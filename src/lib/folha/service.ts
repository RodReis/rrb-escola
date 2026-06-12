import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getFaixasVigentes } from "@/lib/data/folha";
import { calcularItem } from "./engine/pipeline";
import { descontoGozoNaMensal } from "./engine/ferias";
import { calcHoraAula } from "./engine/proventos";
import type { LancamentoManual } from "./engine/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function gerarRun(companyId: string, competencia: string, geradaPor: string) {
  const supabase = await createServerClient();

  const existente = await supabase
    .from("folha_runs")
    .select("id")
    .eq("company_id", companyId)
    .eq("competencia", competencia)
    .maybeSingle();
  if (existente.data) return { runId: existente.data.id as string, criada: false };

  const [{ data: config }, { data: contratos }] = await Promise.all([
    supabase.from("folha_config").select("*").eq("company_id", companyId).single(),
    supabase
      .from("folha_contratos")
      .select("*, folha_contratos_rubricas(valor, percentual, ativa, folha_rubricas(codigo))")
      .eq("company_id", companyId)
      .eq("ativo", true),
  ]);
  if (!config || !contratos) throw new Error("Config/contratos não encontrados");

  const { data: run, error } = await supabase
    .from("folha_runs")
    .insert({
      escola_id: config.escola_id as string,
      company_id: companyId,
      competencia,
      gerada_por: geradaPor,
    })
    .select("id")
    .single();
  if (error) throw error;

  const recorrentes = await buscarRecorrentesDoMesAnterior(companyId, competencia);

  for (const contrato of contratos) {
    const manuais = recorrentes.get(contrato.id as string) ?? [];
    await recalcularItemDb(run.id as string, contrato.id as string, manuais);
  }
  await recalcularTotaisRun(run.id as string);
  return { runId: run.id as string, criada: true };
}

async function buscarRecorrentesDoMesAnterior(
  companyId: string,
  competencia: string
): Promise<Map<string, LancamentoManual[]>> {
  const supabase = await createServerClient();
  const [ano, mes] = competencia.split("-").map(Number);
  const anterior =
    mes === 1 ? `${ano - 1}-12` : `${ano}-${String(mes - 1).padStart(2, "0")}`;

  const { data } = await supabase
    .from("folha_lancamentos")
    .select(
      `valor, referencia, recorrente_parcelas, recorrente_parcela_atual,
       folha_rubricas(codigo),
       folha_itens!inner(contrato_id, folha_runs!inner(company_id, competencia))`
    )
    .eq("folha_itens.folha_runs.company_id", companyId)
    .eq("folha_itens.folha_runs.competencia", anterior)
    .in("origem", ["manual", "recorrente"])
    .not("recorrente_parcelas", "is", null);

  const porContrato = new Map<string, LancamentoManual[]>();

  for (const l of data ?? []) {
    const row = l as unknown as {
      valor: number;
      referencia: string | null;
      recorrente_parcelas: number | null;
      recorrente_parcela_atual: number | null;
      folha_rubricas: { codigo: string } | null;
      folha_itens: { contrato_id: string; folha_runs: { company_id: string; competencia: string } };
    };

    if (!row.folha_rubricas?.codigo) continue;
    const atual = (row.recorrente_parcela_atual ?? 0) + 1;
    if (row.recorrente_parcelas != null && atual > row.recorrente_parcelas) continue;

    const contratoId = row.folha_itens.contrato_id;
    const arr = porContrato.get(contratoId) ?? [];
    arr.push({
      rubrica_codigo: row.folha_rubricas.codigo,
      valor: row.valor,
      referencia: `${atual}/${row.recorrente_parcelas}`,
      origem: "recorrente",
      recorrente_parcelas: row.recorrente_parcelas ?? undefined,
      recorrente_parcela_atual: atual,
    });
    porContrato.set(contratoId, arr);
  }

  return porContrato;
}

function diasIntersecaoNoMes(
  gozoInicioISO: string,
  gozoDias: number,
  competencia: string,
): number {
  const [ano, mes] = competencia.split("-").map(Number);
  const mesInicio = new Date(Date.UTC(ano, mes - 1, 1));
  const mesFim = new Date(Date.UTC(ano, mes, 0));

  const gozo = new Date(`${gozoInicioISO}T12:00:00Z`);
  const gozoFim = new Date(gozo);
  gozoFim.setUTCDate(gozoFim.getUTCDate() + gozoDias - 1);

  const intersecaoInicio = gozo > mesInicio ? gozo : mesInicio;
  const intersecaoFim = gozoFim < mesFim ? gozoFim : mesFim;

  if (intersecaoInicio > intersecaoFim) return 0;
  return (
    Math.floor((intersecaoFim.getTime() - intersecaoInicio.getTime()) / 86400000) + 1
  );
}

type ContratoGozo = {
  salario_base: number | null;
  valor_hora_aula: number | null;
  aulas_semanais: number | null;
  perfil_codigo?: string;
};

async function injetarDescontoGozo(
  supabase: SupabaseClient,
  contratoId: string,
  competencia: string,
  contrato: ContratoGozo,
  semanasMes: number,
  manuaisBase: LancamentoManual[],
): Promise<LancamentoManual[]> {
  const jaTemGozo = manuaisBase.some(
    (m) => m.rubrica_codigo === "ferias_desconto_gozo",
  );
  if (jaTemGozo) return manuaisBase;

  const { data: periodos, error } = await supabase
    .from("folha_periodos_aquisitivos")
    .select("gozo_inicio, gozo_dias")
    .eq("contrato_id", contratoId)
    .in("status", ["agendado", "gozado"])
    .not("gozo_inicio", "is", null);
  if (error) throw error;

  type PRow = { gozo_inicio: string; gozo_dias: number };
  const rows = (periodos ?? []) as unknown as PRow[];

  for (const p of rows) {
    const dias = diasIntersecaoNoMes(p.gozo_inicio, p.gozo_dias, competencia);
    if (dias <= 0) continue;

    let base: number;
    if (contrato.perfil_codigo === "clt_professor") {
      base = Math.round(
        calcHoraAula(
          contrato.valor_hora_aula ?? 0,
          contrato.aulas_semanais ?? 0,
          semanasMes,
        ) * 100,
      ) / 100;
    } else {
      base = contrato.salario_base ?? 0;
    }

    const valor = descontoGozoNaMensal(base, dias);
    if (valor <= 0) continue;

    return [
      ...manuaisBase,
      {
        rubrica_codigo: "ferias_desconto_gozo",
        valor,
        referencia: `${dias} dias`,
        origem: "manual" as const,
      },
    ];
  }

  return manuaisBase;
}

export async function recalcularItemDb(
  runId: string,
  contratoId: string,
  manuaisOverride?: LancamentoManual[]
) {
  const supabase = await createServerClient();

  const { data: run } = await supabase
    .from("folha_runs")
    .select("competencia, company_id, status")
    .eq("id", runId)
    .single();
  if (!run) throw new Error("Run não encontrada");
  if (!["rascunho", "em_revisao"].includes(run.status as string))
    throw new Error("Run travada para edição");

  const [{ data: contrato }, { data: config }, faixas] = await Promise.all([
    supabase
      .from("folha_contratos")
      .select("*, folha_contratos_rubricas(valor, percentual, ativa, folha_rubricas(codigo)), folha_perfis_calculo!perfil_calculo_id(codigo)")
      .eq("id", contratoId)
      .single(),
    supabase
      .from("folha_config")
      .select("*")
      .eq("company_id", run.company_id as string)
      .single(),
    getFaixasVigentes(run.competencia as string),
  ]);
  if (!contrato || !config) throw new Error("Contrato/config não encontrados");

  const { data: perfilRubricas } = await supabase
    .from("folha_perfis_rubricas")
    .select("automatica, ordem_execucao, folha_rubricas(*)")
    .eq("perfil_id", contrato.perfil_calculo_id as string);

  const { data: todasRubricas } = await supabase
    .from("folha_rubricas")
    .select("*")
    .eq("escola_id", contrato.escola_id as string)
    .eq("ativa", true);

  const itemResult = await supabase
    .from("folha_itens")
    .select("id")
    .eq("run_id", runId)
    .eq("contrato_id", contratoId)
    .maybeSingle();
  let item = itemResult.data as { id: string } | null;

  let manuais = manuaisOverride;
  if (!manuais && item) {
    const { data: existentes } = await supabase
      .from("folha_lancamentos")
      .select(
        "valor, referencia, origem, recorrente_parcelas, recorrente_parcela_atual, folha_rubricas(codigo)"
      )
      .eq("item_id", item.id)
      .in("origem", ["manual", "recorrente"]);

    manuais = (existentes ?? []).map((l) => {
      const row = l as unknown as {
        valor: number;
        referencia: string | null;
        origem: string;
        recorrente_parcelas: number | null;
        recorrente_parcela_atual: number | null;
        folha_rubricas: { codigo: string } | null;
      };
      return {
        rubrica_codigo: row.folha_rubricas?.codigo ?? "",
        valor: row.valor,
        referencia: row.referencia ?? undefined,
        origem: row.origem as "manual" | "recorrente",
        recorrente_parcelas: row.recorrente_parcelas ?? undefined,
        recorrente_parcela_atual: row.recorrente_parcela_atual ?? undefined,
      };
    }).filter((m) => m.rubrica_codigo !== "");
  }

  type VerbaRow = {
    valor: number | null;
    percentual: number | null;
    ativa: boolean;
    folha_rubricas: { codigo: string } | null;
  };

  const verbas = ((contrato.folha_contratos_rubricas ?? []) as VerbaRow[])
    .filter((v) => v.ativa && v.folha_rubricas?.codigo)
    .map((v) => ({
      rubrica_codigo: v.folha_rubricas!.codigo,
      valor: v.valor,
      percentual: v.percentual,
    }));

  type PerfilRow = {
    automatica: boolean;
    ordem_execucao: number;
    folha_rubricas: {
      id: string;
      codigo: string;
      nome: string;
      tipo: "provento" | "desconto" | "base" | "informativa";
      metodo_calculo: string;
      incide_inss: boolean;
      incide_irrf: boolean;
      incide_fgts: boolean;
      incide_dsr: boolean;
      ordem_holerite: number;
    };
  };

  const perfilMapped = ((perfilRubricas ?? []) as unknown as PerfilRow[]).map((p) => ({
    rubrica: p.folha_rubricas,
    automatica: p.automatica,
    ordem_execucao: p.ordem_execucao,
  }));

  type PerfilCalculo = { codigo: string } | null;
  const perfilCalculo = (contrato as unknown as { folha_perfis_calculo: PerfilCalculo }).folha_perfis_calculo;

  const manuaisComGozo = await injetarDescontoGozo(
    supabase,
    contratoId,
    run.competencia as string,
    {
      salario_base: contrato.salario_base as number | null,
      valor_hora_aula: contrato.valor_hora_aula as number | null,
      aulas_semanais: contrato.aulas_semanais as number | null,
      perfil_codigo: perfilCalculo?.codigo,
    },
    Number(config.semanas_mes),
    manuais ?? [],
  );

  const resultado = calcularItem({
    contrato: {
      id: contrato.id as string,
      salario_base: contrato.salario_base as number | null,
      valor_hora_aula: contrato.valor_hora_aula as number | null,
      aulas_semanais: contrato.aulas_semanais as number | null,
      dependentes_irrf: (contrato.dependentes_irrf as number) ?? 0,
      verbas,
    },
    perfilRubricas: perfilMapped,
    config: {
      divisor_dsr: config.divisor_dsr as number,
      percentual_hora_atividade: Number(config.percentual_hora_atividade),
      semanas_mes: Number(config.semanas_mes),
    },
    manuais: manuaisComGozo,
    faixas: { inss: faixas.inss, ir: faixas.ir },
    redutor: faixas.redutor,
    rubricasExtras: (todasRubricas ?? []) as Parameters<typeof calcularItem>[0]["rubricasExtras"],
  });

  if (!item) {
    const inserted = await supabase
      .from("folha_itens")
      .insert({ run_id: runId, contrato_id: contratoId })
      .select("id")
      .single();
    item = inserted.data as { id: string } | null;
  }
  if (!item) throw new Error("Falha ao criar item");

  const { error: delErr } = await supabase
    .from("folha_lancamentos")
    .delete()
    .eq("item_id", item.id);
  if (delErr) throw delErr;

  const rubricaIds = new Map(
    (todasRubricas ?? []).map((r) => [
      (r as { codigo: string; id: string }).codigo,
      (r as { codigo: string; id: string }).id,
    ])
  );

  const linhas = resultado.lancamentos
    .map((l) => {
      const rubrica_id = rubricaIds.get(l.rubrica_codigo);
      if (!rubrica_id) return null;
      const m = (manuais ?? []).find(
        (x) => x.rubrica_codigo === l.rubrica_codigo && x.valor === l.valor
      );
      return {
        item_id: item!.id,
        rubrica_id,
        referencia: l.referencia,
        valor: l.valor,
        origem: l.origem,
        recorrente_parcelas: m?.recorrente_parcelas ?? null,
        recorrente_parcela_atual: m?.recorrente_parcela_atual ?? null,
      };
    })
    .filter((l): l is NonNullable<typeof l> => l !== null);

  if (linhas.length) {
    const { error: insErr } = await supabase.from("folha_lancamentos").insert(linhas);
    if (insErr) throw insErr;
  }

  const { error: updItemErr } = await supabase
    .from("folha_itens")
    .update({
      total_proventos: resultado.total_proventos,
      total_descontos: resultado.total_descontos,
      liquido: resultado.liquido,
      base_inss: resultado.base_inss,
      base_irrf: resultado.base_irrf,
      base_fgts: resultado.base_fgts,
    })
    .eq("id", item.id);
  if (updItemErr) throw updItemErr;

  return resultado;
}

export async function recalcularTotaisRun(runId: string, client?: SupabaseClient) {
  const supabase = client ?? (await createServerClient());

  const { data: itens } = await supabase
    .from("folha_itens")
    .select("total_proventos, total_descontos, liquido")
    .eq("run_id", runId)
    .eq("status", "ativo");

  const t = (itens ?? []).reduce(
    (acc, i) => {
      const row = i as {
        total_proventos: number | null;
        total_descontos: number | null;
        liquido: number | null;
      };
      return {
        p: acc.p + Number(row.total_proventos ?? 0),
        d: acc.d + Number(row.total_descontos ?? 0),
        l: acc.l + Number(row.liquido ?? 0),
      };
    },
    { p: 0, d: 0, l: 0 }
  );

  const { error: updRunErr } = await supabase
    .from("folha_runs")
    .update({
      total_proventos: t.p,
      total_descontos: t.d,
      total_liquido: t.l,
    })
    .eq("id", runId);
  if (updRunErr) throw updRunErr;
}

export async function gerarRunAdmin(companyId: string, competencia: string, geradaPor: string) {
  const supabase = createAdminClient() as SupabaseClient;

  const existente = await supabase
    .from("folha_runs")
    .select("id")
    .eq("company_id", companyId)
    .eq("competencia", competencia)
    .maybeSingle();
  if (existente.data) return { runId: existente.data.id as string, criada: false };

  const [{ data: config }, { data: contratos }] = await Promise.all([
    supabase.from("folha_config").select("*").eq("company_id", companyId).single(),
    supabase
      .from("folha_contratos")
      .select("*, folha_contratos_rubricas(valor, percentual, ativa, folha_rubricas(codigo))")
      .eq("company_id", companyId)
      .eq("ativo", true),
  ]);
  if (!config || !contratos) throw new Error("Config/contratos não encontrados");

  const { data: run, error } = await supabase
    .from("folha_runs")
    .insert({
      escola_id: config.escola_id as string,
      company_id: companyId,
      competencia,
      gerada_por: geradaPor,
    })
    .select("id")
    .single();
  if (error) throw error;

  const runId = run.id as string;
  const recorrentes = await buscarRecorrentesAdmin(supabase, companyId, competencia);

  for (const contrato of contratos) {
    const manuais = recorrentes.get(contrato.id as string) ?? [];
    await recalcularItemAdmin(supabase, runId, contrato.id as string, manuais);
  }
  await recalcularTotaisAdmin(supabase, runId);
  return { runId, criada: true };
}

async function buscarRecorrentesAdmin(
  supabase: SupabaseClient,
  companyId: string,
  competencia: string
): Promise<Map<string, LancamentoManual[]>> {
  const [ano, mes] = competencia.split("-").map(Number);
  const anterior =
    mes === 1 ? `${ano - 1}-12` : `${ano}-${String(mes - 1).padStart(2, "0")}`;

  const { data } = await supabase
    .from("folha_lancamentos")
    .select(
      `valor, referencia, recorrente_parcelas, recorrente_parcela_atual,
       folha_rubricas(codigo),
       folha_itens!inner(contrato_id, folha_runs!inner(company_id, competencia))`
    )
    .eq("folha_itens.folha_runs.company_id", companyId)
    .eq("folha_itens.folha_runs.competencia", anterior)
    .in("origem", ["manual", "recorrente"])
    .not("recorrente_parcelas", "is", null);

  const porContrato = new Map<string, LancamentoManual[]>();
  for (const l of data ?? []) {
    const row = l as unknown as {
      valor: number;
      referencia: string | null;
      recorrente_parcelas: number | null;
      recorrente_parcela_atual: number | null;
      folha_rubricas: { codigo: string } | null;
      folha_itens: { contrato_id: string; folha_runs: { company_id: string; competencia: string } };
    };
    if (!row.folha_rubricas?.codigo) continue;
    const atual = (row.recorrente_parcela_atual ?? 0) + 1;
    if (row.recorrente_parcelas != null && atual > row.recorrente_parcelas) continue;
    const contratoId = row.folha_itens.contrato_id;
    const arr = porContrato.get(contratoId) ?? [];
    arr.push({
      rubrica_codigo: row.folha_rubricas.codigo,
      valor: row.valor,
      referencia: `${atual}/${row.recorrente_parcelas}`,
      origem: "recorrente",
      recorrente_parcelas: row.recorrente_parcelas ?? undefined,
      recorrente_parcela_atual: atual,
    });
    porContrato.set(contratoId, arr);
  }
  return porContrato;
}

async function recalcularItemAdmin(
  supabase: SupabaseClient,
  runId: string,
  contratoId: string,
  manuaisOverride: LancamentoManual[]
) {
  const { data: run } = await supabase
    .from("folha_runs")
    .select("competencia, company_id, status")
    .eq("id", runId)
    .single();
  if (!run) throw new Error("Run não encontrada");

  const [{ data: contrato }, { data: config }, faixas] = await Promise.all([
    supabase
      .from("folha_contratos")
      .select("*, folha_contratos_rubricas(valor, percentual, ativa, folha_rubricas(codigo))")
      .eq("id", contratoId)
      .single(),
    supabase
      .from("folha_config")
      .select("*")
      .eq("company_id", run.company_id as string)
      .single(),
    getFaixasVigentes(run.competencia as string),
  ]);
  if (!contrato || !config) throw new Error("Contrato/config não encontrados");

  const { data: perfilRubricas } = await supabase
    .from("folha_perfis_rubricas")
    .select("automatica, ordem_execucao, folha_rubricas(*)")
    .eq("perfil_id", contrato.perfil_calculo_id as string);

  const { data: todasRubricas } = await supabase
    .from("folha_rubricas")
    .select("*")
    .eq("escola_id", contrato.escola_id as string)
    .eq("ativa", true);

  const itemResult = await supabase
    .from("folha_itens")
    .select("id")
    .eq("run_id", runId)
    .eq("contrato_id", contratoId)
    .maybeSingle();
  let item = itemResult.data as { id: string } | null;

  type VerbaRow = {
    valor: number | null;
    percentual: number | null;
    ativa: boolean;
    folha_rubricas: { codigo: string } | null;
  };

  const verbas = ((contrato.folha_contratos_rubricas ?? []) as VerbaRow[])
    .filter((v) => v.ativa && v.folha_rubricas?.codigo)
    .map((v) => ({
      rubrica_codigo: v.folha_rubricas!.codigo,
      valor: v.valor,
      percentual: v.percentual,
    }));

  type PerfilRow = {
    automatica: boolean;
    ordem_execucao: number;
    folha_rubricas: {
      id: string;
      codigo: string;
      nome: string;
      tipo: "provento" | "desconto" | "base" | "informativa";
      metodo_calculo: string;
      incide_inss: boolean;
      incide_irrf: boolean;
      incide_fgts: boolean;
      incide_dsr: boolean;
      ordem_holerite: number;
    };
  };

  const perfilMapped = ((perfilRubricas ?? []) as unknown as PerfilRow[]).map((p) => ({
    rubrica: p.folha_rubricas,
    automatica: p.automatica,
    ordem_execucao: p.ordem_execucao,
  }));

  const resultado = calcularItem({
    contrato: {
      id: contrato.id as string,
      salario_base: contrato.salario_base as number | null,
      valor_hora_aula: contrato.valor_hora_aula as number | null,
      aulas_semanais: contrato.aulas_semanais as number | null,
      dependentes_irrf: (contrato.dependentes_irrf as number) ?? 0,
      verbas,
    },
    perfilRubricas: perfilMapped,
    config: {
      divisor_dsr: config.divisor_dsr as number,
      percentual_hora_atividade: Number(config.percentual_hora_atividade),
      semanas_mes: Number(config.semanas_mes),
    },
    manuais: manuaisOverride,
    faixas: { inss: faixas.inss, ir: faixas.ir },
    redutor: faixas.redutor,
    rubricasExtras: (todasRubricas ?? []) as Parameters<typeof calcularItem>[0]["rubricasExtras"],
  });

  if (!item) {
    const inserted = await supabase
      .from("folha_itens")
      .insert({ run_id: runId, contrato_id: contratoId })
      .select("id")
      .single();
    item = inserted.data as { id: string } | null;
  }
  if (!item) throw new Error("Falha ao criar item");

  const { error: delErr } = await supabase.from("folha_lancamentos").delete().eq("item_id", item.id);
  if (delErr) throw delErr;

  const rubricaIds = new Map(
    (todasRubricas ?? []).map((r) => [
      (r as { codigo: string; id: string }).codigo,
      (r as { codigo: string; id: string }).id,
    ])
  );

  const linhas = resultado.lancamentos
    .map((l) => {
      const rubrica_id = rubricaIds.get(l.rubrica_codigo);
      if (!rubrica_id) return null;
      const m = manuaisOverride.find(
        (x) => x.rubrica_codigo === l.rubrica_codigo && x.valor === l.valor
      );
      return {
        item_id: item!.id,
        rubrica_id,
        referencia: l.referencia,
        valor: l.valor,
        origem: l.origem,
        recorrente_parcelas: m?.recorrente_parcelas ?? null,
        recorrente_parcela_atual: m?.recorrente_parcela_atual ?? null,
      };
    })
    .filter((l): l is NonNullable<typeof l> => l !== null);

  if (linhas.length) {
    const { error: insErr } = await supabase.from("folha_lancamentos").insert(linhas);
    if (insErr) throw insErr;
  }

  const { error: updItemErr } = await supabase
    .from("folha_itens")
    .update({
      total_proventos: resultado.total_proventos,
      total_descontos: resultado.total_descontos,
      liquido: resultado.liquido,
      base_inss: resultado.base_inss,
      base_irrf: resultado.base_irrf,
      base_fgts: resultado.base_fgts,
    })
    .eq("id", item.id);
  if (updItemErr) throw updItemErr;
}

async function recalcularTotaisAdmin(supabase: SupabaseClient, runId: string) {
  const { data: itens } = await supabase
    .from("folha_itens")
    .select("total_proventos, total_descontos, liquido")
    .eq("run_id", runId)
    .eq("status", "ativo");

  const t = (itens ?? []).reduce(
    (acc, i) => {
      const row = i as { total_proventos: number | null; total_descontos: number | null; liquido: number | null };
      return {
        p: acc.p + Number(row.total_proventos ?? 0),
        d: acc.d + Number(row.total_descontos ?? 0),
        l: acc.l + Number(row.liquido ?? 0),
      };
    },
    { p: 0, d: 0, l: 0 }
  );

  const { error: updRunErr } = await supabase
    .from("folha_runs")
    .update({ total_proventos: t.p, total_descontos: t.d, total_liquido: t.l })
    .eq("id", runId);
  if (updRunErr) throw updRunErr;
}
