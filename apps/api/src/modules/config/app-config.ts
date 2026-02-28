import { z } from 'zod';

const boolString = z
  .string()
  .optional()
  .transform((value) => value === undefined || value.toLowerCase() === 'true');

const envSchema = z.object({
  NODE_ENV: z.string().default('development'),
  PORT: z.coerce.number().int().positive().default(3000),

  REDIS_URL: z.string().min(1),
  DATABASE_URL: z.string().min(1),

  DISCORD_BOT_TOKEN: z.string().optional(),
  DISCORD_CLIENT_ID: z.string().optional(),
  DISCORD_GUILD_ID: z.string().optional(),

  MISTRAL_API_KEY: z.string().min(1),
  MISTRAL_MODEL: z.string().default('mistral-small-latest'),

  TELEGRAM_BOT_TOKEN: z.string().optional(),

  SUPABASE_URL: z.string().default(''),
  SUPABASE_ANON_KEY: z.string().default(''),
  APP_AUTH_SECRET: z.string().default('change-me'),
  GITHUB_OAUTH_STATE_TTL_SECONDS: z.coerce.number().int().positive().default(10 * 60),

  FRONTEND_URL: z.string().default('http://localhost:3001'),
  API_BASE_URL: z.string().default('http://localhost:3000'),
  GITHUB_OAUTH_CLIENT_ID: z.string().default(''),
  GITHUB_OAUTH_CLIENT_SECRET: z.string().default(''),
  GITHUB_OAUTH_SCOPE: z.string().default('repo read:user'),

  VIBE_BIN: z.string().default('vibe'),
  VIBE_AGENT: z.string().default('pr-agent'),
  VIBE_MAX_TURNS: z.coerce.number().int().positive().default(12),
  VIBE_MAX_PRICE: z.coerce.number().positive().default(0.5),
  WORKSPACE_ROOT: z.string().default('/tmp/cfca-workspaces'),
  QUEUE_WORKERS_ENABLED: boolString,
});

export type AppConfig = z.infer<typeof envSchema>;

export const APP_CONFIG = Symbol('APP_CONFIG');

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return envSchema.parse(env);
}
