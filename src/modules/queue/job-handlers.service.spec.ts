import { AckService } from '../ack/ack.service';
import { MESSAGE_STATUS } from '../../common/status';
import { JobHandlersService } from './job-handlers.service';
import { makeAppConfig } from '../../../test/support/app-config';

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
    };

    const prsRepository = {
      create: jest.fn().mockResolvedValue({ id: 'pr-row-1' }),
    };

    const queueService = {
      enqueueReplyAck: jest.fn().mockResolvedValue(undefined),
      enqueueCreatePr: jest.fn().mockResolvedValue(undefined),
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
      makeAppConfig(),
      triageService as any,
      messagesRepository as any,
      complaintsRepository as any,
      prsRepository as any,
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
      queueService,
      ackService,
      vibeService,
    };
  }

  it('routes actionable intents to ack + create_pr', async () => {
    const { service, triageService, complaintsRepository, queueService, messagesRepository } =
      createService();

    triageService.classify.mockResolvedValue({
      intent: 'bug_report',
      confidence: 0.9,
      severity: 'high',
      summary: 'Crash on export',
    });

    complaintsRepository.upsertFromTriage.mockResolvedValue({ id: 'complaint-1' });

    await service.handleClassifyIntent({
      messageId: 'msg-1',
      platformMessageId: 'discord-1',
      userId: 'u1',
      username: 'alex',
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
    expect(queueService.enqueueCreatePr).toHaveBeenCalled();
  });

  it('does not enqueue ack/create_pr for non-actionable intents', async () => {
    const { service, triageService, complaintsRepository, queueService } = createService();

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
      channelId: 'c1',
      threadId: null,
      text: 'How do I export?',
      timestamp: '2026-02-28T00:00:00Z',
    });

    expect(queueService.enqueueReplyAck).not.toHaveBeenCalled();
    expect(queueService.enqueueCreatePr).not.toHaveBeenCalled();
  });

  it('marks complaint manual and notifies on failed create_pr', async () => {
    const { service, vibeService, complaintsRepository, queueService } = createService();

    vibeService.createPr.mockResolvedValue({
      status: 'failed',
      reason: 'no pr url',
      prUrl: null,
      changedFiles: [],
      warnings: [],
    });

    await service.handleCreatePr({
      complaintId: 'complaint-3',
      messageId: 'msg-3',
      summary: 'Export bug',
      originalMessage: 'Export crashes',
      repoUrl: 'https://github.com/acme/api.git',
      baseBranch: 'main',
      username: 'alex',
    });

    expect(complaintsRepository.setNeedsManual).toHaveBeenCalledWith(
      'complaint-3',
      'no pr url',
    );
    expect(queueService.enqueueTelegram).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'pr_failed' }),
    );
  });

  it('creates PR record and notifies on successful create_pr', async () => {
    const { service, vibeService, complaintsRepository, prsRepository, queueService } =
      createService();

    vibeService.createPr.mockResolvedValue({
      status: 'success',
      prUrl: 'https://github.com/acme/api/pull/5',
      prNumber: 5,
      branch: 'fix/export-crash',
      changedFiles: ['src/export.ts'],
      warnings: [],
    });

    await service.handleCreatePr({
      complaintId: 'complaint-4',
      messageId: 'msg-4',
      summary: 'Export bug',
      originalMessage: 'Export crashes',
      repoUrl: 'https://github.com/acme/api.git',
      baseBranch: 'main',
      username: 'alex',
    });

    expect(prsRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        complaintId: 'complaint-4',
        prUrl: 'https://github.com/acme/api/pull/5',
        prNumber: 5,
        repo: 'acme/api',
      }),
    );
    expect(complaintsRepository.setPrCreated).toHaveBeenCalledWith(
      'complaint-4',
      'pr-row-1',
    );
    expect(queueService.enqueueTelegram).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'pr_created' }),
    );
  });
});
