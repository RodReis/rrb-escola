import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/session";
import { listarCobrancasAbertasParaCancelamento } from "@/lib/data/cancelamento";

export async function GET(request: Request) {
  await requirePermission("matriculas", "update");

  const url = new URL(request.url);
  const alunoId = url.searchParams.get("aluno_id");
  const data = url.searchParams.get("data");
  if (!alunoId || !data) {
    return NextResponse.json({ error: "aluno_id e data são obrigatórios." }, { status: 400 });
  }

  const cobrancas = await listarCobrancasAbertasParaCancelamento(alunoId, data);
  return NextResponse.json(cobrancas);
}
