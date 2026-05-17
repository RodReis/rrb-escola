// Exporta folha de pagamento de um mes especifico como SQL template.
// Saida: supabase/payroll_template.sql — usar para popular folhas de outros meses.
// Uso: node scripts/export_payroll_template.mjs [YYYY-MM]
// Default: 2026-05

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

const mes = (process.argv[2] || "2026-05").slice(0, 7);
const refMonth = `${mes}-01`;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
);

const { data, error } = await supabase
  .from("payroll")
  .select("*, employees(name, cpf, companies(name))")
  .eq("reference_month", refMonth);

if (error) { console.error(error); process.exit(1); }
if (!data.length) { console.error(`Nenhuma folha encontrada para ${refMonth}`); process.exit(1); }

data.sort((a, b) => {
  const na = a.employees?.name ?? "";
  const nb = b.employees?.name ?? "";
  return na.localeCompare(nb, "pt-BR");
});

const cols = [
  "employee_id","reference_month","base_salary","additional","consider_decimo_terceiro",
  "considera_um_tercio_ferias","total_earnings","inss","ir","loan_deduction","advance",
  "total_deductions","family_allowance","net_amount","observations","uniform_value",
  "salario_sem_dsr","aplica_dobra","horas_extras","gratificacao","comissao","adicional_noturno",
  "periculosidade","insalubridade","outros_proventos","vale_transporte","vale_alimentacao",
  "outros_descontos","dependentes","inss_manual","ir_manual","gps"
];

function fmt(v) {
  if (v == null) return "NULL";
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "number") return String(v);
  const s = String(v).replace(/'/g, "''");
  return `'${s}'`;
}

const out = [];
out.push(`-- Payroll template (mes base: ${refMonth})`);
out.push(`-- Generated ${new Date().toISOString()}`);
out.push(`-- Rows: ${data.length}`);
out.push(`-- Uso: inserir todas linhas substituindo reference_month pelo mes alvo.`);
out.push(`-- Idempotente via on conflict (employee_id, reference_month).`);
out.push("");
out.push(`INSERT INTO public.payroll (${cols.join(", ")}) VALUES`);
const values = data.map((r) => {
  const vals = cols.map((c) => fmt(r[c]));
  const nome = r.employees?.name ?? "??";
  const cpf = r.employees?.cpf ?? "";
  return `  -- ${nome} (${cpf})\n  (${vals.join(", ")})`;
});
out.push(values.join(",\n"));
out.push(`ON CONFLICT (employee_id, reference_month) DO NOTHING;`);
out.push("");

const path = "supabase/payroll_template.sql";
writeFileSync(path, out.join("\n"), "utf8");
console.log(`Exported ${data.length} rows from ${refMonth} -> ${path}`);
process.exit(0);
