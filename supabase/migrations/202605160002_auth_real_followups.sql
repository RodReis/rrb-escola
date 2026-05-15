-- Auth real follow-ups (post-review): adiciona policies para bucket biometrias-alunos
-- e policies update/delete para bucket importacoes.

create policy "perfil ativo read biometrias" on storage.objects
  for select to authenticated
  using (bucket_id = 'biometrias-alunos' and exists (select 1 from current_perfil()));

create policy "perfil ativo write biometrias" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'biometrias-alunos' and exists (select 1 from current_perfil()));

create policy "perfil ativo update biometrias" on storage.objects
  for update to authenticated
  using (bucket_id = 'biometrias-alunos' and exists (select 1 from current_perfil()))
  with check (bucket_id = 'biometrias-alunos' and exists (select 1 from current_perfil()));

create policy "perfil ativo delete biometrias" on storage.objects
  for delete to authenticated
  using (bucket_id = 'biometrias-alunos' and exists (select 1 from current_perfil()));

create policy "perfil ativo update importacoes" on storage.objects
  for update to authenticated
  using (bucket_id = 'importacoes' and exists (select 1 from current_perfil()))
  with check (bucket_id = 'importacoes' and exists (select 1 from current_perfil()));

create policy "perfil ativo delete importacoes" on storage.objects
  for delete to authenticated
  using (bucket_id = 'importacoes' and exists (select 1 from current_perfil()));
