-- Migração: remoção da folha de pagamento legada (motor v1 / payroll)
-- A folha v2 (folha_runs/folha_itens/folha_contratos) substitui completamente o legado.
-- Dados de salário foram migrados para folha_contratos antes desta remoção.
--
-- IRREVERSÍVEL: dropa as tabelas payroll e as colunas legadas de employees.
-- inss_brackets / ir_brackets NÃO são tocadas (compartilhadas com a folha v2).

-- 1. Tabelas exclusivas da folha antiga
drop table if exists public.payroll_import_cache cascade;
drop table if exists public.payroll_periods cascade;
drop table if exists public.payroll cascade;

-- 2. Colunas legadas em employees (base contratual agora vive em folha_contratos)
alter table public.employees drop column if exists base_salary;
alter table public.employees drop column if exists salario_sem_dsr;
alter table public.employees drop column if exists aplica_dobra;
alter table public.employees drop column if exists gps_default;
