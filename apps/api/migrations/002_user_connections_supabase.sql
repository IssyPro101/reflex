ALTER TABLE IF EXISTS user_connections
  ADD COLUMN IF NOT EXISTS supabase_user_id TEXT;

ALTER TABLE IF EXISTS user_connections
  ALTER COLUMN session_id DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_connections_supabase_user_id_key'
  ) THEN
    ALTER TABLE user_connections
      ADD CONSTRAINT user_connections_supabase_user_id_key UNIQUE (supabase_user_id);
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_user_connections_supabase_user_id
  ON user_connections(supabase_user_id);
