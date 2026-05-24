import "server-only";

import { createServerClient } from "@/lib/supabase/server";
import { DEFAULT_SCHOOL_ID } from "@/lib/constants";
import { TITULO_NOTA_BIMESTRAL } from "@/lib/data/lancamento-notas";

export type AlunoNotaBim = {
  matriculaId: string;
  alunoId: string;
  nome: string;
  valor: number | null;
};

export type NotasDoBimestre = {
  valorMaximo: number;
  alunos: AlunoNotaBim[];
};

export async function getNotasDoBimestre(
  turmaId: string,
  disciplinaId: string,
  bimestre: number,
  anoLetivo: number,
  escolaId: string = DEFAULT_SCHOOL_ID,
): Promise<NotasDoBimestre> {
  const supabase = await createServerClient();

  // Alunos matriculados ativos
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

  const alunosBase = ((matRows ?? []) as unknown as MatRow[])
    .filter((m) => m.alunos != null)
    .map((m) => ({
      matriculaId: m.id,
      alunoId: m.aluno_id,
      nome: m.alunos!.nome,
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

  // Avaliação "Nota Bimestral" do bimestre (se existir)
  const { data: avalRow } = await supabase
    .from("avaliacoes")
    .select("id, valor_maximo")
    .eq("escola_id", escolaId)
    .eq("turma_id", turmaId)
    .eq("disciplina_id", disciplinaId)
    .eq("ano_letivo", anoLetivo)
    .eq("bimestre", bimestre)
    .eq("titulo", TITULO_NOTA_BIMESTRAL)
    .maybeSingle();

  const valorMaximo = avalRow ? Number(avalRow.valor_maximo) : 10;
  const notaPorAluno = new Map<string, number>();

  if (avalRow) {
    const { data: notas } = await supabase
      .from("notas")
      .select("aluno_id, valor")
      .eq("avaliacao_id", avalRow.id);
    for (const n of (notas ?? []) as Array<{ aluno_id: string; valor: number | string | null }>) {
      if (n.valor == null) continue;
      const v = Number(n.valor);
      if (Number.isFinite(v)) notaPorAluno.set(n.aluno_id, v);
    }
  }

  return {
    valorMaximo,
    alunos: alunosBase.map((a) => ({
      ...a,
      valor: notaPorAluno.get(a.alunoId) ?? null,
    })),
  };
}
