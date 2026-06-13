-- Migração: novo fluxo de status da folha (iniciada → em_andamento → revisao → aprovacao → aprovado)
-- Remove: rascunho, em_revisao, aprovada, paga, fechada
-- Adiciona: iniciada, em_andamento, revisao, aprovacao, aprovado

-- 1. Remover a restrição antiga PRIMEIRO (para que o UPDATE não seja bloqueado)
ALTER TABLE folha_runs DROP CONSTRAINT folha_runs_status_check;

-- 2. Alterar o default para o novo status inicial
ALTER TABLE folha_runs ALTER COLUMN status SET DEFAULT 'iniciada';

-- 3. Migrar dados existentes
UPDATE folha_runs
SET status = CASE status
  WHEN 'rascunho'   THEN 'iniciada'
  WHEN 'em_revisao' THEN 'em_andamento'
  WHEN 'aprovada'   THEN 'aprovado'
  WHEN 'paga'       THEN 'aprovado'
  WHEN 'fechada'    THEN 'aprovado'
  ELSE status
END;

-- 4. Adicionar a nova restrição de status
ALTER TABLE folha_runs ADD CONSTRAINT folha_runs_status_check
  CHECK (status = ANY (ARRAY['iniciada'::text, 'em_andamento'::text, 'revisao'::text, 'aprovacao'::text, 'aprovado'::text]));
