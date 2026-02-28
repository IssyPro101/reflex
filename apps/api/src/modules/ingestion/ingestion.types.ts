import { z } from 'zod';

export const discordIngestSchema = z.object({
  platform: z.literal('discord').default('discord'),
  message_id: z.string().min(1),
  user_id: z.string().min(1),
  username: z.string().min(1),
  supabase_user_id: z.string().min(1).optional(),
  channel_id: z.string().min(1),
  thread_id: z.string().nullable().optional(),
  text: z.string().min(1),
  timestamp: z.string().min(1),
});

export type DiscordIngestPayload = z.infer<typeof discordIngestSchema>;
