-- WhatsApp Inbox (Fase 6): conversa bidirecional + RBAC.
-- Depende: escolas, pipeline_lead, alunos, responsaveis_aluno, perfis, modulos, role_permissoes.

-- ─── pipeline_conversa ────────────────────────────────────────────────────────
create table pipeline_conversa (
  id                  uuid primary key default gen_random_uuid(),
  escola_id           uuid not null references escolas(id) on delete cascade,
  telefone            text not null,
  nome_whatsapp       text,
  lead_id             uuid references pipeline_lead(id) on delete set null,
  aluno_id            uuid references alunos(id) on delete set null,
  responsavel_id      uuid references responsaveis_aluno(id) on delete set null,
  assigned_to         uuid references perfis(id) on delete set null,
  status              text not null default 'aberta',   -- 'aberta' | 'arquivada'
  nao_lidas           int  not null default 0,
  janela_expira_em    timestamptz,
  ultima_msg_em       timestamptz not null default now(),
  ultima_msg_preview  text,
  created_at          timestamptz not null default now()
);

create unique index pipeline_conversa_tel_idx
  on pipeline_conversa(escola_id, telefone);
create index pipeline_conversa_ordem_idx
  on pipeline_conversa(escola_id, status, ultima_msg_em desc);
create index pipeline_conversa_assigned_idx
  on pipeline_conversa(escola_id, assigned_to);

alter table pipeline_conversa enable row level security;

create policy pipeline_conversa_service on pipeline_conversa
  for all to service_role using (true) with check (true);

create policy pipeline_conversa_escola on pipeline_conversa
  for all to authenticated
  using (escola_id = (select escola_id from current_perfil()))
  with check (escola_id = (select escola_id from current_perfil()));

grant select, insert, update, delete on pipeline_conversa to authenticated;

-- ─── pipeline_conversa_mensagem ───────────────────────────────────────────────
create table pipeline_conversa_mensagem (
  id                   uuid primary key default gen_random_uuid(),
  escola_id            uuid not null references escolas(id) on delete cascade,
  conversa_id          uuid not null references pipeline_conversa(id) on delete cascade,
  direcao              text not null,                 -- 'entrada' | 'saida'
  tipo                 text not null default 'texto', -- 'texto' | 'imagem' | 'template'
  texto                text,
  midia_url            text,
  status               text,                          -- só saída: 'enviada' | 'falha'
  erro                 text,
  provider_message_id  text,
  enviada_por          uuid references perfis(id) on delete set null,
  created_at           timestamptz not null default now()
);

create index pipeline_conversa_msg_idx
  on pipeline_conversa_mensagem(conversa_id, created_at);
create unique index pipeline_conversa_msg_provider_idx
  on pipeline_conversa_mensagem(provider_message_id)
  where provider_message_id is not null;

alter table pipeline_conversa_mensagem enable row level security;

create policy pipeline_conversa_msg_service on pipeline_conversa_mensagem
  for all to service_role using (true) with check (true);

create policy pipeline_conversa_msg_escola on pipeline_conversa_mensagem
  for all to authenticated
  using (escola_id = (select escola_id from current_perfil()))
  with check (escola_id = (select escola_id from current_perfil()));

grant select, insert, update, delete on pipeline_conversa_mensagem to authenticated;

-- ─── RBAC ─────────────────────────────────────────────────────────────────────
insert into modulos (codigo, grupo, nome, ordem) values
  ('whatsapp_inbox', 'comunicacao', 'WhatsApp Inbox', 40)
on conflict (codigo) do nothing;

insert into role_permissoes (role_codigo, modulo_codigo, pode_ler, pode_criar, pode_editar, pode_deletar) values
  ('admin',       'whatsapp_inbox', true,  true,  true,  true),
  ('coordenacao', 'whatsapp_inbox', true,  true,  true,  false),
  ('secretaria',  'whatsapp_inbox', false, false, false, false),
  ('professor',   'whatsapp_inbox', false, false, false, false)
on conflict (role_codigo, modulo_codigo) do nothing;

-- Realtime: publicar as tabelas novas.
alter publication supabase_realtime add table pipeline_conversa;
alter publication supabase_realtime add table pipeline_conversa_mensagem;
