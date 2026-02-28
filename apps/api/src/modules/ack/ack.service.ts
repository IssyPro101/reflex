import { Injectable, Logger } from '@nestjs/common';

import { MESSAGE_STATUS } from '../../common/status';
import { MessagesRepository } from '../db/messages.repository';
import { DiscordService } from '../discord/discord.service';

@Injectable()
export class AckService {
  private readonly logger = new Logger(AckService.name);

  static readonly DEFAULT_ACK =
    "Thanks! I've flagged this to the team and we're looking into it ✅";

  constructor(
    private readonly discordService: DiscordService,
    private readonly messagesRepository: MessagesRepository,
  ) {}

  async sendAck(
    messageId: string,
    platformMessageId: string,
    channelId: string,
    threadId: string | null,
    text: string = AckService.DEFAULT_ACK,
  ): Promise<string | null> {
    const message = await this.messagesRepository.findById(messageId);
    if (message?.ack_message_id) {
      this.logger.warn(`Message ${messageId} already acknowledged, skipping duplicate reply`);
      return message.ack_message_id;
    }

    const ackMessageId = await this.discordService.replyToMessage(
      channelId,
      threadId,
      text,
      platformMessageId,
    );

    await this.messagesRepository.setAckMessageId(messageId, ackMessageId);
    await this.messagesRepository.updateStatus(messageId, MESSAGE_STATUS.ACKNOWLEDGED);

    return ackMessageId;
  }
}
