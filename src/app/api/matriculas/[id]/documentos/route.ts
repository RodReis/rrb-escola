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

  if (!matricula) return NextResponse.json([]);

  const { data: docs } = await supabase
    .from("documentos_aluno")
    .select("*")
    .eq("aluno_id", matricula.aluno_id)
    .in("tipo_documento", TIPOS_GERADOS)
    .order("created_at", { ascending: false });

  const docsComUrl = await Promise.all(
    (docs ?? []).map(async (doc) => {
      const { data: signed } = await supabase.storage
        .from("documentos-alunos")
        .createSignedUrl(doc.storage_path, 60 * 30);
      return { ...doc, signed_url: signed?.signedUrl ?? null };
    })
  );

  return NextResponse.json(docsComUrl);
}
