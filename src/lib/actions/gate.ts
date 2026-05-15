"use server";

import { revalidatePath } from "next/cache";
import { DEFAULT_SCHOOL_ID } from "@/lib/constants";
import { registerGateEvent } from "@/lib/server/gate-events";
import { sendGuardianNotification } from "@/lib/server/guardian-notifications";
import { createAdminClient } from "@/lib/supabase/admin";
import { formBoolean, formNumber, formText } from "@/lib/utils";

export async function registerGateEventAction(formData: FormData) {
  const alunoId = formText(formData, "aluno_id");
  const deviceId = formText(formData, "dispositivo_id");
  const type = formText(formData, "tipo");
  const origin = formText(formData, "origem") ?? "manual";
  if (!alunoId || !type) return;

  await registerGateEvent({
    alunoId,
    tipo: type === "saida" ? "saida" : "entrada",
    dispositivoId: deviceId,
    origem: origin === "facial" || origin === "facial_simulado" ? origin : "manual",
    confianca: formNumber(formData, "confianca"),
    observacao: formText(formData, "observacao")
  });

  revalidatePath("/portaria");
  revalidatePath("/frequencias");
  revalidatePath(`/alunos/${alunoId}/editar`);
}

export async function saveStudentGateSettingsAction(formData: FormData) {
  const alunoId = formText(formData, "aluno_id");
  if (!alunoId) return;

  const supabase = createAdminClient();
  const authorized = formBoolean(formData, "autorizado");
  const guardianId = formText(formData, "responsavel_id");

  await supabase.from("consentimentos_biometria").upsert(
    {
      aluno_id: alunoId,
      autorizado: authorized,
      responsavel_id: guardianId,
      data_consentimento: authorized ? new Date().toISOString() : null,
      data_revogacao: authorized ? null : new Date().toISOString(),
      observacao: formText(formData, "observacao")
    },
    { onConflict: "aluno_id" }
  );

  await supabase.from("preferencias_notificacao_aluno").upsert(
    {
      aluno_id: alunoId,
      responsavel_id: guardianId,
      canal: "whatsapp",
      telefone_destino: formText(formData, "telefone_destino"),
      notificar_entrada: formBoolean(formData, "notificar_entrada"),
      notificar_saida: formBoolean(formData, "notificar_saida"),
      ativo: formBoolean(formData, "notificacao_ativa")
    },
    { onConflict: "aluno_id,canal" }
  );

  revalidatePath(`/alunos/${alunoId}/editar`);
}

export async function uploadStudentFaceReferenceAction(formData: FormData) {
  const alunoId = formText(formData, "aluno_id");
  const file = formData.get("foto_referencia");
  if (!alunoId || !(file instanceof File) || file.size === 0) return;

  const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
  if (!allowedTypes.has(file.type)) throw new Error("Envie uma imagem JPG, PNG ou WEBP.");

  const supabase = createAdminClient();
  const consent = await supabase.from("consentimentos_biometria").select("autorizado").eq("aluno_id", alunoId).maybeSingle();
  if (consent.error) throw consent.error;
  if (!consent.data?.autorizado) throw new Error("Autorize a biometria antes de cadastrar a referencia facial.");

  const extension = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const storagePath = `${alunoId}/${Date.now()}-referencia.${extension}`;
  const bytes = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await supabase.storage.from("biometrias-alunos").upload(storagePath, bytes, {
    contentType: file.type,
    upsert: false
  });
  if (uploadError) throw uploadError;

  const modelo = formText(formData, "modelo") ?? "captura-web-v1";

  const { error: upsertError } = await supabase.from("biometrias_aluno").upsert(
    {
      aluno_id: alunoId,
      modelo,
      foto_referencia_path: storagePath,
      ativo: true,
      criado_por: "operador",
      data_cadastro: new Date().toISOString(),
      data_revogacao: null,
      observacao: formText(formData, "observacao")
    },
    { onConflict: "aluno_id,modelo" }
  );
  if (upsertError) throw upsertError;

  revalidatePath(`/alunos/${alunoId}/editar`);
}

export async function deactivateStudentFaceReferenceAction(formData: FormData) {
  const alunoId = formText(formData, "aluno_id");
  const id = formText(formData, "biometria_id");
  if (!alunoId || !id) return;

  await createAdminClient()
    .from("biometrias_aluno")
    .update({ ativo: false, data_revogacao: new Date().toISOString() })
    .eq("id", id)
    .eq("aluno_id", alunoId);

  revalidatePath(`/alunos/${alunoId}/editar`);
}

export async function createGateDeviceAction(formData: FormData) {
  const nome = formText(formData, "nome");
  if (!nome) return;

  await createAdminClient().from("dispositivos_acesso").insert({
    escola_id: DEFAULT_SCHOOL_ID,
    nome,
    local: formText(formData, "local"),
    tipo: formText(formData, "tipo") ?? "portaria",
    ativo: true
  });

  revalidatePath("/portaria");
  revalidatePath("/portaria/dispositivos");
}

export async function updateGateDeviceAction(formData: FormData) {
  const id = formText(formData, "id");
  const nome = formText(formData, "nome");
  if (!id || !nome) return;

  await createAdminClient()
    .from("dispositivos_acesso")
    .update({
      nome,
      local: formText(formData, "local"),
      tipo: formText(formData, "tipo") ?? "portaria",
      ativo: formBoolean(formData, "ativo")
    })
    .eq("id", id)
    .eq("escola_id", DEFAULT_SCHOOL_ID);

  revalidatePath("/portaria");
  revalidatePath("/portaria/dispositivos");
  revalidatePath("/portaria/camera");
}

export async function toggleGateDeviceAction(formData: FormData) {
  const id = formText(formData, "id");
  if (!id) return;

  await createAdminClient()
    .from("dispositivos_acesso")
    .update({ ativo: formBoolean(formData, "ativo") })
    .eq("id", id)
    .eq("escola_id", DEFAULT_SCHOOL_ID);

  revalidatePath("/portaria");
  revalidatePath("/portaria/dispositivos");
  revalidatePath("/portaria/camera");
}

export async function retryGuardianNotificationAction(formData: FormData) {
  const id = formText(formData, "notificacao_id");
  if (!id) return;

  const supabase = createAdminClient();
  const { data: notification, error } = await supabase
    .from("notificacoes_responsavel")
    .select("id, canal, telefone_destino, mensagem, aluno_id, evento_acesso_id")
    .eq("id", id)
    .eq("escola_id", DEFAULT_SCHOOL_ID)
    .single();

  if (error || !notification) throw error ?? new Error("Notificacao nao encontrada.");

  await supabase.from("notificacoes_responsavel").update({ status: "pendente", erro: null }).eq("id", notification.id);

  const result = await sendGuardianNotification({
    notificationId: notification.id,
    canal: notification.canal,
    telefoneDestino: notification.telefone_destino,
    mensagem: notification.mensagem,
    alunoId: notification.aluno_id,
    eventoAcessoId: notification.evento_acesso_id
  });

  await supabase
    .from("notificacoes_responsavel")
    .update({
      status: result.status,
      provider_message_id: result.providerMessageId ?? null,
      erro: result.erro ?? null
    })
    .eq("id", notification.id);

  revalidatePath("/portaria");
  revalidatePath("/portaria/notificacoes");
  revalidatePath(`/alunos/${notification.aluno_id}/editar`);
}
