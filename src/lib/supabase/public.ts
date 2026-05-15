import { createClient } from "@supabase/supabase-js";
import { requiredEnv } from "@/lib/env";

export function createPublicClient() {
  return createClient(
    requiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        storage: undefined
      }
    }
  );
}
