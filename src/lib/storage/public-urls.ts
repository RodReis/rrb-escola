// Buckets publicos: retorna URL direta sem assinar
import { createServerClient } from "@/lib/supabase/server";

export async function getPublicUrl(bucket: string, path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  // Se ja for URL completa (http/https), retorna direto
  if (/^https?:\/\//i.test(path)) return path;
  const supabase = await createServerClient();
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl ?? null;
}
