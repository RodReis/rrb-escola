-- Adiciona RG aos responsáveis do aluno para geração de contratos
ALTER TABLE responsaveis_aluno ADD COLUMN IF NOT EXISTS rg text;
