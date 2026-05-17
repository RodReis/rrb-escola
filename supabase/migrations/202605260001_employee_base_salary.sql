-- Employee default base salary
alter table public.employees
  add column if not exists base_salary numeric(10,2) default 0;
