# Reset Matrículas 2026 da Planilha — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Limpar matrículas/séries/turmas/cobranças/pagamentos 2026 e recriar do zero usando `public/MATRICULADOS2026.xlsx` como fonte de verdade. Alunos sem valor na planilha ficam sem matrícula (fluxo manual existente já cobre).

**Architecture:** Migration adiciona `valor_mensalidade_praticado` em `matriculas`. Script `.mjs` Node parseia planilha, valida match de alunos, deleta dependências 2026 em transação, recria séries/turmas/matrículas/cobranças. Helper `generate-charges` ganha branch que usa valor praticado quando setado. UI `matricula-edit-dialog` ganha campo do valor.

**Tech Stack:** Next.js 15 + Supabase (PostgreSQL 17) + ExcelJS + Vitest + Node 24.

**Spec:** `docs/superpowers/specs/2026-05-23-reset-matriculas-planilha-design.md`

---

## File Structure

**Create:**
- `supabase/migrations/202605230001_matricula_valor_praticado.sql` — schema change
- `scripts/lib/reset-matriculas-mapper.mjs` — turma/série mapper alinhado ao DB real
- `scripts/lib/reset-matriculas-mapper.test.mjs` — testes do mapper
- `scripts/reset_matriculas_2026.mjs` — script principal dry-run/apply

**Modify:**
- `src/lib/server/generate-charges.ts` — branch quando `valor_mensalidade_praticado` setado
- `src/components/finance/matricula-edit-dialog.tsx` — campo valor
- `src/lib/actions/alunos-sem-valor.ts` — aceitar/salvar campo valor
- `src/lib/data/alunos-sem-valor-constants.ts` — adicionar campo ao `RawAluno`/`AlunoSemValorRow`
- `src/lib/data/alunos-sem-valor.ts` — selecionar coluna nova
- `package.json` — npm scripts `reset:matriculas:2026[:apply]`

**Reuse (no change):**
- `scripts/lib/normalize-name.mjs` — já normaliza nome corretamente
- `scripts/lib/parse-matriculados-xlsx.mjs` — já parseia estrutura da planilha

---

## Task 1: Migration `valor_mensalidade_praticado`

**Files:**
- Create: `supabase/migrations/202605230001_matricula_valor_praticado.sql`

- [ ] **Step 1: Criar migration**

```sql
-- Permite valor mensal específico por matrícula, sobrepondo planos.valor_mensalidade.
-- Usado quando a planilha de matriculados traz valor cobrado individualizado por aluno
-- (descontos, bolsas implícitas, valores históricos diferentes do plano).

alter table matriculas
  add column valor_mensalidade_praticado numeric(12,2);

comment on column matriculas.valor_mensalidade_praticado is
  'Valor mensal cobrado deste aluno. Quando null, usa planos.valor_mensalidade.';
```

- [ ] **Step 2: Aplicar via MCP Supabase**

Usar `mcp__claude_ai_Supabase__apply_migration` com `project_id=fljkjhmwnjehsodvqaqk`, `name=matricula_valor_praticado`, passando o SQL acima. Esperado: success, sem erros.

- [ ] **Step 3: Verificar coluna existe**

```sql
select column_name, data_type, is_nullable
from information_schema.columns
where table_name='matriculas' and column_name='valor_mensalidade_praticado';
```

Esperado: 1 linha, `numeric`, `YES`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/202605230001_matricula_valor_praticado.sql
git commit -m "feat(financeiro): add valor_mensalidade_praticado to matriculas"
```

---

## Task 2: Mapper série/turma alinhado ao DB

**Files:**
- Create: `scripts/lib/reset-matriculas-mapper.mjs`
- Create: `scripts/lib/reset-matriculas-mapper.test.mjs`

Mapper retorna `{ serie_nome, turma_nome, turno }` com nomes que batem **exatamente** o que será inserido no DB (vide Task 5).

- [ ] **Step 1: Escrever teste falhando**

```js
// scripts/lib/reset-matriculas-mapper.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { mapHeaderToTarget } from "./reset-matriculas-mapper.mjs";

test("MATERNAL - MATUTINO", () => {
  assert.deepEqual(mapHeaderToTarget("MATERNAL - MATUTINO"), {
    serie_nome: "MATERNAL",
    turma_nome: "MATUTINO",
    turno: "matutino"
  });
});

test("INFANTIL 5 - VESPERTINO", () => {
  assert.deepEqual(mapHeaderToTarget("INFANTIL 5 - VESPERTINO"), {
    serie_nome: "INFANTIL5",
    turma_nome: "VESPERTINO",
    turno: "vespertino"
  });
});

test("1º ANO - A (FUND1 letra A vira MATUTINO)", () => {
  assert.deepEqual(mapHeaderToTarget("1º ANO - A"), {
    serie_nome: "1º ANO",
    turma_nome: "MATUTINO",
    turno: "matutino"
  });
});

test("5º ANO - B (FUND1 letra B vira VESPERTINO)", () => {
  assert.deepEqual(mapHeaderToTarget("5º ANO - B"), {
    serie_nome: "5º ANO",
    turma_nome: "VESPERTINO",
    turno: "vespertino"
  });
});

test("6º ANO - A (FUND2 só matutino)", () => {
  assert.deepEqual(mapHeaderToTarget("6º ANO - A"), {
    serie_nome: "6º ANO",
    turma_nome: "MATUTINO",
    turno: "matutino"
  });
});

test("1ª SÉRIE - EM - A (MÉDIO)", () => {
  assert.deepEqual(mapHeaderToTarget("1ª SÉRIE - EM - A"), {
    serie_nome: "1ª SÉRIE",
    turma_nome: "MATUTINO",
    turno: "matutino"
  });
});

test("header inválido retorna null", () => {
  assert.equal(mapHeaderToTarget("BLA"), null);
});
```

- [ ] **Step 2: Rodar teste pra confirmar falha**

Run: `node --test scripts/lib/reset-matriculas-mapper.test.mjs`
Esperado: FAIL — module não encontrado.

- [ ] **Step 3: Implementar mapper**

```js
// scripts/lib/reset-matriculas-mapper.mjs

function normalize(s) {
  return String(s ?? "")
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toUpperCase()
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

export function mapHeaderToTarget(raw) {
  const s = normalize(raw);
  if (!s) return null;

  // MATERNAL - MATUTINO|VESPERTINO
  let m = s.match(/^MATERNAL\s*-\s*(MATUTINO|VESPERTINO)$/);
  if (m) {
    return { serie_nome: "MATERNAL", turma_nome: m[1], turno: m[1].toLowerCase() };
  }

  // INFANTIL N - MATUTINO|VESPERTINO
  m = s.match(/^INFANTIL\s*(\d+)\s*-\s*(MATUTINO|VESPERTINO)$/);
  if (m) {
    return {
      serie_nome: `INFANTIL${m[1]}`,
      turma_nome: m[2],
      turno: m[2].toLowerCase()
    };
  }

  // MÉDIO: 1ª SÉRIE - EM - A (testar antes de FUND p/ não pegar errado)
  m = s.match(/^(\d+)A?\s*SERIE\s*-\s*EM\s*-\s*([AB])$/);
  if (m) {
    return {
      serie_nome: `${m[1]}ª SÉRIE`,
      turma_nome: m[2] === "A" ? "MATUTINO" : "VESPERTINO",
      turno: m[2] === "A" ? "matutino" : "vespertino"
    };
  }

  // FUND1 (1-5) e FUND2 (6-9): Nº ANO - A|B
  m = s.match(/^(\d+)O?\s*ANO\s*-\s*([AB])$/);
  if (m) {
    const n = Number(m[1]);
    const letra = m[2];
    // FUND2 (6-9): só matutino independente da letra
    if (n >= 6) {
      return { serie_nome: `${n}º ANO`, turma_nome: "MATUTINO", turno: "matutino" };
    }
    // FUND1 (1-5): A=matutino, B=vespertino
    return {
      serie_nome: `${n}º ANO`,
      turma_nome: letra === "A" ? "MATUTINO" : "VESPERTINO",
      turno: letra === "A" ? "matutino" : "vespertino"
    };
  }

  return null;
}

export const SERIES_ALVO = [
  { nome: "MATERNAL", ordem: 1, segmento: "INFANTIL" },
  { nome: "INFANTIL3", ordem: 2, segmento: "INFANTIL" },
  { nome: "INFANTIL4", ordem: 3, segmento: "INFANTIL" },
  { nome: "INFANTIL5", ordem: 4, segmento: "INFANTIL" },
  { nome: "1º ANO", ordem: 5, segmento: "FUNDAMENTAL1" },
  { nome: "2º ANO", ordem: 6, segmento: "FUNDAMENTAL1" },
  { nome: "3º ANO", ordem: 7, segmento: "FUNDAMENTAL1" },
  { nome: "4º ANO", ordem: 8, segmento: "FUNDAMENTAL1" },
  { nome: "5º ANO", ordem: 9, segmento: "FUNDAMENTAL1" },
  { nome: "6º ANO", ordem: 10, segmento: "FUNDAMENTAL2" },
  { nome: "7º ANO", ordem: 11, segmento: "FUNDAMENTAL2" },
  { nome: "8º ANO", ordem: 12, segmento: "FUNDAMENTAL2" },
  { nome: "9º ANO", ordem: 13, segmento: "FUNDAMENTAL2" },
  { nome: "1ª SÉRIE", ordem: 14, segmento: "MEDIO" },
  { nome: "2ª SÉRIE", ordem: 15, segmento: "MEDIO" },
  { nome: "3ª SÉRIE", ordem: 16, segmento: "MEDIO" },
];

export const TURMAS_ALVO = [
  // Infantil: ambos turnos
  { serie: "MATERNAL",   turma: "MATUTINO",   turno: "matutino" },
  { serie: "MATERNAL",   turma: "VESPERTINO", turno: "vespertino" },
  { serie: "INFANTIL3",  turma: "MATUTINO",   turno: "matutino" },
  { serie: "INFANTIL3",  turma: "VESPERTINO", turno: "vespertino" },
  { serie: "INFANTIL4",  turma: "MATUTINO",   turno: "matutino" },
  { serie: "INFANTIL4",  turma: "VESPERTINO", turno: "vespertino" },
  { serie: "INFANTIL5",  turma: "MATUTINO",   turno: "matutino" },
  { serie: "INFANTIL5",  turma: "VESPERTINO", turno: "vespertino" },
  // FUND1: ambos
  { serie: "1º ANO", turma: "MATUTINO",   turno: "matutino" },
  { serie: "1º ANO", turma: "VESPERTINO", turno: "vespertino" },
  { serie: "2º ANO", turma: "MATUTINO",   turno: "matutino" },
  { serie: "2º ANO", turma: "VESPERTINO", turno: "vespertino" },
  { serie: "3º ANO", turma: "MATUTINO",   turno: "matutino" },
  { serie: "3º ANO", turma: "VESPERTINO", turno: "vespertino" },
  { serie: "4º ANO", turma: "MATUTINO",   turno: "matutino" },
  { serie: "4º ANO", turma: "VESPERTINO", turno: "vespertino" },
  { serie: "5º ANO", turma: "MATUTINO",   turno: "matutino" },
  { serie: "5º ANO", turma: "VESPERTINO", turno: "vespertino" },
  // FUND2: só matutino
  { serie: "6º ANO", turma: "MATUTINO", turno: "matutino" },
  { serie: "7º ANO", turma: "MATUTINO", turno: "matutino" },
  { serie: "8º ANO", turma: "MATUTINO", turno: "matutino" },
  { serie: "9º ANO", turma: "MATUTINO", turno: "matutino" },
  // MEDIO: só matutino
  { serie: "1ª SÉRIE", turma: "MATUTINO", turno: "matutino" },
  { serie: "2ª SÉRIE", turma: "MATUTINO", turno: "matutino" },
  { serie: "3ª SÉRIE", turma: "MATUTINO", turno: "matutino" },
];
```

- [ ] **Step 4: Rodar testes pra confirmar passam**

Run: `node --test scripts/lib/reset-matriculas-mapper.test.mjs`
Esperado: 7 tests passing.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/reset-matriculas-mapper.mjs scripts/lib/reset-matriculas-mapper.test.mjs
git commit -m "feat(scripts): mapper series/turmas alvo do reset 2026"
```

---

## Task 3: Script reset principal — esqueleto + parse + match

**Files:**
- Create: `scripts/reset_matriculas_2026.mjs`

Esta task escreve o script até a validação de match (sem chegar a deletar/inserir nada). Próximas tasks adicionam delete/insert/cobranças.

- [ ] **Step 1: Esqueleto do script**

```js
// scripts/reset_matriculas_2026.mjs
//
// Reset completo das matrículas 2026: apaga matriculas + cobrancas + pagamentos
// + turmas 2026 + series não-alvo, e recria a partir de public/MATRICULADOS2026.xlsx.
//
// Spec: docs/superpowers/specs/2026-05-23-reset-matriculas-planilha-design.md
// Plan: docs/superpowers/plans/2026-05-23-reset-matriculas-planilha.md
//
// Uso:
//   node scripts/reset_matriculas_2026.mjs                          # dry-run
//   node scripts/reset_matriculas_2026.mjs --apply --i-have-backup  # aplica

import { createClient } from "@supabase/supabase-js";
import ExcelJS from "exceljs";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseMatriculadosXlsx } from "./lib/parse-matriculados-xlsx.mjs";
import { normalizeName } from "./lib/normalize-name.mjs";
import {
  mapHeaderToTarget,
  SERIES_ALVO,
  TURMAS_ALVO
} from "./lib/reset-matriculas-mapper.mjs";

const ANO_LETIVO = 2026;
const XLSX_PATH = "public/MATRICULADOS2026.xlsx";
const PLANO_NOME = "Mensalidade 2026";

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
const hasBackupFlag = process.argv.includes("--i-have-backup");
const mode = apply ? "APPLY" : "DRY-RUN";

if (apply && !hasBackupFlag) {
  console.error("ERRO: --apply requer flag --i-have-backup. Faça backup antes:");
  console.error("  Supabase Dashboard > Database > Backups > Manual backup");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
});

async function loadEscolaId() {
  const { data, error } = await supabase
    .from("escolas")
    .select("id")
    .limit(1)
    .single();
  if (error || !data) throw new Error("escola não encontrada");
  return data.id;
}

async function loadPlanoId(escolaId) {
  const { data, error } = await supabase
    .from("planos")
    .select("id, nome")
    .eq("escola_id", escolaId)
    .eq("nome", PLANO_NOME)
    .single();
  if (error || !data) throw new Error(`plano '${PLANO_NOME}' não encontrado`);
  return data.id;
}

async function main() {
  console.log(`\n=== RESET MATRÍCULAS 2026 — modo ${mode} ===\n`);

  const escolaId = await loadEscolaId();
  const planoId = await loadPlanoId(escolaId);
  console.log(`escola_id: ${escolaId}`);
  console.log(`plano_id: ${planoId}`);

  // 1. Parse planilha
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(XLSX_PATH);
  const itensRaw = parseMatriculadosXlsx(wb);
  console.log(`\nplanilha: ${itensRaw.length} linhas detectadas`);

  // 2. Mapeia cada item para serie/turma/turno alvo
  const itens = [];
  const semMapeamento = [];
  for (const it of itensRaw) {
    const mapped = mapHeaderToTarget(it.turma_label);
    if (!mapped) {
      semMapeamento.push(it);
      continue;
    }
    itens.push({ ...it, ...mapped });
  }
  if (semMapeamento.length > 0) {
    console.error(`\nERRO: ${semMapeamento.length} linhas com header não mapeado:`);
    for (const x of semMapeamento.slice(0, 10)) {
      console.error(`  - '${x.turma_label}' (sheet ${x.sheet}, aluno '${x.nome_raw}')`);
    }
    process.exit(1);
  }

  const comValor = itens.filter(i => typeof i.mensalidade === "number" && i.mensalidade > 0);
  const semValor = itens.filter(i => i.mensalidade == null || i.mensalidade <= 0);
  console.log(`com valor: ${comValor.length} | sem valor: ${semValor.length} (serão ignorados)`);

  // 3. Match de nomes
  const { data: alunosDb, error: errAlunos } = await supabase
    .from("alunos")
    .select("id, nome")
    .eq("escola_id", escolaId)
    .eq("ativo", true);
  if (errAlunos) throw errAlunos;

  const byName = new Map();
  const dupes = [];
  for (const a of alunosDb) {
    const key = normalizeName(a.nome);
    if (byName.has(key)) {
      dupes.push({ key, ids: [byName.get(key), a.id] });
    } else {
      byName.set(key, a.id);
    }
  }
  if (dupes.length > 0) {
    console.error(`\nERRO: ${dupes.length} nomes normalizados duplicados no DB:`);
    for (const d of dupes.slice(0, 10)) {
      console.error(`  - '${d.key}' -> ${d.ids.join(", ")}`);
    }
    process.exit(1);
  }

  const naoCasados = [];
  for (const it of comValor) {
    const key = normalizeName(it.nome_raw);
    const id = byName.get(key);
    if (!id) {
      naoCasados.push(it);
    } else {
      it.aluno_id = id;
    }
  }
  if (naoCasados.length > 0) {
    console.error(`\nERRO: ${naoCasados.length} alunos da planilha não encontrados no DB:`);
    for (const n of naoCasados) {
      console.error(`  - '${n.nome_raw}' (sheet ${n.sheet}, turma '${n.turma_label}')`);
    }
    process.exit(1);
  }

  console.log(`\nmatch: ${comValor.length} alunos casados com sucesso`);
  console.log(`\nPróximas etapas (delete/insert) serão implementadas nas Tasks 4-7.`);
  // Aqui termina por agora; o restante é adicionado incrementalmente.
}

main().catch(err => {
  console.error("FATAL:", err?.message ?? err);
  process.exit(1);
});
```

- [ ] **Step 2: Rodar dry-run**

Run: `node scripts/reset_matriculas_2026.mjs`
Esperado:
- imprime escola_id, plano_id
- `planilha: 499 linhas detectadas` (ou similar)
- `com valor: 463 | sem valor: 36` (aproximado)
- `match: 463 alunos casados com sucesso`
- exit 0

Se algum erro (não mapeado / não casado / dupe): NÃO continuar. Reportar pro usuário lista de inconsistências antes de prosseguir.

- [ ] **Step 3: Commit**

```bash
git add scripts/reset_matriculas_2026.mjs
git commit -m "feat(scripts): reset matriculas 2026 — parse + match validation"
```

---

## Task 4: Script reset — delete em transação

**Files:**
- Modify: `scripts/reset_matriculas_2026.mjs`

Supabase JS não tem transação client-side. Vamos usar RPC com função PL/pgSQL. Alternativa: chamadas separadas com tratamento de erro — aceitável aqui pois delete cascateia já no nível tabela e fazemos backup antes.

Decisão: chamadas sequenciais com rollback manual via try/catch (deletes são reversíveis só via backup; é o que a flag `--i-have-backup` cobre).

- [ ] **Step 1: Adicionar função `executeReset` no script**

Adicionar (antes do `main`):

```js
async function executeReset(escolaId, itens, planoId) {
  // 1. Apagar pagamentos vinculados a matriculas 2026
  const { data: matriculasAntigas, error: errM } = await supabase
    .from("matriculas")
    .select("id")
    .eq("escola_id", escolaId)
    .eq("ano_letivo", ANO_LETIVO);
  if (errM) throw errM;
  const matriculaIds = matriculasAntigas.map(m => m.id);
  console.log(`\ndelete: ${matriculaIds.length} matriculas 2026 alvo`);

  if (matriculaIds.length > 0) {
    const { error, count } = await supabase
      .from("pagamentos")
      .delete({ count: "exact" })
      .in("matricula_id", matriculaIds);
    if (error) throw error;
    console.log(`  pagamentos deletados: ${count}`);

    const { error: errC, count: countC } = await supabase
      .from("cobrancas")
      .delete({ count: "exact" })
      .in("matricula_id", matriculaIds);
    if (errC) throw errC;
    console.log(`  cobrancas deletadas: ${countC}`);

    const { error: errMD, count: countMD } = await supabase
      .from("matriculas")
      .delete({ count: "exact" })
      .in("id", matriculaIds);
    if (errMD) throw errMD;
    console.log(`  matriculas deletadas: ${countMD}`);
  }

  // 2. Apagar turmas 2026
  const { error: errT, count: countT } = await supabase
    .from("turmas")
    .delete({ count: "exact" })
    .eq("escola_id", escolaId)
    .eq("ano_letivo", ANO_LETIVO);
  if (errT) throw errT;
  console.log(`  turmas 2026 deletadas: ${countT}`);

  // 3. Apagar séries fora da lista alvo (sem dependências)
  const nomesAlvo = SERIES_ALVO.map(s => s.nome);
  const { data: seriesForaAlvo, error: errSF } = await supabase
    .from("series")
    .select("id, nome")
    .eq("escola_id", escolaId)
    .not("nome", "in", `(${nomesAlvo.map(n => `"${n}"`).join(",")})`);
  if (errSF) throw errSF;
  for (const s of seriesForaAlvo) {
    const { error } = await supabase.from("series").delete().eq("id", s.id);
    if (error) {
      console.log(`  série '${s.nome}' não pôde ser deletada (deps): ${error.message}`);
    } else {
      console.log(`  série '${s.nome}' deletada`);
    }
  }
}
```

- [ ] **Step 2: Wireup no `main` (dentro de bloco `if (apply)`)**

Substituir o trecho `Próximas etapas...` por:

```js
if (!apply) {
  console.log(`\n[DRY-RUN] Para aplicar: node scripts/reset_matriculas_2026.mjs --apply --i-have-backup`);
  return;
}

console.log(`\n--- INICIANDO RESET ---`);
await executeReset(escolaId, itens, planoId);
console.log(`\nPróximas etapas (insert/cobranças) — Tasks 5-7`);
```

- [ ] **Step 3: Dry-run de novo**

Run: `node scripts/reset_matriculas_2026.mjs`
Esperado: termina com mensagem `[DRY-RUN]`. Nada apagado no DB.

Verificar via MCP que counts não mudaram:
```sql
select count(*) from matriculas where ano_letivo=2026;
```
Esperado: mesmo número do início.

- [ ] **Step 4: Commit (NÃO rodar com --apply ainda)**

```bash
git add scripts/reset_matriculas_2026.mjs
git commit -m "feat(scripts): reset matriculas 2026 — delete phase"
```

---

## Task 5: Script reset — recriar séries e turmas

**Files:**
- Modify: `scripts/reset_matriculas_2026.mjs`

- [ ] **Step 1: Adicionar função `recreateSeriesTurmas`**

Adicionar após `executeReset`:

```js
async function recreateSeriesTurmas(escolaId) {
  // Buscar séries existentes (após delete) p/ saber quais já estão lá
  const { data: existentes, error: errE } = await supabase
    .from("series")
    .select("id, nome")
    .eq("escola_id", escolaId);
  if (errE) throw errE;

  const byNome = new Map(existentes.map(s => [s.nome, s.id]));
  const serieIdByNome = new Map();

  // Upsert séries alvo
  for (const s of SERIES_ALVO) {
    if (byNome.has(s.nome)) {
      const id = byNome.get(s.nome);
      // update ordem se mudou
      const { error } = await supabase
        .from("series")
        .update({ ordem: s.ordem, ativo: true })
        .eq("id", id);
      if (error) throw error;
      serieIdByNome.set(s.nome, id);
    } else {
      const { data, error } = await supabase
        .from("series")
        .insert({ escola_id: escolaId, nome: s.nome, ordem: s.ordem, ativo: true })
        .select("id")
        .single();
      if (error) throw error;
      serieIdByNome.set(s.nome, data.id);
      console.log(`  série criada: ${s.nome}`);
    }
  }

  // Inserir turmas
  const turmaIdByKey = new Map(); // key = `${serie_nome}|${turma_nome}`
  for (const t of TURMAS_ALVO) {
    const serieId = serieIdByNome.get(t.serie);
    if (!serieId) throw new Error(`série '${t.serie}' não encontrada`);
    const { data, error } = await supabase
      .from("turmas")
      .insert({
        escola_id: escolaId,
        serie_id: serieId,
        nome: t.turma,
        ano_letivo: ANO_LETIVO,
        turno: t.turno,
        capacidade: 30,
        ativo: true
      })
      .select("id")
      .single();
    if (error) throw error;
    turmaIdByKey.set(`${t.serie}|${t.turma}`, data.id);
  }
  console.log(`  séries: ${SERIES_ALVO.length} alvo | turmas criadas: ${TURMAS_ALVO.length}`);

  return { serieIdByNome, turmaIdByKey };
}
```

- [ ] **Step 2: Wireup no `main`**

Substituir mensagem `Próximas etapas (insert/cobranças)...` por:

```js
const { serieIdByNome, turmaIdByKey } = await recreateSeriesTurmas(escolaId);
console.log(`\nPróximas etapas (matriculas + cobranças) — Tasks 6-7`);
// Manter variáveis acessíveis pra próxima task
globalThis.__reset = { serieIdByNome, turmaIdByKey, itens, planoId, escolaId };
```

(O `globalThis.__reset` é só pra task seguinte conseguir testar isolado; será removido na task final.)

- [ ] **Step 3: Dry-run (não passa por `recreateSeriesTurmas` ainda — só em apply)**

Run: `node scripts/reset_matriculas_2026.mjs`
Esperado: mesmo output dry-run da task 3.

- [ ] **Step 4: Commit**

```bash
git add scripts/reset_matriculas_2026.mjs
git commit -m "feat(scripts): reset matriculas 2026 — recreate series/turmas"
```

---

## Task 6: Script reset — inserir matrículas

**Files:**
- Modify: `scripts/reset_matriculas_2026.mjs`

- [ ] **Step 1: Adicionar função `insertMatriculas`**

Após `recreateSeriesTurmas`:

```js
async function insertMatriculas(escolaId, planoId, itens, serieIdByNome, turmaIdByKey) {
  // Buscar codigos de matrícula dos alunos
  const alunoIds = [...new Set(itens.map(i => i.aluno_id))];
  const { data: alunos, error } = await supabase
    .from("alunos")
    .select("id, matricula_codigo")
    .in("id", alunoIds);
  if (error) throw error;
  const codigoById = new Map(alunos.map(a => [a.id, a.matricula_codigo]));

  const rows = [];
  for (const it of itens) {
    const serieId = serieIdByNome.get(it.serie_nome);
    const turmaId = turmaIdByKey.get(`${it.serie_nome}|${it.turma_nome}`);
    if (!serieId || !turmaId) {
      throw new Error(`mapeamento ausente: ${it.serie_nome}/${it.turma_nome}`);
    }
    rows.push({
      escola_id: escolaId,
      aluno_id: it.aluno_id,
      serie_id: serieId,
      turma_id: turmaId,
      plano_id: planoId,
      codigo: `${codigoById.get(it.aluno_id) ?? it.aluno_id}-${ANO_LETIVO}`,
      data_matricula: `${ANO_LETIVO}-01-01`,
      ano_letivo: ANO_LETIVO,
      status: "ativa",
      tipo_vaga: "paga",
      percentual_bolsa: 0,
      valor_mensalidade_praticado: it.mensalidade
    });
  }

  // Insert em batches de 100
  const BATCH = 100;
  const inseridas = [];
  for (let i = 0; i < rows.length; i += BATCH) {
    const slice = rows.slice(i, i + BATCH);
    const { data, error: errIns } = await supabase
      .from("matriculas")
      .insert(slice)
      .select("id, aluno_id, valor_mensalidade_praticado, data_matricula");
    if (errIns) throw errIns;
    inseridas.push(...data);
  }
  console.log(`  matriculas inseridas: ${inseridas.length}`);
  return inseridas;
}
```

- [ ] **Step 2: Wireup no `main`**

Substituir mensagem `Próximas etapas (matriculas + cobranças)...` por:

```js
const matriculasNovas = await insertMatriculas(
  escolaId, planoId, itens, serieIdByNome, turmaIdByKey
);
console.log(`\nPróxima etapa (cobranças) — Task 7`);
globalThis.__reset = { ...globalThis.__reset, matriculasNovas };
```

- [ ] **Step 3: Dry-run**

Run: `node scripts/reset_matriculas_2026.mjs`
Esperado: mesmo output dry-run anterior.

- [ ] **Step 4: Commit**

```bash
git add scripts/reset_matriculas_2026.mjs
git commit -m "feat(scripts): reset matriculas 2026 — insert matriculas"
```

---

## Task 7: Script reset — gerar cobranças

**Files:**
- Modify: `scripts/reset_matriculas_2026.mjs`

Geração local (não chama `generate-charges.ts` porque aquele é TS server-side com tipos diferentes). Gera 12 mensalidades + 1 cobrança de matrícula por aluno.

- [ ] **Step 1: Adicionar `generateCobrancas`**

```js
function lastDayOfMonth(year, monthIndex) {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

function dueDate(year, monthIndex, day) {
  const safe = Math.min(Math.max(day, 1), lastDayOfMonth(year, monthIndex));
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(safe).padStart(2, "0")}`;
}

async function generateCobrancas(escolaId, planoId, matriculasNovas) {
  // Carrega plano pra ler dia_vencimento, valor_matricula, quantidade_parcelas
  const { data: plano, error: errP } = await supabase
    .from("planos")
    .select("nome, valor_matricula, quantidade_parcelas, dia_vencimento")
    .eq("id", planoId)
    .single();
  if (errP) throw errP;

  const valorMatricula = Number(plano.valor_matricula ?? 0);
  const installments = Number(plano.quantidade_parcelas ?? 12);
  const dueDay = Number(plano.dia_vencimento ?? 10);

  const rows = [];
  for (const m of matriculasNovas) {
    const valorMensal = Number(m.valor_mensalidade_praticado ?? 0);
    // Cobrança de matrícula (parcela 0)
    if (valorMatricula > 0) {
      rows.push({
        escola_id: escolaId,
        aluno_id: m.aluno_id,
        matricula_id: m.id,
        plano_id: planoId,
        descricao: `Matricula ${ANO_LETIVO}`,
        competencia: `${ANO_LETIVO}-00`,
        numero_parcela: 0,
        valor_original: valorMatricula,
        valor_desconto: 0,
        valor_acrescimo: 0,
        data_vencimento: m.data_matricula,
        status: "aberta"
      });
    }
    // 12 mensalidades
    for (let idx = 0; idx < installments; idx += 1) {
      const monthIndex = idx % 12;
      const year = ANO_LETIVO + Math.floor(idx / 12);
      rows.push({
        escola_id: escolaId,
        aluno_id: m.aluno_id,
        matricula_id: m.id,
        plano_id: planoId,
        descricao: `Mensalidade ${String(monthIndex + 1).padStart(2, "0")}/${year} - ${plano.nome}`,
        competencia: `${year}-${String(monthIndex + 1).padStart(2, "0")}`,
        numero_parcela: idx + 1,
        valor_original: valorMensal,
        valor_desconto: 0,
        valor_acrescimo: 0,
        data_vencimento: dueDate(year, monthIndex, dueDay),
        status: "aberta"
      });
    }
  }

  const BATCH = 500;
  let total = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const slice = rows.slice(i, i + BATCH);
    const { error } = await supabase.from("cobrancas").insert(slice);
    if (error) throw error;
    total += slice.length;
  }
  console.log(`  cobranças inseridas: ${total}`);
}
```

- [ ] **Step 2: Wireup final no `main`**

Substituir mensagem `Próxima etapa (cobranças)...` e limpar `globalThis.__reset`:

```js
await generateCobrancas(escolaId, planoId, matriculasNovas);

console.log(`\n=== RESET CONCLUÍDO ===`);
console.log(`séries: ${SERIES_ALVO.length}`);
console.log(`turmas: ${TURMAS_ALVO.length}`);
console.log(`matrículas: ${matriculasNovas.length}`);
```

Remover linhas `globalThis.__reset = ...`.

- [ ] **Step 3: Dry-run final**

Run: `node scripts/reset_matriculas_2026.mjs`
Esperado: imprime contagens previstas e mensagem `[DRY-RUN]`. Sem efeito no DB.

- [ ] **Step 4: Commit**

```bash
git add scripts/reset_matriculas_2026.mjs
git commit -m "feat(scripts): reset matriculas 2026 — gerar cobranças"
```

---

## Task 8: npm scripts

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Adicionar scripts**

Localizar bloco `"scripts": { ... }` e adicionar antes do fechamento:

```json
    "reset:matriculas:2026": "node scripts/reset_matriculas_2026.mjs",
    "reset:matriculas:2026:apply": "node scripts/reset_matriculas_2026.mjs --apply --i-have-backup"
```

(Adicionar vírgula no item anterior.)

- [ ] **Step 2: Verificar JSON válido**

Run: `node -e "JSON.parse(require('fs').readFileSync('package.json','utf8'))"`
Esperado: sem output (sem erro).

- [ ] **Step 3: Rodar via npm**

Run: `npm run reset:matriculas:2026`
Esperado: roda dry-run, mesmo output da Task 7 step 3.

- [ ] **Step 4: Commit**

```bash
git add package.json
git commit -m "chore(scripts): npm aliases para reset matriculas 2026"
```

---

## Task 9: Atualizar `generate-charges.ts` pra usar valor praticado

**Files:**
- Modify: `src/lib/server/generate-charges.ts`

- [ ] **Step 1: Adicionar campo no input + buscar matrícula**

Em `GenerateChargesInput`, adicionar:

```ts
type GenerateChargesInput = {
  supabase: SupabaseLike;
  escolaId: string;
  alunoId: string;
  matriculaId: string;
  planoId: string | null;
  dataMatricula: string;
  anoLetivo: number;
  tipoVaga?: TipoVagaCobranca;
  percentualBolsa?: number;
  valorMensalidadePraticado?: number | null;
};
```

- [ ] **Step 2: Aplicar override no cálculo**

Localizar bloco em `generateChargesForEnrollment` que calcula `monthlyFee`:

```ts
  const monthlyFee = Number(plan.valor_mensalidade ?? 0);
```

Substituir por:

```ts
  const planMonthly = Number(plan.valor_mensalidade ?? 0);
  const praticado = input.valorMensalidadePraticado;
  const monthlyFee = (typeof praticado === "number" && praticado > 0) ? praticado : planMonthly;
  // Quando valor praticado existe, desconto de bolsa não se aplica (valor já é o final cobrado)
  const usaPraticado = (typeof praticado === "number" && praticado > 0);
```

Localizar:

```ts
  const descontoMensal = tipoVaga === "bolsa_parcial"
    ? Math.round(monthlyFee * (percentualBolsa / 100) * 100) / 100
    : 0;
```

Substituir por:

```ts
  const descontoMensal = (!usaPraticado && tipoVaga === "bolsa_parcial")
    ? Math.round(monthlyFee * (percentualBolsa / 100) * 100) / 100
    : 0;
```

- [ ] **Step 3: Atualizar callers**

Run: `grep -rn "generateChargesForEnrollment" src`
Esperado: 2-3 callers. Para cada um, adicionar `valorMensalidadePraticado: matricula.valor_mensalidade_praticado` ao input (passing through do registro de matrícula). Se caller não tem acesso ao registro, deixar como `undefined` (fallback ao plano = comportamento atual).

- [ ] **Step 4: Build & typecheck**

Run: `npm run typecheck`
Esperado: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/generate-charges.ts
git commit -m "feat(financeiro): generate-charges respeita valor_mensalidade_praticado"
```

---

## Task 10: Adicionar campo valor na UI de matrícula

**Files:**
- Modify: `src/components/finance/matricula-edit-dialog.tsx`
- Modify: `src/lib/actions/alunos-sem-valor.ts`
- Modify: `src/lib/data/alunos-sem-valor-constants.ts`
- Modify: `src/lib/data/alunos-sem-valor.ts`

- [ ] **Step 1: Adicionar campo em `RawAluno` + `AlunoSemValorRow`**

Em `src/lib/data/alunos-sem-valor-constants.ts`, localizar tipo `RawAluno.matriculas[number]` e adicionar:

```ts
valor_mensalidade_praticado: number | null;
```

E em `AlunoSemValorRow`:

```ts
valorMensalidadePraticado: number | null;
```

E em `buildRow`, propagar:

```ts
valorMensalidadePraticado: matricula.valor_mensalidade_praticado ?? null,
```

(Se não há matrícula, valor é `null`.)

- [ ] **Step 2: Atualizar query em `alunos-sem-valor.ts`**

Localizar select de matrículas. Adicionar coluna:

```ts
matriculas!left(id, tipo_vaga, plano_id, status, ano_letivo, valor_mensalidade_praticado,
  planos(valor_matricula),
  turmas(id, nome, series(id, nome, ordem))),
```

E no mapeamento `allMatriculas`/`matricula2026.map`:

```ts
valor_mensalidade_praticado: m.valor_mensalidade_praticado,
```

(Adicionar campo no tipo inline e propagar.)

- [ ] **Step 3: Adicionar campo no dialog**

Em `src/components/finance/matricula-edit-dialog.tsx`, adicionar state:

```ts
const [valorMensalidade, setValorMensalidade] = useState<string>(
  row.valorMensalidadePraticado != null ? String(row.valorMensalidadePraticado) : ""
);
```

No `openDialog`, resetar:

```ts
setValorMensalidade(row.valorMensalidadePraticado != null ? String(row.valorMensalidadePraticado) : "");
```

Adicionar input após o campo `Plano`:

```tsx
<label className="text-xs font-medium text-ink/70">
  Valor mensalidade praticado (R$)
  <input
    name="valor_mensalidade_praticado"
    type="number"
    step="0.01"
    min="0"
    value={valorMensalidade}
    onChange={(e) => setValorMensalidade(e.target.value)}
    placeholder="Em branco usa valor do plano"
  />
</label>
```

- [ ] **Step 4: Atualizar action**

Em `src/lib/actions/alunos-sem-valor.ts`, adicionar leitor:

```ts
function readValorPraticado(formData: FormData): number | null {
  const raw = formData.get("valor_mensalidade_praticado");
  if (typeof raw !== "string" || raw.trim() === "") return null;
  const v = Number(raw);
  if (!Number.isFinite(v) || v < 0) return null;
  return v;
}
```

No `upsertMatriculaSemValorAction`, ler e incluir nos `insert`/`update`:

```ts
const valorPraticado = readValorPraticado(formData);
```

No `update` body: adicionar `valor_mensalidade_praticado: valorPraticado,`
No `insert` body: adicionar `valor_mensalidade_praticado: valorPraticado,`

- [ ] **Step 5: Typecheck + build**

Run: `npm run typecheck && npm run build`
Esperado: 0 errors, build sucesso.

- [ ] **Step 6: Smoke test UI manual**

```bash
npm run dev
```

Abrir `http://localhost:3000/financeiro/alunos-sem-valor`. Editar uma matrícula, setar valor 700, salvar. Verificar via MCP:

```sql
select valor_mensalidade_praticado from matriculas where id='<id editado>';
```
Esperado: 700.00.

Limpar valor (campo vazio), salvar. Verificar = null.

- [ ] **Step 7: Commit**

```bash
git add src/components/finance/matricula-edit-dialog.tsx \
        src/lib/actions/alunos-sem-valor.ts \
        src/lib/data/alunos-sem-valor.ts \
        src/lib/data/alunos-sem-valor-constants.ts
git commit -m "feat(financeiro): campo valor mensalidade praticado no dialog matrícula"
```

---

## Task 11: Backup + Apply em produção

**Files:** nenhum

Esta task é executada **interativamente com o usuário**. NÃO rodar autonomamente.

- [ ] **Step 1: Solicitar backup ao usuário**

Pedir ao usuário pra abrir Supabase Dashboard:
- Project: `rrb-escola` (`fljkjhmwnjehsodvqaqk`)
- Database > Backups > "Create manual backup"
- Aguardar conclusão (timestamp do backup visível na lista).

Anotar timestamp do backup no chat.

- [ ] **Step 2: Confirmar dry-run final**

Run: `npm run reset:matriculas:2026`
Esperado: counts batem com expectativa (cerca de 463 matrículas, ~6020 cobranças se 12 parcelas + 1 matrícula × 463 ≈ 6019).

- [ ] **Step 3: Apply**

Confirmar com usuário em tela: "Vou apagar 507 matrículas + 5558 cobranças + 5556 pagamentos 2026 e recriar 463 matrículas. Confirmar?"

Após "sim":

Run: `npm run reset:matriculas:2026:apply`
Esperado: imprime contagens reais de delete e insert, termina com `=== RESET CONCLUÍDO ===`.

- [ ] **Step 4: Verificação pós-apply**

```sql
select
  (select count(*) from matriculas where ano_letivo=2026 and status='ativa') as ativas,
  (select count(*) from matriculas where ano_letivo=2026 and valor_mensalidade_praticado is not null) as com_valor_praticado,
  (select count(*) from cobrancas where date_part('year', data_vencimento)=2026) as cobrancas_2026,
  (select count(*) from turmas where ano_letivo=2026) as turmas_2026,
  (select count(distinct serie_id) from turmas where ano_letivo=2026) as series_em_uso;
```

Esperado:
- `ativas` ≈ 463 (matches planilha com valor)
- `com_valor_praticado` = `ativas` (todos têm valor)
- `cobrancas_2026` ≈ 463 × 12 = 5556 (cobrança de matrícula tem vencimento `data_matricula` = 2026-01-01, então também conta)
- `turmas_2026` = 21
- `series_em_uso` ≤ 16

- [ ] **Step 5: Smoke test UI**

Abrir `http://localhost:3000/financeiro/alunos-com-desconto`. Validar valores na grid batem com planilha pra amostra de 5 alunos.

- [ ] **Step 6: Tag commit final (opcional)**

```bash
git tag reset-matriculas-2026-aplicado-$(date +%Y%m%d-%H%M)
```

---

## Self-Review

**Spec coverage:**
- ✅ Schema change (Task 1)
- ✅ Mapeamento séries/turmas (Task 2)
- ✅ Pipeline reset (Tasks 3-7)
- ✅ generate-charges.ts atualizado (Task 9)
- ✅ UI matricula-edit-dialog (Task 10)
- ✅ Match por nome normalizado + abort em falha (Task 3)
- ✅ Backup obrigatório (flag + Task 11)
- ✅ Não-objetivos respeitados (sem cálculo de bolsa, sem criar alunos novos)

**Placeholders:** nenhum TBD/TODO genérico. Cada step tem código completo ou comando exato.

**Type consistency:** `valor_mensalidade_praticado` (DB / form / row) e `valorMensalidadePraticado` (camelCase nos types TS) consistentes. `valorMensalidadePraticado` é convertido no boundary (action + buildRow).

**Risco residual:**
- Task 9 callers — depende de quantos lugares chamam `generateChargesForEnrollment`. Grep antes de modificar. Se algum caller não tem acesso ao registro de matrícula, passa `undefined` (fallback seguro).
- Insert batch de 5500+ cobranças: 500/batch × 11 batches. Aceitável.
- Plano "Mensalidade 2026" hardcoded. Verificar existe antes de rodar.

---

## Execution Handoff

Plan completo e salvo em `docs/superpowers/plans/2026-05-23-reset-matriculas-planilha.md`. Duas opções de execução:

**1. Subagent-Driven (recomendado)** — eu disparo subagent fresco por task, revisamos entre tasks, iteração rápida.

**2. Inline Execution** — executo as tasks nesta sessão usando executing-plans, batch com checkpoints pra revisão.

Qual?
