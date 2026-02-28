import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import IORedis from 'ioredis';

import { REDIS_CONNECTION } from './queue.tokens';

@Injectable()
export class QueueInfraLifecycle implements OnModuleDestroy {
  constructor(@Inject(REDIS_CONNECTION) private readonly redis: IORedis) {}

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
  }
}
