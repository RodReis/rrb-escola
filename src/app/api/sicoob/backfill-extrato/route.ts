import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/session";
import { syncExtratoSicoob } from "@/lib/conciliacao/sync-extrato";
import { parseCompetencia } from "@/lib/conciliacao/competencia-param";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Carga retroativa do extrato Sicoob para UMA competência.
 *
 * O cron diário (`/api/jobs/dispatch`) só busca o mês corrente — e o anterior
 * nos 3 primeiros dias do mês. Competência mais antiga que isso nunca entrou
 * no banco, e sem ela não há o que conciliar: nem os débitos, nem as
 * transferências do repasse isaac.
 *
 * O Sicoob limita o extrato às competências recentes. Mês que a API não tem
 * volta com `movimentos: 0` ou com a conta listada em `falhas` — isso é
 * resposta, não erro da rota: significa que aquele mês só entra por OFX.
 */
export async function GET(req: Request) {
  await requirePermission("financeiro.conciliacao", "update");

  const { searchParams } = new URL(req.url);
  const competencia = parseCompetencia(
    searchParams.get("mes"),
    searchParams.get("ano"),
    new Date(),
  );

  if (!competencia.ok) {
    return NextResponse.json({ erro: competencia.erro }, { status: 400 });
  }

  // Sem isto, uma falha no upsert (constraint, enum, escala de numeric) vira um
  // 500 mudo: a Vercel não guarda o stack e o motivo real se perde.
  try {
    const resultado = await syncExtratoSicoob({ mes: competencia.mes, ano: competencia.ano });

    return NextResponse.json({
      competencia: `${String(competencia.mes).padStart(2, "0")}/${competencia.ano}`,
      movimentos: resultado.movimentos,
      descartados: resultado.descartados,
      falhas: resultado.falhas,
      repassesCasados: resultado.repasses.casadas,
      alertasRepasse: resultado.repasses.alertas,
    });
  } catch (err) {
    const erro = err as { message?: string; code?: string; details?: string; hint?: string };
    return NextResponse.json(
      {
        competencia: `${String(competencia.mes).padStart(2, "0")}/${competencia.ano}`,
        erro: erro?.message ?? "falha ao sincronizar extrato",
        code: erro?.code ?? null,
        details: erro?.details ?? null,
        hint: erro?.hint ?? null,
      },
      { status: 500 },
    );
  }
}
