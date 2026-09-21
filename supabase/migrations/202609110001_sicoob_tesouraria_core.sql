-- Tesouraria Sicoob: contas, Pix de recebimento e conciliação.

do $$ begin
  create type provedor_pagamento as enum ('asaas','sicoob');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type origem_recebimento as enum ('cobranca','venda','contrato','evento','lancamento','avulso');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type status_pix_cobranca as enum ('ativa','concluida','expirada','cancelada');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type tipo_extrato_bancario as enum ('credito','debito');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type status_conciliacao as enum ('pendente','auto','manual','ignorado');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type alvo_conciliacao as enum ('pagamento','lancamento');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type origem_conciliacao as enum ('auto','manual');
exception when duplicate_object then null;
end $$;

create table if not exists contas_bancarias (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references escolas(id) on delete cascade,
  apelido text,
  banco text not null default '756',
  cooperativa text,
  agencia text,
  conta text not null,
  chave_pix text,
  provedor provedor_pagamento not null default 'sicoob',
  ativo boolean not null default true,
  saldo_sincronizado_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists pix_cobranca (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references escolas(id) on delete cascade,
  conta_id uuid not null references contas_bancarias(id) on delete restrict,
  origem_tipo origem_recebimento not null,
  origem_id uuid,
  txid text not null check (txid ~ '^[a-zA-Z0-9]{26,35}$'),
  valor numeric(12,2) not null check (valor > 0),
  devedor_nome text,
  devedor_doc text,
  descricao text not null,
  pix_copia_cola text not null,
  location text,
  status status_pix_cobranca not null default 'ativa',
  expira_em timestamptz not null,
  payload jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (escola_id, txid)
);

create table if not exists pix_recebido (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references escolas(id) on delete cascade,
  conta_id uuid references contas_bancarias(id) on delete set null,
  end_to_end_id text not null unique,
  txid text,
  valor numeric(12,2) not null check (valor > 0),
  pagador_nome text,
  pagador_doc text,
  recebido_em timestamptz not null,
  payload jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now()
);

create table if not exists extrato_bancario (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references escolas(id) on delete cascade,
  conta_id uuid not null references contas_bancarias(id) on delete cascade,
  id_transacao text not null,
  data date not null,
  tipo tipo_extrato_bancario not null,
  valor numeric(12,2) not null,
  descricao text not null,
  end_to_end_id text,
  contraparte_doc text,
  status_conciliacao status_conciliacao not null default 'pendente',
  payload jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (conta_id, id_transacao)
);

create table if not exists conciliacao_vinculo (
  id uuid primary key default gen_random_uuid(),
  extrato_id uuid not null references extrato_bancario(id) on delete cascade,
  alvo_tipo alvo_conciliacao not null,
  alvo_id uuid not null,
  valor numeric(12,2) not null check (valor > 0),
  origem origem_conciliacao not null,
  criado_por uuid references perfis(id) on delete set null,
  criado_em timestamptz not null default now(),
  unique (extrato_id, alvo_tipo, alvo_id)
);

create table if not exists webhooks_recebidos (
  id uuid primary key default gen_random_uuid(),
  provedor provedor_pagamento not null,
  evento text not null,
  id_externo text,
  payload jsonb not null,
  recebido_em timestamptz not null default now(),
  processado_em timestamptz,
  erro text
);

create index if not exists contas_bancarias_escola_idx on contas_bancarias (escola_id, ativo);
create index if not exists pix_cobranca_origem_idx on pix_cobranca (origem_tipo, origem_id);
create index if not exists pix_recebido_txid_idx on pix_recebido (txid) where txid is not null;
create index if not exists extrato_bancario_status_idx on extrato_bancario (escola_id, status_conciliacao, data desc);
create index if not exists extrato_bancario_e2e_idx on extrato_bancario (end_to_end_id) where end_to_end_id is not null;
create index if not exists conciliacao_vinculo_alvo_idx on conciliacao_vinculo (alvo_tipo, alvo_id);
create index if not exists webhooks_recebidos_provedor_idx on webhooks_recebidos (provedor, recebido_em desc);

drop trigger if exists contas_bancarias_atualizado_em on contas_bancarias;
create trigger contas_bancarias_atualizado_em before update on contas_bancarias
  for each row execute function set_lancamento_atualizado_em();

drop trigger if exists pix_cobranca_atualizado_em on pix_cobranca;
create trigger pix_cobranca_atualizado_em before update on pix_cobranca
  for each row execute function set_lancamento_atualizado_em();

drop trigger if exists extrato_bancario_atualizado_em on extrato_bancario;
create trigger extrato_bancario_atualizado_em before update on extrato_bancario
  for each row execute function set_lancamento_atualizado_em();

alter table contas_bancarias enable row level security;
alter table pix_cobranca enable row level security;
alter table pix_recebido enable row level security;
alter table extrato_bancario enable row level security;
alter table conciliacao_vinculo enable row level security;
alter table webhooks_recebidos enable row level security;

drop policy if exists contas_bancarias_rw on contas_bancarias;
create policy contas_bancarias_rw on contas_bancarias for all
  using (escola_id = (select escola_id from current_perfil()) and (select perfil from current_perfil()) in ('admin','financeiro'))
  with check (escola_id = (select escola_id from current_perfil()) and (select perfil from current_perfil()) in ('admin','financeiro'));

drop policy if exists pix_cobranca_rw on pix_cobranca;
create policy pix_cobranca_rw on pix_cobranca for all
  using (escola_id = (select escola_id from current_perfil()) and (select perfil from current_perfil()) in ('admin','financeiro'))
  with check (escola_id = (select escola_id from current_perfil()) and (select perfil from current_perfil()) in ('admin','financeiro'));

drop policy if exists pix_recebido_rw on pix_recebido;
create policy pix_recebido_rw on pix_recebido for all
  using (escola_id = (select escola_id from current_perfil()) and (select perfil from current_perfil()) in ('admin','financeiro'))
  with check (escola_id = (select escola_id from current_perfil()) and (select perfil from current_perfil()) in ('admin','financeiro'));

drop policy if exists extrato_bancario_rw on extrato_bancario;
create policy extrato_bancario_rw on extrato_bancario for all
  using (escola_id = (select escola_id from current_perfil()) and (select perfil from current_perfil()) in ('admin','financeiro'))
  with check (escola_id = (select escola_id from current_perfil()) and (select perfil from current_perfil()) in ('admin','financeiro'));

drop policy if exists conciliacao_vinculo_rw on conciliacao_vinculo;
create policy conciliacao_vinculo_rw on conciliacao_vinculo for all
  using (exists (
    select 1 from extrato_bancario e
    where e.id = extrato_id
      and e.escola_id = (select escola_id from current_perfil())
      and (select perfil from current_perfil()) in ('admin','financeiro')
  ))
  with check (exists (
    select 1 from extrato_bancario e
    where e.id = extrato_id
      and e.escola_id = (select escola_id from current_perfil())
      and (select perfil from current_perfil()) in ('admin','financeiro')
  ));

drop policy if exists webhooks_recebidos_admin_read on webhooks_recebidos;
create policy webhooks_recebidos_admin_read on webhooks_recebidos for select
  using ((select perfil from current_perfil()) = 'admin');

create or replace function espelhar_pagamento_cobranca_razao()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_descricao text;
  v_categoria_id uuid;
begin
  select c.descricao into v_descricao from cobrancas c where c.id = new.cobranca_id;

  select id into v_categoria_id
  from categorias_financeiras
  where escola_id = new.escola_id and tipo = 'receita' and nome = 'Mensalidades'
  limit 1;

  if v_categoria_id is null then
    insert into categorias_financeiras (escola_id, nome, tipo)
    values (new.escola_id, 'Mensalidades', 'receita')
    on conflict (escola_id, nome, tipo) do update set nome = excluded.nome
    returning id into v_categoria_id;
  end if;

  if new.cancelado_em is null then
    insert into lancamento_financeiro (
      escola_id, tipo, competencia, descricao, categoria_id, valor,
      data_vencimento, data_pagamento, forma_pagamento, status,
      origem_tipo, origem_id
    ) values (
      new.escola_id, 'receita', to_char(new.data_pagamento, 'YYYY-MM'),
      coalesce(v_descricao, 'Mensalidade'), v_categoria_id, new.valor_pago,
      new.data_pagamento, new.data_pagamento, new.forma_pagamento, 'paga',
      'cobranca', new.id
    )
    on conflict (origem_tipo, origem_id) where origem_id is not null
    do update set
      valor = excluded.valor,
      data_pagamento = excluded.data_pagamento,
      forma_pagamento = excluded.forma_pagamento,
      status = 'paga';
  else
    update lancamento_financeiro
    set status = 'cancelada'
    where origem_tipo = 'cobranca' and origem_id = new.id;
  end if;

  return new;
end;
$$;

drop trigger if exists pagamentos_espelha_razao on pagamentos;
create trigger pagamentos_espelha_razao
  after insert or update of cancelado_em, valor_pago, data_pagamento, forma_pagamento on pagamentos
  for each row execute function espelhar_pagamento_cobranca_razao();

insert into categorias_financeiras (escola_id, nome, tipo)
select distinct escola_id, 'Mensalidades', 'receita'::tipo_lancamento
from pagamentos
on conflict (escola_id, nome, tipo) do nothing;

insert into lancamento_financeiro (
  escola_id, tipo, competencia, descricao, categoria_id, valor,
  data_vencimento, data_pagamento, forma_pagamento, status, origem_tipo, origem_id
)
select
  p.escola_id, 'receita', to_char(p.data_pagamento, 'YYYY-MM'), c.descricao,
  cf.id, p.valor_pago, p.data_pagamento, p.data_pagamento, p.forma_pagamento,
  case when p.cancelado_em is null then 'paga'::status_lancamento else 'cancelada'::status_lancamento end,
  'cobranca', p.id
from pagamentos p
join cobrancas c on c.id = p.cobranca_id
join categorias_financeiras cf on cf.escola_id = p.escola_id and cf.nome = 'Mensalidades' and cf.tipo = 'receita'
on conflict (origem_tipo, origem_id) where origem_id is not null do nothing;

create or replace function registrar_pix_recebido(
  p_end_to_end_id text,
  p_txid text,
  p_valor numeric,
  p_recebido_em timestamptz,
  p_payload jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pix pix_cobranca%rowtype;
  v_pix_recebido_id uuid;
  v_pagamento_id uuid;
begin
  select * into v_pix
  from pix_cobranca
  where txid = p_txid
  order by criado_em desc
  limit 1;

  if found then
    insert into pix_recebido (
      escola_id, conta_id, end_to_end_id, txid, valor, recebido_em, payload
    ) values (
      v_pix.escola_id, v_pix.conta_id, p_end_to_end_id, p_txid, p_valor, p_recebido_em, coalesce(p_payload, '{}'::jsonb)
    )
    on conflict (end_to_end_id) do nothing
    returning id into v_pix_recebido_id;

    if v_pix_recebido_id is null then
      select id into v_pix_recebido_id from pix_recebido where end_to_end_id = p_end_to_end_id;
      return v_pix_recebido_id;
    end if;

    update pix_cobranca set status = 'concluida' where id = v_pix.id;

    if v_pix.origem_tipo = 'cobranca' and v_pix.origem_id is not null then
      insert into pagamentos (
        escola_id, cobranca_id, aluno_id, matricula_id, data_pagamento,
        valor_pago, forma_pagamento, observacao
      )
      select c.escola_id, c.id, c.aluno_id, c.matricula_id, p_recebido_em::date,
        p_valor, 'pix', 'Pagamento confirmado via Sicoob Pix'
      from cobrancas c
      where c.id = v_pix.origem_id
      returning id into v_pagamento_id;
    elsif v_pix.origem_tipo = 'venda' and v_pix.origem_id is not null then
      perform confirmar_venda(v_pix.origem_id);
    elsif v_pix.origem_tipo = 'lancamento' and v_pix.origem_id is not null then
      update lancamento_financeiro
      set status = 'paga', data_pagamento = p_recebido_em::date, forma_pagamento = 'pix'
      where id = v_pix.origem_id;
    elsif v_pix.origem_tipo = 'avulso' then
      insert into lancamento_financeiro (
        escola_id, tipo, competencia, descricao, valor, data_vencimento,
        data_pagamento, forma_pagamento, status, origem_tipo, origem_id
      ) values (
        v_pix.escola_id, 'receita', to_char(p_recebido_em, 'YYYY-MM'),
        v_pix.descricao, p_valor, p_recebido_em::date, p_recebido_em::date,
        'pix', 'paga', 'manual', v_pix_recebido_id
      );
    end if;

    return v_pix_recebido_id;
  end if;

  raise exception 'pix_cobranca nao encontrada para txid %', p_txid;
end;
$$;

grant execute on function registrar_pix_recebido(text, text, numeric, timestamptz, jsonb) to service_role;

insert into modulos (codigo, grupo, nome, ordem) values
  ('financeiro.tesouraria', 'financeiro', 'Tesouraria', 24),
  ('financeiro.conciliacao', 'financeiro', 'Conciliação Bancária', 25)
on conflict (codigo) do update set grupo = excluded.grupo, nome = excluded.nome, ordem = excluded.ordem;

insert into role_permissoes (role_codigo, modulo_codigo, pode_ler, pode_criar, pode_editar, pode_deletar) values
  ('admin', 'financeiro.tesouraria', true, true, true, true),
  ('financeiro', 'financeiro.tesouraria', true, true, true, false),
  ('secretaria', 'financeiro.tesouraria', false, false, false, false),
  ('professor', 'financeiro.tesouraria', false, false, false, false),
  ('admin', 'financeiro.conciliacao', true, true, true, true),
  ('financeiro', 'financeiro.conciliacao', true, false, true, false),
  ('secretaria', 'financeiro.conciliacao', false, false, false, false),
  ('professor', 'financeiro.conciliacao', false, false, false, false)
on conflict (role_codigo, modulo_codigo) do update set
  pode_ler = excluded.pode_ler,
  pode_criar = excluded.pode_criar,
  pode_editar = excluded.pode_editar,
  pode_deletar = excluded.pode_deletar;
