-- Avatar do perfil + bucket para logos da escola e fotos de perfis

alter table perfis add column if not exists foto_url text;
comment on column perfis.foto_url is 'Path no storage perfis-fotos OU URL externa';

-- Bucket: fotos de perfis dos usuarios
insert into storage.buckets (id, name, public)
values ('perfis-fotos', 'perfis-fotos', true)
on conflict (id) do nothing;

-- Bucket: logos das escolas
insert into storage.buckets (id, name, public)
values ('escola-logos', 'escola-logos', true)
on conflict (id) do nothing;

-- Policies publicas para leitura (buckets sao public)
do $$ begin
  create policy "perfis-fotos read" on storage.objects for select
    using (bucket_id = 'perfis-fotos');
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "perfis-fotos write" on storage.objects for all
    to authenticated
    using (bucket_id = 'perfis-fotos')
    with check (bucket_id = 'perfis-fotos');
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "escola-logos read" on storage.objects for select
    using (bucket_id = 'escola-logos');
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "escola-logos write" on storage.objects for all
    to authenticated
    using (bucket_id = 'escola-logos')
    with check (bucket_id = 'escola-logos');
exception when duplicate_object then null;
end $$;
