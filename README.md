# CFCA MVP

Customer Feedback -> Code Agent (CFCA) MVP implementation based on `prd.md`.

## What this service does

- Listens to Discord messages and stores them.
- Classifies intent with Mistral.
- Auto-acks actionable complaints.
- Runs Mistral Vibe in programmatic mode to fix code and open PRs.
- Runs file safety post-checks before accepting PR output.
- Sends Telegram notifications for PR success/failure.
- Handles GitHub `pull_request` merge webhook and follows up to Discord users.

## Stack

- NestJS + TypeScript
- BullMQ + Redis
- Postgres (Supabase compatible)
- discord.js
- Mistral SDK
- Mistral Vibe CLI

## Setup

1. Copy `.env.example` to `.env` and fill values.
2. Run SQL migration in `migrations/001_init_cfca.sql`.
3. Ensure runtime has:
   - `vibe` CLI installed and accessible
   - `gh` CLI authenticated (`gh auth status`)
4. Install dependencies and run:

```bash
npm install
npm run start:dev
```

## Key endpoints

- `GET /health`
- `POST /ingest/discord`
- `POST /webhooks/github`

## Queue jobs

- `classify_intent`
- `reply_ack`
- `create_pr`
- `notify_telegram`
- `follow_up_user`

## Vibe assets

- Skill: `.vibe/skills/create-pr/SKILL.md`
- Agent profile: `.vibe/agents/pr-agent.toml`
