# Aba "Alunos com desconto" — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a second tab to `/financeiro/alunos-sem-valor` that lists active 2026 students whose monthly tuition is below the official practiced value (because the plan undercharges or `tipo_vaga = bolsa_parcial`), excluding students who pay the official sibling price.

**Architecture:** A new pure function `buildDescontoRow` decides inclusion and computes the discount %, separated from a thin Supabase query function. The page reads `?aba=...` and dispatches between the existing "Sem valor" view and the new "Com desconto" view. URL-driven tabs follow the existing `dashboard-tabs.tsx` Link-based pattern. No migration.

**Tech Stack:** Next.js 14 App Router, Supabase (`createServerClient`), TypeScript, Vitest (node env), exceljs, lucide-react.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/lib/data/alunos-com-desconto.ts` (create) | Types + pure `buildDescontoRow` + async `getAlunosComDesconto`. |
| `src/lib/data/alunos-com-desconto.test.ts` (create) | Unit tests for `buildDescontoRow`. |
| `src/components/finance/alunos-tabs.tsx` (create) | `[Sem valor][Com desconto]` tabs linked by `?aba=...`. |
| `src/components/finance/alunos-com-desconto-filters.tsx` (create) | GET-form filters: nome, série, turma. |
| `src/components/finance/export-alunos-com-desconto-button.tsx` (create) | Excel export. |
| `src/app/(app)/financeiro/alunos-sem-valor/page.tsx` (modify) | Read `?aba`. Render tabs. When `aba=com-desconto`: swap data fn, KPIs, filters, columns, export; no edit button. |

---

## Task 1: Pure types + `buildDescontoRow` + tests

**Files:**
- Create: `src/lib/data/alunos-com-desconto.ts`
- Test: `src/lib/data/alunos-com-desconto.test.ts`

This task creates the pure logic only — no Supabase query yet.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/data/alunos-com-desconto.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { buildDescontoRow, type RawMatricula } from "./alunos-com-desconto";

const respFin = {
  nome: "Maria",
  parentesco: "mãe",
  telefone: "",
  celular: "62999990000",
  responsavel_financeiro: true,
};

function baseRaw(overrides: Partial<RawMatricula> = {}): RawMatricula {
  return {
    id: "m1",
    tipo_vaga: "paga",
    percentual_bolsa: 0,
    alunos: { id: "a1", nome: "JOÃO SILVA", responsaveis_aluno: [respFin] },
    series: { id: "s1", nome: "5º Ano", ordem: 5, segmento: "FUNDAMENTAL1" },
    turmas: { id: "t1", nome: "A" },
    planos: { valor_mensalidade: 690 },
    ...overrides,
  };
}

// valoresSeg shape: [ordem_filho=1, ordem_filho=2, ordem_filho=3]
// Using FUNDAMENTAL1 2026 reference: 745 / 690 / 650.
const FUND1 = [745, 690, 650];

describe("buildDescontoRow — exclusions", () => {
  it("paga + plano matches valor cheio (ordem 1) -> null", () => {
    expect(buildDescontoRow(baseRaw({ planos: { valor_mensalidade: 745 } }), FUND1)).toBeNull();
  });
  it("paga + plano matches valor irmão 2 (ordem 2) -> null", () => {
    expect(buildDescontoRow(baseRaw({ planos: { valor_mensalidade: 690 } }), FUND1)).toBeNull();
  });
  it("paga + plano matches valor irmão 3 (ordem 3) -> null", () => {
    expect(buildDescontoRow(baseRaw({ planos: { valor_mensalidade: 650 } }), FUND1)).toBeNull();
  });
  it("paga + plano > cheio -> null (no discount)", () => {
    expect(buildDescontoRow(baseRaw({ planos: { valor_mensalidade: 800 } }), FUND1)).toBeNull();
  });
  it("no plano -> null", () => {
    expect(buildDescontoRow(baseRaw({ planos: null }), FUND1)).toBeNull();
  });
  it("no segmento -> null", () => {
    const raw = baseRaw({
      series: { id: "s1", nome: "5º Ano", ordem: 5, segmento: null },
    });
    expect(buildDescontoRow(raw, FUND1)).toBeNull();
  });
  it("empty valoresSeg -> null", () => {
    expect(buildDescontoRow(baseRaw(), [])).toBeNull();
  });
});

describe("buildDescontoRow — inclusions", () => {
  it("paga + plano below min sibling -> origem 'plano'", () => {
    const row = buildDescontoRow(baseRaw({ planos: { valor_mensalidade: 600 } }), FUND1);
    expect(row).not.toBeNull();
    expect(row!.origem).toBe("plano");
    expect(row!.valorPraticadoCheio).toBe(745);
    expect(row!.valorMensalidadePlano).toBe(600);
    expect(row!.percentualBolsaParcial).toBe(0);
    // efetivo % = 1 - 600/745 ≈ 0.1946...
    expect(row!.percentualDescontoEfetivo).toBeCloseTo(1 - 600 / 745, 4);
  });

  it("bolsa_parcial 50% + plano cheio -> origem 'bolsa_parcial', % ~ 0.5", () => {
    const raw = baseRaw({
      tipo_vaga: "bolsa_parcial",
      percentual_bolsa: 50,
      planos: { valor_mensalidade: 745 },
    });
    const row = buildDescontoRow(raw, FUND1);
    expect(row).not.toBeNull();
    expect(row!.origem).toBe("bolsa_parcial");
    expect(row!.percentualBolsaParcial).toBe(50);
    expect(row!.percentualDescontoEfetivo).toBeCloseTo(0.5, 4);
  });

  it("bolsa_parcial 30% + plano abaixo do menor irmão -> origem 'plano+bolsa'", () => {
    const raw = baseRaw({
      tipo_vaga: "bolsa_parcial",
      percentual_bolsa: 30,
      planos: { valor_mensalidade: 600 },
    });
    const row = buildDescontoRow(raw, FUND1);
    expect(row).not.toBeNull();
    expect(row!.origem).toBe("plano+bolsa");
    // efetivo = 600 * 0.7 = 420; % = 1 - 420/745 ≈ 0.4362
    expect(row!.percentualDescontoEfetivo).toBeCloseTo(1 - 420 / 745, 4);
  });

  it("bolsa_parcial with plan that matches sibling 2 still includes (bolsa wins)", () => {
    const raw = baseRaw({
      tipo_vaga: "bolsa_parcial",
      percentual_bolsa: 20,
      planos: { valor_mensalidade: 690 }, // exact ordem 2
    });
    const row = buildDescontoRow(raw, FUND1);
    expect(row).not.toBeNull();
    expect(row!.origem).toBe("bolsa_parcial");
  });

  it("clamps negative % to 0", () => {
    // plano > cheio with tiny bolsa: efetivo could still be > cheio
    const raw = baseRaw({
      tipo_vaga: "bolsa_parcial",
      percentual_bolsa: 1,
      planos: { valor_mensalidade: 800 },
    });
    const row = buildDescontoRow(raw, FUND1);
    expect(row).not.toBeNull();
    expect(row!.percentualDescontoEfetivo).toBe(0); // clamp(max 0)
  });
});

describe("buildDescontoRow — derivations", () => {
  it("derives nome / série / turma / segmento / serieOrdem from joins", () => {
    const row = buildDescontoRow(baseRaw({ planos: { valor_mensalidade: 600 } }), FUND1);
    expect(row!.nome).toBe("JOÃO SILVA");
    expect(row!.serie).toBe("5º Ano");
    expect(row!.serieId).toBe("s1");
    expect(row!.serieOrdem).toBe(5);
    expect(row!.turma).toBe("A");
    expect(row!.turmaId).toBe("t1");
    expect(row!.segmento).toBe("FUNDAMENTAL1");
  });

  it("picks responsavel_financeiro first and celular||telefone", () => {
    const respOther = {
      nome: "Carlos",
      parentesco: "pai",
      telefone: "62888880000",
      celular: "",
      responsavel_financeiro: false,
    };
    const raw = baseRaw({
      planos: { valor_mensalidade: 600 },
      alunos: { id: "a1", nome: "JOÃO SILVA", responsaveis_aluno: [respOther, respFin] },
    });
    const row = buildDescontoRow(raw, FUND1);
    expect(row!.responsavelNome).toBe("Maria");
    expect(row!.responsavelParentesco).toBe("mãe");
    expect(row!.responsavelTelefone).toBe("62999990000");
  });

  it("no responsável -> null fields", () => {
    const raw = baseRaw({
      planos: { valor_mensalidade: 600 },
      alunos: { id: "a1", nome: "JOÃO SILVA", responsaveis_aluno: [] },
    });
    const row = buildDescontoRow(raw, FUND1);
    expect(row!.responsavelNome).toBeNull();
    expect(row!.responsavelParentesco).toBeNull();
    expect(row!.responsavelTelefone).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/lib/data/alunos-com-desconto.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create the constants/types/helpers file**

Create `src/lib/data/alunos-com-desconto.ts`:

```typescript
import { createServerClient } from "@/lib/supabase/server";
import { DEFAULT_SCHOOL_ID } from "@/lib/constants";

export type OrigemDesconto = "plano" | "bolsa_parcial" | "plano+bolsa";

export type RawResponsavel = {
  nome: string;
  parentesco: string | null;
  telefone: string | null;
  celular: string | null;
  responsavel_financeiro: boolean;
};

export type RawMatricula = {
  id: string;
  tipo_vaga: "paga" | "bolsa_parcial";
  percentual_bolsa: number;
  alunos: {
    id: string;
    nome: string;
    responsaveis_aluno: RawResponsavel[];
  } | null;
  series: {
    id: string;
    nome: string;
    ordem: number;
    segmento: string | null;
  } | null;
  turmas: { id: string; nome: string } | null;
  planos: { valor_mensalidade: number | null } | null;
};

export type AlunoComDescontoRow = {
  alunoId: string;
  matriculaId: string;
  nome: string;
  serie: string;
  serieId: string;
  serieOrdem: number;
  turma: string;
  turmaId: string;
  segmento: string;
  origem: OrigemDesconto;
  valorPraticadoCheio: number;
  valorMensalidadePlano: number;
  percentualBolsaParcial: number;
  percentualDescontoEfetivo: number;
  responsavelNome: string | null;
  responsavelParentesco: string | null;
  responsavelTelefone: string | null;
};

export type AlunosComDescontoFilters = {
  nome: string | null;
  serieId: string | null;
  turmaId: string | null;
};

export const ORIGEM_LABEL: Record<OrigemDesconto, string> = {
  plano: "Plano",
  bolsa_parcial: "Bolsa parcial",
  "plano+bolsa": "Plano + Bolsa parcial",
};

export function origemTone(origem: OrigemDesconto): "neutral" | "warning" | "danger" {
  if (origem === "plano") return "neutral";
  if (origem === "bolsa_parcial") return "warning";
  return "danger";
}

/**
 * Decides whether the matrícula qualifies as "with discount" and computes the row.
 *
 * Rules (in order):
 *   1. No plano / no segmento / empty valoresSeg -> null.
 *   2. If plano value matches ANY ordem_filho value AND tipo_vaga !== bolsa_parcial -> null
 *      (paying official sibling price, not a discount).
 *   3. Enters if tipo_vaga === bolsa_parcial OR plano value < min(valoresSeg).
 *   4. Origem combines plano and bolsa.
 *   5. valorEfetivo applies the bolsa percentual to the plan; percentual is clamped to [0, 1].
 *
 * `valoresSeg` MUST start with the ordem_filho=1 value (caller orders it).
 */
export function buildDescontoRow(
  raw: RawMatricula,
  valoresSeg: number[]
): AlunoComDescontoRow | null {
  const valorPlano = raw.planos?.valor_mensalidade;
  if (valorPlano == null) return null;
  if (!raw.series?.segmento) return null;
  if (valoresSeg.length === 0) return null;

  const valorPlanoNum = Number(valorPlano);
  const minSeg = Math.min(...valoresSeg);
  const isBolsaParcial =
    raw.tipo_vaga === "bolsa_parcial" &&
    raw.percentual_bolsa > 0 &&
    raw.percentual_bolsa < 100;

  const bateValorOficial = valoresSeg.some((v) => v === valorPlanoNum);
  if (bateValorOficial && !isBolsaParcial) return null;

  const temDescontoPlano = valorPlanoNum < minSeg;
  if (!temDescontoPlano && !isBolsaParcial) return null;

  const origem: OrigemDesconto =
    temDescontoPlano && isBolsaParcial
      ? "plano+bolsa"
      : temDescontoPlano
      ? "plano"
      : "bolsa_parcial";

  const valorEfetivo = isBolsaParcial
    ? valorPlanoNum * (1 - raw.percentual_bolsa / 100)
    : valorPlanoNum;

  const valorPraticadoCheio = valoresSeg[0];
  const percentualDescontoEfetivo = Math.max(
    0,
    1 - valorEfetivo / valorPraticadoCheio
  );

  const responsaveis = [...(raw.alunos?.responsaveis_aluno ?? [])].sort(
    (a, b) => Number(b.responsavel_financeiro) - Number(a.responsavel_financeiro)
  );
  const resp = responsaveis[0] ?? null;
  const respTel = resp ? resp.celular || resp.telefone || null : null;

  return {
    alunoId: raw.alunos?.id ?? "",
    matriculaId: raw.id,
    nome: raw.alunos?.nome ?? "—",
    serie: raw.series.nome,
    serieId: raw.series.id,
    serieOrdem: raw.series.ordem,
    turma: raw.turmas?.nome ?? "—",
    turmaId: raw.turmas?.id ?? "",
    segmento: raw.series.segmento,
    origem,
    valorPraticadoCheio,
    valorMensalidadePlano: valorPlanoNum,
    percentualBolsaParcial: isBolsaParcial ? raw.percentual_bolsa : 0,
    percentualDescontoEfetivo,
    responsavelNome: resp?.nome ?? null,
    responsavelParentesco: resp?.parentesco ?? null,
    responsavelTelefone: respTel,
  };
}
```

> Note: the file imports `createServerClient` / `DEFAULT_SCHOOL_ID` because Task 2 will append the async query. If TypeScript flags those as unused for now, leave them — Task 2 uses them. If `noUnusedLocals` makes typecheck fail, remove them temporarily and Task 2 re-adds them. The tests don't need them.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/lib/data/alunos-com-desconto.test.ts`
Expected: PASS — all green.

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: clean. If `createServerClient`/`DEFAULT_SCHOOL_ID` cause unused-import errors, remove them — Task 2 will re-add.

- [ ] **Step 6: Commit**

```bash
git add src/lib/data/alunos-com-desconto.ts src/lib/data/alunos-com-desconto.test.ts
git commit -m "feat(financeiro): pure helpers for alunos com desconto"
```

---

## Task 2: `getAlunosComDesconto` query function

**Files:**
- Modify: `src/lib/data/alunos-com-desconto.ts` (append the async function)

This task is not unit-tested (integration boundary). The pure logic is already covered.

- [ ] **Step 1: Ensure server-only imports are present**

Ensure these imports exist at the top of `src/lib/data/alunos-com-desconto.ts`:

```typescript
import { createServerClient } from "@/lib/supabase/server";
import { DEFAULT_SCHOOL_ID } from "@/lib/constants";
```

(Task 1 may have left them in. Re-add if removed.)

- [ ] **Step 2: Append `getAlunosComDesconto` at the end of `src/lib/data/alunos-com-desconto.ts`**

```typescript
/**
 * Fetches active 2026 matrículas of tipo_vaga `paga` or `bolsa_parcial` that
 * pay below the practiced value (plano below min sibling price OR bolsa_parcial),
 * excluding students who pay an official sibling price.
 * Sorted by série order, then student name.
 */
export async function getAlunosComDesconto(
  filters: AlunosComDescontoFilters
): Promise<AlunoComDescontoRow[]> {
  const supabase = await createServerClient();

  let query = supabase
    .from("matriculas")
    .select(`
      id, tipo_vaga, percentual_bolsa,
      alunos!inner(id, nome, responsaveis_aluno(nome, parentesco, telefone, celular, responsavel_financeiro)),
      series!inner(id, nome, ordem, segmento),
      turmas!inner(id, nome),
      planos!inner(valor_mensalidade)
    `)
    .eq("escola_id", DEFAULT_SCHOOL_ID)
    .eq("ano_letivo", 2026)
    .eq("status", "ativa")
    .in("tipo_vaga", ["paga", "bolsa_parcial"]);

  if (filters.nome) {
    query = query.or(`nome.ilike.%${filters.nome}%`, { foreignTable: "alunos" });
  }

  const { data, error } = await query;
  if (error) throw error;

  // Load all practiced values for 2026 and index by segmento.
  const { data: valoresData, error: valErr } = await supabase
    .from("valores_praticados")
    .select("segmento, ordem_filho, valor_mensalidade")
    .eq("escola_id", DEFAULT_SCHOOL_ID)
    .eq("ano_letivo", 2026)
    .order("ordem_filho", { ascending: true });
  if (valErr) throw valErr;

  const valoresPorSegmento = new Map<string, number[]>();
  for (const v of (valoresData ?? []) as Array<{
    segmento: string;
    ordem_filho: number;
    valor_mensalidade: number | string;
  }>) {
    const arr = valoresPorSegmento.get(v.segmento) ?? [];
    arr.push(Number(v.valor_mensalidade));
    valoresPorSegmento.set(v.segmento, arr);
  }

  const rows: AlunoComDescontoRow[] = [];
  for (const item of data ?? []) {
    const rec = item as unknown as RawMatricula;
    const segmento = rec.series?.segmento ?? null;
    if (!segmento) continue;
    const valoresSeg = valoresPorSegmento.get(segmento) ?? [];
    const row = buildDescontoRow(rec, valoresSeg);
    if (!row) continue;
    if (filters.serieId && row.serieId !== filters.serieId) continue;
    if (filters.turmaId && row.turmaId !== filters.turmaId) continue;
    rows.push(row);
  }

  rows.sort(
    (a, b) => a.serieOrdem - b.serieOrdem || a.nome.localeCompare(b.nome, "pt-BR")
  );
  return rows;
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: clean. If Supabase nested-join generics produce a type error, the `as unknown as RawMatricula` cast (already in place) is the boundary cast — that should resolve it.

- [ ] **Step 4: Run tests (no regression)**

Run: `npm test -- src/lib/data/alunos-com-desconto.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/data/alunos-com-desconto.ts
git commit -m "feat(financeiro): getAlunosComDesconto query function"
```

---

## Task 3: `AlunosTabs` component

**Files:**
- Create: `src/components/finance/alunos-tabs.tsx`

Mirrors the `dashboard-tabs.tsx` pattern: Link-based, server-renderable, no JS state.

- [ ] **Step 1: Create the component**

Create `src/components/finance/alunos-tabs.tsx`:

```tsx
import Link from "next/link";
import { AlertTriangle, BadgePercent, type LucideIcon } from "lucide-react";

export type AlunosTab = "sem-valor" | "com-desconto";

const TABS: Array<{ id: AlunosTab; label: string; icon: LucideIcon }> = [
  { id: "sem-valor", label: "Sem valor", icon: AlertTriangle },
  { id: "com-desconto", label: "Com desconto", icon: BadgePercent },
];

export function AlunosTabs({ active }: { active: AlunosTab }) {
  return (
    <nav className="flex gap-1 border-b border-line">
      {TABS.map((t) => {
        const Icon = t.icon;
        const isActive = t.id === active;
        return (
          <Link
            key={t.id}
            href={`/financeiro/alunos-sem-valor?aba=${t.id}`}
            scroll={false}
            className={`relative inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
              isActive ? "text-brand" : "text-ink/55 hover:text-ink"
            }`}
          >
            <Icon size={14} />
            {t.label}
            {isActive && (
              <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-brand" />
            )}
          </Link>
        );
      })}
    </nav>
  );
}

export function parseAlunosTab(value: string | undefined): AlunosTab {
  return value === "com-desconto" ? "com-desconto" : "sem-valor";
}
```

`BadgePercent` exists in lucide-react. If it doesn't import cleanly, swap to `Percent`.

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/components/finance/alunos-tabs.tsx
git commit -m "feat(financeiro): alunos tabs component"
```

---

## Task 4: `AlunosComDescontoFilters` component

**Files:**
- Create: `src/components/finance/alunos-com-desconto-filters.tsx`

Mirrors `alunos-sem-valor-filters.tsx` but omits the motivo field. The form's hidden input `aba=com-desconto` keeps the tab selection on submit.

- [ ] **Step 1: Create the component**

Create `src/components/finance/alunos-com-desconto-filters.tsx`:

```tsx
import { Search } from "lucide-react";

type Option = { id: string; nome: string };

type Props = {
  defaults: {
    nome: string;
    serieId: string;
    turmaId: string;
  };
  series: Option[];
  turmas: Option[];
};

export function AlunosComDescontoFilters({ defaults, series, turmas }: Props) {
  return (
    <form
      method="GET"
      className="grid gap-3 rounded-ui border border-line bg-muted/30 p-4 md:grid-cols-[1fr_180px_180px_120px] items-end"
    >
      <input type="hidden" name="aba" value="com-desconto" />
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
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/components/finance/alunos-com-desconto-filters.tsx
git commit -m "feat(financeiro): alunos com desconto filters component"
```

---

## Task 5: `ExportAlunosComDescontoButton` component

**Files:**
- Create: `src/components/finance/export-alunos-com-desconto-button.tsx`

Mirrors `export-alunos-sem-valor-button.tsx`: client component, `exceljs`, flat one-row-per-aluno (no responsável fan-out; the single responsável is already on the row).

- [ ] **Step 1: Create the component**

Create `src/components/finance/export-alunos-com-desconto-button.tsx`:

```tsx
"use client";

import { FileSpreadsheet } from "lucide-react";
import ExcelJS from "exceljs";
import { ORIGEM_LABEL, type AlunoComDescontoRow } from "@/lib/data/alunos-com-desconto";

export function ExportAlunosComDescontoButton({ rows }: { rows: AlunoComDescontoRow[] }) {
  const handleXlsx = async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Alunos com desconto");
    ws.columns = [
      { header: "Aluno", key: "aluno", width: 32 },
      { header: "Série", key: "serie", width: 12 },
      { header: "Turma", key: "turma", width: 10 },
      { header: "Segmento", key: "segmento", width: 14 },
      { header: "Origem do desconto", key: "origem", width: 22 },
      { header: "Valor praticado (cheio)", key: "valorCheio", width: 18 },
      { header: "Valor mensalidade plano", key: "valorPlano", width: 20 },
      { header: "% bolsa parcial", key: "pctBolsa", width: 14 },
      { header: "% desconto efetivo", key: "pctEf", width: 18 },
      { header: "Responsável", key: "responsavel", width: 28 },
      { header: "Parentesco", key: "parentesco", width: 14 },
      { header: "Telefone", key: "telefone", width: 18 },
    ];

    for (const r of rows) {
      ws.addRow({
        aluno: r.nome,
        serie: r.serie,
        turma: r.turma,
        segmento: r.segmento,
        origem: ORIGEM_LABEL[r.origem],
        valorCheio: r.valorPraticadoCheio,
        valorPlano: r.valorMensalidadePlano,
        pctBolsa: r.percentualBolsaParcial / 100,
        pctEf: r.percentualDescontoEfetivo,
        responsavel: r.responsavelNome ?? "",
        parentesco: r.responsavelParentesco ?? "",
        telefone: r.responsavelTelefone ?? "",
      });
    }

    ws.getRow(1).font = { bold: true };
    ws.getColumn("valorCheio").numFmt = '"R$ "#,##0.00';
    ws.getColumn("valorPlano").numFmt = '"R$ "#,##0.00';
    ws.getColumn("pctBolsa").numFmt = "0.0%";
    ws.getColumn("pctEf").numFmt = "0.0%";

    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "alunos_com_desconto_2026.xlsx";
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
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/components/finance/export-alunos-com-desconto-button.tsx
git commit -m "feat(financeiro): excel export for alunos com desconto"
```

---

## Task 6: Page — add tabs + branch by `aba`

**Files:**
- Modify: `src/app/(app)/financeiro/alunos-sem-valor/page.tsx`

This task ADDS the tab branching to the existing page without breaking the current "Sem valor" rendering.

- [ ] **Step 1: Update imports and signature**

Open `src/app/(app)/financeiro/alunos-sem-valor/page.tsx`. Add these imports next to the existing ones:

```typescript
import { BadgePercent } from "lucide-react";
import { AlunosTabs, parseAlunosTab, type AlunosTab } from "@/components/finance/alunos-tabs";
import { AlunosComDescontoFilters } from "@/components/finance/alunos-com-desconto-filters";
import { ExportAlunosComDescontoButton } from "@/components/finance/export-alunos-com-desconto-button";
import {
  getAlunosComDesconto,
  ORIGEM_LABEL,
  origemTone,
  type AlunosComDescontoFilters as DescontoFilters,
} from "@/lib/data/alunos-com-desconto";
```

Update the page's `searchParams` Promise type to include `aba`:

```typescript
searchParams: Promise<{
  aba?: string;
  nome?: string;
  motivo?: string;
  serie?: string;
  turma?: string;
}>;
```

- [ ] **Step 2: Add the dispatch logic and the "com-desconto" branch**

Right after `const sp = await searchParams;`, ADD:

```typescript
  const aba: AlunosTab = parseAlunosTab(sp.aba);
```

Then BEFORE the existing `const filters = parseFilters(sp);` line, add an early return / branch for `aba === "com-desconto"`. The cleanest shape is to extract two branches; replace the body of the function (from the `const sp = ...` line onward) with:

```typescript
  const sp = await searchParams;
  const aba: AlunosTab = parseAlunosTab(sp.aba);
  const academic = await getAcademicData();

  const series = academic.series.map((s) => ({ id: s.id, nome: s.nome }));
  const turmas2026 = academic.turmas
    .filter((t) => (t as { ano_letivo: number }).ano_letivo === 2026)
    .map((t) => ({
      id: t.id,
      nome: t.nome,
      serieId: (t as { serie_id: string | null }).serie_id ?? "",
    }));
  const planos = academic.planos.map((p) => ({ id: p.id, nome: p.nome }));

  if (aba === "com-desconto") {
    const descontoFilters: DescontoFilters = {
      nome: sp.nome?.trim() || null,
      serieId: sp.serie || null,
      turmaId: sp.turma || null,
    };
    const rows = await getAlunosComDesconto(descontoFilters);

    const planoCount = rows.filter(
      (r) => r.origem === "plano" || r.origem === "plano+bolsa"
    ).length;
    const bolsaCount = rows.filter(
      (r) => r.origem === "bolsa_parcial" || r.origem === "plano+bolsa"
    ).length;
    const mediaDesconto =
      rows.length === 0
        ? 0
        : rows.reduce((acc, r) => acc + r.percentualDescontoEfetivo, 0) / rows.length;

    const pctFmt = (v: number) =>
      `${(v * 100).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;

    return (
      <div className="grid gap-8">
        <PageHeader
          breadcrumb={[{ label: "Financeiro", href: "/financeiro" }, { label: "Alunos sem valor" }]}
          title="Alunos sem valor de matrícula"
          description="Alunos ativos sem matrícula 2026, sem valor de matrícula definido, com vaga não-pagante ou com desconto."
          actions={<ExportAlunosComDescontoButton rows={rows} />}
          kpis={[
            { label: "Total", value: rows.length.toLocaleString("pt-BR") },
            { label: "Plano abaixo", value: planoCount.toLocaleString("pt-BR") },
            { label: "Bolsa parcial", value: bolsaCount.toLocaleString("pt-BR"), tone: "warning" },
            { label: "Desconto médio", value: pctFmt(mediaDesconto) },
          ]}
        />

        <AlunosTabs active={aba} />

        <AlunosComDescontoFilters
          defaults={{
            nome: descontoFilters.nome ?? "",
            serieId: descontoFilters.serieId ?? "",
            turmaId: descontoFilters.turmaId ?? "",
          }}
          series={series}
          turmas={turmas2026.map((t) => ({ id: t.id, nome: t.nome }))}
        />

        {rows.length === 0 ? (
          <Panel>
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-ink/40">
              <BadgePercent size={28} />
              <p className="text-sm font-medium">Nenhum aluno com desconto encontrado.</p>
            </div>
          </Panel>
        ) : (
          <DataTableShell>
            <table className="ds-dt min-w-[940px]">
              <thead>
                <tr>
                  <th>Aluno</th>
                  <th>Série</th>
                  <th>Turma</th>
                  <th>Origem</th>
                  <th>% Desconto</th>
                  <th>Responsável</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.alunoId}>
                    <td className="font-semibold text-ink">{r.nome}</td>
                    <td>{r.serie}</td>
                    <td>{r.turma}</td>
                    <td>
                      <StatusPill tone={origemTone(r.origem)}>
                        {ORIGEM_LABEL[r.origem]}
                      </StatusPill>
                    </td>
                    <td>{`-${pctFmt(r.percentualDescontoEfetivo)}`}</td>
                    <td>
                      {r.responsavelNome ? (
                        <div className="text-sm">
                          <span className="font-medium text-ink">{r.responsavelNome}</span>
                          {r.responsavelParentesco ? (
                            <span className="text-ink/50"> ({r.responsavelParentesco})</span>
                          ) : null}
                          {r.responsavelTelefone ? (
                            <span className="text-ink/60"> · {r.responsavelTelefone}</span>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-ink/40">—</span>
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

  // --- aba === "sem-valor" (default) ---

  const filters = parseFilters(sp);
  const rows = await getAlunosSemValor(filters);

  const semMatricula = rows.filter((r) => r.motivo === "sem_matricula").length;
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
        description="Alunos ativos sem matrícula 2026, sem valor de matrícula definido ou com vaga não-pagante."
        actions={<ExportAlunosSemValorButton rows={rows} />}
        kpis={[
          { label: "Total", value: rows.length.toLocaleString("pt-BR") },
          { label: "Sem matrícula", value: semMatricula.toLocaleString("pt-BR"), tone: "danger" },
          { label: "Sem valor", value: semValor.toLocaleString("pt-BR"), tone: "danger" },
          { label: "Bolsistas", value: bolsistas.toLocaleString("pt-BR"), tone: "warning" },
          { label: "Permuta/Gratuita", value: permutaGratuita.toLocaleString("pt-BR") },
        ]}
      />

      <AlunosTabs active={aba} />

      <AlunosSemValorFilters
        defaults={{
          nome: filters.nome ?? "",
          motivo: filters.motivo ?? "",
          serieId: filters.serieId ?? "",
          turmaId: filters.turmaId ?? "",
        }}
        series={series}
        turmas={turmas2026.map((t) => ({ id: t.id, nome: t.nome }))}
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
          <table className="ds-dt min-w-[940px]">
            <thead>
              <tr>
                <th>Aluno</th>
                <th>Série</th>
                <th>Turma</th>
                <th>Motivo</th>
                <th>Responsáveis</th>
                {canEditAny ? <th>Ações</th> : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.alunoId}>
                  <td className="font-semibold text-ink">{r.nome}</td>
                  <td>{r.serie || "—"}</td>
                  <td>{r.turma || "—"}</td>
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
                        {r.responsaveis.map((resp) => (
                          <div key={`${resp.nome}-${resp.parentesco ?? ""}`} className="text-sm">
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
                  {canEditAny ? (
                    <td>
                      {(r.matriculaId ? canUpdate : canCreate) ? (
                        <MatriculaEditDialog
                          row={r}
                          series={series}
                          turmas={turmas2026}
                          planos={planos}
                        />
                      ) : null}
                    </td>
                  ) : null}
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

Notes:
- The `series` / `turmas2026` / `planos` are computed BEFORE the branch so both branches reuse them.
- `requirePermission` and the `canUpdate/canCreate/canEditAny` lines stay where they already are (above this block) — unchanged.
- The `parseFilters` function for the "sem-valor" branch stays at top-level — unchanged.
- `getAlunosSemValor`, `MOTIVO_LABEL`, `motivoTone`, `AlunosSemValorFilters`, `ExportAlunosSemValorButton`, `MatriculaEditDialog`, `AlertTriangle` imports stay as they are.
- The variable formerly named `turmas` is renamed to `turmas2026` for clarity since it now feeds two branches. Update any remaining usages (`turmas={turmas...}`) to `turmas={turmas2026...}`.

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: clean. If a stray reference to the old `turmas` symbol survives, rename it to `turmas2026`.

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: build succeeds; route `/financeiro/alunos-sem-valor` listed.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(app)/financeiro/alunos-sem-valor/page.tsx"
git commit -m "feat(financeiro): add com-desconto tab and branch"
```

---

## Task 7: Final verification

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: PASS — including the new `alunos-com-desconto.test.ts`.

- [ ] **Step 2: Typecheck and build**

Run: `npm run typecheck && npm run build`
Expected: both succeed.

- [ ] **Step 3: Manual smoke test**

Run `npm run dev`, log in, open Financeiro → "Alunos sem valor". Verify:

- The page shows tabs `[Sem valor] [Com desconto]`, with "Sem valor" active by default.
- Clicking "Com desconto" navigates to `?aba=com-desconto`; the URL changes, the KPIs change to Total / Plano abaixo / Bolsa parcial / Desconto médio.
- The grid lists students whose plano mensalidade is below the segmento's min ordem_filho value, or who are `bolsa_parcial`. Students whose plano value equals an official sibling value do NOT appear.
- Filters (nome, série, turma) reduce the list.
- "Exportar XLSX" downloads `alunos_com_desconto_2026.xlsx` with 12 columns; currency and percent formats render correctly.
- Switching back to "Sem valor" keeps the previous behavior (same KPIs, same edit button, same export).

---

## Self-Review

**Spec coverage:**
- Discount detection (plano below min OR bolsa_parcial) → Task 1 `buildDescontoRow`. ✓
- Exclude official sibling price → Task 1 rule 7. ✓
- Combined % efetivo → Task 1 rule 13. ✓
- Tabs at top with `?aba=` URL param → Tasks 3 + 6. ✓
- KPIs Total / Plano abaixo / Bolsa parcial / Desconto médio → Task 6. ✓
- Grid columns Aluno / Série / Turma / Origem (StatusPill) / % / Responsável → Task 6. ✓
- Filters nome/série/turma (no motivo) → Task 4. ✓
- Excel export with 12 columns and formatting → Task 5. ✓
- Permission `relatorios` read (page-level) → already in place; unchanged. ✓
- No edit button in com-desconto tab → Task 6 (the com-desconto return block omits the Ações column). ✓
- Active 2026 scope → Task 2 query filters. ✓
- Tests for buildDescontoRow inclusion/exclusion/origem/% → Task 1. ✓

**Placeholder scan:** No TBD/TODO. Every code step contains complete code.

**Type consistency:** `RawMatricula`, `AlunoComDescontoRow`, `AlunosComDescontoFilters`, `OrigemDesconto`, `ORIGEM_LABEL`, `origemTone`, `buildDescontoRow`, `getAlunosComDesconto`, `AlunosTab`, `parseAlunosTab` — consistent across Tasks 1, 2, 3, 4, 5, 6.
