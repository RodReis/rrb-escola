import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  validarAssinaturaWebhook,
  parsearEventoWebhook,
} from "@/lib/whatsapp/inbox-parser";
import { processarEventoInbound } from "@/lib/whatsapp/inbox-receive";

export const dynamic = "force-dynamic";

// Verificação inicial da Meta.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  if (mode === "subscribe" && token && token === process.env.META_VERIFY_TOKEN) {
    return new NextResponse(challenge ?? "", { status: 200 });
  }
  return new NextResponse("forbidden", { status: 403 });
}

export async function POST(req: Request) {
  const secret = process.env.META_APP_SECRET;
  const rawBody = await req.text();
  const assinatura = req.headers.get("x-hub-signature-256");

  if (!secret || !validarAssinaturaWebhook(rawBody, assinatura, secret)) {
    return NextResponse.json({ error: "assinatura inválida" }, { status: 401 });
  }

  const payload = JSON.parse(rawBody);
  const eventos = parsearEventoWebhook(payload);

  // Responde 200 já; processa em seguida (best-effort, sem travar a Meta).
  if (eventos.length > 0) {
    const supabase = createAdminClient();
    for (const evento of eventos) {
      try {
        await processarEventoInbound(evento, supabase as any);
      } catch (err) {
        console.error("[whatsapp/webhook] falha ao processar evento:", err);
      }
    }
  }

  return NextResponse.json({ ok: true });
}
