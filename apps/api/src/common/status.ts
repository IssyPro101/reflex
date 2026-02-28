export const MESSAGE_STATUS = {
  RECEIVED: 'received',
  CLASSIFIED: 'classified',
  ACKNOWLEDGED: 'acknowledged',
  FOLLOWED_UP: 'followed_up',
} as const;

export type MessageStatus = (typeof MESSAGE_STATUS)[keyof typeof MESSAGE_STATUS];

export const COMPLAINT_STATUS = {
  PENDING: 'pending',
  NEEDS_MANUAL: 'needs_manual',
  PR_CREATED: 'pr_created',
  RESOLVED: 'resolved',
  IGNORED: 'ignored',
} as const;

export type ComplaintStatus = (typeof COMPLAINT_STATUS)[keyof typeof COMPLAINT_STATUS];

export const PR_STATUS = {
  OPEN: 'open',
  MERGED: 'merged',
  CLOSED: 'closed',
  BLOCKED: 'blocked',
} as const;

export type PrStatus = (typeof PR_STATUS)[keyof typeof PR_STATUS];
