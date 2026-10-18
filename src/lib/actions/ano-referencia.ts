"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/session";

export async function avancarAnoReferenciaAction(): Promise<void> {
  const session = await requirePermission("configuracoes.escola", "update");
  const supabase = await createServerClient();

  const { data } = await supabase
    .from("escolas")
    .select("ano_referencia_atual")
    .eq("id", session.profile.escola_id)
    .maybeSingle();

  const anoAtual = (data?.ano_referencia_atual as number | undefined) ?? new Date().getFullYear();

  await supabase
    .from("escolas")
    .update({ ano_referencia_atual: anoAtual + 1 })
    .eq("id", session.profile.escola_id);

  revalidatePath("/configuracoes/ano-referencia");
  redirect("/configuracoes/ano-referencia?salvo=1");
}
