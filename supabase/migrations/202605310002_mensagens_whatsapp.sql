-- Camada de mensageria WhatsApp: log de cada envio.

do $$ begin
  create type status_mensagem_whatsapp as enum ('pendente', 'enviada', 'falha');
exception when duplicate_object then null;
end $$;

create table mensagens_whatsapp (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references escolas(id) on delete cascade,
  telefone text not null,
  mensagem text not null,
  status status_mensagem_whatsapp not null default 'pendente',
  erro text,
  provider_message_id text,
  aluno_id uuid references alunos(id) on delete set null,
  referencia_tipo text,
  referencia_id uuid,
  created_at timestamptz not null default now(),
  enviada_em timestamptz
);

create index mensagens_whatsapp_escola_idx on mensagens_whatsapp (escola_id);
create index mensagens_whatsapp_status_idx on mensagens_whatsapp (status);
create index mensagens_whatsapp_aluno_idx on mensagens_whatsapp (aluno_id);

alter table mensagens_whatsapp enable row level security;

create policy "mensagens whatsapp service" on mensagens_whatsapp for all to service_role
  using (true) with check (true);

create policy "mensagens whatsapp escola" on mensagens_whatsapp for all to authenticated
  using (escola_id = (select escola_id from current_perfil()))
  with check (escola_id = (select escola_id from current_perfil()));
