import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Job, Worker } from 'bullmq';
import IORedis from 'ioredis';

import { JOB_NAMES } from '../../common/queue';
import { InjectAppConfig } from '../config/get-config';
import { AppConfig } from '../config/app-config';
import { JobHandlersService } from './job-handlers.service';
import {
  ClassifyIntentJob,
  CreatePrJob,
  FollowUpUserJob,
  NotifyTelegramJob,
  ReplyAckJob,
} from './jobs';
import { QueueService } from './queue.service';
import { REDIS_CONNECTION } from './queue.tokens';

@Injectable()
export class WorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WorkerService.name);
  private worker: Worker | null = null;

  constructor(
    @InjectAppConfig() private readonly config: AppConfig,
    @Inject(REDIS_CONNECTION) private readonly redis: IORedis,
    private readonly queueService: QueueService,
    private readonly handlers: JobHandlersService,
  ) {}

  async onModuleInit(): Promise<void> {
    if (!this.config.QUEUE_WORKERS_ENABLED) {
      this.logger.log('Queue workers disabled by configuration');
      return;
    }

    this.worker = new Worker(
      this.queueService.getQueueName(),
      async (job: Job) => this.processJob(job),
      {
        connection: this.redis,
        concurrency: 3,
      },
    );

    this.worker.on('failed', (job, error) => {
      this.logger.error(`Job failed: ${job?.name ?? 'unknown'}`, error);
    });

    this.worker.on('completed', (job) => {
      this.logger.log(`Job completed: ${job.name}`);
    });
  }

  async onModuleDestroy(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
    }
  }

  private async processJob(job: Job): Promise<void> {
    switch (job.name) {
      case JOB_NAMES.CLASSIFY_INTENT:
        await this.handlers.handleClassifyIntent(job.data as ClassifyIntentJob);
        return;
      case JOB_NAMES.REPLY_ACK:
        await this.handlers.handleReplyAck(job.data as ReplyAckJob);
        return;
      case JOB_NAMES.CREATE_PR:
        await this.handlers.handleCreatePr(job.data as CreatePrJob);
        return;
      case JOB_NAMES.NOTIFY_TELEGRAM:
        await this.handlers.handleNotifyTelegram(job.data as NotifyTelegramJob);
        return;
      case JOB_NAMES.FOLLOW_UP_USER:
        await this.handlers.handleFollowUpUser(job.data as FollowUpUserJob);
        return;
      default:
        throw new Error(`Unsupported job name: ${job.name}`);
    }
  }
}
