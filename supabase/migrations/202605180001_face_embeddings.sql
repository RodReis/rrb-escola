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
