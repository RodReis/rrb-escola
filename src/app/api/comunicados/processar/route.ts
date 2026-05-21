import { NextResponse } from "next/server";
import { processarLote } from "@/lib/comunicados/processar";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");

  // Vercel Cron envia "Bearer <CRON_SECRET>" no header Authorization.
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const resultado = await processarLote();
  return NextResponse.json(resultado);
}
