-- Livro-razão financeiro unificado (Fase 0 do módulo Comercial).
-- Generaliza `despesas` em `lancamento_financeiro` (tipo = receita|despesa) e
-- `categorias_despesa` em `categorias_financeiras` (com tipo + hierarquia).
-- Espelha padrões de 202605270001_despesas.sql: enums idempotentes, trigger
-- atualizado_em, RLS via current_perfil() restrita a admin/financeiro.

-- 1) Enums (idempotentes)
do $$ begin
  create type tipo_lancamento as enum ('receita','despesa');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type status_lancamento as enum ('aberta','paga','cancelada');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type forma_pagamento as enum ('pix','dinheiro','cartao','boleto','transferencia');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type origem_lancamento as enum ('despesa','venda','contrato','evento','cobranca','manual');
exception when duplicate_object then null;
end $$;

-- 2) Categorias financeiras (evolui de categorias_despesa)
create table if not exists categorias_financeiras (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references escolas(id) on delete cascade,
  nome text not null,
  tipo tipo_lancamento not null,
  parent_id uuid references categorias_financeiras(id) on delete restrict,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  unique (escola_id, nome, tipo)
);

create index if not exists categorias_financeiras_escola_idx on categorias_financeiras (escola_id);
create index if not exists categorias_financeiras_tipo_idx on categorias_financeiras (tipo);

-- 3) Livro-razão (generaliza despesas)
-- classe_despesa preserva a distinção fixa|variavel da tela atual de despesas
-- (despesas.tipo). Nullable: só faz sentido para tipo='despesa'.
create table if not exists lancamento_financeiro (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references escolas(id) on delete cascade,
  tipo tipo_lancamento not null,
  classe_despesa text check (classe_despesa in ('fixa','variavel')),
  competencia text not null check (competencia ~ '^\d{4}-\d{2}$'),
  descricao text not null,
  categoria_id uuid references categorias_financeiras(id) on delete restrict,
  contraparte text,
  valor numeric(12,2) not null check (valor > 0),
  data_vencimento date not null,
  data_pagamento date,
  forma_pagamento forma_pagamento,
  status status_lancamento not null default 'aberta',
  origem_tipo origem_lancamento not null default 'manual',
  origem_id uuid,
  evento_id uuid references eventos_escola(id) on delete set null,
  folha_run_id uuid references folha_runs(id) on delete set null,
  comprovante_path text,
  criado_por uuid references perfis(id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists lancamento_escola_comp_idx on lancamento_financeiro (escola_id, competencia);
create index if not exists lancamento_tipo_status_idx on lancamento_financeiro (tipo, status);
create index if not exists lancamento_origem_idx on lancamento_financeiro (origem_tipo, origem_id);
create index if not exists lancamento_categoria_idx on lancamento_financeiro (categoria_id);

-- guard de idempotência da migração de dados: 1 lançamento por origem
create unique index if not exists lancamento_origem_unico_idx
  on lancamento_financeiro (origem_tipo, origem_id)
  where origem_id is not null;

-- 4) Trigger atualizado_em (mesmo padrão de despesas)
create or replace function set_lancamento_atualizado_em()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;

drop trigger if exists lancamento_atualizado_em on lancamento_financeiro;
create trigger lancamento_atualizado_em
  before update on lancamento_financeiro
  for each row execute function set_lancamento_atualizado_em();

-- 5) RLS — admin/financeiro apenas (secretaria não acessa o razão)
alter table categorias_financeiras enable row level security;
alter table lancamento_financeiro enable row level security;

drop policy if exists categorias_financeiras_rw on categorias_financeiras;
create policy categorias_financeiras_rw on categorias_financeiras
  for all
  using (
    escola_id = (select escola_id from current_perfil())
    and (select perfil from current_perfil()) in ('admin','financeiro')
  )
  with check (
    escola_id = (select escola_id from current_perfil())
    and (select perfil from current_perfil()) in ('admin','financeiro')
  );

drop policy if exists lancamento_financeiro_rw on lancamento_financeiro;
create policy lancamento_financeiro_rw on lancamento_financeiro
  for all
  using (
    escola_id = (select escola_id from current_perfil())
    and (select perfil from current_perfil()) in ('admin','financeiro')
  )
  with check (
    escola_id = (select escola_id from current_perfil())
    and (select perfil from current_perfil()) in ('admin','financeiro')
  );

-- reusa bucket de comprovantes existente (despesas-comprovantes); nada a criar.
