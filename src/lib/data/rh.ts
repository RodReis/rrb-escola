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

export type Employee = {
  id: string;
  company_id: string;
  cpf: string;
  name: string;
  birth_date: string | null;
  hire_date: string | null;
  school_category: string | null;
  email: string | null;
  telefone: string | null;
  cargo: string | null;
  status_contrato: string | null;
  ativo: boolean;
  salario_sem_dsr: number | null;
  aplica_dobra: boolean | null;
  companies?: { id: string; name: string; cnpj: string } | null;
};

export type EmployeeFilters = {
  companyId?: string;
  segmento?: string;
  search?: string;
  statusContrato?: string;
  includeInactive?: boolean;
};

export async function listEmployees(filters: EmployeeFilters = {}): Promise<Employee[]> {
  const supabase = await createServerClient();
  let query = supabase
    .from("employees")
    .select("id, company_id, cpf, name, birth_date, hire_date, school_category, email, telefone, cargo, status_contrato, ativo, salario_sem_dsr, aplica_dobra, companies(id, name, cnpj)")
    .order("name");

  if (!filters.includeInactive) query = query.eq("ativo", true);
  if (filters.companyId) query = query.eq("company_id", filters.companyId);
  if (filters.segmento) query = query.eq("school_category", filters.segmento);
  if (filters.statusContrato) query = query.eq("status_contrato", filters.statusContrato);
  if (filters.search) {
    const term = `%${filters.search}%`;
    query = query.or(`name.ilike.${term},cpf.ilike.${term},email.ilike.${term}`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((row) => ({
    ...row,
    companies: Array.isArray(row.companies) ? row.companies[0] ?? null : row.companies ?? null
  })) as Employee[];
}

export async function getEmployeeById(id: string): Promise<Employee | null> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("employees")
    .select("id, company_id, cpf, name, birth_date, hire_date, school_category, email, telefone, cargo, status_contrato, ativo, salario_sem_dsr, aplica_dobra, companies(id, name, cnpj)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    ...data,
    companies: Array.isArray(data.companies) ? data.companies[0] ?? null : data.companies ?? null
  } as Employee;
}

export type EmployeeSegmentCounts = {
  all: number;
  admin: number;
  fund1: number;
  fund2: number;
  medio: number;
};

export async function getEmployeeSegmentCounts(
  filters: Omit<EmployeeFilters, "segmento"> = {}
): Promise<EmployeeSegmentCounts> {
  const supabase = await createServerClient();
  let query = supabase
    .from("employees")
    .select("school_category, ativo, company_id, name, cpf, email, status_contrato");

  if (!filters.includeInactive) query = query.eq("ativo", true);
  if (filters.companyId) query = query.eq("company_id", filters.companyId);
  if (filters.statusContrato) query = query.eq("status_contrato", filters.statusContrato);
  if (filters.search) {
    const term = `%${filters.search}%`;
    query = query.or(`name.ilike.${term},cpf.ilike.${term},email.ilike.${term}`);
  }

  const { data, error } = await query;
  if (error) throw error;

  const counts: EmployeeSegmentCounts = { all: 0, admin: 0, fund1: 0, fund2: 0, medio: 0 };
  for (const row of data ?? []) {
    counts.all += 1;
    const cat = row.school_category as keyof Omit<EmployeeSegmentCounts, "all"> | null;
    if (cat && cat in counts) counts[cat] += 1;
  }
  return counts;
}
