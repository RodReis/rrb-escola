-- Reestrutura series + turmas para padrao:
-- INFANTIL: MATERNAL, INFANTIL2..4 (M+V)
-- FUNDAMENTAL1: 1..5 ANO (M+V)
-- FUNDAMENTAL2: 6..9 ANO (M)
-- MEDIO: 1..3 SERIE (M)
-- Turmas: nome = turno ("MATUTINO" / "VESPERTINO")
-- Remapeia matriculas existentes preservando turno (default MATUTINO se faltar).

begin;

-- 0. renomeia segmentos
update segmentos set nome = 'INFANTIL'     where id = 'a0000000-0000-0000-0000-000000000001';
update segmentos set nome = 'FUNDAMENTAL1' where id = 'a0000000-0000-0000-0000-000000000002';
update segmentos set nome = 'FUNDAMENTAL2' where id = 'a0000000-0000-0000-0000-000000000003';
update segmentos set nome = 'MÉDIO'        where id = 'a0000000-0000-0000-0000-000000000004';

create temp table _serie_map (
  old_id uuid,
  new_id uuid not null,
  new_nome text not null,
  segmento segmento_serie not null,
  segmento_id uuid not null,
  ordem int not null,
  permite_vespertino boolean not null
);

create temp table _turma_map (
  old_id uuid,
  new_id uuid
);

-- 1. cria/encontra series novas (canonicas)
with novas as (
  insert into series (id, escola_id, nome, ordem, segmento, segmento_id, ativo)
  values
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 'MATERNAL',   1, 'INFANTIL',     'a0000000-0000-0000-0000-000000000001', true),
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 'INFANTIL2',  2, 'INFANTIL',     'a0000000-0000-0000-0000-000000000001', true),
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 'INFANTIL3',  3, 'INFANTIL',     'a0000000-0000-0000-0000-000000000001', true),
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 'INFANTIL4',  4, 'INFANTIL',     'a0000000-0000-0000-0000-000000000001', true),
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', '1º ANO',     5, 'FUNDAMENTAL1', 'a0000000-0000-0000-0000-000000000002', true),
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', '2º ANO',     6, 'FUNDAMENTAL1', 'a0000000-0000-0000-0000-000000000002', true),
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', '3º ANO',     7, 'FUNDAMENTAL1', 'a0000000-0000-0000-0000-000000000002', true),
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', '4º ANO',     8, 'FUNDAMENTAL1', 'a0000000-0000-0000-0000-000000000002', true),
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', '5º ANO',     9, 'FUNDAMENTAL1', 'a0000000-0000-0000-0000-000000000002', true),
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', '6º ANO',    10, 'FUNDAMENTAL2', 'a0000000-0000-0000-0000-000000000003', true),
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', '7º ANO',    11, 'FUNDAMENTAL2', 'a0000000-0000-0000-0000-000000000003', true),
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', '8º ANO',    12, 'FUNDAMENTAL2', 'a0000000-0000-0000-0000-000000000003', true),
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', '9º ANO',    13, 'FUNDAMENTAL2', 'a0000000-0000-0000-0000-000000000003', true),
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', '1ª SÉRIE',  14, 'MEDIO',        'a0000000-0000-0000-0000-000000000004', true),
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', '2ª SÉRIE',  15, 'MEDIO',        'a0000000-0000-0000-0000-000000000004', true),
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', '3ª SÉRIE',  16, 'MEDIO',        'a0000000-0000-0000-0000-000000000004', true)
  returning id, nome, segmento, segmento_id, ordem
)
insert into _serie_map (new_id, new_nome, segmento, segmento_id, ordem, permite_vespertino)
select id, nome, segmento, segmento_id, ordem,
  case when segmento in ('INFANTIL','FUNDAMENTAL1') then true else false end
from novas;

-- 2. mapeia series antigas -> novas via lookup pelo nome
update _serie_map sm set old_id = s.id
from series s
where s.escola_id = '00000000-0000-0000-0000-000000000001'
  and s.id <> sm.new_id
  and (
    (sm.new_nome = 'MATERNAL'  and s.nome in ('Maternal','Infantil I'))
    or (sm.new_nome = 'INFANTIL2' and s.nome in ('Infantil II','Infantil 3'))
    or (sm.new_nome = 'INFANTIL3' and s.nome in ('Infantil III','Infantil 4'))
    or (sm.new_nome = 'INFANTIL4' and s.nome = 'Infantil 5')
    or (sm.new_nome = '1º ANO' and s.nome = '1º Ano')
    or (sm.new_nome = '2º ANO' and s.nome = '2º Ano')
    or (sm.new_nome = '3º ANO' and s.nome = '3º Ano')
    or (sm.new_nome = '4º ANO' and s.nome = '4º Ano')
    or (sm.new_nome = '5º ANO' and s.nome = '5º Ano')
    or (sm.new_nome = '6º ANO' and s.nome = '6º Ano')
    or (sm.new_nome = '7º ANO' and s.nome = '7º Ano')
    or (sm.new_nome = '8º ANO' and s.nome = '8º Ano')
    or (sm.new_nome = '9º ANO' and s.nome = '9º Ano')
    or (sm.new_nome = '1ª SÉRIE' and s.nome = '1ª Série')
    or (sm.new_nome = '2ª SÉRIE' and s.nome = '2ª Série')
    or (sm.new_nome = '3ª SÉRIE' and s.nome = '3ª Série')
  );

-- versao expandida: cada serie antiga aponta pra new_id correspondente
create temp table _serie_old_to_new as
select s.id as old_id, sm.new_id, sm.new_nome, sm.segmento, sm.permite_vespertino
from series s
join _serie_map sm on (
    (sm.new_nome = 'MATERNAL'  and s.nome in ('Maternal','Infantil I'))
    or (sm.new_nome = 'INFANTIL2' and s.nome in ('Infantil II','Infantil 3'))
    or (sm.new_nome = 'INFANTIL3' and s.nome in ('Infantil III','Infantil 4'))
    or (sm.new_nome = 'INFANTIL4' and s.nome = 'Infantil 5')
    or (sm.new_nome = '1º ANO' and s.nome = '1º Ano')
    or (sm.new_nome = '2º ANO' and s.nome = '2º Ano')
    or (sm.new_nome = '3º ANO' and s.nome = '3º Ano')
    or (sm.new_nome = '4º ANO' and s.nome = '4º Ano')
    or (sm.new_nome = '5º ANO' and s.nome = '5º Ano')
    or (sm.new_nome = '6º ANO' and s.nome = '6º Ano')
    or (sm.new_nome = '7º ANO' and s.nome = '7º Ano')
    or (sm.new_nome = '8º ANO' and s.nome = '8º Ano')
    or (sm.new_nome = '9º ANO' and s.nome = '9º Ano')
    or (sm.new_nome = '1ª SÉRIE' and s.nome = '1ª Série')
    or (sm.new_nome = '2ª SÉRIE' and s.nome = '2ª Série')
    or (sm.new_nome = '3ª SÉRIE' and s.nome = '3ª Série')
  )
where s.escola_id = '00000000-0000-0000-0000-000000000001';

-- 3. cria turmas novas (1 por serie x turno permitido) por ano letivo presente
-- Coleta todos (ano_letivo, new_id, turno) que existem em turmas antigas via mapping
create temp table _turma_target as
select distinct
  son.new_id as serie_id,
  t.ano_letivo,
  case
    when son.permite_vespertino and t.turno = 'vespertino' then 'vespertino'::turno_turma
    else 'matutino'::turno_turma
  end as turno
from turmas t
join _serie_old_to_new son on son.old_id = t.serie_id;

create temp table _turma_nova as
select gen_random_uuid() as id, serie_id, ano_letivo, turno from _turma_target;

insert into turmas (id, escola_id, serie_id, nome, ano_letivo, turno, ativo)
select id, '00000000-0000-0000-0000-000000000001', serie_id,
       case turno when 'matutino' then 'MATUTINO' else 'VESPERTINO' end,
       ano_letivo, turno, true
from _turma_nova;

-- 4. mapping turma antiga -> turma nova (por serie_id, ano_letivo, turno)
insert into _turma_map (old_id, new_id)
select t.id,
       tn.id
from turmas t
join _serie_old_to_new son on son.old_id = t.serie_id
join _turma_nova tn on tn.serie_id = son.new_id
                    and tn.ano_letivo = t.ano_letivo
                    and tn.turno = (case
                      when son.permite_vespertino and t.turno = 'vespertino' then 'vespertino'::turno_turma
                      else 'matutino'::turno_turma
                    end);

-- 5. remapeia matriculas
update matriculas m
   set serie_id = son.new_id,
       turma_id = tm.new_id
  from _serie_old_to_new son
  join _turma_map tm on true
 where m.serie_id = son.old_id
   and tm.old_id = m.turma_id;

-- 6. drop turmas antigas (sem matriculas vinculadas agora)
delete from turmas
 where serie_id in (select old_id from _serie_old_to_new)
   and id not in (select new_id from _turma_map);

-- 7. drop series antigas
delete from series
 where id in (select old_id from _serie_old_to_new);

-- 8. relatorio
select 'series novas' tipo, count(*) qtd from series where escola_id='00000000-0000-0000-0000-000000000001'
union all select 'turmas novas', count(*) from turmas where escola_id='00000000-0000-0000-0000-000000000001'
union all select 'matriculas remapeadas', count(*) from matriculas where serie_id in (select new_id from _serie_map);

commit;
