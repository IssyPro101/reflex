import { z } from 'zod';

export const actionableIntents = new Set(['bug_report', 'feature_request']);

export const triageResultSchema = z.object({
  intent: z.enum(['bug_report', 'feature_request', 'question', 'spam', 'harmful']),
  confidence: z.number().min(0).max(1),
  severity: z.enum(['low', 'medium', 'high']).default('medium'),
  summary: z.string().min(1),
});

export type TriageResult = z.infer<typeof triageResultSchema>;

export function isActionableIntent(intent: TriageResult['intent']): boolean {
  return actionableIntents.has(intent);
}
