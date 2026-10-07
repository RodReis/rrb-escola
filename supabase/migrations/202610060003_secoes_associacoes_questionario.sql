-- Seções da Ficha Avaliativa (catálogo) e Associação da Série ao Questionário
-- (spec 2026-10-06-secoes-associacoes-questionario-design).
-- Ano e Série não são gravados: vêm de turmas.ano_letivo / turmas.serie_id.

-- 1) RBAC
insert into modulos (codigo, grupo, nome, ordem) values
  ('questionario.secao',      'academico', 'Questionário — Seções da Ficha', 74),
  ('questionario.associacao', 'academico', 'Questionário — Associações', 75)
on conflict (codigo) do nothing;

insert into role_permissoes (role_codigo, modulo_codigo, pode_ler, pode_criar, pode_editar, pode_deletar)
select r.codigo, m.codigo,
       r.codigo in ('admin', 'secretaria'), r.codigo in ('admin', 'secretaria'),
       r.codigo in ('admin', 'secretaria'), r.codigo in ('admin', 'secretaria')
from roles r
cross join (values ('questionario.secao'), ('questionario.associacao')) as m(codigo)
where r.codigo in ('admin', 'secretaria', 'financeiro', 'professor')
on conflict (role_codigo, modulo_codigo) do nothing;

-- 2) Tabelas
create table if not exists public.ficha_secoes (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references escolas(id) on delete cascade,
  codigo serial,
  descricao text not null check (length(btrim(descricao)) > 0),
  permite_lancamento_coletivo boolean not null default false,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists ficha_secoes_descricao_uq
  on ficha_secoes (escola_id, lower(descricao));

create table if not exists public.questionario_associacoes (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references escolas(id) on delete cascade,
  questionario_id uuid not null references questionarios(id) on delete restrict,
  turma_id uuid not null references turmas(id) on delete restrict,
  etapa smallint not null check (etapa between 1 and 4),
  professor_id uuid not null references employees(id) on delete restrict,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (questionario_id, turma_id, etapa, professor_id)
);
create index if not exists questionario_associacoes_turma_idx on questionario_associacoes (turma_id);
create index if not exists questionario_associacoes_professor_idx on questionario_associacoes (professor_id);
create index if not exists questionario_associacoes_escola_idx on questionario_associacoes (escola_id);

-- 3) updated_at
create trigger ficha_secoes_updated_at before update on ficha_secoes
  for each row execute function set_updated_at();
create trigger questionario_associacoes_updated_at before update on questionario_associacoes
  for each row execute function set_updated_at();

-- 4) RLS por escola (mesmo padrão do módulo)
do $$
declare t text;
begin
  foreach t in array array['ficha_secoes', 'questionario_associacoes'] loop
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
