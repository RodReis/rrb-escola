import { NextResponse } from "next/server";
import { processarWebhookPixSicoob } from "@/lib/sicoob/webhook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const secret = process.env.SICOOB_WEBHOOK_SECRET;
  const url = new URL(req.url);
  if (secret && url.searchParams.get("t") !== secret) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const payload = await req.json().catch(() => null);
  if (!payload) return NextResponse.json({ error: "payload inválido" }, { status: 400 });

  const result = await processarWebhookPixSicoob(payload);
  if (!result.ok && result.reason === "payload sem pix[]") {
    return NextResponse.json(result, { status: 400 });
  }
  if (!result.ok) return NextResponse.json(result, { status: 500 });
  return NextResponse.json(result);
}
