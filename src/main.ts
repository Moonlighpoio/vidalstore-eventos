import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 3010);

  await app.listen(port);

  console.log(`vidalstore-eventos (consumidores) escuchando en ${port}`);
}

bootstrap().catch((error) => {
  console.error('Fallo al arrancar vidalstore-eventos', error);
  process.exit(1);
});
