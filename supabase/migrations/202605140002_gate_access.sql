create table if not exists consentimentos_biometria (
  id uuid primary key default gen_random_uuid(),
  aluno_id uuid not null unique references alunos(id) on delete cascade,
  autorizado boolean not null default false,
  responsavel_id uuid references responsaveis_aluno(id) on delete set null,
  data_consentimento timestamptz,
  data_revogacao timestamptz,
  observacao text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists preferencias_notificacao_aluno (
  id uuid primary key default gen_random_uuid(),
  aluno_id uuid not null references alunos(id) on delete cascade,
  responsavel_id uuid references responsaveis_aluno(id) on delete set null,
  canal text not null default 'whatsapp',
  telefone_destino text,
  notificar_entrada boolean not null default true,
  notificar_saida boolean not null default true,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (aluno_id, canal)
);

create table if not exists dispositivos_acesso (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references escolas(id) on delete cascade,
  nome text not null,
  local text,
  tipo text not null default 'portaria',
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (escola_id, nome)
);

create table if not exists eventos_acesso (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references escolas(id) on delete cascade,
  aluno_id uuid not null references alunos(id) on delete cascade,
  dispositivo_id uuid references dispositivos_acesso(id) on delete set null,
  tipo text not null check (tipo in ('entrada', 'saida')),
  origem text not null default 'manual' check (origem in ('manual', 'facial_simulado', 'facial')),
  confianca numeric(5,2),
  data_evento timestamptz not null default now(),
  data_referencia date not null default current_date,
  observacao text,
  created_at timestamptz not null default now()
);

create table if not exists notificacoes_responsavel (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references escolas(id) on delete cascade,
  aluno_id uuid not null references alunos(id) on delete cascade,
  responsavel_id uuid references responsaveis_aluno(id) on delete set null,
  evento_acesso_id uuid references eventos_acesso(id) on delete set null,
  canal text not null default 'whatsapp',
  telefone_destino text,
  mensagem text not null,
  status text not null default 'simulada' check (status in ('simulada', 'pendente', 'enviada', 'erro')),
  erro text,
  provider_message_id text,
  created_at timestamptz not null default now()
);

create index if not exists eventos_acesso_aluno_data_idx on eventos_acesso (aluno_id, data_referencia desc, data_evento desc);
create index if not exists eventos_acesso_escola_data_idx on eventos_acesso (escola_id, data_referencia desc, data_evento desc);
create index if not exists notificacoes_responsavel_aluno_idx on notificacoes_responsavel (aluno_id, created_at desc);

alter table consentimentos_biometria enable row level security;
alter table preferencias_notificacao_aluno enable row level security;
alter table dispositivos_acesso enable row level security;
alter table eventos_acesso enable row level security;
alter table notificacoes_responsavel enable row level security;

drop policy if exists "service role full access consentimentos biometria" on consentimentos_biometria;
create policy "service role full access consentimentos biometria"
on consentimentos_biometria for all to service_role using (true) with check (true);

drop policy if exists "service role full access preferencias notificacao" on preferencias_notificacao_aluno;
create policy "service role full access preferencias notificacao"
on preferencias_notificacao_aluno for all to service_role using (true) with check (true);

drop policy if exists "service role full access dispositivos acesso" on dispositivos_acesso;
create policy "service role full access dispositivos acesso"
on dispositivos_acesso for all to service_role using (true) with check (true);

drop policy if exists "service role full access eventos acesso" on eventos_acesso;
create policy "service role full access eventos acesso"
on eventos_acesso for all to service_role using (true) with check (true);

drop policy if exists "service role full access notificacoes responsavel" on notificacoes_responsavel;
create policy "service role full access notificacoes responsavel"
on notificacoes_responsavel for all to service_role using (true) with check (true);

drop trigger if exists consentimentos_biometria_updated_at on consentimentos_biometria;
create trigger consentimentos_biometria_updated_at before update on consentimentos_biometria for each row execute function set_updated_at();

drop trigger if exists preferencias_notificacao_aluno_updated_at on preferencias_notificacao_aluno;
create trigger preferencias_notificacao_aluno_updated_at before update on preferencias_notificacao_aluno for each row execute function set_updated_at();

drop trigger if exists dispositivos_acesso_updated_at on dispositivos_acesso;
create trigger dispositivos_acesso_updated_at before update on dispositivos_acesso for each row execute function set_updated_at();
