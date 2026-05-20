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
