import "server-only";

import { createServerClient } from "@/lib/supabase/server";
import { DEFAULT_SCHOOL_ID } from "@/lib/constants";

export const TITULO_NOTA_BIMESTRAL = "Nota Bimestral";

export type TurmaComSerie = {
  serieId: string;
  serieNome: string;
  serieOrdem: number;
  turmaId: string;
  turmaNome: string;
};

export type DisciplinaOption = { id: string; nome: string };

export type AlunoGridRow = {
  matriculaId: string;
  alunoId: string;
  nome: string;
  notas: { 1: number | null; 2: number | null; 3: number | null; 4: number | null };
  media: number | null;
};

export type GridNotasAnual = {
  valorMaximo: number;
  alunos: AlunoGridRow[];
};

export async function getTurmasComSerie(
  anoLetivo: number,
  escolaId: string = DEFAULT_SCHOOL_ID,
): Promise<TurmaComSerie[]> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("turmas")
    .select("id, nome, series!inner(id, nome, ordem)")
    .eq("escola_id", escolaId)
    .eq("ano_letivo", anoLetivo)
    .eq("ativo", true);
  if (error) throw error;

  type Row = {
    id: string;
    nome: string;
    series: { id: string; nome: string; ordem: number } | null;
  };

  return ((data ?? []) as unknown as Row[])
    .filter((r) => r.series != null)
    .map((r) => ({
      serieId: r.series!.id,
      serieNome: r.series!.nome,
      serieOrdem: r.series!.ordem,
      turmaId: r.id,
      turmaNome: r.nome,
    }))
    .sort(
      (a, b) =>
        a.serieOrdem - b.serieOrdem || a.turmaNome.localeCompare(b.turmaNome, "pt-BR"),
    );
}

export async function getDisciplinasPorSerie(
  serieId: string,
  escolaId: string = DEFAULT_SCHOOL_ID,
): Promise<DisciplinaOption[]> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("disciplinas")
    .select("id, nome")
    .eq("escola_id", escolaId)
    .eq("serie_id", serieId)
    .eq("ativo", true)
    .order("ordem", { ascending: true })
    .order("nome", { ascending: true });
  if (error) throw error;
  return (data ?? []) as DisciplinaOption[];
}

export async function getGridNotasAnual(
  turmaId: string,
  disciplinaId: string,
  anoLetivo: number,
  escolaId: string = DEFAULT_SCHOOL_ID,
): Promise<GridNotasAnual> {
  const supabase = await createServerClient();

  // 1. Alunos matriculados ativos na turma do ano letivo.
  const { data: matRows, error: matErr } = await supabase
    .from("matriculas")
    .select("id, aluno_id, alunos!inner(nome)")
    .eq("escola_id", escolaId)
    .eq("turma_id", turmaId)
    .eq("ano_letivo", anoLetivo)
    .eq("status", "ativa");
  if (matErr) throw matErr;

  type MatRow = {
    id: string;
    aluno_id: string;
    alunos: { nome: string } | null;
  };

  const alunos = ((matRows ?? []) as unknown as MatRow[])
    .filter((m) => m.alunos != null)
    .map((m) => ({
      matriculaId: m.id,
      alunoId: m.aluno_id,
      nome: m.alunos!.nome,
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

  // 2. Avaliações "Nota Bimestral" existentes para (turma, disciplina, ano).
  const { data: avalRows, error: avalErr } = await supabase
    .from("avaliacoes")
    .select("id, bimestre, valor_maximo")
    .eq("escola_id", escolaId)
    .eq("turma_id", turmaId)
    .eq("disciplina_id", disciplinaId)
    .eq("ano_letivo", anoLetivo)
    .eq("titulo", TITULO_NOTA_BIMESTRAL);
  if (avalErr) throw avalErr;

  const avalsPorBim = new Map<number, { id: string; valorMaximo: number }>();
  for (const r of (avalRows ?? []) as Array<{
    id: string;
    bimestre: number;
    valor_maximo: number | string;
  }>) {
    avalsPorBim.set(r.bimestre, { id: r.id, valorMaximo: Number(r.valor_maximo) });
  }

  const valoresMax: Array<{ id: string; valorMaximo: number }> = [];
  avalsPorBim.forEach((v) => valoresMax.push(v));
  const valorMaximo = valoresMax.find((v) => v.valorMaximo > 0)?.valorMaximo ?? 10;

  // 3. Notas dessas avaliações.
  const avalIds = valoresMax.map((v) => v.id);
  type NotaRow = { aluno_id: string; avaliacao_id: string; valor: number | string | null };
  const notasMap = new Map<string, Map<number, number>>(); // alunoId → bim → valor

  if (avalIds.length > 0) {
    const { data: notaRows, error: notaErr } = await supabase
      .from("notas")
      .select("aluno_id, avaliacao_id, valor")
      .in("avaliacao_id", avalIds);
    if (notaErr) throw notaErr;

    const bimPorAvalId = new Map<string, number>();
    avalsPorBim.forEach((info, bim) => {
      bimPorAvalId.set(info.id, bim);
    });

    for (const n of (notaRows ?? []) as NotaRow[]) {
      if (n.valor == null) continue;
      const bim = bimPorAvalId.get(n.avaliacao_id);
      if (!bim) continue;
      const valor = Number(n.valor);
      if (!Number.isFinite(valor)) continue;
      let inner = notasMap.get(n.aluno_id);
      if (!inner) {
        inner = new Map();
        notasMap.set(n.aluno_id, inner);
      }
      inner.set(bim, valor);
    }
  }

  // 4. Monta linhas.
  const linhas: AlunoGridRow[] = alunos.map((a) => {
    const inner = notasMap.get(a.alunoId);
    const notas = {
      1: inner?.get(1) ?? null,
      2: inner?.get(2) ?? null,
      3: inner?.get(3) ?? null,
      4: inner?.get(4) ?? null,
    } as AlunoGridRow["notas"];
    const presentes = [notas[1], notas[2], notas[3], notas[4]].filter(
      (v): v is number => v != null,
    );
    const media =
      presentes.length > 0
        ? Math.round(
            (presentes.reduce((s, v) => s + v, 0) / presentes.length) * 100,
          ) / 100
        : null;
    return { ...a, notas, media };
  });

  return { valorMaximo, alunos: linhas };
}
