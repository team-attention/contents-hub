import * as fs from "node:fs";
import type { ConnectionOptions } from "node:tls";
import { appEnv, publicEnv } from "../env";

export const getDBCredentials = (dbUrl: string) => {
  const db_url = new URL(dbUrl);
  return {
    database: "postgres",
    host: db_url.hostname,
    port: Number.parseInt(db_url.port),
    user: db_url.username,
    password: db_url.password,
    // This is a workaround for the SSL issue in development mode
    ssl: appEnv.isDevelopment
      ? "prefer"
      : ({
          ca: publicEnv.DATABASE_SSL_CA_PATH
            ? fs.readFileSync(publicEnv.DATABASE_SSL_CA_PATH).toString()
            : undefined,
          rejectUnauthorized: true,
        } as "prefer" | ConnectionOptions),
  };
};

export const PROVIDER_DB_CONNECTION = "PROVIDER_DB_CONNECTION";
