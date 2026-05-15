import { DEFAULT_SCHOOL_ID } from "@/lib/constants";
import { createAdminClient } from "@/lib/supabase/admin";
import type { StudentImportData } from "@/lib/server/student-import-parser";

export type ImportedFile = {
  id: string;
  nome_arquivo: string;
  tipo: string;
  storage_path: string;
  status: string;
  observacao: string | null;
  created_at: string;
  signed_url: string | null;
  total_linhas: number;
  prontas: number;
  pendentes: number;
  duplicadas: number;
  importadas: number;
  erros: number;
};

export type ImportStudentLine = {
  id: string;
  arquivo_id: string;
  linha: number;
  status: string;
  dados: StudentImportData;
  erros: string[];
  aluno_id: string | null;
  created_at: string;
};

function summarize(rows: Array<{ status: string }>) {
  return {
    total_linhas: rows.length,
    prontas: rows.filter((row) => row.status === "pronto").length,
    pendentes: rows.filter((row) => row.status === "pendente").length,
    duplicadas: rows.filter((row) => row.status === "duplicado").length,
    importadas: rows.filter((row) => row.status === "importado").length,
    erros: rows.filter((row) => row.status === "erro").length
  };
}

async function withSignedUrl<T extends { storage_path: string }>(supabase: ReturnType<typeof createAdminClient>, item: T) {
  const { data: signed } = await supabase.storage.from("importacoes").createSignedUrl(item.storage_path, 60 * 30);
  return {
    ...item,
    signed_url: signed?.signedUrl ?? null
  };
}

export async function getImportedFiles(): Promise<ImportedFile[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("arquivos_importados")
    .select("*, importacao_alunos_linhas(status)")
    .eq("escola_id", DEFAULT_SCHOOL_ID)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return Promise.all(
    (data ?? []).map(async (item) => {
      const signed = await withSignedUrl(supabase, item);
      const summary = summarize(item.importacao_alunos_linhas ?? []);
      return {
        ...signed,
        ...summary
      };
    })
  );
}

export async function getImportDetail(id: string): Promise<{ file: ImportedFile; rows: ImportStudentLine[] }> {
  const supabase = createAdminClient();
  const [fileResult, rowsResult] = await Promise.all([
    supabase
      .from("arquivos_importados")
      .select("*, importacao_alunos_linhas(status)")
      .eq("id", id)
      .eq("escola_id", DEFAULT_SCHOOL_ID)
      .single(),
    supabase
      .from("importacao_alunos_linhas")
      .select("*")
      .eq("arquivo_id", id)
      .eq("escola_id", DEFAULT_SCHOOL_ID)
      .order("linha")
  ]);

  if (fileResult.error) throw fileResult.error;
  if (rowsResult.error) throw rowsResult.error;

  const signed = await withSignedUrl(supabase, fileResult.data);
  const rows = (rowsResult.data ?? []) as ImportStudentLine[];

  return {
    file: {
      ...signed,
      ...summarize(rows)
    },
    rows
  };
}
