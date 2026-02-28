import { Injectable } from '@nestjs/common';

import { MessagesRepository } from '../db/messages.repository';
import { QueueService } from '../queue/queue.service';
import { DiscordIngestPayload } from './ingestion.types';

@Injectable()
export class IngestionService {
  constructor(
    private readonly messagesRepository: MessagesRepository,
    private readonly queueService: QueueService,
  ) {}

  async ingestDiscord(payload: DiscordIngestPayload): Promise<{ messageId: string }> {
    const message = await this.messagesRepository.createMessage({
      platform: payload.platform,
      platformMessageId: payload.message_id,
      userId: payload.user_id,
      username: payload.username,
      channelId: payload.channel_id,
      threadId: payload.thread_id ?? null,
      messageText: payload.text,
    });

    await this.queueService.enqueueClassifyIntent({
      messageId: message.id,
      platformMessageId: payload.message_id,
      userId: payload.user_id,
      username: payload.username,
      channelId: payload.channel_id,
      threadId: payload.thread_id ?? null,
      text: payload.text,
      timestamp: payload.timestamp,
    });

    return { messageId: message.id };
  }
}
