import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/session";
import { listAlunosDaTurma } from "@/lib/data/comunicados";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requirePermission("comunicados", "read");
  const { id } = await params;
  const alunos = await listAlunosDaTurma(id, session.profile.escola_id);
  return NextResponse.json(alunos);
}
