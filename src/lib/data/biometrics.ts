import { createServerClient } from "@/lib/supabase/server";

export type BiometryActive = {
  id: string;
  data_cadastro: string;
  score_qualidade: number | null;
  foto_referencia_path: string | null;
};

export type StudentBiometryData = {
  responsaveis: Array<{ id: string; nome: string }>;
  consentimento: { autorizado: boolean; responsavel_id: string | null; data_consentimento: string | null; observacao: string | null } | null;
  biometriaAtiva: BiometryActive | null;
  fotoReferenciaSignedUrl: string | null;
};

async function signedBiometryPhotoUrl(path: string | null) {
  if (!path) return null;
  const supabase = await createServerClient();
  const { data } = await supabase.storage.from("biometrias-alunos").createSignedUrl(path, 60 * 30);
  return data?.signedUrl ?? null;
}

export async function getStudentBiometryData(alunoId: string): Promise<StudentBiometryData> {
  const supabase = await createServerClient();
  const [responsaveis, consentimento, biometria] = await Promise.all([
    supabase.from("responsaveis_aluno").select("id, nome").eq("aluno_id", alunoId),
    supabase.from("consentimentos_biometria").select("autorizado, responsavel_id, data_consentimento, observacao").eq("aluno_id", alunoId).maybeSingle(),
    supabase.from("biometrias_aluno").select("id, data_cadastro, score_qualidade, foto_referencia_path").eq("aluno_id", alunoId).eq("ativo", true).maybeSingle()
  ]);

  const bio = biometria.data;
  const signed = await signedBiometryPhotoUrl(bio?.foto_referencia_path ?? null);

  return {
    responsaveis: responsaveis.data ?? [],
    consentimento: consentimento.data ?? null,
    biometriaAtiva: bio ?? null,
    fotoReferenciaSignedUrl: signed
  };
}
