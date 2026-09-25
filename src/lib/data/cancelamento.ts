import { createServerClient } from "@/lib/supabase/server";

export type CobrancaParaCancelamento = {
  id: string;
  descricao: string;
  competencia: string;
  valorFinal: number;
  dataVencimento: string;
  origem: "manual" | "isaac";
  preSelecionada: boolean;
  temPixAtivo: boolean;
};

/**
 * Cobranças em aberto/parciais do aluno, para o passo de selecionar quais
 * cancelar junto com a matrícula. Pré-marca as que vencem DEPOIS da data de
 * cancelamento (spec: "pré-marcadas as que vencem depois da data").
 *
 * `temPixAtivo` vem de uma segunda consulta em `pix_cobranca` (mesmos ids de
 * cobrança, `origem_tipo = 'cobranca'`, `status = 'ativa'`) resolvida em
 * memória — evita N+1 (uma query por cobrança).
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

  const cobrancaIds = (data ?? []).map((row) => row.id as string);
  const idsComPixAtivo = new Set<string>();
  if (cobrancaIds.length > 0) {
    const { data: pixAtivos, error: erroPix } = await supabase
      .from("pix_cobranca")
      .select("origem_id")
      .eq("origem_tipo", "cobranca")
      .eq("status", "ativa")
      .in("origem_id", cobrancaIds);

    if (erroPix) throw new Error("Não foi possível carregar o status de PIX das cobranças.");
    for (const row of pixAtivos ?? []) idsComPixAtivo.add(row.origem_id as string);
  }

  return (data ?? []).map((row) => ({
    id: row.id as string,
    descricao: row.descricao as string,
    competencia: row.competencia as string,
    valorFinal: row.valor_final as number,
    dataVencimento: row.data_vencimento as string,
    origem: row.origem as "manual" | "isaac",
    preSelecionada: (row.data_vencimento as string) > dataCancelamento,
    temPixAtivo: idsComPixAtivo.has(row.id as string),
  }));
}
