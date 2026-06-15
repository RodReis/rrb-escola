-- RPC confirmar_venda / cancelar_venda (Fase 1).
-- security definer: permite à secretaria gerar lançamento no razão sem ter acesso
-- direto a lancamento_financeiro (RLS do razão = admin/financeiro só).
-- FASE 1 = SEM ESTOQUE: confirmar só gera a receita e marca confirmada.
-- Fase 2 adiciona o bloco de movimento_estoque via create or replace nesta RPC.

create or replace function confirmar_venda(p_venda_id uuid)
returns uuid                 -- id do lançamento gerado
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venda venda%rowtype;
  v_total numeric(12,2);
  v_lancamento_id uuid;
  v_competencia text;
begin
  select * into v_venda from venda where id = p_venda_id for update;
  if not found then
    raise exception 'Venda % não encontrada', p_venda_id;
  end if;
  if v_venda.status <> 'rascunho' then
    raise exception 'Venda % não está em rascunho (status=%)', p_venda_id, v_venda.status;
  end if;

  -- total = Σ subtotal − desconto
  select coalesce(sum(subtotal), 0) into v_total
  from venda_item where venda_id = p_venda_id;
  v_total := v_total - coalesce(v_venda.desconto, 0);
  if v_total <= 0 then
    raise exception 'Total da venda deve ser positivo (total=%)', v_total;
  end if;

  v_competencia := to_char(v_venda.data_venda, 'YYYY-MM');

  -- idempotência: se já existe lançamento desta venda, não recria
  select id into v_lancamento_id
  from lancamento_financeiro
  where origem_tipo = 'venda' and origem_id = p_venda_id
  limit 1;

  if v_lancamento_id is null then
    insert into lancamento_financeiro (
      escola_id, tipo, competencia, descricao, valor,
      data_vencimento, data_pagamento, forma_pagamento, status,
      contraparte, origem_tipo, origem_id, evento_id, criado_por
    ) values (
      v_venda.escola_id, 'receita', v_competencia,
      'Venda #' || left(p_venda_id::text, 8),
      v_total, v_venda.data_venda, v_venda.data_venda, v_venda.forma_pagamento, 'paga',
      coalesce(v_venda.cliente_nome, (select nome from alunos where id = v_venda.aluno_id)),
      'venda', p_venda_id, v_venda.evento_id, v_venda.criado_por
    )
    returning id into v_lancamento_id;
  end if;

  update venda set status = 'confirmada' where id = p_venda_id;
  return v_lancamento_id;
end;
$$;

create or replace function cancelar_venda(p_venda_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status status_venda;
begin
  select status into v_status from venda where id = p_venda_id for update;
  if not found then
    raise exception 'Venda % não encontrada', p_venda_id;
  end if;
  if v_status = 'cancelada' then
    return; -- idempotente
  end if;

  -- marca lançamentos da venda como cancelada (não deleta histórico)
  update lancamento_financeiro
  set status = 'cancelada'
  where origem_tipo = 'venda' and origem_id = p_venda_id and status <> 'cancelada';

  update venda set status = 'cancelada' where id = p_venda_id;
  -- Fase 2: estorno de estoque (movimento entrada) entra aqui via create or replace.
end;
$$;

grant execute on function confirmar_venda(uuid) to authenticated;
grant execute on function cancelar_venda(uuid) to authenticated;
