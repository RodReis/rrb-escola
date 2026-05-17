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
      const { data: cobrancas } = await supabase
        .from("cobrancas")
        .select("valor_final")
        .eq("escola_id", escolaId)
        .eq("competencia", competencia)
        .neq("status", "cancelada");
      const total = (cobrancas ?? []).reduce((s, r) => s + Number(r.valor_final ?? 0), 0);
      const count = cobrancas?.length ?? 0;
      return count > 0 ? total / count : 0;
    })
  );

  return {
    atual: serie[serie.length - 1] ?? 0,
    serie,
  };
}

export type FolhaRatioData = {
  ratio: number;
  receita: number;
  folha: number;
};

export async function getFolhaRatio(
  competencia: string,
  escolaId: string = DEFAULT_SCHOOL_ID
): Promise<FolhaRatioData> {
  const supabase = await createServerClient();
  const [receita, folha] = await Promise.all([
    somaPagamentos(supabase, escolaId, competencia),
    somaFolha(supabase, escolaId, competencia),
  ]);
  return {
    ratio: receita > 0 ? folha / receita : 0,
    receita,
    folha,
  };
}

export type FolhaEmpresaRow = {
  empresaId: string;
  empresa: string;
  headcount: number;
  bruto: number;
  inss: number;
  irrf: number;
  liquido: number;
};

// Nota: tabela payroll é por funcionario+mes, sem escola_id.
// Agregamos por company_id (employees.companies.name).
export async function getFolhaPorEmpresa(
  competencia: string,
  _escolaId: string = DEFAULT_SCHOOL_ID
): Promise<FolhaEmpresaRow[]> {
  const supabase = await createServerClient();
  const referenceMonth = competenciaToReferenceMonth(competencia);

  const { data } = await supabase
    .from("payroll")
    .select(
      "employee_id, total_earnings, inss, ir, net_amount, employees(company_id, companies(name))"
    )
    .eq("reference_month", referenceMonth);

  type Row = {
    employee_id: string;
    total_earnings: number | null;
    inss: number | null;
    ir: number | null;
    net_amount: number | null;
    employees:
      | { company_id: string | null; companies: { name: string } | { name: string }[] | null }
      | { company_id: string | null; companies: { name: string } | { name: string }[] | null }[]
      | null;
  };

  const porEmpresa = new Map<string, FolhaEmpresaRow>();
  for (const r of ((data ?? []) as unknown as Row[])) {
    const emp = Array.isArray(r.employees) ? r.employees[0] : r.employees;
    const empresaId = emp?.company_id ?? "sem-empresa";
    const compRel = emp?.companies
      ? Array.isArray(emp.companies)
        ? emp.companies[0]
        : emp.companies
      : null;
    const nome = compRel?.name ?? "—";
    const acc =
      porEmpresa.get(empresaId) ?? {
        empresaId,
        empresa: nome,
        headcount: 0,
        bruto: 0,
        inss: 0,
        irrf: 0,
        liquido: 0,
      };
    acc.headcount += 1;
    acc.bruto += Number(r.total_earnings ?? 0);
    acc.inss += Number(r.inss ?? 0);
    acc.irrf += Number(r.ir ?? 0);
    acc.liquido += Number(r.net_amount ?? 0);
    porEmpresa.set(empresaId, acc);
  }

  return Array.from(porEmpresa.values());
}

export type InadimplenciaData = {
  percentual: number;
  valor: number;
  count: number;
};

export async function getInadimplencia(
  competencia: string,
  escolaId: string = DEFAULT_SCHOOL_ID
): Promise<InadimplenciaData> {
  const supabase = await createServerClient();
  const [vencidas, total] = await Promise.all([
    supabase
      .from("cobrancas")
      .select("valor_final")
      .eq("escola_id", escolaId)
      .eq("competencia", competencia)
      .eq("status", "vencida"),
    supabase
      .from("cobrancas")
      .select("valor_final")
      .eq("escola_id", escolaId)
      .eq("competencia", competencia)
      .neq("status", "cancelada"),
  ]);

  const valor = (vencidas.data ?? []).reduce((s, r) => s + Number(r.valor_final ?? 0), 0);
  const totalValor = (total.data ?? []).reduce((s, r) => s + Number(r.valor_final ?? 0), 0);

  return {
    percentual: totalValor > 0 ? valor / totalValor : 0,
    valor,
    count: vencidas.data?.length ?? 0,
  };
}

export type DevedorRow = {
  alunoId: string;
  nome: string;
  valor: number;
  diasVencimento: number;
};

export async function getTopDevedores(
  limit: number = 5,
  escolaId: string = DEFAULT_SCHOOL_ID
): Promise<DevedorRow[]> {
  const supabase = await createServerClient();
  const hoje = new Date();
  const hojeStr = `${hoje.getFullYear()}-${pad(hoje.getMonth() + 1)}-${pad(hoje.getDate())}`;

  const { data } = await supabase
    .from("cobrancas")
    .select("valor_final, data_vencimento, matriculas(aluno_id, alunos(nome))")
    .eq("escola_id", escolaId)
    .in("status", ["vencida", "parcial"])
    .lte("data_vencimento", hojeStr);

  type Row = {
    valor_final: number | null;
    data_vencimento: string;
    matriculas:
      | { aluno_id: string; alunos: { nome: string } | { nome: string }[] | null }
      | { aluno_id: string; alunos: { nome: string } | { nome: string }[] | null }[]
      | null;
  };

  const porAluno = new Map<string, { nome: string; valor: number; vencimento: string }>();
  for (const c of ((data ?? []) as unknown as Row[])) {
    const matRel = Array.isArray(c.matriculas) ? c.matriculas[0] : c.matriculas;
    const alunoId = matRel?.aluno_id;
    if (!alunoId) continue;
    const alunoRel = matRel?.alunos
      ? Array.isArray(matRel.alunos)
        ? matRel.alunos[0]
        : matRel.alunos
      : null;
    const nome = alunoRel?.nome ?? "—";
    const acc = porAluno.get(alunoId) ?? { nome, valor: 0, vencimento: c.data_vencimento };
    acc.valor += Number(c.valor_final ?? 0);
    if (c.data_vencimento < acc.vencimento) acc.vencimento = c.data_vencimento;
    porAluno.set(alunoId, acc);
  }

  const rows: DevedorRow[] = Array.from(porAluno.entries()).map(([alunoId, v]) => {
    const [vy, vm, vd] = v.vencimento.split("-").map(Number) as [number, number, number];
    const vencUTC = Date.UTC(vy, vm - 1, vd);
    const hojeUTC = Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
    const dias = Math.floor((hojeUTC - vencUTC) / (1000 * 60 * 60 * 24));
    return { alunoId, nome: v.nome, valor: v.valor, diasVencimento: dias };
  });

  rows.sort((a, b) => b.valor - a.valor);
  return rows.slice(0, limit);
}

export type RepasseData = {
  valor: number;
  valorPrev: number;
};

export async function getRepasseRecebido(
  competencia: string,
  escolaId: string = DEFAULT_SCHOOL_ID
): Promise<RepasseData> {
  const supabase = await createServerClient();
  const prev = prevCompetencia(competencia);
  const [valor, valorPrev] = await Promise.all([
    somaPagamentos(supabase, escolaId, competencia),
    somaPagamentos(supabase, escolaId, prev),
  ]);
  return { valor, valorPrev };
}

export type RenovacaoRow = {
  matriculaId: string;
  alunoId: string;
  alunoNome: string;
  anoLetivo: number;
  diasRestantes: number;
};

export async function getRenovacoesPendentes(
  limit: number = 5,
  escolaId: string = DEFAULT_SCHOOL_ID
): Promise<RenovacaoRow[]> {
  const supabase = await createServerClient();
  const hoje = new Date();
  const anoLetivo = hoje.getFullYear();

  const { data } = await supabase
    .from("matriculas")
    .select("id, aluno_id, ano_letivo, alunos(nome)")
    .eq("escola_id", escolaId)
    .eq("status", "ativa")
    .eq("ano_letivo", anoLetivo)
    .limit(limit);

  const fimAno = new Date(anoLetivo, 11, 31);
  const diasRestantes = Math.floor((fimAno.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));

  type Row = {
    id: string;
    aluno_id: string;
    ano_letivo: number;
    alunos: { nome: string } | { nome: string }[] | null;
  };

  return ((data ?? []) as unknown as Row[]).map((m) => {
    const alunoRel = Array.isArray(m.alunos) ? m.alunos[0] : m.alunos;
    return {
      matriculaId: m.id,
      alunoId: m.aluno_id,
      alunoNome: alunoRel?.nome ?? "—",
      anoLetivo: m.ano_letivo,
      diasRestantes,
    };
  });
}

export type AlertaSeveridade = "critico" | "atencao" | "info";

export type AlertaItem = {
  id: string;
  severidade: AlertaSeveridade;
  titulo: string;
  descricao: string;
  href?: string;
};

export async function getAlertas(
  competencia: string,
  gestaoFinanceira: GestaoFinanceira,
  escolaId: string = DEFAULT_SCHOOL_ID
): Promise<AlertaItem[]> {
  const alertas: AlertaItem[] = [];

  const ocup = await getOcupacao(escolaId);
  for (const etapa of ocup.porEtapa) {
    if (etapa.capacidade > 0 && etapa.matriculados / etapa.capacidade < 0.5) {
      alertas.push({
        id: `vagas-${etapa.etapa}`,
        severidade: "atencao",
        titulo: `Vagas ociosas em ${etapa.etapa}`,
        descricao: `${etapa.matriculados}/${etapa.capacidade} matrículas`,
        href: "/matriculas",
      });
    }
  }

  if (gestaoFinanceira === "propria") {
    const inad = await getInadimplencia(competencia, escolaId);
    if (inad.percentual > 0.1) {
      alertas.push({
        id: "inadimplencia-alta",
        severidade: "critico",
        titulo: "Inadimplência acima de 10%",
        descricao: `${(inad.percentual * 100).toFixed(1)}% do previsto não foi pago`,
        href: "/financeiro",
      });
    }
  }

  const folhaRatio = await getFolhaRatio(competencia, escolaId);
  if (folhaRatio.ratio > 0.65) {
    alertas.push({
      id: "folha-pesada",
      severidade: "atencao",
      titulo: "Folha acima de 65% da receita",
      descricao: `${(folhaRatio.ratio * 100).toFixed(1)}% comprometido`,
      href: "/rh",
    });
  }

  return alertas.slice(0, 5);
}
