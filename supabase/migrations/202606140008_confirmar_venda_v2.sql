-- confirmar_venda / cancelar_venda v2 (Fase 2): agora com estoque.
-- confirmar: além da receita, cria movimento de saída por item cujo produto
-- controla_estoque=true. Venda a descoberto BLOQUEADA (trigger fn_movimento_estoque_guard
-- impede saldo < 0; aqui também checamos antes para mensagem clara).
-- cancelar: estorna o estoque com movimentos de entrada (não deleta histórico).

create or replace function confirmar_venda(p_venda_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venda venda%rowtype;
  v_total numeric(12,2);
  v_lancamento_id uuid;
  v_competencia text;
  v_item record;
  v_saldo integer;
begin
  select * into v_venda from venda where id = p_venda_id for update;
  if not found then
    raise exception 'Venda % não encontrada', p_venda_id;
  end if;
  if v_venda.status <> 'rascunho' then
    raise exception 'Venda % não está em rascunho (status=%)', p_venda_id, v_venda.status;
  end if;

  -- 1) Validação de saldo para itens com controle de estoque (descoberto bloqueado).
  for v_item in
    select vi.variacao_id, vi.quantidade
    from venda_item vi
    join produto_variacao pv on pv.id = vi.variacao_id
    join produto p on p.id = pv.produto_id
    where vi.venda_id = p_venda_id and p.controla_estoque = true
  loop
    select coalesce(sum(quantidade * sentido), 0) into v_saldo
    from movimento_estoque where variacao_id = v_item.variacao_id;
    if v_saldo < v_item.quantidade then
      raise exception 'Saldo insuficiente para a variação % (saldo=%, pedido=%)',
        v_item.variacao_id, v_saldo, v_item.quantidade;
    end if;
  end loop;

  -- 2) Total = Σ subtotal − desconto
  select coalesce(sum(subtotal), 0) into v_total from venda_item where venda_id = p_venda_id;
  v_total := v_total - coalesce(v_venda.desconto, 0);
  if v_total <= 0 then
    raise exception 'Total da venda deve ser positivo (total=%)', v_total;
  end if;

  v_competencia := to_char(v_venda.data_venda, 'YYYY-MM');

  -- 3) Receita no razão (idempotente)
  select id into v_lancamento_id
  from lancamento_financeiro
  where origem_tipo = 'venda' and origem_id = p_venda_id limit 1;

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
    ) returning id into v_lancamento_id;
  end if;

  -- 4) Saída de estoque por item com controle (idempotente: só se ainda não houve saída desta venda)
  if not exists (
    select 1 from movimento_estoque
    where origem_tipo = 'venda' and origem_id = p_venda_id and tipo = 'saida'
  ) then
    insert into movimento_estoque (escola_id, variacao_id, tipo, quantidade, sentido, data, origem_tipo, origem_id, criado_por)
    select v_venda.escola_id, vi.variacao_id, 'saida', vi.quantidade, -1, v_venda.data_venda, 'venda', p_venda_id, v_venda.criado_por
    from venda_item vi
    join produto_variacao pv on pv.id = vi.variacao_id
    join produto p on p.id = pv.produto_id
    where vi.venda_id = p_venda_id and p.controla_estoque = true;
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
  v_escola uuid;
begin
  select status, escola_id into v_status, v_escola from venda where id = p_venda_id for update;
  if not found then
    raise exception 'Venda % não encontrada', p_venda_id;
  end if;
  if v_status = 'cancelada' then
    return;
  end if;

  -- estorna estoque: para cada saída desta venda, cria entrada equivalente
  -- (só se ainda não estornado).
  if not exists (
    select 1 from movimento_estoque
    where origem_tipo = 'venda' and origem_id = p_venda_id and tipo = 'entrada'
  ) then
    insert into movimento_estoque (escola_id, variacao_id, tipo, quantidade, sentido, origem_tipo, origem_id, observacao)
    select v_escola, m.variacao_id, 'entrada', m.quantidade, 1, 'venda', p_venda_id, 'Estorno de cancelamento'
    from movimento_estoque m
    where m.origem_tipo = 'venda' and m.origem_id = p_venda_id and m.tipo = 'saida';
  end if;

  update lancamento_financeiro
  set status = 'cancelada'
  where origem_tipo = 'venda' and origem_id = p_venda_id and status <> 'cancelada';

  update venda set status = 'cancelada' where id = p_venda_id;
end;
$$;

grant execute on function confirmar_venda(uuid) to authenticated;
grant execute on function cancelar_venda(uuid) to authenticated;
