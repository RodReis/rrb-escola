import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvFile(file) {
  const path = resolve(process.cwd(), file);
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
loadEnvFile(".env.local");
loadEnvFile(".env");

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
);

const { data, error } = await supabase
  .from("payroll")
  .select("*, employees(name, cpf, companies(name))")
  .order("reference_month");

if (error) { console.error(error); process.exit(1); }

data.sort((a, b) => {
  const na = a.employees?.name ?? "";
  const nb = b.employees?.name ?? "";
  return na.localeCompare(nb, "pt-BR");
});

const cols = [
  "id","employee_id","reference_month","base_salary","additional","consider_decimo_terceiro",
  "considera_um_tercio_ferias","total_earnings","inss","ir","loan_deduction","advance",
  "total_deductions","family_allowance","net_amount","observations","uniform_value",
  "salario_sem_dsr","aplica_dobra","horas_extras","gratificacao","comissao","adicional_noturno",
  "periculosidade","insalubridade","outros_proventos","vale_transporte","vale_alimentacao",
  "outros_descontos","dependentes","inss_manual","ir_manual"
];

function fmt(v) {
  if (v == null) return "NULL";
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "number") return String(v);
  const s = String(v).replace(/'/g, "''");
  return `'${s}'`;
}

const out = [];
out.push("-- Seed payroll");
out.push(`-- Generated ${new Date().toISOString()}`);
out.push(`-- Rows: ${data.length}`);
out.push("");
out.push(`INSERT INTO public.payroll (${cols.join(", ")}) VALUES`);
const values = data.map((r) => {
  const vals = cols.map((c) => fmt(r[c]));
  const nome = r.employees?.name ?? "??";
  const cpf = r.employees?.cpf ?? "";
  const empresa = r.employees?.companies?.name ?? "";
  return `  -- ${nome} (${cpf}) [${empresa}] mês=${r.reference_month}\n  (${vals.join(", ")})`;
});
out.push(values.join(",\n") + ";");
out.push("");

const path = "scripts/payroll_seed.sql";
writeFileSync(path, out.join("\n"), "utf8");
console.log(`Exported ${data.length} rows to ${path}`);
process.exit(0);
