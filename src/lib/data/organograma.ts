// src/lib/data/organograma.ts
import { createServerClient } from "@/lib/supabase/server";
import { DEFAULT_SCHOOL_ID } from "@/lib/constants";

export async function getOrganogramaTree(anoLetivo: number = new Date().getFullYear()) {
  const supabase = await createServerClient();

  const { data: segmentos, error: segErr } = await supabase
    .from("segmentos")
    .select("id, nome, ordem")
    .eq("escola_id", DEFAULT_SCHOOL_ID)
    .eq("ativo", true)
    .order("ordem");

  if (segErr) throw segErr;

  const { data: series, error: serErr } = await supabase
    .from("series")
    .select("id, nome, ordem, segmento_id")
    .eq("escola_id", DEFAULT_SCHOOL_ID)
    .not("segmento_id", "is", null)
    .order("ordem");

  if (serErr) throw serErr;

  const { data: turmas, error: turErr } = await supabase
    .from("turmas")
    .select("id, nome, serie_id")
    .eq("escola_id", DEFAULT_SCHOOL_ID)
    .eq("ano_letivo", anoLetivo)
    .order("nome");

  if (turErr) throw turErr;

  const { data: matriculas, error: matErr } = await supabase
    .from("matriculas")
    .select("turma_id")
    .eq("escola_id", DEFAULT_SCHOOL_ID)
    .eq("ano_letivo", anoLetivo)
    .eq("status", "ativa");

  if (matErr) throw matErr;

  const countByTurma = new Map<string, number>();
  for (const m of matriculas ?? []) {
    if (m.turma_id) {
      countByTurma.set(m.turma_id, (countByTurma.get(m.turma_id) ?? 0) + 1);
    }
  }

  const serieBySegmento = new Map<string, typeof series>();
  for (const s of series ?? []) {
    if (!s.segmento_id) continue;
    const arr = serieBySegmento.get(s.segmento_id) ?? [];
    arr.push(s);
    serieBySegmento.set(s.segmento_id, arr);
  }

  const turmasBySerie = new Map<string, Array<{ id: string; nome: string; alunos: number }>>();
  for (const t of turmas ?? []) {
    if (!t.serie_id) continue;  // null guard
    const arr = turmasBySerie.get(t.serie_id) ?? [];
    arr.push({ id: t.id, nome: t.nome, alunos: countByTurma.get(t.id) ?? 0 });
    turmasBySerie.set(t.serie_id, arr);
  }

  const tree = (segmentos ?? []).map((seg) => {
    const segs = serieBySegmento.get(seg.id) ?? [];
    const turmasDoSegmento = segs.flatMap((s) =>
      (turmasBySerie.get(s.id) ?? []).map((t) => ({
        ...t,
        serieNome: s.nome
      }))
    );
    return {
      id: seg.id,
      nome: seg.nome,
      alunos: turmasDoSegmento.reduce((sum, t) => sum + t.alunos, 0),
      turmas: turmasDoSegmento
    };
  });

  const totalAlunos = tree.reduce((sum, seg) => sum + seg.alunos, 0);

  return { tree, totalAlunos };
}

export async function getOrganogramaDrill(turmaId: string, anoLetivo: number = new Date().getFullYear()) {
  const supabase = await createServerClient();
  const now = new Date(Date.now() - 3 * 60 * 60 * 1000);
  const competencia = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;

  const { data: matriculas, error: matErr } = await supabase
    .from("matriculas")
    .select("id, aluno_id, alunos(id, nome, matricula_codigo), turmas(id, nome, series(nome, segmentos(nome)))")
    .eq("turma_id", turmaId)
    .eq("escola_id", DEFAULT_SCHOOL_ID)
    .eq("status", "ativa")
    .eq("ano_letivo", anoLetivo)
    .order("alunos(nome)");

  if (matErr) throw matErr;

  if (!matriculas || matriculas.length === 0) {
    return { turma: null, alunos: [], somaSala: 0, ticketMedio: 0, competencia };
  }

  const alunoIds = matriculas.map((m) => m.aluno_id).filter(Boolean) as string[];

  const { data: cobrancas, error: cobErr } = await supabase
    .from("cobrancas")
    .select("aluno_id, valor_final")
    .eq("escola_id", DEFAULT_SCHOOL_ID)
    .eq("competencia", competencia)
    .neq("status", "cancelada")
    .in("aluno_id", alunoIds);

  if (cobErr) throw cobErr;

  const valorByAluno = new Map<string, number>();
  for (const c of cobrancas ?? []) {
    if (c.aluno_id) valorByAluno.set(c.aluno_id, Number(c.valor_final ?? 0));
  }

  const { data: responsaveis, error: respErr } = await supabase
    .from("responsaveis_aluno")
    .select("aluno_id, nome")
    .eq("responsavel_financeiro", true)
    .in("aluno_id", alunoIds);

  if (respErr) throw respErr;

  const respByAluno = new Map<string, string>();
  for (const r of responsaveis ?? []) {
    if (r.aluno_id && !respByAluno.has(r.aluno_id)) {
      respByAluno.set(r.aluno_id, r.nome);
    }
  }

  const alunosList = matriculas.map((m) => {
    const aluno = Array.isArray(m.alunos) ? m.alunos[0] : m.alunos;
    return {
      id: aluno?.id ?? "",
      nome: aluno?.nome ?? "",
      respFinanceiro: respByAluno.get(aluno?.id ?? "") ?? null,
      mensalidade: valorByAluno.get(aluno?.id ?? "") ?? null
    };
  });

  const somaSala = alunosList.reduce((sum, a) => sum + (a.mensalidade ?? 0), 0);
  const ticketMedio = alunosList.length > 0 ? somaSala / alunosList.length : 0;

  const primeiraMatricula = matriculas[0];
  const turmaInfo = Array.isArray(primeiraMatricula.turmas)
    ? primeiraMatricula.turmas[0]
    : primeiraMatricula.turmas;
  const turmaInfoAny = turmaInfo as unknown as { series: unknown } | null;
  const seriesRaw = turmaInfoAny?.series;
  const serieInfo = seriesRaw
    ? (Array.isArray(seriesRaw)
        ? (seriesRaw as Array<{ nome: string; segmentos: unknown }>)[0]
        : (seriesRaw as { nome: string; segmentos: unknown }))
    : null;
  const segmentoInfo = serieInfo
    ? (Array.isArray(serieInfo.segmentos)
        ? (serieInfo as { nome: string; segmentos: Array<{ nome: string }> }).segmentos[0]
        : (serieInfo as { nome: string; segmentos: { nome: string } }).segmentos)
    : null;

  return {
    turma: {
      id: turmaId,
      nome: turmaInfo?.nome ?? "",
      serieNome: serieInfo?.nome ?? "",
      segmentoNome: (segmentoInfo as { nome: string } | null)?.nome ?? ""
    },
    alunos: alunosList,
    somaSala,
    ticketMedio,
    competencia
  };
}
