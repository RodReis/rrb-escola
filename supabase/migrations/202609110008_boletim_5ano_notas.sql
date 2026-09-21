-- Importa notas do boletim (1o e 2o bimestre 2026) das turmas 5o ANO A-Matutino e 5o ANO B-Vespertino.
-- Mesmo padrao das migrations anteriores: avaliacao sintetica "Media Bimestral" por
-- disciplina x bimestre, nota = MB do boletim.
-- Fonte: Resultado - 5 ANO - MATUTINO.pdf / Resultado - 5 ANO - VERPERTINO.pdf.
-- Grasiela Marques Araujo Azevedo (5o ANO A) excluida: boletim com dados incompletos
-- (falta Ciencias, Redacao, Maker, Ensino Religioso e parte de Projeto Semear/Socioemocional).
-- Turma resolvida dinamicamente pela matricula 2026 dos alunos do boletim.

create or replace function pg_temp.norm_nome(txt text) returns text as $$
  select upper(translate(txt,
    'áàâãäÁÀÂÃÄéèêëÉÈÊËíìîïÍÌÎÏóòôõöÓÒÔÕÖúùûüÚÙÛÜçÇñÑ',
    'aaaaaAAAAAeeeeEEEEiiiiIIIIooooOOOOOOuuuuUUUUcCnN'
  ));
$$ language sql immutable;

-- Disciplinas do 5o ANO que ainda nao existiam no seed padrao
insert into disciplinas (escola_id, serie_id, nome, ordem)
select '00000000-0000-0000-0000-000000000001'::uuid, 'c8834ff7-b712-4b46-b25e-ee34d3be5d90'::uuid, nome, ordem
from (values
  ('Redacao', 8),
  ('Maker', 9),
  ('Projeto Semear', 10),
  ('Socioemocional', 11),
  ('Ensino Religioso', 12)
) as novas(nome, ordem)
on conflict (escola_id, serie_id, nome) do nothing;

create temp table stg_boletim_5ano_a (
  aluno_nome text,
  disciplina text,
  b1 numeric(5,2),
  b2 numeric(5,2)
) on commit drop;

create temp table stg_boletim_5ano_b (
  aluno_nome text,
  disciplina text,
  b1 numeric(5,2),
  b2 numeric(5,2)
) on commit drop;

insert into stg_boletim_5ano_a (aluno_nome, disciplina, b1, b2) values
  ('ANA BEATRIZ GONCALVES DUARTE','Ciencias',8.8,8.9),
  ('ANA BEATRIZ GONCALVES DUARTE','Matematica',9.4,9.5),
  ('ANA BEATRIZ GONCALVES DUARTE','Redacao',9.7,9.7),
  ('ANA BEATRIZ GONCALVES DUARTE','Maker',10.0,10.0),
  ('ANA BEATRIZ GONCALVES DUARTE','Projeto Semear',10.0,10.0),
  ('ANA BEATRIZ GONCALVES DUARTE','Socioemocional',10.0,10.0),
  ('ANA BEATRIZ GONCALVES DUARTE','Portugues',9.4,9.1),
  ('ANA BEATRIZ GONCALVES DUARTE','Historia',8.5,8.8),
  ('ANA BEATRIZ GONCALVES DUARTE','Geografia',9.0,9.2),
  ('ANA BEATRIZ GONCALVES DUARTE','Artes',10.0,10.0),
  ('ANA BEATRIZ GONCALVES DUARTE','Educacao Fisica',10.0,10.0),
  ('ANA BEATRIZ GONCALVES DUARTE','Ingles',9.1,8.7),
  ('ANA BEATRIZ GONCALVES DUARTE','Ensino Religioso',10.0,10.0),
  ('ANA JULIA SOUZA VENUTE','Ciencias',9.8,8.4),
  ('ANA JULIA SOUZA VENUTE','Matematica',9.1,10.0),
  ('ANA JULIA SOUZA VENUTE','Redacao',9.7,9.5),
  ('ANA JULIA SOUZA VENUTE','Maker',10.0,10.0),
  ('ANA JULIA SOUZA VENUTE','Projeto Semear',10.0,10.0),
  ('ANA JULIA SOUZA VENUTE','Socioemocional',10.0,10.0),
  ('ANA JULIA SOUZA VENUTE','Portugues',9.7,9.3),
  ('ANA JULIA SOUZA VENUTE','Historia',9.1,9.2),
  ('ANA JULIA SOUZA VENUTE','Geografia',9.0,9.2),
  ('ANA JULIA SOUZA VENUTE','Artes',10.0,10.0),
  ('ANA JULIA SOUZA VENUTE','Educacao Fisica',10.0,10.0),
  ('ANA JULIA SOUZA VENUTE','Ingles',9.4,8.2),
  ('ANA JULIA SOUZA VENUTE','Ensino Religioso',10.0,10.0),
  ('ANA LUIZA NUNES MORAIS','Ciencias',9.8,9.8),
  ('ANA LUIZA NUNES MORAIS','Matematica',9.8,10.0),
  ('ANA LUIZA NUNES MORAIS','Redacao',9.8,9.9),
  ('ANA LUIZA NUNES MORAIS','Maker',10.0,10.0),
  ('ANA LUIZA NUNES MORAIS','Projeto Semear',10.0,10.0),
  ('ANA LUIZA NUNES MORAIS','Socioemocional',10.0,10.0),
  ('ANA LUIZA NUNES MORAIS','Portugues',10.0,9.4),
  ('ANA LUIZA NUNES MORAIS','Historia',9.7,9.8),
  ('ANA LUIZA NUNES MORAIS','Geografia',9.9,9.8),
  ('ANA LUIZA NUNES MORAIS','Artes',10.0,10.0),
  ('ANA LUIZA NUNES MORAIS','Educacao Fisica',10.0,10.0),
  ('ANA LUIZA NUNES MORAIS','Ingles',9.5,8.8),
  ('ANA LUIZA NUNES MORAIS','Ensino Religioso',10.0,10.0),
  ('DANIEL FERREIRA LEITE FILHO','Ciencias',9.7,9.8),
  ('DANIEL FERREIRA LEITE FILHO','Matematica',9.5,10.0),
  ('DANIEL FERREIRA LEITE FILHO','Redacao',9.7,9.8),
  ('DANIEL FERREIRA LEITE FILHO','Maker',10.0,10.0),
  ('DANIEL FERREIRA LEITE FILHO','Projeto Semear',10.0,10.0),
  ('DANIEL FERREIRA LEITE FILHO','Socioemocional',10.0,10.0),
  ('DANIEL FERREIRA LEITE FILHO','Portugues',9.8,9.7),
  ('DANIEL FERREIRA LEITE FILHO','Historia',9.9,9.8),
  ('DANIEL FERREIRA LEITE FILHO','Geografia',9.6,9.5),
  ('DANIEL FERREIRA LEITE FILHO','Artes',10.0,10.0),
  ('DANIEL FERREIRA LEITE FILHO','Educacao Fisica',10.0,10.0),
  ('DANIEL FERREIRA LEITE FILHO','Ingles',9.6,9.2),
  ('DANIEL FERREIRA LEITE FILHO','Ensino Religioso',10.0,10.0),
  ('DAVI DE SOUZA OLIVEIRA','Ciencias',7.6,7.2),
  ('DAVI DE SOUZA OLIVEIRA','Matematica',5.8,7.0),
  ('DAVI DE SOUZA OLIVEIRA','Redacao',7.5,7.5),
  ('DAVI DE SOUZA OLIVEIRA','Maker',10.0,10.0),
  ('DAVI DE SOUZA OLIVEIRA','Projeto Semear',10.0,10.0),
  ('DAVI DE SOUZA OLIVEIRA','Socioemocional',10.0,10.0),
  ('DAVI DE SOUZA OLIVEIRA','Portugues',7.6,7.3),
  ('DAVI DE SOUZA OLIVEIRA','Historia',5.2,7.2),
  ('DAVI DE SOUZA OLIVEIRA','Geografia',7.6,7.2),
  ('DAVI DE SOUZA OLIVEIRA','Artes',10.0,10.0),
  ('DAVI DE SOUZA OLIVEIRA','Educacao Fisica',10.0,10.0),
  ('DAVI DE SOUZA OLIVEIRA','Ingles',7.9,7.9),
  ('DAVI DE SOUZA OLIVEIRA','Ensino Religioso',10.0,10.0),
  ('DAVI GABRIEL SILVA BORGES','Ciencias',9.0,8.6),
  ('DAVI GABRIEL SILVA BORGES','Matematica',8.2,7.6),
  ('DAVI GABRIEL SILVA BORGES','Redacao',9.0,8.8),
  ('DAVI GABRIEL SILVA BORGES','Maker',10.0,10.0),
  ('DAVI GABRIEL SILVA BORGES','Projeto Semear',10.0,10.0),
  ('DAVI GABRIEL SILVA BORGES','Socioemocional',10.0,10.0),
  ('DAVI GABRIEL SILVA BORGES','Portugues',6.3,8.4),
  ('DAVI GABRIEL SILVA BORGES','Historia',7.9,8.9),
  ('DAVI GABRIEL SILVA BORGES','Geografia',6.5,8.6),
  ('DAVI GABRIEL SILVA BORGES','Artes',10.0,10.0),
  ('DAVI GABRIEL SILVA BORGES','Educacao Fisica',10.0,10.0),
  ('DAVI GABRIEL SILVA BORGES','Ingles',9.2,8.0),
  ('DAVI GABRIEL SILVA BORGES','Ensino Religioso',10.0,10.0),
  ('DAVI LUIZ CARDOSO ARAUJO','Ciencias',8.6,8.4),
  ('DAVI LUIZ CARDOSO ARAUJO','Matematica',8.5,8.1),
  ('DAVI LUIZ CARDOSO ARAUJO','Redacao',9.0,8.7),
  ('DAVI LUIZ CARDOSO ARAUJO','Maker',10.0,10.0),
  ('DAVI LUIZ CARDOSO ARAUJO','Projeto Semear',10.0,10.0),
  ('DAVI LUIZ CARDOSO ARAUJO','Socioemocional',10.0,10.0),
  ('DAVI LUIZ CARDOSO ARAUJO','Portugues',9.0,8.3),
  ('DAVI LUIZ CARDOSO ARAUJO','Historia',8.2,8.7),
  ('DAVI LUIZ CARDOSO ARAUJO','Geografia',8.5,8.4),
  ('DAVI LUIZ CARDOSO ARAUJO','Artes',10.0,10.0),
  ('DAVI LUIZ CARDOSO ARAUJO','Educacao Fisica',10.0,10.0),
  ('DAVI LUIZ CARDOSO ARAUJO','Ingles',8.0,8.0),
  ('DAVI LUIZ CARDOSO ARAUJO','Ensino Religioso',10.0,10.0),
  ('EVELLYN NEVES DE OLIVEIRA ARAUJO','Ciencias',9.0,8.9),
  ('EVELLYN NEVES DE OLIVEIRA ARAUJO','Matematica',7.0,8.1),
  ('EVELLYN NEVES DE OLIVEIRA ARAUJO','Redacao',9.5,9.7),
  ('EVELLYN NEVES DE OLIVEIRA ARAUJO','Maker',10.0,10.0),
  ('EVELLYN NEVES DE OLIVEIRA ARAUJO','Projeto Semear',10.0,10.0),
  ('EVELLYN NEVES DE OLIVEIRA ARAUJO','Socioemocional',10.0,10.0),
  ('EVELLYN NEVES DE OLIVEIRA ARAUJO','Portugues',9.2,8.0),
  ('EVELLYN NEVES DE OLIVEIRA ARAUJO','Historia',8.5,8.5),
  ('EVELLYN NEVES DE OLIVEIRA ARAUJO','Geografia',8.9,8.5),
  ('EVELLYN NEVES DE OLIVEIRA ARAUJO','Artes',10.0,10.0),
  ('EVELLYN NEVES DE OLIVEIRA ARAUJO','Educacao Fisica',10.0,10.0),
  ('EVELLYN NEVES DE OLIVEIRA ARAUJO','Ingles',8.1,8.0),
  ('EVELLYN NEVES DE OLIVEIRA ARAUJO','Ensino Religioso',10.0,10.0),
  ('HEITOR SILVA PARREIRA','Ciencias',9.8,9.9),
  ('HEITOR SILVA PARREIRA','Matematica',9.6,9.8),
  ('HEITOR SILVA PARREIRA','Redacao',9.7,9.9),
  ('HEITOR SILVA PARREIRA','Maker',10.0,10.0),
  ('HEITOR SILVA PARREIRA','Projeto Semear',10.0,10.0),
  ('HEITOR SILVA PARREIRA','Socioemocional',10.0,10.0),
  ('HEITOR SILVA PARREIRA','Portugues',9.9,9.3),
  ('HEITOR SILVA PARREIRA','Historia',9.6,9.6),
  ('HEITOR SILVA PARREIRA','Geografia',9.3,9.9),
  ('HEITOR SILVA PARREIRA','Artes',10.0,10.0),
  ('HEITOR SILVA PARREIRA','Educacao Fisica',10.0,10.0),
  ('HEITOR SILVA PARREIRA','Ingles',9.4,9.3),
  ('HEITOR SILVA PARREIRA','Ensino Religioso',10.0,10.0),
  ('HELOISA VINHAL SILVA','Ciencias',9.9,9.5),
  ('HELOISA VINHAL SILVA','Matematica',10.0,10.0),
  ('HELOISA VINHAL SILVA','Redacao',9.9,9.7),
  ('HELOISA VINHAL SILVA','Maker',10.0,10.0),
  ('HELOISA VINHAL SILVA','Projeto Semear',10.0,10.0),
  ('HELOISA VINHAL SILVA','Socioemocional',10.0,10.0),
  ('HELOISA VINHAL SILVA','Portugues',9.9,9.6),
  ('HELOISA VINHAL SILVA','Historia',9.4,9.7),
  ('HELOISA VINHAL SILVA','Geografia',9.9,9.7),
  ('HELOISA VINHAL SILVA','Artes',10.0,10.0),
  ('HELOISA VINHAL SILVA','Educacao Fisica',10.0,10.0),
  ('HELOISA VINHAL SILVA','Ingles',9.6,9.8),
  ('HELOISA VINHAL SILVA','Ensino Religioso',10.0,10.0),
  ('HENRIQUE LAUFER CARDOSO','Ciencias',8.4,8.6),
  ('HENRIQUE LAUFER CARDOSO','Matematica',7.5,8.4),
  ('HENRIQUE LAUFER CARDOSO','Redacao',9.5,8.7),
  ('HENRIQUE LAUFER CARDOSO','Maker',10.0,10.0),
  ('HENRIQUE LAUFER CARDOSO','Projeto Semear',10.0,10.0),
  ('HENRIQUE LAUFER CARDOSO','Socioemocional',10.0,10.0),
  ('HENRIQUE LAUFER CARDOSO','Portugues',8.3,8.3),
  ('HENRIQUE LAUFER CARDOSO','Historia',7.1,8.7),
  ('HENRIQUE LAUFER CARDOSO','Geografia',7.9,8.7),
  ('HENRIQUE LAUFER CARDOSO','Artes',10.0,10.0),
  ('HENRIQUE LAUFER CARDOSO','Educacao Fisica',10.0,10.0),
  ('HENRIQUE LAUFER CARDOSO','Ingles',8.3,8.3),
  ('HENRIQUE LAUFER CARDOSO','Ensino Religioso',10.0,10.0),
  ('JOAO GABRIEL SILVA MIRANDA','Ciencias',9.1,9.3),
  ('JOAO GABRIEL SILVA MIRANDA','Matematica',9.3,9.5),
  ('JOAO GABRIEL SILVA MIRANDA','Redacao',9.0,9.7),
  ('JOAO GABRIEL SILVA MIRANDA','Maker',10.0,10.0),
  ('JOAO GABRIEL SILVA MIRANDA','Projeto Semear',10.0,10.0),
  ('JOAO GABRIEL SILVA MIRANDA','Socioemocional',10.0,10.0),
  ('JOAO GABRIEL SILVA MIRANDA','Portugues',9.2,9.0),
  ('JOAO GABRIEL SILVA MIRANDA','Historia',8.3,9.0),
  ('JOAO GABRIEL SILVA MIRANDA','Geografia',9.4,9.1),
  ('JOAO GABRIEL SILVA MIRANDA','Artes',10.0,10.0),
  ('JOAO GABRIEL SILVA MIRANDA','Educacao Fisica',10.0,10.0),
  ('JOAO GABRIEL SILVA MIRANDA','Ingles',8.1,8.2),
  ('JOAO GABRIEL SILVA MIRANDA','Ensino Religioso',10.0,10.0),
  ('LUIS EDUARDO FERREIRA LINKE','Ciencias',8.0,7.9),
  ('LUIS EDUARDO FERREIRA LINKE','Matematica',8.3,6.5),
  ('LUIS EDUARDO FERREIRA LINKE','Redacao',8.5,7.8),
  ('LUIS EDUARDO FERREIRA LINKE','Maker',10.0,10.0),
  ('LUIS EDUARDO FERREIRA LINKE','Projeto Semear',10.0,10.0),
  ('LUIS EDUARDO FERREIRA LINKE','Socioemocional',10.0,10.0),
  ('LUIS EDUARDO FERREIRA LINKE','Portugues',8.3,7.5),
  ('LUIS EDUARDO FERREIRA LINKE','Historia',4.2,7.5),
  ('LUIS EDUARDO FERREIRA LINKE','Geografia',7.7,7.8),
  ('LUIS EDUARDO FERREIRA LINKE','Artes',10.0,10.0),
  ('LUIS EDUARDO FERREIRA LINKE','Educacao Fisica',10.0,10.0),
  ('LUIS EDUARDO FERREIRA LINKE','Ingles',8.2,7.5),
  ('LUIS EDUARDO FERREIRA LINKE','Ensino Religioso',10.0,10.0),
  ('MARIA CECILIA RODRIGUES ARAUJO','Ciencias',9.5,9.4),
  ('MARIA CECILIA RODRIGUES ARAUJO','Matematica',9.5,9.8),
  ('MARIA CECILIA RODRIGUES ARAUJO','Redacao',9.5,9.8),
  ('MARIA CECILIA RODRIGUES ARAUJO','Maker',10.0,10.0),
  ('MARIA CECILIA RODRIGUES ARAUJO','Projeto Semear',10.0,10.0),
  ('MARIA CECILIA RODRIGUES ARAUJO','Socioemocional',10.0,10.0),
  ('MARIA CECILIA RODRIGUES ARAUJO','Portugues',9.1,9.3),
  ('MARIA CECILIA RODRIGUES ARAUJO','Historia',8.9,9.2),
  ('MARIA CECILIA RODRIGUES ARAUJO','Geografia',9.4,9.3),
  ('MARIA CECILIA RODRIGUES ARAUJO','Artes',10.0,10.0),
  ('MARIA CECILIA RODRIGUES ARAUJO','Educacao Fisica',10.0,10.0),
  ('MARIA CECILIA RODRIGUES ARAUJO','Ingles',9.3,8.7),
  ('MARIA CECILIA RODRIGUES ARAUJO','Ensino Religioso',10.0,10.0),
  ('MIGUEL LUIS SOUSA RIBEIRO','Ciencias',9.0,8.6),
  ('MIGUEL LUIS SOUSA RIBEIRO','Matematica',8.1,8.4),
  ('MIGUEL LUIS SOUSA RIBEIRO','Redacao',9.3,9.0),
  ('MIGUEL LUIS SOUSA RIBEIRO','Maker',10.0,10.0),
  ('MIGUEL LUIS SOUSA RIBEIRO','Projeto Semear',10.0,10.0),
  ('MIGUEL LUIS SOUSA RIBEIRO','Socioemocional',10.0,10.0),
  ('MIGUEL LUIS SOUSA RIBEIRO','Portugues',9.1,8.3),
  ('MIGUEL LUIS SOUSA RIBEIRO','Historia',8.5,9.3),
  ('MIGUEL LUIS SOUSA RIBEIRO','Geografia',8.7,9.0),
  ('MIGUEL LUIS SOUSA RIBEIRO','Artes',10.0,10.0),
  ('MIGUEL LUIS SOUSA RIBEIRO','Educacao Fisica',10.0,10.0),
  ('MIGUEL LUIS SOUSA RIBEIRO','Ingles',8.7,8.0),
  ('MIGUEL LUIS SOUSA RIBEIRO','Ensino Religioso',10.0,10.0),
  ('MIGUEL NUNES TRAJANO DE MORAES SILVA','Ciencias',7.1,8.2),
  ('MIGUEL NUNES TRAJANO DE MORAES SILVA','Matematica',7.6,7.2),
  ('MIGUEL NUNES TRAJANO DE MORAES SILVA','Redacao',8.5,9.0),
  ('MIGUEL NUNES TRAJANO DE MORAES SILVA','Maker',10.0,10.0),
  ('MIGUEL NUNES TRAJANO DE MORAES SILVA','Projeto Semear',10.0,10.0),
  ('MIGUEL NUNES TRAJANO DE MORAES SILVA','Socioemocional',10.0,10.0),
  ('MIGUEL NUNES TRAJANO DE MORAES SILVA','Portugues',7.6,7.6),
  ('MIGUEL NUNES TRAJANO DE MORAES SILVA','Historia',7.2,6.5),
  ('MIGUEL NUNES TRAJANO DE MORAES SILVA','Geografia',7.0,7.5),
  ('MIGUEL NUNES TRAJANO DE MORAES SILVA','Artes',10.0,10.0),
  ('MIGUEL NUNES TRAJANO DE MORAES SILVA','Educacao Fisica',10.0,10.0),
  ('MIGUEL NUNES TRAJANO DE MORAES SILVA','Ingles',8.1,7.5),
  ('MIGUEL NUNES TRAJANO DE MORAES SILVA','Ensino Religioso',10.0,10.0),
  ('VALENTINA RODRIGUES AVELINO DE FREITAS RAMOS','Ciencias',9.1,9.3),
  ('VALENTINA RODRIGUES AVELINO DE FREITAS RAMOS','Matematica',8.7,8.9),
  ('VALENTINA RODRIGUES AVELINO DE FREITAS RAMOS','Redacao',9.7,9.7),
  ('VALENTINA RODRIGUES AVELINO DE FREITAS RAMOS','Maker',10.0,10.0),
  ('VALENTINA RODRIGUES AVELINO DE FREITAS RAMOS','Projeto Semear',10.0,10.0),
  ('VALENTINA RODRIGUES AVELINO DE FREITAS RAMOS','Socioemocional',10.0,10.0),
  ('VALENTINA RODRIGUES AVELINO DE FREITAS RAMOS','Portugues',9.7,8.8),
  ('VALENTINA RODRIGUES AVELINO DE FREITAS RAMOS','Historia',8.9,9.1),
  ('VALENTINA RODRIGUES AVELINO DE FREITAS RAMOS','Geografia',8.9,9.2),
  ('VALENTINA RODRIGUES AVELINO DE FREITAS RAMOS','Artes',10.0,10.0),
  ('VALENTINA RODRIGUES AVELINO DE FREITAS RAMOS','Educacao Fisica',10.0,10.0),
  ('VALENTINA RODRIGUES AVELINO DE FREITAS RAMOS','Ingles',8.1,8.0),
  ('VALENTINA RODRIGUES AVELINO DE FREITAS RAMOS','Ensino Religioso',10.0,10.0),
  ('WILSON DE PAIVA NETO','Ciencias',9.2,8.8),
  ('WILSON DE PAIVA NETO','Matematica',8.0,7.5),
  ('WILSON DE PAIVA NETO','Redacao',9.5,8.8),
  ('WILSON DE PAIVA NETO','Maker',10.0,10.0),
  ('WILSON DE PAIVA NETO','Projeto Semear',10.0,10.0),
  ('WILSON DE PAIVA NETO','Socioemocional',10.0,10.0),
  ('WILSON DE PAIVA NETO','Portugues',9.3,8.2),
  ('WILSON DE PAIVA NETO','Historia',6.7,8.2),
  ('WILSON DE PAIVA NETO','Geografia',7.8,7.8),
  ('WILSON DE PAIVA NETO','Artes',10.0,10.0),
  ('WILSON DE PAIVA NETO','Educacao Fisica',10.0,10.0),
  ('WILSON DE PAIVA NETO','Ingles',9.2,8.2),
  ('WILSON DE PAIVA NETO','Ensino Religioso',10.0,10.0),
  ('YAN LEVI PORFIRIO MONTEIRO COSTA','Ciencias',9.7,9.4),
  ('YAN LEVI PORFIRIO MONTEIRO COSTA','Matematica',9.7,9.2),
  ('YAN LEVI PORFIRIO MONTEIRO COSTA','Redacao',9.8,9.5),
  ('YAN LEVI PORFIRIO MONTEIRO COSTA','Maker',10.0,10.0),
  ('YAN LEVI PORFIRIO MONTEIRO COSTA','Projeto Semear',10.0,10.0),
  ('YAN LEVI PORFIRIO MONTEIRO COSTA','Socioemocional',10.0,10.0),
  ('YAN LEVI PORFIRIO MONTEIRO COSTA','Portugues',9.5,9.2),
  ('YAN LEVI PORFIRIO MONTEIRO COSTA','Historia',9.2,9.4),
  ('YAN LEVI PORFIRIO MONTEIRO COSTA','Geografia',9.7,9.6),
  ('YAN LEVI PORFIRIO MONTEIRO COSTA','Artes',10.0,10.0),
  ('YAN LEVI PORFIRIO MONTEIRO COSTA','Educacao Fisica',10.0,10.0),
  ('YAN LEVI PORFIRIO MONTEIRO COSTA','Ingles',9.8,8.8),
  ('YAN LEVI PORFIRIO MONTEIRO COSTA','Ensino Religioso',10.0,10.0);

insert into stg_boletim_5ano_b (aluno_nome, disciplina, b1, b2) values
  ('ALICE CABRINY ALVES DE ALMEIDA','Ciencias',9.0,8.7),
  ('ALICE CABRINY ALVES DE ALMEIDA','Matematica',9.0,9.4),
  ('ALICE CABRINY ALVES DE ALMEIDA','Redacao',10.0,10.0),
  ('ALICE CABRINY ALVES DE ALMEIDA','Maker',10.0,10.0),
  ('ALICE CABRINY ALVES DE ALMEIDA','Projeto Semear',10.0,10.0),
  ('ALICE CABRINY ALVES DE ALMEIDA','Socioemocional',10.0,10.0),
  ('ALICE CABRINY ALVES DE ALMEIDA','Portugues',9.6,8.2),
  ('ALICE CABRINY ALVES DE ALMEIDA','Historia',8.2,8.2),
  ('ALICE CABRINY ALVES DE ALMEIDA','Geografia',8.9,9.3),
  ('ALICE CABRINY ALVES DE ALMEIDA','Artes',10.0,10.0),
  ('ALICE CABRINY ALVES DE ALMEIDA','Educacao Fisica',10.0,10.0),
  ('ALICE CABRINY ALVES DE ALMEIDA','Ingles',9.5,9.0),
  ('ALICE CABRINY ALVES DE ALMEIDA','Ensino Religioso',10.0,10.0),
  ('ANA LAURA DE SOUZA VALERIANO','Ciencias',9.4,9.3),
  ('ANA LAURA DE SOUZA VALERIANO','Matematica',9.9,9.8),
  ('ANA LAURA DE SOUZA VALERIANO','Redacao',8.9,9.5),
  ('ANA LAURA DE SOUZA VALERIANO','Maker',10.0,10.0),
  ('ANA LAURA DE SOUZA VALERIANO','Projeto Semear',10.0,10.0),
  ('ANA LAURA DE SOUZA VALERIANO','Socioemocional',10.0,10.0),
  ('ANA LAURA DE SOUZA VALERIANO','Portugues',9.5,8.5),
  ('ANA LAURA DE SOUZA VALERIANO','Historia',8.7,9.0),
  ('ANA LAURA DE SOUZA VALERIANO','Geografia',8.7,9.2),
  ('ANA LAURA DE SOUZA VALERIANO','Artes',10.0,9.5),
  ('ANA LAURA DE SOUZA VALERIANO','Educacao Fisica',10.0,10.0),
  ('ANA LAURA DE SOUZA VALERIANO','Ingles',9.6,9.4),
  ('ANA LAURA DE SOUZA VALERIANO','Ensino Religioso',10.0,10.0),
  ('BOAZ MARRA GARCIA','Ciencias',9.9,9.7),
  ('BOAZ MARRA GARCIA','Matematica',10.0,10.0),
  ('BOAZ MARRA GARCIA','Redacao',10.0,9.7),
  ('BOAZ MARRA GARCIA','Maker',10.0,10.0),
  ('BOAZ MARRA GARCIA','Projeto Semear',10.0,10.0),
  ('BOAZ MARRA GARCIA','Socioemocional',10.0,10.0),
  ('BOAZ MARRA GARCIA','Portugues',9.1,9.5),
  ('BOAZ MARRA GARCIA','Historia',9.4,9.3),
  ('BOAZ MARRA GARCIA','Geografia',9.9,9.5),
  ('BOAZ MARRA GARCIA','Artes',10.0,10.0),
  ('BOAZ MARRA GARCIA','Educacao Fisica',10.0,10.0),
  ('BOAZ MARRA GARCIA','Ingles',9.7,9.7),
  ('BOAZ MARRA GARCIA','Ensino Religioso',10.0,10.0),
  ('CATARINA QUEIROZ DIAS','Ciencias',8.3,8.0),
  ('CATARINA QUEIROZ DIAS','Matematica',8.9,9.0),
  ('CATARINA QUEIROZ DIAS','Redacao',9.5,8.7),
  ('CATARINA QUEIROZ DIAS','Maker',10.0,10.0),
  ('CATARINA QUEIROZ DIAS','Projeto Semear',10.0,10.0),
  ('CATARINA QUEIROZ DIAS','Socioemocional',10.0,10.0),
  ('CATARINA QUEIROZ DIAS','Portugues',8.4,8.1),
  ('CATARINA QUEIROZ DIAS','Historia',8.0,7.7),
  ('CATARINA QUEIROZ DIAS','Geografia',8.4,8.7),
  ('CATARINA QUEIROZ DIAS','Artes',10.0,9.5),
  ('CATARINA QUEIROZ DIAS','Educacao Fisica',10.0,10.0),
  ('CATARINA QUEIROZ DIAS','Ingles',8.5,8.4),
  ('CATARINA QUEIROZ DIAS','Ensino Religioso',9.5,9.0),
  ('HENRIQUE FERNANDES FERREIRA','Ciencias',8.4,8.6),
  ('HENRIQUE FERNANDES FERREIRA','Matematica',8.6,9.0),
  ('HENRIQUE FERNANDES FERREIRA','Redacao',9.5,8.0),
  ('HENRIQUE FERNANDES FERREIRA','Maker',10.0,10.0),
  ('HENRIQUE FERNANDES FERREIRA','Projeto Semear',10.0,10.0),
  ('HENRIQUE FERNANDES FERREIRA','Socioemocional',10.0,10.0),
  ('HENRIQUE FERNANDES FERREIRA','Portugues',8.8,8.2),
  ('HENRIQUE FERNANDES FERREIRA','Historia',8.5,8.1),
  ('HENRIQUE FERNANDES FERREIRA','Geografia',8.8,8.1),
  ('HENRIQUE FERNANDES FERREIRA','Artes',9.0,8.0),
  ('HENRIQUE FERNANDES FERREIRA','Educacao Fisica',10.0,10.0),
  ('HENRIQUE FERNANDES FERREIRA','Ingles',8.7,8.5),
  ('HENRIQUE FERNANDES FERREIRA','Ensino Religioso',10.0,9.5),
  ('JOAO ANTONIO AFRA OLIVEIRA','Ciencias',9.4,9.1),
  ('JOAO ANTONIO AFRA OLIVEIRA','Matematica',9.7,9.6),
  ('JOAO ANTONIO AFRA OLIVEIRA','Redacao',9.7,9.8),
  ('JOAO ANTONIO AFRA OLIVEIRA','Maker',10.0,10.0),
  ('JOAO ANTONIO AFRA OLIVEIRA','Projeto Semear',10.0,10.0),
  ('JOAO ANTONIO AFRA OLIVEIRA','Socioemocional',10.0,10.0),
  ('JOAO ANTONIO AFRA OLIVEIRA','Portugues',9.4,8.7),
  ('JOAO ANTONIO AFRA OLIVEIRA','Historia',9.3,8.7),
  ('JOAO ANTONIO AFRA OLIVEIRA','Geografia',9.4,9.2),
  ('JOAO ANTONIO AFRA OLIVEIRA','Artes',9.5,8.5),
  ('JOAO ANTONIO AFRA OLIVEIRA','Educacao Fisica',10.0,10.0),
  ('JOAO ANTONIO AFRA OLIVEIRA','Ingles',8.7,8.9),
  ('JOAO ANTONIO AFRA OLIVEIRA','Ensino Religioso',10.0,9.5),
  ('JOAO LUCAS NERES CUNHA ALVES','Ciencias',7.6,8.1),
  ('JOAO LUCAS NERES CUNHA ALVES','Matematica',8.3,8.1),
  ('JOAO LUCAS NERES CUNHA ALVES','Redacao',8.8,9.6),
  ('JOAO LUCAS NERES CUNHA ALVES','Maker',10.0,10.0),
  ('JOAO LUCAS NERES CUNHA ALVES','Projeto Semear',10.0,10.0),
  ('JOAO LUCAS NERES CUNHA ALVES','Socioemocional',10.0,10.0),
  ('JOAO LUCAS NERES CUNHA ALVES','Portugues',8.6,7.8),
  ('JOAO LUCAS NERES CUNHA ALVES','Historia',7.8,7.4),
  ('JOAO LUCAS NERES CUNHA ALVES','Geografia',8.1,7.7),
  ('JOAO LUCAS NERES CUNHA ALVES','Artes',8.0,8.0),
  ('JOAO LUCAS NERES CUNHA ALVES','Educacao Fisica',10.0,10.0),
  ('JOAO LUCAS NERES CUNHA ALVES','Ingles',8.2,8.1),
  ('JOAO LUCAS NERES CUNHA ALVES','Ensino Religioso',9.5,9.0),
  ('MARIA JULIA DELMONICO TORRANO RIOS','Ciencias',9.0,8.4),
  ('MARIA JULIA DELMONICO TORRANO RIOS','Matematica',8.7,9.3),
  ('MARIA JULIA DELMONICO TORRANO RIOS','Redacao',10.0,9.8),
  ('MARIA JULIA DELMONICO TORRANO RIOS','Maker',10.0,10.0),
  ('MARIA JULIA DELMONICO TORRANO RIOS','Projeto Semear',10.0,10.0),
  ('MARIA JULIA DELMONICO TORRANO RIOS','Socioemocional',10.0,10.0),
  ('MARIA JULIA DELMONICO TORRANO RIOS','Portugues',9.3,8.4),
  ('MARIA JULIA DELMONICO TORRANO RIOS','Historia',8.1,8.5),
  ('MARIA JULIA DELMONICO TORRANO RIOS','Geografia',8.5,9.2),
  ('MARIA JULIA DELMONICO TORRANO RIOS','Artes',10.0,10.0),
  ('MARIA JULIA DELMONICO TORRANO RIOS','Educacao Fisica',10.0,10.0),
  ('MARIA JULIA DELMONICO TORRANO RIOS','Ingles',9.3,9.6),
  ('MARIA JULIA DELMONICO TORRANO RIOS','Ensino Religioso',10.0,9.0),
  ('MARIA PILAR GONCALVES CALABRIA DE DEUS','Ciencias',8.2,8.0),
  ('MARIA PILAR GONCALVES CALABRIA DE DEUS','Matematica',8.5,8.1),
  ('MARIA PILAR GONCALVES CALABRIA DE DEUS','Redacao',9.5,9.5),
  ('MARIA PILAR GONCALVES CALABRIA DE DEUS','Maker',10.0,10.0),
  ('MARIA PILAR GONCALVES CALABRIA DE DEUS','Projeto Semear',10.0,10.0),
  ('MARIA PILAR GONCALVES CALABRIA DE DEUS','Socioemocional',10.0,10.0),
  ('MARIA PILAR GONCALVES CALABRIA DE DEUS','Portugues',9.4,7.9),
  ('MARIA PILAR GONCALVES CALABRIA DE DEUS','Historia',8.2,8.1),
  ('MARIA PILAR GONCALVES CALABRIA DE DEUS','Geografia',8.5,8.7),
  ('MARIA PILAR GONCALVES CALABRIA DE DEUS','Artes',9.5,8.5),
  ('MARIA PILAR GONCALVES CALABRIA DE DEUS','Educacao Fisica',10.0,10.0),
  ('MARIA PILAR GONCALVES CALABRIA DE DEUS','Ingles',8.2,8.7),
  ('MARIA PILAR GONCALVES CALABRIA DE DEUS','Ensino Religioso',10.0,9.0),
  ('MATHEUS VIEIRA SILVA','Ciencias',9.9,8.6),
  ('MATHEUS VIEIRA SILVA','Matematica',9.8,9.7),
  ('MATHEUS VIEIRA SILVA','Redacao',9.5,9.7),
  ('MATHEUS VIEIRA SILVA','Maker',10.0,10.0),
  ('MATHEUS VIEIRA SILVA','Projeto Semear',10.0,10.0),
  ('MATHEUS VIEIRA SILVA','Socioemocional',10.0,10.0),
  ('MATHEUS VIEIRA SILVA','Portugues',9.2,8.8),
  ('MATHEUS VIEIRA SILVA','Historia',9.5,8.8),
  ('MATHEUS VIEIRA SILVA','Geografia',9.6,9.2),
  ('MATHEUS VIEIRA SILVA','Artes',9.0,9.0),
  ('MATHEUS VIEIRA SILVA','Educacao Fisica',10.0,10.0),
  ('MATHEUS VIEIRA SILVA','Ingles',9.0,9.3),
  ('MATHEUS VIEIRA SILVA','Ensino Religioso',10.0,9.5),
  ('PAOLLA CABRINI PIRES','Ciencias',7.0,7.3),
  ('PAOLLA CABRINI PIRES','Matematica',8.8,8.2),
  ('PAOLLA CABRINI PIRES','Redacao',9.5,8.0),
  ('PAOLLA CABRINI PIRES','Maker',10.0,10.0),
  ('PAOLLA CABRINI PIRES','Projeto Semear',10.0,10.0),
  ('PAOLLA CABRINI PIRES','Socioemocional',10.0,10.0),
  ('PAOLLA CABRINI PIRES','Portugues',7.5,6.5),
  ('PAOLLA CABRINI PIRES','Historia',7.8,6.6),
  ('PAOLLA CABRINI PIRES','Geografia',7.6,7.6),
  ('PAOLLA CABRINI PIRES','Artes',8.0,8.0),
  ('PAOLLA CABRINI PIRES','Educacao Fisica',10.0,10.0),
  ('PAOLLA CABRINI PIRES','Ingles',8.8,8.2),
  ('PAOLLA CABRINI PIRES','Ensino Religioso',9.0,8.0),
  ('PEDRO JOAO TANCREDI COUTO','Ciencias',7.3,6.1),
  ('PEDRO JOAO TANCREDI COUTO','Matematica',7.0,5.6),
  ('PEDRO JOAO TANCREDI COUTO','Redacao',9.0,7.5),
  ('PEDRO JOAO TANCREDI COUTO','Maker',10.0,10.0),
  ('PEDRO JOAO TANCREDI COUTO','Projeto Semear',10.0,10.0),
  ('PEDRO JOAO TANCREDI COUTO','Socioemocional',10.0,10.0),
  ('PEDRO JOAO TANCREDI COUTO','Portugues',7.3,6.4),
  ('PEDRO JOAO TANCREDI COUTO','Historia',7.2,6.9),
  ('PEDRO JOAO TANCREDI COUTO','Geografia',7.7,6.9),
  ('PEDRO JOAO TANCREDI COUTO','Artes',8.0,7.5),
  ('PEDRO JOAO TANCREDI COUTO','Educacao Fisica',10.0,10.0),
  ('PEDRO JOAO TANCREDI COUTO','Ingles',8.2,8.3),
  ('PEDRO JOAO TANCREDI COUTO','Ensino Religioso',9.0,8.0),
  ('RAPHAELA PAULA ALCANTARA','Ciencias',8.2,7.5),
  ('RAPHAELA PAULA ALCANTARA','Matematica',9.3,8.7),
  ('RAPHAELA PAULA ALCANTARA','Redacao',9.7,8.8),
  ('RAPHAELA PAULA ALCANTARA','Maker',10.0,10.0),
  ('RAPHAELA PAULA ALCANTARA','Projeto Semear',10.0,10.0),
  ('RAPHAELA PAULA ALCANTARA','Socioemocional',10.0,10.0),
  ('RAPHAELA PAULA ALCANTARA','Portugues',8.7,7.4),
  ('RAPHAELA PAULA ALCANTARA','Historia',7.8,8.3),
  ('RAPHAELA PAULA ALCANTARA','Geografia',8.1,8.5),
  ('RAPHAELA PAULA ALCANTARA','Artes',10.0,9.5),
  ('RAPHAELA PAULA ALCANTARA','Educacao Fisica',10.0,10.0),
  ('RAPHAELA PAULA ALCANTARA','Ingles',8.4,9.6),
  ('RAPHAELA PAULA ALCANTARA','Ensino Religioso',9.5,9.0),
  ('MARIA EDUARDA OLIVEIRA COSTA','Ciencias',7.9,7.6),
  ('MARIA EDUARDA OLIVEIRA COSTA','Matematica',6.6,6.1),
  ('MARIA EDUARDA OLIVEIRA COSTA','Redacao',8.0,7.7),
  ('MARIA EDUARDA OLIVEIRA COSTA','Maker',10.0,10.0),
  ('MARIA EDUARDA OLIVEIRA COSTA','Projeto Semear',10.0,10.0),
  ('MARIA EDUARDA OLIVEIRA COSTA','Socioemocional',10.0,10.0),
  ('MARIA EDUARDA OLIVEIRA COSTA','Portugues',8.2,7.5),
  ('MARIA EDUARDA OLIVEIRA COSTA','Historia',7.8,7.5),
  ('MARIA EDUARDA OLIVEIRA COSTA','Geografia',7.9,7.4),
  ('MARIA EDUARDA OLIVEIRA COSTA','Artes',8.5,8.5),
  ('MARIA EDUARDA OLIVEIRA COSTA','Educacao Fisica',10.0,10.0),
  ('MARIA EDUARDA OLIVEIRA COSTA','Ingles',8.0,7.9),
  ('MARIA EDUARDA OLIVEIRA COSTA','Ensino Religioso',9.0,8.5);

-- Turma A (Matutino)
create temp table stg_turma_alvo_5a (turma_id uuid) on commit drop;

insert into stg_turma_alvo_5a (turma_id)
select m.turma_id
from stg_boletim_5ano_a s
join alunos al on pg_temp.norm_nome(al.nome) = pg_temp.norm_nome(s.aluno_nome)
join matriculas m on m.aluno_id = al.id and m.ano_letivo = 2026
group by m.turma_id
order by count(*) desc
limit 1;

do $$
begin
  if (select count(*) from stg_turma_alvo_5a) <> 1 then
    raise exception 'nao foi possivel resolver uma unica turma para os alunos do boletim (5o ANO A)';
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
from stg_boletim_5ano_a s
join disciplinas d on d.serie_id = 'c8834ff7-b712-4b46-b25e-ee34d3be5d90' and d.nome = s.disciplina
cross join stg_turma_alvo_5a t
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
from stg_boletim_5ano_a s
join alunos al on pg_temp.norm_nome(al.nome) = pg_temp.norm_nome(s.aluno_nome)
cross join stg_turma_alvo_5a t
join matriculas m on m.aluno_id = al.id and m.ano_letivo = 2026 and m.turma_id = t.turma_id
join disciplinas d on d.serie_id = 'c8834ff7-b712-4b46-b25e-ee34d3be5d90' and d.nome = s.disciplina
join avaliacoes a on a.turma_id = t.turma_id and a.disciplina_id = d.id
  and a.bimestre = 1 and a.ano_letivo = 2026 and a.titulo = 'Media Bimestral'
on conflict (avaliacao_id, aluno_id) do update set valor = excluded.valor;

insert into notas (escola_id, avaliacao_id, aluno_id, matricula_id, valor)
select '00000000-0000-0000-0000-000000000001'::uuid, a.id, al.id, m.id, s.b2
from stg_boletim_5ano_a s
join alunos al on pg_temp.norm_nome(al.nome) = pg_temp.norm_nome(s.aluno_nome)
cross join stg_turma_alvo_5a t
join matriculas m on m.aluno_id = al.id and m.ano_letivo = 2026 and m.turma_id = t.turma_id
join disciplinas d on d.serie_id = 'c8834ff7-b712-4b46-b25e-ee34d3be5d90' and d.nome = s.disciplina
join avaliacoes a on a.turma_id = t.turma_id and a.disciplina_id = d.id
  and a.bimestre = 2 and a.ano_letivo = 2026 and a.titulo = 'Media Bimestral'
on conflict (avaliacao_id, aluno_id) do update set valor = excluded.valor;

-- Turma B (Vespertino)
create temp table stg_turma_alvo_5b (turma_id uuid) on commit drop;

insert into stg_turma_alvo_5b (turma_id)
select m.turma_id
from stg_boletim_5ano_b s
join alunos al on pg_temp.norm_nome(al.nome) = pg_temp.norm_nome(s.aluno_nome)
join matriculas m on m.aluno_id = al.id and m.ano_letivo = 2026
group by m.turma_id
order by count(*) desc
limit 1;

do $$
begin
  if (select count(*) from stg_turma_alvo_5b) <> 1 then
    raise exception 'nao foi possivel resolver uma unica turma para os alunos do boletim (5o ANO B)';
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
from stg_boletim_5ano_b s
join disciplinas d on d.serie_id = 'c8834ff7-b712-4b46-b25e-ee34d3be5d90' and d.nome = s.disciplina
cross join stg_turma_alvo_5b t
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
from stg_boletim_5ano_b s
join alunos al on pg_temp.norm_nome(al.nome) = pg_temp.norm_nome(s.aluno_nome)
cross join stg_turma_alvo_5b t
join matriculas m on m.aluno_id = al.id and m.ano_letivo = 2026 and m.turma_id = t.turma_id
join disciplinas d on d.serie_id = 'c8834ff7-b712-4b46-b25e-ee34d3be5d90' and d.nome = s.disciplina
join avaliacoes a on a.turma_id = t.turma_id and a.disciplina_id = d.id
  and a.bimestre = 1 and a.ano_letivo = 2026 and a.titulo = 'Media Bimestral'
on conflict (avaliacao_id, aluno_id) do update set valor = excluded.valor;

insert into notas (escola_id, avaliacao_id, aluno_id, matricula_id, valor)
select '00000000-0000-0000-0000-000000000001'::uuid, a.id, al.id, m.id, s.b2
from stg_boletim_5ano_b s
join alunos al on pg_temp.norm_nome(al.nome) = pg_temp.norm_nome(s.aluno_nome)
cross join stg_turma_alvo_5b t
join matriculas m on m.aluno_id = al.id and m.ano_letivo = 2026 and m.turma_id = t.turma_id
join disciplinas d on d.serie_id = 'c8834ff7-b712-4b46-b25e-ee34d3be5d90' and d.nome = s.disciplina
join avaliacoes a on a.turma_id = t.turma_id and a.disciplina_id = d.id
  and a.bimestre = 2 and a.ano_letivo = 2026 and a.titulo = 'Media Bimestral'
on conflict (avaliacao_id, aluno_id) do update set valor = excluded.valor;
