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
