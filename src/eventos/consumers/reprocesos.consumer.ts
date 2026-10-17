import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { Repository } from 'typeorm';
import { MensajeMuerto } from '../entities/mensaje-muerto.entity';
import { QUEUES } from '../../mensajeria/topologia';
import { RabbitMqService } from '../../mensajeria/rabbitmq.service';
import { MalformedMessageError } from '../../mensajeria/errors';
import { requireString } from '../payload.util';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Reproceso controlado de un mensaje muerto (4.9, grupos de 3).
 *
 * vidalstore-admin publica el comando dlq.reprocesar con { mensajeMuertoId,
 * payloadCorregido?, solicitadoPor }. Este consumidor, dueño de la tabla
 * mensajes_muertos, republica el evento original —o el corregido— en su
 * exchange y routing key originales, conservando el x-evento-id para que la
 * auditoría siga siendo idempotente, y marca la fila como reprocesada.
 */
@Injectable()
export class ReprocesosConsumer {
  private readonly logger = new Logger(ReprocesosConsumer.name);

  constructor(
    private readonly rabbit: RabbitMqService,
    @InjectRepository(MensajeMuerto)
    private readonly repository: Repository<MensajeMuerto>,
  ) {
    this.rabbit.consume(QUEUES.reprocesos, (payload) => this.handle(payload));
  }

  private async handle(payload: unknown): Promise<void> {
    const data = (payload ?? {}) as Record<string, unknown>;

    const mensajeMuertoId = requireString(data, 'mensajeMuertoId');
    const solicitadoPor = requireString(data, 'solicitadoPor');

    const fila = await this.repository.findOne({
      where: { id: mensajeMuertoId },
    });

    if (!fila) {
      throw new MalformedMessageError(
        `No existe el mensaje muerto ${mensajeMuertoId}`,
      );
    }

    if (!fila.exchangeOrigen || !fila.routingKey) {
      throw new MalformedMessageError(
        `La fila ${mensajeMuertoId} no tiene exchange o routing key de origen`,
      );
    }

    const eventoId = this.resolveEventoId(fila);

    // Si hubo que generar el x-evento-id, se persiste antes de republicar para
    // que todos los reprocesos de esta fila reutilicen el mismo identificador.
    await this.repository.save(fila);

    const cuerpo = this.resolvePayload(fila, data.payloadCorregido);

    await this.rabbit.publish(
      fila.exchangeOrigen,
      fila.routingKey,
      cuerpo,
      eventoId,
    );

    fila.reprocesadoEn = new Date();
    fila.reprocesadoPor = solicitadoPor;
    await this.repository.save(fila);

    this.logger.log(
      `Reprocesado ${mensajeMuertoId} -> ${fila.exchangeOrigen}/${fila.routingKey} (evento ${eventoId}) por ${solicitadoPor}`,
    );
  }

  private resolveEventoId(fila: MensajeMuerto): string {
    if (fila.eventoId && UUID_PATTERN.test(fila.eventoId)) {
      return fila.eventoId;
    }

    // El mensaje venía roto (sin x-evento-id o inválido): se genera uno y se
    // guarda en la fila para que todos los reprocesos reutilicen el mismo.
    const generado = randomUUID();
    fila.eventoId = generado;
    return generado;
  }

  private resolvePayload(
    fila: MensajeMuerto,
    payloadCorregido: unknown,
  ): Record<string, unknown> {
    if (payloadCorregido !== undefined) {
      if (
        typeof payloadCorregido !== 'object' ||
        payloadCorregido === null ||
        Array.isArray(payloadCorregido)
      ) {
        throw new MalformedMessageError(
          'payloadCorregido debe ser un objeto JSON',
        );
      }

      return payloadCorregido as Record<string, unknown>;
    }

    try {
      const parsed = JSON.parse(fila.payload) as unknown;

      if (
        typeof parsed !== 'object' ||
        parsed === null ||
        Array.isArray(parsed)
      ) {
        throw new MalformedMessageError(
          'El payload original no es un objeto JSON; se requiere payloadCorregido',
        );
      }

      return parsed as Record<string, unknown>;
    } catch (error) {
      if (error instanceof MalformedMessageError) {
        throw error;
      }

      throw new MalformedMessageError(
        'El payload original no es JSON válido; se requiere payloadCorregido',
      );
    }
  }
}
