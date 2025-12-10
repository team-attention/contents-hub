# NestJS + Drizzle + TestContainers E2E Test Scaffolding Guide

A comprehensive guide for setting up E2E tests with NestJS, Drizzle ORM, and TestContainers.

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Directory Structure](#directory-structure)
- [Core Components](#core-components)
- [Test Patterns](#test-patterns)
- [Running Tests](#running-tests)
- [Checklist for New Projects](#checklist-for-new-projects)
- [Troubleshooting](#troubleshooting)
- [Common Pitfalls](#common-pitfalls)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Jest Test Execution                      │
├─────────────────────────────────────────────────────────────┤
│  1. Global Setup                                             │
│     └─ Start PostgreSQL TestContainer                        │
│     └─ Apply Drizzle schema (via drizzle-kit API)            │
│     └─ Validate schema was created                           │
├─────────────────────────────────────────────────────────────┤
│  2. Test Files (Sequential with --runInBand)                 │
│     ├─ beforeAll: Create NestJS app + DB connection          │
│     ├─ beforeEach: Create test data                          │
│     ├─ Test execution                                        │
│     └─ afterEach: Reset schema (complete isolation)          │
├─────────────────────────────────────────────────────────────┤
│  3. Global Teardown                                          │
│     └─ Stop PostgreSQL container                             │
└─────────────────────────────────────────────────────────────┘
```

### Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| **Single global container** | Saves container startup time per test (seconds → 0) |
| **Schema reset per test** | Complete test isolation, no data leakage |
| **`--runInBand` required** | Single process execution for global variable sharing |
| **DI-based mocking** | Leverages NestJS testing utilities, isolates external services |
| **Env-based auth bypass** | Simple auth bypass via `MOCK_USER_ID` environment variable |
| **drizzle-kit API for schema** | Auto-sync with schema.ts - no manual SQL maintenance |

---

## Directory Structure

```
apps/server/
├── test/
│   ├── e2e/                           # E2E test files
│   │   ├── auth.e2e-spec.ts
│   │   ├── feature-a/
│   │   │   ├── feature-a.e2e-spec.ts
│   │   │   └── helper.ts              # Domain-specific helpers
│   │   └── feature-b/
│   │       ├── feature-b.e2e-spec.ts
│   │       └── helper.ts
│   ├── utils/                         # Shared test utilities
│   │   ├── global.ts                  # Container management
│   │   ├── helpers.ts                 # App creation & data setup
│   │   └── mock.ts                    # External service mocks
│   ├── env-setup.ts                   # Environment variable loading
│   ├── jest-global-setup.ts           # Global setup
│   └── jest-global-teardown.ts        # Global teardown
├── jest-e2e.config.js                 # E2E Jest configuration
└── .env.test                          # Test environment variables
```

---

## Core Components

### 1. Jest E2E Configuration (`jest-e2e.config.js`)

```javascript
module.exports = {
  moduleFileExtensions: ["js", "json", "ts"],
  rootDir: ".",
  testEnvironment: "node",
  testRegex: ".e2e-spec.ts$",
  testTimeout: 30000, // 30s recommended for container startup
  transform: {
    "^.+\\.(t|j)s$": "ts-jest",
  },
  // Key: Global setup/teardown
  globalSetup: "./test/jest-global-setup.ts",
  globalTeardown: "./test/jest-global-teardown.ts",
  setupFilesAfterEnv: ["./test/env-setup.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
};
```

### 2. Environment Variables (`.env.test`)

```bash
APP_ENV=test
DATABASE_URL=postgres://test:test@localhost:54328/postgres

# IMPORTANT: MOCK_USER_ID must be a valid UUID if your user_id column is UUID type!
# ❌ WRONG: MOCK_USER_ID=test-user-id
# ✅ CORRECT:
MOCK_USER_ID=00000000-0000-0000-0000-000000000001

# Add other required environment variables...
SUPABASE_URL=http://localhost:54321
SUPABASE_ANON_KEY=test-anon-key
SUPABASE_JWT_SECRET=test-jwt-secret
```

### 3. Environment Loading (`test/env-setup.ts`)

```typescript
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({
  path: path.resolve(__dirname, "../.env.test"),
  override: true, // Ensure test env vars take precedence
});
```

### 4. Global Container Management (`test/utils/global.ts`)

```typescript
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import * as schema from "@/db/schema";

export type TestDb = PostgresJsDatabase<typeof schema>;

// Store container globally
export function setGlobalTestPostgresContainer(
  container: StartedPostgreSqlContainer
): void {
  (globalThis as Record<string, unknown>).TEST_POSTGRES_CONTAINER = container;
}

// Retrieve container
export function getGlobalTestPostgresContainer(): StartedPostgreSqlContainer {
  const container = (globalThis as Record<string, unknown>).TEST_POSTGRES_CONTAINER as
    | StartedPostgreSqlContainer
    | undefined;
  if (!container) {
    throw new Error("Test PostgreSQL container not initialized");
  }
  return container;
}

// Cleanup container
export async function clearGlobalTestDb(): Promise<void> {
  const container = (globalThis as Record<string, unknown>).TEST_POSTGRES_CONTAINER as
    | StartedPostgreSqlContainer
    | undefined;
  if (container) {
    await container.stop();
    (globalThis as Record<string, unknown>).TEST_POSTGRES_CONTAINER = undefined;
  }
}
```

### 5. Test Helpers (`test/utils/helpers.ts`)

> **IMPORTANT**: Use `require()` for drizzle-kit/api to avoid TypeScript compilation issues.

```typescript
import { ValidationPipe, type INestApplication, type Type } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { sql } from "drizzle-orm";
import { type PostgresJsDatabase, drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { PROVIDER_DB_CONNECTION } from "@/db/drizzle.module";
import * as schema from "@/db/schema";
import { env } from "@/env";
import type { TestDb } from "./global";

// IMPORTANT: Use require() instead of import() - this is a workaround for drizzle-kit API
// REF: https://github.com/drizzle-team/drizzle-orm/discussions/4373#discussioncomment-12743792
const { generateDrizzleJson, generateMigration } =
  require("drizzle-kit/api") as typeof import("drizzle-kit/api");

/**
 * Push Drizzle schema to database programmatically.
 * This auto-syncs with schema.ts - no manual SQL maintenance needed!
 */
async function pushSchema(db: PostgresJsDatabase<typeof schema>): Promise<void> {
  const prevJson = generateDrizzleJson({});
  // Pass prevJson.id to maintain consistency, use "snake_case" for column naming
  const curJson = generateDrizzleJson(schema, prevJson.id, undefined, "snake_case");
  const statements = await generateMigration(prevJson, curJson);

  for (const statement of statements) {
    await db.execute(statement);
  }
}

/**
 * Create NestJS test application with DB connection override.
 * IMPORTANT: Includes ValidationPipe for DTO validation to work!
 */
export async function createTestApp(
  moduleClass: Type,
): Promise<{ app: INestApplication; db: TestDb }> {
  const databaseUrl = env.DATABASE_URL;
  const client = postgres(databaseUrl, {
    onnotice: () => {}, // Suppress PostgreSQL NOTICE messages
  });
  const db = drizzle(client, { schema });

  const moduleFixture = await Test.createTestingModule({
    imports: [moduleClass],
  })
    .overrideProvider(PROVIDER_DB_CONNECTION)
    .useValue(db)
    // Add external service mocks as needed:
    // .overrideProvider(ExternalService)
    // .useClass(MockExternalService)
    .compile();

  const app = moduleFixture.createNestApplication();

  // IMPORTANT: Add ValidationPipe for class-validator to work!
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  await app.init();

  return { app, db };
}

/**
 * Reset database between tests for complete isolation.
 * Drops and recreates the schema, then reapplies Drizzle schema.
 */
export async function cleanAndSetupTestData(db: TestDb): Promise<void> {
  // If using custom schema (e.g., pgSchema("contents_hub")), drop that schema
  // If using default public schema, drop public
  await db.execute(sql`DROP SCHEMA IF EXISTS "contents_hub" CASCADE`);
  // await db.execute(sql`DROP SCHEMA IF EXISTS public CASCADE`);
  // await db.execute(sql`CREATE SCHEMA public`);

  await db.execute(sql`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
  await pushSchema(db);
}

/**
 * Validate that the schema was created correctly.
 * Call this in globalSetup after pushSchema to catch setup issues early.
 */
export async function validateTestDb(db: TestDb): Promise<void> {
  // Adjust schema name based on your pgSchema() configuration
  const tables = await db.execute<{ count: number }>(
    sql`SELECT COUNT(*)::int AS count FROM pg_tables WHERE schemaname = 'contents_hub'`,
  );
  if (tables[0].count === 0) {
    throw new Error("No tables found in the contents_hub schema - schema push may have failed");
  }
}

export { pushSchema };
```

### 6. Global Setup (`test/jest-global-setup.ts`)

```typescript
import "./env-setup"; // Load env vars first!
import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/db/schema";
import { env } from "@/env";
import { setGlobalTestPostgresContainer } from "./utils/global";
import { cleanAndSetupTestData, validateTestDb } from "./utils/helpers";

export default async function globalSetup() {
  const databaseUrl = env.DATABASE_URL;
  const url = new URL(databaseUrl);

  // Start TestContainer
  const container = await new PostgreSqlContainer("postgres:15-alpine")
    .withUsername(url.username)
    .withPassword(url.password)
    .withDatabase(url.pathname.slice(1))
    .withExposedPorts({ container: 5432, host: Number.parseInt(url.port) })
    .withReuse() // Reuse container for faster local dev
    .start();

  setGlobalTestPostgresContainer(container);

  // Connect and apply schema
  const client = postgres(databaseUrl, {
    onnotice: () => {}, // Suppress NOTICE messages
  });
  const db = drizzle(client, { schema, logger: false });

  // Apply Drizzle schema
  await cleanAndSetupTestData(db);

  // Validate schema was created - fail fast if setup is broken
  await validateTestDb(db);

  await client.end();
}
```

### 7. Global Teardown (`test/jest-global-teardown.ts`)

```typescript
import { clearGlobalTestDb } from "./utils/global";

export default async function globalTeardown() {
  await clearGlobalTestDb();
}
```

### 8. External Service Mocks (`test/utils/mock.ts`)

```typescript
// Example: Mock for external payment service
export class MockPaymentService {
  static readonly PAYMENT_ID = "test-payment-id";
  static readonly TRANSACTION_ID = "test-transaction-id";

  async createPayment() {
    return { id: MockPaymentService.PAYMENT_ID };
  }

  async processPayment() {
    return { success: true, transactionId: MockPaymentService.TRANSACTION_ID };
  }

  async refundPayment() {
    return { success: true };
  }
}

// Example: Mock for external notification service
export class MockNotificationService {
  async sendEmail() {
    return { sent: true };
  }

  async sendPushNotification() {
    return { sent: true };
  }
}
```

---

## Test Patterns

### Basic E2E Test Structure

```typescript
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { AppModule } from "@/app.module";
import type { TestDb } from "../utils/global";
import { cleanAndSetupTestData, createTestApp } from "../utils/helpers";

describe("Feature Name (e2e)", () => {
  let app: INestApplication;
  let db: TestDb;

  beforeAll(async () => {
    ({ app, db } = await createTestApp(AppModule));
  });

  afterEach(async () => {
    await cleanAndSetupTestData(db);
  });

  afterAll(async () => {
    await app.close();
  });

  describe("GET /resources", () => {
    it("should return 401 without token", async () => {
      await request(app.getHttpServer()).get("/resources").expect(401);
    });

    it("should return empty list initially", async () => {
      const response = await request(app.getHttpServer())
        .get("/resources")
        .set("Authorization", "Bearer any-token")
        .expect(200);

      expect(response.body.items).toEqual([]);
    });
  });

  describe("POST /resources", () => {
    it("should create a new resource", async () => {
      const response = await request(app.getHttpServer())
        .post("/resources")
        .set("Authorization", "Bearer any-token")
        .send({ name: "New Resource", url: "https://example.com" })
        .expect(201);

      expect(response.body.name).toBe("New Resource");
      expect(response.body).toHaveProperty("id");
    });

    it("should return 400 for invalid input", async () => {
      await request(app.getHttpServer())
        .post("/resources")
        .set("Authorization", "Bearer any-token")
        .send({ name: "" }) // Invalid
        .expect(400);
    });
  });
});
```

### Auth Bypass Pattern (Using Passport Strategy)

```typescript
// src/auth/strategies/mock.strategy.ts
import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { Strategy } from "passport-http-bearer";
import { env } from "@/env";

export const MOCK_STRATEGY = "mock";

@Injectable()
export class MockStrategy extends PassportStrategy(Strategy, MOCK_STRATEGY) {
  async validate(_token: string): Promise<{ id: string; email: string }> {
    return {
      id: env.MOCK_USER_ID ?? "mock-user-id",
      email: "mock@example.com",
    };
  }
}
```

```typescript
// src/auth/decorators/auth.decorator.ts
import { UseGuards, applyDecorators } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { appEnv, env } from "@/env";
import { MOCK_STRATEGY } from "../strategies/mock.strategy";
import { SUPABASE_STRATEGY } from "../strategies/supabase.strategy";

export function Auth() {
  // Use mock strategy in test/development when MOCK_USER_ID is set
  const strategy =
    (appEnv.isDevelopment || appEnv.isTest) && env.MOCK_USER_ID
      ? MOCK_STRATEGY
      : SUPABASE_STRATEGY;

  return applyDecorators(UseGuards(AuthGuard(strategy)));
}
```

---

## Running Tests

### package.json Scripts

```json
{
  "scripts": {
    "test": "jest",
    "test:e2e": "APP_ENV=test jest --config ./jest-e2e.config.js --runInBand",
    "test:e2e:watch": "APP_ENV=test jest --config ./jest-e2e.config.js --runInBand --watch"
  }
}
```

### Commands

```bash
# Run all E2E tests
pnpm test:e2e

# Run specific test file
pnpm test:e2e -- subscriptions.e2e-spec.ts

# Watch mode
pnpm test:e2e:watch
```

---

## Required Dependencies

```json
{
  "devDependencies": {
    "@nestjs/testing": "^10.x",
    "@testcontainers/postgresql": "^11.x",
    "testcontainers": "^11.x",
    "jest": "^29.x",
    "ts-jest": "^29.x",
    "supertest": "^7.x",
    "@types/supertest": "^6.x"
  }
}
```

---

## Checklist for New Projects

### Initial Setup
- [ ] Install dependencies (`@testcontainers/postgresql`, `testcontainers`, `supertest`)
- [ ] Create `jest-e2e.config.js` with `testTimeout: 30000`
- [ ] Create `.env.test` with **valid UUID** for `MOCK_USER_ID`
- [ ] Create `test/env-setup.ts` with `override: true`
- [ ] Create `test/utils/global.ts`
- [ ] Create `test/utils/helpers.ts` with:
  - [ ] `require("drizzle-kit/api")` (NOT `import`)
  - [ ] `ValidationPipe` in `createTestApp`
  - [ ] `onnotice: () => {}` to suppress PostgreSQL notices
  - [ ] `validateTestDb` function
- [ ] Create `test/jest-global-setup.ts` with `validateTestDb` call
- [ ] Create `test/jest-global-teardown.ts`
- [ ] Add `test:e2e` script to `package.json` (`--runInBand` required!)

### Auth Setup
- [ ] Create mock auth strategy (e.g., `MockStrategy`)
- [ ] Add conditional strategy selection in `Auth()` decorator
- [ ] Ensure `MOCK_USER_ID` is valid UUID format if DB uses UUID type

### Schema Setup
- [ ] Identify your schema name (e.g., `contents_hub`, `public`)
- [ ] Update `cleanAndSetupTestData` to drop correct schema
- [ ] Update `validateTestDb` to check correct schema

---

## Troubleshooting

### "Test PostgreSQL container not initialized"
- Verify `--runInBand` flag is present in test command
- Check that `jest-global-setup.ts` is correctly configured in Jest config

### "invalid input syntax for type uuid"
- **Cause**: `MOCK_USER_ID` is set to a non-UUID string like `test-user-id`
- **Fix**: Use valid UUID format: `MOCK_USER_ID=00000000-0000-0000-0000-000000000001`

### "relation does not exist" after schema drop
- **Cause**: `cleanAndSetupTestData` drops schema but `pushSchema` fails silently
- **Fix**: Add `validateTestDb()` call after `pushSchema()` to catch failures early

### Data leaking between tests
- Ensure `cleanAndSetupTestData` is called in `afterEach`
- Verify schema drop/recreate logic uses correct schema name

### Container fails to start
- Check Docker is running
- Check for port conflicts (verify port in `.env.test`)
- When using `withReuse()`, may need to manually clean up old containers

### Timeout errors
- Increase `testTimeout` value (30000ms recommended)
- First run may take longer due to image download

### ValidationPipe not working (400 errors not returned)
- **Cause**: `ValidationPipe` not added to test app
- **Fix**: Add `app.useGlobalPipes(new ValidationPipe(...))` in `createTestApp`

### PostgreSQL NOTICE messages cluttering output
- Add `onnotice: () => {}` to postgres client options

---

## Common Pitfalls

### 1. drizzle-kit API Import Issue

**Problem**: TypeScript errors when using `await import("drizzle-kit/api")`

**Solution**: Use CommonJS `require()` with type assertion:
```typescript
// ❌ WRONG - causes TypeScript errors
const { generateDrizzleJson, generateMigration } = await import("drizzle-kit/api");

// ✅ CORRECT - workaround
const { generateDrizzleJson, generateMigration } =
  require("drizzle-kit/api") as typeof import("drizzle-kit/api");
```

### 2. generateDrizzleJson Parameters

**Problem**: Schema not generated correctly

**Solution**: Pass correct parameters:
```typescript
const prevJson = generateDrizzleJson({});
// Pass prevJson.id as second param, undefined as third, "snake_case" as fourth
const curJson = generateDrizzleJson(schema, prevJson.id, undefined, "snake_case");
const statements = await generateMigration(prevJson, curJson);

// Note: statements is an array directly, NOT statements.statements
for (const statement of statements) {
  await db.execute(statement);
}
```

### 3. Custom Schema (pgSchema) Handling

**Problem**: Using `pgSchema("my_schema")` but dropping `public` schema

**Solution**: Drop the correct schema:
```typescript
// If your schema.ts uses: export const mySchema = pgSchema("contents_hub");
await db.execute(sql`DROP SCHEMA IF EXISTS "contents_hub" CASCADE`);

// NOT:
// await db.execute(sql`DROP SCHEMA IF EXISTS public CASCADE`);
```

### 4. Null Response Serialization

**Problem**: Service returns `null` but test expects `null`, gets `{}`

**Solution**: NestJS may serialize `null` as empty object. Adjust test:
```typescript
// ❌ May fail
expect(response.body).toBeNull();

// ✅ More robust
expect(response.body.id).toBeUndefined();
// or check for empty object
expect(Object.keys(response.body).length).toBe(0);
```

### 5. UUID vs String for MOCK_USER_ID

**Problem**: `invalid input syntax for type uuid: "test-user-id"`

**Solution**: If your `user_id` column is UUID type, `MOCK_USER_ID` must be valid UUID:
```bash
# ❌ WRONG
MOCK_USER_ID=test-user-id

# ✅ CORRECT
MOCK_USER_ID=00000000-0000-0000-0000-000000000001
```
