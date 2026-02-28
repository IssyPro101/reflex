import { IngestionService } from './ingestion.service';

describe('IngestionService', () => {
  it('persists incoming Discord message and enqueues classify job', async () => {
    const messagesRepository = {
      createMessage: jest.fn().mockResolvedValue({ id: 'msg-1' }),
    };

    const queueService = {
      enqueueClassifyIntent: jest.fn().mockResolvedValue(undefined),
    };

    const service = new IngestionService(
      messagesRepository as any,
      queueService as any,
    );

    const result = await service.ingestDiscord({
      platform: 'discord',
      message_id: 'discord-msg-1',
      user_id: 'u1',
      username: 'alex',
      channel_id: 'c1',
      thread_id: null,
      text: 'Export crashes',
      timestamp: '2026-02-28T00:00:00Z',
    });

    expect(result).toEqual({ messageId: 'msg-1' });
    expect(messagesRepository.createMessage).toHaveBeenCalled();
    expect(queueService.enqueueClassifyIntent).toHaveBeenCalledWith(
      expect.objectContaining({
        messageId: 'msg-1',
        text: 'Export crashes',
      }),
    );
  });
});
