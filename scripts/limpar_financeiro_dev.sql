-- Fase A2 — limpeza dos dados financeiros gerados para desenvolvimento.
--
-- Contexto: as cobranças de 2026 foram geradas a partir do plano da matrícula
-- (scripts/gerar_cobrancas_2026.js) e baixadas em bloco como se o isaac tivesse
-- repassado o valor cheio (scripts/registrar_repasse_isaac.js). Nada disso
-- corresponde a dinheiro real: a receita fica bruta (sem a taxa de 7,3%), a
-- inadimplência fica sempre zero e material cai na categoria de mensalidade.
-- A Fase B reimporta os meses a partir dos analíticos do isaac.
--
-- Ref: docs/superpowers/specs/2026-09-21-financeiro-isaac-multicnpj-design.md
--
-- NÃO É MIGRATION. Roda à mão, local primeiro, produção depois, sempre após
-- backup (scripts/backup_matriculas.mjs + dump das tabelas tocadas).
--
-- NÃO TOCA: alunos, matriculas, planos, responsaveis_aluno, folha,
-- contas_bancarias, extrato_bancario, nem lancamento_financeiro de origem
-- diferente de 'cobranca'.
--
-- Ensaio: trocar o commit final por rollback e conferir o select.

begin;

-- Ordem importa: as três primeiras tabelas referenciam cobranças/pagamentos por
-- uuid solto, sem FK, então o cascade de `cobrancas` não as alcança.

-- 1) Lançamentos do razão espelhados de pagamentos.
--    O trigger espelhar_pagamento_cobranca_razao grava origem_id = pagamento.id.
delete from lancamento_financeiro
where origem_tipo = 'cobranca';

-- 2) Vínculos de conciliação que apontam para pagamentos que vão sumir.
--    alvo_id é uuid sem FK; sem isto sobra vínculo órfão apontando para nada.
delete from conciliacao_vinculo
where alvo_tipo = 'pagamento'
  and alvo_id in (select id from pagamentos);

-- 3) Pix de cobrança ligados a cobranças (origem_id também é uuid sem FK).
delete from pix_cobranca
where origem_tipo = 'cobranca'
  and origem_id in (select id from cobrancas);

-- 4) Cobranças. O cascade de pagamentos.cobranca_id leva os pagamentos junto.
--    Sem filtro de escola: a base é mono-escola e um escola_id hardcoded
--    silenciosamente não apagaria nada se o id divergisse entre ambientes.
delete from cobrancas;

-- Conferência antes do commit: as três primeiras têm que zerar, as duas
-- últimas têm que bater com a contagem de antes da execução.
select (select count(*) from cobrancas)             as cobrancas,
       (select count(*) from pagamentos)            as pagamentos,
       (select count(*) from lancamento_financeiro
         where origem_tipo = 'cobranca')            as razao_cobranca,
       (select count(*) from alunos)                as alunos,
       (select count(*) from matriculas)            as matriculas;

commit;  -- ensaio: trocar por rollback
