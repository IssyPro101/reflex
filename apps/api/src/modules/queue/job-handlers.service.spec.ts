import { AckService } from '../ack/ack.service';
import { MESSAGE_STATUS } from '../../common/status';
import { JobHandlersService } from './job-handlers.service';

describe('JobHandlersService', () => {
  function createService() {
    const triageService = {
      classify: jest.fn(),
    };

    const messagesRepository = {
      updateStatus: jest.fn().mockResolvedValue(undefined),
    };

    const complaintsRepository = {
      upsertFromTriage: jest.fn(),
      setNeedsManual: jest.fn().mockResolvedValue(undefined),
      setPrCreated: jest.fn().mockResolvedValue(undefined),
      appendProcessLog: jest.fn().mockResolvedValue(undefined),
    };

    const prsRepository = {
      create: jest.fn().mockResolvedValue({ id: 'pr-row-1' }),
    };

    const userConnectionsRepository = {
      getBySupabaseUserId: jest.fn(),
    };

    const userDiscordGuildsRepository = {
      getByGuildId: jest.fn(),
    };

    const userTargetsRepository = {
      getBySupabaseUserId: jest.fn(),
    };

    const queueService = {
      enqueueReplyAck: jest.fn().mockResolvedValue(undefined),
      enqueueTelegram: jest.fn().mockResolvedValue(undefined),
    };

    const ackService = {
      sendAck: jest.fn().mockResolvedValue('ack-1'),
    };

    const vibeService = {
      createPr: jest.fn(),
    };

    const telegramService = {
      notify: jest.fn().mockResolvedValue(undefined),
    };

    const followUpService = {
      handleMergedPr: jest.fn().mockResolvedValue(true),
    };

    const service = new JobHandlersService(
      triageService as any,
      messagesRepository as any,
      complaintsRepository as any,
      prsRepository as any,
      userConnectionsRepository as any,
      userDiscordGuildsRepository as any,
      userTargetsRepository as any,
      queueService as any,
      ackService as any,
      vibeService as any,
      telegramService as any,
      followUpService as any,
    );

    return {
      service,
      triageService,
      messagesRepository,
      complaintsRepository,
      prsRepository,
      userConnectionsRepository,
      userDiscordGuildsRepository,
      userTargetsRepository,
      queueService,
      vibeService,
    };
  }

  it('routes actionable intents to ack + direct vibe createPr call', async () => {
    const {
      service,
      triageService,
      complaintsRepository,
      queueService,
      messagesRepository,
      userConnectionsRepository,
      userDiscordGuildsRepository,
      userTargetsRepository,
      vibeService,
    } = createService();

    triageService.classify.mockResolvedValue({
      intent: 'bug_report',
      confidence: 0.9,
      severity: 'high',
      summary: 'Crash on export',
    });

    complaintsRepository.upsertFromTriage.mockResolvedValue({ id: 'complaint-1' });
    userDiscordGuildsRepository.getByGuildId.mockResolvedValue({
      supabase_user_id: 'sb-1',
    });
    userConnectionsRepository.getBySupabaseUserId.mockResolvedValue({
      supabase_user_id: 'sb-1',
      github_access_token: 'gh-token-1',
    });
    userTargetsRepository.getBySupabaseUserId.mockResolvedValue({
      repo_url: 'https://github.com/acme/api.git',
      base_branch: 'main',
    });
    vibeService.createPr.mockResolvedValue({
      status: 'success',
      prUrl: 'https://github.com/acme/api/pull/5',
      prNumber: 5,
      branch: 'fix/export-crash',
      changedFiles: ['src/export.ts'],
      warnings: [],
    });

    await service.handleClassifyIntent({
      messageId: 'msg-1',
      platformMessageId: 'discord-1',
      userId: 'u1',
      username: 'alex',
      guildId: 'g-1',
      channelId: 'c1',
      threadId: null,
      text: 'Export crashes on iOS',
      timestamp: '2026-02-28T00:00:00Z',
    });

    expect(messagesRepository.updateStatus).toHaveBeenCalledWith(
      'msg-1',
      MESSAGE_STATUS.CLASSIFIED,
    );
    expect(queueService.enqueueReplyAck).toHaveBeenCalledWith({
      messageId: 'msg-1',
      channelId: 'c1',
      threadId: null,
      ackText: AckService.DEFAULT_ACK,
    });
    expect(vibeService.createPr).toHaveBeenCalledWith({
      complaintId: 'complaint-1',
      summary: 'Crash on export',
      originalMessage: 'Export crashes on iOS',
      repoUrl: 'https://github.com/acme/api.git',
      baseBranch: 'main',
      githubToken: 'gh-token-1',
    });
    expect(queueService.enqueueTelegram).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: 'pr_created' }),
    );
  });

  it('does not enqueue ack or call vibe for non-actionable intents', async () => {
    const { service, triageService, complaintsRepository, queueService, vibeService } = createService();

    triageService.classify.mockResolvedValue({
      intent: 'question',
      confidence: 0.8,
      severity: 'low',
      summary: 'How do I export?',
    });

    complaintsRepository.upsertFromTriage.mockResolvedValue({ id: 'complaint-2' });

    await service.handleClassifyIntent({
      messageId: 'msg-2',
      platformMessageId: 'discord-2',
      userId: 'u2',
      username: 'sam',
      guildId: 'g-2',
      channelId: 'c1',
      threadId: null,
      text: 'How do I export?',
      timestamp: '2026-02-28T00:00:00Z',
    });

    expect(queueService.enqueueReplyAck).not.toHaveBeenCalled();
    expect(vibeService.createPr).not.toHaveBeenCalled();
  });

  it('marks actionable complaint manual when user target is not configured', async () => {
    const {
      service,
      triageService,
      complaintsRepository,
      queueService,
      userConnectionsRepository,
      userDiscordGuildsRepository,
      userTargetsRepository,
      vibeService,
    } = createService();

    triageService.classify.mockResolvedValue({
      intent: 'bug_report',
      confidence: 0.9,
      severity: 'high',
      summary: 'Crash on export',
    });

    complaintsRepository.upsertFromTriage.mockResolvedValue({ id: 'complaint-5' });
    userDiscordGuildsRepository.getByGuildId.mockResolvedValue({
      supabase_user_id: 'sb-1',
    });
    userConnectionsRepository.getBySupabaseUserId.mockResolvedValue({
      supabase_user_id: 'sb-1',
      github_access_token: 'gh-token-1',
    });
    userTargetsRepository.getBySupabaseUserId.mockResolvedValue(null);

    await service.handleClassifyIntent({
      messageId: 'msg-5',
      platformMessageId: 'discord-5',
      userId: 'u5',
      username: 'alex',
      guildId: 'g-5',
      channelId: 'c1',
      threadId: null,
      text: 'Export crashes on iOS',
      timestamp: '2026-02-28T00:00:00Z',
    });

    expect(vibeService.createPr).not.toHaveBeenCalled();
    expect(complaintsRepository.setNeedsManual).toHaveBeenCalledWith(
      'complaint-5',
      expect.stringContaining('No linked Discord server owner'),
    );
    expect(queueService.enqueueTelegram).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'pr_failed', supabaseUserId: 'sb-1' }),
    );
  });

  it('marks complaint manual and notifies on failed vibe createPr', async () => {
    const {
      service,
      triageService,
      complaintsRepository,
      queueService,
      userConnectionsRepository,
      userDiscordGuildsRepository,
      userTargetsRepository,
      vibeService,
    } = createService();

    triageService.classify.mockResolvedValue({
      intent: 'bug_report',
      confidence: 0.9,
      severity: 'high',
      summary: 'Export bug',
    });
    complaintsRepository.upsertFromTriage.mockResolvedValue({ id: 'complaint-3' });
    userDiscordGuildsRepository.getByGuildId.mockResolvedValue({
      supabase_user_id: 'sb-1',
    });
    userConnectionsRepository.getBySupabaseUserId.mockResolvedValue({
      supabase_user_id: 'sb-1',
      github_access_token: 'gh-token-1',
    });
    userTargetsRepository.getBySupabaseUserId.mockResolvedValue({
      repo_url: 'https://github.com/acme/api.git',
      base_branch: 'main',
    });
    vibeService.createPr.mockResolvedValue({
      status: 'failed',
      reason: 'no pr url',
      prUrl: null,
      changedFiles: [],
      warnings: [],
    });

    await service.handleClassifyIntent({
      messageId: 'msg-3',
      platformMessageId: 'discord-3',
      userId: 'u3',
      username: 'alex',
      guildId: 'g-3',
      channelId: 'c1',
      threadId: null,
      text: 'Export crashes',
      timestamp: '2026-02-28T00:00:00Z',
    });

    expect(complaintsRepository.setNeedsManual).toHaveBeenCalledWith(
      'complaint-3',
      'no pr url',
    );
    expect(queueService.enqueueTelegram).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'pr_failed', supabaseUserId: 'sb-1' }),
    );
  });

  it('stores blocked PR rows when vibe blocks forbidden changes', async () => {
    const {
      service,
      triageService,
      complaintsRepository,
      prsRepository,
      userConnectionsRepository,
      userDiscordGuildsRepository,
      userTargetsRepository,
      vibeService,
    } = createService();

    triageService.classify.mockResolvedValue({
      intent: 'bug_report',
      confidence: 0.9,
      severity: 'high',
      summary: 'Export bug',
    });
    complaintsRepository.upsertFromTriage.mockResolvedValue({ id: 'complaint-9' });
    userDiscordGuildsRepository.getByGuildId.mockResolvedValue({
      supabase_user_id: 'sb-1',
    });
    userConnectionsRepository.getBySupabaseUserId.mockResolvedValue({
      supabase_user_id: 'sb-1',
      github_access_token: 'gh-token-1',
    });
    userTargetsRepository.getBySupabaseUserId.mockResolvedValue({
      repo_url: 'https://github.com/acme/api.git',
      base_branch: 'main',
    });
    vibeService.createPr.mockResolvedValue({
      status: 'blocked',
      reason: 'Forbidden files modified',
      prUrl: 'https://github.com/acme/api/pull/23',
      changedFiles: ['.github/workflows/ci.yml'],
      warnings: [],
    });

    await service.handleClassifyIntent({
      messageId: 'msg-9',
      platformMessageId: 'discord-9',
      userId: 'u9',
      username: 'alex',
      guildId: 'g-9',
      channelId: 'c1',
      threadId: null,
      text: 'Export crashes',
      timestamp: '2026-02-28T00:00:00Z',
    });

    expect(prsRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        complaintId: 'complaint-9',
        repo: 'acme/api',
        prNumber: 23,
        status: 'blocked',
      }),
    );
  });
});
