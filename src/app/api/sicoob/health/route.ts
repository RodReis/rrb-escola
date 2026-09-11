import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/session";
import { readSicoobConfig } from "@/lib/sicoob/config";
import { getSicoobAccessToken } from "@/lib/sicoob/auth";
import { consultarSaldo } from "@/lib/sicoob/conta-corrente";
import { createServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  await requirePermission("financeiro.conciliacao", "read");

  const config = readSicoobConfig();
  if (!config) {
    return NextResponse.json({ ok: false, reason: "Sicoob não configurado" }, { status: 503 });
  }

  const certNotAfter = config.certNotAfter ?? null;
  const certExpiraEmDias = certNotAfter
    ? Math.ceil((new Date(certNotAfter).getTime() - Date.now()) / 86400000)
    : null;

  try {
    await getSicoobAccessToken(config, "cco_saldo");
  } catch (err) {
    return NextResponse.json({
      ok: false,
      certNotAfter,
      certExpiraEmDias,
      reason: err instanceof Error ? err.message : "falha ao obter token Sicoob",
    }, { status: 502 });
  }

  const supabase = await createServerClient();
  const { data: conta } = await supabase
    .from("contas_bancarias")
    .select("conta")
    .eq("provedor", "sicoob")
    .eq("ativo", true)
    .limit(1)
    .maybeSingle();

  if (!conta?.conta) {
    return NextResponse.json({
      ok: true,
      token: "ok",
      certNotAfter,
      certExpiraEmDias,
      saldo: "nao_consultado",
      reason: "Nenhuma conta Sicoob ativa cadastrada",
    });
  }

  const saldo = await consultarSaldo(conta.conta);
  if (!saldo.ok) {
    return NextResponse.json({
      ok: false,
      token: "ok",
      certNotAfter,
      certExpiraEmDias,
      reason: saldo.reason,
    }, { status: 502 });
  }

  return NextResponse.json({
    ok: true,
    token: "ok",
    certNotAfter,
    certExpiraEmDias,
    saldo: saldo.data,
  });
}
