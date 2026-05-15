import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_SCHOOL_ID } from "@/lib/constants";
import type { StudentSheet } from "@/lib/types";

export async function listStudents() {
  const { data, error } = await createAdminClient()
    .from("alunos")
    .select("id, matricula_codigo, nome, cpf, celular, ativo, matriculas(status, series(nome), turmas(nome))")
    .eq("escola_id", DEFAULT_SCHOOL_ID)
    .order("nome");

  if (error) throw error;
  return data ?? [];
}

export async function getStudentSheet(id: string) {
  const { data, error } = await createAdminClient()
    .from("alunos")
    .select(`
      *,
      enderecos_aluno(*),
      contatos_aluno(*),
      responsaveis_aluno(*),
      pessoas_autorizadas(*),
      informacoes_medicas(*),
      autorizacoes_aluno(*),
      matriculas(id, codigo, data_matricula, ano_letivo, idade_na_matricula, status, observacoes, series(nome), turmas(nome), planos(nome))
    `)
    .eq("id", id)
    .single();

  if (error) throw error;
  return data as StudentSheet;
}

export async function getStudentFormOptions() {
  const supabase = createAdminClient();
  const [series, turmas, planos] = await Promise.all([
    supabase.from("series").select("id, nome").eq("escola_id", DEFAULT_SCHOOL_ID).eq("ativo", true).order("ordem"),
    supabase.from("turmas").select("id, nome, ano_letivo, serie_id").eq("escola_id", DEFAULT_SCHOOL_ID).eq("ativo", true).order("nome"),
    supabase.from("planos").select("id, nome").eq("escola_id", DEFAULT_SCHOOL_ID).eq("ativo", true).order("nome")
  ]);

  if (series.error) throw series.error;
  if (turmas.error) throw turmas.error;
  if (planos.error) throw planos.error;

  return {
    series: series.data ?? [],
    turmas: turmas.data ?? [],
    planos: planos.data ?? []
  };
}

export async function getStudentsReport() {
  const { data, error } = await createAdminClient()
    .from("alunos")
    .select(`
      id,
      matricula_codigo,
      nome,
      cpf,
      rg,
      data_nascimento,
      celular,
      ativo,
      enderecos_aluno(cidade, uf, cep),
      responsaveis_aluno(nome, parentesco, celular, email, responsavel_financeiro),
      matriculas(status, ano_letivo, data_matricula, series(nome), turmas(nome))
    `)
    .eq("escola_id", DEFAULT_SCHOOL_ID)
    .order("nome");

  if (error) throw error;

  return (data ?? []).map((student) => {
    const activeEnrollment = [...(student.matriculas ?? [])]
      .sort((a, b) => Number(b.ano_letivo ?? 0) - Number(a.ano_letivo ?? 0))
      .find((item) => item.status === "ativa") ?? student.matriculas?.[0] ?? null;
    const activeSeries = activeEnrollment?.series as { nome?: string } | { nome?: string }[] | null | undefined;
    const activeClass = activeEnrollment?.turmas as { nome?: string } | { nome?: string }[] | null | undefined;
    const guardian =
      student.responsaveis_aluno?.find((item) => item.responsavel_financeiro) ?? student.responsaveis_aluno?.[0] ?? null;
    const address = student.enderecos_aluno?.[0] ?? null;

    return {
      id: student.id,
      matricula: student.matricula_codigo,
      nome: student.nome,
      cpf: student.cpf,
      rg: student.rg,
      dataNascimento: student.data_nascimento,
      celular: student.celular,
      ativo: student.ativo,
      cidade: address?.cidade ?? "",
      uf: address?.uf ?? "",
      cep: address?.cep ?? "",
      responsavel: guardian?.nome ?? "",
      responsavelParentesco: guardian?.parentesco ?? "",
      responsavelCelular: guardian?.celular ?? "",
      responsavelEmail: guardian?.email ?? "",
      serie: Array.isArray(activeSeries) ? activeSeries[0]?.nome ?? "" : activeSeries?.nome ?? "",
      turma: Array.isArray(activeClass) ? activeClass[0]?.nome ?? "" : activeClass?.nome ?? "",
      anoLetivo: activeEnrollment?.ano_letivo ?? null,
      statusMatricula: activeEnrollment?.status ?? ""
    };
  });
}
