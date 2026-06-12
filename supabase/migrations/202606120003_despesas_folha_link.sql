alter table public.despesas add column if not exists folha_run_id uuid references folha_runs(id) on delete set null;
create index if not exists despesas_folha_run_idx on despesas (folha_run_id);
