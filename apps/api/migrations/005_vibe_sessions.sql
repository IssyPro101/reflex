CREATE TABLE IF NOT EXISTS vibe_sessions (
  id TEXT PRIMARY KEY,
  complaint_id TEXT NOT NULL,
  summary TEXT NOT NULL,
  status TEXT NOT NULL,
  output_lines JSONB NOT NULL DEFAULT '[]'::jsonb,
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vibe_sessions_started_at
  ON vibe_sessions(started_at DESC);

CREATE INDEX IF NOT EXISTS idx_vibe_sessions_status
  ON vibe_sessions(status);
