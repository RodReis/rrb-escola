# Payroll Seed from XLSX — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone Node script that reads payroll XLSX files in `public/`, matches names against `employees`, and UPDATEs all `payroll` rows per matched employee with deduction/earning values, producing a log file.

**Architecture:** Single ESM script `scripts/seed_payroll_from_xlsx.mjs`. Loads env from `.env.local`, parses two hardcoded xlsx files with `exceljs` using a tolerant header scanner (variations across sheets), normalizes names, fetches `employees` from Supabase, runs UPDATEs in a loop, writes a plaintext log. No schema changes, no UI, no new dependencies.

**Tech Stack:** Node.js (ESM), `exceljs`, `@supabase/supabase-js`. Spec: `docs/2026-05-16-payroll-seed-from-xlsx-design.md`.

---

## File Structure

- **Create** `scripts/seed_payroll_from_xlsx.mjs` — entire script (parser + env loader + matcher + updater + logger)
- **Generate at runtime** `scripts/payroll_seed_log.txt` — log output (gitignored or committed at user's discretion)

Single-file design chosen: script is one-shot, < 300 lines total, no shared logic with the app. Splitting would add ceremony for no isolation benefit.

---

### Task 1: Scaffold script with env loader and Supabase client

**Files:**
- Create: `scripts/seed_payroll_from_xlsx.mjs`

- [ ] **Step 1: Create file with env loader and Supabase client init**

```js
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

console.log("Seed payroll: iniciando.");
```

- [ ] **Step 2: Verify script runs and connects**

Run: `node scripts/seed_payroll_from_xlsx.mjs`
Expected: prints `Seed payroll: iniciando.` and exits cleanly (no errors).

- [ ] **Step 3: Commit**

```bash
git add scripts/seed_payroll_from_xlsx.mjs
git commit -m "chore(payroll): scaffold seed_payroll_from_xlsx script"
```

---

### Task 2: Add cell coercion helpers and name normalizer

**Files:**
- Modify: `scripts/seed_payroll_from_xlsx.mjs`

- [ ] **Step 1: Append helpers above the `console.log` line**

```js
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
```

- [ ] **Step 2: Add quick sanity check at bottom (temporary)**

Append before final `console.log`:

```js
console.log(normalizeName("José Da Silva  "));  // "jose da silva"
console.log(normalizeHeader("Adiant."));         // "ADIANT"
```

- [ ] **Step 3: Run and verify output**

Run: `node scripts/seed_payroll_from_xlsx.mjs`
Expected: prints `jose da silva` then `ADIANT` then `Seed payroll: iniciando.`

- [ ] **Step 4: Remove the two temporary console.logs**

- [ ] **Step 5: Commit**

```bash
git add scripts/seed_payroll_from_xlsx.mjs
git commit -m "chore(payroll): cell coercion + name/header normalizers"
```

---

### Task 3: Parse a single xlsx file into rows

**Files:**
- Modify: `scripts/seed_payroll_from_xlsx.mjs`

- [ ] **Step 1: Add `parseFile` function before the `console.log("Seed payroll: iniciando.");` line**

```js
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
        additional: round2(colMap.additional ? cellNumber(row.getCell(colMap.additional).value) : 0),
        inss: round2(colMap.inss ? cellNumber(row.getCell(colMap.inss).value) : 0),
        ir: round2(colMap.ir ? cellNumber(row.getCell(colMap.ir).value) : 0),
        loan_deduction: round2(colMap.loan_deduction ? cellNumber(row.getCell(colMap.loan_deduction).value) : 0),
        advance: round2(colMap.advance ? cellNumber(row.getCell(colMap.advance).value) : 0),
        total_deductions: round2(colMap.total_deductions ? cellNumber(row.getCell(colMap.total_deductions).value) : 0),
        family_allowance: round2(colMap.family_allowance ? cellNumber(row.getCell(colMap.family_allowance).value) : 0)
      };
      out.push(rec);
    }
  }

  return { rows: out, skippedSheets };
}
```

- [ ] **Step 2: Add temporary smoke test below `console.log("Seed payroll: iniciando.");`**

```js
for (const f of FILES) {
  const { rows, skippedSheets } = await parseFile(f);
  console.log(`FILE: ${basename(f)} → ${rows.length} rows; skipped sheets: ${JSON.stringify(skippedSheets)}`);
  console.log("Sample:", rows.slice(0, 2));
}
process.exit(0);
```

- [ ] **Step 3: Run and verify parsing**

Run: `node scripts/seed_payroll_from_xlsx.mjs`
Expected:
- For each file, prints row count > 0.
- `skippedSheets` includes any sheet matching `/desconto/i`.
- Sample shows objects with `nome`, `additional`, `inss`, `ir`, `loan_deduction`, `advance`, `total_deductions`, `family_allowance` as numbers.

- [ ] **Step 4: Remove the smoke test block (the `for...of FILES` and `process.exit(0)` added in Step 2)**

- [ ] **Step 5: Commit**

```bash
git add scripts/seed_payroll_from_xlsx.mjs
git commit -m "feat(payroll): parse xlsx rows with tolerant header detection"
```

---

### Task 4: Load employees and build name map

**Files:**
- Modify: `scripts/seed_payroll_from_xlsx.mjs`

- [ ] **Step 1: Add `loadEmployees` function above `console.log("Seed payroll: iniciando.");`**

```js
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
```

- [ ] **Step 2: Add temporary smoke test below `console.log("Seed payroll: iniciando.");`**

```js
const employeeMap = await loadEmployees();
console.log(`Loaded ${employeeMap.size} unique employee names.`);
const ambiguous = [...employeeMap.entries()].filter(([, arr]) => arr.length > 1);
console.log(`Ambiguous keys: ${ambiguous.length}`);
process.exit(0);
```

- [ ] **Step 3: Run and verify**

Run: `node scripts/seed_payroll_from_xlsx.mjs`
Expected: prints `Loaded N unique employee names.` where N > 0. Prints ambiguous count (likely 0 or low).

- [ ] **Step 4: Remove the smoke test block**

- [ ] **Step 5: Commit**

```bash
git add scripts/seed_payroll_from_xlsx.mjs
git commit -m "feat(payroll): load employees and build normalized name map"
```

---

### Task 5: Match rows to employees and run UPDATEs with log accumulator

**Files:**
- Modify: `scripts/seed_payroll_from_xlsx.mjs`

- [ ] **Step 1: Add `processRow` function above `console.log("Seed payroll: iniciando.");`**

```js
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
```

- [ ] **Step 2: No standalone test for this step — verified in Task 6.**

- [ ] **Step 3: Commit**

```bash
git add scripts/seed_payroll_from_xlsx.mjs
git commit -m "feat(payroll): match rows to employees and update payroll"
```

---

### Task 6: Wire the main flow and write log file

**Files:**
- Modify: `scripts/seed_payroll_from_xlsx.mjs`

- [ ] **Step 1: Replace the line `console.log("Seed payroll: iniciando.");` with the full main flow**

```js
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
```

- [ ] **Step 2: Run the script end-to-end**

Run: `node scripts/seed_payroll_from_xlsx.mjs`
Expected:
- Console prints the SUMMARY block with non-zero `matched` and `payrollRowsUpdated`.
- `scripts/payroll_seed_log.txt` exists and ends with `DONE`.

- [ ] **Step 3: Inspect log for sanity**

Run: `Get-Content scripts/payroll_seed_log.txt -Tail 20` (PowerShell)
Expected: SUMMARY shows `errors=0`. `notFound` count is reasonable (low). `payrollRowsUpdated` ≥ `matched` (each matched employee may have multiple month rows).

- [ ] **Step 4: Spot-check the database**

Pick one name printed as MATCHED. Compare values in `payroll` (for any month) against the XLSX row:

```sql
SELECT p.reference_month, p.additional, p.inss, p.ir, p.loan_deduction, p.advance, p.total_deductions, p.family_allowance
FROM payroll p
JOIN employees e ON e.id = p.employee_id
WHERE e.name ILIKE '%<chosen name>%';
```

Expected: values match the XLSX row for that employee across all their months.

- [ ] **Step 5: Verify untouched columns**

Run the same SQL with `base_salary, total_earnings, net_amount` instead. Expected: those fields were not modified by this run (compare against a known-good earlier state if needed; `updated_at` will change but the values must not).

- [ ] **Step 6: Commit**

```bash
git add scripts/seed_payroll_from_xlsx.mjs scripts/payroll_seed_log.txt
git commit -m "feat(payroll): seed payroll deductions/earnings from xlsx files"
```

---

### Task 7: Final cleanup and documentation note

**Files:**
- Modify: `scripts/seed_payroll_from_xlsx.mjs` (header comment only)

- [ ] **Step 1: Add a header comment at the very top of the file**

```js
// Seed payroll from xlsx — one-shot script.
// Reads public/*.xlsx, matches by employee name, UPDATEs all payroll rows.
// Spec: docs/2026-05-16-payroll-seed-from-xlsx-design.md
// Usage: node scripts/seed_payroll_from_xlsx.mjs
```

- [ ] **Step 2: Commit**

```bash
git add scripts/seed_payroll_from_xlsx.mjs
git commit -m "docs(payroll): header comment with spec link and usage"
```

---

## Self-Review

**Spec coverage:**
- Parse 2 xlsx files → Tasks 1, 3, 6 ✓
- Skip `/desconto/i` sheets → Task 3 ✓
- Tolerant header detection (variations across sheets) → Task 3 (`HEADER_MAP` + `normalizeHeader`) ✓
- Map columns: additional, inss, ir, loan_deduction (SIND/empréstimo/emprest), advance, total_deductions, family_allowance → Task 3 ✓
- Match by normalized name → Tasks 2, 4, 5 ✓
- Update all payroll rows per employee → Task 5 ✓
- Not touch base_salary / total_earnings / net_amount → Task 5 (SET clause excludes them); verification Task 6 Step 5 ✓
- Log file with matched/not-found/ambiguous/warnings/errors/summary → Tasks 5, 6 ✓
- Abort if env missing / file missing / employees load fails → Tasks 1, 4, 6 ✓
- No schema change, no new deps → confirmed (uses `exceljs`, `@supabase/supabase-js` already present) ✓

**Placeholder scan:** No TBDs, no "implement later", every code step has full code. ✓

**Type consistency:**
- `parseFile` returns `{ rows, skippedSheets }` — consumed in Task 6 with both keys ✓
- `loadEmployees` returns `Map<string, {id,name}[]>` — consumed in `processRow` as `.get(key)` returning array ✓
- `processRow` mutates `log` and `stats` — both initialized in Task 6 ✓
- `HEADER_MAP` values match `payroll` column names exactly: `additional`, `inss`, `ir`, `loan_deduction`, `advance`, `total_deductions`, `family_allowance` ✓
- `FILES` paths match those given in the user request ✓

Plan complete and saved to `docs/superpowers/plans/2026-05-16-payroll-seed-from-xlsx.md`.
