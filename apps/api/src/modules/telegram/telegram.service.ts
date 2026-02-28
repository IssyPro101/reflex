import { Injectable, Logger } from '@nestjs/common';
import TelegramBot from 'node-telegram-bot-api';

import { InjectAppConfig } from '../config/get-config';
import { AppConfig } from '../config/app-config';
import { UserConnectionsRepository } from '../db/user-connections.repository';
import { NotifyTelegramJob } from '../queue/jobs';

@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);
  private readonly bot: TelegramBot | null;

  constructor(
    @InjectAppConfig() config: AppConfig,
    private readonly userConnectionsRepository: UserConnectionsRepository,
  ) {
    if (!config.TELEGRAM_BOT_TOKEN) {
      this.bot = null;
      this.logger.warn('Telegram notifier disabled (missing bot token)');
      return;
    }

    this.bot = new TelegramBot(config.TELEGRAM_BOT_TOKEN);
  }

  isReady(): boolean {
    return Boolean(this.bot);
  }

  async notify(job: NotifyTelegramJob): Promise<void> {
    if (!this.bot) {
      this.logger.warn('Skipping Telegram notification because notifier is disabled');
      return;
    }
    if (!job.supabaseUserId) {
      this.logger.warn('Skipping Telegram notification: missing supabaseUserId');
      return;
    }

    const connection = await this.userConnectionsRepository.getBySupabaseUserId(job.supabaseUserId);
    if (!connection?.telegram_chat_id) {
      this.logger.warn(
        `Skipping Telegram notification: missing telegram chat id for user ${job.supabaseUserId}`,
      );
      return;
    }

    const message = this.formatMessage(job);
    await this.bot.sendMessage(connection.telegram_chat_id, message);
  }

  private formatMessage(job: NotifyTelegramJob): string {
    if (job.type === 'pr_created') {
      return [
        '🚨 PR Created',
        `Fix: ${String(job.payload.summary ?? 'n/a')}`,
        `Source: ${String(job.payload.source ?? 'Discord')}`,
        `User: ${String(job.payload.username ?? 'unknown')}`,
        `PR: ${String(job.payload.prUrl ?? 'n/a')}`,
      ].join('\n');
    }

    return [
      '⚠️ PR Creation Failed',
      `Fix: ${String(job.payload.summary ?? 'n/a')}`,
      `Reason: ${String(job.payload.reason ?? 'unknown')}`,
      `User: ${String(job.payload.username ?? 'unknown')}`,
    ].join('\n');
  }
}
