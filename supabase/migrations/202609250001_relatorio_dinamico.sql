-- Relatórios/Etiquetas dinâmicos (spec 2026-09-25): RBAC dos 3 relatórios,
-- templates de leiaute por escola e vínculo funcionário (RH) ↔ usuário professor.

-- 1) RBAC
insert into modulos (codigo, grupo, nome, ordem) values
  ('relatorios.dinamico-aluno',       'operacional', 'Relatório Dinâmico — Alunos', 42),
  ('relatorios.dinamico-funcionario', 'operacional', 'Relatório Dinâmico — Funcionários', 43),
  ('relatorios.dinamico-professor',   'operacional', 'Relatório Dinâmico — Professores', 44)
on conflict (codigo) do nothing;

insert into role_permissoes (role_codigo, modulo_codigo, pode_ler, pode_criar, pode_editar, pode_deletar) values
  ('admin',      'relatorios.dinamico-aluno',       true,  true,  true,  true),
  ('admin',      'relatorios.dinamico-funcionario', true,  true,  true,  true),
  ('admin',      'relatorios.dinamico-professor',   true,  true,  true,  true),
  ('secretaria', 'relatorios.dinamico-aluno',       true,  true,  true,  true),
  ('secretaria', 'relatorios.dinamico-funcionario', false, false, false, false),
  ('secretaria', 'relatorios.dinamico-professor',   true,  true,  true,  true),
  ('financeiro', 'relatorios.dinamico-aluno',       false, false, false, false),
  ('financeiro', 'relatorios.dinamico-funcionario', true,  true,  true,  true),
  ('financeiro', 'relatorios.dinamico-professor',   true,  true,  true,  true),
  ('professor',  'relatorios.dinamico-aluno',       false, false, false, false),
  ('professor',  'relatorios.dinamico-funcionario', false, false, false, false),
  ('professor',  'relatorios.dinamico-professor',   false, false, false, false)
on conflict (role_codigo, modulo_codigo) do nothing;

-- 2) Templates de leiaute
create table if not exists public.relatorio_templates (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references escolas(id) on delete cascade,
  entidade text not null check (entidade in ('aluno','funcionario','professor')),
  nome text not null check (length(trim(nome)) between 1 and 120),
  config jsonb not null,
  criado_por uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (escola_id, entidade, nome)
);

create index if not exists relatorio_templates_escola_entidade_idx
  on relatorio_templates (escola_id, entidade);

create trigger relatorio_templates_updated_at before update on relatorio_templates
  for each row execute function set_updated_at();

alter table relatorio_templates enable row level security;

create policy relatorio_templates_service on relatorio_templates
  for all to service_role using (true) with check (true);

create policy relatorio_templates_select on relatorio_templates
  for select to authenticated
  using (escola_id = (select escola_id from current_perfil())
         and has_permission('relatorios.dinamico-' || entidade, 'read'));

create policy relatorio_templates_insert on relatorio_templates
  for insert to authenticated
  with check (escola_id = (select escola_id from current_perfil())
              and has_permission('relatorios.dinamico-' || entidade, 'create'));

create policy relatorio_templates_update on relatorio_templates
  for update to authenticated
  using (escola_id = (select escola_id from current_perfil())
         and has_permission('relatorios.dinamico-' || entidade, 'update'))
  with check (escola_id = (select escola_id from current_perfil())
              and has_permission('relatorios.dinamico-' || entidade, 'update'));

create policy relatorio_templates_delete on relatorio_templates
  for delete to authenticated
  using (escola_id = (select escola_id from current_perfil())
         and has_permission('relatorios.dinamico-' || entidade, 'delete'));

grant select, insert, update, delete on relatorio_templates to authenticated;

-- 3) Vínculo funcionário (RH) ↔ usuário professor (perfis)
alter table public.employees
  add column if not exists perfil_id uuid unique references public.perfis(id) on delete set null;

-- Backfill por e-mail: só matches 1↔1 (e-mail duplicado em qualquer lado é ignorado).
do $$
declare
  v_ligados int;
  v_ambiguos int;
begin
  with pares as (
    select e.id as employee_id, p.id as perfil_id
    from employees e
    join perfis p on p.perfil = 'professor' and lower(trim(p.email)) = lower(trim(e.email))
    where e.perfil_id is null and e.email is not null and trim(e.email) <> ''
  ),
  unicos as (
    select employee_id, min(perfil_id::text)::uuid as perfil_id
    from pares
    where employee_id in (select employee_id from pares group by employee_id having count(*) = 1)
      and perfil_id in (select perfil_id from pares group by perfil_id having count(*) = 1)
      and perfil_id not in (select perfil_id from employees where perfil_id is not null)
    group by employee_id
  )
  update employees e set perfil_id = u.perfil_id
  from unicos u where e.id = u.employee_id;
  get diagnostics v_ligados = row_count;

  select count(*) into v_ambiguos
  from employees e
  where e.perfil_id is null and e.email is not null
    and (select count(*) from perfis p
         where p.perfil = 'professor' and lower(trim(p.email)) = lower(trim(e.email))) > 1;

  raise notice 'relatorio_dinamico: % funcionários vinculados por e-mail; % ambíguos ignorados', v_ligados, v_ambiguos;
end $$;
