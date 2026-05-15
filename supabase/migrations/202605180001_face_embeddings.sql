-- Portaria facial sub-spec 1: pgvector + embedding column + match function.

create extension if not exists vector;

alter table biometrias_aluno
  add column if not exists embedding vector(128),
  add column if not exists score_qualidade numeric(5,3);

create index if not exists biometrias_aluno_embedding_idx
  on biometrias_aluno using ivfflat (embedding vector_l2_ops)
  with (lists = 100)
  where ativo = true and embedding is not null;

alter table consentimentos_biometria
  add column if not exists termo_documento_id uuid references documentos_aluno(id) on delete set null;

create or replace function match_biometria(
  p_embedding vector(128),
  p_threshold numeric default 0.6,
  p_escola_id uuid default null
)
returns table (
  biometria_id uuid,
  aluno_id uuid,
  matricula_codigo text,
  nome text,
  distancia float,
  confianca numeric
) as $$
  select
    b.id as biometria_id,
    b.aluno_id,
    a.matricula_codigo,
    a.nome,
    (b.embedding <-> p_embedding)::float as distancia,
    round((1 - (b.embedding <-> p_embedding) / 2)::numeric * 100, 2) as confianca
  from biometrias_aluno b
  join alunos a on a.id = b.aluno_id
  join consentimentos_biometria c on c.aluno_id = b.aluno_id
  where b.ativo = true
    and b.embedding is not null
    and a.ativo = true
    and c.autorizado = true
    and (p_escola_id is null or a.escola_id = p_escola_id)
    and (b.embedding <-> p_embedding) < p_threshold
  order by b.embedding <-> p_embedding asc
  limit 1;
$$ language sql stable security definer set search_path = public, extensions;

grant execute on function match_biometria(vector, numeric, uuid) to authenticated, service_role;

-- Re-enrollment fix: previous active is set to ativo=false but stays in the table.
-- The (aluno_id, modelo) unique constraint from 202605140003 prevents re-insert.
alter table biometrias_aluno
  drop constraint if exists biometrias_aluno_aluno_id_modelo_key;
