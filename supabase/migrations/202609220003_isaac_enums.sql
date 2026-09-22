-- Valores de enum para o repasse isaac.
--
-- Migration própria, separada das tabelas (202609220004), porque o Postgres
-- não aceita usar um valor de enum na mesma transação em que ele foi
-- adicionado: `alter type ... add value` seguido de um `insert`/`check` que
-- referencie o valor novo falha com "unsafe use of new value". Cada migration
-- roda em sua própria transação, então separar resolve.
--
-- Ref: docs/superpowers/specs/2026-09-21-financeiro-isaac-multicnpj-design.md

-- Origem do lançamento no livro-razão. Hoje: 'despesa','venda','contrato',
-- 'evento','cobranca','manual'. Sem 'isaac', a despesa da taxa e a amortização
-- do crédito de curto prazo cairiam em 'manual', indistinguíveis de lançamento
-- digitado à mão.
alter type origem_lancamento add value if not exists 'isaac';

-- Alvo da conciliação bancária. Hoje: 'pagamento','lancamento'. O repasse isaac
-- chega em duas transferências (dia 05 e dia 15) que são casadas uma a uma
-- contra isaac_transferencia, não contra um pagamento individual.
alter type alvo_conciliacao add value if not exists 'repasse_isaac';
