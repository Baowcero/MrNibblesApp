// Business days and cut-offs are Africa/Lagos.
process.env.TZ ??= 'Africa/Lagos';

import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

try {
  process.loadEnvFile('.env'); // Node 20.12+; no extra package needed
} catch {
  // No .env file: rely on real environment variables (production).
}

const { AppModule } = await import('./app.module.js');

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true }) // raw body is needed to check Paystack's signature;
  app.setGlobalPrefix('v1');
  app.enableCors({ origin: true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  await app.listen(process.env.PORT ?? 4000);
}
await bootstrap();
