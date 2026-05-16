-- GPS deduction: employee default + per-row override
alter table public.employees
  add column if not exists gps_default numeric(10,2) default 0;

alter table public.payroll
  add column if not exists gps numeric(10,2);
