import { createServerClient } from "@/lib/supabase/server";
import { DEFAULT_SCHOOL_ID } from "@/lib/constants";

export type EvasaoData = {
  ativos: number;
  cancelados: number;
  transferidos: number;
  concluidos: number;
  taxaEvasao: number; // (cancelados+transferidos) / total
  porMes: Array<{ mes: string; cancelados: number; transferidos: number }>;
};

export type FrequenciaHeatmapPonto = {
  data: string;
  presentes: number;
  faltas: number;
  taxa: number;
};

export type FrequenciaDetalhada = {
  heatmap: FrequenciaHeatmapPonto[];
  topFaltosos: Array<{
    alunoId: string;
    nome: string;
    turma: string;
    faltas: number;
    presencas: number;
    taxa: number;
  }>;
};

export type MediaDisciplinaRow = {
  disciplinaId: string;
  disciplina: string;
  serie: string;
  bimestre: number;
  media: number | null;
  totalAvaliacoes: number;
  totalNotas: number;
  totalAlunos: number;
};

export type PedagogicoSummary = {
  totalDisciplinas: number;
  totalAvaliacoes: number;
  totalNotasLancadas: number;
  aprovados: number; // media >= 6
  reprovados: number; // media < 6
};

function pickOne<T>(v: T | T[] | null | undefined): T | null {
  return Array.isArray(v) ? v[0] ?? null : v ?? null;
}

export async function getEvasao(
  escolaId: string = DEFAULT_SCHOOL_ID,
  anoLetivo: number = new Date().getFullYear()
): Promise<EvasaoData> {
  const supabase = await createServerClient();

  const { data } = await supabase
    .from("matriculas")
    .select("status, updated_at")
    .eq("escola_id", escolaId)
    .eq("ano_letivo", anoLetivo);

  let ativos = 0, cancelados = 0, transferidos = 0, concluidos = 0;
  const porMesMap = new Map<string, { cancelados: number; transferidos: number }>();

  for (const r of (data ?? []) as Array<{ status: string; updated_at: string }>) {
    if (r.status === "ativa") ativos++;
    else if (r.status === "cancelada") cancelados++;
    else if (r.status === "transferida") transferidos++;
    else if (r.status === "concluida") concluidos++;

    if (r.status === "cancelada" || r.status === "transferida") {
      const mes = String(r.updated_at).slice(0, 7);
      const acc = porMesMap.get(mes) ?? { cancelados: 0, transferidos: 0 };
      if (r.status === "cancelada") acc.cancelados++;
      else acc.transferidos++;
      porMesMap.set(mes, acc);
    }
  }

  const total = ativos + cancelados + transferidos + concluidos;
  const evasivos = cancelados + transferidos;

  const porMes = Array.from(porMesMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([mes, c]) => ({ mes, ...c }));

  return {
    ativos,
    cancelados,
    transferidos,
    concluidos,
    taxaEvasao: total > 0 ? evasivos / total : 0,
    porMes,
  };
}

export async function getFrequenciaDetalhada(
  escolaId: string = DEFAULT_SCHOOL_ID,
  days: number = 60
): Promise<FrequenciaDetalhada> {
  const supabase = await createServerClient();
  const hoje = new Date();
  const desde = new Date(hoje);
  desde.setDate(desde.getDate() - days);
  const desdeStr = desde.toISOString().slice(0, 10);
  const hojeStr = hoje.toISOString().slice(0, 10);

  const { data: freqs } = await supabase
    .from("frequencias")
    .select("data_aula, presente, aluno_id, alunos(nome), matriculas(turmas(nome))")
    .eq("escola_id", escolaId)
    .gte("data_aula", desdeStr)
    .lte("data_aula", hojeStr);

  // Heatmap por dia
  const porDia = new Map<string, { p: number; f: number }>();
  // Top faltosos
  const porAluno = new Map<string, { nome: string; turma: string; p: number; f: number }>();

  for (const r of ((freqs ?? []) as any[])) {
    const dia = porDia.get(r.data_aula) ?? { p: 0, f: 0 };
    if (r.presente) dia.p++;
    else dia.f++;
    porDia.set(r.data_aula, dia);

    const aluno = pickOne(r.alunos);
    const matricula = pickOne(r.matriculas);
    const turma = pickOne(matricula?.turmas);
    const acc = porAluno.get(r.aluno_id) ?? {
      nome: aluno?.nome ?? "—",
      turma: turma?.nome ?? "—",
      p: 0,
      f: 0,
    };
    if (r.presente) acc.p++;
    else acc.f++;
    porAluno.set(r.aluno_id, acc);
  }

  const heatmap: FrequenciaHeatmapPonto[] = Array.from(porDia.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([data, c]) => ({
      data,
      presentes: c.p,
      faltas: c.f,
      taxa: c.p + c.f > 0 ? c.p / (c.p + c.f) : 0,
    }));

  const topFaltosos = Array.from(porAluno.entries())
    .map(([alunoId, v]) => ({
      alunoId,
      nome: v.nome,
      turma: v.turma,
      faltas: v.f,
      presencas: v.p,
      taxa: v.p + v.f > 0 ? v.p / (v.p + v.f) : 0,
    }))
    .filter((a) => a.faltas > 0)
    .sort((a, b) => b.faltas - a.faltas)
    .slice(0, 10);

  return { heatmap, topFaltosos };
}

export async function getMediasPorDisciplina(
  escolaId: string = DEFAULT_SCHOOL_ID,
  anoLetivo: number = new Date().getFullYear()
): Promise<MediaDisciplinaRow[]> {
  const supabase = await createServerClient();

  const { data } = await supabase
    .from("notas_consolidadas")
    .select("disciplina_id, bimestre, media, total_avaliacoes, notas_lancadas, matricula_id")
    .eq("escola_id", escolaId)
    .eq("ano_letivo", anoLetivo);

  if (!data || data.length === 0) return [];

  // Agrega por disciplina × bimestre
  type Acc = { somaMedias: number; alunosComMedia: number; totalAlunos: number; avaliacoes: number; notas: number };
  const agg = new Map<string, Acc>();

  for (const r of data as any[]) {
    const key = `${r.disciplina_id}__${r.bimestre}`;
    const acc = agg.get(key) ?? { somaMedias: 0, alunosComMedia: 0, totalAlunos: 0, avaliacoes: r.total_avaliacoes, notas: 0 };
    acc.totalAlunos++;
    if (r.media !== null && r.media !== undefined) {
      acc.somaMedias += Number(r.media);
      acc.alunosComMedia++;
    }
    acc.notas += Number(r.notas_lancadas ?? 0);
    agg.set(key, acc);
  }

  // Carrega nomes de disciplinas + series
  const disciplinaIds = Array.from(new Set(Array.from(agg.keys()).map((k) => k.split("__")[0])));
  if (disciplinaIds.length === 0) return [];

  const { data: disciplinas } = await supabase
    .from("disciplinas")
    .select("id, nome, series(nome)")
    .in("id", disciplinaIds);

  const dispMap = new Map<string, { nome: string; serie: string }>();
  for (const d of (disciplinas ?? []) as any[]) {
    const serieRel = pickOne(d.series);
    dispMap.set(d.id, { nome: d.nome, serie: serieRel?.nome ?? "—" });
  }

  const rows: MediaDisciplinaRow[] = Array.from(agg.entries()).map(([key, a]) => {
    const [disciplinaId, bimStr] = key.split("__");
    const info = dispMap.get(disciplinaId) ?? { nome: "—", serie: "—" };
    return {
      disciplinaId,
      disciplina: info.nome,
      serie: info.serie,
      bimestre: Number(bimStr),
      media: a.alunosComMedia > 0 ? a.somaMedias / a.alunosComMedia : null,
      totalAvaliacoes: a.avaliacoes,
      totalNotas: a.notas,
      totalAlunos: a.totalAlunos,
    };
  });

  rows.sort((a, b) => {
    if (a.serie !== b.serie) return a.serie.localeCompare(b.serie);
    if (a.bimestre !== b.bimestre) return a.bimestre - b.bimestre;
    return a.disciplina.localeCompare(b.disciplina);
  });

  return rows;
}

export async function getPedagogicoSummary(
  escolaId: string = DEFAULT_SCHOOL_ID,
  anoLetivo: number = new Date().getFullYear()
): Promise<PedagogicoSummary> {
  const supabase = await createServerClient();

  const [discRes, avalRes, notasRes, consolRes] = await Promise.all([
    supabase
      .from("disciplinas")
      .select("id", { count: "exact", head: true })
      .eq("escola_id", escolaId)
      .eq("ativo", true),
    supabase
      .from("avaliacoes")
      .select("id", { count: "exact", head: true })
      .eq("escola_id", escolaId)
      .eq("ano_letivo", anoLetivo),
    supabase
      .from("notas")
      .select("valor", { count: "exact" })
      .eq("escola_id", escolaId)
      .not("valor", "is", null),
    supabase
      .from("notas_consolidadas")
      .select("media")
      .eq("escola_id", escolaId)
      .eq("ano_letivo", anoLetivo)
      .not("media", "is", null),
  ]);

  let aprovados = 0;
  let reprovados = 0;
  for (const r of (consolRes.data ?? []) as Array<{ media: number | string | null }>) {
    const m = Number(r.media);
    if (Number.isFinite(m)) {
      if (m >= 6) aprovados++;
      else reprovados++;
    }
  }

  return {
    totalDisciplinas: discRes.count ?? 0,
    totalAvaliacoes: avalRes.count ?? 0,
    totalNotasLancadas: notasRes.count ?? 0,
    aprovados,
    reprovados,
  };
}
