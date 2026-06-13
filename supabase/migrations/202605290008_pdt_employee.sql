-- professor_disciplina_turma: troca perfil_id (perfis) por employee_id (employees)
-- Motivo: professores são cadastrados via /rh/funcionarios (tabela employees com
-- school_category fund1|fund2|medio), não via /usuarios (perfis).
-- Zero atribuições existentes — sem migração de dados.

alter table professor_disciplina_turma
  drop constraint if exists professor_disciplina_turma_perfil_id_fkey;

alter table professor_disciplina_turma
  drop constraint if exists professor_disciplina_turma_escola_id_perfil_id_disciplina_id__key;

alter table professor_disciplina_turma
  drop column if exists perfil_id;

alter table professor_disciplina_turma
  add column employee_id uuid not null references employees(id) on delete cascade;

alter table professor_disciplina_turma
  add constraint professor_disciplina_turma_unique
  unique (escola_id, employee_id, disciplina_id, turma_id);

create index if not exists pdt_employee_idx on professor_disciplina_turma (employee_id);
