import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/session";
import { readSicoobConfig } from "@/lib/sicoob/config";
import { getSicoobAccessToken } from "@/lib/sicoob/auth";
import { consultarSaldo } from "@/lib/sicoob/conta-corrente";
import { createServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ContaSaude = {
  conta: string;
  apelido: string | null;
  credencialRef: string | null;
  ok: boolean;
  token: "ok" | "falhou" | "nao_configurado";
  certNotAfter: string | null;
  certExpiraEmDias: number | null;
  saldo?: unknown;
  reason?: string;
};

/**
 * Saúde do Sicoob POR CONTA.
 *
 * Antes verificava uma credencial e uma conta arbitrária. Com dois CNPJs, cada
 * um tem app e certificado A1 próprios: um certificado vencido no segundo CNPJ
 * passaria despercebido enquanto o primeiro respondesse — e o alerta de
 * vencimento existe justamente para isso.
 */
export async function GET() {
  await requirePermission("financeiro.conciliacao", "read");

  const supabase = await createServerClient();
  const { data: contas } = await supabase
    .from("contas_bancarias")
    .select("conta, apelido, credencial_ref")
    .eq("provedor", "sicoob")
    .eq("ativo", true)
    .order("apelido");

  if (!contas || contas.length === 0) {
    return NextResponse.json({
      ok: true,
      contas: [],
      reason: "Nenhuma conta Sicoob ativa cadastrada",
    });
  }

  const resultados: ContaSaude[] = [];

  for (const linha of contas) {
    const credencialRef = (linha.credencial_ref as string | null) ?? null;
    const base = {
      conta: linha.conta as string,
      apelido: (linha.apelido as string | null) ?? null,
      credencialRef,
    };

    const config = readSicoobConfig(undefined, credencialRef);
    if (!config) {
      resultados.push({
        ...base,
        ok: false,
        token: "nao_configurado",
        certNotAfter: null,
        certExpiraEmDias: null,
        reason: credencialRef
          ? `Faltam as variáveis SICOOB_${credencialRef}_*`
          : "Sicoob não configurado",
      });
      continue;
    }

    const certNotAfter = config.certNotAfter ?? null;
    const certExpiraEmDias = certNotAfter
      ? Math.ceil((new Date(certNotAfter).getTime() - Date.now()) / 86400000)
      : null;

    try {
      await getSicoobAccessToken(config, "cco_saldo");
    } catch (err) {
      resultados.push({
        ...base,
        ok: false,
        token: "falhou",
        certNotAfter,
        certExpiraEmDias,
        reason: err instanceof Error ? err.message : "falha ao obter token Sicoob",
      });
      continue;
    }

    const saldo = await consultarSaldo(linha.conta as string, credencialRef);
    resultados.push({
      ...base,
      ok: saldo.ok,
      token: "ok",
      certNotAfter,
      certExpiraEmDias,
      ...(saldo.ok ? { saldo: saldo.data } : { reason: saldo.reason }),
    });
  }

  const todasOk = resultados.every((r) => r.ok);
  return NextResponse.json({ ok: todasOk, contas: resultados }, { status: todasOk ? 200 : 502 });
}
