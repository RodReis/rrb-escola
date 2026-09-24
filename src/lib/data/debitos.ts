import { DEFAULT_SCHOOL_ID } from "@/lib/constants";
import { createServerClient } from "@/lib/supabase/server";
import { classificarDebitos } from "@/lib/conciliacao/pipeline-debitos";
import { carregarPendentes } from "@/lib/conciliacao/carregar-pendentes";
import type { MovimentoConta } from "@/lib/conciliacao/transferencia-interna";
import type { Regra } from "@/lib/conciliacao/classificar-regra";

/**
 * Monta os três baldes da tela (a classificar / sugestões / transferências)
 * rodando o mesmo pipeline puro do sync sobre o que está pendente hoje —
 * assim a tela sempre reflete o extrato atual, mesmo antes do próximo sync.
 */

export type MovimentoExtrato = {
  id: string;
  contaId: string;
  data: string;
  valor: number;
  descricao: string;
  documento: string | null;
};

export type GrupoAClassificar = {
  /** Documento da contraparte, ou a descrição quando o extrato não traz documento. */
  chave: string;
  documento: string | null;
  descricao: string;
  total: number;
  movimentos: MovimentoExtrato[];
};

export type SugestaoDebito = MovimentoExtrato & {
  regraId: string;
  categoriaId: string;
  categoriaNome: string;
  companyId: string | null;
  classeDespesa: "fixa" | "variavel" | null;
};

export type ParInternoResolvido = {
  id: string;
  debito: MovimentoExtrato;
  credito: MovimentoExtrato | null;
};

export type ParAmbiguoResolvido = {
  debito: MovimentoExtrato;
  candidatos: MovimentoExtrato[];
};

export type ContaPropriaSemParResolvido = MovimentoExtrato;

export type DebitosData = {
  aClassificar: GrupoAClassificar[];
  sugestoes: SugestaoDebito[];
  transferenciasAuto: ParInternoResolvido[];
  transferenciasAmbiguas: ParAmbiguoResolvido[];
  /** Débitos para CNPJ próprio sem par de crédito casado (D2, ex.: Caixa). */
  contaPropriaSemPar: ContaPropriaSemParResolvido[];
  categorias: { id: string; nome: string }[];
  companies: { id: string; nome: string }[];
  contas: { id: string; companyId: string | null }[];
};

export async function getDebitosData(): Promise<DebitosData> {
  const supabase = await createServerClient();

  const [contasRes, linhasSemOrdem, categoriasRes, companiesRes, transferenciasRes] = await Promise.all([
    supabase.from("contas_bancarias").select("id, company_id, companies(cnpj, name)").eq("escola_id", DEFAULT_SCHOOL_ID),
    // Pagina de verdade (C1) — um .select() simples corta em 1000 linhas
    // (PostgREST max_rows) e derruba candidato de par fora do corte,
    // arriscando gravar sozinho uma transferência que era pra ser ambígua.
    carregarPendentes(supabase, DEFAULT_SCHOOL_ID, ["pendente", "auto"]),
    supabase.from("categorias_financeiras").select("id, nome").eq("escola_id", DEFAULT_SCHOOL_ID).eq("tipo", "despesa").eq("ativo", true).order("nome"),
    supabase.from("companies").select("id, name").eq("ativo", true).order("name"),
    supabase.from("transferencia_interna").select("id, debito_extrato_id, credito_extrato_id").eq("escola_id", DEFAULT_SCHOOL_ID),
  ]);

  if (contasRes.error) throw contasRes.error;
  if (categoriasRes.error) throw categoriasRes.error;
  if (companiesRes.error) throw companiesRes.error;
  if (transferenciasRes.error) throw transferenciasRes.error;

  // Preserva o comportamento pré-paginação (query ordenava por valor desc).
  const pendentes = [...linhasSemOrdem].sort((a, b) => Number(b.valor) - Number(a.valor));

  const contas = contasRes.data ?? [];
  const contasProprias = new Set(contas.map((c) => c.id as string));
  const documentosProprios = new Set(
    contas
      .map((c) => {
        const co = Array.isArray(c.companies) ? c.companies[0] : c.companies;
        return (co?.cnpj as string | undefined)?.replace(/\D/g, "");
      })
      .filter((d): d is string => Boolean(d)),
  );

  const { data: regrasRaw, error: regrasError } = await supabase
    .from("contraparte_regra")
    .select("id, tipo_match, documento, padrao_texto, valor_esperado, dia_inicio, dia_fim, conta_id, categoria_id, company_id, classe_despesa")
    .eq("escola_id", DEFAULT_SCHOOL_ID)
    .eq("ativo", true);
  if (regrasError) throw regrasError;

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

  const linhas = pendentes;
  const porId = new Map(linhas.map((l) => [l.id as string, l]));

  // Um par de transferência pode referenciar um extrato que já saiu de
  // pendente/auto por outro caminho (ex.: ignorado por engano antes desta
  // tela existir) — `undefined` aqui não pode virar 500 na página inteira,
  // então cada chamador filtra o `null` antes de usar.
  const toMovimento = (id: string): MovimentoExtrato | null => {
    const l = porId.get(id);
    if (!l) return null;
    return {
      id,
      contaId: l.conta_id as string,
      data: l.data as string,
      valor: Number(l.valor),
      descricao: String(l.descricao ?? ""),
      documento: (l.contraparte_doc as string | null) ?? null,
    };
  };

  // O pipeline só olha "pendente" (é o que ainda não tem decisão); "auto" já
  // resolvido entra só para renderizar os pares de transferência automáticos.
  // pareamento_recusado: usuário já desfez este par antes — não reclassifica
  // como transferência de novo (I1); segue disponível como crédito de outro par.
  const pendentesSemDecisao = linhas.filter((l) => l.status_conciliacao === "pendente" && !l.pareamento_recusado);
  const debitos: MovimentoConta[] = pendentesSemDecisao
    .filter((l) => l.tipo === "debito")
    .map((l) => ({ id: l.id as string, contaId: l.conta_id as string, data: l.data as string, valor: Number(l.valor), tipo: "debito" }));
  const creditos: MovimentoConta[] = pendentesSemDecisao
    .filter((l) => l.tipo === "credito")
    .map((l) => ({ id: l.id as string, contaId: l.conta_id as string, data: l.data as string, valor: Number(l.valor), tipo: "credito" }));

  const documentos: Record<string, string | null> = {};
  const descricoes: Record<string, string> = {};
  for (const l of pendentesSemDecisao) {
    documentos[l.id as string] = (l.contraparte_doc as string | null) ?? null;
    descricoes[l.id as string] = String(l.descricao ?? "");
  }

  const resultado = classificarDebitos({
    debitos,
    creditos,
    documentos,
    descricoes,
    regras,
    contasProprias,
    documentosProprios,
  });

  // A classificar, agrupado por contraparte_doc (ou descrição quando não há documento).
  const grupos = new Map<string, GrupoAClassificar>();
  for (const debitoId of resultado.aClassificar) {
    const mov = toMovimento(debitoId);
    if (!mov) continue;
    const chave = mov.documento ?? `desc:${mov.descricao}`;
    const grupo = grupos.get(chave);
    if (grupo) {
      grupo.total += mov.valor;
      grupo.movimentos.push(mov);
    } else {
      grupos.set(chave, {
        chave,
        documento: mov.documento,
        descricao: mov.descricao,
        total: mov.valor,
        movimentos: [mov],
      });
    }
  }
  // Grupos ordenados por total decrescente (maiores em valor no topo), mas
  // dentro de cada grupo os movimentos vêm ordenados por DATA, não por valor
  // (a query-fonte ordena por valor desc; sem isto "primeiro"/"último" do
  // card mostraria o intervalo errado — C4).
  for (const grupo of Array.from(grupos.values())) {
    grupo.movimentos.sort((a, b) => a.data.localeCompare(b.data));
  }
  const aClassificar = Array.from(grupos.values()).sort((a, b) => b.total - a.total);

  const categoriaNomePor = new Map((categoriasRes.data ?? []).map((c) => [c.id as string, c.nome as string]));
  const sugestoes: SugestaoDebito[] = resultado.sugestoes.flatMap((s) => {
    const mov = toMovimento(s.debitoId);
    if (!mov) return [];
    return [{
      ...mov,
      regraId: s.regraId,
      categoriaId: s.categoriaId,
      categoriaNome: categoriaNomePor.get(s.categoriaId) ?? "—",
      companyId: s.companyId,
      classeDespesa: s.classeDespesa,
    }];
  });

  // Transferências: os pares já gravados (origem auto, do último sync) e os
  // ambíguos calculados agora sobre o que ainda está pendente. `debito` que
  // não resolve mais (extrato saiu de pendente/auto por outro caminho) faz o
  // par inteiro ser pulado — não derruba a página inteira (I2).
  const transferenciasAuto: ParInternoResolvido[] = (transferenciasRes.data ?? []).flatMap((t) => {
    const debito = toMovimento(t.debito_extrato_id as string);
    if (!debito) return [];
    const credito = t.credito_extrato_id ? toMovimento(t.credito_extrato_id as string) : null;
    return [{ id: t.id as string, debito, credito }];
  });

  const transferenciasAmbiguas: ParAmbiguoResolvido[] = resultado.ambiguos.flatMap((a) => {
    const debito = toMovimento(a.debitoId);
    if (!debito) return [];
    const candidatos = a.candidatos.flatMap((id) => {
      const c = toMovimento(id);
      return c ? [c] : [];
    });
    return [{ debito, candidatos }];
  });

  // D2: débito para CNPJ próprio sem par de crédito casado (ex.: Caixa) —
  // não é sugestão nem transferência, só precisa ficar visível (I3).
  const contaPropriaSemPar: ContaPropriaSemParResolvido[] = resultado.contaPropriaSemPar.flatMap((c) => {
    const mov = toMovimento(c.debitoId);
    return mov ? [mov] : [];
  });

  return {
    aClassificar,
    sugestoes,
    transferenciasAuto,
    transferenciasAmbiguas,
    contaPropriaSemPar,
    categorias: (categoriasRes.data ?? []).map((c) => ({ id: c.id as string, nome: c.nome as string })),
    companies: (companiesRes.data ?? []).map((c) => ({ id: c.id as string, nome: c.name as string })),
    contas: contas.map((c) => ({ id: c.id as string, companyId: (c.company_id as string | null) ?? null })),
  };
}
