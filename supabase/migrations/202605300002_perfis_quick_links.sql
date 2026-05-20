alter table perfis
  add column if not exists quick_links jsonb not null default '[]'::jsonb;
