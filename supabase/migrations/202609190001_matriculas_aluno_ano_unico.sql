-- Um aluno tem no maximo uma matricula por ano letivo.
--
-- A ausencia dessa trava permitiu que a linha deslocada convivesse com a do ano
-- correto: o importador do sistema antigo derivou ano_letivo de
-- year(data_matricula), mas a escola matricula de set-dez PARA o ano seguinte,
-- entao parte do historico ficou um ano atras e duplicou a serie do aluno.
--
-- Verificado antes de criar: 0 pares (escola_id, aluno_id, ano_letivo)
-- duplicados no banco local e 0 em producao.

ALTER TABLE matriculas
  ADD CONSTRAINT matriculas_aluno_ano_unico
  UNIQUE (escola_id, aluno_id, ano_letivo);
