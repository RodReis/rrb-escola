-- Capacidade padrão da escola: 25 alunos por sala
-- Atualiza default da coluna + todas turmas existentes

alter table turmas
  alter column capacidade set default 25;

update turmas
  set capacidade = 25
  where capacidade <> 25;
