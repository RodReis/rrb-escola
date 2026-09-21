-- Importa notas parciais do boletim (1o e 2o bimestre 2026) de Grasiela Marques Araujo
-- Azevedo, 5o ANO A - Matutino. Boletim incompleto: sem Ciencias, Redacao, Maker,
-- Ensino Religioso, e Projeto Semear/Socioemocional so tem 3o bimestre (fora do
-- padrao b1/b2 usado aqui, nao lancado).
-- Cadastro corrigido antes desta migration: matricula 2026 apontava para 6o ANO,
-- corrigida para 5o ANO A - Matutino (boletim e a verdade).
-- Fonte: Resultado - 5 ANO - MATUTINO.pdf.

create or replace function pg_temp.norm_nome(txt text) returns text as $$
  select upper(translate(txt,
    'áàâãäÁÀÂÃÄéèêëÉÈÊËíìîïÍÌÎÏóòôõöÓÒÔÕÖúùûüÚÙÛÜçÇñÑ',
    'aaaaaAAAAAeeeeEEEEiiiiIIIIooooOOOOOOuuuuUUUUcCnN'
  ));
$$ language sql immutable;

create temp table stg_boletim_5ano_grasiela (
  aluno_nome text,
  disciplina text,
  b1 numeric(5,2),
  b2 numeric(5,2)
) on commit drop;

insert into stg_boletim_5ano_grasiela (aluno_nome, disciplina, b1, b2) values
  ('GRASIELA MARQUES ARAUJO AZEVEDO','Matematica',6.8,8.0),
  ('GRASIELA MARQUES ARAUJO AZEVEDO','Portugues',7.1,7.1),
  ('GRASIELA MARQUES ARAUJO AZEVEDO','Historia',8.3,7.1),
  ('GRASIELA MARQUES ARAUJO AZEVEDO','Geografia',7.0,7.5),
  ('GRASIELA MARQUES ARAUJO AZEVEDO','Artes',10.0,10.0),
  ('GRASIELA MARQUES ARAUJO AZEVEDO','Educacao Fisica',10.0,10.0),
  ('GRASIELA MARQUES ARAUJO AZEVEDO','Ingles',9.3,9.3);

create temp table stg_turma_alvo_5g (turma_id uuid) on commit drop;

insert into stg_turma_alvo_5g (turma_id)
select m.turma_id
from stg_boletim_5ano_grasiela s
join alunos al on pg_temp.norm_nome(al.nome) = pg_temp.norm_nome(s.aluno_nome)
join matriculas m on m.aluno_id = al.id and m.ano_letivo = 2026
group by m.turma_id
order by count(*) desc
limit 1;

do $$
begin
  if (select count(*) from stg_turma_alvo_5g) <> 1 then
    raise exception 'nao foi possivel resolver uma unica turma para Grasiela (5o ANO A)';
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
from stg_boletim_5ano_grasiela s
join disciplinas d on d.serie_id = 'c8834ff7-b712-4b46-b25e-ee34d3be5d90' and d.nome = s.disciplina
cross join stg_turma_alvo_5g t
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
from stg_boletim_5ano_grasiela s
join alunos al on pg_temp.norm_nome(al.nome) = pg_temp.norm_nome(s.aluno_nome)
cross join stg_turma_alvo_5g t
join matriculas m on m.aluno_id = al.id and m.ano_letivo = 2026 and m.turma_id = t.turma_id
join disciplinas d on d.serie_id = 'c8834ff7-b712-4b46-b25e-ee34d3be5d90' and d.nome = s.disciplina
join avaliacoes a on a.turma_id = t.turma_id and a.disciplina_id = d.id
  and a.bimestre = 1 and a.ano_letivo = 2026 and a.titulo = 'Media Bimestral'
on conflict (avaliacao_id, aluno_id) do update set valor = excluded.valor;

insert into notas (escola_id, avaliacao_id, aluno_id, matricula_id, valor)
select '00000000-0000-0000-0000-000000000001'::uuid, a.id, al.id, m.id, s.b2
from stg_boletim_5ano_grasiela s
join alunos al on pg_temp.norm_nome(al.nome) = pg_temp.norm_nome(s.aluno_nome)
cross join stg_turma_alvo_5g t
join matriculas m on m.aluno_id = al.id and m.ano_letivo = 2026 and m.turma_id = t.turma_id
join disciplinas d on d.serie_id = 'c8834ff7-b712-4b46-b25e-ee34d3be5d90' and d.nome = s.disciplina
join avaliacoes a on a.turma_id = t.turma_id and a.disciplina_id = d.id
  and a.bimestre = 2 and a.ano_letivo = 2026 and a.titulo = 'Media Bimestral'
on conflict (avaliacao_id, aluno_id) do update set valor = excluded.valor;
