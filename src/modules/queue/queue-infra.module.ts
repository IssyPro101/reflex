import { Module } from '@nestjs/common';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';

import { CFCA_QUEUE_NAME } from '../../common/queue';
import { APP_CONFIG, AppConfig } from '../config/app-config';
import { QueueService } from './queue.service';
import { QueueInfraLifecycle } from './queue-infra.lifecycle';
import { CFCA_QUEUE, REDIS_CONNECTION } from './queue.tokens';

@Module({
  providers: [
    {
      provide: REDIS_CONNECTION,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) =>
        new IORedis(config.REDIS_URL, {
          maxRetriesPerRequest: null,
          enableReadyCheck: true,
        }),
    },
    {
      provide: CFCA_QUEUE,
      inject: [REDIS_CONNECTION],
      useFactory: (connection: IORedis) =>
        new Queue(CFCA_QUEUE_NAME, {
          connection,
        }),
    },
    QueueService,
    QueueInfraLifecycle,
  ],
  exports: [REDIS_CONNECTION, CFCA_QUEUE, QueueService],
})
export class QueueInfraModule {}
