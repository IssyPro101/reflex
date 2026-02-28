import { Injectable, Logger } from '@nestjs/common';

import { MESSAGE_STATUS, PR_STATUS } from '../../common/status';
import { AckService } from '../ack/ack.service';
import { ComplaintsRepository } from '../db/complaints.repository';
import { MessagesRepository } from '../db/messages.repository';
import { PrsRepository } from '../db/prs.repository';
import { UserConnectionRow } from '../db/types';
import { UserConnectionsRepository } from '../db/user-connections.repository';
import { UserTargetsRepository } from '../db/user-targets.repository';
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
    private readonly triageService: TriageService,
    private readonly messagesRepository: MessagesRepository,
    private readonly complaintsRepository: ComplaintsRepository,
    private readonly prsRepository: PrsRepository,
    private readonly userConnectionsRepository: UserConnectionsRepository,
    private readonly userTargetsRepository: UserTargetsRepository,
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

    const createPrContext = await this.resolveCreatePrContext(job);
    if (!createPrContext) {
      const reason =
        'No linked GitHub account with target repo/base branch found for this user. Configure target repo in dashboard and link Discord user ID.';

      await this.complaintsRepository.setNeedsManual(complaint.id, reason);
      await this.queueService.enqueueTelegram({
        type: 'pr_failed',
        payload: {
          summary: triage.summary,
          reason,
          username: job.username,
        },
      });
      return;
    }

    await this.queueService.enqueueCreatePr({
      complaintId: complaint.id,
      messageId: job.messageId,
      summary: triage.summary,
      originalMessage: job.text,
      repoUrl: createPrContext.repoUrl,
      baseBranch: createPrContext.baseBranch,
      username: job.username,
      githubToken: createPrContext.githubToken,
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

  private async resolveCreatePrContext(
    job: ClassifyIntentJob,
  ): Promise<{ repoUrl: string; baseBranch: string; githubToken: string } | null> {
    const connection = await this.resolveUserConnection(job);
    if (!connection) {
      this.logger.warn(`No user connection resolved for Discord user ${job.userId} (${job.username})`);
      return null;
    }

    const target = await this.userTargetsRepository.getBySupabaseUserId(connection.supabase_user_id);
    if (!target) {
      this.logger.warn(`No target config for Supabase user ${connection.supabase_user_id}`);
      return null;
    }

    return {
      repoUrl: target.repo_url,
      baseBranch: target.base_branch,
      githubToken: connection.github_access_token,
    };
  }

  private async resolveUserConnection(job: ClassifyIntentJob): Promise<UserConnectionRow | null> {
    if (job.supabaseUserId) {
      const bySupabase = await this.userConnectionsRepository.getBySupabaseUserId(job.supabaseUserId);
      if (bySupabase) {
        return bySupabase;
      }
    }

    const byDiscordUserId = await this.userConnectionsRepository.getByDiscordUserId(job.userId);
    if (byDiscordUserId) {
      return byDiscordUserId;
    }

    return this.userConnectionsRepository.getByGithubLogin(job.username);
  }
}
