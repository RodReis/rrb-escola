-- Garantia idempotente das policies RLS de RH/payroll que a 202605200004
-- não pôde criar por rodar antes das tabelas existirem.

do $$
declare
  alvo record;
begin
  for alvo in
    select * from (values
      ('inss_brackets', 'inss_brackets read', false),
      ('ir_brackets',   'ir_brackets read',   false),
      ('companies',     'companies rw',       true),
      ('employees',     'employees rw',       true),
      ('payroll',       'payroll rw',         true),
      ('payroll_periods', 'payroll_periods rw', true),
      ('payroll_import_cache', 'payroll_import_cache rw', true)
    ) as t(tabela, policy_nome, com_check)
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
