import { createServerClient } from "@/lib/supabase/server";
import { DEFAULT_SCHOOL_ID } from "@/lib/constants";

export type GestaoFinanceira = "propria" | "terceirizada";

export type EscolaConfig = {
  gestaoFinanceira: GestaoFinanceira;
};

export async function getEscolaConfig(escolaId: string = DEFAULT_SCHOOL_ID): Promise<EscolaConfig> {
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("escolas")
    .select("gestao_financeira")
    .eq("id", escolaId)
    .maybeSingle();

  const value = (data?.gestao_financeira as GestaoFinanceira | undefined) ?? "propria";
  return { gestaoFinanceira: value };
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function competenciaFromDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

function monthRange(competencia: string): { first: string; last: string } {
  const [y, m] = competencia.split("-").map(Number);
  const first = `${y}-${pad(m)}-01`;
  const last = `${y}-${pad(m)}-${pad(new Date(y, m, 0).getDate())}`;
  return { first, last };
}

function competenciaToReferenceMonth(competencia: string): string {
  const [y, m] = competencia.split("-").map(Number);
  return `${y}-${pad(m)}-01`;
}

function prevCompetencia(competencia: string): string {
  const [y, m] = competencia.split("-").map(Number);
  const d = new Date(y, m - 2, 1);
  return competenciaFromDate(d);
}

export function currentCompetencia(): string {
  return competenciaFromDate(new Date());
}

export type HeroData = {
  competencia: string;
  receita: number;
  receitaPrev: number;
  despesa: number;
  despesaPrev: number;
  folha: number;
  folhaPrev: number;
  margem: number;
  margemPrev: number;
};

type Supa = Awaited<ReturnType<typeof createServerClient>>;

async function somaPagamentos(
  supabase: Supa,
  escolaId: string,
  competencia: string
): Promise<number> {
  const { first, last } = monthRange(competencia);
  const { data } = await supabase
    .from("pagamentos")
    .select("valor_pago")
    .eq("escola_id", escolaId)
    .gte("data_pagamento", first)
    .lte("data_pagamento", last)
    .is("cancelado_em", null);
  return (data ?? []).reduce((s, r) => s + Number(r.valor_pago ?? 0), 0);
}

async function somaDespesas(
  supabase: Supa,
  escolaId: string,
  competencia: string
): Promise<number> {
  const { data } = await supabase
    .from("despesas")
    .select("valor")
    .eq("escola_id", escolaId)
    .eq("competencia", competencia);
  return (data ?? []).reduce((s, r) => s + Number(r.valor ?? 0), 0);
}

// Nota: tabela payroll nao tem escola_id; reference_month e DATE (YYYY-MM-01).
// Soma total_earnings (proventos brutos) do mes inteiro.
async function somaFolha(
  supabase: Supa,
  _escolaId: string,
  competencia: string
): Promise<number> {
  const referenceMonth = competenciaToReferenceMonth(competencia);
  const { data } = await supabase
    .from("payroll")
    .select("total_earnings")
    .eq("reference_month", referenceMonth);
  return (data ?? []).reduce((s, r) => s + Number(r.total_earnings ?? 0), 0);
}

export async function getHero(
  competencia: string,
  escolaId: string = DEFAULT_SCHOOL_ID
): Promise<HeroData> {
  const supabase = await createServerClient();
  const prev = prevCompetencia(competencia);

  const [receita, receitaPrev, despesa, despesaPrev, folha, folhaPrev] = await Promise.all([
    somaPagamentos(supabase, escolaId, competencia),
    somaPagamentos(supabase, escolaId, prev),
    somaDespesas(supabase, escolaId, competencia),
    somaDespesas(supabase, escolaId, prev),
    somaFolha(supabase, escolaId, competencia),
    somaFolha(supabase, escolaId, prev),
  ]);

  return {
    competencia,
    receita,
    receitaPrev,
    despesa,
    despesaPrev,
    folha,
    folhaPrev,
    margem: receita - despesa - folha,
    margemPrev: receitaPrev - despesaPrev - folhaPrev,
  };
}
