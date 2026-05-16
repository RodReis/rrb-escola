# RH Fase 2 — Folha de Pagamento — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build monthly payroll system with live calc, hybrid INSS/IR (auto+manual), period lock, brackets admin UI, holerite PDF, and XLSX export.

**Architecture:** Pure-function calculators shared between client (live UI) and server (validate before persist). Server Components for pages + Server Actions for mutations. Brackets in DB editable via admin UI. Period status table locks edits.

**Tech Stack:** Next.js 14 App Router, React 18, Supabase SSR, Zod, jspdf+jspdf-autotable, exceljs, TypeScript, Tailwind, Lucide.

**Spec:** `docs/superpowers/specs/2026-05-16-rh-folha-pagamento-design.md`

---

## File Structure

**Migration:**
- Create: `supabase/migrations/202605240001_payroll_v2.sql`
- Create: `supabase/migrations/202605240002_brackets_seed.sql`

**Calculators (pure functions, no DB):**
- Create: `src/lib/payroll/calculators.ts`

**Data layer:**
- Create: `src/lib/data/payroll.ts`
- Create: `src/lib/data/brackets.ts`

**Server actions:**
- Create: `src/lib/actions/payroll.ts`
- Create: `src/lib/actions/brackets.ts`

**Validation:**
- Create: `src/lib/validation/payroll.ts`

**Date helpers (small, focused):**
- Create: `src/lib/payroll/date-utils.ts`

**Components (`src/components/rh/payroll/`):**
- Create: `month-nav.tsx`
- Create: `generate-month-button.tsx`
- Create: `close-period-button.tsx`
- Create: `payroll-month-table.tsx`
- Create: `payroll-summary-card.tsx`
- Create: `payroll-row-form.tsx`
- Create: `holerite-pdf-button.tsx`
- Create: `export-month-buttons.tsx`

**Brackets components (`src/components/rh/brackets/`):**
- Create: `brackets-table.tsx`
- Create: `brackets-form.tsx`
- Create: `new-vigencia-button.tsx`

**Pages:**
- Create: `src/app/(app)/rh/folha/page.tsx`
- Create: `src/app/(app)/rh/folha/[mes]/page.tsx`
- Create: `src/app/(app)/rh/folha/[mes]/[employee_id]/page.tsx`
- Create: `src/app/(app)/rh/brackets/page.tsx`

**Topbar update:**
- Modify: `src/components/layout/rh-dropdown.tsx` (add Folha + Brackets items)

---

## Task 1: Migration — payroll_v2 schema

**Files:**
- Create: `supabase/migrations/202605240001_payroll_v2.sql`

- [ ] **Step 1: Create migration file**

File: `supabase/migrations/202605240001_payroll_v2.sql`

```sql
-- INSS progressive brackets
create table if not exists public.inss_brackets (
  id uuid primary key default gen_random_uuid(),
  vigencia_inicio date not null,
  ordem int not null,
  valor_de numeric(10,2) not null,
  valor_ate numeric(10,2),
  aliquota numeric(5,4) not null,
  parcela_deduzir numeric(10,2) not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (vigencia_inicio, ordem)
);

create index if not exists idx_inss_brackets_vigencia on public.inss_brackets (vigencia_inicio desc);

-- IRRF progressive brackets
create table if not exists public.ir_brackets (
  id uuid primary key default gen_random_uuid(),
  vigencia_inicio date not null,
  ordem int not null,
  valor_de numeric(10,2) not null,
  valor_ate numeric(10,2),
  aliquota numeric(5,4) not null,
  parcela_deduzir numeric(10,2) not null default 0,
  deducao_dependente numeric(10,2) default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (vigencia_inicio, ordem)
);

create index if not exists idx_ir_brackets_vigencia on public.ir_brackets (vigencia_inicio desc);

-- payroll periods lock
create table if not exists public.payroll_periods (
  id uuid primary key default gen_random_uuid(),
  reference_month date not null unique,
  status text not null default 'aberto' check (status in ('aberto','fechado')),
  closed_at timestamptz,
  closed_by uuid references auth.users(id),
  created_at timestamptz default now()
);

create index if not exists idx_payroll_periods_status on public.payroll_periods (status);

-- payroll extra columns
alter table public.payroll
  add column if not exists horas_extras numeric(10,2) default 0,
  add column if not exists gratificacao numeric(10,2) default 0,
  add column if not exists comissao numeric(10,2) default 0,
  add column if not exists adicional_noturno numeric(10,2) default 0,
  add column if not exists periculosidade numeric(10,2) default 0,
  add column if not exists insalubridade numeric(10,2) default 0,
  add column if not exists outros_proventos numeric(10,2) default 0,
  add column if not exists vale_transporte numeric(10,2) default 0,
  add column if not exists vale_alimentacao numeric(10,2) default 0,
  add column if not exists outros_descontos numeric(10,2) default 0,
  add column if not exists dependentes int default 0,
  add column if not exists inss_manual boolean default false,
  add column if not exists ir_manual boolean default false;

create index if not exists idx_payroll_reference_month on public.payroll (reference_month);

-- triggers updated_at
drop trigger if exists inss_brackets_updated_at on public.inss_brackets;
create trigger inss_brackets_updated_at before update on public.inss_brackets
for each row execute function public.set_updated_at();

drop trigger if exists ir_brackets_updated_at on public.ir_brackets;
create trigger ir_brackets_updated_at before update on public.ir_brackets
for each row execute function public.set_updated_at();
```

- [ ] **Step 2: Apply migration**

Run: `docker exec -i supabase_db_rrb-escola psql -U postgres -d postgres < supabase/migrations/202605240001_payroll_v2.sql`
Expected: CREATE TABLE × 3, CREATE INDEX × multiple, ALTER TABLE, CREATE TRIGGER × 2.

- [ ] **Step 3: Verify tables/columns exist**

Run:
```bash
docker exec -i supabase_db_rrb-escola psql -U postgres -d postgres -c "select tablename from pg_tables where schemaname='public' and tablename in ('inss_brackets','ir_brackets','payroll_periods') order by tablename;"
```
Expected: 3 rows.

Run:
```bash
docker exec -i supabase_db_rrb-escola psql -U postgres -d postgres -c "select column_name from information_schema.columns where table_schema='public' and table_name='payroll' and column_name in ('horas_extras','gratificacao','comissao','adicional_noturno','periculosidade','insalubridade','outros_proventos','vale_transporte','vale_alimentacao','outros_descontos','dependentes','inss_manual','ir_manual') order by column_name;"
```
Expected: 13 rows.

- [ ] **Step 4: Commit**

```bash
cd c:/Desenv/Projetos/rrb-escola
git add supabase/migrations/202605240001_payroll_v2.sql
git commit -m "feat(payroll): migration brackets + periods + extra columns"
```

---

## Task 2: Seed brackets INSS + IR 2026

**Files:**
- Create: `supabase/migrations/202605240002_brackets_seed.sql`

- [ ] **Step 1: Create seed file**

File: `supabase/migrations/202605240002_brackets_seed.sql`

```sql
-- INSS 2026 (vigencia 2026-01-01)
insert into public.inss_brackets (vigencia_inicio, ordem, valor_de, valor_ate, aliquota, parcela_deduzir)
values
  ('2026-01-01', 1,    0.00,  1518.00, 0.0750,   0.00),
  ('2026-01-01', 2, 1518.01,  2793.88, 0.0900,  22.77),
  ('2026-01-01', 3, 2793.89,  4190.83, 0.1200, 106.59),
  ('2026-01-01', 4, 4190.84,  8157.41, 0.1400, 190.40)
on conflict (vigencia_inicio, ordem) do nothing;

-- IRRF 2026 (vigencia 2026-01-01)
insert into public.ir_brackets (vigencia_inicio, ordem, valor_de, valor_ate, aliquota, parcela_deduzir, deducao_dependente)
values
  ('2026-01-01', 1,    0.00, 2428.80, 0.0000,   0.00, 189.59),
  ('2026-01-01', 2, 2428.81, 2826.65, 0.0750, 182.16, 189.59),
  ('2026-01-01', 3, 2826.66, 3751.05, 0.1500, 394.16, 189.59),
  ('2026-01-01', 4, 3751.06, 4664.68, 0.2250, 675.49, 189.59),
  ('2026-01-01', 5, 4664.69,    NULL, 0.2750, 908.73, 189.59)
on conflict (vigencia_inicio, ordem) do nothing;
```

- [ ] **Step 2: Apply seed**

Run: `docker exec -i supabase_db_rrb-escola psql -U postgres -d postgres < supabase/migrations/202605240002_brackets_seed.sql`
Expected: `INSERT 0 4` + `INSERT 0 5`.

- [ ] **Step 3: Verify**

Run:
```bash
docker exec -i supabase_db_rrb-escola psql -U postgres -d postgres -c "select count(*) inss from inss_brackets; select count(*) ir from ir_brackets;"
```
Expected: 4 and 5.

- [ ] **Step 4: Commit**

```bash
cd c:/Desenv/Projetos/rrb-escola
git add supabase/migrations/202605240002_brackets_seed.sql
git commit -m "feat(payroll): seed INSS+IR brackets 2026"
```

---

## Task 3: Date utils helper

**Files:**
- Create: `src/lib/payroll/date-utils.ts`

- [ ] **Step 1: Create file**

File: `src/lib/payroll/date-utils.ts`

```ts
// Mês de referência sempre representado como YYYY-MM-01 (primeiro dia)
// no banco. Na URL usamos YYYY-MM. Helpers para conversão e navegação.

const MESES_PT = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];
const MESES_PT_ABBR = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export function urlToDbMonth(urlMonth: string): string {
  // "2026-05" -> "2026-05-01"
  return `${urlMonth}-01`;
}

export function dbToUrlMonth(dbMonth: string): string {
  // "2026-05-01" -> "2026-05"
  return dbMonth.slice(0, 7);
}

export function currentUrlMonth(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export function isValidUrlMonth(urlMonth: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(urlMonth);
}

export function shiftUrlMonth(urlMonth: string, deltaMonths: number): string {
  const [y, m] = urlMonth.split("-").map(Number);
  const d = new Date(Date.UTC(y, (m - 1) + deltaMonths, 1));
  const yy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${yy}-${mm}`;
}

export function monthLabel(urlMonth: string): string {
  const [y, m] = urlMonth.split("-").map(Number);
  return `${MESES_PT[m - 1]} ${y}`;
}

export function monthLabelShort(urlMonth: string): string {
  const [y, m] = urlMonth.split("-").map(Number);
  return `${MESES_PT_ABBR[m - 1]}/${y}`;
}
```

- [ ] **Step 2: Type check**

Run: `cd c:/Desenv/Projetos/rrb-escola && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
cd c:/Desenv/Projetos/rrb-escola
git add src/lib/payroll/date-utils.ts
git commit -m "feat(payroll): URL/DB month converters and label helpers"
```

---

## Task 4: Pure calculators (INSS, IR, totais)

**Files:**
- Create: `src/lib/payroll/calculators.ts`

- [ ] **Step 1: Create file**

File: `src/lib/payroll/calculators.ts`

```ts
export type InssBracket = {
  ordem: number;
  valor_de: number;
  valor_ate: number | null;
  aliquota: number;       // 0.075 = 7.5%
  parcela_deduzir: number;
};

export type IrBracket = {
  ordem: number;
  valor_de: number;
  valor_ate: number | null;
  aliquota: number;
  parcela_deduzir: number;
  deducao_dependente: number;
};

export type PayrollInput = {
  base_salary: number;
  horas_extras: number;
  gratificacao: number;
  comissao: number;
  adicional_noturno: number;
  periculosidade: number;
  insalubridade: number;
  outros_proventos: number;
  family_allowance: number;
  vale_transporte: number;
  vale_alimentacao: number;
  outros_descontos: number;
  loan_deduction: number;
  advance: number;
  uniform_value: number;
  dependentes: number;
};

export type ComputedPayroll = {
  total_earnings: number;
  inss: number;
  ir: number;
  total_deductions: number;
  net_amount: number;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function calcINSS(base: number, brackets: InssBracket[]): number {
  if (base <= 0 || brackets.length === 0) return 0;
  const sorted = [...brackets].sort((a, b) => a.ordem - b.ordem);

  // Teto: maior valor_ate
  const teto = sorted.reduce((max, b) => (b.valor_ate ?? max) > max ? (b.valor_ate ?? max) : max, 0);
  const baseLimitada = Math.min(base, teto);

  let total = 0;
  for (const b of sorted) {
    const ate = b.valor_ate ?? Infinity;
    const faixaSize = Math.max(0, Math.min(baseLimitada, ate) - b.valor_de);
    if (faixaSize <= 0) continue;
    total += faixaSize * b.aliquota;
    if (baseLimitada <= ate) break;
  }
  return round2(total);
}

export function calcIR(baseAfterInss: number, dependentes: number, brackets: IrBracket[]): number {
  if (baseAfterInss <= 0 || brackets.length === 0) return 0;
  const sorted = [...brackets].sort((a, b) => a.ordem - b.ordem);
  const deducaoDep = (sorted[0]?.deducao_dependente ?? 0) * Math.max(0, dependentes);
  const baseFinal = Math.max(0, baseAfterInss - deducaoDep);

  for (const b of sorted) {
    const ate = b.valor_ate ?? Infinity;
    if (baseFinal <= ate) {
      return round2(Math.max(0, baseFinal * b.aliquota - b.parcela_deduzir));
    }
  }
  const last = sorted[sorted.length - 1]!;
  return round2(Math.max(0, baseFinal * last.aliquota - last.parcela_deduzir));
}

export function calcTotalEarnings(input: PayrollInput): number {
  return round2(
    input.base_salary +
    input.horas_extras +
    input.gratificacao +
    input.comissao +
    input.adicional_noturno +
    input.periculosidade +
    input.insalubridade +
    input.outros_proventos +
    input.family_allowance
  );
}

export function calcTotalDeductions(input: PayrollInput, inss: number, ir: number): number {
  return round2(
    inss +
    ir +
    input.loan_deduction +
    input.advance +
    input.vale_transporte +
    input.vale_alimentacao +
    input.outros_descontos +
    input.uniform_value
  );
}

export function calcAll(
  input: PayrollInput,
  brackets: { inss: InssBracket[]; ir: IrBracket[] },
  opts: { manualInss?: number; manualIr?: number } = {}
): ComputedPayroll {
  const total_earnings = calcTotalEarnings(input);
  const baseInss = total_earnings - input.family_allowance; // salário-família não compõe base INSS
  const autoInss = calcINSS(baseInss, brackets.inss);
  const inss = opts.manualInss != null ? round2(opts.manualInss) : autoInss;

  const baseIr = baseInss - inss;
  const autoIr = calcIR(baseIr, input.dependentes, brackets.ir);
  const ir = opts.manualIr != null ? round2(opts.manualIr) : autoIr;

  const total_deductions = calcTotalDeductions(input, inss, ir);
  const net_amount = round2(total_earnings - total_deductions);

  return { total_earnings, inss, ir, total_deductions, net_amount };
}
```

- [ ] **Step 2: Type check**

Run: `cd c:/Desenv/Projetos/rrb-escola && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
cd c:/Desenv/Projetos/rrb-escola
git add src/lib/payroll/calculators.ts
git commit -m "feat(payroll): pure calculators INSS+IR+totais"
```

---

## Task 5: Data layer brackets

**Files:**
- Create: `src/lib/data/brackets.ts`

- [ ] **Step 1: Create file**

File: `src/lib/data/brackets.ts`

```ts
import { createServerClient } from "@/lib/supabase/server";
import type { InssBracket, IrBracket } from "@/lib/payroll/calculators";

export type InssBracketRow = InssBracket & { id: string; vigencia_inicio: string };
export type IrBracketRow = IrBracket & { id: string; vigencia_inicio: string };

export async function getBracketsForMonth(dbMonth: string): Promise<{ inss: InssBracketRow[]; ir: IrBracketRow[] }> {
  const supabase = await createServerClient();

  // Vigência mais recente cuja vigencia_inicio <= dbMonth
  const [vigInss, vigIr] = await Promise.all([
    supabase
      .from("inss_brackets")
      .select("vigencia_inicio")
      .lte("vigencia_inicio", dbMonth)
      .order("vigencia_inicio", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("ir_brackets")
      .select("vigencia_inicio")
      .lte("vigencia_inicio", dbMonth)
      .order("vigencia_inicio", { ascending: false })
      .limit(1)
      .maybeSingle()
  ]);

  const inssVigencia = vigInss.data?.vigencia_inicio ?? null;
  const irVigencia = vigIr.data?.vigencia_inicio ?? null;

  const [inss, ir] = await Promise.all([
    inssVigencia
      ? supabase
          .from("inss_brackets")
          .select("id, vigencia_inicio, ordem, valor_de, valor_ate, aliquota, parcela_deduzir")
          .eq("vigencia_inicio", inssVigencia)
          .order("ordem")
      : Promise.resolve({ data: [], error: null }),
    irVigencia
      ? supabase
          .from("ir_brackets")
          .select("id, vigencia_inicio, ordem, valor_de, valor_ate, aliquota, parcela_deduzir, deducao_dependente")
          .eq("vigencia_inicio", irVigencia)
          .order("ordem")
      : Promise.resolve({ data: [], error: null })
  ]);

  return {
    inss: (inss.data ?? []).map((r) => ({ ...r, aliquota: Number(r.aliquota), parcela_deduzir: Number(r.parcela_deduzir), valor_de: Number(r.valor_de), valor_ate: r.valor_ate != null ? Number(r.valor_ate) : null })) as InssBracketRow[],
    ir: (ir.data ?? []).map((r) => ({ ...r, aliquota: Number(r.aliquota), parcela_deduzir: Number(r.parcela_deduzir), deducao_dependente: Number(r.deducao_dependente ?? 0), valor_de: Number(r.valor_de), valor_ate: r.valor_ate != null ? Number(r.valor_ate) : null })) as IrBracketRow[]
  };
}

export async function listBracketVigencias(table: "inss" | "ir"): Promise<string[]> {
  const supabase = await createServerClient();
  const tableName = table === "inss" ? "inss_brackets" : "ir_brackets";
  const { data, error } = await supabase
    .from(tableName)
    .select("vigencia_inicio")
    .order("vigencia_inicio", { ascending: false });
  if (error) throw error;
  const unique = Array.from(new Set((data ?? []).map((r) => r.vigencia_inicio)));
  return unique;
}

export async function listBracketsByVigencia(
  table: "inss" | "ir",
  vigencia: string
): Promise<InssBracketRow[] | IrBracketRow[]> {
  const supabase = await createServerClient();
  if (table === "inss") {
    const { data, error } = await supabase
      .from("inss_brackets")
      .select("id, vigencia_inicio, ordem, valor_de, valor_ate, aliquota, parcela_deduzir")
      .eq("vigencia_inicio", vigencia)
      .order("ordem");
    if (error) throw error;
    return (data ?? []).map((r) => ({ ...r, aliquota: Number(r.aliquota), parcela_deduzir: Number(r.parcela_deduzir), valor_de: Number(r.valor_de), valor_ate: r.valor_ate != null ? Number(r.valor_ate) : null })) as InssBracketRow[];
  } else {
    const { data, error } = await supabase
      .from("ir_brackets")
      .select("id, vigencia_inicio, ordem, valor_de, valor_ate, aliquota, parcela_deduzir, deducao_dependente")
      .eq("vigencia_inicio", vigencia)
      .order("ordem");
    if (error) throw error;
    return (data ?? []).map((r) => ({ ...r, aliquota: Number(r.aliquota), parcela_deduzir: Number(r.parcela_deduzir), deducao_dependente: Number(r.deducao_dependente ?? 0), valor_de: Number(r.valor_de), valor_ate: r.valor_ate != null ? Number(r.valor_ate) : null })) as IrBracketRow[];
  }
}
```

- [ ] **Step 2: Type check**

Run: `cd c:/Desenv/Projetos/rrb-escola && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
cd c:/Desenv/Projetos/rrb-escola
git add src/lib/data/brackets.ts
git commit -m "feat(payroll): data layer brackets queries"
```

---

## Task 6: Data layer payroll

**Files:**
- Create: `src/lib/data/payroll.ts`

- [ ] **Step 1: Create file**

File: `src/lib/data/payroll.ts`

```ts
import { createServerClient } from "@/lib/supabase/server";

export type PayrollPeriod = {
  id: string;
  reference_month: string;
  status: "aberto" | "fechado";
  closed_at: string | null;
  closed_by: string | null;
};

export type PayrollRow = {
  id: string;
  employee_id: string;
  reference_month: string;
  base_salary: number | null;
  additional: number | null;
  horas_extras: number | null;
  gratificacao: number | null;
  comissao: number | null;
  adicional_noturno: number | null;
  periculosidade: number | null;
  insalubridade: number | null;
  outros_proventos: number | null;
  family_allowance: number | null;
  vale_transporte: number | null;
  vale_alimentacao: number | null;
  outros_descontos: number | null;
  loan_deduction: number | null;
  advance: number | null;
  uniform_value: number | null;
  dependentes: number | null;
  total_earnings: number | null;
  inss: number | null;
  ir: number | null;
  inss_manual: boolean;
  ir_manual: boolean;
  total_deductions: number | null;
  net_amount: number | null;
  consider_decimo_terceiro: boolean | null;
  considera_um_tercio_ferias: boolean | null;
  observations: string | null;
};

export type PayrollRowJoined = PayrollRow & {
  employees: {
    id: string;
    name: string;
    cpf: string;
    cargo: string | null;
    school_category: string | null;
    ativo: boolean;
    company_id: string;
    companies: { id: string; name: string; cnpj: string } | null;
  } | null;
};

export type PayrollFilters = {
  search?: string;
  companyId?: string;
  segmento?: string;
};

export async function listPayrollByMonth(
  dbMonth: string,
  filters: PayrollFilters = {}
): Promise<PayrollRowJoined[]> {
  const supabase = await createServerClient();

  let query = supabase
    .from("payroll")
    .select(`
      id, employee_id, reference_month, base_salary, additional,
      horas_extras, gratificacao, comissao, adicional_noturno, periculosidade, insalubridade, outros_proventos,
      family_allowance, vale_transporte, vale_alimentacao, outros_descontos, loan_deduction, advance, uniform_value,
      dependentes, total_earnings, inss, ir, inss_manual, ir_manual, total_deductions, net_amount,
      consider_decimo_terceiro, considera_um_tercio_ferias, observations,
      employees!inner(id, name, cpf, cargo, school_category, ativo, company_id, companies(id, name, cnpj))
    `)
    .eq("reference_month", dbMonth);

  const { data, error } = await query;
  if (error) throw error;

  let rows = (data ?? []).map((r) => ({
    ...r,
    employees: Array.isArray(r.employees) ? r.employees[0] ?? null : r.employees ?? null
  })) as PayrollRowJoined[];

  rows = rows.map((r) => {
    if (r.employees && Array.isArray(r.employees.companies)) {
      r.employees.companies = (r.employees.companies as unknown as Array<{ id: string; name: string; cnpj: string }>)[0] ?? null;
    }
    return r;
  });

  if (filters.companyId) rows = rows.filter((r) => r.employees?.company_id === filters.companyId);
  if (filters.segmento) rows = rows.filter((r) => r.employees?.school_category === filters.segmento);
  if (filters.search) {
    const term = filters.search.toLowerCase();
    rows = rows.filter((r) => {
      const name = r.employees?.name?.toLowerCase() ?? "";
      const cpf = r.employees?.cpf ?? "";
      return name.includes(term) || cpf.includes(term);
    });
  }

  rows.sort((a, b) => (a.employees?.name ?? "").localeCompare(b.employees?.name ?? ""));
  return rows;
}

export async function getPayrollByEmployeeMonth(
  employeeId: string,
  dbMonth: string
): Promise<PayrollRowJoined | null> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("payroll")
    .select(`
      id, employee_id, reference_month, base_salary, additional,
      horas_extras, gratificacao, comissao, adicional_noturno, periculosidade, insalubridade, outros_proventos,
      family_allowance, vale_transporte, vale_alimentacao, outros_descontos, loan_deduction, advance, uniform_value,
      dependentes, total_earnings, inss, ir, inss_manual, ir_manual, total_deductions, net_amount,
      consider_decimo_terceiro, considera_um_tercio_ferias, observations,
      employees!inner(id, name, cpf, cargo, school_category, ativo, company_id, hire_date, birth_date, companies(id, name, cnpj))
    `)
    .eq("employee_id", employeeId)
    .eq("reference_month", dbMonth)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = { ...data, employees: Array.isArray(data.employees) ? data.employees[0] ?? null : data.employees ?? null } as PayrollRowJoined;
  if (row.employees && Array.isArray(row.employees.companies)) {
    row.employees.companies = (row.employees.companies as unknown as Array<{ id: string; name: string; cnpj: string }>)[0] ?? null;
  }
  return row;
}

export async function getPayrollPeriod(dbMonth: string): Promise<PayrollPeriod> {
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("payroll_periods")
    .select("id, reference_month, status, closed_at, closed_by")
    .eq("reference_month", dbMonth)
    .maybeSingle();

  if (data) return data as PayrollPeriod;

  // Create with default
  const { data: created, error } = await supabase
    .from("payroll_periods")
    .insert({ reference_month: dbMonth, status: "aberto" })
    .select("id, reference_month, status, closed_at, closed_by")
    .single();
  if (error) throw error;
  return created as PayrollPeriod;
}

export type MonthSummary = {
  count: number;
  total_proventos: number;
  total_descontos: number;
  total_liquido: number;
  total_inss: number;
  total_ir: number;
};

export async function getMonthSummary(dbMonth: string): Promise<MonthSummary> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("payroll")
    .select("total_earnings, total_deductions, net_amount, inss, ir")
    .eq("reference_month", dbMonth);
  if (error) throw error;
  const rows = data ?? [];
  return {
    count: rows.length,
    total_proventos: rows.reduce((s, r) => s + Number(r.total_earnings ?? 0), 0),
    total_descontos: rows.reduce((s, r) => s + Number(r.total_deductions ?? 0), 0),
    total_liquido: rows.reduce((s, r) => s + Number(r.net_amount ?? 0), 0),
    total_inss: rows.reduce((s, r) => s + Number(r.inss ?? 0), 0),
    total_ir: rows.reduce((s, r) => s + Number(r.ir ?? 0), 0)
  };
}

export async function listEmployeesNeedingPayroll(dbMonth: string): Promise<Array<{ id: string; name: string }>> {
  const supabase = await createServerClient();
  const { data: existing } = await supabase
    .from("payroll")
    .select("employee_id")
    .eq("reference_month", dbMonth);
  const existingIds = new Set((existing ?? []).map((r) => r.employee_id));

  const { data: actives, error } = await supabase
    .from("employees")
    .select("id, name")
    .eq("ativo", true)
    .order("name");
  if (error) throw error;
  return (actives ?? []).filter((e) => !existingIds.has(e.id));
}
```

- [ ] **Step 2: Type check**

Run: `cd c:/Desenv/Projetos/rrb-escola && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
cd c:/Desenv/Projetos/rrb-escola
git add src/lib/data/payroll.ts
git commit -m "feat(payroll): data layer payroll queries"
```

---

## Task 7: Validation schemas (payroll + brackets)

**Files:**
- Create: `src/lib/validation/payroll.ts`

- [ ] **Step 1: Create file**

File: `src/lib/validation/payroll.ts`

```ts
import { z } from "zod";

const numericNonNeg = z.preprocess(
  (v) => {
    if (v === "" || v == null) return 0;
    if (typeof v === "string") return Number(v.replace(",", "."));
    return v;
  },
  z.number().min(0)
);

const boolFromForm = z.preprocess((v) => v === "on" || v === true, z.boolean());

export const PayrollSchema = z.object({
  employee_id: z.string().uuid(),
  reference_month: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Mês inválido"),
  base_salary: numericNonNeg,
  horas_extras: numericNonNeg,
  gratificacao: numericNonNeg,
  comissao: numericNonNeg,
  adicional_noturno: numericNonNeg,
  periculosidade: numericNonNeg,
  insalubridade: numericNonNeg,
  outros_proventos: numericNonNeg,
  family_allowance: numericNonNeg,
  vale_transporte: numericNonNeg,
  vale_alimentacao: numericNonNeg,
  outros_descontos: numericNonNeg,
  loan_deduction: numericNonNeg,
  advance: numericNonNeg,
  uniform_value: numericNonNeg,
  dependentes: z.preprocess(
    (v) => (v === "" || v == null ? 0 : Number(v)),
    z.number().int().min(0)
  ),
  consider_decimo_terceiro: boolFromForm.optional(),
  considera_um_tercio_ferias: boolFromForm.optional(),
  inss_manual: boolFromForm.optional(),
  ir_manual: boolFromForm.optional(),
  inss: numericNonNeg.optional(),
  ir: numericNonNeg.optional(),
  observations: z.preprocess((v) => (v === "" ? undefined : v), z.string().optional())
});

export const BracketSchema = z.object({
  table: z.enum(["inss", "ir"]),
  vigencia_inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  ordem: z.preprocess((v) => Number(v), z.number().int().min(1)),
  valor_de: numericNonNeg,
  valor_ate: z.preprocess(
    (v) => (v === "" || v == null ? null : Number(String(v).replace(",", "."))),
    z.number().min(0).nullable()
  ),
  aliquota: numericNonNeg,
  parcela_deduzir: numericNonNeg,
  deducao_dependente: numericNonNeg.optional()
});

export const NewVigenciaSchema = z.object({
  table: z.enum(["inss", "ir"]),
  vigencia_inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  copy_from: z.preprocess((v) => (v === "" ? undefined : v), z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional())
});

export type PayrollInput = z.infer<typeof PayrollSchema>;
```

- [ ] **Step 2: Type check**

Run: `cd c:/Desenv/Projetos/rrb-escola && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
cd c:/Desenv/Projetos/rrb-escola
git add src/lib/validation/payroll.ts
git commit -m "feat(payroll): Zod schemas for payroll + brackets"
```

---

## Task 8: Server actions payroll (upsert + close/reopen)

**Files:**
- Create: `src/lib/actions/payroll.ts`

- [ ] **Step 1: Create file**

File: `src/lib/actions/payroll.ts`

```ts
"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requirePerfil } from "@/lib/auth/session";
import { createServerClient } from "@/lib/supabase/server";
import { PayrollSchema } from "@/lib/validation/payroll";
import { calcAll, type PayrollInput as CalcInput } from "@/lib/payroll/calculators";
import { getBracketsForMonth } from "@/lib/data/brackets";
import { dbToUrlMonth, urlToDbMonth, shiftUrlMonth } from "@/lib/payroll/date-utils";

function firstError(error: { issues: { message: string }[] }) {
  return encodeURIComponent(error.issues[0]?.message ?? "Dados inválidos");
}

function readPayrollForm(formData: FormData) {
  const get = (k: string) => formData.get(k);
  return {
    employee_id: String(get("employee_id") ?? ""),
    reference_month: String(get("reference_month") ?? ""),
    base_salary: get("base_salary"),
    horas_extras: get("horas_extras"),
    gratificacao: get("gratificacao"),
    comissao: get("comissao"),
    adicional_noturno: get("adicional_noturno"),
    periculosidade: get("periculosidade"),
    insalubridade: get("insalubridade"),
    outros_proventos: get("outros_proventos"),
    family_allowance: get("family_allowance"),
    vale_transporte: get("vale_transporte"),
    vale_alimentacao: get("vale_alimentacao"),
    outros_descontos: get("outros_descontos"),
    loan_deduction: get("loan_deduction"),
    advance: get("advance"),
    uniform_value: get("uniform_value"),
    dependentes: get("dependentes"),
    consider_decimo_terceiro: get("consider_decimo_terceiro"),
    considera_um_tercio_ferias: get("considera_um_tercio_ferias"),
    inss_manual: get("inss_manual"),
    ir_manual: get("ir_manual"),
    inss: get("inss"),
    ir: get("ir"),
    observations: get("observations")
  };
}

export async function upsertPayrollAction(formData: FormData) {
  await requirePerfil(["admin", "financeiro"]);

  const parsed = PayrollSchema.safeParse(readPayrollForm(formData));
  if (!parsed.success) {
    const urlMonth = dbToUrlMonth(String(formData.get("reference_month") ?? ""));
    const empId = String(formData.get("employee_id") ?? "");
    redirect(`/rh/folha/${urlMonth}/${empId}?erro=${firstError(parsed.error)}`);
  }
  const data = parsed.data;

  const supabase = await createServerClient();

  // Verifica period status
  const { data: period } = await supabase
    .from("payroll_periods")
    .select("status")
    .eq("reference_month", data.reference_month)
    .maybeSingle();
  if (period?.status === "fechado") {
    const urlMonth = dbToUrlMonth(data.reference_month);
    redirect(`/rh/folha/${urlMonth}/${data.employee_id}?erro=${encodeURIComponent("Período fechado")}`);
  }

  // Recalc server-side
  const brackets = await getBracketsForMonth(data.reference_month);
  const calcInput: CalcInput = {
    base_salary: data.base_salary,
    horas_extras: data.horas_extras,
    gratificacao: data.gratificacao,
    comissao: data.comissao,
    adicional_noturno: data.adicional_noturno,
    periculosidade: data.periculosidade,
    insalubridade: data.insalubridade,
    outros_proventos: data.outros_proventos,
    family_allowance: data.family_allowance,
    vale_transporte: data.vale_transporte,
    vale_alimentacao: data.vale_alimentacao,
    outros_descontos: data.outros_descontos,
    loan_deduction: data.loan_deduction,
    advance: data.advance,
    uniform_value: data.uniform_value,
    dependentes: data.dependentes
  };
  const computed = calcAll(calcInput, brackets, {
    manualInss: data.inss_manual && data.inss != null ? data.inss : undefined,
    manualIr: data.ir_manual && data.ir != null ? data.ir : undefined
  });

  // Upsert via unique (employee_id, reference_month)
  const { error } = await supabase
    .from("payroll")
    .upsert(
      {
        employee_id: data.employee_id,
        reference_month: data.reference_month,
        base_salary: data.base_salary,
        horas_extras: data.horas_extras,
        gratificacao: data.gratificacao,
        comissao: data.comissao,
        adicional_noturno: data.adicional_noturno,
        periculosidade: data.periculosidade,
        insalubridade: data.insalubridade,
        outros_proventos: data.outros_proventos,
        family_allowance: data.family_allowance,
        vale_transporte: data.vale_transporte,
        vale_alimentacao: data.vale_alimentacao,
        outros_descontos: data.outros_descontos,
        loan_deduction: data.loan_deduction,
        advance: data.advance,
        uniform_value: data.uniform_value,
        dependentes: data.dependentes,
        inss: computed.inss,
        ir: computed.ir,
        inss_manual: data.inss_manual ?? false,
        ir_manual: data.ir_manual ?? false,
        total_earnings: computed.total_earnings,
        total_deductions: computed.total_deductions,
        net_amount: computed.net_amount,
        consider_decimo_terceiro: data.consider_decimo_terceiro ?? false,
        considera_um_tercio_ferias: data.considera_um_tercio_ferias ?? false,
        observations: data.observations ?? null
      },
      { onConflict: "employee_id,reference_month" }
    );

  if (error) {
    const urlMonth = dbToUrlMonth(data.reference_month);
    redirect(`/rh/folha/${urlMonth}/${data.employee_id}?erro=${encodeURIComponent(error.message)}`);
  }

  const urlMonth = dbToUrlMonth(data.reference_month);
  revalidatePath(`/rh/folha/${urlMonth}`);
  revalidatePath(`/rh/folha/${urlMonth}/${data.employee_id}`);
  redirect(`/rh/folha/${urlMonth}/${data.employee_id}?ok=salvo`);
}

export async function closePeriodAction(formData: FormData) {
  const session = await requirePerfil(["admin"]);
  const dbMonth = urlToDbMonth(String(formData.get("mes") ?? ""));
  const supabase = await createServerClient();

  const { error } = await supabase
    .from("payroll_periods")
    .upsert(
      {
        reference_month: dbMonth,
        status: "fechado",
        closed_at: new Date().toISOString(),
        closed_by: session.user.id
      },
      { onConflict: "reference_month" }
    );
  if (error) {
    redirect(`/rh/folha/${dbToUrlMonth(dbMonth)}?erro=${encodeURIComponent(error.message)}`);
  }
  revalidatePath(`/rh/folha/${dbToUrlMonth(dbMonth)}`);
  redirect(`/rh/folha/${dbToUrlMonth(dbMonth)}?ok=fechado`);
}

export async function reopenPeriodAction(formData: FormData) {
  await requirePerfil(["admin"]);
  const dbMonth = urlToDbMonth(String(formData.get("mes") ?? ""));
  const supabase = await createServerClient();

  const { error } = await supabase
    .from("payroll_periods")
    .update({ status: "aberto", closed_at: null, closed_by: null })
    .eq("reference_month", dbMonth);
  if (error) {
    redirect(`/rh/folha/${dbToUrlMonth(dbMonth)}?erro=${encodeURIComponent(error.message)}`);
  }
  revalidatePath(`/rh/folha/${dbToUrlMonth(dbMonth)}`);
  redirect(`/rh/folha/${dbToUrlMonth(dbMonth)}?ok=reaberto`);
}

export async function generateMonthAction(formData: FormData) {
  await requirePerfil(["admin", "financeiro"]);
  const urlMonth = String(formData.get("mes") ?? "");
  const dbMonth = urlToDbMonth(urlMonth);
  const prevDbMonth = urlToDbMonth(shiftUrlMonth(urlMonth, -1));

  const supabase = await createServerClient();

  // Ensure period row + check status
  const { data: period } = await supabase
    .from("payroll_periods")
    .select("status")
    .eq("reference_month", dbMonth)
    .maybeSingle();
  if (period?.status === "fechado") {
    redirect(`/rh/folha/${urlMonth}?erro=${encodeURIComponent("Mês está fechado")}`);
  }
  if (!period) {
    await supabase.from("payroll_periods").insert({ reference_month: dbMonth, status: "aberto" });
  }

  const { data: employees, error: empErr } = await supabase
    .from("employees")
    .select("id")
    .eq("ativo", true);
  if (empErr) redirect(`/rh/folha/${urlMonth}?erro=${encodeURIComponent(empErr.message)}`);

  // Pull prev payrolls in one query
  const { data: prevRows } = await supabase
    .from("payroll")
    .select("employee_id, base_salary, dependentes, vale_transporte, vale_alimentacao")
    .eq("reference_month", prevDbMonth);
  const prevMap = new Map<string, { base_salary: number; dependentes: number; vale_transporte: number; vale_alimentacao: number }>();
  for (const p of prevRows ?? []) {
    prevMap.set(p.employee_id, {
      base_salary: Number(p.base_salary ?? 0),
      dependentes: Number(p.dependentes ?? 0),
      vale_transporte: Number(p.vale_transporte ?? 0),
      vale_alimentacao: Number(p.vale_alimentacao ?? 0)
    });
  }

  const rows = (employees ?? []).map((e) => {
    const prev = prevMap.get(e.id);
    return {
      employee_id: e.id,
      reference_month: dbMonth,
      base_salary: prev?.base_salary ?? 0,
      dependentes: prev?.dependentes ?? 0,
      vale_transporte: prev?.vale_transporte ?? 0,
      vale_alimentacao: prev?.vale_alimentacao ?? 0,
      total_earnings: prev?.base_salary ?? 0,
      total_deductions: 0,
      net_amount: prev?.base_salary ?? 0
    };
  });

  if (rows.length > 0) {
    const { error } = await supabase
      .from("payroll")
      .upsert(rows, { onConflict: "employee_id,reference_month", ignoreDuplicates: true });
    if (error) redirect(`/rh/folha/${urlMonth}?erro=${encodeURIComponent(error.message)}`);
  }

  revalidatePath(`/rh/folha/${urlMonth}`);
  redirect(`/rh/folha/${urlMonth}?ok=gerada`);
}

export async function syncNewEmployeesAction(formData: FormData) {
  await requirePerfil(["admin", "financeiro"]);
  const urlMonth = String(formData.get("mes") ?? "");
  const dbMonth = urlToDbMonth(urlMonth);

  const supabase = await createServerClient();

  const { data: period } = await supabase
    .from("payroll_periods")
    .select("status")
    .eq("reference_month", dbMonth)
    .maybeSingle();
  if (period?.status === "fechado") {
    redirect(`/rh/folha/${urlMonth}?erro=${encodeURIComponent("Mês está fechado")}`);
  }

  const { data: existing } = await supabase
    .from("payroll")
    .select("employee_id")
    .eq("reference_month", dbMonth);
  const existingIds = new Set((existing ?? []).map((r) => r.employee_id));

  const { data: actives } = await supabase
    .from("employees")
    .select("id")
    .eq("ativo", true);

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

  if (newRows.length > 0) {
    const { error } = await supabase.from("payroll").insert(newRows);
    if (error) redirect(`/rh/folha/${urlMonth}?erro=${encodeURIComponent(error.message)}`);
  }

  revalidatePath(`/rh/folha/${urlMonth}`);
  redirect(`/rh/folha/${urlMonth}?ok=sincronizado`);
}
```

- [ ] **Step 2: Type check**

Run: `cd c:/Desenv/Projetos/rrb-escola && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
cd c:/Desenv/Projetos/rrb-escola
git add src/lib/actions/payroll.ts
git commit -m "feat(payroll): server actions upsert/close/reopen/generate/sync"
```

---

## Task 9: Server actions brackets

**Files:**
- Create: `src/lib/actions/brackets.ts`

- [ ] **Step 1: Create file**

File: `src/lib/actions/brackets.ts`

```ts
"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requirePerfil } from "@/lib/auth/session";
import { createServerClient } from "@/lib/supabase/server";
import { BracketSchema, NewVigenciaSchema } from "@/lib/validation/payroll";

function firstError(error: { issues: { message: string }[] }) {
  return encodeURIComponent(error.issues[0]?.message ?? "Dados inválidos");
}

export async function upsertBracketAction(formData: FormData) {
  await requirePerfil(["admin"]);

  const parsed = BracketSchema.safeParse({
    table: String(formData.get("table") ?? ""),
    vigencia_inicio: String(formData.get("vigencia_inicio") ?? ""),
    ordem: formData.get("ordem"),
    valor_de: formData.get("valor_de"),
    valor_ate: formData.get("valor_ate"),
    aliquota: formData.get("aliquota"),
    parcela_deduzir: formData.get("parcela_deduzir"),
    deducao_dependente: formData.get("deducao_dependente")
  });
  if (!parsed.success) {
    redirect(`/rh/brackets?erro=${firstError(parsed.error)}`);
  }
  const data = parsed.data;
  const id = String(formData.get("id") ?? "");
  const supabase = await createServerClient();

  const payload: Record<string, unknown> = {
    vigencia_inicio: data.vigencia_inicio,
    ordem: data.ordem,
    valor_de: data.valor_de,
    valor_ate: data.valor_ate,
    aliquota: data.aliquota,
    parcela_deduzir: data.parcela_deduzir
  };
  if (data.table === "ir") payload.deducao_dependente = data.deducao_dependente ?? 0;

  const tableName = data.table === "inss" ? "inss_brackets" : "ir_brackets";
  const { error } = id
    ? await supabase.from(tableName).update(payload).eq("id", id)
    : await supabase.from(tableName).insert(payload);

  if (error) redirect(`/rh/brackets?erro=${encodeURIComponent(error.message)}`);

  revalidatePath("/rh/brackets");
  redirect(`/rh/brackets?ok=salvo&tab=${data.table}`);
}

export async function deleteBracketAction(formData: FormData) {
  await requirePerfil(["admin"]);
  const table = String(formData.get("table") ?? "");
  const id = String(formData.get("id") ?? "");
  if (table !== "inss" && table !== "ir") redirect("/rh/brackets?erro=Tabela inválida");
  if (!id) redirect("/rh/brackets?erro=ID inválido");

  const supabase = await createServerClient();
  const tableName = table === "inss" ? "inss_brackets" : "ir_brackets";
  const { error } = await supabase.from(tableName).delete().eq("id", id);
  if (error) redirect(`/rh/brackets?erro=${encodeURIComponent(error.message)}`);

  revalidatePath("/rh/brackets");
  redirect(`/rh/brackets?ok=removido&tab=${table}`);
}

export async function createBracketVigenciaAction(formData: FormData) {
  await requirePerfil(["admin"]);
  const parsed = NewVigenciaSchema.safeParse({
    table: String(formData.get("table") ?? ""),
    vigencia_inicio: String(formData.get("vigencia_inicio") ?? ""),
    copy_from: formData.get("copy_from")
  });
  if (!parsed.success) redirect(`/rh/brackets?erro=${firstError(parsed.error)}`);
  const { table, vigencia_inicio, copy_from } = parsed.data;

  const supabase = await createServerClient();
  const tableName = table === "inss" ? "inss_brackets" : "ir_brackets";

  if (copy_from) {
    const { data: source } = await supabase
      .from(tableName)
      .select("*")
      .eq("vigencia_inicio", copy_from)
      .order("ordem");
    const rows = (source ?? []).map((r) => {
      const copy: Record<string, unknown> = {
        vigencia_inicio,
        ordem: r.ordem,
        valor_de: r.valor_de,
        valor_ate: r.valor_ate,
        aliquota: r.aliquota,
        parcela_deduzir: r.parcela_deduzir
      };
      if (table === "ir") copy.deducao_dependente = r.deducao_dependente ?? 0;
      return copy;
    });
    if (rows.length > 0) {
      const { error } = await supabase.from(tableName).insert(rows);
      if (error) redirect(`/rh/brackets?erro=${encodeURIComponent(error.message)}`);
    }
  } else {
    // Create empty vigencia with one placeholder bracket (ordem 1)
    const payload: Record<string, unknown> = {
      vigencia_inicio,
      ordem: 1,
      valor_de: 0,
      valor_ate: null,
      aliquota: 0,
      parcela_deduzir: 0
    };
    if (table === "ir") payload.deducao_dependente = 0;
    const { error } = await supabase.from(tableName).insert(payload);
    if (error) redirect(`/rh/brackets?erro=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/rh/brackets");
  redirect(`/rh/brackets?ok=vigencia_criada&tab=${table}&vigencia=${vigencia_inicio}`);
}

export async function deleteVigenciaAction(formData: FormData) {
  await requirePerfil(["admin"]);
  const table = String(formData.get("table") ?? "");
  const vigencia = String(formData.get("vigencia") ?? "");
  if (table !== "inss" && table !== "ir") redirect("/rh/brackets?erro=Tabela inválida");

  const supabase = await createServerClient();
  const tableName = table === "inss" ? "inss_brackets" : "ir_brackets";
  const { error } = await supabase.from(tableName).delete().eq("vigencia_inicio", vigencia);
  if (error) redirect(`/rh/brackets?erro=${encodeURIComponent(error.message)}`);

  revalidatePath("/rh/brackets");
  redirect(`/rh/brackets?ok=vigencia_removida&tab=${table}`);
}
```

- [ ] **Step 2: Type check**

Run: `cd c:/Desenv/Projetos/rrb-escola && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
cd c:/Desenv/Projetos/rrb-escola
git add src/lib/actions/brackets.ts
git commit -m "feat(payroll): server actions for brackets CRUD"
```

---

## Task 10: Month navigation component

**Files:**
- Create: `src/components/rh/payroll/month-nav.tsx`

- [ ] **Step 1: Create file**

File: `src/components/rh/payroll/month-nav.tsx`

```tsx
"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { shiftUrlMonth, monthLabel } from "@/lib/payroll/date-utils";

export function MonthNav({ mes }: { mes: string }) {
  const prev = shiftUrlMonth(mes, -1);
  const next = shiftUrlMonth(mes, 1);

  return (
    <div className="inline-flex items-center gap-2">
      <Link
        href={`/rh/folha/${prev}`}
        className="ds-button ds-button-secondary px-2"
        aria-label="Mês anterior"
      >
        <ChevronLeft size={14} />
      </Link>
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-ui border border-line bg-surface text-sm font-semibold text-ink min-w-[160px] justify-center">
        <Calendar size={14} className="text-ink/55" />
        {monthLabel(mes)}
      </div>
      <Link
        href={`/rh/folha/${next}`}
        className="ds-button ds-button-secondary px-2"
        aria-label="Próximo mês"
      >
        <ChevronRight size={14} />
      </Link>
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
git add src/components/rh/payroll/month-nav.tsx
git commit -m "feat(payroll): month navigation component"
```

---

## Task 11: Action buttons (generate, sync, close, reopen)

**Files:**
- Create: `src/components/rh/payroll/generate-month-button.tsx`
- Create: `src/components/rh/payroll/close-period-button.tsx`

- [ ] **Step 1: Create generate-month-button.tsx**

File: `src/components/rh/payroll/generate-month-button.tsx`

```tsx
"use client";

import { Plus, RefreshCcw } from "lucide-react";
import { generateMonthAction, syncNewEmployeesAction } from "@/lib/actions/payroll";

export function GenerateMonthButton({ mes, hasPayrolls }: { mes: string; hasPayrolls: boolean }) {
  if (hasPayrolls) {
    return (
      <form
        action={syncNewEmployeesAction}
        onSubmit={(e) => {
          if (!confirm(`Adicionar novos funcionários ativos sem lançamento no mês ${mes}?`)) {
            e.preventDefault();
          }
        }}
        className="inline"
      >
        <input type="hidden" name="mes" value={mes} />
        <button type="submit" className="ds-button ds-button-secondary">
          <RefreshCcw size={14} /> Adicionar novos
        </button>
      </form>
    );
  }
  return (
    <form
      action={generateMonthAction}
      onSubmit={(e) => {
        if (!confirm(`Gerar folha de ${mes}? Linhas serão criadas copiando base_salary do mês anterior.`)) {
          e.preventDefault();
        }
      }}
      className="inline"
    >
      <input type="hidden" name="mes" value={mes} />
      <button type="submit" className="ds-button ds-button-primary">
        <Plus size={14} /> Gerar folha do mês
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Create close-period-button.tsx**

File: `src/components/rh/payroll/close-period-button.tsx`

```tsx
"use client";

import { Lock, Unlock } from "lucide-react";
import { closePeriodAction, reopenPeriodAction } from "@/lib/actions/payroll";

export function ClosePeriodButton({ mes, status }: { mes: string; status: "aberto" | "fechado" }) {
  if (status === "fechado") {
    return (
      <form
        action={reopenPeriodAction}
        onSubmit={(e) => {
          if (!confirm(`Reabrir o mês ${mes}? Edições voltarão a ser permitidas.`)) e.preventDefault();
        }}
        className="inline"
      >
        <input type="hidden" name="mes" value={mes} />
        <button type="submit" className="ds-button ds-button-secondary">
          <Unlock size={14} /> Reabrir mês
        </button>
      </form>
    );
  }
  return (
    <form
      action={closePeriodAction}
      onSubmit={(e) => {
        if (!confirm(`Fechar o mês ${mes}? Edições serão bloqueadas até reabertura.`)) e.preventDefault();
      }}
      className="inline"
    >
      <input type="hidden" name="mes" value={mes} />
      <button type="submit" className="ds-button ds-button-secondary">
        <Lock size={14} /> Fechar mês
      </button>
    </form>
  );
}
```

- [ ] **Step 3: Type check + commit**

```bash
cd c:/Desenv/Projetos/rrb-escola
npx tsc --noEmit
git add src/components/rh/payroll/generate-month-button.tsx src/components/rh/payroll/close-period-button.tsx
git commit -m "feat(payroll): generate/sync/close/reopen buttons"
```

---

## Task 12: Payroll month table + summary card

**Files:**
- Create: `src/components/rh/payroll/payroll-month-table.tsx`
- Create: `src/components/rh/payroll/payroll-summary-card.tsx`

- [ ] **Step 1: Create payroll-summary-card.tsx**

File: `src/components/rh/payroll/payroll-summary-card.tsx`

```tsx
import { Panel } from "@/components/ui/card";
import { money } from "@/lib/constants";
import type { MonthSummary } from "@/lib/data/payroll";

export function PayrollSummaryCard({ summary }: { summary: MonthSummary }) {
  const items: Array<{ label: string; value: string; tone?: "success" | "danger" | "warning" }> = [
    { label: "Funcionários", value: summary.count.toLocaleString("pt-BR") },
    { label: "Proventos",    value: money.format(summary.total_proventos), tone: "success" },
    { label: "INSS",         value: money.format(summary.total_inss), tone: "danger" },
    { label: "IR",           value: money.format(summary.total_ir), tone: "danger" },
    { label: "Descontos",    value: money.format(summary.total_descontos), tone: "warning" },
    { label: "Líquido",      value: money.format(summary.total_liquido), tone: "success" }
  ];
  return (
    <Panel className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 p-4">
      {items.map((it) => (
        <div key={it.label}>
          <p className="text-[0.62rem] font-bold uppercase tracking-[0.10em] text-ink/55">{it.label}</p>
          <strong
            className={`mt-1 block text-lg font-bold tabular-nums ${
              it.tone === "success" ? "text-success" : it.tone === "danger" ? "text-danger" : it.tone === "warning" ? "text-warning" : "text-ink"
            }`}
          >
            {it.value}
          </strong>
        </div>
      ))}
    </Panel>
  );
}
```

- [ ] **Step 2: Create payroll-month-table.tsx**

File: `src/components/rh/payroll/payroll-month-table.tsx`

```tsx
import Link from "next/link";
import { FileText } from "lucide-react";
import { DataTableShell } from "@/components/ui/data-table";
import { Avatar } from "@/components/ui/avatar";
import { StatusPill } from "@/components/ui/status-pill";
import { money } from "@/lib/constants";
import type { PayrollRowJoined } from "@/lib/data/payroll";

export function PayrollMonthTable({
  rows,
  mes,
  canEdit
}: {
  rows: PayrollRowJoined[];
  mes: string;
  canEdit: boolean;
}) {
  return (
    <DataTableShell
      footer={
        <span>
          Mostrando <strong className="text-ink">{rows.length}</strong> funcionário(s)
        </span>
      }
    >
      <table className="ds-dt min-w-[1200px]">
        <thead>
          <tr>
            <th>Funcionário</th>
            <th>Empresa</th>
            <th className="text-right">Base</th>
            <th className="text-right">Proventos</th>
            <th className="text-right">INSS</th>
            <th className="text-right">IR</th>
            <th className="text-right">Descontos</th>
            <th className="text-right">Líquido</th>
            <th className="text-right">Ações</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={9} className="text-center text-ink/50 py-10">
                Nenhum lançamento no mês.
              </td>
            </tr>
          ) : null}
          {rows.map((r) => (
            <tr key={r.id}>
              <td>
                <Link
                  href={`/rh/folha/${mes}/${r.employee_id}`}
                  className="flex items-center gap-3 group"
                >
                  <Avatar name={r.employees?.name ?? "?"} size={32} />
                  <span className="flex flex-col leading-tight">
                    <span className="font-semibold text-ink group-hover:text-brand">
                      {r.employees?.name ?? "—"}
                      {r.employees && !r.employees.ativo ? (
                        <StatusPill tone="danger" className="ml-2">Inativo</StatusPill>
                      ) : null}
                    </span>
                    <span className="text-xs text-ink/50 tabular-nums">{r.employees?.cpf ?? ""}</span>
                  </span>
                </Link>
              </td>
              <td className="text-ink/80">{r.employees?.companies?.name ?? "—"}</td>
              <td className="text-right tabular-nums">{money.format(Number(r.base_salary ?? 0))}</td>
              <td className="text-right tabular-nums text-success">{money.format(Number(r.total_earnings ?? 0))}</td>
              <td className="text-right tabular-nums text-danger">{money.format(Number(r.inss ?? 0))}</td>
              <td className="text-right tabular-nums text-danger">{money.format(Number(r.ir ?? 0))}</td>
              <td className="text-right tabular-nums text-warning">{money.format(Number(r.total_deductions ?? 0))}</td>
              <td className="text-right font-bold text-brand tabular-nums">{money.format(Number(r.net_amount ?? 0))}</td>
              <td className="text-right">
                <Link
                  href={`/rh/folha/${mes}/${r.employee_id}`}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline"
                >
                  <FileText size={12} /> {canEdit ? "Editar" : "Ver"}
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </DataTableShell>
  );
}
```

- [ ] **Step 3: Type check + commit**

```bash
cd c:/Desenv/Projetos/rrb-escola
npx tsc --noEmit
git add src/components/rh/payroll/payroll-summary-card.tsx src/components/rh/payroll/payroll-month-table.tsx
git commit -m "feat(payroll): month table + summary card components"
```

---

## Task 13: Holerite PDF button

**Files:**
- Create: `src/components/rh/payroll/holerite-pdf-button.tsx`

- [ ] **Step 1: Create file**

File: `src/components/rh/payroll/holerite-pdf-button.tsx`

```tsx
"use client";

import { FileDown } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { monthLabel } from "@/lib/payroll/date-utils";
import { money } from "@/lib/constants";
import type { PayrollRowJoined } from "@/lib/data/payroll";

export function HoleritePdfButton({ row, mes }: { row: PayrollRowJoined; mes: string }) {
  const handleClick = () => {
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const emp = row.employees;
    const comp = emp?.companies;

    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(comp?.name ?? "—", 14, 16);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`CNPJ: ${comp?.cnpj ?? "—"}`, 14, 22);

    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("RECIBO DE PAGAMENTO DE SALÁRIO", 105, 22, { align: "center" });

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`Competência: ${monthLabel(mes)}`, 196, 22, { align: "right" });

    doc.line(14, 26, 196, 26);

    doc.setFontSize(9);
    doc.text(`Nome: ${emp?.name ?? "—"}`, 14, 33);
    doc.text(`CPF: ${emp?.cpf ?? "—"}`, 110, 33);
    doc.text(`Cargo: ${emp?.cargo ?? "—"}`, 14, 39);
    doc.text(`Categoria: ${emp?.school_category ?? "—"}`, 110, 39);

    const proventos: Array<[string, string, string]> = [];
    const descontos: Array<[string, string, string]> = [];
    const push = (arr: typeof proventos, code: string, label: string, val: number | null) => {
      const v = Number(val ?? 0);
      if (v > 0) arr.push([code, label, money.format(v)]);
    };
    push(proventos, "001", "Salário base", row.base_salary);
    push(proventos, "002", "Horas extras", row.horas_extras);
    push(proventos, "003", "Gratificação", row.gratificacao);
    push(proventos, "004", "Comissão", row.comissao);
    push(proventos, "005", "Adicional noturno", row.adicional_noturno);
    push(proventos, "006", "Periculosidade", row.periculosidade);
    push(proventos, "007", "Insalubridade", row.insalubridade);
    push(proventos, "008", "Outros proventos", row.outros_proventos);
    push(proventos, "009", "Salário-família", row.family_allowance);

    push(descontos, "101", "INSS", row.inss);
    push(descontos, "102", "IRRF", row.ir);
    push(descontos, "103", "Empréstimo", row.loan_deduction);
    push(descontos, "104", "Adiantamento", row.advance);
    push(descontos, "105", "Vale transporte", row.vale_transporte);
    push(descontos, "106", "Vale alimentação", row.vale_alimentacao);
    push(descontos, "107", "Uniforme", row.uniform_value);
    push(descontos, "108", "Outros descontos", row.outros_descontos);

    autoTable(doc, {
      startY: 45,
      head: [["Cód.", "Proventos", "Valor"]],
      body: proventos.length ? proventos : [["", "Nenhum provento", ""]],
      styles: { fontSize: 9, halign: "left" },
      columnStyles: { 2: { halign: "right" } },
      headStyles: { fillColor: [27, 79, 216] },
      theme: "grid"
    });

    const yAfterProv = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4;
    autoTable(doc, {
      startY: yAfterProv,
      head: [["Cód.", "Descontos", "Valor"]],
      body: descontos.length ? descontos : [["", "Nenhum desconto", ""]],
      styles: { fontSize: 9 },
      columnStyles: { 2: { halign: "right" } },
      headStyles: { fillColor: [190, 50, 50] },
      theme: "grid"
    });

    const yAfterDesc = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(`Total proventos: ${money.format(Number(row.total_earnings ?? 0))}`, 14, yAfterDesc);
    doc.text(`Total descontos: ${money.format(Number(row.total_deductions ?? 0))}`, 14, yAfterDesc + 6);
    doc.setFontSize(12);
    doc.text(`Líquido a receber: ${money.format(Number(row.net_amount ?? 0))}`, 14, yAfterDesc + 14);

    // Bases informativas
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    const baseInss = Number(row.total_earnings ?? 0) - Number(row.family_allowance ?? 0);
    const baseIr = baseInss - Number(row.inss ?? 0);
    const fgts = Math.round(baseInss * 0.08 * 100) / 100;
    doc.text(`Base INSS: ${money.format(baseInss)}  |  Base IR: ${money.format(baseIr)}  |  FGTS (8%): ${money.format(fgts)}`, 14, yAfterDesc + 22);

    doc.line(20, yAfterDesc + 38, 90, yAfterDesc + 38);
    doc.text("Assinatura do funcionário", 30, yAfterDesc + 42);
    doc.line(120, yAfterDesc + 38, 190, yAfterDesc + 38);
    doc.text("Assinatura da empresa", 132, yAfterDesc + 42);

    const cpfClean = (emp?.cpf ?? "").replace(/\D/g, "");
    doc.save(`holerite_${cpfClean}_${mes}.pdf`);
  };

  return (
    <button type="button" onClick={handleClick} className="ds-button ds-button-secondary">
      <FileDown size={14} /> Holerite PDF
    </button>
  );
}
```

- [ ] **Step 2: Verify jspdf libs**

Run:
```bash
cd c:/Desenv/Projetos/rrb-escola
node -e "require('jspdf'); require('jspdf-autotable'); console.log('ok')"
```
Expected: `ok`. If missing: `npm install jspdf jspdf-autotable`.

- [ ] **Step 3: Type check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
cd c:/Desenv/Projetos/rrb-escola
git add src/components/rh/payroll/holerite-pdf-button.tsx
git commit -m "feat(payroll): holerite PDF button via jspdf"
```

---

## Task 14: Export month buttons (XLSX + PDF tabular)

**Files:**
- Create: `src/components/rh/payroll/export-month-buttons.tsx`

- [ ] **Step 1: Create file**

File: `src/components/rh/payroll/export-month-buttons.tsx`

```tsx
"use client";

import { FileSpreadsheet, FileText } from "lucide-react";
import ExcelJS from "exceljs";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { monthLabel } from "@/lib/payroll/date-utils";
import { money } from "@/lib/constants";
import type { PayrollRowJoined } from "@/lib/data/payroll";

export function ExportMonthButtons({ rows, mes }: { rows: PayrollRowJoined[]; mes: string }) {
  const handleXlsx = async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(`Folha ${mes}`);
    ws.columns = [
      { header: "Funcionário", key: "name", width: 30 },
      { header: "CPF", key: "cpf", width: 16 },
      { header: "Empresa", key: "empresa", width: 25 },
      { header: "Base", key: "base", width: 12 },
      { header: "Proventos", key: "proventos", width: 14 },
      { header: "INSS", key: "inss", width: 12 },
      { header: "IR", key: "ir", width: 12 },
      { header: "Descontos", key: "descontos", width: 14 },
      { header: "Líquido", key: "liquido", width: 14 }
    ];
    rows.forEach((r) => {
      ws.addRow({
        name: r.employees?.name ?? "—",
        cpf: r.employees?.cpf ?? "",
        empresa: r.employees?.companies?.name ?? "—",
        base: Number(r.base_salary ?? 0),
        proventos: Number(r.total_earnings ?? 0),
        inss: Number(r.inss ?? 0),
        ir: Number(r.ir ?? 0),
        descontos: Number(r.total_deductions ?? 0),
        liquido: Number(r.net_amount ?? 0)
      });
    });
    ws.getRow(1).font = { bold: true };
    ["base", "proventos", "inss", "ir", "descontos", "liquido"].forEach((k) => {
      ws.getColumn(k).numFmt = '"R$ "#,##0.00';
    });

    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `folha_${mes}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePdf = () => {
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text(`Folha de pagamento — ${monthLabel(mes)}`, 14, 15);

    autoTable(doc, {
      startY: 22,
      head: [["Funcionário", "Empresa", "Base", "Proventos", "INSS", "IR", "Descontos", "Líquido"]],
      body: rows.map((r) => [
        r.employees?.name ?? "—",
        r.employees?.companies?.name ?? "—",
        money.format(Number(r.base_salary ?? 0)),
        money.format(Number(r.total_earnings ?? 0)),
        money.format(Number(r.inss ?? 0)),
        money.format(Number(r.ir ?? 0)),
        money.format(Number(r.total_deductions ?? 0)),
        money.format(Number(r.net_amount ?? 0))
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [27, 79, 216] },
      columnStyles: {
        2: { halign: "right" },
        3: { halign: "right" },
        4: { halign: "right" },
        5: { halign: "right" },
        6: { halign: "right" },
        7: { halign: "right" }
      },
      theme: "striped"
    });

    doc.save(`folha_${mes}.pdf`);
  };

  return (
    <div className="inline-flex gap-2">
      <button type="button" onClick={handleXlsx} className="ds-button ds-button-secondary">
        <FileSpreadsheet size={14} /> Exportar XLSX
      </button>
      <button type="button" onClick={handlePdf} className="ds-button ds-button-secondary">
        <FileText size={14} /> Exportar PDF
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Type check + commit**

```bash
cd c:/Desenv/Projetos/rrb-escola
npx tsc --noEmit
git add src/components/rh/payroll/export-month-buttons.tsx
git commit -m "feat(payroll): export month XLSX + PDF tabular"
```

---

## Task 15: Payroll row form (live calc, 3 cards)

**Files:**
- Create: `src/components/rh/payroll/payroll-row-form.tsx`

- [ ] **Step 1: Create file**

File: `src/components/rh/payroll/payroll-row-form.tsx`

```tsx
"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/card";
import { money } from "@/lib/constants";
import { calcAll, type InssBracket, type IrBracket, type PayrollInput as CalcInput } from "@/lib/payroll/calculators";
import type { PayrollRowJoined } from "@/lib/data/payroll";
import { upsertPayrollAction } from "@/lib/actions/payroll";

type Props = {
  row: PayrollRowJoined;
  brackets: { inss: InssBracket[]; ir: IrBracket[] };
  disabled: boolean;
};

type FormState = {
  base_salary: number;
  horas_extras: number;
  gratificacao: number;
  comissao: number;
  adicional_noturno: number;
  periculosidade: number;
  insalubridade: number;
  outros_proventos: number;
  family_allowance: number;
  vale_transporte: number;
  vale_alimentacao: number;
  outros_descontos: number;
  loan_deduction: number;
  advance: number;
  uniform_value: number;
  dependentes: number;
  inss_manual: boolean;
  ir_manual: boolean;
  inss: number;
  ir: number;
  consider_decimo_terceiro: boolean;
  considera_um_tercio_ferias: boolean;
  observations: string;
};

function num(v: unknown): number {
  if (v == null || v === "") return 0;
  if (typeof v === "number") return v;
  return Number(String(v).replace(",", ".")) || 0;
}

export function PayrollRowForm({ row, brackets, disabled }: Props) {
  const initial: FormState = useMemo(
    () => ({
      base_salary: num(row.base_salary),
      horas_extras: num(row.horas_extras),
      gratificacao: num(row.gratificacao),
      comissao: num(row.comissao),
      adicional_noturno: num(row.adicional_noturno),
      periculosidade: num(row.periculosidade),
      insalubridade: num(row.insalubridade),
      outros_proventos: num(row.outros_proventos),
      family_allowance: num(row.family_allowance),
      vale_transporte: num(row.vale_transporte),
      vale_alimentacao: num(row.vale_alimentacao),
      outros_descontos: num(row.outros_descontos),
      loan_deduction: num(row.loan_deduction),
      advance: num(row.advance),
      uniform_value: num(row.uniform_value),
      dependentes: num(row.dependentes),
      inss_manual: !!row.inss_manual,
      ir_manual: !!row.ir_manual,
      inss: num(row.inss),
      ir: num(row.ir),
      consider_decimo_terceiro: !!row.consider_decimo_terceiro,
      considera_um_tercio_ferias: !!row.considera_um_tercio_ferias,
      observations: row.observations ?? ""
    }),
    [row]
  );
  const [state, setState] = useState<FormState>(initial);

  const calcInput: CalcInput = {
    base_salary: state.base_salary,
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

  const computed = calcAll(calcInput, brackets, {
    manualInss: state.inss_manual ? state.inss : undefined,
    manualIr: state.ir_manual ? state.ir : undefined
  });

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setState((s) => ({ ...s, [k]: v }));
  const setNum = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) =>
    set(k, num(e.target.value) as never);

  const resetCalc = () => {
    setState((s) => ({ ...s, inss_manual: false, ir_manual: false, inss: computed.inss, ir: computed.ir }));
  };

  return (
    <form action={upsertPayrollAction} className="grid gap-6">
      <input type="hidden" name="employee_id" value={row.employee_id} />
      <input type="hidden" name="reference_month" value={row.reference_month} />

      <div className="grid gap-3 lg:grid-cols-3">
        <Panel className="grid gap-3 p-5">
          <h3 className="text-sm font-bold text-ink uppercase tracking-[0.1em]">Proventos</h3>
          <NumberField label="Salário base" name="base_salary" value={state.base_salary} onChange={setNum("base_salary")} disabled={disabled} required />
          <NumberField label="Horas extras" name="horas_extras" value={state.horas_extras} onChange={setNum("horas_extras")} disabled={disabled} />
          <NumberField label="Gratificação" name="gratificacao" value={state.gratificacao} onChange={setNum("gratificacao")} disabled={disabled} />
          <NumberField label="Comissão" name="comissao" value={state.comissao} onChange={setNum("comissao")} disabled={disabled} />
          <NumberField label="Adicional noturno" name="adicional_noturno" value={state.adicional_noturno} onChange={setNum("adicional_noturno")} disabled={disabled} />
          <NumberField label="Periculosidade" name="periculosidade" value={state.periculosidade} onChange={setNum("periculosidade")} disabled={disabled} />
          <NumberField label="Insalubridade" name="insalubridade" value={state.insalubridade} onChange={setNum("insalubridade")} disabled={disabled} />
          <NumberField label="Outros proventos" name="outros_proventos" value={state.outros_proventos} onChange={setNum("outros_proventos")} disabled={disabled} />
          <NumberField label="Salário-família" name="family_allowance" value={state.family_allowance} onChange={setNum("family_allowance")} disabled={disabled} />
          <div className="mt-2 border-t border-line pt-2 flex justify-between text-sm font-bold">
            <span className="text-ink/70">Subtotal proventos</span>
            <span className="text-success tabular-nums">{money.format(computed.total_earnings)}</span>
          </div>
        </Panel>

        <Panel className="grid gap-3 p-5">
          <h3 className="text-sm font-bold text-ink uppercase tracking-[0.1em]">Descontos</h3>

          <label className="flex items-center justify-between text-xs">
            <span className="font-semibold text-ink/70">INSS</span>
            <label className="inline-flex items-center gap-1 text-[0.65rem] text-ink/60">
              <input
                type="checkbox"
                name="inss_manual"
                checked={state.inss_manual}
                onChange={(e) => set("inss_manual", e.target.checked)}
                disabled={disabled}
                className="h-3 w-3 accent-brand"
              />
              Editar manual
            </label>
          </label>
          {state.inss_manual ? (
            <input
              name="inss"
              type="number"
              step="0.01"
              min="0"
              value={state.inss}
              onChange={setNum("inss")}
              disabled={disabled}
            />
          ) : (
            <>
              <input type="hidden" name="inss" value={computed.inss} />
              <div className="rounded-ui border border-line bg-paper px-3 py-2 text-sm text-danger font-semibold tabular-nums">
                {money.format(computed.inss)} <span className="text-xs text-ink/45 font-normal">(auto)</span>
              </div>
            </>
          )}

          <label className="flex items-center justify-between text-xs mt-2">
            <span className="font-semibold text-ink/70">IRRF</span>
            <label className="inline-flex items-center gap-1 text-[0.65rem] text-ink/60">
              <input
                type="checkbox"
                name="ir_manual"
                checked={state.ir_manual}
                onChange={(e) => set("ir_manual", e.target.checked)}
                disabled={disabled}
                className="h-3 w-3 accent-brand"
              />
              Editar manual
            </label>
          </label>
          {state.ir_manual ? (
            <input
              name="ir"
              type="number"
              step="0.01"
              min="0"
              value={state.ir}
              onChange={setNum("ir")}
              disabled={disabled}
            />
          ) : (
            <>
              <input type="hidden" name="ir" value={computed.ir} />
              <div className="rounded-ui border border-line bg-paper px-3 py-2 text-sm text-danger font-semibold tabular-nums">
                {money.format(computed.ir)} <span className="text-xs text-ink/45 font-normal">(auto)</span>
              </div>
            </>
          )}

          <NumberField label="Dependentes (IR)" name="dependentes" value={state.dependentes} onChange={setNum("dependentes")} step={1} integer disabled={disabled} />
          <NumberField label="Empréstimo" name="loan_deduction" value={state.loan_deduction} onChange={setNum("loan_deduction")} disabled={disabled} />
          <NumberField label="Adiantamento" name="advance" value={state.advance} onChange={setNum("advance")} disabled={disabled} />
          <NumberField label="Vale transporte" name="vale_transporte" value={state.vale_transporte} onChange={setNum("vale_transporte")} disabled={disabled} />
          <NumberField label="Vale alimentação" name="vale_alimentacao" value={state.vale_alimentacao} onChange={setNum("vale_alimentacao")} disabled={disabled} />
          <NumberField label="Outros descontos" name="outros_descontos" value={state.outros_descontos} onChange={setNum("outros_descontos")} disabled={disabled} />
          <NumberField label="Uniforme" name="uniform_value" value={state.uniform_value} onChange={setNum("uniform_value")} disabled={disabled} />

          <div className="mt-2 border-t border-line pt-2 flex justify-between text-sm font-bold">
            <span className="text-ink/70">Subtotal descontos</span>
            <span className="text-warning tabular-nums">{money.format(computed.total_deductions)}</span>
          </div>
        </Panel>

        <Panel className="grid gap-3 p-5">
          <h3 className="text-sm font-bold text-ink uppercase tracking-[0.1em]">Outros / Resumo</h3>
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="consider_decimo_terceiro"
              checked={state.consider_decimo_terceiro}
              onChange={(e) => set("consider_decimo_terceiro", e.target.checked)}
              disabled={disabled}
              className="h-4 w-4 accent-brand"
            />
            Considera 13º
          </label>
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="considera_um_tercio_ferias"
              checked={state.considera_um_tercio_ferias}
              onChange={(e) => set("considera_um_tercio_ferias", e.target.checked)}
              disabled={disabled}
              className="h-4 w-4 accent-brand"
            />
            Considera 1/3 férias
          </label>
          <label className="block text-sm">
            <span className="text-xs font-semibold text-ink/70">Observações</span>
            <textarea
              name="observations"
              value={state.observations}
              onChange={(e) => set("observations", e.target.value)}
              disabled={disabled}
              rows={3}
              className="mt-1 w-full rounded-ui border border-line bg-surface px-3 py-2 text-sm"
            />
          </label>
          <div className="mt-2 border-t border-line pt-3 grid gap-2">
            <div className="flex justify-between text-xs">
              <span className="text-ink/60">Total proventos</span>
              <span className="text-success tabular-nums">{money.format(computed.total_earnings)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-ink/60">Total descontos</span>
              <span className="text-warning tabular-nums">{money.format(computed.total_deductions)}</span>
            </div>
            <div className="flex justify-between items-end pt-2 border-t border-line">
              <span className="text-xs font-bold uppercase tracking-[0.1em] text-ink/60">Líquido</span>
              <span className="font-display text-3xl text-brand tabular-nums">{money.format(computed.net_amount)}</span>
            </div>
          </div>
          <button
            type="button"
            className="mt-2 text-xs font-semibold text-brand hover:underline disabled:opacity-50"
            onClick={resetCalc}
            disabled={disabled}
          >
            Resetar INSS/IR automático
          </button>
        </Panel>
      </div>

      {!disabled ? (
        <div className="flex justify-end">
          <Button type="submit" variant="primary">Salvar</Button>
        </div>
      ) : null}
    </form>
  );
}

function NumberField({
  label,
  name,
  value,
  onChange,
  step = 0.01,
  integer = false,
  required = false,
  disabled = false
}: {
  label: string;
  name: string;
  value: number;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  step?: number;
  integer?: boolean;
  required?: boolean;
  disabled?: boolean;
}) {
  return (
    <label className="block text-sm">
      <span className="text-xs font-semibold text-ink/70">{label}</span>
      <input
        name={name}
        type="number"
        step={integer ? 1 : step}
        min="0"
        value={value}
        onChange={onChange}
        required={required}
        disabled={disabled}
        className="mt-1 w-full rounded-ui border border-line bg-surface px-3 py-2 text-sm tabular-nums"
      />
    </label>
  );
}
```

- [ ] **Step 2: Type check**

Run: `cd c:/Desenv/Projetos/rrb-escola && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
cd c:/Desenv/Projetos/rrb-escola
git add src/components/rh/payroll/payroll-row-form.tsx
git commit -m "feat(payroll): payroll row form with live calc"
```

---

## Task 16: Payroll redirect page + month page

**Files:**
- Create: `src/app/(app)/rh/folha/page.tsx`
- Create: `src/app/(app)/rh/folha/[mes]/page.tsx`

- [ ] **Step 1: Create redirect page**

File: `src/app/(app)/rh/folha/page.tsx`

```tsx
import { redirect } from "next/navigation";
import { currentUrlMonth } from "@/lib/payroll/date-utils";

export default function FolhaIndex() {
  redirect(`/rh/folha/${currentUrlMonth()}`);
}
```

- [ ] **Step 2: Create month page**

File: `src/app/(app)/rh/folha/[mes]/page.tsx`

```tsx
import { notFound } from "next/navigation";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/status-pill";
import { MonthNav } from "@/components/rh/payroll/month-nav";
import { GenerateMonthButton } from "@/components/rh/payroll/generate-month-button";
import { ClosePeriodButton } from "@/components/rh/payroll/close-period-button";
import { PayrollMonthTable } from "@/components/rh/payroll/payroll-month-table";
import { PayrollSummaryCard } from "@/components/rh/payroll/payroll-summary-card";
import { ExportMonthButtons } from "@/components/rh/payroll/export-month-buttons";
import { requirePerfil } from "@/lib/auth/session";
import { isValidUrlMonth, urlToDbMonth, monthLabel } from "@/lib/payroll/date-utils";
import {
  listPayrollByMonth,
  getPayrollPeriod,
  getMonthSummary,
  listEmployeesNeedingPayroll
} from "@/lib/data/payroll";

export const dynamic = "force-dynamic";

export default async function FolhaMesPage({
  params,
  searchParams
}: {
  params: Promise<{ mes: string }>;
  searchParams: Promise<{ ok?: string; erro?: string }>;
}) {
  const session = await requirePerfil(["admin", "financeiro"]);
  const { mes } = await params;
  const sp = await searchParams;

  if (!isValidUrlMonth(mes)) notFound();
  const dbMonth = urlToDbMonth(mes);
  const isAdmin = session.profile.perfil === "admin";

  const [rows, period, summary, needing] = await Promise.all([
    listPayrollByMonth(dbMonth),
    getPayrollPeriod(dbMonth),
    getMonthSummary(dbMonth),
    listEmployeesNeedingPayroll(dbMonth)
  ]);

  const fechado = period.status === "fechado";

  return (
    <div className="grid gap-8">
      <PageHeader
        breadcrumb={[{ label: "RH" }, { label: "Folha" }, { label: monthLabel(mes) }]}
        title="Folha de pagamento"
        counter={monthLabel(mes)}
        description="Lançamentos da competência. Salário base, proventos, descontos e líquido por funcionário."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <MonthNav mes={mes} />
            <span className="mx-1 h-5 w-px bg-line" />
            <GenerateMonthButton mes={mes} hasPayrolls={rows.length > 0} />
            {isAdmin ? <ClosePeriodButton mes={mes} status={period.status} /> : null}
            <ExportMonthButtons rows={rows} mes={mes} />
          </div>
        }
      />

      {sp.ok ? (
        <div className="rounded-ui bg-success/10 p-3 text-sm font-semibold text-success">
          Operação <strong>{sp.ok}</strong> concluída.
        </div>
      ) : null}
      {sp.erro ? (
        <div className="rounded-ui bg-danger/10 p-3 text-sm font-semibold text-danger">{sp.erro}</div>
      ) : null}

      {fechado ? (
        <div className="rounded-ui bg-warning/10 border border-warning/30 p-3 text-sm font-semibold text-warning">
          Mês fechado em {period.closed_at ? new Date(period.closed_at).toLocaleString("pt-BR") : "—"}. Edições bloqueadas.
        </div>
      ) : null}

      {needing.length > 0 && rows.length > 0 ? (
        <div className="rounded-ui bg-brand/10 p-3 text-sm font-semibold text-brand flex items-center justify-between gap-3">
          <span>{needing.length} funcionário(s) ativo(s) sem lançamento neste mês.</span>
          <GenerateMonthButton mes={mes} hasPayrolls={true} />
        </div>
      ) : null}

      <PayrollSummaryCard summary={summary} />

      <Panel className="flex items-center justify-between gap-3 p-4">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-ink/70">Status do período:</span>
          <StatusPill tone={fechado ? "danger" : "success"}>{fechado ? "Fechado" : "Aberto"}</StatusPill>
        </div>
        <ButtonLink href="/rh/brackets" variant="secondary">Brackets</ButtonLink>
      </Panel>

      {rows.length === 0 ? (
        <div className="rounded-panel border border-line bg-surface p-10 text-center">
          <p className="text-sm font-medium text-ink/65">Folha de {monthLabel(mes)} ainda não foi gerada.</p>
          <div className="mt-4 inline-block">
            <GenerateMonthButton mes={mes} hasPayrolls={false} />
          </div>
        </div>
      ) : (
        <PayrollMonthTable rows={rows} mes={mes} canEdit={!fechado} />
      )}
    </div>
  );
}
```

- [ ] **Step 3: Type check + smoke**

Run: `npx tsc --noEmit`
Expected: clean.

Start dev server, navigate to `/rh/folha`. Should redirect to current month.
Empty mês → empty state with "Gerar folha" button.

- [ ] **Step 4: Commit**

```bash
cd c:/Desenv/Projetos/rrb-escola
git add "src/app/(app)/rh/folha/page.tsx" "src/app/(app)/rh/folha/[mes]/page.tsx"
git commit -m "feat(payroll): folha redirect + month list page"
```

---

## Task 17: Employee/month form page

**Files:**
- Create: `src/app/(app)/rh/folha/[mes]/[employee_id]/page.tsx`

- [ ] **Step 1: Create page**

File: `src/app/(app)/rh/folha/[mes]/[employee_id]/page.tsx`

```tsx
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { PayrollRowForm } from "@/components/rh/payroll/payroll-row-form";
import { HoleritePdfButton } from "@/components/rh/payroll/holerite-pdf-button";
import { requirePerfil } from "@/lib/auth/session";
import { isValidUrlMonth, urlToDbMonth, monthLabel } from "@/lib/payroll/date-utils";
import { getPayrollByEmployeeMonth, getPayrollPeriod } from "@/lib/data/payroll";
import { getBracketsForMonth } from "@/lib/data/brackets";

export const dynamic = "force-dynamic";

export default async function FolhaEmployeeMonthPage({
  params,
  searchParams
}: {
  params: Promise<{ mes: string; employee_id: string }>;
  searchParams: Promise<{ ok?: string; erro?: string }>;
}) {
  await requirePerfil(["admin", "financeiro"]);
  const { mes, employee_id } = await params;
  const sp = await searchParams;

  if (!isValidUrlMonth(mes)) notFound();
  const dbMonth = urlToDbMonth(mes);

  const [row, period, brackets] = await Promise.all([
    getPayrollByEmployeeMonth(employee_id, dbMonth),
    getPayrollPeriod(dbMonth),
    getBracketsForMonth(dbMonth)
  ]);

  if (!row) notFound();

  const disabled = period.status === "fechado";
  const emp = row.employees;

  return (
    <div className="grid gap-6">
      <PageHeader
        breadcrumb={[
          { label: "RH" },
          { label: "Folha", href: "/rh/folha" },
          { label: monthLabel(mes), href: `/rh/folha/${mes}` },
          { label: emp?.name ?? "—" }
        ]}
        title={emp?.name ?? "—"}
        counter={monthLabel(mes)}
        description={`${emp?.companies?.name ?? "—"} • ${emp?.cargo ?? "—"} • ${emp?.school_category ?? "—"}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <HoleritePdfButton row={row} mes={mes} />
            <ButtonLink href={`/rh/folha/${mes}`} variant="secondary">
              <ArrowLeft size={14} /> Voltar
            </ButtonLink>
          </div>
        }
      />

      {sp.ok ? (
        <div className="rounded-ui bg-success/10 p-3 text-sm font-semibold text-success">
          Lançamento salvo.
        </div>
      ) : null}
      {sp.erro ? (
        <div className="rounded-ui bg-danger/10 p-3 text-sm font-semibold text-danger">{sp.erro}</div>
      ) : null}

      {disabled ? (
        <div className="rounded-ui bg-warning/10 border border-warning/30 p-3 text-sm font-semibold text-warning">
          Mês fechado. Reabra para editar.
        </div>
      ) : null}

      {brackets.inss.length === 0 || brackets.ir.length === 0 ? (
        <div className="rounded-ui bg-danger/10 p-3 text-sm font-semibold text-danger">
          Brackets INSS/IR não configurados para esta competência. Acesse <strong>/rh/brackets</strong> para cadastrar.
        </div>
      ) : null}

      <PayrollRowForm row={row} brackets={brackets} disabled={disabled} />
    </div>
  );
}
```

- [ ] **Step 2: Type check + smoke**

Run: `npx tsc --noEmit`
Expected: clean.

Navigate to `/rh/folha/2026-05/<employee_id>` after Gerar folha. Form renders, live calc on edit, save works.

- [ ] **Step 3: Commit**

```bash
cd c:/Desenv/Projetos/rrb-escola
git add "src/app/(app)/rh/folha/[mes]/[employee_id]/page.tsx"
git commit -m "feat(payroll): employee/month form page"
```

---

## Task 18: Brackets table component

**Files:**
- Create: `src/components/rh/brackets/brackets-table.tsx`

- [ ] **Step 1: Create file**

File: `src/components/rh/brackets/brackets-table.tsx`

```tsx
"use client";

import { Trash2 } from "lucide-react";
import { upsertBracketAction, deleteBracketAction } from "@/lib/actions/brackets";
import type { InssBracketRow, IrBracketRow } from "@/lib/data/brackets";

type Props =
  | { table: "inss"; vigencia: string; brackets: InssBracketRow[] }
  | { table: "ir"; vigencia: string; brackets: IrBracketRow[] };

export function BracketsTable(props: Props) {
  const { table, vigencia, brackets } = props;
  return (
    <div className="overflow-x-auto rounded-panel border border-line bg-surface">
      <table className="ds-dt min-w-[700px]">
        <thead>
          <tr>
            <th className="w-16">Ordem</th>
            <th>De (R$)</th>
            <th>Até (R$)</th>
            <th>Alíquota</th>
            <th>Parc. deduzir (R$)</th>
            {table === "ir" ? <th>Ded. dependente (R$)</th> : null}
            <th className="text-right">Ações</th>
          </tr>
        </thead>
        <tbody>
          {brackets.length === 0 ? (
            <tr>
              <td colSpan={table === "ir" ? 7 : 6} className="text-center text-ink/50 py-8">
                Nenhuma faixa nesta vigência.
              </td>
            </tr>
          ) : null}
          {brackets.map((b) => (
            <tr key={b.id}>
              <form action={upsertBracketAction} className="contents">
                <input type="hidden" name="id" value={b.id} />
                <input type="hidden" name="table" value={table} />
                <input type="hidden" name="vigencia_inicio" value={vigencia} />
                <td>
                  <input name="ordem" type="number" min="1" defaultValue={b.ordem} className="w-16 tabular-nums" />
                </td>
                <td>
                  <input name="valor_de" type="number" step="0.01" min="0" defaultValue={b.valor_de} className="tabular-nums" />
                </td>
                <td>
                  <input
                    name="valor_ate"
                    type="number"
                    step="0.01"
                    min="0"
                    defaultValue={b.valor_ate ?? ""}
                    placeholder="(sem teto)"
                    className="tabular-nums"
                  />
                </td>
                <td>
                  <input name="aliquota" type="number" step="0.0001" min="0" max="1" defaultValue={b.aliquota} className="tabular-nums" />
                </td>
                <td>
                  <input name="parcela_deduzir" type="number" step="0.01" min="0" defaultValue={b.parcela_deduzir} className="tabular-nums" />
                </td>
                {table === "ir" ? (
                  <td>
                    <input
                      name="deducao_dependente"
                      type="number"
                      step="0.01"
                      min="0"
                      defaultValue={(b as IrBracketRow).deducao_dependente}
                      className="tabular-nums"
                    />
                  </td>
                ) : null}
                <td className="text-right">
                  <button type="submit" className="text-xs font-semibold text-brand hover:underline mr-3">Salvar</button>
                </td>
              </form>
              <td className="text-right">
                <form
                  action={deleteBracketAction}
                  onSubmit={(e) => {
                    if (!confirm("Excluir esta faixa?")) e.preventDefault();
                  }}
                  className="inline"
                >
                  <input type="hidden" name="id" value={b.id} />
                  <input type="hidden" name="table" value={table} />
                  <button type="submit" className="text-xs font-semibold text-danger hover:underline inline-flex items-center gap-1">
                    <Trash2 size={12} /> Remover
                  </button>
                </form>
              </td>
            </tr>
          ))}
          {/* Linha "nova faixa" */}
          <tr>
            <form action={upsertBracketAction} className="contents">
              <input type="hidden" name="table" value={table} />
              <input type="hidden" name="vigencia_inicio" value={vigencia} />
              <td>
                <input name="ordem" type="number" min="1" defaultValue={brackets.length + 1} className="w-16 tabular-nums" />
              </td>
              <td>
                <input name="valor_de" type="number" step="0.01" min="0" placeholder="0,00" className="tabular-nums" />
              </td>
              <td>
                <input name="valor_ate" type="number" step="0.01" min="0" placeholder="(sem teto)" className="tabular-nums" />
              </td>
              <td>
                <input name="aliquota" type="number" step="0.0001" min="0" max="1" placeholder="0,1500" className="tabular-nums" />
              </td>
              <td>
                <input name="parcela_deduzir" type="number" step="0.01" min="0" placeholder="0,00" className="tabular-nums" />
              </td>
              {table === "ir" ? (
                <td>
                  <input name="deducao_dependente" type="number" step="0.01" min="0" placeholder="0,00" className="tabular-nums" />
                </td>
              ) : null}
              <td className="text-right">
                <button type="submit" className="text-xs font-semibold text-success hover:underline">+ Adicionar faixa</button>
              </td>
            </form>
            <td></td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
cd c:/Desenv/Projetos/rrb-escola
git add src/components/rh/brackets/brackets-table.tsx
git commit -m "feat(payroll): editable brackets table component"
```

---

## Task 19: New vigência button

**Files:**
- Create: `src/components/rh/brackets/new-vigencia-button.tsx`

- [ ] **Step 1: Create file**

File: `src/components/rh/brackets/new-vigencia-button.tsx`

```tsx
"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { createBracketVigenciaAction } from "@/lib/actions/brackets";

export function NewVigenciaButton({
  table,
  vigencias
}: {
  table: "inss" | "ir";
  vigencias: string[];
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="ds-button ds-button-primary"
      >
        <Plus size={14} /> Nova vigência
      </button>
    );
  }

  return (
    <form action={createBracketVigenciaAction} className="flex items-center gap-2 rounded-ui border border-line bg-surface p-3">
      <input type="hidden" name="table" value={table} />
      <label className="flex items-center gap-2 text-xs">
        <span className="font-semibold text-ink/70">Início</span>
        <input name="vigencia_inicio" type="date" required className="text-sm" />
      </label>
      <label className="flex items-center gap-2 text-xs">
        <span className="font-semibold text-ink/70">Copiar de</span>
        <select name="copy_from" defaultValue={vigencias[0] ?? ""}>
          <option value="">(vazia)</option>
          {vigencias.map((v) => (
            <option key={v} value={v}>{v}</option>
          ))}
        </select>
      </label>
      <button type="submit" className="ds-button ds-button-primary">Criar</button>
      <button type="button" onClick={() => setOpen(false)} className="text-xs font-semibold text-ink/55 hover:text-brand">
        Cancelar
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Type check + commit**

```bash
cd c:/Desenv/Projetos/rrb-escola
npx tsc --noEmit
git add src/components/rh/brackets/new-vigencia-button.tsx
git commit -m "feat(payroll): new vigência button (admin)"
```

---

## Task 20: Brackets admin page

**Files:**
- Create: `src/app/(app)/rh/brackets/page.tsx`

- [ ] **Step 1: Create page**

File: `src/app/(app)/rh/brackets/page.tsx`

```tsx
import Link from "next/link";
import { Trash2 } from "lucide-react";
import { Panel } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { BracketsTable } from "@/components/rh/brackets/brackets-table";
import { NewVigenciaButton } from "@/components/rh/brackets/new-vigencia-button";
import { listBracketVigencias, listBracketsByVigencia } from "@/lib/data/brackets";
import { deleteVigenciaAction } from "@/lib/actions/brackets";
import { requirePerfil } from "@/lib/auth/session";
import type { InssBracketRow, IrBracketRow } from "@/lib/data/brackets";

export const dynamic = "force-dynamic";

export default async function BracketsPage({
  searchParams
}: {
  searchParams: Promise<{ tab?: string; vigencia?: string; ok?: string; erro?: string }>;
}) {
  await requirePerfil(["admin"]);
  const sp = await searchParams;

  const [inssVigencias, irVigencias] = await Promise.all([
    listBracketVigencias("inss"),
    listBracketVigencias("ir")
  ]);

  const inssVigSel = sp.vigencia && sp.tab === "inss" ? sp.vigencia : inssVigencias[0];
  const irVigSel = sp.vigencia && sp.tab === "ir" ? sp.vigencia : irVigencias[0];

  const [inssBrackets, irBrackets] = await Promise.all([
    inssVigSel ? listBracketsByVigencia("inss", inssVigSel) : Promise.resolve([] as InssBracketRow[]),
    irVigSel ? listBracketsByVigencia("ir", irVigSel) : Promise.resolve([] as IrBracketRow[])
  ]);

  return (
    <div className="grid gap-8">
      <PageHeader
        breadcrumb={[{ label: "RH" }, { label: "Configuração" }, { label: "Brackets" }]}
        title="Tabelas progressivas"
        description="Vigências de INSS e IRRF. A folha usa a vigência mais recente cuja data ≤ competência."
      />

      {sp.ok ? (
        <div className="rounded-ui bg-success/10 p-3 text-sm font-semibold text-success">Operação concluída.</div>
      ) : null}
      {sp.erro ? (
        <div className="rounded-ui bg-danger/10 p-3 text-sm font-semibold text-danger">{sp.erro}</div>
      ) : null}

      <Panel className="grid gap-4 p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-ink">INSS</h2>
          <div className="flex items-center gap-2">
            {inssVigencias.length > 0 ? (
              <select
                defaultValue={inssVigSel}
                onChange={(e) => {
                  window.location.href = `/rh/brackets?tab=inss&vigencia=${e.target.value}`;
                }}
                className="text-sm"
              >
                {inssVigencias.map((v) => (
                  <option key={v} value={v}>Vigência: {v}</option>
                ))}
              </select>
            ) : (
              <span className="text-sm text-ink/55">Nenhuma vigência</span>
            )}
            <NewVigenciaButton table="inss" vigencias={inssVigencias} />
            {inssVigSel ? (
              <form
                action={deleteVigenciaAction}
                onSubmit={(e) => {
                  if (!confirm(`Excluir vigência INSS ${inssVigSel}?`)) e.preventDefault();
                }}
                className="inline"
              >
                <input type="hidden" name="table" value="inss" />
                <input type="hidden" name="vigencia" value={inssVigSel} />
                <button type="submit" className="ds-button ds-button-secondary text-danger">
                  <Trash2 size={14} /> Excluir vigência
                </button>
              </form>
            ) : null}
          </div>
        </div>
        {inssVigSel ? (
          <BracketsTable table="inss" vigencia={inssVigSel} brackets={inssBrackets as InssBracketRow[]} />
        ) : (
          <p className="text-sm text-ink/55">Crie uma vigência para começar.</p>
        )}
      </Panel>

      <Panel className="grid gap-4 p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-ink">IRRF</h2>
          <div className="flex items-center gap-2">
            {irVigencias.length > 0 ? (
              <select
                defaultValue={irVigSel}
                onChange={(e) => {
                  window.location.href = `/rh/brackets?tab=ir&vigencia=${e.target.value}`;
                }}
                className="text-sm"
              >
                {irVigencias.map((v) => (
                  <option key={v} value={v}>Vigência: {v}</option>
                ))}
              </select>
            ) : (
              <span className="text-sm text-ink/55">Nenhuma vigência</span>
            )}
            <NewVigenciaButton table="ir" vigencias={irVigencias} />
            {irVigSel ? (
              <form
                action={deleteVigenciaAction}
                onSubmit={(e) => {
                  if (!confirm(`Excluir vigência IR ${irVigSel}?`)) e.preventDefault();
                }}
                className="inline"
              >
                <input type="hidden" name="table" value="ir" />
                <input type="hidden" name="vigencia" value={irVigSel} />
                <button type="submit" className="ds-button ds-button-secondary text-danger">
                  <Trash2 size={14} /> Excluir vigência
                </button>
              </form>
            ) : null}
          </div>
        </div>
        {irVigSel ? (
          <BracketsTable table="ir" vigencia={irVigSel} brackets={irBrackets as IrBracketRow[]} />
        ) : (
          <p className="text-sm text-ink/55">Crie uma vigência para começar.</p>
        )}
      </Panel>

      <Panel className="p-4 text-xs text-ink/55">
        <Link href="/rh/folha" className="font-semibold text-brand hover:underline">← Voltar para folha</Link>
      </Panel>
    </div>
  );
}
```

**Important note:** The two `<select onChange>` use `window.location.href` assignment because the page is a server component but the selects need to navigate. Since this is a server component, `onChange` won't work directly — we need to wrap each select in a tiny client component OR use plain `<a>` links. The cleanest path is to extract the select to a client component. Adjust as follows:

Replace each `<select onChange>` block with a separate small client component. Create `src/components/rh/brackets/vigencia-select.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";

export function VigenciaSelect({
  table,
  vigencias,
  current
}: {
  table: "inss" | "ir";
  vigencias: string[];
  current?: string;
}) {
  const router = useRouter();
  return (
    <select
      defaultValue={current ?? ""}
      onChange={(e) => router.push(`/rh/brackets?tab=${table}&vigencia=${e.target.value}`)}
      className="text-sm"
    >
      {vigencias.map((v) => (
        <option key={v} value={v}>Vigência: {v}</option>
      ))}
    </select>
  );
}
```

Then in `brackets/page.tsx` import `VigenciaSelect` and replace the inline `<select onChange>` blocks with `<VigenciaSelect table="inss" vigencias={inssVigencias} current={inssVigSel} />` and the IR equivalent.

- [ ] **Step 2: Create VigenciaSelect client component**

File: `src/components/rh/brackets/vigencia-select.tsx` — content shown above.

- [ ] **Step 3: Update brackets/page.tsx to use VigenciaSelect**

Edit the page file. Replace the two `<select onChange>` blocks with `<VigenciaSelect />` and import the component at the top.

Final imports block in `src/app/(app)/rh/brackets/page.tsx`:

```tsx
import Link from "next/link";
import { Trash2 } from "lucide-react";
import { Panel } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { BracketsTable } from "@/components/rh/brackets/brackets-table";
import { NewVigenciaButton } from "@/components/rh/brackets/new-vigencia-button";
import { VigenciaSelect } from "@/components/rh/brackets/vigencia-select";
import { listBracketVigencias, listBracketsByVigencia } from "@/lib/data/brackets";
import { deleteVigenciaAction } from "@/lib/actions/brackets";
import { requirePerfil } from "@/lib/auth/session";
import type { InssBracketRow, IrBracketRow } from "@/lib/data/brackets";
```

Replace the INSS select block:
```tsx
{inssVigencias.length > 0 ? (
  <VigenciaSelect table="inss" vigencias={inssVigencias} current={inssVigSel} />
) : (
  <span className="text-sm text-ink/55">Nenhuma vigência</span>
)}
```

Replace the IR select block similarly with `table="ir"`.

- [ ] **Step 4: Type check + smoke**

Run: `npx tsc --noEmit`
Expected: clean.

Navigate to `/rh/brackets`. Verify 2 panels (INSS + IR), each with 4/5 seed faixas, select vigência changes URL, delete prompt, new vigência button.

- [ ] **Step 5: Commit**

```bash
cd c:/Desenv/Projetos/rrb-escola
git add "src/app/(app)/rh/brackets/page.tsx" src/components/rh/brackets/vigencia-select.tsx
git commit -m "feat(payroll): brackets admin page with vigência select"
```

---

## Task 21: Topbar RH dropdown — add Folha + Brackets

**Files:**
- Modify: `src/components/layout/rh-dropdown.tsx`

- [ ] **Step 1: Edit file**

Open `src/components/layout/rh-dropdown.tsx`. Update the icons import and `rhItems` array:

Replace:
```tsx
import { Briefcase, Building2, UsersRound, ChevronDown } from "lucide-react";
```
with:
```tsx
import { Briefcase, Building2, UsersRound, Wallet, SlidersHorizontal, ChevronDown } from "lucide-react";
```

Replace:
```tsx
const rhItems = [
  { href: "/rh/empresas", label: "Empresas", icon: Building2 },
  { href: "/rh/funcionarios", label: "Funcionários", icon: UsersRound }
];
```
with:
```tsx
const rhItems = [
  { href: "/rh/empresas", label: "Empresas", icon: Building2 },
  { href: "/rh/funcionarios", label: "Funcionários", icon: UsersRound },
  { href: "/rh/folha", label: "Folha", icon: Wallet },
  { href: "/rh/brackets", label: "Brackets", icon: SlidersHorizontal }
];
```

- [ ] **Step 2: Type check + smoke**

Run: `npx tsc --noEmit`
Expected: clean.

Open topbar → RH dropdown → verify 4 items: Empresas, Funcionários, Folha, Brackets. Click each navigates correctly.

- [ ] **Step 3: Commit**

```bash
cd c:/Desenv/Projetos/rrb-escola
git add src/components/layout/rh-dropdown.tsx
git commit -m "feat(topbar): add Folha + Brackets items to RH dropdown"
```

---

## Task 22: Final integration smoke test

- [ ] **Step 1: Full type check**

Run: `cd c:/Desenv/Projetos/rrb-escola && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 2: Walk through scenarios**

Start dev: `npm run dev`. Logged as **admin**:

- [ ] Topbar → RH → 4 items visíveis (Empresas, Funcionários, Folha, Brackets)
- [ ] `/rh/folha` redireciona p/ mês atual
- [ ] Mês vazio → empty state + botão "Gerar folha"
- [ ] Click "Gerar folha" → confirm → cria 64 linhas (uma por employee ativo)
- [ ] Lista mostra tabela com base, proventos, INSS, IR, descontos, líquido
- [ ] Cabeçalho mostra summary card com totais corretos
- [ ] Click numa linha → form individual abre em `/rh/folha/[mes]/[employee_id]`
- [ ] Edit base_salary → INSS/IR/totais recalculam em tempo real
- [ ] Toggle "Editar manual" INSS → input liberado, server respeita valor
- [ ] Resetar INSS/IR auto → recalcula via bracket
- [ ] Salvar → redirect com flash `ok=salvo`, valores persistidos
- [ ] Reload da página: valores carregados corretamente
- [ ] Holerite PDF baixa arquivo com layout correto (proventos, descontos, líquido, bases)
- [ ] Exportar XLSX baixa planilha com todos campos
- [ ] Exportar PDF baixa tabela paisagem
- [ ] Fechar mês → confirm → status banner amarelo, inputs disabled no form, botão Salvar oculto
- [ ] Reabrir mês → edição volta
- [ ] `/rh/brackets` mostra 2 panels INSS (4 faixas) + IR (5 faixas)
- [ ] Select vigência muda URL
- [ ] Editar uma faixa → Salvar persiste
- [ ] Adicionar faixa nova → criada
- [ ] Excluir faixa → confirm → removida
- [ ] Criar nova vigência via "Nova vigência" → date + copiar de → cria
- [ ] Excluir vigência inteira → confirm → remove todas faixas

Logged as **financeiro**:
- [ ] `/rh/folha` acessível, lista visível
- [ ] Form individual editável e salvável
- [ ] Botão "Fechar mês" NÃO aparece (admin only)
- [ ] `/rh/brackets` → `/acesso-negado` (admin only)

Logged as **secretaria**:
- [ ] `/rh/folha` → `/acesso-negado`
- [ ] `/rh/brackets` → `/acesso-negado`

- [ ] **Step 3: Commit fixes if any**

```bash
# Only if fixes were applied during walkthrough
git add -A
git commit -m "fix(payroll): integration smoke test fixes"
```

---

## Spec coverage check

| Spec section | Task |
|--------------|------|
| Migration brackets + periods + columns | Task 1 |
| Seed INSS+IR 2026 | Task 2 |
| Date utils | Task 3 |
| Calculators INSS/IR/totais | Task 4 |
| Data layer brackets | Task 5 |
| Data layer payroll + period + summary + needing | Task 6 |
| Zod schemas payroll + brackets + new vigência | Task 7 |
| Server actions upsert/close/reopen/generate/sync | Task 8 |
| Server actions brackets CRUD + vigência | Task 9 |
| Month nav | Task 10 |
| Generate / Sync / Close / Reopen buttons | Task 11 |
| Month table + summary card | Task 12 |
| Holerite PDF | Task 13 |
| Export XLSX + PDF mês | Task 14 |
| Row form com live calc + manual toggle + reset | Task 15 |
| Folha redirect + month page | Task 16 |
| Employee/month form page + holerite | Task 17 |
| Brackets table editable + delete | Task 18 |
| New vigência (copy from / empty) | Task 19 |
| Brackets admin page com vigência select | Task 20 |
| Topbar RH dropdown — Folha + Brackets | Task 21 |
| Smoke test admin/financeiro/secretaria | Task 22 |
| Permissões (admin full+close, financeiro edit, secretaria none) | Tasks 8, 9, 16, 17, 20 |
| Period fechado bloqueia edição | Tasks 8, 15, 17 |
| Mismatch banner novos funcionários | Task 16 |
| Empty state mês vazio | Task 16 |

All sections covered.
