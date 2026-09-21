import "server-only";

import { createServerClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/session";
import { mapAtividades, type AtividadeRecente, type RawAtividade } from "./pipeline-atividade-helpers";

export type { AtividadeRecente } from "./pipeline-atividade-helpers";

export async function getAtividadeRecentePipeline(
  escolaId: string,
  limit = 5,
): Promise<AtividadeRecente[]> {
  // Atividade não é dado sensível (nota/ligação), mas exige acesso ao pipeline.
  try {
    await requirePermission("pipeline", "read");
  } catch {
    return [];
  }

  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from("pipeline_card_atividade")
    .select(`
      id, tipo, descricao, created_at,
      usuario:usuario_id(nome),
      card:card_id(titulo)
    `)
    .eq("escola_id", escolaId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;

  return mapAtividades((data ?? []) as unknown as RawAtividade[], limit);
}
