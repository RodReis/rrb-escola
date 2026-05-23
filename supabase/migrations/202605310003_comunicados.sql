-- Comunicados aos pais: tabela comunicados + extensão de mensagens_whatsapp + bucket + RBAC

-- 1) Coluna de imagem em mensagens_whatsapp (Frente 3)
alter table mensagens_whatsapp add column if not exists imagem_url text;

-- 2) Enums
do $$ begin
  create type alcance_comunicado as enum ('geral', 'individual');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type status_comunicado as enum ('processando', 'concluido');
exception when duplicate_object then null;
end $$;

-- 3) Tabela comunicados
create table comunicados (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references escolas(id) on delete cascade,
  titulo text not null,
  mensagem text not null,
  imagem_path text,
  alcance alcance_comunicado not null,
  aluno_id uuid references alunos(id) on delete set null,
  status status_comunicado not null default 'processando',
  total_destinatarios integer not null default 0,
  total_enviados integer not null default 0,
  total_falhas integer not null default 0,
  criado_por uuid references perfis(id) on delete set null,
  created_at timestamptz not null default now(),
  concluido_em timestamptz
);

create index comunicados_escola_idx on comunicados (escola_id);
create index comunicados_status_idx on comunicados (status);

alter table comunicados enable row level security;

create policy "comunicados service" on comunicados for all to service_role
  using (true) with check (true);

create policy "comunicados escola" on comunicados for all to authenticated
  using (escola_id = (select escola_id from current_perfil()))
  with check (escola_id = (select escola_id from current_perfil()));

-- 4) Bucket de Storage para imagens de comunicados (privado)
insert into storage.buckets (id, name, public)
values ('comunicados', 'comunicados', false)
on conflict (id) do nothing;

create policy "comunicados bucket read" on storage.objects for select to authenticated
  using (bucket_id = 'comunicados' and exists (select 1 from current_perfil()));

create policy "comunicados bucket write" on storage.objects for insert to authenticated
  with check (bucket_id = 'comunicados' and exists (select 1 from current_perfil()));

create policy "comunicados bucket delete" on storage.objects for delete to authenticated
  using (bucket_id = 'comunicados' and exists (select 1 from current_perfil()));

-- 5) Seed RBAC: módulo comunicados no grupo rh
insert into modulos (codigo, grupo, nome, ordem) values
  ('comunicados', 'rh', 'Comunicados', 34);

insert into role_permissoes (role_codigo, modulo_codigo, pode_ler, pode_criar, pode_editar, pode_deletar)
  values ('admin', 'comunicados', true, true, true, true);
