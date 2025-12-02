import { Module } from "@nestjs/common";
import { PostgresJsDatabase, drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { appEnv, env } from "../env";
import * as schema from "./schema";

export const PROVIDER_DB_CONNECTION = "DB_CONNECTION";

export type DbConnection = PostgresJsDatabase<typeof schema>;

@Module({
  providers: [
    {
      provide: PROVIDER_DB_CONNECTION,
      useFactory: async (): Promise<DbConnection> => {
        const client = postgres(env.DATABASE_URL, {
          max: appEnv.isProduction ? 20 : 10,
          // min: appEnv.isProduction ? 5 : 1,
          idle_timeout: 20,
          connect_timeout: 15,
        });
        return drizzle(client, { schema });
      },
    },
  ],
  exports: [PROVIDER_DB_CONNECTION],
})
export class DrizzleModule {}
