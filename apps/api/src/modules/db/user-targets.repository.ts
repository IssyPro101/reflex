import { Injectable } from '@nestjs/common';
import { v4 as uuid } from 'uuid';

import { DbService } from './db.service';
import { UserTargetRow } from './types';

export interface UpsertUserTargetInput {
  supabaseUserId: string;
  repoUrl: string;
  baseBranch: string;
}

@Injectable()
export class UserTargetsRepository {
  constructor(private readonly db: DbService) {}

  async upsertBySupabaseUserId(input: UpsertUserTargetInput): Promise<UserTargetRow> {
    const result = await this.db.query<UserTargetRow>(
      `
      INSERT INTO user_targets (
        id,
        supabase_user_id,
        repo_url,
        base_branch
      )
      VALUES ($1,$2,$3,$4)
      ON CONFLICT (supabase_user_id)
      DO UPDATE SET
        repo_url = EXCLUDED.repo_url,
        base_branch = EXCLUDED.base_branch,
        updated_at = NOW()
      RETURNING *
      `,
      [uuid(), input.supabaseUserId, input.repoUrl, input.baseBranch],
    );

    return result.rows[0];
  }

  async getBySupabaseUserId(supabaseUserId: string): Promise<UserTargetRow | null> {
    const result = await this.db.query<UserTargetRow>(
      `SELECT * FROM user_targets WHERE supabase_user_id = $1 LIMIT 1`,
      [supabaseUserId],
    );

    return result.rows[0] ?? null;
  }

  async deleteBySupabaseUserId(supabaseUserId: string): Promise<void> {
    await this.db.query(`DELETE FROM user_targets WHERE supabase_user_id = $1`, [supabaseUserId]);
  }
}
