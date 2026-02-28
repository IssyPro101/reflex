import { Module } from '@nestjs/common';
import { Queue } from 'bullmq';

import { CFCA_QUEUE_NAME } from '../../common/queue';
import { APP_CONFIG, AppConfig } from '../config/app-config';
import { QueueService } from './queue.service';
import { CFCA_QUEUE, REDIS_CONNECTION } from './queue.tokens';

@Module({
  providers: [
    {
      provide: REDIS_CONNECTION,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => ({
        url: config.REDIS_URL,
      }),
    },
    {
      provide: CFCA_QUEUE,
      inject: [REDIS_CONNECTION],
      useFactory: (connection: { url: string }) =>
        new Queue(CFCA_QUEUE_NAME, {
          connection,
        }),
    },
    QueueService,
  ],
  exports: [REDIS_CONNECTION, CFCA_QUEUE, QueueService],
})
export class QueueInfraModule {}
