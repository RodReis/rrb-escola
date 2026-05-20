import { createServerClient } from "@/lib/supabase/server";

export type PayrollPeriod = {
  id: string;
  reference_month: string;
  status: "aberto" | "fechado";
  closed_at: string | null;
  closed_by: string | null;
};

export type PayrollRow = {
  id: string;
  employee_id: string;
  reference_month: string;
  base_salary: number | null;
  additional: number | null;
  horas_extras: number | null;
  gratificacao: number | null;
  comissao: number | null;
  adicional_noturno: number | null;
  periculosidade: number | null;
  insalubridade: number | null;
  outros_proventos: number | null;
  family_allowance: number | null;
  vale_transporte: number | null;
  vale_alimentacao: number | null;
  outros_descontos: number | null;
  loan_deduction: number | null;
  advance: number | null;
  uniform_value: number | null;
  gps: number | null;
  dependentes: number | null;
  salario_sem_dsr: number | null;
  aplica_dobra: boolean | null;
  total_earnings: number | null;
  inss: number | null;
  ir: number | null;
  inss_manual: boolean;
  ir_manual: boolean;
  total_deductions: number | null;
  net_amount: number | null;
  consider_decimo_terceiro: boolean | null;
  considera_um_tercio_ferias: boolean | null;
  observations: string | null;
};

export type PayrollRowJoined = PayrollRow & {
  employees: {
    id: string;
    name: string;
    cpf: string;
    cargo: string | null;
    school_category: string | null;
    ativo: boolean;
    company_id: string;
    base_salary: number | null;
    salario_sem_dsr: number | null;
    aplica_dobra: boolean | null;
    gps_default: number | null;
    companies: { id: string; name: string; cnpj: string } | null;
  } | null;
};

export type PayrollFilters = {
  search?: string;
  companyId?: string;
  segmento?: string;
};

export async function listPayrollByMonth(
  dbMonth: string,
  filters: PayrollFilters = {}
): Promise<PayrollRowJoined[]> {
  const supabase = await createServerClient();

  let query = supabase
    .from("payroll")
    .select(`
      id, employee_id, reference_month, base_salary, additional,
      horas_extras, gratificacao, comissao, adicional_noturno, periculosidade, insalubridade, outros_proventos,
      family_allowance, vale_transporte, vale_alimentacao, outros_descontos, loan_deduction, advance, uniform_value, gps,
      dependentes, salario_sem_dsr, aplica_dobra, total_earnings, inss, ir, inss_manual, ir_manual, total_deductions, net_amount,
      consider_decimo_terceiro, considera_um_tercio_ferias, observations,
      employees!inner(id, name, cpf, cargo, school_category, ativo, company_id, base_salary, salario_sem_dsr, aplica_dobra, gps_default, companies(id, name, cnpj))
    `)
    .eq("reference_month", dbMonth);

  const { data, error } = await query;
  if (error) throw error;

  let rows = (data ?? []).map((r) => ({
    ...r,
    employees: Array.isArray(r.employees) ? r.employees[0] ?? null : r.employees ?? null
  })) as unknown as PayrollRowJoined[];

  rows = rows.map((r) => {
    if (r.employees && Array.isArray(r.employees.companies)) {
      r.employees.companies = (r.employees.companies as unknown as Array<{ id: string; name: string; cnpj: string }>)[0] ?? null;
    }
    return r;
  });

  rows = rows.filter((r) => r.employees?.ativo !== false);
  if (filters.companyId) rows = rows.filter((r) => r.employees?.company_id === filters.companyId);
  if (filters.segmento) rows = rows.filter((r) => r.employees?.school_category === filters.segmento);
  if (filters.search) {
    const term = filters.search.toLowerCase();
    rows = rows.filter((r) => {
      const name = r.employees?.name?.toLowerCase() ?? "";
      const cpf = r.employees?.cpf ?? "";
      return name.includes(term) || cpf.includes(term);
    });
  }

  rows.sort((a, b) => (a.employees?.name ?? "").localeCompare(b.employees?.name ?? ""));
  return rows;
}

export async function listCompanies(): Promise<{ id: string; name: string }[]> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("companies")
    .select("id, name")
    .order("name");
  if (error) throw error;
  return data ?? [];
}

export async function getPayrollByEmployeeMonth(
  employeeId: string,
  dbMonth: string
): Promise<PayrollRowJoined | null> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("payroll")
    .select(`
      id, employee_id, reference_month, base_salary, additional,
      horas_extras, gratificacao, comissao, adicional_noturno, periculosidade, insalubridade, outros_proventos,
      family_allowance, vale_transporte, vale_alimentacao, outros_descontos, loan_deduction, advance, uniform_value, gps,
      dependentes, salario_sem_dsr, aplica_dobra, total_earnings, inss, ir, inss_manual, ir_manual, total_deductions, net_amount,
      consider_decimo_terceiro, considera_um_tercio_ferias, observations,
      employees!inner(id, name, cpf, cargo, school_category, ativo, company_id, hire_date, birth_date, base_salary, salario_sem_dsr, aplica_dobra, gps_default, companies(id, name, cnpj))
    `)
    .eq("employee_id", employeeId)
    .eq("reference_month", dbMonth)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = { ...data, employees: Array.isArray(data.employees) ? data.employees[0] ?? null : data.employees ?? null } as unknown as PayrollRowJoined;
  if (row.employees && Array.isArray(row.employees.companies)) {
    row.employees.companies = (row.employees.companies as unknown as Array<{ id: string; name: string; cnpj: string }>)[0] ?? null;
  }
  return row;
}

export async function getPayrollPeriod(dbMonth: string): Promise<PayrollPeriod> {
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("payroll_periods")
    .select("id, reference_month, status, closed_at, closed_by")
    .eq("reference_month", dbMonth)
    .maybeSingle();

  if (data) return data as PayrollPeriod;

  // Create with default
  const { data: created, error } = await supabase
    .from("payroll_periods")
    .insert({ reference_month: dbMonth, status: "aberto" })
    .select("id, reference_month, status, closed_at, closed_by")
    .single();
  if (error) throw error;
  return created as PayrollPeriod;
}

export type MonthSummary = {
  count: number;
  total_proventos: number;
  total_descontos: number;
  total_liquido: number;
  total_inss: number;
  total_ir: number;
};

export async function getMonthSummary(dbMonth: string): Promise<MonthSummary> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("payroll")
    .select("total_earnings, total_deductions, net_amount, inss, ir")
    .eq("reference_month", dbMonth);
  if (error) throw error;
  const rows = data ?? [];
  return {
    count: rows.length,
    total_proventos: rows.reduce((s, r) => s + Number(r.total_earnings ?? 0), 0),
    total_descontos: rows.reduce((s, r) => s + Number(r.total_deductions ?? 0), 0),
    total_liquido: rows.reduce((s, r) => s + Number(r.net_amount ?? 0), 0),
    total_inss: rows.reduce((s, r) => s + Number(r.inss ?? 0), 0),
    total_ir: rows.reduce((s, r) => s + Number(r.ir ?? 0), 0)
  };
}

export async function listEmployeesNeedingPayroll(dbMonth: string): Promise<Array<{ id: string; name: string }>> {
  const supabase = await createServerClient();
  const { data: existing } = await supabase
    .from("payroll")
    .select("employee_id")
    .eq("reference_month", dbMonth);
  const existingIds = new Set((existing ?? []).map((r) => r.employee_id));

  const { data: actives, error } = await supabase
    .from("employees")
    .select("id, name")
    .eq("ativo", true)
    .order("name");
  if (error) throw error;
  return (actives ?? []).filter((e) => !existingIds.has(e.id));
}
