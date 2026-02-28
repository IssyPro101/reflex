# Mistral Hack Monorepo

## Workspace Layout

- `apps/api`: CFCA backend (NestJS + BullMQ + Postgres + GitHub OAuth bridge)
- `apps/web`: Next.js observability frontend (Supabase Google auth + GitHub connect)
- `packages/*`: shared packages (reserved)

## Install

```bash
pnpm install
```

## Run Locally

```bash
pnpm dev:api
pnpm dev:web
```

Or run both together:

```bash
pnpm dev
```

## Environment Setup

### API (`apps/api/.env`)

Start from [`apps/api/.env.example`](./apps/api/.env.example) and set:

- `DATABASE_URL`
- `REDIS_URL`
- `MISTRAL_API_KEY`
- `TARGET_REPO_URL`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `APP_AUTH_SECRET`
- `FRONTEND_URL=http://localhost:3001`
- `GITHUB_OAUTH_CLIENT_ID`
- `GITHUB_OAUTH_CLIENT_SECRET`

### Web (`apps/web/.env.local`)

Set:

- `NEXT_PUBLIC_API_URL=http://localhost:3000`
- `NEXT_PUBLIC_SUPABASE_URL=...`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY=...`

Also enable `Google` provider in your Supabase project auth settings and add `http://localhost:3001` to allowed redirect URLs.
