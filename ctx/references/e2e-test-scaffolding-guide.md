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

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Jest Test Execution                      │
├─────────────────────────────────────────────────────────────┤
│  1. Global Setup                                             │
│     └─ Start PostgreSQL TestContainer                        │
│     └─ Apply Drizzle schema                                  │
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
  testTimeout: 10000,
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
MOCK_USER_ID=test-user-id
# Add other required environment variables...
```

### 3. Environment Loading (`test/env-setup.ts`)

```typescript
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({
  path: path.resolve(__dirname, "../.env.test"),
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
  (globalThis as any).TEST_POSTGRES_CONTAINER = container;
}

// Retrieve container
export function getGlobalTestPostgresContainer(): StartedPostgreSqlContainer {
  const container = (globalThis as any).TEST_POSTGRES_CONTAINER;
  if (!container) {
    throw new Error("Test PostgreSQL container not initialized");
  }
  return container;
}

// Cleanup container
export async function clearGlobalTestDb(): Promise<void> {
  const container = (globalThis as any).TEST_POSTGRES_CONTAINER;
  if (container) {
    await container.stop();
    (globalThis as any).TEST_POSTGRES_CONTAINER = undefined;
  }
}
```

### 5. Global Setup (`test/jest-global-setup.ts`)

```typescript
import "./env-setup"; // Load env vars first!
import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import postgres from "postgres";
import * as schema from "@/db/schema";
import { setGlobalTestPostgresContainer } from "./utils/global";

// Push Drizzle schema programmatically
async function pushSchema(db: ReturnType<typeof drizzle>) {
  const { generateDrizzleJson, generateMigration } = await import("drizzle-kit/api");
  const drizzleJson = generateDrizzleJson(schema);
  const migration = await generateMigration(
    { tables: {}, views: {}, enums: {}, schemas: {}, sequences: {}, roles: {}, policies: {}, _meta: { tables: {}, columns: {}, schemas: {} } },
    drizzleJson
  );

  for (const statement of migration.statements) {
    await db.execute(sql.raw(statement));
  }
}

export default async function globalSetup() {
  const databaseUrl = process.env.DATABASE_URL!;
  const url = new URL(databaseUrl);

  // Start TestContainer
  const container = await new PostgreSqlContainer("postgres:15-alpine")
    .withUsername(url.username)
    .withPassword(url.password)
    .withDatabase(url.pathname.slice(1))
    .withExposedPorts({ container: 5432, host: parseInt(url.port) })
    .withReuse() // Reuse container for faster local dev
    .start();

  setGlobalTestPostgresContainer(container);

  // Connect and apply schema
  const client = postgres(databaseUrl);
  const db = drizzle(client, { schema });

  // Install extensions
  await db.execute(sql`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

  // Apply schema
  await pushSchema(db);

  await client.end();
}
```

### 6. Global Teardown (`test/jest-global-teardown.ts`)

```typescript
import { clearGlobalTestDb } from "./utils/global";

export default async function globalTeardown() {
  await clearGlobalTestDb();
}
```

### 7. Test Helpers (`test/utils/helpers.ts`)

```typescript
import { Test } from "@nestjs/testing";
import { INestApplication, Type } from "@nestjs/common";
import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import postgres from "postgres";
import * as schema from "@/db/schema";
import { PROVIDER_DB_CONNECTION } from "@/db/config";
import { TestDb } from "./global";

// Create NestJS test app
export async function createTestApp(
  moduleClass: Type
): Promise<{ app: INestApplication; db: TestDb }> {
  const databaseUrl = process.env.DATABASE_URL!;
  const client = postgres(databaseUrl);
  const db = drizzle(client, { schema });

  const moduleFixture = await Test.createTestingModule({
    imports: [moduleClass],
  })
    .overrideProvider(PROVIDER_DB_CONNECTION)
    .useValue(db)
    // Add external service mocks as needed
    // .overrideProvider(ExternalService)
    // .useClass(MockExternalService)
    .compile();

  const app = moduleFixture.createNestApplication();
  await app.init();

  return { app, db };
}

// Reset DB between tests
export async function cleanAndSetupTestData(db: TestDb): Promise<void> {
  // Drop and recreate schema
  await db.execute(sql`DROP SCHEMA IF EXISTS public CASCADE`);
  await db.execute(sql`CREATE SCHEMA public`);
  await db.execute(sql`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

  // Reapply Drizzle schema
  await pushSchema(db);
}

// Create test user (with auth bypass)
export async function createTestUser(
  db: TestDb,
  email = "test@example.com"
): Promise<{ userId: string }> {
  const userId = globalThis.crypto.randomUUID();

  // Set env var for auth bypass
  process.env.MOCK_USER_ID = userId;

  // Insert test user
  await db.insert(schema.users).values({
    id: userId,
    email,
  });

  return { userId };
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
import request from "supertest";
import { INestApplication } from "@nestjs/common";
import { AppModule } from "@/app.module";
import {
  createTestApp,
  cleanAndSetupTestData,
  createTestUser,
} from "../utils/helpers";
import { TestDb } from "../utils/global";

describe("Feature Name (e2e)", () => {
  let app: INestApplication;
  let db: TestDb;
  let testUserId: string;

  beforeAll(async () => {
    ({ app, db } = await createTestApp(AppModule));
  });

  beforeEach(async () => {
    const { userId } = await createTestUser(db);
    testUserId = userId;
  });

  afterEach(async () => {
    await cleanAndSetupTestData(db);
  });

  afterAll(async () => {
    await app.close();
  });

  describe("GET /resources", () => {
    it("should return empty list initially", async () => {
      const response = await request(app.getHttpServer())
        .get("/resources")
        .set("Authorization", "Bearer dummy-token")
        .expect(200);

      expect(response.body.items).toEqual([]);
    });

    it("should return created resources", async () => {
      // Given: Insert test data directly
      await db.insert(schema.resources).values({
        userId: testUserId,
        name: "Test Resource",
      });

      // When
      const response = await request(app.getHttpServer())
        .get("/resources")
        .set("Authorization", "Bearer dummy-token")
        .expect(200);

      // Then
      expect(response.body.items).toHaveLength(1);
      expect(response.body.items[0].name).toBe("Test Resource");
    });
  });

  describe("POST /resources", () => {
    it("should create a new resource", async () => {
      const response = await request(app.getHttpServer())
        .post("/resources")
        .set("Authorization", "Bearer dummy-token")
        .send({ name: "New Resource" })
        .expect(201);

      expect(response.body.name).toBe("New Resource");

      // Verify in DB
      const resources = await db.query.resources.findMany({
        where: eq(schema.resources.userId, testUserId),
      });
      expect(resources).toHaveLength(1);
    });
  });
});
```

### Domain-Specific Helper Pattern

```typescript
// test/e2e/orders/helper.ts
import { TestDb } from "../../utils/global";
import * as schema from "@/db/schema";

export async function createTestProduct(
  db: TestDb,
  overrides: Partial<typeof schema.products.$inferInsert> = {}
): Promise<string> {
  const productId = globalThis.crypto.randomUUID();

  await db.insert(schema.products).values({
    id: productId,
    name: "Test Product",
    price: 1000,
    ...overrides,
  });

  return productId;
}

export async function createTestOrder(
  db: TestDb,
  userId: string,
  productId: string
): Promise<string> {
  const orderId = globalThis.crypto.randomUUID();

  await db.insert(schema.orders).values({
    id: orderId,
    userId,
    productId,
    status: "pending",
  });

  return orderId;
}
```

### External API Mocking Pattern

```typescript
describe("Webhook handling (e2e)", () => {
  let validateSpy: jest.SpyInstance;

  beforeEach(async () => {
    // Spy on external service method
    validateSpy = jest
      .spyOn(ExternalClient.prototype, "validateSignature")
      .mockResolvedValue(true);
  });

  afterEach(async () => {
    validateSpy.mockRestore();
  });

  it("should process valid webhook", async () => {
    const webhookPayload = {
      event: "payment.completed",
      data: { id: "payment-123" },
    };

    await request(app.getHttpServer())
      .post("/webhooks/external")
      .set("X-Signature", "test-signature")
      .send(webhookPayload)
      .expect(200);

    expect(validateSpy).toHaveBeenCalledWith("test-signature", webhookPayload);
  });
});
```

### Auth Bypass Pattern

In your auth guard, add a bypass for test environment:

```typescript
// src/guards/auth.guard.ts
@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    // Bypass for tests
    if (process.env.MOCK_USER_ID) {
      const request = context.switchToHttp().getRequest();
      request.user = { id: process.env.MOCK_USER_ID };
      return true;
    }

    // Normal auth logic...
  }
}
```

---

## Running Tests

### package.json Scripts

```json
{
  "scripts": {
    "test": "jest",
    "test:e2e": "APP_ENV=ci jest --config ./jest-e2e.config.js --runInBand",
    "test:e2e:watch": "APP_ENV=ci jest --config ./jest-e2e.config.js --runInBand --watch"
  }
}
```

### Commands

```bash
# Run all E2E tests
pnpm test:e2e

# Run specific test file
pnpm test:e2e -- orders.e2e-spec.ts

# Watch mode
pnpm test:e2e:watch
```

---

## Required Dependencies

```json
{
  "devDependencies": {
    "@nestjs/testing": "^10.x",
    "@testcontainers/postgresql": "^10.x",
    "testcontainers": "^10.x",
    "jest": "^29.x",
    "ts-jest": "^29.x",
    "supertest": "^6.x",
    "@types/supertest": "^2.x"
  }
}
```

---

## Checklist for New Projects

- [ ] Install dependencies (`@testcontainers/postgresql`, `testcontainers`, `supertest`)
- [ ] Create `jest-e2e.config.js`
- [ ] Create `.env.test` (specify DATABASE_URL with fixed port)
- [ ] Create `test/env-setup.ts`
- [ ] Create `test/utils/global.ts`
- [ ] Create `test/utils/helpers.ts` (adapt to your project)
- [ ] Create `test/utils/mock.ts` (for external services)
- [ ] Create `test/jest-global-setup.ts`
- [ ] Create `test/jest-global-teardown.ts`
- [ ] Add `test:e2e` script to `package.json` (`--runInBand` is required!)
- [ ] Add `MOCK_USER_ID` bypass logic to auth guard (optional)

---

## Troubleshooting

### "Test PostgreSQL container not initialized"
- Verify `--runInBand` flag is present in test command
- Check that `jest-global-setup.ts` is correctly configured in Jest config

### Data leaking between tests
- Ensure `cleanAndSetupTestData` is called in `afterEach`
- Verify schema drop/recreate logic works correctly

### Container fails to start
- Check Docker is running
- Check for port conflicts (verify port in `.env.test`)
- When using `withReuse()`, may need to manually clean up old containers

### Timeout errors
- Increase `testTimeout` value (default 10 seconds)
- First run may take longer due to image download
