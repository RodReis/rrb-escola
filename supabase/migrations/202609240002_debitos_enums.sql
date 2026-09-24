-- Schema da classificação de débitos.
--
-- Decisões fechadas em 24/09 (ver spec, D1 a D7):
--  D1 a regra SUGERE, não lança — por isso não há coluna de "aplicar automático";
--  D3 competência do débito = mês do pagamento, editável;
--  D4 a empresa do lançamento pode diferir da dona da conta, com aviso na tela.
--
-- Ref: docs/superpowers/specs/2026-09-23-financeiro-debitos-transferencias-design.md

alter type origem_lancamento add value if not exists 'extrato';
alter type alvo_conciliacao  add value if not exists 'transferencia_interna';
