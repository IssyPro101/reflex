import { GithubController } from './github.controller';

describe('GithubController', () => {
  it('queues follow-up for merged pull request events', async () => {
    const signatureService = {
      verify: jest.fn().mockReturnValue(true),
    };

    const queueService = {
      enqueueFollowUp: jest.fn().mockResolvedValue(undefined),
    };

    const controller = new GithubController(
      signatureService as any,
      queueService as any,
    );

    const payload = {
      action: 'closed',
      pull_request: { number: 12, merged: true, merged_at: '2026-02-28T00:00:00Z' },
      repository: { full_name: 'acme/api' },
    };

    await controller.handleWebhook(
      { body: Buffer.from(JSON.stringify(payload)) } as any,
      'sha256=good',
      'pull_request',
    );

    expect(queueService.enqueueFollowUp).toHaveBeenCalledWith({
      prNumber: 12,
      repo: 'acme/api',
      mergedAt: '2026-02-28T00:00:00Z',
    });
  });
});
