import { createServerClient } from "@/lib/supabase/server";

export type StudentDocument = {
  id: string;
  aluno_id: string;
  nome_arquivo: string;
  tipo_documento: string;
  storage_path: string;
  content_type: string | null;
  tamanho_bytes: number | null;
  created_at: string;
  signed_url: string | null;
};

export async function getStudentDocuments(alunoId: string): Promise<StudentDocument[]> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("documentos_aluno")
    .select("*")
    .eq("aluno_id", alunoId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  const paths = (data ?? []).map((d) => d.storage_path);
  const { data: signedList } = await supabase.storage
    .from("documentos-alunos")
    .createSignedUrls(paths, 60 * 30);
  const urlMap = Object.fromEntries(
    (signedList ?? []).map((s) => [s.path, s.signedUrl ?? null])
  );
  return (data ?? []).map((d) => ({ ...d, signed_url: urlMap[d.storage_path] ?? null }));
}

const TIPOS_GERADOS = ["contrato", "declaracao", "termo", "outro"] as const;

export async function getMatriculaDocumentos(alunoId: string): Promise<StudentDocument[]> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("documentos_aluno")
    .select("*")
    .eq("aluno_id", alunoId)
    .in("tipo_documento", TIPOS_GERADOS)
    .order("created_at", { ascending: false });

  if (error) throw error;

  const paths = (data ?? []).map((d) => d.storage_path);
  const { data: signedList } = await supabase.storage
    .from("documentos-alunos")
    .createSignedUrls(paths, 60 * 30);
  const urlMap = Object.fromEntries(
    (signedList ?? []).map((s) => [s.path, s.signedUrl ?? null])
  );
  return (data ?? []).map((d) => ({ ...d, signed_url: urlMap[d.storage_path] ?? null }));
}
