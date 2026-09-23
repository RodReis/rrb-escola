import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { consultarExtrato } from "@/lib/sicoob/extrato";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * TEMPORÁRIA. Mostra a forma da resposta do extrato sem expor valor nenhum.
 * Remover assim que a Task 9 fechar.
 */
export async function GET(req: Request) {
  await requirePermission("financeiro.conciliacao", "update");

  const { searchParams } = new URL(req.url);
  const mes = Number(searchParams.get("mes"));
  const ano = Number(searchParams.get("ano"));

  const supabase = createAdminClient();
  const { data: contas } = await supabase
    .from("contas_bancarias")
    .select("conta, credencial_ref")
    .eq("provedor", "sicoob")
    .eq("ativo", true);

  const formas = [];
  for (const conta of contas ?? []) {
    const r = await consultarExtrato({
      contaCorrente: conta.conta,
      mes,
      ano,
      credencialRef: conta.credencial_ref,
    });

    if (!r.ok) {
      formas.push({ credencial: conta.credencial_ref, ok: false, reason: r.reason });
      continue;
    }

    const raiz = r.data as Record<string, unknown>;
    const resultado = raiz?.resultado as Record<string, unknown> | undefined;

    formas.push({
      credencial: conta.credencial_ref,
      ok: true,
      chavesRaiz: Object.keys(raiz ?? {}),
      chavesResultado: resultado && typeof resultado === "object" ? Object.keys(resultado) : null,
      transacoesNaRaiz: Array.isArray(raiz?.transacoes) ? (raiz.transacoes as unknown[]).length : null,
      transacoesNoResultado: Array.isArray(resultado?.transacoes)
        ? (resultado.transacoes as unknown[]).length
        : null,
    });
  }

  return NextResponse.json({ competencia: `${mes}/${ano}`, formas });
}
