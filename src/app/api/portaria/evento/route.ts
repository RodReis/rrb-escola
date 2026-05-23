import { NextRequest, NextResponse } from "next/server";
import { isGateRequestAuthorized, unauthorizedGateResponse } from "@/lib/server/gate-api-auth";
import { registerGateEvent } from "@/lib/server/gate-events";
import { createAdminClient } from "@/lib/supabase/admin";

type GateEventPayload = {
  aluno_id?: string;
  tipo?: "entrada" | "saida";
  dispositivo_id?: string | null;
  origem?: "facial" | "facial_simulado" | "manual";
  confianca?: number | null;
  observacao?: string | null;
  foto_base64?: string | null;
};

const MAX_FOTO_BYTES = 2 * 1024 * 1024;

// Sobe a foto capturada no bucket portaria-eventos e retorna uma URL assinada.
// Retorna null se não houver foto ou se o upload falhar (não bloqueia o evento).
async function uploadFotoEvento(
  alunoId: string,
  fotoBase64: string,
): Promise<string | null> {
  try {
    // Detecta o tipo a partir do data-URI; default JPEG.
    const mimeMatch = fotoBase64.match(/^data:(image\/(?:jpeg|png));base64,/);
    const contentType = mimeMatch ? mimeMatch[1] : "image/jpeg";
    const extensao = contentType === "image/png" ? "png" : "jpg";

    const base64 = fotoBase64.includes(",") ? fotoBase64.split(",")[1] : fotoBase64;
    const buffer = Buffer.from(base64, "base64");
    if (buffer.length === 0 || buffer.length > MAX_FOTO_BYTES) return null;

    const supabase = createAdminClient();
    const path = `${alunoId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extensao}`;
    const { error: upErr } = await supabase.storage
      .from("portaria-eventos")
      .upload(path, buffer, { contentType, upsert: false });
    if (upErr) return null;

    const { data: signed } = await supabase.storage
      .from("portaria-eventos")
      .createSignedUrl(path, 60 * 60);
    return signed?.signedUrl ?? null;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  if (!isGateRequestAuthorized(request)) {
    return unauthorizedGateResponse();
  }

  const payload = (await request.json()) as GateEventPayload;
  if (!payload.aluno_id || (payload.tipo !== "entrada" && payload.tipo !== "saida")) {
    return NextResponse.json({ error: "payload invalido" }, { status: 400 });
  }

  const fotoUrl = payload.foto_base64
    ? await uploadFotoEvento(payload.aluno_id, payload.foto_base64)
    : null;

  const result = await registerGateEvent({
    alunoId: payload.aluno_id,
    tipo: payload.tipo,
    dispositivoId: payload.dispositivo_id,
    origem: payload.origem ?? "facial",
    confianca: payload.confianca ?? null,
    observacao: payload.observacao ?? "Evento recebido pela API da portaria",
    fotoUrl,
  });

  return NextResponse.json({ ok: true, ...result });
}
