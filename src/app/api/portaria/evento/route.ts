import { NextRequest, NextResponse } from "next/server";
import { isGateRequestAuthorized, unauthorizedGateResponse } from "@/lib/server/gate-api-auth";
import { registerGateEvent } from "@/lib/server/gate-events";

type GateEventPayload = {
  aluno_id?: string;
  tipo?: "entrada" | "saida";
  dispositivo_id?: string | null;
  origem?: "facial" | "facial_simulado" | "manual";
  confianca?: number | null;
  observacao?: string | null;
};

export async function POST(request: NextRequest) {
  if (!isGateRequestAuthorized(request)) {
    return unauthorizedGateResponse();
  }

  const payload = (await request.json()) as GateEventPayload;
  if (!payload.aluno_id || (payload.tipo !== "entrada" && payload.tipo !== "saida")) {
    return NextResponse.json({ error: "payload invalido" }, { status: 400 });
  }

  const result = await registerGateEvent({
    alunoId: payload.aluno_id,
    tipo: payload.tipo,
    dispositivoId: payload.dispositivo_id,
    origem: payload.origem ?? "facial",
    confianca: payload.confianca ?? null,
    observacao: payload.observacao ?? "Evento recebido pela API da portaria"
  });

  return NextResponse.json({ ok: true, ...result });
}
