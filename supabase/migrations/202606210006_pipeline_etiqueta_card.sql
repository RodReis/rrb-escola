-- Pipeline: etiqueta visual no card (cor + label)

alter table pipeline_card
  add column if not exists etiqueta_cor   text null,
  add column if not exists etiqueta_label text null;

alter table pipeline_card
  add constraint pipeline_card_etiqueta_cor_valida
  check (etiqueta_cor is null or etiqueta_cor in (
    'verde', 'azul', 'amarelo', 'vermelho', 'roxo', 'laranja', 'cinza'
  ));
