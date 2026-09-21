-- Importa notas do boletim (1o e 2o bimestre 2026) das turmas 3o ANO A-Matutino e 3o ANO B-Vespertino.
-- Mesmo padrao das migrations anteriores: avaliacao sintetica "Media Bimestral" por
-- disciplina x bimestre, nota = MB do boletim.
-- Fonte: Resultado - 3 ANO - MATUTINO.pdf / Resultado - 3 ANO - VERPERTINO.pdf.
-- Turma resolvida dinamicamente pela matricula 2026 dos alunos do boletim.

-- Normaliza acentos pra casar nome do boletim (sem acento) com nome do cadastro (com acento).
create or replace function pg_temp.norm_nome(txt text) returns text as $$
  select upper(translate(txt,
    'áàâãäÁÀÂÃÄéèêëÉÈÊËíìîïÍÌÎÏóòôõöÓÒÔÕÖúùûüÚÙÛÜçÇñÑ',
    'aaaaaAAAAAeeeeEEEEiiiiIIIIooooOOOOOOuuuuUUUUcCnN'
  ));
$$ language sql immutable;

-- Disciplinas do 3o ANO que ainda nao existiam no seed padrao
insert into disciplinas (escola_id, serie_id, nome, ordem)
select '00000000-0000-0000-0000-000000000001'::uuid, '849b6a49-b7b3-4749-ad07-82980e27c883'::uuid, nome, ordem
from (values
  ('Matematica Concreta', 8),
  ('Maker', 9),
  ('Projeto Semear', 10),
  ('Socioemocional', 11),
  ('Ensino Religioso', 12)
) as novas(nome, ordem)
on conflict (escola_id, serie_id, nome) do nothing;

create temp table stg_boletim_3ano_a (
  aluno_nome text,
  disciplina text,
  b1 numeric(5,2),
  b2 numeric(5,2)
) on commit drop;

create temp table stg_boletim_3ano_b (
  aluno_nome text,
  disciplina text,
  b1 numeric(5,2),
  b2 numeric(5,2)
) on commit drop;

insert into stg_boletim_3ano_a (aluno_nome, disciplina, b1, b2) values
  ('ANTONIO ENRIQUE CARVALHO JANUARIO','Ciencias',9.4,10.0),
  ('ANTONIO ENRIQUE CARVALHO JANUARIO','Matematica',9.7,10.0),
  ('ANTONIO ENRIQUE CARVALHO JANUARIO','Matematica Concreta',10.0,10.0),
  ('ANTONIO ENRIQUE CARVALHO JANUARIO','Maker',10.0,10.0),
  ('ANTONIO ENRIQUE CARVALHO JANUARIO','Projeto Semear',10.0,10.0),
  ('ANTONIO ENRIQUE CARVALHO JANUARIO','Socioemocional',10.0,10.0),
  ('ANTONIO ENRIQUE CARVALHO JANUARIO','Portugues',9.7,9.8),
  ('ANTONIO ENRIQUE CARVALHO JANUARIO','Historia',9.6,9.5),
  ('ANTONIO ENRIQUE CARVALHO JANUARIO','Geografia',10.0,9.7),
  ('ANTONIO ENRIQUE CARVALHO JANUARIO','Artes',10.0,10.0),
  ('ANTONIO ENRIQUE CARVALHO JANUARIO','Educacao Fisica',10.0,10.0),
  ('ANTONIO ENRIQUE CARVALHO JANUARIO','Ingles',10.0,9.7),
  ('ANTONIO ENRIQUE CARVALHO JANUARIO','Ensino Religioso',10.0,10.0),
  ('AYLA MARCIANO SOARES','Ciencias',9.3,10.0),
  ('AYLA MARCIANO SOARES','Matematica',9.7,9.5),
  ('AYLA MARCIANO SOARES','Matematica Concreta',10.0,10.0),
  ('AYLA MARCIANO SOARES','Maker',10.0,10.0),
  ('AYLA MARCIANO SOARES','Projeto Semear',10.0,10.0),
  ('AYLA MARCIANO SOARES','Socioemocional',10.0,10.0),
  ('AYLA MARCIANO SOARES','Portugues',8.8,9.2),
  ('AYLA MARCIANO SOARES','Historia',8.8,9.5),
  ('AYLA MARCIANO SOARES','Geografia',9.4,9.5),
  ('AYLA MARCIANO SOARES','Artes',10.0,10.0),
  ('AYLA MARCIANO SOARES','Educacao Fisica',10.0,10.0),
  ('AYLA MARCIANO SOARES','Ingles',9.5,9.7),
  ('AYLA MARCIANO SOARES','Ensino Religioso',10.0,10.0),
  ('BENJAMIN ALVES TOMAZ NUNES OLIVEIRA','Ciencias',9.0,9.3),
  ('BENJAMIN ALVES TOMAZ NUNES OLIVEIRA','Matematica',9.4,8.7),
  ('BENJAMIN ALVES TOMAZ NUNES OLIVEIRA','Matematica Concreta',10.0,10.0),
  ('BENJAMIN ALVES TOMAZ NUNES OLIVEIRA','Maker',10.0,10.0),
  ('BENJAMIN ALVES TOMAZ NUNES OLIVEIRA','Projeto Semear',10.0,10.0),
  ('BENJAMIN ALVES TOMAZ NUNES OLIVEIRA','Socioemocional',10.0,10.0),
  ('BENJAMIN ALVES TOMAZ NUNES OLIVEIRA','Portugues',8.4,8.9),
  ('BENJAMIN ALVES TOMAZ NUNES OLIVEIRA','Historia',8.9,8.8),
  ('BENJAMIN ALVES TOMAZ NUNES OLIVEIRA','Geografia',9.3,9.4),
  ('BENJAMIN ALVES TOMAZ NUNES OLIVEIRA','Artes',10.0,10.0),
  ('BENJAMIN ALVES TOMAZ NUNES OLIVEIRA','Educacao Fisica',10.0,10.0),
  ('BENJAMIN ALVES TOMAZ NUNES OLIVEIRA','Ingles',9.0,9.5),
  ('BENJAMIN ALVES TOMAZ NUNES OLIVEIRA','Ensino Religioso',10.0,10.0),
  ('CECILIA FERREIRA DE PAULA','Ciencias',8.9,9.6),
  ('CECILIA FERREIRA DE PAULA','Matematica',9.6,10.0),
  ('CECILIA FERREIRA DE PAULA','Matematica Concreta',10.0,10.0),
  ('CECILIA FERREIRA DE PAULA','Maker',10.0,10.0),
  ('CECILIA FERREIRA DE PAULA','Projeto Semear',10.0,10.0),
  ('CECILIA FERREIRA DE PAULA','Socioemocional',10.0,10.0),
  ('CECILIA FERREIRA DE PAULA','Portugues',8.7,9.5),
  ('CECILIA FERREIRA DE PAULA','Historia',9.2,9.4),
  ('CECILIA FERREIRA DE PAULA','Geografia',9.1,9.7),
  ('CECILIA FERREIRA DE PAULA','Artes',10.0,10.0),
  ('CECILIA FERREIRA DE PAULA','Educacao Fisica',10.0,10.0),
  ('CECILIA FERREIRA DE PAULA','Ingles',9.7,9.5),
  ('CECILIA FERREIRA DE PAULA','Ensino Religioso',10.0,10.0),
  ('DANIEL DORNELES DE QUEIROZ','Ciencias',10.0,9.7),
  ('DANIEL DORNELES DE QUEIROZ','Matematica',9.9,9.5),
  ('DANIEL DORNELES DE QUEIROZ','Matematica Concreta',10.0,10.0),
  ('DANIEL DORNELES DE QUEIROZ','Maker',10.0,10.0),
  ('DANIEL DORNELES DE QUEIROZ','Projeto Semear',10.0,10.0),
  ('DANIEL DORNELES DE QUEIROZ','Socioemocional',10.0,10.0),
  ('DANIEL DORNELES DE QUEIROZ','Portugues',9.8,9.8),
  ('DANIEL DORNELES DE QUEIROZ','Historia',10.0,9.8),
  ('DANIEL DORNELES DE QUEIROZ','Geografia',8.9,10.0),
  ('DANIEL DORNELES DE QUEIROZ','Artes',10.0,10.0),
  ('DANIEL DORNELES DE QUEIROZ','Educacao Fisica',10.0,10.0),
  ('DANIEL DORNELES DE QUEIROZ','Ingles',9.8,9.6),
  ('DANIEL DORNELES DE QUEIROZ','Ensino Religioso',10.0,10.0),
  ('DAVI RODRIGUES MOTA','Ciencias',9.6,9.6),
  ('DAVI RODRIGUES MOTA','Matematica',9.0,9.6),
  ('DAVI RODRIGUES MOTA','Matematica Concreta',10.0,10.0),
  ('DAVI RODRIGUES MOTA','Maker',10.0,10.0),
  ('DAVI RODRIGUES MOTA','Projeto Semear',10.0,10.0),
  ('DAVI RODRIGUES MOTA','Socioemocional',10.0,10.0),
  ('DAVI RODRIGUES MOTA','Portugues',8.6,8.8),
  ('DAVI RODRIGUES MOTA','Historia',9.0,9.1),
  ('DAVI RODRIGUES MOTA','Geografia',9.5,9.6),
  ('DAVI RODRIGUES MOTA','Artes',10.0,10.0),
  ('DAVI RODRIGUES MOTA','Educacao Fisica',10.0,10.0),
  ('DAVI RODRIGUES MOTA','Ingles',9.5,9.6),
  ('DAVI RODRIGUES MOTA','Ensino Religioso',10.0,10.0),
  ('DAVI SILVA RODRIGUES DA MATA','Ciencias',10.0,9.4),
  ('DAVI SILVA RODRIGUES DA MATA','Matematica',9.5,9.9),
  ('DAVI SILVA RODRIGUES DA MATA','Matematica Concreta',10.0,10.0),
  ('DAVI SILVA RODRIGUES DA MATA','Maker',10.0,10.0),
  ('DAVI SILVA RODRIGUES DA MATA','Projeto Semear',10.0,10.0),
  ('DAVI SILVA RODRIGUES DA MATA','Socioemocional',10.0,10.0),
  ('DAVI SILVA RODRIGUES DA MATA','Portugues',9.7,9.7),
  ('DAVI SILVA RODRIGUES DA MATA','Historia',9.5,9.8),
  ('DAVI SILVA RODRIGUES DA MATA','Geografia',9.8,9.9),
  ('DAVI SILVA RODRIGUES DA MATA','Artes',10.0,10.0),
  ('DAVI SILVA RODRIGUES DA MATA','Educacao Fisica',10.0,10.0),
  ('DAVI SILVA RODRIGUES DA MATA','Ingles',10.0,9.9),
  ('DAVI SILVA RODRIGUES DA MATA','Ensino Religioso',10.0,10.0),
  ('HELOISA MACHADO SILVA','Ciencias',8.6,9.6),
  ('HELOISA MACHADO SILVA','Matematica',8.3,9.5),
  ('HELOISA MACHADO SILVA','Matematica Concreta',10.0,10.0),
  ('HELOISA MACHADO SILVA','Maker',10.0,10.0),
  ('HELOISA MACHADO SILVA','Projeto Semear',10.0,10.0),
  ('HELOISA MACHADO SILVA','Socioemocional',10.0,10.0),
  ('HELOISA MACHADO SILVA','Portugues',9.0,9.2),
  ('HELOISA MACHADO SILVA','Historia',8.6,9.6),
  ('HELOISA MACHADO SILVA','Geografia',8.3,8.8),
  ('HELOISA MACHADO SILVA','Artes',10.0,10.0),
  ('HELOISA MACHADO SILVA','Educacao Fisica',10.0,10.0),
  ('HELOISA MACHADO SILVA','Ingles',9.0,9.2),
  ('HELOISA MACHADO SILVA','Ensino Religioso',10.0,10.0),
  ('HESTHER VITORIA DE JESUS FERREIRA','Ciencias',9.6,9.7),
  ('HESTHER VITORIA DE JESUS FERREIRA','Matematica',10.0,9.5),
  ('HESTHER VITORIA DE JESUS FERREIRA','Matematica Concreta',10.0,10.0),
  ('HESTHER VITORIA DE JESUS FERREIRA','Maker',10.0,10.0),
  ('HESTHER VITORIA DE JESUS FERREIRA','Projeto Semear',10.0,10.0),
  ('HESTHER VITORIA DE JESUS FERREIRA','Socioemocional',10.0,10.0),
  ('HESTHER VITORIA DE JESUS FERREIRA','Portugues',9.1,9.5),
  ('HESTHER VITORIA DE JESUS FERREIRA','Historia',9.3,9.4),
  ('HESTHER VITORIA DE JESUS FERREIRA','Geografia',9.3,9.4),
  ('HESTHER VITORIA DE JESUS FERREIRA','Artes',10.0,10.0),
  ('HESTHER VITORIA DE JESUS FERREIRA','Educacao Fisica',10.0,10.0),
  ('HESTHER VITORIA DE JESUS FERREIRA','Ingles',10.0,10.0),
  ('HESTHER VITORIA DE JESUS FERREIRA','Ensino Religioso',10.0,10.0),
  ('ISABELA MARQUES ARAUJO AZEVEDO','Ciencias',9.0,9.6),
  ('ISABELA MARQUES ARAUJO AZEVEDO','Matematica',8.9,9.7),
  ('ISABELA MARQUES ARAUJO AZEVEDO','Matematica Concreta',10.0,10.0),
  ('ISABELA MARQUES ARAUJO AZEVEDO','Maker',10.0,10.0),
  ('ISABELA MARQUES ARAUJO AZEVEDO','Projeto Semear',10.0,10.0),
  ('ISABELA MARQUES ARAUJO AZEVEDO','Socioemocional',10.0,10.0),
  ('ISABELA MARQUES ARAUJO AZEVEDO','Portugues',8.0,9.0),
  ('ISABELA MARQUES ARAUJO AZEVEDO','Historia',9.1,8.6),
  ('ISABELA MARQUES ARAUJO AZEVEDO','Geografia',8.2,9.1),
  ('ISABELA MARQUES ARAUJO AZEVEDO','Artes',10.0,10.0),
  ('ISABELA MARQUES ARAUJO AZEVEDO','Educacao Fisica',10.0,10.0),
  ('ISABELA MARQUES ARAUJO AZEVEDO','Ingles',9.0,9.5),
  ('ISABELA MARQUES ARAUJO AZEVEDO','Ensino Religioso',10.0,10.0),
  ('JOAO FELIPE DA SILVA BORGES','Ciencias',9.8,9.2),
  ('JOAO FELIPE DA SILVA BORGES','Matematica',8.6,9.9),
  ('JOAO FELIPE DA SILVA BORGES','Matematica Concreta',10.0,10.0),
  ('JOAO FELIPE DA SILVA BORGES','Maker',10.0,10.0),
  ('JOAO FELIPE DA SILVA BORGES','Projeto Semear',10.0,10.0),
  ('JOAO FELIPE DA SILVA BORGES','Socioemocional',10.0,10.0),
  ('JOAO FELIPE DA SILVA BORGES','Portugues',8.5,8.5),
  ('JOAO FELIPE DA SILVA BORGES','Historia',8.4,9.2),
  ('JOAO FELIPE DA SILVA BORGES','Geografia',8.4,9.0),
  ('JOAO FELIPE DA SILVA BORGES','Artes',10.0,10.0),
  ('JOAO FELIPE DA SILVA BORGES','Educacao Fisica',10.0,10.0),
  ('JOAO FELIPE DA SILVA BORGES','Ingles',9.5,9.0),
  ('JOAO FELIPE DA SILVA BORGES','Ensino Religioso',10.0,10.0),
  ('JOSE AUGUSTO RIBEIRO LOPES','Ciencias',10.0,9.9),
  ('JOSE AUGUSTO RIBEIRO LOPES','Matematica',9.6,10.0),
  ('JOSE AUGUSTO RIBEIRO LOPES','Matematica Concreta',10.0,10.0),
  ('JOSE AUGUSTO RIBEIRO LOPES','Maker',10.0,10.0),
  ('JOSE AUGUSTO RIBEIRO LOPES','Projeto Semear',10.0,10.0),
  ('JOSE AUGUSTO RIBEIRO LOPES','Socioemocional',10.0,10.0),
  ('JOSE AUGUSTO RIBEIRO LOPES','Portugues',9.8,9.6),
  ('JOSE AUGUSTO RIBEIRO LOPES','Historia',9.6,9.4),
  ('JOSE AUGUSTO RIBEIRO LOPES','Geografia',9.6,9.5),
  ('JOSE AUGUSTO RIBEIRO LOPES','Artes',10.0,10.0),
  ('JOSE AUGUSTO RIBEIRO LOPES','Educacao Fisica',10.0,10.0),
  ('JOSE AUGUSTO RIBEIRO LOPES','Ingles',9.6,10.0),
  ('JOSE AUGUSTO RIBEIRO LOPES','Ensino Religioso',10.0,10.0),
  ('JULIA BARBARA CORDEIRO GOULART','Ciencias',9.1,9.6),
  ('JULIA BARBARA CORDEIRO GOULART','Matematica',9.3,9.5),
  ('JULIA BARBARA CORDEIRO GOULART','Matematica Concreta',10.0,10.0),
  ('JULIA BARBARA CORDEIRO GOULART','Maker',10.0,10.0),
  ('JULIA BARBARA CORDEIRO GOULART','Projeto Semear',10.0,10.0),
  ('JULIA BARBARA CORDEIRO GOULART','Socioemocional',10.0,10.0),
  ('JULIA BARBARA CORDEIRO GOULART','Portugues',8.0,9.3),
  ('JULIA BARBARA CORDEIRO GOULART','Historia',9.3,9.5),
  ('JULIA BARBARA CORDEIRO GOULART','Geografia',8.6,9.1),
  ('JULIA BARBARA CORDEIRO GOULART','Artes',10.0,10.0),
  ('JULIA BARBARA CORDEIRO GOULART','Educacao Fisica',10.0,10.0),
  ('JULIA BARBARA CORDEIRO GOULART','Ingles',8.7,9.0),
  ('JULIA BARBARA CORDEIRO GOULART','Ensino Religioso',10.0,10.0),
  ('LARISSA OLIVEIRA BARCELOS','Ciencias',8.4,9.4),
  ('LARISSA OLIVEIRA BARCELOS','Matematica',9.5,9.7),
  ('LARISSA OLIVEIRA BARCELOS','Matematica Concreta',10.0,10.0),
  ('LARISSA OLIVEIRA BARCELOS','Maker',10.0,10.0),
  ('LARISSA OLIVEIRA BARCELOS','Projeto Semear',10.0,10.0),
  ('LARISSA OLIVEIRA BARCELOS','Socioemocional',10.0,10.0),
  ('LARISSA OLIVEIRA BARCELOS','Portugues',8.4,9.1),
  ('LARISSA OLIVEIRA BARCELOS','Historia',9.2,9.5),
  ('LARISSA OLIVEIRA BARCELOS','Geografia',8.8,9.3),
  ('LARISSA OLIVEIRA BARCELOS','Artes',10.0,10.0),
  ('LARISSA OLIVEIRA BARCELOS','Educacao Fisica',10.0,10.0),
  ('LARISSA OLIVEIRA BARCELOS','Ingles',9.0,9.0),
  ('LARISSA OLIVEIRA BARCELOS','Ensino Religioso',10.0,10.0),
  ('LAVINIA SANTIAGO XAVIER SILVA','Ciencias',9.4,9.3),
  ('LAVINIA SANTIAGO XAVIER SILVA','Matematica',8.6,9.7),
  ('LAVINIA SANTIAGO XAVIER SILVA','Matematica Concreta',10.0,10.0),
  ('LAVINIA SANTIAGO XAVIER SILVA','Maker',10.0,10.0),
  ('LAVINIA SANTIAGO XAVIER SILVA','Projeto Semear',10.0,10.0),
  ('LAVINIA SANTIAGO XAVIER SILVA','Socioemocional',10.0,10.0),
  ('LAVINIA SANTIAGO XAVIER SILVA','Portugues',8.7,9.3),
  ('LAVINIA SANTIAGO XAVIER SILVA','Historia',9.0,9.5),
  ('LAVINIA SANTIAGO XAVIER SILVA','Geografia',9.2,8.8),
  ('LAVINIA SANTIAGO XAVIER SILVA','Artes',10.0,10.0),
  ('LAVINIA SANTIAGO XAVIER SILVA','Educacao Fisica',10.0,10.0),
  ('LAVINIA SANTIAGO XAVIER SILVA','Ingles',9.0,9.5),
  ('LAVINIA SANTIAGO XAVIER SILVA','Ensino Religioso',10.0,10.0),
  ('LEONARDO DOS SANTOS MENDES','Ciencias',9.2,8.8),
  ('LEONARDO DOS SANTOS MENDES','Matematica',8.9,9.1),
  ('LEONARDO DOS SANTOS MENDES','Matematica Concreta',10.0,10.0),
  ('LEONARDO DOS SANTOS MENDES','Maker',10.0,10.0),
  ('LEONARDO DOS SANTOS MENDES','Projeto Semear',10.0,10.0),
  ('LEONARDO DOS SANTOS MENDES','Socioemocional',10.0,10.0),
  ('LEONARDO DOS SANTOS MENDES','Portugues',8.0,8.5),
  ('LEONARDO DOS SANTOS MENDES','Historia',7.9,9.1),
  ('LEONARDO DOS SANTOS MENDES','Geografia',8.5,8.7),
  ('LEONARDO DOS SANTOS MENDES','Artes',10.0,10.0),
  ('LEONARDO DOS SANTOS MENDES','Educacao Fisica',10.0,10.0),
  ('LEONARDO DOS SANTOS MENDES','Ingles',9.5,9.0),
  ('LEONARDO DOS SANTOS MENDES','Ensino Religioso',10.0,10.0),
  ('LORENZO RODRIGUES LINO','Ciencias',9.9,10.0),
  ('LORENZO RODRIGUES LINO','Matematica',9.6,9.8),
  ('LORENZO RODRIGUES LINO','Matematica Concreta',10.0,10.0),
  ('LORENZO RODRIGUES LINO','Maker',10.0,10.0),
  ('LORENZO RODRIGUES LINO','Projeto Semear',10.0,10.0),
  ('LORENZO RODRIGUES LINO','Socioemocional',10.0,10.0),
  ('LORENZO RODRIGUES LINO','Portugues',9.4,9.7),
  ('LORENZO RODRIGUES LINO','Historia',9.6,9.8),
  ('LORENZO RODRIGUES LINO','Geografia',9.8,9.7),
  ('LORENZO RODRIGUES LINO','Artes',10.0,10.0),
  ('LORENZO RODRIGUES LINO','Educacao Fisica',10.0,10.0),
  ('LORENZO RODRIGUES LINO','Ingles',9.2,9.7),
  ('LORENZO RODRIGUES LINO','Ensino Religioso',10.0,10.0),
  ('LUCCA ARRUDA RODRIGUES','Ciencias',9.8,9.6),
  ('LUCCA ARRUDA RODRIGUES','Matematica',8.9,9.5),
  ('LUCCA ARRUDA RODRIGUES','Matematica Concreta',10.0,10.0),
  ('LUCCA ARRUDA RODRIGUES','Maker',10.0,10.0),
  ('LUCCA ARRUDA RODRIGUES','Projeto Semear',10.0,10.0),
  ('LUCCA ARRUDA RODRIGUES','Socioemocional',10.0,10.0),
  ('LUCCA ARRUDA RODRIGUES','Portugues',8.9,9.5),
  ('LUCCA ARRUDA RODRIGUES','Historia',9.2,9.5),
  ('LUCCA ARRUDA RODRIGUES','Geografia',9.0,9.0),
  ('LUCCA ARRUDA RODRIGUES','Artes',10.0,10.0),
  ('LUCCA ARRUDA RODRIGUES','Educacao Fisica',10.0,10.0),
  ('LUCCA ARRUDA RODRIGUES','Ingles',9.7,9.5),
  ('LUCCA ARRUDA RODRIGUES','Ensino Religioso',10.0,10.0),
  ('MARIA LUIZA DE JESUS BASTOS','Ciencias',9.5,9.9),
  ('MARIA LUIZA DE JESUS BASTOS','Matematica',8.9,9.4),
  ('MARIA LUIZA DE JESUS BASTOS','Matematica Concreta',10.0,10.0),
  ('MARIA LUIZA DE JESUS BASTOS','Maker',10.0,10.0),
  ('MARIA LUIZA DE JESUS BASTOS','Projeto Semear',10.0,10.0),
  ('MARIA LUIZA DE JESUS BASTOS','Socioemocional',10.0,10.0),
  ('MARIA LUIZA DE JESUS BASTOS','Portugues',9.5,9.2),
  ('MARIA LUIZA DE JESUS BASTOS','Historia',9.5,9.4),
  ('MARIA LUIZA DE JESUS BASTOS','Geografia',9.0,8.5),
  ('MARIA LUIZA DE JESUS BASTOS','Artes',10.0,10.0),
  ('MARIA LUIZA DE JESUS BASTOS','Educacao Fisica',10.0,10.0),
  ('MARIA LUIZA DE JESUS BASTOS','Ingles',9.8,9.0),
  ('MARIA LUIZA DE JESUS BASTOS','Ensino Religioso',10.0,10.0),
  ('MARIA SOPHIA FERNANDES DE SOUZA','Ciencias',9.6,9.3),
  ('MARIA SOPHIA FERNANDES DE SOUZA','Matematica',9.4,10.0),
  ('MARIA SOPHIA FERNANDES DE SOUZA','Matematica Concreta',10.0,10.0),
  ('MARIA SOPHIA FERNANDES DE SOUZA','Maker',10.0,10.0),
  ('MARIA SOPHIA FERNANDES DE SOUZA','Projeto Semear',10.0,10.0),
  ('MARIA SOPHIA FERNANDES DE SOUZA','Socioemocional',10.0,10.0),
  ('MARIA SOPHIA FERNANDES DE SOUZA','Portugues',9.2,8.8),
  ('MARIA SOPHIA FERNANDES DE SOUZA','Historia',9.0,9.4),
  ('MARIA SOPHIA FERNANDES DE SOUZA','Geografia',9.2,9.4),
  ('MARIA SOPHIA FERNANDES DE SOUZA','Artes',10.0,10.0),
  ('MARIA SOPHIA FERNANDES DE SOUZA','Educacao Fisica',10.0,10.0),
  ('MARIA SOPHIA FERNANDES DE SOUZA','Ingles',9.9,9.5),
  ('MARIA SOPHIA FERNANDES DE SOUZA','Ensino Religioso',10.0,10.0),
  ('MATHIAS TAVARES AGUIAR','Ciencias',10.0,9.8),
  ('MATHIAS TAVARES AGUIAR','Matematica',9.2,9.2),
  ('MATHIAS TAVARES AGUIAR','Matematica Concreta',10.0,10.0),
  ('MATHIAS TAVARES AGUIAR','Maker',10.0,10.0),
  ('MATHIAS TAVARES AGUIAR','Projeto Semear',10.0,10.0),
  ('MATHIAS TAVARES AGUIAR','Socioemocional',10.0,10.0),
  ('MATHIAS TAVARES AGUIAR','Portugues',9.8,9.3),
  ('MATHIAS TAVARES AGUIAR','Historia',9.6,9.4),
  ('MATHIAS TAVARES AGUIAR','Geografia',9.6,10.0),
  ('MATHIAS TAVARES AGUIAR','Artes',10.0,10.0),
  ('MATHIAS TAVARES AGUIAR','Educacao Fisica',10.0,10.0),
  ('MATHIAS TAVARES AGUIAR','Ingles',10.0,10.0),
  ('MATHIAS TAVARES AGUIAR','Ensino Religioso',10.0,10.0),
  ('NICOLAS SILVA PARREIRA','Ciencias',9.4,9.6),
  ('NICOLAS SILVA PARREIRA','Matematica',9.7,10.0),
  ('NICOLAS SILVA PARREIRA','Matematica Concreta',10.0,10.0),
  ('NICOLAS SILVA PARREIRA','Maker',10.0,10.0),
  ('NICOLAS SILVA PARREIRA','Projeto Semear',10.0,10.0),
  ('NICOLAS SILVA PARREIRA','Socioemocional',10.0,10.0),
  ('NICOLAS SILVA PARREIRA','Portugues',9.8,9.7),
  ('NICOLAS SILVA PARREIRA','Historia',9.0,9.6),
  ('NICOLAS SILVA PARREIRA','Geografia',9.5,9.7),
  ('NICOLAS SILVA PARREIRA','Artes',10.0,10.0),
  ('NICOLAS SILVA PARREIRA','Educacao Fisica',10.0,10.0),
  ('NICOLAS SILVA PARREIRA','Ingles',10.0,10.0),
  ('NICOLAS SILVA PARREIRA','Ensino Religioso',10.0,10.0),
  ('RAFAEL ARANTES BORBA MARTINS','Ciencias',9.9,9.6),
  ('RAFAEL ARANTES BORBA MARTINS','Matematica',9.6,9.9),
  ('RAFAEL ARANTES BORBA MARTINS','Matematica Concreta',10.0,10.0),
  ('RAFAEL ARANTES BORBA MARTINS','Maker',10.0,10.0),
  ('RAFAEL ARANTES BORBA MARTINS','Projeto Semear',10.0,10.0),
  ('RAFAEL ARANTES BORBA MARTINS','Socioemocional',10.0,10.0),
  ('RAFAEL ARANTES BORBA MARTINS','Portugues',9.3,9.0),
  ('RAFAEL ARANTES BORBA MARTINS','Historia',9.6,9.8),
  ('RAFAEL ARANTES BORBA MARTINS','Geografia',9.5,9.2),
  ('RAFAEL ARANTES BORBA MARTINS','Artes',10.0,10.0),
  ('RAFAEL ARANTES BORBA MARTINS','Educacao Fisica',10.0,10.0),
  ('RAFAEL ARANTES BORBA MARTINS','Ingles',9.5,9.7),
  ('RAFAEL ARANTES BORBA MARTINS','Ensino Religioso',10.0,10.0),
  ('SAMUEL VIEIRA DE CARVALHO JORGE','Ciencias',8.4,9.2),
  ('SAMUEL VIEIRA DE CARVALHO JORGE','Matematica',8.1,9.0),
  ('SAMUEL VIEIRA DE CARVALHO JORGE','Matematica Concreta',10.0,10.0),
  ('SAMUEL VIEIRA DE CARVALHO JORGE','Maker',10.0,10.0),
  ('SAMUEL VIEIRA DE CARVALHO JORGE','Projeto Semear',10.0,10.0),
  ('SAMUEL VIEIRA DE CARVALHO JORGE','Socioemocional',10.0,10.0),
  ('SAMUEL VIEIRA DE CARVALHO JORGE','Portugues',8.0,8.3),
  ('SAMUEL VIEIRA DE CARVALHO JORGE','Historia',8.7,9.0),
  ('SAMUEL VIEIRA DE CARVALHO JORGE','Geografia',8.0,8.6),
  ('SAMUEL VIEIRA DE CARVALHO JORGE','Artes',10.0,10.0),
  ('SAMUEL VIEIRA DE CARVALHO JORGE','Educacao Fisica',10.0,10.0),
  ('SAMUEL VIEIRA DE CARVALHO JORGE','Ingles',8.7,9.0),
  ('SAMUEL VIEIRA DE CARVALHO JORGE','Ensino Religioso',10.0,10.0);

insert into stg_boletim_3ano_b (aluno_nome, disciplina, b1, b2) values
  ('BERNARDO LACERDA XAVIER','Ciencias',9.7,10.0),
  ('BERNARDO LACERDA XAVIER','Matematica',10.0,9.6),
  ('BERNARDO LACERDA XAVIER','Matematica Concreta',10.0,10.0),
  ('BERNARDO LACERDA XAVIER','Maker',10.0,10.0),
  ('BERNARDO LACERDA XAVIER','Projeto Semear',10.0,10.0),
  ('BERNARDO LACERDA XAVIER','Socioemocional',10.0,10.0),
  ('BERNARDO LACERDA XAVIER','Portugues',9.7,9.8),
  ('BERNARDO LACERDA XAVIER','Historia',9.9,10.0),
  ('BERNARDO LACERDA XAVIER','Geografia',10.0,10.0),
  ('BERNARDO LACERDA XAVIER','Artes',10.0,10.0),
  ('BERNARDO LACERDA XAVIER','Educacao Fisica',10.0,10.0),
  ('BERNARDO LACERDA XAVIER','Ingles',10.0,10.0),
  ('BERNARDO LACERDA XAVIER','Ensino Religioso',10.0,10.0),
  ('IGOR LEMES DE OLIVEIRA','Ciencias',9.5,9.6),
  ('IGOR LEMES DE OLIVEIRA','Matematica',9.9,9.7),
  ('IGOR LEMES DE OLIVEIRA','Matematica Concreta',10.0,10.0),
  ('IGOR LEMES DE OLIVEIRA','Maker',10.0,10.0),
  ('IGOR LEMES DE OLIVEIRA','Projeto Semear',10.0,10.0),
  ('IGOR LEMES DE OLIVEIRA','Socioemocional',10.0,10.0),
  ('IGOR LEMES DE OLIVEIRA','Portugues',9.0,9.7),
  ('IGOR LEMES DE OLIVEIRA','Historia',9.5,9.8),
  ('IGOR LEMES DE OLIVEIRA','Geografia',9.7,9.6),
  ('IGOR LEMES DE OLIVEIRA','Artes',10.0,10.0),
  ('IGOR LEMES DE OLIVEIRA','Educacao Fisica',10.0,10.0),
  ('IGOR LEMES DE OLIVEIRA','Ingles',9.6,9.8),
  ('IGOR LEMES DE OLIVEIRA','Ensino Religioso',10.0,10.0),
  ('ISAAC MIRANDA LOPES','Ciencias',9.6,9.7),
  ('ISAAC MIRANDA LOPES','Matematica',9.5,9.0),
  ('ISAAC MIRANDA LOPES','Matematica Concreta',10.0,10.0),
  ('ISAAC MIRANDA LOPES','Maker',10.0,10.0),
  ('ISAAC MIRANDA LOPES','Projeto Semear',10.0,10.0),
  ('ISAAC MIRANDA LOPES','Socioemocional',10.0,10.0),
  ('ISAAC MIRANDA LOPES','Portugues',8.8,9.1),
  ('ISAAC MIRANDA LOPES','Historia',9.4,9.2),
  ('ISAAC MIRANDA LOPES','Geografia',9.5,9.6),
  ('ISAAC MIRANDA LOPES','Artes',10.0,10.0),
  ('ISAAC MIRANDA LOPES','Educacao Fisica',10.0,10.0),
  ('ISAAC MIRANDA LOPES','Ingles',10.0,9.8),
  ('ISAAC MIRANDA LOPES','Ensino Religioso',10.0,10.0),
  ('ISABELLA OLIVEIRA MARTINS FIGUEIREDO','Ciencias',9.2,9.3),
  ('ISABELLA OLIVEIRA MARTINS FIGUEIREDO','Matematica',9.5,7.9),
  ('ISABELLA OLIVEIRA MARTINS FIGUEIREDO','Matematica Concreta',10.0,10.0),
  ('ISABELLA OLIVEIRA MARTINS FIGUEIREDO','Maker',10.0,10.0),
  ('ISABELLA OLIVEIRA MARTINS FIGUEIREDO','Projeto Semear',10.0,10.0),
  ('ISABELLA OLIVEIRA MARTINS FIGUEIREDO','Socioemocional',10.0,10.0),
  ('ISABELLA OLIVEIRA MARTINS FIGUEIREDO','Portugues',5.5,8.4),
  ('ISABELLA OLIVEIRA MARTINS FIGUEIREDO','Historia',8.6,9.2),
  ('ISABELLA OLIVEIRA MARTINS FIGUEIREDO','Geografia',9.4,8.6),
  ('ISABELLA OLIVEIRA MARTINS FIGUEIREDO','Artes',10.0,10.0),
  ('ISABELLA OLIVEIRA MARTINS FIGUEIREDO','Educacao Fisica',10.0,10.0),
  ('ISABELLA OLIVEIRA MARTINS FIGUEIREDO','Ingles',8.7,9.0),
  ('ISABELLA OLIVEIRA MARTINS FIGUEIREDO','Ensino Religioso',10.0,10.0),
  ('ISIS FERREIRA CASTRO','Ciencias',9.3,9.8),
  ('ISIS FERREIRA CASTRO','Matematica',9.1,9.8),
  ('ISIS FERREIRA CASTRO','Matematica Concreta',10.0,10.0),
  ('ISIS FERREIRA CASTRO','Maker',10.0,10.0),
  ('ISIS FERREIRA CASTRO','Projeto Semear',10.0,10.0),
  ('ISIS FERREIRA CASTRO','Socioemocional',10.0,10.0),
  ('ISIS FERREIRA CASTRO','Portugues',9.3,9.9),
  ('ISIS FERREIRA CASTRO','Historia',9.6,9.8),
  ('ISIS FERREIRA CASTRO','Geografia',9.7,9.8),
  ('ISIS FERREIRA CASTRO','Artes',10.0,10.0),
  ('ISIS FERREIRA CASTRO','Educacao Fisica',10.0,10.0),
  ('ISIS FERREIRA CASTRO','Ingles',9.9,10.0),
  ('ISIS FERREIRA CASTRO','Ensino Religioso',10.0,10.0),
  ('LARA PEREIRA DOMINGUES','Ciencias',9.5,9.7),
  ('LARA PEREIRA DOMINGUES','Matematica',9.6,9.4),
  ('LARA PEREIRA DOMINGUES','Matematica Concreta',10.0,10.0),
  ('LARA PEREIRA DOMINGUES','Maker',10.0,10.0),
  ('LARA PEREIRA DOMINGUES','Projeto Semear',10.0,10.0),
  ('LARA PEREIRA DOMINGUES','Socioemocional',10.0,10.0),
  ('LARA PEREIRA DOMINGUES','Portugues',9.4,9.7),
  ('LARA PEREIRA DOMINGUES','Historia',9.0,9.7),
  ('LARA PEREIRA DOMINGUES','Geografia',9.8,9.8),
  ('LARA PEREIRA DOMINGUES','Artes',10.0,10.0),
  ('LARA PEREIRA DOMINGUES','Educacao Fisica',10.0,10.0),
  ('LARA PEREIRA DOMINGUES','Ingles',9.5,10.0),
  ('LARA PEREIRA DOMINGUES','Ensino Religioso',10.0,10.0),
  ('LORENZO CHAVES FINOTTI','Ciencias',8.4,9.7),
  ('LORENZO CHAVES FINOTTI','Matematica',8.7,8.7),
  ('LORENZO CHAVES FINOTTI','Matematica Concreta',10.0,10.0),
  ('LORENZO CHAVES FINOTTI','Maker',10.0,10.0),
  ('LORENZO CHAVES FINOTTI','Projeto Semear',10.0,10.0),
  ('LORENZO CHAVES FINOTTI','Socioemocional',10.0,10.0),
  ('LORENZO CHAVES FINOTTI','Portugues',7.7,9.3),
  ('LORENZO CHAVES FINOTTI','Historia',8.9,9.2),
  ('LORENZO CHAVES FINOTTI','Geografia',9.4,9.4),
  ('LORENZO CHAVES FINOTTI','Artes',10.0,10.0),
  ('LORENZO CHAVES FINOTTI','Educacao Fisica',10.0,10.0),
  ('LORENZO CHAVES FINOTTI','Ingles',10.0,10.0),
  ('LORENZO CHAVES FINOTTI','Ensino Religioso',10.0,10.0),
  ('LORENZO OLIVEIRA ASSIS','Ciencias',9.6,9.8),
  ('LORENZO OLIVEIRA ASSIS','Matematica',9.6,9.1),
  ('LORENZO OLIVEIRA ASSIS','Matematica Concreta',10.0,10.0),
  ('LORENZO OLIVEIRA ASSIS','Maker',10.0,10.0),
  ('LORENZO OLIVEIRA ASSIS','Projeto Semear',10.0,10.0),
  ('LORENZO OLIVEIRA ASSIS','Socioemocional',10.0,10.0),
  ('LORENZO OLIVEIRA ASSIS','Portugues',8.6,9.5),
  ('LORENZO OLIVEIRA ASSIS','Historia',8.4,9.4),
  ('LORENZO OLIVEIRA ASSIS','Geografia',9.6,8.8),
  ('LORENZO OLIVEIRA ASSIS','Artes',10.0,10.0),
  ('LORENZO OLIVEIRA ASSIS','Educacao Fisica',10.0,10.0),
  ('LORENZO OLIVEIRA ASSIS','Ingles',9.7,9.7),
  ('LORENZO OLIVEIRA ASSIS','Ensino Religioso',10.0,10.0),
  ('LORRANY SOUZA MORAIS','Ciencias',9.3,9.7),
  ('LORRANY SOUZA MORAIS','Matematica',9.0,9.3),
  ('LORRANY SOUZA MORAIS','Matematica Concreta',10.0,10.0),
  ('LORRANY SOUZA MORAIS','Maker',10.0,10.0),
  ('LORRANY SOUZA MORAIS','Projeto Semear',10.0,10.0),
  ('LORRANY SOUZA MORAIS','Socioemocional',10.0,10.0),
  ('LORRANY SOUZA MORAIS','Portugues',8.9,9.4),
  ('LORRANY SOUZA MORAIS','Historia',8.6,9.4),
  ('LORRANY SOUZA MORAIS','Geografia',9.2,9.6),
  ('LORRANY SOUZA MORAIS','Artes',10.0,10.0),
  ('LORRANY SOUZA MORAIS','Educacao Fisica',10.0,10.0),
  ('LORRANY SOUZA MORAIS','Ingles',10.0,10.0),
  ('LORRANY SOUZA MORAIS','Ensino Religioso',10.0,10.0),
  ('LUCAS ALVES COUTO','Ciencias',8.5,9.9),
  ('LUCAS ALVES COUTO','Matematica',9.2,9.6),
  ('LUCAS ALVES COUTO','Matematica Concreta',10.0,10.0),
  ('LUCAS ALVES COUTO','Maker',10.0,10.0),
  ('LUCAS ALVES COUTO','Projeto Semear',10.0,10.0),
  ('LUCAS ALVES COUTO','Socioemocional',10.0,10.0),
  ('LUCAS ALVES COUTO','Portugues',9.3,9.8),
  ('LUCAS ALVES COUTO','Historia',8.8,9.6),
  ('LUCAS ALVES COUTO','Geografia',9.6,9.8),
  ('LUCAS ALVES COUTO','Artes',10.0,10.0),
  ('LUCAS ALVES COUTO','Educacao Fisica',10.0,10.0),
  ('LUCAS ALVES COUTO','Ingles',9.7,10.0),
  ('LUCAS ALVES COUTO','Ensino Religioso',10.0,10.0),
  ('MANUELA MARGARIDA BARROS','Ciencias',9.5,9.8),
  ('MANUELA MARGARIDA BARROS','Matematica',10.0,9.7),
  ('MANUELA MARGARIDA BARROS','Matematica Concreta',10.0,10.0),
  ('MANUELA MARGARIDA BARROS','Maker',10.0,10.0),
  ('MANUELA MARGARIDA BARROS','Projeto Semear',10.0,10.0),
  ('MANUELA MARGARIDA BARROS','Socioemocional',10.0,10.0),
  ('MANUELA MARGARIDA BARROS','Portugues',9.8,9.5),
  ('MANUELA MARGARIDA BARROS','Historia',9.9,9.8),
  ('MANUELA MARGARIDA BARROS','Geografia',10.0,9.3),
  ('MANUELA MARGARIDA BARROS','Artes',10.0,10.0),
  ('MANUELA MARGARIDA BARROS','Educacao Fisica',10.0,10.0),
  ('MANUELA MARGARIDA BARROS','Ingles',10.0,10.0),
  ('MANUELA MARGARIDA BARROS','Ensino Religioso',10.0,10.0),
  ('MARIA CLARA SANTOS BATISTA REGO','Ciencias',9.4,9.7),
  ('MARIA CLARA SANTOS BATISTA REGO','Matematica',8.8,9.2),
  ('MARIA CLARA SANTOS BATISTA REGO','Matematica Concreta',10.0,10.0),
  ('MARIA CLARA SANTOS BATISTA REGO','Maker',10.0,10.0),
  ('MARIA CLARA SANTOS BATISTA REGO','Projeto Semear',10.0,10.0),
  ('MARIA CLARA SANTOS BATISTA REGO','Socioemocional',10.0,10.0),
  ('MARIA CLARA SANTOS BATISTA REGO','Portugues',8.3,9.3),
  ('MARIA CLARA SANTOS BATISTA REGO','Historia',9.1,9.9),
  ('MARIA CLARA SANTOS BATISTA REGO','Geografia',9.8,9.4),
  ('MARIA CLARA SANTOS BATISTA REGO','Artes',10.0,10.0),
  ('MARIA CLARA SANTOS BATISTA REGO','Educacao Fisica',10.0,10.0),
  ('MARIA CLARA SANTOS BATISTA REGO','Ingles',9.9,9.7),
  ('MARIA CLARA SANTOS BATISTA REGO','Ensino Religioso',10.0,10.0),
  ('MARIA VALENTINA GOBIRA DE CARVALHO','Ciencias',9.4,9.7),
  ('MARIA VALENTINA GOBIRA DE CARVALHO','Matematica',10.0,9.8),
  ('MARIA VALENTINA GOBIRA DE CARVALHO','Matematica Concreta',10.0,10.0),
  ('MARIA VALENTINA GOBIRA DE CARVALHO','Maker',10.0,10.0),
  ('MARIA VALENTINA GOBIRA DE CARVALHO','Projeto Semear',10.0,10.0),
  ('MARIA VALENTINA GOBIRA DE CARVALHO','Socioemocional',10.0,10.0),
  ('MARIA VALENTINA GOBIRA DE CARVALHO','Portugues',9.5,9.8),
  ('MARIA VALENTINA GOBIRA DE CARVALHO','Historia',9.5,9.8),
  ('MARIA VALENTINA GOBIRA DE CARVALHO','Geografia',9.7,9.9),
  ('MARIA VALENTINA GOBIRA DE CARVALHO','Artes',10.0,10.0),
  ('MARIA VALENTINA GOBIRA DE CARVALHO','Educacao Fisica',10.0,10.0),
  ('MARIA VALENTINA GOBIRA DE CARVALHO','Ingles',10.0,10.0),
  ('MARIA VALENTINA GOBIRA DE CARVALHO','Ensino Religioso',10.0,10.0),
  ('MARIANA CARVALHO LEAO','Ciencias',8.9,9.7),
  ('MARIANA CARVALHO LEAO','Matematica',9.0,8.5),
  ('MARIANA CARVALHO LEAO','Matematica Concreta',10.0,10.0),
  ('MARIANA CARVALHO LEAO','Maker',10.0,10.0),
  ('MARIANA CARVALHO LEAO','Projeto Semear',10.0,10.0),
  ('MARIANA CARVALHO LEAO','Socioemocional',10.0,10.0),
  ('MARIANA CARVALHO LEAO','Portugues',2.9,8.7),
  ('MARIANA CARVALHO LEAO','Historia',8.9,8.8),
  ('MARIANA CARVALHO LEAO','Geografia',9.1,8.5),
  ('MARIANA CARVALHO LEAO','Artes',10.0,10.0),
  ('MARIANA CARVALHO LEAO','Educacao Fisica',10.0,10.0),
  ('MARIANA CARVALHO LEAO','Ingles',9.8,9.5),
  ('MARIANA CARVALHO LEAO','Ensino Religioso',10.0,10.0),
  ('VICCENZO JOSE CELSO MOURA CAMPOS','Ciencias',9.6,9.9),
  ('VICCENZO JOSE CELSO MOURA CAMPOS','Matematica',9.4,8.9),
  ('VICCENZO JOSE CELSO MOURA CAMPOS','Matematica Concreta',10.0,10.0),
  ('VICCENZO JOSE CELSO MOURA CAMPOS','Maker',10.0,10.0),
  ('VICCENZO JOSE CELSO MOURA CAMPOS','Projeto Semear',10.0,10.0),
  ('VICCENZO JOSE CELSO MOURA CAMPOS','Socioemocional',10.0,10.0),
  ('VICCENZO JOSE CELSO MOURA CAMPOS','Portugues',8.8,9.4),
  ('VICCENZO JOSE CELSO MOURA CAMPOS','Historia',9.0,9.8),
  ('VICCENZO JOSE CELSO MOURA CAMPOS','Geografia',9.7,9.9),
  ('VICCENZO JOSE CELSO MOURA CAMPOS','Artes',10.0,10.0),
  ('VICCENZO JOSE CELSO MOURA CAMPOS','Educacao Fisica',10.0,10.0),
  ('VICCENZO JOSE CELSO MOURA CAMPOS','Ingles',9.6,9.9),
  ('VICCENZO JOSE CELSO MOURA CAMPOS','Ensino Religioso',10.0,10.0);

-- Turma A (Matutino)
create temp table stg_turma_alvo_3a (turma_id uuid) on commit drop;

insert into stg_turma_alvo_3a (turma_id)
select m.turma_id
from stg_boletim_3ano_a s
join alunos al on pg_temp.norm_nome(al.nome) = pg_temp.norm_nome(s.aluno_nome)
join matriculas m on m.aluno_id = al.id and m.ano_letivo = 2026
group by m.turma_id
order by count(*) desc
limit 1;

do $$
begin
  if (select count(*) from stg_turma_alvo_3a) <> 1 then
    raise exception 'nao foi possivel resolver uma unica turma para os alunos do boletim (3o ANO A)';
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
from stg_boletim_3ano_a s
join disciplinas d on d.serie_id = '849b6a49-b7b3-4749-ad07-82980e27c883' and d.nome = s.disciplina
cross join stg_turma_alvo_3a t
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
from stg_boletim_3ano_a s
join alunos al on pg_temp.norm_nome(al.nome) = pg_temp.norm_nome(s.aluno_nome)
cross join stg_turma_alvo_3a t
join matriculas m on m.aluno_id = al.id and m.ano_letivo = 2026 and m.turma_id = t.turma_id
join disciplinas d on d.serie_id = '849b6a49-b7b3-4749-ad07-82980e27c883' and d.nome = s.disciplina
join avaliacoes a on a.turma_id = t.turma_id and a.disciplina_id = d.id
  and a.bimestre = 1 and a.ano_letivo = 2026 and a.titulo = 'Media Bimestral'
on conflict (avaliacao_id, aluno_id) do update set valor = excluded.valor;

insert into notas (escola_id, avaliacao_id, aluno_id, matricula_id, valor)
select '00000000-0000-0000-0000-000000000001'::uuid, a.id, al.id, m.id, s.b2
from stg_boletim_3ano_a s
join alunos al on pg_temp.norm_nome(al.nome) = pg_temp.norm_nome(s.aluno_nome)
cross join stg_turma_alvo_3a t
join matriculas m on m.aluno_id = al.id and m.ano_letivo = 2026 and m.turma_id = t.turma_id
join disciplinas d on d.serie_id = '849b6a49-b7b3-4749-ad07-82980e27c883' and d.nome = s.disciplina
join avaliacoes a on a.turma_id = t.turma_id and a.disciplina_id = d.id
  and a.bimestre = 2 and a.ano_letivo = 2026 and a.titulo = 'Media Bimestral'
on conflict (avaliacao_id, aluno_id) do update set valor = excluded.valor;

-- Turma B (Vespertino)
create temp table stg_turma_alvo_3b (turma_id uuid) on commit drop;

insert into stg_turma_alvo_3b (turma_id)
select m.turma_id
from stg_boletim_3ano_b s
join alunos al on pg_temp.norm_nome(al.nome) = pg_temp.norm_nome(s.aluno_nome)
join matriculas m on m.aluno_id = al.id and m.ano_letivo = 2026
group by m.turma_id
order by count(*) desc
limit 1;

do $$
begin
  if (select count(*) from stg_turma_alvo_3b) <> 1 then
    raise exception 'nao foi possivel resolver uma unica turma para os alunos do boletim (3o ANO B)';
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
from stg_boletim_3ano_b s
join disciplinas d on d.serie_id = '849b6a49-b7b3-4749-ad07-82980e27c883' and d.nome = s.disciplina
cross join stg_turma_alvo_3b t
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
from stg_boletim_3ano_b s
join alunos al on pg_temp.norm_nome(al.nome) = pg_temp.norm_nome(s.aluno_nome)
cross join stg_turma_alvo_3b t
join matriculas m on m.aluno_id = al.id and m.ano_letivo = 2026 and m.turma_id = t.turma_id
join disciplinas d on d.serie_id = '849b6a49-b7b3-4749-ad07-82980e27c883' and d.nome = s.disciplina
join avaliacoes a on a.turma_id = t.turma_id and a.disciplina_id = d.id
  and a.bimestre = 1 and a.ano_letivo = 2026 and a.titulo = 'Media Bimestral'
on conflict (avaliacao_id, aluno_id) do update set valor = excluded.valor;

insert into notas (escola_id, avaliacao_id, aluno_id, matricula_id, valor)
select '00000000-0000-0000-0000-000000000001'::uuid, a.id, al.id, m.id, s.b2
from stg_boletim_3ano_b s
join alunos al on pg_temp.norm_nome(al.nome) = pg_temp.norm_nome(s.aluno_nome)
cross join stg_turma_alvo_3b t
join matriculas m on m.aluno_id = al.id and m.ano_letivo = 2026 and m.turma_id = t.turma_id
join disciplinas d on d.serie_id = '849b6a49-b7b3-4749-ad07-82980e27c883' and d.nome = s.disciplina
join avaliacoes a on a.turma_id = t.turma_id and a.disciplina_id = d.id
  and a.bimestre = 2 and a.ano_letivo = 2026 and a.titulo = 'Media Bimestral'
on conflict (avaliacao_id, aluno_id) do update set valor = excluded.valor;
