import { AppConfig } from '../../src/modules/config/app-config';

export function makeAppConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    NODE_ENV: 'test',
    PORT: 3000,
    REDIS_URL: 'redis://localhost:6379',
    DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/cfca',
    DISCORD_BOT_TOKEN: undefined,
    DISCORD_CLIENT_ID: undefined,
    DISCORD_GUILD_ID: undefined,
    MISTRAL_API_KEY: 'test-key',
    MISTRAL_MODEL: 'mistral-small-latest',
    TELEGRAM_BOT_TOKEN: undefined,
    TELEGRAM_CHAT_ID: undefined,
    GITHUB_WEBHOOK_SECRET: 'test-secret',
    TARGET_REPO_URL: 'https://github.com/example/repo.git',
    TARGET_BASE_BRANCH: 'main',
    VIBE_BIN: 'vibe',
    VIBE_AGENT: 'pr-agent',
    VIBE_MAX_TURNS: 12,
    VIBE_MAX_PRICE: 0.5,
    WORKSPACE_ROOT: '/tmp/cfca-tests',
    QUEUE_WORKERS_ENABLED: true,
    ...overrides,
  };
}
