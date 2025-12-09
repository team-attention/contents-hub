import { resolve } from "node:path";
// TODO: Add lint rule to prevent using process.env directly
import { config } from "dotenv-flow";
import { z } from "zod";

// dotenv-flow automatically loads in order:
// .env -> .env.local -> .env.{APP_ENV} -> .env.{APP_ENV}.local
// Note: .env.local is skipped in test environment for reproducibility
config({
  node_env: process.env.APP_ENV,
  default_node_env: "development",
  path: resolve(__dirname, "../../.."),
});

export const env = z
  .object({
    // App Configuration
    APP_ENV: z.enum(["development", "production", "test"]).default("development"),
    PORT: z.coerce.number().default(3000),

    // Database (Supabase PostgreSQL)
    DATABASE_URL: z.string().url(),

    // Supabase
    SUPABASE_URL: z.string().url(),
    SUPABASE_ANON_KEY: z.string(),
    SUPABASE_JWT_SECRET: z.string(),

    // Auth (optional - for dev/test mock)
    MOCK_USER_ID: z.string().optional(),

    // Anthropic (Claude)
    ANTHROPIC_API_KEY: z.string(),
  })
  .parse(process.env);

export const appEnv = {
  isDevelopment: env.APP_ENV === "development",
  isProduction: env.APP_ENV === "production",
  isTest: env.APP_ENV === "test",
};
