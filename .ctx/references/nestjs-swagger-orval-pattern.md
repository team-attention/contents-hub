# NestJS Swagger + Orval Pattern

This document describes the pattern for generating type-safe API clients from NestJS Swagger documentation using Orval in a pnpm monorepo.

## Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                          FLOW                                   │
└─────────────────────────────────────────────────────────────────┘

 NestJS Server                    Orval                    React Client
 ┌────────────────┐              ┌─────────────┐          ┌────────────────┐
 │ Controllers    │              │             │          │ Generated      │
 │ + @ApiTags     │ ──generates──▶ swagger.json ──reads──▶│ React Query    │
 │ + @ApiProperty │              │             │          │ Hooks + Types  │
 │ + DTOs         │              └─────────────┘          └────────────────┘
 └────────────────┘                                             │
                                                                ▼
                                                         ┌────────────────┐
                                                         │ Custom Mutator │
                                                         │ - Auth Token   │
                                                         │ - Error Handle │
                                                         └────────────────┘
```

**Benefits:**
- **Single Source of Truth**: Swagger spec is the only API definition
- **Type Safety**: Server DTOs automatically sync with client types
- **Better DX**: IDE autocomplete and refactoring support
- **Easy Maintenance**: Client auto-updates when API changes

---

## Project Structure

```
contents-hub/
├── package.json              # Root scripts: generate, generate:swagger, generate:api
├── apps/
│   ├── server/
│   │   ├── nest-cli.json     # Swagger plugin config
│   │   ├── scripts/
│   │   │   └── generate-swagger-docs.ts  # Standalone swagger generation
│   │   ├── __generated__/
│   │   │   └── swagger.json  # Generated swagger spec (gitignored)
│   │   └── src/
│   │       └── *.controller.ts, *.dto.ts
│   └── extension/
│       ├── orval.config.ts   # Orval configuration
│       └── src/lib/api/
│           ├── client.ts     # Custom HTTP client (mutator)
│           └── __generated__/ # Generated hooks/types (gitignored)
```

---

## Server Setup (NestJS)

### 1. Install Dependencies

```bash
pnpm --filter @contents-hub/server add @nestjs/swagger class-validator class-transformer
```

### 2. Configure nest-cli.json

```json
{
  "$schema": "https://json.schemastore.org/nest-cli",
  "collection": "@nestjs/schematics",
  "sourceRoot": "src",
  "compilerOptions": {
    "deleteOutDir": true,
    "plugins": [
      {
        "name": "@nestjs/swagger",
        "options": {
          "classValidatorShim": true,
          "introspectComments": true,
          "dtoFileNameSuffix": [".dto.ts", ".entity.ts"],
          "controllerFileNameSuffix": [".controller.ts"]
        }
      }
    ]
  }
}
```

### 3. Swagger Generation Script

Create `apps/server/scripts/generate-swagger-docs.ts`:

```typescript
// Set dummy env vars for swagger generation (no actual DB connection needed)
// These must be set BEFORE any imports that trigger env validation
process.env.APP_ENV ??= "development";
process.env.DATABASE_URL ??= "postgresql://dummy:dummy@localhost:5432/dummy";
process.env.SUPABASE_URL ??= "http://localhost:54321";
process.env.SUPABASE_ANON_KEY ??= "dummy";
process.env.SUPABASE_JWT_SECRET ??= "dummy";
process.env.ANTHROPIC_API_KEY ??= "dummy";
// Add any other required env vars for your project

import { mkdirSync, writeFileSync } from "node:fs";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "../src/app.module";

async function generateSwaggerDocs() {
  const app = await NestFactory.create(AppModule, { logger: false });

  const config = new DocumentBuilder()
    .setTitle("Contents Hub API")
    .setDescription("API documentation for Contents Hub")
    .setVersion("1.0")
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);

  mkdirSync("__generated__", { recursive: true });
  writeFileSync("__generated__/swagger.json", JSON.stringify(document, null, 2));

  console.log("Swagger docs generated at __generated__/swagger.json");

  await app.close();
  process.exit(0);
}

generateSwaggerDocs();
```

**Why dummy env vars?**
- Swagger generation only extracts OpenAPI spec from decorators
- No actual DB connection or API calls needed
- Using `??=` ensures real env vars aren't overwritten if they exist
- This allows CI to run without secrets

### 4. Server package.json Scripts

```json
{
  "scripts": {
    "generate:swagger": "ts-node -r tsconfig-paths/register scripts/generate-swagger-docs.ts"
  }
}
```

### 5. Controller Decorators

```typescript
import { Controller, Get, Post, Delete, Body, Param, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from "@nestjs/swagger";

@Controller("subscriptions")
@ApiTags("subscriptions")
@ApiBearerAuth()
export class SubscriptionsController {
  @Get()
  @ApiOperation({ summary: "Get all subscriptions" })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiQuery({ name: "offset", required: false, type: Number })
  @ApiResponse({ status: 200, type: SubscriptionListResponseDto })
  findAll(@Query("limit") limit?: number, @Query("offset") offset?: number) {}

  @Post()
  @ApiOperation({ summary: "Create a subscription" })
  @ApiResponse({ status: 201, type: SubscriptionResponseDto })
  create(@Body() dto: CreateSubscriptionDto) {}

  @Delete(":id")
  @ApiOperation({ summary: "Delete a subscription" })
  @ApiResponse({ status: 204 })
  remove(@Param("id") id: string) {}
}
```

### 6. DTO Patterns

**Response DTO:**
```typescript
import { ApiProperty } from "@nestjs/swagger";

export class SubscriptionResponseDto {
  @ApiProperty({ example: "550e8400-e29b-41d4-a716-446655440000" })
  id: string;

  @ApiProperty({ example: "https://example.com/feed.xml" })
  feedUrl: string;

  @ApiProperty({ example: "2024-01-01T00:00:00.000Z" })
  createdAt: string;
}

export class SubscriptionListResponseDto {
  @ApiProperty({ type: [SubscriptionResponseDto] })
  items: SubscriptionResponseDto[];
}
```

**Request DTO:**
```typescript
import { ApiProperty } from "@nestjs/swagger";
import { IsUrl, IsOptional, IsArray, IsString } from "class-validator";

export class CreateSubscriptionDto {
  @ApiProperty({ example: "https://example.com/feed.xml" })
  @IsUrl()
  feedUrl: string;

  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}
```

---

## Client Setup (Orval)

### 1. Install Dependencies

```bash
pnpm --filter @contents-hub/extension add -D orval
pnpm --filter @contents-hub/extension add @tanstack/react-query
```

### 2. Create orval.config.ts

```typescript
import { defineConfig } from "orval";

export default defineConfig({
  api: {
    input: {
      target: "../server/__generated__/swagger.json",
      filters: {
        tags: [/^(?!.*system|admin).*$/], // Exclude admin/system endpoints
      },
    },
    output: {
      target: "./src/lib/api/__generated__/api.ts",
      schemas: "./src/lib/api/__generated__/models",
      client: "react-query",
      httpClient: "fetch",
      override: {
        mutator: {
          path: "./src/lib/api/client.ts",
          name: "apiClient",
        },
        query: {
          useQuery: true,
          useSuspenseQuery: true,
          useInfinite: false,
        },
        operationName: (operation) => {
          const originalName = operation.operationId ?? "";
          const action = originalName.replace(/.*Controller_/gi, "");

          const tag = operation.tags?.[0];
          if (!tag) return action;

          // Convert to singular PascalCase: subscriptions → Subscription
          const domain = tag.endsWith("s")
            ? tag.slice(0, -1).charAt(0).toUpperCase() + tag.slice(1, -1)
            : tag.charAt(0).toUpperCase() + tag.slice(1);

          // Handle reserved words: delete → remove
          if (action === "delete") return `remove${domain}`;
          return `${action}${domain}`;
        },
      },
      biome: true,
    },
  },
});
```

**Operation Naming Results:**
- `SubscriptionsController_create` → `createSubscription`
- `SubscriptionsController_findAll` → `findAllSubscription`
- `SubscriptionsController_delete` → `removeSubscription`

### 3. Custom HTTP Client (Mutator)

Create `src/lib/api/client.ts`:

```typescript
import { supabase } from "../supabase";
import { env } from "../env";

export class ApiError extends Error {
  constructor(
    public message: string,
    public status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const apiClient = async <T>(url: string, options: RequestInit): Promise<T> => {
  const fullUrl = `${env.API_SERVER_URL}${url}`;

  // Get auth token from Supabase session
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  if (session?.access_token) {
    (headers as Record<string, string>).Authorization = `Bearer ${session.access_token}`;
  }

  const response = await fetch(fullUrl, { ...options, headers });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new ApiError(error.message ?? response.statusText, response.status);
  }

  if (response.status === 204) {
    return { status: response.status, data: null } as T;
  }

  const data = await response.json();
  return { status: response.status, data } as T;
};
```

### 4. Client package.json Scripts

```json
{
  "scripts": {
    "generate:api": "orval"
  }
}
```

---

## Monorepo Integration

### Root package.json Scripts

```json
{
  "scripts": {
    "generate:swagger": "pnpm --filter @contents-hub/server generate:swagger",
    "generate:api": "pnpm --filter @contents-hub/extension generate:api",
    "generate": "pnpm generate:swagger && pnpm generate:api"
  }
}
```

### .gitignore

```gitignore
# Generated API files (regenerated in CI)
apps/server/__generated__/
apps/extension/src/lib/api/__generated__/
```

---

## CI/CD Integration

### GitHub Actions Workflow

```yaml
# .github/workflows/ci.yml
name: CI

on:
  pull_request:
  push:
    branches: [main]

jobs:
  check:
    name: Lint & Type Check
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
          cache: pnpm

      - name: Install dependencies
        run: pnpm install

      - name: Run check (lint + format)
        run: pnpm check

      - name: Generate API client
        run: pnpm generate

      - name: Run type check
        run: pnpm typecheck

  build:
    name: Build
    runs-on: ubuntu-latest
    needs: check
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
          cache: pnpm

      - name: Install dependencies
        run: pnpm install

      - name: Generate API client
        run: pnpm generate

      - name: Build all packages
        run: pnpm build
```

**Key Points:**
- `pnpm generate` must run BEFORE `typecheck` and `build`
- No secrets needed - swagger generation uses dummy env vars
- Generated files are gitignored but recreated in CI

---

## Usage Example

```typescript
import { useQueryClient } from "@tanstack/react-query";
import {
  useFindAllSubscription,
  useCreateSubscription,
  useRemoveSubscription,
  getFindAllSubscriptionQueryKey,
  findByUrlSubscription,
} from "../lib/api/__generated__/api";

export function useSubscriptions() {
  const queryClient = useQueryClient();

  const { data, isLoading, error: queryError } = useFindAllSubscription();
  const createMutation = useCreateSubscription();
  const removeMutation = useRemoveSubscription();

  const subscriptions = data?.data.items ?? [];

  const addSubscription = useCallback(
    async (feedUrl: string) => {
      // Check if already exists
      const existing = await findByUrlSubscription(feedUrl);
      if (existing.data) {
        throw new Error("Already subscribed");
      }

      await createMutation.mutateAsync({ data: { feedUrl } });
      queryClient.invalidateQueries({ queryKey: getFindAllSubscriptionQueryKey() });
    },
    [createMutation, queryClient],
  );

  const removeSubscription = useCallback(
    async (id: string) => {
      await removeMutation.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: getFindAllSubscriptionQueryKey() });
    },
    [removeMutation, queryClient],
  );

  return {
    subscriptions,
    isLoading,
    error,
    addSubscription,
    removeSubscription,
  };
}
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Types don't match server | Re-run `pnpm generate` |
| CI fails with ZodError for env | Add missing dummy env vars in generate-swagger-docs.ts |
| Duplicate operation names | Add unique `operationId` in `@ApiOperation()` |
| Optional field not nullable | Use `@ApiProperty({ required: false, nullable: true })` |
| Empty swagger.json | Check nest-cli.json plugin config |
| Module not found in CI | Ensure `pnpm generate` runs before typecheck/build |

---

## Summary

| Layer | Responsibility | Key Files |
|-------|---------------|-----------|
| **Server** | API + Swagger generation | `generate-swagger-docs.ts`, `*.controller.ts`, `*.dto.ts` |
| **Config** | Swagger plugin | `nest-cli.json` |
| **Orval** | Code generation | `orval.config.ts`, `client.ts` |
| **Generated** | Type-safe hooks | `__generated__/api.ts`, `__generated__/models/` |
| **CI** | Regenerate on every build | `.github/workflows/ci.yml` |
