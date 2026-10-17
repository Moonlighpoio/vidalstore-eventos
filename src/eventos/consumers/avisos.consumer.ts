import { Injectable, Logger } from '@nestjs/common';
import { ConsumeMessage } from 'amqplib';
import {
  EXCHANGES,
  QUEUES,
  ROUTING_KEYS,
} from '../../mensajeria/topologia';
import { RabbitMqService } from '../../mensajeria/rabbitmq.service';
import { readEventHeaders, requireString } from '../payload.util';

@Injectable()
export class AvisosConsumer {
  private readonly logger = new Logger(AvisosConsumer.name);

  constructor(private readonly rabbit: RabbitMqService) {
    this.rabbit.consume(QUEUES.avisos, (payload, _raw, message) =>
      this.handle(payload, message),
    );
  }

  private async handle(
    payload: unknown,
    message: ConsumeMessage,
  ): Promise<void> {
    const routingKey = message.fields.routingKey;
    const { eventoId } = readEventHeaders(message);
    const data = (payload ?? {}) as Record<string, unknown>;

    if (routingKey === ROUTING_KEYS.licenciaRevocada) {
      await this.avisar(data, routingKey, eventoId, {
        asunto: 'Tu licencia fue revocada',
        cuerpo: (juegoId) =>
          `La licencia del juego ${juegoId} fue revocada por un administrador.`,
      });
      return;
    }

    if (routingKey === ROUTING_KEYS.compraRealizada) {
      await this.avisar(data, routingKey, eventoId, {
        asunto: 'Gracias por tu compra',
        cuerpo: (juegoId) =>
          `Tu compra del juego ${juegoId} quedó registrada en tu biblioteca.`,
      });
      return;
    }

    this.logger.debug(`Evento ${routingKey} no amerita aviso`);
  }

  private async avisar(
    data: Record<string, unknown>,
    origen: string,
    eventoId: string,
    plantilla: { asunto: string; cuerpo: (juegoId: string) => string },
  ): Promise<void> {
    const usuarioSub = requireString(data, 'usuarioSub');
    const juegoId = requireString(data, 'juegoId');

    await this.rabbit.publish(
      EXCHANGES.comandos,
      ROUTING_KEYS.correoEnviar,
      {
        para: usuarioSub,
        asunto: plantilla.asunto,
        cuerpo: plantilla.cuerpo(juegoId),
        origen,
        eventoId,
      },
    );

    this.logger.log(
      `Aviso emitido (${origen}) para ${usuarioSub} del juego ${juegoId}`,
    );
  }
}
