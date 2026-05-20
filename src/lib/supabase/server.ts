import { createServerClient as createSSRClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { requiredEnv } from "@/lib/env";

export async function createServerClient() {
  const cookieStore = cookies();
  return createSSRClient(
    requiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // chamado de Server Component — setAll vira no-op (cookies só mutáveis em actions/handlers)
          }
        }
      }
    }
  );
}
