-- Certificado de conclusao: parametros por escola.
-- O historico escolar impresso no verso vem de historico_escolar (ver
-- 202609180001_historico_escolar.sql). Nao ha snapshot proprio do certificado:
-- historico_anos.congelado ja e o mecanismo de congelamento do documento legal.

create table if not exists public.certificado_config (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references escolas(id) on delete cascade,
  titulo_certificado text not null default 'Certificado',
  texto_inicio text not null default 'A Diretora da',
  descricao_curso text not null default 'ENSINO MÉDIO',
  base_legal text not null default 'sob a Resolução CEE/CEB N.01, de 14 de janeiro de 2022 de acordo com a Lei Nº 9394 de 20 de dezembro de 1996.',
  texto_customizado text,
  mostrar_historico boolean not null default true,
  leiaute jsonb not null default '{}'::jsonb,
  assinaturas jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (escola_id)
);

create trigger certificado_config_updated_at
  before update on certificado_config
  for each row execute function set_updated_at();

alter table certificado_config enable row level security;

create policy certificado_config_service on certificado_config
  for all to service_role using (true) with check (true);

create policy certificado_config_escola on certificado_config
  for all to authenticated
  using (escola_id = (select escola_id from current_perfil()))
  with check (escola_id = (select escola_id from current_perfil()));

grant select, insert, update, delete on certificado_config to authenticated;

-- Sem bloco RBAC: o certificado usa o modulo 'historico', ja seedado em
-- 202609180001_historico_escolar.sql.

comment on table certificado_config is 'Parametros padrao do certificado de conclusao por escola. O verso vem de historico_escolar.';
