import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { createServerClient } from "@/lib/supabase/server";

const TIPOS_GERADOS = ["contrato", "declaracao", "termo"];

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  await requireSession();
  const supabase = await createServerClient();

  const { data: matricula } = await supabase
    .from("matriculas")
    .select("aluno_id")
    .eq("id", params.id)
    .single();

  if (!matricula) return NextResponse.json({ error: "Matrícula não encontrada" }, { status: 404 });

  const { data: docs } = await supabase
    .from("documentos_aluno")
    .select("*")
    .eq("aluno_id", matricula.aluno_id)
    .in("tipo_documento", TIPOS_GERADOS)
    .order("created_at", { ascending: false });

  const paths = (docs ?? []).map((d) => d.storage_path);
  const { data: signedList } = await supabase.storage
    .from("documentos-alunos")
    .createSignedUrls(paths, 60 * 30);
  const urlMap = Object.fromEntries(
    (signedList ?? []).map((s) => [s.path, s.signedUrl ?? null])
  );
  const docsComUrl = (docs ?? []).map((d) => ({ ...d, signed_url: urlMap[d.storage_path] ?? null }));

  return NextResponse.json(docsComUrl);
}
