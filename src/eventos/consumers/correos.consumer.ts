import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConsumeMessage } from 'amqplib';
import { Repository } from 'typeorm';
import { Notificacion } from '../entities/notificacion.entity';
import { QUEUES } from '../../mensajeria/topologia';
import { RabbitMqService } from '../../mensajeria/rabbitmq.service';
import { isUniqueViolation } from '../../mensajeria/errors';
import { requireString } from '../payload.util';

@Injectable()
export class CorreosConsumer {
  private readonly logger = new Logger(CorreosConsumer.name);

  constructor(
    private readonly rabbit: RabbitMqService,
    @InjectRepository(Notificacion)
    private readonly repository: Repository<Notificacion>,
  ) {
    this.rabbit.consume(QUEUES.correos, (payload, _raw, message) =>
      this.handle(payload, message),
    );
  }

  private async handle(
    payload: unknown,
    _message: ConsumeMessage,
  ): Promise<void> {
    const data = (payload ?? {}) as Record<string, unknown>;

    const para = requireString(data, 'para');
    const asunto = requireString(data, 'asunto');
    const cuerpo = requireString(data, 'cuerpo');
    const origen = requireString(data, 'origen');
    const eventoId =
      typeof data.eventoId === 'string' && data.eventoId.length > 0
        ? data.eventoId
        : null;

    // El envío se simula: basta un log claro.
    this.logger.log(
      `Correo enviado -> para=${para} asunto="${asunto}" cuerpo="${cuerpo}" (origen ${origen})`,
    );

    try {
      await this.repository.save(
        this.repository.create({
          para,
          asunto,
          estado: 'enviada',
          eventoId,
          creadaEn: new Date(),
        }),
      );
    } catch (error) {
      if (isUniqueViolation(error)) {
        this.logger.warn(
          `Aviso ya registrado para el evento ${eventoId} ("${asunto}"); no se duplica (idempotencia)`,
        );
        return;
      }

      throw error;
    }
  }
}
