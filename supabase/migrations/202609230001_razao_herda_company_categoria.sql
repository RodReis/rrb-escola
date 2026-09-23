-- O razão passa a herdar empresa, categoria e contraparte da cobrança.
--
-- A função original é de 202609110001, escrita ANTES do importador isaac
-- (202609220004/5). Ela lia só a descrição da cobrança e resolvia o resto
-- sozinha, o que em 2026-09 produzia três erros silenciosos:
--
--   1. forçava a categoria 'Mensalidades', ignorando cobrancas.categoria_id —
--      então material didático, que o importador classifica por segmento,
--      aparecia no razão como mensalidade;
--   2. nunca copiava cobrancas.company_id — o filtro por empresa no
--      livro-razão não encontrava nada, apesar de a cobrança ter o CNPJ certo;
--   3. nunca preenchia contraparte — o razão não dizia de quem era a receita.
--
-- Nenhum dos três dava erro: o número só saía errado.
--
-- A competência continua vindo de data_pagamento (eixo caixa). Mudar isso é a
-- decisão D6 do spec e tem migration própria, porque altera todo agrupamento
-- histórico por competência.
--
-- Ref: docs/superpowers/specs/2026-09-23-financeiro-debitos-transferencias-design.md (P0)

create or replace function espelhar_pagamento_cobranca_razao()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cobranca     cobrancas%rowtype;
  v_categoria_id uuid;
  v_aluno_nome   text;
begin
  select * into v_cobranca from cobrancas where id = new.cobranca_id;

  -- A categoria da cobrança manda. O fallback 'Mensalidades' cobre a cobrança
  -- antiga ou manual, criada antes de categoria_id existir.
  v_categoria_id := v_cobranca.categoria_id;

  if v_categoria_id is null then
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
  end if;

  select nome into v_aluno_nome from alunos where id = v_cobranca.aluno_id;

  if new.cancelado_em is null then
    insert into lancamento_financeiro (
      escola_id, tipo, competencia, descricao, categoria_id, valor,
      data_vencimento, data_pagamento, forma_pagamento, status,
      origem_tipo, origem_id, company_id, contraparte
    ) values (
      new.escola_id, 'receita', to_char(new.data_pagamento, 'YYYY-MM'),
      coalesce(v_cobranca.descricao, 'Mensalidade'), v_categoria_id, new.valor_pago,
      new.data_pagamento, new.data_pagamento, new.forma_pagamento, 'paga',
      'cobranca', new.id, v_cobranca.company_id, v_aluno_nome
    )
    on conflict (origem_tipo, origem_id) where origem_id is not null
    do update set
      valor          = excluded.valor,
      data_pagamento = excluded.data_pagamento,
      forma_pagamento = excluded.forma_pagamento,
      status         = 'paga',
      -- Sem estas três, um reimport continuaria deixando o lançamento antigo
      -- incompleto: o insert cai no conflito e o do update é quem vale.
      company_id     = excluded.company_id,
      categoria_id   = excluded.categoria_id,
      contraparte    = excluded.contraparte;
  else
    update lancamento_financeiro
    set status = 'cancelada'
    where origem_tipo = 'cobranca' and origem_id = new.id;
  end if;

  return new;
end;
$$;

-- Backfill dos lançamentos já espelhados. Idempotente: o where só pega o que
-- está diferente, então rodar de novo não faz nada.
update lancamento_financeiro l
set company_id   = c.company_id,
    categoria_id = coalesce(c.categoria_id, l.categoria_id),
    contraparte  = a.nome
from pagamentos p
join cobrancas c on c.id = p.cobranca_id
join alunos a    on a.id = c.aluno_id
where l.origem_tipo = 'cobranca'
  and l.origem_id = p.id
  and (
        l.company_id  is distinct from c.company_id
     or l.contraparte is distinct from a.nome
     or (c.categoria_id is not null and l.categoria_id is distinct from c.categoria_id)
  );
