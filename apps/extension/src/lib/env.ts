export const env = {
  SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL as string,
  SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY as string,
  API_SERVER_URL: import.meta.env.VITE_API_SERVER_URL as string,
} as const;

export function validateEnv(): void {
  const required = ["SUPABASE_URL", "SUPABASE_ANON_KEY", "API_SERVER_URL"] as const;
  const missing = required.filter((key) => !env[key]);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }
}
