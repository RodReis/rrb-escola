"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/session";
import { DEFAULT_SCHOOL_ID } from "@/lib/constants";
import { getHistoricoAluno } from "@/lib/data/historico";
import { deveCongelar } from "@/lib/historico/congelamento";
import { validarNovaAssociacao } from "@/lib/historico/associacoes";
import { agregarNotasConsolidadas } from "@/lib/historico/medias";
import type { HistoricoData, NivelEnsino, OrigemHistorico, ResultadoHistorico } from "@/lib/historico/tipos";
import { createServerClient } from "@/lib/supabase/server";
import { formNumber, formText } from "@/lib/utils";

async function garantirHistorico(alunoId: string, nivel: NivelEnsino): Promise<string> {
  const supabase = await createServerClient();
  const { data: existente, error: erroBusca } = await supabase
    .from("historico_escolar")
    .select("id")
    .eq("escola_id", DEFAULT_SCHOOL_ID)
    .eq("aluno_id", alunoId)
    .eq("nivel", nivel)
    .maybeSingle();
  if (erroBusca) throw erroBusca;
  if (existente) return existente.id as string;

  const { data: criado, error: erroCriacao } = await supabase
    .from("historico_escolar")
    .insert({ escola_id: DEFAULT_SCHOOL_ID, aluno_id: alunoId, nivel })
    .select("id")
    .single();
  if (erroCriacao) throw erroCriacao;
  return criado.id as string;
}

export async function salvarObservacaoAction(formData: FormData) {
  await requirePermission("historico", "update");
  const alunoId = formText(formData, "alunoId");
  const nivel = formText(formData, "nivel") as NivelEnsino;
  if (!alunoId || !nivel) return;

  const historicoId = await garantirHistorico(alunoId, nivel);
  const supabase = await createServerClient();
  const { error } = await supabase
    .from("historico_escolar")
    .update({ observacoes: formText(formData, "observacoes") })
    .eq("id", historicoId);
  if (error) throw error;

  revalidatePath("/historico/notas");
}

/**
 * Grava um ano do histórico. Se o resultado final congela o ano interno,
 * copia as médias calculadas para historico_notas — a partir daí o ano não
 * recalcula mais.
 */
export async function salvarAnoHistoricoAction(formData: FormData) {
  await requirePermission("historico", "update");
  const alunoId = formText(formData, "alunoId");
  const nivel = formText(formData, "nivel") as NivelEnsino;
  const ano = formNumber(formData, "ano");
  const serieNome = formText(formData, "serieNome");
  const origem = (formText(formData, "origem") ?? "externa") as OrigemHistorico;
  const resultado = (formText(formData, "resultado") ?? "cursando") as ResultadoHistorico;
  if (!alunoId || !nivel || !ano || !serieNome) return;

  const historicoId = await garantirHistorico(alunoId, nivel);
  const congelado = deveCongelar(resultado, origem);
  const supabase = await createServerClient();

  const { data: anoRow, error } = await supabase
    .from("historico_anos")
    .upsert(
      {
        historico_id: historicoId,
        ano,
        serie_id: formText(formData, "serieId") || null,
        serie_nome: serieNome,
        origem,
        instituicao: formText(formData, "instituicao") || null,
        cidade: formText(formData, "cidade") || null,
        uf: formText(formData, "uf") || null,
        resultado,
        media_aprovacao: formNumber(formData, "mediaAprovacao"),
        carga_horaria: formNumber(formData, "cargaHoraria"),
        dias_letivos: formNumber(formData, "diasLetivos"),
        faltas: formNumber(formData, "faltas"),
        percentual_frequencia: formNumber(formData, "percentualFrequencia"),
        congelado
      },
      { onConflict: "historico_id,ano" }
    )
    .select("id")
    .single();
  if (error) throw error;

  if (congelado && origem === "interna") {
    await congelarNotasDoAno(anoRow.id as string, alunoId, ano);
  }

  revalidatePath("/historico/notas");
}

/** Copia as médias calculadas de notas_consolidadas para historico_notas. */
async function congelarNotasDoAno(historicoAnoId: string, alunoId: string, ano: number) {
  const supabase = await createServerClient();

  const { data: jaTem, error: erroJaTem } = await supabase
    .from("historico_notas")
    .select("id")
    .eq("historico_ano_id", historicoAnoId)
    .limit(1);
  if (erroJaTem) throw erroJaTem;
  if ((jaTem ?? []).length > 0) return;

  const { data, error } = await supabase
    .from("notas_consolidadas")
    .select("disciplina_id, media, disciplinas(nome, ordem)")
    .eq("escola_id", DEFAULT_SCHOOL_ID)
    .eq("aluno_id", alunoId)
    .eq("ano_letivo", ano);
  if (error) throw error;

  const notas = agregarNotasConsolidadas(
    (data ?? []).map((row) => ({
      disciplina_id: row.disciplina_id as string,
      media: row.media === null ? null : Number(row.media),
      disciplinas: row.disciplinas as { nome?: string; ordem?: number } | null
    }))
  );

  const linhas = notas.map((n, i) => ({
    historico_ano_id: historicoAnoId,
    disciplina_id: n.disciplinaId,
    disciplina_nome: n.disciplinaNome,
    nota: n.nota,
    ordem: i
  }));
  if (linhas.length === 0) return;

  const { error: erroInsert } = await supabase.from("historico_notas").insert(linhas);
  if (erroInsert) throw erroInsert;
}

export async function removerAnoHistoricoAction(formData: FormData) {
  await requirePermission("historico", "delete");
  const id = formText(formData, "id");
  if (!id) return;
  const supabase = await createServerClient();
  const { error } = await supabase.from("historico_anos").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/historico/notas");
}

/** Substitui as notas de um ano congelado/externo pelas linhas enviadas. */
export async function salvarNotasAnoAction(formData: FormData) {
  await requirePermission("historico", "update");
  const historicoAnoId = formText(formData, "historicoAnoId");
  const payload = formText(formData, "notas");
  if (!historicoAnoId || !payload) return;

  const notas = JSON.parse(payload) as Array<{
    disciplinaId: string | null;
    disciplinaNome: string;
    nota: number | null;
    cargaHoraria: number | null;
    faltas: number | null;
  }>;

  const supabase = await createServerClient();
  const { error: erroDelete } = await supabase
    .from("historico_notas")
    .delete()
    .eq("historico_ano_id", historicoAnoId);
  if (erroDelete) throw erroDelete;

  const linhas = notas
    .filter((n) => n.disciplinaNome.trim() !== "")
    .map((n, i) => ({
      historico_ano_id: historicoAnoId,
      disciplina_id: n.disciplinaId,
      disciplina_nome: n.disciplinaNome.trim(),
      nota: n.nota,
      carga_horaria: n.cargaHoraria,
      faltas: n.faltas,
      ordem: i
    }));
  if (linhas.length > 0) {
    const { error } = await supabase.from("historico_notas").insert(linhas);
    if (error) throw error;
  }

  revalidatePath("/historico/notas");
}

export async function salvarAssociacaoAction(formData: FormData) {
  await requirePermission("historico", "create");
  const serieId = formText(formData, "serieId");
  const credenciamentoId = formText(formData, "credenciamentoId");
  const nivel = formText(formData, "nivel") as NivelEnsino;
  const anoInicio = formNumber(formData, "anoInicio");
  const anoFim = formNumber(formData, "anoFim");
  if (!serieId || !credenciamentoId || !nivel || !anoInicio || !anoFim) return;

  const supabase = await createServerClient();
  const { data: existentes, error: erroBusca } = await supabase
    .from("historico_niveis_ensino")
    .select("ano_inicio, ano_fim")
    .eq("escola_id", DEFAULT_SCHOOL_ID)
    .eq("serie_id", serieId);
  if (erroBusca) throw erroBusca;

  const validacao = validarNovaAssociacao(
    { anoInicio, anoFim },
    (existentes ?? []).map((e) => ({ anoInicio: e.ano_inicio as number, anoFim: e.ano_fim as number }))
  );
  if (!validacao.ok) {
    throw new Error(
      `Já existe associação para esta série no período ${validacao.conflito.anoInicio}–${validacao.conflito.anoFim}.`
    );
  }

  const { error } = await supabase.from("historico_niveis_ensino").insert({
    escola_id: DEFAULT_SCHOOL_ID,
    serie_id: serieId,
    credenciamento_id: credenciamentoId,
    nivel,
    ano_inicio: anoInicio,
    ano_fim: anoFim
  });
  if (error) throw error;

  revalidatePath("/historico/associacoes");
}

export async function removerAssociacaoAction(formData: FormData) {
  await requirePermission("historico", "delete");
  const id = formText(formData, "id");
  if (!id) return;
  const supabase = await createServerClient();
  const { error } = await supabase
    .from("historico_niveis_ensino")
    .delete()
    .eq("id", id)
    .eq("escola_id", DEFAULT_SCHOOL_ID);
  if (error) throw error;
  revalidatePath("/historico/associacoes");
}

/** Carrega os HistoricoData dos alunos selecionados para o gerador de PDF no cliente. */
export async function carregarHistoricosAction(
  alunoIds: string[],
  nivel: NivelEnsino
): Promise<HistoricoData[]> {
  await requirePermission("historico", "read");
  const historicos = await Promise.all(alunoIds.map((id) => getHistoricoAluno(id, nivel)));
  return historicos.filter((h): h is HistoricoData => h !== null);
}
