"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth/session";
import { DEFAULT_SCHOOL_ID } from "@/lib/constants";
import { generateChargesForEnrollment } from "@/lib/server/generate-charges";
import { createServerClient } from "@/lib/supabase/server";
import { formBoolean, formNumber, formText } from "@/lib/utils";
import { assertOk } from "@/lib/actions/assert-ok";
import type { ActionResult } from "@/lib/actions/types";

type TipoVagaInput =
  | "NORMAL"
  | "BOLSA_50_PORCENTO"
  | "BOLSA_INTEGRAL"
  | "FILHO_PROFESSORA"
  | "FILHO_PROFESSORA_INTEGRAL"
  | "PERMUTA"
  | "ISENTO";

function readTipoVaga(formData: FormData): TipoVagaInput {
  const raw = formText(formData, "tipo_vaga");
  const valid: TipoVagaInput[] = [
    "NORMAL",
    "BOLSA_50_PORCENTO",
    "BOLSA_INTEGRAL",
    "FILHO_PROFESSORA",
    "FILHO_PROFESSORA_INTEGRAL",
    "PERMUTA",
    "ISENTO",
  ];
  if (raw && (valid as string[]).includes(raw)) return raw as TipoVagaInput;
  return "NORMAL";
}

/** BOLSA_50_PORCENTO é sempre 50% fixo; os demais tipos não têm percentual. */
function readPercentualBolsa(_formData: FormData, tipo: TipoVagaInput): number {
  return tipo === "BOLSA_50_PORCENTO" ? 50 : 0;
}

export async function createStudentAction(formData: FormData) {
  await requirePermission("alunos", "create");
  const supabase = await createServerClient();
  const nome = formText(formData, "nome");
  const matricula = formText(formData, "matricula_codigo");

  if (!nome || !matricula) throw new Error("Nome e matricula sao obrigatorios.");

  const { data: aluno, error } = await supabase
    .from("alunos")
    .insert({
      escola_id: DEFAULT_SCHOOL_ID,
      matricula_codigo: matricula,
      nome,
      sexo: formText(formData, "sexo"),
      data_nascimento: formText(formData, "data_nascimento"),
      naturalidade: formText(formData, "naturalidade"),
      celular: formText(formData, "celular"),
      cpf: formText(formData, "cpf"),
      rg: formText(formData, "rg"),
      certidao_nascimento: formText(formData, "certidao_nascimento"),
      certidao_livro: formText(formData, "certidao_livro"),
      certidao_folha: formText(formData, "certidao_folha"),
      certidao_numero: formText(formData, "certidao_numero"),
      certidao_cartorio: formText(formData, "certidao_cartorio"),
      email: formText(formData, "email"),
      codigo_inep: formText(formData, "codigo_inep"),
      etnia: formText(formData, "etnia"),
      informacoes_adicionais: formText(formData, "informacoes_adicionais"),
      disciplina_eletiva: formText(formData, "disciplina_eletiva"),
      foto_url: formText(formData, "foto_url")
    })
    .select("id")
    .single();

  if (error) throw error;
  const alunoId = aluno.id;

  await Promise.all([
    supabase.from("enderecos_aluno").insert({
      aluno_id: alunoId,
      logradouro: formText(formData, "logradouro") ?? "Nao informado",
      numero: formText(formData, "numero"),
      complemento: formText(formData, "complemento"),
      bairro: formText(formData, "bairro"),
      cidade: formText(formData, "cidade"),
      uf: formText(formData, "uf"),
      cep: formText(formData, "cep"),
      principal: true
    }),
    supabase.from("contatos_aluno").insert({
      aluno_id: alunoId,
      nome: formText(formData, "contato_nome") ?? "Contato",
      telefone: formText(formData, "contato_telefone"),
      celular: formText(formData, "contato_celular"),
      parentesco: formText(formData, "contato_parentesco"),
      principal: true
    }),
    supabase.from("responsaveis_aluno").insert({
      aluno_id: alunoId,
      nome: formText(formData, "responsavel_nome") ?? "Responsavel",
      cpf: formText(formData, "responsavel_cpf"),
      telefone: formText(formData, "responsavel_telefone"),
      celular: formText(formData, "responsavel_celular"),
      parentesco: formText(formData, "responsavel_parentesco"),
      email: formText(formData, "responsavel_email"),
      responsavel_financeiro: true,
      responsavel_pedagogico: true
    }),
    supabase.from("informacoes_medicas").insert({
      aluno_id: alunoId,
      alergia: formBoolean(formData, "alergia"),
      necessidade_especial: formBoolean(formData, "necessidade_especial"),
      necessita_apoio: formBoolean(formData, "necessita_apoio"),
      doenca_grave: formBoolean(formData, "doenca_grave"),
      remedio_especial: formBoolean(formData, "remedio_especial"),
      tipo_sanguineo: formText(formData, "tipo_sanguineo"),
      medico: formText(formData, "medico"),
      telefone_medico: formText(formData, "telefone_medico"),
      plano_saude: formText(formData, "plano_saude"),
      telefone_plano: formText(formData, "telefone_plano")
    }),
    supabase.from("autorizacoes_aluno").insert({
      aluno_id: alunoId,
      nao_entregar_boletim: formBoolean(formData, "nao_entregar_boletim"),
      assinar_comunicados: formBoolean(formData, "assinar_comunicados"),
      requerer_prova_substitutiva: formBoolean(formData, "requerer_prova_substitutiva")
    })
  ]);

  const serieId = formText(formData, "serie_id");
  const turmaId = formText(formData, "turma_id");
  if (serieId && turmaId) {
    const planoId = formText(formData, "plano_id");
    const dataMatricula = formText(formData, "data_matricula") ?? new Date().toISOString().slice(0, 10);
    const anoLetivo = formNumber(formData, "ano_letivo") ?? new Date().getFullYear();
    const tipoVaga = readTipoVaga(formData);
    const percentualBolsa = readPercentualBolsa(formData, tipoVaga);

    // Sem o assertOk, uma matrícula recusada devolvia `enrollment` null, o
    // `if` abaixo pulava a geração de cobranças e a tela confirmava a
    // matrícula: aluno sem matrícula e sem cobrança, ninguém avisado.
    const enrollment = assertOk(await supabase.from("matriculas").insert({
      escola_id: DEFAULT_SCHOOL_ID,
      aluno_id: alunoId,
      serie_id: serieId,
      turma_id: turmaId,
      plano_id: planoId,
      codigo: `${matricula}-${new Date().getFullYear()}`,
      data_matricula: dataMatricula,
      ano_letivo: anoLetivo,
      idade_na_matricula: formNumber(formData, "idade_na_matricula"),
      status: "ativa",
      tipo_vaga: tipoVaga,
      percentual_bolsa: percentualBolsa
    }).select("id").single(), "Não foi possível criar a matrícula");

    if (enrollment) {
      await generateChargesForEnrollment({
        supabase,
        escolaId: DEFAULT_SCHOOL_ID,
        alunoId,
        matriculaId: enrollment.id,
        planoId,
        dataMatricula,
        anoLetivo,
        tipoVaga,
        percentualBolsa
      });
    }
  }

  revalidatePath("/alunos");
  revalidatePath("/financeiro");
  redirect(`/alunos/${alunoId}`);
}

export async function updateStudentAction(formData: FormData): Promise<ActionResult> {
  await requirePermission("alunos", "update");
  const supabase = await createServerClient();
  const alunoId = formText(formData, "aluno_id");
  // getAll + last: hidden carries the saved value; visible input (aba pessoal) appended after → last wins
  const nomeValues = formData.getAll("nome").map(String).filter(Boolean);
  const matriculaValues = formData.getAll("matricula_codigo").map(String).filter(Boolean);
  const nome = nomeValues[nomeValues.length - 1]?.trim() || null;
  const matricula = matriculaValues[matriculaValues.length - 1]?.trim() || null;

  if (!alunoId || !nome || !matricula) throw new Error("Aluno, nome e matricula sao obrigatorios.");

  const ftab = formText(formData, "ftab") ?? "pessoal";

  // Always update name/matricula (come from hidden inputs on all tabs).
  // Only update pessoal-specific fields when on the pessoal tab — inactive fields are absent
  // from the DOM and would overwrite real data with null.
  const alunosPayload: Record<string, unknown> = { matricula_codigo: matricula, nome };
  if (ftab === "pessoal") {
    Object.assign(alunosPayload, {
      sexo: formText(formData, "sexo"),
      data_nascimento: formText(formData, "data_nascimento"),
      naturalidade: formText(formData, "naturalidade"),
      celular: formText(formData, "celular"),
      cpf: formText(formData, "cpf"),
      rg: formText(formData, "rg"),
      certidao_nascimento: formText(formData, "certidao_nascimento"),
      certidao_livro: formText(formData, "certidao_livro"),
      certidao_folha: formText(formData, "certidao_folha"),
      certidao_numero: formText(formData, "certidao_numero"),
      certidao_cartorio: formText(formData, "certidao_cartorio"),
      email: formText(formData, "email"),
      codigo_inep: formText(formData, "codigo_inep"),
      etnia: formText(formData, "etnia"),
      informacoes_adicionais: formText(formData, "informacoes_adicionais"),
      disciplina_eletiva: formText(formData, "disciplina_eletiva"),
    });
  }

  const { error } = await supabase
    .from("alunos")
    .update(alunosPayload)
    .eq("id", alunoId)
    .eq("escola_id", DEFAULT_SCHOOL_ID);

  if (error) throw error;

  const enderecoId   = formText(formData, "endereco_id");
  const contatoId    = formText(formData, "contato_id");
  const responsavelId = formText(formData, "responsavel_id");
  const paiId        = formText(formData, "pai_id");
  const maeId        = formText(formData, "mae_id");

  // Only run DB operations that belong to the active tab.
  // Fields from inactive tabs are absent from the DOM → FormData → must not be written.
  // Wrap in Promise.resolve() because PostgrestFilterBuilder is thenable but not a full Promise.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const q = (builder: any) => Promise.resolve(builder) as Promise<{ error: unknown }>;
  const ops: Promise<{ error: unknown }>[] = [];

  if (ftab === "endereco") {
    const payload = {
      aluno_id: alunoId,
      logradouro: formText(formData, "logradouro"),
      numero: formText(formData, "numero"),
      complemento: formText(formData, "complemento"),
      bairro: formText(formData, "bairro"),
      cidade: formText(formData, "cidade"),
      uf: formText(formData, "uf"),
      cep: formText(formData, "cep"),
      principal: true,
    };
    ops.push(q(
      enderecoId
        ? supabase.from("enderecos_aluno").update(payload).eq("id", enderecoId).eq("aluno_id", alunoId)
        : supabase.from("enderecos_aluno").insert(payload)
    ));
  }

  if (ftab === "responsavel") {
    const contatoNome = formText(formData, "contato_nome");
    if (contatoNome) {
      const contatoPayload = {
        aluno_id: alunoId,
        nome: contatoNome,
        telefone: formText(formData, "contato_telefone"),
        celular: formText(formData, "contato_celular"),
        parentesco: formText(formData, "contato_parentesco"),
        principal: true,
      };
      ops.push(q(
        contatoId
          ? supabase.from("contatos_aluno").update(contatoPayload).eq("id", contatoId).eq("aluno_id", alunoId)
          : supabase.from("contatos_aluno").insert(contatoPayload)
      ));
    }

    const paiNome = formText(formData, "pai_nome");
    if (paiNome) {
      const paiPayload = {
        aluno_id: alunoId,
        nome: paiNome,
        rg: formText(formData, "pai_rg"),
        cpf: formText(formData, "pai_cpf"),
        telefone: formText(formData, "pai_telefone"),
        celular: formText(formData, "pai_celular"),
        email: formText(formData, "pai_email"),
        parentesco: "Pai",
      };
      ops.push(q(
        paiId
          ? supabase.from("responsaveis_aluno").update(paiPayload).eq("id", paiId).eq("aluno_id", alunoId)
          : supabase.from("responsaveis_aluno").insert(paiPayload)
      ));
    }

    const maeNome = formText(formData, "mae_nome");
    if (maeNome) {
      const maePayload = {
        aluno_id: alunoId,
        nome: maeNome,
        rg: formText(formData, "mae_rg"),
        cpf: formText(formData, "mae_cpf"),
        telefone: formText(formData, "mae_telefone"),
        celular: formText(formData, "mae_celular"),
        email: formText(formData, "mae_email"),
        parentesco: "Mãe",
      };
      ops.push(q(
        maeId
          ? supabase.from("responsaveis_aluno").update(maePayload).eq("id", maeId).eq("aluno_id", alunoId)
          : supabase.from("responsaveis_aluno").insert(maePayload)
      ));
    }

    const respNome = formText(formData, "responsavel_nome");
    if (respNome) {
      const responsavelPayload = {
        aluno_id: alunoId,
        nome: respNome,
        cpf: formText(formData, "responsavel_cpf"),
        telefone: formText(formData, "responsavel_telefone"),
        celular: formText(formData, "responsavel_celular"),
        parentesco: formText(formData, "responsavel_parentesco"),
        email: formText(formData, "responsavel_email"),
        responsavel_financeiro: true,
        responsavel_pedagogico: true,
      };
      ops.push(q(
        responsavelId
          ? supabase.from("responsaveis_aluno").update(responsavelPayload).eq("id", responsavelId).eq("aluno_id", alunoId)
          : supabase.from("responsaveis_aluno").insert(responsavelPayload)
      ));
    }
  }

  if (ftab === "medico") {
    ops.push(q(
      supabase.from("informacoes_medicas").upsert(
        {
          aluno_id: alunoId,
          alergia: formBoolean(formData, "alergia"),
          necessidade_especial: formBoolean(formData, "necessidade_especial"),
          necessita_apoio: formBoolean(formData, "necessita_apoio"),
          doenca_grave: formBoolean(formData, "doenca_grave"),
          remedio_especial: formBoolean(formData, "remedio_especial"),
          tipo_sanguineo: formText(formData, "tipo_sanguineo"),
          medico: formText(formData, "medico"),
          telefone_medico: formText(formData, "telefone_medico"),
          plano_saude: formText(formData, "plano_saude"),
          telefone_plano: formText(formData, "telefone_plano"),
        },
        { onConflict: "aluno_id" }
      )
    ));
  }

  if (ftab === "autorizacoes") {
    ops.push(q(
      supabase.from("autorizacoes_aluno").upsert(
        {
          aluno_id: alunoId,
          nao_entregar_boletim: formBoolean(formData, "nao_entregar_boletim"),
          assinar_comunicados: formBoolean(formData, "assinar_comunicados"),
          requerer_prova_substitutiva: formBoolean(formData, "requerer_prova_substitutiva"),
        },
        { onConflict: "aluno_id" }
      )
    ));
  }

  const relatedResults = await Promise.all(ops);
  const firstError = relatedResults.find((r) => r && "error" in r && r.error);
  if (firstError && "error" in firstError && firstError.error) throw firstError.error;

  revalidatePath("/alunos");
  revalidatePath(`/alunos/${alunoId}`);
  revalidatePath(`/alunos/${alunoId}/editar`);
  return {
    ok: true,
    data: undefined,
    redirectTo: `/alunos/${alunoId}/editar?ftab=${ftab}`,
  };
}

export async function toggleStudentAction(formData: FormData) {
  await requirePermission("alunos", "update");
  const alunoId = formText(formData, "aluno_id");
  const ativo = formBoolean(formData, "ativo");
  if (!alunoId) return;

  const supabase = await createServerClient();
  await supabase
    .from("alunos")
    .update({ ativo })
    .eq("id", alunoId)
    .eq("escola_id", DEFAULT_SCHOOL_ID);

  revalidatePath("/alunos");
  revalidatePath(`/alunos/${alunoId}`);
}

export async function addStudentAddressAction(formData: FormData) {
  await requirePermission("alunos", "update");
  const alunoId = formText(formData, "aluno_id");
  const logradouro = formText(formData, "logradouro");
  if (!alunoId || !logradouro) return;

  const supabase = await createServerClient();
  assertOk(await supabase.from("enderecos_aluno").insert({
    aluno_id: alunoId,
    logradouro,
    numero: formText(formData, "numero"),
    complemento: formText(formData, "complemento"),
    bairro: formText(formData, "bairro"),
    cidade: formText(formData, "cidade"),
    uf: formText(formData, "uf"),
    cep: formText(formData, "cep"),
    principal: false
  }), "Não foi possível salvar o endereço");

  revalidatePath(`/alunos/${alunoId}`);
  revalidatePath(`/alunos/${alunoId}/editar`);
}

export async function addStudentContactAction(formData: FormData) {
  await requirePermission("alunos", "update");
  const alunoId = formText(formData, "aluno_id");
  const nome = formText(formData, "nome");
  if (!alunoId || !nome) return;

  const supabase = await createServerClient();
  assertOk(await supabase.from("contatos_aluno").insert({
    aluno_id: alunoId,
    nome,
    telefone: formText(formData, "telefone"),
    celular: formText(formData, "celular"),
    parentesco: formText(formData, "parentesco"),
    observacao: formText(formData, "observacao"),
    principal: false
  }), "Não foi possível salvar o contato");

  revalidatePath(`/alunos/${alunoId}`);
  revalidatePath(`/alunos/${alunoId}/editar`);
}

export async function addStudentGuardianAction(formData: FormData) {
  await requirePermission("alunos", "update");
  const alunoId = formText(formData, "aluno_id");
  const nome = formText(formData, "nome");
  if (!alunoId || !nome) return;

  const supabase = await createServerClient();
  assertOk(await supabase.from("responsaveis_aluno").insert({
    aluno_id: alunoId,
    nome,
    cpf: formText(formData, "cpf"),
    telefone: formText(formData, "telefone"),
    celular: formText(formData, "celular"),
    parentesco: formText(formData, "parentesco"),
    email: formText(formData, "email"),
    responsavel_financeiro: formBoolean(formData, "responsavel_financeiro"),
    responsavel_pedagogico: formBoolean(formData, "responsavel_pedagogico")
  }), "Não foi possível salvar o responsável");

  revalidatePath(`/alunos/${alunoId}`);
  revalidatePath(`/alunos/${alunoId}/editar`);
}

export async function addStudentAuthorizedPersonAction(formData: FormData) {
  await requirePermission("alunos", "update");
  const alunoId = formText(formData, "aluno_id");
  const nome = formText(formData, "nome");
  if (!alunoId || !nome) return;

  const supabase = await createServerClient();
  assertOk(await supabase.from("pessoas_autorizadas").insert({
    aluno_id: alunoId,
    nome,
    telefone: formText(formData, "telefone"),
    documento: formText(formData, "documento"),
    observacao: formText(formData, "observacao"),
    ativo: true
  }), "Não foi possível salvar a pessoa autorizada");

  revalidatePath(`/alunos/${alunoId}`);
  revalidatePath(`/alunos/${alunoId}/editar`);
}

export async function removeStudentRelatedRecordAction(formData: FormData) {
  await requirePermission("alunos", "update");
  const alunoId = formText(formData, "aluno_id");
  const table = formText(formData, "table");
  const id = formText(formData, "id");
  if (!alunoId || !table || !id) return;

  const allowedTables = new Set(["enderecos_aluno", "contatos_aluno", "responsaveis_aluno", "pessoas_autorizadas"]);
  if (!allowedTables.has(table)) return;

  const supabase = await createServerClient();
  assertOk(
    await supabase.from(table).delete().eq("id", id).eq("aluno_id", alunoId),
    "Não foi possível remover o registro",
  );

  revalidatePath(`/alunos/${alunoId}`);
  revalidatePath(`/alunos/${alunoId}/editar`);
}

export async function deleteStudentAction(formData: FormData) {
  await requirePermission("alunos", "delete");
  const alunoId = formText(formData, "aluno_id");
  if (!alunoId) return;

  const supabase = await createServerClient();
  await supabase
    .from("alunos")
    .delete()
    .eq("id", alunoId)
    .eq("escola_id", DEFAULT_SCHOOL_ID);

  revalidatePath("/alunos");
  redirect("/alunos");
}

export async function uploadStudentPhotoAction(formData: FormData) {
  await requirePermission("alunos", "update");
  const alunoId = formText(formData, "aluno_id");
  const file = formData.get("foto");
  if (!alunoId || !(file instanceof File) || file.size === 0) return;

  const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
  if (!allowedTypes.has(file.type)) throw new Error("Envie uma imagem JPG, PNG ou WEBP.");

  const supabase = await createServerClient();
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const storagePath = `${alunoId}/${Date.now()}.${extension}`;
  const bytes = Buffer.from(await file.arrayBuffer());

  const { data: uploaded, error: uploadError } = await supabase.storage.from("alunos-fotos").upload(storagePath, bytes, {
    contentType: file.type,
    upsert: false
  });

  if (uploadError) throw uploadError;

  await supabase
    .from("alunos")
    .update({ foto_url: uploaded?.path ?? storagePath })
    .eq("id", alunoId)
    .eq("escola_id", DEFAULT_SCHOOL_ID);

  revalidatePath(`/alunos/${alunoId}`);
  revalidatePath(`/alunos/${alunoId}/editar`);
}
