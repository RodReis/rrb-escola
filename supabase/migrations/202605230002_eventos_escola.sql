-- Eventos da escola: tabela independente do calendário letivo.
-- Reuniões de pais, festa junina, conselho de classe, etc.
-- Não bloqueiam dia letivo, não geram exceção; pura agenda.

create table eventos_escola (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references escolas(id) on delete cascade,
  titulo text not null,
  data_inicio date not null,
  data_fim date not null,
  descricao text,
  local text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint eventos_escola_periodo_valido check (data_fim >= data_inicio)
);

create index eventos_escola_data_idx on eventos_escola (escola_id, data_inicio);

create trigger eventos_escola_updated_at
  before update on eventos_escola
  for each row execute function set_updated_at();

alter table eventos_escola enable row level security;

create policy "eventos escola tenant" on eventos_escola for all to authenticated
  using (escola_id = (select escola_id from current_perfil()))
  with check (escola_id = (select escola_id from current_perfil()));

-- Seed RBAC: módulo eventos no grupo secretaria
insert into modulos (codigo, grupo, nome, ordem) values
  ('eventos', 'secretaria', 'Eventos', 18);

insert into role_permissoes (role_codigo, modulo_codigo, pode_ler, pode_criar, pode_editar, pode_deletar)
  values ('admin', 'eventos', true, true, true, true);

insert into role_permissoes (role_codigo, modulo_codigo, pode_ler, pode_criar, pode_editar, pode_deletar)
  values ('secretaria', 'eventos', true, true, true, true);

insert into role_permissoes (role_codigo, modulo_codigo, pode_ler, pode_criar, pode_editar, pode_deletar)
  values ('financeiro', 'eventos', true, false, false, false);

insert into role_permissoes (role_codigo, modulo_codigo, pode_ler, pode_criar, pode_editar, pode_deletar)
  values ('professor', 'eventos', true, false, false, false);
