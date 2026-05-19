-- supabase/migrations/202605300001_rbac_permissoes.sql

-- 1) Tabela roles
create table roles (
  codigo text primary key,
  nome text not null,
  descricao text,
  sistema boolean not null default false,
  escola_id uuid references escolas(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_roles_escola on roles(escola_id);

-- 2) Catálogo de módulos
create table modulos (
  codigo text primary key,
  grupo text not null,
  nome text not null,
  ordem int not null default 0
);

create index idx_modulos_grupo on modulos(grupo, ordem);

-- 3) Permissões
create table role_permissoes (
  role_codigo text not null references roles(codigo) on delete cascade,
  modulo_codigo text not null references modulos(codigo) on delete cascade,
  pode_ler boolean not null default false,
  pode_criar boolean not null default false,
  pode_editar boolean not null default false,
  pode_deletar boolean not null default false,
  primary key (role_codigo, modulo_codigo)
);

-- 4) Seed roles (DEVE vir ANTES da FK em perfis)
insert into roles (codigo, nome, sistema) values
  ('admin', 'Administrador', true),
  ('secretaria', 'Secretaria', true),
  ('financeiro', 'Financeiro', true),
  ('professor', 'Professor', true);

-- 5) FK perfis.perfil → roles.codigo
alter table perfis add constraint perfis_perfil_fk
  foreign key (perfil) references roles(codigo);

-- 6) Seed módulos (25 sub-módulos × 7 grupos)
insert into modulos (codigo, grupo, nome, ordem) values
  ('avaliacoes', 'pedagogico', 'Avaliações', 1),
  ('frequencias', 'pedagogico', 'Frequências', 2),
  ('disciplinas', 'pedagogico', 'Disciplinas', 3),
  ('mural', 'pedagogico', 'Mural', 4),
  ('alunos', 'secretaria', 'Alunos', 10),
  ('matriculas', 'secretaria', 'Matrículas', 11),
  ('importacoes', 'secretaria', 'Importações', 12),
  ('documentos.templates', 'secretaria', 'Templates Documentos', 13),
  ('financeiro.cobrancas', 'financeiro', 'Cobranças & Pagamentos', 20),
  ('despesas', 'financeiro', 'Despesas', 21),
  ('planos', 'financeiro', 'Planos', 22),
  ('valores-praticados', 'financeiro', 'Valores Praticados', 23),
  ('bolsistas', 'financeiro', 'Bolsistas', 24),
  ('rh.funcionarios', 'rh', 'Funcionários', 30),
  ('rh.empresas', 'rh', 'Empresas', 31),
  ('rh.folha', 'rh', 'Folha de Pagamento', 32),
  ('rh.templates', 'rh', 'Templates RH', 33),
  ('series', 'academico', 'Séries', 40),
  ('turmas', 'academico', 'Turmas', 41),
  ('professores', 'academico', 'Professores', 42),
  ('organograma', 'academico', 'Organograma', 43),
  ('portaria', 'operacional', 'Portaria', 50),
  ('relatorios', 'operacional', 'Relatórios', 51),
  ('usuarios', 'administracao', 'Usuários', 90),
  ('configuracoes.escola', 'administracao', 'Configurações da Escola', 91),
  ('configuracoes.webhook', 'administracao', 'Webhook', 92),
  ('configuracoes.perfis', 'administracao', 'Perfis e Permissões', 93);

-- 7) Seed role_permissoes — admin (full)
insert into role_permissoes (role_codigo, modulo_codigo, pode_ler, pode_criar, pode_editar, pode_deletar)
select 'admin', codigo, true, true, true, true from modulos;

-- 8) Seed role_permissoes — secretaria
insert into role_permissoes (role_codigo, modulo_codigo, pode_ler, pode_criar, pode_editar, pode_deletar)
select 'secretaria', codigo,
  true,
  case when grupo in ('secretaria','academico','operacional') then true else false end,
  case when grupo in ('secretaria','academico','operacional') then true else false end,
  case when grupo in ('secretaria','academico','operacional') then true else false end
from modulos
where grupo in ('secretaria','academico','operacional','pedagogico','financeiro');

-- 9) Seed role_permissoes — financeiro
insert into role_permissoes (role_codigo, modulo_codigo, pode_ler, pode_criar, pode_editar, pode_deletar)
select 'financeiro', codigo,
  case
    when grupo = 'financeiro' then true
    when grupo in ('secretaria','academico','rh') then true
    when codigo = 'relatorios' then true
    else false
  end,
  case when grupo = 'financeiro' then true else false end,
  case when grupo = 'financeiro' then true else false end,
  case when grupo = 'financeiro' then true else false end
from modulos
where grupo in ('financeiro','secretaria','academico','rh','operacional');

-- 10) Seed role_permissoes — professor
insert into role_permissoes (role_codigo, modulo_codigo, pode_ler, pode_criar, pode_editar, pode_deletar)
select 'professor', codigo,
  case
    when grupo = 'pedagogico' then true
    when codigo in ('alunos','matriculas') then true
    when grupo = 'academico' then true
    when codigo = 'relatorios' then true
    else false
  end,
  case when grupo = 'pedagogico' then true else false end,
  case when grupo = 'pedagogico' then true else false end,
  case when grupo = 'pedagogico' then true else false end
from modulos
where grupo in ('pedagogico','secretaria','academico','operacional');

-- 11) RLS
alter table roles enable row level security;
alter table role_permissoes enable row level security;
alter table modulos enable row level security;

create policy "roles read all" on roles for select to authenticated using (true);

create policy "roles admin manage" on roles for all to authenticated
  using (
    (select perfil from current_perfil()) = 'admin'
    and (escola_id = (select escola_id from current_perfil()) or escola_id is null)
  )
  with check (
    (select perfil from current_perfil()) = 'admin'
    and (escola_id = (select escola_id from current_perfil()) or sistema = false)
  );

create policy "role_permissoes read all" on role_permissoes for select to authenticated using (true);

create policy "role_permissoes admin manage" on role_permissoes for all to authenticated
  using ((select perfil from current_perfil()) = 'admin')
  with check ((select perfil from current_perfil()) = 'admin');

create policy "modulos read all" on modulos for select to authenticated using (true);

-- 12) Helper SQL has_permission
create or replace function has_permission(p_modulo text, p_acao text)
returns boolean as $$
  select coalesce(
    (select case p_acao
      when 'read' then pode_ler
      when 'create' then pode_criar
      when 'update' then pode_editar
      when 'delete' then pode_deletar
    end
    from role_permissoes rp
    join perfis p on p.perfil = rp.role_codigo
    where p.user_id = auth.uid() and p.ativo = true
      and rp.modulo_codigo = p_modulo
    limit 1),
    false
  );
$$ language sql stable security definer set search_path = public;
