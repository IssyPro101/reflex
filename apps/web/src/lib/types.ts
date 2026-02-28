export type AuthMeResponse = {
  app: {
    authenticated: boolean;
    userId?: string;
    email?: string | null;
  };
  github: {
    connected: boolean;
    login?: string;
    name?: string | null;
    scope?: string | null;
    target?: { repoUrl: string; baseBranch: string } | null;
  };
  discord: {
    guildIds: string[];
  };
  telegram: {
    chatId?: string | null;
  };
};

export type ObservabilityResponse = {
  counts: {
    messagesTotal: number;
    complaintsTotal: number;
    complaintsPending: number;
    complaintsManual: number;
    prsOpen: number;
    prsMerged: number;
  };
  recentComplaints: Complaint[];
  recentPrs: PullRequest[];
  generatedAt: string;
};

export type Complaint = {
  id: string;
  summary: string;
  severity: string;
  status: string;
  intent: string;
  failure_reason: string | null;
  created_at: string;
  username: string;
  message_text: string;
  pr_url: string | null;
  pr_number: number | null;
  pr_status: string | null;
};

export type PullRequest = {
  id: string;
  repo: string;
  pr_number: number;
  pr_url: string;
  status: string;
  created_at: string;
  summary: string | null;
  severity: string | null;
};

export type Repo = {
  id: number;
  full_name: string;
  html_url: string;
  default_branch: string;
  private: boolean;
};

export type VibeSession = {
  id: string;
  complaintId: string;
  summary: string;
  status: "running" | "completed" | "failed";
  outputLines: string[];
  startedAt: string;
  completedAt: string | null;
};

export type VibeSessionEvent = {
  type: "session_started" | "session_output" | "session_ended";
  sessionId: string;
  session: VibeSession;
  newChunk?: string;
};
