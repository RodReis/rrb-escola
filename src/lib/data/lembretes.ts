import { createServerClient } from "@/lib/supabase/server";
import { DEFAULT_SCHOOL_ID } from "@/lib/constants";
import { resolverLembretesPendentes } from "@/lib/lembretes/detectar";

export type ConfigLembretes = {
  autoAtivo: boolean;
  template: string;
};

const TEMPLATE_FALLBACK =
  "Olá {responsavel}, a mensalidade de {aluno} ({descricao}) no valor de {valor}, vencida em {vencimento}, está em aberto há {dias_atraso} dia(s). Por favor, regularize.";

export async function getConfigLembretes(
  escolaId: string = DEFAULT_SCHOOL_ID,
): Promise<ConfigLembretes> {
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("escolas")
    .select("lembrete_auto_ativo, lembrete_template")
    .eq("id", escolaId)
    .maybeSingle();
  return {
    autoAtivo: !!data?.lembrete_auto_ativo,
    template: data?.lembrete_template || TEMPLATE_FALLBACK,
  };
}

export async function contarLembretesPendentes(
  escolaId: string = DEFAULT_SCHOOL_ID,
): Promise<number> {
  const supabase = await createServerClient();
  const pendentes = await resolverLembretesPendentes(supabase, escolaId, true);
  return pendentes.length;
}
