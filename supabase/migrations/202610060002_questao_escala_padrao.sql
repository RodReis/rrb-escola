-- Escala padrão da questão "Com Escala" (ajuste da spec 2026-10-06): o cadastro da questão
-- escolhe a escala; ao adicionar a questão ao questionário ela vem preenchida (e ainda pode
-- ser trocada por questionário, em questionario_questoes.escala_id).
-- Nullable: questões já cadastradas ficam sem escala padrão até serem editadas.

alter table public.questoes
  add column if not exists escala_id uuid references escalas(id) on delete restrict;

create index if not exists questoes_escala_idx on questoes (escala_id);
