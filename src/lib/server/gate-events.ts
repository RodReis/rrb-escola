import { DEFAULT_SCHOOL_ID } from "@/lib/constants";
import { sendGuardianNotification } from "@/lib/server/guardian-notifications";
import { createAdminClient } from "@/lib/supabase/admin";

type RegisterGateEventInput = {
  alunoId: string;
  tipo: "entrada" | "saida";
  dispositivoId?: string | null;
  origem?: "manual" | "facial_simulado" | "facial";
  confianca?: number | null;
  observacao?: string | null;
};

function eventMessage(studentName: string, type: string, eventDate: Date) {
  const time = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit"
  }).format(eventDate);

  if (type === "entrada") return `Oi, seu filho ${studentName} entrou na escola as ${time}.`;
  return `Oi, seu filho ${studentName} saiu da escola as ${time}.`;
}

function gateCooldownSeconds() {
  const value = Number(process.env.GATE_EVENT_COOLDOWN_SECONDS ?? 120);
  return Number.isFinite(value) && value > 0 ? value : 120;
}

export async function registerGateEvent(input: RegisterGateEventInput) {
  const supabase = createAdminClient();
  const now = new Date();
  const dateReference = now.toISOString().slice(0, 10);

  const { data: student, error: studentError } = await supabase
    .from("alunos")
    .select("id, nome")
    .eq("id", input.alunoId)
    .eq("escola_id", DEFAULT_SCHOOL_ID)
    .single();

  if (studentError || !student) throw studentError ?? new Error("Aluno nao encontrado.");

  const cooldownStart = new Date(now.getTime() - gateCooldownSeconds() * 1000).toISOString();
  const { data: recentEvent, error: recentEventError } = await supabase
    .from("eventos_acesso")
    .select("id, data_referencia")
    .eq("escola_id", DEFAULT_SCHOOL_ID)
    .eq("aluno_id", input.alunoId)
    .eq("tipo", input.tipo)
    .gte("data_evento", cooldownStart)
    .order("data_evento", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (recentEventError) throw recentEventError;

  if (recentEvent) {
    return {
      eventId: recentEvent.id as string,
      notificationId: null,
      frequencyDate: input.tipo === "entrada" ? (recentEvent.data_referencia as string) : null,
      duplicated: true
    };
  }

  const { data: event, error: eventError } = await supabase
    .from("eventos_acesso")
    .insert({
      escola_id: DEFAULT_SCHOOL_ID,
      aluno_id: input.alunoId,
      dispositivo_id: input.dispositivoId || null,
      tipo: input.tipo,
      origem: input.origem ?? "manual",
      confianca: input.confianca ?? null,
      data_evento: now.toISOString(),
      data_referencia: dateReference,
      observacao: input.observacao ?? null
    })
    .select("id")
    .single();

  if (eventError) throw eventError;

  if (input.tipo === "entrada") {
    const { data: enrollment } = await supabase
      .from("matriculas")
      .select("id")
      .eq("aluno_id", input.alunoId)
      .eq("status", "ativa")
      .order("ano_letivo", { ascending: false })
      .limit(1)
      .maybeSingle();

    await supabase.from("frequencias").upsert(
      {
        escola_id: DEFAULT_SCHOOL_ID,
        aluno_id: input.alunoId,
        matricula_id: enrollment?.id ?? null,
        data_aula: dateReference,
        presente: true,
        justificativa: "Registro automatico pela portaria"
      },
      { onConflict: "aluno_id,data_aula" }
    );
  }

  const { data: preference } = await supabase
    .from("preferencias_notificacao_aluno")
    .select("*, responsaveis_aluno(id, nome, celular, telefone)")
    .eq("aluno_id", input.alunoId)
    .eq("ativo", true)
    .maybeSingle();

  const shouldNotify =
    preference &&
    ((input.tipo === "entrada" && preference.notificar_entrada) || (input.tipo === "saida" && preference.notificar_saida));

  let notificationId: string | null = null;

  if (shouldNotify) {
    const guardian = Array.isArray(preference.responsaveis_aluno)
      ? preference.responsaveis_aluno[0]
      : preference.responsaveis_aluno;
    const phone = preference.telefone_destino || guardian?.celular || guardian?.telefone;
    const message = eventMessage(student.nome, input.tipo, now);

    const { data: notification, error: notificationError } = await supabase
      .from("notificacoes_responsavel")
      .insert({
        escola_id: DEFAULT_SCHOOL_ID,
        aluno_id: input.alunoId,
        responsavel_id: preference.responsavel_id,
        evento_acesso_id: event.id,
        canal: preference.canal,
        telefone_destino: phone,
        mensagem: message,
        status: process.env.WHATSAPP_WEBHOOK_URL ? "pendente" : "simulada"
      })
      .select("id, canal, telefone_destino, mensagem")
      .single();

    if (notificationError) throw notificationError;
    notificationId = notification?.id ?? null;

    if (notification) {
      const result = await sendGuardianNotification({
        notificationId: notification.id,
        canal: notification.canal,
        telefoneDestino: notification.telefone_destino,
        mensagem: notification.mensagem,
        alunoId: input.alunoId,
        eventoAcessoId: event.id
      });

      await supabase
        .from("notificacoes_responsavel")
        .update({
          status: result.status,
          provider_message_id: result.providerMessageId ?? null,
          erro: result.erro ?? null
        })
        .eq("id", notification.id);
    }
  }

  return {
    eventId: event.id as string,
    notificationId,
    frequencyDate: input.tipo === "entrada" ? dateReference : null,
    duplicated: false
  };
}
