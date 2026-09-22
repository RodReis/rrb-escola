-- FILHO_PROFESSORA também desconta 50% na mensalidade (mesma regra de cobrança
-- de BOLSA_50_PORCENTO); o tipo separado serve só para identificar filhos de
-- professora/funcionária nos relatórios. FILHO_PROFESSORA_INTEGRAL continua
-- isento de cobrança (tratado junto com BOLSA_INTEGRAL/PERMUTA/ISENTO no código).

alter table matriculas drop constraint matriculas_bolsa_50_check;

update matriculas set percentual_bolsa = 50 where tipo_vaga = 'FILHO_PROFESSORA';

alter table matriculas
  add constraint matriculas_bolsa_50_check
  check (
    (tipo_vaga in ('BOLSA_50_PORCENTO', 'FILHO_PROFESSORA') and percentual_bolsa = 50)
    or (tipo_vaga not in ('BOLSA_50_PORCENTO', 'FILHO_PROFESSORA') and percentual_bolsa = 0)
  );
