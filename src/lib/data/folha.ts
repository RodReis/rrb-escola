import { createServerClient } from "@/lib/supabase/server";
import { getBracketsForMonth, type InssBracketRow, type IrBracketRow } from "@/lib/data/brackets";

export type RedutorIrrf = {
  id: string;
  valido_de: string;
  valido_ate: string | null;
  limite_isencao: number;
  limite_reducao: number;
  coef_fixo: number;
  coef_mult: number;
};

export async function getRuns(competencia?: string) {
  const supabase = await createServerClient();
  let q = supabase
    .from("folha_runs")
    .select("*, companies(name)")
    .order("competencia", { ascending: false });
  if (competencia) q = q.eq("competencia", competencia);
  const { data, error } = await q;
  if (error) throw error;
  return data;
}

export async function getRunDetalhe(runId: string) {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("folha_runs")
    .select(
      `*, companies(name),
      folha_itens(*, folha_contratos(id, employees(name),
        folha_perfis_calculo:perfil_calculo_id(codigo, nome)))`
    )
    .eq("id", runId)
    .single();
  if (error) throw error;
  return data;
}

export async function getItemLancamentos(itemId: string) {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("folha_lancamentos")
    .select("*, folha_rubricas(codigo, nome, tipo, ordem_holerite)")
    .eq("item_id", itemId);
  if (error) throw error;
  return (data ?? []).sort(
    (a, b) =>
      ((a.folha_rubricas as { ordem_holerite: number } | null)?.ordem_holerite ?? 99) -
      ((b.folha_rubricas as { ordem_holerite: number } | null)?.ordem_holerite ?? 99)
  );
}

export async function getItemComRun(itemId: string) {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("folha_itens")
    .select(
      `id, status, total_proventos, total_descontos, liquido,
       folha_runs:run_id(id, status, competencia, companies:company_id(name)),
       folha_contratos(employees(name), folha_perfis_calculo:perfil_calculo_id(nome))`
    )
    .eq("id", itemId)
    .single();
  if (error) throw error;
  return data;
}

export async function getRubricas() {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("folha_rubricas")
    .select("*")
    .order("ordem_holerite");
  if (error) throw error;
  return data;
}

export async function getPerfis() {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("folha_perfis_calculo")
    .select("*, folha_perfis_rubricas(*, folha_rubricas(*))")
    .order("nome");
  if (error) throw error;
  return data;
}

export async function getContratos(ativos = true) {
  const supabase = await createServerClient();
  let q = supabase.from("folha_contratos").select(
    `*, employees(name, cpf), companies(name),
      folha_perfis_calculo:perfil_calculo_id(codigo, nome),
      folha_contratos_rubricas(*, folha_rubricas(codigo, nome))`
  );
  if (ativos) q = q.eq("ativo", true);
  const { data, error } = await q;
  if (error) throw error;
  return data;
}

export async function getConfig(companyId: string) {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("folha_config")
    .select("*")
    .eq("company_id", companyId)
    .single();
  if (error) throw error;
  return data;
}

export async function getProvisoesSaldo() {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("folha_provisoes")
    .select("*, folha_contratos(employees(name))")
    .is("baixada_em", null)
    .order("competencia", { ascending: false });
  if (error) throw error;
  return data;
}

export async function getContrato(id: string) {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("folha_contratos")
    .select(
      `*, employees(id, name), companies(id, name),
       folha_perfis_calculo:perfil_calculo_id(id, codigo, nome),
       folha_contratos_rubricas(*, folha_rubricas(id, codigo, nome))`
    )
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

export async function getEmployeesWithoutContract() {
  const supabase = await createServerClient();
  const { data: empData, error: empErr } = await supabase
    .from("employees")
    .select("id, name")
    .eq("active", true)
    .order("name");
  if (empErr) throw empErr;

  const { data: contratoData, error: cErr } = await supabase
    .from("folha_contratos")
    .select("employee_id")
    .eq("ativo", true);
  if (cErr) throw cErr;

  const comContrato = new Set((contratoData ?? []).map((c) => (c as { employee_id: string }).employee_id));
  return (empData ?? []).filter((e) => !comContrato.has(e.id));
}

export async function getCategoriasDespesa() {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("categorias_despesa")
    .select("id, nome")
    .eq("ativo", true)
    .order("nome");
  if (error) throw error;
  return data ?? [];
}

export async function getConfigOrNull(companyId: string) {
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("folha_config")
    .select("*")
    .eq("company_id", companyId)
    .maybeSingle();
  return data;
}

export async function getFaixasVigentes(competencia: string): Promise<{
  inss: InssBracketRow[];
  ir: IrBracketRow[];
  redutor: RedutorIrrf | null;
}> {
  const ref = `${competencia}-01`;
  const supabase = await createServerClient();

  const [brackets, red] = await Promise.all([
    getBracketsForMonth(ref),
    supabase
      .from("irrf_redutor")
      .select("*")
      .lte("valido_de", ref)
      .order("valido_de", { ascending: false })
      .limit(1),
  ]);

  if (red.error) throw red.error;

  return {
    inss: brackets.inss,
    ir: brackets.ir,
    redutor: (red.data?.[0] as RedutorIrrf | undefined) ?? null,
  };
}
