# Reflex Web (Next.js)

Observability frontend for Reflex.

## Features

- Google sign-in via Supabase Auth
- GitHub connect/disconnect
- Read-only system observability dashboard

## Environment

Create `apps/web/.env.local`:

```bash
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

## Run

From monorepo root:

```bash
pnpm dev:web
```

or inside `apps/web`:

```bash
pnpm dev
```

App runs on `http://localhost:3001`.

## Supabase Setup Notes

- Enable `Google` provider in Supabase Auth.
- Add `http://localhost:3001` to Supabase redirect URL allow list.
