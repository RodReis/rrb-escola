# Reconciliar Matrículas 2026 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reconstruir série, turma e turno de todas as matrículas 2026 a partir de `public/MATRICULADOS2026.xlsx`, preservando IDs de matrícula e pagamentos vinculados.

**Architecture:** Script Node ESM one-shot (`scripts/reconcile_matriculas_2026.mjs`) com dois modos: `--dry-run` (default, só relatório) e `--apply` (escreve no banco). Decompõe em módulos puros + camadas IO testáveis isoladas. Sem servidor, sem UI.

**Tech Stack:** Node 20+, ESM, `exceljs` (já no `package.json`), `@supabase/supabase-js` com service role key, `.env.local` lido manualmente.

Spec: `docs/superpowers/specs/2026-05-17-reconciliar-matriculas-2026-design.md`

---

## File Structure

- Create: `scripts/lib/normalize-name.mjs` — normalização de nome (puro).
- Create: `scripts/lib/parse-matriculados-xlsx.mjs` — parser da planilha (puro, recebe workbook).
- Create: `scripts/lib/turma-mapper.mjs` — mapeia cabeçalho da planilha em `{serie_nome, turma_nome, turno}` (puro).
- Create: `scripts/reconcile_matriculas_2026.mjs` — orquestrador (IO Supabase + CLI).
- Create: `scripts/tests/normalize-name.test.mjs` — testes Node builtin `node:test`.
- Create: `scripts/tests/turma-mapper.test.mjs`.
- Create: `scripts/tests/parse-matriculados-xlsx.test.mjs`.
- Create: `scripts/tests/fixtures/mini-matriculados.xlsx` — fixture gerada por script (1 turma por sheet, 2 alunos).
- Create: `scripts/tests/build-fixture.mjs` — gera a fixture xlsx via `exceljs`.
- Modify: `package.json` — adiciona `"test:scripts": "node --test scripts/tests/*.test.mjs"` e `"reconcile:matriculas:2026": "node scripts/reconcile_matriculas_2026.mjs"`.

Convenção: cada módulo em `scripts/lib/` exporta funções puras (sem IO). O orquestrador chama lib + Supabase. Testes só cobrem as libs puras.

---

### Task 1: Normalização de nome

**Files:**
- Create: `scripts/lib/normalize-name.mjs`
- Test: `scripts/tests/normalize-name.test.mjs`

- [ ] **Step 1: Write failing test**

`scripts/tests/normalize-name.test.mjs`:

```javascript
import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeName } from "../lib/normalize-name.mjs";

test("uppercases and trims", () => {
  assert.equal(normalizeName("  alice cabriny  "), "ALICE CABRINY");
});

test("strips accents", () => {
  assert.equal(normalizeName("João Pedro"), "JOAO PEDRO");
  assert.equal(normalizeName("Ana Lúcia"), "ANA LUCIA");
  assert.equal(normalizeName("MANUELA MARGARÍDA"), "MANUELA MARGARIDA");
});

test("collapses multiple spaces", () => {
  assert.equal(normalizeName("ana    paula  da   silva"), "ANA PAULA DA SILVA");
});

test("returns empty string for null/undefined", () => {
  assert.equal(normalizeName(null), "");
  assert.equal(normalizeName(undefined), "");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test scripts/tests/normalize-name.test.mjs`
Expected: FAIL (module not found / `normalizeName` undefined).

- [ ] **Step 3: Implement**

`scripts/lib/normalize-name.mjs`:

```javascript
export function normalizeName(s) {
  if (s == null) return "";
  return String(s)
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}
```

- [ ] **Step 4: Run test to verify pass**

Run: `node --test scripts/tests/normalize-name.test.mjs`
Expected: PASS (4/4).

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/normalize-name.mjs scripts/tests/normalize-name.test.mjs
git commit -m "feat(scripts): normalize-name util com testes"
```

---

### Task 2: Mapeador de cabeçalho de turma

**Files:**
- Create: `scripts/lib/turma-mapper.mjs`
- Test: `scripts/tests/turma-mapper.test.mjs`

Mapeia strings tipo `INFANTIL 4 - MATUTINO`, `3º ANO - A`, `1ª SÉRIE - EM - A`, `MATERNAL - VESPERTINO` em `{ serie_nome, turma_nome, turno }`.

Regra:
- Cabeçalho com `MATUTINO|VESPERTINO|NOTURNO|INTEGRAL` no final → turno explícito; `turma_nome` = `A` se matutino, `B` se vespertino (Infantil/Maternal). Para Infantil, séries chamadas `Infantil N`. Para Maternal: `Maternal`.
- Cabeçalho com letra final isolada (`A`, `B`, …) → turno = `matutino` para `A`, `vespertino` para `B`. Convenção do projeto.
- `Nº ANO - X` → série `Nº Ano`, turma `X`.
- `Nª SÉRIE - EM - X` → série `Nª Série EM`, turma `X`.

- [ ] **Step 1: Write failing test**

`scripts/tests/turma-mapper.test.mjs`:

```javascript
import { test } from "node:test";
import assert from "node:assert/strict";
import { mapTurmaHeader } from "../lib/turma-mapper.mjs";

test("maternal matutino", () => {
  assert.deepEqual(mapTurmaHeader("MATERNAL - MATUTINO"), {
    serie_nome: "Maternal",
    turma_nome: "A",
    turno: "matutino"
  });
});

test("maternal vespertino", () => {
  assert.deepEqual(mapTurmaHeader("MATERNAL - VESPERTINO"), {
    serie_nome: "Maternal",
    turma_nome: "B",
    turno: "vespertino"
  });
});

test("infantil com turno explicito", () => {
  assert.deepEqual(mapTurmaHeader("INFANTIL 4 - MATUTINO"), {
    serie_nome: "Infantil 4",
    turma_nome: "A",
    turno: "matutino"
  });
  assert.deepEqual(mapTurmaHeader("INFANTIL 3 - VESPERTINO"), {
    serie_nome: "Infantil 3",
    turma_nome: "B",
    turno: "vespertino"
  });
  assert.deepEqual(mapTurmaHeader("INFANTIL 5 - MATUTINO"), {
    serie_nome: "Infantil 5",
    turma_nome: "A",
    turno: "matutino"
  });
});

test("ano fundamental letra A = matutino", () => {
  assert.deepEqual(mapTurmaHeader("1º ANO - A"), {
    serie_nome: "1º Ano",
    turma_nome: "A",
    turno: "matutino"
  });
  assert.deepEqual(mapTurmaHeader("9º ANO - A"), {
    serie_nome: "9º Ano",
    turma_nome: "A",
    turno: "matutino"
  });
});

test("ano fundamental letra B = vespertino", () => {
  assert.deepEqual(mapTurmaHeader("3º ANO - B"), {
    serie_nome: "3º Ano",
    turma_nome: "B",
    turno: "vespertino"
  });
});

test("ensino medio", () => {
  assert.deepEqual(mapTurmaHeader("1ª SÉRIE - EM - A"), {
    serie_nome: "1ª Série EM",
    turma_nome: "A",
    turno: "matutino"
  });
  assert.deepEqual(mapTurmaHeader("3ª SÉRIE - EM - A"), {
    serie_nome: "3ª Série EM",
    turma_nome: "A",
    turno: "matutino"
  });
});

test("aceita variantes de digitacao", () => {
  assert.deepEqual(mapTurmaHeader("  3o ANO  -  A  "), {
    serie_nome: "3º Ano",
    turma_nome: "A",
    turno: "matutino"
  });
  assert.deepEqual(mapTurmaHeader("INFANTIL  4  -  MATUTINO"), {
    serie_nome: "Infantil 4",
    turma_nome: "A",
    turno: "matutino"
  });
});

test("retorna null para string nao reconhecida", () => {
  assert.equal(mapTurmaHeader("ALUNO"), null);
  assert.equal(mapTurmaHeader(""), null);
  assert.equal(mapTurmaHeader("MATRICULA"), null);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test scripts/tests/turma-mapper.test.mjs`
Expected: FAIL.

- [ ] **Step 3: Implement**

`scripts/lib/turma-mapper.mjs`:

```javascript
const TURNO_MAP = {
  MATUTINO: "matutino",
  VESPERTINO: "vespertino",
  NOTURNO: "noturno",
  INTEGRAL: "integral"
};

function clean(s) {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function mapTurmaHeader(raw) {
  const s = clean(raw);
  if (!s) return null;

  // MATERNAL - <TURNO>
  let m = s.match(/^MATERNAL\s*-\s*(MATUTINO|VESPERTINO|NOTURNO|INTEGRAL)$/);
  if (m) {
    const turno = TURNO_MAP[m[1]];
    return {
      serie_nome: "Maternal",
      turma_nome: turno === "matutino" ? "A" : "B",
      turno
    };
  }

  // INFANTIL <N> - <TURNO>
  m = s.match(/^INFANTIL\s*(\d+)\s*-\s*(MATUTINO|VESPERTINO|NOTURNO|INTEGRAL)$/);
  if (m) {
    const turno = TURNO_MAP[m[2]];
    return {
      serie_nome: `Infantil ${m[1]}`,
      turma_nome: turno === "matutino" ? "A" : "B",
      turno
    };
  }

  // <N>O ANO - <LETRA>
  m = s.match(/^(\d+)O\s*ANO\s*-\s*([A-Z])$/);
  if (m) {
    const letra = m[2];
    return {
      serie_nome: `${m[1]}º Ano`,
      turma_nome: letra,
      turno: letra === "A" ? "matutino" : "vespertino"
    };
  }

  // <N>A SERIE - EM - <LETRA>
  m = s.match(/^(\d+)A\s*SERIE\s*-\s*EM\s*-\s*([A-Z])$/);
  if (m) {
    const letra = m[2];
    return {
      serie_nome: `${m[1]}ª Série EM`,
      turma_nome: letra,
      turno: letra === "A" ? "matutino" : "vespertino"
    };
  }

  return null;
}
```

Nota: `clean()` remove diacríticos, então `º` vira `O` no NFD. Portanto o regex aceita `3O ANO` (que originalmente era `3º ANO`). Idem `Aª SERIE`.

- [ ] **Step 4: Run test to verify pass**

Run: `node --test scripts/tests/turma-mapper.test.mjs`
Expected: PASS (8/8).

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/turma-mapper.mjs scripts/tests/turma-mapper.test.mjs
git commit -m "feat(scripts): turma-mapper xlsx-header -> serie/turma/turno"
```

---

### Task 3: Fixture xlsx + parser da planilha

**Files:**
- Create: `scripts/tests/build-fixture.mjs`
- Create: `scripts/tests/fixtures/mini-matriculados.xlsx`
- Create: `scripts/lib/parse-matriculados-xlsx.mjs`
- Test: `scripts/tests/parse-matriculados-xlsx.test.mjs`

Parser recebe um workbook ExcelJS já carregado e devolve array de itens `{ nome_raw, sheet, turma_label, mensalidade }`.

- [ ] **Step 1: Criar gerador de fixture**

`scripts/tests/build-fixture.mjs`:

```javascript
import ExcelJS from "exceljs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdirSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));

const wb = new ExcelJS.Workbook();

function addBlock(ws, header, alunos) {
  const r1 = ws.addRow([null, null, null, header]);
  ws.addRow([null, null, null, "ALUNO", "MATRICULA"]);
  alunos.forEach((a, i) => {
    ws.addRow([null, null, i + 1, a.nome, a.valor]);
  });
  ws.addRow([]);
}

const inf = wb.addWorksheet("INFANTIL");
inf.addRow([]);
inf.addRow([]);
addBlock(inf, "MATERNAL - MATUTINO", [
  { nome: "Antony Rodrigues Lino", valor: 600 },
  { nome: "Eurico Flores Amorim", valor: 690 }
]);
addBlock(inf, "INFANTIL 4 - VESPERTINO", [
  { nome: "Manuela Margarida Barros", valor: 800 }
]);

const f1 = wb.addWorksheet("FUND 1");
f1.addRow([]);
addBlock(f1, "3º ANO - B", [
  { nome: "Alice Teste", valor: 700 }
]);

mkdirSync(resolve(__dirname, "fixtures"), { recursive: true });
await wb.xlsx.writeFile(resolve(__dirname, "fixtures/mini-matriculados.xlsx"));
console.log("fixture gerada");
```

Run: `node scripts/tests/build-fixture.mjs`
Expected: imprime "fixture gerada", cria arquivo.

- [ ] **Step 2: Write failing test**

`scripts/tests/parse-matriculados-xlsx.test.mjs`:

```javascript
import { test } from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseMatriculadosXlsx } from "../lib/parse-matriculados-xlsx.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function loadFixture() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(resolve(__dirname, "fixtures/mini-matriculados.xlsx"));
  return wb;
}

test("extrai todos alunos com turma e mensalidade", async () => {
  const wb = await loadFixture();
  const items = parseMatriculadosXlsx(wb);
  assert.equal(items.length, 4);

  const maternal = items.filter(i => i.turma_label.includes("MATERNAL"));
  assert.equal(maternal.length, 2);
  assert.equal(maternal[0].nome_raw, "Antony Rodrigues Lino");
  assert.equal(maternal[0].mensalidade, 600);

  const inf4 = items.find(i => i.nome_raw === "Manuela Margarida Barros");
  assert.ok(inf4);
  assert.match(inf4.turma_label, /INFANTIL 4 - VESPERTINO/);

  const a3b = items.find(i => i.nome_raw === "Alice Teste");
  assert.ok(a3b);
  assert.match(a3b.turma_label, /3.\s*ANO\s*-\s*B/);
  assert.equal(a3b.sheet, "FUND 1");
});

test("ignora linhas sem nome", async () => {
  const wb = await loadFixture();
  const items = parseMatriculadosXlsx(wb);
  // Nenhum item deve ter nome vazio
  assert.ok(items.every(i => i.nome_raw && i.nome_raw.length > 2));
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `node --test scripts/tests/parse-matriculados-xlsx.test.mjs`
Expected: FAIL (parser não existe).

- [ ] **Step 4: Implement parser**

`scripts/lib/parse-matriculados-xlsx.mjs`:

```javascript
import { mapTurmaHeader } from "./turma-mapper.mjs";

function cellText(v) {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  if (typeof v === "object" && v !== null) {
    if ("text" in v) return cellText(v.text);
    if ("result" in v) return cellText(v.result);
    if ("richText" in v && Array.isArray(v.richText)) {
      return v.richText.map(r => r.text).join("");
    }
  }
  return "";
}

function cellNumber(v) {
  if (v == null) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") {
    const n = Number(v.replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  if (typeof v === "object" && v !== null && "result" in v) {
    return cellNumber(v.result);
  }
  return null;
}

function findTurmaHeader(rowValues) {
  for (const v of rowValues) {
    const t = cellText(v).trim();
    if (!t) continue;
    const mapped = mapTurmaHeader(t);
    if (mapped) return t; // retorna label original
  }
  return null;
}

function isAlunoHeaderRow(rowValues) {
  return rowValues.some(v => cellText(v).trim().toUpperCase() === "ALUNO");
}

function extractNameAndValue(rowValues) {
  // Procura primeira string > 5 chars que não seja header.
  let nome = null;
  let valor = null;
  for (const v of rowValues) {
    const t = cellText(v).trim();
    if (!nome && t.length > 5) {
      const up = t.toUpperCase();
      if (up === "ALUNO" || up.startsWith("MATRICULA")) continue;
      if (mapTurmaHeader(t)) continue;
      nome = t;
      continue;
    }
    if (nome && valor == null) {
      const n = cellNumber(v);
      if (n != null && n > 0) {
        valor = n;
        break;
      }
    }
  }
  return { nome, valor };
}

export function parseMatriculadosXlsx(workbook) {
  const items = [];
  for (const ws of workbook.worksheets) {
    let currentTurma = null;
    let seenAlunoHeader = false;
    ws.eachRow({ includeEmpty: false }, (row) => {
      const values = Array.isArray(row.values) ? row.values.slice(1) : [];

      const header = findTurmaHeader(values);
      if (header) {
        currentTurma = header;
        seenAlunoHeader = false;
        return;
      }

      if (currentTurma && !seenAlunoHeader) {
        if (isAlunoHeaderRow(values)) {
          seenAlunoHeader = true;
          return;
        }
      }

      if (currentTurma && seenAlunoHeader) {
        const { nome, valor } = extractNameAndValue(values);
        if (nome) {
          items.push({
            nome_raw: nome,
            sheet: ws.name,
            turma_label: currentTurma,
            mensalidade: valor
          });
        }
      }
    });
  }
  return items;
}
```

- [ ] **Step 5: Run test to verify pass**

Run: `node --test scripts/tests/parse-matriculados-xlsx.test.mjs`
Expected: PASS.

- [ ] **Step 6: Validar contra planilha real**

Criar checagem ad-hoc rodando o parser na planilha real e conferindo total = 499.

Run:

```powershell
node -e "import('exceljs').then(async (m) => { const { default: ExcelJS } = m; const { parseMatriculadosXlsx } = await import('./scripts/lib/parse-matriculados-xlsx.mjs'); const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile('public/MATRICULADOS2026.xlsx'); const items = parseMatriculadosXlsx(wb); console.log('total:', items.length); const turmas = {}; items.forEach(i => turmas[i.turma_label] = (turmas[i.turma_label]||0)+1); for (const [k,v] of Object.entries(turmas)) console.log(k, v); }).catch(e => { console.error(e); process.exit(1); })"
```

Expected: `total: 499` e distribuição igual à do spec (25 turmas).

Se total divergir → debugar parser antes de prosseguir.

- [ ] **Step 7: Commit**

```bash
git add scripts/lib/parse-matriculados-xlsx.mjs scripts/tests/parse-matriculados-xlsx.test.mjs scripts/tests/build-fixture.mjs scripts/tests/fixtures/mini-matriculados.xlsx
git commit -m "feat(scripts): parser MATRICULADOS2026.xlsx com fixture e teste"
```

---

### Task 4: Esqueleto do orquestrador + load env + carga do DB

**Files:**
- Create: `scripts/reconcile_matriculas_2026.mjs`
- Modify: `package.json`

- [ ] **Step 1: Criar esqueleto do script**

`scripts/reconcile_matriculas_2026.mjs`:

```javascript
// Reconcilia série/turma/turno de matrículas 2026 a partir de
// public/MATRICULADOS2026.xlsx.
// Spec: docs/superpowers/specs/2026-05-17-reconciliar-matriculas-2026-design.md
// Plan: docs/superpowers/plans/2026-05-17-reconciliar-matriculas-2026.md
//
// Uso:
//   node scripts/reconcile_matriculas_2026.mjs            # dry-run
//   node scripts/reconcile_matriculas_2026.mjs --apply    # aplica

import { createClient } from "@supabase/supabase-js";
import ExcelJS from "exceljs";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { parseMatriculadosXlsx } from "./lib/parse-matriculados-xlsx.mjs";
import { mapTurmaHeader } from "./lib/turma-mapper.mjs";
import { normalizeName } from "./lib/normalize-name.mjs";

const ANO_LETIVO = 2026;
const XLSX_PATH = "public/MATRICULADOS2026.xlsx";
const REPORT_DIR = "docs/pdfs";

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
const mode = apply ? "APPLY" : "DRY-RUN";

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
});

async function loadEscolaId() {
  const { data, error } = await supabase
    .from("escolas")
    .select("id, nome")
    .order("created_at", { ascending: true })
    .limit(1);
  if (error) throw error;
  if (!data?.length) throw new Error("Nenhuma escola encontrada em escolas");
  return { id: data[0].id, nome: data[0].nome };
}

async function loadAlunos(escola_id) {
  const out = [];
  let from = 0;
  const pageSize = 1000;
  for (;;) {
    const { data, error } = await supabase
      .from("alunos")
      .select("id, nome")
      .eq("escola_id", escola_id)
      .range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data?.length) break;
    out.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return out;
}

async function loadSeries(escola_id) {
  const { data, error } = await supabase
    .from("series")
    .select("id, nome")
    .eq("escola_id", escola_id);
  if (error) throw error;
  return data ?? [];
}

async function loadTurmas(escola_id) {
  const { data, error } = await supabase
    .from("turmas")
    .select("id, serie_id, nome, ano_letivo, turno")
    .eq("escola_id", escola_id)
    .eq("ano_letivo", ANO_LETIVO);
  if (error) throw error;
  return data ?? [];
}

async function loadMatriculas(escola_id) {
  const out = [];
  let from = 0;
  const pageSize = 1000;
  for (;;) {
    const { data, error } = await supabase
      .from("matriculas")
      .select("id, aluno_id, serie_id, turma_id, ano_letivo, status")
      .eq("escola_id", escola_id)
      .eq("ano_letivo", ANO_LETIVO)
      .range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data?.length) break;
    out.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return out;
}

async function main() {
  console.log(`Modo: ${mode}`);
  console.log(`Planilha: ${XLSX_PATH}`);

  const escola = await loadEscolaId();
  console.log(`Escola: ${escola.nome} (${escola.id})`);

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(XLSX_PATH);
  const planilha = parseMatriculadosXlsx(wb);
  console.log(`Linhas planilha: ${planilha.length}`);

  const [alunos, series, turmas, matriculas] = await Promise.all([
    loadAlunos(escola.id),
    loadSeries(escola.id),
    loadTurmas(escola.id),
    loadMatriculas(escola.id)
  ]);
  console.log(
    `DB: alunos=${alunos.length} series=${series.length} turmas=${turmas.length} matriculas2026=${matriculas.length}`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 2: Adicionar scripts em package.json**

Modify `package.json` (em `"scripts"`):

```json
    "test:scripts": "node --test scripts/tests/*.test.mjs",
    "reconcile:matriculas:2026": "node scripts/reconcile_matriculas_2026.mjs",
    "reconcile:matriculas:2026:apply": "node scripts/reconcile_matriculas_2026.mjs --apply",
```

- [ ] **Step 3: Smoke test**

Run: `npm run reconcile:matriculas:2026`
Expected: imprime modo DRY-RUN, escola, total da planilha (499), e contagens do DB. Sem erro.

Se faltar variável de ambiente → ajustar `.env.local`.

- [ ] **Step 4: Commit**

```bash
git add scripts/reconcile_matriculas_2026.mjs package.json
git commit -m "feat(scripts): esqueleto reconcile_matriculas_2026 com loads"
```

---

### Task 5: Resolução série/turma + matching de alunos

Estende `main()` com:
- Resolução de cada item da planilha em `{aluno_id?, serie_id?, turma_id?, serie_nome_alvo, turma_nome_alvo, turno_alvo, status}`.
- Status possíveis: `inalterado`, `update_matricula`, `insert_matricula`, `orfao_planilha`, `turma_faltando`, `serie_faltando`.

**Files:**
- Modify: `scripts/reconcile_matriculas_2026.mjs`

- [ ] **Step 1: Adicionar lógica de resolução**

Após `loadMatriculas`, adicionar antes do final do `main`:

```javascript
  // Índices
  const alunoByNorm = new Map();
  for (const a of alunos) {
    alunoByNorm.set(normalizeName(a.nome), a);
  }
  const serieByNome = new Map(series.map((s) => [s.nome, s]));
  const turmaByKey = new Map(
    turmas.map((t) => [`${t.serie_id}|${t.nome}|${t.turno}`, t])
  );
  const matriculaByAluno = new Map(matriculas.map((m) => [m.aluno_id, m]));

  const resolved = [];
  const orfaos = [];
  const turmasFaltando = new Set();
  const seriesFaltando = new Set();

  for (const item of planilha) {
    const mapped = mapTurmaHeader(item.turma_label);
    if (!mapped) {
      // Defensivo: parser não deveria ter aceito sem mapeamento.
      orfaos.push({ ...item, motivo: "turma_label nao mapeada" });
      continue;
    }
    const aluno = alunoByNorm.get(normalizeName(item.nome_raw));
    if (!aluno) {
      orfaos.push({ ...item, motivo: "aluno nao encontrado por nome" });
      continue;
    }

    const serie = serieByNome.get(mapped.serie_nome);
    if (!serie) {
      seriesFaltando.add(mapped.serie_nome);
    }
    const turma = serie
      ? turmaByKey.get(`${serie.id}|${mapped.turma_nome}|${mapped.turno}`)
      : null;
    if (serie && !turma) {
      turmasFaltando.add(
        `${mapped.serie_nome} | turma ${mapped.turma_nome} | ${mapped.turno}`
      );
    }

    const matricula = matriculaByAluno.get(aluno.id);

    let status;
    if (!serie || !turma) {
      status = "turma_faltando";
    } else if (!matricula) {
      status = "insert_matricula";
    } else if (matricula.turma_id === turma.id) {
      status = "inalterado";
    } else {
      status = "update_matricula";
    }

    resolved.push({
      aluno_id: aluno.id,
      aluno_nome: aluno.nome,
      sheet: item.sheet,
      turma_label: item.turma_label,
      serie_nome_alvo: mapped.serie_nome,
      turma_nome_alvo: mapped.turma_nome,
      turno_alvo: mapped.turno,
      matricula_id_atual: matricula?.id ?? null,
      serie_id_alvo: serie?.id ?? null,
      turma_id_alvo: turma?.id ?? null,
      status
    });
  }

  // Extras: matrículas no DB cujos alunos não estão na planilha (por nome)
  const planilhaAlunoIds = new Set(
    resolved.map((r) => r.aluno_id).filter(Boolean)
  );
  const extras = matriculas
    .filter((m) => !planilhaAlunoIds.has(m.aluno_id))
    .map((m) => ({
      matricula_id: m.id,
      aluno_id: m.aluno_id,
      aluno_nome: alunos.find((a) => a.id === m.aluno_id)?.nome ?? "?"
    }));

  const counts = resolved.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, {});
  counts.orfaos_planilha = orfaos.length;
  counts.extras_sistema = extras.length;

  console.log("\n=== Resumo ===");
  for (const [k, v] of Object.entries(counts)) console.log(`  ${k}: ${v}`);
  if (seriesFaltando.size) {
    console.log("\nSéries faltando no DB:");
    for (const s of seriesFaltando) console.log(`  - ${s}`);
  }
  if (turmasFaltando.size) {
    console.log("\nTurmas faltando no DB:");
    for (const t of turmasFaltando) console.log(`  - ${t}`);
  }
```

- [ ] **Step 2: Rodar dry-run e validar números**

Run: `npm run reconcile:matriculas:2026`
Expected: imprime resumo com counts. Esperado: `inalterado + update_matricula + insert_matricula + turma_faltando + orfaos_planilha = 499`.

- [ ] **Step 3: Spot-check Manuela**

Adicionar (temporário, remover depois) ao final do `main` antes do exit:

```javascript
  const m = resolved.find((r) => r.aluno_nome.toUpperCase().includes("MANUELA MARGARIDA"));
  console.log("\nSpot-check MANUELA:", m);
```

Run: `npm run reconcile:matriculas:2026`
Expected: `serie_nome_alvo: "3º Ano"`, `turma_nome_alvo: "B"`, `turno_alvo: "vespertino"`, `status` = `update_matricula`.

Remover o spot-check após validar (não commitar).

- [ ] **Step 4: Commit**

```bash
git add scripts/reconcile_matriculas_2026.mjs
git commit -m "feat(scripts): resolucao + matching planilha vs DB (dry-run)"
```

---

### Task 6: Geração de relatório JSON

**Files:**
- Modify: `scripts/reconcile_matriculas_2026.mjs`

- [ ] **Step 1: Escrever relatório**

Adicionar antes do final de `main`:

```javascript
  mkdirSync(REPORT_DIR, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const reportPath = `${REPORT_DIR}/reconcile-2026-${mode.toLowerCase()}-${timestamp}.json`;
  const report = {
    mode,
    ano_letivo: ANO_LETIVO,
    escola,
    counts,
    series_faltando: [...seriesFaltando],
    turmas_faltando: [...turmasFaltando],
    inalterados_count: counts.inalterado ?? 0,
    corrigidos: resolved.filter((r) => r.status === "update_matricula"),
    criados: resolved.filter((r) => r.status === "insert_matricula"),
    orfaos_planilha: orfaos,
    extras_sistema: extras
  };
  writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf8");
  console.log(`\nRelatório: ${reportPath}`);
```

- [ ] **Step 2: Rodar e abrir relatório**

Run: `npm run reconcile:matriculas:2026`
Expected: novo arquivo em `docs/pdfs/reconcile-2026-dry-run-*.json` com listas detalhadas.

Inspecionar manualmente: top 5 de `corrigidos[]` devem ter `de` (turma atual) e `para` (turma alvo) reconhecíveis. Se faltar `de`, adicionar dados:

Atualize a montagem de `corrigidos` para incluir `de` (atual) lendo `turmas`:

```javascript
  const turmaById = new Map(turmas.map((t) => [t.id, t]));
  const serieById = new Map(series.map((s) => [s.id, s]));
  const enriched = resolved.map((r) => {
    if (r.status !== "update_matricula") return r;
    const matricula = matriculas.find((m) => m.id === r.matricula_id_atual);
    const turmaAtual = matricula ? turmaById.get(matricula.turma_id) : null;
    const serieAtual = matricula ? serieById.get(matricula.serie_id) : null;
    return {
      ...r,
      de: serieAtual && turmaAtual
        ? `${serieAtual.nome} | ${turmaAtual.nome} | ${turmaAtual.turno}`
        : null,
      para: `${r.serie_nome_alvo} | ${r.turma_nome_alvo} | ${r.turno_alvo}`
    };
  });
  report.corrigidos = enriched.filter((r) => r.status === "update_matricula");
```

Inserir antes do `writeFileSync`.

- [ ] **Step 3: Rodar de novo e validar**

Run: `npm run reconcile:matriculas:2026`
Expected: `corrigidos[].de` e `.para` preenchidos.

- [ ] **Step 4: Commit**

```bash
git add scripts/reconcile_matriculas_2026.mjs
git commit -m "feat(scripts): relatorio JSON detalhado de reconciliacao"
```

---

### Task 7: Apply — criar séries/turmas faltantes

**Files:**
- Modify: `scripts/reconcile_matriculas_2026.mjs`

- [ ] **Step 1: Adicionar função de criação**

Antes do `main`, definir:

```javascript
async function ensureSeriesETurmas({
  escola_id,
  series,
  turmas,
  resolved,
  seriesFaltando,
  turmasFaltando,
  dryRun
}) {
  const serieByNome = new Map(series.map((s) => [s.nome, s]));
  const turmaByKey = new Map(
    turmas.map((t) => [`${t.serie_id}|${t.nome}|${t.turno}`, t])
  );
  const seriesCriadas = [];
  const turmasCriadas = [];

  // Cria séries faltantes
  for (const nome of seriesFaltando) {
    if (dryRun) {
      seriesCriadas.push({ nome, dry: true });
      continue;
    }
    const { data, error } = await supabase
      .from("series")
      .insert({ escola_id, nome, ordem: 0, ativo: true })
      .select("id, nome")
      .single();
    if (error) throw new Error(`Erro criando serie ${nome}: ${error.message}`);
    serieByNome.set(data.nome, data);
    seriesCriadas.push(data);
  }

  // Recoleta turmas faltantes resolvendo serie_id agora
  const turmasNecessarias = new Map();
  for (const r of resolved) {
    const key = `${r.serie_nome_alvo}|${r.turma_nome_alvo}|${r.turno_alvo}`;
    if (turmasNecessarias.has(key)) continue;
    const serie = serieByNome.get(r.serie_nome_alvo);
    if (!serie) continue;
    const tKey = `${serie.id}|${r.turma_nome_alvo}|${r.turno_alvo}`;
    if (turmaByKey.has(tKey)) continue;
    turmasNecessarias.set(key, {
      serie_id: serie.id,
      serie_nome: r.serie_nome_alvo,
      nome: r.turma_nome_alvo,
      turno: r.turno_alvo
    });
  }

  for (const t of turmasNecessarias.values()) {
    if (dryRun) {
      turmasCriadas.push({ ...t, dry: true });
      continue;
    }
    const { data, error } = await supabase
      .from("turmas")
      .insert({
        escola_id,
        serie_id: t.serie_id,
        nome: t.nome,
        ano_letivo: ANO_LETIVO,
        turno: t.turno,
        capacidade: 30,
        ativo: true
      })
      .select("id, serie_id, nome, ano_letivo, turno")
      .single();
    if (error)
      throw new Error(
        `Erro criando turma ${t.serie_nome}/${t.nome}/${t.turno}: ${error.message}`
      );
    turmaByKey.set(`${data.serie_id}|${data.nome}|${data.turno}`, data);
    turmasCriadas.push(data);
  }

  return { serieByNome, turmaByKey, seriesCriadas, turmasCriadas };
}
```

- [ ] **Step 2: Integrar no main**

Antes do bloco que monta `resolved`, mover a chamada de `ensureSeriesETurmas` para depois da primeira passada de resolução (que detecta faltantes). Reorganização:

1. Primeira passada: resolve usando estado atual do DB, anotando `seriesFaltando`/`turmasFaltando`.
2. Se `apply`: chama `ensureSeriesETurmas` que cria faltantes; reroda resolução com mapas atualizados.
3. Se `dry-run`: chama com `dryRun: true`, apenas registra o que seria criado, e refaz resolução com mapas hipotéticos (incluindo as "fakes" para ver quantos `update_matricula`/`insert_matricula` apareceriam).

Implementação concreta — refatorar o bloco de resolução em uma função reusável. Substituir o bloco atual:

```javascript
  function resolveAll({ serieByNome, turmaByKey }) {
    const resolved = [];
    const orfaos = [];
    const seriesFaltando = new Set();
    const turmasFaltando = new Set();
    for (const item of planilha) {
      const mapped = mapTurmaHeader(item.turma_label);
      if (!mapped) {
        orfaos.push({ ...item, motivo: "turma_label nao mapeada" });
        continue;
      }
      const aluno = alunoByNorm.get(normalizeName(item.nome_raw));
      if (!aluno) {
        orfaos.push({ ...item, motivo: "aluno nao encontrado por nome" });
        continue;
      }
      const serie = serieByNome.get(mapped.serie_nome);
      if (!serie) seriesFaltando.add(mapped.serie_nome);
      const turma = serie
        ? turmaByKey.get(`${serie.id}|${mapped.turma_nome}|${mapped.turno}`)
        : null;
      if (serie && !turma)
        turmasFaltando.add(
          `${mapped.serie_nome} | turma ${mapped.turma_nome} | ${mapped.turno}`
        );
      const matricula = matriculaByAluno.get(aluno.id);
      let status;
      if (!serie || !turma) status = "turma_faltando";
      else if (!matricula) status = "insert_matricula";
      else if (matricula.turma_id === turma.id) status = "inalterado";
      else status = "update_matricula";
      resolved.push({
        aluno_id: aluno.id,
        aluno_nome: aluno.nome,
        sheet: item.sheet,
        turma_label: item.turma_label,
        serie_nome_alvo: mapped.serie_nome,
        turma_nome_alvo: mapped.turma_nome,
        turno_alvo: mapped.turno,
        matricula_id_atual: matricula?.id ?? null,
        serie_id_alvo: serie?.id ?? null,
        turma_id_alvo: turma?.id ?? null,
        status
      });
    }
    return { resolved, orfaos, seriesFaltando, turmasFaltando };
  }

  let pass1 = resolveAll({
    serieByNome: new Map(series.map((s) => [s.nome, s])),
    turmaByKey: new Map(
      turmas.map((t) => [`${t.serie_id}|${t.nome}|${t.turno}`, t])
    )
  });

  const ensured = await ensureSeriesETurmas({
    escola_id: escola.id,
    series,
    turmas,
    resolved: pass1.resolved,
    seriesFaltando: pass1.seriesFaltando,
    turmasFaltando: pass1.turmasFaltando,
    dryRun: !apply
  });

  // Segunda passada: usa mapas atualizados.
  let pass2;
  if (apply) {
    pass2 = resolveAll({
      serieByNome: ensured.serieByNome,
      turmaByKey: ensured.turmaByKey
    });
  } else {
    // Em dry-run, simula criação adicionando placeholders em memória.
    const simSerie = new Map(ensured.serieByNome);
    const simTurma = new Map(ensured.turmaByKey);
    for (const s of ensured.seriesCriadas) {
      if (!simSerie.has(s.nome))
        simSerie.set(s.nome, { id: `dry-serie-${s.nome}`, nome: s.nome });
    }
    for (const t of ensured.turmasCriadas) {
      const serie = simSerie.get(t.serie_nome ?? "");
      const sid = t.serie_id ?? serie?.id;
      if (sid) {
        const key = `${sid}|${t.nome}|${t.turno}`;
        if (!simTurma.has(key))
          simTurma.set(key, {
            id: `dry-turma-${key}`,
            serie_id: sid,
            nome: t.nome,
            turno: t.turno
          });
      }
    }
    pass2 = resolveAll({ serieByNome: simSerie, turmaByKey: simTurma });
  }

  const resolved = pass2.resolved;
  const orfaos = pass2.orfaos;
  const seriesFaltando = pass2.seriesFaltando;
  const turmasFaltando = pass2.turmasFaltando;
```

Importante: o bloco de `counts`, `extras`, `enriched` e relatório continua igual depois disso, mas adicione ao `report`:

```javascript
  report.series_criadas = ensured.seriesCriadas;
  report.turmas_criadas = ensured.turmasCriadas;
```

- [ ] **Step 3: Dry-run**

Run: `npm run reconcile:matriculas:2026`
Expected: `turma_faltando` agora deve ser 0 (ou perto), pois a simulação cria as faltantes. `update_matricula + insert_matricula + inalterado + orfaos_planilha = 499` (ou bem perto).

- [ ] **Step 4: Commit**

```bash
git add scripts/reconcile_matriculas_2026.mjs
git commit -m "feat(scripts): ensureSeriesETurmas + dupla passada de resolucao"
```

---

### Task 8: Apply — UPDATE e INSERT de matrículas

**Files:**
- Modify: `scripts/reconcile_matriculas_2026.mjs`

- [ ] **Step 1: Adicionar função de aplicação**

```javascript
async function applyMatriculas({ escola_id, resolved, dryRun }) {
  let updated = 0;
  let inserted = 0;
  for (const r of resolved) {
    if (r.status === "update_matricula") {
      if (dryRun) {
        updated++;
        continue;
      }
      const { error } = await supabase
        .from("matriculas")
        .update({
          serie_id: r.serie_id_alvo,
          turma_id: r.turma_id_alvo,
          updated_at: new Date().toISOString()
        })
        .eq("id", r.matricula_id_atual);
      if (error)
        throw new Error(
          `UPDATE matricula ${r.matricula_id_atual} falhou: ${error.message}`
        );
      updated++;
    } else if (r.status === "insert_matricula") {
      if (dryRun) {
        inserted++;
        continue;
      }
      const { error } = await supabase.from("matriculas").insert({
        escola_id,
        aluno_id: r.aluno_id,
        serie_id: r.serie_id_alvo,
        turma_id: r.turma_id_alvo,
        ano_letivo: ANO_LETIVO,
        status: "ativa"
      });
      if (error)
        throw new Error(
          `INSERT matricula aluno ${r.aluno_id} falhou: ${error.message}`
        );
      inserted++;
    }
  }
  return { updated, inserted };
}
```

- [ ] **Step 2: Chamar no main**

Após `pass2` e antes da escrita do relatório, adicionar:

```javascript
  const applied = await applyMatriculas({
    escola_id: escola.id,
    resolved,
    dryRun: !apply
  });
  console.log(`\nAplicado: updates=${applied.updated} inserts=${applied.inserted}`);
  report.applied = applied;
```

- [ ] **Step 3: Dry-run final**

Run: `npm run reconcile:matriculas:2026`
Expected: imprime `Aplicado: updates=N inserts=M`. Sem escrita no banco. Relatório completo escrito.

Conferir manualmente o relatório:
- Total `corrigidos[].length` == counts.update_matricula
- Spot-check 3 casos do problema (Manuela + 4º Ano + Inf4 Mat) listados em `corrigidos` ou já `inalterado`.

- [ ] **Step 4: Backup do banco antes do apply real**

```powershell
# Lista matrículas 2026 atuais como snapshot
node -e "import('@supabase/supabase-js').then(async (m) => { const { createClient } = m; const url=process.env.NEXT_PUBLIC_SUPABASE_URL; const k=process.env.SUPABASE_SERVICE_ROLE_KEY; const s=createClient(url,k); const { data } = await s.from('matriculas').select('id, aluno_id, serie_id, turma_id, ano_letivo, status').eq('ano_letivo',2026); require('fs').writeFileSync('docs/pdfs/backup-matriculas-2026-pre-reconcile.json', JSON.stringify(data,null,2)); console.log('backup:', data.length); }).catch(e => { console.error(e); process.exit(1); })"
```

Expected: arquivo `docs/pdfs/backup-matriculas-2026-pre-reconcile.json` com snapshot.

- [ ] **Step 5: Apply REAL — atenção, escreve no banco**

Confirmar com o usuário antes de rodar. Comando:

Run: `npm run reconcile:matriculas:2026:apply`
Expected: imprime `Modo: APPLY`, cria séries/turmas faltantes no banco, faz UPDATE em todas matrículas divergentes, INSERT nas que faltavam. Termina com sumário e caminho do relatório `docs/pdfs/reconcile-2026-apply-*.json`.

- [ ] **Step 6: Validar no banco**

Query manual:

```sql
SELECT s.nome AS serie, t.nome AS turma, t.turno, count(*)
FROM matriculas m
JOIN turmas t ON t.id = m.turma_id
JOIN series s ON s.id = m.serie_id
WHERE m.ano_letivo = 2026 AND m.status = 'ativa'
GROUP BY s.nome, t.nome, t.turno
ORDER BY s.nome, t.nome, t.turno;
```

Expected: contagens batem com a planilha:
- `Infantil 4 | A | matutino`: 20
- `Infantil 4 | B | vespertino`: 19
- `3º Ano | B | vespertino`: 25
- `4º Ano | B | vespertino`: 16
- etc.

Spot-check Manuela:

```sql
SELECT a.nome, s.nome AS serie, t.nome AS turma, t.turno
FROM matriculas m
JOIN alunos a ON a.id = m.aluno_id
JOIN turmas t ON t.id = m.turma_id
JOIN series s ON s.id = m.serie_id
WHERE a.nome ILIKE '%MANUELA MARGARIDA%' AND m.ano_letivo = 2026;
```

Expected: `3º Ano | B | vespertino`.

- [ ] **Step 7: Commit**

```bash
git add scripts/reconcile_matriculas_2026.mjs docs/pdfs/backup-matriculas-2026-pre-reconcile.json
git commit -m "feat(scripts): apply mode UPDATE/INSERT matriculas + backup snapshot"
```

Não commitar os arquivos `docs/pdfs/reconcile-2026-*.json` (são run logs).

- [ ] **Step 8: Adicionar reports ao .gitignore se necessário**

Verificar `.gitignore` para `docs/pdfs/reconcile-2026-*.json` e `docs/pdfs/backup-matriculas-2026-*.json` (backup pode permanecer rastreado se útil; relatórios não).

Run: `git status`
Se houver relatórios não commitados, adicionar regra ao `.gitignore`:

```
docs/pdfs/reconcile-2026-*.json
```

Commit do .gitignore se modificado.

---

### Task 9: Documentação no README do scripts

**Files:**
- Create ou modify: `scripts/README.md`

- [ ] **Step 1: Documentar**

Adicionar seção:

```markdown
## reconcile_matriculas_2026

Reconcilia série/turma/turno de matrículas 2026 a partir de
`public/MATRICULADOS2026.xlsx`.

- Dry-run: `npm run reconcile:matriculas:2026`
- Apply: `npm run reconcile:matriculas:2026:apply`

Relatório em `docs/pdfs/reconcile-2026-*.json`.

Convenção:
- Maternal/Infantil: turno no cabeçalho (`MATERNAL - MATUTINO`).
- Fund+Médio: turma `A` = matutino, `B` = vespertino.

Match aluno: nome exato normalizado (sem acento, upper, trim).
Sem match → órfão (revisar manualmente).
```

- [ ] **Step 2: Commit**

```bash
git add scripts/README.md
git commit -m "docs(scripts): documenta reconcile_matriculas_2026"
```

---

## Self-Review

- Spec coverage:
  - Fonte verdade xlsx → Tasks 3, 4. ✓
  - Match nome normalizado → Tasks 1, 5. ✓
  - Mapeamento turma → Task 2. ✓
  - Convenção turno (A=mat, B=vesp) → Task 2 testes. ✓
  - Dry-run + apply → Tasks 4, 7, 8. ✓
  - Criar séries/turmas faltantes → Task 7. ✓
  - UPDATE preservando ID matrícula → Task 8. ✓
  - INSERT para alunos sem matrícula 2026 → Task 8. ✓
  - Relatório JSON com corrigidos/criados/órfãos/extras → Tasks 6, 8. ✓
  - Spot-check Manuela + 4 turmas problemáticas → Task 5 step 3, Task 8 step 6. ✓
  - Backup snapshot pré-apply → Task 8 step 4. ✓
  - Fora escopo (valores, órfãos, cancelamentos) → mencionado, não implementado. ✓

- Placeholders: nenhum "TODO", "TBD", "fill in".

- Type consistency:
  - `mapTurmaHeader` retorno: `{serie_nome, turma_nome, turno}` consistente Tasks 2, 5, 7, 8.
  - `parseMatriculadosXlsx` retorno: `{nome_raw, sheet, turma_label, mensalidade}` consistente Tasks 3, 5.
  - `normalizeName` assinatura idem Tasks 1, 5.
  - `resolved` shape estável Tasks 5, 6, 7, 8.

Tudo OK.
