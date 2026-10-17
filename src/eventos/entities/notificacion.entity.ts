import {
  Check,
  Column,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('notificaciones')
@Check('chk_notificaciones_estado', `estado IN ('enviada','fallida')`)
@Index('uq_notificaciones_aviso', ['eventoId', 'asunto'], { unique: true })
export class Notificacion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 256 })
  para: string;

  @Column({ type: 'varchar', length: 256 })
  asunto: string;

  @Column({ type: 'varchar', length: 16 })
  estado: 'enviada' | 'fallida';

  @Column({ name: 'evento_id', type: 'varchar', length: 64, nullable: true })
  eventoId: string | null;

  @Column({ name: 'creada_en', type: 'timestamptz' })
  creadaEn: Date;
}
