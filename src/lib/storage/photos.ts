import "server-only";
import { createServerClient } from "@/lib/supabase/server";

const SIGNED_TTL_SECONDS = 60 * 60;
const BUCKET_PUBLIC_PREFIX = "/storage/v1/object/public/alunos-fotos/";

/**
 * foto_url pode ser URL completa (http://host/storage/v1/object/public/alunos-fotos/UUID/nome.jpg)
 * ou path relativo (UUID/nome.jpg). Normaliza para path relativo.
 */
function toRelativePath(urlOrPath: string): string {
  const idx = urlOrPath.indexOf(BUCKET_PUBLIC_PREFIX);
  if (idx !== -1) return urlOrPath.slice(idx + BUCKET_PUBLIC_PREFIX.length);
  return urlOrPath;
}

export async function getSignedFotoUrl(path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  const supabase = await createServerClient();
  const { data, error } = await supabase.storage
    .from("alunos-fotos")
    .createSignedUrl(toRelativePath(path), SIGNED_TTL_SECONDS);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

export async function getSignedFotoUrls(
  paths: (string | null | undefined)[],
): Promise<Map<string, string>> {
  const validPaths = paths.filter((p): p is string => !!p);
  if (validPaths.length === 0) return new Map();
  const supabase = await createServerClient();
  const relativePaths = validPaths.map(toRelativePath);
  const { data, error } = await supabase.storage
    .from("alunos-fotos")
    .createSignedUrls(relativePaths, SIGNED_TTL_SECONDS);
  if (error || !data) return new Map();
  const map = new Map<string, string>();
  for (let i = 0; i < data.length; i++) {
    const item = data[i];
    if (item.signedUrl) {
      // Key por path relativo E pela URL original para compatibilidade com ambos os callers
      map.set(relativePaths[i], item.signedUrl);
      map.set(validPaths[i], item.signedUrl);
    }
  }
  return map;
}
