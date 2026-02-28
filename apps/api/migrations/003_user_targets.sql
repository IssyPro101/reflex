CREATE TABLE IF NOT EXISTS user_targets (
  id UUID PRIMARY KEY,
  supabase_user_id TEXT NOT NULL UNIQUE,
  repo_url TEXT NOT NULL,
  base_branch TEXT NOT NULL DEFAULT 'main',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_targets_supabase_user_id
  ON user_targets(supabase_user_id);
