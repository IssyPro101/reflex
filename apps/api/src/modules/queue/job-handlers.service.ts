import { Injectable, Logger } from '@nestjs/common';

import { MESSAGE_STATUS, PR_STATUS } from '../../common/status';
import { AckService } from '../ack/ack.service';
import { InjectAppConfig } from '../config/get-config';
import { AppConfig } from '../config/app-config';
import { ComplaintsRepository } from '../db/complaints.repository';
import { MessagesRepository } from '../db/messages.repository';
import { PrsRepository } from '../db/prs.repository';
import { FollowUpService } from '../followup/followup.service';
import { TelegramService } from '../telegram/telegram.service';
import { isActionableIntent } from '../triage/triage.types';
import { TriageService } from '../triage/triage.service';
import { extractPrNumber } from '../vibe/vibe-output';
import { VibeService } from '../vibe/vibe.service';
import {
  ClassifyIntentJob,
  CreatePrJob,
  FollowUpUserJob,
  NotifyTelegramJob,
  ReplyAckJob,
} from './jobs';
import { QueueService } from './queue.service';

@Injectable()
export class JobHandlersService {
  private readonly logger = new Logger(JobHandlersService.name);

  constructor(
    @InjectAppConfig() private readonly config: AppConfig,
    private readonly triageService: TriageService,
    private readonly messagesRepository: MessagesRepository,
    private readonly complaintsRepository: ComplaintsRepository,
    private readonly prsRepository: PrsRepository,
    private readonly queueService: QueueService,
    private readonly ackService: AckService,
    private readonly vibeService: VibeService,
    private readonly telegramService: TelegramService,
    private readonly followUpService: FollowUpService,
  ) {}

  async handleClassifyIntent(job: ClassifyIntentJob): Promise<void> {
    const triage = await this.triageService.classify(job.text);
    const actionable = isActionableIntent(triage.intent);

    const complaint = await this.complaintsRepository.upsertFromTriage({
      messageId: job.messageId,
      intent: triage.intent,
      confidence: triage.confidence,
      severity: triage.severity,
      summary: triage.summary,
      actionable,
    });

    await this.messagesRepository.updateStatus(job.messageId, MESSAGE_STATUS.CLASSIFIED);

    if (!actionable) {
      return;
    }

    await this.queueService.enqueueReplyAck({
      messageId: job.messageId,
      channelId: job.channelId,
      threadId: job.threadId,
      ackText: AckService.DEFAULT_ACK,
    });

    await this.queueService.enqueueCreatePr({
      complaintId: complaint.id,
      messageId: job.messageId,
      summary: triage.summary,
      originalMessage: job.text,
      repoUrl: this.config.TARGET_REPO_URL,
      baseBranch: this.config.TARGET_BASE_BRANCH,
      username: job.username,
      githubToken: this.config.GITHUB_FALLBACK_TOKEN,
    });
  }

  async handleReplyAck(job: ReplyAckJob): Promise<void> {
    await this.ackService.sendAck(job.messageId, job.channelId, job.threadId, job.ackText);
  }

  async handleCreatePr(job: CreatePrJob): Promise<void> {
    const vibeResult = await this.vibeService.createPr({
      summary: job.summary,
      originalMessage: job.originalMessage,
      repoUrl: job.repoUrl,
      baseBranch: job.baseBranch,
      githubToken: job.githubToken,
    });
    const repoIdentifier = this.resolveRepoIdentifier(
      job.repoUrl,
      vibeResult.prUrl,
    );

    if (vibeResult.status !== 'success') {
      await this.complaintsRepository.setNeedsManual(job.complaintId, vibeResult.reason);

      const blockedPrNumber =
        vibeResult.prUrl && vibeResult.status === 'blocked'
          ? extractPrNumber(vibeResult.prUrl)
          : null;

      if (blockedPrNumber && vibeResult.prUrl) {
        await this.prsRepository.create({
          complaintId: job.complaintId,
          repo: repoIdentifier,
          prNumber: blockedPrNumber,
          prUrl: vibeResult.prUrl,
          branch: 'unknown',
          status: PR_STATUS.BLOCKED,
        });
      }

      await this.queueService.enqueueTelegram({
        type: 'pr_failed',
        payload: {
          summary: job.summary,
          reason: vibeResult.reason,
          username: job.username,
        },
      });

      return;
    }

    const pr = await this.prsRepository.create({
      complaintId: job.complaintId,
      repo: repoIdentifier,
      prNumber: vibeResult.prNumber,
      prUrl: vibeResult.prUrl,
      branch: vibeResult.branch,
      status: PR_STATUS.OPEN,
    });

    await this.complaintsRepository.setPrCreated(job.complaintId, pr.id);

    await this.queueService.enqueueTelegram({
      type: 'pr_created',
      payload: {
        summary: job.summary,
        source: 'Discord',
        username: job.username,
        prUrl: vibeResult.prUrl,
      },
    });
  }

  async handleNotifyTelegram(job: NotifyTelegramJob): Promise<void> {
    await this.telegramService.notify(job);
  }

  async handleFollowUpUser(job: FollowUpUserJob): Promise<void> {
    const found = await this.followUpService.handleMergedPr(job.prNumber, job.repo);

    if (!found) {
      this.logger.warn(`Unable to handle follow-up for ${job.repo}#${job.prNumber}`);
    }
  }

  private resolveRepoIdentifier(repoUrl: string, prUrl: string | null): string {
    if (prUrl) {
      const fromPr = prUrl.match(/github\.com\/([^/]+\/[^/]+)\/pull\/[0-9]+/i);
      if (fromPr) {
        return fromPr[1];
      }
    }

    const normalized = repoUrl.replace(/\.git$/i, '');
    const fromRepo = normalized.match(/github\.com[/:]([^/]+\/[^/]+)$/i);
    if (fromRepo) {
      return fromRepo[1];
    }

    return repoUrl;
  }
}
