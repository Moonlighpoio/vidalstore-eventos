import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('mensajes_muertos')
export class MensajeMuerto {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'cola_origen', type: 'varchar', length: 128 })
  colaOrigen: string;

  @Column({ name: 'exchange_origen', type: 'varchar', length: 128, nullable: true })
  exchangeOrigen: string | null;

  @Column({ name: 'routing_key', type: 'varchar', length: 128, nullable: true })
  routingKey: string | null;

  @Column({ name: 'evento_id', type: 'varchar', length: 64, nullable: true })
  eventoId: string | null;

  @Column({ type: 'varchar', length: 256 })
  motivo: string;

  @Column({ type: 'integer', default: 0 })
  intentos: number;

  @Column({ type: 'text' })
  payload: string;

  @Column({ name: 'recibido_en', type: 'timestamptz' })
  recibidoEn: Date;

  @Column({ name: 'reprocesado_en', type: 'timestamptz', nullable: true })
  reprocesadoEn: Date | null;

  @Column({ name: 'reprocesado_por', type: 'varchar', length: 128, nullable: true })
  reprocesadoPor: string | null;
}
