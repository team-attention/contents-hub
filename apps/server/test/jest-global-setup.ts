import "./env-setup";
import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../src/db/schema";
import { env } from "../src/env";
import { setGlobalTestPostgresContainer } from "./utils/global";
import { cleanAndSetupTestData, validateTestDb } from "./utils/helpers";

export default async function globalSetup() {
  const databaseUrl = env.DATABASE_URL;
  const url = new URL(databaseUrl);

  const container = await new PostgreSqlContainer("postgres:15-alpine")
    .withUsername(url.username)
    .withPassword(url.password)
    .withDatabase(url.pathname.slice(1))
    .withExposedPorts({ container: 5432, host: Number.parseInt(url.port) })
    .withReuse()
    .start();

  setGlobalTestPostgresContainer(container);

  const client = postgres(databaseUrl, {
    onnotice: () => {}, // Suppress notices
  });
  const db = drizzle(client, { schema, logger: false });

  // Push schema to db
  await cleanAndSetupTestData(db);

  // Validate schema was created
  await validateTestDb(db);

  await client.end();
}
