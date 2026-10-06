import { createServerClient } from "@/lib/supabase/server";
import type {
  EscalaRow, GrupoRow, QuestaoDetalhe, QuestaoLinha, QuestionarioDetalhe, QuestionarioRow,
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
  questao_grupos: { descricao: string } | Array<{ descricao: string }> | null;
};

export async function listarQuestoes(): Promise<QuestaoLinha[]> {
  const db = await createServerClient();
  const { data, error } = await db
    .from("questoes")
    .select("id, tipo, pergunta, ativa, grupo_id, questao_grupos(descricao)")
    .order("created_at");
  if (error) throw error;
  return ((data ?? []) as QuestaoBruta[]).map((q) => {
    const grupo = Array.isArray(q.questao_grupos) ? q.questao_grupos[0] : q.questao_grupos;
    return {
      id: q.id,
      tipo: q.tipo,
      pergunta: q.pergunta,
      ativa: q.ativa,
      grupoId: q.grupo_id,
      grupoDescricao: grupo?.descricao ?? "",
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
  questao_alternativas: Array<{ rotulo: string; ordem: number }> | null;
};

export async function getQuestao(id: string): Promise<QuestaoDetalhe | null> {
  const db = await createServerClient();
  const { data, error } = await db
    .from("questoes")
    .select(
      "id, grupo_id, tipo, pergunta, ativa, obrigatoria, limitar_caracteres, qtde_caracteres, qtde_linhas, questao_alternativas(rotulo, ordem)",
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
