import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { connect, ConsumeMessage } from 'amqplib';
import { randomUUID } from 'node:crypto';
import {
  BINDINGS,
  EXCHANGES,
  EXCHANGE_TYPES,
  EVENTO_CONTENT_TYPE,
  HEADERS,
  QUEUES,
  WORK_QUEUE_ARGUMENTS,
  WORK_QUEUES,
} from './topologia';
import { isMalformedMessageError, MalformedMessageError } from './errors';

type AmqpConnection = Awaited<ReturnType<typeof connect>>;
type AmqpChannel = Awaited<ReturnType<AmqpConnection['createChannel']>>;

export type MessageHandler = (
  payload: unknown,
  raw: string,
  message: ConsumeMessage,
) => Promise<void>;

export interface ConsumeOptions {
  requeueOnError?: boolean;
  parsePayload?: boolean;
}

@Injectable()
export class RabbitMqService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitMqService.name);
  private connection?: AmqpConnection;
  private channel?: AmqpChannel;
  private readonly handlers: Array<{
    queue: string;
    handler: MessageHandler;
    options: ConsumeOptions;
  }> = [];

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    await this.connectWithRetry();
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.channel?.close();
      await this.connection?.close();
    } catch {
      // ignore
    }
  }

  isConnected(): boolean {
    return Boolean(this.channel);
  }

  private get urls(): string[] {
    const configured = this.configService.get<string>('RABBITMQ_URLS');

    if (configured) {
      return configured
        .split(',')
        .map((url) => url.trim())
        .filter(Boolean);
    }

    return [
      this.configService.get<string>(
        'RABBITMQ_URL',
        'amqp://localhost:5672',
      ),
    ];
  }

  private async connectWithRetry(): Promise<void> {
    for (const url of this.urls) {
      try {
        await this.connect(url);
        return;
      } catch (error) {
        this.logger.error(
          `No se pudo conectar a ${url}: ${(error as Error).message}`,
        );
      }
    }

    this.logger.error(
      'No se pudo conectar a ningún nodo de RabbitMQ al arrancar',
    );
  }

  private async connect(url: string): Promise<void> {
    const connection = await connect(url);
    connection.on('error', (error) =>
      this.logger.error(`Error de conexión RabbitMQ: ${error.message}`),
    );
    connection.on('close', () => {
      this.logger.warn('Conexión RabbitMQ cerrada');
      this.channel = undefined;
    });

    const channel = await connection.createChannel();
    this.connection = connection;
    this.channel = channel;

    await this.declareTopology(channel);
    await this.registerConsumers(channel);

    this.logger.log(`Conectado a RabbitMQ en ${url}`);
  }

  private async declareTopology(channel: AmqpChannel): Promise<void> {
    await channel.assertExchange(EXCHANGES.eventos, EXCHANGE_TYPES.eventos, {
      durable: true,
    });
    await channel.assertExchange(EXCHANGES.comandos, EXCHANGE_TYPES.comandos, {
      durable: true,
    });
    await channel.assertExchange(EXCHANGES.dlx, EXCHANGE_TYPES.dlx, {
      durable: true,
    });

    // Las DLQ se declaran antes que las colas de trabajo. Su política de
    // retención (techo alto, sin message-ttl) la aplica el broker por política
    // desde vidalstore-plataforma/scripts/aplicar-politicas.sh, para no tener
    // que redeclarar colas ya existentes.
    await channel.assertQueue(QUEUES.avisosDlq, { durable: true });
    await channel.assertQueue(QUEUES.auditoriaDlq, { durable: true });
    await channel.assertQueue(QUEUES.correosDlq, { durable: true });
    await channel.assertQueue(QUEUES.reprocesosDlq, { durable: true });

    for (const queue of WORK_QUEUES) {
      await channel.assertQueue(queue, {
        durable: true,
        arguments: {
          ...WORK_QUEUE_ARGUMENTS,
          'x-dead-letter-exchange': EXCHANGES.dlx,
          'x-dead-letter-routing-key': queue,
        },
      });
    }

    for (const binding of BINDINGS) {
      await channel.bindQueue(
        binding.queue,
        binding.exchange,
        binding.routingKey,
      );
    }
  }

  private async registerConsumers(channel: AmqpChannel): Promise<void> {
    const configurado = Number(
      this.configService.get<string>('RABBITMQ_PREFETCH', '10'),
    );
    const prefetch = Number.isNaN(configurado) ? 10 : configurado;
    await channel.prefetch(prefetch);

    for (const registration of this.handlers) {
      await channel.consume(
        registration.queue,
        (message) =>
          this.dispatch(channel, registration, message),
        { noAck: false },
      );
    }
  }

  private async dispatch(
    channel: AmqpChannel,
    registration: { queue: string; handler: MessageHandler; options: ConsumeOptions },
    message: ConsumeMessage | null,
  ): Promise<void> {
    if (!message) {
      return;
    }

    const raw = message.content.toString('utf-8');

    try {
      const payload =
        registration.options.parsePayload === false
          ? undefined
          : this.parsePayload(raw);
      await this.runWithRetry(() => registration.handler(payload, raw, message));
      channel.ack(message);
    } catch (error) {
      if (isMalformedMessageError(error)) {
        this.logger.warn(
          `Mensaje mal formado en ${registration.queue}: ${(error as Error).message}. Va a la DLQ.`,
        );
        channel.nack(message, false, false);
        return;
      }

      if (registration.options.requeueOnError) {
        this.logger.error(
          `Error transitorio en ${registration.queue}, se reencola: ${(error as Error).message}`,
        );
        channel.nack(message, false, true);
        return;
      }

      this.logger.error(
        `Se agotaron los reintentos en ${registration.queue}, va a la DLQ: ${(error as Error).message}`,
      );
      channel.nack(message, false, false);
    }
  }

  private parsePayload(raw: string): unknown {
    try {
      return JSON.parse(raw);
    } catch {
      throw new MalformedMessageError('El mensaje no es JSON válido');
    }
  }

  private async runWithRetry<T>(task: () => Promise<T>): Promise<T> {
    const retries = Number(
      this.configService.get<number>('RABBITMQ_TRANSIENT_RETRIES', 3),
    );
    const delayMs = Number(
      this.configService.get<number>('RABBITMQ_TRANSIENT_RETRY_MS', 2000),
    );

    let lastError: unknown;

    for (let attempt = 0; attempt <= retries; attempt += 1) {
      try {
        return await task();
      } catch (error) {
        if (isMalformedMessageError(error)) {
          throw error;
        }

        lastError = error;

        if (attempt < retries) {
          await this.sleep(delayMs);
        }
      }
    }

    throw lastError;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  consume(queue: string, handler: MessageHandler, options: ConsumeOptions = {}) {
    this.handlers.push({ queue, handler, options });
  }

  async publish(
    exchange: string,
    routingKey: string,
    payload: Record<string, unknown>,
    eventoId?: string,
  ): Promise<void> {
    const channel = this.requireChannel();

    const headers = {
      [HEADERS.eventoId]: eventoId ?? randomUUID(),
      [HEADERS.emitidoEn]: new Date().toISOString(),
    };

    channel.publish(exchange, routingKey, Buffer.from(JSON.stringify(payload)), {
      persistent: true,
      contentType: EVENTO_CONTENT_TYPE,
      headers,
    });
  }

  private requireChannel(): AmqpChannel {
    if (!this.channel) {
      throw new Error('Canal de RabbitMQ no disponible');
    }

    return this.channel;
  }
}
