import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConsumeMessage } from 'amqplib';
import { Repository } from 'typeorm';
import { MensajeMuerto } from '../entities/mensaje-muerto.entity';
import { QUEUES, HEADERS } from '../../mensajeria/topologia';
import { RabbitMqService } from '../../mensajeria/rabbitmq.service';

interface XDeathEntry {
  count?: number;
  reason?: string;
  queue?: string;
  exchange?: string;
  'routing-keys'?: string[];
}

@Injectable()
export class MensajesMuertosConsumer {
  private readonly logger = new Logger(MensajesMuertosConsumer.name);
  private readonly colas = [
    QUEUES.avisosDlq,
    QUEUES.auditoriaDlq,
    QUEUES.correosDlq,
    QUEUES.reprocesosDlq,
  ];

  constructor(
    private readonly rabbit: RabbitMqService,
    @InjectRepository(MensajeMuerto)
    private readonly repository: Repository<MensajeMuerto>,
  ) {
    for (const cola of this.colas) {
      this.rabbit.consume(
        cola,
        (_payload, raw, message) => this.handle(raw, message),
        { requeueOnError: true, parsePayload: false },
      );
    }
  }

  private async handle(raw: string, message: ConsumeMessage): Promise<void> {
    const death = this.readDeath(message);
    const headers = message.properties.headers ?? {};
    const eventoIdHeader = headers[HEADERS.eventoId];

    const colaOrigen = death?.queue ?? message.fields.routingKey;
    const routingKey =
      death?.['routing-keys']?.[0] ?? message.fields.routingKey;
    const exchangeOrigen = death?.exchange ?? message.fields.exchange ?? null;
    const motivo = death?.reason ?? 'desconocido';
    const intentos = typeof death?.count === 'number' ? death.count : 0;

    this.logger.warn(
      `Mensaje muerto: colaOrigen=${colaOrigen} routingKey=${routingKey} motivo=${motivo} intentos=${intentos}`,
    );

    await this.repository.save(
      this.repository.create({
        colaOrigen,
        exchangeOrigen,
        routingKey,
        eventoId:
          typeof eventoIdHeader === 'string' ? eventoIdHeader : null,
        motivo,
        intentos,
        payload: raw,
        recibidoEn: new Date(),
        reprocesadoEn: null,
        reprocesadoPor: null,
      }),
    );
  }

  private readDeath(message: ConsumeMessage): XDeathEntry | undefined {
    const headers = message.properties.headers ?? {};
    const xDeath = headers['x-death'];

    if (!Array.isArray(xDeath) || xDeath.length === 0) {
      return undefined;
    }

    return xDeath[xDeath.length - 1] as XDeathEntry;
  }
}
