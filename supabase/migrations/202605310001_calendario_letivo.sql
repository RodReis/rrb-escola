-- Calendário Letivo: calendario_letivo (1 por ano/escola) + calendario_excecoes (feriados/recessos)

do $$ begin
  create type tipo_excecao_calendario as enum ('feriado', 'recesso');
exception when duplicate_object then null;
end $$;

create table calendario_letivo (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references escolas(id) on delete cascade,
  ano_letivo integer not null,
  data_inicio date not null,
  data_fim date not null,
  dias_semana_letivos integer[] not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint calendario_letivo_ano_unico unique (escola_id, ano_letivo),
  constraint calendario_letivo_periodo_valido check (data_fim > data_inicio),
  constraint calendario_letivo_dias_nao_vazio check (array_length(dias_semana_letivos, 1) > 0)
);

create index calendario_letivo_escola_idx on calendario_letivo (escola_id);

create trigger calendario_letivo_updated_at
  before update on calendario_letivo
  for each row execute function set_updated_at();

create table calendario_excecoes (
  id uuid primary key default gen_random_uuid(),
  calendario_id uuid not null references calendario_letivo(id) on delete cascade,
  escola_id uuid not null references escolas(id) on delete cascade,
  data_inicio date not null,
  data_fim date not null,
  tipo tipo_excecao_calendario not null,
  descricao text not null,
  created_at timestamptz not null default now(),
  constraint calendario_excecoes_periodo_valido check (data_fim >= data_inicio)
);

create index calendario_excecoes_calendario_idx on calendario_excecoes (calendario_id);
create index calendario_excecoes_escola_idx on calendario_excecoes (escola_id);

alter table calendario_letivo enable row level security;
alter table calendario_excecoes enable row level security;

create policy "calendario letivo escola" on calendario_letivo for all to authenticated
  using (escola_id = (select escola_id from current_perfil()))
  with check (escola_id = (select escola_id from current_perfil()));

create policy "calendario excecoes escola" on calendario_excecoes for all to authenticated
  using (escola_id = (select escola_id from current_perfil()))
  with check (escola_id = (select escola_id from current_perfil()));

-- Seed RBAC: módulo calendario no grupo academico
insert into modulos (codigo, grupo, nome, ordem) values
  ('calendario', 'academico', 'Calendário Letivo', 44);

-- admin: full
insert into role_permissoes (role_codigo, modulo_codigo, pode_ler, pode_criar, pode_editar, pode_deletar)
  values ('admin', 'calendario', true, true, true, true);

-- secretaria: full (grupo academico)
insert into role_permissoes (role_codigo, modulo_codigo, pode_ler, pode_criar, pode_editar, pode_deletar)
  values ('secretaria', 'calendario', true, true, true, true);

-- financeiro: read-only
insert into role_permissoes (role_codigo, modulo_codigo, pode_ler, pode_criar, pode_editar, pode_deletar)
  values ('financeiro', 'calendario', true, false, false, false);

-- professor: read-only
insert into role_permissoes (role_codigo, modulo_codigo, pode_ler, pode_criar, pode_editar, pode_deletar)
  values ('professor', 'calendario', true, false, false, false);
