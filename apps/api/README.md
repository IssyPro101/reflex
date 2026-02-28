# CFCA API (NestJS)

Customer Feedback -> Code Agent backend service.

## From Monorepo Root

Install dependencies:

```bash
pnpm install
```

Run API in dev mode:

```bash
pnpm dev:api
```

Run migration:

```bash
pnpm migrate:api
```

Run tests:

```bash
pnpm --filter cfca-api test
```

## Directly from apps/api

```bash
pnpm dev
pnpm test
```

## Key endpoints

- `GET /health`
- `POST /ingest/discord`
- `POST /webhooks/github`
- `GET /auth/github/url`
- `GET /auth/github/callback`
- `GET /auth/me`
- `GET /auth/github/repos`
- `GET /auth/github/target`
- `PUT /auth/github/target`
- `GET /auth/discord/guild-links`
- `POST /auth/discord/guild-link`
- `DELETE /auth/discord/guild-link`
- `POST /auth/telegram/link`
- `DELETE /auth/telegram/link`
- `POST /auth/github/disconnect`
- `GET /observability/overview`

## Auth model

The API expects a Supabase access token in `Authorization: Bearer <token>` for authenticated routes.

- App sign-in: handled in frontend with Supabase Google OAuth.
- GitHub connection: handled by API (`/auth/github/url` + `/auth/github/callback`).

## Required env for auth integration

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `APP_AUTH_SECRET`
- `FRONTEND_URL` (default `http://localhost:3001`)
- `API_BASE_URL` (public API base URL used for GitHub webhook registration, e.g. `https://api.example.com`)
- `GITHUB_OAUTH_CLIENT_ID`
- `GITHUB_OAUTH_CLIENT_SECRET`
- `GITHUB_WEBHOOK_SECRET`
