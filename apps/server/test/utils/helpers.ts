import { type INestApplication, type Type, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { sql } from "drizzle-orm";
import { type PostgresJsDatabase, drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { PROVIDER_DB_CONNECTION } from "../../src/db/drizzle.module";
import * as schema from "../../src/db/schema";
import { env } from "../../src/env";
import type { TestDb } from "./global";

// This is a workaround for the issue that pushSchema is not working in programmatic way.
// REF: https://github.com/drizzle-team/drizzle-orm/discussions/4373#discussioncomment-12743792
const { generateDrizzleJson, generateMigration } = require("drizzle-kit/api") as typeof import(
  "drizzle-kit/api",
);

async function pushSchema(db: PostgresJsDatabase<typeof schema>) {
  const prevJson = generateDrizzleJson({});
  const curJson = generateDrizzleJson(schema, prevJson.id, undefined, "snake_case");
  const statements = await generateMigration(prevJson, curJson);
  for (const statement of statements) {
    await db.execute(statement);
  }
}

export async function createTestApp(
  moduleClass: Type,
): Promise<{ app: INestApplication; db: TestDb }> {
  const databaseUrl = env.DATABASE_URL;
  const client = postgres(databaseUrl, {
    onnotice: () => {}, // Suppress notices
  });
  const db = drizzle(client, { schema });

  const moduleFixture = await Test.createTestingModule({
    imports: [moduleClass],
  })
    .overrideProvider(PROVIDER_DB_CONNECTION)
    .useValue(db)
    .compile();

  const app = moduleFixture.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.init();

  return { app, db };
}

export async function cleanAndSetupTestData(db: TestDb): Promise<void> {
  // Pre-setup (with IF NOT EXISTS to handle reused containers)
  await db.execute(sql`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
  await db.execute(sql`DROP SCHEMA IF EXISTS "contents_hub" CASCADE`);
  // Push schema to db
  await pushSchema(db);
}

export async function validateTestDb(db: TestDb): Promise<void> {
  // Check that there is at least one table in the contents_hub schema
  const tables = await db.execute<{ count: number }>(
    sql`SELECT COUNT(*)::int AS count FROM pg_tables WHERE schemaname = 'contents_hub'`,
  );
  if (tables[0].count === 0) {
    throw new Error("No tables found in the contents_hub schema");
  }
}

export { pushSchema };
