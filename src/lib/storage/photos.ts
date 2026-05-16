import "server-only";
import { createServerClient } from "@/lib/supabase/server";

const SIGNED_TTL_SECONDS = 60 * 60;

export async function getSignedFotoUrl(path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  const supabase = await createServerClient();
  const { data, error } = await supabase.storage
    .from("alunos-fotos")
    .createSignedUrl(path, SIGNED_TTL_SECONDS);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

export async function getSignedFotoUrls(
  paths: (string | null | undefined)[],
): Promise<Map<string, string>> {
  const validPaths = paths.filter((p): p is string => !!p);
  if (validPaths.length === 0) return new Map();
  const supabase = await createServerClient();
  const { data, error } = await supabase.storage
    .from("alunos-fotos")
    .createSignedUrls(validPaths, SIGNED_TTL_SECONDS);
  if (error || !data) return new Map();
  const map = new Map<string, string>();
  for (const item of data) {
    if (item.signedUrl && item.path) map.set(item.path, item.signedUrl);
  }
  return map;
}
