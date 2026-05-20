# RH Fase 1 — Empresas e Funcionários — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build CRUD for empresas (companies) and funcionários (employees) with soft delete, filters, masked CPF/CNPJ validation, admin/secretaria gates, and new RH dropdown in topbar.

**Architecture:** Next.js App Router server components + server actions (matches existing `/alunos`, `/financeiro` patterns). Zod validation, Supabase data access, design system primitives (`PageHeader`, `DataTableShell`, `FilterChips`, `StatusPill`).

**Tech Stack:** Next.js 14 App Router, React 18, Supabase SSR, Zod, TypeScript, Tailwind, Lucide icons.

**Spec:** `docs/superpowers/specs/2026-05-16-rh-empresas-funcionarios-design.md`

---

## File Structure

**Migrations:**
- Create: `supabase/migrations/202605230001_rh_empresas_funcionarios.sql`

**Data (read):**
- Create: `src/lib/data/rh.ts`

**Actions (mutations):**
- Create: `src/lib/actions/rh.ts`

**Validation:**
- Create: `src/lib/validation/rh.ts`

**Auth helper:**
- Modify: `src/lib/auth/session.ts` (add `requirePerfil`)

**Format helpers:**
- Create: `src/lib/format/masks.ts` (CPF/CNPJ/phone masks)

**Components:**
- Create: `src/components/rh/company-card.tsx`
- Create: `src/components/rh/company-form.tsx`
- Create: `src/components/rh/employee-form.tsx`
- Create: `src/components/rh/employee-filters.tsx`
- Create: `src/components/layout/rh-dropdown.tsx`

**Pages:**
- Create: `src/app/(app)/rh/empresas/page.tsx`
- Create: `src/app/(app)/rh/empresas/nova/page.tsx`
- Create: `src/app/(app)/rh/empresas/[id]/page.tsx`
- Create: `src/app/(app)/rh/empresas/[id]/editar/page.tsx`
- Create: `src/app/(app)/rh/funcionarios/page.tsx`
- Create: `src/app/(app)/rh/funcionarios/novo/page.tsx`
- Create: `src/app/(app)/rh/funcionarios/[id]/editar/page.tsx`
- Create: `src/app/(app)/acesso-negado/page.tsx`

**Topbar:**
- Modify: `src/components/layout/topbar.tsx` (add `RhDropdown`)

---

## Task 1: Migration — soft delete + extra columns

**Files:**
- Create: `supabase/migrations/202605230001_rh_empresas_funcionarios.sql`

- [ ] **Step 1: Create migration file**

File: `supabase/migrations/202605230001_rh_empresas_funcionarios.sql`

```sql
-- companies: add ativo + updated_at
alter table public.companies add column if not exists ativo boolean not null default true;
alter table public.companies add column if not exists updated_at timestamptz default now();

-- companies: trigger for updated_at
drop trigger if exists companies_updated_at on public.companies;
create trigger companies_updated_at
before update on public.companies
for each row
execute function public.set_updated_at();

-- employees: soft delete + new fields
alter table public.employees add column if not exists ativo boolean not null default true;
alter table public.employees add column if not exists email text;
alter table public.employees add column if not exists telefone text;
alter table public.employees add column if not exists cargo text;
alter table public.employees add column if not exists status_contrato text;

-- check constraint for status_contrato (added separately to allow nulls)
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'employees_status_contrato_check'
  ) then
    alter table public.employees
      add constraint employees_status_contrato_check
      check (status_contrato is null or status_contrato in ('CLT','PJ','Estagio','Temporario'));
  end if;
end $$;

-- employees: trigger for updated_at
drop trigger if exists employees_updated_at on public.employees;
create trigger employees_updated_at
before update on public.employees
for each row
execute function public.set_updated_at();

-- indexes
create index if not exists idx_employees_ativo on public.employees (ativo);
create index if not exists idx_employees_school_category on public.employees (school_category);
create index if not exists idx_companies_ativo on public.companies (ativo);
```

- [ ] **Step 2: Apply migration to local Supabase**

Run: `docker exec -i supabase_db_rrb-escola psql -U postgres -d postgres < supabase/migrations/202605230001_rh_empresas_funcionarios.sql`
Expected output (last lines):
```
ALTER TABLE
ALTER TABLE
DROP TRIGGER
CREATE TRIGGER
ALTER TABLE
ALTER TABLE
ALTER TABLE
ALTER TABLE
ALTER TABLE
DO
DROP TRIGGER
CREATE TRIGGER
CREATE INDEX
CREATE INDEX
CREATE INDEX
```

- [ ] **Step 3: Verify columns**

Run:
```bash
docker exec -i supabase_db_rrb-escola psql -U postgres -d postgres -c "select column_name from information_schema.columns where table_schema='public' and table_name='employees' and column_name in ('ativo','email','telefone','cargo','status_contrato') order by column_name;"
```
Expected: 5 rows (ativo, cargo, email, status_contrato, telefone).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/202605230001_rh_empresas_funcionarios.sql
git commit -m "feat(rh): migration add soft delete + extra fields on companies/employees"
```

---

## Task 2: Format masks helper

**Files:**
- Create: `src/lib/format/masks.ts`

- [ ] **Step 1: Create masks.ts**

File: `src/lib/format/masks.ts`

```ts
export function maskCPF(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

export function maskCNPJ(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 14);
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

export function maskPhone(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export const CPF_REGEX = /^\d{3}\.\d{3}\.\d{3}-\d{2}$/;
export const CNPJ_REGEX = /^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/;
```

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/format/masks.ts
git commit -m "feat(format): CPF/CNPJ/phone mask helpers"
```

---

## Task 3: Zod validation schemas

**Files:**
- Create: `src/lib/validation/rh.ts`

- [ ] **Step 1: Create rh.ts**

File: `src/lib/validation/rh.ts`

```ts
import { z } from "zod";
import { CPF_REGEX, CNPJ_REGEX } from "@/lib/format/masks";

export const CompanySchema = z.object({
  name: z.string().min(3, "Nome deve ter ao menos 3 caracteres"),
  cnpj: z.string().regex(CNPJ_REGEX, "CNPJ inválido (formato 00.000.000/0000-00)")
});

export const CompanyUpdateSchema = CompanySchema.extend({
  id: z.string().uuid(),
  ativo: z.preprocess((v) => v === "on" || v === true, z.boolean())
});

export const SchoolCategoryEnum = z.enum(["admin", "fund1", "fund2", "medio"]);
export const StatusContratoEnum = z.enum(["CLT", "PJ", "Estagio", "Temporario"]);

const optionalString = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
  z.string().optional()
);

export const EmployeeSchema = z.object({
  company_id: z.string().uuid("Empresa obrigatória"),
  name: z.string().min(3, "Nome deve ter ao menos 3 caracteres"),
  cpf: z.string().regex(CPF_REGEX, "CPF inválido (formato 000.000.000-00)"),
  email: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().email("E-mail inválido").optional()
  ),
  telefone: optionalString,
  cargo: optionalString,
  school_category: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    SchoolCategoryEnum.optional()
  ),
  status_contrato: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    StatusContratoEnum.optional()
  ),
  birth_date: optionalString,
  hire_date: optionalString
});

export const EmployeeUpdateSchema = EmployeeSchema.extend({
  id: z.string().uuid(),
  ativo: z.preprocess((v) => v === "on" || v === true, z.boolean())
});

export type CompanyInput = z.infer<typeof CompanySchema>;
export type EmployeeInput = z.infer<typeof EmployeeSchema>;
```

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/validation/rh.ts
git commit -m "feat(rh): Zod schemas for company/employee inputs"
```

---

## Task 4: Auth helper — requirePerfil

**Files:**
- Modify: `src/lib/auth/session.ts`

- [ ] **Step 1: Add requirePerfil function**

Edit `src/lib/auth/session.ts`. Append after `requireAdmin`:

```ts
export async function requirePerfil(perfis: Array<SessionProfile["perfil"]>): Promise<Session> {
  const session = await requireSession();
  if (!perfis.includes(session.profile.perfil)) {
    redirect("/acesso-negado");
  }
  return session;
}
```

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/auth/session.ts
git commit -m "feat(auth): requirePerfil helper"
```

---

## Task 5: Acesso negado page

**Files:**
- Create: `src/app/(app)/acesso-negado/page.tsx`

- [ ] **Step 1: Create page**

File: `src/app/(app)/acesso-negado/page.tsx`

```tsx
import { ShieldAlert } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/card";

export default function AcessoNegadoPage() {
  return (
    <div className="grid gap-8">
      <PageHeader
        breadcrumb={[{ label: "Sistema" }, { label: "Acesso negado" }]}
        title="Acesso negado"
        description="Você não tem permissão para acessar esta página."
      />
      <Panel className="flex flex-col items-center gap-4 py-12 text-center">
        <span className="grid h-14 w-14 place-items-center rounded-pill bg-danger/12 text-danger">
          <ShieldAlert size={28} strokeWidth={2} />
        </span>
        <p className="text-sm text-ink/65 max-w-md">
          Esta funcionalidade está disponível apenas para perfis específicos.
          Se você acredita que deveria ter acesso, contate um administrador.
        </p>
        <ButtonLink href="/" variant="primary">Voltar ao início</ButtonLink>
      </Panel>
    </div>
  );
}
```

- [ ] **Step 2: Verify in dev server**

Run: `npm run dev`. Navigate to `http://localhost:3000/acesso-negado`.
Expected: page renders with shield icon and "Voltar ao início" button.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/acesso-negado/page.tsx
git commit -m "feat(rh): acesso negado page"
```

---

## Task 6: Data layer — companies queries

**Files:**
- Create: `src/lib/data/rh.ts`

- [ ] **Step 1: Create rh.ts with company queries**

File: `src/lib/data/rh.ts`

```ts
import { createServerClient } from "@/lib/supabase/server";

export type Company = {
  id: string;
  cnpj: string;
  name: string;
  ativo: boolean;
  created_at: string | null;
  updated_at: string | null;
};

export type CompanySummary = {
  totalFuncionarios: number;
  ativos: number;
  inativos: number;
  porCategoria: { admin: number; fund1: number; fund2: number; medio: number };
};

export async function listCompanies(opts?: { includeInactive?: boolean }): Promise<Company[]> {
  const supabase = await createServerClient();
  let query = supabase
    .from("companies")
    .select("id, cnpj, name, ativo, created_at, updated_at")
    .order("name");
  if (!opts?.includeInactive) query = query.eq("ativo", true);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Company[];
}

export async function getCompanyById(id: string): Promise<Company | null> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("companies")
    .select("id, cnpj, name, ativo, created_at, updated_at")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as Company | null) ?? null;
}

export async function getCompanySummary(id: string): Promise<CompanySummary> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("employees")
    .select("id, ativo, school_category")
    .eq("company_id", id);
  if (error) throw error;
  const summary: CompanySummary = {
    totalFuncionarios: 0,
    ativos: 0,
    inativos: 0,
    porCategoria: { admin: 0, fund1: 0, fund2: 0, medio: 0 }
  };
  for (const row of data ?? []) {
    summary.totalFuncionarios += 1;
    if (row.ativo) summary.ativos += 1;
    else summary.inativos += 1;
    const cat = row.school_category as keyof typeof summary.porCategoria | null;
    if (cat && cat in summary.porCategoria) summary.porCategoria[cat] += 1;
  }
  return summary;
}
```

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/data/rh.ts
git commit -m "feat(rh): data layer for companies queries"
```

---

## Task 7: Data layer — employees queries

**Files:**
- Modify: `src/lib/data/rh.ts`

- [ ] **Step 1: Append employee queries**

Append to `src/lib/data/rh.ts`:

```ts
export type Employee = {
  id: string;
  company_id: string;
  cpf: string;
  name: string;
  birth_date: string | null;
  hire_date: string | null;
  school_category: string | null;
  email: string | null;
  telefone: string | null;
  cargo: string | null;
  status_contrato: string | null;
  ativo: boolean;
  companies?: { id: string; name: string; cnpj: string } | null;
};

export type EmployeeFilters = {
  companyId?: string;
  segmento?: string;
  search?: string;
  statusContrato?: string;
  includeInactive?: boolean;
};

export async function listEmployees(filters: EmployeeFilters = {}): Promise<Employee[]> {
  const supabase = await createServerClient();
  let query = supabase
    .from("employees")
    .select("id, company_id, cpf, name, birth_date, hire_date, school_category, email, telefone, cargo, status_contrato, ativo, companies(id, name, cnpj)")
    .order("name");

  if (!filters.includeInactive) query = query.eq("ativo", true);
  if (filters.companyId) query = query.eq("company_id", filters.companyId);
  if (filters.segmento) query = query.eq("school_category", filters.segmento);
  if (filters.statusContrato) query = query.eq("status_contrato", filters.statusContrato);
  if (filters.search) {
    const term = `%${filters.search}%`;
    query = query.or(`name.ilike.${term},cpf.ilike.${term},email.ilike.${term}`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((row) => ({
    ...row,
    companies: Array.isArray(row.companies) ? row.companies[0] ?? null : row.companies ?? null
  })) as Employee[];
}

export async function getEmployeeById(id: string): Promise<Employee | null> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("employees")
    .select("id, company_id, cpf, name, birth_date, hire_date, school_category, email, telefone, cargo, status_contrato, ativo, companies(id, name, cnpj)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    ...data,
    companies: Array.isArray(data.companies) ? data.companies[0] ?? null : data.companies ?? null
  } as Employee;
}

export type EmployeeSegmentCounts = {
  all: number;
  admin: number;
  fund1: number;
  fund2: number;
  medio: number;
};

export async function getEmployeeSegmentCounts(
  filters: Omit<EmployeeFilters, "segmento"> = {}
): Promise<EmployeeSegmentCounts> {
  const supabase = await createServerClient();
  let query = supabase
    .from("employees")
    .select("school_category, ativo, company_id, name, cpf, email, status_contrato");

  if (!filters.includeInactive) query = query.eq("ativo", true);
  if (filters.companyId) query = query.eq("company_id", filters.companyId);
  if (filters.statusContrato) query = query.eq("status_contrato", filters.statusContrato);
  if (filters.search) {
    const term = `%${filters.search}%`;
    query = query.or(`name.ilike.${term},cpf.ilike.${term},email.ilike.${term}`);
  }

  const { data, error } = await query;
  if (error) throw error;

  const counts: EmployeeSegmentCounts = { all: 0, admin: 0, fund1: 0, fund2: 0, medio: 0 };
  for (const row of data ?? []) {
    counts.all += 1;
    const cat = row.school_category as keyof Omit<EmployeeSegmentCounts, "all"> | null;
    if (cat && cat in counts) counts[cat] += 1;
  }
  return counts;
}
```

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/data/rh.ts
git commit -m "feat(rh): data layer for employees queries with filters"
```

---

## Task 8: Server actions — companies

**Files:**
- Create: `src/lib/actions/rh.ts`

- [ ] **Step 1: Create rh.ts with company actions**

File: `src/lib/actions/rh.ts`

```ts
"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requirePerfil } from "@/lib/auth/session";
import { createServerClient } from "@/lib/supabase/server";
import { CompanySchema, CompanyUpdateSchema } from "@/lib/validation/rh";

function firstError(error: { issues: { message: string }[] }) {
  return encodeURIComponent(error.issues[0]?.message ?? "Dados inválidos");
}

export async function createCompanyAction(formData: FormData) {
  await requirePerfil(["admin"]);

  const parsed = CompanySchema.safeParse({
    name: String(formData.get("name") ?? "").trim(),
    cnpj: String(formData.get("cnpj") ?? "").trim()
  });
  if (!parsed.success) {
    redirect(`/rh/empresas/nova?erro=${firstError(parsed.error)}`);
  }

  const supabase = await createServerClient();
  const { error } = await supabase.from("companies").insert({
    name: parsed.data.name,
    cnpj: parsed.data.cnpj
  });

  if (error) {
    const msg = error.code === "23505" ? "CNPJ já cadastrado" : error.message;
    redirect(`/rh/empresas/nova?erro=${encodeURIComponent(msg)}`);
  }

  revalidatePath("/rh/empresas");
  redirect("/rh/empresas?ok=criada");
}

export async function updateCompanyAction(formData: FormData) {
  await requirePerfil(["admin"]);

  const parsed = CompanyUpdateSchema.safeParse({
    id: String(formData.get("id") ?? ""),
    name: String(formData.get("name") ?? "").trim(),
    cnpj: String(formData.get("cnpj") ?? "").trim(),
    ativo: formData.get("ativo")
  });
  if (!parsed.success) {
    const id = formData.get("id");
    redirect(`/rh/empresas/${id}/editar?erro=${firstError(parsed.error)}`);
  }

  const supabase = await createServerClient();
  const { error } = await supabase
    .from("companies")
    .update({
      name: parsed.data.name,
      cnpj: parsed.data.cnpj,
      ativo: parsed.data.ativo
    })
    .eq("id", parsed.data.id);

  if (error) {
    const msg = error.code === "23505" ? "CNPJ já cadastrado" : error.message;
    redirect(`/rh/empresas/${parsed.data.id}/editar?erro=${encodeURIComponent(msg)}`);
  }

  revalidatePath("/rh/empresas");
  revalidatePath(`/rh/empresas/${parsed.data.id}`);
  redirect("/rh/empresas?ok=editada");
}

export async function toggleCompanyAction(formData: FormData) {
  await requirePerfil(["admin"]);
  const id = String(formData.get("id") ?? "");
  const ativo = formData.get("ativo") === "on";

  if (!id) redirect("/rh/empresas?erro=ID inválido");

  const supabase = await createServerClient();
  const { error } = await supabase.from("companies").update({ ativo }).eq("id", id);
  if (error) redirect(`/rh/empresas?erro=${encodeURIComponent(error.message)}`);

  revalidatePath("/rh/empresas");
  redirect(`/rh/empresas?ok=${ativo ? "ativada" : "desativada"}`);
}
```

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/actions/rh.ts
git commit -m "feat(rh): server actions for company CRUD"
```

---

## Task 9: Server actions — employees

**Files:**
- Modify: `src/lib/actions/rh.ts`

- [ ] **Step 1: Append employee actions**

Append to `src/lib/actions/rh.ts`:

```ts
import { EmployeeSchema, EmployeeUpdateSchema } from "@/lib/validation/rh";

function readEmployeeForm(formData: FormData) {
  return {
    company_id: String(formData.get("company_id") ?? ""),
    name: String(formData.get("name") ?? "").trim(),
    cpf: String(formData.get("cpf") ?? "").trim(),
    email: String(formData.get("email") ?? "").trim(),
    telefone: String(formData.get("telefone") ?? "").trim(),
    cargo: String(formData.get("cargo") ?? "").trim(),
    school_category: String(formData.get("school_category") ?? "").trim(),
    status_contrato: String(formData.get("status_contrato") ?? "").trim(),
    birth_date: String(formData.get("birth_date") ?? "").trim(),
    hire_date: String(formData.get("hire_date") ?? "").trim()
  };
}

export async function createEmployeeAction(formData: FormData) {
  await requirePerfil(["admin", "secretaria"]);

  const parsed = EmployeeSchema.safeParse(readEmployeeForm(formData));
  if (!parsed.success) {
    redirect(`/rh/funcionarios/novo?erro=${firstError(parsed.error)}`);
  }

  const supabase = await createServerClient();
  const { error } = await supabase.from("employees").insert({
    company_id: parsed.data.company_id,
    name: parsed.data.name,
    cpf: parsed.data.cpf,
    email: parsed.data.email ?? null,
    telefone: parsed.data.telefone ?? null,
    cargo: parsed.data.cargo ?? null,
    school_category: parsed.data.school_category ?? null,
    status_contrato: parsed.data.status_contrato ?? null,
    birth_date: parsed.data.birth_date || null,
    hire_date: parsed.data.hire_date || null
  });

  if (error) {
    const msg = error.code === "23505" ? "CPF já cadastrado" : error.message;
    redirect(`/rh/funcionarios/novo?erro=${encodeURIComponent(msg)}`);
  }

  revalidatePath("/rh/funcionarios");
  revalidatePath(`/rh/empresas/${parsed.data.company_id}`);
  redirect("/rh/funcionarios?ok=criado");
}

export async function updateEmployeeAction(formData: FormData) {
  await requirePerfil(["admin", "secretaria"]);

  const id = String(formData.get("id") ?? "");
  const parsed = EmployeeUpdateSchema.safeParse({
    id,
    ...readEmployeeForm(formData),
    ativo: formData.get("ativo")
  });
  if (!parsed.success) {
    redirect(`/rh/funcionarios/${id}/editar?erro=${firstError(parsed.error)}`);
  }

  const supabase = await createServerClient();
  const { error } = await supabase
    .from("employees")
    .update({
      company_id: parsed.data.company_id,
      name: parsed.data.name,
      cpf: parsed.data.cpf,
      email: parsed.data.email ?? null,
      telefone: parsed.data.telefone ?? null,
      cargo: parsed.data.cargo ?? null,
      school_category: parsed.data.school_category ?? null,
      status_contrato: parsed.data.status_contrato ?? null,
      birth_date: parsed.data.birth_date || null,
      hire_date: parsed.data.hire_date || null,
      ativo: parsed.data.ativo
    })
    .eq("id", parsed.data.id);

  if (error) {
    const msg = error.code === "23505" ? "CPF já cadastrado" : error.message;
    redirect(`/rh/funcionarios/${parsed.data.id}/editar?erro=${encodeURIComponent(msg)}`);
  }

  revalidatePath("/rh/funcionarios");
  revalidatePath(`/rh/empresas/${parsed.data.company_id}`);
  redirect("/rh/funcionarios?ok=editado");
}

export async function toggleEmployeeAction(formData: FormData) {
  await requirePerfil(["admin", "secretaria"]);
  const id = String(formData.get("id") ?? "");
  const ativo = formData.get("ativo") === "on";

  if (!id) redirect("/rh/funcionarios?erro=ID inválido");

  const supabase = await createServerClient();
  const { error } = await supabase.from("employees").update({ ativo }).eq("id", id);
  if (error) redirect(`/rh/funcionarios?erro=${encodeURIComponent(error.message)}`);

  revalidatePath("/rh/funcionarios");
  redirect(`/rh/funcionarios?ok=${ativo ? "ativado" : "desativado"}`);
}
```

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/actions/rh.ts
git commit -m "feat(rh): server actions for employee CRUD"
```

---

## Task 10: RH dropdown component

**Files:**
- Create: `src/components/layout/rh-dropdown.tsx`

- [ ] **Step 1: Create rh-dropdown.tsx**

File: `src/components/layout/rh-dropdown.tsx`

```tsx
"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Briefcase, Building2, UsersRound, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const rhItems = [
  { href: "/rh/empresas", label: "Empresas", icon: Building2 },
  { href: "/rh/funcionarios", label: "Funcionários", icon: UsersRound }
];

const rhHrefs = rhItems.map((i) => i.href);

export function RhDropdown() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number; width: number }>({ left: 0, top: 0, width: 0 });
  const ref = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  const isActive = rhHrefs.some((href) => pathname === href || pathname.startsWith(`${href}/`));

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current?.contains(e.target as Node)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  useEffect(() => {
    if (!open || !btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    setPos({ left: r.left, top: r.bottom + 6, width: 192 });
  }, [open]);

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex h-[30px] shrink-0 items-center gap-[7px] rounded-[7px] px-2.5 text-[12px] font-semibold no-underline outline-none focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40 transition-all duration-150",
          isActive
            ? "bg-white text-[#1B3FB8] shadow-[0_1px_0_rgba(255,255,255,0.16)_inset,0_6px_14px_-6px_rgba(0,0,0,0.25)]"
            : "text-white/70 hover:bg-white/[0.18] hover:text-white"
        )}
      >
        <Briefcase size={13} strokeWidth={isActive ? 2 : 1.7} />
        RH
        <ChevronDown size={11} strokeWidth={2} className={cn("transition-transform duration-150", open && "rotate-180")} />
      </button>

      {open && mounted
        ? createPortal(
            <div
              style={{ position: "fixed", left: pos.left, top: pos.top, width: pos.width, zIndex: 9999 }}
              className="rounded-[10px] border border-[#1B3FB8]/20 bg-white shadow-[0_14px_40px_-10px_rgba(0,0,0,0.18),0_2px_8px_-4px_rgba(0,0,0,0.08)] p-1"
              onMouseDown={(e) => e.stopPropagation()}
            >
              {rhItems.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex items-center gap-2.5 px-2.5 py-2 text-[12px] rounded-[7px] transition-colors duration-100",
                      active
                        ? "bg-[#1B3FB8]/[0.07] font-semibold text-[#1B3FB8]"
                        : "font-medium text-[#1A2240] hover:bg-slate-50"
                    )}
                  >
                    <Icon size={13} strokeWidth={active ? 2 : 1.7} />
                    {item.label}
                  </Link>
                );
              })}
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
```

- [ ] **Step 2: Wire RhDropdown into topbar**

Edit `src/components/layout/topbar.tsx`. Add import after SecretariaDropdown import:

```tsx
import { RhDropdown } from "@/components/layout/rh-dropdown";
```

Then locate the block `<div className="shrink-0"><SecretariaDropdown /></div>` and replace with:

```tsx
      <div className="flex items-center gap-0.5 shrink-0">
        <SecretariaDropdown />
        <RhDropdown />
      </div>
```

- [ ] **Step 3: Type check + verify**

Run: `npx tsc --noEmit`
Expected: no errors.

Start dev server, navigate to `http://localhost:3000/`, click RH dropdown.
Expected: dropdown opens, shows Empresas and Funcionários, navigates correctly.

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/rh-dropdown.tsx src/components/layout/topbar.tsx
git commit -m "feat(topbar): RH dropdown with Empresas and Funcionários"
```

---

## Task 11: CompanyForm component

**Files:**
- Create: `src/components/rh/company-form.tsx`

- [ ] **Step 1: Create company-form.tsx**

File: `src/components/rh/company-form.tsx`

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { maskCNPJ } from "@/lib/format/masks";
import type { Company } from "@/lib/data/rh";

type Props = {
  action: (formData: FormData) => void | Promise<void>;
  company?: Company;
  submitLabel?: string;
};

export function CompanyForm({ action, company, submitLabel = "Salvar" }: Props) {
  const [cnpj, setCnpj] = useState(company?.cnpj ?? "");

  return (
    <form action={action} className="grid gap-4 md:grid-cols-2">
      {company ? <input type="hidden" name="id" value={company.id} /> : null}

      <label className="md:col-span-2">
        Nome da empresa
        <input
          name="name"
          defaultValue={company?.name ?? ""}
          required
          minLength={3}
          placeholder="Ex.: Escola RRB Educação Ltda."
        />
      </label>

      <label>
        CNPJ
        <input
          name="cnpj"
          value={cnpj}
          onChange={(e) => setCnpj(maskCNPJ(e.target.value))}
          required
          placeholder="00.000.000/0000-00"
        />
      </label>

      {company ? (
        <label className="flex grid-cols-none items-center gap-2 self-end pb-3">
          <input name="ativo" type="checkbox" defaultChecked={company.ativo} className="h-4 w-4" />
          Ativa
        </label>
      ) : null}

      <div className="md:col-span-2 flex justify-end gap-2">
        <Button type="submit" variant="primary">{submitLabel}</Button>
      </div>
    </form>
  );
}
```

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/rh/company-form.tsx
git commit -m "feat(rh): CompanyForm component"
```

---

## Task 12: CompanyCard component

**Files:**
- Create: `src/components/rh/company-card.tsx`

- [ ] **Step 1: Create company-card.tsx**

File: `src/components/rh/company-card.tsx`

```tsx
import Link from "next/link";
import { Building2 } from "lucide-react";
import { Panel } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/status-pill";
import { toggleCompanyAction } from "@/lib/actions/rh";
import type { Company, CompanySummary } from "@/lib/data/rh";

type Props = {
  company: Company;
  summary: CompanySummary;
  canEdit: boolean;
};

const categoryLabels = {
  admin: "Admin",
  fund1: "Fund. I",
  fund2: "Fund. II",
  medio: "Médio"
} as const;

export function CompanyCard({ company, summary, canEdit }: Props) {
  return (
    <Panel className="flex flex-col gap-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-ui bg-brand/10 text-brand">
            <Building2 size={18} strokeWidth={2.2} />
          </span>
          <div className="min-w-0">
            <h3 className="text-lg font-bold text-ink truncate" title={company.name}>{company.name}</h3>
            <p className="text-xs text-ink/55 font-medium tabular-nums">{company.cnpj}</p>
          </div>
        </div>
        <StatusPill tone={company.ativo ? "success" : "danger"}>
          {company.ativo ? "Ativa" : "Inativa"}
        </StatusPill>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5 border-y border-line py-3">
        <div>
          <p className="text-[0.62rem] font-bold uppercase tracking-[0.10em] text-ink/55">Funcionários</p>
          <strong className="mt-1 block text-lg font-bold text-ink tabular-nums">{summary.totalFuncionarios}</strong>
        </div>
        {(Object.keys(categoryLabels) as Array<keyof typeof categoryLabels>).map((cat) => (
          <div key={cat}>
            <p className="text-[0.62rem] font-bold uppercase tracking-[0.10em] text-ink/55">{categoryLabels[cat]}</p>
            <strong className="mt-1 block text-lg font-bold text-ink/80 tabular-nums">{summary.porCategoria[cat]}</strong>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between gap-3">
        <Link href={`/rh/empresas/${company.id}`} className="text-sm font-semibold text-brand hover:underline">
          Ver funcionários →
        </Link>
        {canEdit ? (
          <div className="flex items-center gap-3">
            <Link href={`/rh/empresas/${company.id}/editar`} className="text-xs font-semibold text-ink/65 hover:text-brand">
              Editar
            </Link>
            <form action={toggleCompanyAction} className="inline">
              <input type="hidden" name="id" value={company.id} />
              <input type="hidden" name="ativo" value={company.ativo ? "" : "on"} />
              <button type="submit" className="text-xs font-semibold text-danger hover:underline">
                {company.ativo ? "Desativar" : "Ativar"}
              </button>
            </form>
          </div>
        ) : null}
      </div>
    </Panel>
  );
}
```

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/rh/company-card.tsx
git commit -m "feat(rh): CompanyCard component"
```

---

## Task 13: Empresas — lista page

**Files:**
- Create: `src/app/(app)/rh/empresas/page.tsx`

- [ ] **Step 1: Create page**

File: `src/app/(app)/rh/empresas/page.tsx`

```tsx
import { Plus } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { CompanyCard } from "@/components/rh/company-card";
import { listCompanies, getCompanySummary } from "@/lib/data/rh";
import { requireSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function EmpresasPage({
  searchParams
}: {
  searchParams: Promise<{ ok?: string; erro?: string }>;
}) {
  const session = await requireSession();
  const params = await searchParams;
  const isAdmin = session.profile.perfil === "admin";

  const companies = await listCompanies({ includeInactive: isAdmin });
  const summaries = await Promise.all(companies.map((c) => getCompanySummary(c.id)));

  const totalFuncionarios = summaries.reduce((s, x) => s + x.totalFuncionarios, 0);
  const totalAtivos = summaries.reduce((s, x) => s + x.ativos, 0);
  const totalInativos = summaries.reduce((s, x) => s + x.inativos, 0);
  const ativas = companies.filter((c) => c.ativo).length;

  return (
    <div className="grid gap-8">
      <PageHeader
        breadcrumb={[{ label: "RH" }, { label: "Empresas" }]}
        title="Empresas"
        counter={companies.length.toLocaleString("pt-BR")}
        description="Cadastro de pessoas jurídicas para vinculação de funcionários."
        actions={
          isAdmin ? (
            <ButtonLink href="/rh/empresas/nova" variant="primary">
              <Plus size={14} /> Nova empresa
            </ButtonLink>
          ) : null
        }
        kpis={[
          { label: "Total",         value: companies.length.toLocaleString("pt-BR") },
          { label: "Ativas",        value: ativas.toLocaleString("pt-BR"), tone: "success" },
          { label: "Funcionários",  value: totalFuncionarios.toLocaleString("pt-BR") },
          { label: "Ativos",        value: totalAtivos.toLocaleString("pt-BR"), tone: "success" },
          { label: "Inativos",      value: totalInativos.toLocaleString("pt-BR"), tone: "danger" }
        ]}
      />

      {params.ok ? (
        <div className="rounded-ui bg-success/10 p-3 text-sm font-semibold text-success">
          Empresa {params.ok} com sucesso.
        </div>
      ) : null}
      {params.erro ? (
        <div className="rounded-ui bg-danger/10 p-3 text-sm font-semibold text-danger">{params.erro}</div>
      ) : null}

      {companies.length === 0 ? (
        <div className="rounded-panel border border-line bg-surface p-10 text-center">
          <p className="text-sm font-medium text-ink/65">Nenhuma empresa cadastrada.</p>
          {isAdmin ? (
            <ButtonLink href="/rh/empresas/nova" variant="primary" className="mt-4">
              <Plus size={14} /> Cadastrar primeira empresa
            </ButtonLink>
          ) : null}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {companies.map((company, i) => (
            <CompanyCard
              key={company.id}
              company={company}
              summary={summaries[i]!}
              canEdit={isAdmin}
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Type check + smoke test**

Run: `npx tsc --noEmit`
Expected: no errors.

Start dev server, navigate to `/rh/empresas`.
Expected: 2 company cards (from seed), with KPIs and counts.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/rh/empresas/page.tsx
git commit -m "feat(rh): empresas list page"
```

---

## Task 14: Empresas — nova page

**Files:**
- Create: `src/app/(app)/rh/empresas/nova/page.tsx`

- [ ] **Step 1: Create page**

File: `src/app/(app)/rh/empresas/nova/page.tsx`

```tsx
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/card";
import { CompanyForm } from "@/components/rh/company-form";
import { createCompanyAction } from "@/lib/actions/rh";
import { requirePerfil } from "@/lib/auth/session";

export default async function NovaEmpresaPage({
  searchParams
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  await requirePerfil(["admin"]);
  const params = await searchParams;

  return (
    <div className="grid gap-8">
      <PageHeader
        breadcrumb={[{ label: "RH" }, { label: "Empresas", href: "/rh/empresas" }, { label: "Nova" }]}
        title="Nova empresa"
        description="Cadastre uma pessoa jurídica para vincular funcionários."
      />

      {params.erro ? (
        <div className="rounded-ui bg-danger/10 p-3 text-sm font-semibold text-danger">{params.erro}</div>
      ) : null}

      <Panel className="p-6">
        <CompanyForm action={createCompanyAction} submitLabel="Criar empresa" />
      </Panel>
    </div>
  );
}
```

- [ ] **Step 2: Smoke test**

Start dev server. Navigate to `/rh/empresas/nova` logged as admin.
Submit empty form → should redirect with `?erro=Nome deve ter ao menos 3 caracteres`.
Submit valid form (e.g. Nome: "Teste Ltda", CNPJ: "11.222.333/0001-44") → redirect to `/rh/empresas?ok=criada`.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/rh/empresas/nova/page.tsx
git commit -m "feat(rh): nova empresa page"
```

---

## Task 15: Empresas — editar page

**Files:**
- Create: `src/app/(app)/rh/empresas/[id]/editar/page.tsx`

- [ ] **Step 1: Create page**

File: `src/app/(app)/rh/empresas/[id]/editar/page.tsx`

```tsx
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/card";
import { CompanyForm } from "@/components/rh/company-form";
import { updateCompanyAction } from "@/lib/actions/rh";
import { getCompanyById } from "@/lib/data/rh";
import { requirePerfil } from "@/lib/auth/session";

export default async function EditarEmpresaPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ erro?: string }>;
}) {
  await requirePerfil(["admin"]);
  const { id } = await params;
  const sp = await searchParams;

  const company = await getCompanyById(id);
  if (!company) notFound();

  return (
    <div className="grid gap-8">
      <PageHeader
        breadcrumb={[
          { label: "RH" },
          { label: "Empresas", href: "/rh/empresas" },
          { label: company.name }
        ]}
        title="Editar empresa"
        counter={company.cnpj}
      />

      {sp.erro ? (
        <div className="rounded-ui bg-danger/10 p-3 text-sm font-semibold text-danger">{sp.erro}</div>
      ) : null}

      <Panel className="p-6">
        <CompanyForm action={updateCompanyAction} company={company} submitLabel="Salvar alterações" />
      </Panel>
    </div>
  );
}
```

- [ ] **Step 2: Smoke test**

Navigate to `/rh/empresas/<id>/editar`. Form prefilled. Save → redirect to list with ok flash.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/rh/empresas/\[id\]/editar/page.tsx
git commit -m "feat(rh): editar empresa page"
```

---

## Task 16: EmployeeForm component

**Files:**
- Create: `src/components/rh/employee-form.tsx`

- [ ] **Step 1: Create employee-form.tsx**

File: `src/components/rh/employee-form.tsx`

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { maskCPF, maskPhone } from "@/lib/format/masks";
import type { Employee } from "@/lib/data/rh";
import type { Company } from "@/lib/data/rh";

type Props = {
  action: (formData: FormData) => void | Promise<void>;
  employee?: Employee;
  companies: Company[];
  defaultCompanyId?: string;
  submitLabel?: string;
};

export function EmployeeForm({ action, employee, companies, defaultCompanyId, submitLabel = "Salvar" }: Props) {
  const [cpf, setCpf] = useState(employee?.cpf ?? "");
  const [telefone, setTelefone] = useState(employee?.telefone ?? "");

  return (
    <form action={action} className="grid gap-4 md:grid-cols-2">
      {employee ? <input type="hidden" name="id" value={employee.id} /> : null}

      <label>
        Empresa
        <select name="company_id" defaultValue={employee?.company_id ?? defaultCompanyId ?? ""} required>
          <option value="">Selecione...</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </label>

      <label>
        Nome completo
        <input name="name" defaultValue={employee?.name ?? ""} required minLength={3} />
      </label>

      <label>
        CPF
        <input
          name="cpf"
          value={cpf}
          onChange={(e) => setCpf(maskCPF(e.target.value))}
          required
          placeholder="000.000.000-00"
        />
      </label>

      <label>
        E-mail
        <input name="email" type="email" defaultValue={employee?.email ?? ""} />
      </label>

      <label>
        Telefone
        <input
          name="telefone"
          value={telefone}
          onChange={(e) => setTelefone(maskPhone(e.target.value))}
          placeholder="(00) 00000-0000"
        />
      </label>

      <label>
        Cargo
        <input name="cargo" defaultValue={employee?.cargo ?? ""} />
      </label>

      <label>
        Categoria escolar
        <select name="school_category" defaultValue={employee?.school_category ?? ""}>
          <option value="">—</option>
          <option value="admin">Admin</option>
          <option value="fund1">Fundamental I</option>
          <option value="fund2">Fundamental II</option>
          <option value="medio">Médio</option>
        </select>
      </label>

      <label>
        Status do contrato
        <select name="status_contrato" defaultValue={employee?.status_contrato ?? ""}>
          <option value="">—</option>
          <option value="CLT">CLT</option>
          <option value="PJ">PJ</option>
          <option value="Estagio">Estágio</option>
          <option value="Temporario">Temporário</option>
        </select>
      </label>

      <label>
        Data de nascimento
        <input name="birth_date" type="date" defaultValue={employee?.birth_date ?? ""} />
      </label>

      <label>
        Data de admissão
        <input name="hire_date" type="date" defaultValue={employee?.hire_date ?? ""} />
      </label>

      {employee ? (
        <label className="flex grid-cols-none items-center gap-2 self-end pb-3">
          <input name="ativo" type="checkbox" defaultChecked={employee.ativo} className="h-4 w-4" />
          Ativo
        </label>
      ) : null}

      <div className="md:col-span-2 flex justify-end gap-2">
        <Button type="submit" variant="primary">{submitLabel}</Button>
      </div>
    </form>
  );
}
```

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/rh/employee-form.tsx
git commit -m "feat(rh): EmployeeForm component"
```

---

## Task 17: EmployeeFilters component

**Files:**
- Create: `src/components/rh/employee-filters.tsx`

- [ ] **Step 1: Create employee-filters.tsx**

File: `src/components/rh/employee-filters.tsx`

```tsx
"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback } from "react";
import { FilterChips } from "@/components/ui/filter-chips";
import { FilterDropdown } from "@/components/ui/filter-dropdown";
import { SearchInline } from "@/components/ui/search-inline";
import type { Company } from "@/lib/data/rh";
import type { EmployeeSegmentCounts } from "@/lib/data/rh";

type Props = {
  companies: Company[];
  counts: EmployeeSegmentCounts;
  canViewInactive: boolean;
};

export function EmployeeFilters({ companies, counts, canViewInactive }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const search = searchParams.get("search") ?? "";
  const segmento = searchParams.get("segmento") ?? "";
  const companyId = searchParams.get("empresa") ?? "";
  const statusContrato = searchParams.get("contrato") ?? "";
  const incluirInativos = searchParams.get("inativos") === "1";

  const update = useCallback(
    (key: string, value: string, clear?: string[]) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) params.set(key, value);
      else params.delete(key);
      for (const k of clear ?? []) params.delete(k);
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams]
  );

  const chips = [
    { value: "",      label: "Todos",     count: counts.all },
    { value: "admin", label: "Admin",     count: counts.admin },
    { value: "fund1", label: "Fund. I",   count: counts.fund1 },
    { value: "fund2", label: "Fund. II",  count: counts.fund2 },
    { value: "medio", label: "Médio",     count: counts.medio }
  ];

  return (
    <div className="flex w-full flex-wrap items-center gap-4">
      <FilterChips
        items={chips}
        value={segmento}
        onChange={(v) => update("segmento", v)}
      />

      <div className="flex flex-1 min-w-[260px] items-center gap-2 rounded-ui border border-line bg-paper px-3 py-1.5 focus-within:border-brand/60 focus-within:bg-surface focus-within:shadow-ring transition">
        <SearchInline
          defaultValue={search}
          placeholder="Buscar por nome, CPF ou e-mail..."
          onChange={(e) => {
            const value = (e.target as HTMLInputElement).value;
            clearTimeout((window as unknown as Record<string, ReturnType<typeof setTimeout>>)._empSearchTimer);
            (window as unknown as Record<string, ReturnType<typeof setTimeout>>)._empSearchTimer = setTimeout(
              () => update("search", value),
              300
            );
          }}
        />
      </div>

      <FilterDropdown
        label="Empresa"
        value={companyId}
        options={companies.map((c) => ({ value: c.id, label: c.name }))}
        onChange={(v) => update("empresa", v)}
        emptyLabel="Todas"
      />

      <FilterDropdown
        label="Contrato"
        value={statusContrato}
        options={[
          { value: "CLT", label: "CLT" },
          { value: "PJ", label: "PJ" },
          { value: "Estagio", label: "Estágio" },
          { value: "Temporario", label: "Temporário" }
        ]}
        onChange={(v) => update("contrato", v)}
        emptyLabel="Todos"
      />

      {canViewInactive ? (
        <label className="inline-flex items-center gap-2 text-xs font-semibold text-ink/70">
          <input
            type="checkbox"
            checked={incluirInativos}
            onChange={(e) => update("inativos", e.target.checked ? "1" : "")}
            className="h-4 w-4 accent-brand"
          />
          Incluir inativos
        </label>
      ) : null}

      {(search || segmento || companyId || statusContrato || incluirInativos) && (
        <button
          type="button"
          className="text-xs font-semibold text-ink/55 hover:text-brand"
          onClick={() => router.push(pathname)}
        >
          Limpar
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/rh/employee-filters.tsx
git commit -m "feat(rh): EmployeeFilters component"
```

---

## Task 18: Funcionários — lista page

**Files:**
- Create: `src/app/(app)/rh/funcionarios/page.tsx`

- [ ] **Step 1: Create page**

File: `src/app/(app)/rh/funcionarios/page.tsx`

```tsx
import Link from "next/link";
import { Plus } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { DataTableShell } from "@/components/ui/data-table";
import { StatusPill, type StatusTone } from "@/components/ui/status-pill";
import { Avatar } from "@/components/ui/avatar";
import { EmployeeFilters } from "@/components/rh/employee-filters";
import { toggleEmployeeAction } from "@/lib/actions/rh";
import { listCompanies, listEmployees, getEmployeeSegmentCounts } from "@/lib/data/rh";
import { requireSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

const contratoTone: Record<string, StatusTone> = {
  CLT: "success",
  PJ: "neutral",
  Estagio: "warning",
  Temporario: "danger"
};

const categoryLabels: Record<string, string> = {
  admin: "Admin",
  fund1: "Fund. I",
  fund2: "Fund. II",
  medio: "Médio"
};

export default async function FuncionariosPage({
  searchParams
}: {
  searchParams: Promise<{ search?: string; segmento?: string; empresa?: string; contrato?: string; inativos?: string; ok?: string; erro?: string }>;
}) {
  const session = await requireSession();
  const params = await searchParams;
  const isAdmin = session.profile.perfil === "admin";
  const canMutate = isAdmin || session.profile.perfil === "secretaria";

  const filters = {
    search: params.search || undefined,
    segmento: params.segmento || undefined,
    companyId: params.empresa || undefined,
    statusContrato: params.contrato || undefined,
    includeInactive: isAdmin && params.inativos === "1"
  };

  const [employees, companies, counts] = await Promise.all([
    listEmployees(filters),
    listCompanies({ includeInactive: true }),
    getEmployeeSegmentCounts(filters)
  ]);

  const ativos = employees.filter((e) => e.ativo).length;
  const docentes = employees.filter((e) => e.school_category && e.school_category !== "admin").length;
  const adminCount = employees.filter((e) => e.school_category === "admin").length;

  return (
    <div className="grid gap-8">
      <PageHeader
        breadcrumb={[{ label: "RH" }, { label: "Funcionários" }]}
        title="Funcionários"
        counter={employees.length.toLocaleString("pt-BR")}
        description="Cadastro completo dos funcionários vinculados às empresas da escola."
        actions={
          canMutate ? (
            <ButtonLink href="/rh/funcionarios/novo" variant="primary">
              <Plus size={14} /> Novo funcionário
            </ButtonLink>
          ) : null
        }
        kpis={[
          { label: "Total",    value: employees.length.toLocaleString("pt-BR") },
          { label: "Ativos",   value: ativos.toLocaleString("pt-BR"), tone: "success" },
          { label: "Admin",    value: adminCount.toLocaleString("pt-BR") },
          { label: "Docentes", value: docentes.toLocaleString("pt-BR") }
        ]}
      />

      {params.ok ? (
        <div className="rounded-ui bg-success/10 p-3 text-sm font-semibold text-success">
          Funcionário {params.ok} com sucesso.
        </div>
      ) : null}
      {params.erro ? (
        <div className="rounded-ui bg-danger/10 p-3 text-sm font-semibold text-danger">{params.erro}</div>
      ) : null}

      <DataTableShell
        toolbar={
          <EmployeeFilters companies={companies} counts={counts} canViewInactive={isAdmin} />
        }
        footer={
          <span>
            Mostrando <strong className="text-ink">{employees.length}</strong> funcionário(s)
          </span>
        }
      >
        <table className="ds-dt min-w-[1100px]">
          <thead>
            <tr>
              <th>Funcionário</th>
              <th>Empresa</th>
              <th>Categoria</th>
              <th>Cargo</th>
              <th>Contato</th>
              <th>Contrato</th>
              <th>Status</th>
              {canMutate ? <th className="text-right">Ações</th> : null}
            </tr>
          </thead>
          <tbody>
            {employees.length === 0 ? (
              <tr>
                <td colSpan={canMutate ? 8 : 7} className="text-center text-ink/50 py-10">
                  Nenhum funcionário encontrado.
                </td>
              </tr>
            ) : null}
            {employees.map((emp) => (
              <tr key={emp.id}>
                <td>
                  <Link
                    href={canMutate ? `/rh/funcionarios/${emp.id}/editar` : `#`}
                    className="flex items-center gap-3 group"
                  >
                    <Avatar name={emp.name} size={32} />
                    <span className="flex flex-col leading-tight">
                      <span className="font-semibold text-ink group-hover:text-brand">{emp.name}</span>
                      <span className="text-xs text-ink/50 tabular-nums">{emp.cpf}</span>
                    </span>
                  </Link>
                </td>
                <td className="text-ink/80">{emp.companies?.name ?? "—"}</td>
                <td className="text-ink/80">
                  {emp.school_category ? categoryLabels[emp.school_category] ?? emp.school_category : "—"}
                </td>
                <td className="text-ink/80">{emp.cargo ?? "—"}</td>
                <td>
                  <span className="flex flex-col leading-tight">
                    <span className="text-sm text-ink/80">{emp.email ?? "—"}</span>
                    <span className="text-xs text-ink/55">{emp.telefone ?? "—"}</span>
                  </span>
                </td>
                <td>
                  {emp.status_contrato ? (
                    <StatusPill tone={contratoTone[emp.status_contrato] ?? "neutral"}>
                      {emp.status_contrato}
                    </StatusPill>
                  ) : (
                    <span className="text-ink/40">—</span>
                  )}
                </td>
                <td>
                  <StatusPill tone={emp.ativo ? "success" : "danger"}>
                    {emp.ativo ? "Ativo" : "Inativo"}
                  </StatusPill>
                </td>
                {canMutate ? (
                  <td className="text-right">
                    <div className="inline-flex items-center gap-3">
                      <Link
                        href={`/rh/funcionarios/${emp.id}/editar`}
                        className="text-xs font-semibold text-brand hover:underline"
                      >
                        Editar
                      </Link>
                      <form action={toggleEmployeeAction} className="inline">
                        <input type="hidden" name="id" value={emp.id} />
                        <input type="hidden" name="ativo" value={emp.ativo ? "" : "on"} />
                        <button type="submit" className="text-xs font-semibold text-danger hover:underline">
                          {emp.ativo ? "Desativar" : "Ativar"}
                        </button>
                      </form>
                    </div>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </DataTableShell>
    </div>
  );
}
```

- [ ] **Step 2: Type check + smoke test**

Run: `npx tsc --noEmit`
Expected: no errors.

Navigate to `/rh/funcionarios`. Verify 64 seeded employees, KPIs, filter chips, search.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/rh/funcionarios/page.tsx
git commit -m "feat(rh): funcionarios list page with filters"
```

---

## Task 19: Funcionários — novo page

**Files:**
- Create: `src/app/(app)/rh/funcionarios/novo/page.tsx`

- [ ] **Step 1: Create page**

File: `src/app/(app)/rh/funcionarios/novo/page.tsx`

```tsx
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/card";
import { EmployeeForm } from "@/components/rh/employee-form";
import { createEmployeeAction } from "@/lib/actions/rh";
import { listCompanies } from "@/lib/data/rh";
import { requirePerfil } from "@/lib/auth/session";

export default async function NovoFuncionarioPage({
  searchParams
}: {
  searchParams: Promise<{ erro?: string; company?: string }>;
}) {
  await requirePerfil(["admin", "secretaria"]);
  const params = await searchParams;
  const companies = await listCompanies({ includeInactive: false });

  return (
    <div className="grid gap-8">
      <PageHeader
        breadcrumb={[{ label: "RH" }, { label: "Funcionários", href: "/rh/funcionarios" }, { label: "Novo" }]}
        title="Novo funcionário"
        description="Vincule um funcionário a uma empresa."
      />

      {params.erro ? (
        <div className="rounded-ui bg-danger/10 p-3 text-sm font-semibold text-danger">{params.erro}</div>
      ) : null}

      <Panel className="p-6">
        <EmployeeForm
          action={createEmployeeAction}
          companies={companies}
          defaultCompanyId={params.company}
          submitLabel="Cadastrar funcionário"
        />
      </Panel>
    </div>
  );
}
```

- [ ] **Step 2: Smoke test**

Navigate to `/rh/funcionarios/novo`. Form renders, dropdown has 2 companies. Submit valid → redirect with ok.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/rh/funcionarios/novo/page.tsx
git commit -m "feat(rh): novo funcionario page"
```

---

## Task 20: Funcionários — editar page

**Files:**
- Create: `src/app/(app)/rh/funcionarios/[id]/editar/page.tsx`

- [ ] **Step 1: Create page**

File: `src/app/(app)/rh/funcionarios/[id]/editar/page.tsx`

```tsx
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/card";
import { EmployeeForm } from "@/components/rh/employee-form";
import { updateEmployeeAction } from "@/lib/actions/rh";
import { listCompanies, getEmployeeById } from "@/lib/data/rh";
import { requirePerfil } from "@/lib/auth/session";

export default async function EditarFuncionarioPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ erro?: string }>;
}) {
  await requirePerfil(["admin", "secretaria"]);
  const { id } = await params;
  const sp = await searchParams;

  const [employee, companies] = await Promise.all([
    getEmployeeById(id),
    listCompanies({ includeInactive: true })
  ]);

  if (!employee) notFound();

  return (
    <div className="grid gap-8">
      <PageHeader
        breadcrumb={[
          { label: "RH" },
          { label: "Funcionários", href: "/rh/funcionarios" },
          { label: employee.name }
        ]}
        title="Editar funcionário"
        counter={employee.cpf}
      />

      {sp.erro ? (
        <div className="rounded-ui bg-danger/10 p-3 text-sm font-semibold text-danger">{sp.erro}</div>
      ) : null}

      <Panel className="p-6">
        <EmployeeForm
          action={updateEmployeeAction}
          employee={employee}
          companies={companies}
          submitLabel="Salvar alterações"
        />
      </Panel>
    </div>
  );
}
```

- [ ] **Step 2: Smoke test**

Navigate to `/rh/funcionarios/<id>/editar`. Form prefilled. Save → redirect with ok.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/rh/funcionarios/\[id\]/editar/page.tsx
git commit -m "feat(rh): editar funcionario page"
```

---

## Task 21: Empresa — detalhe page com lista funcionários

**Files:**
- Create: `src/app/(app)/rh/empresas/[id]/page.tsx`

- [ ] **Step 1: Create page**

File: `src/app/(app)/rh/empresas/[id]/page.tsx`

```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { DataTableShell } from "@/components/ui/data-table";
import { StatusPill, type StatusTone } from "@/components/ui/status-pill";
import { Avatar } from "@/components/ui/avatar";
import { getCompanyById, getCompanySummary, listEmployees } from "@/lib/data/rh";
import { requireSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

const contratoTone: Record<string, StatusTone> = {
  CLT: "success",
  PJ: "neutral",
  Estagio: "warning",
  Temporario: "danger"
};

const categoryLabels: Record<string, string> = {
  admin: "Admin",
  fund1: "Fund. I",
  fund2: "Fund. II",
  medio: "Médio"
};

export default async function EmpresaDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;
  const canMutate = session.profile.perfil === "admin" || session.profile.perfil === "secretaria";

  const company = await getCompanyById(id);
  if (!company) notFound();

  const [summary, employees] = await Promise.all([
    getCompanySummary(id),
    listEmployees({ companyId: id })
  ]);

  return (
    <div className="grid gap-8">
      <PageHeader
        breadcrumb={[
          { label: "RH" },
          { label: "Empresas", href: "/rh/empresas" },
          { label: company.name }
        ]}
        title={company.name}
        counter={company.cnpj}
        description="Funcionários vinculados a esta empresa."
        actions={
          canMutate ? (
            <ButtonLink href={`/rh/funcionarios/novo?company=${company.id}`} variant="primary">
              <Plus size={14} /> Adicionar funcionário
            </ButtonLink>
          ) : null
        }
        kpis={[
          { label: "Funcionários", value: summary.totalFuncionarios.toLocaleString("pt-BR") },
          { label: "Ativos",       value: summary.ativos.toLocaleString("pt-BR"), tone: "success" },
          { label: "Inativos",     value: summary.inativos.toLocaleString("pt-BR"), tone: "danger" },
          { label: "Admin",        value: summary.porCategoria.admin.toLocaleString("pt-BR") },
          { label: "Docentes",     value: (summary.porCategoria.fund1 + summary.porCategoria.fund2 + summary.porCategoria.medio).toLocaleString("pt-BR") }
        ]}
      />

      <DataTableShell>
        <table className="ds-dt min-w-[860px]">
          <thead>
            <tr>
              <th>Funcionário</th>
              <th>Categoria</th>
              <th>Cargo</th>
              <th>Contato</th>
              <th>Contrato</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {employees.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center text-ink/50 py-10">
                  Nenhum funcionário vinculado a esta empresa.
                </td>
              </tr>
            ) : null}
            {employees.map((emp) => (
              <tr key={emp.id}>
                <td>
                  <Link
                    href={canMutate ? `/rh/funcionarios/${emp.id}/editar` : `#`}
                    className="flex items-center gap-3 group"
                  >
                    <Avatar name={emp.name} size={32} />
                    <span className="flex flex-col leading-tight">
                      <span className="font-semibold text-ink group-hover:text-brand">{emp.name}</span>
                      <span className="text-xs text-ink/50 tabular-nums">{emp.cpf}</span>
                    </span>
                  </Link>
                </td>
                <td className="text-ink/80">
                  {emp.school_category ? categoryLabels[emp.school_category] ?? emp.school_category : "—"}
                </td>
                <td className="text-ink/80">{emp.cargo ?? "—"}</td>
                <td>
                  <span className="flex flex-col leading-tight">
                    <span className="text-sm text-ink/80">{emp.email ?? "—"}</span>
                    <span className="text-xs text-ink/55">{emp.telefone ?? "—"}</span>
                  </span>
                </td>
                <td>
                  {emp.status_contrato ? (
                    <StatusPill tone={contratoTone[emp.status_contrato] ?? "neutral"}>
                      {emp.status_contrato}
                    </StatusPill>
                  ) : (
                    <span className="text-ink/40">—</span>
                  )}
                </td>
                <td>
                  <StatusPill tone={emp.ativo ? "success" : "danger"}>
                    {emp.ativo ? "Ativo" : "Inativo"}
                  </StatusPill>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </DataTableShell>
    </div>
  );
}
```

- [ ] **Step 2: Smoke test**

Navigate to `/rh/empresas/<company_id>`. Lista filtrada da empresa, KPIs da empresa.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/rh/empresas/\[id\]/page.tsx
git commit -m "feat(rh): empresa detail page with employees list"
```

---

## Task 22: Final integration smoke test

- [ ] **Step 1: Run all type checks**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 2: Run dev server and walk through scenarios**

Start: `npm run dev`

Test scenarios (logged as **admin**):
- [ ] Topbar shows new "RH" dropdown with Empresas + Funcionários
- [ ] `/rh/empresas` lists 2 companies with KPIs
- [ ] Click "Ver funcionários →" on a card → `/rh/empresas/[id]` shows that company's employees
- [ ] Click "Nova empresa" → form opens → submit invalid CNPJ → erro inline
- [ ] Submit valid → redirect to list with success flash
- [ ] Edit existing empresa → form prefilled → save → success flash
- [ ] Desativar empresa → status pill changes; with "incluir inativos" admin only filter visible in funcionários
- [ ] `/rh/funcionarios` lists 64 employees; chips filter by categoria; search filters by name
- [ ] FilterDropdown Empresa filters by company
- [ ] FilterDropdown Contrato filters by status
- [ ] "Novo funcionário" form: company prefilled via `?company=<id>` query; submit valid creates row
- [ ] Edit funcionário: prefill works; save updates and redirects
- [ ] Desativar funcionário → some da lista; toggle "Incluir inativos" → reaparece (admin only)

Test scenarios (logged as **secretaria**, requires test profile):
- [ ] `/rh/empresas/nova` → redirects to `/acesso-negado`
- [ ] `/rh/empresas/[id]/editar` → redirects to `/acesso-negado`
- [ ] `/rh/funcionarios/novo` → opens form (allowed)
- [ ] `/rh/funcionarios/[id]/editar` → opens form (allowed)
- [ ] Company card has no "Editar"/"Desativar" buttons

- [ ] **Step 3: Commit final integration check**

If any fixes were applied during walkthrough, commit them with descriptive message. Otherwise skip.

```bash
# If fixes needed:
git add -A
git commit -m "fix(rh): integration smoke test fixes"
```

---

## Spec coverage check

| Spec section | Task |
|--------------|------|
| Migration (soft delete + extras) | Task 1 |
| `src/lib/data/rh.ts` | Tasks 6, 7 |
| `src/lib/actions/rh.ts` | Tasks 8, 9 |
| `src/lib/validation/rh.ts` | Task 3 |
| `src/lib/auth/session.ts` requirePerfil | Task 4 |
| `src/lib/format/masks.ts` | Task 2 |
| `src/components/rh/company-form.tsx` | Task 11 |
| `src/components/rh/company-card.tsx` | Task 12 |
| `src/components/rh/employee-form.tsx` | Task 16 |
| `src/components/rh/employee-filters.tsx` | Task 17 |
| `src/components/layout/rh-dropdown.tsx` | Task 10 |
| `/rh/empresas` lista | Task 13 |
| `/rh/empresas/nova` | Task 14 |
| `/rh/empresas/[id]` detalhe | Task 21 |
| `/rh/empresas/[id]/editar` | Task 15 |
| `/rh/funcionarios` lista global | Task 18 |
| `/rh/funcionarios/novo` | Task 19 |
| `/rh/funcionarios/[id]/editar` | Task 20 |
| `/acesso-negado` | Task 5 |
| Permissões admin/secretaria | Tasks 4, 8, 9 + page guards |
| Empty states | Tasks 13, 18, 21 |
| Erro CPF/CNPJ duplicado | Tasks 8, 9 |
| Topbar dropdown RH | Task 10 |
| Smoke test scenarios | Task 22 |

All sections covered.
