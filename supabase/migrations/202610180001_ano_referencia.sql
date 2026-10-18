alter table public.escolas
  add column if not exists ano_referencia_atual int not null
    default extract(year from now())::int;
