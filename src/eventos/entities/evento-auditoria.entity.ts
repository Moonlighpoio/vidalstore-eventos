import {
  Column,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('eventos_auditoria')
@Index('uq_eventos_auditoria_evento_id', ['eventoId'], { unique: true })
@Index('idx_eventos_auditoria_routing_recibido', ['routingKey', 'recibidoEn'])
export class EventoAuditoria {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'routing_key', type: 'varchar', length: 128 })
  routingKey: string;

  @Column({ name: 'evento_id', type: 'varchar', length: 64 })
  eventoId: string;

  @Column({ name: 'usuario_sub', type: 'varchar', length: 128, nullable: true })
  usuarioSub: string | null;

  @Column({ type: 'jsonb' })
  payload: Record<string, unknown>;

  @Column({ name: 'emitido_en', type: 'timestamptz' })
  emitidoEn: Date;

  @Column({ name: 'recibido_en', type: 'timestamptz' })
  recibidoEn: Date;
}
