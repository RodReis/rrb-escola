-- Qualifica despesa como fixa (recorrente todo mes) ou variavel (pontual)

alter table despesas
  add column tipo text not null default 'variavel'
  check (tipo in ('fixa', 'variavel'));

create index if not exists despesas_tipo_idx on despesas (tipo);

comment on column despesas.tipo is
  'fixa = recorrente mensal (aluguel, agua, luz, internet); variavel = pontual';

-- Backfill: categorias historicamente fixas
update despesas d
set tipo = 'fixa'
where d.categoria_id in (
  select id from categorias_despesa
  where nome in ('Aluguel', 'Água', 'Luz', 'Internet')
);
