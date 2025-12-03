import "./env-setup";
import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import * as postgresModule from "postgres";
import * as schema from "../src/db/schema";
import { env } from "../src/env";
import { setGlobalTestPostgresContainer } from "./utils/global";
import { applySchema } from "./utils/helpers";

const postgres =
  "default" in postgresModule ? (postgresModule.default as typeof postgresModule) : postgresModule;

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

  const client = postgres(databaseUrl);
  const db = drizzle(client, { schema });

  await db.execute(sql`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
  await applySchema(db);

  await client.end();
}
