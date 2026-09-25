-- Previsto × Realizado.
--
-- lancamento_financeiro com status 'aberta' JÁ é o título a pagar; esta migration
-- só acrescenta a recorrência, as chaves de idempotência e a baixa atômica.

-- Recorrência --------------------------------------------------------------
create table if not exists despesa_recorrente (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references escolas(id) on delete cascade,
  company_id uuid references companies(id) on delete restrict,
  descricao text not null,
  categoria_id uuid not null references categorias_financeiras(id) on delete restrict,
  contraparte text,
  valor_referencia numeric(12,2) check (valor_referencia is null or valor_referencia > 0),
  dia_vencimento int not null check (dia_vencimento between 1 and 31),
  classe_despesa text check (classe_despesa in ('fixa','variavel')),
  ativo boolean not null default true,
  inicio_competencia text not null check (inicio_competencia ~ '^\d{4}-\d{2}$'),
  fim_competencia text check (fim_competencia ~ '^\d{4}-\d{2}$'),
  criado_por uuid references perfis(id) on delete set null,
  criado_em timestamptz not null default now()
);

create index if not exists despesa_recorrente_escola_idx
  on despesa_recorrente (escola_id) where ativo;

alter table lancamento_financeiro
  add column if not exists recorrente_id uuid references despesa_recorrente(id) on delete set null;

-- Rodar a geração duas vezes no mesmo mês não duplica título.
create unique index if not exists lancamento_recorrente_competencia_uq
  on lancamento_financeiro (recorrente_id, competencia)
  where recorrente_id is not null;

-- Import da planilha -------------------------------------------------------
-- sha256 de competencia|descricao normalizada|centavos|data_vencimento.
-- Reenviar o mesmo mês não duplica o previsto.
alter table lancamento_financeiro add column if not exists import_hash text;

create unique index if not exists lancamento_import_hash_uq
  on lancamento_financeiro (escola_id, import_hash)
  where import_hash is not null;

alter table despesa_recorrente enable row level security;

drop policy if exists despesa_recorrente_rw on despesa_recorrente;
create policy despesa_recorrente_rw on despesa_recorrente for all
  using (exists (select 1 from current_perfil() p
                 where p.id is not null and p.perfil in ('admin','financeiro')))
  with check (exists (select 1 from current_perfil() p
                      where p.id is not null and p.perfil in ('admin','financeiro')));

-- Baixa de previsto --------------------------------------------------------
-- Núcleo compartilhado. NÃO é exposto: só as duas portas abaixo o chamam.
-- Valida tudo de novo dentro da transação: quem chama pode ter lido o título
-- há segundos e outro usuário (ou o sync) pode tê-lo baixado nesse meio tempo.
create or replace function _baixar_previsto(
  p_extrato_id uuid,
  p_lancamento_id uuid,
  p_perfil_id uuid,
  p_origem origem_conciliacao
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ext   extrato_bancario%rowtype;
  v_lan   lancamento_financeiro%rowtype;
  v_forma forma_pagamento;
begin
  select * into v_ext from extrato_bancario where id = p_extrato_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Movimento não encontrado.');
  end if;
  if v_ext.tipo <> 'debito' or v_ext.status_conciliacao <> 'pendente' then
    return jsonb_build_object('ok', false, 'error', 'O movimento não é um débito pendente.');
  end if;

  select * into v_lan from lancamento_financeiro where id = p_lancamento_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Título não encontrado.');
  end if;
  if v_lan.escola_id <> v_ext.escola_id then
    return jsonb_build_object('ok', false, 'error', 'Título de outra escola.');
  end if;
  if v_lan.tipo <> 'despesa' or v_lan.status <> 'aberta' then
    return jsonb_build_object('ok', false, 'error', 'O título não está em aberto.');
  end if;
  if round(v_lan.valor * 100) <> round(abs(v_ext.valor) * 100) then
    return jsonb_build_object('ok', false, 'error', 'O valor do título é diferente do débito.');
  end if;

  v_forma := (case
    when v_ext.descricao ilike '%pix%' then 'pix'
    when v_ext.descricao ilike '%tit.compe%' or v_ext.descricao ilike '%boleto%' then 'boleto'
    else 'transferencia'
  end)::forma_pagamento;

  update lancamento_financeiro
     set status = 'paga',
         data_pagamento = v_ext.data,
         forma_pagamento = v_forma,
         atualizado_em = now()
   where id = v_lan.id;

  insert into conciliacao_vinculo (extrato_id, alvo_tipo, alvo_id, valor, origem, criado_por)
  values (v_ext.id, 'lancamento', v_lan.id, abs(v_ext.valor), p_origem, p_perfil_id)
  on conflict (extrato_id, alvo_tipo, alvo_id) do nothing;

  update extrato_bancario
     set status_conciliacao = (case when p_origem = 'auto' then 'auto' else 'manual' end)::status_conciliacao
   where id = v_ext.id;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function _baixar_previsto(uuid, uuid, uuid, origem_conciliacao)
  from public, anon, authenticated;

-- Porta do usuário (tela): exige perfil admin/financeiro.
create or replace function baixar_previsto(p_extrato_id uuid, p_lancamento_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_perfil perfis%rowtype;
begin
  select * into v_perfil from current_perfil();
  if v_perfil.id is null then
    return jsonb_build_object('ok', false, 'error', 'Sessão sem perfil ativo.');
  end if;
  if v_perfil.perfil not in ('admin', 'financeiro') then
    return jsonb_build_object('ok', false, 'error', 'Sem permissão para baixar títulos.');
  end if;
  return _baixar_previsto(p_extrato_id, p_lancamento_id, v_perfil.id, 'manual');
end;
$$;

grant execute on function baixar_previsto(uuid, uuid) to authenticated;

-- Porta do sync (service_role): candidato único, origem 'auto'.
create or replace function baixar_previsto_auto(p_extrato_id uuid, p_lancamento_id uuid)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select _baixar_previsto(p_extrato_id, p_lancamento_id, null, 'auto');
$$;

revoke all on function baixar_previsto_auto(uuid, uuid) from public, anon, authenticated;
grant execute on function baixar_previsto_auto(uuid, uuid) to service_role;
