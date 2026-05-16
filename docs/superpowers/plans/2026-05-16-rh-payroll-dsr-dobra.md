# RH Payroll — DSR + Dobra Mensal — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `salario_sem_dsr` + `aplica_dobra` as contractual inputs in employees + payroll. UI replaces `base_salary` input with live-derived breakdown (s/DSR → DSR → base → total). `base_salary` continues persisted as derived/cache value.

**Architecture:** Migration adds 4 columns (2 in employees, 2 in payroll). Pure calculator functions for DSR/base/total. Form payroll switches primary input to `salario_sem_dsr` with live readonly derived fields. Server action recomputes `base_salary` from s/DSR before persisting. `generateMonthAction` inherits s/DSR + dobra from last prior payroll OR from employee defaults.

**Tech Stack:** Next.js 14 App Router, React 18, Supabase SSR, Zod, TypeScript, Tailwind.

**Spec:** `docs/superpowers/specs/2026-05-16-rh-payroll-dsr-dobra-design.md`

---

## File Structure

**Migration:**
- Create: `supabase/migrations/202605240003_dsr_dobra.sql`

**Calculators (extend):**
- Modify: `src/lib/payroll/calculators.ts` (add `calcDSR`, `calcBaseFromSemDsr`, `calcProventosBase`; extend `PayrollInput`; tweak `calcAll` to derive `base_salary` from s/DSR when present)

**Validation (extend):**
- Modify: `src/lib/validation/payroll.ts` (add 2 fields to `PayrollSchema`)
- Modify: `src/lib/validation/rh.ts` (add 2 fields to `EmployeeSchema` + `EmployeeUpdateSchema`)

**Data layer (extend types + selects):**
- Modify: `src/lib/data/rh.ts` (Employee type, list/get selects)
- Modify: `src/lib/data/payroll.ts` (PayrollRow type, list/get selects)

**Server actions (extend):**
- Modify: `src/lib/actions/payroll.ts` (`upsertPayrollAction`, `generateMonthAction`, `syncNewEmployeesAction`)
- Modify: `src/lib/actions/rh.ts` (`createEmployeeAction`, `updateEmployeeAction`, `readEmployeeForm`)

**UI (extend forms):**
- Modify: `src/components/rh/employee-form.tsx` (add s/DSR field + dobra checkbox)
- Modify: `src/components/rh/payroll/payroll-row-form.tsx` (rearrange Card Proventos)

---

## Task 1: Migration — DSR + dobra columns

**Files:**
- Create: `supabase/migrations/202605240003_dsr_dobra.sql`

- [ ] **Step 1: Create migration file**

File: `supabase/migrations/202605240003_dsr_dobra.sql`

```sql
-- employees: dados contratuais default
alter table public.employees
  add column if not exists salario_sem_dsr numeric(10,2) default 0,
  add column if not exists aplica_dobra boolean default false;

-- payroll: override mensal (NULL = não preenchido; preenchido após save)
alter table public.payroll
  add column if not exists salario_sem_dsr numeric(10,2),
  add column if not exists aplica_dobra boolean;
```

- [ ] **Step 2: Apply**

Run:
```
docker exec -i supabase_db_rrb-escola psql -U postgres -d postgres < supabase/migrations/202605240003_dsr_dobra.sql
```

Expected: ALTER TABLE × 2 (no errors).

- [ ] **Step 3: Verify columns**

Run:
```
docker exec -i supabase_db_rrb-escola psql -U postgres -d postgres -c "select table_name, column_name from information_schema.columns where table_schema='public' and column_name in ('salario_sem_dsr','aplica_dobra') order by table_name, column_name;"
```

Expected: 4 rows (employees.aplica_dobra, employees.salario_sem_dsr, payroll.aplica_dobra, payroll.salario_sem_dsr).

- [ ] **Step 4: Commit**

```bash
cd c:/Desenv/Projetos/rrb-escola
git add supabase/migrations/202605240003_dsr_dobra.sql
git commit -m "feat(payroll): migration salario_sem_dsr + aplica_dobra columns"
```

---

## Task 2: Calculator — DSR helpers + extend calcAll

**Files:**
- Modify: `src/lib/payroll/calculators.ts`

- [ ] **Step 1: Add 3 pure helper functions**

Open `src/lib/payroll/calculators.ts`. After the existing `round2` function and before `calcINSS`, insert:

```ts
export function calcDSR(salarioSemDsr: number): number {
  if (salarioSemDsr <= 0) return 0;
  return round2(salarioSemDsr / 5);
}

export function calcBaseFromSemDsr(salarioSemDsr: number): number {
  if (salarioSemDsr <= 0) return 0;
  return round2(salarioSemDsr + calcDSR(salarioSemDsr));
}

export function calcProventosBase(salarioSemDsr: number, aplicaDobra: boolean): number {
  const base = calcBaseFromSemDsr(salarioSemDsr);
  return aplicaDobra ? round2(base * 2) : base;
}
```

- [ ] **Step 2: Extend PayrollInput type**

In same file, locate `export type PayrollInput = { ... }`. Add 2 optional fields at the end of the type (before the closing `}`):

```ts
  salario_sem_dsr?: number;
  aplica_dobra?: boolean;
```

- [ ] **Step 3: Update calcAll to derive base_salary from s/DSR when present**

Locate `export function calcAll(...)`. Before `const total_earnings = calcTotalEarnings(input);`, insert:

```ts
  if (input.salario_sem_dsr != null && input.salario_sem_dsr > 0) {
    input = { ...input, base_salary: calcProventosBase(input.salario_sem_dsr, input.aplica_dobra ?? false) };
  }
```

- [ ] **Step 4: Type check**

Run: `cd c:/Desenv/Projetos/rrb-escola && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
cd c:/Desenv/Projetos/rrb-escola
git add src/lib/payroll/calculators.ts
git commit -m "feat(payroll): calcDSR + calcBaseFromSemDsr + calcProventosBase + calcAll derive base_salary"
```

---

## Task 3: Validation — extend PayrollSchema

**Files:**
- Modify: `src/lib/validation/payroll.ts`

- [ ] **Step 1: Add 2 fields to PayrollSchema**

Open `src/lib/validation/payroll.ts`. Inside `PayrollSchema = z.object({ ... })`, add these 2 lines before the closing `})`:

```ts
  salario_sem_dsr: numericNonNeg.optional(),
  aplica_dobra: boolFromForm.optional(),
```

- [ ] **Step 2: Type check**

Run: `cd c:/Desenv/Projetos/rrb-escola && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
cd c:/Desenv/Projetos/rrb-escola
git add src/lib/validation/payroll.ts
git commit -m "feat(payroll): PayrollSchema accepts salario_sem_dsr + aplica_dobra"
```

---

## Task 4: Validation — extend Employee schemas

**Files:**
- Modify: `src/lib/validation/rh.ts`

- [ ] **Step 1: Add fields to EmployeeSchema**

Open `src/lib/validation/rh.ts`. Locate `EmployeeSchema = z.object({ ... })`. Add inside the object (before closing `})`):

```ts
  salario_sem_dsr: z.preprocess(
    (v) => {
      if (v === "" || v == null) return 0;
      if (typeof v === "string") return Number(v.replace(",", "."));
      return v;
    },
    z.number().min(0)
  ).optional(),
  aplica_dobra: z.preprocess((v) => v === "on" || v === true, z.boolean()).optional(),
```

`EmployeeUpdateSchema` extends `EmployeeSchema` already (per Phase 1 implementation), so the new fields propagate automatically. Confirm by reading the file — if `EmployeeUpdateSchema` is defined as `EmployeeSchema.extend({...})`, no additional change is needed.

- [ ] **Step 2: Type check**

Run: `cd c:/Desenv/Projetos/rrb-escola && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
cd c:/Desenv/Projetos/rrb-escola
git add src/lib/validation/rh.ts
git commit -m "feat(rh): EmployeeSchema accepts salario_sem_dsr + aplica_dobra"
```

---

## Task 5: Data layer — Employee fields

**Files:**
- Modify: `src/lib/data/rh.ts`

- [ ] **Step 1: Extend Employee type**

Open `src/lib/data/rh.ts`. Locate `export type Employee = { ... }`. Add 2 fields before the optional `companies` join:

```ts
  salario_sem_dsr: number | null;
  aplica_dobra: boolean | null;
```

- [ ] **Step 2: Update select strings**

In the same file, locate the `.select("...")` strings in `listEmployees` and `getEmployeeById`. Both currently include:
```
"id, company_id, cpf, name, birth_date, hire_date, school_category, email, telefone, cargo, status_contrato, ativo, companies(id, name, cnpj)"
```

Replace with:
```
"id, company_id, cpf, name, birth_date, hire_date, school_category, email, telefone, cargo, status_contrato, ativo, salario_sem_dsr, aplica_dobra, companies(id, name, cnpj)"
```

Apply to both functions.

- [ ] **Step 3: Type check**

Run: `cd c:/Desenv/Projetos/rrb-escola && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
cd c:/Desenv/Projetos/rrb-escola
git add src/lib/data/rh.ts
git commit -m "feat(rh): Employee type + queries include salario_sem_dsr + aplica_dobra"
```

---

## Task 6: Data layer — PayrollRow fields + employee join

**Files:**
- Modify: `src/lib/data/payroll.ts`

- [ ] **Step 1: Extend PayrollRow type**

Open `src/lib/data/payroll.ts`. Locate `export type PayrollRow = { ... }`. Add inside the type (after `dependentes: number | null;`):

```ts
  salario_sem_dsr: number | null;
  aplica_dobra: boolean | null;
```

- [ ] **Step 2: Update select strings to include payroll columns + employee defaults**

Both `listPayrollByMonth` and `getPayrollByEmployeeMonth` build a `.select(\`...\`)` string. Find each occurrence of the payroll columns list. The original includes:

```
... dependentes, total_earnings, inss, ir, inss_manual, ir_manual, ...
```

Insert `salario_sem_dsr, aplica_dobra,` after `dependentes,`. So the column list becomes:

```
... dependentes, salario_sem_dsr, aplica_dobra, total_earnings, inss, ir, inss_manual, ir_manual, ...
```

For the `employees(...)` join in both selects, the existing fields are:
```
employees!inner(id, name, cpf, cargo, school_category, ativo, company_id, companies(id, name, cnpj))
```

Replace with:
```
employees!inner(id, name, cpf, cargo, school_category, ativo, company_id, salario_sem_dsr, aplica_dobra, companies(id, name, cnpj))
```

For `getPayrollByEmployeeMonth`, the join also has `hire_date, birth_date`. Insert `salario_sem_dsr, aplica_dobra,` alongside, so it reads:
```
employees!inner(id, name, cpf, cargo, school_category, ativo, company_id, hire_date, birth_date, salario_sem_dsr, aplica_dobra, companies(id, name, cnpj))
```

- [ ] **Step 3: Extend the `employees` join type in PayrollRowJoined**

In the same file, locate `export type PayrollRowJoined = PayrollRow & { employees: { ... } | null; }`. Inside the inline employees object, add 2 fields:

```ts
    salario_sem_dsr: number | null;
    aplica_dobra: boolean | null;
```

- [ ] **Step 4: Type check**

Run: `cd c:/Desenv/Projetos/rrb-escola && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
cd c:/Desenv/Projetos/rrb-escola
git add src/lib/data/payroll.ts
git commit -m "feat(payroll): PayrollRow type + queries include s/DSR + dobra (incl. employee join)"
```

---

## Task 7: Server action — employee CRUD reads new fields

**Files:**
- Modify: `src/lib/actions/rh.ts`

- [ ] **Step 1: Update readEmployeeForm to read new fields**

Open `src/lib/actions/rh.ts`. Locate `function readEmployeeForm(formData: FormData)`. Add 2 lines inside the returned object (before the closing `}`):

```ts
    salario_sem_dsr: formData.get("salario_sem_dsr"),
    aplica_dobra: formData.get("aplica_dobra"),
```

- [ ] **Step 2: Update createEmployeeAction insert payload**

In the same file, locate `createEmployeeAction`. Inside the `.insert({...})` call, add 2 fields before the closing `}`:

```ts
    salario_sem_dsr: parsed.data.salario_sem_dsr ?? 0,
    aplica_dobra: parsed.data.aplica_dobra ?? false,
```

- [ ] **Step 3: Update updateEmployeeAction update payload**

In the same file, locate `updateEmployeeAction`. Inside `.update({...})`, add 2 fields before the closing `}`:

```ts
      salario_sem_dsr: parsed.data.salario_sem_dsr ?? 0,
      aplica_dobra: parsed.data.aplica_dobra ?? false,
```

- [ ] **Step 4: Type check**

Run: `cd c:/Desenv/Projetos/rrb-escola && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
cd c:/Desenv/Projetos/rrb-escola
git add src/lib/actions/rh.ts
git commit -m "feat(rh): employee CRUD persists salario_sem_dsr + aplica_dobra"
```

---

## Task 8: Server action — upsertPayrollAction derives base + persists fields

**Files:**
- Modify: `src/lib/actions/payroll.ts`

- [ ] **Step 1: Update readPayrollForm**

Open `src/lib/actions/payroll.ts`. Locate `function readPayrollForm(formData: FormData)`. Add 2 lines inside returned object (before closing `}`):

```ts
    salario_sem_dsr: get("salario_sem_dsr"),
    aplica_dobra: get("aplica_dobra"),
```

- [ ] **Step 2: Import calcProventosBase**

At top of file, find the import from `@/lib/payroll/calculators`. Currently:
```ts
import { calcAll, type PayrollInput as CalcInput } from "@/lib/payroll/calculators";
```
Replace with:
```ts
import { calcAll, calcProventosBase, type PayrollInput as CalcInput } from "@/lib/payroll/calculators";
```

- [ ] **Step 3: Derive base_salary from s/DSR in upsertPayrollAction**

Locate `upsertPayrollAction`. Find the block where `calcInput` is built. Currently starts with:
```ts
  const calcInput: CalcInput = {
    base_salary: data.base_salary,
```

Replace with:
```ts
  const semDsr = data.salario_sem_dsr ?? 0;
  const dobra = data.aplica_dobra ?? false;
  const baseDerivada = semDsr > 0 ? calcProventosBase(semDsr, dobra) : data.base_salary;

  const calcInput: CalcInput = {
    base_salary: baseDerivada,
    salario_sem_dsr: semDsr,
    aplica_dobra: dobra,
```

(Keep all the other fields the same — the change above just substitutes `base_salary` value and adds 2 new entries at the start of the object.)

- [ ] **Step 4: Persist new fields + derived base_salary in upsert**

In the same `upsertPayrollAction`, find the `.upsert({...})` call. The current payload has `base_salary: data.base_salary,`. Replace that line with:

```ts
        base_salary: baseDerivada,
        salario_sem_dsr: semDsr,
        aplica_dobra: dobra,
```

- [ ] **Step 5: Type check**

Run: `cd c:/Desenv/Projetos/rrb-escola && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
cd c:/Desenv/Projetos/rrb-escola
git add src/lib/actions/payroll.ts
git commit -m "feat(payroll): upsertPayrollAction derives base_salary from s/DSR + persists fields"
```

---

## Task 9: Server action — generateMonthAction + syncNewEmployeesAction inherit fields

**Files:**
- Modify: `src/lib/actions/payroll.ts`

- [ ] **Step 1: Update generateMonthAction inheritance logic**

In `src/lib/actions/payroll.ts`, locate `generateMonthAction`. Find the block that builds `priorRows` query and `prevMap`. The current select string is:

```ts
    .select("employee_id, reference_month, base_salary, dependentes, vale_transporte, vale_alimentacao")
```

Replace with:

```ts
    .select("employee_id, reference_month, base_salary, dependentes, vale_transporte, vale_alimentacao, salario_sem_dsr, aplica_dobra")
```

Update the `prevMap` type signature and population. Replace the existing:

```ts
  const prevMap = new Map<string, { base_salary: number; dependentes: number; vale_transporte: number; vale_alimentacao: number }>();
  for (const p of priorRows ?? []) {
    if (prevMap.has(p.employee_id)) continue;
    prevMap.set(p.employee_id, {
      base_salary: Number(p.base_salary ?? 0),
      dependentes: Number(p.dependentes ?? 0),
      vale_transporte: Number(p.vale_transporte ?? 0),
      vale_alimentacao: Number(p.vale_alimentacao ?? 0)
    });
  }
```

With:

```ts
  const prevMap = new Map<string, { base_salary: number; dependentes: number; vale_transporte: number; vale_alimentacao: number; salario_sem_dsr: number | null; aplica_dobra: boolean | null }>();
  for (const p of priorRows ?? []) {
    if (prevMap.has(p.employee_id)) continue;
    prevMap.set(p.employee_id, {
      base_salary: Number(p.base_salary ?? 0),
      dependentes: Number(p.dependentes ?? 0),
      vale_transporte: Number(p.vale_transporte ?? 0),
      vale_alimentacao: Number(p.vale_alimentacao ?? 0),
      salario_sem_dsr: p.salario_sem_dsr != null ? Number(p.salario_sem_dsr) : null,
      aplica_dobra: p.aplica_dobra
    });
  }
```

- [ ] **Step 2: Fetch employee defaults for fallback**

Right after the employees query block (where `employees` is fetched ativo=true), add a fetch of contractual defaults. Replace the existing employees query:

```ts
  const { data: employees, error: empErr } = await supabase
    .from("employees")
    .select("id")
    .eq("ativo", true);
```

With:

```ts
  const { data: employees, error: empErr } = await supabase
    .from("employees")
    .select("id, salario_sem_dsr, aplica_dobra")
    .eq("ativo", true);
```

- [ ] **Step 3: Use inherited or default values when building rows**

In the same function, locate the block `const rows = (employees ?? []).map((e) => { ... })`. Replace the entire block with:

```ts
  const rows = (employees ?? []).map((e) => {
    const prev = prevMap.get(e.id);
    const empSemDsr = Number(e.salario_sem_dsr ?? 0);
    const empDobra = e.aplica_dobra ?? false;
    const semDsr = prev?.salario_sem_dsr ?? (empSemDsr > 0 ? empSemDsr : null);
    const dobra = prev?.aplica_dobra ?? empDobra;
    const baseFromSemDsr = semDsr != null && semDsr > 0
      ? calcProventosBase(semDsr, dobra ?? false)
      : null;
    const base_salary = baseFromSemDsr ?? prev?.base_salary ?? 0;
    return {
      employee_id: e.id,
      reference_month: dbMonth,
      base_salary,
      salario_sem_dsr: semDsr,
      aplica_dobra: dobra,
      dependentes: prev?.dependentes ?? 0,
      vale_transporte: prev?.vale_transporte ?? 0,
      vale_alimentacao: prev?.vale_alimentacao ?? 0,
      total_earnings: base_salary,
      total_deductions: 0,
      net_amount: base_salary
    };
  });
```

- [ ] **Step 4: Update syncNewEmployeesAction**

Find `syncNewEmployeesAction`. The current code fetches actives with `.select("id")` and builds rows with all zeros. Replace the actives query:

```ts
  const { data: actives } = await supabase
    .from("employees")
    .select("id")
    .eq("ativo", true);
```

With:

```ts
  const { data: actives } = await supabase
    .from("employees")
    .select("id, salario_sem_dsr, aplica_dobra")
    .eq("ativo", true);
```

Then replace the `newRows` construction:

```ts
  const newRows = (actives ?? [])
    .filter((e) => !existingIds.has(e.id))
    .map((e) => ({
      employee_id: e.id,
      reference_month: dbMonth,
      base_salary: 0,
      total_earnings: 0,
      total_deductions: 0,
      net_amount: 0
    }));
```

With:

```ts
  const newRows = (actives ?? [])
    .filter((e) => !existingIds.has(e.id))
    .map((e) => {
      const empSemDsr = Number(e.salario_sem_dsr ?? 0);
      const empDobra = e.aplica_dobra ?? false;
      const base = empSemDsr > 0 ? calcProventosBase(empSemDsr, empDobra) : 0;
      return {
        employee_id: e.id,
        reference_month: dbMonth,
        base_salary: base,
        salario_sem_dsr: empSemDsr > 0 ? empSemDsr : null,
        aplica_dobra: empDobra,
        total_earnings: base,
        total_deductions: 0,
        net_amount: base
      };
    });
```

- [ ] **Step 5: Type check**

Run: `cd c:/Desenv/Projetos/rrb-escola && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
cd c:/Desenv/Projetos/rrb-escola
git add src/lib/actions/payroll.ts
git commit -m "feat(payroll): generateMonth + syncNewEmployees inherit s/DSR + dobra"
```

---

## Task 10: UI — employee-form.tsx adds DSR + dobra fields

**Files:**
- Modify: `src/components/rh/employee-form.tsx`

- [ ] **Step 1: Add `useState` for salario_sem_dsr (already client component with useState)**

Open `src/components/rh/employee-form.tsx`. Locate the existing `useState` declarations near the top of the component (after the `cpf` + `telefone` state). Add:

```ts
  const [salarioSemDsr, setSalarioSemDsr] = useState<string>(
    employee?.salario_sem_dsr != null ? String(employee.salario_sem_dsr) : ""
  );
```

- [ ] **Step 2: Add JSX fields**

Locate the existing `<label>Status do contrato<select name="status_contrato">...</select></label>` block. After it (before the closing `</form>` and the submit button), add a new group:

```tsx
      <label>
        Salário s/ DSR
        <input
          name="salario_sem_dsr"
          type="number"
          step="0.01"
          min="0"
          value={salarioSemDsr}
          onChange={(e) => setSalarioSemDsr(e.target.value)}
          placeholder="0,00"
        />
      </label>

      <label className="flex grid-cols-none items-center gap-2 self-end pb-3">
        <input
          name="aplica_dobra"
          type="checkbox"
          defaultChecked={employee?.aplica_dobra ?? false}
          className="h-4 w-4"
        />
        Aplica dobra mensal
      </label>
```

- [ ] **Step 3: Type check**

Run: `cd c:/Desenv/Projetos/rrb-escola && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Smoke**

Start dev: `npm run dev`. Navigate `/rh/funcionarios/novo`. Form shows new fields. Edit existing funcionário: fields prefill from DB.

- [ ] **Step 5: Commit**

```bash
cd c:/Desenv/Projetos/rrb-escola
git add src/components/rh/employee-form.tsx
git commit -m "feat(rh): employee-form adds Salário s/ DSR + aplica dobra"
```

---

## Task 11: UI — payroll-row-form Proventos rearrange (live DSR/base/total)

**Files:**
- Modify: `src/components/rh/payroll/payroll-row-form.tsx`

- [ ] **Step 1: Extend FormState type**

Open `src/components/rh/payroll/payroll-row-form.tsx`. Locate `type FormState = { ... }`. Add 2 fields (before `consider_decimo_terceiro`):

```ts
  salario_sem_dsr: number;
  aplica_dobra: boolean;
```

- [ ] **Step 2: Extend initial state with inheritance lookup**

Locate the `initial: FormState = useMemo(() => ({ ... }), [row])` block. Inside the returned object, add (before `consider_decimo_terceiro`):

```ts
      salario_sem_dsr: num(
        row.salario_sem_dsr ?? row.employees?.salario_sem_dsr ?? 0
      ),
      aplica_dobra:
        row.aplica_dobra ?? row.employees?.aplica_dobra ?? false,
```

- [ ] **Step 3: Import new calculators**

At top of file, locate the import from `@/lib/payroll/calculators`. Currently:
```ts
import { calcAll, type InssBracket, type IrBracket, type PayrollInput as CalcInput } from "@/lib/payroll/calculators";
```
Replace with:
```ts
import { calcAll, calcDSR, calcBaseFromSemDsr, calcProventosBase, type InssBracket, type IrBracket, type PayrollInput as CalcInput } from "@/lib/payroll/calculators";
```

- [ ] **Step 4: Compute derived values in component body**

Locate the line `const calcInput: CalcInput = { base_salary: state.base_salary, ... }`. Replace the entire `const calcInput` declaration with:

```ts
  const derivedBase =
    state.salario_sem_dsr > 0
      ? calcProventosBase(state.salario_sem_dsr, state.aplica_dobra)
      : state.base_salary;

  const calcInput: CalcInput = {
    base_salary: derivedBase,
    salario_sem_dsr: state.salario_sem_dsr,
    aplica_dobra: state.aplica_dobra,
    horas_extras: state.horas_extras,
    gratificacao: state.gratificacao,
    comissao: state.comissao,
    adicional_noturno: state.adicional_noturno,
    periculosidade: state.periculosidade,
    insalubridade: state.insalubridade,
    outros_proventos: state.outros_proventos,
    family_allowance: state.family_allowance,
    vale_transporte: state.vale_transporte,
    vale_alimentacao: state.vale_alimentacao,
    outros_descontos: state.outros_descontos,
    loan_deduction: state.loan_deduction,
    advance: state.advance,
    uniform_value: state.uniform_value,
    dependentes: state.dependentes
  };
```

- [ ] **Step 5: Replace "Salário base" input with s/DSR + derived block in Card Proventos**

Locate the Card Proventos (`<Panel ...><h3>...Proventos</h3>...`). Find the line:

```tsx
          <NumberField label="Salário base" name="base_salary" value={state.base_salary} onChange={setNum("base_salary")} disabled={disabled} required />
```

Replace with:

```tsx
          <NumberField
            label="Salário s/ DSR"
            name="salario_sem_dsr"
            value={state.salario_sem_dsr}
            onChange={setNum("salario_sem_dsr")}
            disabled={disabled}
          />
          <div className="grid gap-1 text-xs text-ink/65">
            <div className="flex justify-between">
              <span>DSR (1/5)</span>
              <span className="tabular-nums">{money.format(calcDSR(state.salario_sem_dsr))}</span>
            </div>
            <div className="flex justify-between">
              <span>Salário base</span>
              <span className="tabular-nums">{money.format(calcBaseFromSemDsr(state.salario_sem_dsr))}</span>
            </div>
          </div>
          <label className="inline-flex items-center gap-2 text-sm mt-1">
            <input
              name="aplica_dobra"
              type="checkbox"
              checked={state.aplica_dobra}
              onChange={(e) => set("aplica_dobra", e.target.checked)}
              disabled={disabled}
              className="h-4 w-4 accent-brand"
            />
            Aplica dobra mensal
          </label>
          <div className="flex justify-between text-sm font-bold border-t border-line pt-2 mt-1">
            <span className="text-ink/70">Total base</span>
            <span className="text-success tabular-nums">{money.format(derivedBase)}</span>
          </div>
          <input type="hidden" name="base_salary" value={derivedBase} />
```

The hidden `base_salary` input ensures the form submits the derived value (server recomputes anyway, but UI consistency).

- [ ] **Step 6: Type check**

Run: `cd c:/Desenv/Projetos/rrb-escola && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 7: Smoke**

Start dev. Open `/rh/folha/<mes>/<employee_id>` for Ana (after setting her `salario_sem_dsr=2304.75` + `aplica_dobra=true` in employee form). Verify:
- s/DSR field shows 2304.75
- DSR shows R$ 460,95
- Salário base shows R$ 2.765,70
- Checkbox dobra marcado
- Total base shows R$ 5.531,40
- INSS ≈ R$ 583,99, IR ≈ R$ 451,81, Líquido ≈ R$ 4.495,60
- Editar s/DSR → DSR/base/total atualizam live
- Toggle dobra → total base muda live
- Salvar persiste

- [ ] **Step 8: Commit**

```bash
cd c:/Desenv/Projetos/rrb-escola
git add src/components/rh/payroll/payroll-row-form.tsx
git commit -m "feat(payroll): row form switches base to s/DSR with live DSR/base/total"
```

---

## Task 12: Final integration smoke test

- [ ] **Step 1: Full type check**

Run: `cd c:/Desenv/Projetos/rrb-escola && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 2: End-to-end Ana Flávia scenario**

1. Start dev: `npm run dev`
2. Login admin
3. Navigate `/rh/funcionarios`, find "Ana Flávia de Jesus Luciano", click Editar
4. Fill `Salário s/ DSR` = `2304.75`, check `Aplica dobra mensal`, save
5. Navigate `/rh/folha/2026-05` (or current month). If folha já gerada com base_salary=0, edit Ana Flávia → preencher s/DSR → salvar; senão, click "Gerar folha" para popular automaticamente
6. Open Ana row → verify all derived values match spec table
7. Verify INSS/IR/líquido reflect tabela 2026 oficial
8. Download holerite PDF — verify Salário base mostra valor consolidado correto

- [ ] **Step 3: Regression check**

- [ ] Funcionário sem `salario_sem_dsr` cadastrado (qualquer outro): form payroll abre com s/DSR=0, derived base=0, mas `base_salary` legacy continua editável via field hidden — admin pode usar legacy mode
- [ ] generateMonth de mês novo: novos payrolls herdam s/DSR + dobra automaticamente
- [ ] syncNewEmployees: idem
- [ ] Toggle dobra mid-month: total recalcula; INSS/IR recalculam via brackets

- [ ] **Step 4: Commit fixes (if any)**

```bash
# Only if issues found and corrected
git add -A
git commit -m "fix(payroll): smoke test fixes for DSR + dobra"
```

---

## Spec coverage check

| Spec section | Task |
|--------------|------|
| Migration (4 colunas) | Task 1 |
| Calculator: calcDSR, calcBaseFromSemDsr, calcProventosBase | Task 2 |
| calcAll derives base_salary from s/DSR | Task 2 |
| PayrollSchema accepts s/DSR + dobra | Task 3 |
| EmployeeSchema accepts s/DSR + dobra | Task 4 |
| Data layer Employee type + queries | Task 5 |
| Data layer PayrollRow type + queries + employee join | Task 6 |
| Employee CRUD persists fields | Task 7 |
| upsertPayrollAction derives + persists | Task 8 |
| generateMonth inheritance | Task 9 |
| syncNewEmployees inheritance | Task 9 |
| employee-form UI (s/DSR + dobra) | Task 10 |
| payroll-row-form UI (s/DSR replaces base, live derived, total base) | Task 11 |
| Smoke test Ana Flávia case | Task 12 |
| Backwards compat (legacy s/DSR=0) | Tasks 8, 11, 12 |

All spec sections covered.
