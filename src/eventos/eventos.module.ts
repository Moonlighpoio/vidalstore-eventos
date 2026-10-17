import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventoAuditoria } from './entities/evento-auditoria.entity';
import { Notificacion } from './entities/notificacion.entity';
import { MensajeMuerto } from './entities/mensaje-muerto.entity';
import { AuditoriaConsumer } from './consumers/auditoria.consumer';
import { AvisosConsumer } from './consumers/avisos.consumer';
import { CorreosConsumer } from './consumers/correos.consumer';
import { MensajesMuertosConsumer } from './consumers/mensajes-muertos.consumer';
import { ReprocesosConsumer } from './consumers/reprocesos.consumer';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      EventoAuditoria,
      Notificacion,
      MensajeMuerto,
    ]),
  ],
  providers: [
    AuditoriaConsumer,
    AvisosConsumer,
    CorreosConsumer,
    MensajesMuertosConsumer,
    ReprocesosConsumer,
  ],
})
export class EventosModule {}
