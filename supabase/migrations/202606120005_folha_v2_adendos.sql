alter table public.folha_contratos
  add column if not exists cargo text,
  add column if not exists cbo text,
  add column if not exists aulas_por_turno jsonb;

alter table public.irrf_redutor
  add column if not exists coef_fixo numeric(12,2) not null default 978.62,
  add column if not exists coef_mult numeric(10,6) not null default 0.133145;

update public.irrf_redutor
  set coef_fixo = 978.62, coef_mult = 0.133145
  where coef_fixo is null or coef_mult is null;

update public.folha_rubricas
  set metodo_calculo = 'percentual_sobre_base'
  where codigo = 'sindicato' and metodo_calculo = 'valor_contratual';
