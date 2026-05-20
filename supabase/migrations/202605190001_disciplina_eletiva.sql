-- Ficha aluno sub-spec 1: adiciona campo disciplina_eletiva (presente no PDF modelo).
alter table alunos
  add column if not exists disciplina_eletiva text;
