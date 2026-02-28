CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY,
  platform TEXT NOT NULL,
  platform_message_id TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL,
  username TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  thread_id TEXT,
  message_text TEXT NOT NULL,
  status TEXT NOT NULL,
  ack_message_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS complaints (
  id UUID PRIMARY KEY,
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  intent TEXT NOT NULL,
  confidence NUMERIC NOT NULL,
  severity TEXT NOT NULL,
  summary TEXT NOT NULL,
  status TEXT NOT NULL,
  failure_reason TEXT,
  pr_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (message_id)
);

CREATE TABLE IF NOT EXISTS prs (
  id UUID PRIMARY KEY,
  complaint_id UUID NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
  repo TEXT NOT NULL,
  pr_number INTEGER NOT NULL,
  pr_url TEXT NOT NULL UNIQUE,
  branch TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'complaints_pr_id_fkey'
  ) THEN
    ALTER TABLE complaints
      ADD CONSTRAINT complaints_pr_id_fkey
      FOREIGN KEY (pr_id) REFERENCES prs(id)
      ON DELETE SET NULL;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_complaints_status ON complaints(status);
CREATE INDEX IF NOT EXISTS idx_prs_number_repo ON prs(pr_number, repo);
CREATE INDEX IF NOT EXISTS idx_prs_status ON prs(status);

CREATE TABLE IF NOT EXISTS user_connections (
  id UUID PRIMARY KEY,
  supabase_user_id TEXT NOT NULL UNIQUE,
  session_id TEXT,
  github_user_id BIGINT NOT NULL UNIQUE,
  github_login TEXT NOT NULL,
  github_name TEXT,
  github_access_token TEXT NOT NULL,
  github_scope TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_connections_supabase_user_id
  ON user_connections(supabase_user_id);
