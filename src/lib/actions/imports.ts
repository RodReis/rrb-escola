"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth/session";
import { DEFAULT_SCHOOL_ID } from "@/lib/constants";
import { generateChargesForEnrollment } from "@/lib/server/generate-charges";
import { parsePdfStudents, parseSpreadsheetStudents, type StudentImportData } from "@/lib/server/student-import-parser";
import { createServerClient } from "@/lib/supabase/server";
import { formNumber, formText } from "@/lib/utils";

const readyStatus = "pronto";

function safeFileName(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "-");
}

function isSpreadsheet(file: File) {
  const name = file.name.toLowerCase();
  return name.endsWith(".xlsx") || name.endsWith(".xls") || name.endsWith(".csv");
}

function isPdf(file: File) {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

function normalize(value: string | null | undefined) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

async function validateImportRows(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  rows: Array<{ line: number; data: StudentImportData }>
) {
  const [students, series, turmas, planos] = await Promise.all([
    supabase.from("alunos").select("matricula_codigo").eq("escola_id", DEFAULT_SCHOOL_ID),
    supabase.from("series").select("id, nome").eq("escola_id", DEFAULT_SCHOOL_ID),
    supabase.from("turmas").select("id, nome, ano_letivo, serie_id").eq("escola_id", DEFAULT_SCHOOL_ID),
    supabase.from("planos").select("id, nome").eq("escola_id", DEFAULT_SCHOOL_ID)
  ]);

  if (students.error) throw students.error;
  if (series.error) throw series.error;
  if (turmas.error) throw turmas.error;
  if (planos.error) throw planos.error;

  const existingCodes = new Set((students.data ?? []).map((item) => normalize(item.matricula_codigo)));
  const seriesByName = new Map((series.data ?? []).map((item) => [normalize(item.nome), item]));
  const plansByName = new Map((planos.data ?? []).map((item) => [normalize(item.nome), item]));

  return rows.map((row) => {
    const errors: string[] = [];
    const data = {
      ...row.data,
      ano_letivo: row.data.ano_letivo ?? new Date().getFullYear()
    };

    if (!data.matricula_codigo) errors.push("Matricula obrigatoria.");
    if (!data.nome) errors.push("Nome obrigatorio.");
    if (data.matricula_codigo && existingCodes.has(normalize(data.matricula_codigo))) errors.push("Matricula ja cadastrada.");

    const serie = data.serie ? seriesByName.get(normalize(data.serie)) : null;
    if (!serie) errors.push("Serie nao localizada.");

    const turma = serie
      ? (turmas.data ?? []).find(
          (item) => item.serie_id === serie.id && normalize(item.nome) === normalize(data.turma) && Number(item.ano_letivo) === Number(data.ano_letivo)
        )
      : null;
    if (!turma) errors.push("Turma nao localizada para a serie e ano letivo.");

    if (data.plano && !plansByName.has(normalize(data.plano))) errors.push("Plano nao localizado.");

    return {
      linha: row.line,
      dados: data,
      erros: errors,
      status: errors.length === 0 ? readyStatus : errors.some((error) => error.includes("ja cadastrada")) ? "duplicado" : "pendente"
    };
  });
}

export async function uploadStudentImportAction(formData: FormData) {
  await requirePermission("importacoes", "create");
  const file = formData.get("arquivo");
  if (!(file instanceof File) || file.size === 0) return;
  if (!isPdf(file) && !isSpreadsheet(file)) throw new Error("Envie um PDF, XLSX, XLS ou CSV.");

  const supabase = await createServerClient();
  const bytes = Buffer.from(await file.arrayBuffer());
  const storagePath = `alunos/${Date.now()}-${safeFileName(file.name)}`;
  const contentType = isPdf(file) ? "application/pdf" : file.type || "application/octet-stream";
  const tipo = isPdf(file) ? "pdf_alunos" : "planilha_alunos";

  const { error: uploadError } = await supabase.storage.from("importacoes").upload(storagePath, bytes, {
    contentType,
    upsert: false
  });
  if (uploadError) throw uploadError;

  const { data: importedFile, error: insertError } = await supabase
    .from("arquivos_importados")
    .insert({
      escola_id: DEFAULT_SCHOOL_ID,
      nome_arquivo: file.name,
      tipo,
      storage_path: storagePath,
      status: "pendente",
      observacao: formText(formData, "observacao")
    })
    .select("id")
    .single();
  if (insertError) throw insertError;

  try {
    const parsedRows = isPdf(file) ? await parsePdfStudents(bytes) : await parseSpreadsheetStudents(bytes, file.name);
    const validatedRows = await validateImportRows(supabase, parsedRows);

    if (validatedRows.length === 0) {
      await supabase
        .from("arquivos_importados")
        .update({ status: "erro", observacao: "Nenhuma linha de aluno foi extraida do arquivo." })
        .eq("id", importedFile.id);
    } else {
      const { error: rowsError } = await supabase.from("importacao_alunos_linhas").insert(
        validatedRows.map((row) => ({
          arquivo_id: importedFile.id,
          escola_id: DEFAULT_SCHOOL_ID,
          linha: row.linha,
          status: row.status,
          dados: row.dados,
          erros: row.erros
        }))
      );
      if (rowsError) throw rowsError;
    }
  } catch (error) {
    await supabase
      .from("arquivos_importados")
      .update({ status: "erro", observacao: error instanceof Error ? error.message : "Falha ao processar arquivo." })
      .eq("id", importedFile.id);
  }

  revalidatePath("/importacoes");
  redirect(`/importacoes/${importedFile.id}`);
}

export const uploadStudentPdfAction = uploadStudentImportAction;

export async function updateImportStudentRowAction(formData: FormData) {
  await requirePermission("importacoes", "update");
  const id = formText(formData, "id");
  const arquivoId = formText(formData, "arquivo_id");
  if (!id || !arquivoId) return;

  const data: StudentImportData = {
    matricula_codigo: formText(formData, "matricula_codigo") ?? "",
    nome: formText(formData, "nome") ?? "",
    cpf: formText(formData, "cpf"),
    rg: formText(formData, "rg"),
    data_nascimento: formText(formData, "data_nascimento"),
    sexo: formText(formData, "sexo"),
    celular: formText(formData, "celular"),
    email: formText(formData, "email"),
    logradouro: formText(formData, "logradouro"),
    numero: formText(formData, "numero"),
    bairro: formText(formData, "bairro"),
    cidade: formText(formData, "cidade"),
    uf: formText(formData, "uf"),
    cep: formText(formData, "cep"),
    responsavel_nome: formText(formData, "responsavel_nome"),
    responsavel_cpf: formText(formData, "responsavel_cpf"),
    responsavel_telefone: formText(formData, "responsavel_telefone"),
    responsavel_celular: formText(formData, "responsavel_celular"),
    responsavel_parentesco: formText(formData, "responsavel_parentesco"),
    responsavel_email: formText(formData, "responsavel_email"),
    serie: formText(formData, "serie"),
    turma: formText(formData, "turma"),
    plano: formText(formData, "plano"),
    ano_letivo: formNumber(formData, "ano_letivo"),
    data_matricula: formText(formData, "data_matricula"),
    idade_na_matricula: formNumber(formData, "idade_na_matricula")
  };

  const supabase = await createServerClient();
  const [validated] = await validateImportRows(supabase, [{ line: 1, data }]);

  await supabase
    .from("importacao_alunos_linhas")
    .update({
      dados: validated.dados,
      erros: validated.erros,
      status: validated.status
    })
    .eq("id", id)
    .eq("arquivo_id", arquivoId)
    .eq("escola_id", DEFAULT_SCHOOL_ID);

  revalidatePath(`/importacoes/${arquivoId}`);
  revalidatePath("/importacoes");
}

export async function processImportStudentBatchAction(formData: FormData) {
  await requirePermission("importacoes", "update");
  const arquivoId = formText(formData, "arquivo_id");
  if (!arquivoId) return;

  const supabase = await createServerClient();
  const { data: rows, error } = await supabase
    .from("importacao_alunos_linhas")
    .select("*")
    .eq("arquivo_id", arquivoId)
    .eq("escola_id", DEFAULT_SCHOOL_ID)
    .eq("status", readyStatus)
    .order("linha");
  if (error) throw error;

  const [series, turmas, planos] = await Promise.all([
    supabase.from("series").select("id, nome").eq("escola_id", DEFAULT_SCHOOL_ID),
    supabase.from("turmas").select("id, nome, ano_letivo, serie_id").eq("escola_id", DEFAULT_SCHOOL_ID),
    supabase.from("planos").select("id, nome").eq("escola_id", DEFAULT_SCHOOL_ID)
  ]);
  if (series.error) throw series.error;
  if (turmas.error) throw turmas.error;
  if (planos.error) throw planos.error;

  const seriesByName = new Map((series.data ?? []).map((item) => [normalize(item.nome), item]));
  const plansByName = new Map((planos.data ?? []).map((item) => [normalize(item.nome), item]));

  for (const row of rows ?? []) {
    const data = row.dados as StudentImportData;
    const serie = data.serie ? seriesByName.get(normalize(data.serie)) : null;
    const turma = serie
      ? (turmas.data ?? []).find(
          (item) => item.serie_id === serie.id && normalize(item.nome) === normalize(data.turma) && Number(item.ano_letivo) === Number(data.ano_letivo)
        )
      : null;
    const plano = data.plano ? plansByName.get(normalize(data.plano)) : null;

    if (!serie || !turma) {
      await supabase
        .from("importacao_alunos_linhas")
        .update({ status: "pendente", erros: ["Serie ou turma nao localizada."] })
        .eq("id", row.id);
      continue;
    }

    const { data: aluno, error: studentError } = await supabase
      .from("alunos")
      .insert({
        escola_id: DEFAULT_SCHOOL_ID,
        matricula_codigo: data.matricula_codigo,
        nome: data.nome,
        cpf: data.cpf,
        rg: data.rg,
        data_nascimento: data.data_nascimento,
        sexo: data.sexo,
        celular: data.celular,
        email: data.email,
        ativo: true
      })
      .select("id")
      .single();

    if (studentError || !aluno) {
      await supabase
        .from("importacao_alunos_linhas")
        .update({ status: "erro", erros: [studentError?.message ?? "Falha ao criar aluno."] })
        .eq("id", row.id);
      continue;
    }

    await Promise.all([
      supabase.from("enderecos_aluno").insert({
        aluno_id: aluno.id,
        logradouro: data.logradouro ?? "Nao informado",
        numero: data.numero,
        bairro: data.bairro,
        cidade: data.cidade,
        uf: data.uf,
        cep: data.cep,
        principal: true
      }),
      supabase.from("contatos_aluno").insert({
        aluno_id: aluno.id,
        nome: data.responsavel_nome ?? "Contato",
        telefone: data.responsavel_telefone,
        celular: data.responsavel_celular ?? data.celular,
        parentesco: data.responsavel_parentesco,
        principal: true
      }),
      supabase.from("responsaveis_aluno").insert({
        aluno_id: aluno.id,
        nome: data.responsavel_nome ?? "Responsavel",
        cpf: data.responsavel_cpf,
        telefone: data.responsavel_telefone,
        celular: data.responsavel_celular,
        parentesco: data.responsavel_parentesco,
        email: data.responsavel_email,
        responsavel_financeiro: true,
        responsavel_pedagogico: true
      }),
      supabase.from("informacoes_medicas").insert({ aluno_id: aluno.id }),
      supabase.from("autorizacoes_aluno").insert({ aluno_id: aluno.id })
    ]);

    const dataMatricula = data.data_matricula ?? new Date().toISOString().slice(0, 10);
    const anoLetivo = data.ano_letivo ?? new Date().getFullYear();
    const { data: enrollment } = await supabase
      .from("matriculas")
      .insert({
        escola_id: DEFAULT_SCHOOL_ID,
        aluno_id: aluno.id,
        serie_id: serie.id,
        turma_id: turma.id,
        plano_id: plano?.id ?? null,
        codigo: `${data.matricula_codigo}-${anoLetivo}`,
        data_matricula: dataMatricula,
        ano_letivo: anoLetivo,
        idade_na_matricula: data.idade_na_matricula,
        status: "ativa",
        observacoes: `Importado do lote ${arquivoId}`
      })
      .select("id")
      .single();

    if (enrollment) {
      await generateChargesForEnrollment({
        supabase,
        escolaId: DEFAULT_SCHOOL_ID,
        alunoId: aluno.id,
        matriculaId: enrollment.id,
        planoId: plano?.id ?? null,
        dataMatricula,
        anoLetivo
      });
    }

    await supabase.from("importacao_alunos_linhas").update({ status: "importado", erros: [], aluno_id: aluno.id }).eq("id", row.id);
  }

  const { data: remaining } = await supabase
    .from("importacao_alunos_linhas")
    .select("id, status")
    .eq("arquivo_id", arquivoId)
    .eq("escola_id", DEFAULT_SCHOOL_ID);
  const statuses = remaining ?? [];
  const finalStatus = statuses.length > 0 && statuses.every((row) => row.status === "importado") ? "processado" : "pendente";

  await supabase.from("arquivos_importados").update({ status: finalStatus }).eq("id", arquivoId).eq("escola_id", DEFAULT_SCHOOL_ID);

  revalidatePath(`/importacoes/${arquivoId}`);
  revalidatePath("/importacoes");
  revalidatePath("/alunos");
  revalidatePath("/matriculas");
  revalidatePath("/financeiro");
}

export async function markImportProcessedAction(formData: FormData) {
  await requirePermission("importacoes", "update");
  const id = formText(formData, "id");
  const status = formText(formData, "status");
  if (!id || !status) return;

  const supabase = await createServerClient();
  await supabase
    .from("arquivos_importados")
    .update({ status })
    .eq("id", id)
    .eq("escola_id", DEFAULT_SCHOOL_ID);

  revalidatePath("/importacoes");
  revalidatePath(`/importacoes/${id}`);
}
