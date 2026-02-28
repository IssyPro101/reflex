import { Injectable, Logger } from '@nestjs/common';

import { MESSAGE_STATUS, PR_STATUS } from '../../common/status';
import { ComplaintsRepository } from '../db/complaints.repository';
import { MessagesRepository } from '../db/messages.repository';
import { PrsRepository } from '../db/prs.repository';
import { DiscordService } from '../discord/discord.service';

@Injectable()
export class FollowUpService {
  private readonly logger = new Logger(FollowUpService.name);

  constructor(
    private readonly prsRepository: PrsRepository,
    private readonly complaintsRepository: ComplaintsRepository,
    private readonly messagesRepository: MessagesRepository,
    private readonly discordService: DiscordService,
  ) {}

  async handleMergedPr(prNumber: number, repo: string): Promise<boolean> {
    const pr = await this.prsRepository.getByNumberAndRepo(prNumber, repo);
    if (!pr) {
      this.logger.warn(`No PR row found for ${repo}#${prNumber}`);
      return false;
    }

    await this.prsRepository.setStatus(pr.id, PR_STATUS.MERGED);

    const complaint = await this.complaintsRepository.getByPrId(pr.id);
    if (!complaint) {
      this.logger.warn(`No complaint row found for pr_id ${pr.id}`);
      return false;
    }

    const message = await this.messagesRepository.findById(complaint.message_id);
    if (!message) {
      this.logger.warn(`No message row found for complaint ${complaint.id}`);
      return false;
    }

    await this.discordService.replyToMessage(
      message.channel_id,
      message.thread_id,
      '✅ This issue has been fixed and merged! Thanks for helping improve the product.',
    );

    await this.complaintsRepository.setResolved(complaint.id);
    await this.messagesRepository.updateStatus(message.id, MESSAGE_STATUS.FOLLOWED_UP);

    return true;
  }
}
