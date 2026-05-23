import "server-only";
import { createServerClient } from "@/lib/supabase/server";
import { DEFAULT_SCHOOL_ID } from "@/lib/constants";
import { normalizarTelefone } from "./telefone";
import { sendTemplate } from "./meta";

const IDIOMA_TEMPLATE = "pt_BR";

export type EnviarWhatsAppParams = {
  telefone: string;
  templateName: string;
  variaveis: string[];
  textoLog: string;
  imagemUrl?: string;
  alunoId?: string;
  referenciaTipo?: string;
  referenciaId?: string;
};

export type EnvioResult =
  | { ok: true; mensagemId: string }
  | { ok: false; reason: string };

type SupabaseClientLike = {
  from: (table: string) => any;
};

export async function enviarWhatsApp(
  params: EnviarWhatsAppParams,
  supabaseClient?: SupabaseClientLike,
): Promise<EnvioResult> {
  const supabase = supabaseClient ?? (await createServerClient());
  const telefoneNormalizado = normalizarTelefone(params.telefone);

  // Telefone inválido: grava log de falha direto, sem chamar a API.
  if (!telefoneNormalizado) {
    await supabase.from("mensagens_whatsapp").insert({
      escola_id: DEFAULT_SCHOOL_ID,
      telefone: params.telefone,
      mensagem: params.textoLog,
      status: "falha",
      erro: "Telefone inválido",
      imagem_url: params.imagemUrl ?? null,
      aluno_id: params.alunoId ?? null,
      referencia_tipo: params.referenciaTipo ?? null,
      referencia_id: params.referenciaId ?? null,
      enviada_em: new Date().toISOString(),
    });
    return { ok: false, reason: "Telefone inválido" };
  }

  // Grava log pendente.
  const { data: log, error: logErr } = await supabase
    .from("mensagens_whatsapp")
    .insert({
      escola_id: DEFAULT_SCHOOL_ID,
      telefone: telefoneNormalizado,
      mensagem: params.textoLog,
      status: "pendente",
      imagem_url: params.imagemUrl ?? null,
      aluno_id: params.alunoId ?? null,
      referencia_tipo: params.referenciaTipo ?? null,
      referencia_id: params.referenciaId ?? null,
    })
    .select("id")
    .single();

  if (logErr || !log) {
    return { ok: false, reason: logErr?.message ?? "falha ao registrar mensagem" };
  }

  // Envia o template via Meta.
  const resultado = await sendTemplate({
    telefone: telefoneNormalizado,
    templateName: params.templateName,
    idioma: IDIOMA_TEMPLATE,
    variaveis: params.variaveis,
    imagemUrl: params.imagemUrl,
  });

  // Atualiza o log com o resultado final.
  if (resultado.ok) {
    await supabase
      .from("mensagens_whatsapp")
      .update({
        status: "enviada",
        provider_message_id: resultado.providerMessageId,
        enviada_em: new Date().toISOString(),
      })
      .eq("id", log.id);
    return { ok: true, mensagemId: log.id };
  }

  await supabase
    .from("mensagens_whatsapp")
    .update({
      status: "falha",
      erro: resultado.reason,
      enviada_em: new Date().toISOString(),
    })
    .eq("id", log.id);
  return { ok: false, reason: resultado.reason };
}
