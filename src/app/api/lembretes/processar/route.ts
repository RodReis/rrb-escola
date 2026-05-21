import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_SCHOOL_ID } from "@/lib/constants";
import { processarLembretes } from "@/lib/lembretes/processar";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");

  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  // Só processa se o envio automático estiver ligado para a escola.
  const supabase = createAdminClient();
  const { data: escola } = await supabase
    .from("escolas")
    .select("lembrete_auto_ativo")
    .eq("id", DEFAULT_SCHOOL_ID)
    .maybeSingle();

  if (!escola?.lembrete_auto_ativo) {
    return NextResponse.json({ skipped: "envio automático desativado" });
  }

  const resultado = await processarLembretes({ forcarReenvio: false }, DEFAULT_SCHOOL_ID);
  return NextResponse.json(resultado);
}
