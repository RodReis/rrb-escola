-- Extensão para normalizar acento em buscas de nome. Sem ela, "CORTES" nao
-- encontra "CÔRTES" (nenhuma busca de nome no sistema normaliza acento hoje).
create extension if not exists unaccent;

-- unaccent() e STABLE (depende do dictionary em uso), nao IMMUTABLE — colunas
-- geradas exigem IMMUTABLE. Wrapper padrao documentado pelo Postgres para
-- destravar esse uso: https://www.postgresql.org/docs/current/unaccent.html
create or replace function immutable_unaccent(text)
returns text
language sql
immutable
parallel safe
as $$
  select unaccent('unaccent', $1)
$$;

-- Coluna gerada: sempre em sincronia com `nome`, sem trigger manual.
alter table alunos
  add column nome_normalizado text
  generated always as (lower(immutable_unaccent(nome))) stored;

create index idx_alunos_nome_normalizado on alunos (nome_normalizado);
