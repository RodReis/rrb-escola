import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { classificarDebitos } from "@/lib/conciliacao/pipeline-debitos";
import { carregarPendentes } from "@/lib/conciliacao/carregar-pendentes";
import type { MovimentoConta } from "@/lib/conciliacao/transferencia-interna";
import type { Regra } from "@/lib/conciliacao/classificar-regra";

/**
 * Roda o pipeline sobre os débitos pendentes e grava o que é automático.
 *
 * Grava SOMENTE transferência interna (D1: regra sugere, não lança). Sugestão e
 * fila ficam para a tela — nada de despesa criada sem alguém confirmar.
 *
 * Roda depois do upsert do extrato, sobre o que está no banco e não sobre a
 * resposta da API: o crédito da outra conta pode ter entrado numa execução
 * anterior.
 */
export async function aplicarPipelineDebitos(escolaId: string) {
  const supabase = createAdminClient();

  const { data: contas } = await supabase
    .from("contas_bancarias")
    .select("id, company_id, companies(cnpj)")
    .eq("escola_id", escolaId);

  const contasProprias = new Set((contas ?? []).map((c) => c.id as string));
  const documentosProprios = new Set(
    (contas ?? [])
      .map((c) => {
        const co = Array.isArray(c.companies) ? c.companies[0] : c.companies;
        return (co?.cnpj as string | undefined)?.replace(/\D/g, "");
      })
      .filter((d): d is string => Boolean(d)),
  );

  const linhas = await carregarPendentes(supabase, escolaId, ["pendente"]);

  // pareamento_recusado: usuário já desfez este débito como transferência
  // interna antes — não tenta parear de novo (I1). A marca é só sobre o
  // lado DÉBITO da decisão; este módulo grava só transferência_interna,
  // nunca sugestão/despesa — quem precisa reclassificar o recusado noutro
  // balde (sugestão, fila, conta própria) é a tela (src/lib/data/debitos.ts),
  // não o sync.
  const debitos: MovimentoConta[] = linhas
    .filter((l) => l.tipo === "debito" && !l.pareamento_recusado)
    .map((l) => ({ id: l.id as string, contaId: l.conta_id as string, data: l.data as string, valor: Number(l.valor), tipo: "debito" }));
  const creditos: MovimentoConta[] = linhas
    .filter((l) => l.tipo === "credito")
    .map((l) => ({ id: l.id as string, contaId: l.conta_id as string, data: l.data as string, valor: Number(l.valor), tipo: "credito" }));

  if (debitos.length === 0) return { transferencias: 0, sugestoes: 0, aClassificar: 0, ambiguos: 0 };

  const documentos: Record<string, string | null> = {};
  const descricoes: Record<string, string> = {};
  for (const l of linhas) {
    documentos[l.id as string] = (l.contraparte_doc as string | null) ?? null;
    descricoes[l.id as string] = String(l.descricao ?? "");
  }

  const { data: regrasRaw } = await supabase
    .from("contraparte_regra")
    .select("id, tipo_match, documento, padrao_texto, valor_esperado, dia_inicio, dia_fim, conta_id, categoria_id, company_id, classe_despesa")
    .eq("escola_id", escolaId)
    .eq("ativo", true);

  const regras: Regra[] = (regrasRaw ?? []).map((r) => ({
    id: r.id as string,
    tipoMatch: r.tipo_match as "documento" | "texto",
    documento: (r.documento as string | null) ?? null,
    padraoTexto: (r.padrao_texto as string | null) ?? null,
    valorEsperado: r.valor_esperado === null ? null : Number(r.valor_esperado),
    diaInicio: (r.dia_inicio as number | null) ?? null,
    diaFim: (r.dia_fim as number | null) ?? null,
    contaId: (r.conta_id as string | null) ?? null,
    categoriaId: r.categoria_id as string,
    companyId: (r.company_id as string | null) ?? null,
    classeDespesa: (r.classe_despesa as "fixa" | "variavel" | null) ?? null,
  }));

  const resultado = classificarDebitos({
    debitos, creditos, documentos, descricoes, regras, contasProprias, documentosProprios,
  });

  // Só a transferência interna é gravada sozinha.
  for (const par of resultado.transferenciasInternas) {
    const { error } = await supabase.from("transferencia_interna").upsert(
      {
        escola_id: escolaId,
        debito_extrato_id: par.debitoId,
        credito_extrato_id: par.creditoId,
        conta_destino_id: par.contaDestinoId,
        origem: "auto",
      },
      { onConflict: "debito_extrato_id" },
    );
    if (error) throw error;

    await supabase
      .from("extrato_bancario")
      .update({ status_conciliacao: "auto" })
      .in("id", [par.debitoId, par.creditoId]);
  }

  return {
    transferencias: resultado.transferenciasInternas.length,
    sugestoes: resultado.sugestoes.length,
    aClassificar: resultado.aClassificar.length,
    ambiguos: resultado.ambiguos.length,
  };
}
