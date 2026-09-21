-- Importa notas do boletim (1o e 2o bimestre 2026) da turma 3a SERIE EM A - Matutino.
-- Cadastro corrigido antes desta migration:
--   - Julia da Silva Nunes: cursou 1a e 2a SERIE ambas em 2024 (regularizacao/
--     avanco), 3a SERIE em 2025 (concluida) e ficou SEM matricula 2026. O
--     boletim mostra ela cursando 3a SERIE de novo em 2026 (repetiu). Criada
--     matricula 2026 ativa na 3a SERIE A - Matutino.
-- Perfil de disciplinas do Ensino Medio (3a SERIE) igual ao das demais series
-- do EM, exceto que NAO tem Projeto de Vida neste boletim (28 disciplinas).
-- Reaproveita a seed renomeando Portugues -> Lingua Portuguesa; cria as
-- demais 15 novas. Artes (seed) fica sem uso: nao aparece no boletim.
-- Fonte: Resultado - 3a SERIE - EM A - MATUTINO.pdf.
-- Turma resolvida dinamicamente pela matricula 2026 dos alunos do boletim.

create or replace function pg_temp.norm_nome(txt text) returns text as $$
  select upper(translate(txt,
    'áàâãäÁÀÂÃÄéèêëÉÈÊËíìîïÍÌÎÏóòôõöÓÒÔÕÖúùûüÚÙÛÜçÇñÑ',
    'aaaaaAAAAAeeeeEEEEiiiiIIIIooooOOOOOOuuuuUUUUcCnN'
  ));
$$ language sql immutable;

insert into matriculas (escola_id, aluno_id, serie_id, turma_id, ano_letivo, status, tipo_vaga, percentual_bolsa)
select '00000000-0000-0000-0000-000000000001'::uuid, al.id, t3.serie_id, t3.id, 2026, 'ativa'::status_matricula, 'paga'::tipo_vaga, 0
from alunos al
join turmas t3 on t3.serie_id = (select id from series where nome = '3ª SÉRIE') and t3.ano_letivo = 2026 and t3.turno = 'matutino'
where pg_temp.norm_nome(al.nome) = pg_temp.norm_nome('JÚLIA DA SILVA NUNES')
  and not exists (
    select 1 from matriculas m2 where m2.aluno_id = al.id and m2.ano_letivo = 2026
  );

update disciplinas set nome = 'Lingua Portuguesa'
where serie_id = '0750488e-fcf0-48b1-8e44-2b5362a63eae' and nome = 'Portugues';

insert into disciplinas (escola_id, serie_id, nome, ordem)
select '00000000-0000-0000-0000-000000000001'::uuid, '0750488e-fcf0-48b1-8e44-2b5362a63eae'::uuid, nome, ordem
from (values
  ('Espanhol', 13),
  ('Literatura', 14),
  ('Historia do Brasil', 15),
  ('Historia Geral', 16),
  ('Geografia Politica', 17),
  ('Geografia Fisica', 18),
  ('Matem Frente A', 19),
  ('Matem Frente B/C', 20),
  ('Matem Frente D', 21),
  ('Quimica Frente A', 22),
  ('Quimica Frente B', 23),
  ('Fisica Frente A', 24),
  ('Fisica Frente B', 25),
  ('Biologia Frente A', 26),
  ('Biologia Frente B', 27),
  ('Historia da Arte', 28)
) as novas(nome, ordem)
on conflict (escola_id, serie_id, nome) do nothing;

create temp table stg_boletim_3serie_a (
  aluno_nome text,
  disciplina text,
  b1 numeric(5,2),
  b2 numeric(5,2)
) on commit drop;

insert into stg_boletim_3serie_a (aluno_nome, disciplina, b1, b2) values
  ('JHENNYFER SOUZA ALVES','Filosofia',8.4,9.2),
  ('JHENNYFER SOUZA ALVES','Sociologia',10.0,9.0),
  ('JHENNYFER SOUZA ALVES','Redacao',9.8,9.3),
  ('JHENNYFER SOUZA ALVES','Espanhol',10.0,10.0),
  ('JHENNYFER SOUZA ALVES','Literatura',7.7,9.8),
  ('JHENNYFER SOUZA ALVES','Historia',6.3,9.9),
  ('JHENNYFER SOUZA ALVES','Historia do Brasil',5.5,9.9),
  ('JHENNYFER SOUZA ALVES','Historia Geral',7.2,10.0),
  ('JHENNYFER SOUZA ALVES','Geografia',7.1,9.0),
  ('JHENNYFER SOUZA ALVES','Geografia Politica',8.2,9.5),
  ('JHENNYFER SOUZA ALVES','Geografia Fisica',6.0,8.5),
  ('JHENNYFER SOUZA ALVES','Matematica',7.2,8.6),
  ('JHENNYFER SOUZA ALVES','Matem Frente A',6.7,7.9),
  ('JHENNYFER SOUZA ALVES','Matem Frente B/C',7.0,7.9),
  ('JHENNYFER SOUZA ALVES','Matem Frente D',8.0,10.0),
  ('JHENNYFER SOUZA ALVES','Quimica',8.9,8.6),
  ('JHENNYFER SOUZA ALVES','Quimica Frente A',9.6,8.0),
  ('JHENNYFER SOUZA ALVES','Quimica Frente B',8.3,9.2),
  ('JHENNYFER SOUZA ALVES','Fisica',5.9,7.4),
  ('JHENNYFER SOUZA ALVES','Fisica Frente A',6.7,7.0),
  ('JHENNYFER SOUZA ALVES','Fisica Frente B',5.2,7.9),
  ('JHENNYFER SOUZA ALVES','Biologia',9.1,9.5),
  ('JHENNYFER SOUZA ALVES','Biologia Frente A',9.4,9.0),
  ('JHENNYFER SOUZA ALVES','Biologia Frente B',8.8,10.0),
  ('JHENNYFER SOUZA ALVES','Historia da Arte',6.5,9.6),
  ('JHENNYFER SOUZA ALVES','Lingua Portuguesa',8.0,8.4),
  ('JHENNYFER SOUZA ALVES','Educacao Fisica',10.0,10.0),
  ('JHENNYFER SOUZA ALVES','Ingles',10.0,10.0),
  ('JOAO PEDRO SILVA VIEIRA','Filosofia',8.3,8.4),
  ('JOAO PEDRO SILVA VIEIRA','Sociologia',10.0,10.0),
  ('JOAO PEDRO SILVA VIEIRA','Redacao',7.0,8.5),
  ('JOAO PEDRO SILVA VIEIRA','Espanhol',10.0,10.0),
  ('JOAO PEDRO SILVA VIEIRA','Literatura',8.0,9.2),
  ('JOAO PEDRO SILVA VIEIRA','Historia',5.8,9.1),
  ('JOAO PEDRO SILVA VIEIRA','Historia do Brasil',5.8,9.1),
  ('JOAO PEDRO SILVA VIEIRA','Historia Geral',5.9,9.2),
  ('JOAO PEDRO SILVA VIEIRA','Geografia',7.7,8.4),
  ('JOAO PEDRO SILVA VIEIRA','Geografia Politica',8.2,8.4),
  ('JOAO PEDRO SILVA VIEIRA','Geografia Fisica',7.2,8.5),
  ('JOAO PEDRO SILVA VIEIRA','Matematica',6.5,7.0),
  ('JOAO PEDRO SILVA VIEIRA','Matem Frente A',4.7,6.5),
  ('JOAO PEDRO SILVA VIEIRA','Matem Frente B/C',5.2,5.7),
  ('JOAO PEDRO SILVA VIEIRA','Matem Frente D',9.8,9.0),
  ('JOAO PEDRO SILVA VIEIRA','Quimica',6.6,7.5),
  ('JOAO PEDRO SILVA VIEIRA','Quimica Frente A',7.1,8.0),
  ('JOAO PEDRO SILVA VIEIRA','Quimica Frente B',6.2,7.0),
  ('JOAO PEDRO SILVA VIEIRA','Fisica',5.5,7.0),
  ('JOAO PEDRO SILVA VIEIRA','Fisica Frente A',5.7,5.0),
  ('JOAO PEDRO SILVA VIEIRA','Fisica Frente B',5.3,9.0),
  ('JOAO PEDRO SILVA VIEIRA','Biologia',8.4,8.6),
  ('JOAO PEDRO SILVA VIEIRA','Biologia Frente A',9.5,9.8),
  ('JOAO PEDRO SILVA VIEIRA','Biologia Frente B',7.3,7.5),
  ('JOAO PEDRO SILVA VIEIRA','Historia da Arte',9.2,10.0),
  ('JOAO PEDRO SILVA VIEIRA','Lingua Portuguesa',10.0,8.0),
  ('JOAO PEDRO SILVA VIEIRA','Educacao Fisica',10.0,10.0),
  ('JOAO PEDRO SILVA VIEIRA','Ingles',10.0,10.0),
  ('JULIA DA SILVA NUNES','Filosofia',8.3,9.1),
  ('JULIA DA SILVA NUNES','Sociologia',10.0,10.0),
  ('JULIA DA SILVA NUNES','Redacao',9.9,5.5),
  ('JULIA DA SILVA NUNES','Espanhol',10.0,10.0),
  ('JULIA DA SILVA NUNES','Literatura',9.0,8.3),
  ('JULIA DA SILVA NUNES','Historia',8.5,9.2),
  ('JULIA DA SILVA NUNES','Historia do Brasil',8.8,9.7),
  ('JULIA DA SILVA NUNES','Historia Geral',8.3,8.7),
  ('JULIA DA SILVA NUNES','Geografia',7.9,7.8),
  ('JULIA DA SILVA NUNES','Geografia Politica',9.1,8.1),
  ('JULIA DA SILVA NUNES','Geografia Fisica',6.8,7.5),
  ('JULIA DA SILVA NUNES','Matematica',8.0,8.6),
  ('JULIA DA SILVA NUNES','Matem Frente A',7.8,7.4),
  ('JULIA DA SILVA NUNES','Matem Frente B/C',7.5,8.6),
  ('JULIA DA SILVA NUNES','Matem Frente D',8.7,10.0),
  ('JULIA DA SILVA NUNES','Quimica',9.0,7.7),
  ('JULIA DA SILVA NUNES','Quimica Frente A',9.5,7.4),
  ('JULIA DA SILVA NUNES','Quimica Frente B',8.6,8.1),
  ('JULIA DA SILVA NUNES','Fisica',6.4,8.1),
  ('JULIA DA SILVA NUNES','Fisica Frente A',7.0,7.0),
  ('JULIA DA SILVA NUNES','Fisica Frente B',5.9,9.3),
  ('JULIA DA SILVA NUNES','Biologia',8.9,9.5),
  ('JULIA DA SILVA NUNES','Biologia Frente A',9.5,9.0),
  ('JULIA DA SILVA NUNES','Biologia Frente B',8.3,10.0),
  ('JULIA DA SILVA NUNES','Historia da Arte',8.3,10.0),
  ('JULIA DA SILVA NUNES','Lingua Portuguesa',9.0,10.0),
  ('JULIA DA SILVA NUNES','Educacao Fisica',10.0,10.0),
  ('JULIA DA SILVA NUNES','Ingles',10.0,10.0),
  ('LIVIA BORGES YABAGATA','Filosofia',9.9,9.0),
  ('LIVIA BORGES YABAGATA','Sociologia',10.0,10.0),
  ('LIVIA BORGES YABAGATA','Redacao',9.9,9.8),
  ('LIVIA BORGES YABAGATA','Espanhol',10.0,10.0),
  ('LIVIA BORGES YABAGATA','Literatura',9.0,10.0),
  ('LIVIA BORGES YABAGATA','Historia',8.9,9.9),
  ('LIVIA BORGES YABAGATA','Historia do Brasil',8.2,10.0),
  ('LIVIA BORGES YABAGATA','Historia Geral',9.7,9.9),
  ('LIVIA BORGES YABAGATA','Geografia',8.9,9.7),
  ('LIVIA BORGES YABAGATA','Geografia Politica',8.8,9.4),
  ('LIVIA BORGES YABAGATA','Geografia Fisica',9.0,10.0),
  ('LIVIA BORGES YABAGATA','Matematica',7.3,7.8),
  ('LIVIA BORGES YABAGATA','Matem Frente A',6.5,7.6),
  ('LIVIA BORGES YABAGATA','Matem Frente B/C',6.2,7.4),
  ('LIVIA BORGES YABAGATA','Matem Frente D',9.3,8.4),
  ('LIVIA BORGES YABAGATA','Quimica',7.9,7.7),
  ('LIVIA BORGES YABAGATA','Quimica Frente A',7.6,7.3),
  ('LIVIA BORGES YABAGATA','Quimica Frente B',8.2,8.2),
  ('LIVIA BORGES YABAGATA','Fisica',7.0,7.1),
  ('LIVIA BORGES YABAGATA','Fisica Frente A',6.3,5.9),
  ('LIVIA BORGES YABAGATA','Fisica Frente B',7.8,8.4),
  ('LIVIA BORGES YABAGATA','Biologia',8.2,9.5),
  ('LIVIA BORGES YABAGATA','Biologia Frente A',10.0,9.4),
  ('LIVIA BORGES YABAGATA','Biologia Frente B',6.5,9.6),
  ('LIVIA BORGES YABAGATA','Historia da Arte',7.7,10.0),
  ('LIVIA BORGES YABAGATA','Lingua Portuguesa',9.0,9.7),
  ('LIVIA BORGES YABAGATA','Educacao Fisica',10.0,10.0),
  ('LIVIA BORGES YABAGATA','Ingles',10.0,10.0),
  ('LUNNA BUENO MARGARIDA ALMEIDA','Filosofia',8.5,9.5),
  ('LUNNA BUENO MARGARIDA ALMEIDA','Sociologia',10.0,8.0),
  ('LUNNA BUENO MARGARIDA ALMEIDA','Redacao',8.2,8.0),
  ('LUNNA BUENO MARGARIDA ALMEIDA','Espanhol',10.0,10.0),
  ('LUNNA BUENO MARGARIDA ALMEIDA','Literatura',9.5,9.7),
  ('LUNNA BUENO MARGARIDA ALMEIDA','Historia',7.1,9.4),
  ('LUNNA BUENO MARGARIDA ALMEIDA','Historia do Brasil',6.6,9.4),
  ('LUNNA BUENO MARGARIDA ALMEIDA','Historia Geral',7.6,9.5),
  ('LUNNA BUENO MARGARIDA ALMEIDA','Geografia',7.5,8.5),
  ('LUNNA BUENO MARGARIDA ALMEIDA','Geografia Politica',8.5,9.2),
  ('LUNNA BUENO MARGARIDA ALMEIDA','Geografia Fisica',6.6,7.9),
  ('LUNNA BUENO MARGARIDA ALMEIDA','Matematica',7.0,8.4),
  ('LUNNA BUENO MARGARIDA ALMEIDA','Matem Frente A',6.1,7.9),
  ('LUNNA BUENO MARGARIDA ALMEIDA','Matem Frente B/C',6.6,7.4),
  ('LUNNA BUENO MARGARIDA ALMEIDA','Matem Frente D',8.4,10.0),
  ('LUNNA BUENO MARGARIDA ALMEIDA','Quimica',8.8,8.1),
  ('LUNNA BUENO MARGARIDA ALMEIDA','Quimica Frente A',9.8,7.9),
  ('LUNNA BUENO MARGARIDA ALMEIDA','Quimica Frente B',7.8,8.4),
  ('LUNNA BUENO MARGARIDA ALMEIDA','Fisica',6.2,7.4),
  ('LUNNA BUENO MARGARIDA ALMEIDA','Fisica Frente A',7.0,6.9),
  ('LUNNA BUENO MARGARIDA ALMEIDA','Fisica Frente B',5.5,7.9),
  ('LUNNA BUENO MARGARIDA ALMEIDA','Biologia',8.7,9.5),
  ('LUNNA BUENO MARGARIDA ALMEIDA','Biologia Frente A',8.9,10.0),
  ('LUNNA BUENO MARGARIDA ALMEIDA','Biologia Frente B',8.5,9.0),
  ('LUNNA BUENO MARGARIDA ALMEIDA','Historia da Arte',7.1,9.8),
  ('LUNNA BUENO MARGARIDA ALMEIDA','Lingua Portuguesa',8.5,9.6),
  ('LUNNA BUENO MARGARIDA ALMEIDA','Educacao Fisica',10.0,10.0),
  ('LUNNA BUENO MARGARIDA ALMEIDA','Ingles',10.0,8.0),
  ('MARYA LUIZA DA SILVA VIEIRA','Filosofia',8.5,9.1),
  ('MARYA LUIZA DA SILVA VIEIRA','Sociologia',10.0,9.5),
  ('MARYA LUIZA DA SILVA VIEIRA','Redacao',9.0,9.2),
  ('MARYA LUIZA DA SILVA VIEIRA','Espanhol',10.0,10.0),
  ('MARYA LUIZA DA SILVA VIEIRA','Literatura',9.1,10.0),
  ('MARYA LUIZA DA SILVA VIEIRA','Historia',8.4,9.6),
  ('MARYA LUIZA DA SILVA VIEIRA','Historia do Brasil',8.4,9.6),
  ('MARYA LUIZA DA SILVA VIEIRA','Historia Geral',8.4,9.7),
  ('MARYA LUIZA DA SILVA VIEIRA','Geografia',8.2,9.5),
  ('MARYA LUIZA DA SILVA VIEIRA','Geografia Politica',8.2,9.1),
  ('MARYA LUIZA DA SILVA VIEIRA','Geografia Fisica',8.2,10.0),
  ('MARYA LUIZA DA SILVA VIEIRA','Matematica',6.9,8.3),
  ('MARYA LUIZA DA SILVA VIEIRA','Matem Frente A',5.7,6.4),
  ('MARYA LUIZA DA SILVA VIEIRA','Matem Frente B/C',6.7,8.8),
  ('MARYA LUIZA DA SILVA VIEIRA','Matem Frente D',8.4,9.7),
  ('MARYA LUIZA DA SILVA VIEIRA','Quimica',7.7,7.6),
  ('MARYA LUIZA DA SILVA VIEIRA','Quimica Frente A',7.1,7.2),
  ('MARYA LUIZA DA SILVA VIEIRA','Quimica Frente B',8.4,8.0),
  ('MARYA LUIZA DA SILVA VIEIRA','Fisica',5.5,7.0),
  ('MARYA LUIZA DA SILVA VIEIRA','Fisica Frente A',5.2,5.5),
  ('MARYA LUIZA DA SILVA VIEIRA','Fisica Frente B',5.9,8.5),
  ('MARYA LUIZA DA SILVA VIEIRA','Biologia',9.6,9.3),
  ('MARYA LUIZA DA SILVA VIEIRA','Biologia Frente A',10.0,8.7),
  ('MARYA LUIZA DA SILVA VIEIRA','Biologia Frente B',9.3,10.0),
  ('MARYA LUIZA DA SILVA VIEIRA','Historia da Arte',8.0,9.6),
  ('MARYA LUIZA DA SILVA VIEIRA','Lingua Portuguesa',9.2,9.5),
  ('MARYA LUIZA DA SILVA VIEIRA','Educacao Fisica',10.0,10.0),
  ('MARYA LUIZA DA SILVA VIEIRA','Ingles',10.0,10.0),
  ('NICOLE CAETANO SILVA','Filosofia',8.4,8.9),
  ('NICOLE CAETANO SILVA','Sociologia',10.0,9.5),
  ('NICOLE CAETANO SILVA','Redacao',9.9,9.8),
  ('NICOLE CAETANO SILVA','Espanhol',10.0,10.0),
  ('NICOLE CAETANO SILVA','Literatura',9.1,10.0),
  ('NICOLE CAETANO SILVA','Historia',8.3,9.9),
  ('NICOLE CAETANO SILVA','Historia do Brasil',8.3,9.9),
  ('NICOLE CAETANO SILVA','Historia Geral',8.3,10.0),
  ('NICOLE CAETANO SILVA','Geografia',8.7,9.8),
  ('NICOLE CAETANO SILVA','Geografia Politica',8.2,9.6),
  ('NICOLE CAETANO SILVA','Geografia Fisica',9.2,10.0),
  ('NICOLE CAETANO SILVA','Matematica',8.0,8.7),
  ('NICOLE CAETANO SILVA','Matem Frente A',6.0,6.8),
  ('NICOLE CAETANO SILVA','Matem Frente B/C',8.0,9.3),
  ('NICOLE CAETANO SILVA','Matem Frente D',10.0,10.0),
  ('NICOLE CAETANO SILVA','Quimica',8.2,9.0),
  ('NICOLE CAETANO SILVA','Quimica Frente A',8.7,9.0),
  ('NICOLE CAETANO SILVA','Quimica Frente B',7.8,9.1),
  ('NICOLE CAETANO SILVA','Fisica',7.2,7.7),
  ('NICOLE CAETANO SILVA','Fisica Frente A',7.0,6.5),
  ('NICOLE CAETANO SILVA','Fisica Frente B',7.4,9.0),
  ('NICOLE CAETANO SILVA','Biologia',9.3,9.3),
  ('NICOLE CAETANO SILVA','Biologia Frente A',9.5,9.0),
  ('NICOLE CAETANO SILVA','Biologia Frente B',9.2,9.6),
  ('NICOLE CAETANO SILVA','Historia da Arte',7.5,10.0),
  ('NICOLE CAETANO SILVA','Lingua Portuguesa',7.7,9.3),
  ('NICOLE CAETANO SILVA','Educacao Fisica',10.0,10.0),
  ('NICOLE CAETANO SILVA','Ingles',10.0,10.0),
  ('RAPHAELLY LUISA SOUSA RIBEIRO','Filosofia',7.0,8.8),
  ('RAPHAELLY LUISA SOUSA RIBEIRO','Sociologia',9.8,9.0),
  ('RAPHAELLY LUISA SOUSA RIBEIRO','Redacao',8.6,9.5),
  ('RAPHAELLY LUISA SOUSA RIBEIRO','Espanhol',10.0,10.0),
  ('RAPHAELLY LUISA SOUSA RIBEIRO','Literatura',8.5,8.8),
  ('RAPHAELLY LUISA SOUSA RIBEIRO','Historia',7.9,8.3),
  ('RAPHAELLY LUISA SOUSA RIBEIRO','Historia do Brasil',7.6,8.2),
  ('RAPHAELLY LUISA SOUSA RIBEIRO','Historia Geral',8.3,8.4),
  ('RAPHAELLY LUISA SOUSA RIBEIRO','Geografia',7.3,8.1),
  ('RAPHAELLY LUISA SOUSA RIBEIRO','Geografia Politica',7.5,8.2),
  ('RAPHAELLY LUISA SOUSA RIBEIRO','Geografia Fisica',7.2,8.0),
  ('RAPHAELLY LUISA SOUSA RIBEIRO','Matematica',6.0,7.3),
  ('RAPHAELLY LUISA SOUSA RIBEIRO','Matem Frente A',4.0,6.8),
  ('RAPHAELLY LUISA SOUSA RIBEIRO','Matem Frente B/C',5.9,6.3),
  ('RAPHAELLY LUISA SOUSA RIBEIRO','Matem Frente D',8.3,8.8),
  ('RAPHAELLY LUISA SOUSA RIBEIRO','Quimica',8.0,6.9),
  ('RAPHAELLY LUISA SOUSA RIBEIRO','Quimica Frente A',8.4,6.3),
  ('RAPHAELLY LUISA SOUSA RIBEIRO','Quimica Frente B',7.7,7.5),
  ('RAPHAELLY LUISA SOUSA RIBEIRO','Fisica',5.5,6.0),
  ('RAPHAELLY LUISA SOUSA RIBEIRO','Fisica Frente A',5.1,4.3),
  ('RAPHAELLY LUISA SOUSA RIBEIRO','Fisica Frente B',6.0,7.8),
  ('RAPHAELLY LUISA SOUSA RIBEIRO','Biologia',9.0,8.9),
  ('RAPHAELLY LUISA SOUSA RIBEIRO','Biologia Frente A',9.3,9.1),
  ('RAPHAELLY LUISA SOUSA RIBEIRO','Biologia Frente B',8.7,8.8),
  ('RAPHAELLY LUISA SOUSA RIBEIRO','Historia da Arte',7.7,8.2),
  ('RAPHAELLY LUISA SOUSA RIBEIRO','Lingua Portuguesa',9.0,9.2),
  ('RAPHAELLY LUISA SOUSA RIBEIRO','Educacao Fisica',10.0,10.0),
  ('RAPHAELLY LUISA SOUSA RIBEIRO','Ingles',10.0,10.0);

create temp table stg_turma_alvo_3serie (turma_id uuid) on commit drop;

insert into stg_turma_alvo_3serie (turma_id)
select m.turma_id
from stg_boletim_3serie_a s
join alunos al on pg_temp.norm_nome(al.nome) = pg_temp.norm_nome(s.aluno_nome)
join matriculas m on m.aluno_id = al.id and m.ano_letivo = 2026
group by m.turma_id
order by count(*) desc
limit 1;

do $$
begin
  if (select count(*) from stg_turma_alvo_3serie) <> 1 then
    raise exception 'nao foi possivel resolver uma unica turma para os alunos do boletim (3a SERIE EM A)';
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
from stg_boletim_3serie_a s
join disciplinas d on d.serie_id = '0750488e-fcf0-48b1-8e44-2b5362a63eae' and d.nome = s.disciplina
cross join stg_turma_alvo_3serie t
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
from stg_boletim_3serie_a s
join alunos al on pg_temp.norm_nome(al.nome) = pg_temp.norm_nome(s.aluno_nome)
cross join stg_turma_alvo_3serie t
join matriculas m on m.aluno_id = al.id and m.ano_letivo = 2026 and m.turma_id = t.turma_id
join disciplinas d on d.serie_id = '0750488e-fcf0-48b1-8e44-2b5362a63eae' and d.nome = s.disciplina
join avaliacoes a on a.turma_id = t.turma_id and a.disciplina_id = d.id
  and a.bimestre = 1 and a.ano_letivo = 2026 and a.titulo = 'Media Bimestral'
where s.b1 is not null
on conflict (avaliacao_id, aluno_id) do update set valor = excluded.valor;

insert into notas (escola_id, avaliacao_id, aluno_id, matricula_id, valor)
select '00000000-0000-0000-0000-000000000001'::uuid, a.id, al.id, m.id, s.b2
from stg_boletim_3serie_a s
join alunos al on pg_temp.norm_nome(al.nome) = pg_temp.norm_nome(s.aluno_nome)
cross join stg_turma_alvo_3serie t
join matriculas m on m.aluno_id = al.id and m.ano_letivo = 2026 and m.turma_id = t.turma_id
join disciplinas d on d.serie_id = '0750488e-fcf0-48b1-8e44-2b5362a63eae' and d.nome = s.disciplina
join avaliacoes a on a.turma_id = t.turma_id and a.disciplina_id = d.id
  and a.bimestre = 2 and a.ano_letivo = 2026 and a.titulo = 'Media Bimestral'
where s.b2 is not null
on conflict (avaliacao_id, aluno_id) do update set valor = excluded.valor;
