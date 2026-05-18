// Geracao idempotente de notificacoes diarias.
// Chamado on-demand quando dashboard ou layout carrega.
// Cada (escola+tipo+dia) gera no maximo 1 notificacao broadcast.

import { createServerClient } from "@/lib/supabase/server";
import { DEFAULT_SCHOOL_ID } from "@/lib/constants";

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

async function jaExiste(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  escolaId: string,
  tipo: string,
  refId: string
): Promise<boolean> {
  // chave logica = tipo:refId, gravada em titulo como prefixo "[refId]"
  const { count } = await supabase
    .from("notificacoes")
    .select("id", { count: "exact", head: true })
    .eq("escola_id", escolaId)
    .eq("tipo", tipo)
    .gte("criada_em", `${todayISO()}T00:00:00`)
    .ilike("descricao", `%${refId}%`);
  return (count ?? 0) > 0;
}

export async function runDailyNotifications(escolaId: string = DEFAULT_SCHOOL_ID): Promise<void> {
  const supabase = await createServerClient();
  const hoje = todayISO();
  const [yyyy, mm, dd] = hoje.split("-");

  // ---- Aniversariantes do dia ----
  const { data: aniv } = await supabase
    .from("matriculas")
    .select("aluno_id, alunos(id, nome, data_nascimento)")
    .eq("escola_id", escolaId)
    .eq("status", "ativa");

  const aniversariantesHoje: Array<{ id: string; nome: string }> = [];
  const vistos = new Set<string>();
  for (const m of ((aniv ?? []) as any[])) {
    const a = Array.isArray(m.alunos) ? m.alunos[0] : m.alunos;
    if (!a?.data_nascimento) continue;
    if (vistos.has(a.id)) continue;
    const parts = String(a.data_nascimento).split("-");
    if (parts[1] === mm && parts[2] === dd) {
      vistos.add(a.id);
      aniversariantesHoje.push({ id: a.id, nome: a.nome ?? "—" });
    }
  }

  for (const al of aniversariantesHoje) {
    const exists = await jaExiste(supabase, escolaId, "aniversario_hoje", al.id);
    if (exists) continue;
    await supabase.from("notificacoes").insert({
      escola_id: escolaId,
      perfil_id: null,
      tipo: "aniversario_hoje",
      titulo: `Aniversário hoje · ${al.nome}`,
      descricao: `O aluno ${al.nome} (ref:${al.id}) está fazendo aniversário hoje!`,
      href: `/alunos/${al.id}`,
      severidade: "info",
    });
  }

  // ---- Cobrancas vencidas hoje ----
  const { data: cobs } = await supabase
    .from("cobrancas")
    .select("id, valor_final, data_vencimento, matriculas(aluno_id, alunos(nome))")
    .eq("escola_id", escolaId)
    .eq("data_vencimento", hoje)
    .in("status", ["aberta", "vencida", "parcial"]);

  for (const c of ((cobs ?? []) as any[])) {
    const exists = await jaExiste(supabase, escolaId, "cobranca_vencendo", c.id);
    if (exists) continue;
    const matricula = Array.isArray(c.matriculas) ? c.matriculas[0] : c.matriculas;
    const aluno = Array.isArray(matricula?.alunos) ? matricula?.alunos?.[0] : matricula?.alunos;
    const alunoId = matricula?.aluno_id;
    const nome = aluno?.nome ?? "—";
    const valor = Number(c.valor_final ?? 0);
    await supabase.from("notificacoes").insert({
      escola_id: escolaId,
      perfil_id: null,
      tipo: "cobranca_vencendo",
      titulo: `Cobrança vence hoje · ${nome}`,
      descricao: `Cobrança (ref:${c.id}) de R$ ${valor.toFixed(2)} vence hoje.`,
      href: alunoId ? `/alunos/${alunoId}` : `/financeiro`,
      severidade: "atencao",
    });
  }
}
