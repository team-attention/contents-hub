import { createClient } from "@supabase/supabase-js";
import { ChromeStorageAdapter } from "./chrome-storage-adapter";
import { env } from "./env";

const storage = new ChromeStorageAdapter();

export const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
  auth: {
    storage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
