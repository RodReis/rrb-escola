import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerClient } from "@/lib/supabase/server";
import { isDiaUtil } from "@/lib/folha/date-utils";

async function resolveClient(client?: SupabaseClient): Promise<SupabaseClient> {
  return client ?? (await createServerClient());
}

export async function criarPeriodoInicial(contratoId: string, client?: SupabaseClient) {
  const supabase = await resolveClient(client);
  const { data: contrato, error: errContrato } = await supabase
    .from("folha_contratos")
    .select("data_admissao, janela_ferias")
    .eq("id", contratoId)
    .single();
  if (errContrato) throw errContrato;
  if (!contrato) throw new Error("Contrato não encontrado");
  const fim = new Date(`${contrato.data_admissao}T12:00:00Z`);
  fim.setUTCMonth(fim.getUTCMonth() + 12);
  const { error } = await supabase.from("folha_periodos_aquisitivos").insert({
    contrato_id: contratoId,
    inicio: contrato.data_admissao,
    fim: fim.toISOString().slice(0, 10),
    janela: contrato.janela_ferias,
  });
  if (error) throw error;
}

export async function abrirProximoPeriodo(periodoId: string, client?: SupabaseClient) {
  const supabase = await resolveClient(client);
  const { data: p, error: errP } = await supabase
    .from("folha_periodos_aquisitivos")
    .select("contrato_id, fim, janela")
    .eq("id", periodoId)
    .single();
  if (errP) throw errP;
  if (!p) throw new Error("Período não encontrado");
  const fim = new Date(`${p.fim}T12:00:00Z`);
  fim.setUTCMonth(fim.getUTCMonth() + 12);
  const { data, error } = await supabase
    .from("folha_periodos_aquisitivos")
    .insert({
      contrato_id: p.contrato_id,
      inicio: p.fim,
      fim: fim.toISOString().slice(0, 10),
      janela: p.janela,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data;
}

export async function agendarGozo(
  periodoId: string,
  gozoInicio: string,
  gozoDias: number,
  diasAbono: number,
  client?: SupabaseClient
) {
  const supabase = await resolveClient(client);

  const { data: p, error: errP } = await supabase
    .from("folha_periodos_aquisitivos")
    .select("dias_direito, status, contrato_id")
    .eq("id", periodoId)
    .single();
  if (errP) throw errP;
  if (!p) throw new Error("Período não encontrado");
  if (!["aberto", "agendado", "vencido"].includes(p.status)) throw new Error("Período já gozado");
  if (gozoDias + diasAbono > p.dias_direito)
    throw new Error(`Gozo ${gozoDias} + abono ${diasAbono} excede direito ${p.dias_direito}`);

  const { data: contrato, error: errC } = await supabase
    .from("folha_contratos")
    .select("company_id")
    .eq("id", p.contrato_id)
    .single();
  if (errC) throw errC;
  if (!contrato) throw new Error("Contrato do período não encontrado");

  const { data: config, error: errCfg } = await supabase
    .from("folha_config")
    .select("feriados_locais")
    .eq("company_id", contrato.company_id)
    .single();
  if (errCfg) throw errCfg;
  const feriadosLocais: string[] = Array.isArray(config?.feriados_locais)
    ? (config.feriados_locais as string[])
    : [];

  if (!isDiaUtil(gozoInicio, feriadosLocais))
    throw new Error("Início do gozo deve ser dia útil (CCT/art. 134)");

  const { error } = await supabase
    .from("folha_periodos_aquisitivos")
    .update({
      gozo_inicio: gozoInicio,
      gozo_dias: gozoDias,
      dias_abono: diasAbono,
      status: "agendado",
    })
    .eq("id", periodoId);
  if (error) throw error;
}

export async function marcarVencidos(hojeISO: string, client?: SupabaseClient) {
  const supabase = await resolveClient(client);
  const { data: abertos, error: errAbertos } = await supabase
    .from("folha_periodos_aquisitivos")
    .select("id, fim")
    .eq("status", "aberto");
  if (errAbertos) throw errAbertos;
  const vencidos = (abertos ?? []).filter((p) => {
    const limite = new Date(`${p.fim}T12:00:00Z`);
    limite.setUTCMonth(limite.getUTCMonth() + 11);
    return new Date(`${hojeISO}T12:00:00Z`) > limite;
  });
  if (vencidos.length) {
    const { error } = await supabase
      .from("folha_periodos_aquisitivos")
      .update({ status: "vencido" })
      .in("id", vencidos.map((v) => v.id));
    if (error) throw error;
  }
  return vencidos.length;
}
