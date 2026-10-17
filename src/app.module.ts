import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { MensajeriaModule } from './mensajeria/mensajeria.module';
import { EventosModule } from './eventos/eventos.module';
import { HealthController } from './health/health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    DatabaseModule,
    MensajeriaModule,
    EventosModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
