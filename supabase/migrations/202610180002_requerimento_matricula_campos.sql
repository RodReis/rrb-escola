alter table public.alunos
  add column if not exists religiao text;

alter table public.responsaveis_aluno
  add column if not exists data_nascimento date,
  add column if not exists estado_civil text,
  add column if not exists escolaridade text,
  add column if not exists profissao text,
  add column if not exists endereco_trabalho text,
  add column if not exists telefone_trabalho text,
  add column if not exists cnpj text;
