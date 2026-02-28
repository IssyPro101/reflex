ALTER TABLE IF EXISTS user_connections
  ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT;

CREATE TABLE IF NOT EXISTS user_discord_guilds (
  id UUID PRIMARY KEY,
  supabase_user_id TEXT NOT NULL,
  guild_id TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_discord_guilds_supabase_user_id
  ON user_discord_guilds(supabase_user_id);
