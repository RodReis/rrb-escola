import { createServerClient } from "@/lib/supabase/server";

export type CobrancaParaCancelamento = {
  id: string;
  descricao: string;
  competencia: string;
  valorFinal: number;
  dataVencimento: string;
  origem: "manual" | "isaac";
  preSelecionada: boolean;
};

/**
 * Cobranças em aberto/parciais do aluno, para o passo de selecionar quais
 * cancelar junto com a matrícula. Pré-marca as que vencem DEPOIS da data de
 * cancelamento (spec: "pré-marcadas as que vencem depois da data").
 */
export async function listarCobrancasAbertasParaCancelamento(
  alunoId: string,
  dataCancelamento: string
): Promise<CobrancaParaCancelamento[]> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("cobrancas")
    .select("id, descricao, competencia, valor_final, data_vencimento, origem")
    .eq("aluno_id", alunoId)
    .in("status", ["aberta", "parcial"])
    .order("data_vencimento");

  if (error) throw new Error("Não foi possível carregar as cobranças do aluno.");

  return (data ?? []).map((row) => ({
    id: row.id as string,
    descricao: row.descricao as string,
    competencia: row.competencia as string,
    valorFinal: row.valor_final as number,
    dataVencimento: row.data_vencimento as string,
    origem: row.origem as "manual" | "isaac",
    preSelecionada: (row.data_vencimento as string) > dataCancelamento,
  }));
}
