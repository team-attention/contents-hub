import { defineConfig } from "drizzle-kit";
import { getDBCredentials } from "./src/db/config";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: getDBCredentials(process.env.DATABASE_DIRECT_URL!),
});
