export interface ClassifyIntentJob {
  messageId: string;
  platformMessageId: string;
  userId: string;
  username: string;
  guildId: string | null;
  supabaseUserId?: string;
  channelId: string;
  threadId: string | null;
  text: string;
  timestamp: string;
}

export interface ReplyAckJob {
  messageId: string;
  channelId: string;
  threadId: string | null;
  ackText: string;
}

export interface NotifyTelegramJob {
  type: 'pr_created' | 'pr_failed';
  supabaseUserId?: string;
  payload: Record<string, string | number | null>;
}

export interface FollowUpUserJob {
  prNumber: number;
  repo: string;
  mergedAt: string;
}
