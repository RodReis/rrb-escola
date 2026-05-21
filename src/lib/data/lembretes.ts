import { createServerClient } from "@/lib/supabase/server";
import { DEFAULT_SCHOOL_ID } from "@/lib/constants";
import { resolverLembretesPendentes } from "@/lib/lembretes/detectar";

export type ConfigLembretes = {
  autoAtivo: boolean;
};

export async function getConfigLembretes(
  escolaId: string = DEFAULT_SCHOOL_ID,
): Promise<ConfigLembretes> {
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("escolas")
    .select("lembrete_auto_ativo")
    .eq("id", escolaId)
    .maybeSingle();
  return {
    autoAtivo: !!data?.lembrete_auto_ativo,
  };
}

export async function contarLembretesPendentes(
  escolaId: string = DEFAULT_SCHOOL_ID,
): Promise<number> {
  const supabase = await createServerClient();
  const pendentes = await resolverLembretesPendentes(supabase, escolaId, true);
  return pendentes.length;
}
