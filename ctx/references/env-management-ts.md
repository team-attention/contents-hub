# Environment Variable Management

A comprehensive guide for managing environment variables in TypeScript projects, combining 12-factor app principles with type-safe runtime validation.

## Overview

This guide covers two complementary strategies:
1. **File-based `.env` management with dotenv-flow** - Automatic loading with proper priority
2. **Type-safe `env.ts` pattern** - Runtime validation with Zod for fail-fast error detection

---

## Part 1: `.env` File Strategy (dotenv-flow)

### Why dotenv-flow?

[dotenv-flow](https://github.com/kerimdzhanov/dotenv-flow) extends dotenv with:
- Automatic file loading based on `NODE_ENV`
- Proper priority/override chain
- `.local` file support for developer-specific secrets
- Test environment isolation (`.env.local` auto-skipped)

### File Hierarchy & Priority

Load order (lowest to highest priority):

| Priority | File | VCS | Purpose |
|----------|------|-----|---------|
| 1 | `.env` | Commit | Shared defaults (PORT, DB_HOST, feature flags) |
| 2 | `.env.local` | Ignore | Local developer overrides (skipped in test) |
| 3 | `.env.{NODE_ENV}` | Commit | Environment-specific defaults |
| 4 | `.env.{NODE_ENV}.local` | Ignore | Environment-specific secrets |
| 5 | Shell environment | - | CI/CD injected values (highest priority) |

### What Goes Where

```
.env                      # Shared defaults (commit)
├── PORT=3000
├── LOG_LEVEL=info
└── FEATURE_FLAG_X=false

.env.local                # Local overrides (gitignore)
├── DEBUG=true
└── LOG_LEVEL=debug

.env.development          # Dev environment defaults (commit)
├── API_URL=http://localhost:3000
└── MOCK_ENABLED=true

.env.development.local    # Dev secrets (gitignore)
├── DATABASE_URL=postgres://...
└── API_KEY=dev-key-xxx

.env.production           # Prod defaults (commit)
├── API_URL=https://api.example.com
└── MOCK_ENABLED=false

.env.production.local     # Prod secrets (gitignore) - prefer platform secrets
├── DATABASE_URL=postgres://...
└── API_KEY=prod-key-xxx

.env.test                 # Test defaults (commit)
├── DATABASE_URL=postgres://localhost/test
└── MOCK_USER_ID=test-user-uuid
```

### .gitignore Configuration

```gitignore
# Environment files with secrets
.env.local
.env.*.local

# Keep shared defaults in VCS
# .env
# .env.development
# .env.production
# .env.test
```

### Key Principles

1. **Shared defaults in VCS**: Non-sensitive configuration (ports, feature flags, URLs without secrets) should be committed for team consistency

2. **Secrets in `.local` files**: API keys, database passwords, JWT secrets go in `.local` variants that are gitignored

3. **Production secrets via platform**: For production, prefer platform secret management over files:
   - Fly.io: `fly secrets set KEY=value`
   - Vercel: Dashboard or `vercel env add`
   - AWS: SSM Parameter Store / Secrets Manager
   - Kubernetes: Secrets

4. **Shell overrides file values**: CI/CD can inject secrets as environment variables, which take precedence over all files

5. **Test environment isolation**: dotenv-flow automatically skips `.env.local` in test environment to ensure reproducible tests

---

## Part 2: Type-Safe `env.ts` Pattern

### Why Zod Validation?

- **Fail-fast**: Application crashes immediately on startup if required env vars are missing
- **Type safety**: Full TypeScript autocomplete and type checking
- **Coercion**: Automatically convert strings to numbers, booleans
- **Documentation**: Schema serves as documentation for required variables

### Implementation with dotenv-flow

```typescript
// src/env.ts
import { config } from "dotenv-flow";
import { resolve } from "node:path";
import { z } from "zod";

// dotenv-flow automatically loads in order:
// .env -> .env.local -> .env.{APP_ENV} -> .env.{APP_ENV}.local
// Note: .env.local is skipped in test environment for reproducibility
config({
  node_env: process.env.APP_ENV,
  default_node_env: "development",
  path: resolve(__dirname, ".."),
});

// Define and validate schema
export const env = z
  .object({
    // App Configuration
    APP_ENV: z.enum(["development", "production", "test"]).default("development"),
    PORT: z.coerce.number().default(3000),

    // Database
    DATABASE_URL: z.string().url(),

    // External Services
    SUPABASE_URL: z.string().url(),
    SUPABASE_ANON_KEY: z.string(),
    SUPABASE_JWT_SECRET: z.string(),

    // Optional (dev/test only)
    MOCK_USER_ID: z.string().optional(),

    // API Keys
    ANTHROPIC_API_KEY: z.string(),
  })
  .parse(process.env);

// Convenience helpers
export const appEnv = {
  isDevelopment: env.APP_ENV === "development",
  isProduction: env.APP_ENV === "production",
  isTest: env.APP_ENV === "test",
};
```

### Usage

```typescript
// Import validated env anywhere
import { env, appEnv } from "@/env";

// Full type safety and autocomplete
const port = env.PORT;           // number
const dbUrl = env.DATABASE_URL;  // string
const mockId = env.MOCK_USER_ID; // string | undefined

// Environment checks
if (appEnv.isDevelopment) {
  console.log("Running in development mode");
}
```

### Common Patterns

**Conditional validation:**
```typescript
const schema = z.object({
  // Required in production only
  SENTRY_DSN: z.string().url().optional()
    .refine(
      (val) => process.env.APP_ENV !== "production" || val !== undefined,
      "SENTRY_DSN is required in production"
    ),
});
```

**URL with default:**
```typescript
API_URL: z.string().url().default("http://localhost:3000"),
```

**Boolean from string:**
```typescript
FEATURE_ENABLED: z.string()
  .transform((val) => val === "true")
  .default("false"),
```

**Enum values:**
```typescript
LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
```

---

## Project-Specific Setup

### Monorepo Considerations

For monorepos, env files can be at root or per-package:

```
monorepo/
├── .env                    # Shared across all packages
├── .env.local              # Local overrides (gitignored)
├── apps/
│   ├── server/
│   │   ├── .env            # Server-specific defaults
│   │   ├── .env.test       # Server test config
│   │   └── src/env.ts      # Server-specific schema
│   └── extension/
│       └── src/lib/env.ts  # Extension-specific schema
```

dotenv-flow handles this with the `path` option:
```typescript
config({
  node_env: process.env.APP_ENV,
  path: resolve(__dirname, ".."),  // Load from app directory
});
```

### CI/CD Integration

```yaml
# GitHub Actions example
jobs:
  test:
    env:
      APP_ENV: test
      DATABASE_URL: ${{ secrets.TEST_DATABASE_URL }}
    steps:
      - run: pnpm test
```

---

## Security Considerations

1. **Never commit secrets**: Double-check `.gitignore` includes all `.local` files
2. **Rotate secrets**: File-based secrets are harder to rotate; prefer platform secrets for production
3. **Limit access**: Production `.env.production.local` should only exist on production servers
4. **Audit logging**: Be careful with debug modes that might log env values
5. **Principle of least privilege**: Only include env vars that each service actually needs

---

## Summary

| Concern | Solution |
|---------|----------|
| Team consistency | Commit `.env` and `.env.{env}` with non-sensitive defaults |
| Local secrets | Use `.env.local` and `.env.{env}.local` (gitignored) |
| Production secrets | Platform secret managers (Fly.io, Vercel, AWS, etc.) |
| File loading | dotenv-flow with automatic priority chain |
| Type safety | Zod schema validation in `env.ts` |
| Fail-fast | Validate at application startup |
| CI/CD | Inject via shell environment variables |

---

## Setup Checklist

### Initial Setup

- [ ] Install dependencies: `pnpm add dotenv-flow && pnpm add -D @types/dotenv-flow`
- [ ] Create `src/env.ts` with Zod schema
- [ ] Add `.env.local` and `.env.*.local` to `.gitignore`
- [ ] Create `.env` with shared non-sensitive defaults
- [ ] Create `.env.test` for test environment

### Adding New Environment Variables

- [ ] Add to Zod schema in `env.ts` with appropriate type
- [ ] Add default value to `.env` or `.env.{env}` (if non-sensitive)
- [ ] Document in README or `.env.example`
- [ ] Add to platform secrets if production-only

### Production Deployment

- [ ] All secrets configured in platform secret manager (NOT in files)
- [ ] `APP_ENV=production` set in deployment environment
- [ ] No `.env.production.local` file on server (use platform secrets)
- [ ] Verify `env.ts` validation passes on startup

### Team Onboarding

- [ ] Clone repo and run `pnpm install`
- [ ] Copy `.env.example` to `.env.local` (if provided)
- [ ] Fill in personal secrets (API keys, etc.) in `.env.local`
- [ ] Run `pnpm dev` - should fail-fast if missing required vars

### Security Audit

- [ ] No secrets in `.env`, `.env.development`, `.env.production`
- [ ] `.gitignore` includes `.env.local` and `.env.*.local`
- [ ] Git history doesn't contain committed secrets
- [ ] Production uses platform secrets, not file-based
- [ ] Secrets are rotated periodically
