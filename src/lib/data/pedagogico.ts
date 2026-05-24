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
    fotoUrl: string | null;
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
    .select("data_aula, presente, aluno_id, alunos(nome, foto_url), matriculas(turmas(nome))")
    .eq("escola_id", escolaId)
    .gte("data_aula", desdeStr)
    .lte("data_aula", hojeStr);

  // Heatmap por dia
  const porDia = new Map<string, { p: number; f: number }>();
  // Top faltosos
  const porAluno = new Map<string, { nome: string; turma: string; fotoUrl: string | null; p: number; f: number }>();

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
      fotoUrl: aluno?.foto_url ?? null,
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
      fotoUrl: v.fotoUrl,
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
  employeeId: string;
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
      id, employee_id, disciplina_id, turma_id,
      employees(name),
      disciplinas(nome),
      turmas(nome, series(nome))
    `)
    .eq("escola_id", escolaId);

  return ((data ?? []) as any[]).map((a) => {
    const employee = pickOne(a.employees);
    const disciplina = pickOne(a.disciplinas);
    const turma = pickOne(a.turmas);
    const serie = pickOne(turma?.series);
    return {
      id: a.id,
      employeeId: a.employee_id,
      professorNome: employee?.name ?? "—",
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
  _escolaId: string = DEFAULT_SCHOOL_ID
): Promise<ProfessorOption[]> {
  // Professores vêm de employees com school_category in (fund1, fund2, medio).
  // employees não é multi-tenant por escola (sem escola_id) — todos os funcionários
  // são da única escola por enquanto.
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("employees")
    .select("id, name, email")
    .in("school_category", ["fund1", "fund2", "medio"])
    .eq("ativo", true)
    .order("name");

  return ((data ?? []) as Array<{ id: string; name: string; email: string | null }>).map((e) => ({
    id: e.id,
    nome: e.name,
    email: e.email ?? "",
  }));
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

export type AlunoRankingRow = {
  alunoId: string;
  matriculaId: string;
  nome: string;
  turma: string;
  serie: string;
  segmento: string;
  fotoUrl: string | null;
  mediaGeral: number;
  disciplinasComMedia: number;
};

export async function getRankingAlunos(
  escolaId: string = DEFAULT_SCHOOL_ID,
  anoLetivo: number = new Date().getFullYear(),
  limit: number = 10
): Promise<AlunoRankingRow[]> {
  const supabase = await createServerClient();

  const { data: consol } = await supabase
    .from("notas_consolidadas")
    .select("matricula_id, aluno_id, disciplina_id, media")
    .eq("escola_id", escolaId)
    .eq("ano_letivo", anoLetivo)
    .not("media", "is", null);

  if (!consol || consol.length === 0) return [];

  // Agrega medias por aluno (media das medias de disciplinas no ano todo)
  type Acc = { matriculaId: string; soma: number; count: number };
  const porAluno = new Map<string, Acc>();
  for (const r of consol as any[]) {
    const acc = porAluno.get(r.aluno_id) ?? { matriculaId: r.matricula_id, soma: 0, count: 0 };
    if (r.media !== null && r.media !== undefined) {
      acc.soma += Number(r.media);
      acc.count++;
    }
    porAluno.set(r.aluno_id, acc);
  }

  const alunoIds = Array.from(porAluno.keys());
  if (alunoIds.length === 0) return [];

  const { data: alunos } = await supabase
    .from("alunos")
    .select("id, nome, foto_url")
    .in("id", alunoIds);

  const matriculaIds = Array.from(porAluno.values()).map((a) => a.matriculaId);
  const { data: matriculas } = await supabase
    .from("matriculas")
    .select("id, turmas(nome, series(nome, segmento))")
    .in("id", matriculaIds);

  const nomeMap = new Map<string, { nome: string; fotoUrl: string | null }>();
  for (const a of (alunos ?? []) as Array<{ id: string; nome: string; foto_url: string | null }>) {
    nomeMap.set(a.id, { nome: a.nome, fotoUrl: a.foto_url ?? null });
  }

  const matMap = new Map<string, { turma: string; serie: string; segmento: string }>();
  for (const m of ((matriculas ?? []) as any[])) {
    const t = pickOne(m.turmas);
    const s = pickOne(t?.series);
    matMap.set(m.id, {
      turma: t?.nome ?? "—",
      serie: s?.nome ?? "—",
      segmento: s?.segmento ?? "outros",
    });
  }

  const rows: AlunoRankingRow[] = Array.from(porAluno.entries()).map(([alunoId, a]) => {
    const info = matMap.get(a.matriculaId) ?? { turma: "—", serie: "—", segmento: "outros" };
    const aluno = nomeMap.get(alunoId);
    return {
      alunoId,
      matriculaId: a.matriculaId,
      nome: aluno?.nome ?? "—",
      turma: info.turma,
      serie: info.serie,
      segmento: info.segmento,
      fotoUrl: aluno?.fotoUrl ?? null,
      mediaGeral: a.count > 0 ? a.soma / a.count : 0,
      disciplinasComMedia: a.count,
    };
  });

  rows.sort((a, b) => b.mediaGeral - a.mediaGeral);
  return rows.slice(0, limit);
}

export type BoletimDisciplina = {
  disciplinaId: string;
  disciplina: string;
  bimestres: Array<{
    bimestre: number;
    media: number | null;
    totalAvaliacoes: number;
    notasLancadas: number;
  }>;
  mediaAnual: number | null;
};

export type BoletimFrequencia = {
  totalDias: number;
  presencas: number;
  faltas: number;
  taxa: number;
};

export type BoletimEscola = {
  nome: string;
  cnpj: string | null;
  email: string | null;
  telefone: string | null;
  endereco: string | null;
  cidade: string | null;
  uf: string | null;
  cep: string | null;
  logoUrl: string | null;
};

export type BoletimData = {
  escola: BoletimEscola;
  aluno: {
    id: string;
    nome: string;
    matriculaCodigo: string | null;
    fotoUrl: string | null;
  };
  matricula: {
    id: string;
    anoLetivo: number;
    serie: string;
    turma: string;
    segmento: string;
  };
  disciplinas: BoletimDisciplina[];
  frequencia: BoletimFrequencia;
};

export async function getBoletim(
  alunoId: string,
  anoLetivo: number = new Date().getFullYear(),
  escolaId: string = DEFAULT_SCHOOL_ID
): Promise<BoletimData | null> {
  const supabase = await createServerClient();

  const { data: matricula } = await supabase
    .from("matriculas")
    .select(`
      id, ano_letivo,
      alunos(id, nome, matricula_codigo, foto_url),
      turmas(nome, series(nome, segmento))
    `)
    .eq("escola_id", escolaId)
    .eq("aluno_id", alunoId)
    .eq("ano_letivo", anoLetivo)
    .eq("status", "ativa")
    .maybeSingle();

  if (!matricula) return null;
  const m = matricula as any;
  const aluno = pickOne(m.alunos);
  const turma = pickOne(m.turmas);
  const serieRel = pickOne(turma?.series);

  // Dados da escola para o cabeçalho do boletim
  const { data: escolaRow } = await supabase
    .from("escolas")
    .select("nome, cnpj, email, telefone, endereco, cidade, uf, cep, logo_url")
    .eq("id", escolaId)
    .maybeSingle();

  // Notas consolidadas do aluno no ano
  const { data: consol } = await supabase
    .from("notas_consolidadas")
    .select("disciplina_id, bimestre, media, total_avaliacoes, notas_lancadas")
    .eq("escola_id", escolaId)
    .eq("matricula_id", m.id);

  // Carrega nomes de disciplinas
  const disciplinaIds = Array.from(new Set((consol ?? []).map((c: any) => c.disciplina_id)));
  const { data: disciplinas } = disciplinaIds.length > 0
    ? await supabase.from("disciplinas").select("id, nome, ordem").in("id", disciplinaIds)
    : { data: [] };

  const dispMap = new Map<string, { nome: string; ordem: number }>();
  for (const d of (disciplinas ?? []) as Array<{ id: string; nome: string; ordem: number }>) {
    dispMap.set(d.id, { nome: d.nome, ordem: d.ordem });
  }

  // Agrupa por disciplina
  type Acc = Map<number, { media: number | null; totalAvaliacoes: number; notasLancadas: number }>;
  const porDisc = new Map<string, Acc>();
  for (const c of ((consol ?? []) as any[])) {
    const acc = porDisc.get(c.disciplina_id) ?? new Map();
    acc.set(c.bimestre, {
      media: c.media !== null && c.media !== undefined ? Number(c.media) : null,
      totalAvaliacoes: Number(c.total_avaliacoes ?? 0),
      notasLancadas: Number(c.notas_lancadas ?? 0),
    });
    porDisc.set(c.disciplina_id, acc);
  }

  const disciplinasOut: BoletimDisciplina[] = Array.from(porDisc.entries()).map(([id, bimMap]) => {
    const info = dispMap.get(id) ?? { nome: "—", ordem: 999 };
    const bimestres = [1, 2, 3, 4].map((b) => {
      const v = bimMap.get(b);
      return {
        bimestre: b,
        media: v?.media ?? null,
        totalAvaliacoes: v?.totalAvaliacoes ?? 0,
        notasLancadas: v?.notasLancadas ?? 0,
      };
    });
    const medias = bimestres.map((b) => b.media).filter((v): v is number => v !== null);
    const mediaAnual = medias.length > 0 ? medias.reduce((s, x) => s + x, 0) / medias.length : null;
    return {
      disciplinaId: id,
      disciplina: info.nome,
      bimestres,
      mediaAnual,
    };
  });

  disciplinasOut.sort((a, b) => {
    const oa = dispMap.get(a.disciplinaId)?.ordem ?? 999;
    const ob = dispMap.get(b.disciplinaId)?.ordem ?? 999;
    if (oa !== ob) return oa - ob;
    return a.disciplina.localeCompare(b.disciplina);
  });

  // Frequencia do aluno no ano
  const { data: freqs } = await supabase
    .from("frequencias")
    .select("presente")
    .eq("escola_id", escolaId)
    .eq("aluno_id", alunoId)
    .gte("data_aula", `${anoLetivo}-01-01`)
    .lte("data_aula", `${anoLetivo}-12-31`);

  let presencas = 0;
  let faltas = 0;
  for (const r of (freqs ?? []) as Array<{ presente: boolean }>) {
    if (r.presente) presencas++;
    else faltas++;
  }
  const totalDias = presencas + faltas;

  return {
    escola: {
      nome: escolaRow?.nome ?? "—",
      cnpj: escolaRow?.cnpj ?? null,
      email: escolaRow?.email ?? null,
      telefone: escolaRow?.telefone ?? null,
      endereco: escolaRow?.endereco ?? null,
      cidade: escolaRow?.cidade ?? null,
      uf: escolaRow?.uf ?? null,
      cep: escolaRow?.cep ?? null,
      logoUrl: escolaRow?.logo_url ?? null,
    },
    aluno: {
      id: aluno?.id ?? alunoId,
      nome: aluno?.nome ?? "—",
      matriculaCodigo: aluno?.matricula_codigo ?? null,
      fotoUrl: aluno?.foto_url ?? null,
    },
    matricula: {
      id: m.id,
      anoLetivo: m.ano_letivo,
      serie: serieRel?.nome ?? "—",
      turma: turma?.nome ?? "—",
      segmento: serieRel?.segmento ?? "outros",
    },
    disciplinas: disciplinasOut,
    frequencia: {
      totalDias,
      presencas,
      faltas,
      taxa: totalDias > 0 ? presencas / totalDias : 0,
    },
  };
}

export type PedagogicoOverview = {
  totalAlunos: number;
  totalTurmas: number;
  totalSeries: number;
  totalTurnos: number;
  porEtapa: Array<{
    etapa: string;
    label: string;
    count: number;
    percent: number;
  }>;
};

const ETAPA_LABELS: Record<string, string> = {
  INFANTIL: "Educação Infantil",
  FUNDAMENTAL1: "Ensino Fundamental I",
  FUNDAMENTAL2: "Ensino Fundamental II",
  MEDIO: "Ensino Médio",
};

export async function getPedagogicoOverview(
  escolaId: string = DEFAULT_SCHOOL_ID,
  anoLetivo: number = new Date().getFullYear()
): Promise<PedagogicoOverview> {
  const supabase = await createServerClient();

  const [
    { count: totalAlunos },
    { data: turmas },
    { count: totalSeries },
    { data: matriculasEtapa },
  ] = await Promise.all([
    supabase
      .from("matriculas")
      .select("id", { count: "exact", head: true })
      .eq("escola_id", escolaId)
      .eq("status", "ativa"),
    supabase
      .from("turmas")
      .select("id, turno")
      .eq("escola_id", escolaId)
      .eq("ano_letivo", anoLetivo)
      .eq("ativo", true),
    supabase
      .from("series")
      .select("id", { count: "exact", head: true })
      .eq("escola_id", escolaId),
    supabase
      .from("matriculas")
      .select("series(segmento)")
      .eq("escola_id", escolaId)
      .eq("status", "ativa"),
  ]);

  const turnosSet = new Set<string>();
  for (const t of (turmas ?? []) as Array<{ turno: string }>) {
    if (t.turno) turnosSet.add(t.turno);
  }

  const porEtapaMap = new Map<string, number>();
  for (const m of ((matriculasEtapa ?? []) as any[])) {
    const s = pickOne(m.series);
    const etapa = s?.segmento ?? "outros";
    porEtapaMap.set(etapa, (porEtapaMap.get(etapa) ?? 0) + 1);
  }

  const total = totalAlunos ?? 0;
  const ordem = ["INFANTIL", "FUNDAMENTAL1", "FUNDAMENTAL2", "MEDIO"];
  const porEtapa = ordem.map((etapa) => {
    const count = porEtapaMap.get(etapa) ?? 0;
    return {
      etapa,
      label: ETAPA_LABELS[etapa] ?? etapa,
      count,
      percent: total > 0 ? (count / total) * 100 : 0,
    };
  });

  return {
    totalAlunos: total,
    totalTurmas: (turmas ?? []).length,
    totalSeries: totalSeries ?? 0,
    totalTurnos: turnosSet.size,
    porEtapa,
  };
}
