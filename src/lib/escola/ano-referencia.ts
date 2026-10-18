import type { createServerClient } from "@/lib/supabase/server";

type Cliente = Awaited<ReturnType<typeof createServerClient>>;

/**
 * Ano letivo ativo da escola. Cai para o ano do relógio quando a linha não
 * existe ou a consulta falha — nunca propaga null/undefined para quem usa
 * esse valor como base da regra de corte de matrícula.
 */
export async function getAnoReferenciaAtual(supabase: Cliente, escolaId: string): Promise<number> {
  try {
    const { data, error } = await supabase
      .from("escolas")
      .select("ano_referencia_atual")
      .eq("id", escolaId)
      .maybeSingle();

    if (error || !data) return new Date().getFullYear();
    return data.ano_referencia_atual as number;
  } catch {
    return new Date().getFullYear();
  }
}
