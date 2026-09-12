-- Importa notas do boletim (1o e 2o bimestre 2026) da turma 8o ANO A - Matutino.
-- Mesmo padrao das migrations 202609110010/011 (6o/7o ANO): reaproveita disciplinas
-- seed sem uso (Ciencias -> Ciencias da Natureza, Producao Textual -> Redacao) e cria
-- Literatura, Filosofia, Matematica Complementar.
-- Izabela Santana Cortes excluida: boletim sem nenhuma nota lancada.
-- Fonte: Resultado - 8 ANO - MATUTINO.pdf.
-- Turma resolvida dinamicamente pela matricula 2026 dos alunos do boletim.

create or replace function pg_temp.norm_nome(txt text) returns text as $$
  select upper(translate(txt,
    'áàâãäÁÀÂÃÄéèêëÉÈÊËíìîïÍÌÎÏóòôõöÓÒÔÕÖúùûüÚÙÛÜçÇñÑ',
    'aaaaaAAAAAeeeeEEEEiiiiIIIIooooOOOOOOuuuuUUUUcCnN'
  ));
$$ language sql immutable;

update disciplinas set nome = 'Ciencias da Natureza'
where serie_id = '17f4c5aa-0cae-4c98-a9e5-72787a9027ef' and nome = 'Ciencias';

update disciplinas set nome = 'Redacao'
where serie_id = '17f4c5aa-0cae-4c98-a9e5-72787a9027ef' and nome = 'Producao Textual';

insert into disciplinas (escola_id, serie_id, nome, ordem)
select '00000000-0000-0000-0000-000000000001'::uuid, '17f4c5aa-0cae-4c98-a9e5-72787a9027ef'::uuid, nome, ordem
from (values
  ('Literatura', 10),
  ('Filosofia', 11),
  ('Matematica Complementar', 12)
) as novas(nome, ordem)
on conflict (escola_id, serie_id, nome) do nothing;

create temp table stg_boletim_8ano_a (
  aluno_nome text,
  disciplina text,
  b1 numeric(5,2),
  b2 numeric(5,2)
) on commit drop;

insert into stg_boletim_8ano_a (aluno_nome, disciplina, b1, b2) values
  ('DAVI LUCA PEREIRA DOMINGUES','Filosofia',10.0,10.0),
  ('DAVI LUCA PEREIRA DOMINGUES','Matematica',7.6,8.3),
  ('DAVI LUCA PEREIRA DOMINGUES','Redacao',9.5,10.0),
  ('DAVI LUCA PEREIRA DOMINGUES','Literatura',9.5,10.0),
  ('DAVI LUCA PEREIRA DOMINGUES','Ciencias da Natureza',8.6,7.7),
  ('DAVI LUCA PEREIRA DOMINGUES','Matematica Complementar',7.1,7.0),
  ('DAVI LUCA PEREIRA DOMINGUES','Portugues',9.0,7.6),
  ('DAVI LUCA PEREIRA DOMINGUES','Historia',8.8,7.7),
  ('DAVI LUCA PEREIRA DOMINGUES','Geografia',8.2,8.2),
  ('DAVI LUCA PEREIRA DOMINGUES','Artes',10.0,9.5),
  ('DAVI LUCA PEREIRA DOMINGUES','Educacao Fisica',10.0,10.0),
  ('DAVI LUCA PEREIRA DOMINGUES','Ingles',9.1,10.0),
  ('EMANUELLY BASTOS SANTOS','Filosofia',10.0,10.0),
  ('EMANUELLY BASTOS SANTOS','Matematica',9.5,9.2),
  ('EMANUELLY BASTOS SANTOS','Redacao',9.5,10.0),
  ('EMANUELLY BASTOS SANTOS','Literatura',9.5,9.5),
  ('EMANUELLY BASTOS SANTOS','Ciencias da Natureza',9.3,7.7),
  ('EMANUELLY BASTOS SANTOS','Matematica Complementar',7.5,7.2),
  ('EMANUELLY BASTOS SANTOS','Portugues',9.5,8.7),
  ('EMANUELLY BASTOS SANTOS','Historia',9.9,8.3),
  ('EMANUELLY BASTOS SANTOS','Geografia',8.2,8.1),
  ('EMANUELLY BASTOS SANTOS','Artes',10.0,10.0),
  ('EMANUELLY BASTOS SANTOS','Educacao Fisica',10.0,10.0),
  ('EMANUELLY BASTOS SANTOS','Ingles',9.6,8.3),
  ('ENZO RAFAEL FERNANDES MARIANO SERSOCIMA','Filosofia',10.0,10.0),
  ('ENZO RAFAEL FERNANDES MARIANO SERSOCIMA','Matematica',7.8,6.6),
  ('ENZO RAFAEL FERNANDES MARIANO SERSOCIMA','Redacao',9.0,10.0),
  ('ENZO RAFAEL FERNANDES MARIANO SERSOCIMA','Literatura',10.0,10.0),
  ('ENZO RAFAEL FERNANDES MARIANO SERSOCIMA','Ciencias da Natureza',8.3,8.2),
  ('ENZO RAFAEL FERNANDES MARIANO SERSOCIMA','Matematica Complementar',7.6,8.2),
  ('ENZO RAFAEL FERNANDES MARIANO SERSOCIMA','Portugues',8.2,7.4),
  ('ENZO RAFAEL FERNANDES MARIANO SERSOCIMA','Historia',9.8,7.3),
  ('ENZO RAFAEL FERNANDES MARIANO SERSOCIMA','Geografia',8.7,8.7),
  ('ENZO RAFAEL FERNANDES MARIANO SERSOCIMA','Artes',10.0,10.0),
  ('ENZO RAFAEL FERNANDES MARIANO SERSOCIMA','Educacao Fisica',10.0,10.0),
  ('ENZO RAFAEL FERNANDES MARIANO SERSOCIMA','Ingles',9.1,8.0),
  ('FELIPE DORNELES DE QUEIROZ','Filosofia',10.0,10.0),
  ('FELIPE DORNELES DE QUEIROZ','Matematica',7.2,7.4),
  ('FELIPE DORNELES DE QUEIROZ','Redacao',9.5,7.5),
  ('FELIPE DORNELES DE QUEIROZ','Literatura',9.5,9.0),
  ('FELIPE DORNELES DE QUEIROZ','Ciencias da Natureza',8.3,7.1),
  ('FELIPE DORNELES DE QUEIROZ','Matematica Complementar',6.1,2.7),
  ('FELIPE DORNELES DE QUEIROZ','Portugues',8.2,7.8),
  ('FELIPE DORNELES DE QUEIROZ','Historia',8.0,6.6),
  ('FELIPE DORNELES DE QUEIROZ','Geografia',7.8,6.2),
  ('FELIPE DORNELES DE QUEIROZ','Artes',10.0,9.4),
  ('FELIPE DORNELES DE QUEIROZ','Educacao Fisica',10.0,10.0),
  ('FELIPE DORNELES DE QUEIROZ','Ingles',7.8,7.6),
  ('GUSTAVO MARQUES ARAUJO AZEVEDO','Filosofia',10.0,10.0),
  ('GUSTAVO MARQUES ARAUJO AZEVEDO','Matematica',7.7,7.5),
  ('GUSTAVO MARQUES ARAUJO AZEVEDO','Redacao',9.5,9.0),
  ('GUSTAVO MARQUES ARAUJO AZEVEDO','Literatura',9.5,9.5),
  ('GUSTAVO MARQUES ARAUJO AZEVEDO','Ciencias da Natureza',8.0,7.0),
  ('GUSTAVO MARQUES ARAUJO AZEVEDO','Matematica Complementar',7.0,3.8),
  ('GUSTAVO MARQUES ARAUJO AZEVEDO','Portugues',8.0,7.4),
  ('GUSTAVO MARQUES ARAUJO AZEVEDO','Historia',9.7,7.2),
  ('GUSTAVO MARQUES ARAUJO AZEVEDO','Geografia',8.0,8.0),
  ('GUSTAVO MARQUES ARAUJO AZEVEDO','Artes',10.0,9.4),
  ('GUSTAVO MARQUES ARAUJO AZEVEDO','Educacao Fisica',10.0,10.0),
  ('GUSTAVO MARQUES ARAUJO AZEVEDO','Ingles',9.1,9.0),
  ('HELENA LUIZA DE CASTRO SILVA','Filosofia',10.0,10.0),
  ('HELENA LUIZA DE CASTRO SILVA','Matematica',9.4,9.5),
  ('HELENA LUIZA DE CASTRO SILVA','Redacao',10.0,9.0),
  ('HELENA LUIZA DE CASTRO SILVA','Literatura',9.5,9.0),
  ('HELENA LUIZA DE CASTRO SILVA','Ciencias da Natureza',8.3,7.0),
  ('HELENA LUIZA DE CASTRO SILVA','Matematica Complementar',8.3,6.5),
  ('HELENA LUIZA DE CASTRO SILVA','Portugues',9.0,7.9),
  ('HELENA LUIZA DE CASTRO SILVA','Historia',9.5,8.6),
  ('HELENA LUIZA DE CASTRO SILVA','Geografia',9.2,8.8),
  ('HELENA LUIZA DE CASTRO SILVA','Artes',10.0,9.4),
  ('HELENA LUIZA DE CASTRO SILVA','Educacao Fisica',10.0,10.0),
  ('HELENA LUIZA DE CASTRO SILVA','Ingles',9.6,10.0),
  ('HELOISA BECKER TABALIPA','Filosofia',10.0,10.0),
  ('HELOISA BECKER TABALIPA','Matematica',9.9,9.8),
  ('HELOISA BECKER TABALIPA','Redacao',10.0,10.0),
  ('HELOISA BECKER TABALIPA','Literatura',10.0,10.0),
  ('HELOISA BECKER TABALIPA','Ciencias da Natureza',10.0,9.8),
  ('HELOISA BECKER TABALIPA','Matematica Complementar',10.0,9.3),
  ('HELOISA BECKER TABALIPA','Portugues',9.6,8.9),
  ('HELOISA BECKER TABALIPA','Historia',9.9,9.8),
  ('HELOISA BECKER TABALIPA','Geografia',9.3,9.4),
  ('HELOISA BECKER TABALIPA','Artes',10.0,10.0),
  ('HELOISA BECKER TABALIPA','Educacao Fisica',10.0,10.0),
  ('HELOISA BECKER TABALIPA','Ingles',10.0,10.0),
  ('JOAO PEDRO AZEVEDO ALMEIDA','Filosofia',10.0,10.0),
  ('JOAO PEDRO AZEVEDO ALMEIDA','Matematica',9.9,9.9),
  ('JOAO PEDRO AZEVEDO ALMEIDA','Redacao',10.0,10.0),
  ('JOAO PEDRO AZEVEDO ALMEIDA','Literatura',10.0,10.0),
  ('JOAO PEDRO AZEVEDO ALMEIDA','Ciencias da Natureza',10.0,10.0),
  ('JOAO PEDRO AZEVEDO ALMEIDA','Matematica Complementar',10.0,10.0),
  ('JOAO PEDRO AZEVEDO ALMEIDA','Portugues',9.3,9.4),
  ('JOAO PEDRO AZEVEDO ALMEIDA','Historia',9.9,8.5),
  ('JOAO PEDRO AZEVEDO ALMEIDA','Geografia',9.9,9.2),
  ('JOAO PEDRO AZEVEDO ALMEIDA','Artes',10.0,10.0),
  ('JOAO PEDRO AZEVEDO ALMEIDA','Educacao Fisica',10.0,10.0),
  ('JOAO PEDRO AZEVEDO ALMEIDA','Ingles',10.0,10.0),
  ('JOSE DIAS DE BRITO NETO','Filosofia',10.0,10.0),
  ('JOSE DIAS DE BRITO NETO','Matematica',7.8,7.7),
  ('JOSE DIAS DE BRITO NETO','Redacao',9.5,8.0),
  ('JOSE DIAS DE BRITO NETO','Literatura',9.5,8.0),
  ('JOSE DIAS DE BRITO NETO','Ciencias da Natureza',8.3,7.1),
  ('JOSE DIAS DE BRITO NETO','Matematica Complementar',7.0,6.7),
  ('JOSE DIAS DE BRITO NETO','Portugues',8.5,8.5),
  ('JOSE DIAS DE BRITO NETO','Historia',9.0,7.6),
  ('JOSE DIAS DE BRITO NETO','Geografia',7.6,7.3),
  ('JOSE DIAS DE BRITO NETO','Artes',10.0,9.4),
  ('JOSE DIAS DE BRITO NETO','Educacao Fisica',10.0,10.0),
  ('JOSE DIAS DE BRITO NETO','Ingles',8.3,8.0),
  ('JOSE EMANUEL MEDEIROS SANTOS BORGES','Filosofia',10.0,10.0),
  ('JOSE EMANUEL MEDEIROS SANTOS BORGES','Matematica',8.2,7.8),
  ('JOSE EMANUEL MEDEIROS SANTOS BORGES','Redacao',9.5,10.0),
  ('JOSE EMANUEL MEDEIROS SANTOS BORGES','Literatura',9.5,9.0),
  ('JOSE EMANUEL MEDEIROS SANTOS BORGES','Ciencias da Natureza',9.3,9.3),
  ('JOSE EMANUEL MEDEIROS SANTOS BORGES','Matematica Complementar',7.2,9.0),
  ('JOSE EMANUEL MEDEIROS SANTOS BORGES','Portugues',8.6,8.5),
  ('JOSE EMANUEL MEDEIROS SANTOS BORGES','Historia',9.0,8.3),
  ('JOSE EMANUEL MEDEIROS SANTOS BORGES','Geografia',7.7,7.9),
  ('JOSE EMANUEL MEDEIROS SANTOS BORGES','Artes',10.0,10.0),
  ('JOSE EMANUEL MEDEIROS SANTOS BORGES','Educacao Fisica',10.0,10.0),
  ('JOSE EMANUEL MEDEIROS SANTOS BORGES','Ingles',8.6,8.6),
  ('LARA TEIXEIRA LIMA','Filosofia',10.0,10.0),
  ('LARA TEIXEIRA LIMA','Matematica',9.9,9.4),
  ('LARA TEIXEIRA LIMA','Redacao',10.0,10.0),
  ('LARA TEIXEIRA LIMA','Literatura',9.5,9.5),
  ('LARA TEIXEIRA LIMA','Ciencias da Natureza',8.6,9.7),
  ('LARA TEIXEIRA LIMA','Matematica Complementar',9.9,9.0),
  ('LARA TEIXEIRA LIMA','Portugues',9.2,8.6),
  ('LARA TEIXEIRA LIMA','Historia',9.9,9.0),
  ('LARA TEIXEIRA LIMA','Geografia',9.2,9.0),
  ('LARA TEIXEIRA LIMA','Artes',10.0,10.0),
  ('LARA TEIXEIRA LIMA','Educacao Fisica',10.0,10.0),
  ('LARA TEIXEIRA LIMA','Ingles',10.0,9.3),
  ('LAURA MARQUES DE MACEDO','Filosofia',10.0,10.0),
  ('LAURA MARQUES DE MACEDO','Matematica',7.8,6.5),
  ('LAURA MARQUES DE MACEDO','Redacao',9.5,8.5),
  ('LAURA MARQUES DE MACEDO','Literatura',9.5,8.5),
  ('LAURA MARQUES DE MACEDO','Ciencias da Natureza',8.3,7.6),
  ('LAURA MARQUES DE MACEDO','Matematica Complementar',7.3,4.2),
  ('LAURA MARQUES DE MACEDO','Portugues',8.1,8.5),
  ('LAURA MARQUES DE MACEDO','Historia',9.1,7.4),
  ('LAURA MARQUES DE MACEDO','Geografia',8.4,8.2),
  ('LAURA MARQUES DE MACEDO','Artes',10.0,10.0),
  ('LAURA MARQUES DE MACEDO','Educacao Fisica',10.0,10.0),
  ('LAURA MARQUES DE MACEDO','Ingles',8.0,8.0),
  ('LUIZA SANTOS COSTA','Filosofia',10.0,10.0),
  ('LUIZA SANTOS COSTA','Matematica',7.8,7.2),
  ('LUIZA SANTOS COSTA','Redacao',9.5,10.0),
  ('LUIZA SANTOS COSTA','Literatura',9.5,10.0),
  ('LUIZA SANTOS COSTA','Ciencias da Natureza',9.0,8.6),
  ('LUIZA SANTOS COSTA','Matematica Complementar',7.8,7.5),
  ('LUIZA SANTOS COSTA','Portugues',8.8,8.4),
  ('LUIZA SANTOS COSTA','Historia',9.8,7.3),
  ('LUIZA SANTOS COSTA','Geografia',8.8,8.5),
  ('LUIZA SANTOS COSTA','Artes',10.0,10.0),
  ('LUIZA SANTOS COSTA','Educacao Fisica',10.0,10.0),
  ('LUIZA SANTOS COSTA','Ingles',10.0,10.0),
  ('MARCELA AVELINO RODRIGUES DE PAULO','Filosofia',10.0,10.0),
  ('MARCELA AVELINO RODRIGUES DE PAULO','Matematica',7.9,6.8),
  ('MARCELA AVELINO RODRIGUES DE PAULO','Redacao',9.5,8.0),
  ('MARCELA AVELINO RODRIGUES DE PAULO','Literatura',9.5,8.5),
  ('MARCELA AVELINO RODRIGUES DE PAULO','Ciencias da Natureza',9.3,7.1),
  ('MARCELA AVELINO RODRIGUES DE PAULO','Matematica Complementar',7.2,3.3),
  ('MARCELA AVELINO RODRIGUES DE PAULO','Portugues',8.1,7.3),
  ('MARCELA AVELINO RODRIGUES DE PAULO','Historia',8.5,7.4),
  ('MARCELA AVELINO RODRIGUES DE PAULO','Geografia',8.2,8.7),
  ('MARCELA AVELINO RODRIGUES DE PAULO','Artes',10.0,10.0),
  ('MARCELA AVELINO RODRIGUES DE PAULO','Educacao Fisica',10.0,10.0),
  ('MARCELA AVELINO RODRIGUES DE PAULO','Ingles',8.0,7.8),
  ('MARIA ANTONELLA GOBIRA DE CARVALHO','Filosofia',10.0,10.0),
  ('MARIA ANTONELLA GOBIRA DE CARVALHO','Matematica',8.5,8.9),
  ('MARIA ANTONELLA GOBIRA DE CARVALHO','Redacao',9.5,10.0),
  ('MARIA ANTONELLA GOBIRA DE CARVALHO','Literatura',9.5,10.0),
  ('MARIA ANTONELLA GOBIRA DE CARVALHO','Ciencias da Natureza',9.3,8.2),
  ('MARIA ANTONELLA GOBIRA DE CARVALHO','Matematica Complementar',7.5,6.7),
  ('MARIA ANTONELLA GOBIRA DE CARVALHO','Portugues',9.7,8.6),
  ('MARIA ANTONELLA GOBIRA DE CARVALHO','Historia',9.9,8.2),
  ('MARIA ANTONELLA GOBIRA DE CARVALHO','Geografia',8.7,8.5),
  ('MARIA ANTONELLA GOBIRA DE CARVALHO','Artes',10.0,10.0),
  ('MARIA ANTONELLA GOBIRA DE CARVALHO','Educacao Fisica',10.0,10.0),
  ('MARIA ANTONELLA GOBIRA DE CARVALHO','Ingles',10.0,10.0),
  ('MARIA EDUARDA VILELA MIRANDA','Filosofia',10.0,8.2),
  ('MARIA EDUARDA VILELA MIRANDA','Matematica',7.7,4.9),
  ('MARIA EDUARDA VILELA MIRANDA','Redacao',9.5,10.0),
  ('MARIA EDUARDA VILELA MIRANDA','Literatura',9.5,10.0),
  ('MARIA EDUARDA VILELA MIRANDA','Ciencias da Natureza',8.0,7.1),
  ('MARIA EDUARDA VILELA MIRANDA','Matematica Complementar',6.4,4.4),
  ('MARIA EDUARDA VILELA MIRANDA','Portugues',7.0,4.5),
  ('MARIA EDUARDA VILELA MIRANDA','Historia',7.4,6.6),
  ('MARIA EDUARDA VILELA MIRANDA','Geografia',7.9,7.2),
  ('MARIA EDUARDA VILELA MIRANDA','Artes',10.0,9.5),
  ('MARIA EDUARDA VILELA MIRANDA','Educacao Fisica',10.0,7.5),
  ('MARIA EDUARDA VILELA MIRANDA','Ingles',7.6,8.0),
  ('MEL BUENO MARGARIDA ALMEIDA','Filosofia',10.0,10.0),
  ('MEL BUENO MARGARIDA ALMEIDA','Matematica',8.3,8.1),
  ('MEL BUENO MARGARIDA ALMEIDA','Redacao',9.5,9.0),
  ('MEL BUENO MARGARIDA ALMEIDA','Literatura',9.5,9.5),
  ('MEL BUENO MARGARIDA ALMEIDA','Ciencias da Natureza',8.3,7.1),
  ('MEL BUENO MARGARIDA ALMEIDA','Matematica Complementar',7.8,4.6),
  ('MEL BUENO MARGARIDA ALMEIDA','Portugues',8.4,7.5),
  ('MEL BUENO MARGARIDA ALMEIDA','Historia',9.2,8.6),
  ('MEL BUENO MARGARIDA ALMEIDA','Geografia',8.2,7.3),
  ('MEL BUENO MARGARIDA ALMEIDA','Artes',10.0,10.0),
  ('MEL BUENO MARGARIDA ALMEIDA','Educacao Fisica',10.0,10.0),
  ('MEL BUENO MARGARIDA ALMEIDA','Ingles',7.8,8.0),
  ('ROGER HENRIQUE RIBEIRO DE OLIVEIRA','Filosofia',10.0,10.0),
  ('ROGER HENRIQUE RIBEIRO DE OLIVEIRA','Matematica',8.3,7.3),
  ('ROGER HENRIQUE RIBEIRO DE OLIVEIRA','Redacao',9.5,9.0),
  ('ROGER HENRIQUE RIBEIRO DE OLIVEIRA','Literatura',9.5,10.0),
  ('ROGER HENRIQUE RIBEIRO DE OLIVEIRA','Ciencias da Natureza',9.3,7.1),
  ('ROGER HENRIQUE RIBEIRO DE OLIVEIRA','Matematica Complementar',8.0,6.7),
  ('ROGER HENRIQUE RIBEIRO DE OLIVEIRA','Portugues',8.4,7.8),
  ('ROGER HENRIQUE RIBEIRO DE OLIVEIRA','Historia',8.5,7.2),
  ('ROGER HENRIQUE RIBEIRO DE OLIVEIRA','Geografia',8.2,7.1),
  ('ROGER HENRIQUE RIBEIRO DE OLIVEIRA','Artes',10.0,10.0),
  ('ROGER HENRIQUE RIBEIRO DE OLIVEIRA','Educacao Fisica',10.0,10.0),
  ('ROGER HENRIQUE RIBEIRO DE OLIVEIRA','Ingles',9.1,9.2),
  ('JULIANA ALVARES MONTEIRO','Filosofia',10.0,10.0),
  ('JULIANA ALVARES MONTEIRO','Matematica',7.7,7.1),
  ('JULIANA ALVARES MONTEIRO','Redacao',9.5,8.5),
  ('JULIANA ALVARES MONTEIRO','Literatura',9.5,9.0),
  ('JULIANA ALVARES MONTEIRO','Ciencias da Natureza',8.6,7.3),
  ('JULIANA ALVARES MONTEIRO','Matematica Complementar',7.0,6.8),
  ('JULIANA ALVARES MONTEIRO','Portugues',9.3,7.5),
  ('JULIANA ALVARES MONTEIRO','Historia',8.7,7.9),
  ('JULIANA ALVARES MONTEIRO','Geografia',7.9,7.3),
  ('JULIANA ALVARES MONTEIRO','Artes',10.0,10.0),
  ('JULIANA ALVARES MONTEIRO','Educacao Fisica',10.0,10.0),
  ('JULIANA ALVARES MONTEIRO','Ingles',10.0,10.0),
  ('AMANDA RODRIGUES DA SILVA','Filosofia',10.0,10.0),
  ('AMANDA RODRIGUES DA SILVA','Matematica',8.4,7.3),
  ('AMANDA RODRIGUES DA SILVA','Redacao',6.5,8.0),
  ('AMANDA RODRIGUES DA SILVA','Literatura',6.5,8.5),
  ('AMANDA RODRIGUES DA SILVA','Ciencias da Natureza',8.0,8.5),
  ('AMANDA RODRIGUES DA SILVA','Matematica Complementar',6.5,6.0),
  ('AMANDA RODRIGUES DA SILVA','Portugues',9.3,8.4),
  ('AMANDA RODRIGUES DA SILVA','Historia',9.1,7.2),
  ('AMANDA RODRIGUES DA SILVA','Geografia',8.1,6.8),
  ('AMANDA RODRIGUES DA SILVA','Artes',10.0,10.0),
  ('AMANDA RODRIGUES DA SILVA','Educacao Fisica',10.0,10.0),
  ('AMANDA RODRIGUES DA SILVA','Ingles',8.0,8.0);

create temp table stg_turma_alvo_8a (turma_id uuid) on commit drop;

insert into stg_turma_alvo_8a (turma_id)
select m.turma_id
from stg_boletim_8ano_a s
join alunos al on pg_temp.norm_nome(al.nome) = pg_temp.norm_nome(s.aluno_nome)
join matriculas m on m.aluno_id = al.id and m.ano_letivo = 2026
group by m.turma_id
order by count(*) desc
limit 1;

do $$
begin
  if (select count(*) from stg_turma_alvo_8a) <> 1 then
    raise exception 'nao foi possivel resolver uma unica turma para os alunos do boletim (8o ANO A)';
  end if;
end $$;

insert into avaliacoes (escola_id, disciplina_id, turma_id, bimestre, ano_letivo, titulo, tipo, peso, valor_maximo)
select distinct
  '00000000-0000-0000-0000-000000000001'::uuid,
  d.id,
  t.turma_id,
  b.bimestre,
  2026,
  'Media Bimestral',
  'outro'::tipo_avaliacao,
  1::numeric,
  10::numeric
from stg_boletim_8ano_a s
join disciplinas d on d.serie_id = '17f4c5aa-0cae-4c98-a9e5-72787a9027ef' and d.nome = s.disciplina
cross join stg_turma_alvo_8a t
cross join (values (1), (2)) as b(bimestre)
where not exists (
  select 1 from avaliacoes a
  where a.turma_id = t.turma_id
    and a.disciplina_id = d.id
    and a.bimestre = b.bimestre
    and a.ano_letivo = 2026
    and a.titulo = 'Media Bimestral'
);

insert into notas (escola_id, avaliacao_id, aluno_id, matricula_id, valor)
select '00000000-0000-0000-0000-000000000001'::uuid, a.id, al.id, m.id, s.b1
from stg_boletim_8ano_a s
join alunos al on pg_temp.norm_nome(al.nome) = pg_temp.norm_nome(s.aluno_nome)
cross join stg_turma_alvo_8a t
join matriculas m on m.aluno_id = al.id and m.ano_letivo = 2026 and m.turma_id = t.turma_id
join disciplinas d on d.serie_id = '17f4c5aa-0cae-4c98-a9e5-72787a9027ef' and d.nome = s.disciplina
join avaliacoes a on a.turma_id = t.turma_id and a.disciplina_id = d.id
  and a.bimestre = 1 and a.ano_letivo = 2026 and a.titulo = 'Media Bimestral'
on conflict (avaliacao_id, aluno_id) do update set valor = excluded.valor;

insert into notas (escola_id, avaliacao_id, aluno_id, matricula_id, valor)
select '00000000-0000-0000-0000-000000000001'::uuid, a.id, al.id, m.id, s.b2
from stg_boletim_8ano_a s
join alunos al on pg_temp.norm_nome(al.nome) = pg_temp.norm_nome(s.aluno_nome)
cross join stg_turma_alvo_8a t
join matriculas m on m.aluno_id = al.id and m.ano_letivo = 2026 and m.turma_id = t.turma_id
join disciplinas d on d.serie_id = '17f4c5aa-0cae-4c98-a9e5-72787a9027ef' and d.nome = s.disciplina
join avaliacoes a on a.turma_id = t.turma_id and a.disciplina_id = d.id
  and a.bimestre = 2 and a.ano_letivo = 2026 and a.titulo = 'Media Bimestral'
on conflict (avaliacao_id, aluno_id) do update set valor = excluded.valor;
