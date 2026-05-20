create table if not exists public.payroll_import_cache (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null,
  created_at timestamptz not null default now()
);
