import { createClient } from "@supabase/supabase-js";
import ExcelJS from "exceljs";
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { resolve, basename } from "node:path";

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
  console.error("NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY obrigatórios em .env.local");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
});

const FILES = [
  "public/04º F. pg 2026 (Escola Pinguinho ).xlsx",
  "public/04ºF. pg 2026 (Colegio Integrado).xlsx"
];

function round2(n) {
  return Math.round(n * 100) / 100;
}

function cellNumber(v) {
  if (v == null) return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v === "string") {
    const n = Number(v.replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  }
  if (typeof v === "object" && v !== null && "result" in v) {
    return cellNumber(v.result);
  }
  return 0;
}

function cellText(v) {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  if (typeof v === "object" && v !== null && "result" in v) return cellText(v.result);
  if (typeof v === "object" && v !== null && "richText" in v) {
    return v.richText.map((r) => r.text).join("");
  }
  return String(v);
}

function normalizeName(s) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeHeader(s) {
  return s
    .toUpperCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .replace(/[.:]/g, "")
    .trim();
}

const HEADER_MAP = {
  FUNCIONARIOS: "nome",
  ADICIONAL: "additional",
  INSS: "inss",
  IR: "ir",
  SIND: "loan_deduction",
  EMPRESTIMO: "loan_deduction",
  EMPREST: "loan_deduction",
  ADIANT: "advance",
  DEDUCOES: "total_deductions",
  FAMILIA: "family_allowance"
};

async function parseFile(filePath) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);
  const out = [];
  const skippedSheets = [];

  for (const ws of wb.worksheets) {
    if (/desconto/i.test(ws.name)) {
      skippedSheets.push({ sheet: ws.name, reason: "desconto" });
      continue;
    }

    const colMap = {};
    let headerRow = -1;
    const scanLimit = Math.min(20, ws.rowCount);

    for (let r = 1; r <= scanLimit; r++) {
      const row = ws.getRow(r);
      const localMap = {};
      row.eachCell({ includeEmpty: true }, (cell, n) => {
        const key = normalizeHeader(cellText(cell.value));
        if (HEADER_MAP[key] && localMap[HEADER_MAP[key]] === undefined) {
          localMap[HEADER_MAP[key]] = n;
        }
      });
      if (localMap.nome !== undefined && (localMap.additional !== undefined || localMap.inss !== undefined)) {
        Object.assign(colMap, localMap);
        headerRow = r;
        break;
      }
    }

    if (headerRow < 0) {
      skippedSheets.push({ sheet: ws.name, reason: "no header" });
      continue;
    }

    for (let r = headerRow + 1; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      const nome = cellText(row.getCell(colMap.nome).value).trim();
      if (!nome) continue;
      if (/^\d+$/.test(nome)) continue;

      const rec = {
        file: basename(filePath),
        sheet: ws.name,
        nome,
        additional: round2(colMap.additional !== undefined ? cellNumber(row.getCell(colMap.additional).value) : 0),
        inss: round2(colMap.inss !== undefined ? cellNumber(row.getCell(colMap.inss).value) : 0),
        ir: round2(colMap.ir !== undefined ? cellNumber(row.getCell(colMap.ir).value) : 0),
        loan_deduction: round2(colMap.loan_deduction !== undefined ? cellNumber(row.getCell(colMap.loan_deduction).value) : 0),
        advance: round2(colMap.advance !== undefined ? cellNumber(row.getCell(colMap.advance).value) : 0),
        total_deductions: round2(colMap.total_deductions !== undefined ? cellNumber(row.getCell(colMap.total_deductions).value) : 0),
        family_allowance: round2(colMap.family_allowance !== undefined ? cellNumber(row.getCell(colMap.family_allowance).value) : 0)
      };
      out.push(rec);
    }
  }

  return { rows: out, skippedSheets };
}

async function loadEmployees() {
  const { data, error } = await supabase.from("employees").select("id, name");
  if (error) {
    console.error("Falha ao carregar employees:", error.message);
    process.exit(1);
  }
  const map = new Map();
  for (const e of data) {
    if (!e.name) continue;
    const key = normalizeName(e.name);
    const arr = map.get(key) ?? [];
    arr.push({ id: e.id, name: e.name });
    map.set(key, arr);
  }
  return map;
}

async function processRow(rec, employeeMap, log, stats) {
  stats.rowsParsed++;
  const key = normalizeName(rec.nome);
  const candidates = employeeMap.get(key) ?? [];

  if (candidates.length === 0) {
    stats.notFound++;
    log.push(`  NOT_FOUND: "${rec.nome}" (file=${rec.file}, sheet=${rec.sheet})`);
    return;
  }
  if (candidates.length > 1) {
    stats.ambiguous++;
    log.push(`  AMBIGUOUS: "${rec.nome}" → ids=[${candidates.map((c) => c.id).join(", ")}]`);
    return;
  }

  const target = candidates[0];
  const { data, error } = await supabase
    .from("payroll")
    .update({
      additional: rec.additional,
      inss: rec.inss,
      ir: rec.ir,
      loan_deduction: rec.loan_deduction,
      advance: rec.advance,
      total_deductions: rec.total_deductions,
      family_allowance: rec.family_allowance
    })
    .eq("employee_id", target.id)
    .select("id");

  if (error) {
    stats.errors++;
    log.push(`  ERROR: "${rec.nome}" (employee_id=${target.id}): ${error.message}`);
    return;
  }

  const n = data?.length ?? 0;
  if (n === 0) {
    stats.warnings++;
    log.push(`  WARNING: "${target.name}" matched but 0 payroll rows`);
    return;
  }

  stats.matched++;
  stats.payrollRowsUpdated += n;
  log.push(`  MATCHED: "${target.name}" <- "${rec.nome}" → updated ${n} rows`);
}

const startedAt = new Date().toISOString();
const log = [`[${startedAt}] START`];
const stats = {
  filesProcessed: 0,
  rowsParsed: 0,
  matched: 0,
  notFound: 0,
  ambiguous: 0,
  warnings: 0,
  errors: 0,
  payrollRowsUpdated: 0
};

const employeeMap = await loadEmployees();
log.push(`Employees carregados: ${employeeMap.size} chaves únicas.`);

for (const filePath of FILES) {
  if (!existsSync(resolve(process.cwd(), filePath))) {
    console.error(`Arquivo ausente: ${filePath}`);
    process.exit(1);
  }
  log.push(`FILE: ${basename(filePath)}`);
  const { rows, skippedSheets } = await parseFile(filePath);
  for (const s of skippedSheets) {
    log.push(`  SHEET_SKIPPED: "${s.sheet}" (${s.reason})`);
  }
  let currentSheet = "";
  for (const rec of rows) {
    if (rec.sheet !== currentSheet) {
      log.push(`  SHEET: "${rec.sheet}"`);
      currentSheet = rec.sheet;
    }
    await processRow(rec, employeeMap, log, stats);
  }
  stats.filesProcessed++;
}

const doneAt = new Date().toISOString();
log.push("SUMMARY:");
log.push(`  filesProcessed=${stats.filesProcessed}`);
log.push(`  rowsParsed=${stats.rowsParsed}`);
log.push(`  matched=${stats.matched}`);
log.push(`  notFound=${stats.notFound}`);
log.push(`  ambiguous=${stats.ambiguous}`);
log.push(`  warnings=${stats.warnings}`);
log.push(`  errors=${stats.errors}`);
log.push(`  payrollRowsUpdated=${stats.payrollRowsUpdated}`);
log.push(`[${doneAt}] DONE`);

writeFileSync("scripts/payroll_seed_log.txt", log.join("\n") + "\n", "utf8");
console.log(log.slice(-11).join("\n"));
console.log("Log gravado em scripts/payroll_seed_log.txt");
