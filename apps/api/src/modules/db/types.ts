import { ComplaintStatus, MessageStatus, PrStatus } from '../../common/status';

export interface MessageRow {
  id: string;
  platform: string;
  platform_message_id: string;
  user_id: string;
  username: string;
  channel_id: string;
  thread_id: string | null;
  message_text: string;
  status: MessageStatus;
  ack_message_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ComplaintRow {
  id: string;
  message_id: string;
  intent: string;
  confidence: number;
  severity: string;
  summary: string;
  status: ComplaintStatus;
  failure_reason: string | null;
  process_log: string | null;
  pr_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface PrRow {
  id: string;
  complaint_id: string;
  repo: string;
  pr_number: number;
  pr_url: string;
  branch: string;
  status: PrStatus;
  created_at: string;
  updated_at: string;
}

export interface UserConnectionRow {
  id: string;
  supabase_user_id: string;
  session_id: string | null;
  telegram_chat_id: string | null;
  github_user_id: string;
  github_login: string;
  github_name: string | null;
  github_access_token: string;
  github_scope: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserDiscordGuildRow {
  id: string;
  supabase_user_id: string;
  guild_id: string;
  created_at: string;
  updated_at: string;
}

export interface UserTargetRow {
  id: string;
  supabase_user_id: string;
  repo_url: string;
  base_branch: string;
  created_at: string;
  updated_at: string;
}
