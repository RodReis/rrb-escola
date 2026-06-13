// Importa bases históricas de FGTS a partir de um xlsx para folha_runs sintéticas.
// Colunas esperadas: cpf, competencia (YYYY-MM), base_fgts (número).
//
// Uso:
//   node scripts/importar_bases_historicas.mjs [--xlsx caminho.xlsx]   # dry-run
//   node scripts/importar_bases_historicas.mjs [--xlsx caminho.xlsx] --apply

import { createClient } from "@supabase/supabase-js";
import ExcelJS from "exceljs";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const GERADA_POR = "import-historico";
const DEFAULT_XLSX = "public/bases_historicas.xlsx";

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

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Faltando NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const apply = process.argv.includes("--apply");
const xlsxArg = process.argv.indexOf("--xlsx");
const xlsxPath = xlsxArg !== -1 ? process.argv[xlsxArg + 1] : DEFAULT_XLSX;
const mode = apply ? "APPLY" : "DRY-RUN";

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

function normalizeCpf(v) {
  return String(v ?? "").replace(/\D/g, "");
}

function parseRows(wb) {
  const sheet = wb.worksheets[0];
  if (!sheet) throw new Error("Planilha vazia");

  const headers = [];
  sheet.getRow(1).eachCell((cell) => headers.push(String(cell.value ?? "").toLowerCase().trim()));

  const idxCpf = headers.indexOf("cpf");
  const idxComp = headers.indexOf("competencia");
  const idxBase = headers.indexOf("base_fgts");
  if (idxCpf === -1 || idxComp === -1 || idxBase === -1)
    throw new Error(`Colunas obrigatórias: cpf, competencia, base_fgts. Encontradas: ${headers.join(", ")}`);

  const rows = [];
  const erros = [];
  sheet.eachRow((row, rowNum) => {
    if (rowNum === 1) return;
    const cpf = normalizeCpf(row.getCell(idxCpf + 1).value);
    const competencia = String(row.getCell(idxComp + 1).value ?? "").trim();
    const base_fgts = Number(row.getCell(idxBase + 1).value);

    if (cpf.length !== 11) { erros.push(`Linha ${rowNum}: CPF inválido "${cpf}"`); return; }
    if (!/^\d{4}-\d{2}$/.test(competencia)) { erros.push(`Linha ${rowNum}: competencia deve ser YYYY-MM, recebido "${competencia}"`); return; }
    if (!Number.isFinite(base_fgts) || base_fgts < 0) { erros.push(`Linha ${rowNum}: base_fgts inválido "${base_fgts}"`); return; }

    rows.push({ cpf, competencia, base_fgts });
  });

  return { rows, erros };
}

async function resolveContratos(cpfs) {
  const { data, error } = await supabase
    .from("folha_contratos")
    .select("id, cpf, company_id, escola_id")
    .in("cpf", cpfs)
    .eq("ativo", true);
  if (error) throw error;
  const map = new Map();
  for (const c of data ?? []) map.set(c.cpf, c);
  return map;
}

async function importarRun(contrato, competencia, base_fgts, dryRun) {
  const runPayload = {
    company_id: contrato.company_id,
    escola_id: contrato.escola_id,
    competencia,
    tipo: "mensal",
    status: "fechada",
    gerada_por: GERADA_POR,
  };

  if (dryRun) return { ok: true, dry: true };

  const { data: run, error: runErr } = await supabase
    .from("folha_runs")
    .insert(runPayload)
    .select("id")
    .single();
  if (runErr) return { ok: false, error: runErr.message };

  const itemPayload = {
    run_id: run.id,
    contrato_id: contrato.id,
    base_fgts,
    total_proventos: base_fgts,
    total_descontos: 0,
    liquido: base_fgts,
    status: "calculado",
  };
  const { error: itemErr } = await supabase.from("folha_itens").insert(itemPayload);
  if (itemErr) return { ok: false, error: itemErr.message };

  return { ok: true, run_id: run.id };
}

async function main() {
  console.log(`Modo: ${mode}`);
  console.log(`Planilha: ${xlsxPath}`);

  if (!existsSync(xlsxPath)) {
    console.error(`Arquivo não encontrado: ${xlsxPath}`);
    process.exit(1);
  }

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(xlsxPath);

  const { rows, erros } = parseRows(wb);
  if (erros.length) {
    console.error(`\nErros de validação (${erros.length}):`);
    for (const e of erros) console.error(" ", e);
    process.exit(1);
  }
  console.log(`Linhas válidas: ${rows.length}`);

  const cpfs = [...new Set(rows.map((r) => r.cpf))];
  const contratoMap = await resolveContratos(cpfs);
  console.log(`Contratos ativos encontrados: ${contratoMap.size} de ${cpfs.length} CPFs`);

  const semContrato = cpfs.filter((c) => !contratoMap.has(c));
  if (semContrato.length) {
    console.warn(`CPFs sem contrato ativo: ${semContrato.join(", ")}`);
  }

  let ok = 0;
  let erroCount = 0;
  for (const row of rows) {
    const contrato = contratoMap.get(row.cpf);
    if (!contrato) { erroCount++; continue; }

    const result = await importarRun(contrato, row.competencia, row.base_fgts, !apply);
    if (result.ok) {
      ok++;
      if (!result.dry) console.log(`  OK cpf=${row.cpf} comp=${row.competencia} base=${row.base_fgts} run=${result.run_id}`);
    } else {
      erroCount++;
      console.error(`  ERRO cpf=${row.cpf} comp=${row.competencia}: ${result.error}`);
    }
  }

  console.log(`\nResultado: ok=${ok} erros=${erroCount} (modo=${mode})`);
  if (!apply) console.log("Use --apply para persistir.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
