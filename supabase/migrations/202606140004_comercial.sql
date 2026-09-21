-- Módulo Comercial (Fase 1): produtos, variações (SKU) e vendas.
-- SEM movimento_estoque ainda (Fase 2). Espelha padrões de 202605270001_despesas.sql.
-- RLS: admin/financeiro/secretaria (tabelas comerciais).

-- 1) Enums
do $$ begin
  create type tipo_produto as enum ('uniforme','apostila','outro');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type status_venda as enum ('rascunho','confirmada','cancelada');
exception when duplicate_object then null;
end $$;

-- 2) Produto
create table if not exists produto (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references escolas(id) on delete cascade,
  nome text not null,
  tipo tipo_produto not null,
  controla_estoque boolean not null default false, -- uniforme=true, apostila=false
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists produto_escola_idx on produto (escola_id);

-- 3) Variação (SKU)
create table if not exists produto_variacao (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references escolas(id) on delete cascade,
  produto_id uuid not null references produto(id) on delete cascade,
  sku text,
  atributos jsonb not null default '{}'::jsonb,   -- {"tamanho":"M","genero":"unissex"}
  preco_venda numeric(12,2) not null check (preco_venda >= 0),
  custo numeric(12,2) not null default 0,
  estoque_minimo integer not null default 0,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  unique (escola_id, produto_id, sku)
);
create index if not exists variacao_produto_idx on produto_variacao (produto_id);

-- 4) Venda (sempre à vista nesta entrega)
create table if not exists venda (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references escolas(id) on delete cascade,
  aluno_id uuid references alunos(id) on delete set null,
  cliente_nome text,
  status status_venda not null default 'rascunho',
  data_venda date not null default current_date,
  desconto numeric(12,2) not null default 0 check (desconto >= 0),
  forma_pagamento forma_pagamento,
  numero_cupom text,                  -- obrigatório quando cartão (validado no Zod)
  evento_id uuid references eventos_escola(id) on delete set null,
  observacao text,
  criado_por uuid references perfis(id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists venda_escola_idx on venda (escola_id);
create index if not exists venda_status_idx on venda (status);
create index if not exists venda_data_idx on venda (data_venda);

-- 5) Item de venda (subtotal gerado)
create table if not exists venda_item (
  id uuid primary key default gen_random_uuid(),
  venda_id uuid not null references venda(id) on delete cascade,
  variacao_id uuid not null references produto_variacao(id) on delete restrict,
  quantidade integer not null check (quantidade > 0),
  preco_unit numeric(12,2) not null check (preco_unit >= 0),
  subtotal numeric(12,2) generated always as (quantidade * preco_unit) stored
);
create index if not exists venda_item_venda_idx on venda_item (venda_id);

-- 6) Triggers atualizado_em (padrão de despesas)
create or replace function set_produto_atualizado_em()
returns trigger language plpgsql security definer set search_path = public
as $$ begin new.atualizado_em = now(); return new; end; $$;

drop trigger if exists produto_atualizado_em on produto;
create trigger produto_atualizado_em before update on produto
  for each row execute function set_produto_atualizado_em();

create or replace function set_venda_atualizado_em()
returns trigger language plpgsql security definer set search_path = public
as $$ begin new.atualizado_em = now(); return new; end; $$;

drop trigger if exists venda_atualizado_em on venda;
create trigger venda_atualizado_em before update on venda
  for each row execute function set_venda_atualizado_em();

-- 7) RLS — admin/financeiro/secretaria
alter table produto enable row level security;
alter table produto_variacao enable row level security;
alter table venda enable row level security;
alter table venda_item enable row level security;

drop policy if exists produto_rw on produto;
create policy produto_rw on produto for all
  using (escola_id = (select escola_id from current_perfil())
    and (select perfil from current_perfil()) in ('admin','financeiro','secretaria'))
  with check (escola_id = (select escola_id from current_perfil())
    and (select perfil from current_perfil()) in ('admin','financeiro','secretaria'));

drop policy if exists produto_variacao_rw on produto_variacao;
create policy produto_variacao_rw on produto_variacao for all
  using (escola_id = (select escola_id from current_perfil())
    and (select perfil from current_perfil()) in ('admin','financeiro','secretaria'))
  with check (escola_id = (select escola_id from current_perfil())
    and (select perfil from current_perfil()) in ('admin','financeiro','secretaria'));

drop policy if exists venda_rw on venda;
create policy venda_rw on venda for all
  using (escola_id = (select escola_id from current_perfil())
    and (select perfil from current_perfil()) in ('admin','financeiro','secretaria'))
  with check (escola_id = (select escola_id from current_perfil())
    and (select perfil from current_perfil()) in ('admin','financeiro','secretaria'));

-- venda_item: escopo via venda (não tem escola_id próprio).
drop policy if exists venda_item_rw on venda_item;
create policy venda_item_rw on venda_item for all
  using (exists (
    select 1 from venda v
    where v.id = venda_item.venda_id
      and v.escola_id = (select escola_id from current_perfil())
      and (select perfil from current_perfil()) in ('admin','financeiro','secretaria')
  ))
  with check (exists (
    select 1 from venda v
    where v.id = venda_item.venda_id
      and v.escola_id = (select escola_id from current_perfil())
      and (select perfil from current_perfil()) in ('admin','financeiro','secretaria')
  ));
