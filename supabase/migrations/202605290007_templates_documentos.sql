-- templates_documentos: parametrizáveis pela secretária
create table if not exists public.templates_documentos (
  id            uuid primary key default gen_random_uuid(),
  escola_id     uuid not null references public.escolas(id) on delete cascade,
  nome          text not null check (char_length(nome) >= 3),
  categoria     text not null check (categoria in ('declaracao','termo','contrato','outro')),
  storage_path  text not null,
  ativo         boolean not null default true,
  gerado_count  integer not null default 0,
  mappings      jsonb not null default '[]'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists templates_documentos_escola_ativo_idx
  on public.templates_documentos (escola_id, ativo);
create index if not exists templates_documentos_escola_ranking_idx
  on public.templates_documentos (escola_id, gerado_count desc);

alter table public.templates_documentos enable row level security;

create policy "templates_select_own_escola"
  on public.templates_documentos for select
  using (escola_id = (select escola_id from public.perfis where user_id = auth.uid()));

create policy "templates_insert_own_escola"
  on public.templates_documentos for insert
  with check (escola_id = (select escola_id from public.perfis where user_id = auth.uid()));

create policy "templates_update_own_escola"
  on public.templates_documentos for update
  using (escola_id = (select escola_id from public.perfis where user_id = auth.uid()));

create policy "templates_delete_own_escola"
  on public.templates_documentos for delete
  using (escola_id = (select escola_id from public.perfis where user_id = auth.uid()));

-- bucket privado para os arquivos .docx dos templates
insert into storage.buckets (id, name, public)
values ('templates-documentos', 'templates-documentos', false)
on conflict (id) do nothing;

-- policies do bucket: acesso restrito à escola do usuário (path = "<escola_id>/...")
create policy "templates_storage_select_own_escola"
  on storage.objects for select
  using (
    bucket_id = 'templates-documentos'
    and (storage.foldername(name))[1] = (
      select escola_id::text from public.perfis where user_id = auth.uid()
    )
  );

create policy "templates_storage_insert_own_escola"
  on storage.objects for insert
  with check (
    bucket_id = 'templates-documentos'
    and (storage.foldername(name))[1] = (
      select escola_id::text from public.perfis where user_id = auth.uid()
    )
  );

create policy "templates_storage_update_own_escola"
  on storage.objects for update
  using (
    bucket_id = 'templates-documentos'
    and (storage.foldername(name))[1] = (
      select escola_id::text from public.perfis where user_id = auth.uid()
    )
  );

create policy "templates_storage_delete_own_escola"
  on storage.objects for delete
  using (
    bucket_id = 'templates-documentos'
    and (storage.foldername(name))[1] = (
      select escola_id::text from public.perfis where user_id = auth.uid()
    )
  );
