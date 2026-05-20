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
