import { Injectable } from '@nestjs/common';

import { MESSAGE_STATUS } from '../../common/status';
import { MessagesRepository } from '../db/messages.repository';
import { DiscordService } from '../discord/discord.service';

@Injectable()
export class AckService {
  static readonly DEFAULT_ACK =
    "Thanks! I've flagged this to the team and we're looking into it ✅";

  constructor(
    private readonly discordService: DiscordService,
    private readonly messagesRepository: MessagesRepository,
  ) {}

  async sendAck(
    messageId: string,
    channelId: string,
    threadId: string | null,
    text: string = AckService.DEFAULT_ACK,
  ): Promise<string> {
    const ackMessageId = await this.discordService.replyToMessage(channelId, threadId, text);

    await this.messagesRepository.setAckMessageId(messageId, ackMessageId);
    await this.messagesRepository.updateStatus(messageId, MESSAGE_STATUS.ACKNOWLEDGED);

    return ackMessageId;
  }
}
