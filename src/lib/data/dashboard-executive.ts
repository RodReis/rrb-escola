import { createServerClient } from "@/lib/supabase/server";
import { DEFAULT_SCHOOL_ID } from "@/lib/constants";

export type GestaoFinanceira = "propria" | "terceirizada";

export type TipoVaga = 'paga' | 'bolsa_integral' | 'bolsa_parcial' | 'permuta' | 'gratuita';

const BENEFICIARIO_TIPOS: TipoVaga[] = ['bolsa_integral', 'bolsa_parcial', 'permuta', 'gratuita'];

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
  despesaFixa: number;
  despesaVariavel: number;
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

async function somaDespesasPorTipo(
  supabase: Supa,
  escolaId: string,
  competencia: string
): Promise<{ fixas: number; variaveis: number }> {
  const { data } = await supabase
    .from("despesas")
    .select("valor, tipo")
    .eq("escola_id", escolaId)
    .eq("competencia", competencia);
  let fixas = 0;
  let variaveis = 0;
  for (const r of (data ?? []) as Array<{ valor: number | string; tipo: string }>) {
    const v = Number(r.valor ?? 0);
    if (r.tipo === "fixa") fixas += v;
    else variaveis += v;
  }
  return { fixas, variaveis };
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

  const [receita, receitaPrev, despesaBreakdown, despesaPrev, folha, folhaPrev] = await Promise.all([
    somaPagamentos(supabase, escolaId, competencia),
    somaPagamentos(supabase, escolaId, prev),
    somaDespesasPorTipo(supabase, escolaId, competencia),
    somaDespesas(supabase, escolaId, prev),
    somaFolha(supabase, escolaId, competencia),
    somaFolha(supabase, escolaId, prev),
  ]);

  const despesa = despesaBreakdown.fixas + despesaBreakdown.variaveis;

  return {
    competencia,
    receita,
    receitaPrev,
    despesa,
    despesaPrev,
    despesaFixa: despesaBreakdown.fixas,
    despesaVariavel: despesaBreakdown.variaveis,
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
  const first = monthRange(competencias[0]).first;
  const last = monthRange(competencias[competencias.length - 1]).last;

  // Convert competencias array to set for filtering
  const compSet = new Set(competencias);

  const [pagamentosRes, despesasRes, folhaRes] = await Promise.all([
    supabase
      .from("pagamentos")
      .select("data_pagamento, valor_pago")
      .eq("escola_id", escolaId)
      .gte("data_pagamento", first)
      .lte("data_pagamento", last)
      .is("cancelado_em", null),
    supabase
      .from("despesas")
      .select("valor, competencia")
      .eq("escola_id", escolaId)
      .in("competencia", competencias),
    // payroll uses reference_month (DATE) — convert competencias to DATEs
    supabase
      .from("payroll")
      .select("reference_month, total_earnings")
      .in("reference_month", competencias.map((c) => `${c}-01`)),
  ]);

  const receitaPorComp = new Map<string, number>();
  const despesaPorComp = new Map<string, number>();
  const folhaPorComp = new Map<string, number>();

  for (const p of pagamentosRes.data ?? []) {
    const dt = String(p.data_pagamento);
    const comp = dt.slice(0, 7); // YYYY-MM
    if (compSet.has(comp)) {
      receitaPorComp.set(comp, (receitaPorComp.get(comp) ?? 0) + Number(p.valor_pago ?? 0));
    }
  }
  for (const d of despesasRes.data ?? []) {
    despesaPorComp.set(d.competencia, (despesaPorComp.get(d.competencia) ?? 0) + Number(d.valor ?? 0));
  }
  for (const f of folhaRes.data ?? []) {
    const comp = String(f.reference_month).slice(0, 7);
    folhaPorComp.set(comp, (folhaPorComp.get(comp) ?? 0) + Number(f.total_earnings ?? 0));
  }

  return competencias.map((competencia) => ({
    competencia,
    receita: receitaPorComp.get(competencia) ?? 0,
    custos: (despesaPorComp.get(competencia) ?? 0) + (folhaPorComp.get(competencia) ?? 0),
  }));
}

export type OcupacaoData = {
  total: number;
  ocupadas: number;
  pagantes: number;
  beneficiados: number;
  porEtapa: Array<{
    etapa: string;
    capacidade: number;
    matriculados: number;
    bolsistas: number;
  }>;
};

export async function getOcupacao(escolaId: string = DEFAULT_SCHOOL_ID): Promise<OcupacaoData> {
  const supabase = await createServerClient();
  const anoLetivo = new Date().getFullYear();

  const { data: turmas } = await supabase
    .from("turmas")
    .select("id, capacidade, serie_id, series(segmento)")
    .eq("escola_id", escolaId)
    .eq("ano_letivo", anoLetivo)
    .eq("ativo", true);

  const { data: matriculas } = await supabase
    .from("matriculas")
    .select("turma_id, tipo_vaga")
    .eq("escola_id", escolaId)
    .eq("status", "ativa");

  type MatriculaCount = { total: number; bolsistas: number };
  const matriculasPorTurma = new Map<string, MatriculaCount>();
  let pagantes = 0;
  let beneficiados = 0;

  for (const m of matriculas ?? []) {
    const acc = matriculasPorTurma.get(m.turma_id) ?? { total: 0, bolsistas: 0 };
    acc.total += 1;
    const ehBeneficiario = BENEFICIARIO_TIPOS.includes(m.tipo_vaga as TipoVaga);
    if (ehBeneficiario) {
      acc.bolsistas += 1;
      beneficiados += 1;
    } else {
      pagantes += 1;
    }
    matriculasPorTurma.set(m.turma_id, acc);
  }

  type EtapaAgg = { capacidade: number; matriculados: number; bolsistas: number };
  const porEtapaMap = new Map<string, EtapaAgg>();
  let total = 0;
  let ocupadas = 0;

  for (const t of turmas ?? []) {
    const seriesRel = (t as any).series;
    const etapa = (Array.isArray(seriesRel) ? seriesRel[0]?.segmento : seriesRel?.segmento) ?? "outros";
    const cap = Number(t.capacidade ?? 0);
    const counts = matriculasPorTurma.get(t.id) ?? { total: 0, bolsistas: 0 };
    total += cap;
    ocupadas += counts.total;
    const acc = porEtapaMap.get(etapa) ?? { capacidade: 0, matriculados: 0, bolsistas: 0 };
    acc.capacidade += cap;
    acc.matriculados += counts.total;
    acc.bolsistas += counts.bolsistas;
    porEtapaMap.set(etapa, acc);
  }

  return {
    total,
    ocupadas,
    pagantes,
    beneficiados,
    porEtapa: Array.from(porEtapaMap.entries()).map(([etapa, v]) => ({ etapa, ...v })),
  };
}

export type StageBreakdownRow = {
  etapa: string;
  alunos: number;
  bolsistas: number;
  receita: number;
  ticket: number;
  ocupacao: number;
  capacidade: number;
  vagasLivres: number;
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
  for (const c of (cobrancas ?? []) as any[]) {
    const matriculasRel = c.matriculas;
    const matricula = Array.isArray(matriculasRel) ? matriculasRel[0] : matriculasRel;
    const seriesRel = matricula?.series;
    const serie = Array.isArray(seriesRel) ? seriesRel[0] : seriesRel;
    const etapa = serie?.segmento ?? "outros";
    receitaPorEtapa.set(etapa, (receitaPorEtapa.get(etapa) ?? 0) + Number(c.valor_final ?? 0));
  }

  const ocup = await getOcupacao(escolaId);

  return ocup.porEtapa.map((p) => ({
    etapa: p.etapa,
    alunos: p.matriculados,
    bolsistas: p.bolsistas,
    receita: receitaPorEtapa.get(p.etapa) ?? 0,
    ticket: p.matriculados > 0 ? (receitaPorEtapa.get(p.etapa) ?? 0) / p.matriculados : 0,
    ocupacao: p.capacidade > 0 ? p.matriculados / p.capacidade : 0,
    capacidade: p.capacidade,
    vagasLivres: Math.max(0, p.capacidade - p.matriculados),
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
      const [{ data: cobrancas }, { count: pagantesCount }] = await Promise.all([
        supabase
          .from("cobrancas")
          .select("valor_final")
          .eq("escola_id", escolaId)
          .eq("competencia", competencia)
          .neq("status", "cancelada"),
        supabase
          .from("matriculas")
          .select("id", { count: "exact", head: true })
          .eq("escola_id", escolaId)
          .eq("status", "ativa")
          .in("tipo_vaga", ["paga", "bolsa_parcial"]),
      ]);
      const total = (cobrancas ?? []).reduce((s, r) => s + Number(r.valor_final ?? 0), 0);
      return pagantesCount && pagantesCount > 0 ? total / pagantesCount : 0;
    })
  );

  return {
    atual: serie[serie.length - 1] ?? 0,
    serie,
  };
}

export type FolhaRatioData = {
  ratio: number;
  ratioPrev: number;
  receita: number;
  folha: number;
  serie: number[]; // ratio dos ultimos N meses (em fracao 0..1)
};

export async function getFolhaRatio(
  competencia: string,
  escolaId: string = DEFAULT_SCHOOL_ID,
  months: number = 6
): Promise<FolhaRatioData> {
  const supabase = await createServerClient();
  const competencias = rollingCompetencias(months);
  const prev = prevCompetencia(competencia);

  const serie = await Promise.all(
    competencias.map(async (c) => {
      const [r, f] = await Promise.all([
        somaPagamentos(supabase, escolaId, c),
        somaFolha(supabase, escolaId, c),
      ]);
      return r > 0 ? f / r : 0;
    })
  );

  const [receita, folha, receitaPrev, folhaPrev] = await Promise.all([
    somaPagamentos(supabase, escolaId, competencia),
    somaFolha(supabase, escolaId, competencia),
    somaPagamentos(supabase, escolaId, prev),
    somaFolha(supabase, escolaId, prev),
  ]);

  return {
    ratio: receita > 0 ? folha / receita : 0,
    ratioPrev: receitaPrev > 0 ? folhaPrev / receitaPrev : 0,
    receita,
    folha,
    serie,
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
  const hojeUTC = Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());

  const { data } = await supabase
    .from("matriculas")
    .select("id, aluno_id, ano_letivo, data_matricula, alunos(nome)")
    .eq("escola_id", escolaId)
    .eq("status", "ativa")
    .eq("ano_letivo", anoLetivo)
    .order("data_matricula", { ascending: true })
    .limit(limit);

  return ((data ?? []) as any[]).map((m) => {
    let diasRestantes = 0;
    if (m.data_matricula) {
      const [dy, dm, dd] = String(m.data_matricula).split("-").map(Number) as [number, number, number];
      const fimContratoUTC = Date.UTC(dy + 1, dm - 1, dd);
      diasRestantes = Math.floor((fimContratoUTC - hojeUTC) / (1000 * 60 * 60 * 24));
    } else {
      const fimAno = Date.UTC(anoLetivo, 11, 31);
      diasRestantes = Math.floor((fimAno - hojeUTC) / (1000 * 60 * 60 * 24));
    }
    return {
      matriculaId: m.id,
      alunoId: m.aluno_id,
      alunoNome: Array.isArray(m.alunos) ? (m.alunos[0]?.nome ?? "—") : (m.alunos?.nome ?? "—"),
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

export type BeneficiosData = {
  total: number;
  porTipo: Record<TipoVaga, number>;
  receitaPerdidaEstimada: number;
};

export async function getBeneficios(
  escolaId: string = DEFAULT_SCHOOL_ID
): Promise<BeneficiosData> {
  const supabase = await createServerClient();
  const anoLetivo = new Date().getFullYear();

  const { data: matriculas } = await supabase
    .from("matriculas")
    .select("tipo_vaga, percentual_bolsa, series(segmento), planos(valor_mensalidade)")
    .eq("escola_id", escolaId)
    .eq("status", "ativa")
    .in("tipo_vaga", BENEFICIARIO_TIPOS);

  // Carrega valores praticados do ano corrente (ordem_filho = 1)
  const { data: valoresPraticados } = await supabase
    .from("valores_praticados")
    .select("segmento, valor_mensalidade")
    .eq("escola_id", escolaId)
    .eq("ano_letivo", anoLetivo)
    .eq("ordem_filho", 1);

  const valorPorSegmento = new Map<string, number>();
  for (const v of (valoresPraticados ?? []) as Array<{ segmento: string; valor_mensalidade: number | string }>) {
    valorPorSegmento.set(v.segmento, Number(v.valor_mensalidade));
  }

  const porTipo: Record<TipoVaga, number> = {
    paga: 0,
    bolsa_integral: 0,
    bolsa_parcial: 0,
    permuta: 0,
    gratuita: 0,
  };

  let receitaPerdida = 0;

  for (const m of ((matriculas ?? []) as any[])) {
    const tipo = m.tipo_vaga as TipoVaga;
    porTipo[tipo] = (porTipo[tipo] ?? 0) + 1;

    const seriesRel = m.series;
    const serie = Array.isArray(seriesRel) ? seriesRel[0] : seriesRel;
    const segmento = serie?.segmento as string | undefined;

    const planosRel = m.planos;
    const plano = Array.isArray(planosRel) ? planosRel[0] : planosRel;
    const fallback = Number(plano?.valor_mensalidade ?? 0);

    const valorSegmento = segmento ? valorPorSegmento.get(segmento) : undefined;
    const valorReferencia = valorSegmento ?? fallback;

    if (tipo === "bolsa_parcial") {
      const pct = Number(m.percentual_bolsa ?? 0) / 100;
      receitaPerdida += valorReferencia * pct;
    } else {
      receitaPerdida += valorReferencia;
    }
  }

  const total = BENEFICIARIO_TIPOS.reduce((s, t) => s + (porTipo[t] ?? 0), 0);

  return {
    total,
    porTipo,
    receitaPerdidaEstimada: receitaPerdida,
  };
}
