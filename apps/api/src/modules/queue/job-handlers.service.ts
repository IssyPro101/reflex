import { Injectable, Logger } from '@nestjs/common';

import { MESSAGE_STATUS, PR_STATUS } from '../../common/status';
import { AckService } from '../ack/ack.service';
import { ComplaintsRepository } from '../db/complaints.repository';
import { MessagesRepository } from '../db/messages.repository';
import { PrsRepository } from '../db/prs.repository';
import { UserConnectionsRepository } from '../db/user-connections.repository';
import { UserDiscordGuildsRepository } from '../db/user-discord-guilds.repository';
import { UserTargetsRepository } from '../db/user-targets.repository';
import { FollowUpService } from '../followup/followup.service';
import { TelegramService } from '../telegram/telegram.service';
import { isActionableIntent } from '../triage/triage.types';
import { TriageService } from '../triage/triage.service';
import { extractPrNumber } from '../vibe/vibe-output';
import { VibeService } from '../vibe/vibe.service';
import {
  ClassifyIntentJob,
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
    private readonly userDiscordGuildsRepository: UserDiscordGuildsRepository,
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

    const resolvedSupabaseUserId = await this.resolveSupabaseUserId(job);
    const createPrContext = await this.resolveCreatePrContext(job, resolvedSupabaseUserId);
    if (!createPrContext) {
      const reason =
        'No linked Discord server owner with GitHub target repo/base branch found. Link server in dashboard and configure repo target.';

      await this.complaintsRepository.setNeedsManual(complaint.id, reason);
      await this.queueService.enqueueTelegram({
        type: 'pr_failed',
        supabaseUserId: resolvedSupabaseUserId ?? undefined,
        payload: {
          summary: triage.summary,
          reason,
          username: job.username,
        },
      });
      return;
    }

    const vibeResult = await this.vibeService.createPr({
      complaintId: complaint.id,
      summary: triage.summary,
      originalMessage: job.text,
      repoUrl: createPrContext.repoUrl,
      baseBranch: createPrContext.baseBranch,
      githubToken: createPrContext.githubToken,
    });
    const repoIdentifier = this.resolveRepoIdentifier(createPrContext.repoUrl, vibeResult.prUrl);

    if (vibeResult.status !== 'success') {
      await this.complaintsRepository.setNeedsManual(complaint.id, vibeResult.reason);

      const blockedPrNumber =
        vibeResult.prUrl && vibeResult.status === 'blocked'
          ? extractPrNumber(vibeResult.prUrl)
          : null;

      if (blockedPrNumber && vibeResult.prUrl) {
        await this.prsRepository.create({
          complaintId: complaint.id,
          repo: repoIdentifier,
          prNumber: blockedPrNumber,
          prUrl: vibeResult.prUrl,
          branch: 'unknown',
          status: PR_STATUS.BLOCKED,
        });
      }

      await this.queueService.enqueueTelegram({
        type: 'pr_failed',
        supabaseUserId: createPrContext.supabaseUserId,
        payload: {
          summary: triage.summary,
          reason: vibeResult.reason,
          username: job.username,
        },
      });

      return;
    }
  }

  async handleReplyAck(job: ReplyAckJob): Promise<void> {
    await this.ackService.sendAck(job.messageId, job.channelId, job.threadId, job.ackText);
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
    supabaseUserId: string | null,
  ): Promise<{ repoUrl: string; baseBranch: string; githubToken: string; supabaseUserId: string } | null> {
    if (!supabaseUserId) {
      this.logger.warn(`No user mapping resolved for Discord guild ${job.guildId ?? 'unknown'}`);
      return null;
    }

    const connection = await this.userConnectionsRepository.getBySupabaseUserId(supabaseUserId);
    if (!connection) {
      this.logger.warn(`No GitHub connection found for Supabase user ${supabaseUserId}`);
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
      supabaseUserId: connection.supabase_user_id,
    };
  }

  private async resolveSupabaseUserId(job: ClassifyIntentJob): Promise<string | null> {
    if (job.supabaseUserId) {
      return job.supabaseUserId;
    }
    if (!job.guildId) {
      return null;
    }

    const guildLink = await this.userDiscordGuildsRepository.getByGuildId(job.guildId);
    return guildLink?.supabase_user_id ?? null;
  }
}
