-- O razão passa a gravar a competência da MENSALIDADE, não a do repasse.
--
-- O importador grava pagamentos.data_pagamento = data do repasse e
-- cobrancas.competencia = competência da mensalidade. O trigger usava só a
-- primeira, então o razão só tinha o eixo caixa: dava para perguntar "quanto
-- entrou em agosto", nunca "quanto foi a mensalidade de agosto".
--
-- Efeito medido em 23/09/2026: as 858 cobranças de competência 2026-08
-- apareciam como 845 em 2026-08 e 13 em 2026-09, porque o repasse dessas 13
-- caiu em setembro.
--
-- Os dois eixos passam a coexistir: competencia = mensalidade,
-- data_pagamento = caixa.
--
-- Decisão D6 do spec 2026-09-23-financeiro-debitos-transferencias-design.md.

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
  v_competencia  text;
begin
  select * into v_cobranca from cobrancas where id = new.cobranca_id;

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

  -- Competência da cobrança; cai no mês do pagamento só se a cobrança não
  -- tiver competência (não deveria acontecer: a coluna é NOT NULL).
  v_competencia := coalesce(v_cobranca.competencia, to_char(new.data_pagamento, 'YYYY-MM'));

  if new.cancelado_em is null then
    insert into lancamento_financeiro (
      escola_id, tipo, competencia, descricao, categoria_id, valor,
      data_vencimento, data_pagamento, forma_pagamento, status,
      origem_tipo, origem_id, company_id, contraparte
    ) values (
      new.escola_id, 'receita', v_competencia,
      coalesce(v_cobranca.descricao, 'Mensalidade'), v_categoria_id, new.valor_pago,
      new.data_pagamento, new.data_pagamento, new.forma_pagamento, 'paga',
      'cobranca', new.id, v_cobranca.company_id, v_aluno_nome
    )
    on conflict (origem_tipo, origem_id) where origem_id is not null
    do update set
      valor          = excluded.valor,
      competencia    = excluded.competencia,
      data_pagamento = excluded.data_pagamento,
      forma_pagamento = excluded.forma_pagamento,
      status         = 'paga',
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

-- Backfill da competência. Idempotente.
update lancamento_financeiro l
set competencia = c.competencia
from pagamentos p
join cobrancas c on c.id = p.cobranca_id
where l.origem_tipo = 'cobranca'
  and l.origem_id = p.id
  and l.competencia is distinct from c.competencia;
