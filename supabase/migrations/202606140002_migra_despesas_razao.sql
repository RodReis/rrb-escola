-- Migração de dados: despesas -> livro-razão (Fase 0).
-- Idempotente: pode rodar 2x sem duplicar (guards on conflict / not exists).
-- Não dropa despesas/categorias_despesa (rollback seguro até validação).

-- 1) Categorias: categorias_despesa -> categorias_financeiras (tipo='despesa')
insert into categorias_financeiras (escola_id, nome, tipo, ativo, criado_em)
select cd.escola_id, cd.nome, 'despesa'::tipo_lancamento, cd.ativo, cd.criado_em
from categorias_despesa cd
on conflict (escola_id, nome, tipo) do nothing;

-- 2) Despesas -> lancamento_financeiro.
-- Guard: só insere o que ainda não foi migrado (origem_tipo='despesa', origem_id=despesas.id).
-- categoria_id antigo é remapeado para a categoria financeira de mesmo nome/escola.
-- forma_pagamento: cast via texto (enum antigo forma_pagamento_despesa -> forma_pagamento).
-- despesas.tipo (fixa|variavel) -> classe_despesa.
insert into lancamento_financeiro (
  escola_id, tipo, classe_despesa, competencia, descricao, categoria_id,
  contraparte, valor, data_vencimento, data_pagamento, forma_pagamento,
  status, origem_tipo, origem_id, folha_run_id, comprovante_path,
  criado_por, criado_em
)
select
  d.escola_id,
  'despesa'::tipo_lancamento,
  d.tipo::text,                                   -- 'fixa' | 'variavel'
  d.competencia,
  d.descricao,
  cf.id,                                          -- categoria financeira remapeada
  d.fornecedor,                                   -- contraparte = fornecedor (despesa)
  d.valor,
  d.data_vencimento,
  d.data_pagamento,
  d.forma_pagamento::text::forma_pagamento,       -- cast explícito de enum
  d.status::text::status_lancamento,
  'despesa'::origem_lancamento,
  d.id,
  d.folha_run_id,
  d.comprovante_path,
  d.criado_por,
  d.criado_em
from despesas d
left join categorias_despesa cd on cd.id = d.categoria_id
left join categorias_financeiras cf
  on cf.escola_id = d.escola_id and cf.nome = cd.nome and cf.tipo = 'despesa'
where not exists (
  select 1 from lancamento_financeiro lf
  where lf.origem_tipo = 'despesa' and lf.origem_id = d.id
);
