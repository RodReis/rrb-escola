-- RLS policies for RH/payroll tables missing from original migrations.
-- Defensivo: estas tabelas são criadas em migrations posteriores (rh_base_schema,
-- payroll_v2). Cada policy só é criada se a tabela-alvo já existir e a policy ainda
-- não existir. As policies definitivas estão garantidas em 202606120006 (idempotente).

do $$
declare
  alvo record;
begin
  for alvo in
    select * from (values
      ('inss_brackets', 'inss_brackets read', 'select', false),
      ('ir_brackets',   'ir_brackets read',   'select', false),
      ('companies',     'companies rw',       'all',    true),
      ('employees',     'employees rw',       'all',    true),
      ('payroll',       'payroll rw',         'all',    true),
      ('payroll_periods', 'payroll_periods rw', 'all',  true),
      ('payroll_import_cache', 'payroll_import_cache rw', 'all', true)
    ) as t(tabela, policy_nome, acao, com_check)
  loop
    if exists (select 1 from information_schema.tables
               where table_schema = 'public' and table_name = alvo.tabela)
       and not exists (select 1 from pg_policies
               where schemaname = 'public' and tablename = alvo.tabela and policyname = alvo.policy_nome)
    then
      if alvo.com_check then
        execute format('create policy %I on public.%I for all to authenticated using (true) with check (true)',
          alvo.policy_nome, alvo.tabela);
      else
        execute format('create policy %I on public.%I for select to authenticated using (true)',
          alvo.policy_nome, alvo.tabela);
      end if;
    end if;
  end loop;
end $$;
