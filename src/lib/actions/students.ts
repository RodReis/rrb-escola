"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { DEFAULT_SCHOOL_ID } from "@/lib/constants";
import { generateChargesForEnrollment } from "@/lib/server/generate-charges";
import { createAdminClient } from "@/lib/supabase/admin";
import { formBoolean, formNumber, formText } from "@/lib/utils";

export async function createStudentAction(formData: FormData) {
  const supabase = createAdminClient();
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
    const { data: enrollment } = await supabase.from("matriculas").insert({
      escola_id: DEFAULT_SCHOOL_ID,
      aluno_id: alunoId,
      serie_id: serieId,
      turma_id: turmaId,
      plano_id: planoId,
      codigo: `${matricula}-${new Date().getFullYear()}`,
      data_matricula: dataMatricula,
      ano_letivo: anoLetivo,
      idade_na_matricula: formNumber(formData, "idade_na_matricula"),
      status: "ativa"
    }).select("id").single();

    if (enrollment) {
      await generateChargesForEnrollment({
        supabase,
        escolaId: DEFAULT_SCHOOL_ID,
        alunoId,
        matriculaId: enrollment.id,
        planoId,
        dataMatricula,
        anoLetivo
      });
    }
  }

  revalidatePath("/alunos");
  revalidatePath("/financeiro");
  redirect(`/alunos/${alunoId}`);
}

export async function updateStudentAction(formData: FormData) {
  const supabase = createAdminClient();
  const alunoId = formText(formData, "aluno_id");
  const nome = formText(formData, "nome");
  const matricula = formText(formData, "matricula_codigo");

  if (!alunoId || !nome || !matricula) throw new Error("Aluno, nome e matricula sao obrigatorios.");

  const { error } = await supabase
    .from("alunos")
    .update({
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
      foto_url: formText(formData, "foto_url")
    })
    .eq("id", alunoId)
    .eq("escola_id", DEFAULT_SCHOOL_ID);

  if (error) throw error;

  const enderecoId = formText(formData, "endereco_id");
  const contatoId = formText(formData, "contato_id");
  const responsavelId = formText(formData, "responsavel_id");

  const enderecoPayload = {
    aluno_id: alunoId,
    logradouro: formText(formData, "logradouro") ?? "Nao informado",
    numero: formText(formData, "numero"),
    complemento: formText(formData, "complemento"),
    bairro: formText(formData, "bairro"),
    cidade: formText(formData, "cidade"),
    uf: formText(formData, "uf"),
    cep: formText(formData, "cep"),
    principal: true
  };

  const contatoPayload = {
    aluno_id: alunoId,
    nome: formText(formData, "contato_nome") ?? "Contato",
    telefone: formText(formData, "contato_telefone"),
    celular: formText(formData, "contato_celular"),
    parentesco: formText(formData, "contato_parentesco"),
    principal: true
  };

  const responsavelPayload = {
    aluno_id: alunoId,
    nome: formText(formData, "responsavel_nome") ?? "Responsavel",
    cpf: formText(formData, "responsavel_cpf"),
    telefone: formText(formData, "responsavel_telefone"),
    celular: formText(formData, "responsavel_celular"),
    parentesco: formText(formData, "responsavel_parentesco"),
    email: formText(formData, "responsavel_email"),
    responsavel_financeiro: true,
    responsavel_pedagogico: true
  };

  await Promise.all([
    enderecoId
      ? supabase.from("enderecos_aluno").update(enderecoPayload).eq("id", enderecoId).eq("aluno_id", alunoId)
      : supabase.from("enderecos_aluno").insert(enderecoPayload),
    contatoId
      ? supabase.from("contatos_aluno").update(contatoPayload).eq("id", contatoId).eq("aluno_id", alunoId)
      : supabase.from("contatos_aluno").insert(contatoPayload),
    responsavelId
      ? supabase.from("responsaveis_aluno").update(responsavelPayload).eq("id", responsavelId).eq("aluno_id", alunoId)
      : supabase.from("responsaveis_aluno").insert(responsavelPayload),
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
        telefone_plano: formText(formData, "telefone_plano")
      },
      { onConflict: "aluno_id" }
    ),
    supabase.from("autorizacoes_aluno").upsert(
      {
        aluno_id: alunoId,
        nao_entregar_boletim: formBoolean(formData, "nao_entregar_boletim"),
        assinar_comunicados: formBoolean(formData, "assinar_comunicados"),
        requerer_prova_substitutiva: formBoolean(formData, "requerer_prova_substitutiva")
      },
      { onConflict: "aluno_id" }
    )
  ]);

  revalidatePath("/alunos");
  revalidatePath(`/alunos/${alunoId}`);
  redirect(`/alunos/${alunoId}`);
}

export async function toggleStudentAction(formData: FormData) {
  const alunoId = formText(formData, "aluno_id");
  const ativo = formBoolean(formData, "ativo");
  if (!alunoId) return;

  await createAdminClient()
    .from("alunos")
    .update({ ativo })
    .eq("id", alunoId)
    .eq("escola_id", DEFAULT_SCHOOL_ID);

  revalidatePath("/alunos");
  revalidatePath(`/alunos/${alunoId}`);
}

export async function addStudentAddressAction(formData: FormData) {
  const alunoId = formText(formData, "aluno_id");
  const logradouro = formText(formData, "logradouro");
  if (!alunoId || !logradouro) return;

  await createAdminClient().from("enderecos_aluno").insert({
    aluno_id: alunoId,
    logradouro,
    numero: formText(formData, "numero"),
    complemento: formText(formData, "complemento"),
    bairro: formText(formData, "bairro"),
    cidade: formText(formData, "cidade"),
    uf: formText(formData, "uf"),
    cep: formText(formData, "cep"),
    principal: false
  });

  revalidatePath(`/alunos/${alunoId}`);
  revalidatePath(`/alunos/${alunoId}/editar`);
}

export async function addStudentContactAction(formData: FormData) {
  const alunoId = formText(formData, "aluno_id");
  const nome = formText(formData, "nome");
  if (!alunoId || !nome) return;

  await createAdminClient().from("contatos_aluno").insert({
    aluno_id: alunoId,
    nome,
    telefone: formText(formData, "telefone"),
    celular: formText(formData, "celular"),
    parentesco: formText(formData, "parentesco"),
    observacao: formText(formData, "observacao"),
    principal: false
  });

  revalidatePath(`/alunos/${alunoId}`);
  revalidatePath(`/alunos/${alunoId}/editar`);
}

export async function addStudentGuardianAction(formData: FormData) {
  const alunoId = formText(formData, "aluno_id");
  const nome = formText(formData, "nome");
  if (!alunoId || !nome) return;

  await createAdminClient().from("responsaveis_aluno").insert({
    aluno_id: alunoId,
    nome,
    cpf: formText(formData, "cpf"),
    telefone: formText(formData, "telefone"),
    celular: formText(formData, "celular"),
    parentesco: formText(formData, "parentesco"),
    email: formText(formData, "email"),
    responsavel_financeiro: formBoolean(formData, "responsavel_financeiro"),
    responsavel_pedagogico: formBoolean(formData, "responsavel_pedagogico")
  });

  revalidatePath(`/alunos/${alunoId}`);
  revalidatePath(`/alunos/${alunoId}/editar`);
}

export async function addStudentAuthorizedPersonAction(formData: FormData) {
  const alunoId = formText(formData, "aluno_id");
  const nome = formText(formData, "nome");
  if (!alunoId || !nome) return;

  await createAdminClient().from("pessoas_autorizadas").insert({
    aluno_id: alunoId,
    nome,
    telefone: formText(formData, "telefone"),
    documento: formText(formData, "documento"),
    observacao: formText(formData, "observacao"),
    ativo: true
  });

  revalidatePath(`/alunos/${alunoId}`);
  revalidatePath(`/alunos/${alunoId}/editar`);
}

export async function removeStudentRelatedRecordAction(formData: FormData) {
  const alunoId = formText(formData, "aluno_id");
  const table = formText(formData, "table");
  const id = formText(formData, "id");
  if (!alunoId || !table || !id) return;

  const allowedTables = new Set(["enderecos_aluno", "contatos_aluno", "responsaveis_aluno", "pessoas_autorizadas"]);
  if (!allowedTables.has(table)) return;

  await createAdminClient().from(table).delete().eq("id", id).eq("aluno_id", alunoId);

  revalidatePath(`/alunos/${alunoId}`);
  revalidatePath(`/alunos/${alunoId}/editar`);
}

export async function uploadStudentPhotoAction(formData: FormData) {
  const alunoId = formText(formData, "aluno_id");
  const file = formData.get("foto");
  if (!alunoId || !(file instanceof File) || file.size === 0) return;

  const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
  if (!allowedTypes.has(file.type)) throw new Error("Envie uma imagem JPG, PNG ou WEBP.");

  const supabase = createAdminClient();
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const storagePath = `${alunoId}/${Date.now()}.${extension}`;
  const bytes = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await supabase.storage.from("alunos-fotos").upload(storagePath, bytes, {
    contentType: file.type,
    upsert: false
  });

  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from("alunos-fotos").getPublicUrl(storagePath);
  const fotoUrl = data.publicUrl;

  await supabase
    .from("alunos")
    .update({ foto_url: fotoUrl })
    .eq("id", alunoId)
    .eq("escola_id", DEFAULT_SCHOOL_ID);

  revalidatePath(`/alunos/${alunoId}`);
  revalidatePath(`/alunos/${alunoId}/editar`);
}
