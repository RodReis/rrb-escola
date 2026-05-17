create table public.employees (
  id uuid not null default extensions.uuid_generate_v4 (),
  company_id uuid not null,
  cpf character varying(20) not null,
  name character varying(255) not null,
  birth_date date null,
  hire_date date null,
  school_category character varying(50) null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint employees_pkey primary key (id),
  constraint employees_cpf_key unique (cpf),
  constraint employees_company_id_fkey foreign KEY (company_id) references companies (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_employees_company on public.employees using btree (company_id) TABLESPACE pg_default;

create index IF not exists idx_employees_cpf on public.employees using btree (cpf) TABLESPACE pg_default;

create table public.payroll (
  id uuid not null default extensions.uuid_generate_v4 (),
  employee_id uuid not null,
  reference_month date not null,
  base_salary numeric(10, 2) null,
  additional numeric(10, 2) null default 0,
  consider_decimo_terceiro boolean null default false,
  considera_um_tercio_ferias boolean null default false,
  total_earnings numeric(10, 2) null,
  inss numeric(10, 2) null,
  ir numeric(10, 2) null,
  loan_deduction numeric(10, 2) null default 0,
  advance numeric(10, 2) null default 0,
  total_deductions numeric(10, 2) null,
  family_allowance numeric(10, 2) null default 0,
  net_amount numeric(10, 2) null,
  observations text null,
  uniform_value numeric(10, 2) null default 0,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint payroll_pkey primary key (id),
  constraint payroll_employee_id_reference_month_key unique (employee_id, reference_month),
  constraint payroll_employee_id_fkey foreign KEY (employee_id) references employees (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_payroll_employee_month on public.payroll using btree (employee_id, reference_month) TABLESPACE pg_default;

create table public.despesas (
  id uuid not null default gen_random_uuid (),
  data date not null,
  mes_referencia text not null,
  categoria text not null,
  descricao text not null,
  tipo text not null,
  valor numeric(12, 2) not null,
  forma_pagamento text not null,
  observacoes text null,
  created_by uuid null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint despesas_pkey primary key (id),
  constraint despesas_created_by_fkey foreign KEY (created_by) references auth.users (id) on delete set null,
  constraint despesas_categoria_check check (
    (
      categoria = any (
        array[
          'Aluguel'::text,
          'Salários'::text,
          'Internet'::text,
          'Energia'::text,
          'Água'::text,
          'DARF'::text,
          'Impostos'::text,
          'Eventos'::text,
          'Outros'::text
        ]
      )
    )
  ),
  constraint despesas_tipo_check check (
    (
      tipo = any (array['Fixo'::text, 'Variável'::text])
    )
  ),
  constraint despesas_valor_check check ((valor > (0)::numeric))
) TABLESPACE pg_default;

create index IF not exists despesas_mes_referencia_idx on public.despesas using btree (mes_referencia) TABLESPACE pg_default;

create index IF not exists despesas_categoria_idx on public.despesas using btree (categoria) TABLESPACE pg_default;

create index IF not exists despesas_data_idx on public.despesas using btree (data desc) TABLESPACE pg_default;

create trigger despesas_updated_at BEFORE
update on despesas for EACH row
execute FUNCTION set_updated_at ();

create table public.companies (
  id uuid not null default extensions.uuid_generate_v4 (),
  cnpj character varying(20) not null,
  name character varying(255) not null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint companies_pkey primary key (id),
  constraint companies_cnpj_key unique (cnpj)
) TABLESPACE pg_default;

create index IF not exists idx_companies_cnpj on public.companies using btree (cnpj) TABLESPACE pg_default;