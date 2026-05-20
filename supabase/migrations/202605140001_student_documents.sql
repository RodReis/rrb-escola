create table if not exists documentos_aluno (
  id uuid primary key default gen_random_uuid(),
  aluno_id uuid not null references alunos(id) on delete cascade,
  nome_arquivo text not null,
  tipo_documento text not null,
  storage_path text not null,
  content_type text,
  tamanho_bytes bigint,
  created_at timestamptz not null default now()
);

create index if not exists documentos_aluno_aluno_idx on documentos_aluno (aluno_id, created_at desc);

alter table documentos_aluno enable row level security;

drop policy if exists "service role full access documentos aluno" on documentos_aluno;
create policy "service role full access documentos aluno"
on documentos_aluno for all to service_role using (true) with check (true);
