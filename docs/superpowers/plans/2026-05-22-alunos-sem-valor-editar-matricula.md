# Editar matrícula na tela Alunos sem valor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the finance team edit a matrícula's tipo_vaga/plano/série/turma/status — or create a 2026 matrícula for students who lack one — directly from the "Alunos sem valor" screen via a modal.

**Architecture:** The data layer is reworked to start from `alunos` (left-joining the 2026 matrícula) so students without a 2026 enrollment appear with a new `sem_matricula` motivo. A new generic `Dialog` shell component is extracted from the existing confirm-dialog pattern. A `MatriculaEditDialog` client component renders the edit form inside it, submitting to a new `upsertMatriculaSemValorAction` server action that creates or updates the matrícula (never touching cobranças).

**Tech Stack:** Next.js 14 App Router, Supabase (`createServerClient`), TypeScript, Vitest (node env), React server actions, lucide-react.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/lib/data/alunos-sem-valor-constants.ts` (modify) | Add `sem_matricula` motivo; add `alunoId`/`serieId`/`turmaId` to row type; `matriculaId` → nullable; update `deriveMotivo`/`buildRow`. |
| `src/lib/data/alunos-sem-valor.test.ts` (modify) | New tests for `sem_matricula` and nullable `matriculaId`. |
| `src/lib/data/alunos-sem-valor.ts` (modify) | Rewrite `getAlunosSemValor` to start from `alunos`, left-join matrícula 2026. |
| `src/lib/actions/alunos-sem-valor.ts` (create) | `upsertMatriculaSemValorAction` — create/update matrícula, no cobranças. |
| `src/components/ui/dialog.tsx` (create) | Generic modal shell — portal, backdrop, ESC, X. |
| `src/components/finance/matricula-edit-dialog.tsx` (create) | Edit button + modal form. |
| `src/app/(app)/financeiro/alunos-sem-valor/page.tsx` (modify) | New "Ações" column, "Sem matrícula" KPI, write-permission flag. |
| `src/components/finance/export-alunos-sem-valor-button.tsx` (modify) | Handle null matriculaId / empty série-turma rows. |

**Task order rationale:** data layer first (constants → query), then the action, then UI shell (`Dialog`) → edit dialog → page wiring → export fix → verification.

---

## Task 1: Add `sem_matricula` motivo and nullable matrícula to constants

**Files:**
- Modify: `src/lib/data/alunos-sem-valor-constants.ts`
- Test: `src/lib/data/alunos-sem-valor.test.ts`

The current `RawMatricula` shape models a matrícula that always exists. The grid now starts from `alunos`, so a row may have no matrícula. We change `buildRow` to take an `alunos`-centric raw shape.

- [ ] **Step 1: Write the failing tests**

Open `src/lib/data/alunos-sem-valor.test.ts`. The current tests import `buildRow`, `deriveMotivo`, `isSemValor`, `motivoTone`, and type `RawMatricula`. We are changing `buildRow`'s input to a new `RawAluno` shape. REPLACE the entire `describe("buildRow", ...)` block and ADD a `describe("deriveMotivo sem_matricula", ...)` block and a `motivoTone` case. Keep the existing `isSemValor`, `deriveMotivo` (non-sem_matricula), and `motivoTone` blocks.

The new/updated test content:

```typescript
import { describe, it, expect } from "vitest";
import {
  deriveMotivo,
  isSemValor,
  buildRow,
  motivoTone,
  type RawAluno,
} from "./alunos-sem-valor-constants";

// ... keep existing describe("isSemValor", ...) unchanged ...
// ... keep existing describe("deriveMotivo", ...) unchanged ...

describe("deriveMotivo sem_matricula", () => {
  it("no matrícula -> sem_matricula", () => {
    expect(deriveMotivo("paga", null, null, false)).toBe("sem_matricula");
  });
  it("has matrícula, paga, valid plano -> null", () => {
    expect(deriveMotivo("paga", "plan-1", 250, true)).toBeNull();
  });
  it("has matrícula, paga, no plano -> sem_valor", () => {
    expect(deriveMotivo("paga", null, null, true)).toBe("sem_valor");
  });
  it("has matrícula, bolsa_integral -> bolsa_integral", () => {
    expect(deriveMotivo("bolsa_integral", "plan-1", 250, true)).toBe("bolsa_integral");
  });
});

describe("motivoTone sem_matricula", () => {
  it("sem_matricula -> danger", () => {
    expect(motivoTone("sem_matricula")).toBe("danger");
  });
});

describe("buildRow", () => {
  const respFin = {
    nome: "Carlos",
    parentesco: "pai",
    telefone: "62888880000",
    celular: "",
    responsavel_financeiro: true,
  };
  const respOther = {
    nome: "Maria",
    parentesco: "mãe",
    telefone: "",
    celular: "62999990000",
    responsavel_financeiro: false,
  };

  const alunoComMatricula: RawAluno = {
    id: "a1",
    nome: "JOÃO SILVA",
    matriculas: [
      {
        id: "m1",
        tipo_vaga: "paga",
        plano_id: null,
        status: "ativa",
        planos: null,
        turmas: { id: "t1", nome: "A", serie_id: "s1", series: { id: "s1", nome: "1º Ano", ordem: 1 } },
      },
    ],
    responsaveis_aluno: [respOther, respFin],
  };

  const alunoSemMatricula: RawAluno = {
    id: "a2",
    nome: "ANA COSTA",
    matriculas: [],
    responsaveis_aluno: [],
  };

  it("derives a row for an aluno with a sem_valor matrícula", () => {
    const row = buildRow(alunoComMatricula);
    expect(row).not.toBeNull();
    expect(row!.alunoId).toBe("a1");
    expect(row!.matriculaId).toBe("m1");
    expect(row!.nome).toBe("JOÃO SILVA");
    expect(row!.serie).toBe("1º Ano");
    expect(row!.serieId).toBe("s1");
    expect(row!.turma).toBe("A");
    expect(row!.turmaId).toBe("t1");
    expect(row!.motivo).toBe("sem_valor");
  });

  it("orders responsavel_financeiro first and uses celular||telefone", () => {
    const row = buildRow(alunoComMatricula);
    expect(row!.responsaveis[0].nome).toBe("Carlos");
    expect(row!.responsaveis[0].telefone).toBe("62888880000");
    expect(row!.responsaveis[1].telefone).toBe("62999990000");
  });

  it("derives a sem_matricula row for an aluno with no 2026 matrícula", () => {
    const row = buildRow(alunoSemMatricula);
    expect(row).not.toBeNull();
    expect(row!.alunoId).toBe("a2");
    expect(row!.matriculaId).toBeNull();
    expect(row!.motivo).toBe("sem_matricula");
    expect(row!.serie).toBe("");
    expect(row!.serieId).toBeNull();
    expect(row!.turma).toBe("");
    expect(row!.turmaId).toBeNull();
    expect(row!.serieOrdem).toBe(9999);
  });

  it("returns null for an aluno with a paga matrícula and valid plano", () => {
    const ok: RawAluno = {
      ...alunoComMatricula,
      matriculas: [
        {
          id: "m1",
          tipo_vaga: "paga",
          plano_id: "p1",
          status: "ativa",
          planos: { valor_matricula: 250 },
          turmas: { id: "t1", nome: "A", serie_id: "s1", series: { id: "s1", nome: "1º Ano", ordem: 1 } },
        },
      ],
    };
    expect(buildRow(ok)).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/lib/data/alunos-sem-valor.test.ts`
Expected: FAIL — `RawAluno` not exported, `buildRow` signature mismatch, `deriveMotivo` arity mismatch.

- [ ] **Step 3: Update `alunos-sem-valor-constants.ts`**

Apply these changes to `src/lib/data/alunos-sem-valor-constants.ts`:

a) Add `sem_matricula` to `MotivoSemValor`:

```typescript
export type MotivoSemValor =
  | "sem_matricula"
  | "sem_valor"
  | "bolsa_integral"
  | "bolsa_parcial"
  | "permuta"
  | "gratuita";
```

b) Add `sem_matricula` to `MOTIVO_LABEL` (first entry):

```typescript
export const MOTIVO_LABEL: Record<MotivoSemValor, string> = {
  sem_matricula: "Sem matrícula",
  sem_valor: "Sem valor",
  bolsa_integral: "Bolsa integral",
  bolsa_parcial: "Bolsa parcial",
  permuta: "Permuta",
  gratuita: "Gratuita",
};
```

c) Update `motivoTone` — `sem_matricula` is also `danger`:

```typescript
export function motivoTone(motivo: MotivoSemValor): "danger" | "warning" | "neutral" {
  if (motivo === "sem_matricula" || motivo === "sem_valor") return "danger";
  if (motivo === "bolsa_integral" || motivo === "bolsa_parcial") return "warning";
  return "neutral";
}
```

d) REPLACE the `RawMatricula` type with a matrícula sub-type plus a new `RawAluno` type. Find the existing `RawMatricula` type and replace it with:

```typescript
export type StatusMatricula = "ativa" | "cancelada" | "transferida" | "concluida";

export type RawMatriculaEmbed = {
  id: string;
  tipo_vaga: TipoVaga;
  plano_id: string | null;
  status: StatusMatricula;
  planos: { valor_matricula: number | null } | null;
  turmas: {
    id: string;
    nome: string;
    serie_id: string;
    series: { id: string; nome: string; ordem: number } | null;
  } | null;
};

export type RawAluno = {
  id: string;
  nome: string;
  matriculas: RawMatriculaEmbed[];
  responsaveis_aluno: RawResponsavel[];
};
```

Keep `RawResponsavel` unchanged. `RawMatricula` is removed — Task 3 (the query) will be updated to not reference it.

e) Update `AlunoSemValorRow` — add `alunoId`, `serieId`, `turmaId`; make `matriculaId` nullable:

```typescript
export type AlunoSemValorRow = {
  alunoId: string;
  matriculaId: string | null;
  nome: string;
  serie: string;
  serieId: string | null;
  serieOrdem: number;
  turma: string;
  turmaId: string | null;
  motivo: MotivoSemValor;
  valorMatricula: number;
  responsaveis: ResponsavelRow[];
};
```

f) Update `deriveMotivo` — add a `hasMatricula` parameter:

```typescript
/**
 * Returns the Motivo for an aluno, or null if the aluno should NOT appear in the grid.
 * - No 2026 matrícula -> "sem_matricula".
 * - Has matrícula, tipo_vaga non-paga -> the tipo_vaga (precedence over sem_valor).
 * - Has matrícula, paga, no value -> "sem_valor".
 * - Has matrícula, paga, valid value -> null (not shown).
 */
export function deriveMotivo(
  tipoVaga: TipoVaga,
  planoId: string | null,
  valorMatricula: number | null,
  hasMatricula: boolean
): MotivoSemValor | null {
  if (!hasMatricula) return "sem_matricula";
  if (tipoVaga !== "paga") return tipoVaga;
  if (isSemValor(planoId, valorMatricula)) return "sem_valor";
  return null;
}
```

g) REPLACE `buildRow` — now takes `RawAluno`:

```typescript
/** Builds an AlunoSemValorRow from a raw aluno (with optional 2026 matrícula), or null if it should not appear. */
export function buildRow(raw: RawAluno): AlunoSemValorRow | null {
  const matricula = raw.matriculas[0] ?? null;
  const hasMatricula = matricula !== null;
  const valor = matricula?.planos?.valor_matricula ?? null;
  const motivo = deriveMotivo(
    matricula?.tipo_vaga ?? "paga",
    matricula?.plano_id ?? null,
    valor,
    hasMatricula
  );
  if (!motivo) return null;

  const responsaveis: ResponsavelRow[] = [...raw.responsaveis_aluno]
    .sort((a, b) => Number(b.responsavel_financeiro) - Number(a.responsavel_financeiro))
    .map((r) => ({
      nome: r.nome,
      parentesco: r.parentesco,
      telefone: r.celular || r.telefone || "",
    }));

  return {
    alunoId: raw.id,
    matriculaId: matricula?.id ?? null,
    nome: raw.nome,
    serie: matricula?.turmas?.series?.nome ?? "",
    serieId: matricula?.turmas?.series?.id ?? null,
    serieOrdem: matricula?.turmas?.series?.ordem ?? 9999,
    turma: matricula?.turmas?.nome ?? "",
    turmaId: matricula?.turmas?.id ?? null,
    motivo,
    valorMatricula: valor ?? 0,
    responsaveis,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/lib/data/alunos-sem-valor.test.ts`
Expected: PASS — all tests green. NOTE: `npm run typecheck` will still FAIL here because `alunos-sem-valor.ts` (the query) still references the removed `RawMatricula`. That is expected and fixed in Task 3. Do not try to fix the query in this task.

- [ ] **Step 5: Commit**

```bash
git add src/lib/data/alunos-sem-valor-constants.ts src/lib/data/alunos-sem-valor.test.ts
git commit -m "feat(financeiro): add sem_matricula motivo and aluno-centric row model"
```

---

## Task 2: Rewrite `getAlunosSemValor` query to start from alunos

**Files:**
- Modify: `src/lib/data/alunos-sem-valor.ts`

This task makes the codebase compile again (Task 1 left it broken on purpose).

- [ ] **Step 1: Replace the body of `getAlunosSemValor`**

Open `src/lib/data/alunos-sem-valor.ts`. It currently imports `RawMatricula`, `TipoVaga` etc. and queries `matriculas`. Replace the imports and the whole `getAlunosSemValor` function. The top-of-file imports become:

```typescript
import "server-only";
import { createServerClient } from "@/lib/supabase/server";
import { DEFAULT_SCHOOL_ID } from "@/lib/constants";
import {
  buildRow,
  deriveMotivo,
  isSemValor,
  type RawAluno,
  type RawResponsavel,
  type AlunoSemValorRow,
  type AlunosSemValorFilters,
} from "./alunos-sem-valor-constants";
```

Keep the existing `export type { ... }` / `export { ... }` re-export blocks, but update them to re-export the new names. The re-export block should list: types `TipoVaga`, `MotivoSemValor`, `StatusMatricula`, `RawResponsavel`, `RawMatriculaEmbed`, `RawAluno`, `ResponsavelRow`, `AlunoSemValorRow`, `AlunosSemValorFilters`; values `MOTIVO_LABEL`, `motivoTone`, `isSemValor`, `deriveMotivo`, `buildRow`. (Drop `RawMatricula` — it no longer exists.)

Replace `getAlunosSemValor` with:

```typescript
/**
 * Fetches active students and their 2026 active matrícula (if any), keeping only
 * those who have no normal matrícula value: no 2026 matrícula at all, an
 * incomplete registration (no plan / value 0), or a non-paying vaga.
 * Sorted by série order, then student name.
 */
export async function getAlunosSemValor(
  filters: AlunosSemValorFilters
): Promise<AlunoSemValorRow[]> {
  const supabase = await createServerClient();

  let query = supabase
    .from("alunos")
    .select(`
      id, nome,
      matriculas!left(id, tipo_vaga, plano_id, status, ano_letivo,
        planos(valor_matricula),
        turmas(id, nome, serie_id, series(id, nome, ordem))),
      responsaveis_aluno(nome, parentesco, telefone, celular, responsavel_financeiro)
    `)
    .eq("escola_id", DEFAULT_SCHOOL_ID)
    .eq("ativo", true);

  if (filters.nome) {
    query = query.ilike("nome", `%${filters.nome}%`);
  }

  const { data, error } = await query;
  if (error) throw error;

  const rows: AlunoSemValorRow[] = [];
  for (const item of data ?? []) {
    const rec = item as Record<string, unknown>;
    // matriculas comes back as an array; keep only the active 2026 one.
    const allMatriculas = (rec.matriculas as unknown as Array<{
      id: string;
      tipo_vaga: string;
      plano_id: string | null;
      status: string;
      ano_letivo: number;
      planos: { valor_matricula: number | null } | null;
      turmas: {
        id: string;
        nome: string;
        serie_id: string;
        series: { id: string; nome: string; ordem: number } | null;
      } | null;
    }>) ?? [];
    const matricula2026 = allMatriculas.filter(
      (m) => m.ano_letivo === 2026 && m.status === "ativa"
    );

    const raw: RawAluno = {
      id: rec.id as string,
      nome: rec.nome as string,
      matriculas: matricula2026.map((m) => ({
        id: m.id,
        tipo_vaga: m.tipo_vaga as RawAluno["matriculas"][number]["tipo_vaga"],
        plano_id: m.plano_id,
        status: m.status as RawAluno["matriculas"][number]["status"],
        planos: m.planos,
        turmas: m.turmas,
      })),
      responsaveis_aluno: (rec.responsaveis_aluno as RawResponsavel[]) ?? [],
    };

    const row = buildRow(raw);
    if (!row) continue;
    if (filters.motivo && row.motivo !== filters.motivo) continue;
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

> **Note on the Supabase select:** `matriculas!left(...)` requests a left join so
> students with no matrícula are still returned. The `ano_letivo` / `status`
> filtering is done in JS (a student may have matrículas from several years; we
> keep only the active 2026 one). If supabase-js rejects the `!left` hint on this
> version, drop `!left` — an unfiltered embedded resource is already a left join
> by default in PostgREST; the JS filter still selects the 2026 active row. If
> the `as unknown as` casts produce a typecheck error, double-cast through
> `unknown` first (the pattern already used elsewhere in this file).

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors. If `isSemValor`/`deriveMotivo` are reported as unused imports, they are kept only for the re-export block — leave them if the re-export consumes them; if typecheck genuinely complains, keep `buildRow` (used in the function) and ensure `isSemValor`/`deriveMotivo` remain referenced by the `export { ... } from` block.

- [ ] **Step 3: Run tests**

Run: `npm test -- src/lib/data/alunos-sem-valor.test.ts`
Expected: PASS (Task 1 tests, unaffected).

- [ ] **Step 4: Commit**

```bash
git add src/lib/data/alunos-sem-valor.ts
git commit -m "feat(financeiro): getAlunosSemValor starts from alunos, includes sem_matricula"
```

---

## Task 3: `upsertMatriculaSemValorAction` server action

**Files:**
- Create: `src/lib/actions/alunos-sem-valor.ts`

- [ ] **Step 1: Create the action file**

Create `src/lib/actions/alunos-sem-valor.ts`:

```typescript
"use server";

import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { DEFAULT_SCHOOL_ID } from "@/lib/constants";
import { requirePermission } from "@/lib/auth/session";

type TipoVagaInput = "paga" | "bolsa_integral" | "bolsa_parcial" | "permuta" | "gratuita";
type StatusInput = "ativa" | "cancelada" | "transferida" | "concluida";

const TIPOS_VAGA: TipoVagaInput[] = ["paga", "bolsa_integral", "bolsa_parcial", "permuta", "gratuita"];
const STATUSES: StatusInput[] = ["ativa", "cancelada", "transferida", "concluida"];

function readField(formData: FormData, key: string): string | null {
  const raw = formData.get(key);
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed === "" ? null : trimmed;
}

function readTipoVaga(formData: FormData): TipoVagaInput {
  const raw = readField(formData, "tipo_vaga");
  return raw && (TIPOS_VAGA as string[]).includes(raw) ? (raw as TipoVagaInput) : "paga";
}

function readStatus(formData: FormData): StatusInput {
  const raw = readField(formData, "status");
  return raw && (STATUSES as string[]).includes(raw) ? (raw as StatusInput) : "ativa";
}

/**
 * Reads percentual_bolsa, validating it is 1-99 when tipo_vaga is bolsa_parcial,
 * and 0 otherwise. Returns a number or an error string.
 */
function readPercentualBolsa(formData: FormData, tipo: TipoVagaInput): number | { error: string } {
  if (tipo !== "bolsa_parcial") return 0;
  const raw = formData.get("percentual_bolsa");
  const value = typeof raw === "string" && raw.trim() !== "" ? Number(raw) : NaN;
  if (!Number.isFinite(value) || value <= 0 || value >= 100) {
    return { error: "Bolsa parcial exige percentual entre 1 e 99." };
  }
  return value;
}

/**
 * Creates or updates a 2026 matrícula from the "Alunos sem valor" edit modal.
 * - matricula_id present  -> update tipo_vaga, percentual_bolsa, plano_id,
 *   serie_id, turma_id, status. Requires "matriculas" update permission.
 * - matricula_id absent   -> insert a new 2026 matrícula. Requires "matriculas"
 *   create permission. serie_id and turma_id are mandatory.
 * Never generates or recalculates cobranças.
 */
export async function upsertMatriculaSemValorAction(
  formData: FormData
): Promise<{ error?: string }> {
  const matriculaId = readField(formData, "matricula_id");
  const alunoId = readField(formData, "aluno_id");
  const serieId = readField(formData, "serie_id");
  const turmaId = readField(formData, "turma_id");
  const planoId = readField(formData, "plano_id");
  const tipoVaga = readTipoVaga(formData);
  const status = readStatus(formData);

  const percentual = readPercentualBolsa(formData, tipoVaga);
  if (typeof percentual !== "number") return percentual;

  if (!alunoId) return { error: "Aluno não informado." };

  const supabase = await createServerClient();

  if (matriculaId) {
    await requirePermission("matriculas", "update");
    if (!serieId || !turmaId) return { error: "Série e turma são obrigatórias." };

    const { error } = await supabase
      .from("matriculas")
      .update({
        tipo_vaga: tipoVaga,
        percentual_bolsa: percentual,
        plano_id: planoId,
        serie_id: serieId,
        turma_id: turmaId,
        status,
      })
      .eq("id", matriculaId)
      .eq("escola_id", DEFAULT_SCHOOL_ID);
    if (error) return { error: "Erro ao atualizar a matrícula. Tente novamente." };
  } else {
    await requirePermission("matriculas", "create");
    if (!serieId || !turmaId) {
      return { error: "Série e turma são obrigatórias para criar a matrícula." };
    }

    const { data: aluno } = await supabase
      .from("alunos")
      .select("matricula_codigo")
      .eq("id", alunoId)
      .eq("escola_id", DEFAULT_SCHOOL_ID)
      .single();
    const codigo = `${aluno?.matricula_codigo ?? alunoId}-2026`;

    const { error } = await supabase.from("matriculas").insert({
      escola_id: DEFAULT_SCHOOL_ID,
      aluno_id: alunoId,
      serie_id: serieId,
      turma_id: turmaId,
      plano_id: planoId,
      codigo,
      data_matricula: new Date().toISOString().slice(0, 10),
      ano_letivo: 2026,
      status: "ativa",
      tipo_vaga: tipoVaga,
      percentual_bolsa: percentual,
    });
    if (error) return { error: "Erro ao criar a matrícula. Tente novamente." };
  }

  revalidatePath("/financeiro/alunos-sem-valor");
  revalidatePath("/financeiro");
  revalidatePath("/matriculas");
  revalidatePath(`/alunos/${alunoId}`);
  return {};
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors. If the `matriculas` insert object is rejected for a missing required column, compare against the `matriculas` insert in `createEnrollmentAction` (`src/lib/actions/academics.ts`) and add any column it includes that this one omits (e.g. `idade_na_matricula` is nullable, `observacoes` is nullable — only add a column if the DB rejects the insert).

- [ ] **Step 3: Run tests (no regression)**

Run: `npm test`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/lib/actions/alunos-sem-valor.ts
git commit -m "feat(financeiro): upsertMatriculaSemValorAction create/update matricula"
```

---

## Task 4: Generic `Dialog` component

**Files:**
- Create: `src/components/ui/dialog.tsx`

Extracts the modal shell from the pattern in `src/components/ui/confirm-dialog.tsx` (portal, backdrop, ESC, X button) into a reusable component with no form logic.

- [ ] **Step 1: Create the component**

Create `src/components/ui/dialog.tsx`:

```tsx
"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

type DialogProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
};

/**
 * Generic modal shell: portal to body, backdrop, ESC to close, click-outside to
 * close, X button. Contains no form logic — callers render their own content.
 */
export function Dialog({ open, title, onClose, children }: DialogProps) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || typeof window === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="absolute inset-0 bg-ink/30 backdrop-blur-[2px]" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative w-full max-w-md rounded-[10px] border border-line bg-surface p-6 shadow-lift"
      >
        <div className="flex items-start justify-between gap-4">
          <p className="text-sm font-semibold text-ink">{title}</p>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md text-ink/40 hover:bg-muted hover:text-ink"
            aria-label="Fechar"
          >
            <X size={14} />
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>,
    document.body
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors. If `shadow-lift` / `bg-surface` / `border-line` are unknown classes, they are project design tokens already used by `confirm-dialog.tsx` — they are valid; do not change them.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/dialog.tsx
git commit -m "feat(ui): generic Dialog modal shell component"
```

---

## Task 5: `MatriculaEditDialog` component

**Files:**
- Create: `src/components/finance/matricula-edit-dialog.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/finance/matricula-edit-dialog.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { upsertMatriculaSemValorAction } from "@/lib/actions/alunos-sem-valor";
import type { AlunoSemValorRow } from "@/lib/data/alunos-sem-valor";

type Option = { id: string; nome: string };
type TurmaOption = { id: string; nome: string; serieId: string };

type Props = {
  row: AlunoSemValorRow;
  series: Option[];
  turmas: TurmaOption[];
  planos: Option[];
};

const TIPOS = [
  { value: "paga", label: "Paga" },
  { value: "bolsa_integral", label: "Bolsa integral" },
  { value: "bolsa_parcial", label: "Bolsa parcial" },
  { value: "permuta", label: "Permuta" },
  { value: "gratuita", label: "Gratuita" },
];

const STATUSES = [
  { value: "ativa", label: "Ativa" },
  { value: "cancelada", label: "Cancelada" },
  { value: "transferida", label: "Transferida" },
  { value: "concluida", label: "Concluída" },
];

export function MatriculaEditDialog({ row, series, turmas, planos }: Props) {
  const [open, setOpen] = useState(false);
  const [tipoVaga, setTipoVaga] = useState("paga");
  const [serieId, setSerieId] = useState(row.serieId ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const isCreate = row.matriculaId === null;
  const title = isCreate ? "Criar matrícula 2026" : "Editar matrícula";
  const turmasDaSerie = turmas.filter((t) => t.serieId === serieId);

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    const result = await upsertMatriculaSemValorAction(formData);
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setOpen(false);
  }

  function openDialog() {
    // Reset local state to the row's current values each time the modal opens.
    setTipoVaga("paga");
    setSerieId(row.serieId ?? "");
    setError(null);
    setOpen(true);
  }

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        className="ds-button ds-button-secondary min-h-0 px-2.5 py-1.5 text-xs"
      >
        <Pencil size={13} /> Editar
      </button>

      <Dialog open={open} title={title} onClose={() => setOpen(false)}>
        <form action={handleSubmit} className="grid gap-3">
          <input type="hidden" name="aluno_id" value={row.alunoId} />
          {row.matriculaId ? (
            <input type="hidden" name="matricula_id" value={row.matriculaId} />
          ) : null}

          <p className="text-xs text-ink/60">{row.nome}</p>

          {error ? (
            <p className="rounded-ui bg-danger/10 px-3 py-2 text-xs font-medium text-danger">
              {error}
            </p>
          ) : null}

          <label className="text-xs font-medium text-ink/70">
            Tipo de vaga
            <select name="tipo_vaga" value={tipoVaga} onChange={(e) => setTipoVaga(e.target.value)}>
              {TIPOS.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </label>

          {tipoVaga === "bolsa_parcial" ? (
            <label className="text-xs font-medium text-ink/70">
              Percentual da bolsa (1-99)
              <input name="percentual_bolsa" type="number" min={1} max={99} inputMode="numeric" />
            </label>
          ) : null}

          <label className="text-xs font-medium text-ink/70">
            Plano
            <select name="plano_id" defaultValue="">
              <option value="">Sem plano</option>
              {planos.map((p) => (
                <option key={p.id} value={p.id}>{p.nome}</option>
              ))}
            </select>
          </label>

          <label className="text-xs font-medium text-ink/70">
            Série
            <select
              name="serie_id"
              value={serieId}
              onChange={(e) => setSerieId(e.target.value)}
              required
            >
              <option value="">Selecione…</option>
              {series.map((s) => (
                <option key={s.id} value={s.id}>{s.nome}</option>
              ))}
            </select>
          </label>

          <label className="text-xs font-medium text-ink/70">
            Turma
            <select name="turma_id" defaultValue={row.turmaId ?? ""} required>
              <option value="">Selecione…</option>
              {turmasDaSerie.map((t) => (
                <option key={t.id} value={t.id}>{t.nome}</option>
              ))}
            </select>
          </label>

          <label className="text-xs font-medium text-ink/70">
            Status
            <select name="status" defaultValue={row.matriculaId ? "ativa" : "ativa"}>
              {STATUSES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </label>

          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="ds-button ds-button-secondary text-xs"
            >
              Cancelar
            </button>
            <button type="submit" disabled={pending} className="ds-button ds-button-primary text-xs">
              {pending ? "Salvando…" : "Salvar"}
            </button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
```

> **Note:** `tipoVaga` and `serieId` are controlled (they drive conditional UI:
> the percentual field and the turma options). `plano_id`, `turma_id`, `status`
> use `defaultValue` because they don't drive other UI. The turma select is keyed
> only by the filtered list; when the série changes the available turmas update.
> Pre-selecting the existing tipo_vaga is intentionally NOT done from `row`
> because the row model does not carry `tipo_vaga` (only the derived `motivo`);
> the user picks it explicitly. This is acceptable per the spec — the modal lets
> the user set tipo_vaga; it does not need to pre-populate it.

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/finance/matricula-edit-dialog.tsx
git commit -m "feat(financeiro): matricula edit dialog component"
```

---

## Task 6: Wire the dialog into the page

**Files:**
- Modify: `src/app/(app)/financeiro/alunos-sem-valor/page.tsx`

- [ ] **Step 1: Update the page**

Replace the full content of `src/app/(app)/financeiro/alunos-sem-valor/page.tsx` with:

```tsx
import { AlertTriangle } from "lucide-react";
import { Panel } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { DataTableShell } from "@/components/ui/data-table";
import { StatusPill } from "@/components/ui/status-pill";
import { AlunosSemValorFilters } from "@/components/finance/alunos-sem-valor-filters";
import { ExportAlunosSemValorButton } from "@/components/finance/export-alunos-sem-valor-button";
import { MatriculaEditDialog } from "@/components/finance/matricula-edit-dialog";
import {
  getAlunosSemValor,
  MOTIVO_LABEL,
  motivoTone,
  type AlunosSemValorFilters as Filters,
  type MotivoSemValor,
} from "@/lib/data/alunos-sem-valor";
import { getAcademicData } from "@/lib/data/lookups";
import { requirePermission } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";

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
  searchParams: Promise<{ nome?: string; motivo?: string; serie?: string; turma?: string }>;
}) {
  const session = await requirePermission("relatorios", "read");
  const canEdit =
    session.profile.perfil === "admin" || can(session.permissions, "matriculas", "update");

  const sp = await searchParams;
  const filters = parseFilters(sp);
  const [rows, academic] = await Promise.all([
    getAlunosSemValor(filters),
    getAcademicData(),
  ]);

  const semMatricula = rows.filter((r) => r.motivo === "sem_matricula").length;
  const semValor = rows.filter((r) => r.motivo === "sem_valor").length;
  const bolsistas = rows.filter(
    (r) => r.motivo === "bolsa_integral" || r.motivo === "bolsa_parcial"
  ).length;
  const permutaGratuita = rows.filter(
    (r) => r.motivo === "permuta" || r.motivo === "gratuita"
  ).length;

  const series = academic.series.map((s) => ({ id: s.id, nome: s.nome }));
  const turmas = academic.turmas.map((t) => ({
    id: t.id,
    nome: t.nome,
    serieId: (t as { serie_id: string }).serie_id,
  }));
  const planos = academic.planos.map((p) => ({ id: p.id, nome: p.nome }));

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

      <AlunosSemValorFilters
        defaults={{
          nome: filters.nome ?? "",
          motivo: filters.motivo ?? "",
          serieId: filters.serieId ?? "",
          turmaId: filters.turmaId ?? "",
        }}
        series={series}
        turmas={turmas.map((t) => ({ id: t.id, nome: t.nome }))}
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
                {canEdit ? <th>Ações</th> : null}
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
                  {canEdit ? (
                    <td>
                      <MatriculaEditDialog
                        row={r}
                        series={series}
                        turmas={turmas}
                        planos={planos}
                      />
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

> **Verify:** `getAcademicData()` (`src/lib/data/lookups.ts`) returns `turmas`
> with a `serie_id` column (the query is `select("*, series(nome)")`). Confirm
> `turmas` rows expose `serie_id` before relying on the `(t as { serie_id }).serie_id`
> cast. They do — `turmas` table has a `serie_id` column and `select("*")`
> includes it. Also confirm `session.profile.perfil` and `session.permissions`
> are the real fields on the `Session` type returned by `requirePermission`
> (they are — see `src/lib/auth/session.ts`).

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: build succeeds; route `/financeiro/alunos-sem-valor` listed.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/financeiro/alunos-sem-valor/page.tsx"
git commit -m "feat(financeiro): wire matricula edit dialog into alunos sem valor page"
```

---

## Task 7: Fix Excel export for nullable matrícula

**Files:**
- Modify: `src/components/finance/export-alunos-sem-valor-button.tsx`

The export already iterates `rows` and reads `r.nome`, `r.serie`, `r.turma`, `r.motivo`, `r.valorMatricula`, `r.responsaveis`. With the new model, `sem_matricula` rows have `serie`/`turma` as empty strings and `valorMatricula` 0 — those already render fine. The only real risk is if the file references `r.matriculaId` anywhere.

- [ ] **Step 1: Inspect and adjust**

Open `src/components/finance/export-alunos-sem-valor-button.tsx`. Confirm it does NOT use `r.matriculaId`. It iterates rows building flat aluno×responsável lines. No code change is needed for the data — empty `serie`/`turma` strings export as empty cells, which is correct.

If the file imports `AlunoSemValorRow` and uses only `nome`, `serie`, `turma`, `motivo`, `valorMatricula`, `responsaveis` — leave it unchanged and skip to Step 2.

If it references `r.matriculaId` (it should not), replace that usage with `r.alunoId`.

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors — the `AlunoSemValorRow` type changes (new fields, nullable `matriculaId`) do not break a consumer that only reads the unchanged fields.

- [ ] **Step 3: Commit (only if a change was made)**

If Step 1 required a change:

```bash
git add src/components/finance/export-alunos-sem-valor-button.tsx
git commit -m "fix(financeiro): export handles sem_matricula rows"
```

If no change was needed, skip the commit and note it in the task report.

---

## Task 8: Final verification

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: PASS — including the updated `alunos-sem-valor.test.ts`.

- [ ] **Step 2: Typecheck and build**

Run: `npm run typecheck && npm run build`
Expected: both succeed.

- [ ] **Step 3: Manual smoke test**

Run `npm run dev`, log in, open Financeiro → "Alunos sem valor". Verify:
- KPIs include "Sem matrícula"; the grid lists active students with no 2026 matrícula (motivo "Sem matrícula").
- A row with a matrícula: "Editar" opens a modal titled "Editar matrícula"; changing tipo_vaga to `paga` + a plano with value and saving removes the row from the grid (or changes its motivo).
- A `sem_matricula` row: "Editar" opens a modal titled "Criar matrícula 2026"; selecting série/turma/tipo_vaga and saving makes the student disappear from the grid; the new matrícula appears in `/matriculas`; no cobrança was created (check Financeiro → Cobranças for that aluno).
- Selecting tipo `bolsa_parcial` with percentual 0 or 100 shows the error message in the modal.
- A user without `matriculas` update permission does not see the "Ações" column / "Editar" button.

---

## Self-Review

**Spec coverage:**
- Grid includes alunos sem matrícula 2026, motivo `sem_matricula` → Task 1 (model) + Task 2 (query). ✓
- Edit existing OR create matrícula → Task 3 (`upsertMatriculaSemValorAction` create/update). ✓
- Editable fields tipo_vaga/percentual_bolsa/plano/série/turma/status → Task 3 (action) + Task 5 (form). ✓
- Create does not generate cobranças → Task 3 (no `generateChargesForEnrollment` call). ✓
- Edit does not touch cobranças → Task 3 (update only matrícula columns). ✓
- Modal UI on the grid → Task 4 (`Dialog`) + Task 5 (`MatriculaEditDialog`). ✓
- Permission `matriculas` update/create → Task 3 (`requirePermission` per branch) + Task 6 (`canEdit` gates the button). ✓
- Generic Dialog component → Task 4. ✓
- `AlunoSemValorRow` gains `alunoId`/`serieId`/`turmaId`, nullable `matriculaId` → Task 1. ✓
- `MotivoSemValor` + `MOTIVO_LABEL` + `motivoTone` cover `sem_matricula` → Task 1. ✓
- New KPI "Sem matrícula" → Task 6. ✓
- Filter dropdown shows `sem_matricula` automatically (from `MOTIVO_LABEL`) → no task needed; verified in Task 8 smoke test. ✓
- Export handles null matriculaId / empty série-turma → Task 7. ✓
- Tests for `sem_matricula` and nullable `matriculaId` → Task 1. ✓

**Placeholder scan:** No TBD/TODO. Every code step has complete code. Task 7 is conditional (change only if needed) — that is explicit and bounded, not a placeholder.

**Type consistency:** `RawAluno`, `RawMatriculaEmbed`, `StatusMatricula`, `AlunoSemValorRow` (with `alunoId`/`matriculaId: string|null`/`serieId`/`turmaId`), `MotivoSemValor` (with `sem_matricula`), `deriveMotivo` (4-arg with `hasMatricula`), `buildRow(raw: RawAluno)`, `upsertMatriculaSemValorAction(formData): Promise<{error?: string}>` — names and signatures consistent across Tasks 1, 2, 3, 5, 6. The page row key changes from `r.matriculaId` to `r.alunoId` (Task 6) because `matriculaId` is now nullable — consistent.
