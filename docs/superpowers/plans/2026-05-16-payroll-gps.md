# Payroll GPS — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "GPS" deduction field to payroll, with per-employee default (`employees.gps_default`) and per-row override (`payroll.gps`). Surface it in payroll form after "Adiantamento" and include it in `total_deductions`.

**Architecture:** Mirror the existing `salario_sem_dsr` / `aplica_dobra` inheritance pattern: nullable on `payroll`, non-null default on `employees`. Form falls back from `row.gps` → `row.employees.gps_default` → 0. Calculator adds `gps` to `calcTotalDeductions`. Validators/actions/data-layer thread `gps` through end-to-end.

**Tech Stack:** Next.js 16 App Router, Supabase Postgres, Zod, React. Spec: `docs/2026-05-16-payroll-gps-design.md`.

---

## File Structure

- **Create** `supabase/migrations/202605250001_payroll_gps.sql` — adds columns.
- **Modify** `src/lib/payroll/calculators.ts` — add `gps` to `PayrollInput` and `calcTotalDeductions`.
- **Modify** `src/lib/validation/payroll.ts` — accept `gps` in `PayrollSchema`.
- **Modify** `src/lib/validation/rh.ts` — accept `gps_default` in employee schema.
- **Modify** `src/lib/data/payroll.ts` — `PayrollRowJoined` type + select columns.
- **Modify** `src/lib/actions/payroll.ts` — read `gps` from form, persist, recalc.
- **Modify** `src/components/rh/payroll/payroll-row-form.tsx` — render `GPS` field after Adiantamento, init from inherited value.
- **Modify** `src/components/rh/employee-form.tsx` — add `gps_default` input.

No new files in `src/`. One migration file.

---

### Task 1: Migration — add columns

**Files:**
- Create: `supabase/migrations/202605250001_payroll_gps.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- GPS deduction: employee default + per-row override
alter table public.employees
  add column if not exists gps_default numeric(10,2) default 0;

alter table public.payroll
  add column if not exists gps numeric(10,2);
```

- [ ] **Step 2: Apply migration locally**

Run: `npx supabase db push` (or whatever workflow this repo uses — fall back to `psql` if needed).
Expected: migration runs without error.

- [ ] **Step 3: Verify columns exist**

Run via existing pattern (e.g. a quick `node -e` script or psql):
```sql
SELECT column_name FROM information_schema.columns WHERE table_name='employees' AND column_name='gps_default';
SELECT column_name FROM information_schema.columns WHERE table_name='payroll' AND column_name='gps';
```
Expected: both return one row.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/202605250001_payroll_gps.sql
git commit -m "feat(payroll): migration add gps_default and gps columns"
```

---

### Task 2: Calculator — include `gps` in deductions

**Files:**
- Modify: `src/lib/payroll/calculators.ts`

- [ ] **Step 1: Add `gps` to `PayrollInput`**

Find the `PayrollInput` type (around line 18). Add `gps: number;` right after `uniform_value: number;` (line 33) and before `dependentes: number;`. Final order should be `..., uniform_value, gps, dependentes, salario_sem_dsr?, aplica_dobra?`.

- [ ] **Step 2: Sum `gps` in `calcTotalDeductions`**

Find `calcTotalDeductions` (around line 114). Add `input.gps` to the sum so the body becomes:

```ts
export function calcTotalDeductions(input: PayrollInput, inss: number, ir: number): number {
  return round2(
    inss +
    ir +
    input.loan_deduction +
    input.advance +
    input.vale_transporte +
    input.vale_alimentacao +
    input.outros_descontos +
    input.uniform_value +
    input.gps
  );
}
```

- [ ] **Step 3: Run typecheck**

Run: `npm run lint` or `npx tsc --noEmit`.
Expected: TypeScript fails — every caller of `PayrollInput` is missing `gps`. This is expected and will be fixed in Tasks 4–6. Note the failing locations.

- [ ] **Step 4: Commit (compile failure is intentional — next tasks fix callers)**

```bash
git add src/lib/payroll/calculators.ts
git commit -m "feat(payroll): include gps in total deductions"
```

---

### Task 3: Validation — accept `gps` and `gps_default`

**Files:**
- Modify: `src/lib/validation/payroll.ts`
- Modify: `src/lib/validation/rh.ts`

- [ ] **Step 1: Add `gps` to `PayrollSchema`**

In `src/lib/validation/payroll.ts`, find `PayrollSchema` (line 14). Add `gps: numericNonNeg,` immediately after `uniform_value: numericNonNeg,` (line 31) and before `dependentes:`.

- [ ] **Step 2: Add `gps_default` to employee schema in `rh.ts`**

In `src/lib/validation/rh.ts`, find the employee schema (around line 40). Add this entry after `aplica_dobra`:

```ts
gps_default: z.preprocess(
  (v) => {
    if (v === "" || v == null) return 0;
    if (typeof v === "string") return Number(v.replace(",", "."));
    return v;
  },
  z.number().min(0)
).optional()
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/validation/payroll.ts src/lib/validation/rh.ts
git commit -m "feat(payroll): validate gps and gps_default"
```

---

### Task 4: Data layer — read/expose `gps` and `gps_default`

**Files:**
- Modify: `src/lib/data/payroll.ts`

- [ ] **Step 1: Add `gps` to `PayrollRowJoined`**

Find the type declaration (around line 30 — the field `uniform_value: number | null;` lives there). Add `gps: number | null;` right after `uniform_value` and before `dependentes`.

In the `employees` join object (around line 55), add `gps_default: number | null;` after `aplica_dobra: boolean | null;`.

- [ ] **Step 2: Add columns to both `select` strings**

There are two `select` blocks (around lines 77–82 and 124–128). In each, add `gps` to the payroll column list (after `uniform_value` is a safe spot) and add `gps_default` to the `employees!inner(... salario_sem_dsr, aplica_dobra, gps_default, companies(...))` projection.

Example final fragment for the first select:
```ts
.select(`
  ...,
  family_allowance, vale_transporte, vale_alimentacao, outros_descontos, loan_deduction, advance, uniform_value, gps,
  dependentes, salario_sem_dsr, aplica_dobra, total_earnings, inss, ir, inss_manual, ir_manual, total_deductions, net_amount,
  consider_decimo_terceiro, considera_um_tercio_ferias, observations,
  employees!inner(id, name, cpf, cargo, school_category, ativo, company_id, salario_sem_dsr, aplica_dobra, gps_default, companies(id, name, cnpj))
`)
```

Apply the analogous change to the second select block.

- [ ] **Step 3: Run typecheck**

Run: `npx tsc --noEmit`.
Expected: still fails because actions/form don't include `gps` yet. Note remaining errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/data/payroll.ts
git commit -m "feat(payroll): expose gps and gps_default in joined row"
```

---

### Task 5: Action — persist `gps`, use it in recalc

**Files:**
- Modify: `src/lib/actions/payroll.ts`

- [ ] **Step 1: Read `gps` from form**

Find the form-extraction block where fields like `salario_sem_dsr: get("salario_sem_dsr")` live (around line 44). Add `gps: get("gps"),` to the object literal (placement: after `advance` or anywhere in the deduction grouping, before the closing brace).

- [ ] **Step 2: Pass `gps` into `calcInput`**

Find the `calcInput: CalcInput = { ... }` construction (around line 80). Add `gps: data.gps,` to the object — order doesn't matter functionally; place near other deductions for readability.

- [ ] **Step 3: Persist `gps` in the upsert payload**

Find the upsert object (around line 110, where it has `reference_month`, `base_salary`, etc). Add `gps: data.gps,` near the other deduction fields.

- [ ] **Step 4: Run typecheck**

Run: `npx tsc --noEmit`.
Expected: only failure remaining is the form not providing `gps`. Note errors in `payroll-row-form.tsx`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/actions/payroll.ts
git commit -m "feat(payroll): persist gps and include in recalc"
```

---

### Task 6: Payroll form — render `GPS` field

**Files:**
- Modify: `src/components/rh/payroll/payroll-row-form.tsx`

- [ ] **Step 1: Add `gps` to `FormState`**

Find the `FormState` type (around line 17). Add `gps: number;` after `advance: number;` (line 31), keeping deduction fields grouped.

- [ ] **Step 2: Init `gps` in `initial`**

Find the `initial` `useMemo` (around line 52). Add this entry after the `advance: num(row.advance)` line:

```ts
gps: num(row.gps ?? row.employees?.gps_default ?? 0),
```

- [ ] **Step 3: Pass `gps` into `calcInput`**

Find the `calcInput: CalcInput` literal (around line 92). Add `gps: state.gps,` after `advance: state.advance,`.

- [ ] **Step 4: Render `<NumberField>` after Adiantamento**

Find the Adiantamento field (around line 252):
```tsx
<NumberField label="Adiantamento" name="advance" value={state.advance} onChange={setNum("advance")} disabled={disabled} />
```

Add immediately after it, before Vale transporte:
```tsx
<NumberField label="GPS" name="gps" value={state.gps} onChange={setNum("gps")} disabled={disabled} />
```

- [ ] **Step 5: Typecheck and run dev server**

Run: `npx tsc --noEmit`.
Expected: passes.

Run dev server (`npm run dev` per repo convention), open a payroll row in the browser, confirm:
- GPS field shows immediately after Adiantamento.
- Default value matches `employees.gps_default` (0 for now since no one has set it).
- Editing the value updates `Subtotal descontos`.

If you can't run the browser test, say so in the report — do not claim success.

- [ ] **Step 6: Commit**

```bash
git add src/components/rh/payroll/payroll-row-form.tsx
git commit -m "feat(payroll): render gps field after adiantamento"
```

---

### Task 7: Employee form — `gps_default` field

**Files:**
- Modify: `src/components/rh/employee-form.tsx`

- [ ] **Step 1: Read the current file**

Read the file fully to find where `salario_sem_dsr` and `aplica_dobra` inputs are rendered.

- [ ] **Step 2: Add `gps_default` input**

Add a numeric input mirroring `salario_sem_dsr`'s pattern (same label/styling). Field name: `gps_default`. Default value: `employee?.gps_default ?? 0`. Place it adjacent to `salario_sem_dsr` / `aplica_dobra` (these fields visually belong together).

- [ ] **Step 3: Verify employee action persists `gps_default`**

Search for where the employee form action writes to Supabase (likely `src/lib/actions/rh.ts`). Confirm the validated payload from Task 3's schema is forwarded to `.upsert(...)` / `.update(...)`. If it filters fields explicitly, add `gps_default`.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`.
Expected: passes.

- [ ] **Step 5: Manual UI check**

Open employee edit page, set `gps_default` to a non-zero value (e.g. 250), save. Reopen the payroll form for that employee on a row where `payroll.gps IS NULL` — GPS field should initialize to 250.

If you can't run the browser test, say so explicitly.

- [ ] **Step 6: Commit**

```bash
git add src/components/rh/employee-form.tsx src/lib/actions/rh.ts
git commit -m "feat(rh): employee form gps_default field"
```

---

## Self-Review

**Spec coverage:**
- Schema (`employees.gps_default`, `payroll.gps`) → Task 1 ✓
- Calculator sums GPS in deductions → Task 2 ✓
- Validation (`gps`, `gps_default`) → Task 3 ✓
- Data layer (`PayrollRowJoined`, select) → Task 4 ✓
- Action persists GPS, recalc uses it → Task 5 ✓
- Form GPS field after Adiantamento with inheritance fallback → Task 6 ✓
- Employee form GPS default → Task 7 ✓
- "Fora de escopo" items (cálculo automático, import xlsx, histórico, boleto) not touched ✓

**Placeholder scan:** Every step has explicit code or commands. No "implement later" stubs. Task 7 Step 2 says "mirroring salario_sem_dsr's pattern" — that's a structural reference, not a placeholder, since the actual file isn't shown here.

**Type consistency:**
- `gps: number;` (required) on `PayrollInput` and `FormState`. ✓
- `gps: number | null;` (nullable) on `PayrollRowJoined`. ✓
- `gps_default: number | null;` (nullable) on `PayrollRowJoined.employees`. ✓
- `gps` flows: form → action `data.gps` → `calcInput.gps` → upsert payload → DB. ✓
- `gps_default`: employee form → rh action → `employees.gps_default` → joined into payroll form → fallback when `row.gps` is null. ✓

Plan complete.
