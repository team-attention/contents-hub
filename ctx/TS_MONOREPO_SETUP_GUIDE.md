# pnpm Monorepo Setup Guide

This document provides a comprehensive guide to the pnpm workspace-based monorepo configuration.
It serves as a reference for AI agents and developers to replicate this setup in other projects.

---

## Table of Contents

1. [Project Structure](#1-project-structure)
2. [pnpm Workspace Configuration](#2-pnpm-workspace-configuration)
3. [Biome (Linter & Formatter)](#3-biome-linter--formatter)
4. [TypeScript Configuration](#4-typescript-configuration)
5. [Jest Testing Configuration](#5-jest-testing-configuration)
6. [Server Setup (NestJS)](#6-server-setup-nestjs)
7. [Drizzle ORM Setup](#7-drizzle-orm-setup)
8. [Frontend Setup (React/Vite)](#8-frontend-setup-reactvite)
9. [Orval (OpenAPI Client Generator)](#9-orval-openapi-client-generator)
10. [Infrastructure (Terraform)](#10-infrastructure-terraform)
11. [GitHub Actions CI/CD](#11-github-actions-cicd)
12. [Shared Packages](#12-shared-packages)
13. [Command Reference](#13-command-reference)
14. [New Project Checklist](#14-new-project-checklist)

---

## 1. Project Structure

```
.
├── apps/                      # Application packages
│   ├── server/               # NestJS backend server
│   ├── web/                  # React (Vite) frontend
├── infra/                    # Terraform infrastructure code
├── packages/                 # Shared packages
│   └── ui/                   # Design system (Tailwind components)
│   └── shared/               # Shared types & utilities
├── package.json              # Root package.json
├── pnpm-workspace.yaml       # pnpm workspace configuration
├── biome.json                # Biome linter/formatter configuration
├── .nvmrc                    # Node.js version (nvm)
└── .github/workflows/        # GitHub Actions CI/CD
```

---

## 2. pnpm Workspace Configuration

### `pnpm-workspace.yaml`

```yaml
packages:
  - "apps/*"
  - "apps/creator-search/client"  # Sub-packages can also be workspaces
  - "packages/*"
```

### Root `package.json`

```json
{
  "private": true,
  "type": "module",
  "scripts": {
    "check": "biome check && pnpm run -r --parallel --stream check",
    "check:staged": "biome check --staged --no-errors-on-unmatched && pnpm run -r --parallel --stream check",
    "fix": "biome check --write && pnpm run -r --parallel --stream fix",
    "test": "pnpm run -r --parallel --stream test",
    "dev": "pnpm run -r --parallel --stream dev"
  },
  "devDependencies": {
    "@biomejs/biome": "^1.9.4",
    "@types/jest": "^29.5.14",
    "@types/node": "^20.17.19",
    "jest": "^30.0.4",
    "ts-jest": "^29.2.5",
    "tsx": "^4.19.2",
    "typescript": "^5.7.3"
  },
  "packageManager": "pnpm@10.5.2+sha512..."
}
```

**Key Points:**
- `pnpm run -r --parallel --stream`: Execute scripts across all workspaces in parallel
- `packageManager` field: Lock pnpm version
- `"type": "module"`: Default to ESM

### `.nvmrc` (Node.js Version Management)

```
22.16.0
```

**Usage:**
```bash
nvm use        # Automatically reads .nvmrc
nvm install    # Install the specified version
```

---

## 3. Biome (Linter & Formatter)

Biome replaces ESLint + Prettier with a unified, faster tool.

### `biome.json`

```json
{
  "$schema": "https://biomejs.dev/schemas/1.8.2/schema.json",
  "organizeImports": {
    "enabled": true
  },
  "linter": {
    "enabled": true,
    "ignore": ["mockServiceWorker.js", "apps/data_process", "infra/", "*.js"],
    "rules": {
      "recommended": true,
      "correctness": {
        "useJsxKeyInIterable": "off",
        "noUnusedImports": "error"
      },
      "style": {
        "noNonNullAssertion": "off"
      },
      "suspicious": {
        "noShadowRestrictedNames": "off",
        "noArrayIndexKey": "off",
        "noFocusedTests": "off"
      },
      "security": {
        "noDangerouslySetInnerHtml": "off"
      },
      "complexity": {
        "noForEach": "off"
      }
    }
  },
  "formatter": {
    "enabled": true,
    "formatWithErrors": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 120,
    "lineEnding": "lf"
  },
  "json": {
    "parser": {
      "allowComments": true
    },
    "formatter": {
      "trailingCommas": "none"
    }
  },
  "overrides": [
    {
      "include": ["**/*.controller.ts", "**/*.service.ts"],
      "linter": {
        "rules": {
          "style": {
            "useImportType": "off"
          }
        }
      }
    }
  ],
  "vcs": {
    "enabled": true,
    "clientKind": "git",
    "useIgnoreFile": true
  },
  "files": {
    "maxSize": 10485760,
    "ignore": [
      "*.js",
      ".output",
      "dist",
      "__generated__",
      "apps/server/drizzle/*",
      "apps/server/migrations/*"
    ]
  },
  "javascript": {
    "parser": {
      "unsafeParameterDecoratorsEnabled": true
    },
    "formatter": {
      "arrowParentheses": "always",
      "bracketSameLine": false,
      "bracketSpacing": true,
      "jsxQuoteStyle": "double",
      "quoteProperties": "asNeeded",
      "semicolons": "always",
      "trailingCommas": "all"
    }
  }
}
```

**Key Points:**
- `unsafeParameterDecoratorsEnabled: true`: Required for NestJS decorators
- `overrides`: Disable `useImportType` for NestJS controllers/services (DI requires runtime imports)
- `vcs.useIgnoreFile`: Respects `.gitignore`

### Commands

```bash
pnpm check              # Full lint and format check
pnpm check:staged       # Check staged files only (for pre-commit)
pnpm fix                # Auto-fix issues
```

---

## 4. TypeScript Configuration

### Server (NestJS) - `apps/server/tsconfig.json`

```json
{
  "compilerOptions": {
    "module": "commonjs",
    "moduleResolution": "node",
    "declaration": true,
    "removeComments": true,
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "allowSyntheticDefaultImports": true,
    "target": "ES2021",
    "sourceMap": true,
    "outDir": "./dist",
    "baseUrl": "./",
    "incremental": true,
    "skipLibCheck": true,
    "strictNullChecks": true,
    "noImplicitAny": true,
    "resolveJsonModule": true,
    "typeRoots": ["node_modules/@types", "src/types"],
    "paths": {
      "@/*": ["src/*"]
    }
  }
}
```

**NestJS Required Settings:**
- `emitDecoratorMetadata: true`: Required for NestJS decorator metadata
- `experimentalDecorators: true`: Enable decorator syntax
- `module: commonjs`: NestJS requires CommonJS

### Frontend (React/Vite) - `apps/web/tsconfig.app.json`

```json
{
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.app.tsbuildinfo",
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"],
      "~/*": ["./public/*"]
    },
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ESNext", "ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src", "vitest.setup.ts", "vitest.config.ts"]
}
```

**Vite Required Settings:**
- `moduleResolution: bundler`: Vite bundler mode
- `noEmit: true`: Vite handles transpilation
- `jsx: react-jsx`: React 17+ JSX runtime

```json
{
  "compilerOptions": {
    "module": "commonjs",
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "target": "ES2021",
    "baseUrl": "./",
    "paths": {
      "@/*": ["./src/*"],
      "@server/*": ["./server/src/*"]
    },
    "types": ["jest", "node"],
    "allowJs": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*", "bin/**/*", "scripts/**/*", "server/**/*"]
}
```

---

## 5. Jest Testing Configuration

### Standard Jest Config - `apps/server/jest.config.js`

```javascript
module.exports = {
  moduleFileExtensions: ["js", "json", "ts"],
  testRegex: ".*\\.spec\\.ts$",
  transform: {
    "^.+\\.(t|j)s$": "ts-jest",
  },
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  collectCoverageFrom: ["**/*.(t|j)s"],
  coverageDirectory: "../coverage",
  testEnvironment: "node",
};
```
---

## 6. Server Setup (NestJS)

### `nest-cli.json`

```json
{
  "$schema": "https://json.schemastore.org/nest-cli",
  "collection": "@nestjs/schematics",
  "sourceRoot": "src",
  "compilerOptions": {
    "deleteOutDir": true,
    "assets": [
      {
        "include": "**/*.html",
        "outDir": "dist/public",
        "watchAssets": true
      }
    ],
    "plugins": [
      {
        "name": "@nestjs/swagger",
        "options": {
          "classValidatorShim": true,
          "introspectComments": true,
          "dtoFileNameSuffix": [".dto.ts", ".entity.ts", ".interface.ts"],
          "controllerFileNameSuffix": [".controller.ts"]
        }
      }
    ],
    "tsConfigPath": "tsconfig.build.json",
    "watchAssets": true
  }
}
```

**Swagger Plugin Features:**
- `classValidatorShim`: Auto-detect class-validator decorators
- `introspectComments`: JSDoc comments appear in API docs
- Auto-generates OpenAPI schema from DTOs

---

## 7. Drizzle ORM Setup

### Configuration - `apps/server/drizzle.config.ts`

```typescript
import { publicEnv } from "@/common/config/env";
import { DATABASE_CREDENTIALS } from "@/db/config";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  out: "./migrations",
  schema: "./src/db/schema.ts",
  schemaFilter: publicEnv.DATABASE_SCHEMA.split(","),
  dialect: "postgresql",
  dbCredentials: DATABASE_CREDENTIALS,
  migrations: {
    table: "__drizzle_migrations",
    schema: "backpac",
  },
  verbose: true,
});
```

### Database Connection - `apps/server/src/db/config.ts`

```typescript
import * as fs from "node:fs";
import type { ConnectionOptions } from "node:tls";
import { appEnv } from "@/common/config/env";
import { env, publicEnv } from "@/common/config/env";

const db_url = new URL(env.DATABASE_URL);

export const DATABASE_CREDENTIALS = {
  database: "postgres",
  host: db_url.hostname,
  port: Number.parseInt(db_url.port),
  user: db_url.username,
  password: db_url.password,
  ssl: appEnv.isDevelopment
    ? "prefer"
    : ({
        ca: fs.readFileSync(publicEnv.DATABASE_SSL_CA_PATH).toString(),
        rejectUnauthorized: true,
      } as "prefer" | ConnectionOptions),
};

export const PROVIDER_DB_CONNECTION = "PROVIDER_DB_CONNECTION";
```

### NestJS Module - `apps/server/src/db/drizzle.module.ts`

```typescript
import { Module } from "@nestjs/common";
import { drizzle } from "drizzle-orm/postgres-js";
import * as postgres from "postgres";
import { DATABASE_CREDENTIALS, PROVIDER_DB_CONNECTION } from "./config";
import * as schema from "./schema";

@Module({
  providers: [
    {
      provide: PROVIDER_DB_CONNECTION,
      useFactory: async () => {
        const client = postgres(DATABASE_CREDENTIALS);
        return drizzle({
          client,
          schema,
          // logger: true,  // Enable for debugging
        });
      },
    },
  ],
  exports: [PROVIDER_DB_CONNECTION],
})
export class DrizzleModule {}
```

### Schema Definition - `apps/server/src/db/schema.ts`

```typescript
import { relations, sql } from "drizzle-orm";
import {
  boolean, index, integer, jsonb, numeric, pgSchema,
  primaryKey, text, timestamp, unique, uniqueIndex, uuid, varchar,
} from "drizzle-orm/pg-core";
import { customType } from "drizzle-orm/pg-core";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

// Custom JSONB type with TypeScript generics
export const customJsonb = <TData>(name: string) =>
  customType<{ data: TData; driverData: string }>({
    dataType() {
      return "jsonb";
    },
    toDriver(value: TData) {
      return value;
    },
  })(name);

// Multi-schema support
const authSchema = pgSchema("auth");
export const backpac = pgSchema("backpac");

// Enum definitions
export const workspaceRoleEnum = backpac.enum("workspace_role", ["OWNER", "ADMIN", "MEMBER"]);
export const channelPlatformEnum = backpac.enum("channel_platform", ["YOUTUBE_SHORTS", "TIKTOK", "INSTAGRAM"]);

// Table definition with auto-updated timestamps
export const Table_workspaces = backpac.table("workspaces", {
  id: uuid("id").defaultRandom().primaryKey().notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  thumbnailUrl: text("thumbnail_url"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
    .defaultNow()
    .notNull()
    .$onUpdate(() => sql`now()`),  // Auto-update on mutation
  deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "string" }),  // Soft delete
});

// Table with indexes and constraints
export const Table_workspaceMembers = backpac.table(
  "workspace_users",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => Table_workspaces.id, { onDelete: "restrict" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => authUsers.id),
    role: workspaceRoleEnum("role").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull()
      .$onUpdate(() => sql`now()`),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "string" }),
  },
  (table) => [
    uniqueIndex("workspace_users_user_id_workspace_id_unique").on(table.workspaceId, table.userId),
    index("workspace_users_user_id_idx").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
    // Conditional unique index
    uniqueIndex("workspace_users_workspace_id_owner_unique")
      .on(table.workspaceId)
      .where(sql`${table.role} = 'OWNER' AND ${table.deletedAt} IS NULL`),
  ],
);

// Type export for dependency injection
export type DbConnection = PostgresJsDatabase<typeof import("./schema")>;
```

### Query Patterns

#### Simple Query with Query API
```typescript
const user = await this.db.query.authUsers.findFirst({
  where: eq(authUsers.id, userId),
  columns: { email: true },
});
```

#### Relation Loading
```typescript
const workspace = await this.db.query.Table_workspaces.findFirst({
  where: eq(Table_workspaces.id, workspaceId),
  with: {
    workspaceMembers: {
      with: { user: true },
      where: isNull(Table_workspaceMembers.deletedAt),
    },
  },
});
```

#### Complex Select with Joins
```typescript
const workspaces = await this.db
  .select({
    id: Table_workspaces.id,
    name: Table_workspaces.name,
  })
  .from(Table_workspaces)
  .innerJoin(Table_workspaceMembers, eq(Table_workspaces.id, Table_workspaceMembers.workspaceId))
  .where(and(
    eq(Table_workspaceMembers.userId, userId),
    isNull(Table_workspaceMembers.deletedAt),
  ));
```

#### Upsert (Insert or Update)
```typescript
await this.db
  .insert(Table_youtubeCreators)
  .values({ ...creator })
  .onConflictDoUpdate({
    target: [Table_youtubeCreators.channelId],
    set: {
      username: creator.username,
      updatedAt: sql`now()`,
    },
  });
```

#### Transaction
```typescript
await this.db.transaction(async (tx) => {
  await tx.update(Table_channels).set({ ... }).where(...);
  await tx.delete(...).where(...);
  // Rollback on error
});
```

### Service Injection

```typescript
@Injectable()
export class WorkspaceService {
  constructor(
    @Inject(PROVIDER_DB_CONNECTION)
    private readonly db: DbConnection,
  ) {}
}
```

---

## 8. Frontend Setup (React/Vite)

### Vite Configuration - `apps/web/vite.config.ts`

```typescript
import path from "node:path";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import react from "@vitejs/plugin-react";
import { codeInspectorPlugin } from "code-inspector-plugin";
import UnoCSS from "unocss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    react(),
    UnoCSS(),
    sentryVitePlugin({
      org: "your-org",
      project: "your-project",
      authToken: process.env.SENTRY_AUTH_TOKEN,
      reactComponentAnnotation: { enabled: true },
      sourcemaps: { filesToDeleteAfterUpload: ["*.map"] },
    }),
    codeInspectorPlugin({
      bundler: "vite",
      editor: "cursor",
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "~": path.resolve(__dirname, "./public"),
    },
  },
  server: {
    host: true,
    proxy: {
      "/api": {
        target: "http://localhost:8888",
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    sourcemap: true,
  },
});
```

### Tailwind CSS (Shared Configuration)

`apps/web/tailwind.config.js`:
```javascript
import config from "@your-org/ui/tailwind";
export default config;
```

The shared config is managed in `packages/ui/tailwind.config.js` with:
- CSS variable-based theming
- Custom colors, fonts, animations
- shadcn/ui compatible settings

---

## 9. Orval (OpenAPI Client Generator)

Orval generates type-safe React Query hooks from the server's OpenAPI specification.

### Configuration - `apps/web/orval.config.ts`

```typescript
import { defineConfig } from "orval";

export default defineConfig({
  base: {
    input: {
      target: "../../apps/server/__generated__/swagger.json",
      filters: {
        // Exclude admin and system endpoints
        tags: [/^(?!.*system|admin).*$/],
      },
    },
    output: {
      target: "src/api/__generated__/api.schema.ts",
      schemas: "src/api/__generated__/models",
      baseUrl: "http://localhost:8888",  // Replaced by mutator
      client: "react-query",
      httpClient: "fetch",
      override: {
        // Remove "Controller" from operation names
        operationName: (operation, route, verb) => {
          const originalName = operation.operationId ?? "";
          const _staged = originalName.replace(/.*Controller/gi, "");
          return _staged.replace(/_api\/v(\d+)/gi, (match, version) => `ApiV${version}`);
        },
        mutator: {
          path: "src/api/client.ts",
          name: "apiClient",
        },
        query: {
          useQuery: true,
          useInfinite: false,
          useSuspenseQuery: true,  // React 19 suspense support
        },
      },
      biome: true,  // Auto-format with Biome
    },
  },
});
```

### Custom API Client (Mutator) - `apps/web/src/api/client.ts`

```typescript
import { appEnv } from "@/constants/app-env";
import { env } from "@/constants/env";
import { supabase } from "@/lib/supabase";

const getUrl = (contextUrl: string): string => {
  const baseUrl = env.API_BASE;

  if (appEnv.isDevelopment) {
    // Use proxy to avoid CORS in development
    try {
      const url = new URL(contextUrl);
      return `${url.pathname}${url.search}`;
    } catch {
      return contextUrl;
    }
  }

  const url = new URL(contextUrl);
  return new URL(`${baseUrl}${url.pathname}${url.search}`).toString();
};

const getHeaders = async (headers?: HeadersInit): Promise<HeadersInit> => {
  const accessToken = (await supabase.auth.getSession()).data.session?.access_token;

  let _headers = { ...headers };
  if (accessToken !== undefined) {
    _headers = {
      ..._headers,
      Authorization: `Bearer ${accessToken}`,
    };
  }

  return _headers;
};

export const apiClient = async <T>(url: string, options: RequestInit): Promise<T> => {
  const requestUrl = getUrl(url);
  const requestHeaders = await getHeaders(options.headers);

  const request = new Request(requestUrl, { ...options, headers: requestHeaders });
  const response = await fetch(request);

  if (response.status === 401) {
    throw new KnownAuthError("Unauthorized", window.location.href);
  }

  if (response.status >= 400 && response.status < 500) {
    const errorData = await response.json();
    throw new KnownError(errorData.message ?? response.statusText, response.status);
  }

  if (response.status >= 500) {
    throw new Error(response.statusText);
  }

  if (response.status === 204 || response.status === 201 || options.method === "PATCH") {
    return { status: response.status, data: null, headers: response.headers } as T;
  }

  const data = await response.json();
  return { status: response.status, data, headers: response.headers } as T;
};

export class KnownError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "KnownError";
    this.status = status;
  }

  static is(error: unknown): error is KnownError {
    return error instanceof KnownError;
  }
}

export class KnownAuthError extends KnownError {
  redirectUrl?: string;

  constructor(message: string, redirectUrl?: string) {
    super(message, 401);
    this.name = "KnownAuthError";
    this.redirectUrl = redirectUrl;
  }

  static is(error: unknown): error is KnownAuthError {
    return error instanceof KnownAuthError;
  }
}

// For multipart uploads
apiClient.post = async <T>(path: string, { body }: { headers?: HeadersInit; body: BodyInit }) => {
  const url = `${env.API_BASE}${path}`;
  return await apiClient<T>(url, {
    method: "POST",
    body,
    credentials: "include",
  });
};
```

### Server OpenAPI Generation

The server generates OpenAPI spec in `apps/server/src/main.ts`:

```typescript
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";

const config = new DocumentBuilder()
  .setTitle("Backpac API")
  .setDescription("The Backpac API description")
  .setVersion("1.0")
  .addBearerAuth()
  .build();

if (appEnv.isDevelopment) {
  const document = SwaggerModule.createDocument(app, config, {
    deepScanRoutes: true,
  });
  SwaggerModule.setup("docs", app, () => document);

  // Write to file only if content changes
  const swaggerPath = "__generated__/swagger.json";
  const existingContent = readFileSync(swaggerPath, "utf8");
  const newContent = JSON.stringify(document, null, 2);

  if (existingContent !== newContent) {
    writeFileSync(swaggerPath, newContent);
  }
}
```

### Development Workflow

```json
{
  "scripts": {
    "dev": "concurrently \"pnpm watch:server-openapi\" \"vite\"",
    "watch:server-openapi": "pnpm codegen:server && chokidar \"../../apps/server/__generated__/swagger.json\" -c \"pnpm codegen:server\"",
    "codegen:server": "orval --clean"
  }
}
```

**Flow:**
1. Server starts and generates `swagger.json`
2. `chokidar` watches for changes
3. On change, `orval --clean` regenerates client
4. Frontend uses type-safe hooks immediately

### Generated Code Usage

```typescript
// Import generated hooks
import {
  useGetWorkspaceMembersApiV1Suspense,
  useCreateInvitationApiV1,
  getGetWorkspaceMembersApiV1QueryKey,
} from "@/api/__generated__/api.schema";

// Suspense Query (React 19)
const { data } = useGetWorkspaceMembersApiV1Suspense(workspaceId);

// Mutation with cache invalidation
const queryClient = useQueryClient();
const { mutateAsync: inviteMember } = useCreateInvitationApiV1({
  mutation: {
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: getGetWorkspaceMembersApiV1QueryKey(workspaceId),
      });
    },
  },
});
```

---

## 10. Infrastructure (Terraform)

### `infra/main.tf`

```hcl
terraform {
  cloud {
    organization = "your-org"
    workspaces {
      name = "your-workspace"
    }
  }

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = "us-west-1"
  default_tags {
    tags = {
      Terraform = "https://github.com/your-org/your-repo"
    }
  }
}

# Multi-region providers
provider "aws" {
  region = "us-east-1"
  alias  = "east"
}
```

### Key Terraform Files

| File | Description |
|------|-------------|
| `ecr.tf` | Docker image registry |
| `ecs.tf` | Container orchestration |
| `iam.tf` | IAM roles and policies |
| `network.tf` | VPC, subnets, security groups |
| `monitoring.tf` | CloudWatch alarms |
| `ses.tf` | Email service |

---

## 11. GitHub Actions CI/CD

### Server CI - `.github/workflows/ci-server.yml`

```yaml
name: CI-SERVER
on:
  pull_request:
    paths:
      - 'apps/server/**'
      - 'package.json'
      - 'pnpm-lock.yaml'

concurrency:
  group: ${{ github.workflow }}-${{ github.event.pull_request.number || github.ref }}
  cancel-in-progress: true

jobs:
  check-js:
    name: Build and Check
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
          cache: pnpm
      - run: pnpm install
      - run: pnpm check

  test:
    name: E2E Tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
          cache: pnpm
      - run: pnpm install
      - name: Run E2E tests
        working-directory: ./apps/server
        run: pnpm test:e2e
```

### Frontend CI - `.github/workflows/ci-web.yml`

```yaml
name: CI-WEB
on:
  pull_request:
    paths:
      - 'apps/web/**'
      - 'package.json'
      - 'pnpm-lock.yaml'

concurrency:
  group: ${{ github.workflow }}-${{ github.event.pull_request.number || github.ref }}
  cancel-in-progress: true

jobs:
  check-js:
    name: Frontend
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
          cache: pnpm
      - run: pnpm install
      - name: Run checks
        working-directory: ./apps/web
        run: pnpm check
      - name: Run tests
        working-directory: ./apps/web
        run: pnpm test
      - name: Run build
        working-directory: ./apps/web
        run: pnpm build
```

**Key Points:**
- `paths` filter: Only run CI when relevant files change
- `concurrency`: Prevent duplicate runs
- `pnpm/action-setup@v4`: Auto-install pnpm
- `node-version-file: .nvmrc`: Use project's Node version

---

## 12. Shared Packages

### Shared Package `package.json`

```json
{
  "name": "@your-org/design-system",
  "version": "1.0.0",
  "type": "module",
  "main": "src/index.ts",
  "types": "src/index.d.ts",
  "module": "src/index.ts",
  "exports": {
    ".": "./src/index.ts",
    "./tailwind": "./tailwind.config.js",
    "./postcss": "./postcss.config.js",
    "./style": "./src/index.css"
  }
}
```

**Using workspace packages:**
```json
// apps/web/package.json
{
  "dependencies": {
    "@your-org/design-system": "workspace:*"
  }
}
```

---

## 13. Command Reference

```bash
# Root commands
pnpm install          # Install all dependencies
pnpm dev              # Start all dev servers
pnpm check            # Lint and type check
pnpm fix              # Auto-fix issues
pnpm test             # Run all tests

# Filtered commands (use package name from package.json)
pnpm --filter server dev               # Server only
pnpm --filter web dev                  # Web only
pnpm --filter server build             # Build server
pnpm --filter web build                # Build frontend

# Database commands
pnpm --filter server check:db          # Check migrations
drizzle-kit generate                   # Generate new migration
drizzle-kit push                       # Apply migrations

# API generation
pnpm --filter web codegen:server       # Regenerate API client
```

---

## 14. New Project Checklist

1. [ ] Install pnpm and set `packageManager` field
2. [ ] Create `.nvmrc` file with Node.js version
3. [ ] Configure `pnpm-workspace.yaml`
4. [ ] Copy and customize `biome.json`
5. [ ] Set up root `package.json` scripts
6. [ ] Configure `tsconfig.json` for each app
7. [ ] Set up Jest testing configuration
8. [ ] Configure NestJS with Swagger plugin
9. [ ] Set up Drizzle ORM with schema
10. [ ] Configure Vite with plugins
11. [ ] Set up Orval for API client generation
12. [ ] Create GitHub Actions workflows
13. [ ] Set up shared packages structure (if needed)
14. [ ] Configure Terraform infrastructure (if needed)
