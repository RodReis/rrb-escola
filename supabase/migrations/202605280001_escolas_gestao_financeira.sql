-- Adiciona modelo de gestão financeira por escola
-- 'propria': escola controla cobrança/inadimplência internamente
-- 'terceirizada': cobrança operada por terceiro, sem inadimplência visível

alter table escolas
  add column if not exists gestao_financeira text not null default 'propria'
  check (gestao_financeira in ('propria', 'terceirizada'));

-- CRM Escola opera com cobrança terceirizada
update escolas
  set gestao_financeira = 'terceirizada'
  where id = '00000000-0000-0000-0000-000000000001';

comment on column escolas.gestao_financeira is
  'Modelo de cobrança: propria (escola controla) | terceirizada (operador externo)';
