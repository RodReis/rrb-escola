import { NextResponse } from "next/server";
import { processarWebhookAsaas } from "@/lib/asaas/webhook";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const token = process.env.ASAAS_WEBHOOK_TOKEN;
  const header = req.headers.get("asaas-access-token");

  if (!token || header !== token) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const payload = await req.json().catch(() => null);
  if (!payload) {
    return NextResponse.json({ error: "payload inválido" }, { status: 400 });
  }

  const resultado = await processarWebhookAsaas(payload);
  return NextResponse.json(resultado);
}
