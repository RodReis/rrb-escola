-- Teste do trigger espelhar_pagamento_cobranca_razao.
--
-- Roda contra o Supabase LOCAL espelhado de produção:
--   bash scripts/sync_local_from_prod.sh
--
-- Uso:
--   docker exec -i supabase_db_rrb-escola psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 -f - < scripts/tests/trigger_razao_cobranca.test.sql
--
-- Tudo roda em transação com rollback: não altera o banco.

begin;

do $$
declare
  v_pagamento_id uuid;
  v_cobranca_id  uuid;
  v_company_id   uuid;
  v_categoria_id uuid;
  v_aluno_nome   text;
  v_lanc         lancamento_financeiro%rowtype;
begin
  -- Cobrança isaac real, com empresa e categoria preenchidas e pagamento ativo.
  select c.id, c.company_id, c.categoria_id into v_cobranca_id, v_company_id, v_categoria_id
  from cobrancas c
  join pagamentos p on p.cobranca_id = c.id
  where c.origem = 'isaac'
    and c.company_id is not null
    and c.categoria_id is not null
    and p.cancelado_em is null
  limit 1;

  if v_cobranca_id is null then
    raise exception 'FIXTURE AUSENTE: nenhuma cobranca isaac com company_id/categoria_id e pagamento ativo no banco local. Rode: bash scripts/sync_local_from_prod.sh';
  end if;

  select p.id into v_pagamento_id
  from pagamentos p
  where p.cobranca_id = v_cobranca_id
    and p.cancelado_em is null
  limit 1;

  if v_pagamento_id is null then
    raise exception 'FIXTURE AUSENTE: nenhum pagamento ativo encontrado para a cobranca';
  end if;

  select nome into v_aluno_nome from alunos where id = (select aluno_id from cobrancas where id = v_cobranca_id);

  -- Dispara o trigger sem alterar valor: "after update of valor_pago" dispara
  -- pela coluna citada no SET, mesmo que o valor seja idêntico.
  update pagamentos set valor_pago = valor_pago where id = v_pagamento_id;

  select * into v_lanc
  from lancamento_financeiro
  where origem_tipo = 'cobranca' and origem_id = v_pagamento_id;

  if v_lanc.id is null then
    raise exception 'FALHOU: pagamento % nao gerou lancamento no razao', v_pagamento_id;
  end if;

  if v_lanc.company_id is distinct from v_company_id then
    raise exception 'FALHOU company_id: lancamento=% cobranca=%',
      v_lanc.company_id, v_company_id;
  end if;

  if v_lanc.categoria_id is distinct from v_categoria_id then
    raise exception 'FALHOU categoria_id: lancamento=% cobranca=%',
      v_lanc.categoria_id, v_categoria_id;
  end if;

  if v_lanc.contraparte is distinct from v_aluno_nome then
    raise exception 'FALHOU contraparte: lancamento=% aluno=%',
      v_lanc.contraparte, v_aluno_nome;
  end if;

  raise notice 'OK: o trigger propaga company_id, categoria_id e contraparte';
end $$;

rollback;
