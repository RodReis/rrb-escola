import { createServerClient } from "@/lib/supabase/server";
import { DEFAULT_SCHOOL_ID } from "@/lib/constants";

export async function getAttendanceData() {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("frequencias")
    .select("*, alunos(nome, matricula_codigo)")
    .eq("escola_id", DEFAULT_SCHOOL_ID)
    .order("data_aula", { ascending: false })
    .limit(100);

  if (error) throw error;
  return data ?? [];
}

export async function getClassAttendanceData(turmaId?: string, date?: string) {
  const supabase = await createServerClient();
  const today = date ?? new Date().toISOString().slice(0, 10);

  const { data: turmas, error: turmasError } = await supabase
    .from("turmas")
    .select("id, nome, ano_letivo, series(nome)")
    .eq("escola_id", DEFAULT_SCHOOL_ID)
    .eq("ativo", true)
    .order("ano_letivo", { ascending: false })
    .order("nome");

  if (turmasError) throw turmasError;

  const normalizedTurmas = (turmas ?? []).map((turma) => ({
    ...turma,
    series: Array.isArray(turma.series) ? turma.series[0] : turma.series
  }));
  const selectedTurmaId = turmaId ?? normalizedTurmas[0]?.id ?? "";
  if (!selectedTurmaId) {
    return { turmas: normalizedTurmas, selectedTurmaId, date: today, students: [] };
  }

  const { data: enrollments, error: enrollmentsError } = await supabase
    .from("matriculas")
    .select("id, aluno_id, alunos(id, matricula_codigo, nome)")
    .eq("escola_id", DEFAULT_SCHOOL_ID)
    .eq("turma_id", selectedTurmaId)
    .eq("status", "ativa")
    .order("alunos(nome)");

  if (enrollmentsError) throw enrollmentsError;

  const alunoIds = (enrollments ?? []).map((item) => item.aluno_id);
  const { data: attendance, error: attendanceError } = alunoIds.length
    ? await supabase
        .from("frequencias")
        .select("aluno_id, presente, justificativa")
        .eq("escola_id", DEFAULT_SCHOOL_ID)
        .eq("data_aula", today)
        .in("aluno_id", alunoIds)
    : { data: [], error: null };

  if (attendanceError) throw attendanceError;

  const attendanceMap = new Map((attendance ?? []).map((item) => [item.aluno_id, item]));

  return {
    turmas: normalizedTurmas,
    selectedTurmaId,
    date: today,
    students: (enrollments ?? []).map((enrollment) => ({
      matriculaId: enrollment.id,
      alunoId: enrollment.aluno_id,
      aluno: Array.isArray(enrollment.alunos) ? enrollment.alunos[0] : enrollment.alunos,
      attendance: attendanceMap.get(enrollment.aluno_id) ?? null
    }))
  };
}

export async function getAttendanceReport(start?: string, end?: string) {
  const today = new Date().toISOString().slice(0, 10);
  const defaultStart = `${today.slice(0, 7)}-01`;
  const dateStart = start || defaultStart;
  const dateEnd = end || today;

  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("frequencias")
    .select("id, data_aula, presente, justificativa, alunos(id, matricula_codigo, nome)")
    .eq("escola_id", DEFAULT_SCHOOL_ID)
    .gte("data_aula", dateStart)
    .lte("data_aula", dateEnd)
    .order("data_aula", { ascending: false });

  if (error) throw error;

  const rows = data ?? [];
  const byStudent = new Map<
    string,
    { aluno: string; matricula: string; presencas: number; faltas: number; total: number; percentual: number }
  >();

  for (const item of rows) {
    const aluno = Array.isArray(item.alunos) ? item.alunos[0] : item.alunos;
    const key = aluno?.id ?? "sem-aluno";
    const current = byStudent.get(key) ?? {
      aluno: aluno?.nome ?? "Sem aluno",
      matricula: aluno?.matricula_codigo ?? "",
      presencas: 0,
      faltas: 0,
      total: 0,
      percentual: 0
    };
    current.total += 1;
    if (item.presente) current.presencas += 1;
    else current.faltas += 1;
    current.percentual = current.total > 0 ? Math.round((current.presencas / current.total) * 100) : 0;
    byStudent.set(key, current);
  }

  const summary = Array.from(byStudent.values()).sort((a, b) => a.aluno.localeCompare(b.aluno));

  return {
    start: dateStart,
    end: dateEnd,
    rows,
    summary,
    totals: {
      registros: rows.length,
      presencas: rows.filter((item) => item.presente).length,
      faltas: rows.filter((item) => !item.presente).length
    }
  };
}
