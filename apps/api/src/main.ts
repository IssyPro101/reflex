import 'dotenv/config';
import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';
import { APP_CONFIG, AppConfig } from './modules/config/app-config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    rawBody: true,
    bodyParser: true,
  });

  const config = app.get<AppConfig>(APP_CONFIG);
  app.enableCors({
    origin: config.FRONTEND_URL,
    credentials: true,
  });
  await app.listen(config.PORT);
}

bootstrap().catch((error: unknown) => {
  // eslint-disable-next-line no-console
  console.error('Failed to bootstrap app', error);
  process.exit(1);
});
