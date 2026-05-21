import { DEFAULT_SCHOOL_ID } from "@/lib/constants";
import { createServerClient } from "@/lib/supabase/server";

export async function getGateData() {
  const supabase = await createServerClient();
  const [students, devices, events, notifications] = await Promise.all([
    supabase
      .from("alunos")
      .select("id, matricula_codigo, nome, ativo")
      .eq("escola_id", DEFAULT_SCHOOL_ID)
      .eq("ativo", true)
      .order("nome"),
    supabase
      .from("dispositivos_acesso")
      .select("*")
      .eq("escola_id", DEFAULT_SCHOOL_ID)
      .eq("ativo", true)
      .order("nome"),
    supabase
      .from("eventos_acesso")
      .select("*, alunos(nome, matricula_codigo), dispositivos_acesso(nome)")
      .eq("escola_id", DEFAULT_SCHOOL_ID)
      .order("data_evento", { ascending: false })
      .limit(30),
    supabase
      .from("notificacoes_responsavel")
      .select("*, alunos(nome)")
      .eq("escola_id", DEFAULT_SCHOOL_ID)
      .order("created_at", { ascending: false })
      .limit(20)
  ]);

  if (students.error) throw students.error;
  if (devices.error) throw devices.error;
  if (events.error) throw events.error;
  if (notifications.error) throw notifications.error;

  return {
    students: students.data ?? [],
    devices: devices.data ?? [],
    events: events.data ?? [],
    notifications: notifications.data ?? []
  };
}

export async function getGateDevices() {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("dispositivos_acesso")
    .select("*")
    .eq("escola_id", DEFAULT_SCHOOL_ID)
    .order("nome");

  if (error) throw error;
  return data ?? [];
}

export async function getGateNotifications(status?: string) {
  const allowedStatuses = new Set(["pendente", "enviada", "falha"]);
  const supabase = await createServerClient();
  let query = supabase
    .from("mensagens_whatsapp")
    .select("id, telefone, mensagem, status, erro, provider_message_id, created_at, alunos:aluno_id(nome, matricula_codigo)")
    .eq("escola_id", DEFAULT_SCHOOL_ID)
    .eq("referencia_tipo", "portaria")
    .order("created_at", { ascending: false })
    .limit(100);

  if (status && allowedStatuses.has(status)) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function getGateDailyStatus(date?: string) {
  const selectedDate = date || new Date().toISOString().slice(0, 10);
  const supabase = await createServerClient();
  const [students, events] = await Promise.all([
    supabase
      .from("alunos")
      .select("id, matricula_codigo, nome")
      .eq("escola_id", DEFAULT_SCHOOL_ID)
      .eq("ativo", true)
      .order("nome"),
    supabase
      .from("eventos_acesso")
      .select("id, aluno_id, tipo, origem, confianca, data_evento, dispositivos_acesso(nome)")
      .eq("escola_id", DEFAULT_SCHOOL_ID)
      .eq("data_referencia", selectedDate)
      .order("data_evento", { ascending: true })
  ]);

  if (students.error) throw students.error;
  if (events.error) throw events.error;

  const eventsByStudent = new Map<string, NonNullable<typeof events.data>>();
  for (const event of events.data ?? []) {
    const current = eventsByStudent.get(event.aluno_id) ?? [];
    current.push(event);
    eventsByStudent.set(event.aluno_id, current);
  }

  const rows = (students.data ?? []).map((student) => {
    const studentEvents = eventsByStudent.get(student.id) ?? [];
    const firstEntry = studentEvents.find((event) => event.tipo === "entrada") ?? null;
    const exits = studentEvents.filter((event) => event.tipo === "saida");
    const lastExit = exits.at(-1) ?? null;
    const latestEvent = studentEvents.at(-1) ?? null;
    const status = !latestEvent ? "nao_chegou" : latestEvent.tipo === "entrada" ? "dentro" : "saiu";

    return {
      aluno_id: student.id,
      matricula_codigo: student.matricula_codigo,
      nome: student.nome,
      status,
      primeira_entrada: firstEntry?.data_evento ?? null,
      ultima_saida: lastExit?.data_evento ?? null,
      ultimo_evento: latestEvent?.data_evento ?? null,
      ultimo_tipo: latestEvent?.tipo ?? null,
      origem: latestEvent?.origem ?? null,
      confianca: latestEvent?.confianca ?? null,
      total_eventos: studentEvents.length
    };
  });

  return {
    date: selectedDate,
    rows,
    totals: {
      alunos: rows.length,
      dentro: rows.filter((row) => row.status === "dentro").length,
      sairam: rows.filter((row) => row.status === "saiu").length,
      naoChegaram: rows.filter((row) => row.status === "nao_chegou").length,
      eventos: events.data?.length ?? 0
    }
  };
}

export async function getStudentGateSettings(alunoId: string) {
  const supabase = await createServerClient();
  const [consent, preferences, notifications, events, guardians, biometrics] = await Promise.all([
    supabase.from("consentimentos_biometria").select("*").eq("aluno_id", alunoId).maybeSingle(),
    supabase
      .from("preferencias_notificacao_aluno")
      .select("*, responsaveis_aluno(nome, parentesco)")
      .eq("aluno_id", alunoId)
      .maybeSingle(),
    supabase
      .from("notificacoes_responsavel")
      .select("*")
      .eq("aluno_id", alunoId)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("eventos_acesso")
      .select("*, dispositivos_acesso(nome)")
      .eq("aluno_id", alunoId)
      .order("data_evento", { ascending: false })
      .limit(10),
    supabase.from("responsaveis_aluno").select("id, nome, parentesco, celular, telefone, email").eq("aluno_id", alunoId).order("nome"),
    supabase.from("biometrias_aluno").select("*").eq("aluno_id", alunoId).order("data_cadastro", { ascending: false })
  ]);

  if (consent.error) throw consent.error;
  if (preferences.error) throw preferences.error;
  if (notifications.error) throw notifications.error;
  if (events.error) throw events.error;
  if (guardians.error) throw guardians.error;
  if (biometrics.error) throw biometrics.error;

  const biometricsWithUrls = await Promise.all(
    (biometrics.data ?? []).map(async (item) => {
      if (!item.foto_referencia_path) return { ...item, foto_url: null };
      const { data: signed } = await supabase.storage.from("biometrias-alunos").createSignedUrl(item.foto_referencia_path, 60 * 30);
      return { ...item, foto_url: signed?.signedUrl ?? null };
    })
  );

  return {
    consent: consent.data,
    preferences: preferences.data,
    notifications: notifications.data ?? [],
    events: events.data ?? [],
    guardians: guardians.data ?? [],
    biometrics: biometricsWithUrls
  };
}
