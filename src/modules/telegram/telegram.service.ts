import { Injectable, Logger } from '@nestjs/common';
import TelegramBot from 'node-telegram-bot-api';

import { InjectAppConfig } from '../config/get-config';
import { AppConfig } from '../config/app-config';
import { NotifyTelegramJob } from '../queue/jobs';

@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);
  private readonly bot: TelegramBot | null;
  private readonly chatId: string | null;

  constructor(@InjectAppConfig() config: AppConfig) {
    if (!config.TELEGRAM_BOT_TOKEN || !config.TELEGRAM_CHAT_ID) {
      this.bot = null;
      this.chatId = null;
      this.logger.warn('Telegram notifier disabled (missing token or chat id)');
      return;
    }

    this.bot = new TelegramBot(config.TELEGRAM_BOT_TOKEN);
    this.chatId = config.TELEGRAM_CHAT_ID;
  }

  isReady(): boolean {
    return Boolean(this.bot && this.chatId);
  }

  async notify(job: NotifyTelegramJob): Promise<void> {
    if (!this.bot || !this.chatId) {
      this.logger.warn('Skipping Telegram notification because notifier is disabled');
      return;
    }

    const message = this.formatMessage(job);
    await this.bot.sendMessage(this.chatId, message);
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
