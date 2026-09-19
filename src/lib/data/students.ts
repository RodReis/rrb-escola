import { createServerClient } from "@/lib/supabase/server";
import { DEFAULT_SCHOOL_ID } from "@/lib/constants";
import type { StudentSheet } from "@/lib/types";

/** "ativos" (padrao) | "inativos" | "todos" — ver `situacao` em runStudentsQuery. */
export type SituacaoAluno = "ativos" | "inativos" | "todos";

export type StudentFilters = {
  nome?: string;
  serieId?: string;
  turmaId?: string;
  segmento?: string;
  anoLetivo?: number;
  situacao?: SituacaoAluno;
  page?: number;
  pageSize?: number;
};

export const STUDENTS_PAGE_SIZE = 30;

export type PaginatedStudents = {
  rows: NonNullable<Awaited<ReturnType<typeof runStudentsQuery>>["data"]>;
  total: number;
  page: number;
  pageSize: number;
};

function runStudentsQuery(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  filters: StudentFilters | undefined,
  from: number,
  to: number
) {
  // Filtro por matrícula (segmento/série/turma) exige inner join na relação;
  // sem esses filtros usamos left join para não perder alunos sem matrícula.
  // Ex-aluno nao tem matricula: o inner join abaixo o excluiria sempre, entao
  // ao pedir inativos (ou todos) o join volta a ser left.
  //
  // `anoLetivo` de proposito NAO entra aqui: a tela sempre manda um (o ano
  // corrente por padrao), entao inclui-lo tornava o inner join permanente e
  // escondia da lista o aluno ativo sem matricula no ano — justamente quem a
  // secretaria precisa achar para rematricular. O ano volta a filtrar assim que
  // ha serie/turma/segmento escolhidos.
  const situacao = filters?.situacao ?? "ativos";
  const querInativos = situacao !== "ativos";
  const hasEnrollmentFilter =
    !querInativos && Boolean(filters?.serieId || filters?.turmaId || filters?.segmento);
  const matriculaSelect = hasEnrollmentFilter
    ? "matriculas!inner(status, serie_id, turma_id, ano_letivo, series!inner(id, nome, segmento), turmas(id, nome), planos(nome))"
    : "matriculas(status, serie_id, turma_id, ano_letivo, series(id, nome, segmento), turmas(id, nome), planos(nome))";

  let query = supabase
    .from("alunos")
    .select(
      `id, matricula_codigo, nome, cpf, celular, ativo, foto_url, ${matriculaSelect}, responsaveis_aluno(nome, celular, telefone, parentesco)`,
      { count: "exact" }
    )
    .eq("escola_id", DEFAULT_SCHOOL_ID)
    .order("nome")
    .range(from, to);

  if (filters?.nome) query = query.ilike("nome", `%${filters.nome}%`);
  if (situacao === "ativos") query = query.eq("ativo", true);
  if (situacao === "inativos") query = query.eq("ativo", false);
  // Filtrar por ano é visão histórica: quem foi re-matriculado fica "concluida"
  // no ano anterior e ainda deve aparecer nele.
  if (hasEnrollmentFilter) {
    query = filters?.anoLetivo
      ? query.in("matriculas.status", ["ativa", "concluida"])
      : query.eq("matriculas.status", "ativa");
  }
  if (hasEnrollmentFilter) {
    if (filters?.serieId) query = query.eq("matriculas.serie_id", filters.serieId);
    if (filters?.turmaId) query = query.eq("matriculas.turma_id", filters.turmaId);
    if (filters?.segmento) query = query.eq("matriculas.series.segmento", filters.segmento);
    if (filters?.anoLetivo) query = query.eq("matriculas.ano_letivo", filters.anoLetivo);
  }

  return query;
}

export async function listStudents(filters?: StudentFilters): Promise<PaginatedStudents> {
  const supabase = await createServerClient();
  const page = Math.max(1, filters?.page ?? 1);
  const pageSize = filters?.pageSize ?? STUDENTS_PAGE_SIZE;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await runStudentsQuery(supabase, filters, from, to);
  if (error) throw error;

  return { rows: data ?? [], total: count ?? 0, page, pageSize };
}

type SegmentCountFilters = Pick<StudentFilters, "situacao" | "serieId" | "turmaId" | "anoLetivo">;

/**
 * Conta por segmento com os mesmos filtros de `listStudents` (exceto `segmento`,
 * que é o próprio eixo contado) — senão as abas ficam travadas num total que
 * ignora Situação/Série/Turma escolhidos nos combos ao lado.
 */
export async function getStudentSegmentCounts(filters?: SegmentCountFilters) {
  const supabase = await createServerClient();
  const situacao = filters?.situacao ?? "ativos";
  const querInativos = situacao !== "ativos";
  const anoLetivo = filters?.anoLetivo ?? new Date().getFullYear();

  let query = supabase
    .from("alunos")
    .select("id, ativo, matriculas(status, ano_letivo, serie_id, turma_id, series(segmento))")
    .eq("escola_id", DEFAULT_SCHOOL_ID);
  if (situacao === "ativos") query = query.eq("ativo", true);
  if (situacao === "inativos") query = query.eq("ativo", false);

  const { data, error } = await query;
  if (error) throw error;

  const counts = { all: 0, infantil: 0, fund1: 0, fund2: 0, medio: 0 };
  for (const row of data ?? []) {
    // Ex-aluno sem matrícula (inativo) ainda deve ser contado em "Todos" ao
    // filtrar por Situação — só matrícula filtra por ano quando ela existe.
    const matriculas = (row.matriculas ?? []) as {
      status?: string | null;
      ano_letivo?: number | null;
      serie_id?: string | null;
      turma_id?: string | null;
      series?: { segmento?: string | null } | { segmento?: string | null }[] | null;
    }[];
    let matriculasDoAno = matriculas.filter((m) => m.ano_letivo === anoLetivo);
    if (filters?.serieId) matriculasDoAno = matriculasDoAno.filter((m) => m.serie_id === filters.serieId);
    if (filters?.turmaId) matriculasDoAno = matriculasDoAno.filter((m) => m.turma_id === filters.turmaId);
    if (!querInativos) {
      matriculasDoAno = matriculasDoAno.filter((m) => ["ativa", "concluida"].includes(m.status ?? ""));
    }

    if (matriculasDoAno.length === 0) {
      // Sem matrícula no ano não há segmento a atribuir, mas o aluno ainda
      // existe: "Todos" precisa bater com o contador do título, que vem de
      // listStudents. Série/turma são exigências reais (inner join lá), então
      // só nesses casos o aluno sai da conta.
      if (!filters?.serieId && !filters?.turmaId) counts.all += 1;
      continue;
    }
    counts.all += 1;
    const enr = matriculasDoAno.find((m) => m.status === "ativa") ?? matriculasDoAno[0];
    const series = enr ? (Array.isArray(enr.series) ? enr.series[0] : enr.series) : null;
    const seg = (series as { segmento?: string | null } | null)?.segmento ?? null;
    if (seg === "INFANTIL") counts.infantil += 1;
    else if (seg === "FUNDAMENTAL1") counts.fund1 += 1;
    else if (seg === "FUNDAMENTAL2") counts.fund2 += 1;
    else if (seg === "MEDIO") counts.medio += 1;
  }
  return counts;
}

export async function getStudentFilterOptions(anoLetivo: number = new Date().getFullYear()) {
  const supabase = await createServerClient();
  const [seriesRes, turmasRes] = await Promise.all([
    supabase
      .from("series")
      .select("id, nome, segmento, ordem")
      .eq("escola_id", DEFAULT_SCHOOL_ID)
      .eq("ativo", true)
      .not("segmento", "is", null)
      .order("ordem"),
    supabase
      .from("turmas")
      .select("id, nome, serie_id, ano_letivo, turno")
      .eq("escola_id", DEFAULT_SCHOOL_ID)
      .eq("ativo", true)
      .eq("ano_letivo", anoLetivo)
      .order("turno")
      .order("nome"),
  ]);

  if (seriesRes.error) throw seriesRes.error;
  if (turmasRes.error) throw turmasRes.error;

  return {
    series: seriesRes.data ?? [],
    turmas: turmasRes.data ?? [],
  };
}

export async function getStudentAvailableYears(): Promise<number[]> {
  const supabase = await createServerClient();
  const { data, error } = await supabase.rpc("anos_letivos_matriculas", {
    p_escola_id: DEFAULT_SCHOOL_ID,
  });
  if (error) throw error;
  const rows = (data ?? []) as { ano_letivo: number }[];
  const anos = new Set<number>(rows.map((m) => m.ano_letivo));
  anos.add(new Date().getFullYear());
  return Array.from(anos).sort((a, b) => b - a);
}

export async function getStudentSheet(id: string) {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("alunos")
    .select(`
      *,
      enderecos_aluno(*),
      contatos_aluno(*),
      responsaveis_aluno(*),
      pessoas_autorizadas(*),
      informacoes_medicas(*),
      autorizacoes_aluno(*),
      matriculas(id, codigo, data_matricula, ano_letivo, idade_na_matricula, status, observacoes, series(nome), turmas(nome), planos(nome))
    `)
    .eq("id", id)
    .single();

  if (error) throw error;
  return data as StudentSheet;
}

export async function getStudentFormOptions() {
  const supabase = await createServerClient();
  const [series, turmas, planos] = await Promise.all([
    supabase.from("series").select("id, nome").eq("escola_id", DEFAULT_SCHOOL_ID).eq("ativo", true).order("ordem"),
    supabase.from("turmas").select("id, nome, ano_letivo, serie_id").eq("escola_id", DEFAULT_SCHOOL_ID).eq("ativo", true).order("nome"),
    supabase.from("planos").select("id, nome").eq("escola_id", DEFAULT_SCHOOL_ID).eq("ativo", true).order("nome")
  ]);

  if (series.error) throw series.error;
  if (turmas.error) throw turmas.error;
  if (planos.error) throw planos.error;

  return {
    series: series.data ?? [],
    turmas: turmas.data ?? [],
    planos: planos.data ?? []
  };
}

export async function getStudentsReport() {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("alunos")
    .select(`
      id,
      matricula_codigo,
      nome,
      cpf,
      rg,
      data_nascimento,
      celular,
      ativo,
      enderecos_aluno(cidade, uf, cep),
      responsaveis_aluno(nome, parentesco, celular, email, responsavel_financeiro),
      matriculas(status, ano_letivo, data_matricula, series(nome), turmas(nome))
    `)
    .eq("escola_id", DEFAULT_SCHOOL_ID)
    .order("nome");

  if (error) throw error;

  return (data ?? []).map((student) => {
    const activeEnrollment = [...(student.matriculas ?? [])]
      .sort((a, b) => Number(b.ano_letivo ?? 0) - Number(a.ano_letivo ?? 0))
      .find((item) => item.status === "ativa") ?? student.matriculas?.[0] ?? null;
    const activeSeries = activeEnrollment?.series as { nome?: string } | { nome?: string }[] | null | undefined;
    const activeClass = activeEnrollment?.turmas as { nome?: string } | { nome?: string }[] | null | undefined;
    const guardian =
      student.responsaveis_aluno?.find((item) => item.responsavel_financeiro) ?? student.responsaveis_aluno?.[0] ?? null;
    const address = student.enderecos_aluno?.[0] ?? null;

    return {
      id: student.id,
      matricula: student.matricula_codigo,
      nome: student.nome,
      cpf: student.cpf,
      rg: student.rg,
      dataNascimento: student.data_nascimento,
      celular: student.celular,
      ativo: student.ativo,
      cidade: address?.cidade ?? "",
      uf: address?.uf ?? "",
      cep: address?.cep ?? "",
      responsavel: guardian?.nome ?? "",
      responsavelParentesco: guardian?.parentesco ?? "",
      responsavelCelular: guardian?.celular ?? "",
      responsavelEmail: guardian?.email ?? "",
      serie: Array.isArray(activeSeries) ? activeSeries[0]?.nome ?? "" : activeSeries?.nome ?? "",
      turma: Array.isArray(activeClass) ? activeClass[0]?.nome ?? "" : activeClass?.nome ?? "",
      anoLetivo: activeEnrollment?.ano_letivo ?? null,
      statusMatricula: activeEnrollment?.status ?? ""
    };
  });
}
