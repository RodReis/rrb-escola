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

function yoyCompetencia(competencia: string): string {
  const [y, m] = competencia.split("-").map(Number);
  return `${y - 1}-${pad(m)}`;
}

export function currentCompetencia(): string {
  return competenciaFromDate(new Date());
}

export type HeroData = {
  competencia: string;
  receita: number;
  receitaPrev: number;
  receitaYoY: number;
  despesa: number;
  despesaPrev: number;
  despesaYoY: number;
  despesaFixa: number;
  despesaVariavel: number;
  folha: number;
  folhaPrev: number;
  folhaYoY: number;
  margem: number;
  margemPrev: number;
  margemYoY: number;
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
  const yoy = yoyCompetencia(competencia);

  const [
    receita, receitaPrev, receitaYoY,
    despesaBreakdown, despesaPrev, despesaYoY,
    folha, folhaPrev, folhaYoY,
  ] = await Promise.all([
    somaPagamentos(supabase, escolaId, competencia),
    somaPagamentos(supabase, escolaId, prev),
    somaPagamentos(supabase, escolaId, yoy),
    somaDespesasPorTipo(supabase, escolaId, competencia),
    somaDespesas(supabase, escolaId, prev),
    somaDespesas(supabase, escolaId, yoy),
    somaFolha(supabase, escolaId, competencia),
    somaFolha(supabase, escolaId, prev),
    somaFolha(supabase, escolaId, yoy),
  ]);

  const despesa = despesaBreakdown.fixas + despesaBreakdown.variaveis;

  return {
    competencia,
    receita,
    receitaPrev,
    receitaYoY,
    despesa,
    despesaPrev,
    despesaYoY,
    despesaFixa: despesaBreakdown.fixas,
    despesaVariavel: despesaBreakdown.variaveis,
    folha,
    folhaPrev,
    folhaYoY,
    margem: receita - despesa - folha,
    margemPrev: receitaPrev - despesaPrev - folhaPrev,
    margemYoY: receitaYoY - despesaYoY - folhaYoY,
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
      .is("cancelado_em", null)
      .range(0, 99999),
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

export async function getOcupacao(
  escolaId: string = DEFAULT_SCHOOL_ID,
  anoLetivo: number = new Date().getFullYear()
): Promise<OcupacaoData> {
  const supabase = await createServerClient();

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
  escolaId: string = DEFAULT_SCHOOL_ID,
  anoLetivo: number = new Date().getFullYear()
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

  const ocup = await getOcupacao(escolaId, anoLetivo);

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
  escolaId: string = DEFAULT_SCHOOL_ID,
  anoLetivo: number = new Date().getFullYear()
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
  escolaId: string = DEFAULT_SCHOOL_ID,
  anoLetivo: number = new Date().getFullYear()
): Promise<BeneficiosData> {
  const supabase = await createServerClient();

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

export type FrequenciaResumo = {
  totalRegistros: number;
  presentes: number;
  faltas: number;
  taxaPresenca: number; // 0..1
  diasComRegistro: number;
  serie: Array<{ data: string; taxa: number }>; // ultimos N dias
};

export async function getFrequenciaResumo(
  escolaId: string = DEFAULT_SCHOOL_ID,
  days: number = 30,
  anoLetivo: number = new Date().getFullYear()
): Promise<FrequenciaResumo> {
  const supabase = await createServerClient();
  const hoje = new Date();
  const desde = new Date(hoje);
  desde.setDate(desde.getDate() - days);
  const desdeStr = desde.toISOString().slice(0, 10);
  const hojeStr = hoje.toISOString().slice(0, 10);

  const { data } = await supabase
    .from("frequencias")
    .select("data_aula, presente")
    .eq("escola_id", escolaId)
    .gte("data_aula", desdeStr)
    .lte("data_aula", hojeStr);

  let presentes = 0;
  let faltas = 0;
  const porDia = new Map<string, { p: number; f: number }>();

  for (const r of (data ?? []) as Array<{ data_aula: string; presente: boolean }>) {
    if (r.presente) presentes++;
    else faltas++;
    const acc = porDia.get(r.data_aula) ?? { p: 0, f: 0 };
    if (r.presente) acc.p++;
    else acc.f++;
    porDia.set(r.data_aula, acc);
  }

  const total = presentes + faltas;
  const serie = Array.from(porDia.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([data, c]) => ({
      data,
      taxa: c.p + c.f > 0 ? c.p / (c.p + c.f) : 0,
    }));

  return {
    totalRegistros: total,
    presentes,
    faltas,
    taxaPresenca: total > 0 ? presentes / total : 0,
    diasComRegistro: porDia.size,
    serie,
  };
}

export type AniversarianteRow = {
  alunoId: string;
  nome: string;
  dia: number;
  mes: number;
  diaSemana: string;
  proximo: boolean; // verdadeiro se aniversario ainda nao passou
  hoje: boolean;
};

export async function getAniversariantes(
  escolaId: string = DEFAULT_SCHOOL_ID,
  limit: number = 10
): Promise<AniversarianteRow[]> {
  const supabase = await createServerClient();
  const hoje = new Date();
  const mesAtual = hoje.getMonth() + 1;
  const diaHoje = hoje.getDate();

  // alunos com matricula ativa
  const { data: matriculas } = await supabase
    .from("matriculas")
    .select("aluno_id, alunos(id, nome, data_nascimento)")
    .eq("escola_id", escolaId)
    .eq("status", "ativa");

  const vistos = new Set<string>();
  const rows: AniversarianteRow[] = [];
  const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];

  for (const m of (matriculas ?? []) as any[]) {
    const aluno = Array.isArray(m.alunos) ? m.alunos[0] : m.alunos;
    if (!aluno?.data_nascimento) continue;
    if (vistos.has(aluno.id)) continue;
    vistos.add(aluno.id);

    const [, mm, dd] = String(aluno.data_nascimento).split("-").map(Number);
    if (mm !== mesAtual) continue;

    const dataAniv = new Date(hoje.getFullYear(), mm - 1, dd);
    rows.push({
      alunoId: aluno.id,
      nome: aluno.nome ?? "—",
      dia: dd,
      mes: mm,
      diaSemana: DIAS_SEMANA[dataAniv.getDay()] ?? "",
      proximo: dd >= diaHoje,
      hoje: dd === diaHoje,
    });
  }

  rows.sort((a, b) => a.dia - b.dia);
  return rows.slice(0, limit);
}

export type TurmaRankingRow = {
  turmaId: string;
  turmaNome: string;
  serie: string;
  segmento: string;
  turno: string;
  capacidade: number;
  matriculados: number;
  ocupacao: number; // 0..1
  vagasLivres: number;
};

export async function getRankingTurmas(
  escolaId: string = DEFAULT_SCHOOL_ID,
  limit: number = 10,
  anoLetivo: number = new Date().getFullYear()
): Promise<TurmaRankingRow[]> {
  const supabase = await createServerClient();

  const { data: turmas } = await supabase
    .from("turmas")
    .select("id, nome, turno, capacidade, serie_id, series(nome, segmento)")
    .eq("escola_id", escolaId)
    .eq("ano_letivo", anoLetivo)
    .eq("ativo", true);

  const { data: matriculas } = await supabase
    .from("matriculas")
    .select("turma_id")
    .eq("escola_id", escolaId)
    .eq("status", "ativa");

  const countPorTurma = new Map<string, number>();
  for (const m of matriculas ?? []) {
    countPorTurma.set(m.turma_id, (countPorTurma.get(m.turma_id) ?? 0) + 1);
  }

  const rows: TurmaRankingRow[] = ((turmas ?? []) as any[]).map((t) => {
    const seriesRel = t.series;
    const serie = Array.isArray(seriesRel) ? seriesRel[0] : seriesRel;
    const cap = Number(t.capacidade ?? 0);
    const matric = countPorTurma.get(t.id) ?? 0;
    return {
      turmaId: t.id,
      turmaNome: t.nome,
      serie: serie?.nome ?? "—",
      segmento: serie?.segmento ?? "outros",
      turno: t.turno,
      capacidade: cap,
      matriculados: matric,
      ocupacao: cap > 0 ? matric / cap : 0,
      vagasLivres: Math.max(0, cap - matric),
    };
  });

  rows.sort((a, b) => b.ocupacao - a.ocupacao);
  return rows.slice(0, limit);
}

export type CategoriaDespesaRow = {
  categoriaId: string | null;
  categoria: string;
  total: number;
  count: number;
  tipo: "fixa" | "variavel" | "mista";
};

export async function getTopCategoriasDespesas(
  competencia: string,
  escolaId: string = DEFAULT_SCHOOL_ID,
  limit: number = 6
): Promise<CategoriaDespesaRow[]> {
  const supabase = await createServerClient();

  const { data } = await supabase
    .from("despesas")
    .select("valor, tipo, categoria_id, categorias_despesa(nome)")
    .eq("escola_id", escolaId)
    .eq("competencia", competencia)
    .neq("status", "cancelada");

  type Acc = { categoria: string; total: number; count: number; tipos: Set<string> };
  const map = new Map<string, Acc>();

  for (const r of (data ?? []) as any[]) {
    const catRel = r.categorias_despesa;
    const cat = Array.isArray(catRel) ? catRel[0] : catRel;
    const key = r.categoria_id ?? "sem_categoria";
    const nome = cat?.nome ?? "Sem categoria";
    const acc = map.get(key) ?? { categoria: nome, total: 0, count: 0, tipos: new Set() };
    acc.total += Number(r.valor ?? 0);
    acc.count += 1;
    if (r.tipo) acc.tipos.add(r.tipo);
    map.set(key, acc);
  }

  const rows: CategoriaDespesaRow[] = Array.from(map.entries()).map(([id, a]) => ({
    categoriaId: id === "sem_categoria" ? null : id,
    categoria: a.categoria,
    total: a.total,
    count: a.count,
    tipo: a.tipos.size > 1 ? "mista" : (a.tipos.has("fixa") ? "fixa" : "variavel"),
  }));

  rows.sort((a, b) => b.total - a.total);
  return rows.slice(0, limit);
}

export type RealizadoVsProjetadoData = {
  projetado: number;
  realizado: number;
  diferenca: number;
  pctRealizacao: number; // 0..1
  porEtapa: Array<{
    etapa: string;
    projetado: number;
    realizado: number;
    diferenca: number;
    matriculados: number;
    valorReferencia: number;
  }>;
};

export async function getRealizadoVsProjetado(
  competencia: string,
  escolaId: string = DEFAULT_SCHOOL_ID,
  anoLetivo: number = new Date().getFullYear()
): Promise<RealizadoVsProjetadoData> {
  const supabase = await createServerClient();

  // Carrega valores praticados ordem_filho = 1 (preco cheio)
  const { data: valoresRaw } = await supabase
    .from("valores_praticados")
    .select("segmento, valor_mensalidade")
    .eq("escola_id", escolaId)
    .eq("ano_letivo", anoLetivo)
    .eq("ordem_filho", 1);

  const valorPorSegmento = new Map<string, number>();
  for (const v of (valoresRaw ?? []) as Array<{ segmento: string; valor_mensalidade: number | string }>) {
    valorPorSegmento.set(v.segmento, Number(v.valor_mensalidade));
  }

  // Matriculados por segmento (todas as ativas, inclusive bolsistas — projetado conta TODOS pelo preco cheio)
  const ocup = await getOcupacao(escolaId);

  // Realizado: soma cobrancas do mes (valor_final ja com descontos)
  const { data: cobrancas } = await supabase
    .from("cobrancas")
    .select("valor_final, matriculas(serie_id, series(segmento))")
    .eq("escola_id", escolaId)
    .eq("competencia", competencia)
    .neq("status", "cancelada");

  const realizadoPorEtapa = new Map<string, number>();
  for (const c of ((cobrancas ?? []) as any[])) {
    const matriculasRel = c.matriculas;
    const matricula = Array.isArray(matriculasRel) ? matriculasRel[0] : matriculasRel;
    const seriesRel = matricula?.series;
    const serie = Array.isArray(seriesRel) ? seriesRel[0] : seriesRel;
    const etapa = serie?.segmento ?? "outros";
    realizadoPorEtapa.set(etapa, (realizadoPorEtapa.get(etapa) ?? 0) + Number(c.valor_final ?? 0));
  }

  const porEtapa = ocup.porEtapa.map((e) => {
    const valorReferencia = valorPorSegmento.get(e.etapa) ?? 0;
    const projetado = e.matriculados * valorReferencia;
    const realizado = realizadoPorEtapa.get(e.etapa) ?? 0;
    return {
      etapa: e.etapa,
      projetado,
      realizado,
      diferenca: realizado - projetado,
      matriculados: e.matriculados,
      valorReferencia,
    };
  });

  const projetado = porEtapa.reduce((s, e) => s + e.projetado, 0);
  const realizado = porEtapa.reduce((s, e) => s + e.realizado, 0);

  return {
    projetado,
    realizado,
    diferenca: realizado - projetado,
    pctRealizacao: projetado > 0 ? realizado / projetado : 0,
    porEtapa,
  };
}

export type FrequenciaPorTurmaRow = {
  turmaId: string;
  turmaNome: string;
  serie: string;
  segmento: string;
  presentes: number;
  faltas: number;
  taxaPresenca: number; // 0..1
  totalRegistros: number;
};

export async function getFrequenciaPorTurma(
  escolaId: string = DEFAULT_SCHOOL_ID,
  days: number = 30,
  anoLetivo: number = new Date().getFullYear()
): Promise<FrequenciaPorTurmaRow[]> {
  const supabase = await createServerClient();
  const hoje = new Date();
  const desde = new Date(hoje);
  desde.setDate(desde.getDate() - days);
  const desdeStr = desde.toISOString().slice(0, 10);
  const hojeStr = hoje.toISOString().slice(0, 10);

  const { data: turmas } = await supabase
    .from("turmas")
    .select("id, nome, series(nome, segmento)")
    .eq("escola_id", escolaId)
    .eq("ano_letivo", anoLetivo)
    .eq("ativo", true);

  const { data: frequencias } = await supabase
    .from("frequencias")
    .select("presente, matricula_id, matriculas(turma_id)")
    .eq("escola_id", escolaId)
    .gte("data_aula", desdeStr)
    .lte("data_aula", hojeStr);

  type Acc = { p: number; f: number };
  const porTurma = new Map<string, Acc>();
  for (const f of ((frequencias ?? []) as any[])) {
    const mRel = f.matriculas;
    const matricula = Array.isArray(mRel) ? mRel[0] : mRel;
    const turmaId = matricula?.turma_id;
    if (!turmaId) continue;
    const acc = porTurma.get(turmaId) ?? { p: 0, f: 0 };
    if (f.presente) acc.p++;
    else acc.f++;
    porTurma.set(turmaId, acc);
  }

  const rows: FrequenciaPorTurmaRow[] = ((turmas ?? []) as any[]).map((t) => {
    const seriesRel = t.series;
    const serie = Array.isArray(seriesRel) ? seriesRel[0] : seriesRel;
    const acc = porTurma.get(t.id) ?? { p: 0, f: 0 };
    const total = acc.p + acc.f;
    return {
      turmaId: t.id,
      turmaNome: t.nome,
      serie: serie?.nome ?? "—",
      segmento: serie?.segmento ?? "outros",
      presentes: acc.p,
      faltas: acc.f,
      taxaPresenca: total > 0 ? acc.p / total : 0,
      totalRegistros: total,
    };
  });

  // ordena: turmas COM registros primeiro (menor taxa = problema), depois turmas sem registro no fim
  rows.sort((a, b) => {
    if (a.totalRegistros === 0 && b.totalRegistros === 0) return 0;
    if (a.totalRegistros === 0) return 1;
    if (b.totalRegistros === 0) return -1;
    return a.taxaPresenca - b.taxaPresenca;
  });

  return rows;
}

export type AniversarioSemanaRow = {
  alunoId: string;
  nome: string;
  dia: number;
  mes: number;
  diaSemana: string;
  fotoUrl: string | null;
  hoje: boolean;
};

export async function getAniversariantesSemana(
  escolaId: string = DEFAULT_SCHOOL_ID
): Promise<AniversarioSemanaRow[]> {
  const supabase = await createServerClient();
  const hoje = new Date();
  const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];

  // 7 dias a partir de hoje: lista (mes, dia) validos
  const janela: Array<{ mes: number; dia: number; rotulo: string }> = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + i);
    janela.push({
      mes: d.getMonth() + 1,
      dia: d.getDate(),
      rotulo: DIAS_SEMANA[d.getDay()] ?? "",
    });
  }

  const { data: matriculas } = await supabase
    .from("matriculas")
    .select("aluno_id, alunos(id, nome, data_nascimento, foto_url)")
    .eq("escola_id", escolaId)
    .eq("status", "ativa");

  const vistos = new Set<string>();
  const rows: AniversarioSemanaRow[] = [];

  for (const m of ((matriculas ?? []) as any[])) {
    const aluno = Array.isArray(m.alunos) ? m.alunos[0] : m.alunos;
    if (!aluno?.data_nascimento) continue;
    if (vistos.has(aluno.id)) continue;

    const parts = String(aluno.data_nascimento).split("-").map(Number);
    const mm = parts[1];
    const dd = parts[2];
    if (!mm || !dd) continue;

    const slot = janela.find((j) => j.mes === mm && j.dia === dd);
    if (!slot) continue;

    vistos.add(aluno.id);
    rows.push({
      alunoId: aluno.id,
      nome: aluno.nome ?? "—",
      dia: dd,
      mes: mm,
      diaSemana: slot.rotulo,
      fotoUrl: aluno.foto_url ?? null,
      hoje: dd === hoje.getDate() && mm === hoje.getMonth() + 1,
    });
  }

  rows.sort((a, b) => {
    // ordena seguindo a janela (proximidade)
    const ia = janela.findIndex((j) => j.mes === a.mes && j.dia === a.dia);
    const ib = janela.findIndex((j) => j.mes === b.mes && j.dia === b.dia);
    return ia - ib;
  });

  return rows;
}

export type AniversarioMatriculaRow = {
  alunoId: string;
  nome: string;
  dataMatricula: string;
  anosNaEscola: number;
  diaSemana: string;
  hoje: boolean;
};

export async function getAniversariantesMatricula(
  escolaId: string = DEFAULT_SCHOOL_ID,
  limit: number = 10,
  anoLetivo: number = new Date().getFullYear()
): Promise<AniversarioMatriculaRow[]> {
  const supabase = await createServerClient();
  const hoje = new Date();
  const mesAtual = hoje.getMonth() + 1;
  const diaHoje = hoje.getDate();
  const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];

  // Pega a matricula mais antiga (primeira na escola) por aluno ativo
  const { data: matriculas } = await supabase
    .from("matriculas")
    .select("aluno_id, data_matricula, alunos(id, nome)")
    .eq("escola_id", escolaId);

  const primeira = new Map<string, { dataMatricula: string; nome: string }>();
  for (const m of ((matriculas ?? []) as any[])) {
    const aluno = Array.isArray(m.alunos) ? m.alunos[0] : m.alunos;
    if (!aluno || !m.data_matricula) continue;
    const atual = primeira.get(aluno.id);
    if (!atual || m.data_matricula < atual.dataMatricula) {
      primeira.set(aluno.id, { dataMatricula: m.data_matricula, nome: aluno.nome ?? "—" });
    }
  }

  // Verifica quem tem matricula ATIVA (so listar quem ainda esta na escola)
  const { data: ativasRaw } = await supabase
    .from("matriculas")
    .select("aluno_id")
    .eq("escola_id", escolaId)
    .eq("status", "ativa");

  const ativos = new Set<string>(
    (ativasRaw ?? []).map((m: { aluno_id: string }) => m.aluno_id)
  );

  const rows: AniversarioMatriculaRow[] = [];
  for (const [alunoId, info] of Array.from(primeira.entries())) {
    if (!ativos.has(alunoId)) continue;
    const parts = info.dataMatricula.split("-").map(Number);
    const ano = parts[0];
    const mm = parts[1];
    const dd = parts[2];
    if (!ano || !mm || !dd) continue;
    if (mm !== mesAtual) continue;

    const anos = hoje.getFullYear() - ano;
    if (anos < 1) continue; // pula recém-matriculados sem aniversário

    const dataAniv = new Date(hoje.getFullYear(), mm - 1, dd);
    rows.push({
      alunoId,
      nome: info.nome,
      dataMatricula: info.dataMatricula,
      anosNaEscola: anos,
      diaSemana: DIAS_SEMANA[dataAniv.getDay()] ?? "",
      hoje: dd === diaHoje,
    });
  }

  rows.sort((a, b) => {
    const da = new Date(a.dataMatricula).getDate();
    const db = new Date(b.dataMatricula).getDate();
    return da - db;
  });

  return rows.slice(0, limit);
}

export type ProximaCobrancaRow = {
  cobrancaId: string;
  alunoId: string;
  alunoNome: string;
  descricao: string;
  valor: number;
  dataVencimento: string;
  diasAteVencimento: number;
  status: string;
};

export async function getProximasCobrancas(
  escolaId: string = DEFAULT_SCHOOL_ID,
  dias: number = 7
): Promise<ProximaCobrancaRow[]> {
  const supabase = await createServerClient();
  const hoje = new Date();
  const hojeStr = hoje.toISOString().slice(0, 10);
  const limite = new Date(hoje);
  limite.setDate(limite.getDate() + dias);
  const limiteStr = limite.toISOString().slice(0, 10);

  const { data } = await supabase
    .from("cobrancas")
    .select(`
      id, descricao, valor_final, data_vencimento, status,
      matriculas(aluno_id, alunos(nome))
    `)
    .eq("escola_id", escolaId)
    .gte("data_vencimento", hojeStr)
    .lte("data_vencimento", limiteStr)
    .in("status", ["aberta", "vencida", "parcial"])
    .order("data_vencimento");

  const hojeUTC = Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  return ((data ?? []) as any[]).map((c) => {
    const matricula = Array.isArray(c.matriculas) ? c.matriculas[0] : c.matriculas;
    const aluno = Array.isArray(matricula?.alunos) ? matricula?.alunos?.[0] : matricula?.alunos;
    const [vy, vm, vd] = String(c.data_vencimento).split("-").map(Number) as [number, number, number];
    const vencUTC = Date.UTC(vy, vm - 1, vd);
    const diasAteVencimento = Math.floor((vencUTC - hojeUTC) / (1000 * 60 * 60 * 24));
    return {
      cobrancaId: c.id,
      alunoId: matricula?.aluno_id ?? "",
      alunoNome: aluno?.nome ?? "—",
      descricao: c.descricao ?? "—",
      valor: Number(c.valor_final ?? 0),
      dataVencimento: c.data_vencimento,
      diasAteVencimento,
      status: c.status,
    };
  });
}

export type SaudeIndicador = {
  id: string;
  titulo: string;
  detalhe: string;
  ok: boolean;
  href: string;
};

export type SaudeSistemaData = {
  totalChecks: number;
  okCount: number;
  itens: SaudeIndicador[];
};

export async function getSaudeSistema(
  escolaId: string = DEFAULT_SCHOOL_ID
): Promise<SaudeSistemaData> {
  const supabase = await createServerClient();
  const anoLetivo = new Date().getFullYear();

  // 1. Turmas sem disciplinas (via serie)
  const { data: seriesSemDisc } = await supabase
    .from("series")
    .select("id, nome, disciplinas(id)")
    .eq("escola_id", escolaId);
  const seriesVazias = ((seriesSemDisc ?? []) as any[]).filter((s) => {
    const arr = Array.isArray(s.disciplinas) ? s.disciplinas : [];
    return arr.length === 0;
  });

  // 2. Turmas sem nenhuma avaliação no ano
  const { data: turmasRaw } = await supabase
    .from("turmas")
    .select("id, nome, ano_letivo, ativo, series(nome)")
    .eq("escola_id", escolaId)
    .eq("ano_letivo", anoLetivo)
    .eq("ativo", true);

  const turmaIds = ((turmasRaw ?? []) as any[]).map((t) => t.id);
  const { data: avals } = turmaIds.length > 0
    ? await supabase
        .from("avaliacoes")
        .select("turma_id")
        .eq("escola_id", escolaId)
        .eq("ano_letivo", anoLetivo)
        .in("turma_id", turmaIds)
    : { data: [] };
  const turmasComAval = new Set(((avals ?? []) as Array<{ turma_id: string }>).map((a) => a.turma_id));
  const turmasSemAval = ((turmasRaw ?? []) as any[]).filter((t) => !turmasComAval.has(t.id));

  // 3. Disciplinas sem professor atribuido (qualquer turma)
  const { count: discCount } = await supabase
    .from("disciplinas")
    .select("id", { count: "exact", head: true })
    .eq("escola_id", escolaId)
    .eq("ativo", true);
  const { count: atribCount } = await supabase
    .from("professor_disciplina_turma")
    .select("id", { count: "exact", head: true })
    .eq("escola_id", escolaId);
  const semProfessor = (discCount ?? 0) > 0 && (atribCount ?? 0) === 0;

  // 4. Alunos ativos sem plano
  const { count: alunosSemPlano } = await supabase
    .from("matriculas")
    .select("id", { count: "exact", head: true })
    .eq("escola_id", escolaId)
    .eq("status", "ativa")
    .is("plano_id", null);

  // 5. Valores praticados ano corrente
  const { count: valoresCount } = await supabase
    .from("valores_praticados")
    .select("id", { count: "exact", head: true })
    .eq("escola_id", escolaId)
    .eq("ano_letivo", anoLetivo);

  const itens: SaudeIndicador[] = [
    {
      id: "series-sem-disc",
      titulo: "Séries com disciplinas",
      detalhe: seriesVazias.length === 0
        ? "Todas as séries possuem disciplinas"
        : `${seriesVazias.length} série(s) sem disciplinas: ${seriesVazias.slice(0, 3).map((s) => s.nome).join(", ")}`,
      ok: seriesVazias.length === 0,
      href: "/disciplinas",
    },
    {
      id: "turmas-sem-aval",
      titulo: "Turmas com avaliações",
      detalhe: turmasSemAval.length === 0
        ? "Todas as turmas têm pelo menos uma avaliação"
        : `${turmasSemAval.length} turma(s) sem avaliações no ano`,
      ok: turmasSemAval.length === 0,
      href: "/avaliacoes/nova",
    },
    {
      id: "disc-sem-prof",
      titulo: "Disciplinas com professor",
      detalhe: semProfessor
        ? "Nenhuma atribuição professor → disciplina cadastrada"
        : `${atribCount ?? 0} atribuição(ões) configurada(s)`,
      ok: !semProfessor,
      href: "/professores/atribuicoes",
    },
    {
      id: "alunos-sem-plano",
      titulo: "Alunos ativos com plano",
      detalhe: (alunosSemPlano ?? 0) === 0
        ? "Todas matrículas ativas têm plano vinculado"
        : `${alunosSemPlano} matrícula(s) ativa(s) sem plano`,
      ok: (alunosSemPlano ?? 0) === 0,
      href: "/alunos",
    },
    {
      id: "valores-praticados",
      titulo: "Valores praticados do ano",
      detalhe: (valoresCount ?? 0) >= 12
        ? `${valoresCount} valores cadastrados`
        : `Faltam ${12 - (valoresCount ?? 0)} de 12 valores (4 segmentos × 3 ordens)`,
      ok: (valoresCount ?? 0) >= 12,
      href: "/valores-praticados",
    },
  ];

  return {
    totalChecks: itens.length,
    okCount: itens.filter((i) => i.ok).length,
    itens,
  };
}

export type SaldoYTDData = {
  receita: number;
  despesa: number;
  folha: number;
  margem: number;
  mesesComputados: number;
};

export async function getSaldoYTD(
  escolaId: string = DEFAULT_SCHOOL_ID,
  anoLetivo: number = new Date().getFullYear()
): Promise<SaldoYTDData> {
  const supabase = await createServerClient();
  const hoje = new Date();
  const mesAtual = hoje.getMonth() + 1;
  const competencias: string[] = [];
  for (let m = 1; m <= mesAtual; m++) {
    competencias.push(`${anoLetivo}-${pad(m)}`);
  }

  // receita: pagamentos no ano
  const inicioAno = `${anoLetivo}-01-01`;
  const fimHoje = hoje.toISOString().slice(0, 10);

  const [pagamentosRes, despesasRes, folhaRes] = await Promise.all([
    supabase
      .from("pagamentos")
      .select("valor_pago")
      .eq("escola_id", escolaId)
      .gte("data_pagamento", inicioAno)
      .lte("data_pagamento", fimHoje)
      .is("cancelado_em", null)
      .range(0, 99999),
    supabase
      .from("despesas")
      .select("valor")
      .eq("escola_id", escolaId)
      .in("competencia", competencias),
    supabase
      .from("payroll")
      .select("total_earnings")
      .in("reference_month", competencias.map((c) => `${c}-01`)),
  ]);

  const receita = (pagamentosRes.data ?? []).reduce((s, r) => s + Number(r.valor_pago ?? 0), 0);
  const despesa = (despesasRes.data ?? []).reduce((s, r) => s + Number(r.valor ?? 0), 0);
  const folha = (folhaRes.data ?? []).reduce((s, r) => s + Number(r.total_earnings ?? 0), 0);

  return {
    receita,
    despesa,
    folha,
    margem: receita - despesa - folha,
    mesesComputados: mesAtual,
  };
}
