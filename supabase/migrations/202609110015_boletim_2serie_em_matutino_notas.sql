-- Importa notas do boletim (1o e 2o bimestre 2026) da turma 2a SERIE EM A - Matutino.
-- Cadastro corrigido antes desta migration:
--   - Sofia Xavier Dantas: cursou 2a SERIE em 2025, cadastro promoveu ela para
--     3a SERIE 2026, mas o boletim mostra ela cursando 2a SERIE 2026 (repetiu
--     o ano). Corrigido serie_id/turma_id da matricula 2026.
-- Mesmo perfil de disciplinas do Ensino Medio ja usado na 1a SERIE (29
-- disciplinas, com desmembramento por frente e por escopo de Historia e
-- Geografia). Reaproveita a seed renomeando Portugues -> Lingua Portuguesa;
-- cria as demais 17 novas. Artes (seed) fica sem uso: nao aparece no boletim.
-- Fonte: Resultado - 2a SERIE - EM A - MATUTINO.pdf.
-- Turma resolvida dinamicamente pela matricula 2026 dos alunos do boletim.

create or replace function pg_temp.norm_nome(txt text) returns text as $$
  select upper(translate(txt,
    'áàâãäÁÀÂÃÄéèêëÉÈÊËíìîïÍÌÎÏóòôõöÓÒÔÕÖúùûüÚÙÛÜçÇñÑ',
    'aaaaaAAAAAeeeeEEEEiiiiIIIIooooOOOOOOuuuuUUUUcCnN'
  ));
$$ language sql immutable;

update matriculas m
set serie_id = s2.id, turma_id = t2.id
from series s2
join turmas t2 on t2.serie_id = s2.id and t2.ano_letivo = 2026 and t2.turno = 'matutino'
where s2.nome = '2ª SÉRIE'
  and m.ano_letivo = 2026
  and m.aluno_id in (
    select al.id from alunos al
    where pg_temp.norm_nome(al.nome) = pg_temp.norm_nome('SOFIA XAVIER DANTAS')
  );

update disciplinas set nome = 'Lingua Portuguesa'
where serie_id = 'c40f5f57-eb43-4100-bf15-6adb30f2c2d8' and nome = 'Portugues';

insert into disciplinas (escola_id, serie_id, nome, ordem)
select '00000000-0000-0000-0000-000000000001'::uuid, 'c40f5f57-eb43-4100-bf15-6adb30f2c2d8'::uuid, nome, ordem
from (values
  ('Projeto de Vida', 13),
  ('Espanhol', 14),
  ('Literatura', 15),
  ('Quimica Frente A', 16),
  ('Quimica Frente B', 17),
  ('Historia do Brasil', 18),
  ('Historia Geral', 19),
  ('Geografia Fisica', 20),
  ('Geografia Politica', 21),
  ('Matem Frente A', 22),
  ('Matem Frente B/C', 23),
  ('Matem Frente D', 24),
  ('Fisica Frente A', 25),
  ('Fisica Frente B', 26),
  ('Biologia Frente A', 27),
  ('Biologia Frente B', 28),
  ('Historia da Arte', 29)
) as novas(nome, ordem)
on conflict (escola_id, serie_id, nome) do nothing;

create temp table stg_boletim_2serie_a (
  aluno_nome text,
  disciplina text,
  b1 numeric(5,2),
  b2 numeric(5,2)
) on commit drop;

insert into stg_boletim_2serie_a (aluno_nome, disciplina, b1, b2) values
  ('FELIPE CARDOSO DOMINGUES','Filosofia',9.0,9.4),
  ('FELIPE CARDOSO DOMINGUES','Projeto de Vida',10.0,10.0),
  ('FELIPE CARDOSO DOMINGUES','Sociologia',10.0,10.0),
  ('FELIPE CARDOSO DOMINGUES','Redacao',8.0,5.8),
  ('FELIPE CARDOSO DOMINGUES','Espanhol',10.0,10.0),
  ('FELIPE CARDOSO DOMINGUES','Literatura',10.0,9.5),
  ('FELIPE CARDOSO DOMINGUES','Quimica',9.3,9.5),
  ('FELIPE CARDOSO DOMINGUES','Quimica Frente A',9.9,9.5),
  ('FELIPE CARDOSO DOMINGUES','Quimica Frente B',8.7,9.6),
  ('FELIPE CARDOSO DOMINGUES','Historia',9.0,9.0),
  ('FELIPE CARDOSO DOMINGUES','Historia do Brasil',9.2,9.0),
  ('FELIPE CARDOSO DOMINGUES','Historia Geral',8.9,9.1),
  ('FELIPE CARDOSO DOMINGUES','Geografia',8.9,9.3),
  ('FELIPE CARDOSO DOMINGUES','Geografia Fisica',8.7,8.9),
  ('FELIPE CARDOSO DOMINGUES','Geografia Politica',9.1,9.8),
  ('FELIPE CARDOSO DOMINGUES','Matematica',8.8,8.6),
  ('FELIPE CARDOSO DOMINGUES','Matem Frente A',8.7,7.7),
  ('FELIPE CARDOSO DOMINGUES','Matem Frente B/C',7.9,8.1),
  ('FELIPE CARDOSO DOMINGUES','Matem Frente D',10.0,10.0),
  ('FELIPE CARDOSO DOMINGUES','Fisica',7.9,9.5),
  ('FELIPE CARDOSO DOMINGUES','Fisica Frente A',7.7,10.0),
  ('FELIPE CARDOSO DOMINGUES','Fisica Frente B',8.1,9.0),
  ('FELIPE CARDOSO DOMINGUES','Biologia',9.4,9.1),
  ('FELIPE CARDOSO DOMINGUES','Biologia Frente A',9.9,9.0),
  ('FELIPE CARDOSO DOMINGUES','Biologia Frente B',9.0,9.2),
  ('FELIPE CARDOSO DOMINGUES','Historia da Arte',8.0,9.4),
  ('FELIPE CARDOSO DOMINGUES','Lingua Portuguesa',9.0,7.5),
  ('FELIPE CARDOSO DOMINGUES','Educacao Fisica',10.0,10.0),
  ('FELIPE CARDOSO DOMINGUES','Ingles',10.0,10.0),
  ('HEITOR HENRIQUE ARAUJO BORGES','Filosofia',9.0,7.5),
  ('HEITOR HENRIQUE ARAUJO BORGES','Projeto de Vida',10.0,10.0),
  ('HEITOR HENRIQUE ARAUJO BORGES','Sociologia',9.0,9.5),
  ('HEITOR HENRIQUE ARAUJO BORGES','Redacao',7.0,5.5),
  ('HEITOR HENRIQUE ARAUJO BORGES','Espanhol',10.0,10.0),
  ('HEITOR HENRIQUE ARAUJO BORGES','Literatura',10.0,9.0),
  ('HEITOR HENRIQUE ARAUJO BORGES','Quimica',8.6,9.2),
  ('HEITOR HENRIQUE ARAUJO BORGES','Quimica Frente A',8.9,9.4),
  ('HEITOR HENRIQUE ARAUJO BORGES','Quimica Frente B',8.4,9.0),
  ('HEITOR HENRIQUE ARAUJO BORGES','Historia',8.0,9.5),
  ('HEITOR HENRIQUE ARAUJO BORGES','Historia do Brasil',8.4,9.3),
  ('HEITOR HENRIQUE ARAUJO BORGES','Historia Geral',7.6,9.8),
  ('HEITOR HENRIQUE ARAUJO BORGES','Geografia',8.5,8.7),
  ('HEITOR HENRIQUE ARAUJO BORGES','Geografia Fisica',8.4,8.4),
  ('HEITOR HENRIQUE ARAUJO BORGES','Geografia Politica',8.6,9.1),
  ('HEITOR HENRIQUE ARAUJO BORGES','Matematica',6.3,8.5),
  ('HEITOR HENRIQUE ARAUJO BORGES','Matem Frente A',4.4,8.0),
  ('HEITOR HENRIQUE ARAUJO BORGES','Matem Frente B/C',7.1,8.0),
  ('HEITOR HENRIQUE ARAUJO BORGES','Matem Frente D',7.6,9.5),
  ('HEITOR HENRIQUE ARAUJO BORGES','Fisica',6.8,7.7),
  ('HEITOR HENRIQUE ARAUJO BORGES','Fisica Frente A',7.7,8.0),
  ('HEITOR HENRIQUE ARAUJO BORGES','Fisica Frente B',6.0,7.5),
  ('HEITOR HENRIQUE ARAUJO BORGES','Biologia',8.7,8.6),
  ('HEITOR HENRIQUE ARAUJO BORGES','Biologia Frente A',8.9,9.3),
  ('HEITOR HENRIQUE ARAUJO BORGES','Biologia Frente B',8.6,8.0),
  ('HEITOR HENRIQUE ARAUJO BORGES','Historia da Arte',9.1,8.7),
  ('HEITOR HENRIQUE ARAUJO BORGES','Lingua Portuguesa',8.6,7.9),
  ('HEITOR HENRIQUE ARAUJO BORGES','Educacao Fisica',10.0,10.0),
  ('HEITOR HENRIQUE ARAUJO BORGES','Ingles',10.0,9.0),
  ('LEONARDO VICENTE DE SOUZA SILVA FILHO','Filosofia',9.5,9.5),
  ('LEONARDO VICENTE DE SOUZA SILVA FILHO','Projeto de Vida',10.0,10.0),
  ('LEONARDO VICENTE DE SOUZA SILVA FILHO','Sociologia',9.5,10.0),
  ('LEONARDO VICENTE DE SOUZA SILVA FILHO','Redacao',9.9,10.0),
  ('LEONARDO VICENTE DE SOUZA SILVA FILHO','Espanhol',10.0,10.0),
  ('LEONARDO VICENTE DE SOUZA SILVA FILHO','Literatura',10.0,9.5),
  ('LEONARDO VICENTE DE SOUZA SILVA FILHO','Quimica',10.0,10.0),
  ('LEONARDO VICENTE DE SOUZA SILVA FILHO','Quimica Frente A',10.0,10.0),
  ('LEONARDO VICENTE DE SOUZA SILVA FILHO','Quimica Frente B',10.0,10.0),
  ('LEONARDO VICENTE DE SOUZA SILVA FILHO','Historia',10.0,10.0),
  ('LEONARDO VICENTE DE SOUZA SILVA FILHO','Historia do Brasil',10.0,10.0),
  ('LEONARDO VICENTE DE SOUZA SILVA FILHO','Historia Geral',10.0,10.0),
  ('LEONARDO VICENTE DE SOUZA SILVA FILHO','Geografia',10.0,10.0),
  ('LEONARDO VICENTE DE SOUZA SILVA FILHO','Geografia Fisica',10.0,10.0),
  ('LEONARDO VICENTE DE SOUZA SILVA FILHO','Geografia Politica',10.0,10.0),
  ('LEONARDO VICENTE DE SOUZA SILVA FILHO','Matematica',9.8,9.8),
  ('LEONARDO VICENTE DE SOUZA SILVA FILHO','Matem Frente A',9.6,9.5),
  ('LEONARDO VICENTE DE SOUZA SILVA FILHO','Matem Frente B/C',10.0,10.0),
  ('LEONARDO VICENTE DE SOUZA SILVA FILHO','Matem Frente D',10.0,10.0),
  ('LEONARDO VICENTE DE SOUZA SILVA FILHO','Fisica',9.6,10.0),
  ('LEONARDO VICENTE DE SOUZA SILVA FILHO','Fisica Frente A',10.0,10.0),
  ('LEONARDO VICENTE DE SOUZA SILVA FILHO','Fisica Frente B',9.3,10.0),
  ('LEONARDO VICENTE DE SOUZA SILVA FILHO','Biologia',10.0,10.0),
  ('LEONARDO VICENTE DE SOUZA SILVA FILHO','Biologia Frente A',10.0,10.0),
  ('LEONARDO VICENTE DE SOUZA SILVA FILHO','Biologia Frente B',10.0,10.0),
  ('LEONARDO VICENTE DE SOUZA SILVA FILHO','Historia da Arte',10.0,10.0),
  ('LEONARDO VICENTE DE SOUZA SILVA FILHO','Lingua Portuguesa',10.0,9.2),
  ('LEONARDO VICENTE DE SOUZA SILVA FILHO','Educacao Fisica',10.0,10.0),
  ('LEONARDO VICENTE DE SOUZA SILVA FILHO','Ingles',10.0,10.0),
  ('LUIZA RIBEIRO DE OLIVEIRA','Filosofia',9.8,9.1),
  ('LUIZA RIBEIRO DE OLIVEIRA','Projeto de Vida',10.0,10.0),
  ('LUIZA RIBEIRO DE OLIVEIRA','Sociologia',9.0,10.0),
  ('LUIZA RIBEIRO DE OLIVEIRA','Redacao',9.9,10.0),
  ('LUIZA RIBEIRO DE OLIVEIRA','Espanhol',10.0,10.0),
  ('LUIZA RIBEIRO DE OLIVEIRA','Literatura',10.0,10.0),
  ('LUIZA RIBEIRO DE OLIVEIRA','Quimica',10.0,10.0),
  ('LUIZA RIBEIRO DE OLIVEIRA','Quimica Frente A',10.0,10.0),
  ('LUIZA RIBEIRO DE OLIVEIRA','Quimica Frente B',10.0,10.0),
  ('LUIZA RIBEIRO DE OLIVEIRA','Historia',10.0,10.0),
  ('LUIZA RIBEIRO DE OLIVEIRA','Historia do Brasil',10.0,10.0),
  ('LUIZA RIBEIRO DE OLIVEIRA','Historia Geral',10.0,10.0),
  ('LUIZA RIBEIRO DE OLIVEIRA','Geografia',10.0,10.0),
  ('LUIZA RIBEIRO DE OLIVEIRA','Geografia Fisica',10.0,10.0),
  ('LUIZA RIBEIRO DE OLIVEIRA','Geografia Politica',10.0,10.0),
  ('LUIZA RIBEIRO DE OLIVEIRA','Matematica',10.0,10.0),
  ('LUIZA RIBEIRO DE OLIVEIRA','Matem Frente A',10.0,10.0),
  ('LUIZA RIBEIRO DE OLIVEIRA','Matem Frente B/C',10.0,10.0),
  ('LUIZA RIBEIRO DE OLIVEIRA','Matem Frente D',10.0,10.0),
  ('LUIZA RIBEIRO DE OLIVEIRA','Fisica',10.0,10.0),
  ('LUIZA RIBEIRO DE OLIVEIRA','Fisica Frente A',10.0,10.0),
  ('LUIZA RIBEIRO DE OLIVEIRA','Fisica Frente B',10.0,10.0),
  ('LUIZA RIBEIRO DE OLIVEIRA','Biologia',10.0,10.0),
  ('LUIZA RIBEIRO DE OLIVEIRA','Biologia Frente A',10.0,10.0),
  ('LUIZA RIBEIRO DE OLIVEIRA','Biologia Frente B',10.0,10.0),
  ('LUIZA RIBEIRO DE OLIVEIRA','Historia da Arte',10.0,10.0),
  ('LUIZA RIBEIRO DE OLIVEIRA','Lingua Portuguesa',10.0,10.0),
  ('LUIZA RIBEIRO DE OLIVEIRA','Educacao Fisica',10.0,10.0),
  ('LUIZA RIBEIRO DE OLIVEIRA','Ingles',10.0,10.0),
  ('SERGIO DANIEL BORGES ROQUE','Filosofia',8.0,8.0),
  ('SERGIO DANIEL BORGES ROQUE','Projeto de Vida',10.0,10.0),
  ('SERGIO DANIEL BORGES ROQUE','Sociologia',9.5,9.5),
  ('SERGIO DANIEL BORGES ROQUE','Redacao',8.3,5.9),
  ('SERGIO DANIEL BORGES ROQUE','Espanhol',10.0,10.0),
  ('SERGIO DANIEL BORGES ROQUE','Literatura',10.0,8.5),
  ('SERGIO DANIEL BORGES ROQUE','Quimica',8.2,8.7),
  ('SERGIO DANIEL BORGES ROQUE','Quimica Frente A',9.1,9.2),
  ('SERGIO DANIEL BORGES ROQUE','Quimica Frente B',7.4,8.2),
  ('SERGIO DANIEL BORGES ROQUE','Historia',7.5,9.2),
  ('SERGIO DANIEL BORGES ROQUE','Historia do Brasil',7.6,9.0),
  ('SERGIO DANIEL BORGES ROQUE','Historia Geral',7.5,9.5),
  ('SERGIO DANIEL BORGES ROQUE','Geografia',8.5,8.5),
  ('SERGIO DANIEL BORGES ROQUE','Geografia Fisica',8.5,8.1),
  ('SERGIO DANIEL BORGES ROQUE','Geografia Politica',8.6,8.9),
  ('SERGIO DANIEL BORGES ROQUE','Matematica',7.1,7.9),
  ('SERGIO DANIEL BORGES ROQUE','Matem Frente A',5.1,6.6),
  ('SERGIO DANIEL BORGES ROQUE','Matem Frente B/C',7.1,7.1),
  ('SERGIO DANIEL BORGES ROQUE','Matem Frente D',9.3,10.0),
  ('SERGIO DANIEL BORGES ROQUE','Fisica',6.2,8.5),
  ('SERGIO DANIEL BORGES ROQUE','Fisica Frente A',5.9,9.5),
  ('SERGIO DANIEL BORGES ROQUE','Fisica Frente B',6.6,7.5),
  ('SERGIO DANIEL BORGES ROQUE','Biologia',8.8,9.0),
  ('SERGIO DANIEL BORGES ROQUE','Biologia Frente A',9.4,10.0),
  ('SERGIO DANIEL BORGES ROQUE','Biologia Frente B',8.2,8.0),
  ('SERGIO DANIEL BORGES ROQUE','Historia da Arte',7.9,8.8),
  ('SERGIO DANIEL BORGES ROQUE','Lingua Portuguesa',8.4,7.7),
  ('SERGIO DANIEL BORGES ROQUE','Educacao Fisica',10.0,10.0),
  ('SERGIO DANIEL BORGES ROQUE','Ingles',8.0,9.0),
  ('SOFIA XAVIER DANTAS','Filosofia',9.7,9.5),
  ('SOFIA XAVIER DANTAS','Projeto de Vida',10.0,10.0),
  ('SOFIA XAVIER DANTAS','Sociologia',10.0,10.0),
  ('SOFIA XAVIER DANTAS','Redacao',9.8,10.0),
  ('SOFIA XAVIER DANTAS','Espanhol',10.0,10.0),
  ('SOFIA XAVIER DANTAS','Literatura',10.0,10.0),
  ('SOFIA XAVIER DANTAS','Quimica',10.0,9.7),
  ('SOFIA XAVIER DANTAS','Quimica Frente A',10.0,9.4),
  ('SOFIA XAVIER DANTAS','Quimica Frente B',10.0,10.0),
  ('SOFIA XAVIER DANTAS','Historia',9.8,10.0),
  ('SOFIA XAVIER DANTAS','Historia do Brasil',10.0,10.0),
  ('SOFIA XAVIER DANTAS','Historia Geral',9.7,10.0),
  ('SOFIA XAVIER DANTAS','Geografia',9.9,9.3),
  ('SOFIA XAVIER DANTAS','Geografia Fisica',10.0,8.8),
  ('SOFIA XAVIER DANTAS','Geografia Politica',9.9,9.9),
  ('SOFIA XAVIER DANTAS','Matematica',9.3,9.4),
  ('SOFIA XAVIER DANTAS','Matem Frente A',9.8,8.4),
  ('SOFIA XAVIER DANTAS','Matem Frente B/C',9.6,10.0),
  ('SOFIA XAVIER DANTAS','Matem Frente D',8.5,10.0),
  ('SOFIA XAVIER DANTAS','Fisica',9.4,9.2),
  ('SOFIA XAVIER DANTAS','Fisica Frente A',9.4,9.7),
  ('SOFIA XAVIER DANTAS','Fisica Frente B',9.5,8.7),
  ('SOFIA XAVIER DANTAS','Biologia',10.0,10.0),
  ('SOFIA XAVIER DANTAS','Biologia Frente A',10.0,10.0),
  ('SOFIA XAVIER DANTAS','Biologia Frente B',10.0,10.0),
  ('SOFIA XAVIER DANTAS','Historia da Arte',10.0,9.7),
  ('SOFIA XAVIER DANTAS','Lingua Portuguesa',9.9,9.8),
  ('SOFIA XAVIER DANTAS','Educacao Fisica',10.0,10.0),
  ('SOFIA XAVIER DANTAS','Ingles',10.0,10.0),
  ('ANA LAURA ROSA DO COUTO','Filosofia',8.0,7.4),
  ('ANA LAURA ROSA DO COUTO','Projeto de Vida',10.0,10.0),
  ('ANA LAURA ROSA DO COUTO','Sociologia',9.0,9.5),
  ('ANA LAURA ROSA DO COUTO','Redacao',7.0,5.2),
  ('ANA LAURA ROSA DO COUTO','Espanhol',10.0,10.0),
  ('ANA LAURA ROSA DO COUTO','Literatura',6.7,7.0),
  ('ANA LAURA ROSA DO COUTO','Quimica',6.8,7.1),
  ('ANA LAURA ROSA DO COUTO','Quimica Frente A',6.6,7.7),
  ('ANA LAURA ROSA DO COUTO','Quimica Frente B',7.0,6.5),
  ('ANA LAURA ROSA DO COUTO','Historia',7.0,8.8),
  ('ANA LAURA ROSA DO COUTO','Historia do Brasil',7.0,8.6),
  ('ANA LAURA ROSA DO COUTO','Historia Geral',7.0,9.0),
  ('ANA LAURA ROSA DO COUTO','Geografia',7.0,7.7),
  ('ANA LAURA ROSA DO COUTO','Geografia Fisica',7.0,7.7),
  ('ANA LAURA ROSA DO COUTO','Geografia Politica',7.0,7.7),
  ('ANA LAURA ROSA DO COUTO','Matematica',7.0,7.1),
  ('ANA LAURA ROSA DO COUTO','Matem Frente A',7.5,7.5),
  ('ANA LAURA ROSA DO COUTO','Matem Frente B/C',7.5,7.0),
  ('ANA LAURA ROSA DO COUTO','Matem Frente D',6.0,7.0),
  ('ANA LAURA ROSA DO COUTO','Fisica',7.2,5.6),
  ('ANA LAURA ROSA DO COUTO','Fisica Frente A',7.0,3.8),
  ('ANA LAURA ROSA DO COUTO','Fisica Frente B',7.5,7.5),
  ('ANA LAURA ROSA DO COUTO','Biologia',7.0,8.4),
  ('ANA LAURA ROSA DO COUTO','Biologia Frente A',8.0,9.7),
  ('ANA LAURA ROSA DO COUTO','Biologia Frente B',6.0,7.2),
  ('ANA LAURA ROSA DO COUTO','Historia da Arte',7.3,7.1),
  ('ANA LAURA ROSA DO COUTO','Lingua Portuguesa',7.1,7.7),
  ('ANA LAURA ROSA DO COUTO','Educacao Fisica',10.0,10.0),
  ('ANA LAURA ROSA DO COUTO','Ingles',8.0,10.0);

create temp table stg_turma_alvo_2serie (turma_id uuid) on commit drop;

insert into stg_turma_alvo_2serie (turma_id)
select m.turma_id
from stg_boletim_2serie_a s
join alunos al on pg_temp.norm_nome(al.nome) = pg_temp.norm_nome(s.aluno_nome)
join matriculas m on m.aluno_id = al.id and m.ano_letivo = 2026
group by m.turma_id
order by count(*) desc
limit 1;

do $$
begin
  if (select count(*) from stg_turma_alvo_2serie) <> 1 then
    raise exception 'nao foi possivel resolver uma unica turma para os alunos do boletim (2a SERIE EM A)';
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
from stg_boletim_2serie_a s
join disciplinas d on d.serie_id = 'c40f5f57-eb43-4100-bf15-6adb30f2c2d8' and d.nome = s.disciplina
cross join stg_turma_alvo_2serie t
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
from stg_boletim_2serie_a s
join alunos al on pg_temp.norm_nome(al.nome) = pg_temp.norm_nome(s.aluno_nome)
cross join stg_turma_alvo_2serie t
join matriculas m on m.aluno_id = al.id and m.ano_letivo = 2026 and m.turma_id = t.turma_id
join disciplinas d on d.serie_id = 'c40f5f57-eb43-4100-bf15-6adb30f2c2d8' and d.nome = s.disciplina
join avaliacoes a on a.turma_id = t.turma_id and a.disciplina_id = d.id
  and a.bimestre = 1 and a.ano_letivo = 2026 and a.titulo = 'Media Bimestral'
where s.b1 is not null
on conflict (avaliacao_id, aluno_id) do update set valor = excluded.valor;

insert into notas (escola_id, avaliacao_id, aluno_id, matricula_id, valor)
select '00000000-0000-0000-0000-000000000001'::uuid, a.id, al.id, m.id, s.b2
from stg_boletim_2serie_a s
join alunos al on pg_temp.norm_nome(al.nome) = pg_temp.norm_nome(s.aluno_nome)
cross join stg_turma_alvo_2serie t
join matriculas m on m.aluno_id = al.id and m.ano_letivo = 2026 and m.turma_id = t.turma_id
join disciplinas d on d.serie_id = 'c40f5f57-eb43-4100-bf15-6adb30f2c2d8' and d.nome = s.disciplina
join avaliacoes a on a.turma_id = t.turma_id and a.disciplina_id = d.id
  and a.bimestre = 2 and a.ano_letivo = 2026 and a.titulo = 'Media Bimestral'
where s.b2 is not null
on conflict (avaliacao_id, aluno_id) do update set valor = excluded.valor;
