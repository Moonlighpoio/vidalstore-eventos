import { Controller, Get } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { RabbitMqService } from '../mensajeria/rabbitmq.service';

@Controller('salud')
export class HealthController {
  constructor(
    private readonly rabbit: RabbitMqService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  @Get()
  async check() {
    const broker = this.rabbit.isConnected();
    const postgres = await this.checkPostgres();

    return {
      status: broker && postgres ? 'ok' : 'degradado',
      broker,
      postgres,
      timestamp: new Date().toISOString(),
    };
  }

  private async checkPostgres(): Promise<boolean> {
    try {
      await this.dataSource.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }
}
