import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConsumeMessage } from 'amqplib';
import { Repository } from 'typeorm';
import { EventoAuditoria } from '../entities/evento-auditoria.entity';
import { QUEUES } from '../../mensajeria/topologia';
import { RabbitMqService } from '../../mensajeria/rabbitmq.service';
import { isUniqueViolation } from '../../mensajeria/errors';
import { readEventHeaders } from '../payload.util';

@Injectable()
export class AuditoriaConsumer {
  private readonly logger = new Logger(AuditoriaConsumer.name);

  constructor(
    private readonly rabbit: RabbitMqService,
    @InjectRepository(EventoAuditoria)
    private readonly repository: Repository<EventoAuditoria>,
  ) {
    this.rabbit.consume(QUEUES.auditoria, (payload, _raw, message) =>
      this.handle(payload, message),
    );
  }

  private async handle(
    payload: unknown,
    message: ConsumeMessage,
  ): Promise<void> {
    const headers = readEventHeaders(message);
    const routingKey = message.fields.routingKey;
    const data = (payload ?? {}) as Record<string, unknown>;

    const evento = this.repository.create({
      routingKey,
      eventoId: headers.eventoId,
      usuarioSub:
        typeof data.usuarioSub === 'string' ? data.usuarioSub : null,
      payload: data,
      emitidoEn: headers.emitidoEn ? new Date(headers.emitidoEn) : new Date(),
      recibidoEn: new Date(),
    });

    try {
      await this.repository.save(evento);
      this.logger.log(`Auditoría guardada: ${routingKey} (${headers.eventoId})`);
    } catch (error) {
      if (isUniqueViolation(error)) {
        this.logger.warn(
          `Evento ${headers.eventoId} ya auditado; se descarta duplicado (idempotencia)`,
        );
        return;
      }

      throw error;
    }
  }
}
