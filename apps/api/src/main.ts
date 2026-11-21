// Business days and cut-offs are Africa/Lagos.
process.env.TZ ??= 'Africa/Lagos';

import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';

try {
  process.loadEnvFile('.env'); // Node 20.12+; no extra package needed
} catch {
  // No .env file: rely on real environment variables (production).
}

const { AppModule } = await import('./app.module.js');
const { RateLimiter } = await import('./common/rate-limit.js');
const { checkEnvironment, corsOptions, ipFloodLimit, securityHeaders, trustProxySetting } = await import('./common/security.js');

async function bootstrap() {
  checkEnvironment(); // in production a weak or missing setting stops the start-up
  // rawBody is needed to check Paystack's webhook signature
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });
  // Delivery photos are sent as the raw image body
  app.useBodyParser('raw', { type: ['image/jpeg', 'image/png', 'image/webp'], limit: '8mb' });
  app.disable('x-powered-by');
  app.set('trust proxy', trustProxySetting()); // the real client IP behind a load balancer, for rate limits
  app.use(securityHeaders);
  app.use(ipFloodLimit(app.get(RateLimiter)));
  app.setGlobalPrefix('v1');
  app.enableCors(corsOptions());
  app.enableShutdownHooks(); // finish current requests when the server restarts
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  await app.listen(process.env.PORT ?? 4000);
}
await bootstrap();
