---
when:
  - Deploying the server to Fly.io
  - Updating deployment configuration
  - Debugging production issues
  - Setting up CI/CD for deployment

what: |
  Fly.io deployment configuration and patterns for the contents-hub server.
  Covers Docker setup, fly.toml configuration, and secrets management.

not_when:
  - Local development setup
  - Extension deployment (not applicable)
---

# Fly.io Deployment

## Overview

The server (`apps/server`) is deployed to Fly.io using a multi-stage Dockerfile at project root.

- **App Name**: contents-hub-server
- **Primary Region**: nrt (Tokyo)
- **URL**: https://contents-hub-server.fly.dev

## Configuration Files

| File | Purpose |
|------|---------|
| `Dockerfile.server` | Multi-stage Docker build for server |
| `fly.toml` | Fly.io app configuration |
| `.dockerignore` | Files to exclude from Docker build |

## Docker Build Pattern (Monorepo)

For pnpm monorepo, Docker builds require special handling:

```dockerfile
# 1. Copy workspace config first
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# 2. Copy all package.json files for dependency resolution
COPY apps/server/package.json ./apps/server/

# 3. Install dependencies with workspace filtering
RUN pnpm install --frozen-lockfile --filter=server...

# 4. Build the specific package
RUN pnpm --filter=server build
```

**Key Points**:
- Dockerfile at project root for workspace context access
- Use `--filter=server...` to include transitive dependencies
- Multi-stage build to minimize final image size

## Secrets Management

### Setting Secrets

Use `fly secrets set` for sensitive environment variables:

```bash
$ cat .env | fly secrets set
```

### Required Secrets

| Secret | Description |
|--------|-------------|
| `DATABASE_URL` | Supabase PostgreSQL connection string |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_ANON_KEY` | Supabase anonymous key |
| `SUPABASE_JWT_SECRET` | JWT secret for token verification |
| `ANTHROPIC_API_KEY` | Anthropic API key for AI features |

### Viewing Secrets

```bash
fly secrets list  # List secret names (not values)
```

## Deployment Commands

```bash
# Deploy latest changes
fly deploy

# Check app status
fly status

# View logs
fly logs

# SSH into machine
fly ssh console

# Scale to zero (cost saving)
fly scale count 0

# Scale back up
fly scale count 1
```

## fly.toml Configuration

Key settings in `fly.toml`:

```toml
[http_service]
  internal_port = 3000
  auto_stop_machines = "stop"    # Scale to zero when idle
  auto_start_machines = true     # Auto-start on request
  min_machines_running = 0       # Allow full scale-down

[[vm]]
  memory = "256mb"
  cpu_kind = "shared"
  cpus = 1
```

## Health Check

The server exposes `/health` endpoint for Fly.io health checks:
- Interval: 10s
- Timeout: 5s
- Grace period: 5s

## Notes

- Server binds to `0.0.0.0` (required for Fly.io)
- PORT environment variable defaults to 3000
- Database is external (Supabase) - no Fly.io internal DB needed
