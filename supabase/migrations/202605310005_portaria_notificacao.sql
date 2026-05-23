-- Notificação de portaria: bucket de fotos capturadas + remoção da tabela antiga.

-- 1) Bucket privado para fotos capturadas na portaria
insert into storage.buckets (id, name, public)
values ('portaria-eventos', 'portaria-eventos', false)
on conflict (id) do nothing;

create policy "portaria eventos read" on storage.objects for select to authenticated
  using (bucket_id = 'portaria-eventos' and exists (select 1 from current_perfil()));

create policy "portaria eventos service" on storage.objects for all to service_role
  using (bucket_id = 'portaria-eventos') with check (bucket_id = 'portaria-eventos');

-- 2) Remove a tabela antiga de notificações (substituída por mensagens_whatsapp).
--    Tabela está vazia em produção — drop seguro.
drop table if exists notificacoes_responsavel;
