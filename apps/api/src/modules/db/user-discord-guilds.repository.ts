import { ConflictException, Injectable } from '@nestjs/common';
import { v4 as uuid } from 'uuid';

import { DbService } from './db.service';
import { UserDiscordGuildRow } from './types';

@Injectable()
export class UserDiscordGuildsRepository {
  constructor(private readonly db: DbService) {}

  async getByGuildId(guildId: string): Promise<UserDiscordGuildRow | null> {
    const result = await this.db.query<UserDiscordGuildRow>(
      `SELECT * FROM user_discord_guilds WHERE guild_id = $1 LIMIT 1`,
      [guildId],
    );

    return result.rows[0] ?? null;
  }

  async listBySupabaseUserId(supabaseUserId: string): Promise<UserDiscordGuildRow[]> {
    const result = await this.db.query<UserDiscordGuildRow>(
      `SELECT * FROM user_discord_guilds WHERE supabase_user_id = $1 ORDER BY created_at ASC`,
      [supabaseUserId],
    );

    return result.rows;
  }

  async linkGuildToSupabaseUserId(
    supabaseUserId: string,
    guildId: string,
  ): Promise<UserDiscordGuildRow> {
    const existing = await this.getByGuildId(guildId);
    if (existing && existing.supabase_user_id !== supabaseUserId) {
      throw new ConflictException('This Discord server is already linked to another user');
    }
    if (existing) {
      return existing;
    }

    const result = await this.db.query<UserDiscordGuildRow>(
      `
      INSERT INTO user_discord_guilds (
        id,
        supabase_user_id,
        guild_id
      )
      VALUES ($1,$2,$3)
      RETURNING *
      `,
      [uuid(), supabaseUserId, guildId],
    );

    return result.rows[0];
  }

  async unlinkGuildFromSupabaseUserId(
    supabaseUserId: string,
    guildId: string,
  ): Promise<boolean> {
    const result = await this.db.query(
      `DELETE FROM user_discord_guilds WHERE supabase_user_id = $1 AND guild_id = $2`,
      [supabaseUserId, guildId],
    );

    return (result.rowCount ?? 0) > 0;
  }
}
