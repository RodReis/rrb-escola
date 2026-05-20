import { NextRequest, NextResponse } from "next/server";
import { DEFAULT_SCHOOL_ID } from "@/lib/constants";
import { isGateRequestAuthorized, unauthorizedGateResponse } from "@/lib/server/gate-api-auth";
// service role: chamada pela API /api/portaria/* (autenticada por GATE_API_TOKEN)
import { createAdminClient } from "@/lib/supabase/admin";

type MatchPayload = {
  embedding?: number[];
};

export async function POST(request: NextRequest) {
  if (!isGateRequestAuthorized(request)) return unauthorizedGateResponse();

  const payload = (await request.json()) as MatchPayload;
  if (!Array.isArray(payload.embedding) || payload.embedding.length !== 128) {
    return NextResponse.json({ error: "embedding invalido (esperado array 128)" }, { status: 400 });
  }

  const threshold = Number(process.env.GATE_MATCH_THRESHOLD || "0.6");
  const vector = `[${payload.embedding.map((v) => Number(v).toFixed(6)).join(",")}]`;

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("match_biometria", {
    p_embedding: vector,
    p_threshold: threshold,
    p_escola_id: DEFAULT_SCHOOL_ID
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data || data.length === 0) return NextResponse.json({ ok: true, match: null });

  const best = data[0];
  return NextResponse.json({
    ok: true,
    match: {
      biometria_id: best.biometria_id,
      aluno_id: best.aluno_id,
      matricula_codigo: best.matricula_codigo,
      nome: best.nome,
      distancia: best.distancia,
      confianca: best.confianca
    },
    threshold
  });
}
