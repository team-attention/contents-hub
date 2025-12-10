# Supabase + Drizzle ORM Setup Guide

A comprehensive guide for connecting Supabase PostgreSQL with Drizzle ORM, including SSL configuration and common pitfalls.

---

## Quick Start Checklist

### Prerequisites
- [ ] Supabase project created
- [ ] Database password noted
- [ ] `drizzle-orm` and `drizzle-kit` installed
- [ ] `postgres` (postgres.js) driver installed
- [ ] `dotenv` or `dotenv-flow` installed

### Configuration Steps
- [ ] Get **two** connection strings from Supabase Dashboard:
  - [ ] Transaction Pooler URL → `DATABASE_URL` (for runtime)
  - [ ] Direct URL → `DATABASE_DIRECT_URL` (for migrations)
- [ ] Create environment variables file (`.env`)
- [ ] Add `DATABASE_SSL_CA_PATH` for production (optional)
- [ ] Create `src/db/config.ts` with `getDBCredentials()` function
- [ ] Create `drizzle.config.ts` for migrations
- [ ] Update `src/db/drizzle.module.ts` to use credentials
- [ ] Test migration: `pnpm drizzle-kit migrate`
- [ ] Test runtime connection: start the server

---

## Understanding Supabase Connection Strings

### The Problem

```
Error: getaddrinfo ENOTFOUND db.[PROJECT-ID].supabase.co
```

This error occurs when using the wrong connection string type.

### Two Connection Strings You Need

| Type | Environment Variable | Host Format | Port | Use Case |
|------|---------------------|-------------|------|----------|
| **Transaction Pooler** | `DATABASE_URL` | `aws-0-[region].pooler.supabase.com` | 6543 | Runtime (ORM queries) |
| **Direct** | `DATABASE_DIRECT_URL` | `db.[ID].supabase.co` | 5432 | Migrations only |

### Where to Find Them

1. Go to **Supabase Dashboard** > **Project Settings** > **Database**
2. Scroll to **Connection string** section
3. Copy both:
   - **Transaction pooler** (Mode: Transaction) → `DATABASE_URL`
   - **Direct connection** → `DATABASE_DIRECT_URL`

> **Reference**: [Supabase Discussion #20934](https://github.com/orgs/supabase/discussions/20934)

---

## Environment Variables

### .env

```env
# Runtime connection (Transaction Pooler)
DATABASE_URL=postgresql://postgres.[PROJECT-ID]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres

# Migration connection (Direct)
DATABASE_DIRECT_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT-ID].supabase.co:5432/postgres

# Optional: SSL certificate for production
DATABASE_SSL_CA_PATH=/path/to/ca-certificate.crt
```

### Environment Schema (src/env.ts)

```typescript
import { z } from "zod";

export const env = z
  .object({
    DATABASE_URL: z.string().url(),
    APP_ENV: z.enum(["development", "production", "test"]).default("development"),
    // ... other env vars
  })
  .parse(process.env);

export const publicEnv = z
  .object({
    DATABASE_SSL_CA_PATH: z.string().optional(),
  })
  .parse(process.env);

export const appEnv = {
  isDevelopment: env.APP_ENV === "development",
  isProduction: env.APP_ENV === "production",
  isTest: env.APP_ENV === "test",
};
```

---

## Database Configuration

### Why Use Credentials Object Instead of URL?

When SSL is required (production), passing the URL directly to postgres.js may not work properly.

> **Reference**: [Drizzle ORM Discussion #881](https://github.com/drizzle-team/drizzle-orm/discussions/881)

### src/db/config.ts

```typescript
import * as fs from "node:fs";
import type { ConnectionOptions } from "node:tls";
import { appEnv, publicEnv } from "../env";

export const getDBCredentials = (dbUrl: string) => {
  const db_url = new URL(dbUrl);
  return {
    database: "postgres",
    host: db_url.hostname,
    port: Number.parseInt(db_url.port),
    user: db_url.username,
    password: db_url.password,
    ssl: appEnv.isDevelopment
      ? "prefer"
      : ({
          ca: publicEnv.DATABASE_SSL_CA_PATH
            ? fs.readFileSync(publicEnv.DATABASE_SSL_CA_PATH).toString()
            : undefined,
          rejectUnauthorized: true,
        } as "prefer" | ConnectionOptions),
  };
};

export const PROVIDER_DB_CONNECTION = "PROVIDER_DB_CONNECTION";
```

### Key Points

- **Function, not constant**: `getDBCredentials(dbUrl)` allows different URLs for different purposes
- **SSL handling**: "prefer" for development, full SSL object for production
- **URL parsing**: Extracts host, port, user, password from connection string

---

## Drizzle Configuration

### drizzle.config.ts

```typescript
import { defineConfig } from "drizzle-kit";
import { getDBCredentials } from "./src/db/config";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  // Use DIRECT URL for migrations (not pooler)
  dbCredentials: getDBCredentials(process.env.DATABASE_DIRECT_URL!),
});
```

### Why Direct URL for Migrations?

- Migrations need direct database access for DDL operations
- Transaction pooler may have issues with migration transactions
- Direct connection is more reliable for schema changes

---

## NestJS Integration

### src/db/drizzle.module.ts

```typescript
import { Module } from "@nestjs/common";
import { PostgresJsDatabase, drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { appEnv, env } from "../env";
import { getDBCredentials, PROVIDER_DB_CONNECTION } from "./config";
import * as schema from "./schema";

export type DbConnection = PostgresJsDatabase<typeof schema>;

export { PROVIDER_DB_CONNECTION };

@Module({
  providers: [
    {
      provide: PROVIDER_DB_CONNECTION,
      useFactory: async (): Promise<DbConnection> => {
        // Use POOLER URL for runtime queries
        const client = postgres(getDBCredentials(env.DATABASE_URL), {
          max: appEnv.isProduction ? 20 : 10,
          idle_timeout: 20,
          connect_timeout: 15,
        });
        return drizzle(client, { schema });
      },
    },
  ],
  exports: [PROVIDER_DB_CONNECTION],
})
export class DrizzleModule {}
```

### src/db/index.ts

```typescript
export * from "./schema";
export { getDBCredentials, PROVIDER_DB_CONNECTION } from "./config";
export { DrizzleModule, type DbConnection } from "./drizzle.module";
```

---

## Project Structure

```
src/
├── db/
│   ├── config.ts          # getDBCredentials() function
│   ├── drizzle.module.ts  # NestJS module (uses DATABASE_URL)
│   ├── schema.ts          # Drizzle schema definitions
│   └── index.ts           # Barrel exports
├── env.ts                 # Environment validation
drizzle/
├── migrations/            # Generated migrations
drizzle.config.ts          # Uses DATABASE_DIRECT_URL
```

---

## Commands

```bash
# Generate migrations from schema changes
pnpm drizzle-kit generate

# Apply migrations to database
pnpm drizzle-kit migrate

# Open Drizzle Studio (GUI)
pnpm drizzle-kit studio

# Push schema directly (dev only, no migration files)
pnpm drizzle-kit push
```

---

## Troubleshooting

### 1. `ENOTFOUND db.[ID].supabase.co`

**Cause**: Using Direct URL where Pooler URL is needed, or vice versa.

**Solution**:
- Runtime (drizzle.module.ts): Use `DATABASE_URL` (Pooler)
- Migrations (drizzle.config.ts): Use `DATABASE_DIRECT_URL` (Direct)

### 2. Decorator Transform Error

```
ERROR: Transforming JavaScript decorators is not supported
```

**Cause**: `drizzle.config.ts` imports from barrel file that includes NestJS modules.

**Solution**: Import directly from `config.ts`:
```typescript
// BAD
import { getDBCredentials } from "./src/db";
import { getDBCredentials } from "@/db";

// GOOD
import { getDBCredentials } from "./src/db/config";
```

### 3. SSL Certificate Errors in Production

**Solution**:
1. Download CA certificate from Supabase Dashboard
2. Set `DATABASE_SSL_CA_PATH` environment variable
3. Ensure file is readable by the application

### 4. Connection Timeout

**Solution**: Adjust connection pool settings:
```typescript
const client = postgres(credentials, {
  connect_timeout: 15,  // Seconds
  idle_timeout: 20,
  max: 10,
});
```

### 5. Environment Variables Not Loading in drizzle-kit

**Cause**: dotenv not loaded before config.ts imports.

**Solution**: Ensure `.env` is in working directory, or use:
```typescript
// At top of drizzle.config.ts
import "dotenv/config";
```

---

## SSL Configuration Reference

### Development
```typescript
ssl: "prefer"  // Connect with or without SSL
```

### Production (with CA certificate)
```typescript
ssl: {
  ca: fs.readFileSync(process.env.DATABASE_SSL_CA_PATH).toString(),
  rejectUnauthorized: true,
}
```

### Production (without certificate - not recommended)
```typescript
ssl: {
  rejectUnauthorized: false,
}
```

---

## Connection String Comparison

| Aspect | DATABASE_URL (Pooler) | DATABASE_DIRECT_URL (Direct) |
|--------|----------------------|------------------------------|
| Host | `aws-0-*.pooler.supabase.com` | `db.*.supabase.co` |
| Port | 6543 | 5432 |
| User | `postgres.[project-id]` | `postgres` |
| Used for | Runtime queries | Migrations |
| Connection pool | Supabase-managed | Direct to DB |

---

## Summary Table

| File | Connection Type | Environment Variable |
|------|-----------------|---------------------|
| `drizzle.config.ts` | Direct | `DATABASE_DIRECT_URL` |
| `drizzle.module.ts` | Pooler | `DATABASE_URL` |

| Issue | Solution |
|-------|----------|
| `ENOTFOUND` | Use correct URL for each context |
| Decorator error | Import from `config.ts` directly |
| SSL errors | Set `DATABASE_SSL_CA_PATH` |
| Env not loading | Add `import "dotenv/config"` |
