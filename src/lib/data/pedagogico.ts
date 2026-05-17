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

export type DisciplinaRow = {
  id: string;
  serieId: string;
  serie: string;
  segmento: string;
  nome: string;
  ordem: number;
  ativo: boolean;
};

export async function listDisciplinas(
  escolaId: string = DEFAULT_SCHOOL_ID
): Promise<DisciplinaRow[]> {
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("disciplinas")
    .select("id, nome, ordem, ativo, serie_id, series(nome, segmento)")
    .eq("escola_id", escolaId)
    .order("nome");

  return ((data ?? []) as any[]).map((d) => {
    const s = pickOne(d.series);
    return {
      id: d.id,
      serieId: d.serie_id,
      serie: s?.nome ?? "—",
      segmento: s?.segmento ?? "outros",
      nome: d.nome,
      ordem: Number(d.ordem ?? 0),
      ativo: !!d.ativo,
    };
  });
}

export type AtribuicaoRow = {
  id: string;
  perfilId: string;
  professorNome: string;
  disciplinaId: string;
  disciplina: string;
  turmaId: string;
  turma: string;
  serie: string;
};

export async function listAtribuicoes(
  escolaId: string = DEFAULT_SCHOOL_ID
): Promise<AtribuicaoRow[]> {
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("professor_disciplina_turma")
    .select(`
      id, perfil_id, disciplina_id, turma_id,
      perfis(nome),
      disciplinas(nome),
      turmas(nome, series(nome))
    `)
    .eq("escola_id", escolaId);

  return ((data ?? []) as any[]).map((a) => {
    const perfil = pickOne(a.perfis);
    const disciplina = pickOne(a.disciplinas);
    const turma = pickOne(a.turmas);
    const serie = pickOne(turma?.series);
    return {
      id: a.id,
      perfilId: a.perfil_id,
      professorNome: perfil?.nome ?? "—",
      disciplinaId: a.disciplina_id,
      disciplina: disciplina?.nome ?? "—",
      turmaId: a.turma_id,
      turma: turma?.nome ?? "—",
      serie: serie?.nome ?? "—",
    };
  }).sort((x, y) => x.professorNome.localeCompare(y.professorNome, "pt-BR"));
}

export type ProfessorOption = {
  id: string;
  nome: string;
  email: string;
};

export async function listProfessores(
  escolaId: string = DEFAULT_SCHOOL_ID
): Promise<ProfessorOption[]> {
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("perfis")
    .select("id, nome, email")
    .eq("escola_id", escolaId)
    .eq("perfil", "professor")
    .eq("ativo", true)
    .order("nome");

  return ((data ?? []) as Array<{ id: string; nome: string; email: string }>);
}

export type AvaliacaoRow = {
  id: string;
  titulo: string;
  tipo: string;
  bimestre: number;
  anoLetivo: number;
  peso: number;
  valorMaximo: number;
  dataAplicacao: string | null;
  disciplinaId: string;
  disciplina: string;
  turmaId: string;
  turma: string;
  serie: string;
  totalAlunos: number;
  notasLancadas: number;
};

export async function listAvaliacoes(
  escolaId: string = DEFAULT_SCHOOL_ID,
  anoLetivo: number = new Date().getFullYear()
): Promise<AvaliacaoRow[]> {
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("avaliacoes")
    .select(`
      id, titulo, tipo, bimestre, ano_letivo, peso, valor_maximo, data_aplicacao,
      disciplina_id, disciplinas(nome),
      turma_id, turmas(nome, series(nome))
    `)
    .eq("escola_id", escolaId)
    .eq("ano_letivo", anoLetivo)
    .order("bimestre")
    .order("data_aplicacao", { ascending: false });

  if (!data || data.length === 0) return [];

  const ids = data.map((a) => a.id);
  const [{ data: alunosRes }, { data: notasRes }] = await Promise.all([
    supabase
      .from("matriculas")
      .select("turma_id, status")
      .eq("escola_id", escolaId)
      .eq("status", "ativa"),
    supabase
      .from("notas")
      .select("avaliacao_id, valor")
      .in("avaliacao_id", ids),
  ]);

  const alunosPorTurma = new Map<string, number>();
  for (const m of (alunosRes ?? []) as Array<{ turma_id: string }>) {
    alunosPorTurma.set(m.turma_id, (alunosPorTurma.get(m.turma_id) ?? 0) + 1);
  }

  const notasPorAval = new Map<string, number>();
  for (const n of (notasRes ?? []) as Array<{ avaliacao_id: string; valor: number | null }>) {
    if (n.valor !== null && n.valor !== undefined) {
      notasPorAval.set(n.avaliacao_id, (notasPorAval.get(n.avaliacao_id) ?? 0) + 1);
    }
  }

  return ((data ?? []) as any[]).map((a) => {
    const disc = pickOne(a.disciplinas);
    const turma = pickOne(a.turmas);
    const serie = pickOne(turma?.series);
    return {
      id: a.id,
      titulo: a.titulo,
      tipo: a.tipo,
      bimestre: a.bimestre,
      anoLetivo: a.ano_letivo,
      peso: Number(a.peso),
      valorMaximo: Number(a.valor_maximo),
      dataAplicacao: a.data_aplicacao,
      disciplinaId: a.disciplina_id,
      disciplina: disc?.nome ?? "—",
      turmaId: a.turma_id,
      turma: turma?.nome ?? "—",
      serie: serie?.nome ?? "—",
      totalAlunos: alunosPorTurma.get(a.turma_id) ?? 0,
      notasLancadas: notasPorAval.get(a.id) ?? 0,
    };
  });
}

export type AvaliacaoDetalhe = AvaliacaoRow & {
  alunos: Array<{
    matriculaId: string;
    alunoId: string;
    nome: string;
    valorAtual: number | null;
  }>;
};

export async function getAvaliacaoDetalhe(
  id: string,
  escolaId: string = DEFAULT_SCHOOL_ID
): Promise<AvaliacaoDetalhe | null> {
  const supabase = await createServerClient();

  const { data: aval } = await supabase
    .from("avaliacoes")
    .select(`
      id, titulo, tipo, bimestre, ano_letivo, peso, valor_maximo, data_aplicacao,
      disciplina_id, disciplinas(nome),
      turma_id, turmas(nome, series(nome))
    `)
    .eq("escola_id", escolaId)
    .eq("id", id)
    .maybeSingle();

  if (!aval) return null;

  const turmaId = (aval as any).turma_id;
  const { data: matriculas } = await supabase
    .from("matriculas")
    .select("id, aluno_id, alunos(nome)")
    .eq("escola_id", escolaId)
    .eq("turma_id", turmaId)
    .eq("status", "ativa");

  const { data: notas } = await supabase
    .from("notas")
    .select("matricula_id, valor")
    .eq("avaliacao_id", id);

  const notaPorMatricula = new Map<string, number | null>();
  for (const n of (notas ?? []) as Array<{ matricula_id: string; valor: number | null }>) {
    notaPorMatricula.set(n.matricula_id, n.valor);
  }

  const alunos = ((matriculas ?? []) as any[])
    .map((m) => {
      const a = pickOne(m.alunos);
      return {
        matriculaId: m.id,
        alunoId: m.aluno_id,
        nome: a?.nome ?? "—",
        valorAtual: notaPorMatricula.get(m.id) ?? null,
      };
    })
    .sort((x, y) => x.nome.localeCompare(y.nome, "pt-BR"));

  const disc = pickOne((aval as any).disciplinas);
  const turma = pickOne((aval as any).turmas);
  const serie = pickOne(turma?.series);

  return {
    id: (aval as any).id,
    titulo: (aval as any).titulo,
    tipo: (aval as any).tipo,
    bimestre: (aval as any).bimestre,
    anoLetivo: (aval as any).ano_letivo,
    peso: Number((aval as any).peso),
    valorMaximo: Number((aval as any).valor_maximo),
    dataAplicacao: (aval as any).data_aplicacao,
    disciplinaId: (aval as any).disciplina_id,
    disciplina: disc?.nome ?? "—",
    turmaId,
    turma: turma?.nome ?? "—",
    serie: serie?.nome ?? "—",
    totalAlunos: alunos.length,
    notasLancadas: alunos.filter((a) => a.valorAtual !== null).length,
    alunos,
  };
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
