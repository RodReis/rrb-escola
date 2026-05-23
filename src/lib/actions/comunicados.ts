"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/session";
import { formText } from "@/lib/utils";
import { resolverDestinatarios } from "@/lib/comunicados/destinatarios";
import type { AlvosSegmentado } from "@/lib/comunicados/destinatarios";

const MAX_IMAGEM_BYTES = 5 * 1024 * 1024;
const TIPOS_IMAGEM = ["image/png", "image/jpeg", "image/webp"];

// Lê e valida o campo "alvos" (JSON) — formato { alunos: string[], criterio: [...] }.
function parseAlvosSegmentado(formData: FormData): AlvosSegmentado {
  const raw = formData.get("alvos");
  const vazio: AlvosSegmentado = { alunos: [], criterio: [] };
  if (typeof raw !== "string" || raw.trim() === "") return vazio;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return vazio;
    const alunos = Array.isArray(parsed.alunos)
      ? parsed.alunos.filter((x: unknown): x is string => typeof x === "string" && x.length > 0)
      : [];
    const criterio = Array.isArray(parsed.criterio)
      ? parsed.criterio.filter(
          (c: any) =>
            c && typeof c === "object" &&
            (c.tipo === "turma" || c.tipo === "serie") &&
            typeof c.id === "string" && typeof c.nome === "string",
        )
      : [];
    return { alunos, criterio };
  } catch {
    return vazio;
  }
}

export async function criarComunicadoAction(formData: FormData) {
  const session = await requirePermission("comunicados", "create");
  const supabase = await createServerClient();

  const titulo = formText(formData, "titulo");
  const mensagem = formText(formData, "mensagem");
  const alcance = formText(formData, "alcance");
  const alunoId = formText(formData, "aluno_id");

  if (!titulo || !mensagem) {
    redirect("/comunicados/novo?erro=campos_obrigatorios");
  }
  if (alcance !== "geral" && alcance !== "individual" && alcance !== "segmentado") {
    redirect("/comunicados/novo?erro=alcance_invalido");
  }
  if (alcance === "individual" && !alunoId) {
    redirect("/comunicados/novo?erro=aluno_obrigatorio");
  }

  const alvos: AlvosSegmentado =
    alcance === "segmentado" ? parseAlvosSegmentado(formData) : { alunos: [], criterio: [] };
  if (alcance === "segmentado" && alvos.alunos.length === 0) {
    redirect("/comunicados/novo?erro=alvos_obrigatorios");
  }

  // Upload opcional da imagem.
  let imagemPath: string | null = null;
  const file = formData.get("imagem");
  if (file instanceof File && file.size > 0) {
    if (!TIPOS_IMAGEM.includes(file.type)) {
      redirect("/comunicados/novo?erro=imagem_tipo");
    }
    if (file.size > MAX_IMAGEM_BYTES) {
      redirect("/comunicados/novo?erro=imagem_grande");
    }
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}-${safeName}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    const { error: upErr } = await supabase.storage
      .from("comunicados")
      .upload(path, buffer, { contentType: file.type, upsert: false });
    if (upErr) {
      redirect(`/comunicados/novo?erro=${encodeURIComponent(upErr.message)}`);
    }
    imagemPath = path;
  }

  // Cria o comunicado.
  const { data: comunicado, error: comErr } = await supabase
    .from("comunicados")
    .insert({
      escola_id: session.profile.escola_id,
      titulo,
      mensagem,
      imagem_path: imagemPath,
      alcance,
      aluno_id: alcance === "individual" ? alunoId : null,
      alvos,
      status: "processando",
      criado_por: session.profile.id,
    })
    .select("id")
    .single();

  if (comErr || !comunicado) {
    redirect(`/comunicados/novo?erro=${encodeURIComponent(comErr?.message ?? "falha")}`);
  }

  // Resolve destinatários.
  const destinatarios = await resolverDestinatarios(
    supabase,
    alcance,
    alcance === "individual" ? alunoId : null,
    alvos.alunos,
    session.profile.escola_id,
  );

  // URL assinada da imagem (válida por bastante tempo, pois o cron envia depois).
  let imagemUrl: string | null = null;
  if (imagemPath) {
    const { data: signed } = await supabase.storage
      .from("comunicados")
      .createSignedUrl(imagemPath, 60 * 60 * 24 * 7); // 7 dias
    imagemUrl = signed?.signedUrl ?? null;
  }

  // Insere uma mensagem pendente por destinatário.
  if (destinatarios.length > 0) {
    const { error: msgErr } = await supabase.from("mensagens_whatsapp").insert(
      destinatarios.map((d) => ({
        escola_id: session.profile.escola_id,
        telefone: d.telefone,
        mensagem,
        status: "pendente" as const,
        imagem_url: imagemUrl,
        aluno_id: d.alunoId,
        referencia_tipo: "comunicado",
        referencia_id: comunicado.id,
      })),
    );
    if (msgErr) {
      // Não deixa o comunicado preso em "processando" sem fila: marca como concluído com falha.
      await supabase
        .from("comunicados")
        .update({
          total_destinatarios: 0,
          total_falhas: destinatarios.length,
          status: "concluido",
          concluido_em: new Date().toISOString(),
        })
        .eq("id", comunicado.id);
      redirect(`/comunicados/${comunicado.id}?erro=${encodeURIComponent(msgErr.message)}`);
    }
  }

  // Atualiza total de destinatários. Se zero, já marca concluído.
  const { error: updErr } = await supabase
    .from("comunicados")
    .update({
      total_destinatarios: destinatarios.length,
      status: destinatarios.length === 0 ? "concluido" : "processando",
      concluido_em: destinatarios.length === 0 ? new Date().toISOString() : null,
    })
    .eq("id", comunicado.id);
  if (updErr) {
    console.error("[comunicados] falha ao atualizar contador do comunicado:", updErr.message);
  }

  revalidatePath("/comunicados");
  redirect(`/comunicados/${comunicado.id}`);
}
