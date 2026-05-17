-- Base schema for RH (companies/employees/payroll) — replaces ad-hoc tables that existed pre-migration.
-- Idempotent: uses create table if not exists + add column if not exists.

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  cnpj text not null unique,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  cpf text not null,
  name text not null,
  birth_date date,
  hire_date date,
  school_category text check (school_category is null or school_category in ('admin','fund1','fund2','medio')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_employees_company on public.employees (company_id);
create index if not exists idx_employees_cpf on public.employees (cpf);

create table if not exists public.payroll (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  reference_month date not null,
  base_salary numeric(12,2),
  additional numeric(12,2) default 0,
  family_allowance numeric(12,2) default 0,
  loan_deduction numeric(12,2) default 0,
  advance numeric(12,2) default 0,
  uniform_value numeric(12,2) default 0,
  total_earnings numeric(12,2),
  inss numeric(12,2),
  ir numeric(12,2),
  total_deductions numeric(12,2),
  net_amount numeric(12,2),
  consider_decimo_terceiro boolean default false,
  considera_um_tercio_ferias boolean default false,
  observations text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (employee_id, reference_month)
);

create index if not exists idx_payroll_employee on public.payroll (employee_id);

-- Helper trigger function used by subsequent migrations
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;
