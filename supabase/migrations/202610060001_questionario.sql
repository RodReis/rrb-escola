-- Módulo Questionário (spec 2026-10-06): grupos, escalas, questões e questionários.
-- Só cadastros; respostas ficam para o ciclo seguinte (por isso questionario_questoes
-- tem PK própria: respostas futuras apontam para ela).

-- 1) RBAC
insert into modulos (codigo, grupo, nome, ordem) values
  ('questionario.grupo',        'academico', 'Questionário — Grupos de Questão', 70),
  ('questionario.escala',       'academico', 'Questionário — Escalas', 71),
  ('questionario.questao',      'academico', 'Questionário — Questões', 72),
  ('questionario.questionario', 'academico', 'Questionário — Questionários', 73)
on conflict (codigo) do nothing;

insert into role_permissoes (role_codigo, modulo_codigo, pode_ler, pode_criar, pode_editar, pode_deletar)
select r.codigo, m.codigo,
       r.codigo in ('admin', 'secretaria'), r.codigo in ('admin', 'secretaria'),
       r.codigo in ('admin', 'secretaria'), r.codigo in ('admin', 'secretaria')
from roles r
cross join (values
  ('questionario.grupo'), ('questionario.escala'),
  ('questionario.questao'), ('questionario.questionario')
) as m(codigo)
where r.codigo in ('admin', 'secretaria', 'financeiro', 'professor')
on conflict (role_codigo, modulo_codigo) do nothing;

-- 2) Enum
do $$ begin
  create type questao_tipo as enum (
    'subjetiva', 'objetiva_unica', 'objetiva_multipla', 'objetiva_escala', 'matriz_descritiva'
  );
exception when duplicate_object then null;
end $$;

-- 3) Tabelas
create table if not exists public.questao_grupos (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references escolas(id) on delete cascade,
  codigo serial,
  descricao text not null check (length(btrim(descricao)) > 0),
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists questao_grupos_descricao_uq
  on questao_grupos (escola_id, lower(descricao));

create table if not exists public.escalas (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references escolas(id) on delete cascade,
  descricao text not null check (length(btrim(descricao)) > 0),
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists escalas_descricao_uq on escalas (escola_id, lower(descricao));

create table if not exists public.escala_opcoes (
  id uuid primary key default gen_random_uuid(),
  escala_id uuid not null references escalas(id) on delete cascade,
  rotulo text not null check (length(btrim(rotulo)) > 0),
  ordem int not null
);
create index if not exists escala_opcoes_escala_idx on escala_opcoes (escala_id);

create table if not exists public.questoes (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references escolas(id) on delete cascade,
  grupo_id uuid not null references questao_grupos(id) on delete restrict,
  tipo questao_tipo not null,
  pergunta text not null check (length(btrim(pergunta)) > 0),
  ativa boolean not null default true,
  obrigatoria boolean not null default false,
  limitar_caracteres boolean not null default false,
  qtde_caracteres int not null default 0 check (qtde_caracteres >= 0),
  qtde_linhas int not null default 0 check (qtde_linhas >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists questoes_grupo_idx on questoes (grupo_id);
create index if not exists questoes_escola_idx on questoes (escola_id);

create table if not exists public.questao_alternativas (
  id uuid primary key default gen_random_uuid(),
  questao_id uuid not null references questoes(id) on delete cascade,
  rotulo text not null check (length(btrim(rotulo)) > 0),
  ordem int not null
);
create index if not exists questao_alternativas_questao_idx on questao_alternativas (questao_id);

create table if not exists public.questionarios (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references escolas(id) on delete cascade,
  descricao text not null check (length(btrim(descricao)) > 0),
  observacoes text,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists questionarios_escola_idx on questionarios (escola_id);

create table if not exists public.questionario_questoes (
  id uuid primary key default gen_random_uuid(),
  questionario_id uuid not null references questionarios(id) on delete cascade,
  questao_id uuid not null references questoes(id) on delete restrict,
  escala_id uuid references escalas(id) on delete restrict,
  ordem int not null,
  unique (questionario_id, questao_id)
);
create index if not exists questionario_questoes_questao_idx on questionario_questoes (questao_id);

-- 4) updated_at
create trigger questao_grupos_updated_at before update on questao_grupos
  for each row execute function set_updated_at();
create trigger escalas_updated_at before update on escalas
  for each row execute function set_updated_at();
create trigger questoes_updated_at before update on questoes
  for each row execute function set_updated_at();
create trigger questionarios_updated_at before update on questionarios
  for each row execute function set_updated_at();

-- 5) RLS — tabelas com escola_id
do $$
declare t text;
begin
  foreach t in array array['questao_grupos', 'escalas', 'questoes', 'questionarios'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy %I on public.%I for all to service_role using (true) with check (true)',
      t || '_service', t);
    execute format(
      'create policy %I on public.%I for all to authenticated '
      'using (escola_id = (select escola_id from current_perfil())) '
      'with check (escola_id = (select escola_id from current_perfil()))',
      t || '_escola', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

-- 6) RLS — tabelas filhas (escola via pai)
alter table public.escala_opcoes enable row level security;
create policy escala_opcoes_service on public.escala_opcoes
  for all to service_role using (true) with check (true);
create policy escala_opcoes_escola on public.escala_opcoes
  for all to authenticated
  using (exists (select 1 from escalas p
                 where p.id = escala_opcoes.escala_id
                   and p.escola_id = (select escola_id from current_perfil())))
  with check (exists (select 1 from escalas p
                      where p.id = escala_opcoes.escala_id
                        and p.escola_id = (select escola_id from current_perfil())));
grant select, insert, update, delete on public.escala_opcoes to authenticated;

alter table public.questao_alternativas enable row level security;
create policy questao_alternativas_service on public.questao_alternativas
  for all to service_role using (true) with check (true);
create policy questao_alternativas_escola on public.questao_alternativas
  for all to authenticated
  using (exists (select 1 from questoes p
                 where p.id = questao_alternativas.questao_id
                   and p.escola_id = (select escola_id from current_perfil())))
  with check (exists (select 1 from questoes p
                      where p.id = questao_alternativas.questao_id
                        and p.escola_id = (select escola_id from current_perfil())));
grant select, insert, update, delete on public.questao_alternativas to authenticated;

alter table public.questionario_questoes enable row level security;
create policy questionario_questoes_service on public.questionario_questoes
  for all to service_role using (true) with check (true);
create policy questionario_questoes_escola on public.questionario_questoes
  for all to authenticated
  using (exists (select 1 from questionarios p
                 where p.id = questionario_questoes.questionario_id
                   and p.escola_id = (select escola_id from current_perfil())))
  with check (exists (select 1 from questionarios p
                      where p.id = questionario_questoes.questionario_id
                        and p.escola_id = (select escola_id from current_perfil())));
grant select, insert, update, delete on public.questionario_questoes to authenticated;
