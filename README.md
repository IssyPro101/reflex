# CFCA (Reflex) Monorepo

Customer Feedback -> Code Agent (CFCA) is a hackathon MVP that closes the loop between community feedback and shipped code.

It listens to Discord messages, classifies intent with Mistral, opens code-fix PRs against a configured GitHub repo via a Vibe-powered workflow, notifies the developer on Telegram, and follows up in Discord after merge.

## Table of Contents
- [What Is In This Repo](#what-is-in-this-repo)
- [Repository Layout](#repository-layout)
- [Architecture](#architecture)
- [Core Product Flow](#core-product-flow)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Onboarding Checklist](#onboarding-checklist)
- [Environment Variables](#environment-variables)
- [API Reference](#api-reference)
- [Queue Jobs](#queue-jobs)
- [Data Model](#data-model)
- [Development Commands](#development-commands)
- [Testing](#testing)
- [Deployment Notes](#deployment-notes)
- [Security Notes](#security-notes)
- [Troubleshooting](#troubleshooting)
- [Known MVP Constraints](#known-mvp-constraints)

## What Is In This Repo
- `apps/api`: NestJS backend for ingestion, triage, queue workers, GitHub/Discord/Telegram integration, and observability.
- `apps/web`: Next.js dashboard and onboarding app (Supabase auth + API client).
- `apps/api/migrations`: SQL migrations for Postgres schema.
- `prd.md`: Product requirements and demo framing for the hackathon build.

## Repository Layout
```text
.
|-- apps
|   |-- api
|   |   |-- migrations
|   |   `-- src/modules
|   |-- web
|   |   |-- src/app
|   |   |-- src/components
|   |   `-- src/lib
|   `-- (workspace apps)
|-- packages
|   `-- (currently empty)
|-- package.json
|-- pnpm-workspace.yaml
`-- prd.md
```

## Architecture
```text
Discord message
  -> API ingestion
  -> Postgres (messages)
  -> BullMQ job: classify_intent
  -> Mistral triage
  -> complaint row (actionable or ignored)
  -> if actionable:
       - reply_ack job (Discord acknowledgement)
       - create PR workflow (Vibe + git + GitHub API)
       - notify_telegram job (success/failure)

GitHub pull_request webhook (merged)
  -> follow_up_user job
  -> Discord follow-up message
  -> complaint/pr status update
```

### Runtime Components
- API process hosts both HTTP controllers and BullMQ worker logic.
- Redis is used for queueing (`cfca-jobs` queue).
- Postgres stores messages, complaints, PRs, user links, and Vibe session logs.
- Discord bot listener is enabled only when `DISCORD_BOT_TOKEN` is configured.
- Telegram notifier is enabled only when `TELEGRAM_BOT_TOKEN` is configured.

## Core Product Flow
1. User posts complaint/feature request in Discord.
2. Message is ingested and persisted.
3. A queue worker classifies intent using Mistral (`bug_report`, `feature_request`, `question`, `spam`, `harmful`).
4. Actionable intents trigger:
   - Discord acknowledgement reply.
   - PR generation workflow against a user-configured target repo.
5. On PR creation or failure, Telegram notification is sent to the linked chat.
6. On PR merge webhook, user receives a follow-up Discord message.

## Tech Stack
- Monorepo tooling: `pnpm` workspaces
- Backend: NestJS, BullMQ, Redis, Postgres (`pg`), Zod
- AI: Mistral API SDK (`@mistralai/mistralai`)
- Git/code workflow: `git` + Vibe CLI invocation
- Integrations: Discord (`discord.js`), Telegram (`node-telegram-bot-api`), GitHub OAuth + REST API
- Frontend: Next.js 16, React 19, TypeScript, Tailwind 4, Framer Motion
- Auth (web): Supabase JS (Google OAuth via Supabase)

## Prerequisites
- Node.js 20+ (recommended)
- `pnpm` 9.x
- PostgreSQL 14+ and `psql` CLI
- Redis 7+
- Git installed and available in PATH
- Vibe CLI binary available as `vibe` (or set `VIBE_BIN`)
- Accounts/credentials for:
  - Mistral API
  - Supabase project
  - GitHub OAuth app
  - Discord bot
  - Telegram bot

## Quick Start

### 1) Install dependencies
```bash
pnpm install
```

### 2) Start local infrastructure (example)
```bash
docker run --name cfca-postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=cfca -p 5432:5432 -d postgres:16
docker run --name cfca-redis -p 6379:6379 -d redis:7
```

### 3) Configure environment files
Create `apps/api/.env`:

```bash
NODE_ENV=development
PORT=3000

REDIS_URL=redis://localhost:6379
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/cfca

MISTRAL_API_KEY=YOUR_MISTRAL_API_KEY
MISTRAL_MODEL=mistral-small-latest

FRONTEND_URL=http://localhost:3001
API_BASE_URL=http://localhost:3000

SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
APP_AUTH_SECRET=change-this-in-real-env

GITHUB_OAUTH_CLIENT_ID=YOUR_GITHUB_OAUTH_CLIENT_ID
GITHUB_OAUTH_CLIENT_SECRET=YOUR_GITHUB_OAUTH_CLIENT_SECRET
GITHUB_OAUTH_SCOPE="repo admin:repo_hook read:user"
GITHUB_WEBHOOK_SECRET=OPTIONAL_SHARED_SECRET

DISCORD_BOT_TOKEN=OPTIONAL_DISCORD_BOT_TOKEN
TELEGRAM_BOT_TOKEN=OPTIONAL_TELEGRAM_BOT_TOKEN

VIBE_BIN=vibe
VIBE_AGENT=pr-agent
VIBE_MAX_TURNS=12
VIBE_MAX_PRICE=0.5
WORKSPACE_ROOT=/tmp/cfca-workspaces
QUEUE_WORKERS_ENABLED=true
```

Create `apps/web/.env.local`:

```bash
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

### 4) Run migrations
From repo root:
```bash
pnpm migrate:api
```

This applies `apps/api/migrations/*.sql` in order using `psql`.

### 5) Run apps
Option A: run both apps in parallel:
```bash
pnpm dev
```

Option B: run separately:
```bash
pnpm dev:api
pnpm dev:web
```

Local URLs:
- Web UI: `http://localhost:3001`
- API: `http://localhost:3000`
- Health check: `GET http://localhost:3000/health`

## Onboarding Checklist
After both apps are running, complete onboarding in the web app:

1. Sign in with Google (Supabase OAuth).
2. Connect GitHub.
3. Set target repository URL and base branch.
4. Link one or more Discord `guildId` values.
5. Link Telegram `chatId` for notifications.

Notes:
- PR automation requires all of these to exist for the owning user: GitHub connection, target repo, and Discord guild link.
- Discord linking is manual by guild ID in the current UI/API.

## Environment Variables

### API (`apps/api/.env`)
| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `NODE_ENV` | No | `development` | Runtime environment |
| `PORT` | No | `3000` | API port |
| `REDIS_URL` | Yes | - | Redis connection string |
| `DATABASE_URL` | Yes | - | Postgres connection string |
| `DISCORD_BOT_TOKEN` | No | empty | Enables Discord listener/replies |
| `DISCORD_CLIENT_ID` | No | empty | Reserved for Discord app config |
| `DISCORD_GUILD_ID` | No | empty | Reserved for guild scoping |
| `MISTRAL_API_KEY` | Yes | - | Mistral API auth |
| `MISTRAL_MODEL` | No | `mistral-small-latest` | Triage model |
| `TELEGRAM_BOT_TOKEN` | No | empty | Enables Telegram notifications |
| `SUPABASE_URL` | Required for auth | empty | Supabase project URL |
| `SUPABASE_ANON_KEY` | Required for auth | empty | Supabase anon key |
| `APP_AUTH_SECRET` | No | `change-me` | Signs GitHub OAuth state payload |
| `GITHUB_OAUTH_STATE_TTL_SECONDS` | No | `600` | OAuth state expiration |
| `FRONTEND_URL` | No | `http://localhost:3001` | CORS + redirect base |
| `API_BASE_URL` | No | `http://localhost:3000` | Used when auto-installing webhooks |
| `GITHUB_OAUTH_CLIENT_ID` | Required for GitHub connect | empty | GitHub OAuth app client ID |
| `GITHUB_OAUTH_CLIENT_SECRET` | Required for GitHub connect | empty | GitHub OAuth app secret |
| `GITHUB_OAUTH_SCOPE` | No | `repo admin:repo_hook read:user` | OAuth requested scopes |
| `GITHUB_WEBHOOK_SECRET` | No | empty | Optional signature verification secret |
| `VIBE_BIN` | No | `vibe` | Vibe executable path/name |
| `VIBE_AGENT` | No | `pr-agent` | Agent profile name passed to Vibe |
| `VIBE_MAX_TURNS` | No | `12` | Config field for Vibe run policy |
| `VIBE_MAX_PRICE` | No | `0.5` | Max price passed to Vibe |
| `WORKSPACE_ROOT` | No | `/tmp/cfca-workspaces` | Temp clone/workspace root |
| `QUEUE_WORKERS_ENABLED` | No | `true` | Toggle BullMQ workers in API process |

### Web (`apps/web/.env.local`)
| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | No | `http://localhost:3000` | API base URL |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | - | Supabase URL for browser auth |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | - | Supabase anon key for browser auth |

## API Reference

### Health and Integrations
- `GET /health`
  - Returns dependency and integration readiness (`db`, `redis`, `discord`, `telegram`).

### Ingestion
- `POST /ingest/discord`
  - Accepts a Discord-style message payload.
  - Enqueues intent classification.
  - Returns `{ messageId }`.

Example:
```bash
curl -X POST http://localhost:3000/ingest/discord \
  -H "Content-Type: application/json" \
  -d '{
    "platform": "discord",
    "message_id": "123",
    "user_id": "u1",
    "username": "alex",
    "guild_id": "g1",
    "channel_id": "c1",
    "thread_id": null,
    "text": "Export button crashes",
    "timestamp": "2026-03-01T12:00:00.000Z"
  }'
```

### Auth and User Setup (Supabase Bearer token required unless noted)
- `GET /auth/me`
- `GET /auth/github/url?next=/`
- `GET /auth/github/callback` (OAuth callback, no bearer token)
- `POST /auth/github/disconnect`
- `GET /auth/github/repos`
- `GET /auth/github/target`
- `PUT /auth/github/target`
- `GET /auth/discord/guild-links`
- `POST /auth/discord/guild-link`
- `DELETE /auth/discord/guild-link`
- `POST /auth/telegram/link`
- `DELETE /auth/telegram/link`

### Observability (Supabase Bearer token required)
- `GET /observability/overview?limit=20`
  - Returns aggregate counts plus recent complaints and PRs.

### Vibe Session Monitoring (Supabase auth required)
- `GET /vibe/sessions`
- `GET /vibe/sessions/stream?token=<supabase_access_token>` (SSE stream)

### GitHub Webhooks
- `POST /webhooks/github`
  - Handles merged `pull_request` events and enqueues follow-up jobs.
  - If `GITHUB_WEBHOOK_SECRET` is set, validates `x-hub-signature-256`.

## Queue Jobs
| Job | Purpose |
| --- | --- |
| `classify_intent` | Triage message with Mistral, create/update complaint, trigger next steps |
| `reply_ack` | Send Discord acknowledgement reply |
| `notify_telegram` | Send PR-created / PR-failed Telegram notification |
| `follow_up_user` | Handle merged PR follow-up message in Discord |

## Data Model

Main tables:
- `messages`: raw ingested messages and lifecycle status
- `complaints`: triage result, complaint status, failure reason, linked PR
- `prs`: created PR metadata and status
- `user_connections`: Supabase user -> GitHub token and Telegram chat mapping
- `user_targets`: repo/base branch per user
- `user_discord_guilds`: guild ownership/link mapping
- `vibe_sessions`: persisted Vibe stream output for dashboard session view

Status enums are represented as text fields:
- Message: `received`, `classified`, `acknowledged`, `followed_up`
- Complaint: `pending`, `needs_manual`, `pr_created`, `resolved`, `ignored`
- PR: `open`, `merged`, `closed`, `blocked`

## Development Commands

### Workspace (root)
```bash
pnpm dev
pnpm dev:api
pnpm dev:web
pnpm migrate:api
pnpm build
pnpm test
pnpm lint
```

### API app (`apps/api`)
```bash
pnpm dev
pnpm build
pnpm start
pnpm migrate
pnpm test
pnpm test:watch
pnpm test:cov
pnpm lint
```

### Web app (`apps/web`)
```bash
pnpm dev
pnpm build
pnpm start
pnpm lint
```

## Testing
- API includes unit tests for ingestion, triage parsing, queue handlers, and Vibe safety/output parsing.
- Run all workspace tests:
```bash
pnpm test
```
- Current repo has no dedicated frontend test suite configured.

## Deployment Notes
- API Dockerfile exists at `apps/api/Dockerfile`.
- The Docker image installs:
  - Node 20
  - `pnpm`
  - Vibe CLI via `uv tool install mistral-vibe`
  - build dependencies (`git`, `curl`, `ripgrep`)
- Container entrypoint writes `MISTRAL_API_KEY` into `~/.vibe/.env` and starts `node dist/main.js`.

Recommended production split:
- API + workers (same service or separate services with `QUEUE_WORKERS_ENABLED` control)
- Managed Postgres
- Managed Redis
- Frontend on Vercel or equivalent

## Security Notes
- This is an MVP/hackathon codebase. Treat it as non-hardened.
- GitHub access tokens are persisted in Postgres. For production, add encryption-at-rest and key management.
- Set a strong `APP_AUTH_SECRET`.
- Set `GITHUB_WEBHOOK_SECRET` to enforce webhook signature validation.
- Restrict Discord and Telegram bot scopes to least privilege.
- Consider rate limiting and audit logging before public exposure.

## Troubleshooting

### API starts but integrations are disabled
- If you see Discord disabled warnings, set `DISCORD_BOT_TOKEN`.
- If Telegram notifications are skipped, set `TELEGRAM_BOT_TOKEN` and link a chat ID.

### `pnpm migrate:api` fails
- Ensure `psql` is installed and `DATABASE_URL` is reachable.
- Ensure `apps/api/.env` exists and contains `DATABASE_URL`.

### GitHub connect fails
- Set `GITHUB_OAUTH_CLIENT_ID` and `GITHUB_OAUTH_CLIENT_SECRET`.
- Confirm OAuth callback URL points to:
  - `http://localhost:3000/auth/github/callback` (local)
- Ensure Supabase auth token is sent in `Authorization: Bearer <token>` to `/auth/github/url`.

### PRs are not created
- Confirm user has completed onboarding steps:
  - GitHub connected
  - target repo set
  - Discord guild linked
- Confirm GitHub token has push/admin/maintain rights on target repo.
- Confirm `VIBE_BIN` resolves to an installed executable.

### Web shows Supabase env error
- Set both:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

---