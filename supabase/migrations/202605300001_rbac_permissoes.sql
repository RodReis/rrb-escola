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

-- Trigger updated_at on roles
create trigger roles_updated_at
  before update on roles
  for each row execute function set_updated_at();

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
-- Many policies in earlier migrations call current_perfil() which returns
-- perfis%ROWTYPE — Postgres expands the composite type into all columns,
-- creating implicit dependencies on perfis.perfil for every such policy.
-- To alter perfis.perfil from ENUM to text, we must drop ALL these policies,
-- drop and recreate current_perfil(), then recreate every policy.

-- 5.1) Drop all policies that reference current_perfil()
drop policy if exists "perfil ativo full access alunos" on public.alunos;
drop policy if exists "perfil ativo full access arquivos" on public.arquivos_importados;
drop policy if exists "perfil ativo full access aut aluno" on public.autorizacoes_aluno;
drop policy if exists "perfil ativo full access biometrias aluno" on public.biometrias_aluno;
drop policy if exists "categorias_despesa_rw" on public.categorias_despesa;
drop policy if exists "perfil ativo full access cobrancas" on public.cobrancas;
drop policy if exists "perfil ativo full access consentimentos biometria" on public.consentimentos_biometria;
drop policy if exists "perfil ativo full access contatos" on public.contatos_aluno;
drop policy if exists "despesas_rw" on public.despesas;
drop policy if exists "perfil ativo full access dispositivos acesso" on public.dispositivos_acesso;
drop policy if exists "perfil ativo full access documentos aluno" on public.documentos_aluno;
drop policy if exists "perfil ativo full access enderecos" on public.enderecos_aluno;
drop policy if exists "perfil ativo read escolas" on public.escolas;
drop policy if exists "perfil ativo update escolas" on public.escolas;
drop policy if exists "perfil ativo full access eventos acesso" on public.eventos_acesso;
drop policy if exists "perfil ativo full access frequencias" on public.frequencias;
drop policy if exists "perfil ativo full access historico matriculas" on public.historico_matriculas;
drop policy if exists "perfil ativo full access importacao linhas" on public.importacao_alunos_linhas;
drop policy if exists "perfil ativo full access medicas" on public.informacoes_medicas;
drop policy if exists "perfil ativo full access matriculas" on public.matriculas;
drop policy if exists "perfil ativo full access notificacoes responsavel" on public.notificacoes_responsavel;
drop policy if exists "perfil ativo full access pagamentos" on public.pagamentos;
drop policy if exists "perfil admin manage" on public.perfis;
drop policy if exists "perfil self read" on public.perfis;
drop policy if exists "perfil ativo full access autorizadas" on public.pessoas_autorizadas;
drop policy if exists "perfil ativo full access planos" on public.planos;
drop policy if exists "perfil ativo full access preferencias notificacao" on public.preferencias_notificacao_aluno;
drop policy if exists "perfil ativo full access responsaveis" on public.responsaveis_aluno;
drop policy if exists "perfil ativo full access series" on public.series;
drop policy if exists "perfil ativo full access turmas" on public.turmas;
drop policy if exists "despesas_comprovantes_rw" on storage.objects;
drop policy if exists "perfil ativo delete biometrias" on storage.objects;
drop policy if exists "perfil ativo delete documentos" on storage.objects;
drop policy if exists "perfil ativo delete fotos" on storage.objects;
drop policy if exists "perfil ativo delete importacoes" on storage.objects;
drop policy if exists "perfil ativo read biometrias" on storage.objects;
drop policy if exists "perfil ativo read documentos" on storage.objects;
drop policy if exists "perfil ativo read fotos" on storage.objects;
drop policy if exists "perfil ativo read importacoes" on storage.objects;
drop policy if exists "perfil ativo update biometrias" on storage.objects;
drop policy if exists "perfil ativo update documentos" on storage.objects;
drop policy if exists "perfil ativo update fotos" on storage.objects;
drop policy if exists "perfil ativo update importacoes" on storage.objects;
drop policy if exists "perfil ativo write biometrias" on storage.objects;
drop policy if exists "perfil ativo write documentos" on storage.objects;
drop policy if exists "perfil ativo write fotos" on storage.objects;
drop policy if exists "perfil ativo write importacoes" on storage.objects;

-- 5.2) Drop current_perfil() (depends on perfis%ROWTYPE)
drop function if exists current_perfil();

-- 5.3) Alter perfis.perfil ENUM → text
alter table perfis alter column perfil drop default;
alter table perfis alter column perfil type text using perfil::text;
alter table perfis alter column perfil set default 'admin';
-- Keep perfil_usuario enum type alive in case it's referenced elsewhere

-- 5.4) Add FK
alter table perfis add constraint perfis_perfil_fk
  foreign key (perfil) references roles(codigo);

-- 5.5) Recreate current_perfil() (returns updated perfis%ROWTYPE with perfil as text)
create or replace function current_perfil()
returns perfis as $$
  select * from perfis
  where user_id = auth.uid() and ativo = true
  limit 1;
$$ language sql stable security definer set search_path = public;

-- 5.6) Recreate all dropped policies (perfil compared as text instead of ENUM cast)
create policy "perfil ativo full access alunos" on public.alunos for all to authenticated
  using (escola_id = (select escola_id from current_perfil()))
  with check (escola_id = (select escola_id from current_perfil()));

create policy "perfil ativo full access arquivos" on public.arquivos_importados for all to authenticated
  using (escola_id = (select escola_id from current_perfil()))
  with check (escola_id = (select escola_id from current_perfil()));

create policy "perfil ativo full access aut aluno" on public.autorizacoes_aluno for all to authenticated
  using (exists (select 1 from alunos a where a.id = autorizacoes_aluno.aluno_id and a.escola_id = (select escola_id from current_perfil())))
  with check (exists (select 1 from alunos a where a.id = autorizacoes_aluno.aluno_id and a.escola_id = (select escola_id from current_perfil())));

create policy "perfil ativo full access biometrias aluno" on public.biometrias_aluno for all to authenticated
  using (exists (select 1 from alunos a where a.id = biometrias_aluno.aluno_id and a.escola_id = (select escola_id from current_perfil())))
  with check (exists (select 1 from alunos a where a.id = biometrias_aluno.aluno_id and a.escola_id = (select escola_id from current_perfil())));

create policy "categorias_despesa_rw" on public.categorias_despesa for all to authenticated
  using (escola_id = (select escola_id from current_perfil()))
  with check (escola_id = (select escola_id from current_perfil()));

create policy "perfil ativo full access cobrancas" on public.cobrancas for all to authenticated
  using (escola_id = (select escola_id from current_perfil()))
  with check (escola_id = (select escola_id from current_perfil()));

create policy "perfil ativo full access consentimentos biometria" on public.consentimentos_biometria for all to authenticated
  using (exists (select 1 from alunos a where a.id = consentimentos_biometria.aluno_id and a.escola_id = (select escola_id from current_perfil())))
  with check (exists (select 1 from alunos a where a.id = consentimentos_biometria.aluno_id and a.escola_id = (select escola_id from current_perfil())));

create policy "perfil ativo full access contatos" on public.contatos_aluno for all to authenticated
  using (exists (select 1 from alunos a where a.id = contatos_aluno.aluno_id and a.escola_id = (select escola_id from current_perfil())))
  with check (exists (select 1 from alunos a where a.id = contatos_aluno.aluno_id and a.escola_id = (select escola_id from current_perfil())));

create policy "despesas_rw" on public.despesas for all to authenticated
  using (escola_id = (select escola_id from current_perfil()))
  with check (escola_id = (select escola_id from current_perfil()));

create policy "perfil ativo full access dispositivos acesso" on public.dispositivos_acesso for all to authenticated
  using (escola_id = (select escola_id from current_perfil()))
  with check (escola_id = (select escola_id from current_perfil()));

create policy "perfil ativo full access documentos aluno" on public.documentos_aluno for all to authenticated
  using (exists (select 1 from alunos a where a.id = documentos_aluno.aluno_id and a.escola_id = (select escola_id from current_perfil())))
  with check (exists (select 1 from alunos a where a.id = documentos_aluno.aluno_id and a.escola_id = (select escola_id from current_perfil())));

create policy "perfil ativo full access enderecos" on public.enderecos_aluno for all to authenticated
  using (exists (select 1 from alunos a where a.id = enderecos_aluno.aluno_id and a.escola_id = (select escola_id from current_perfil())))
  with check (exists (select 1 from alunos a where a.id = enderecos_aluno.aluno_id and a.escola_id = (select escola_id from current_perfil())));

create policy "perfil ativo read escolas" on public.escolas for select to authenticated
  using (id = (select escola_id from current_perfil()));

create policy "perfil ativo update escolas" on public.escolas for update to authenticated
  using (id = (select escola_id from current_perfil()))
  with check (id = (select escola_id from current_perfil()));

create policy "perfil ativo full access eventos acesso" on public.eventos_acesso for all to authenticated
  using (escola_id = (select escola_id from current_perfil()))
  with check (escola_id = (select escola_id from current_perfil()));

create policy "perfil ativo full access frequencias" on public.frequencias for all to authenticated
  using (escola_id = (select escola_id from current_perfil()))
  with check (escola_id = (select escola_id from current_perfil()));

create policy "perfil ativo full access historico matriculas" on public.historico_matriculas for all to authenticated
  using (escola_id = (select escola_id from current_perfil()))
  with check (escola_id = (select escola_id from current_perfil()));

create policy "perfil ativo full access importacao linhas" on public.importacao_alunos_linhas for all to authenticated
  using (escola_id = (select escola_id from current_perfil()))
  with check (escola_id = (select escola_id from current_perfil()));

create policy "perfil ativo full access medicas" on public.informacoes_medicas for all to authenticated
  using (exists (select 1 from alunos a where a.id = informacoes_medicas.aluno_id and a.escola_id = (select escola_id from current_perfil())))
  with check (exists (select 1 from alunos a where a.id = informacoes_medicas.aluno_id and a.escola_id = (select escola_id from current_perfil())));

create policy "perfil ativo full access matriculas" on public.matriculas for all to authenticated
  using (escola_id = (select escola_id from current_perfil()))
  with check (escola_id = (select escola_id from current_perfil()));

create policy "perfil ativo full access notificacoes responsavel" on public.notificacoes_responsavel for all to authenticated
  using (escola_id = (select escola_id from current_perfil()))
  with check (escola_id = (select escola_id from current_perfil()));

create policy "perfil ativo full access pagamentos" on public.pagamentos for all to authenticated
  using (escola_id = (select escola_id from current_perfil()))
  with check (escola_id = (select escola_id from current_perfil()));

create policy "perfil admin manage" on public.perfis for all to authenticated
  using (escola_id = (select escola_id from current_perfil()) and (select perfil from current_perfil()) = 'admin')
  with check (escola_id = (select escola_id from current_perfil()) and (select perfil from current_perfil()) = 'admin');

create policy "perfil self read" on public.perfis for select to authenticated
  using (user_id = auth.uid() or escola_id = (select escola_id from current_perfil()));

create policy "perfil ativo full access autorizadas" on public.pessoas_autorizadas for all to authenticated
  using (exists (select 1 from alunos a where a.id = pessoas_autorizadas.aluno_id and a.escola_id = (select escola_id from current_perfil())))
  with check (exists (select 1 from alunos a where a.id = pessoas_autorizadas.aluno_id and a.escola_id = (select escola_id from current_perfil())));

create policy "perfil ativo full access planos" on public.planos for all to authenticated
  using (escola_id = (select escola_id from current_perfil()))
  with check (escola_id = (select escola_id from current_perfil()));

create policy "perfil ativo full access preferencias notificacao" on public.preferencias_notificacao_aluno for all to authenticated
  using (exists (select 1 from alunos a where a.id = preferencias_notificacao_aluno.aluno_id and a.escola_id = (select escola_id from current_perfil())))
  with check (exists (select 1 from alunos a where a.id = preferencias_notificacao_aluno.aluno_id and a.escola_id = (select escola_id from current_perfil())));

create policy "perfil ativo full access responsaveis" on public.responsaveis_aluno for all to authenticated
  using (exists (select 1 from alunos a where a.id = responsaveis_aluno.aluno_id and a.escola_id = (select escola_id from current_perfil())))
  with check (exists (select 1 from alunos a where a.id = responsaveis_aluno.aluno_id and a.escola_id = (select escola_id from current_perfil())));

create policy "perfil ativo full access series" on public.series for all to authenticated
  using (escola_id = (select escola_id from current_perfil()))
  with check (escola_id = (select escola_id from current_perfil()));

create policy "perfil ativo full access turmas" on public.turmas for all to authenticated
  using (escola_id = (select escola_id from current_perfil()))
  with check (escola_id = (select escola_id from current_perfil()));

create policy "despesas_comprovantes_rw" on storage.objects for all to authenticated
  using (bucket_id = 'despesas-comprovantes' and exists (select 1 from current_perfil()))
  with check (bucket_id = 'despesas-comprovantes' and exists (select 1 from current_perfil()));

create policy "perfil ativo delete biometrias" on storage.objects for delete to authenticated
  using (bucket_id = 'biometrias-alunos' and exists (select 1 from current_perfil()));

create policy "perfil ativo delete documentos" on storage.objects for delete to authenticated
  using (bucket_id = 'documentos-alunos' and exists (select 1 from current_perfil()));

create policy "perfil ativo delete fotos" on storage.objects for delete to authenticated
  using (bucket_id = 'alunos-fotos' and exists (select 1 from current_perfil()));

create policy "perfil ativo delete importacoes" on storage.objects for delete to authenticated
  using (bucket_id = 'importacoes' and exists (select 1 from current_perfil()));

create policy "perfil ativo read biometrias" on storage.objects for select to authenticated
  using (bucket_id = 'biometrias-alunos' and exists (select 1 from current_perfil()));

create policy "perfil ativo read documentos" on storage.objects for select to authenticated
  using (bucket_id = 'documentos-alunos' and exists (select 1 from current_perfil()));

create policy "perfil ativo read fotos" on storage.objects for select to authenticated
  using (bucket_id = 'alunos-fotos' and exists (select 1 from current_perfil()));

create policy "perfil ativo read importacoes" on storage.objects for select to authenticated
  using (bucket_id = 'importacoes' and exists (select 1 from current_perfil()));

create policy "perfil ativo update biometrias" on storage.objects for update to authenticated
  using (bucket_id = 'biometrias-alunos' and exists (select 1 from current_perfil()))
  with check (bucket_id = 'biometrias-alunos' and exists (select 1 from current_perfil()));

create policy "perfil ativo update documentos" on storage.objects for update to authenticated
  using (bucket_id = 'documentos-alunos' and exists (select 1 from current_perfil()))
  with check (bucket_id = 'documentos-alunos' and exists (select 1 from current_perfil()));

create policy "perfil ativo update fotos" on storage.objects for update to authenticated
  using (bucket_id = 'alunos-fotos' and exists (select 1 from current_perfil()))
  with check (bucket_id = 'alunos-fotos' and exists (select 1 from current_perfil()));

create policy "perfil ativo update importacoes" on storage.objects for update to authenticated
  using (bucket_id = 'importacoes' and exists (select 1 from current_perfil()))
  with check (bucket_id = 'importacoes' and exists (select 1 from current_perfil()));

create policy "perfil ativo write biometrias" on storage.objects for insert to authenticated
  with check (bucket_id = 'biometrias-alunos' and exists (select 1 from current_perfil()));

create policy "perfil ativo write documentos" on storage.objects for insert to authenticated
  with check (bucket_id = 'documentos-alunos' and exists (select 1 from current_perfil()));

create policy "perfil ativo write fotos" on storage.objects for insert to authenticated
  with check (bucket_id = 'alunos-fotos' and exists (select 1 from current_perfil()));

create policy "perfil ativo write importacoes" on storage.objects for insert to authenticated
  with check (bucket_id = 'importacoes' and exists (select 1 from current_perfil()));

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
where grupo in ('financeiro','secretaria','academico','rh')
   or codigo = 'relatorios';

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
where grupo in ('pedagogico','secretaria','academico')
   or codigo = 'relatorios';

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
    and (escola_id = (select escola_id from current_perfil()) or escola_id is null)
    and sistema = false
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

grant execute on function has_permission(text, text) to authenticated;
