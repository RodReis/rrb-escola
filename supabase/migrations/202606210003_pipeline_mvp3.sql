-- Pipeline MVP3: pipeline_template_whatsapp + pipeline_tarefa
-- Depende: pipeline_pode() (MVP2), pipeline_card (MVP1)

-- ─── pipeline_template_whatsapp ───────────────────────────────────────────────

create table pipeline_template_whatsapp (
  id               uuid primary key default gen_random_uuid(),
  escola_id        uuid not null references escolas(id) on delete cascade,
  nome_template    text not null,
  descricao        text not null,
  variaveis_count  int  not null default 0,
  variaveis_fontes text[] not null default '{}',
  ativo            boolean not null default true,
  created_at       timestamptz not null default now()
);

create index pipeline_template_wpp_escola_idx
  on pipeline_template_whatsapp(escola_id, ativo);

alter table pipeline_template_whatsapp enable row level security;

create policy pipeline_template_wpp_read on pipeline_template_whatsapp
  for select to authenticated
  using (pipeline_pode('pipeline', 'read'));

create policy pipeline_template_wpp_write on pipeline_template_whatsapp
  for all to authenticated
  using (pipeline_pode('pipeline_admin', 'read'));

grant select, insert, update, delete on pipeline_template_whatsapp to authenticated;

-- ─── pipeline_tarefa ──────────────────────────────────────────────────────────

create table pipeline_tarefa (
  id           uuid primary key default gen_random_uuid(),
  escola_id    uuid not null references escolas(id) on delete cascade,
  card_id      uuid not null references pipeline_card(id) on delete cascade,
  titulo       text not null,
  descricao    text,
  due_at       timestamptz,
  status       text not null default 'aberta',
  assigned_to  uuid references perfis(id) on delete set null,
  created_by   uuid not null references perfis(id) on delete restrict,
  created_at   timestamptz not null default now(),
  completed_at timestamptz
);

create index pipeline_tarefa_card_idx
  on pipeline_tarefa(card_id, status);

create index pipeline_tarefa_assigned_idx
  on pipeline_tarefa(escola_id, assigned_to, status);

create index pipeline_tarefa_due_idx
  on pipeline_tarefa(escola_id, due_at)
  where status = 'aberta';

alter table pipeline_tarefa enable row level security;

create policy pipeline_tarefa_rw on pipeline_tarefa
  for all to authenticated
  using (pipeline_pode('pipeline', 'read'));

grant select, insert, update, delete on pipeline_tarefa to authenticated;
