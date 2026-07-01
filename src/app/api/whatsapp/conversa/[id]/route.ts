import { NextResponse } from "next/server";
import { getMensagensConversa } from "@/lib/data/inbox";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    // Validação de permissão já está dentro de getMensagensConversa
    const mensagens = await getMensagensConversa(id);
    return NextResponse.json(mensagens);
  } catch {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }
}
