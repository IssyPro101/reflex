import { Injectable } from '@nestjs/common';
import { v4 as uuid } from 'uuid';

import { PR_STATUS, PrStatus } from '../../common/status';
import { DbService } from './db.service';
import { PrRow } from './types';

export interface CreatePrInput {
  complaintId: string;
  repo: string;
  prNumber: number;
  prUrl: string;
  branch: string;
  status?: PrStatus;
}

@Injectable()
export class PrsRepository {
  constructor(private readonly db: DbService) {}

  async create(input: CreatePrInput): Promise<PrRow> {
    const result = await this.db.query<PrRow>(
      `
      INSERT INTO prs (id, complaint_id, repo, pr_number, pr_url, branch, status)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      ON CONFLICT (pr_url) DO UPDATE
      SET
        status = EXCLUDED.status,
        updated_at = NOW()
      RETURNING *
      `,
      [
        uuid(),
        input.complaintId,
        input.repo,
        input.prNumber,
        input.prUrl,
        input.branch,
        input.status ?? PR_STATUS.OPEN,
      ],
    );

    return result.rows[0];
  }

  async getByNumberAndRepo(prNumber: number, repo: string): Promise<PrRow | null> {
    const result = await this.db.query<PrRow>(
      `SELECT * FROM prs WHERE pr_number = $1 AND repo = $2 LIMIT 1`,
      [prNumber, repo],
    );
    return result.rows[0] ?? null;
  }

  async setStatus(id: string, status: PrStatus): Promise<void> {
    await this.db.query(
      `UPDATE prs SET status = $2, updated_at = NOW() WHERE id = $1`,
      [id, status],
    );
  }
}
