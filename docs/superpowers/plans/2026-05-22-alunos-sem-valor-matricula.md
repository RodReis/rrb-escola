# Alunos sem valor de matrícula — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Financeiro screen listing students with active 2026 enrollment that generate no normal matrícula revenue — incomplete registration (no plan / zero value) or scholarship/permuta/gratuita.

**Architecture:** A data function `getAlunosSemValor` queries Supabase (matriculas joined to alunos, planos, turmas/series, responsaveis_aluno) then filters in JS. Pure helpers (`deriveMotivo`, `isSemValor`, `buildRow`) are extracted so they are unit-testable without a Supabase mock. The page mirrors `relatorios/inadimplencia`: `PageHeader` + KPIs, a GET-form filter component, and `DataTableShell`. Excel export mirrors `export-month-buttons.tsx`.

**Tech Stack:** Next.js 14 App Router, Supabase (`createServerClient`), TypeScript, Vitest (node env), exceljs, lucide-react.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/lib/data/alunos-sem-valor.ts` (create) | Types + pure helpers (`deriveMotivo`, `isSemValor`, `buildRow`, `motivoTone`, `MOTIVO_LABEL`) + async `getAlunosSemValor`. |
| `src/lib/data/alunos-sem-valor.test.ts` (create) | Unit tests for pure helpers. |
| `src/components/finance/alunos-sem-valor-filters.tsx` (create) | Client GET-form: nome + motivo + série + turma. |
| `src/components/finance/export-alunos-sem-valor-button.tsx` (create) | Client component: Excel export. |
| `src/app/(app)/financeiro/alunos-sem-valor/page.tsx` (create) | Server component: permission, data fetch, render. |
| `src/components/layout/dropdown-icons.tsx` (modify) | Register `AlertTriangle` in imports + `ICON_MAP`. |
| `src/components/layout/topbar.tsx` (modify) | Add item to `FINANCEIRO_ITEMS`. |

---

## Task 1: Types and pure helpers

**Files:**
- Create: `src/lib/data/alunos-sem-valor.ts`
- Test: `src/lib/data/alunos-sem-valor.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/data/alunos-sem-valor.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { deriveMotivo, isSemValor, buildRow, type RawMatricula } from "./alunos-sem-valor";

describe("isSemValor", () => {
  it("true when plano_id is null", () => {
    expect(isSemValor(null, null)).toBe(true);
  });
  it("true when valor_matricula is 0", () => {
    expect(isSemValor("plan-1", 0)).toBe(true);
  });
  it("true when valor_matricula is null", () => {
    expect(isSemValor("plan-1", null)).toBe(true);
  });
  it("false when plano with valor_matricula > 0", () => {
    expect(isSemValor("plan-1", 250)).toBe(false);
  });
});

describe("deriveMotivo", () => {
  it("paga + no plano -> sem_valor", () => {
    expect(deriveMotivo("paga", null, null)).toBe("sem_valor");
  });
  it("paga + plano valor 0 -> sem_valor", () => {
    expect(deriveMotivo("paga", "plan-1", 0)).toBe("sem_valor");
  });
  it("bolsa_integral + valid plano -> bolsa_integral (tipo_vaga wins)", () => {
    expect(deriveMotivo("bolsa_integral", "plan-1", 250)).toBe("bolsa_integral");
  });
  it("bolsa_integral + no plano -> bolsa_integral (tipo_vaga wins over sem_valor)", () => {
    expect(deriveMotivo("bolsa_integral", null, null)).toBe("bolsa_integral");
  });
  it("permuta -> permuta", () => {
    expect(deriveMotivo("permuta", "plan-1", 250)).toBe("permuta");
  });
  it("gratuita -> gratuita", () => {
    expect(deriveMotivo("gratuita", "plan-1", 250)).toBe("gratuita");
  });
  it("paga + valid plano -> null (not included)", () => {
    expect(deriveMotivo("paga", "plan-1", 250)).toBeNull();
  });
});

describe("buildRow", () => {
  const raw: RawMatricula = {
    id: "m1",
    tipo_vaga: "paga",
    plano_id: null,
    alunos: { id: "a1", nome: "JOÃO SILVA" },
    planos: null,
    turmas: { id: "t1", nome: "A", series: { id: "s1", nome: "1º Ano", ordem: 1 } },
    responsaveis_aluno: [
      { nome: "Maria", parentesco: "mãe", telefone: "", celular: "62999990000", responsavel_financeiro: false },
      { nome: "Carlos", parentesco: "pai", telefone: "62888880000", celular: "", responsavel_financeiro: true },
    ],
  };

  it("derives fields and includes the row", () => {
    const row = buildRow(raw);
    expect(row).not.toBeNull();
    expect(row!.nome).toBe("JOÃO SILVA");
    expect(row!.serie).toBe("1º Ano");
    expect(row!.turma).toBe("A");
    expect(row!.motivo).toBe("sem_valor");
    expect(row!.valorMatricula).toBe(0);
  });

  it("orders responsavel_financeiro first and uses celular||telefone", () => {
    const row = buildRow(raw);
    expect(row!.responsaveis[0].nome).toBe("Carlos");
    expect(row!.responsaveis[0].telefone).toBe("62888880000");
    expect(row!.responsaveis[1].nome).toBe("Maria");
    expect(row!.responsaveis[1].telefone).toBe("62999990000");
  });

  it("returns null for a paga matricula with valid plano", () => {
    const ok: RawMatricula = { ...raw, plano_id: "p1", planos: { valor_matricula: 250 } };
    expect(buildRow(ok)).toBeNull();
  });

  it("handles a student with no responsaveis", () => {
    const noResp: RawMatricula = { ...raw, responsaveis_aluno: [] };
    expect(buildRow(noResp)!.responsaveis).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/data/alunos-sem-valor.test.ts`
Expected: FAIL — `Cannot find module './alunos-sem-valor'` or exports undefined.

- [ ] **Step 3: Write types and pure helpers**

Create `src/lib/data/alunos-sem-valor.ts`:

```typescript
import "server-only";
import { createServerClient } from "@/lib/supabase/server";
import { DEFAULT_SCHOOL_ID } from "@/lib/constants";

export type TipoVaga = "paga" | "bolsa_integral" | "bolsa_parcial" | "permuta" | "gratuita";

export type MotivoSemValor =
  | "sem_valor"
  | "bolsa_integral"
  | "bolsa_parcial"
  | "permuta"
  | "gratuita";

export type RawResponsavel = {
  nome: string;
  parentesco: string | null;
  telefone: string | null;
  celular: string | null;
  responsavel_financeiro: boolean;
};

export type RawMatricula = {
  id: string;
  tipo_vaga: TipoVaga;
  plano_id: string | null;
  alunos: { id: string; nome: string } | null;
  planos: { valor_matricula: number | null } | null;
  turmas: {
    id: string;
    nome: string;
    series: { id: string; nome: string; ordem: number } | null;
  } | null;
  responsaveis_aluno: RawResponsavel[];
};

export type ResponsavelRow = {
  nome: string;
  parentesco: string | null;
  telefone: string;
};

export type AlunoSemValorRow = {
  matriculaId: string;
  nome: string;
  serie: string;
  serieOrdem: number;
  turma: string;
  motivo: MotivoSemValor;
  valorMatricula: number;
  responsaveis: ResponsavelRow[];
};

export type AlunosSemValorFilters = {
  nome: string | null;
  motivo: MotivoSemValor | null;
  serieId: string | null;
  turmaId: string | null;
};

export const MOTIVO_LABEL: Record<MotivoSemValor, string> = {
  sem_valor: "Sem valor",
  bolsa_integral: "Bolsa integral",
  bolsa_parcial: "Bolsa parcial",
  permuta: "Permuta",
  gratuita: "Gratuita",
};

export function motivoTone(motivo: MotivoSemValor): "danger" | "warning" | "neutral" {
  if (motivo === "sem_valor") return "danger";
  if (motivo === "bolsa_integral" || motivo === "bolsa_parcial") return "warning";
  return "neutral";
}

/** True when the matrícula has no defined value: no plan, or plan value is 0/null. */
export function isSemValor(planoId: string | null, valorMatricula: number | null): boolean {
  if (!planoId) return true;
  return !valorMatricula || valorMatricula <= 0;
}

/**
 * Returns the Motivo for a matrícula, or null if it should NOT appear in the grid.
 * Precedence: tipo_vaga (non-paga) wins over sem_valor — a scholarship without a
 * plan is expected, not a registration error.
 */
export function deriveMotivo(
  tipoVaga: TipoVaga,
  planoId: string | null,
  valorMatricula: number | null
): MotivoSemValor | null {
  if (tipoVaga !== "paga") return tipoVaga;
  if (isSemValor(planoId, valorMatricula)) return "sem_valor";
  return null;
}

/** Builds an AlunoSemValorRow from a raw joined matrícula, or null if it should not appear. */
export function buildRow(raw: RawMatricula): AlunoSemValorRow | null {
  const valor = raw.planos?.valor_matricula ?? null;
  const motivo = deriveMotivo(raw.tipo_vaga, raw.plano_id, valor);
  if (!motivo) return null;

  const responsaveis: ResponsavelRow[] = [...raw.responsaveis_aluno]
    .sort((a, b) => Number(b.responsavel_financeiro) - Number(a.responsavel_financeiro))
    .map((r) => ({
      nome: r.nome,
      parentesco: r.parentesco,
      telefone: r.celular || r.telefone || "",
    }));

  return {
    matriculaId: raw.id,
    nome: raw.alunos?.nome ?? "—",
    serie: raw.turmas?.series?.nome ?? "—",
    serieOrdem: raw.turmas?.series?.ordem ?? 9999,
    turma: raw.turmas?.nome ?? "—",
    motivo,
    valorMatricula: valor ?? 0,
    responsaveis,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/data/alunos-sem-valor.test.ts`
Expected: PASS — all `isSemValor`, `deriveMotivo`, `buildRow` tests green.

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: no errors. If `@/lib/supabase/server` or `DEFAULT_SCHOOL_ID` import path is wrong, fix by matching the import used at the top of `src/lib/data/finance.ts`.

- [ ] **Step 6: Commit**

```bash
git add src/lib/data/alunos-sem-valor.ts src/lib/data/alunos-sem-valor.test.ts
git commit -m "feat(financeiro): pure helpers for alunos sem valor de matricula"
```

---

## Task 2: getAlunosSemValor query function

**Files:**
- Modify: `src/lib/data/alunos-sem-valor.ts` (append the async function)

This task adds the Supabase query. It is not unit-tested (integration boundary); the pure logic it relies on is already covered by Task 1.

- [ ] **Step 1: Append `getAlunosSemValor` to `src/lib/data/alunos-sem-valor.ts`**

Add at the end of the file:

```typescript
/**
 * Fetches active 2026 matrículas that have no normal matrícula value
 * (incomplete registration) or are non-paying (scholarship/permuta/gratuita).
 * Sorted by série order, then student name.
 */
export async function getAlunosSemValor(
  filters: AlunosSemValorFilters
): Promise<AlunoSemValorRow[]> {
  const supabase = await createServerClient();

  let query = supabase
    .from("matriculas")
    .select(`
      id, tipo_vaga, plano_id,
      alunos!inner(id, nome),
      planos(valor_matricula),
      turmas!inner(id, nome, serie_id, series!inner(id, nome, ordem)),
      responsaveis_aluno:alunos!inner(responsaveis_aluno(nome, parentesco, telefone, celular, responsavel_financeiro))
    `)
    .eq("escola_id", DEFAULT_SCHOOL_ID)
    .eq("ano_letivo", 2026)
    .eq("status", "ativa");

  if (filters.nome) {
    query = query.ilike("alunos.nome", `%${filters.nome}%`);
  }
  if (filters.serieId) {
    query = query.eq("turmas.serie_id", filters.serieId);
  }
  if (filters.turmaId) {
    query = query.eq("turma_id", filters.turmaId);
  }

  const { data, error } = await query;
  if (error) throw error;

  const rows: AlunoSemValorRow[] = [];
  for (const item of data ?? []) {
    // responsaveis_aluno is nested under alunos in the join; normalize it.
    const alunoNode = (item as Record<string, unknown>).alunos as
      | { id: string; nome: string; responsaveis_aluno?: RawResponsavel[] }
      | null;
    const raw: RawMatricula = {
      id: (item as { id: string }).id,
      tipo_vaga: (item as { tipo_vaga: TipoVaga }).tipo_vaga,
      plano_id: (item as { plano_id: string | null }).plano_id,
      alunos: alunoNode ? { id: alunoNode.id, nome: alunoNode.nome } : null,
      planos: (item as { planos: { valor_matricula: number | null } | null }).planos,
      turmas: (item as { turmas: RawMatricula["turmas"] }).turmas,
      responsaveis_aluno: alunoNode?.responsaveis_aluno ?? [],
    };
    const row = buildRow(raw);
    if (!row) continue;
    if (filters.motivo && row.motivo !== filters.motivo) continue;
    rows.push(row);
  }

  rows.sort(
    (a, b) => a.serieOrdem - b.serieOrdem || a.nome.localeCompare(b.nome, "pt-BR")
  );
  return rows;
}
```

> **Note on the responsaveis join:** Supabase nests `responsaveis_aluno` under
> `alunos` because the FK is `responsaveis_aluno.aluno_id → alunos.id`. If at
> runtime the select string above produces a Supabase error about the embedded
> resource, simplify the select to embed responsaveis via the alunos relation:
> `alunos!inner(id, nome, responsaveis_aluno(nome, parentesco, telefone, celular, responsavel_financeiro))`
> and drop the separate `responsaveis_aluno:` alias line. The normalization
> code already reads `alunoNode.responsaveis_aluno`, so only the select string
> changes.

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Run existing tests (no regression)**

Run: `npm test -- src/lib/data/alunos-sem-valor.test.ts`
Expected: PASS — Task 1 tests still green.

- [ ] **Step 4: Commit**

```bash
git add src/lib/data/alunos-sem-valor.ts
git commit -m "feat(financeiro): getAlunosSemValor query function"
```

---

## Task 3: Register AlertTriangle icon

**Files:**
- Modify: `src/components/layout/dropdown-icons.tsx`

- [ ] **Step 1: Add the import**

In `src/components/layout/dropdown-icons.tsx`, add `AlertTriangle,` to the
lucide-react import block (alphabetical — right after `AlertCircle,`):

```typescript
import {
  AlertCircle,
  AlertTriangle,
  BarChart3,
```

- [ ] **Step 2: Add to ICON_MAP**

In the same file, add `AlertTriangle,` to the `ICON_MAP` object (right after `AlertCircle,`):

```typescript
export const ICON_MAP: Record<string, LucideIcon> = {
  AlertCircle,
  AlertTriangle,
  BarChart3,
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/dropdown-icons.tsx
git commit -m "feat(layout): register AlertTriangle dropdown icon"
```

---

## Task 4: Filters component

**Files:**
- Create: `src/components/finance/alunos-sem-valor-filters.tsx`

Mirrors the GET-form pattern of `src/components/finance/delinquency-filters.tsx`.
The series/turma options are passed in from the page (server component owns the data).

- [ ] **Step 1: Create the component**

Create `src/components/finance/alunos-sem-valor-filters.tsx`:

```tsx
import { Search } from "lucide-react";
import { MOTIVO_LABEL, type MotivoSemValor } from "@/lib/data/alunos-sem-valor";

type Option = { id: string; nome: string };

type Props = {
  defaults: {
    nome: string;
    motivo: string;
    serieId: string;
    turmaId: string;
  };
  series: Option[];
  turmas: Option[];
};

const MOTIVOS = Object.keys(MOTIVO_LABEL) as MotivoSemValor[];

export function AlunosSemValorFilters({ defaults, series, turmas }: Props) {
  return (
    <form
      method="GET"
      className="grid gap-3 rounded-ui border border-line bg-muted/30 p-4 md:grid-cols-[1fr_180px_180px_180px_120px] items-end"
    >
      <label className="relative">
        Aluno
        <Search size={14} className="absolute left-3 bottom-3 text-ink/40" />
        <input
          name="nome"
          placeholder="Nome do aluno"
          defaultValue={defaults.nome}
          className="pl-9"
        />
      </label>
      <label>
        Motivo
        <select name="motivo" defaultValue={defaults.motivo}>
          <option value="">Todos</option>
          {MOTIVOS.map((m) => (
            <option key={m} value={m}>
              {MOTIVO_LABEL[m]}
            </option>
          ))}
        </select>
      </label>
      <label>
        Série
        <select name="serie" defaultValue={defaults.serieId}>
          <option value="">Todas</option>
          {series.map((s) => (
            <option key={s.id} value={s.id}>
              {s.nome}
            </option>
          ))}
        </select>
      </label>
      <label>
        Turma
        <select name="turma" defaultValue={defaults.turmaId}>
          <option value="">Todas</option>
          {turmas.map((t) => (
            <option key={t.id} value={t.id}>
              {t.nome}
            </option>
          ))}
        </select>
      </label>
      <button className="ds-button ds-button-primary" type="submit">
        Filtrar
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/finance/alunos-sem-valor-filters.tsx
git commit -m "feat(financeiro): alunos sem valor filters component"
```

---

## Task 5: Excel export button

**Files:**
- Create: `src/components/finance/export-alunos-sem-valor-button.tsx`

Mirrors `handleXlsx` in `src/components/rh/payroll/export-month-buttons.tsx`.
Output is flat — one row per aluno×responsável; a student with no responsável
yields one row with empty responsável columns.

- [ ] **Step 1: Create the component**

Create `src/components/finance/export-alunos-sem-valor-button.tsx`:

```tsx
"use client";

import { FileSpreadsheet } from "lucide-react";
import ExcelJS from "exceljs";
import { MOTIVO_LABEL, type AlunoSemValorRow } from "@/lib/data/alunos-sem-valor";

export function ExportAlunosSemValorButton({ rows }: { rows: AlunoSemValorRow[] }) {
  const handleXlsx = async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Alunos sem valor");
    ws.columns = [
      { header: "Aluno", key: "aluno", width: 32 },
      { header: "Série", key: "serie", width: 16 },
      { header: "Turma", key: "turma", width: 10 },
      { header: "Motivo", key: "motivo", width: 16 },
      { header: "Valor matrícula", key: "valor", width: 16 },
      { header: "Responsável", key: "responsavel", width: 28 },
      { header: "Parentesco", key: "parentesco", width: 14 },
      { header: "Telefone", key: "telefone", width: 18 },
    ];

    for (const r of rows) {
      const base = {
        aluno: r.nome,
        serie: r.serie,
        turma: r.turma,
        motivo: MOTIVO_LABEL[r.motivo],
        valor: r.valorMatricula,
      };
      if (r.responsaveis.length === 0) {
        ws.addRow({ ...base, responsavel: "", parentesco: "", telefone: "" });
      } else {
        for (const resp of r.responsaveis) {
          ws.addRow({
            ...base,
            responsavel: resp.nome,
            parentesco: resp.parentesco ?? "",
            telefone: resp.telefone,
          });
        }
      }
    }

    ws.getRow(1).font = { bold: true };
    ws.getColumn("valor").numFmt = '"R$ "#,##0.00';

    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "alunos_sem_valor_2026.xlsx";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <button type="button" onClick={handleXlsx} className="ds-button ds-button-secondary">
      <FileSpreadsheet size={14} /> Exportar XLSX
    </button>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/finance/export-alunos-sem-valor-button.tsx
git commit -m "feat(financeiro): excel export for alunos sem valor"
```

---

## Task 6: Page

**Files:**
- Create: `src/app/(app)/financeiro/alunos-sem-valor/page.tsx`

- [ ] **Step 1: Create the page**

Create `src/app/(app)/financeiro/alunos-sem-valor/page.tsx`:

```tsx
import { AlertTriangle, Users } from "lucide-react";
import { Panel } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { DataTableShell } from "@/components/ui/data-table";
import { StatusPill } from "@/components/ui/status-pill";
import { AlunosSemValorFilters } from "@/components/finance/alunos-sem-valor-filters";
import { ExportAlunosSemValorButton } from "@/components/finance/export-alunos-sem-valor-button";
import {
  getAlunosSemValor,
  MOTIVO_LABEL,
  motivoTone,
  type AlunosSemValorFilters as Filters,
  type MotivoSemValor,
} from "@/lib/data/alunos-sem-valor";
import { getAcademicData } from "@/lib/data/lookups";
import { money } from "@/lib/constants";
import { requirePermission } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

const VALID_MOTIVOS = Object.keys(MOTIVO_LABEL) as MotivoSemValor[];

function parseFilters(sp: {
  nome?: string;
  motivo?: string;
  serie?: string;
  turma?: string;
}): Filters {
  const motivo =
    sp.motivo && VALID_MOTIVOS.includes(sp.motivo as MotivoSemValor)
      ? (sp.motivo as MotivoSemValor)
      : null;
  return {
    nome: sp.nome?.trim() || null,
    motivo,
    serieId: sp.serie || null,
    turmaId: sp.turma || null,
  };
}

export default async function AlunosSemValorPage({
  searchParams,
}: {
  searchParams: { nome?: string; motivo?: string; serie?: string; turma?: string };
}) {
  await requirePermission("relatorios", "read");

  const filters = parseFilters(searchParams);
  const [rows, academic] = await Promise.all([
    getAlunosSemValor(filters),
    getAcademicData(),
  ]);

  const semValor = rows.filter((r) => r.motivo === "sem_valor").length;
  const bolsistas = rows.filter(
    (r) => r.motivo === "bolsa_integral" || r.motivo === "bolsa_parcial"
  ).length;
  const permutaGratuita = rows.filter(
    (r) => r.motivo === "permuta" || r.motivo === "gratuita"
  ).length;

  return (
    <div className="grid gap-8">
      <PageHeader
        breadcrumb={[{ label: "Financeiro", href: "/financeiro" }, { label: "Alunos sem valor" }]}
        title="Alunos sem valor de matrícula"
        description="Matrículas ativas de 2026 sem valor de matrícula definido ou com vaga não-pagante."
        actions={<ExportAlunosSemValorButton rows={rows} />}
        kpis={[
          { label: "Total", value: rows.length.toLocaleString("pt-BR") },
          { label: "Sem valor", value: semValor.toLocaleString("pt-BR"), tone: "danger" },
          { label: "Bolsistas", value: bolsistas.toLocaleString("pt-BR"), tone: "warning" },
          { label: "Permuta/Gratuita", value: permutaGratuita.toLocaleString("pt-BR") },
        ]}
      />

      <AlunosSemValorFilters
        defaults={{
          nome: filters.nome ?? "",
          motivo: filters.motivo ?? "",
          serieId: filters.serieId ?? "",
          turmaId: filters.turmaId ?? "",
        }}
        series={academic.series.map((s) => ({ id: s.id, nome: s.nome }))}
        turmas={academic.turmas.map((t) => ({ id: t.id, nome: t.nome }))}
      />

      {rows.length === 0 ? (
        <Panel>
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-ink/40">
            <AlertTriangle size={28} />
            <p className="text-sm font-medium">Nenhum aluno sem valor encontrado.</p>
          </div>
        </Panel>
      ) : (
        <DataTableShell>
          <table className="ds-dt min-w-[880px]">
            <thead>
              <tr>
                <th>Aluno</th>
                <th>Série</th>
                <th>Turma</th>
                <th>Motivo</th>
                <th>Responsáveis</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.matriculaId}>
                  <td className="font-semibold text-ink">{r.nome}</td>
                  <td>{r.serie}</td>
                  <td>{r.turma}</td>
                  <td>
                    <StatusPill tone={motivoTone(r.motivo)}>
                      {MOTIVO_LABEL[r.motivo]}
                    </StatusPill>
                  </td>
                  <td>
                    {r.responsaveis.length === 0 ? (
                      <span className="text-ink/40">—</span>
                    ) : (
                      <div className="grid gap-1">
                        {r.responsaveis.map((resp, idx) => (
                          <div key={idx} className="text-sm">
                            <span className="font-medium text-ink">{resp.nome}</span>
                            {resp.parentesco ? (
                              <span className="text-ink/50"> ({resp.parentesco})</span>
                            ) : null}
                            {resp.telefone ? (
                              <span className="text-ink/60"> · {resp.telefone}</span>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataTableShell>
      )}
    </div>
  );
}
```

> **Verify before finishing this step:** open `src/app/(app)/relatorios/inadimplencia/page.tsx`
> and confirm the `PageHeader` props (`breadcrumb`, `kpis`, `actions`,
> `description`) and the `DataTableShell` / `ds-dt` table markup match what is
> used here. If the project's `PageHeader` API differs, adjust to match the
> real signature — do not invent props.

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Build check**

Run: `npm run build`
Expected: build succeeds; route `/financeiro/alunos-sem-valor` listed in output.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/financeiro/alunos-sem-valor/page.tsx"
git commit -m "feat(financeiro): alunos sem valor page"
```

---

## Task 7: Add menu item

**Files:**
- Modify: `src/components/layout/topbar.tsx`

- [ ] **Step 1: Add the item to FINANCEIRO_ITEMS**

In `src/components/layout/topbar.tsx`, find the `FINANCEIRO_ITEMS` array and
add the new item after `{ href: "/financeiro", ... }`:

```typescript
const FINANCEIRO_ITEMS: DropdownItem[] = [
  { href: "/financeiro", label: "Financeiro", iconName: "BarChart3" },
  { href: "/financeiro/alunos-sem-valor", label: "Alunos sem valor", iconName: "AlertTriangle" },
  { href: "/financeiro/folha", label: "Folha de Pgto.", iconName: "Wallet" },
  { href: "/despesas", label: "Despesas", iconName: "Receipt" },
  { href: "/valores-praticados", label: "Valores praticados", iconName: "ReceiptText" },
  { href: "/planos", label: "Planos", iconName: "CreditCard" },
];
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Verify the menu uses the correct permission**

The dropdown is permission-filtered by `filterByPermissions(FINANCEIRO_ITEMS, ...)`.
Check how `filterByPermissions` maps an item `href` to a permission. The page
itself enforces `requirePermission("relatorios", "read")`. If `filterByPermissions`
keys off a per-item permission field rather than the href, add whatever field the
existing items use (e.g. a `permission` key) set to the value matching `relatorios`.
If it filters purely by href prefix or shows all financeiro items to anyone with
financeiro access, no extra field is needed — leave the item as-is.

Expected: the item appears in the Financeiro dropdown for a user with `relatorios` read access; the page is reachable.

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/topbar.tsx
git commit -m "feat(layout): add Alunos sem valor to Financeiro menu"
```

---

## Task 8: Final verification

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: PASS — including `src/lib/data/alunos-sem-valor.test.ts`.

- [ ] **Step 2: Typecheck and build**

Run: `npm run typecheck && npm run build`
Expected: both succeed.

- [ ] **Step 3: Manual smoke test**

Run `npm run dev`, log in, open the Financeiro menu → "Alunos sem valor". Verify:
- KPIs show non-zero counts (assuming data with scholarships/missing plans exists).
- Filters (nome, motivo, série, turma) narrow the grid via GET form submit.
- "Exportar XLSX" downloads `alunos_sem_valor_2026.xlsx` with the 8 columns.
- A bolsista without a plan shows motivo as the scholarship type, not "Sem valor".

---

## Self-Review

**Spec coverage:**
- "Sem valor" rule (no plan OR value 0) → Task 1 `isSemValor` + tests. ✓
- Bolsista rule (tipo_vaga ≠ paga) → Task 1 `deriveMotivo` + tests. ✓
- Single grid + Motivo column with precedence → Task 1 `deriveMotivo`, Task 6 grid. ✓
- Scope active/2026 → Task 2 query `.eq("ano_letivo", 2026).eq("status", "ativa")`. ✓
- Filters nome/motivo/série/turma → Task 4 component, Task 2 query + JS filter, Task 6 parse. ✓
- Excel export → Task 5. ✓
- Permission `relatorios` → Task 6 `requirePermission`. ✓
- Data approach: TS fn + JS filter, no migration → Tasks 1–2. ✓
- Menu item in Financeiro → Tasks 3 + 7. ✓
- Edge cases (no responsável, plano_id null) → Task 1 tests, Task 6 "—" render. ✓

**Placeholder scan:** No TBD/TODO; all code blocks complete. Two steps (Task 2 join note, Task 6/7 verify notes) instruct verifying against real APIs rather than guessing — intentional, since the exact Supabase nested-select syntax and `filterByPermissions`/`PageHeader` signatures must match the live codebase.

**Type consistency:** `RawMatricula`, `AlunoSemValorRow`, `MotivoSemValor`, `AlunosSemValorFilters`, `MOTIVO_LABEL`, `motivoTone`, `deriveMotivo`, `isSemValor`, `buildRow`, `getAlunosSemValor` — names consistent across Tasks 1, 2, 4, 5, 6.
