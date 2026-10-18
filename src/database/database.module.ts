import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventoAuditoria } from '../eventos/entities/evento-auditoria.entity';
import { Notificacion } from '../eventos/entities/notificacion.entity';
import { MensajeMuerto } from '../eventos/entities/mensaje-muerto.entity';

export const DB_SCHEMA = 'eventos';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST', 'localhost'),
        port: configService.get<number>('DB_PORT', 5432),
        username: configService.get<string>('DB_USER', 'vidalstore'),
        password: configService.get<string>('DB_PASSWORD', 'vidalstore'),
        database: configService.get<string>('DB_NAME', 'vidalstore'),
        schema: configService.get<string>('DB_SCHEMA', DB_SCHEMA),
        entities: [EventoAuditoria, Notificacion, MensajeMuerto],
        synchronize:
          configService.get<string>('NODE_ENV', 'development') !==
          'production',
      }),
    }),
  ],
})
export class DatabaseModule {}
