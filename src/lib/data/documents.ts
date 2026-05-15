import { createAdminClient } from "@/lib/supabase/admin";

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
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("documentos_aluno")
    .select("*")
    .eq("aluno_id", alunoId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return Promise.all(
    (data ?? []).map(async (item) => {
      const { data: signed } = await supabase.storage.from("documentos-alunos").createSignedUrl(item.storage_path, 60 * 30);
      return {
        ...item,
        signed_url: signed?.signedUrl ?? null
      };
    })
  );
}
