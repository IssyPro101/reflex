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
