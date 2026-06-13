import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerClient } from "@/lib/supabase/server";
import { getFaixasVigentes } from "@/lib/data/folha";
import { avos, baseCalculo13Ferias } from "./engine/avos";
import { calcularDecimo1a, calcularDecimo2a, type ResultadoEspecial } from "./engine/decimo";
import { calcularFerias } from "./engine/ferias";
import { calcHoraAula } from "./engine/proventos";
import { recalcularTotaisRun } from "./service";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

type ContratoEspecial = {
  id: string;
  perfil_codigo: string;
  salario_vigente: number;
  data_admissao: string;
  data_desligamento: string | null;
  dependentes_irrf: number;
  antecipa_13_com_ferias: boolean;
};

type PeriodoAgendado = {
  id: string;
  gozo_dias: number;
  dias_abono: number;
  dias_direito: number;
};

async function contratosCltAtivos(
  companyId: string,
  tipo: string,
  anoRef: number,
  client?: SupabaseClient,
): Promise<Array<{ contrato: ContratoEspecial; periodo?: PeriodoAgendado }>> {
  const supabase = client ?? (await createServerClient());

  const { data: config, error: cfgErr } = await supabase
    .from("folha_config")
    .select("semanas_mes")
    .eq("company_id", companyId)
    .single();
  if (cfgErr) throw cfgErr;

  const { data: contratos, error: cErr } = await supabase
    .from("folha_contratos")
    .select(
      "id, salario_base, valor_hora_aula, aulas_semanais, data_admissao, data_desligamento, dependentes_irrf, antecipa_13_com_ferias, folha_perfis_calculo!perfil_calculo_id(codigo), folha_contratos_rubricas(valor, ativa, folha_rubricas(codigo, tipo))",
    )
    .eq("company_id", companyId)
    .eq("ativo", true);
  if (cErr) throw cErr;

  type ContratoRow = {
    id: string;
    salario_base: number | null;
    valor_hora_aula: number | null;
    aulas_semanais: number | null;
    data_admissao: string;
    data_desligamento: string | null;
    dependentes_irrf: number | null;
    antecipa_13_com_ferias: boolean | null;
    folha_perfis_calculo: { codigo: string } | null;
    folha_contratos_rubricas: Array<{
      valor: number | null;
      ativa: boolean;
      folha_rubricas: { codigo: string; tipo: string } | null;
    }>;
  };

  const cltCodigos = ["clt", "clt_professor"];
  const candidatos = (contratos ?? []) as unknown as ContratoRow[];
  const cltContratos = candidatos.filter(
    (c) => c.folha_perfis_calculo?.codigo && cltCodigos.includes(c.folha_perfis_calculo.codigo),
  );

  let excluirIds = new Set<string>();
  if (tipo === "decimo_1a") {
    const anoInicio = `${anoRef}-01-01`;
    const anoFim = `${anoRef}-12-31`;
    const { data: jaTemParcela, error: jpErr } = await supabase
      .from("folha_lancamentos")
      .select(
        "folha_itens!inner(contrato_id, folha_runs!inner(competencia, status))",
      )
      .eq("folha_rubricas.codigo", "decimo_1a_parcela")
      .in("folha_itens.folha_runs.status", ["aprovado"])
      .gte("folha_itens.folha_runs.competencia", anoInicio.slice(0, 7))
      .lte("folha_itens.folha_runs.competencia", anoFim.slice(0, 7));
    if (jpErr) throw jpErr;

    type JaTemRow = {
      folha_itens: { contrato_id: string; folha_runs: { competencia: string; status: string } };
    };
    for (const row of (jaTemParcela ?? []) as unknown as JaTemRow[]) {
      excluirIds.add(row.folha_itens.contrato_id);
    }
  }

  const semanas = Number(config?.semanas_mes ?? 4);
  const resultado: Array<{ contrato: ContratoEspecial; periodo?: PeriodoAgendado }> = [];

  for (const c of cltContratos) {
    if (excluirIds.has(c.id)) continue;
    const perfil = c.folha_perfis_calculo?.codigo ?? "clt";

    let salario_vigente: number;
    if (perfil === "clt_professor") {
      const horaAula = round2(
        calcHoraAula(c.valor_hora_aula ?? 0, c.aulas_semanais ?? 0, semanas),
      );
      const somaVerbas = (c.folha_contratos_rubricas ?? [])
        .filter(
          (v) =>
            v.ativa &&
            v.folha_rubricas?.tipo === "provento" &&
            v.valor != null,
        )
        .reduce((acc, v) => acc + (v.valor ?? 0), 0);
      salario_vigente = round2(horaAula + somaVerbas);
    } else {
      salario_vigente = round2(c.salario_base ?? 0);
    }

    resultado.push({
      contrato: {
        id: c.id,
        perfil_codigo: perfil,
        salario_vigente,
        data_admissao: c.data_admissao,
        data_desligamento: c.data_desligamento,
        dependentes_irrf: c.dependentes_irrf ?? 0,
        antecipa_13_com_ferias: c.antecipa_13_com_ferias ?? false,
      },
    });
  }

  return resultado;
}

async function contratosComFeriasAgendadas(
  companyId: string,
  janela: string | undefined,
  competencia: string,
  client?: SupabaseClient,
): Promise<Array<{ contrato: ContratoEspecial; periodo?: PeriodoAgendado }>> {
  const supabase = client ?? (await createServerClient());

  const [ano, mes] = competencia.split("-").map(Number);
  const proxMesAno = mes === 12 ? ano + 1 : ano;
  const proxMes = mes === 12 ? 1 : mes + 1;
  const proxMesInicio = `${proxMesAno}-${String(proxMes).padStart(2, "0")}-01`;
  const proxMesFim = new Date(Date.UTC(proxMesAno, proxMes, 0));
  const proxMesFimISO = proxMesFim.toISOString().slice(0, 10);

  let query = supabase
    .from("folha_periodos_aquisitivos")
    .select(
      "id, gozo_inicio, gozo_dias, dias_abono, dias_direito, folha_contratos!inner(id, salario_base, valor_hora_aula, aulas_semanais, data_admissao, data_desligamento, dependentes_irrf, antecipa_13_com_ferias, company_id, folha_perfis_calculo!perfil_calculo_id(codigo), folha_contratos_rubricas(valor, ativa, folha_rubricas(codigo, tipo)))",
    )
    .eq("status", "agendado")
    .eq("folha_contratos.company_id", companyId)
    .gte("gozo_inicio", proxMesInicio)
    .lte("gozo_inicio", proxMesFimISO);

  if (janela) {
    query = query.eq("janela", janela);
  }

  const { data: periodos, error: pErr } = await query;
  if (pErr) throw pErr;

  const { data: config, error: cfgErr } = await supabase
    .from("folha_config")
    .select("semanas_mes")
    .eq("company_id", companyId)
    .single();
  if (cfgErr) throw cfgErr;

  const semanas = Number(config?.semanas_mes ?? 4);

  type PeriodoRow = {
    id: string;
    gozo_inicio: string;
    gozo_dias: number;
    dias_abono: number;
    dias_direito: number;
    folha_contratos: {
      id: string;
      salario_base: number | null;
      valor_hora_aula: number | null;
      aulas_semanais: number | null;
      data_admissao: string;
      data_desligamento: string | null;
      dependentes_irrf: number | null;
      antecipa_13_com_ferias: boolean | null;
      folha_perfis_calculo: { codigo: string } | null;
      folha_contratos_rubricas: Array<{
        valor: number | null;
        ativa: boolean;
        folha_rubricas: { codigo: string; tipo: string } | null;
      }>;
    };
  };

  const resultado: Array<{ contrato: ContratoEspecial; periodo?: PeriodoAgendado }> = [];

  for (const p of (periodos ?? []) as unknown as PeriodoRow[]) {
    const c = p.folha_contratos;
    const perfil = c.folha_perfis_calculo?.codigo ?? "clt";

    let salario_vigente: number;
    if (perfil === "clt_professor") {
      const horaAula = round2(
        calcHoraAula(c.valor_hora_aula ?? 0, c.aulas_semanais ?? 0, semanas),
      );
      const somaVerbas = (c.folha_contratos_rubricas ?? [])
        .filter(
          (v) =>
            v.ativa &&
            v.folha_rubricas?.tipo === "provento" &&
            v.valor != null,
        )
        .reduce((acc, v) => acc + (v.valor ?? 0), 0);
      salario_vigente = round2(horaAula + somaVerbas);
    } else {
      salario_vigente = round2(c.salario_base ?? 0);
    }

    resultado.push({
      contrato: {
        id: c.id,
        perfil_codigo: perfil,
        salario_vigente,
        data_admissao: c.data_admissao,
        data_desligamento: c.data_desligamento,
        dependentes_irrf: c.dependentes_irrf ?? 0,
        antecipa_13_com_ferias: c.antecipa_13_com_ferias ?? false,
      },
      periodo: {
        id: p.id,
        gozo_dias: p.gozo_dias,
        dias_abono: p.dias_abono,
        dias_direito: p.dias_direito,
      },
    });
  }

  return resultado;
}

async function basesUltimos12(contratoId: string, competencia: string, client?: SupabaseClient): Promise<number[]> {
  const supabase = client ?? (await createServerClient());
  const { data, error } = await supabase
    .from("folha_itens")
    .select("base_fgts, folha_runs!inner(competencia, tipo, status)")
    .eq("contrato_id", contratoId)
    .eq("folha_runs.tipo", "mensal")
    .eq("folha_runs.status", "aprovado")
    .lt("folha_runs.competencia", competencia)
    .order("folha_runs.competencia", { ascending: false })
    .limit(12);
  if (error) throw error;

  type ItemBase = { base_fgts: number };
  return (data ?? []).map((r) => Number((r as unknown as ItemBase).base_fgts));
}

async function valor1aPagaNoAno(contratoId: string, anoRef: number, client?: SupabaseClient): Promise<number> {
  const supabase = client ?? (await createServerClient());
  const competenciaInicio = `${anoRef}-01`;
  const competenciaFim = `${anoRef}-12`;

  const { data, error } = await supabase
    .from("folha_lancamentos")
    .select(
      "valor, folha_itens!inner(contrato_id, folha_runs!inner(competencia, status))",
    )
    .eq("folha_rubricas.codigo", "decimo_1a_parcela")
    .eq("folha_itens.contrato_id", contratoId)
    .in("folha_itens.folha_runs.status", ["aprovado"])
    .gte("folha_itens.folha_runs.competencia", competenciaInicio)
    .lte("folha_itens.folha_runs.competencia", competenciaFim);
  if (error) throw error;

  type LancRow = { valor: number };
  return (data ?? []).reduce((acc, r) => acc + Number((r as unknown as LancRow).valor), 0);
}

async function persistirItemEspecial(
  runId: string,
  contratoId: string,
  resultado: ResultadoEspecial,
  periodoId?: string,
  client?: SupabaseClient,
): Promise<void> {
  const supabase = client ?? (await createServerClient());

  const { data: contrato, error: cErr } = await supabase
    .from("folha_contratos")
    .select("escola_id")
    .eq("id", contratoId)
    .single();
  if (cErr) throw cErr;

  const { data: todasRubricas, error: rErr } = await supabase
    .from("folha_rubricas")
    .select("id, codigo")
    .eq("escola_id", contrato.escola_id as string)
    .eq("ativa", true);
  if (rErr) throw rErr;

  const rubricaIds = new Map(
    (todasRubricas ?? []).map((r) => [
      (r as { codigo: string; id: string }).codigo,
      (r as { codigo: string; id: string }).id,
    ]),
  );

  const { data: item, error: iErr } = await supabase
    .from("folha_itens")
    .insert({
      run_id: runId,
      contrato_id: contratoId,
      total_proventos: resultado.total_proventos,
      total_descontos: resultado.total_descontos,
      liquido: resultado.liquido,
      base_inss: resultado.base_inss,
      base_irrf: resultado.base_irrf,
      base_fgts: resultado.base_fgts,
      ...(periodoId ? { periodo_aquisitivo_id: periodoId } : {}),
    })
    .select("id")
    .single();
  if (iErr) throw iErr;

  const linhas = resultado.lancamentos
    .map((l) => {
      const rubrica_id = rubricaIds.get(l.rubrica_codigo);
      if (!rubrica_id) return null;
      return {
        item_id: item.id as string,
        rubrica_id,
        referencia: l.referencia,
        valor: l.valor,
        origem: l.origem,
        recorrente_parcelas: null,
        recorrente_parcela_atual: null,
      };
    })
    .filter((l): l is NonNullable<typeof l> => l !== null);

  if (linhas.length) {
    const { error: insErr } = await supabase.from("folha_lancamentos").insert(linhas);
    if (insErr) throw insErr;
  }
}

export async function gerarRunEspecial(
  companyId: string,
  competencia: string,
  tipo: "decimo_1a" | "decimo_2a" | "ferias",
  geradaPor: string,
  janelaCodigo?: string,
  client?: SupabaseClient,
) {
  const supabase = client ?? (await createServerClient());

  const { data: existente } = await supabase
    .from("folha_runs")
    .select("id")
    .eq("company_id", companyId)
    .eq("competencia", competencia)
    .eq("tipo", tipo)
    .maybeSingle();
  if (existente) return { runId: existente.id as string, criada: false };

  const [{ data: config, error: cfgErr }, faixas] = await Promise.all([
    supabase.from("folha_config").select("*").eq("company_id", companyId).single(),
    getFaixasVigentes(competencia),
  ]);
  if (cfgErr) throw cfgErr;
  if (!config) throw new Error("Config não encontrada");

  const anoRef = Number(competencia.slice(0, 4));

  let contratos: Array<{ contrato: ContratoEspecial; periodo?: PeriodoAgendado }> = [];
  if (tipo === "ferias") {
    contratos = await contratosComFeriasAgendadas(companyId, janelaCodigo, competencia, supabase);
  } else {
    contratos = await contratosCltAtivos(companyId, tipo, anoRef, supabase);
  }

  if (contratos.length === 0) {
    return { runId: null, criada: false, motivo: "nenhum contrato elegível" };
  }

  const { data: run, error: runErr } = await supabase
    .from("folha_runs")
    .insert({
      escola_id: (config as { escola_id: string }).escola_id,
      company_id: companyId,
      competencia,
      tipo,
      gerada_por: geradaPor,
    })
    .select("id")
    .single();
  if (runErr) throw runErr;

  const base13FeriasConfig = (config as { base_13_ferias: Record<string, string> }).base_13_ferias ?? {};

  for (const { contrato, periodo } of contratos) {
    const basesAnteriores = await basesUltimos12(contrato.id, competencia, supabase);
    const base = baseCalculo13Ferias(
      contrato.perfil_codigo,
      base13FeriasConfig,
      contrato.salario_vigente,
      basesAnteriores,
    );

    let resultado: ResultadoEspecial;

    if (tipo === "decimo_1a") {
      resultado = calcularDecimo1a({
        base,
        avos: avos(contrato.data_admissao, contrato.data_desligamento, anoRef),
      });
    } else if (tipo === "decimo_2a") {
      const valor1a = await valor1aPagaNoAno(contrato.id, anoRef, supabase);
      resultado = calcularDecimo2a({
        base,
        avos: avos(contrato.data_admissao, contrato.data_desligamento, anoRef),
        valor1aPaga: valor1a,
        dependentes: contrato.dependentes_irrf,
        faixas: { inss: faixas.inss, ir: faixas.ir },
        redutor: faixas.redutor,
      });
    } else {
      resultado = calcularFerias({
        base,
        diasGozo: periodo!.gozo_dias,
        diasAbono: periodo!.dias_abono,
        diasDireito: periodo!.dias_direito,
        dependentes: contrato.dependentes_irrf,
        faixas: { inss: faixas.inss, ir: faixas.ir },
        redutor: faixas.redutor,
      });

      if (contrato.antecipa_13_com_ferias) {
        const valor1aJaPago = await valor1aPagaNoAno(contrato.id, anoRef, supabase);
        if (!valor1aJaPago) {
          const d1 = calcularDecimo1a({
            base,
            avos: avos(contrato.data_admissao, contrato.data_desligamento, anoRef),
          });
          resultado.lancamentos.push(...d1.lancamentos);
          resultado.total_proventos = round2(resultado.total_proventos + d1.total_proventos);
          resultado.liquido = round2(resultado.liquido + d1.liquido);
          resultado.base_fgts = round2(resultado.base_fgts + d1.base_fgts);
        }
      }
    }

    await persistirItemEspecial(run.id as string, contrato.id, resultado, periodo?.id, supabase);
  }

  await recalcularTotaisRun(run.id as string, supabase);
  return { runId: run.id as string, criada: true };
}
