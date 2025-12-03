import type { INestApplication, Type } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import * as postgresModule from "postgres";
import { PROVIDER_DB_CONNECTION } from "../../src/db/drizzle.module";
import * as schema from "../../src/db/schema";
import { env } from "../../src/env";
import type { TestDb } from "./global";

const postgres =
  "default" in postgresModule ? (postgresModule.default as typeof postgresModule) : postgresModule;

const CREATE_TABLES_SQL = `
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  check_interval INTEGER NOT NULL DEFAULT 60,
  last_checked_at TIMESTAMPTZ,
  last_content_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS content_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES subscriptions(id),
  content_hash TEXT NOT NULL,
  summary TEXT,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`;

async function applySchema(db: TestDb): Promise<void> {
  await db.execute(sql.raw(CREATE_TABLES_SQL));
}

export async function createTestApp(
  moduleClass: Type,
): Promise<{ app: INestApplication; db: TestDb }> {
  const databaseUrl = env.DATABASE_URL;
  const client = postgres(databaseUrl);
  const db = drizzle(client, { schema });

  const moduleFixture = await Test.createTestingModule({
    imports: [moduleClass],
  })
    .overrideProvider(PROVIDER_DB_CONNECTION)
    .useValue(db)
    .compile();

  const app = moduleFixture.createNestApplication();
  await app.init();

  return { app, db };
}

export async function cleanAndSetupTestData(db: TestDb): Promise<void> {
  await db.execute(sql`DROP SCHEMA IF EXISTS public CASCADE`);
  await db.execute(sql`CREATE SCHEMA public`);
  await db.execute(sql`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
  await applySchema(db);
}

export { applySchema };
