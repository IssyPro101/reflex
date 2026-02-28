import { Injectable } from '@nestjs/common';
import { v4 as uuid } from 'uuid';

import { COMPLAINT_STATUS } from '../../common/status';
import { DbService } from './db.service';
import { ComplaintRow } from './types';

export interface UpsertComplaintFromTriageInput {
  messageId: string;
  intent: string;
  confidence: number;
  severity: string;
  summary: string;
  actionable: boolean;
}

@Injectable()
export class ComplaintsRepository {
  constructor(private readonly db: DbService) {}

  async upsertFromTriage(input: UpsertComplaintFromTriageInput): Promise<ComplaintRow> {
    const status = input.actionable
      ? COMPLAINT_STATUS.PENDING
      : COMPLAINT_STATUS.IGNORED;

    const result = await this.db.query<ComplaintRow>(
      `
      INSERT INTO complaints (
        id, message_id, intent, confidence, severity, summary, status
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      ON CONFLICT (message_id) DO UPDATE
      SET
        intent = EXCLUDED.intent,
        confidence = EXCLUDED.confidence,
        severity = EXCLUDED.severity,
        summary = EXCLUDED.summary,
        status = EXCLUDED.status,
        updated_at = NOW()
      RETURNING *
      `,
      [
        uuid(),
        input.messageId,
        input.intent,
        input.confidence,
        input.severity,
        input.summary,
        status,
      ],
    );

    return result.rows[0];
  }

  async setNeedsManual(id: string, reason: string): Promise<void> {
    await this.db.query(
      `
      UPDATE complaints
      SET status = $2, failure_reason = $3, updated_at = NOW()
      WHERE id = $1
      `,
      [id, COMPLAINT_STATUS.NEEDS_MANUAL, reason],
    );
  }

  async appendProcessLog(id: string, entry: string): Promise<void> {
    await this.db.query(
      `
      UPDATE complaints
      SET
        process_log = RIGHT(
          CASE
            WHEN COALESCE(process_log, '') = '' THEN $2
            ELSE process_log || E'\n' || $2
          END,
          12000
        ),
        updated_at = NOW()
      WHERE id = $1
      `,
      [id, entry],
    );
  }

  async setPrCreated(id: string, prId: string): Promise<void> {
    await this.db.query(
      `
      UPDATE complaints
      SET status = $2, pr_id = $3, updated_at = NOW()
      WHERE id = $1
      `,
      [id, COMPLAINT_STATUS.PR_CREATED, prId],
    );
  }

  async setResolved(id: string): Promise<void> {
    await this.db.query(
      `UPDATE complaints SET status = $2, updated_at = NOW() WHERE id = $1`,
      [id, COMPLAINT_STATUS.RESOLVED],
    );
  }

  async getById(id: string): Promise<ComplaintRow | null> {
    const result = await this.db.query<ComplaintRow>(
      `SELECT * FROM complaints WHERE id = $1 LIMIT 1`,
      [id],
    );
    return result.rows[0] ?? null;
  }

  async getByPrId(prId: string): Promise<ComplaintRow | null> {
    const result = await this.db.query<ComplaintRow>(
      `SELECT * FROM complaints WHERE pr_id = $1 LIMIT 1`,
      [prId],
    );
    return result.rows[0] ?? null;
  }
}
