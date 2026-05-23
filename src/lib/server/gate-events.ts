import { DEFAULT_SCHOOL_ID } from "@/lib/constants";
import { enviarWhatsApp } from "@/lib/whatsapp/send";
import { montarNotificacaoPortaria } from "@/lib/portaria/notificacao";
import { createAdminClient } from "@/lib/supabase/admin";

const TEMPLATE_PORTARIA_FOTO = process.env.META_TEMPLATE_PORTARIA_FOTO ?? "portaria_acesso_foto";
const TEMPLATE_PORTARIA_TEXTO = process.env.META_TEMPLATE_PORTARIA_TEXTO ?? "portaria_acesso_texto";

type RegisterGateEventInput = {
  alunoId: string;
  tipo: "entrada" | "saida";
  dispositivoId?: string | null;
  origem?: "manual" | "facial_simulado" | "facial";
  confianca?: number | null;
  observacao?: string | null;
  fotoUrl?: string | null;
};

function gateCooldownSeconds() {
  const value = Number(process.env.GATE_EVENT_COOLDOWN_SECONDS ?? 120);
  return Number.isFinite(value) && value > 0 ? value : 120;
}

export async function registerGateEvent(input: RegisterGateEventInput) {
  // service role: invocado pela API /api/portaria/* (autenticada por GATE_API_TOKEN)
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
    ((input.tipo === "entrada" && preference.notificar_entrada) ||
      (input.tipo === "saida" && preference.notificar_saida));

  let notificationId: string | null = null;

  if (shouldNotify) {
    const guardian = Array.isArray(preference.responsaveis_aluno)
      ? preference.responsaveis_aluno[0]
      : preference.responsaveis_aluno;
    const phone = preference.telefone_destino || guardian?.celular || guardian?.telefone;

    if (phone) {
      const notif = montarNotificacaoPortaria(
        {
          nomeAluno: student.nome,
          tipo: input.tipo,
          dataEvento: now,
          fotoUrl: input.fotoUrl ?? null,
        },
        { comFoto: TEMPLATE_PORTARIA_FOTO, semFoto: TEMPLATE_PORTARIA_TEXTO },
      );

      const envio = await enviarWhatsApp(
        {
          telefone: phone,
          templateName: notif.templateName,
          variaveis: notif.variaveis,
          textoLog: notif.textoLog,
          imagemUrl: notif.imagemUrl,
          alunoId: input.alunoId,
          referenciaTipo: "portaria",
          referenciaId: event.id,
        },
        supabase,
      );

      notificationId = envio.ok ? envio.mensagemId : null;
    }
  }

  return {
    eventId: event.id as string,
    notificationId,
    frequencyDate: input.tipo === "entrada" ? dateReference : null,
    duplicated: false
  };
}
