import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvFile(file) {
  const path = resolve(process.cwd(), file);
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
  }
}

loadEnvFile(".env.local");
loadEnvFile(".env");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
});

const DEFAULT_SCHOOL_ID = "00000000-0000-0000-0000-000000000001";
const TODAY = new Date().toISOString().slice(0, 10);

const args = process.argv.slice(2);
const isDryRun = !args.includes("--apply");
const allowZeroSalary = args.includes("--allow-zero-salary");
const companyArg = args.find((a) => a.startsWith("--company="));
const filterCompanyId = companyArg ? companyArg.split("=")[1] : null;

function resolvePerfilCodigo(employee) {
  return employee.school_category ? "clt_professor" : "clt";
}

function resolveSalarioBase(employee) {
  if (employee.base_salary && Number(employee.base_salary) > 0) {
    return Number(employee.base_salary);
  }
  if (employee.salario_sem_dsr && Number(employee.salario_sem_dsr) > 0) {
    return Number(employee.salario_sem_dsr);
  }
  return null;
}

function resolveAdmissao(employee) {
  return employee.hire_date ?? TODAY;
}

async function main() {
  const { data: perfis, error: perfisError } = await supabase
    .from("folha_perfis_calculo")
    .select("id, codigo, escola_id")
    .eq("escola_id", DEFAULT_SCHOOL_ID)
    .eq("ativo", true);

  if (perfisError) {
    console.error("Erro ao carregar perfis de cálculo:", perfisError.message);
    process.exit(1);
  }

  const perfilMap = Object.fromEntries(perfis.map((p) => [p.codigo, p.id]));

  let employeeQuery = supabase
    .from("employees")
    .select(
      "id, company_id, name, cargo, hire_date, school_category, base_salary, salario_sem_dsr, ativo, status_contrato"
    )
    .eq("ativo", true);

  if (filterCompanyId) {
    employeeQuery = employeeQuery.eq("company_id", filterCompanyId);
  }

  const { data: employees, error: empError } = await employeeQuery;

  if (empError) {
    console.error("Erro ao carregar employees:", empError.message);
    process.exit(1);
  }

  const employeeIds = employees.map((e) => e.id);

  const { data: existingContratos, error: contratosError } = await supabase
    .from("folha_contratos")
    .select("employee_id")
    .eq("ativo", true)
    .in("employee_id", employeeIds.length > 0 ? employeeIds : ["00000000-0000-0000-0000-000000000000"]);

  if (contratosError) {
    console.error("Erro ao verificar contratos existentes:", contratosError.message);
    process.exit(1);
  }

  const existingSet = new Set(existingContratos.map((c) => c.employee_id));

  const toCreate = [];
  const skippedExisting = [];
  const skippedNoSalary = [];
  const skippedNoProfile = [];

  for (const emp of employees) {
    if (existingSet.has(emp.id)) {
      skippedExisting.push(emp);
      continue;
    }

    const perfilCodigo = resolvePerfilCodigo(emp);
    const perfilId = perfilMap[perfilCodigo];

    if (!perfilId) {
      skippedNoProfile.push({ ...emp, perfilCodigo });
      continue;
    }

    const salarioBase = resolveSalarioBase(emp);

    if (salarioBase === null && !allowZeroSalary) {
      skippedNoSalary.push(emp);
      continue;
    }

    toCreate.push({
      employee: emp,
      perfilCodigo,
      perfilId,
      salarioBase: salarioBase ?? null,
      admissao: resolveAdmissao(emp),
    });
  }

  if (isDryRun) {
    console.log("\n=== DRY-RUN — nenhuma escrita será feita ===\n");

    if (toCreate.length > 0) {
      const rows = toCreate.map((item) => ({
        Nome: item.employee.name,
        Perfil: item.perfilCodigo,
        "Salário base": item.salarioBase !== null ? `R$ ${item.salarioBase.toFixed(2)}` : "(vazio — preencher no UI)",
        Admissão: item.admissao,
        Cargo: item.employee.cargo ?? "(sem cargo)",
      }));
      console.log("Contratos a criar:");
      console.table(rows);
    } else {
      console.log("Nenhum contrato a criar.");
    }

    console.log("\nResumo:");
    console.log(`  A criar:              ${toCreate.length}`);
    console.log(`  Já têm contrato ativo: ${skippedExisting.length}`);
    console.log(`  Sem salário resolvível: ${skippedNoSalary.length}`);
    console.log(`  Perfil não encontrado:  ${skippedNoProfile.length}`);

    if (skippedNoSalary.length > 0) {
      console.log(
        "\nSem salário (não serão criados):",
        skippedNoSalary.map((e) => e.name).join(", ")
      );
    }

    const professores = toCreate.filter((i) => i.perfilCodigo === "clt_professor");
    if (professores.length > 0) {
      console.log(
        `\nATENÇÃO: ${professores.length} contrato(s) de professor serão criados com salario_base,` +
          " mas sem valor_hora_aula/aulas_semanais. Após a migração, acesse cada contrato e" +
          " informe hora-aula e aulas semanais para que a rubrica hora_aula calcule corretamente."
      );
    }

    console.log(
      "\nNOTA: períodos aquisitivos (folha_periodos_aquisitivos) NÃO são criados por este script." +
        " Eles são necessários para férias/13º mas não para a folha mensal."
    );

    console.log("\nPasse --apply para executar as inserções.\n");
    return;
  }

  console.log(`\n=== APPLY — inserindo ${toCreate.length} contrato(s) ===\n`);

  let inserted = 0;
  const errors = [];

  for (const item of toCreate) {
    const row = {
      escola_id: DEFAULT_SCHOOL_ID,
      employee_id: item.employee.id,
      company_id: item.employee.company_id,
      perfil_calculo_id: item.perfilId,
      salario_base: item.salarioBase,
      valor_hora_aula: null,
      aulas_semanais: null,
      dependentes_irrf: 0,
      data_admissao: item.admissao,
      data_desligamento: null,
      ativo: true,
      cargo: item.employee.cargo ?? null,
      cbo: null,
      aulas_por_turno: null,
    };

    const { error } = await supabase.from("folha_contratos").insert(row);

    if (error) {
      errors.push({ employee: item.employee.name, error: error.message });
      console.error(`  ERRO ${item.employee.name}: ${error.message}`);
    } else {
      inserted++;
      const salStr = item.salarioBase !== null ? `R$ ${item.salarioBase.toFixed(2)}` : "(salário vazio)";
      console.log(`  OK  ${item.employee.name} — ${item.perfilCodigo} — ${salStr}`);
    }
  }

  console.log("\nResumo:");
  console.log(`  Inseridos:             ${inserted}`);
  console.log(`  Erros:                 ${errors.length}`);
  console.log(`  Já tinham contrato:    ${skippedExisting.length}`);
  console.log(`  Sem salário:           ${skippedNoSalary.length}`);

  const professores = toCreate.filter((i) => i.perfilCodigo === "clt_professor");
  if (professores.length > 0) {
    console.log(
      `\nATENÇÃO: ${professores.length} contrato(s) de professor criados com salario_base.` +
        " Informe valor_hora_aula e aulas_semanais em cada contrato para cálculo correto."
    );
  }

  console.log(
    "\nNOTA: períodos aquisitivos (folha_periodos_aquisitivos) NÃO foram criados." +
      " Necessários para férias/13º; não necessários para folha mensal."
  );

  if (errors.length > 0) {
    console.error("\nErros detalhados:");
    for (const e of errors) console.error(`  ${e.employee}: ${e.error}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
