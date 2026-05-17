-- Despesas mensais: categorias, despesas, storage bucket de comprovantes, RLS.
-- Drop legacy ad-hoc `despesas` table (no prior migration created it; user authorized drop).
drop table if exists despesas cascade;

create table if not exists categorias_despesa (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

do $$ begin
  create type forma_pagamento_despesa as enum ('pix','dinheiro','cartao','boleto','transferencia');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type status_despesa as enum ('aberta','paga','cancelada');
exception when duplicate_object then null;
end $$;

create table if not exists despesas (
  id uuid primary key default gen_random_uuid(),
  competencia text not null check (competencia ~ '^\d{4}-\d{2}$'),
  descricao text not null,
  categoria_id uuid references categorias_despesa(id) on delete restrict,
  fornecedor text,
  valor numeric(12,2) not null check (valor > 0),
  data_vencimento date not null,
  data_pagamento date,
  forma_pagamento forma_pagamento_despesa,
  comprovante_path text,
  status status_despesa not null default 'aberta',
  criado_por uuid references perfis(id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists despesas_competencia_idx on despesas (competencia);
create index if not exists despesas_categoria_idx on despesas (categoria_id);
create index if not exists despesas_status_idx on despesas (status);

create or replace function set_despesas_atualizado_em()
returns trigger as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists despesas_atualizado_em on despesas;
create trigger despesas_atualizado_em
  before update on despesas
  for each row execute function set_despesas_atualizado_em();

insert into storage.buckets (id, name, public)
values ('despesas-comprovantes', 'despesas-comprovantes', false)
on conflict (id) do nothing;

alter table categorias_despesa enable row level security;
alter table despesas enable row level security;

drop policy if exists categorias_despesa_rw on categorias_despesa;
create policy categorias_despesa_rw on categorias_despesa
  for all
  using (
    exists (
      select 1 from perfis p
      where p.id = auth.uid()
        and p.perfil in ('admin','financeiro')
    )
  )
  with check (
    exists (
      select 1 from perfis p
      where p.id = auth.uid()
        and p.perfil in ('admin','financeiro')
    )
  );

drop policy if exists despesas_rw on despesas;
create policy despesas_rw on despesas
  for all
  using (
    exists (
      select 1 from perfis p
      where p.id = auth.uid()
        and p.perfil in ('admin','financeiro')
    )
  )
  with check (
    exists (
      select 1 from perfis p
      where p.id = auth.uid()
        and p.perfil in ('admin','financeiro')
    )
  );

drop policy if exists despesas_comprovantes_rw on storage.objects;
create policy despesas_comprovantes_rw on storage.objects
  for all
  using (
    bucket_id = 'despesas-comprovantes'
    and exists (
      select 1 from perfis p
      where p.id = auth.uid()
        and p.perfil in ('admin','financeiro')
    )
  )
  with check (
    bucket_id = 'despesas-comprovantes'
    and exists (
      select 1 from perfis p
      where p.id = auth.uid()
        and p.perfil in ('admin','financeiro')
    )
  );

insert into categorias_despesa (nome) values
  ('Aluguel'),
  ('Água'),
  ('Luz'),
  ('Internet'),
  ('Material escolar'),
  ('Manutenção'),
  ('Fornecedores'),
  ('Outros')
on conflict (nome) do nothing;
