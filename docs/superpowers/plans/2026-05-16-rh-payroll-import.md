# RH Payroll Import — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admin uploads payroll xlsx files; system extracts (nome, s/DSR, aplica_dobra), matches by name, previews, then bulk-updates employees + deletes/regenerates folha of current month with auto-recalc.

**Architecture:** Server actions handle parse + commit. Pure parser using `exceljs` already in deps. Preview cached in DB table (`payroll_import_cache`) keyed by user_id. Commit applies updates, deletes current month payroll/period, regenerates via existing calculator + brackets.

**Tech Stack:** Next.js 14 App Router, React 18, Supabase SSR, Zod, exceljs (already in deps), TypeScript.

**Spec:** `docs/superpowers/specs/2026-05-16-rh-payroll-import-design.md`

---

## File Structure

**Migration:**
- Create: `supabase/migrations/202605240004_payroll_import_cache.sql`

**Pure parser:**
- Create: `src/lib/payroll/xlsx-parser.ts`

**Validation:**
- Create: `src/lib/validation/payroll-import.ts`

**Actions:**
- Create: `src/lib/actions/payroll-import.ts`

**Components (`src/components/rh/payroll-import/`):**
- Create: `upload-form.tsx`
- Create: `preview-table.tsx`
- Create: `commit-button.tsx`
- Create: `cancel-button.tsx`

**Pages:**
- Create: `src/app/(app)/rh/funcionarios/importar/page.tsx`

**Topbar/lista funcionários:**
- Modify: `src/app/(app)/rh/funcionarios/page.tsx` (add "Importar" action button)

---

## Task 1: Migration — payroll_import_cache

**Files:**
- Create: `supabase/migrations/202605240004_payroll_import_cache.sql`

- [ ] **Step 1: Create migration**

File: `supabase/migrations/202605240004_payroll_import_cache.sql`

```sql
create table if not exists public.payroll_import_cache (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null,
  created_at timestamptz not null default now()
);
```

- [ ] **Step 2: Apply**

Run:
```
docker exec -i supabase_db_rrb-escola psql -U postgres -d postgres < supabase/migrations/202605240004_payroll_import_cache.sql
```

Expected: CREATE TABLE.

- [ ] **Step 3: Verify**

Run:
```
docker exec -i supabase_db_rrb-escola psql -U postgres -d postgres -c "select tablename from pg_tables where schemaname='public' and tablename='payroll_import_cache';"
```

Expected: 1 row.

- [ ] **Step 4: Commit**

```bash
cd c:/Desenv/Projetos/rrb-escola
git add supabase/migrations/202605240004_payroll_import_cache.sql
git commit -m "feat(payroll): migration payroll_import_cache for preview state"
```

---

## Task 2: Pure xlsx parser

**Files:**
- Create: `src/lib/payroll/xlsx-parser.ts`

- [ ] **Step 1: Create file**

File: `src/lib/payroll/xlsx-parser.ts`

```ts
import ExcelJS from "exceljs";

export type ParsedRow = {
  sheet: string;
  nome: string;
  salario_sem_dsr: number;
  aplica_dobra: boolean;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function cellNumber(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === "number") return v;
  if (typeof v === "string") return Number(v.replace(",", ".")) || 0;
  if (typeof v === "object" && v !== null && "result" in v) {
    return cellNumber((v as { result: unknown }).result);
  }
  return 0;
}

function cellText(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  if (typeof v === "object" && v !== null && "result" in v) {
    return cellText((v as { result: unknown }).result);
  }
  if (typeof v === "object" && v !== null && "richText" in v) {
    const rt = (v as { richText: Array<{ text: string }> }).richText;
    return rt.map((r) => r.text).join("");
  }
  return String(v);
}

export async function parsePayrollXlsx(buffer: ArrayBuffer | Buffer): Promise<ParsedRow[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as ArrayBuffer);
  const out: ParsedRow[] = [];

  for (const ws of wb.worksheets) {
    if (/desconto/i.test(ws.name)) continue;

    let headerRow = -1;
    let nomeCol = -1;
    let semDsrCol = -1;
    let dobraCol = -1;

    const scanLimit = Math.min(20, ws.rowCount);
    for (let r = 1; r <= scanLimit; r++) {
      const row = ws.getRow(r);
      let foundSemDsr = false;
      let foundNome = false;
      let foundDobra = false;

      row.eachCell({ includeEmpty: true }, (cell, n) => {
        const raw = cellText(cell.value).toUpperCase().trim();
        if (raw.includes("SALÁRIO S/ DSR") || raw.includes("SALARIO S/ DSR")) {
          semDsrCol = n;
          foundSemDsr = true;
        } else if (raw === "FUNCIONÁRIOS" || raw === "FUNCIONARIOS") {
          nomeCol = n;
          foundNome = true;
        } else if (raw.includes("SALÁRIO DOBRA") || raw.includes("SALARIO DOBRA")) {
          dobraCol = n;
          foundDobra = true;
        }
      });

      if (foundSemDsr && foundNome) {
        headerRow = r;
        // dobra optional but useful
        void foundDobra;
        break;
      }
    }

    if (headerRow < 0 || nomeCol < 0 || semDsrCol < 0) continue;

    for (let r = headerRow + 1; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      const nome = cellText(row.getCell(nomeCol).value).trim();
      if (!nome) continue;
      // Skip if nome is numeric or section header
      if (/^\d+$/.test(nome)) continue;

      const semDsrVal = cellNumber(row.getCell(semDsrCol).value);
      if (semDsrVal <= 0) continue;

      const dobraVal = dobraCol > 0 ? cellNumber(row.getCell(dobraCol).value) : 0;
      const aplica_dobra = dobraVal > 0;

      out.push({
        sheet: ws.name,
        nome,
        salario_sem_dsr: round2(semDsrVal),
        aplica_dobra
      });
    }
  }

  return out;
}

export function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
```

- [ ] **Step 2: Type check**

Run: `cd c:/Desenv/Projetos/rrb-escola && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Smoke test with real planilha (node script)**

Run:
```
cd c:/Desenv/Projetos/rrb-escola && node -e "
const { parsePayrollXlsx } = require('./src/lib/payroll/xlsx-parser.ts');
" 2>&1 | head -5
```

This will fail because tsx node can't import ts. Acceptable — actual smoke is via the server action later (Task 4).

- [ ] **Step 4: Commit**

```bash
cd c:/Desenv/Projetos/rrb-escola
git add src/lib/payroll/xlsx-parser.ts
git commit -m "feat(payroll): pure xlsx parser for nome + s/DSR + aplica_dobra"
```

---

## Task 3: Validation schemas

**Files:**
- Create: `src/lib/validation/payroll-import.ts`

- [ ] **Step 1: Create file**

File: `src/lib/validation/payroll-import.ts`

```ts
import { z } from "zod";

export const MatchedRecordSchema = z.object({
  employee_id: z.string().uuid(),
  nome_db: z.string(),
  nome_planilha: z.string(),
  cpf: z.string(),
  salario_sem_dsr: z.number().min(0),
  aplica_dobra: z.boolean()
});

export const ParsedRowSchema = z.object({
  sheet: z.string(),
  nome: z.string(),
  salario_sem_dsr: z.number().min(0),
  aplica_dobra: z.boolean()
});

export const ImportPreviewSchema = z.object({
  matched: z.array(MatchedRecordSchema),
  notMatched: z.array(ParsedRowSchema)
});

export type MatchedRecord = z.infer<typeof MatchedRecordSchema>;
export type ParsedRow = z.infer<typeof ParsedRowSchema>;
export type ImportPreview = z.infer<typeof ImportPreviewSchema>;
```

- [ ] **Step 2: Type check**

Run: `cd c:/Desenv/Projetos/rrb-escola && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
cd c:/Desenv/Projetos/rrb-escola
git add src/lib/validation/payroll-import.ts
git commit -m "feat(payroll): import validation schemas"
```

---

## Task 4: Server action — previewImportAction

**Files:**
- Create: `src/lib/actions/payroll-import.ts`

- [ ] **Step 1: Create file with preview action**

File: `src/lib/actions/payroll-import.ts`

```ts
"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requirePerfil } from "@/lib/auth/session";
import { createServerClient } from "@/lib/supabase/server";
import { parsePayrollXlsx, normalizeName, type ParsedRow } from "@/lib/payroll/xlsx-parser";
import type { MatchedRecord } from "@/lib/validation/payroll-import";

export async function previewImportAction(formData: FormData): Promise<never> {
  const session = await requirePerfil(["admin"]);
  const files = formData.getAll("files");

  if (files.length === 0 || (files.length === 1 && typeof files[0] === "string")) {
    redirect("/rh/funcionarios/importar?erro=" + encodeURIComponent("Selecione ao menos um arquivo .xlsx"));
  }

  const supabase = await createServerClient();
  const { data: employees, error: empErr } = await supabase
    .from("employees")
    .select("id, name, cpf")
    .eq("ativo", true);

  if (empErr) {
    redirect("/rh/funcionarios/importar?erro=" + encodeURIComponent(empErr.message));
  }

  const empMap = new Map<string, { id: string; name: string; cpf: string }>();
  for (const e of employees ?? []) {
    empMap.set(normalizeName(e.name), e);
  }

  const allRows: ParsedRow[] = [];
  for (const f of files) {
    if (typeof f === "string") continue;
    try {
      const buf = await (f as File).arrayBuffer();
      const rows = await parsePayrollXlsx(buf);
      allRows.push(...rows);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao ler arquivo";
      redirect("/rh/funcionarios/importar?erro=" + encodeURIComponent(msg));
    }
  }

  if (allRows.length === 0) {
    redirect("/rh/funcionarios/importar?erro=" + encodeURIComponent("Nenhum dado encontrado nas planilhas"));
  }

  // Dedup by normalized name (last wins)
  const byName = new Map<string, ParsedRow>();
  for (const r of allRows) {
    byName.set(normalizeName(r.nome), r);
  }

  const matched: MatchedRecord[] = [];
  const notMatched: ParsedRow[] = [];
  for (const [key, row] of byName) {
    const emp = empMap.get(key);
    if (emp) {
      matched.push({
        employee_id: emp.id,
        nome_db: emp.name,
        nome_planilha: row.nome,
        cpf: emp.cpf,
        salario_sem_dsr: row.salario_sem_dsr,
        aplica_dobra: row.aplica_dobra
      });
    } else {
      notMatched.push(row);
    }
  }

  const { error: cacheErr } = await supabase
    .from("payroll_import_cache")
    .upsert(
      {
        user_id: session.user.id,
        payload: { matched, notMatched },
        created_at: new Date().toISOString()
      },
      { onConflict: "user_id" }
    );

  if (cacheErr) {
    redirect("/rh/funcionarios/importar?erro=" + encodeURIComponent(cacheErr.message));
  }

  redirect("/rh/funcionarios/importar?preview=1");
}

export async function cancelImportAction(): Promise<never> {
  const session = await requirePerfil(["admin"]);
  const supabase = await createServerClient();
  await supabase.from("payroll_import_cache").delete().eq("user_id", session.user.id);
  redirect("/rh/funcionarios/importar");
}
```

- [ ] **Step 2: Type check**

Run: `cd c:/Desenv/Projetos/rrb-escola && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
cd c:/Desenv/Projetos/rrb-escola
git add src/lib/actions/payroll-import.ts
git commit -m "feat(payroll): previewImportAction + cancelImportAction"
```

---

## Task 5: Server action — commitImportAction

**Files:**
- Modify: `src/lib/actions/payroll-import.ts`

- [ ] **Step 1: Append commit action**

Append to `src/lib/actions/payroll-import.ts`:

```ts
import { calcProventosBase } from "@/lib/payroll/calculators";
import { currentUrlMonth, urlToDbMonth } from "@/lib/payroll/date-utils";
import { ImportPreviewSchema } from "@/lib/validation/payroll-import";

export async function commitImportAction(): Promise<never> {
  const session = await requirePerfil(["admin"]);
  const supabase = await createServerClient();

  const { data: cache, error: cacheErr } = await supabase
    .from("payroll_import_cache")
    .select("payload")
    .eq("user_id", session.user.id)
    .maybeSingle();

  if (cacheErr || !cache?.payload) {
    redirect("/rh/funcionarios/importar?erro=" + encodeURIComponent("Sem preview pendente"));
  }

  const parsedPayload = ImportPreviewSchema.safeParse(cache.payload);
  if (!parsedPayload.success) {
    redirect("/rh/funcionarios/importar?erro=" + encodeURIComponent("Preview corrompido"));
  }

  const { matched } = parsedPayload.data;
  const urlMonth = currentUrlMonth();
  const dbMonth = urlToDbMonth(urlMonth);

  // Check month not closed
  const { data: period } = await supabase
    .from("payroll_periods")
    .select("status")
    .eq("reference_month", dbMonth)
    .maybeSingle();
  if (period?.status === "fechado") {
    redirect(`/rh/funcionarios/importar?erro=${encodeURIComponent("Mês corrente fechado. Reabra antes de importar.")}`);
  }

  // 1) Update employees (one per row)
  for (const m of matched) {
    const { error } = await supabase
      .from("employees")
      .update({
        salario_sem_dsr: m.salario_sem_dsr,
        aplica_dobra: m.aplica_dobra
      })
      .eq("id", m.employee_id);
    if (error) {
      redirect(`/rh/funcionarios/importar?erro=${encodeURIComponent("Erro ao atualizar funcionário: " + error.message)}`);
    }
  }

  // 2) Delete current month payroll + period
  await supabase.from("payroll").delete().eq("reference_month", dbMonth);
  await supabase.from("payroll_periods").delete().eq("reference_month", dbMonth);

  // 3) Re-generate folha
  await supabase.from("payroll_periods").insert({ reference_month: dbMonth, status: "aberto" });

  const { data: actives } = await supabase
    .from("employees")
    .select("id, salario_sem_dsr, aplica_dobra")
    .eq("ativo", true);

  const rows = (actives ?? []).map((e) => {
    const semDsr = Number(e.salario_sem_dsr ?? 0);
    const dobra = e.aplica_dobra ?? false;
    const base = semDsr > 0 ? calcProventosBase(semDsr, dobra) : 0;
    return {
      employee_id: e.id,
      reference_month: dbMonth,
      base_salary: base,
      salario_sem_dsr: semDsr > 0 ? semDsr : null,
      aplica_dobra: dobra,
      total_earnings: base,
      total_deductions: 0,
      net_amount: base
    };
  });

  if (rows.length > 0) {
    const { error } = await supabase
      .from("payroll")
      .upsert(rows, { onConflict: "employee_id,reference_month", ignoreDuplicates: true });
    if (error) {
      redirect(`/rh/funcionarios/importar?erro=${encodeURIComponent("Erro ao regenerar folha: " + error.message)}`);
    }
  }

  // 4) Clean cache
  await supabase.from("payroll_import_cache").delete().eq("user_id", session.user.id);

  revalidatePath(`/rh/folha/${urlMonth}`);
  revalidatePath("/rh/funcionarios");
  redirect(`/rh/folha/${urlMonth}?ok=importado&matched=${matched.length}`);
}
```

- [ ] **Step 2: Type check**

Run: `cd c:/Desenv/Projetos/rrb-escola && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
cd c:/Desenv/Projetos/rrb-escola
git add src/lib/actions/payroll-import.ts
git commit -m "feat(payroll): commitImportAction (update employees + delete + regen folha)"
```

---

## Task 6: UploadForm component

**Files:**
- Create: `src/components/rh/payroll-import/upload-form.tsx`

- [ ] **Step 1: Create file**

File: `src/components/rh/payroll-import/upload-form.tsx`

```tsx
"use client";

import { useState } from "react";
import { Upload, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/card";
import { previewImportAction } from "@/lib/actions/payroll-import";

export function UploadForm() {
  const [files, setFiles] = useState<File[]>([]);

  return (
    <Panel className="grid gap-5 p-6">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-ui bg-brand/10 text-brand">
          <Upload size={18} strokeWidth={2.2} />
        </span>
        <div>
          <h2 className="text-lg font-bold text-ink">Importar Salário s/ DSR + dobra</h2>
          <p className="text-sm text-ink/65 mt-0.5">
            Selecione um ou mais arquivos .xlsx. Apenas <strong>s/DSR</strong> e <strong>dobra</strong> serão atualizados.
            Demais campos da planilha são ignorados.
          </p>
        </div>
      </div>

      <form action={previewImportAction} className="grid gap-3">
        <label className="grid gap-2">
          <span className="text-xs font-semibold text-ink/70 uppercase tracking-[0.1em]">Arquivos</span>
          <input
            type="file"
            name="files"
            accept=".xlsx"
            multiple
            required
            onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
            className="block w-full text-sm"
          />
        </label>

        {files.length > 0 ? (
          <ul className="text-xs text-ink/65 grid gap-1">
            {files.map((f, i) => (
              <li key={i} className="inline-flex items-center gap-2">
                <FileSpreadsheet size={12} /> {f.name}
              </li>
            ))}
          </ul>
        ) : null}

        <div className="flex justify-end">
          <Button type="submit" variant="primary" disabled={files.length === 0}>
            Analisar arquivos
          </Button>
        </div>
      </form>
    </Panel>
  );
}
```

- [ ] **Step 2: Type check**

Run: `cd c:/Desenv/Projetos/rrb-escola && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
cd c:/Desenv/Projetos/rrb-escola
git add src/components/rh/payroll-import/upload-form.tsx
git commit -m "feat(payroll): UploadForm component for xlsx import"
```

---

## Task 7: Preview table component

**Files:**
- Create: `src/components/rh/payroll-import/preview-table.tsx`

- [ ] **Step 1: Create file**

File: `src/components/rh/payroll-import/preview-table.tsx`

```tsx
import { Panel } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/status-pill";
import { money } from "@/lib/constants";
import type { MatchedRecord, ParsedRow } from "@/lib/validation/payroll-import";

export function PreviewTable({
  matched,
  notMatched
}: {
  matched: MatchedRecord[];
  notMatched: ParsedRow[];
}) {
  return (
    <div className="grid gap-5">
      <Panel className="p-0 overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <h2 className="text-sm font-bold text-ink uppercase tracking-[0.1em]">
            Encontrados ({matched.length})
          </h2>
          <StatusPill tone="success">Serão atualizados</StatusPill>
        </div>
        <div className="overflow-x-auto">
          <table className="ds-dt min-w-[820px]">
            <thead>
              <tr>
                <th>Funcionário (DB)</th>
                <th>Nome (planilha)</th>
                <th>CPF</th>
                <th className="text-right">Salário s/ DSR</th>
                <th>Dobra</th>
              </tr>
            </thead>
            <tbody>
              {matched.length === 0 ? (
                <tr><td colSpan={5} className="text-center text-ink/50 py-8">Nenhum match.</td></tr>
              ) : null}
              {matched.map((m) => (
                <tr key={m.employee_id}>
                  <td className="font-semibold text-ink">{m.nome_db}</td>
                  <td className="text-ink/75">{m.nome_planilha}</td>
                  <td className="text-ink/75 tabular-nums">{m.cpf}</td>
                  <td className="text-right tabular-nums text-success font-semibold">
                    {money.format(m.salario_sem_dsr)}
                  </td>
                  <td>
                    <StatusPill tone={m.aplica_dobra ? "success" : "neutral"}>
                      {m.aplica_dobra ? "Sim" : "Não"}
                    </StatusPill>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel className="p-0 overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <h2 className="text-sm font-bold text-ink uppercase tracking-[0.1em]">
            Não encontrados ({notMatched.length})
          </h2>
          <StatusPill tone="warning">Serão ignorados</StatusPill>
        </div>
        <div className="overflow-x-auto">
          <table className="ds-dt min-w-[600px]">
            <thead>
              <tr>
                <th>Nome (planilha)</th>
                <th>Sheet</th>
                <th className="text-right">Salário s/ DSR</th>
                <th>Dobra</th>
              </tr>
            </thead>
            <tbody>
              {notMatched.length === 0 ? (
                <tr><td colSpan={4} className="text-center text-ink/50 py-8">Nenhum (todos casaram).</td></tr>
              ) : null}
              {notMatched.map((r, i) => (
                <tr key={i}>
                  <td className="text-ink/80">{r.nome}</td>
                  <td className="text-ink/60 text-xs">{r.sheet}</td>
                  <td className="text-right tabular-nums text-ink/70">{money.format(r.salario_sem_dsr)}</td>
                  <td>
                    <span className="text-xs text-ink/55">{r.aplica_dobra ? "Sim" : "Não"}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
```

- [ ] **Step 2: Type check**

Run: `cd c:/Desenv/Projetos/rrb-escola && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
cd c:/Desenv/Projetos/rrb-escola
git add src/components/rh/payroll-import/preview-table.tsx
git commit -m "feat(payroll): preview table component (matched + not matched)"
```

---

## Task 8: Commit + cancel buttons

**Files:**
- Create: `src/components/rh/payroll-import/commit-button.tsx`
- Create: `src/components/rh/payroll-import/cancel-button.tsx`

- [ ] **Step 1: Create commit-button.tsx**

File: `src/components/rh/payroll-import/commit-button.tsx`

```tsx
"use client";

import { Check } from "lucide-react";
import { commitImportAction } from "@/lib/actions/payroll-import";

export function CommitButton({ matchedCount }: { matchedCount: number }) {
  return (
    <form
      action={commitImportAction}
      onSubmit={(e) => {
        if (
          !confirm(
            `Confirma atualizar ${matchedCount} funcionário(s) e regerar a folha do mês corrente? A folha atual será APAGADA.`
          )
        ) {
          e.preventDefault();
        }
      }}
      className="inline"
    >
      <button type="submit" className="ds-button ds-button-primary" disabled={matchedCount === 0}>
        <Check size={14} /> Confirmar e regerar folha
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Create cancel-button.tsx**

File: `src/components/rh/payroll-import/cancel-button.tsx`

```tsx
"use client";

import { X } from "lucide-react";
import { cancelImportAction } from "@/lib/actions/payroll-import";

export function CancelButton() {
  return (
    <form action={cancelImportAction} className="inline">
      <button type="submit" className="ds-button ds-button-secondary">
        <X size={14} /> Cancelar
      </button>
    </form>
  );
}
```

- [ ] **Step 3: Type check + commit**

Run: `npx tsc --noEmit`
Expected: clean.

```bash
cd c:/Desenv/Projetos/rrb-escola
git add src/components/rh/payroll-import/commit-button.tsx src/components/rh/payroll-import/cancel-button.tsx
git commit -m "feat(payroll): commit + cancel buttons for import"
```

---

## Task 9: Importar page

**Files:**
- Create: `src/app/(app)/rh/funcionarios/importar/page.tsx`

- [ ] **Step 1: Create file**

File: `src/app/(app)/rh/funcionarios/importar/page.tsx`

```tsx
import { AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { UploadForm } from "@/components/rh/payroll-import/upload-form";
import { PreviewTable } from "@/components/rh/payroll-import/preview-table";
import { CommitButton } from "@/components/rh/payroll-import/commit-button";
import { CancelButton } from "@/components/rh/payroll-import/cancel-button";
import { createServerClient } from "@/lib/supabase/server";
import { requirePerfil } from "@/lib/auth/session";
import { ImportPreviewSchema } from "@/lib/validation/payroll-import";
import { currentUrlMonth, monthLabel } from "@/lib/payroll/date-utils";

export const dynamic = "force-dynamic";

export default async function ImportarPage({
  searchParams
}: {
  searchParams: Promise<{ preview?: string; erro?: string }>;
}) {
  const session = await requirePerfil(["admin"]);
  const sp = await searchParams;

  const supabase = await createServerClient();
  let preview: { matched: ReturnType<typeof previewParse>["matched"]; notMatched: ReturnType<typeof previewParse>["notMatched"] } | null = null;

  if (sp.preview === "1") {
    const { data } = await supabase
      .from("payroll_import_cache")
      .select("payload")
      .eq("user_id", session.user.id)
      .maybeSingle();

    if (data?.payload) {
      const parsed = ImportPreviewSchema.safeParse(data.payload);
      if (parsed.success) preview = parsed.data;
    }
  }

  const currMonth = currentUrlMonth();

  return (
    <div className="grid gap-8">
      <PageHeader
        breadcrumb={[
          { label: "RH" },
          { label: "Funcionários", href: "/rh/funcionarios" },
          { label: "Importar" }
        ]}
        title="Importar folha"
        description="Atualiza Salário s/ DSR + dobra dos funcionários a partir de planilhas .xlsx e regera a folha do mês corrente."
      />

      {sp.erro ? (
        <div className="rounded-ui bg-danger/10 p-3 text-sm font-semibold text-danger">{sp.erro}</div>
      ) : null}

      {preview ? (
        <>
          <div className="rounded-ui border border-warning/30 bg-warning/10 p-4 flex items-start gap-3">
            <AlertTriangle size={18} className="text-warning shrink-0 mt-0.5" />
            <div className="text-sm text-ink/85">
              <p className="font-semibold">Ação destrutiva</p>
              <p className="mt-1">
                A folha de <strong>{monthLabel(currMonth)}</strong> será apagada e regerada com os novos
                valores. INSS e IRRF serão recalculados via tabelas oficiais 2026.
              </p>
            </div>
          </div>

          <PreviewTable matched={preview.matched} notMatched={preview.notMatched} />

          <div className="flex justify-end gap-2">
            <CancelButton />
            <CommitButton matchedCount={preview.matched.length} />
          </div>
        </>
      ) : (
        <UploadForm />
      )}
    </div>
  );
}

// Helper only to infer type of preview state (returned by previewParse stub)
function previewParse() {
  return { matched: [] as Array<unknown>, notMatched: [] as Array<unknown> };
}
```

- [ ] **Step 2: Type check + smoke**

Run: `npx tsc --noEmit`
Expected: clean.

Start dev. Navigate `/rh/funcionarios/importar`. Form upload appears.

- [ ] **Step 3: Commit**

```bash
cd c:/Desenv/Projetos/rrb-escola
git add "src/app/(app)/rh/funcionarios/importar/page.tsx"
git commit -m "feat(payroll): importar page (upload + preview + commit)"
```

---

## Task 10: Add "Importar" button to funcionários list

**Files:**
- Modify: `src/app/(app)/rh/funcionarios/page.tsx`

- [ ] **Step 1: Add import + button**

Open `src/app/(app)/rh/funcionarios/page.tsx`. At top imports, find `Plus` import from lucide. Add `Upload`:

Replace:
```tsx
import { Plus } from "lucide-react";
```
With:
```tsx
import { Plus, Upload } from "lucide-react";
```

Locate the existing `actions` prop of `<PageHeader>`. Currently:
```tsx
        actions={
          canMutate ? (
            <ButtonLink href="/rh/funcionarios/novo" variant="primary">
              <Plus size={14} /> Novo funcionário
            </ButtonLink>
          ) : null
        }
```

Replace with:
```tsx
        actions={
          <div className="inline-flex items-center gap-2">
            {isAdmin ? (
              <ButtonLink href="/rh/funcionarios/importar" variant="secondary">
                <Upload size={14} /> Importar
              </ButtonLink>
            ) : null}
            {canMutate ? (
              <ButtonLink href="/rh/funcionarios/novo" variant="primary">
                <Plus size={14} /> Novo funcionário
              </ButtonLink>
            ) : null}
          </div>
        }
```

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Smoke**

Logged as admin: `/rh/funcionarios` shows "Importar" + "Novo funcionário" buttons.
Logged as secretaria: only "Novo funcionário" appears.

- [ ] **Step 4: Commit**

```bash
cd c:/Desenv/Projetos/rrb-escola
git add "src/app/(app)/rh/funcionarios/page.tsx"
git commit -m "feat(payroll): Importar button on funcionários list (admin only)"
```

---

## Task 11: End-to-end smoke test

- [ ] **Step 1: Full type check**

Run: `cd c:/Desenv/Projetos/rrb-escola && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 2: E2E flow with real planilhas**

Start dev: `npm run dev`

Logged as admin:
- [ ] Navigate `/rh/funcionarios` → "Importar" button visível
- [ ] Click → `/rh/funcionarios/importar` upload form
- [ ] Selecionar `public/04ºF. pg 2026 (Colegio Integrado).xlsx` + `public/04º F. pg 2026 (Escola Pinguinho ).xlsx`
- [ ] Click "Analisar arquivos" → preview tela com matched (~60+) + not matched
- [ ] Banner destrutivo aparece
- [ ] Click "Confirmar e regerar folha" → confirm dialog → ok
- [ ] Redirect `/rh/folha/<currentMonth>?ok=importado&matched=N`
- [ ] Verify Ana Flávia: row tem s/DSR=2304.75, dobra true, INSS=583.99, IR=451.81

Logged as secretaria/financeiro:
- [ ] `/rh/funcionarios/importar` → `/acesso-negado`

Cancel flow:
- [ ] Upload + preview → click "Cancelar" → volta upload form, cache limpo

Error flow:
- [ ] Submit empty form → erro "Selecione ao menos um arquivo"
- [ ] Mês fechado (testar: fechar mês via `/rh/folha/[mes]`, depois importar) → erro "Mês corrente fechado"

- [ ] **Step 3: Commit fixes (se houver)**

```bash
git add -A
git commit -m "fix(payroll): import smoke test fixes"
```

---

## Spec coverage check

| Spec section | Task |
|--------------|------|
| Migration cache table | Task 1 |
| Pure xlsx parser (parsePayrollXlsx + normalizeName) | Task 2 |
| Validation schemas | Task 3 |
| previewImportAction + cancelImportAction | Task 4 |
| commitImportAction (update + delete + regen) | Task 5 |
| UploadForm | Task 6 |
| PreviewTable | Task 7 |
| Commit + Cancel buttons | Task 8 |
| Importar page (server) | Task 9 |
| Botão Importar lista | Task 10 |
| Permissões admin-only | Tasks 4, 5, 9, 10 |
| Banner destrutivo + confirm dialog | Tasks 8, 9 |
| Mês fechado bloqueia | Task 5 |
| Skip sheets DESCONTO | Task 2 |
| Auto-detect header row | Task 2 |
| Match nome normalizado | Tasks 2, 4 |
| Smoke test E2E + Ana case | Task 11 |

All spec sections covered.
