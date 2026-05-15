import { NextRequest, NextResponse } from "next/server";
import { DEFAULT_SCHOOL_ID } from "@/lib/constants";
import { isGateRequestAuthorized, unauthorizedGateResponse } from "@/lib/server/gate-api-auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  if (!isGateRequestAuthorized(request)) {
    return unauthorizedGateResponse();
  }

  const supabase = createAdminClient();
  const { data: biometrics, error } = await supabase
    .from("biometrias_aluno")
    .select("id, aluno_id, modelo, foto_referencia_path, data_cadastro, alunos!inner(id, nome, matricula_codigo, ativo, escola_id)")
    .eq("ativo", true)
    .eq("alunos.escola_id", DEFAULT_SCHOOL_ID)
    .eq("alunos.ativo", true)
    .order("data_cadastro", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const studentIds = Array.from(new Set((biometrics ?? []).map((item) => item.aluno_id)));
  const { data: consents, error: consentError } = await supabase
    .from("consentimentos_biometria")
    .select("aluno_id, autorizado")
    .in("aluno_id", studentIds.length ? studentIds : ["00000000-0000-0000-0000-000000000000"])
    .eq("autorizado", true);

  if (consentError) {
    return NextResponse.json({ error: consentError.message }, { status: 500 });
  }

  const authorizedStudents = new Set((consents ?? []).map((consent) => consent.aluno_id));
  const records = await Promise.all(
    (biometrics ?? [])
      .filter((item) => authorizedStudents.has(item.aluno_id))
      .map(async (item) => {
        const student = Array.isArray(item.alunos) ? item.alunos[0] : item.alunos;
        const signedUrl = item.foto_referencia_path
          ? await supabase.storage.from("biometrias-alunos").createSignedUrl(item.foto_referencia_path, 60 * 30)
          : null;

        return {
          id: item.id,
          aluno_id: item.aluno_id,
          matricula_codigo: student?.matricula_codigo ?? null,
          nome: student?.nome ?? null,
          modelo: item.modelo,
          foto_referencia_url: signedUrl?.data?.signedUrl ?? null,
          data_cadastro: item.data_cadastro
        };
      })
  );

  return NextResponse.json({
    ok: true,
    generated_at: new Date().toISOString(),
    expires_in_seconds: 60 * 30,
    total: records.length,
    records
  });
}
