import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { Job, Queue } from 'bullmq';

import { CFCA_QUEUE_NAME, JOB_NAMES } from '../../common/queue';
import {
  ClassifyIntentJob,
  FollowUpUserJob,
  NotifyTelegramJob,
  ReplyAckJob,
} from './jobs';
import { CFCA_QUEUE } from './queue.tokens';

@Injectable()
export class QueueService implements OnModuleDestroy {
  constructor(@Inject(CFCA_QUEUE) private readonly queue: Queue) {}

  async enqueueClassifyIntent(data: ClassifyIntentJob): Promise<Job<ClassifyIntentJob>> {
    return this.queue.add(JOB_NAMES.CLASSIFY_INTENT, data, {
      removeOnComplete: true,
      removeOnFail: false,
      attempts: 2,
      backoff: { type: 'exponential', delay: 1000 },
    });
  }

  async enqueueReplyAck(data: ReplyAckJob): Promise<Job<ReplyAckJob>> {
    return this.queue.add(JOB_NAMES.REPLY_ACK, data, {
      removeOnComplete: true,
      removeOnFail: false,
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
    });
  }

  async enqueueTelegram(data: NotifyTelegramJob): Promise<Job<NotifyTelegramJob>> {
    return this.queue.add(JOB_NAMES.NOTIFY_TELEGRAM, data, {
      removeOnComplete: true,
      removeOnFail: false,
      attempts: 3,
      backoff: { type: 'exponential', delay: 1500 },
    });
  }

  async enqueueFollowUp(data: FollowUpUserJob): Promise<Job<FollowUpUserJob>> {
    return this.queue.add(JOB_NAMES.FOLLOW_UP_USER, data, {
      removeOnComplete: true,
      removeOnFail: false,
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
    });
  }

  async ping(): Promise<boolean> {
    try {
      await this.queue.getJobCounts();
      return true;
    } catch {
      return false;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue.close();
  }

  getQueueName(): string {
    return CFCA_QUEUE_NAME;
  }
}
