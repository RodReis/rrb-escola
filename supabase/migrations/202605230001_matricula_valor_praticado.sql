-- Permite valor mensal específico por matrícula, sobrepondo planos.valor_mensalidade.
-- Usado quando a planilha de matriculados traz valor cobrado individualizado por aluno
-- (descontos, bolsas implícitas, valores históricos diferentes do plano).

alter table matriculas
  add column valor_mensalidade_praticado numeric(12,2);

comment on column matriculas.valor_mensalidade_praticado is
  'Valor mensal cobrado deste aluno. Quando null, usa planos.valor_mensalidade.';
