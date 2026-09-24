"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/session";
import { createServerClient } from "@/lib/supabase/server";
import { CancelamentoMatriculaSchema } from "@/lib/validation/cancelamento";
import { formText, formBoolean } from "@/lib/utils";

export async function cancelarMatriculaAction(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  await requirePermission("matriculas", "update");

  const alunoId = formText(formData, "alunoId");
  const isaacRaw = formText(formData, "isaacCanceladoConfirmado");

  const parsed = CancelamentoMatriculaSchema.safeParse({
    matriculaId: formText(formData, "matriculaId"),
    data: formText(formData, "data"),
    motivo: formText(formData, "motivo"),
    obs: formText(formData, "obs") ?? "",
    cienteCoordenacao: formBoolean(formData, "cienteCoordenacao"),
    cienteDiretoria: formBoolean(formData, "cienteDiretoria"),
    isaacCanceladoConfirmado: isaacRaw === undefined || isaacRaw === "" ? null : isaacRaw === "on",
    cobrancaIds: formData.getAll("cobrancaIds").map(String),
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createServerClient();
  const { data, error } = await supabase.rpc("cancelar_matricula", {
    p_matricula_id: parsed.data.matriculaId,
    p_data: parsed.data.data,
    p_motivo: parsed.data.motivo,
    p_obs: parsed.data.obs || null,
    p_ciente_coordenacao: parsed.data.cienteCoordenacao,
    p_ciente_diretoria: parsed.data.cienteDiretoria,
    p_isaac_cancelado_confirmado: parsed.data.isaacCanceladoConfirmado,
    p_cobranca_ids: parsed.data.cobrancaIds,
  });

  if (error) return { ok: false, error: "Erro ao cancelar matrícula. Tente novamente." };
  const rpcResult = data as { ok: boolean; error?: string };
  if (!rpcResult.ok) return { ok: false, error: rpcResult.error };

  revalidatePath("/matriculas");
  if (alunoId) {
    revalidatePath(`/alunos/${alunoId}`);
    revalidatePath(`/alunos/${alunoId}/editar`);
  }
  return { ok: true };
}
