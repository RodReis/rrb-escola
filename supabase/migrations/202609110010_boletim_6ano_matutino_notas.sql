-- Importa notas do boletim (1o e 2o bimestre 2026) da turma 6o ANO A - Matutino.
-- Fundamental 2: disciplinas diferentes do Fundamental 1 (Redacao, Literatura,
-- Filosofia, Ciencias da Natureza, Matematica Complementar).
-- Reaproveita disciplinas seed sem uso: Ciencias -> Ciencias da Natureza,
-- Producao Textual -> Redacao (renomeadas, decisao do usuario).
-- Mesmo padrao das migrations anteriores: avaliacao sintetica "Media Bimestral"
-- por disciplina x bimestre, nota = MB do boletim.
-- Fonte: Resultado - 6 ANO - MATUTINO.pdf.
-- Turma resolvida dinamicamente pela matricula 2026 dos alunos do boletim.

create or replace function pg_temp.norm_nome(txt text) returns text as $$
  select upper(translate(txt,
    'áàâãäÁÀÂÃÄéèêëÉÈÊËíìîïÍÌÎÏóòôõöÓÒÔÕÖúùûüÚÙÛÜçÇñÑ',
    'aaaaaAAAAAeeeeEEEEiiiiIIIIooooOOOOOOuuuuUUUUcCnN'
  ));
$$ language sql immutable;

-- Renomeia disciplinas seed sem uso (0 avaliacoes) para os nomes do boletim
update disciplinas set nome = 'Ciencias da Natureza'
where serie_id = '0624bd17-b778-4a59-a344-c68107407462' and nome = 'Ciencias';

update disciplinas set nome = 'Redacao'
where serie_id = '0624bd17-b778-4a59-a344-c68107407462' and nome = 'Producao Textual';

-- Disciplinas do 6o ANO que ainda nao existiam no seed padrao
insert into disciplinas (escola_id, serie_id, nome, ordem)
select '00000000-0000-0000-0000-000000000001'::uuid, '0624bd17-b778-4a59-a344-c68107407462'::uuid, nome, ordem
from (values
  ('Literatura', 10),
  ('Filosofia', 11),
  ('Matematica Complementar', 12)
) as novas(nome, ordem)
on conflict (escola_id, serie_id, nome) do nothing;

create temp table stg_boletim_6ano_a (
  aluno_nome text,
  disciplina text,
  b1 numeric(5,2),
  b2 numeric(5,2)
) on commit drop;

insert into stg_boletim_6ano_a (aluno_nome, disciplina, b1, b2) values
  ('AMANDA NUNES HANN','Redacao',9.5,10.0),
  ('AMANDA NUNES HANN','Literatura',9.5,10.0),
  ('AMANDA NUNES HANN','Filosofia',10.0,10.0),
  ('AMANDA NUNES HANN','Ciencias da Natureza',9.1,9.6),
  ('AMANDA NUNES HANN','Matematica',9.5,9.6),
  ('AMANDA NUNES HANN','Matematica Complementar',10.0,8.5),
  ('AMANDA NUNES HANN','Portugues',8.3,8.0),
  ('AMANDA NUNES HANN','Historia',9.1,7.6),
  ('AMANDA NUNES HANN','Geografia',9.1,7.6),
  ('AMANDA NUNES HANN','Artes',10.0,10.0),
  ('AMANDA NUNES HANN','Educacao Fisica',10.0,10.0),
  ('AMANDA NUNES HANN','Ingles',9.3,10.0),
  ('ANA JULIA AZEVEDO ALMEIDA','Redacao',9.5,10.0),
  ('ANA JULIA AZEVEDO ALMEIDA','Literatura',9.5,10.0),
  ('ANA JULIA AZEVEDO ALMEIDA','Filosofia',10.0,10.0),
  ('ANA JULIA AZEVEDO ALMEIDA','Ciencias da Natureza',10.0,9.7),
  ('ANA JULIA AZEVEDO ALMEIDA','Matematica',9.9,9.7),
  ('ANA JULIA AZEVEDO ALMEIDA','Matematica Complementar',10.0,9.7),
  ('ANA JULIA AZEVEDO ALMEIDA','Portugues',8.9,8.9),
  ('ANA JULIA AZEVEDO ALMEIDA','Historia',9.9,9.0),
  ('ANA JULIA AZEVEDO ALMEIDA','Geografia',9.9,9.7),
  ('ANA JULIA AZEVEDO ALMEIDA','Artes',10.0,10.0),
  ('ANA JULIA AZEVEDO ALMEIDA','Educacao Fisica',10.0,10.0),
  ('ANA JULIA AZEVEDO ALMEIDA','Ingles',9.4,10.0),
  ('ANA JULIA SILVEIRA DA SILVA','Redacao',9.5,10.0),
  ('ANA JULIA SILVEIRA DA SILVA','Literatura',9.5,10.0),
  ('ANA JULIA SILVEIRA DA SILVA','Filosofia',10.0,10.0),
  ('ANA JULIA SILVEIRA DA SILVA','Ciencias da Natureza',8.8,9.4),
  ('ANA JULIA SILVEIRA DA SILVA','Matematica',6.7,7.5),
  ('ANA JULIA SILVEIRA DA SILVA','Matematica Complementar',7.2,7.0),
  ('ANA JULIA SILVEIRA DA SILVA','Portugues',8.2,7.6),
  ('ANA JULIA SILVEIRA DA SILVA','Historia',8.4,7.8),
  ('ANA JULIA SILVEIRA DA SILVA','Geografia',7.7,8.1),
  ('ANA JULIA SILVEIRA DA SILVA','Artes',10.0,10.0),
  ('ANA JULIA SILVEIRA DA SILVA','Educacao Fisica',10.0,10.0),
  ('ANA JULIA SILVEIRA DA SILVA','Ingles',9.3,8.3),
  ('DAVI SALES ANDRADE DE OLIVEIRA','Redacao',9.5,8.0),
  ('DAVI SALES ANDRADE DE OLIVEIRA','Literatura',10.0,9.0),
  ('DAVI SALES ANDRADE DE OLIVEIRA','Filosofia',10.0,10.0),
  ('DAVI SALES ANDRADE DE OLIVEIRA','Ciencias da Natureza',8.2,7.8),
  ('DAVI SALES ANDRADE DE OLIVEIRA','Matematica',7.8,8.7),
  ('DAVI SALES ANDRADE DE OLIVEIRA','Matematica Complementar',8.4,7.8),
  ('DAVI SALES ANDRADE DE OLIVEIRA','Portugues',6.4,7.5),
  ('DAVI SALES ANDRADE DE OLIVEIRA','Historia',8.0,8.0),
  ('DAVI SALES ANDRADE DE OLIVEIRA','Geografia',8.0,8.0),
  ('DAVI SALES ANDRADE DE OLIVEIRA','Artes',10.0,10.0),
  ('DAVI SALES ANDRADE DE OLIVEIRA','Educacao Fisica',10.0,10.0),
  ('DAVI SALES ANDRADE DE OLIVEIRA','Ingles',8.0,8.0),
  ('ELOAH CORREIA SOUZA','Redacao',9.5,10.0),
  ('ELOAH CORREIA SOUZA','Literatura',10.0,10.0),
  ('ELOAH CORREIA SOUZA','Filosofia',10.0,10.0),
  ('ELOAH CORREIA SOUZA','Ciencias da Natureza',8.6,8.6),
  ('ELOAH CORREIA SOUZA','Matematica',9.4,8.7),
  ('ELOAH CORREIA SOUZA','Matematica Complementar',9.3,8.1),
  ('ELOAH CORREIA SOUZA','Portugues',7.9,7.5),
  ('ELOAH CORREIA SOUZA','Historia',8.4,8.6),
  ('ELOAH CORREIA SOUZA','Geografia',9.0,8.0),
  ('ELOAH CORREIA SOUZA','Artes',10.0,10.0),
  ('ELOAH CORREIA SOUZA','Educacao Fisica',10.0,10.0),
  ('ELOAH CORREIA SOUZA','Ingles',8.6,9.3),
  ('GABRIELA GONCALVES SIMOES DE JESUS','Redacao',9.5,10.0),
  ('GABRIELA GONCALVES SIMOES DE JESUS','Literatura',9.5,10.0),
  ('GABRIELA GONCALVES SIMOES DE JESUS','Filosofia',10.0,10.0),
  ('GABRIELA GONCALVES SIMOES DE JESUS','Ciencias da Natureza',8.6,8.4),
  ('GABRIELA GONCALVES SIMOES DE JESUS','Matematica',7.1,7.9),
  ('GABRIELA GONCALVES SIMOES DE JESUS','Matematica Complementar',8.2,7.2),
  ('GABRIELA GONCALVES SIMOES DE JESUS','Portugues',8.0,8.4),
  ('GABRIELA GONCALVES SIMOES DE JESUS','Historia',8.7,7.7),
  ('GABRIELA GONCALVES SIMOES DE JESUS','Geografia',8.6,7.7),
  ('GABRIELA GONCALVES SIMOES DE JESUS','Artes',10.0,10.0),
  ('GABRIELA GONCALVES SIMOES DE JESUS','Educacao Fisica',10.0,10.0),
  ('GABRIELA GONCALVES SIMOES DE JESUS','Ingles',9.6,9.8),
  ('GABRIELE ARANTES VIEIRA','Redacao',9.5,10.0),
  ('GABRIELE ARANTES VIEIRA','Literatura',9.5,10.0),
  ('GABRIELE ARANTES VIEIRA','Filosofia',10.0,10.0),
  ('GABRIELE ARANTES VIEIRA','Ciencias da Natureza',9.1,9.7),
  ('GABRIELE ARANTES VIEIRA','Matematica',9.4,9.7),
  ('GABRIELE ARANTES VIEIRA','Matematica Complementar',10.0,9.2),
  ('GABRIELE ARANTES VIEIRA','Portugues',9.1,8.4),
  ('GABRIELE ARANTES VIEIRA','Historia',9.4,8.4),
  ('GABRIELE ARANTES VIEIRA','Geografia',9.1,7.7),
  ('GABRIELE ARANTES VIEIRA','Artes',10.0,10.0),
  ('GABRIELE ARANTES VIEIRA','Educacao Fisica',10.0,10.0),
  ('GABRIELE ARANTES VIEIRA','Ingles',9.8,9.6),
  ('GUSTAVO HENRIQUE MARTINS SANTOS','Redacao',9.5,9.0),
  ('GUSTAVO HENRIQUE MARTINS SANTOS','Literatura',9.5,10.0),
  ('GUSTAVO HENRIQUE MARTINS SANTOS','Filosofia',10.0,10.0),
  ('GUSTAVO HENRIQUE MARTINS SANTOS','Ciencias da Natureza',9.5,8.3),
  ('GUSTAVO HENRIQUE MARTINS SANTOS','Matematica',9.7,9.6),
  ('GUSTAVO HENRIQUE MARTINS SANTOS','Matematica Complementar',9.7,9.7),
  ('GUSTAVO HENRIQUE MARTINS SANTOS','Portugues',8.3,7.5),
  ('GUSTAVO HENRIQUE MARTINS SANTOS','Historia',9.4,7.9),
  ('GUSTAVO HENRIQUE MARTINS SANTOS','Geografia',8.9,7.6),
  ('GUSTAVO HENRIQUE MARTINS SANTOS','Artes',10.0,10.0),
  ('GUSTAVO HENRIQUE MARTINS SANTOS','Educacao Fisica',10.0,10.0),
  ('GUSTAVO HENRIQUE MARTINS SANTOS','Ingles',9.0,8.8),
  ('HEITOR LOPES DE BRITO','Redacao',9.5,10.0),
  ('HEITOR LOPES DE BRITO','Literatura',9.5,10.0),
  ('HEITOR LOPES DE BRITO','Filosofia',10.0,10.0),
  ('HEITOR LOPES DE BRITO','Ciencias da Natureza',9.6,9.6),
  ('HEITOR LOPES DE BRITO','Matematica',9.3,9.8),
  ('HEITOR LOPES DE BRITO','Matematica Complementar',10.0,9.2),
  ('HEITOR LOPES DE BRITO','Portugues',9.4,9.1),
  ('HEITOR LOPES DE BRITO','Historia',9.6,8.1),
  ('HEITOR LOPES DE BRITO','Geografia',9.2,8.1),
  ('HEITOR LOPES DE BRITO','Artes',10.0,10.0),
  ('HEITOR LOPES DE BRITO','Educacao Fisica',10.0,10.0),
  ('HEITOR LOPES DE BRITO','Ingles',10.0,9.9),
  ('HENRIQUE CABRINI BARCELOS SILVA CARES','Redacao',9.5,10.0),
  ('HENRIQUE CABRINI BARCELOS SILVA CARES','Literatura',9.5,10.0),
  ('HENRIQUE CABRINI BARCELOS SILVA CARES','Filosofia',10.0,10.0),
  ('HENRIQUE CABRINI BARCELOS SILVA CARES','Ciencias da Natureza',10.0,9.7),
  ('HENRIQUE CABRINI BARCELOS SILVA CARES','Matematica',9.3,9.0),
  ('HENRIQUE CABRINI BARCELOS SILVA CARES','Matematica Complementar',9.9,9.0),
  ('HENRIQUE CABRINI BARCELOS SILVA CARES','Portugues',9.3,8.9),
  ('HENRIQUE CABRINI BARCELOS SILVA CARES','Historia',9.3,8.7),
  ('HENRIQUE CABRINI BARCELOS SILVA CARES','Geografia',9.6,8.3),
  ('HENRIQUE CABRINI BARCELOS SILVA CARES','Artes',10.0,10.0),
  ('HENRIQUE CABRINI BARCELOS SILVA CARES','Educacao Fisica',10.0,10.0),
  ('HENRIQUE CABRINI BARCELOS SILVA CARES','Ingles',9.5,9.8),
  ('JOAO LUCAS GRANADO DA SILVA LEMOS','Redacao',9.5,9.5),
  ('JOAO LUCAS GRANADO DA SILVA LEMOS','Literatura',9.5,9.0),
  ('JOAO LUCAS GRANADO DA SILVA LEMOS','Filosofia',10.0,10.0),
  ('JOAO LUCAS GRANADO DA SILVA LEMOS','Ciencias da Natureza',9.8,9.5),
  ('JOAO LUCAS GRANADO DA SILVA LEMOS','Matematica',9.3,9.0),
  ('JOAO LUCAS GRANADO DA SILVA LEMOS','Matematica Complementar',10.0,9.0),
  ('JOAO LUCAS GRANADO DA SILVA LEMOS','Portugues',8.5,7.3),
  ('JOAO LUCAS GRANADO DA SILVA LEMOS','Historia',9.0,8.0),
  ('JOAO LUCAS GRANADO DA SILVA LEMOS','Geografia',8.9,8.0),
  ('JOAO LUCAS GRANADO DA SILVA LEMOS','Artes',10.0,10.0),
  ('JOAO LUCAS GRANADO DA SILVA LEMOS','Educacao Fisica',10.0,10.0),
  ('JOAO LUCAS GRANADO DA SILVA LEMOS','Ingles',9.3,8.8),
  ('JOAO PEDRO DE JESUS BASTOS','Redacao',9.5,10.0),
  ('JOAO PEDRO DE JESUS BASTOS','Literatura',9.5,10.0),
  ('JOAO PEDRO DE JESUS BASTOS','Filosofia',10.0,10.0),
  ('JOAO PEDRO DE JESUS BASTOS','Ciencias da Natureza',9.6,9.4),
  ('JOAO PEDRO DE JESUS BASTOS','Matematica',9.2,8.6),
  ('JOAO PEDRO DE JESUS BASTOS','Matematica Complementar',8.2,8.5),
  ('JOAO PEDRO DE JESUS BASTOS','Portugues',8.5,8.3),
  ('JOAO PEDRO DE JESUS BASTOS','Historia',9.4,8.3),
  ('JOAO PEDRO DE JESUS BASTOS','Geografia',9.7,8.3),
  ('JOAO PEDRO DE JESUS BASTOS','Artes',10.0,10.0),
  ('JOAO PEDRO DE JESUS BASTOS','Educacao Fisica',10.0,10.0),
  ('JOAO PEDRO DE JESUS BASTOS','Ingles',8.0,8.3),
  ('JOAO PEDRO SILVA','Redacao',9.5,8.5),
  ('JOAO PEDRO SILVA','Literatura',9.2,10.0),
  ('JOAO PEDRO SILVA','Filosofia',10.0,10.0),
  ('JOAO PEDRO SILVA','Ciencias da Natureza',9.5,8.4),
  ('JOAO PEDRO SILVA','Matematica',7.9,8.2),
  ('JOAO PEDRO SILVA','Matematica Complementar',9.7,8.4),
  ('JOAO PEDRO SILVA','Portugues',8.3,8.1),
  ('JOAO PEDRO SILVA','Historia',8.7,8.3),
  ('JOAO PEDRO SILVA','Geografia',9.7,9.7),
  ('JOAO PEDRO SILVA','Artes',10.0,10.0),
  ('JOAO PEDRO SILVA','Educacao Fisica',10.0,10.0),
  ('JOAO PEDRO SILVA','Ingles',8.3,9.1),
  ('JOAO PEDRO VIEIRA MARTINS','Redacao',9.5,10.0),
  ('JOAO PEDRO VIEIRA MARTINS','Literatura',9.2,10.0),
  ('JOAO PEDRO VIEIRA MARTINS','Filosofia',10.0,10.0),
  ('JOAO PEDRO VIEIRA MARTINS','Ciencias da Natureza',9.9,8.5),
  ('JOAO PEDRO VIEIRA MARTINS','Matematica',9.4,9.7),
  ('JOAO PEDRO VIEIRA MARTINS','Matematica Complementar',9.6,7.5),
  ('JOAO PEDRO VIEIRA MARTINS','Portugues',8.4,7.4),
  ('JOAO PEDRO VIEIRA MARTINS','Historia',8.7,8.4),
  ('JOAO PEDRO VIEIRA MARTINS','Geografia',8.9,8.4),
  ('JOAO PEDRO VIEIRA MARTINS','Artes',10.0,10.0),
  ('JOAO PEDRO VIEIRA MARTINS','Educacao Fisica',10.0,10.0),
  ('JOAO PEDRO VIEIRA MARTINS','Ingles',9.3,9.1),
  ('LARA MADSON DA SILVA PAIVA','Redacao',9.5,10.0),
  ('LARA MADSON DA SILVA PAIVA','Literatura',9.5,10.0),
  ('LARA MADSON DA SILVA PAIVA','Filosofia',10.0,10.0),
  ('LARA MADSON DA SILVA PAIVA','Ciencias da Natureza',10.0,9.7),
  ('LARA MADSON DA SILVA PAIVA','Matematica',8.2,9.4),
  ('LARA MADSON DA SILVA PAIVA','Matematica Complementar',10.0,8.7),
  ('LARA MADSON DA SILVA PAIVA','Portugues',8.4,8.3),
  ('LARA MADSON DA SILVA PAIVA','Historia',9.0,8.3),
  ('LARA MADSON DA SILVA PAIVA','Geografia',9.7,8.3),
  ('LARA MADSON DA SILVA PAIVA','Artes',10.0,10.0),
  ('LARA MADSON DA SILVA PAIVA','Educacao Fisica',10.0,10.0),
  ('LARA MADSON DA SILVA PAIVA','Ingles',10.0,10.0),
  ('LUCAS OLIVEIRA LISITA','Redacao',9.5,10.0),
  ('LUCAS OLIVEIRA LISITA','Literatura',9.2,10.0),
  ('LUCAS OLIVEIRA LISITA','Filosofia',10.0,10.0),
  ('LUCAS OLIVEIRA LISITA','Ciencias da Natureza',9.6,7.1),
  ('LUCAS OLIVEIRA LISITA','Matematica',9.8,9.6),
  ('LUCAS OLIVEIRA LISITA','Matematica Complementar',9.7,9.2),
  ('LUCAS OLIVEIRA LISITA','Portugues',8.5,8.4),
  ('LUCAS OLIVEIRA LISITA','Historia',8.8,7.9),
  ('LUCAS OLIVEIRA LISITA','Geografia',9.3,8.6),
  ('LUCAS OLIVEIRA LISITA','Artes',10.0,10.0),
  ('LUCAS OLIVEIRA LISITA','Educacao Fisica',10.0,10.0),
  ('LUCAS OLIVEIRA LISITA','Ingles',8.9,9.5),
  ('LUCAS VIEIRA DE CARVALHO JORGE','Redacao',8.0,10.0),
  ('LUCAS VIEIRA DE CARVALHO JORGE','Literatura',7.7,10.0),
  ('LUCAS VIEIRA DE CARVALHO JORGE','Filosofia',10.0,10.0),
  ('LUCAS VIEIRA DE CARVALHO JORGE','Ciencias da Natureza',8.3,8.4),
  ('LUCAS VIEIRA DE CARVALHO JORGE','Matematica',7.2,8.1),
  ('LUCAS VIEIRA DE CARVALHO JORGE','Matematica Complementar',8.0,7.0),
  ('LUCAS VIEIRA DE CARVALHO JORGE','Portugues',7.8,7.7),
  ('LUCAS VIEIRA DE CARVALHO JORGE','Historia',7.7,7.6),
  ('LUCAS VIEIRA DE CARVALHO JORGE','Geografia',8.5,7.6),
  ('LUCAS VIEIRA DE CARVALHO JORGE','Artes',10.0,10.0),
  ('LUCAS VIEIRA DE CARVALHO JORGE','Educacao Fisica',10.0,10.0),
  ('LUCAS VIEIRA DE CARVALHO JORGE','Ingles',7.6,8.0),
  ('LUIZ FABIANO RIBEIRO OLIVEIRA','Redacao',9.5,8.5),
  ('LUIZ FABIANO RIBEIRO OLIVEIRA','Literatura',9.2,8.0),
  ('LUIZ FABIANO RIBEIRO OLIVEIRA','Filosofia',10.0,10.0),
  ('LUIZ FABIANO RIBEIRO OLIVEIRA','Ciencias da Natureza',7.9,5.9),
  ('LUIZ FABIANO RIBEIRO OLIVEIRA','Matematica',7.2,6.6),
  ('LUIZ FABIANO RIBEIRO OLIVEIRA','Matematica Complementar',9.1,7.3),
  ('LUIZ FABIANO RIBEIRO OLIVEIRA','Portugues',6.8,7.6),
  ('LUIZ FABIANO RIBEIRO OLIVEIRA','Historia',7.9,8.1),
  ('LUIZ FABIANO RIBEIRO OLIVEIRA','Geografia',7.3,8.1),
  ('LUIZ FABIANO RIBEIRO OLIVEIRA','Artes',10.0,10.0),
  ('LUIZ FABIANO RIBEIRO OLIVEIRA','Educacao Fisica',10.0,10.0),
  ('LUIZ FABIANO RIBEIRO OLIVEIRA','Ingles',9.6,9.5),
  ('MARCOS ANTONIO CARDOSO MARIANO','Redacao',9.5,10.0),
  ('MARCOS ANTONIO CARDOSO MARIANO','Literatura',9.2,10.0),
  ('MARCOS ANTONIO CARDOSO MARIANO','Filosofia',10.0,10.0),
  ('MARCOS ANTONIO CARDOSO MARIANO','Ciencias da Natureza',9.0,9.3),
  ('MARCOS ANTONIO CARDOSO MARIANO','Matematica',9.0,9.5),
  ('MARCOS ANTONIO CARDOSO MARIANO','Matematica Complementar',9.6,9.4),
  ('MARCOS ANTONIO CARDOSO MARIANO','Portugues',7.4,7.3),
  ('MARCOS ANTONIO CARDOSO MARIANO','Historia',8.7,7.9),
  ('MARCOS ANTONIO CARDOSO MARIANO','Geografia',8.9,8.6),
  ('MARCOS ANTONIO CARDOSO MARIANO','Artes',10.0,10.0),
  ('MARCOS ANTONIO CARDOSO MARIANO','Educacao Fisica',10.0,10.0),
  ('MARCOS ANTONIO CARDOSO MARIANO','Ingles',9.8,9.6),
  ('MARIA JULIA GOMES SALES MAFRA','Redacao',9.5,8.5),
  ('MARIA JULIA GOMES SALES MAFRA','Literatura',9.5,10.0),
  ('MARIA JULIA GOMES SALES MAFRA','Filosofia',10.0,10.0),
  ('MARIA JULIA GOMES SALES MAFRA','Ciencias da Natureza',8.3,8.2),
  ('MARIA JULIA GOMES SALES MAFRA','Matematica',8.9,9.1),
  ('MARIA JULIA GOMES SALES MAFRA','Matematica Complementar',8.7,7.3),
  ('MARIA JULIA GOMES SALES MAFRA','Portugues',8.0,7.3),
  ('MARIA JULIA GOMES SALES MAFRA','Historia',7.7,7.9),
  ('MARIA JULIA GOMES SALES MAFRA','Geografia',8.4,8.3),
  ('MARIA JULIA GOMES SALES MAFRA','Artes',10.0,10.0),
  ('MARIA JULIA GOMES SALES MAFRA','Educacao Fisica',10.0,10.0),
  ('MARIA JULIA GOMES SALES MAFRA','Ingles',9.0,8.6),
  ('MARIA LUIZA FELIPE DE MORAIS','Redacao',9.5,10.0),
  ('MARIA LUIZA FELIPE DE MORAIS','Literatura',9.5,10.0),
  ('MARIA LUIZA FELIPE DE MORAIS','Filosofia',10.0,10.0),
  ('MARIA LUIZA FELIPE DE MORAIS','Ciencias da Natureza',9.0,8.6),
  ('MARIA LUIZA FELIPE DE MORAIS','Matematica',7.9,7.7),
  ('MARIA LUIZA FELIPE DE MORAIS','Matematica Complementar',9.5,8.0),
  ('MARIA LUIZA FELIPE DE MORAIS','Portugues',8.2,7.6),
  ('MARIA LUIZA FELIPE DE MORAIS','Historia',8.4,8.0),
  ('MARIA LUIZA FELIPE DE MORAIS','Geografia',8.7,9.0),
  ('MARIA LUIZA FELIPE DE MORAIS','Artes',10.0,10.0),
  ('MARIA LUIZA FELIPE DE MORAIS','Educacao Fisica',10.0,10.0),
  ('MARIA LUIZA FELIPE DE MORAIS','Ingles',9.5,9.3),
  ('NICOLAS AUGUSTO ALMEIDA GUIMARAES','Redacao',7.7,9.0),
  ('NICOLAS AUGUSTO ALMEIDA GUIMARAES','Literatura',8.7,8.0),
  ('NICOLAS AUGUSTO ALMEIDA GUIMARAES','Filosofia',10.0,10.0),
  ('NICOLAS AUGUSTO ALMEIDA GUIMARAES','Ciencias da Natureza',9.0,7.2),
  ('NICOLAS AUGUSTO ALMEIDA GUIMARAES','Matematica',7.1,7.8),
  ('NICOLAS AUGUSTO ALMEIDA GUIMARAES','Matematica Complementar',7.1,7.5),
  ('NICOLAS AUGUSTO ALMEIDA GUIMARAES','Portugues',5.2,5.5),
  ('NICOLAS AUGUSTO ALMEIDA GUIMARAES','Historia',8.4,7.3),
  ('NICOLAS AUGUSTO ALMEIDA GUIMARAES','Geografia',8.5,7.7),
  ('NICOLAS AUGUSTO ALMEIDA GUIMARAES','Artes',10.0,10.0),
  ('NICOLAS AUGUSTO ALMEIDA GUIMARAES','Educacao Fisica',10.0,10.0),
  ('NICOLAS AUGUSTO ALMEIDA GUIMARAES','Ingles',8.3,8.0),
  ('PEDRO ALMEIDA BORGES','Redacao',9.5,10.0),
  ('PEDRO ALMEIDA BORGES','Literatura',9.5,10.0),
  ('PEDRO ALMEIDA BORGES','Filosofia',10.0,10.0),
  ('PEDRO ALMEIDA BORGES','Ciencias da Natureza',9.0,7.4),
  ('PEDRO ALMEIDA BORGES','Matematica',8.4,9.1),
  ('PEDRO ALMEIDA BORGES','Matematica Complementar',8.4,7.8),
  ('PEDRO ALMEIDA BORGES','Portugues',7.3,7.3),
  ('PEDRO ALMEIDA BORGES','Historia',8.0,7.3),
  ('PEDRO ALMEIDA BORGES','Geografia',8.5,9.0),
  ('PEDRO ALMEIDA BORGES','Artes',10.0,10.0),
  ('PEDRO ALMEIDA BORGES','Educacao Fisica',10.0,10.0),
  ('PEDRO ALMEIDA BORGES','Ingles',8.3,9.0),
  ('PEDRO LUCCA ALVES OLIVEIRA','Redacao',9.5,10.0),
  ('PEDRO LUCCA ALVES OLIVEIRA','Literatura',9.5,8.5),
  ('PEDRO LUCCA ALVES OLIVEIRA','Filosofia',10.0,10.0),
  ('PEDRO LUCCA ALVES OLIVEIRA','Ciencias da Natureza',8.6,5.3),
  ('PEDRO LUCCA ALVES OLIVEIRA','Matematica',6.4,6.4),
  ('PEDRO LUCCA ALVES OLIVEIRA','Matematica Complementar',7.8,6.7),
  ('PEDRO LUCCA ALVES OLIVEIRA','Portugues',5.0,5.1),
  ('PEDRO LUCCA ALVES OLIVEIRA','Historia',8.0,7.9),
  ('PEDRO LUCCA ALVES OLIVEIRA','Geografia',7.2,8.1),
  ('PEDRO LUCCA ALVES OLIVEIRA','Artes',10.0,10.0),
  ('PEDRO LUCCA ALVES OLIVEIRA','Educacao Fisica',10.0,10.0),
  ('PEDRO LUCCA ALVES OLIVEIRA','Ingles',8.1,8.0),
  ('PEDRO MIGUEL ESPINDULA ARRUDA','Redacao',9.5,10.0),
  ('PEDRO MIGUEL ESPINDULA ARRUDA','Literatura',9.5,10.0),
  ('PEDRO MIGUEL ESPINDULA ARRUDA','Filosofia',10.0,10.0),
  ('PEDRO MIGUEL ESPINDULA ARRUDA','Ciencias da Natureza',9.5,7.3),
  ('PEDRO MIGUEL ESPINDULA ARRUDA','Matematica',7.7,7.3),
  ('PEDRO MIGUEL ESPINDULA ARRUDA','Matematica Complementar',8.3,7.5),
  ('PEDRO MIGUEL ESPINDULA ARRUDA','Portugues',8.0,7.6),
  ('PEDRO MIGUEL ESPINDULA ARRUDA','Historia',8.3,8.2),
  ('PEDRO MIGUEL ESPINDULA ARRUDA','Geografia',9.2,8.2),
  ('PEDRO MIGUEL ESPINDULA ARRUDA','Artes',10.0,10.0),
  ('PEDRO MIGUEL ESPINDULA ARRUDA','Educacao Fisica',10.0,10.0),
  ('PEDRO MIGUEL ESPINDULA ARRUDA','Ingles',8.8,9.1),
  ('RAFAELLA SILVEIRA MENDANHA','Redacao',9.5,10.0),
  ('RAFAELLA SILVEIRA MENDANHA','Literatura',9.5,10.0),
  ('RAFAELLA SILVEIRA MENDANHA','Filosofia',10.0,10.0),
  ('RAFAELLA SILVEIRA MENDANHA','Ciencias da Natureza',9.0,9.4),
  ('RAFAELLA SILVEIRA MENDANHA','Matematica',9.7,9.6),
  ('RAFAELLA SILVEIRA MENDANHA','Matematica Complementar',7.7,9.8),
  ('RAFAELLA SILVEIRA MENDANHA','Portugues',8.5,8.4),
  ('RAFAELLA SILVEIRA MENDANHA','Historia',8.7,7.4),
  ('RAFAELLA SILVEIRA MENDANHA','Geografia',9.3,8.0),
  ('RAFAELLA SILVEIRA MENDANHA','Artes',10.0,10.0),
  ('RAFAELLA SILVEIRA MENDANHA','Educacao Fisica',10.0,10.0),
  ('RAFAELLA SILVEIRA MENDANHA','Ingles',8.6,9.3),
  ('RUAN LOURENCO DE CASTRO SILVA','Redacao',5.2,9.0),
  ('RUAN LOURENCO DE CASTRO SILVA','Literatura',5.0,10.0),
  ('RUAN LOURENCO DE CASTRO SILVA','Filosofia',10.0,10.0),
  ('RUAN LOURENCO DE CASTRO SILVA','Ciencias da Natureza',7.9,7.4),
  ('RUAN LOURENCO DE CASTRO SILVA','Matematica',6.4,8.8),
  ('RUAN LOURENCO DE CASTRO SILVA','Matematica Complementar',8.3,9.2),
  ('RUAN LOURENCO DE CASTRO SILVA','Portugues',6.9,7.0),
  ('RUAN LOURENCO DE CASTRO SILVA','Historia',7.7,7.3),
  ('RUAN LOURENCO DE CASTRO SILVA','Geografia',7.7,8.0),
  ('RUAN LOURENCO DE CASTRO SILVA','Artes',10.0,10.0),
  ('RUAN LOURENCO DE CASTRO SILVA','Educacao Fisica',10.0,10.0),
  ('RUAN LOURENCO DE CASTRO SILVA','Ingles',8.1,8.0),
  ('SOPHIA PACHECO DELMONDES','Redacao',9.5,10.0),
  ('SOPHIA PACHECO DELMONDES','Literatura',10.0,10.0),
  ('SOPHIA PACHECO DELMONDES','Filosofia',10.0,10.0),
  ('SOPHIA PACHECO DELMONDES','Ciencias da Natureza',8.3,7.7),
  ('SOPHIA PACHECO DELMONDES','Matematica',7.7,7.2),
  ('SOPHIA PACHECO DELMONDES','Matematica Complementar',7.4,7.0),
  ('SOPHIA PACHECO DELMONDES','Portugues',7.2,7.4),
  ('SOPHIA PACHECO DELMONDES','Historia',8.3,8.0),
  ('SOPHIA PACHECO DELMONDES','Geografia',7.1,7.6),
  ('SOPHIA PACHECO DELMONDES','Artes',10.0,10.0),
  ('SOPHIA PACHECO DELMONDES','Educacao Fisica',10.0,10.0),
  ('SOPHIA PACHECO DELMONDES','Ingles',9.1,8.0),
  ('STELLA BONIFACIO LOOSE FROES','Redacao',9.5,10.0),
  ('STELLA BONIFACIO LOOSE FROES','Literatura',10.0,10.0),
  ('STELLA BONIFACIO LOOSE FROES','Filosofia',10.0,10.0),
  ('STELLA BONIFACIO LOOSE FROES','Ciencias da Natureza',10.0,9.6),
  ('STELLA BONIFACIO LOOSE FROES','Matematica',9.8,9.4),
  ('STELLA BONIFACIO LOOSE FROES','Matematica Complementar',9.5,9.7),
  ('STELLA BONIFACIO LOOSE FROES','Portugues',8.9,8.7),
  ('STELLA BONIFACIO LOOSE FROES','Historia',8.5,7.4),
  ('STELLA BONIFACIO LOOSE FROES','Geografia',9.3,8.0),
  ('STELLA BONIFACIO LOOSE FROES','Artes',10.0,10.0),
  ('STELLA BONIFACIO LOOSE FROES','Educacao Fisica',10.0,10.0),
  ('STELLA BONIFACIO LOOSE FROES','Ingles',10.0,10.0);

create temp table stg_turma_alvo_6a (turma_id uuid) on commit drop;

insert into stg_turma_alvo_6a (turma_id)
select m.turma_id
from stg_boletim_6ano_a s
join alunos al on pg_temp.norm_nome(al.nome) = pg_temp.norm_nome(s.aluno_nome)
join matriculas m on m.aluno_id = al.id and m.ano_letivo = 2026
group by m.turma_id
order by count(*) desc
limit 1;

do $$
begin
  if (select count(*) from stg_turma_alvo_6a) <> 1 then
    raise exception 'nao foi possivel resolver uma unica turma para os alunos do boletim (6o ANO A)';
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
from stg_boletim_6ano_a s
join disciplinas d on d.serie_id = '0624bd17-b778-4a59-a344-c68107407462' and d.nome = s.disciplina
cross join stg_turma_alvo_6a t
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
from stg_boletim_6ano_a s
join alunos al on pg_temp.norm_nome(al.nome) = pg_temp.norm_nome(s.aluno_nome)
cross join stg_turma_alvo_6a t
join matriculas m on m.aluno_id = al.id and m.ano_letivo = 2026 and m.turma_id = t.turma_id
join disciplinas d on d.serie_id = '0624bd17-b778-4a59-a344-c68107407462' and d.nome = s.disciplina
join avaliacoes a on a.turma_id = t.turma_id and a.disciplina_id = d.id
  and a.bimestre = 1 and a.ano_letivo = 2026 and a.titulo = 'Media Bimestral'
on conflict (avaliacao_id, aluno_id) do update set valor = excluded.valor;

insert into notas (escola_id, avaliacao_id, aluno_id, matricula_id, valor)
select '00000000-0000-0000-0000-000000000001'::uuid, a.id, al.id, m.id, s.b2
from stg_boletim_6ano_a s
join alunos al on pg_temp.norm_nome(al.nome) = pg_temp.norm_nome(s.aluno_nome)
cross join stg_turma_alvo_6a t
join matriculas m on m.aluno_id = al.id and m.ano_letivo = 2026 and m.turma_id = t.turma_id
join disciplinas d on d.serie_id = '0624bd17-b778-4a59-a344-c68107407462' and d.nome = s.disciplina
join avaliacoes a on a.turma_id = t.turma_id and a.disciplina_id = d.id
  and a.bimestre = 2 and a.ano_letivo = 2026 and a.titulo = 'Media Bimestral'
on conflict (avaliacao_id, aluno_id) do update set valor = excluded.valor;
