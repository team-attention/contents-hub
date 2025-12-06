// TODO: Add lint rule to prevent using process.env directly
// TODO: Consider using dotenv-flow for better env file management
import { config } from "dotenv";
import { z } from "zod";

if (process.env.APP_ENV === "test") {
  config({ path: [".env.test", "../../.env.test"], override: true });
} else if (process.env.APP_ENV === "development") {
  config({ path: [".env", "../../.env"], override: true });
}

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
