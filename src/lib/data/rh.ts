import { createServerClient } from "@/lib/supabase/server";

export type Company = {
  id: string;
  cnpj: string;
  name: string;
  ativo: boolean;
  created_at: string | null;
  updated_at: string | null;
};

export type CompanySummary = {
  totalFuncionarios: number;
  ativos: number;
  inativos: number;
  porCategoria: { admin: number; fund1: number; fund2: number; medio: number };
};

export async function listCompanies(opts?: { includeInactive?: boolean }): Promise<Company[]> {
  const supabase = await createServerClient();
  let query = supabase
    .from("companies")
    .select("id, cnpj, name, ativo, created_at, updated_at")
    .order("name");
  if (!opts?.includeInactive) query = query.eq("ativo", true);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Company[];
}

export async function getCompanyById(id: string): Promise<Company | null> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("companies")
    .select("id, cnpj, name, ativo, created_at, updated_at")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as Company | null) ?? null;
}

export async function getCompanySummary(id: string): Promise<CompanySummary> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("employees")
    .select("id, ativo, school_category")
    .eq("company_id", id);
  if (error) throw error;
  const summary: CompanySummary = {
    totalFuncionarios: 0,
    ativos: 0,
    inativos: 0,
    porCategoria: { admin: 0, fund1: 0, fund2: 0, medio: 0 }
  };
  for (const row of data ?? []) {
    summary.totalFuncionarios += 1;
    if (row.ativo) summary.ativos += 1;
    else summary.inativos += 1;
    const cat = row.school_category as keyof typeof summary.porCategoria | null;
    if (cat && cat in summary.porCategoria) summary.porCategoria[cat] += 1;
  }
  return summary;
}
