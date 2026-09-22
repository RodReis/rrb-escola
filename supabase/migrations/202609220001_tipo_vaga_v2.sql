-- Substitui o enum tipo_vaga (paga/bolsa_integral/bolsa_parcial/permuta/gratuita)
-- por um novo conjunto com mais granularidade de benefícios.
-- Dados reais em produção antes desta migration: paga (2283), bolsa_integral (1),
-- permuta (1), gratuita (1). Nenhuma linha usava bolsa_parcial.

create type tipo_vaga_v2 as enum (
  'NORMAL',
  'BOLSA_50_PORCENTO',
  'BOLSA_INTEGRAL',
  'FILHO_PROFESSORA',
  'FILHO_PROFESSORA_INTEGRAL',
  'PERMUTA',
  'ISENTO'
);

alter table matriculas add column tipo_vaga_v2 tipo_vaga_v2;

update matriculas set tipo_vaga_v2 = case tipo_vaga
  when 'paga' then 'NORMAL'
  when 'bolsa_integral' then 'BOLSA_INTEGRAL'
  when 'bolsa_parcial' then 'BOLSA_50_PORCENTO'
  when 'permuta' then 'PERMUTA'
  when 'gratuita' then 'ISENTO'
end::tipo_vaga_v2;

alter table matriculas alter column tipo_vaga_v2 set not null;
alter table matriculas alter column tipo_vaga_v2 set default 'NORMAL';

-- BOLSA_50_PORCENTO é sempre 50% fixo agora (sem input manual); demais tipos não bolsam percentual.
update matriculas set percentual_bolsa = 50 where tipo_vaga_v2 = 'BOLSA_50_PORCENTO';
update matriculas set percentual_bolsa = 0 where tipo_vaga_v2 <> 'BOLSA_50_PORCENTO';

alter table matriculas drop constraint matriculas_bolsa_parcial_check;
alter table matriculas drop column tipo_vaga;
alter table matriculas rename column tipo_vaga_v2 to tipo_vaga;
drop type tipo_vaga;
alter type tipo_vaga_v2 rename to tipo_vaga;

alter table matriculas
  add constraint matriculas_bolsa_50_check
  check (
    (tipo_vaga = 'BOLSA_50_PORCENTO' and percentual_bolsa = 50)
    or (tipo_vaga <> 'BOLSA_50_PORCENTO' and percentual_bolsa = 0)
  );

comment on column matriculas.tipo_vaga is
  'NORMAL | BOLSA_50_PORCENTO | BOLSA_INTEGRAL | FILHO_PROFESSORA | FILHO_PROFESSORA_INTEGRAL | PERMUTA | ISENTO';
comment on column matriculas.percentual_bolsa is
  'Sempre 50 quando tipo_vaga=BOLSA_50_PORCENTO; 0 nos demais casos.';
