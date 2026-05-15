create table if not exists biometrias_aluno (
  id uuid primary key default gen_random_uuid(),
  aluno_id uuid not null references alunos(id) on delete cascade,
  modelo text not null,
  embedding_hash text,
  embedding_encrypted text,
  foto_referencia_path text,
  ativo boolean not null default true,
  criado_por text not null default 'sistema',
  data_cadastro timestamptz not null default now(),
  data_revogacao timestamptz,
  observacao text,
  unique (aluno_id, modelo)
);

create index if not exists biometrias_aluno_aluno_idx on biometrias_aluno (aluno_id, ativo);

alter table biometrias_aluno enable row level security;

drop policy if exists "service role full access biometrias aluno" on biometrias_aluno;
create policy "service role full access biometrias aluno"
on biometrias_aluno for all to service_role using (true) with check (true);

insert into storage.buckets (id, name, public)
values ('biometrias-alunos', 'biometrias-alunos', false)
on conflict (id) do nothing;
