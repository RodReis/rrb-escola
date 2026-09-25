import { createServerClient } from "@/lib/supabase/server";
import { DEFAULT_SCHOOL_ID } from "@/lib/constants";
import type { StudentSheet } from "@/lib/types";
import { normalizeNome } from "@/lib/format/normalize-nome";
import { derivarStatusFinanceiroMes, type StatusFinanceiroMes } from "@/lib/finance/status-mes-corrente";
import {
  alunoSemMatriculaAtivaNoAno,
  montarFiltroAlunosAtivos,
  type FiltroAlunosAtivosResolvido,
} from "./students-shared-constants";

/** "ativos" (padrao) | "inativos" | "todos" — ver `situacao` em runStudentsQuery. */
export type SituacaoAluno = "ativos" | "inativos" | "todos";

export type StatusFinanceiroFiltro = NonNullable<StatusFinanceiroMes>;

export type StudentFilters = {
  nome?: string;
  serieId?: string;
  turmaId?: string;
  segmento?: string;
  anoLetivo?: number;
  situacao?: SituacaoAluno;
  financeiro?: StatusFinanceiroFiltro;
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
    ? "matriculas!inner(id, status, serie_id, turma_id, ano_letivo, series!inner(id, nome, segmento), turmas(id, nome), planos(nome))"
    : "matriculas(id, status, serie_id, turma_id, ano_letivo, series(id, nome, segmento), turmas(id, nome), planos(nome))";

  let query = supabase
    .from("alunos")
    .select(
      `id, matricula_codigo, nome, cpf, celular, ativo, foto_url, ${matriculaSelect}, responsaveis_aluno(nome, celular, telefone, parentesco)`,
      { count: "exact" }
    )
    .eq("escola_id", DEFAULT_SCHOOL_ID)
    .order("nome")
    .range(from, to);

  // Busca ignora acento/caixa (mesma regra do combo/fonte única): compara
  // contra `nome_normalizado` em vez de `nome` — ver `docs/superpowers/specs/
  // 2026-09-19-fonte-unica-alunos-design.md`.
  if (filters?.nome) query = query.ilike("nome_normalizado", `%${normalizeNome(filters.nome)}%`);
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

// Lote máximo de ids por `.in()` nesta consulta. Smoke test real (2026-09-24,
// local, 509 alunos) confirmou 414 "URI Too Long" do PostgREST/gateway com
// todos os ids candidatos numa única query (~19KB de query string); 150 ids
// por lote (~5,7KB) respondeu 200 no mesmo ambiente.
const LOTE_IDS_FINANCEIRO = 150;

function emLotes<T>(itens: T[], tamanho: number): T[][] {
  const lotes: T[][] = [];
  for (let i = 0; i < itens.length; i += tamanho) {
    lotes.push(itens.slice(i, i + tamanho));
  }
  return lotes;
}

/**
 * Status financeiro do mês corrente para um lote de alunos (a página atual
 * da lista), numa única consulta — nunca uma por aluno. Alunos sem nenhuma
 * cobrança relevante no mês simplesmente não aparecem no mapa (a UI trata
 * ausência como "—").
 *
 * Fatia os ids em lotes de `LOTE_IDS_FINANCEIRO` — uma escola com centenas de
 * alunos cadastrados no total (não só os da página atual, quando chamada
 * pelo filtro financeiro) pode gerar um `.in()` grande demais para a URL do
 * gateway.
 */
export async function getFinanceiroMesCorrentePorAluno(
  alunoIds: string[]
): Promise<Map<string, StatusFinanceiroMes>> {
  const resultado = new Map<string, StatusFinanceiroMes>();
  if (alunoIds.length === 0) return resultado;

  const hoje = new Date().toISOString().slice(0, 10);
  const inicioMes = `${hoje.slice(0, 7)}-01`;
  const [ano, mes] = hoje.split("-").map(Number);
  const fimMes = new Date(ano, mes, 0).toISOString().slice(0, 10); // dia 0 do mês seguinte = último dia deste mês

  const supabase = await createServerClient();

  const porAluno = new Map<string, { origem: string; status: string; data_vencimento: string }[]>();
  for (const lote of emLotes(alunoIds, LOTE_IDS_FINANCEIRO)) {
    const { data, error } = await supabase
      .from("cobrancas")
      .select("aluno_id, origem, status, data_vencimento")
      .in("aluno_id", lote)
      .gte("data_vencimento", inicioMes)
      .lte("data_vencimento", fimMes);

    if (error) throw error;

    for (const row of data ?? []) {
      const lista = porAluno.get(row.aluno_id as string) ?? [];
      lista.push({
        origem: row.origem as string,
        status: row.status as string,
        data_vencimento: row.data_vencimento as string,
      });
      porAluno.set(row.aluno_id as string, lista);
    }
  }

  for (const [alunoId, cobrancas] of Array.from(porAluno)) {
    const status = derivarStatusFinanceiroMes(cobrancas, hoje);
    if (status !== null) resultado.set(alunoId, status);
  }

  return resultado;
}

// PostgREST corta em max_rows=1000 por padrão (supabase/config.toml) —
// range(0, 100000) NUNCA de fato traz mais que 1000 linhas, então uma escola
// com mais de 1000 alunos cadastrados no total perderia gente silenciosamente
// no filtro financeiro. Pagina de verdade em loop, mesmo padrão de
// `carregarPendentes` (src/lib/conciliacao/carregar-pendentes.ts): concatena
// páginas de `LOTE` até uma vir vazia ou menor que o lote.
const LOTE_CANDIDATOS = 1000;

async function buscarTodosCandidatos(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  filters: StudentFilters | undefined
): Promise<NonNullable<Awaited<ReturnType<typeof runStudentsQuery>>["data"]>> {
  const todos: NonNullable<Awaited<ReturnType<typeof runStudentsQuery>>["data"]> = [];
  let offset = 0;

  for (;;) {
    const { data, error } = await runStudentsQuery(
      supabase,
      { ...filters, financeiro: undefined },
      offset,
      offset + LOTE_CANDIDATOS - 1
    );
    if (error) throw error;

    const pagina = data ?? [];
    todos.push(...pagina);

    if (pagina.length < LOTE_CANDIDATOS) break;
    offset += LOTE_CANDIDATOS;
  }

  return todos;
}

export async function listStudents(filters?: StudentFilters): Promise<PaginatedStudents> {
  const supabase = await createServerClient();
  const page = Math.max(1, filters?.page ?? 1);
  const pageSize = filters?.pageSize ?? STUDENTS_PAGE_SIZE;

  if (filters?.financeiro) {
    // Filtro por status financeiro não é uma coluna — precisa resolver o
    // status derivado de TODOS os alunos que passam nos demais filtros antes
    // de paginar, senão a paginação corta o conjunto errado (mostraria linhas
    // onde só algumas batem o filtro, com contagem total errada).
    const todosIds = await buscarTodosCandidatos(supabase, filters);

    const idsCandidatos = todosIds.map((r) => r.id as string);
    const statusPorAluno = await getFinanceiroMesCorrentePorAluno(idsCandidatos);
    const idsFiltrados = idsCandidatos.filter((id) => statusPorAluno.get(id) === filters.financeiro);

    const from = (page - 1) * pageSize;
    const to = from + pageSize;
    const idsDaPagina = new Set(idsFiltrados.slice(from, to));

    const rows = todosIds.filter((r) => idsDaPagina.has(r.id as string));
    return { rows, total: idsFiltrados.length, page, pageSize };
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await runStudentsQuery(supabase, filters, from, to);
  if (error) throw error;

  return { rows: data ?? [], total: count ?? 0, page, pageSize };
}

type SegmentCountFilters = Pick<StudentFilters, "situacao" | "serieId" | "turmaId" | "anoLetivo">;

/**
 * Status de matrícula que as abas de segmento contam.
 *
 * No ano corrente conta só `ativa` — mesma regra da fonte única
 * (`contarAlunosAtivos`), para as abas somarem o mesmo número de matriculados
 * que o organograma e os KPIs do dashboard mostram. Quem concluiu ou saiu no
 * meio do ano não está mais estudando e não entra.
 *
 * Em ano já encerrado conta também `concluida`: lá, quem foi rematriculado
 * ficou com a matrícula daquele ano concluída e ainda precisa aparecer nele.
 *
 * Exportada para teste — é a regra de decisão onde um bug de contagem moraria.
 */
export function statusParaContagemDeSegmento(
  anoLetivo: number,
  anoCorrente: number = new Date().getFullYear()
): string[] {
  return anoLetivo < anoCorrente ? ["ativa", "concluida"] : ["ativa"];
}

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
      const statusAceitos = statusParaContagemDeSegmento(anoLetivo);
      matriculasDoAno = matriculasDoAno.filter((m) => statusAceitos.includes(m.status ?? ""));
    }

    if (matriculasDoAno.length === 0) {
      // Sem matrícula no ano não há segmento a atribuir. Ao listar ativos,
      // "Todos" conta só matriculados — assim a aba bate com a soma das abas
      // de segmento ao lado e com o contador do título (ambos vêm da fonte
      // única). Quem está ativo sem matrícula aparece na lista e no KPI
      // "Sem matrícula no ano", não aqui.
      // Ao pedir inativos/todos a regra é outra: ex-aluno não tem matrícula e
      // ainda precisa ser contado, senão a aba zera.
      if (querInativos && !filters?.serieId && !filters?.turmaId) counts.all += 1;
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
      matriculas(id, codigo, data_matricula, ano_letivo, idade_na_matricula, status, observacoes, cancelamento_data, cancelamento_motivo, series(nome), turmas(nome), planos(nome))
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
      foto_url,
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
      fotoUrl: student.foto_url,
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

export type AlunoAtivoAnoCorrente = {
  id: string;
  nome: string;
  matriculaCodigo: string | null;
  cpf: string | null;
  matriculaId: string;
  serieId: string;
  turmaId: string;
  anoLetivo: number;
};

export type FiltroAlunosAtivos = {
  anoLetivo?: number;
  serieId?: string;
  turmaId?: string;
  nome?: string;
};

type AlunoAtivoRow = {
  id: string;
  nome: string;
  matricula_codigo: string | null;
  cpf: string | null;
  matriculas:
    | { id: string; serie_id: string; turma_id: string; ano_letivo: number; status: string }
    | { id: string; serie_id: string; turma_id: string; ano_letivo: number; status: string }[]
    | null;
};

// Exportada (apenas para teste) para permitir cobrir a regra 527 com um fake
// mínimo de query builder, sem mockar o client Supabase inteiro — ver
// students-shared.test.ts.
export function buildAlunosAtivosQuery(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  filtro: FiltroAlunosAtivosResolvido,
  opts: { countOnly: boolean }
) {
  // A select string precisa ser IDENTICA nos dois modos: no PostgREST o join
  // com `matriculas` e declarado no proprio select, entao se countOnly trocar
  // o select para "id" os .eq("matriculas.*", ...) abaixo ficam sem relacao a
  // que se aplicar e a regra 527 (status='ativa' + ano_letivo) e ignorada.
  // `opts.countOnly` deve afetar apenas `head`, nunca o conteudo do select.
  let query = supabase
    .from("alunos")
    .select(
      "id, nome, matricula_codigo, cpf, matriculas!inner(id, serie_id, turma_id, ano_letivo, status)",
      { count: "exact", head: opts.countOnly }
    )
    .eq("escola_id", DEFAULT_SCHOOL_ID)
    .eq("ativo", true)
    .eq("matriculas.status", "ativa")
    .eq("matriculas.ano_letivo", filtro.anoLetivo);

  if (filtro.serieId) query = query.eq("matriculas.serie_id", filtro.serieId);
  if (filtro.turmaId) query = query.eq("matriculas.turma_id", filtro.turmaId);
  if (filtro.nomeNormalizado) query = query.ilike("nome_normalizado", `%${filtro.nomeNormalizado}%`);
  if (!opts.countOnly) query = query.order("nome");

  return query;
}

/**
 * Fonte única: alunos com `ativo=true` e matrícula `status='ativa'` no ano
 * letivo informado (ou corrente). Base de todo KPI/contagem "oficial" do
 * sistema — a regra "527". Não usar para telas que precisam ver aluno ativo
 * sem matrícula no ano (ver `listStudents`) nem para o combo de nova
 * matrícula (ver `getAlunosSemMatriculaNoAno`).
 */
export async function getAlunosAtivosAnoCorrente(
  filtro?: FiltroAlunosAtivos
): Promise<AlunoAtivoAnoCorrente[]> {
  const supabase = await createServerClient();
  const resolvido = montarFiltroAlunosAtivos(filtro ?? {});
  const { data, error } = await buildAlunosAtivosQuery(supabase, resolvido, { countOnly: false });
  if (error) throw error;

  return ((data ?? []) as unknown as AlunoAtivoRow[]).map((row) => {
    const matricula = Array.isArray(row.matriculas) ? row.matriculas[0] : row.matriculas;
    return {
      id: row.id,
      nome: row.nome,
      matriculaCodigo: row.matricula_codigo,
      cpf: row.cpf,
      matriculaId: matricula?.id ?? "",
      serieId: matricula?.serie_id ?? "",
      turmaId: matricula?.turma_id ?? "",
      anoLetivo: matricula?.ano_letivo ?? resolvido.anoLetivo,
    };
  });
}

/**
 * Mesma base de `getAlunosAtivosAnoCorrente`, mas devolve só a contagem
 * (`head: true`) — evita trazer linhas quando só o número importa.
 */
export async function contarAlunosAtivos(
  filtro?: Omit<FiltroAlunosAtivos, "nome">
): Promise<number> {
  const supabase = await createServerClient();
  const resolvido = montarFiltroAlunosAtivos(filtro ?? {});
  const { count, error } = await buildAlunosAtivosQuery(supabase, resolvido, { countOnly: true });
  if (error) throw error;
  return count ?? 0;
}

/**
 * Universo do combo de NOVA matrícula/rematrícula: alunos `ativo=true` que
 * NÃO têm matrícula `status='ativa'` no ano letivo informado — quem ainda
 * pode ser matriculado nesse ano. Sem esta função, o combo alinhado à regra
 * 527 ficaria vazio para quem ainda não tem matrícula no ano (caso comum:
 * matricular aluno novo ou reativar aluno com lacuna de anos).
 */
export async function getAlunosSemMatriculaNoAno(
  anoLetivo: number = new Date().getFullYear()
): Promise<
  {
    id: string;
    nome: string;
    matriculaCodigo: string | null;
    dataNascimento: string | null;
    matriculas: { ano_letivo: number; status: string; serie_id: string | null }[];
  }[]
> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("alunos")
    .select("id, nome, matricula_codigo, data_nascimento, matriculas(ano_letivo, status, serie_id)")
    .eq("escola_id", DEFAULT_SCHOOL_ID)
    .eq("ativo", true)
    .order("nome");
  if (error) throw error;

  return (data ?? [])
    .filter((row) =>
      alunoSemMatriculaAtivaNoAno(
        (row.matriculas ?? []) as { ano_letivo: number; status: string }[],
        anoLetivo
      )
    )
    .map((row) => ({
      id: row.id,
      nome: row.nome,
      matriculaCodigo: row.matricula_codigo,
      dataNascimento: row.data_nascimento,
      matriculas: (row.matriculas ?? []) as { ano_letivo: number; status: string; serie_id: string | null }[],
    }));
}
