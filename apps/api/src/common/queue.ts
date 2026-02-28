export const CFCA_QUEUE_NAME = 'cfca-jobs';

export const JOB_NAMES = {
  CLASSIFY_INTENT: 'classify_intent',
  REPLY_ACK: 'reply_ack',
  NOTIFY_TELEGRAM: 'notify_telegram',
  FOLLOW_UP_USER: 'follow_up_user',
} as const;

export type JobName = (typeof JOB_NAMES)[keyof typeof JOB_NAMES];
