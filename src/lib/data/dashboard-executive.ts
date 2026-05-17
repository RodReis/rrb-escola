import { createServerClient } from "@/lib/supabase/server";
import { DEFAULT_SCHOOL_ID } from "@/lib/constants";

export type GestaoFinanceira = "propria" | "terceirizada";

export type EscolaConfig = {
  gestaoFinanceira: GestaoFinanceira;
};

export async function getEscolaConfig(escolaId: string = DEFAULT_SCHOOL_ID): Promise<EscolaConfig> {
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("escolas")
    .select("gestao_financeira")
    .eq("id", escolaId)
    .maybeSingle();

  const value = (data?.gestao_financeira as GestaoFinanceira | undefined) ?? "propria";
  return { gestaoFinanceira: value };
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function competenciaFromDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

function monthRange(competencia: string): { first: string; last: string } {
  const [y, m] = competencia.split("-").map(Number);
  const first = `${y}-${pad(m)}-01`;
  const last = `${y}-${pad(m)}-${pad(new Date(y, m, 0).getDate())}`;
  return { first, last };
}

function competenciaToReferenceMonth(competencia: string): string {
  const [y, m] = competencia.split("-").map(Number);
  return `${y}-${pad(m)}-01`;
}

function prevCompetencia(competencia: string): string {
  const [y, m] = competencia.split("-").map(Number);
  const d = new Date(y, m - 2, 1);
  return competenciaFromDate(d);
}

export function currentCompetencia(): string {
  return competenciaFromDate(new Date());
}

export type HeroData = {
  competencia: string;
  receita: number;
  receitaPrev: number;
  despesa: number;
  despesaPrev: number;
  folha: number;
  folhaPrev: number;
  margem: number;
  margemPrev: number;
};

type Supa = Awaited<ReturnType<typeof createServerClient>>;

async function somaPagamentos(
  supabase: Supa,
  escolaId: string,
  competencia: string
): Promise<number> {
  const { first, last } = monthRange(competencia);
  const { data } = await supabase
    .from("pagamentos")
    .select("valor_pago")
    .eq("escola_id", escolaId)
    .gte("data_pagamento", first)
    .lte("data_pagamento", last)
    .is("cancelado_em", null);
  return (data ?? []).reduce((s, r) => s + Number(r.valor_pago ?? 0), 0);
}

async function somaDespesas(
  supabase: Supa,
  escolaId: string,
  competencia: string
): Promise<number> {
  const { data } = await supabase
    .from("despesas")
    .select("valor")
    .eq("escola_id", escolaId)
    .eq("competencia", competencia);
  return (data ?? []).reduce((s, r) => s + Number(r.valor ?? 0), 0);
}

// Nota: tabela payroll nao tem escola_id; reference_month e DATE (YYYY-MM-01).
// Soma total_earnings (proventos brutos) do mes inteiro.
async function somaFolha(
  supabase: Supa,
  _escolaId: string,
  competencia: string
): Promise<number> {
  const referenceMonth = competenciaToReferenceMonth(competencia);
  const { data } = await supabase
    .from("payroll")
    .select("total_earnings")
    .eq("reference_month", referenceMonth);
  return (data ?? []).reduce((s, r) => s + Number(r.total_earnings ?? 0), 0);
}

export async function getHero(
  competencia: string,
  escolaId: string = DEFAULT_SCHOOL_ID
): Promise<HeroData> {
  const supabase = await createServerClient();
  const prev = prevCompetencia(competencia);

  const [receita, receitaPrev, despesa, despesaPrev, folha, folhaPrev] = await Promise.all([
    somaPagamentos(supabase, escolaId, competencia),
    somaPagamentos(supabase, escolaId, prev),
    somaDespesas(supabase, escolaId, competencia),
    somaDespesas(supabase, escolaId, prev),
    somaFolha(supabase, escolaId, competencia),
    somaFolha(supabase, escolaId, prev),
  ]);

  return {
    competencia,
    receita,
    receitaPrev,
    despesa,
    despesaPrev,
    folha,
    folhaPrev,
    margem: receita - despesa - folha,
    margemPrev: receitaPrev - despesaPrev - folhaPrev,
  };
}

export type RevenueTrendPoint = {
  competencia: string;
  receita: number;
  custos: number;
};

function rollingCompetencias(months: number): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push(competenciaFromDate(d));
  }
  return out;
}

export async function getRevenueTrend(
  months: number = 6,
  escolaId: string = DEFAULT_SCHOOL_ID
): Promise<RevenueTrendPoint[]> {
  const supabase = await createServerClient();
  const competencias = rollingCompetencias(months);

  const pontos = await Promise.all(
    competencias.map(async (competencia) => {
      const [receita, despesa, folha] = await Promise.all([
        somaPagamentos(supabase, escolaId, competencia),
        somaDespesas(supabase, escolaId, competencia),
        somaFolha(supabase, escolaId, competencia),
      ]);
      return {
        competencia,
        receita,
        custos: despesa + folha,
      };
    })
  );

  return pontos;
}

export type OcupacaoData = {
  total: number;
  ocupadas: number;
  porEtapa: Array<{ etapa: string; capacidade: number; matriculados: number }>;
};

export async function getOcupacao(escolaId: string = DEFAULT_SCHOOL_ID): Promise<OcupacaoData> {
  const supabase = await createServerClient();

  const { data: turmas } = await supabase
    .from("turmas")
    .select("id, capacidade, serie_id, series(segmento)")
    .eq("escola_id", escolaId);

  const { data: matriculas } = await supabase
    .from("matriculas")
    .select("turma_id")
    .eq("escola_id", escolaId)
    .eq("status", "ativa");

  const matriculasPorTurma = new Map<string, number>();
  for (const m of matriculas ?? []) {
    matriculasPorTurma.set(m.turma_id, (matriculasPorTurma.get(m.turma_id) ?? 0) + 1);
  }

  const porEtapaMap = new Map<string, { capacidade: number; matriculados: number }>();
  let total = 0;
  let ocupadas = 0;

  for (const t of (turmas ?? []) as Array<{
    id: string;
    capacidade: number | null;
    serie_id: string;
    series: { segmento: string | null } | { segmento: string | null }[] | null;
  }>) {
    const seriesRel = Array.isArray(t.series) ? t.series[0] : t.series;
    const etapa = seriesRel?.segmento ?? "outros";
    const cap = Number(t.capacidade ?? 0);
    const ocup = matriculasPorTurma.get(t.id) ?? 0;
    total += cap;
    ocupadas += ocup;
    const acc = porEtapaMap.get(etapa) ?? { capacidade: 0, matriculados: 0 };
    acc.capacidade += cap;
    acc.matriculados += ocup;
    porEtapaMap.set(etapa, acc);
  }

  return {
    total,
    ocupadas,
    porEtapa: Array.from(porEtapaMap.entries()).map(([etapa, v]) => ({ etapa, ...v })),
  };
}

export type StageBreakdownRow = {
  etapa: string;
  alunos: number;
  receita: number;
  ticket: number;
  ocupacao: number;
};

export async function getStageBreakdown(
  competencia: string,
  escolaId: string = DEFAULT_SCHOOL_ID
): Promise<StageBreakdownRow[]> {
  const supabase = await createServerClient();

  const { data: cobrancas } = await supabase
    .from("cobrancas")
    .select("valor_final, matriculas(serie_id, series(segmento))")
    .eq("escola_id", escolaId)
    .eq("competencia", competencia)
    .neq("status", "cancelada");

  const receitaPorEtapa = new Map<string, number>();
  for (const c of ((cobrancas ?? []) as unknown) as Array<{
    valor_final: number | null;
    matriculas:
      | { serie_id: string; series: { segmento: string | null } | { segmento: string | null }[] | null }
      | { serie_id: string; series: { segmento: string | null } | { segmento: string | null }[] | null }[]
      | null;
  }>) {
    const matRel = Array.isArray(c.matriculas) ? c.matriculas[0] : c.matriculas;
    const seriesRel = matRel?.series
      ? Array.isArray(matRel.series)
        ? matRel.series[0]
        : matRel.series
      : null;
    const etapa = seriesRel?.segmento ?? "outros";
    receitaPorEtapa.set(etapa, (receitaPorEtapa.get(etapa) ?? 0) + Number(c.valor_final ?? 0));
  }

  const ocup = await getOcupacao(escolaId);

  return ocup.porEtapa.map((p) => ({
    etapa: p.etapa,
    alunos: p.matriculados,
    receita: receitaPorEtapa.get(p.etapa) ?? 0,
    ticket: p.matriculados > 0 ? (receitaPorEtapa.get(p.etapa) ?? 0) / p.matriculados : 0,
    ocupacao: p.capacidade > 0 ? p.matriculados / p.capacidade : 0,
  }));
}

export type TicketMedioData = {
  atual: number;
  serie: number[];
};

export async function getTicketMedio(
  months: number = 6,
  escolaId: string = DEFAULT_SCHOOL_ID
): Promise<TicketMedioData> {
  const supabase = await createServerClient();
  const competencias = rollingCompetencias(months);

  const serie = await Promise.all(
    competencias.map(async (competencia) => {
      const [{ count }, { data: cobrancas }] = await Promise.all([
        supabase
          .from("matriculas")
          .select("id", { count: "exact", head: true })
          .eq("escola_id", escolaId)
          .eq("status", "ativa"),
        supabase
          .from("cobrancas")
          .select("valor_final")
          .eq("escola_id", escolaId)
          .eq("competencia", competencia)
          .neq("status", "cancelada"),
      ]);
      const total = (cobrancas ?? []).reduce((s, r) => s + Number(r.valor_final ?? 0), 0);
      return count && count > 0 ? total / count : 0;
    })
  );

  return {
    atual: serie[serie.length - 1] ?? 0,
    serie,
  };
}
