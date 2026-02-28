import { Injectable } from '@nestjs/common';

import { DbService } from '../db/db.service';
import { DiscordService } from '../discord/discord.service';
import { QueueService } from '../queue/queue.service';
import { TelegramService } from '../telegram/telegram.service';

@Injectable()
export class HealthService {
  constructor(
    private readonly dbService: DbService,
    private readonly queueService: QueueService,
    private readonly discordService: DiscordService,
    private readonly telegramService: TelegramService,
  ) {}

  async getHealth(): Promise<Record<string, unknown>> {
    const [db, redis] = await Promise.all([
      this.dbService.ping(),
      this.queueService.ping(),
    ]);

    return {
      status: db && redis ? 'ok' : 'degraded',
      dependencies: {
        db,
        redis,
      },
      integrations: {
        discord: this.discordService.isReady(),
        telegram: this.telegramService.isReady(),
      },
      queue: {
        name: this.queueService.getQueueName(),
      },
      timestamp: new Date().toISOString(),
    };
  }
}
