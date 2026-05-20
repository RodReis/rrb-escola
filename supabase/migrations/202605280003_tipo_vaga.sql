-- Tipo de vaga: classifica matrículas pagantes vs beneficiadas

create type tipo_vaga as enum (
  'paga',
  'bolsa_integral',
  'bolsa_parcial',
  'permuta',
  'gratuita'
);

alter table matriculas
  add column tipo_vaga tipo_vaga not null default 'paga',
  add column percentual_bolsa numeric(5,2) not null default 0
    check (percentual_bolsa >= 0 and percentual_bolsa <= 100);

alter table matriculas
  add constraint matriculas_bolsa_parcial_check
  check (
    (tipo_vaga = 'bolsa_parcial' and percentual_bolsa > 0 and percentual_bolsa < 100)
    or (tipo_vaga <> 'bolsa_parcial' and percentual_bolsa = 0)
  );

comment on column matriculas.tipo_vaga is
  'paga | bolsa_integral | bolsa_parcial | permuta | gratuita';
comment on column matriculas.percentual_bolsa is
  '0-100; apenas válido quando tipo_vaga=bolsa_parcial';
