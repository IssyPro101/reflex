import { Injectable } from '@nestjs/common';
import { v4 as uuid } from 'uuid';

import { DbService } from './db.service';
import { UserConnectionRow } from './types';

export interface UpsertUserConnectionInput {
  supabaseUserId: string;
  githubUserId: number;
  githubLogin: string;
  githubName: string | null;
  githubAccessToken: string;
  githubScope: string | null;
}

@Injectable()
export class UserConnectionsRepository {
  constructor(private readonly db: DbService) {}

  async upsertBySupabaseUserId(
    input: UpsertUserConnectionInput,
  ): Promise<UserConnectionRow> {
    const result = await this.db.query<UserConnectionRow>(
      `
      INSERT INTO user_connections (
        id,
        supabase_user_id,
        github_user_id,
        github_login,
        github_name,
        github_access_token,
        github_scope
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      ON CONFLICT (supabase_user_id)
      DO UPDATE SET
        github_user_id = EXCLUDED.github_user_id,
        github_login = EXCLUDED.github_login,
        github_name = EXCLUDED.github_name,
        github_access_token = EXCLUDED.github_access_token,
        github_scope = EXCLUDED.github_scope,
        updated_at = NOW()
      RETURNING *
      `,
      [
        uuid(),
        input.supabaseUserId,
        input.githubUserId,
        input.githubLogin,
        input.githubName,
        input.githubAccessToken,
        input.githubScope,
      ],
    );

    return result.rows[0];
  }

  async getBySupabaseUserId(supabaseUserId: string): Promise<UserConnectionRow | null> {
    const result = await this.db.query<UserConnectionRow>(
      `SELECT * FROM user_connections WHERE supabase_user_id = $1 LIMIT 1`,
      [supabaseUserId],
    );

    return result.rows[0] ?? null;
  }

  async getByGithubLogin(githubLogin: string): Promise<UserConnectionRow | null> {
    const result = await this.db.query<UserConnectionRow>(
      `SELECT * FROM user_connections WHERE LOWER(github_login) = LOWER($1) LIMIT 1`,
      [githubLogin],
    );

    return result.rows[0] ?? null;
  }

  async getByDiscordUserId(discordUserId: string): Promise<UserConnectionRow | null> {
    const result = await this.db.query<UserConnectionRow>(
      `SELECT * FROM user_connections WHERE session_id = $1 LIMIT 1`,
      [discordUserId],
    );

    return result.rows[0] ?? null;
  }

  async setDiscordUserId(supabaseUserId: string, discordUserId: string): Promise<void> {
    await this.db.query(
      `UPDATE user_connections SET session_id = NULL, updated_at = NOW() WHERE session_id = $2 AND supabase_user_id <> $1`,
      [supabaseUserId, discordUserId],
    );

    await this.db.query(
      `UPDATE user_connections SET session_id = $2, updated_at = NOW() WHERE supabase_user_id = $1`,
      [supabaseUserId, discordUserId],
    );
  }

  async clearDiscordUserId(supabaseUserId: string): Promise<void> {
    await this.db.query(
      `UPDATE user_connections SET session_id = NULL, updated_at = NOW() WHERE supabase_user_id = $1`,
      [supabaseUserId],
    );
  }

  async deleteBySupabaseUserId(supabaseUserId: string): Promise<void> {
    await this.db.query(`DELETE FROM user_connections WHERE supabase_user_id = $1`, [supabaseUserId]);
  }
}
