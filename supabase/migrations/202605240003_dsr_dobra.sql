-- employees: dados contratuais default
alter table public.employees
  add column if not exists salario_sem_dsr numeric(10,2) default 0,
  add column if not exists aplica_dobra boolean default false;

-- payroll: override mensal (NULL = não preenchido; preenchido após save)
alter table public.payroll
  add column if not exists salario_sem_dsr numeric(10,2),
  add column if not exists aplica_dobra boolean;
