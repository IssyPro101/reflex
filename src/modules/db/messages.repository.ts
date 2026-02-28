import { Injectable } from '@nestjs/common';
import { v4 as uuid } from 'uuid';

import { MESSAGE_STATUS, MessageStatus } from '../../common/status';
import { DbService } from './db.service';
import { MessageRow } from './types';

export interface CreateMessageInput {
  platform: string;
  platformMessageId: string;
  userId: string;
  username: string;
  channelId: string;
  threadId: string | null;
  messageText: string;
}

@Injectable()
export class MessagesRepository {
  constructor(private readonly db: DbService) {}

  async createMessage(input: CreateMessageInput): Promise<MessageRow> {
    const result = await this.db.query<MessageRow>(
      `
      INSERT INTO messages (
        id, platform, platform_message_id, user_id, username, channel_id,
        thread_id, message_text, status
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      ON CONFLICT (platform_message_id) DO UPDATE
      SET
        message_text = EXCLUDED.message_text,
        updated_at = NOW()
      RETURNING *
      `,
      [
        uuid(),
        input.platform,
        input.platformMessageId,
        input.userId,
        input.username,
        input.channelId,
        input.threadId,
        input.messageText,
        MESSAGE_STATUS.RECEIVED,
      ],
    );

    return result.rows[0];
  }

  async updateStatus(id: string, status: MessageStatus): Promise<void> {
    await this.db.query(
      `UPDATE messages SET status = $2, updated_at = NOW() WHERE id = $1`,
      [id, status],
    );
  }

  async setAckMessageId(id: string, ackMessageId: string): Promise<void> {
    await this.db.query(
      `UPDATE messages SET ack_message_id = $2, updated_at = NOW() WHERE id = $1`,
      [id, ackMessageId],
    );
  }

  async findById(id: string): Promise<MessageRow | null> {
    const result = await this.db.query<MessageRow>(
      `SELECT * FROM messages WHERE id = $1 LIMIT 1`,
      [id],
    );
    return result.rows[0] ?? null;
  }
}
