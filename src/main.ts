import 'dotenv/config';
import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';
import express from 'express';

import { AppModule } from './app.module';
import { APP_CONFIG, AppConfig } from './modules/config/app-config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    rawBody: false,
  });

  app.use('/webhooks/github', express.raw({ type: '*/*' }));
  app.use(express.json({ limit: '1mb' }));

  const config = app.get<AppConfig>(APP_CONFIG);
  await app.listen(config.PORT);
}

bootstrap().catch((error: unknown) => {
  // eslint-disable-next-line no-console
  console.error('Failed to bootstrap app', error);
  process.exit(1);
});
