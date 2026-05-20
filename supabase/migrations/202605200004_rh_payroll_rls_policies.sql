-- RLS policies for RH/payroll tables missing from original migrations

-- Reference tables: read for all authenticated
create policy "inss_brackets read" on public.inss_brackets
  for select to authenticated using (true);

create policy "ir_brackets read" on public.ir_brackets
  for select to authenticated using (true);

-- RH tables: full access for authenticated (no escola_id — company-scoped)
create policy "companies rw" on public.companies
  for all to authenticated using (true) with check (true);

create policy "employees rw" on public.employees
  for all to authenticated using (true) with check (true);

create policy "payroll rw" on public.payroll
  for all to authenticated using (true) with check (true);

create policy "payroll_periods rw" on public.payroll_periods
  for all to authenticated using (true) with check (true);

create policy "payroll_import_cache rw" on public.payroll_import_cache
  for all to authenticated using (true) with check (true);
