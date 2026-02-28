import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import {
  Channel,
  ChannelType,
  Client,
  GatewayIntentBits,
  Message,
  Partials,
  TextBasedChannel,
} from 'discord.js';

import { InjectAppConfig } from '../config/get-config';
import { AppConfig } from '../config/app-config';
import { IngestionService } from '../ingestion/ingestion.service';

@Injectable()
export class DiscordService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DiscordService.name);
  private readonly client: Client;
  private enabled = false;

  constructor(
    @InjectAppConfig() private readonly config: AppConfig,
    private readonly ingestionService: IngestionService,
  ) {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
      ],
      partials: [Partials.Channel],
    });
  }

  async onModuleInit(): Promise<void> {
    if (!this.config.DISCORD_BOT_TOKEN) {
      this.logger.warn('DISCORD_BOT_TOKEN missing; Discord listener disabled');
      return;
    }

    this.client.on('ready', () => {
      this.enabled = true;
      this.logger.log(`Discord client ready as ${this.client.user?.tag ?? 'unknown'}`);
    });

    this.client.on('messageCreate', (message) => {
      void this.handleMessage(message);
    });

    await this.client.login(this.config.DISCORD_BOT_TOKEN);
  }

  async onModuleDestroy(): Promise<void> {
    this.enabled = false;
    await this.client.destroy();
  }

  isReady(): boolean {
    return this.enabled;
  }

  async replyToMessage(
    channelId: string,
    threadId: string | null,
    content: string,
  ): Promise<string> {
    const targetId = threadId ?? channelId;
    const channel = await this.client.channels.fetch(targetId);

    if (!channel || !this.isTextBased(channel)) {
      throw new Error(`Discord channel not writable: ${targetId}`);
    }

    const sent = await channel.send({ content });
    return sent.id;
  }

  private async handleMessage(message: Message): Promise<void> {
    if (message.author.bot) {
      return;
    }

    const content = message.content.trim();
    if (!content) {
      return;
    }

    const threadId =
      message.channel.type === ChannelType.PublicThread ||
      message.channel.type === ChannelType.PrivateThread
        ? message.channel.id
        : null;

    try {
      await this.ingestionService.ingestDiscord({
        platform: 'discord',
        message_id: message.id,
        user_id: message.author.id,
        username: message.author.username,
        channel_id: message.channelId,
        thread_id: threadId,
        text: content,
        timestamp: message.createdAt.toISOString(),
      });
    } catch (error) {
      this.logger.error(
        `Failed to ingest Discord message ${message.id}`,
        error as Error,
      );
    }
  }

  private isTextBased(channel: Channel): channel is TextBasedChannel {
    return channel.isTextBased();
  }
}
