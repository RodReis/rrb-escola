import { createServerClient } from "@/lib/supabase/server";
import type {
  EscalaRow, GrupoRow, QuestaoDetalhe, QuestaoLinha, QuestionarioDetalhe, QuestionarioRow, SecaoRow,
  AssociacaoRow, TurmaOpcao,
} from "@/lib/questionario/tipos";
import type { QuestaoTipo } from "@/lib/validation/questionario";

const porOrdem = <T extends { ordem: number }>(itens: T[] | null) =>
  [...(itens ?? [])].sort((a, b) => a.ordem - b.ordem);

export async function listarGrupos(): Promise<GrupoRow[]> {
  const db = await createServerClient();
  const { data, error } = await db
    .from("questao_grupos")
    .select("id, codigo, descricao, ativo")
    .order("descricao");
  if (error) throw error;
  return (data ?? []) as GrupoRow[];
}

type EscalaBruta = {
  id: string;
  descricao: string;
  ativo: boolean;
  escala_opcoes: Array<{ rotulo: string; ordem: number }> | null;
};

export async function listarEscalas(): Promise<EscalaRow[]> {
  const db = await createServerClient();
  const { data, error } = await db
    .from("escalas")
    .select("id, descricao, ativo, escala_opcoes(rotulo, ordem)")
    .order("descricao");
  if (error) throw error;
  return ((data ?? []) as EscalaBruta[]).map((e) => ({
    id: e.id,
    descricao: e.descricao,
    ativo: e.ativo,
    opcoes: porOrdem(e.escala_opcoes).map((o) => o.rotulo),
  }));
}

type QuestaoBruta = {
  id: string;
  tipo: QuestaoTipo;
  pergunta: string;
  ativa: boolean;
  grupo_id: string;
  escala_id: string | null;
  questao_grupos: { descricao: string } | Array<{ descricao: string }> | null;
  escalas: { descricao: string } | Array<{ descricao: string }> | null;
};

export async function listarQuestoes(): Promise<QuestaoLinha[]> {
  const db = await createServerClient();
  const { data, error } = await db
    .from("questoes")
    .select("id, tipo, pergunta, ativa, grupo_id, escala_id, questao_grupos(descricao), escalas(descricao)")
    .order("created_at");
  if (error) throw error;
  return ((data ?? []) as QuestaoBruta[]).map((q) => {
    const grupo = Array.isArray(q.questao_grupos) ? q.questao_grupos[0] : q.questao_grupos;
    const escala = Array.isArray(q.escalas) ? q.escalas[0] : q.escalas;
    return {
      id: q.id,
      tipo: q.tipo,
      pergunta: q.pergunta,
      ativa: q.ativa,
      grupoId: q.grupo_id,
      grupoDescricao: grupo?.descricao ?? "",
      escalaId: q.escala_id,
      escalaDescricao: escala?.descricao ?? null,
    };
  });
}

type QuestaoDetalheBruta = {
  id: string;
  grupo_id: string;
  tipo: QuestaoTipo;
  pergunta: string;
  ativa: boolean;
  obrigatoria: boolean;
  limitar_caracteres: boolean;
  qtde_caracteres: number;
  qtde_linhas: number;
  escala_id: string | null;
  questao_alternativas: Array<{ rotulo: string; ordem: number }> | null;
};

export async function getQuestao(id: string): Promise<QuestaoDetalhe | null> {
  const db = await createServerClient();
  const { data, error } = await db
    .from("questoes")
    .select(
      "id, grupo_id, tipo, pergunta, ativa, obrigatoria, limitar_caracteres, qtde_caracteres, qtde_linhas, escala_id, questao_alternativas(rotulo, ordem)",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const { count, error: erroUso } = await db
    .from("questionario_questoes")
    .select("id", { count: "exact", head: true })
    .eq("questao_id", id);
  if (erroUso) throw erroUso;

  const q = data as QuestaoDetalheBruta;
  return {
    id: q.id,
    grupoId: q.grupo_id,
    tipo: q.tipo,
    pergunta: q.pergunta,
    ativa: q.ativa,
    obrigatoria: q.obrigatoria,
    limitarCaracteres: q.limitar_caracteres,
    qtdeCaracteres: q.qtde_caracteres,
    qtdeLinhas: q.qtde_linhas,
    alternativas: porOrdem(q.questao_alternativas).map((a) => a.rotulo),
    escalaId: q.escala_id,
    emUso: (count ?? 0) > 0,
  };
}

export async function listarQuestionarios(): Promise<QuestionarioRow[]> {
  const db = await createServerClient();
  const { data, error } = await db.from("questionarios").select("id, descricao, ativo").order("descricao");
  if (error) throw error;
  return (data ?? []) as QuestionarioRow[];
}

type QuestionarioBruto = {
  id: string;
  descricao: string;
  observacoes: string | null;
  ativo: boolean;
  questionario_questoes: Array<{ id: string; questao_id: string; escala_id: string | null; ordem: number }> | null;
};

export async function getQuestionario(id: string): Promise<QuestionarioDetalhe | null> {
  const db = await createServerClient();
  const { data, error } = await db
    .from("questionarios")
    .select("id, descricao, observacoes, ativo, questionario_questoes(id, questao_id, escala_id, ordem)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const q = data as QuestionarioBruto;
  return {
    id: q.id,
    descricao: q.descricao,
    observacoes: q.observacoes,
    ativo: q.ativo,
    vinculos: porOrdem(q.questionario_questoes).map((v) => ({
      id: v.id,
      questaoId: v.questao_id,
      escalaId: v.escala_id,
    })),
  };
}

export async function listarSecoes(): Promise<SecaoRow[]> {
  const db = await createServerClient();
  const { data, error } = await db
    .from("ficha_secoes")
    .select("id, codigo, descricao, permite_lancamento_coletivo, ativo")
    .order("descricao");
  if (error) throw error;
  return ((data ?? []) as Array<{
    id: string;
    codigo: number;
    descricao: string;
    permite_lancamento_coletivo: boolean;
    ativo: boolean;
  }>).map((s) => ({
    id: s.id,
    codigo: s.codigo,
    descricao: s.descricao,
    permiteLancamentoColetivo: s.permite_lancamento_coletivo,
    ativo: s.ativo,
  }));
}

type Um<T> = T | T[] | null;
const um = <T>(v: Um<T>): T | null => (Array.isArray(v) ? v[0] ?? null : v);

type TurmaBruta = {
  id: string;
  nome: string;
  turno: string;
  ano_letivo: number;
  ativo: boolean;
  serie_id: string;
  series: Um<{ nome: string; ordem: number }>;
};

/** Turmas com a série, para o formulário e os filtros da Associação. */
export async function listarTurmasOpcoes(): Promise<TurmaOpcao[]> {
  const db = await createServerClient();
  const { data, error } = await db
    .from("turmas")
    .select("id, nome, turno, ano_letivo, ativo, serie_id, series(nome, ordem)")
    .order("ano_letivo", { ascending: false })
    .order("nome");
  if (error) throw error;
  return ((data ?? []) as TurmaBruta[]).map((t) => {
    const serie = um(t.series);
    return {
      id: t.id,
      nome: t.nome,
      turno: t.turno,
      anoLetivo: t.ano_letivo,
      ativo: t.ativo,
      serieId: t.serie_id,
      serieNome: serie?.nome ?? "",
      serieOrdem: serie?.ordem ?? 0,
    };
  });
}

type AssociacaoBruta = {
  id: string;
  ativo: boolean;
  etapa: number;
  questionario_id: string;
  turma_id: string;
  professor_id: string;
  questionarios: Um<{ descricao: string }>;
  turmas: Um<{
    nome: string;
    turno: string;
    ano_letivo: number;
    serie_id: string;
    series: Um<{ nome: string }>;
  }>;
  employees: Um<{ name: string }>;
};

export async function listarAssociacoes(): Promise<AssociacaoRow[]> {
  const db = await createServerClient();
  const { data, error } = await db
    .from("questionario_associacoes")
    .select(
      "id, ativo, etapa, questionario_id, turma_id, professor_id, questionarios(descricao), turmas(nome, turno, ano_letivo, serie_id, series(nome)), employees(name)",
    )
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as AssociacaoBruta[]).map((a) => {
    const turma = um(a.turmas);
    return {
      id: a.id,
      ativo: a.ativo,
      etapa: a.etapa,
      questionarioId: a.questionario_id,
      questionarioDescricao: um(a.questionarios)?.descricao ?? "",
      turmaId: a.turma_id,
      turmaNome: turma?.nome ?? "",
      turno: turma?.turno ?? "",
      anoLetivo: turma?.ano_letivo ?? 0,
      serieId: turma?.serie_id ?? "",
      serieNome: um(turma?.series ?? null)?.nome ?? "",
      professorId: a.professor_id,
      professorNome: um(a.employees)?.name ?? "",
    };
  });
}
