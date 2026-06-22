"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/session";
import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  salvarAnamneseSchema,
  mudarStatusAnamneseSchema,
  TRANSICOES_STATUS_ANAMNESE,
  type SalvarAnamneseInput,
  type StatusAnamnese,
} from "@/lib/validation/pipeline";
import type { ActionResult } from "@/lib/actions/pipeline";

export type AnamneseArquivo = {
  id: string;
  nome: string;
  url: string;
  mime_type: string | null;
  created_at: string;
};

export type Anamnese = {
  id: string;
  card_id: string;
  aluno_id: string | null;
  status: StatusAnamnese;
  necessidade_especial: boolean;
  necessidade_especial_descricao: string | null;
  alergias: string | null;
  medicamentos_continuos: string | null;
  restricoes_alimentares: string | null;
  acomp_psicologico: boolean;
  acomp_psicologico_descricao: string | null;
  acomp_fonoaudiologico: boolean;
  acomp_fonoaudiologico_descricao: string | null;
  acomp_psicopedagogico: boolean;
  acomp_psicopedagogico_descricao: string | null;
  historico_desenvolvimento: string | null;
  comportamento_social: string | null;
  rotina_familiar: string | null;
  observacoes_responsaveis: string | null;
  observacoes_coordenacao: string | null;
  consentimento_em: string | null;
  consentimento_por: string | null;
  termo_versao: string | null;
  created_at: string;
  updated_at: string;
};

const BUCKET = "pipeline-anamnese";
const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10MB
const MIME_PERMITIDOS = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

async function gravarLog(
  escola_id: string,
  usuario_id: string,
  card_id: string,
  recurso: "anamnese" | "anamnese_arquivo",
  acao: "read" | "write",
) {
  const admin = createAdminClient();
  await admin.rpc("pipeline_gravar_acesso_log", {
    p_escola_id: escola_id,
    p_usuario_id: usuario_id,
    p_card_id: card_id,
    p_recurso: recurso,
    p_acao: acao,
  });
}

export async function getAnamnese(
  card_id: string,
): Promise<ActionResult<{ anamnese: Anamnese | null; arquivos: AnamneseArquivo[] }>> {
  let session: Awaited<ReturnType<typeof requirePermission>>;
  try {
    session = await requirePermission("pipeline_sensivel", "read");
  } catch {
    return { ok: false, error: "Sem permissão para acessar dados sensíveis" };
  }

  const supabase = await createServerClient();

  const [{ data: anamnese }, { data: arquivos }] = await Promise.all([
    supabase
      .from("pipeline_anamnese")
      .select("*")
      .eq("card_id", card_id)
      .eq("escola_id", session.profile.escola_id)
      .maybeSingle(),
    supabase
      .from("pipeline_anamnese_arquivo")
      .select("id, nome, url, mime_type, created_at")
      .eq("card_id", card_id)
      .eq("escola_id", session.profile.escola_id)
      .order("created_at"),
  ]);

  // Grava log de leitura (fire-and-forget — não bloqueia retorno)
  void gravarLog(
    session.profile.escola_id,
    session.profile.id,
    card_id,
    "anamnese",
    "read",
  );

  return {
    ok: true,
    data: {
      anamnese: anamnese as Anamnese | null,
      arquivos: (arquivos ?? []) as AnamneseArquivo[],
    },
  };
}

export async function salvarAnamnese(
  input: SalvarAnamneseInput,
): Promise<ActionResult> {
  let session: Awaited<ReturnType<typeof requirePermission>>;
  try {
    session = await requirePermission("pipeline_sensivel", "create");
  } catch {
    return { ok: false, error: "Sem permissão para salvar dados sensíveis" };
  }

  const parsed = salvarAnamneseSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Dados inválidos" };
  }

  const data = parsed.data;
  const supabase = await createServerClient();

  // Verifica se anamnese já existe (para determinar status)
  const { data: existente } = await supabase
    .from("pipeline_anamnese")
    .select("id, status")
    .eq("card_id", data.card_id)
    .eq("escola_id", session.profile.escola_id)
    .maybeSingle();

  const statusNovo = existente ? undefined : "em_analise"; // primeira gravação → em_analise

  const payload = {
    escola_id: session.profile.escola_id,
    card_id: data.card_id,
    consentimento_em: data.consentimento_em,
    // Atribuição de consentimento sempre = usuário logado (nunca confiar no cliente)
    consentimento_por: session.profile.id,
    termo_versao: data.termo_versao,
    ...(statusNovo ? { status: statusNovo } : {}),
    necessidade_especial: data.necessidade_especial,
    necessidade_especial_descricao: data.necessidade_especial_descricao,
    alergias: data.alergias,
    medicamentos_continuos: data.medicamentos_continuos,
    restricoes_alimentares: data.restricoes_alimentares,
    acomp_psicologico: data.acomp_psicologico,
    acomp_psicologico_descricao: data.acomp_psicologico_descricao,
    acomp_fonoaudiologico: data.acomp_fonoaudiologico,
    acomp_fonoaudiologico_descricao: data.acomp_fonoaudiologico_descricao,
    acomp_psicopedagogico: data.acomp_psicopedagogico,
    acomp_psicopedagogico_descricao: data.acomp_psicopedagogico_descricao,
    historico_desenvolvimento: data.historico_desenvolvimento,
    comportamento_social: data.comportamento_social,
    rotina_familiar: data.rotina_familiar,
    observacoes_responsaveis: data.observacoes_responsaveis,
    observacoes_coordenacao: data.observacoes_coordenacao,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("pipeline_anamnese")
    .upsert(payload, { onConflict: "card_id" });

  if (error) return { ok: false, error: error.message };

  void gravarLog(
    session.profile.escola_id,
    session.profile.id,
    data.card_id,
    "anamnese",
    "write",
  );

  revalidatePath("/pipeline");
  return { ok: true, data: undefined };
}

export async function mudarStatusAnamnese(
  input: { card_id: string; novo_status: "em_analise" | "concluida" | "requer_atencao" },
): Promise<ActionResult> {
  let session: Awaited<ReturnType<typeof requirePermission>>;
  try {
    session = await requirePermission("pipeline_sensivel", "update");
  } catch {
    return { ok: false, error: "Sem permissão" };
  }

  const parsed = mudarStatusAnamneseSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Dados inválidos" };
  }

  const supabase = await createServerClient();

  const { data: anamnese } = await supabase
    .from("pipeline_anamnese")
    .select("id, status")
    .eq("card_id", parsed.data.card_id)
    .eq("escola_id", session.profile.escola_id)
    .maybeSingle();

  if (!anamnese) return { ok: false, error: "Anamnese não encontrada" };

  const statusAtual = anamnese.status as StatusAnamnese;
  const transicoesPermitidas = TRANSICOES_STATUS_ANAMNESE[statusAtual] ?? [];

  if (!transicoesPermitidas.includes(parsed.data.novo_status)) {
    return {
      ok: false,
      error: `Transição de '${statusAtual}' para '${parsed.data.novo_status}' não permitida`,
    };
  }

  const { error } = await supabase
    .from("pipeline_anamnese")
    .update({ status: parsed.data.novo_status, updated_at: new Date().toISOString() })
    .eq("card_id", parsed.data.card_id)
    .eq("escola_id", session.profile.escola_id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/pipeline");
  return { ok: true, data: undefined };
}

export async function getAnamneseArquivoUrl(
  arquivo_id: string,
): Promise<ActionResult<{ url: string }>> {
  let session: Awaited<ReturnType<typeof requirePermission>>;
  try {
    session = await requirePermission("pipeline_sensivel", "read");
  } catch {
    return { ok: false, error: "Sem permissão" };
  }

  const supabase = await createServerClient();

  const { data: arquivo } = await supabase
    .from("pipeline_anamnese_arquivo")
    .select("id, url, card_id")
    .eq("id", arquivo_id)
    .eq("escola_id", session.profile.escola_id)
    .maybeSingle();

  if (!arquivo) return { ok: false, error: "Arquivo não encontrado" };

  const { data: signed, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(arquivo.url as string, 60);

  if (error || !signed) return { ok: false, error: error?.message ?? "Erro ao gerar URL" };

  void gravarLog(
    session.profile.escola_id,
    session.profile.id,
    arquivo.card_id as string,
    "anamnese_arquivo",
    "read",
  );

  return { ok: true, data: { url: signed.signedUrl } };
}

export async function uploadAnamneseArquivo(
  card_id: string,
  formData: FormData,
): Promise<ActionResult> {
  let session: Awaited<ReturnType<typeof requirePermission>>;
  try {
    session = await requirePermission("pipeline_sensivel", "create");
  } catch {
    return { ok: false, error: "Sem permissão para upload de arquivos sensíveis" };
  }

  const file = formData.get("file");
  if (!(file instanceof File)) return { ok: false, error: "Arquivo inválido" };
  if (file.size > MAX_FILE_BYTES) return { ok: false, error: "Arquivo excede 10MB" };
  if (!MIME_PERMITIDOS.includes(file.type)) {
    return { ok: false, error: "Tipo de arquivo não permitido (apenas PDF e imagens)" };
  }

  const supabase = await createServerClient();

  // Verifica que anamnese existe
  const { data: anamnese } = await supabase
    .from("pipeline_anamnese")
    .select("id")
    .eq("card_id", card_id)
    .eq("escola_id", session.profile.escola_id)
    .maybeSingle();

  if (!anamnese) return { ok: false, error: "Registre a anamnese antes de enviar arquivos" };

  const ext = file.name.split(".").pop() ?? "bin";
  const path = `${session.profile.escola_id}/${card_id}/${Date.now()}.${ext}`;
  const bytes = await file.arrayBuffer();

  const { error: uploadErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType: file.type, upsert: false });

  if (uploadErr) return { ok: false, error: uploadErr.message };

  const { error: dbErr } = await supabase.from("pipeline_anamnese_arquivo").insert({
    escola_id: session.profile.escola_id,
    anamnese_id: anamnese.id,
    card_id,
    nome: file.name,
    url: path,
    mime_type: file.type,
  });

  if (dbErr) {
    // Remove arquivo orphan se insert falhar
    void supabase.storage.from(BUCKET).remove([path]);
    return { ok: false, error: dbErr.message };
  }

  void gravarLog(
    session.profile.escola_id,
    session.profile.id,
    card_id,
    "anamnese_arquivo",
    "write",
  );

  return { ok: true, data: undefined };
}

export async function deletarAnamneseArquivo(arquivo_id: string): Promise<ActionResult> {
  let session: Awaited<ReturnType<typeof requirePermission>>;
  try {
    session = await requirePermission("pipeline_sensivel", "delete");
  } catch {
    return { ok: false, error: "Sem permissão" };
  }

  const supabase = await createServerClient();

  const { data: arquivo } = await supabase
    .from("pipeline_anamnese_arquivo")
    .select("id, url")
    .eq("id", arquivo_id)
    .eq("escola_id", session.profile.escola_id)
    .maybeSingle();

  if (!arquivo) return { ok: false, error: "Arquivo não encontrado" };

  await supabase.storage.from(BUCKET).remove([arquivo.url as string]);

  const { error } = await supabase
    .from("pipeline_anamnese_arquivo")
    .delete()
    .eq("id", arquivo_id)
    .eq("escola_id", session.profile.escola_id);

  if (error) return { ok: false, error: error.message };

  return { ok: true, data: undefined };
}
