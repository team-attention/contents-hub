import type { StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type * as schema from "../../src/db/schema";

export type TestDb = PostgresJsDatabase<typeof schema>;

export function setGlobalTestPostgresContainer(container: StartedPostgreSqlContainer): void {
  (globalThis as Record<string, unknown>).TEST_POSTGRES_CONTAINER = container;
}

export function getGlobalTestPostgresContainer(): StartedPostgreSqlContainer {
  const container = (globalThis as Record<string, unknown>).TEST_POSTGRES_CONTAINER as
    | StartedPostgreSqlContainer
    | undefined;
  if (!container) {
    throw new Error("Test PostgreSQL container not initialized");
  }
  return container;
}

export async function clearGlobalTestDb(): Promise<void> {
  const container = (globalThis as Record<string, unknown>).TEST_POSTGRES_CONTAINER as
    | StartedPostgreSqlContainer
    | undefined;
  if (container) {
    await container.stop();
    (globalThis as Record<string, unknown>).TEST_POSTGRES_CONTAINER = undefined;
  }
}
