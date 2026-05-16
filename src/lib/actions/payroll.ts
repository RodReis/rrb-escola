"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requirePerfil } from "@/lib/auth/session";
import { createServerClient } from "@/lib/supabase/server";
import { PayrollSchema } from "@/lib/validation/payroll";
import { calcAll, calcProventosBase, type PayrollInput as CalcInput } from "@/lib/payroll/calculators";
import { getBracketsForMonth } from "@/lib/data/brackets";
import { dbToUrlMonth, urlToDbMonth, shiftUrlMonth } from "@/lib/payroll/date-utils";

function firstError(error: { issues: { message: string }[] }) {
  return encodeURIComponent(error.issues[0]?.message ?? "Dados inválidos");
}

function readPayrollForm(formData: FormData) {
  const get = (k: string) => formData.get(k);
  return {
    employee_id: String(get("employee_id") ?? ""),
    reference_month: String(get("reference_month") ?? ""),
    base_salary: get("base_salary"),
    horas_extras: get("horas_extras"),
    gratificacao: get("gratificacao"),
    comissao: get("comissao"),
    adicional_noturno: get("adicional_noturno"),
    periculosidade: get("periculosidade"),
    insalubridade: get("insalubridade"),
    outros_proventos: get("outros_proventos"),
    family_allowance: get("family_allowance"),
    vale_transporte: get("vale_transporte"),
    vale_alimentacao: get("vale_alimentacao"),
    outros_descontos: get("outros_descontos"),
    loan_deduction: get("loan_deduction"),
    advance: get("advance"),
    uniform_value: get("uniform_value"),
    dependentes: get("dependentes"),
    consider_decimo_terceiro: get("consider_decimo_terceiro"),
    considera_um_tercio_ferias: get("considera_um_tercio_ferias"),
    inss_manual: get("inss_manual"),
    ir_manual: get("ir_manual"),
    inss: get("inss"),
    ir: get("ir"),
    observations: get("observations"),
    salario_sem_dsr: get("salario_sem_dsr"),
    aplica_dobra: get("aplica_dobra")
  };
}

export async function upsertPayrollAction(formData: FormData) {
  await requirePerfil(["admin", "financeiro"]);

  const parsed = PayrollSchema.safeParse(readPayrollForm(formData));
  if (!parsed.success) {
    const urlMonth = dbToUrlMonth(String(formData.get("reference_month") ?? ""));
    const empId = String(formData.get("employee_id") ?? "");
    redirect(`/rh/folha/${urlMonth}/${empId}?erro=${firstError(parsed.error)}`);
  }
  const data = parsed.data;

  const supabase = await createServerClient();

  // Verifica period status
  const { data: period } = await supabase
    .from("payroll_periods")
    .select("status")
    .eq("reference_month", data.reference_month)
    .maybeSingle();
  if (period?.status === "fechado") {
    const urlMonth = dbToUrlMonth(data.reference_month);
    redirect(`/rh/folha/${urlMonth}/${data.employee_id}?erro=${encodeURIComponent("Período fechado")}`);
  }

  // Recalc server-side
  const brackets = await getBracketsForMonth(data.reference_month);
  const semDsr = data.salario_sem_dsr ?? 0;
  const dobra = data.aplica_dobra ?? false;
  const baseDerivada = semDsr > 0 ? calcProventosBase(semDsr, dobra) : data.base_salary;

  const calcInput: CalcInput = {
    base_salary: baseDerivada,
    salario_sem_dsr: semDsr,
    aplica_dobra: dobra,
    horas_extras: data.horas_extras,
    gratificacao: data.gratificacao,
    comissao: data.comissao,
    adicional_noturno: data.adicional_noturno,
    periculosidade: data.periculosidade,
    insalubridade: data.insalubridade,
    outros_proventos: data.outros_proventos,
    family_allowance: data.family_allowance,
    vale_transporte: data.vale_transporte,
    vale_alimentacao: data.vale_alimentacao,
    outros_descontos: data.outros_descontos,
    loan_deduction: data.loan_deduction,
    advance: data.advance,
    uniform_value: data.uniform_value,
    dependentes: data.dependentes
  };
  const computed = calcAll(calcInput, brackets, {
    manualInss: data.inss_manual && data.inss != null ? data.inss : undefined,
    manualIr: data.ir_manual && data.ir != null ? data.ir : undefined
  });

  // Upsert via unique (employee_id, reference_month)
  const { error } = await supabase
    .from("payroll")
    .upsert(
      {
        employee_id: data.employee_id,
        reference_month: data.reference_month,
        base_salary: baseDerivada,
        salario_sem_dsr: semDsr,
        aplica_dobra: dobra,
        horas_extras: data.horas_extras,
        gratificacao: data.gratificacao,
        comissao: data.comissao,
        adicional_noturno: data.adicional_noturno,
        periculosidade: data.periculosidade,
        insalubridade: data.insalubridade,
        outros_proventos: data.outros_proventos,
        family_allowance: data.family_allowance,
        vale_transporte: data.vale_transporte,
        vale_alimentacao: data.vale_alimentacao,
        outros_descontos: data.outros_descontos,
        loan_deduction: data.loan_deduction,
        advance: data.advance,
        uniform_value: data.uniform_value,
        dependentes: data.dependentes,
        inss: computed.inss,
        ir: computed.ir,
        inss_manual: data.inss_manual ?? false,
        ir_manual: data.ir_manual ?? false,
        total_earnings: computed.total_earnings,
        total_deductions: computed.total_deductions,
        net_amount: computed.net_amount,
        consider_decimo_terceiro: data.consider_decimo_terceiro ?? false,
        considera_um_tercio_ferias: data.considera_um_tercio_ferias ?? false,
        observations: data.observations ?? null
      },
      { onConflict: "employee_id,reference_month" }
    );

  if (error) {
    const urlMonth = dbToUrlMonth(data.reference_month);
    redirect(`/rh/folha/${urlMonth}/${data.employee_id}?erro=${encodeURIComponent(error.message)}`);
  }

  const urlMonth = dbToUrlMonth(data.reference_month);
  revalidatePath(`/rh/folha/${urlMonth}`);
  revalidatePath(`/rh/folha/${urlMonth}/${data.employee_id}`);
  redirect(`/rh/folha/${urlMonth}/${data.employee_id}?ok=salvo`);
}

export async function closePeriodAction(formData: FormData) {
  const session = await requirePerfil(["admin"]);
  const dbMonth = urlToDbMonth(String(formData.get("mes") ?? ""));
  const supabase = await createServerClient();

  const { error } = await supabase
    .from("payroll_periods")
    .upsert(
      {
        reference_month: dbMonth,
        status: "fechado",
        closed_at: new Date().toISOString(),
        closed_by: session.user.id
      },
      { onConflict: "reference_month" }
    );
  if (error) {
    redirect(`/rh/folha/${dbToUrlMonth(dbMonth)}?erro=${encodeURIComponent(error.message)}`);
  }
  revalidatePath(`/rh/folha/${dbToUrlMonth(dbMonth)}`);
  redirect(`/rh/folha/${dbToUrlMonth(dbMonth)}?ok=fechado`);
}

export async function reopenPeriodAction(formData: FormData) {
  await requirePerfil(["admin"]);
  const dbMonth = urlToDbMonth(String(formData.get("mes") ?? ""));
  const supabase = await createServerClient();

  const { error } = await supabase
    .from("payroll_periods")
    .update({ status: "aberto", closed_at: null, closed_by: null })
    .eq("reference_month", dbMonth);
  if (error) {
    redirect(`/rh/folha/${dbToUrlMonth(dbMonth)}?erro=${encodeURIComponent(error.message)}`);
  }
  revalidatePath(`/rh/folha/${dbToUrlMonth(dbMonth)}`);
  redirect(`/rh/folha/${dbToUrlMonth(dbMonth)}?ok=reaberto`);
}

export async function generateMonthAction(formData: FormData) {
  await requirePerfil(["admin", "financeiro"]);
  const urlMonth = String(formData.get("mes") ?? "");
  const dbMonth = urlToDbMonth(urlMonth);

  const supabase = await createServerClient();

  // Ensure period row + check status
  const { data: period } = await supabase
    .from("payroll_periods")
    .select("status")
    .eq("reference_month", dbMonth)
    .maybeSingle();
  if (period?.status === "fechado") {
    redirect(`/rh/folha/${urlMonth}?erro=${encodeURIComponent("Mês está fechado")}`);
  }
  if (!period) {
    await supabase.from("payroll_periods").insert({ reference_month: dbMonth, status: "aberto" });
  }

  const { data: employees, error: empErr } = await supabase
    .from("employees")
    .select("id, salario_sem_dsr, aplica_dobra")
    .eq("ativo", true);
  if (empErr) redirect(`/rh/folha/${urlMonth}?erro=${encodeURIComponent(empErr.message)}`);

  // Pull most recent prior payroll for each employee (any prior month, not just last month)
  const { data: priorRows } = await supabase
    .from("payroll")
    .select("employee_id, reference_month, base_salary, dependentes, vale_transporte, vale_alimentacao, salario_sem_dsr, aplica_dobra")
    .lt("reference_month", dbMonth)
    .order("reference_month", { ascending: false });

  const prevMap = new Map<string, { base_salary: number; dependentes: number; vale_transporte: number; vale_alimentacao: number; salario_sem_dsr: number | null; aplica_dobra: boolean | null }>();
  for (const p of priorRows ?? []) {
    if (prevMap.has(p.employee_id)) continue; // já tem (mais recente)
    prevMap.set(p.employee_id, {
      base_salary: Number(p.base_salary ?? 0),
      dependentes: Number(p.dependentes ?? 0),
      vale_transporte: Number(p.vale_transporte ?? 0),
      vale_alimentacao: Number(p.vale_alimentacao ?? 0),
      salario_sem_dsr: p.salario_sem_dsr != null ? Number(p.salario_sem_dsr) : null,
      aplica_dobra: p.aplica_dobra
    });
  }

  const rows = (employees ?? []).map((e) => {
    const prev = prevMap.get(e.id);
    const empSemDsr = Number(e.salario_sem_dsr ?? 0);
    const empDobra = e.aplica_dobra ?? false;
    const semDsr = prev?.salario_sem_dsr ?? (empSemDsr > 0 ? empSemDsr : null);
    const dobra = prev?.aplica_dobra ?? empDobra;
    const baseFromSemDsr = semDsr != null && semDsr > 0
      ? calcProventosBase(semDsr, dobra ?? false)
      : null;
    const base_salary = baseFromSemDsr ?? prev?.base_salary ?? 0;
    return {
      employee_id: e.id,
      reference_month: dbMonth,
      base_salary,
      salario_sem_dsr: semDsr,
      aplica_dobra: dobra,
      dependentes: prev?.dependentes ?? 0,
      vale_transporte: prev?.vale_transporte ?? 0,
      vale_alimentacao: prev?.vale_alimentacao ?? 0,
      total_earnings: base_salary,
      total_deductions: 0,
      net_amount: base_salary
    };
  });

  if (rows.length > 0) {
    const { error } = await supabase
      .from("payroll")
      .upsert(rows, { onConflict: "employee_id,reference_month", ignoreDuplicates: true });
    if (error) redirect(`/rh/folha/${urlMonth}?erro=${encodeURIComponent(error.message)}`);
  }

  revalidatePath(`/rh/folha/${urlMonth}`);
  redirect(`/rh/folha/${urlMonth}?ok=gerada`);
}

export async function syncNewEmployeesAction(formData: FormData) {
  await requirePerfil(["admin", "financeiro"]);
  const urlMonth = String(formData.get("mes") ?? "");
  const dbMonth = urlToDbMonth(urlMonth);

  const supabase = await createServerClient();

  const { data: period } = await supabase
    .from("payroll_periods")
    .select("status")
    .eq("reference_month", dbMonth)
    .maybeSingle();
  if (period?.status === "fechado") {
    redirect(`/rh/folha/${urlMonth}?erro=${encodeURIComponent("Mês está fechado")}`);
  }

  const { data: existing } = await supabase
    .from("payroll")
    .select("employee_id")
    .eq("reference_month", dbMonth);
  const existingIds = new Set((existing ?? []).map((r) => r.employee_id));

  const { data: actives } = await supabase
    .from("employees")
    .select("id, salario_sem_dsr, aplica_dobra")
    .eq("ativo", true);

  const newRows = (actives ?? [])
    .filter((e) => !existingIds.has(e.id))
    .map((e) => {
      const empSemDsr = Number(e.salario_sem_dsr ?? 0);
      const empDobra = e.aplica_dobra ?? false;
      const base = empSemDsr > 0 ? calcProventosBase(empSemDsr, empDobra) : 0;
      return {
        employee_id: e.id,
        reference_month: dbMonth,
        base_salary: base,
        salario_sem_dsr: empSemDsr > 0 ? empSemDsr : null,
        aplica_dobra: empDobra,
        total_earnings: base,
        total_deductions: 0,
        net_amount: base
      };
    });

  if (newRows.length > 0) {
    const { error } = await supabase.from("payroll").insert(newRows);
    if (error) redirect(`/rh/folha/${urlMonth}?erro=${encodeURIComponent(error.message)}`);
  }

  revalidatePath(`/rh/folha/${urlMonth}`);
  redirect(`/rh/folha/${urlMonth}?ok=sincronizado`);
}
