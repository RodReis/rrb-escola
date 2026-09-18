-- Historico escolar: credenciamentos, niveis de ensino por serie, historico por
-- aluno com anos (internos ou externos) e notas por disciplina.
-- Depende: escolas, alunos, series, disciplinas, companies, modulos, role_permissoes.

do $$ begin
  create type nivel_ensino as enum ('infantil', 'fund1', 'fund2', 'medio');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type origem_historico as enum ('interna', 'externa');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type resultado_historico as enum ('aprovado', 'reprovado', 'cursando', 'transferido');
exception when duplicate_object then null;
end $$;

-- ─── historico_credenciamentos ───────────────────────────────────────────────
create table if not exists public.historico_credenciamentos (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references escolas(id) on delete cascade,
  company_id uuid references companies(id) on delete set null,
  razao_social text not null,
  nome_fantasia text not null,
  cnpj text,
  resolucao text,
  endereco text,
  cidade text,
  uf text,
  cep text,
  telefones text,
  email text,
  logo_path text,
  secretario_nome text,
  secretario_cargo text not null default 'Secretário(a)',
  diretor_nome text,
  diretor_cargo text not null default 'Diretor(a)',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index historico_credenciamentos_escola_idx
  on historico_credenciamentos (escola_id);

create trigger historico_credenciamentos_updated_at
  before update on historico_credenciamentos
  for each row execute function set_updated_at();

alter table historico_credenciamentos enable row level security;

create policy historico_credenciamentos_service on historico_credenciamentos
  for all to service_role using (true) with check (true);

create policy historico_credenciamentos_escola on historico_credenciamentos
  for all to authenticated
  using (escola_id = (select escola_id from current_perfil()))
  with check (escola_id = (select escola_id from current_perfil()));

grant select, insert, update, delete on historico_credenciamentos to authenticated;

-- ─── historico_niveis_ensino ─────────────────────────────────────────────────
create table if not exists public.historico_niveis_ensino (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references escolas(id) on delete cascade,
  serie_id uuid not null references series(id) on delete cascade,
  credenciamento_id uuid not null references historico_credenciamentos(id) on delete restrict,
  nivel nivel_ensino not null,
  ano_inicio int not null,
  ano_fim int not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (escola_id, serie_id, ano_inicio),
  check (ano_fim >= ano_inicio)
);

create index historico_niveis_ensino_serie_idx
  on historico_niveis_ensino (serie_id, ano_inicio);

create trigger historico_niveis_ensino_updated_at
  before update on historico_niveis_ensino
  for each row execute function set_updated_at();

alter table historico_niveis_ensino enable row level security;

create policy historico_niveis_ensino_service on historico_niveis_ensino
  for all to service_role using (true) with check (true);

create policy historico_niveis_ensino_escola on historico_niveis_ensino
  for all to authenticated
  using (escola_id = (select escola_id from current_perfil()))
  with check (escola_id = (select escola_id from current_perfil()));

grant select, insert, update, delete on historico_niveis_ensino to authenticated;

-- ─── historico_escolar ───────────────────────────────────────────────────────
create table if not exists public.historico_escolar (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references escolas(id) on delete cascade,
  aluno_id uuid not null references alunos(id) on delete cascade,
  nivel nivel_ensino not null,
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (escola_id, aluno_id, nivel)
);

create index historico_escolar_aluno_idx on historico_escolar (aluno_id);

create trigger historico_escolar_updated_at
  before update on historico_escolar
  for each row execute function set_updated_at();

alter table historico_escolar enable row level security;

create policy historico_escolar_service on historico_escolar
  for all to service_role using (true) with check (true);

create policy historico_escolar_escola on historico_escolar
  for all to authenticated
  using (escola_id = (select escola_id from current_perfil()))
  with check (escola_id = (select escola_id from current_perfil()));

grant select, insert, update, delete on historico_escolar to authenticated;

-- ─── historico_anos ──────────────────────────────────────────────────────────
create table if not exists public.historico_anos (
  id uuid primary key default gen_random_uuid(),
  historico_id uuid not null references historico_escolar(id) on delete cascade,
  ano int not null,
  serie_id uuid references series(id) on delete set null,
  serie_nome text not null,
  origem origem_historico not null,
  instituicao text,
  cidade text,
  uf text,
  resultado resultado_historico not null default 'cursando',
  media_aprovacao numeric(4,2),
  carga_horaria int,
  dias_letivos int,
  faltas int,
  percentual_frequencia numeric(5,2),
  congelado boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (historico_id, ano)
);

create index historico_anos_historico_idx on historico_anos (historico_id, ano);

create trigger historico_anos_updated_at
  before update on historico_anos
  for each row execute function set_updated_at();

alter table historico_anos enable row level security;

create policy historico_anos_service on historico_anos
  for all to service_role using (true) with check (true);

create policy historico_anos_escola on historico_anos
  for all to authenticated
  using (exists (
    select 1 from historico_escolar h
    where h.id = historico_anos.historico_id
      and h.escola_id = (select escola_id from current_perfil())
  ))
  with check (exists (
    select 1 from historico_escolar h
    where h.id = historico_anos.historico_id
      and h.escola_id = (select escola_id from current_perfil())
  ));

grant select, insert, update, delete on historico_anos to authenticated;

-- ─── historico_notas ─────────────────────────────────────────────────────────
create table if not exists public.historico_notas (
  id uuid primary key default gen_random_uuid(),
  historico_ano_id uuid not null references historico_anos(id) on delete cascade,
  disciplina_id uuid references disciplinas(id) on delete set null,
  disciplina_nome text not null,
  nota numeric(4,2),
  carga_horaria int,
  faltas int,
  ordem int not null default 0,
  created_at timestamptz not null default now()
);

create index historico_notas_ano_idx on historico_notas (historico_ano_id, ordem);

alter table historico_notas enable row level security;

create policy historico_notas_service on historico_notas
  for all to service_role using (true) with check (true);

create policy historico_notas_escola on historico_notas
  for all to authenticated
  using (exists (
    select 1 from historico_anos a
    join historico_escolar h on h.id = a.historico_id
    where a.id = historico_notas.historico_ano_id
      and h.escola_id = (select escola_id from current_perfil())
  ))
  with check (exists (
    select 1 from historico_anos a
    join historico_escolar h on h.id = a.historico_id
    where a.id = historico_notas.historico_ano_id
      and h.escola_id = (select escola_id from current_perfil())
  ));

grant select, insert, update, delete on historico_notas to authenticated;

-- ─── RBAC ────────────────────────────────────────────────────────────────────
insert into modulos (codigo, grupo, nome, ordem) values
  ('historico', 'secretaria', 'Histórico Escolar', 100)
on conflict (codigo) do nothing;

insert into role_permissoes (role_codigo, modulo_codigo, pode_ler, pode_criar, pode_editar, pode_deletar) values
  ('admin', 'historico', true, true, true, true),
  ('secretaria', 'historico', true, true, true, true)
on conflict (role_codigo, modulo_codigo) do nothing;
