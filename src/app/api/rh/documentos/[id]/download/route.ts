import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/session";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await requirePermission("rh.templates", "read");
  const { id } = await params;
  const supabase = await createServerClient();

  const { data: tpl, error: tplErr } = await supabase
    .from("templates_documentos")
    .select("nome, storage_path, escola_id")
    .eq("id", id)
    .maybeSingle();
  if (tplErr || !tpl) {
    return NextResponse.json({ error: "Template não encontrado" }, { status: 404 });
  }

  const { data: blob, error: dlErr } = await supabase
    .storage.from("templates-documentos").download(tpl.storage_path as string);
  if (dlErr || !blob) {
    return NextResponse.json({ error: dlErr?.message ?? "Falha no download" }, { status: 500 });
  }

  const buf = Buffer.from(await blob.arrayBuffer());
  const safeName = String(tpl.nome).replace(/[^\w\d\-_.]+/g, "_");
  return new NextResponse(buf, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${safeName}.docx"`,
      "Cache-Control": "no-store",
    },
  });
}
