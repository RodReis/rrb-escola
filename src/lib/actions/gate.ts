"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/session";
import { DEFAULT_SCHOOL_ID } from "@/lib/constants";
import { registerGateEvent } from "@/lib/server/gate-events";
import { createServerClient } from "@/lib/supabase/server";
import { formBoolean, formNumber, formText } from "@/lib/utils";

export async function registerGateEventAction(formData: FormData) {
  await requirePermission("portaria", "create");
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
  await requirePermission("portaria", "update");
  const alunoId = formText(formData, "aluno_id");
  if (!alunoId) return;

  const supabase = await createServerClient();
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

export async function createGateDeviceAction(formData: FormData) {
  await requirePermission("portaria", "create");
  const nome = formText(formData, "nome");
  if (!nome) return;

  const supabase = await createServerClient();
  await supabase.from("dispositivos_acesso").insert({
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
  await requirePermission("portaria", "update");
  const id = formText(formData, "id");
  const nome = formText(formData, "nome");
  if (!id || !nome) return;

  const supabase = await createServerClient();
  await supabase
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
  await requirePermission("portaria", "update");
  const id = formText(formData, "id");
  if (!id) return;

  const supabase = await createServerClient();
  await supabase
    .from("dispositivos_acesso")
    .update({ ativo: formBoolean(formData, "ativo") })
    .eq("id", id)
    .eq("escola_id", DEFAULT_SCHOOL_ID);

  revalidatePath("/portaria");
  revalidatePath("/portaria/dispositivos");
  revalidatePath("/portaria/camera");
}

