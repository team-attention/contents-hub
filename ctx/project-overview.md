---
when:
  - Understanding project structure or tech stack
  - Adding new apps or packages
  - Checking environment configuration

what: |
  Describes the overall structure, tech stack, and key configuration patterns of the Contents Hub project.
---

# Project Overview

## Project Structure

TypeScript monorepo based on pnpm workspace:

```
contents-hub/
├── apps/
│   ├── server/      # NestJS backend
│   ├── client/      # React frontend (placeholder)
│   └── extension/   # Chrome Extension
├── packages/
│   └── shared/      # Shared types & utilities
└── ctx/             # Context documents
```

## Tech Stack

| Area | Stack |
|------|-------|
| **Server** | NestJS + DrizzleORM + Supabase + Claude Agent SDK |
| **Client** | React + Vite + Shadcn + Tailwind + React Query + Context API |
| **Extension** | React + Vite + CRXJS (manifest v3) |
| **Shared** | TypeScript types & utilities |

## Environment Configuration

### Server Environment Variables (`apps/server/src/env.ts`)

Runtime validation with Zod schema:

```typescript
// Required
DATABASE_URL      // Supabase PostgreSQL
SUPABASE_URL      // Supabase API URL
SUPABASE_ANON_KEY // Supabase anonymous key
ANTHROPIC_API_KEY // Claude API key

// Optional (has defaults)
APP_ENV           // development | production | test
PORT              // default 3000
```

Different .env files loaded based on APP_ENV:
- `development` → `.env`
- `test` → `.env.test`

## Main Commands

```bash
pnpm dev:server    # NestJS dev server
pnpm dev:client    # React app
pnpm dev:extension # Chrome Extension (HMR)
pnpm build         # Build all
pnpm typecheck     # TypeScript check
```
