-- Importa notas do boletim (1o e 2o bimestre 2026) da turma 9o ANO A - Matutino.
-- Cadastro corrigido antes desta migration: Francisco Xavier Dantas Neto e
-- Guilherme Gratao Costa tinham matricula 2026 apontando para 1a SERIE (Ensino
-- Medio), corrigida para 9o ANO A - Matutino (progressao historica normal
-- 2018-2025 ate 8o ANO; boletim e a verdade).
-- Perfil de disciplinas do 9o ANO difere do padrao 6o-8o ANO (20 disciplinas
-- no boletim, incluindo desmembramentos como Matematica/Matematica 1/Matematica 2
-- e Geografia/Geografia Fisica/Geografia Politica). Reaproveita as 9 seed
-- (renomeando) e cria 11 novas:
--   Artes -> Arte, Ciencias -> Ciencias da Natureza, Producao Textual -> Redacao,
--   Portugues -> Gramatica (mantidos: Educacao Fisica, Geografia, Historia,
--   Ingles, Matematica).
--   Novas: Literatura, Filosofia, Projeto de Vida, Quimica, Fisica,
--   Leitura e Interpretacao, Matematica 1, Matematica 2, Geografia Fisica,
--   Geografia Politica, Biologia.
-- Fonte: Resultado - 9 ANO - MATUTINO.pdf.
-- Turma resolvida dinamicamente pela matricula 2026 dos alunos do boletim.

create or replace function pg_temp.norm_nome(txt text) returns text as $$
  select upper(translate(txt,
    'áàâãäÁÀÂÃÄéèêëÉÈÊËíìîïÍÌÎÏóòôõöÓÒÔÕÖúùûüÚÙÛÜçÇñÑ',
    'aaaaaAAAAAeeeeEEEEiiiiIIIIooooOOOOOOuuuuUUUUcCnN'
  ));
$$ language sql immutable;

-- Corrige cadastro: Francisco Xavier Dantas Neto e Guilherme Gratao Costa
-- estavam com matricula 2026 na 1a SERIE (Ensino Medio) por erro de promocao.
update matriculas m
set serie_id = s9.id, turma_id = t9.id
from series s9
join turmas t9 on t9.serie_id = s9.id and t9.ano_letivo = 2026 and t9.turno = 'matutino'
where s9.nome = '9º ANO'
  and m.ano_letivo = 2026
  and m.aluno_id in (
    select al.id from alunos al
    where pg_temp.norm_nome(al.nome) in (
      pg_temp.norm_nome('FRANCISCO XAVIER DANTAS NETO'),
      pg_temp.norm_nome('GUILHERME GRATÃO COSTA')
    )
  );

update disciplinas set nome = 'Arte'
where serie_id = '28cc4f4d-a171-4dc2-8dfa-9001bf262167' and nome = 'Artes';

update disciplinas set nome = 'Ciencias da Natureza'
where serie_id = '28cc4f4d-a171-4dc2-8dfa-9001bf262167' and nome = 'Ciencias';

update disciplinas set nome = 'Redacao'
where serie_id = '28cc4f4d-a171-4dc2-8dfa-9001bf262167' and nome = 'Producao Textual';

update disciplinas set nome = 'Gramatica'
where serie_id = '28cc4f4d-a171-4dc2-8dfa-9001bf262167' and nome = 'Portugues';

insert into disciplinas (escola_id, serie_id, nome, ordem)
select '00000000-0000-0000-0000-000000000001'::uuid, '28cc4f4d-a171-4dc2-8dfa-9001bf262167'::uuid, nome, ordem
from (values
  ('Literatura', 9),
  ('Filosofia', 10),
  ('Projeto de Vida', 11),
  ('Quimica', 12),
  ('Fisica', 13),
  ('Leitura e Interpretacao', 14),
  ('Matematica 1', 15),
  ('Matematica 2', 16),
  ('Geografia Fisica', 17),
  ('Geografia Politica', 18),
  ('Biologia', 19)
) as novas(nome, ordem)
on conflict (escola_id, serie_id, nome) do nothing;

create temp table stg_boletim_9ano_a (
  aluno_nome text,
  disciplina text,
  b1 numeric(5,2),
  b2 numeric(5,2)
) on commit drop;

insert into stg_boletim_9ano_a (aluno_nome, disciplina, b1, b2) values
  ('BERNARDO PONDE AMORIM ALMEIDA E SILVA','Redacao',9.3,9.0),
  ('BERNARDO PONDE AMORIM ALMEIDA E SILVA','Literatura',10.0,9.4),
  ('BERNARDO PONDE AMORIM ALMEIDA E SILVA','Filosofia',10.0,10.0),
  ('BERNARDO PONDE AMORIM ALMEIDA E SILVA','Projeto de Vida',10.0,10.0),
  ('BERNARDO PONDE AMORIM ALMEIDA E SILVA','Quimica',9.6,7.1),
  ('BERNARDO PONDE AMORIM ALMEIDA E SILVA','Fisica',8.3,8.0),
  ('BERNARDO PONDE AMORIM ALMEIDA E SILVA','Gramatica',9.8,8.7),
  ('BERNARDO PONDE AMORIM ALMEIDA E SILVA','Leitura e Interpretacao',8.6,10.0),
  ('BERNARDO PONDE AMORIM ALMEIDA E SILVA','Matematica',10.0,9.2),
  ('BERNARDO PONDE AMORIM ALMEIDA E SILVA','Matematica 1',10.0,9.6),
  ('BERNARDO PONDE AMORIM ALMEIDA E SILVA','Matematica 2',10.0,8.8),
  ('BERNARDO PONDE AMORIM ALMEIDA E SILVA','Geografia Fisica',10.0,8.7),
  ('BERNARDO PONDE AMORIM ALMEIDA E SILVA','Geografia Politica',9.1,8.1),
  ('BERNARDO PONDE AMORIM ALMEIDA E SILVA','Geografia',9.5,8.4),
  ('BERNARDO PONDE AMORIM ALMEIDA E SILVA','Historia',8.6,10.0),
  ('BERNARDO PONDE AMORIM ALMEIDA E SILVA','Arte',10.0,10.0),
  ('BERNARDO PONDE AMORIM ALMEIDA E SILVA','Educacao Fisica',10.0,10.0),
  ('BERNARDO PONDE AMORIM ALMEIDA E SILVA','Ingles',10.0,10.0),
  ('BERNARDO PONDE AMORIM ALMEIDA E SILVA','Biologia',7.8,9.4),
  ('BERNARDO PONDE AMORIM ALMEIDA E SILVA','Ciencias da Natureza',8.5,8.1),
  ('DANIEL ARANTES SANTOS','Redacao',7.5,9.0),
  ('DANIEL ARANTES SANTOS','Literatura',6.4,8.6),
  ('DANIEL ARANTES SANTOS','Filosofia',10.0,10.0),
  ('DANIEL ARANTES SANTOS','Projeto de Vida',10.0,10.0),
  ('DANIEL ARANTES SANTOS','Quimica',7.0,6.0),
  ('DANIEL ARANTES SANTOS','Fisica',5.6,7.7),
  ('DANIEL ARANTES SANTOS','Gramatica',7.9,8.6),
  ('DANIEL ARANTES SANTOS','Leitura e Interpretacao',10.0,8.1),
  ('DANIEL ARANTES SANTOS','Matematica',8.6,7.8),
  ('DANIEL ARANTES SANTOS','Matematica 1',9.3,6.6),
  ('DANIEL ARANTES SANTOS','Matematica 2',7.9,9.0),
  ('DANIEL ARANTES SANTOS','Geografia Fisica',9.1,9.0),
  ('DANIEL ARANTES SANTOS','Geografia Politica',9.8,9.3),
  ('DANIEL ARANTES SANTOS','Geografia',9.4,9.1),
  ('DANIEL ARANTES SANTOS','Historia',8.3,10.0),
  ('DANIEL ARANTES SANTOS','Arte',10.0,10.0),
  ('DANIEL ARANTES SANTOS','Educacao Fisica',10.0,10.0),
  ('DANIEL ARANTES SANTOS','Ingles',8.0,10.0),
  ('DANIEL ARANTES SANTOS','Biologia',8.1,9.6),
  ('DANIEL ARANTES SANTOS','Ciencias da Natureza',6.9,7.7),
  ('EDUARDA DOS SANTOS SANTANA','Redacao',9.3,9.2),
  ('EDUARDA DOS SANTOS SANTANA','Literatura',9.0,7.5),
  ('EDUARDA DOS SANTOS SANTANA','Filosofia',10.0,10.0),
  ('EDUARDA DOS SANTOS SANTANA','Projeto de Vida',10.0,10.0),
  ('EDUARDA DOS SANTOS SANTANA','Quimica',6.3,5.7),
  ('EDUARDA DOS SANTOS SANTANA','Fisica',6.6,5.7),
  ('EDUARDA DOS SANTOS SANTANA','Gramatica',9.5,9.0),
  ('EDUARDA DOS SANTOS SANTANA','Leitura e Interpretacao',8.9,9.0),
  ('EDUARDA DOS SANTOS SANTANA','Matematica',8.8,7.6),
  ('EDUARDA DOS SANTOS SANTANA','Matematica 1',8.2,7.1),
  ('EDUARDA DOS SANTOS SANTANA','Matematica 2',9.4,8.2),
  ('EDUARDA DOS SANTOS SANTANA','Geografia Fisica',7.7,8.7),
  ('EDUARDA DOS SANTOS SANTANA','Geografia Politica',8.1,9.6),
  ('EDUARDA DOS SANTOS SANTANA','Geografia',7.9,9.1),
  ('EDUARDA DOS SANTOS SANTANA','Historia',8.4,10.0),
  ('EDUARDA DOS SANTOS SANTANA','Arte',10.0,10.0),
  ('EDUARDA DOS SANTOS SANTANA','Educacao Fisica',10.0,10.0),
  ('EDUARDA DOS SANTOS SANTANA','Ingles',9.0,8.0),
  ('EDUARDA DOS SANTOS SANTANA','Biologia',8.4,8.5),
  ('EDUARDA DOS SANTOS SANTANA','Ciencias da Natureza',7.1,6.6),
  ('FRANCISCO XAVIER DANTAS NETO','Redacao',10.0,9.5),
  ('FRANCISCO XAVIER DANTAS NETO','Literatura',9.8,9.8),
  ('FRANCISCO XAVIER DANTAS NETO','Filosofia',10.0,10.0),
  ('FRANCISCO XAVIER DANTAS NETO','Projeto de Vida',10.0,10.0),
  ('FRANCISCO XAVIER DANTAS NETO','Quimica',9.3,9.5),
  ('FRANCISCO XAVIER DANTAS NETO','Fisica',7.5,6.3),
  ('FRANCISCO XAVIER DANTAS NETO','Gramatica',10.0,9.3),
  ('FRANCISCO XAVIER DANTAS NETO','Leitura e Interpretacao',10.0,10.0),
  ('FRANCISCO XAVIER DANTAS NETO','Matematica',10.0,7.2),
  ('FRANCISCO XAVIER DANTAS NETO','Matematica 1',10.0,7.5),
  ('FRANCISCO XAVIER DANTAS NETO','Matematica 2',10.0,7.0),
  ('FRANCISCO XAVIER DANTAS NETO','Geografia Fisica',8.8,9.5),
  ('FRANCISCO XAVIER DANTAS NETO','Geografia Politica',8.8,8.4),
  ('FRANCISCO XAVIER DANTAS NETO','Geografia',8.8,8.9),
  ('FRANCISCO XAVIER DANTAS NETO','Historia',8.3,10.0),
  ('FRANCISCO XAVIER DANTAS NETO','Arte',10.0,10.0),
  ('FRANCISCO XAVIER DANTAS NETO','Educacao Fisica',10.0,10.0),
  ('FRANCISCO XAVIER DANTAS NETO','Ingles',10.0,10.0),
  ('FRANCISCO XAVIER DANTAS NETO','Biologia',7.7,10.0),
  ('FRANCISCO XAVIER DANTAS NETO','Ciencias da Natureza',8.1,8.6),
  ('GABRIEL AUGUSTO NOGUEIRA DE MOURA','Redacao',8.5,8.8),
  ('GABRIEL AUGUSTO NOGUEIRA DE MOURA','Literatura',8.6,8.4),
  ('GABRIEL AUGUSTO NOGUEIRA DE MOURA','Filosofia',10.0,10.0),
  ('GABRIEL AUGUSTO NOGUEIRA DE MOURA','Projeto de Vida',10.0,10.0),
  ('GABRIEL AUGUSTO NOGUEIRA DE MOURA','Quimica',5.7,6.2),
  ('GABRIEL AUGUSTO NOGUEIRA DE MOURA','Fisica',4.0,7.5),
  ('GABRIEL AUGUSTO NOGUEIRA DE MOURA','Gramatica',7.0,9.8),
  ('GABRIEL AUGUSTO NOGUEIRA DE MOURA','Leitura e Interpretacao',8.3,8.7),
  ('GABRIEL AUGUSTO NOGUEIRA DE MOURA','Matematica',8.1,7.1),
  ('GABRIEL AUGUSTO NOGUEIRA DE MOURA','Matematica 1',8.0,7.0),
  ('GABRIEL AUGUSTO NOGUEIRA DE MOURA','Matematica 2',8.2,7.3),
  ('GABRIEL AUGUSTO NOGUEIRA DE MOURA','Geografia Fisica',7.4,8.3),
  ('GABRIEL AUGUSTO NOGUEIRA DE MOURA','Geografia Politica',8.4,9.5),
  ('GABRIEL AUGUSTO NOGUEIRA DE MOURA','Geografia',7.9,8.9),
  ('GABRIEL AUGUSTO NOGUEIRA DE MOURA','Historia',7.8,9.0),
  ('GABRIEL AUGUSTO NOGUEIRA DE MOURA','Arte',10.0,10.0),
  ('GABRIEL AUGUSTO NOGUEIRA DE MOURA','Educacao Fisica',10.0,10.0),
  ('GABRIEL AUGUSTO NOGUEIRA DE MOURA','Ingles',10.0,10.0),
  ('GABRIEL AUGUSTO NOGUEIRA DE MOURA','Biologia',5.8,7.5),
  ('GABRIEL AUGUSTO NOGUEIRA DE MOURA','Ciencias da Natureza',5.1,7.0),
  ('GABRIEL PAULO MENDOZA MARTINS ARAUJO','Redacao',9.0,9.0),
  ('GABRIEL PAULO MENDOZA MARTINS ARAUJO','Literatura',9.8,9.9),
  ('GABRIEL PAULO MENDOZA MARTINS ARAUJO','Filosofia',10.0,10.0),
  ('GABRIEL PAULO MENDOZA MARTINS ARAUJO','Projeto de Vida',10.0,10.0),
  ('GABRIEL PAULO MENDOZA MARTINS ARAUJO','Quimica',8.6,9.1),
  ('GABRIEL PAULO MENDOZA MARTINS ARAUJO','Fisica',8.3,9.6),
  ('GABRIEL PAULO MENDOZA MARTINS ARAUJO','Gramatica',9.1,9.9),
  ('GABRIEL PAULO MENDOZA MARTINS ARAUJO','Leitura e Interpretacao',10.0,10.0),
  ('GABRIEL PAULO MENDOZA MARTINS ARAUJO','Matematica',9.5,8.8),
  ('GABRIEL PAULO MENDOZA MARTINS ARAUJO','Matematica 1',9.2,8.8),
  ('GABRIEL PAULO MENDOZA MARTINS ARAUJO','Matematica 2',9.9,8.9),
  ('GABRIEL PAULO MENDOZA MARTINS ARAUJO','Geografia Fisica',9.1,10.0),
  ('GABRIEL PAULO MENDOZA MARTINS ARAUJO','Geografia Politica',9.1,8.7),
  ('GABRIEL PAULO MENDOZA MARTINS ARAUJO','Geografia',9.1,9.3),
  ('GABRIEL PAULO MENDOZA MARTINS ARAUJO','Historia',9.6,10.0),
  ('GABRIEL PAULO MENDOZA MARTINS ARAUJO','Arte',10.0,10.0),
  ('GABRIEL PAULO MENDOZA MARTINS ARAUJO','Educacao Fisica',10.0,10.0),
  ('GABRIEL PAULO MENDOZA MARTINS ARAUJO','Ingles',8.6,10.0),
  ('GABRIEL PAULO MENDOZA MARTINS ARAUJO','Biologia',8.5,10.0),
  ('GABRIEL PAULO MENDOZA MARTINS ARAUJO','Ciencias da Natureza',8.4,9.5),
  ('GUILHERME GRATAO COSTA','Redacao',9.5,9.2),
  ('GUILHERME GRATAO COSTA','Literatura',10.0,10.0),
  ('GUILHERME GRATAO COSTA','Filosofia',10.0,10.0),
  ('GUILHERME GRATAO COSTA','Projeto de Vida',10.0,10.0),
  ('GUILHERME GRATAO COSTA','Quimica',8.5,9.3),
  ('GUILHERME GRATAO COSTA','Fisica',8.9,9.5),
  ('GUILHERME GRATAO COSTA','Gramatica',10.0,9.5),
  ('GUILHERME GRATAO COSTA','Leitura e Interpretacao',9.3,10.0),
  ('GUILHERME GRATAO COSTA','Matematica',10.0,9.9),
  ('GUILHERME GRATAO COSTA','Matematica 1',10.0,9.9),
  ('GUILHERME GRATAO COSTA','Matematica 2',10.0,9.9),
  ('GUILHERME GRATAO COSTA','Geografia Fisica',10.0,10.0),
  ('GUILHERME GRATAO COSTA','Geografia Politica',10.0,9.9),
  ('GUILHERME GRATAO COSTA','Geografia',10.0,9.9),
  ('GUILHERME GRATAO COSTA','Historia',9.6,10.0),
  ('GUILHERME GRATAO COSTA','Arte',10.0,10.0),
  ('GUILHERME GRATAO COSTA','Educacao Fisica',10.0,10.0),
  ('GUILHERME GRATAO COSTA','Ingles',10.0,10.0),
  ('GUILHERME GRATAO COSTA','Biologia',8.8,10.0),
  ('GUILHERME GRATAO COSTA','Ciencias da Natureza',8.7,9.6),
  ('GUSTAVO GOMES ROCHA DE OLIVEIRA','Redacao',8.6,8.8),
  ('GUSTAVO GOMES ROCHA DE OLIVEIRA','Literatura',7.6,7.9),
  ('GUSTAVO GOMES ROCHA DE OLIVEIRA','Filosofia',10.0,10.0),
  ('GUSTAVO GOMES ROCHA DE OLIVEIRA','Projeto de Vida',10.0,10.0),
  ('GUSTAVO GOMES ROCHA DE OLIVEIRA','Quimica',4.5,6.1),
  ('GUSTAVO GOMES ROCHA DE OLIVEIRA','Fisica',3.1,7.1),
  ('GUSTAVO GOMES ROCHA DE OLIVEIRA','Gramatica',5.5,7.9),
  ('GUSTAVO GOMES ROCHA DE OLIVEIRA','Leitura e Interpretacao',8.5,8.8),
  ('GUSTAVO GOMES ROCHA DE OLIVEIRA','Matematica',9.4,7.7),
  ('GUSTAVO GOMES ROCHA DE OLIVEIRA','Matematica 1',9.0,7.5),
  ('GUSTAVO GOMES ROCHA DE OLIVEIRA','Matematica 2',9.8,7.9),
  ('GUSTAVO GOMES ROCHA DE OLIVEIRA','Geografia Fisica',8.5,8.4),
  ('GUSTAVO GOMES ROCHA DE OLIVEIRA','Geografia Politica',7.6,8.4),
  ('GUSTAVO GOMES ROCHA DE OLIVEIRA','Geografia',8.0,8.4),
  ('GUSTAVO GOMES ROCHA DE OLIVEIRA','Historia',8.1,8.9),
  ('GUSTAVO GOMES ROCHA DE OLIVEIRA','Arte',10.0,10.0),
  ('GUSTAVO GOMES ROCHA DE OLIVEIRA','Educacao Fisica',10.0,10.0),
  ('GUSTAVO GOMES ROCHA DE OLIVEIRA','Ingles',7.5,8.0),
  ('GUSTAVO GOMES ROCHA DE OLIVEIRA','Biologia',5.9,8.4),
  ('GUSTAVO GOMES ROCHA DE OLIVEIRA','Ciencias da Natureza',4.5,7.2),
  ('HEITOR SANTOS RIBEIRO','Redacao',9.5,10.0),
  ('HEITOR SANTOS RIBEIRO','Literatura',10.0,10.0),
  ('HEITOR SANTOS RIBEIRO','Filosofia',10.0,10.0),
  ('HEITOR SANTOS RIBEIRO','Projeto de Vida',10.0,10.0),
  ('HEITOR SANTOS RIBEIRO','Quimica',10.0,10.0),
  ('HEITOR SANTOS RIBEIRO','Fisica',10.0,10.0),
  ('HEITOR SANTOS RIBEIRO','Gramatica',10.0,10.0),
  ('HEITOR SANTOS RIBEIRO','Leitura e Interpretacao',10.0,10.0),
  ('HEITOR SANTOS RIBEIRO','Matematica',10.0,10.0),
  ('HEITOR SANTOS RIBEIRO','Matematica 1',10.0,10.0),
  ('HEITOR SANTOS RIBEIRO','Matematica 2',10.0,10.0),
  ('HEITOR SANTOS RIBEIRO','Geografia Fisica',10.0,10.0),
  ('HEITOR SANTOS RIBEIRO','Geografia Politica',10.0,10.0),
  ('HEITOR SANTOS RIBEIRO','Geografia',10.0,10.0),
  ('HEITOR SANTOS RIBEIRO','Historia',10.0,10.0),
  ('HEITOR SANTOS RIBEIRO','Arte',10.0,10.0),
  ('HEITOR SANTOS RIBEIRO','Educacao Fisica',10.0,10.0),
  ('HEITOR SANTOS RIBEIRO','Ingles',10.0,10.0),
  ('HEITOR SANTOS RIBEIRO','Biologia',8.4,10.0),
  ('HEITOR SANTOS RIBEIRO','Ciencias da Natureza',9.4,10.0),
  ('HENRIQUE CARDOSO DOMINGUES','Redacao',9.5,9.8),
  ('HENRIQUE CARDOSO DOMINGUES','Literatura',9.7,9.0),
  ('HENRIQUE CARDOSO DOMINGUES','Filosofia',10.0,10.0),
  ('HENRIQUE CARDOSO DOMINGUES','Projeto de Vida',10.0,10.0),
  ('HENRIQUE CARDOSO DOMINGUES','Quimica',7.8,9.9),
  ('HENRIQUE CARDOSO DOMINGUES','Fisica',9.2,9.2),
  ('HENRIQUE CARDOSO DOMINGUES','Gramatica',10.0,9.7),
  ('HENRIQUE CARDOSO DOMINGUES','Leitura e Interpretacao',10.0,10.0),
  ('HENRIQUE CARDOSO DOMINGUES','Matematica',10.0,9.0),
  ('HENRIQUE CARDOSO DOMINGUES','Matematica 1',10.0,9.0),
  ('HENRIQUE CARDOSO DOMINGUES','Matematica 2',10.0,9.1),
  ('HENRIQUE CARDOSO DOMINGUES','Geografia Fisica',9.7,10.0),
  ('HENRIQUE CARDOSO DOMINGUES','Geografia Politica',8.7,9.1),
  ('HENRIQUE CARDOSO DOMINGUES','Geografia',9.2,9.5),
  ('HENRIQUE CARDOSO DOMINGUES','Historia',9.2,10.0),
  ('HENRIQUE CARDOSO DOMINGUES','Arte',10.0,10.0),
  ('HENRIQUE CARDOSO DOMINGUES','Educacao Fisica',10.0,10.0),
  ('HENRIQUE CARDOSO DOMINGUES','Ingles',9.0,8.0),
  ('HENRIQUE CARDOSO DOMINGUES','Biologia',8.3,9.7),
  ('HENRIQUE CARDOSO DOMINGUES','Ciencias da Natureza',8.4,9.6),
  ('ISABELLA DE CASTRO LOBO','Redacao',9.5,10.0),
  ('ISABELLA DE CASTRO LOBO','Literatura',9.1,9.5),
  ('ISABELLA DE CASTRO LOBO','Filosofia',10.0,10.0),
  ('ISABELLA DE CASTRO LOBO','Projeto de Vida',10.0,10.0),
  ('ISABELLA DE CASTRO LOBO','Quimica',9.0,8.2),
  ('ISABELLA DE CASTRO LOBO','Fisica',6.5,8.7),
  ('ISABELLA DE CASTRO LOBO','Gramatica',9.7,8.8),
  ('ISABELLA DE CASTRO LOBO','Leitura e Interpretacao',10.0,10.0),
  ('ISABELLA DE CASTRO LOBO','Matematica',9.5,8.1),
  ('ISABELLA DE CASTRO LOBO','Matematica 1',9.0,8.2),
  ('ISABELLA DE CASTRO LOBO','Matematica 2',10.0,8.0),
  ('ISABELLA DE CASTRO LOBO','Geografia Fisica',9.0,9.3),
  ('ISABELLA DE CASTRO LOBO','Geografia Politica',8.0,8.6),
  ('ISABELLA DE CASTRO LOBO','Geografia',8.5,8.9),
  ('ISABELLA DE CASTRO LOBO','Historia',8.3,10.0),
  ('ISABELLA DE CASTRO LOBO','Arte',10.0,10.0),
  ('ISABELLA DE CASTRO LOBO','Educacao Fisica',10.0,10.0),
  ('ISABELLA DE CASTRO LOBO','Ingles',10.0,10.0),
  ('ISABELLA DE CASTRO LOBO','Biologia',8.9,10.0),
  ('ISABELLA DE CASTRO LOBO','Ciencias da Natureza',8.1,8.9),
  ('JOSE AFONSO GODOY DE ARAUJO','Redacao',8.8,8.5),
  ('JOSE AFONSO GODOY DE ARAUJO','Literatura',7.8,7.9),
  ('JOSE AFONSO GODOY DE ARAUJO','Filosofia',10.0,10.0),
  ('JOSE AFONSO GODOY DE ARAUJO','Projeto de Vida',10.0,10.0),
  ('JOSE AFONSO GODOY DE ARAUJO','Quimica',8.5,6.0),
  ('JOSE AFONSO GODOY DE ARAUJO','Fisica',6.2,5.7),
  ('JOSE AFONSO GODOY DE ARAUJO','Gramatica',6.5,8.8),
  ('JOSE AFONSO GODOY DE ARAUJO','Leitura e Interpretacao',8.0,10.0),
  ('JOSE AFONSO GODOY DE ARAUJO','Matematica',9.5,7.7),
  ('JOSE AFONSO GODOY DE ARAUJO','Matematica 1',9.4,7.7),
  ('JOSE AFONSO GODOY DE ARAUJO','Matematica 2',9.7,7.8),
  ('JOSE AFONSO GODOY DE ARAUJO','Geografia Fisica',8.7,7.3),
  ('JOSE AFONSO GODOY DE ARAUJO','Geografia Politica',8.2,8.7),
  ('JOSE AFONSO GODOY DE ARAUJO','Geografia',8.4,8.0),
  ('JOSE AFONSO GODOY DE ARAUJO','Historia',7.5,8.3),
  ('JOSE AFONSO GODOY DE ARAUJO','Arte',10.0,10.0),
  ('JOSE AFONSO GODOY DE ARAUJO','Educacao Fisica',10.0,10.0),
  ('JOSE AFONSO GODOY DE ARAUJO','Ingles',10.0,8.0),
  ('JOSE AFONSO GODOY DE ARAUJO','Biologia',5.5,7.1),
  ('JOSE AFONSO GODOY DE ARAUJO','Ciencias da Natureza',6.7,6.2),
  ('JULIO CESAR DE JESUS BASTOS','Redacao',8.8,9.3),
  ('JULIO CESAR DE JESUS BASTOS','Literatura',8.2,8.4),
  ('JULIO CESAR DE JESUS BASTOS','Filosofia',10.0,10.0),
  ('JULIO CESAR DE JESUS BASTOS','Projeto de Vida',10.0,10.0),
  ('JULIO CESAR DE JESUS BASTOS','Quimica',4.8,6.6),
  ('JULIO CESAR DE JESUS BASTOS','Fisica',5.9,7.4),
  ('JULIO CESAR DE JESUS BASTOS','Gramatica',8.7,8.4),
  ('JULIO CESAR DE JESUS BASTOS','Leitura e Interpretacao',10.0,9.6),
  ('JULIO CESAR DE JESUS BASTOS','Matematica',8.3,7.5),
  ('JULIO CESAR DE JESUS BASTOS','Matematica 1',7.6,6.6),
  ('JULIO CESAR DE JESUS BASTOS','Matematica 2',9.0,8.4),
  ('JULIO CESAR DE JESUS BASTOS','Geografia Fisica',7.7,8.9),
  ('JULIO CESAR DE JESUS BASTOS','Geografia Politica',8.8,9.3),
  ('JULIO CESAR DE JESUS BASTOS','Geografia',8.2,9.1),
  ('JULIO CESAR DE JESUS BASTOS','Historia',7.5,9.1),
  ('JULIO CESAR DE JESUS BASTOS','Arte',10.0,10.0),
  ('JULIO CESAR DE JESUS BASTOS','Educacao Fisica',10.0,10.0),
  ('JULIO CESAR DE JESUS BASTOS','Ingles',8.0,7.5),
  ('JULIO CESAR DE JESUS BASTOS','Biologia',5.8,7.3),
  ('JULIO CESAR DE JESUS BASTOS','Ciencias da Natureza',5.5,7.1),
  ('LUCAS CAETANO FIGUEIREDO','Redacao',8.8,9.7),
  ('LUCAS CAETANO FIGUEIREDO','Literatura',9.0,9.2),
  ('LUCAS CAETANO FIGUEIREDO','Filosofia',10.0,10.0),
  ('LUCAS CAETANO FIGUEIREDO','Projeto de Vida',10.0,10.0),
  ('LUCAS CAETANO FIGUEIREDO','Quimica',6.3,8.7),
  ('LUCAS CAETANO FIGUEIREDO','Fisica',5.6,8.2),
  ('LUCAS CAETANO FIGUEIREDO','Gramatica',8.7,9.5),
  ('LUCAS CAETANO FIGUEIREDO','Leitura e Interpretacao',9.0,10.0),
  ('LUCAS CAETANO FIGUEIREDO','Matematica',9.4,8.4),
  ('LUCAS CAETANO FIGUEIREDO','Matematica 1',8.8,8.4),
  ('LUCAS CAETANO FIGUEIREDO','Matematica 2',10.0,8.5),
  ('LUCAS CAETANO FIGUEIREDO','Geografia Fisica',7.4,10.0),
  ('LUCAS CAETANO FIGUEIREDO','Geografia Politica',8.7,9.4),
  ('LUCAS CAETANO FIGUEIREDO','Geografia',8.0,9.7),
  ('LUCAS CAETANO FIGUEIREDO','Historia',8.0,10.0),
  ('LUCAS CAETANO FIGUEIREDO','Arte',10.0,10.0),
  ('LUCAS CAETANO FIGUEIREDO','Educacao Fisica',10.0,10.0),
  ('LUCAS CAETANO FIGUEIREDO','Ingles',9.0,8.0),
  ('LUCAS CAETANO FIGUEIREDO','Biologia',7.1,9.5),
  ('LUCAS CAETANO FIGUEIREDO','Ciencias da Natureza',6.3,8.8),
  ('MARCOS PAULO CARDOSO MARIANO','Redacao',8.8,8.8),
  ('MARCOS PAULO CARDOSO MARIANO','Literatura',9.5,8.8),
  ('MARCOS PAULO CARDOSO MARIANO','Filosofia',10.0,10.0),
  ('MARCOS PAULO CARDOSO MARIANO','Projeto de Vida',10.0,10.0),
  ('MARCOS PAULO CARDOSO MARIANO','Quimica',5.7,9.1),
  ('MARCOS PAULO CARDOSO MARIANO','Fisica',5.0,8.4),
  ('MARCOS PAULO CARDOSO MARIANO','Gramatica',8.6,9.2),
  ('MARCOS PAULO CARDOSO MARIANO','Leitura e Interpretacao',8.5,10.0),
  ('MARCOS PAULO CARDOSO MARIANO','Matematica',10.0,8.5),
  ('MARCOS PAULO CARDOSO MARIANO','Matematica 1',10.0,8.2),
  ('MARCOS PAULO CARDOSO MARIANO','Matematica 2',10.0,8.9),
  ('MARCOS PAULO CARDOSO MARIANO','Geografia Fisica',8.3,9.7),
  ('MARCOS PAULO CARDOSO MARIANO','Geografia Politica',9.1,9.3),
  ('MARCOS PAULO CARDOSO MARIANO','Geografia',8.7,9.5),
  ('MARCOS PAULO CARDOSO MARIANO','Historia',7.8,10.0),
  ('MARCOS PAULO CARDOSO MARIANO','Arte',10.0,10.0),
  ('MARCOS PAULO CARDOSO MARIANO','Educacao Fisica',10.0,10.0),
  ('MARCOS PAULO CARDOSO MARIANO','Ingles',8.5,8.0),
  ('MARCOS PAULO CARDOSO MARIANO','Biologia',6.1,10.0),
  ('MARCOS PAULO CARDOSO MARIANO','Ciencias da Natureza',5.6,9.1),
  ('MARIA JULYA DE SOUZA OLIVEIRA','Redacao',8.7,9.0),
  ('MARIA JULYA DE SOUZA OLIVEIRA','Literatura',8.3,9.2),
  ('MARIA JULYA DE SOUZA OLIVEIRA','Filosofia',10.0,10.0),
  ('MARIA JULYA DE SOUZA OLIVEIRA','Projeto de Vida',10.0,10.0),
  ('MARIA JULYA DE SOUZA OLIVEIRA','Quimica',5.0,7.1),
  ('MARIA JULYA DE SOUZA OLIVEIRA','Fisica',3.5,8.2),
  ('MARIA JULYA DE SOUZA OLIVEIRA','Gramatica',7.7,9.4),
  ('MARIA JULYA DE SOUZA OLIVEIRA','Leitura e Interpretacao',10.0,10.0),
  ('MARIA JULYA DE SOUZA OLIVEIRA','Matematica',7.1,9.7),
  ('MARIA JULYA DE SOUZA OLIVEIRA','Matematica 1',7.2,9.4),
  ('MARIA JULYA DE SOUZA OLIVEIRA','Matematica 2',7.1,10.0),
  ('MARIA JULYA DE SOUZA OLIVEIRA','Geografia Fisica',6.7,10.0),
  ('MARIA JULYA DE SOUZA OLIVEIRA','Geografia Politica',8.0,9.4),
  ('MARIA JULYA DE SOUZA OLIVEIRA','Geografia',7.3,9.7),
  ('MARIA JULYA DE SOUZA OLIVEIRA','Historia',8.0,10.0),
  ('MARIA JULYA DE SOUZA OLIVEIRA','Arte',10.0,10.0),
  ('MARIA JULYA DE SOUZA OLIVEIRA','Educacao Fisica',10.0,10.0),
  ('MARIA JULYA DE SOUZA OLIVEIRA','Ingles',7.5,7.0),
  ('MARIA JULYA DE SOUZA OLIVEIRA','Biologia',6.1,10.0),
  ('MARIA JULYA DE SOUZA OLIVEIRA','Ciencias da Natureza',4.8,8.4),
  ('MARIANNA BORGES DE MATOS ROSA','Redacao',9.5,9.6),
  ('MARIANNA BORGES DE MATOS ROSA','Literatura',8.7,9.4),
  ('MARIANNA BORGES DE MATOS ROSA','Filosofia',10.0,10.0),
  ('MARIANNA BORGES DE MATOS ROSA','Projeto de Vida',10.0,10.0),
  ('MARIANNA BORGES DE MATOS ROSA','Quimica',6.1,8.1),
  ('MARIANNA BORGES DE MATOS ROSA','Fisica',4.2,7.6),
  ('MARIANNA BORGES DE MATOS ROSA','Gramatica',8.9,9.7),
  ('MARIANNA BORGES DE MATOS ROSA','Leitura e Interpretacao',10.0,10.0),
  ('MARIANNA BORGES DE MATOS ROSA','Matematica',9.5,8.8),
  ('MARIANNA BORGES DE MATOS ROSA','Matematica 1',9.0,8.0),
  ('MARIANNA BORGES DE MATOS ROSA','Matematica 2',10.0,9.6),
  ('MARIANNA BORGES DE MATOS ROSA','Geografia Fisica',9.1,10.0),
  ('MARIANNA BORGES DE MATOS ROSA','Geografia Politica',8.4,9.4),
  ('MARIANNA BORGES DE MATOS ROSA','Geografia',8.7,9.7),
  ('MARIANNA BORGES DE MATOS ROSA','Historia',7.9,10.0),
  ('MARIANNA BORGES DE MATOS ROSA','Arte',10.0,10.0),
  ('MARIANNA BORGES DE MATOS ROSA','Educacao Fisica',10.0,10.0),
  ('MARIANNA BORGES DE MATOS ROSA','Ingles',9.0,7.0),
  ('MARIANNA BORGES DE MATOS ROSA','Biologia',7.5,10.0),
  ('MARIANNA BORGES DE MATOS ROSA','Ciencias da Natureza',5.9,8.5),
  ('MIGUEL RODRIGUES DE ALMEIDA','Redacao',8.8,8.0),
  ('MIGUEL RODRIGUES DE ALMEIDA','Literatura',8.5,7.0),
  ('MIGUEL RODRIGUES DE ALMEIDA','Filosofia',10.0,10.0),
  ('MIGUEL RODRIGUES DE ALMEIDA','Projeto de Vida',10.0,10.0),
  ('MIGUEL RODRIGUES DE ALMEIDA','Quimica',6.8,6.9),
  ('MIGUEL RODRIGUES DE ALMEIDA','Fisica',4.1,7.1),
  ('MIGUEL RODRIGUES DE ALMEIDA','Gramatica',9.4,8.2),
  ('MIGUEL RODRIGUES DE ALMEIDA','Leitura e Interpretacao',10.0,10.0),
  ('MIGUEL RODRIGUES DE ALMEIDA','Matematica',7.3,7.0),
  ('MIGUEL RODRIGUES DE ALMEIDA','Matematica 1',7.0,7.0),
  ('MIGUEL RODRIGUES DE ALMEIDA','Matematica 2',7.7,7.0),
  ('MIGUEL RODRIGUES DE ALMEIDA','Geografia Fisica',8.7,7.4),
  ('MIGUEL RODRIGUES DE ALMEIDA','Geografia Politica',8.5,7.7),
  ('MIGUEL RODRIGUES DE ALMEIDA','Geografia',8.6,7.5),
  ('MIGUEL RODRIGUES DE ALMEIDA','Historia',7.7,8.4),
  ('MIGUEL RODRIGUES DE ALMEIDA','Arte',10.0,10.0),
  ('MIGUEL RODRIGUES DE ALMEIDA','Educacao Fisica',10.0,10.0),
  ('MIGUEL RODRIGUES DE ALMEIDA','Ingles',7.5,7.0),
  ('MIGUEL RODRIGUES DE ALMEIDA','Biologia',7.3,7.0),
  ('MIGUEL RODRIGUES DE ALMEIDA','Ciencias da Natureza',6.0,7.0),
  ('VICTOR ARTHUR BARBOSA DOS SANTOS','Redacao',8.3,8.0),
  ('VICTOR ARTHUR BARBOSA DOS SANTOS','Literatura',8.1,8.8),
  ('VICTOR ARTHUR BARBOSA DOS SANTOS','Filosofia',10.0,10.0),
  ('VICTOR ARTHUR BARBOSA DOS SANTOS','Projeto de Vida',10.0,10.0),
  ('VICTOR ARTHUR BARBOSA DOS SANTOS','Quimica',7.0,6.4),
  ('VICTOR ARTHUR BARBOSA DOS SANTOS','Fisica',7.0,7.0),
  ('VICTOR ARTHUR BARBOSA DOS SANTOS','Gramatica',7.6,7.7),
  ('VICTOR ARTHUR BARBOSA DOS SANTOS','Leitura e Interpretacao',10.0,8.2),
  ('VICTOR ARTHUR BARBOSA DOS SANTOS','Matematica',7.9,7.9),
  ('VICTOR ARTHUR BARBOSA DOS SANTOS','Matematica 1',7.8,8.4),
  ('VICTOR ARTHUR BARBOSA DOS SANTOS','Matematica 2',8.0,7.4),
  ('VICTOR ARTHUR BARBOSA DOS SANTOS','Geografia Fisica',7.2,7.9),
  ('VICTOR ARTHUR BARBOSA DOS SANTOS','Geografia Politica',7.8,8.0),
  ('VICTOR ARTHUR BARBOSA DOS SANTOS','Geografia',7.5,7.9),
  ('VICTOR ARTHUR BARBOSA DOS SANTOS','Historia',7.5,8.9),
  ('VICTOR ARTHUR BARBOSA DOS SANTOS','Arte',10.0,10.0),
  ('VICTOR ARTHUR BARBOSA DOS SANTOS','Educacao Fisica',10.0,10.0),
  ('VICTOR ARTHUR BARBOSA DOS SANTOS','Ingles',7.5,7.5),
  ('VICTOR ARTHUR BARBOSA DOS SANTOS','Biologia',7.0,7.7),
  ('VICTOR ARTHUR BARBOSA DOS SANTOS','Ciencias da Natureza',7.0,7.0),
  ('JOAO VITOR GOMES TAVARES','Redacao',8.1,7.5),
  ('JOAO VITOR GOMES TAVARES','Literatura',7.8,7.3),
  ('JOAO VITOR GOMES TAVARES','Filosofia',10.0,10.0),
  ('JOAO VITOR GOMES TAVARES','Projeto de Vida',10.0,10.0),
  ('JOAO VITOR GOMES TAVARES','Quimica',6.5,6.1),
  ('JOAO VITOR GOMES TAVARES','Fisica',5.5,7.0),
  ('JOAO VITOR GOMES TAVARES','Gramatica',7.2,10.0),
  ('JOAO VITOR GOMES TAVARES','Leitura e Interpretacao',10.0,8.3),
  ('JOAO VITOR GOMES TAVARES','Matematica',7.2,5.6),
  ('JOAO VITOR GOMES TAVARES','Matematica 1',7.3,6.1),
  ('JOAO VITOR GOMES TAVARES','Matematica 2',7.2,5.1),
  ('JOAO VITOR GOMES TAVARES','Geografia Fisica',6.7,8.1),
  ('JOAO VITOR GOMES TAVARES','Geografia Politica',3.3,2.6),
  ('JOAO VITOR GOMES TAVARES','Geografia',5.0,5.3),
  ('JOAO VITOR GOMES TAVARES','Historia',7.8,8.6),
  ('JOAO VITOR GOMES TAVARES','Arte',10.0,10.0),
  ('JOAO VITOR GOMES TAVARES','Educacao Fisica',10.0,8.5),
  ('JOAO VITOR GOMES TAVARES','Ingles',8.0,8.0),
  ('JOAO VITOR GOMES TAVARES','Biologia',5.6,7.8),
  ('JOAO VITOR GOMES TAVARES','Ciencias da Natureza',5.8,6.9);

create temp table stg_turma_alvo_9a (turma_id uuid) on commit drop;

insert into stg_turma_alvo_9a (turma_id)
select m.turma_id
from stg_boletim_9ano_a s
join alunos al on pg_temp.norm_nome(al.nome) = pg_temp.norm_nome(s.aluno_nome)
join matriculas m on m.aluno_id = al.id and m.ano_letivo = 2026
group by m.turma_id
order by count(*) desc
limit 1;

do $$
begin
  if (select count(*) from stg_turma_alvo_9a) <> 1 then
    raise exception 'nao foi possivel resolver uma unica turma para os alunos do boletim (9o ANO A)';
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
from stg_boletim_9ano_a s
join disciplinas d on d.serie_id = '28cc4f4d-a171-4dc2-8dfa-9001bf262167' and d.nome = s.disciplina
cross join stg_turma_alvo_9a t
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
from stg_boletim_9ano_a s
join alunos al on pg_temp.norm_nome(al.nome) = pg_temp.norm_nome(s.aluno_nome)
cross join stg_turma_alvo_9a t
join matriculas m on m.aluno_id = al.id and m.ano_letivo = 2026 and m.turma_id = t.turma_id
join disciplinas d on d.serie_id = '28cc4f4d-a171-4dc2-8dfa-9001bf262167' and d.nome = s.disciplina
join avaliacoes a on a.turma_id = t.turma_id and a.disciplina_id = d.id
  and a.bimestre = 1 and a.ano_letivo = 2026 and a.titulo = 'Media Bimestral'
on conflict (avaliacao_id, aluno_id) do update set valor = excluded.valor;

insert into notas (escola_id, avaliacao_id, aluno_id, matricula_id, valor)
select '00000000-0000-0000-0000-000000000001'::uuid, a.id, al.id, m.id, s.b2
from stg_boletim_9ano_a s
join alunos al on pg_temp.norm_nome(al.nome) = pg_temp.norm_nome(s.aluno_nome)
cross join stg_turma_alvo_9a t
join matriculas m on m.aluno_id = al.id and m.ano_letivo = 2026 and m.turma_id = t.turma_id
join disciplinas d on d.serie_id = '28cc4f4d-a171-4dc2-8dfa-9001bf262167' and d.nome = s.disciplina
join avaliacoes a on a.turma_id = t.turma_id and a.disciplina_id = d.id
  and a.bimestre = 2 and a.ano_letivo = 2026 and a.titulo = 'Media Bimestral'
on conflict (avaliacao_id, aluno_id) do update set valor = excluded.valor;
