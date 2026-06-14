-- Movimento de estoque (Fase 2). Fonte de verdade do saldo (Σ quantidade × sentido).
-- Saldo NUNCA é coluna mutável — só nasce de movimento (view saldo_estoque).
-- Espelha padrões de despesas/comercial. RLS admin/financeiro/secretaria.

-- 1) Enum
do $$ begin
  create type tipo_movimento_estoque as enum ('entrada','saida','ajuste');
exception when duplicate_object then null;
end $$;

-- 2) Tabela
create table if not exists movimento_estoque (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references escolas(id) on delete cascade,
  variacao_id uuid not null references produto_variacao(id) on delete restrict,
  tipo tipo_movimento_estoque not null,
  quantidade integer not null check (quantidade > 0),  -- sempre positivo
  sentido smallint not null default 1 check (sentido in (-1, 1)),
  custo_unit numeric(12,2),
  data date not null default current_date,
  origem_tipo origem_lancamento,   -- 'venda' p/ saída automática
  origem_id uuid,
  observacao text,
  criado_por uuid references perfis(id) on delete set null,
  criado_em timestamptz not null default now()
);
create index if not exists movimento_variacao_data_idx on movimento_estoque (variacao_id, data);
create index if not exists movimento_origem_idx on movimento_estoque (origem_tipo, origem_id);

-- 3) Trigger: força sentido por tipo + bloqueia saldo negativo.
--    entrada -> +1, saida -> -1 (ignora o que vier do client). ajuste -> sentido livre.
--    Qualquer movimento que levaria o saldo da variação abaixo de 0 falha.
create or replace function fn_movimento_estoque_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_saldo_atual integer;
  v_delta integer;
begin
  -- força sentido
  if new.tipo = 'entrada' then
    new.sentido := 1;
  elsif new.tipo = 'saida' then
    new.sentido := -1;
  end if; -- ajuste mantém o sentido informado (-1/+1)

  v_delta := new.quantidade * new.sentido;

  -- saldo atual da variação (antes deste movimento)
  select coalesce(sum(quantidade * sentido), 0) into v_saldo_atual
  from movimento_estoque
  where variacao_id = new.variacao_id;

  if v_saldo_atual + v_delta < 0 then
    raise exception 'Saldo insuficiente para variação % (atual=%, movimento=%)',
      new.variacao_id, v_saldo_atual, v_delta;
  end if;

  return new;
end;
$$;

drop trigger if exists movimento_estoque_guard on movimento_estoque;
create trigger movimento_estoque_guard
  before insert on movimento_estoque
  for each row execute function fn_movimento_estoque_guard();

-- 4) View de saldo (recalcula sempre; volume baixo)
create or replace view saldo_estoque as
select
  v.id as variacao_id,
  v.escola_id,
  coalesce(sum(m.quantidade * m.sentido), 0) as saldo,
  max(case when m.tipo = 'saida' then m.data end) as ultima_saida
from produto_variacao v
left join movimento_estoque m on m.variacao_id = v.id
group by v.id, v.escola_id;

-- 5) RLS — admin/financeiro/secretaria
alter table movimento_estoque enable row level security;

drop policy if exists movimento_estoque_rw on movimento_estoque;
create policy movimento_estoque_rw on movimento_estoque for all
  using (escola_id = (select escola_id from current_perfil())
    and (select perfil from current_perfil()) in ('admin','financeiro','secretaria'))
  with check (escola_id = (select escola_id from current_perfil())
    and (select perfil from current_perfil()) in ('admin','financeiro','secretaria'));

-- 6) RBAC: módulo de estoque (grupo secretaria), admin/financeiro/secretaria.
insert into modulos (codigo, grupo, nome, ordem) values
  ('comercial.estoque', 'secretaria', 'Estoque', 21)
on conflict (codigo) do nothing;

insert into role_permissoes (role_codigo, modulo_codigo, pode_ler, pode_criar, pode_editar, pode_deletar) values
  ('admin',      'comercial.estoque', true, true, true, true),
  ('financeiro', 'comercial.estoque', true, true, true, true),
  ('secretaria', 'comercial.estoque', true, true, true, true),
  ('professor',  'comercial.estoque', false, false, false, false)
on conflict (role_codigo, modulo_codigo) do nothing;
