-- Importa notas do boletim (1o e 2o bimestre 2026) das turmas 4o ANO A-Matutino e 4o ANO B-Vespertino.
-- Mesmo padrao das migrations anteriores: avaliacao sintetica "Media Bimestral" por
-- disciplina x bimestre, nota = MB do boletim.
-- Fonte: Resultado - 4 ANO - MATUTINO.pdf / Resultado - 4 ANO - VERPERTINO.pdf.
-- Samuel Souza Borges (4o ANO A) excluido: boletim so tem nota parcial do 3o bimestre
-- (Projeto Semear, Socioemocional, Educacao Fisica), sem 1o/2o bimestre.
-- Turma resolvida dinamicamente pela matricula 2026 dos alunos do boletim.

create or replace function pg_temp.norm_nome(txt text) returns text as $$
  select upper(translate(txt,
    'áàâãäÁÀÂÃÄéèêëÉÈÊËíìîïÍÌÎÏóòôõöÓÒÔÕÖúùûüÚÙÛÜçÇñÑ',
    'aaaaaAAAAAeeeeEEEEiiiiIIIIooooOOOOOOuuuuUUUUcCnN'
  ));
$$ language sql immutable;

-- Disciplinas do 4o ANO que ainda nao existiam no seed padrao
insert into disciplinas (escola_id, serie_id, nome, ordem)
select '00000000-0000-0000-0000-000000000001'::uuid, '27bed718-b6e6-406b-ae55-15477c430a57'::uuid, nome, ordem
from (values
  ('Redacao', 8),
  ('Maker', 9),
  ('Projeto Semear', 10),
  ('Socioemocional', 11),
  ('Ensino Religioso', 12)
) as novas(nome, ordem)
on conflict (escola_id, serie_id, nome) do nothing;

create temp table stg_boletim_4ano_a (
  aluno_nome text,
  disciplina text,
  b1 numeric(5,2),
  b2 numeric(5,2)
) on commit drop;

create temp table stg_boletim_4ano_b (
  aluno_nome text,
  disciplina text,
  b1 numeric(5,2),
  b2 numeric(5,2)
) on commit drop;

insert into stg_boletim_4ano_a (aluno_nome, disciplina, b1, b2) values
  ('ANNE AZARA BORGES DE ARAUJO BARBOSA','Ciencias',6.9,7.4),
  ('ANNE AZARA BORGES DE ARAUJO BARBOSA','Matematica',7.6,8.0),
  ('ANNE AZARA BORGES DE ARAUJO BARBOSA','Redacao',9.0,7.0),
  ('ANNE AZARA BORGES DE ARAUJO BARBOSA','Maker',10.0,10.0),
  ('ANNE AZARA BORGES DE ARAUJO BARBOSA','Projeto Semear',10.0,10.0),
  ('ANNE AZARA BORGES DE ARAUJO BARBOSA','Socioemocional',10.0,10.0),
  ('ANNE AZARA BORGES DE ARAUJO BARBOSA','Portugues',7.0,6.9),
  ('ANNE AZARA BORGES DE ARAUJO BARBOSA','Historia',7.4,6.9),
  ('ANNE AZARA BORGES DE ARAUJO BARBOSA','Geografia',7.9,7.4),
  ('ANNE AZARA BORGES DE ARAUJO BARBOSA','Artes',8.5,8.5),
  ('ANNE AZARA BORGES DE ARAUJO BARBOSA','Educacao Fisica',10.0,10.0),
  ('ANNE AZARA BORGES DE ARAUJO BARBOSA','Ingles',7.3,8.8),
  ('ANNE AZARA BORGES DE ARAUJO BARBOSA','Ensino Religioso',8.0,9.0),
  ('ARTHUR MARTINS RODRIGUES FERREIRA','Ciencias',9.7,9.0),
  ('ARTHUR MARTINS RODRIGUES FERREIRA','Matematica',9.3,9.1),
  ('ARTHUR MARTINS RODRIGUES FERREIRA','Redacao',9.7,7.5),
  ('ARTHUR MARTINS RODRIGUES FERREIRA','Maker',10.0,10.0),
  ('ARTHUR MARTINS RODRIGUES FERREIRA','Projeto Semear',10.0,10.0),
  ('ARTHUR MARTINS RODRIGUES FERREIRA','Socioemocional',10.0,10.0),
  ('ARTHUR MARTINS RODRIGUES FERREIRA','Portugues',9.1,9.1),
  ('ARTHUR MARTINS RODRIGUES FERREIRA','Historia',9.7,9.0),
  ('ARTHUR MARTINS RODRIGUES FERREIRA','Geografia',9.7,9.4),
  ('ARTHUR MARTINS RODRIGUES FERREIRA','Artes',9.0,9.5),
  ('ARTHUR MARTINS RODRIGUES FERREIRA','Educacao Fisica',10.0,10.0),
  ('ARTHUR MARTINS RODRIGUES FERREIRA','Ingles',8.6,9.3),
  ('ARTHUR MARTINS RODRIGUES FERREIRA','Ensino Religioso',10.0,9.5),
  ('CARLOS ANTONIO GONCALVES LIMA','Ciencias',7.6,7.5),
  ('CARLOS ANTONIO GONCALVES LIMA','Matematica',7.4,9.0),
  ('CARLOS ANTONIO GONCALVES LIMA','Redacao',9.7,9.5),
  ('CARLOS ANTONIO GONCALVES LIMA','Maker',10.0,10.0),
  ('CARLOS ANTONIO GONCALVES LIMA','Projeto Semear',10.0,10.0),
  ('CARLOS ANTONIO GONCALVES LIMA','Socioemocional',10.0,10.0),
  ('CARLOS ANTONIO GONCALVES LIMA','Portugues',7.8,8.6),
  ('CARLOS ANTONIO GONCALVES LIMA','Historia',8.4,8.6),
  ('CARLOS ANTONIO GONCALVES LIMA','Geografia',7.9,7.9),
  ('CARLOS ANTONIO GONCALVES LIMA','Artes',9.0,9.0),
  ('CARLOS ANTONIO GONCALVES LIMA','Educacao Fisica',10.0,10.0),
  ('CARLOS ANTONIO GONCALVES LIMA','Ingles',7.9,9.6),
  ('CARLOS ANTONIO GONCALVES LIMA','Ensino Religioso',9.5,9.5),
  ('DANIEL MARQUES COSTA','Ciencias',7.5,7.2),
  ('DANIEL MARQUES COSTA','Matematica',8.1,7.9),
  ('DANIEL MARQUES COSTA','Redacao',9.8,8.0),
  ('DANIEL MARQUES COSTA','Maker',10.0,10.0),
  ('DANIEL MARQUES COSTA','Projeto Semear',10.0,10.0),
  ('DANIEL MARQUES COSTA','Socioemocional',10.0,10.0),
  ('DANIEL MARQUES COSTA','Portugues',7.3,8.4),
  ('DANIEL MARQUES COSTA','Historia',8.1,9.1),
  ('DANIEL MARQUES COSTA','Geografia',8.0,8.7),
  ('DANIEL MARQUES COSTA','Artes',8.0,8.5),
  ('DANIEL MARQUES COSTA','Educacao Fisica',10.0,10.0),
  ('DANIEL MARQUES COSTA','Ingles',8.0,9.6),
  ('DANIEL MARQUES COSTA','Ensino Religioso',9.5,9.0),
  ('EDSON MIGUEL DIONISIO BUENO','Ciencias',9.4,7.9),
  ('EDSON MIGUEL DIONISIO BUENO','Matematica',9.0,9.6),
  ('EDSON MIGUEL DIONISIO BUENO','Redacao',9.7,9.0),
  ('EDSON MIGUEL DIONISIO BUENO','Maker',10.0,10.0),
  ('EDSON MIGUEL DIONISIO BUENO','Projeto Semear',10.0,10.0),
  ('EDSON MIGUEL DIONISIO BUENO','Socioemocional',10.0,10.0),
  ('EDSON MIGUEL DIONISIO BUENO','Portugues',8.9,8.5),
  ('EDSON MIGUEL DIONISIO BUENO','Historia',9.0,9.0),
  ('EDSON MIGUEL DIONISIO BUENO','Geografia',9.2,8.6),
  ('EDSON MIGUEL DIONISIO BUENO','Artes',9.0,8.0),
  ('EDSON MIGUEL DIONISIO BUENO','Educacao Fisica',10.0,10.0),
  ('EDSON MIGUEL DIONISIO BUENO','Ingles',8.6,9.7),
  ('EDSON MIGUEL DIONISIO BUENO','Ensino Religioso',9.0,9.0),
  ('GEOVANNA ALMEIDA AZEVEDO','Ciencias',7.7,8.3),
  ('GEOVANNA ALMEIDA AZEVEDO','Matematica',8.2,8.1),
  ('GEOVANNA ALMEIDA AZEVEDO','Redacao',9.6,8.6),
  ('GEOVANNA ALMEIDA AZEVEDO','Maker',10.0,10.0),
  ('GEOVANNA ALMEIDA AZEVEDO','Projeto Semear',10.0,10.0),
  ('GEOVANNA ALMEIDA AZEVEDO','Socioemocional',10.0,10.0),
  ('GEOVANNA ALMEIDA AZEVEDO','Portugues',8.2,8.3),
  ('GEOVANNA ALMEIDA AZEVEDO','Historia',8.3,7.7),
  ('GEOVANNA ALMEIDA AZEVEDO','Geografia',8.7,8.4),
  ('GEOVANNA ALMEIDA AZEVEDO','Artes',9.0,9.0),
  ('GEOVANNA ALMEIDA AZEVEDO','Educacao Fisica',10.0,10.0),
  ('GEOVANNA ALMEIDA AZEVEDO','Ingles',8.1,8.8),
  ('GEOVANNA ALMEIDA AZEVEDO','Ensino Religioso',9.0,9.5),
  ('HELENA AZEVEDO DE ARAUJO','Ciencias',9.7,9.4),
  ('HELENA AZEVEDO DE ARAUJO','Matematica',9.7,9.7),
  ('HELENA AZEVEDO DE ARAUJO','Redacao',9.9,9.5),
  ('HELENA AZEVEDO DE ARAUJO','Maker',10.0,10.0),
  ('HELENA AZEVEDO DE ARAUJO','Projeto Semear',10.0,10.0),
  ('HELENA AZEVEDO DE ARAUJO','Socioemocional',10.0,10.0),
  ('HELENA AZEVEDO DE ARAUJO','Portugues',9.7,9.7),
  ('HELENA AZEVEDO DE ARAUJO','Historia',9.8,9.5),
  ('HELENA AZEVEDO DE ARAUJO','Geografia',9.7,9.3),
  ('HELENA AZEVEDO DE ARAUJO','Artes',9.5,10.0),
  ('HELENA AZEVEDO DE ARAUJO','Educacao Fisica',10.0,10.0),
  ('HELENA AZEVEDO DE ARAUJO','Ingles',9.5,9.8),
  ('HELENA AZEVEDO DE ARAUJO','Ensino Religioso',10.0,10.0),
  ('HELENA GONCALVES MENDANHA','Ciencias',9.2,9.5),
  ('HELENA GONCALVES MENDANHA','Matematica',9.6,9.0),
  ('HELENA GONCALVES MENDANHA','Redacao',9.8,9.7),
  ('HELENA GONCALVES MENDANHA','Maker',10.0,10.0),
  ('HELENA GONCALVES MENDANHA','Projeto Semear',10.0,10.0),
  ('HELENA GONCALVES MENDANHA','Socioemocional',10.0,10.0),
  ('HELENA GONCALVES MENDANHA','Portugues',9.2,9.2),
  ('HELENA GONCALVES MENDANHA','Historia',9.3,9.1),
  ('HELENA GONCALVES MENDANHA','Geografia',9.3,9.3),
  ('HELENA GONCALVES MENDANHA','Artes',9.5,9.5),
  ('HELENA GONCALVES MENDANHA','Educacao Fisica',10.0,10.0),
  ('HELENA GONCALVES MENDANHA','Ingles',9.3,9.7),
  ('HELENA GONCALVES MENDANHA','Ensino Religioso',10.0,10.0),
  ('JOAO FELIPE ARANTES VIEIRA','Ciencias',9.5,9.3),
  ('JOAO FELIPE ARANTES VIEIRA','Matematica',9.2,9.5),
  ('JOAO FELIPE ARANTES VIEIRA','Redacao',9.9,9.8),
  ('JOAO FELIPE ARANTES VIEIRA','Maker',10.0,10.0),
  ('JOAO FELIPE ARANTES VIEIRA','Projeto Semear',10.0,10.0),
  ('JOAO FELIPE ARANTES VIEIRA','Socioemocional',10.0,10.0),
  ('JOAO FELIPE ARANTES VIEIRA','Portugues',9.3,9.4),
  ('JOAO FELIPE ARANTES VIEIRA','Historia',8.8,9.4),
  ('JOAO FELIPE ARANTES VIEIRA','Geografia',9.5,9.8),
  ('JOAO FELIPE ARANTES VIEIRA','Artes',9.0,9.0),
  ('JOAO FELIPE ARANTES VIEIRA','Educacao Fisica',10.0,10.0),
  ('JOAO FELIPE ARANTES VIEIRA','Ingles',9.4,9.9),
  ('JOAO FELIPE ARANTES VIEIRA','Ensino Religioso',9.0,9.0),
  ('JOAO VITOR ALVES ADOLFO','Ciencias',9.3,8.8),
  ('JOAO VITOR ALVES ADOLFO','Matematica',9.7,9.6),
  ('JOAO VITOR ALVES ADOLFO','Redacao',9.7,9.3),
  ('JOAO VITOR ALVES ADOLFO','Maker',10.0,10.0),
  ('JOAO VITOR ALVES ADOLFO','Projeto Semear',10.0,10.0),
  ('JOAO VITOR ALVES ADOLFO','Socioemocional',10.0,10.0),
  ('JOAO VITOR ALVES ADOLFO','Portugues',9.0,9.4),
  ('JOAO VITOR ALVES ADOLFO','Historia',8.4,9.3),
  ('JOAO VITOR ALVES ADOLFO','Geografia',9.8,9.2),
  ('JOAO VITOR ALVES ADOLFO','Artes',9.0,9.0),
  ('JOAO VITOR ALVES ADOLFO','Educacao Fisica',10.0,10.0),
  ('JOAO VITOR ALVES ADOLFO','Ingles',8.8,9.8),
  ('JOAO VITOR ALVES ADOLFO','Ensino Religioso',9.5,9.0),
  ('LOUISE MADSON DA SILVA PAIVA','Ciencias',8.0,6.6),
  ('LOUISE MADSON DA SILVA PAIVA','Matematica',7.7,7.5),
  ('LOUISE MADSON DA SILVA PAIVA','Redacao',9.5,7.0),
  ('LOUISE MADSON DA SILVA PAIVA','Maker',10.0,10.0),
  ('LOUISE MADSON DA SILVA PAIVA','Projeto Semear',10.0,10.0),
  ('LOUISE MADSON DA SILVA PAIVA','Socioemocional',10.0,10.0),
  ('LOUISE MADSON DA SILVA PAIVA','Portugues',6.4,6.9),
  ('LOUISE MADSON DA SILVA PAIVA','Historia',7.4,6.7),
  ('LOUISE MADSON DA SILVA PAIVA','Geografia',8.3,6.9),
  ('LOUISE MADSON DA SILVA PAIVA','Artes',9.5,9.5),
  ('LOUISE MADSON DA SILVA PAIVA','Educacao Fisica',10.0,10.0),
  ('LOUISE MADSON DA SILVA PAIVA','Ingles',8.7,9.5),
  ('LOUISE MADSON DA SILVA PAIVA','Ensino Religioso',8.0,9.0),
  ('LUAN MADSON GEDEAO DE PAIVA FILHO','Ciencias',9.2,8.6),
  ('LUAN MADSON GEDEAO DE PAIVA FILHO','Matematica',8.6,9.0),
  ('LUAN MADSON GEDEAO DE PAIVA FILHO','Redacao',9.6,9.7),
  ('LUAN MADSON GEDEAO DE PAIVA FILHO','Maker',10.0,10.0),
  ('LUAN MADSON GEDEAO DE PAIVA FILHO','Projeto Semear',10.0,10.0),
  ('LUAN MADSON GEDEAO DE PAIVA FILHO','Socioemocional',10.0,10.0),
  ('LUAN MADSON GEDEAO DE PAIVA FILHO','Portugues',8.3,9.1),
  ('LUAN MADSON GEDEAO DE PAIVA FILHO','Historia',9.0,9.1),
  ('LUAN MADSON GEDEAO DE PAIVA FILHO','Geografia',9.2,9.2),
  ('LUAN MADSON GEDEAO DE PAIVA FILHO','Artes',9.0,9.0),
  ('LUAN MADSON GEDEAO DE PAIVA FILHO','Educacao Fisica',10.0,10.0),
  ('LUAN MADSON GEDEAO DE PAIVA FILHO','Ingles',9.4,9.7),
  ('LUAN MADSON GEDEAO DE PAIVA FILHO','Ensino Religioso',9.0,9.0),
  ('MANUELA ROCHA BORBA','Ciencias',8.2,8.5),
  ('MANUELA ROCHA BORBA','Matematica',7.2,8.0),
  ('MANUELA ROCHA BORBA','Redacao',9.5,9.7),
  ('MANUELA ROCHA BORBA','Maker',10.0,10.0),
  ('MANUELA ROCHA BORBA','Projeto Semear',10.0,10.0),
  ('MANUELA ROCHA BORBA','Socioemocional',10.0,10.0),
  ('MANUELA ROCHA BORBA','Portugues',8.8,9.1),
  ('MANUELA ROCHA BORBA','Historia',8.7,8.1),
  ('MANUELA ROCHA BORBA','Geografia',8.7,8.1),
  ('MANUELA ROCHA BORBA','Artes',9.0,10.0),
  ('MANUELA ROCHA BORBA','Educacao Fisica',10.0,10.0),
  ('MANUELA ROCHA BORBA','Ingles',8.4,8.8),
  ('MANUELA ROCHA BORBA','Ensino Religioso',9.0,10.0),
  ('MANUELLE CARDOSO CORREIA','Ciencias',7.4,7.9),
  ('MANUELLE CARDOSO CORREIA','Matematica',7.7,7.2),
  ('MANUELLE CARDOSO CORREIA','Redacao',9.7,9.0),
  ('MANUELLE CARDOSO CORREIA','Maker',10.0,10.0),
  ('MANUELLE CARDOSO CORREIA','Projeto Semear',10.0,10.0),
  ('MANUELLE CARDOSO CORREIA','Socioemocional',10.0,10.0),
  ('MANUELLE CARDOSO CORREIA','Portugues',8.3,7.4),
  ('MANUELLE CARDOSO CORREIA','Historia',8.0,7.0),
  ('MANUELLE CARDOSO CORREIA','Geografia',8.9,7.3),
  ('MANUELLE CARDOSO CORREIA','Artes',9.0,8.0),
  ('MANUELLE CARDOSO CORREIA','Educacao Fisica',10.0,10.0),
  ('MANUELLE CARDOSO CORREIA','Ingles',8.7,9.2),
  ('MANUELLE CARDOSO CORREIA','Ensino Religioso',9.0,8.0),
  ('MARIA ALICE DE MELO COUTO','Ciencias',9.6,9.3),
  ('MARIA ALICE DE MELO COUTO','Matematica',8.6,9.5),
  ('MARIA ALICE DE MELO COUTO','Redacao',9.9,9.9),
  ('MARIA ALICE DE MELO COUTO','Maker',10.0,10.0),
  ('MARIA ALICE DE MELO COUTO','Projeto Semear',10.0,10.0),
  ('MARIA ALICE DE MELO COUTO','Socioemocional',10.0,10.0),
  ('MARIA ALICE DE MELO COUTO','Portugues',9.1,9.7),
  ('MARIA ALICE DE MELO COUTO','Historia',9.8,9.4),
  ('MARIA ALICE DE MELO COUTO','Geografia',9.2,9.6),
  ('MARIA ALICE DE MELO COUTO','Artes',9.0,9.0),
  ('MARIA ALICE DE MELO COUTO','Educacao Fisica',10.0,10.0),
  ('MARIA ALICE DE MELO COUTO','Ingles',8.8,9.8),
  ('MARIA ALICE DE MELO COUTO','Ensino Religioso',10.0,9.5),
  ('MARIANA OLIVEIRA ARAUJO','Ciencias',9.2,8.6),
  ('MARIANA OLIVEIRA ARAUJO','Matematica',8.6,8.4),
  ('MARIANA OLIVEIRA ARAUJO','Redacao',9.8,9.8),
  ('MARIANA OLIVEIRA ARAUJO','Maker',10.0,10.0),
  ('MARIANA OLIVEIRA ARAUJO','Projeto Semear',10.0,10.0),
  ('MARIANA OLIVEIRA ARAUJO','Socioemocional',10.0,10.0),
  ('MARIANA OLIVEIRA ARAUJO','Portugues',9.2,9.3),
  ('MARIANA OLIVEIRA ARAUJO','Historia',9.3,9.0),
  ('MARIANA OLIVEIRA ARAUJO','Geografia',9.4,9.3),
  ('MARIANA OLIVEIRA ARAUJO','Artes',9.0,9.0),
  ('MARIANA OLIVEIRA ARAUJO','Educacao Fisica',10.0,10.0),
  ('MARIANA OLIVEIRA ARAUJO','Ingles',8.3,9.5),
  ('MARIANA OLIVEIRA ARAUJO','Ensino Religioso',10.0,10.0),
  ('RAFAEL PAULO MENDOZA MARTINS ARAUJO','Ciencias',8.8,8.7),
  ('RAFAEL PAULO MENDOZA MARTINS ARAUJO','Matematica',9.5,9.7),
  ('RAFAEL PAULO MENDOZA MARTINS ARAUJO','Redacao',9.9,9.8),
  ('RAFAEL PAULO MENDOZA MARTINS ARAUJO','Maker',10.0,10.0),
  ('RAFAEL PAULO MENDOZA MARTINS ARAUJO','Projeto Semear',10.0,10.0),
  ('RAFAEL PAULO MENDOZA MARTINS ARAUJO','Socioemocional',10.0,10.0),
  ('RAFAEL PAULO MENDOZA MARTINS ARAUJO','Portugues',9.3,9.3),
  ('RAFAEL PAULO MENDOZA MARTINS ARAUJO','Historia',9.7,9.5),
  ('RAFAEL PAULO MENDOZA MARTINS ARAUJO','Geografia',9.1,9.6),
  ('RAFAEL PAULO MENDOZA MARTINS ARAUJO','Artes',9.0,9.0),
  ('RAFAEL PAULO MENDOZA MARTINS ARAUJO','Educacao Fisica',10.0,10.0),
  ('RAFAEL PAULO MENDOZA MARTINS ARAUJO','Ingles',9.3,9.8),
  ('RAFAEL PAULO MENDOZA MARTINS ARAUJO','Ensino Religioso',9.0,9.5),
  ('ROBERT MULLER BUENO FILHO','Ciencias',8.0,8.1),
  ('ROBERT MULLER BUENO FILHO','Matematica',8.8,8.9),
  ('ROBERT MULLER BUENO FILHO','Redacao',9.0,9.7),
  ('ROBERT MULLER BUENO FILHO','Maker',10.0,10.0),
  ('ROBERT MULLER BUENO FILHO','Projeto Semear',10.0,10.0),
  ('ROBERT MULLER BUENO FILHO','Socioemocional',10.0,10.0),
  ('ROBERT MULLER BUENO FILHO','Portugues',8.0,9.1),
  ('ROBERT MULLER BUENO FILHO','Historia',7.8,8.0),
  ('ROBERT MULLER BUENO FILHO','Geografia',8.2,7.7),
  ('ROBERT MULLER BUENO FILHO','Artes',8.5,9.0),
  ('ROBERT MULLER BUENO FILHO','Educacao Fisica',10.0,10.0),
  ('ROBERT MULLER BUENO FILHO','Ingles',8.5,9.4),
  ('ROBERT MULLER BUENO FILHO','Ensino Religioso',9.0,9.0),
  ('YASMIN RIBEIRO DE OLIVEIRA','Ciencias',8.9,8.7),
  ('YASMIN RIBEIRO DE OLIVEIRA','Matematica',8.4,9.1),
  ('YASMIN RIBEIRO DE OLIVEIRA','Redacao',9.8,9.5),
  ('YASMIN RIBEIRO DE OLIVEIRA','Maker',10.0,10.0),
  ('YASMIN RIBEIRO DE OLIVEIRA','Projeto Semear',10.0,10.0),
  ('YASMIN RIBEIRO DE OLIVEIRA','Socioemocional',10.0,10.0),
  ('YASMIN RIBEIRO DE OLIVEIRA','Portugues',9.0,9.1),
  ('YASMIN RIBEIRO DE OLIVEIRA','Historia',9.0,9.1),
  ('YASMIN RIBEIRO DE OLIVEIRA','Geografia',8.4,9.0),
  ('YASMIN RIBEIRO DE OLIVEIRA','Artes',10.0,9.0),
  ('YASMIN RIBEIRO DE OLIVEIRA','Educacao Fisica',10.0,10.0),
  ('YASMIN RIBEIRO DE OLIVEIRA','Ingles',8.5,8.9),
  ('YASMIN RIBEIRO DE OLIVEIRA','Ensino Religioso',9.5,9.5);

insert into stg_boletim_4ano_b (aluno_nome, disciplina, b1, b2) values
  ('ANNA CLARA ROCHA RODRIGUES DE MOURA','Ciencias',9.1,7.9),
  ('ANNA CLARA ROCHA RODRIGUES DE MOURA','Matematica',8.0,8.5),
  ('ANNA CLARA ROCHA RODRIGUES DE MOURA','Redacao',9.5,9.5),
  ('ANNA CLARA ROCHA RODRIGUES DE MOURA','Maker',10.0,10.0),
  ('ANNA CLARA ROCHA RODRIGUES DE MOURA','Projeto Semear',10.0,10.0),
  ('ANNA CLARA ROCHA RODRIGUES DE MOURA','Socioemocional',10.0,10.0),
  ('ANNA CLARA ROCHA RODRIGUES DE MOURA','Portugues',8.8,9.3),
  ('ANNA CLARA ROCHA RODRIGUES DE MOURA','Historia',8.5,8.8),
  ('ANNA CLARA ROCHA RODRIGUES DE MOURA','Geografia',9.3,9.0),
  ('ANNA CLARA ROCHA RODRIGUES DE MOURA','Artes',10.0,10.0),
  ('ANNA CLARA ROCHA RODRIGUES DE MOURA','Educacao Fisica',10.0,10.0),
  ('ANNA CLARA ROCHA RODRIGUES DE MOURA','Ingles',8.2,8.7),
  ('ANNA CLARA ROCHA RODRIGUES DE MOURA','Ensino Religioso',10.0,10.0),
  ('ENZO EMANUEL PONTES DA CONCEICAO','Ciencias',8.6,8.7),
  ('ENZO EMANUEL PONTES DA CONCEICAO','Matematica',8.4,9.4),
  ('ENZO EMANUEL PONTES DA CONCEICAO','Redacao',9.5,9.5),
  ('ENZO EMANUEL PONTES DA CONCEICAO','Maker',10.0,10.0),
  ('ENZO EMANUEL PONTES DA CONCEICAO','Projeto Semear',10.0,10.0),
  ('ENZO EMANUEL PONTES DA CONCEICAO','Socioemocional',10.0,10.0),
  ('ENZO EMANUEL PONTES DA CONCEICAO','Portugues',9.4,8.6),
  ('ENZO EMANUEL PONTES DA CONCEICAO','Historia',8.9,9.3),
  ('ENZO EMANUEL PONTES DA CONCEICAO','Geografia',9.0,8.6),
  ('ENZO EMANUEL PONTES DA CONCEICAO','Artes',10.0,10.0),
  ('ENZO EMANUEL PONTES DA CONCEICAO','Educacao Fisica',10.0,10.0),
  ('ENZO EMANUEL PONTES DA CONCEICAO','Ingles',9.1,9.5),
  ('ENZO EMANUEL PONTES DA CONCEICAO','Ensino Religioso',10.0,10.0),
  ('ESTHER RIOS DE FREITAS','Ciencias',9.0,9.3),
  ('ESTHER RIOS DE FREITAS','Matematica',8.0,8.3),
  ('ESTHER RIOS DE FREITAS','Redacao',9.0,8.5),
  ('ESTHER RIOS DE FREITAS','Maker',10.0,10.0),
  ('ESTHER RIOS DE FREITAS','Projeto Semear',10.0,10.0),
  ('ESTHER RIOS DE FREITAS','Socioemocional',10.0,10.0),
  ('ESTHER RIOS DE FREITAS','Portugues',9.5,9.2),
  ('ESTHER RIOS DE FREITAS','Historia',9.1,9.3),
  ('ESTHER RIOS DE FREITAS','Geografia',9.2,9.3),
  ('ESTHER RIOS DE FREITAS','Artes',10.0,10.0),
  ('ESTHER RIOS DE FREITAS','Educacao Fisica',10.0,10.0),
  ('ESTHER RIOS DE FREITAS','Ingles',8.6,9.7),
  ('ESTHER RIOS DE FREITAS','Ensino Religioso',10.0,10.0),
  ('HEITOR CALDAS ALVES','Ciencias',8.0,7.7),
  ('HEITOR CALDAS ALVES','Matematica',7.0,7.0),
  ('HEITOR CALDAS ALVES','Redacao',9.5,7.6),
  ('HEITOR CALDAS ALVES','Maker',10.0,10.0),
  ('HEITOR CALDAS ALVES','Projeto Semear',10.0,10.0),
  ('HEITOR CALDAS ALVES','Socioemocional',10.0,10.0),
  ('HEITOR CALDAS ALVES','Portugues',8.0,8.6),
  ('HEITOR CALDAS ALVES','Historia',8.5,8.8),
  ('HEITOR CALDAS ALVES','Geografia',8.5,8.6),
  ('HEITOR CALDAS ALVES','Artes',10.0,10.0),
  ('HEITOR CALDAS ALVES','Educacao Fisica',10.0,10.0),
  ('HEITOR CALDAS ALVES','Ingles',8.0,8.6),
  ('HEITOR CALDAS ALVES','Ensino Religioso',10.0,10.0),
  ('HEITOR CORREA NERI DE OLIVEIRA','Ciencias',9.4,8.6),
  ('HEITOR CORREA NERI DE OLIVEIRA','Matematica',8.7,9.0),
  ('HEITOR CORREA NERI DE OLIVEIRA','Redacao',9.0,9.0),
  ('HEITOR CORREA NERI DE OLIVEIRA','Maker',10.0,10.0),
  ('HEITOR CORREA NERI DE OLIVEIRA','Projeto Semear',10.0,10.0),
  ('HEITOR CORREA NERI DE OLIVEIRA','Socioemocional',10.0,10.0),
  ('HEITOR CORREA NERI DE OLIVEIRA','Portugues',9.1,8.9),
  ('HEITOR CORREA NERI DE OLIVEIRA','Historia',8.0,8.4),
  ('HEITOR CORREA NERI DE OLIVEIRA','Geografia',9.0,8.3),
  ('HEITOR CORREA NERI DE OLIVEIRA','Artes',10.0,10.0),
  ('HEITOR CORREA NERI DE OLIVEIRA','Educacao Fisica',10.0,10.0),
  ('HEITOR CORREA NERI DE OLIVEIRA','Ingles',8.5,9.5),
  ('HEITOR CORREA NERI DE OLIVEIRA','Ensino Religioso',10.0,10.0),
  ('HENRIQUE RODRIGUES DOS ANJOS','Ciencias',9.0,8.7),
  ('HENRIQUE RODRIGUES DOS ANJOS','Matematica',8.6,9.4),
  ('HENRIQUE RODRIGUES DOS ANJOS','Redacao',9.5,7.5),
  ('HENRIQUE RODRIGUES DOS ANJOS','Maker',10.0,10.0),
  ('HENRIQUE RODRIGUES DOS ANJOS','Projeto Semear',10.0,10.0),
  ('HENRIQUE RODRIGUES DOS ANJOS','Socioemocional',10.0,10.0),
  ('HENRIQUE RODRIGUES DOS ANJOS','Portugues',9.2,9.2),
  ('HENRIQUE RODRIGUES DOS ANJOS','Historia',9.0,9.3),
  ('HENRIQUE RODRIGUES DOS ANJOS','Geografia',8.6,9.1),
  ('HENRIQUE RODRIGUES DOS ANJOS','Artes',10.0,10.0),
  ('HENRIQUE RODRIGUES DOS ANJOS','Educacao Fisica',10.0,10.0),
  ('HENRIQUE RODRIGUES DOS ANJOS','Ingles',8.8,9.7),
  ('HENRIQUE RODRIGUES DOS ANJOS','Ensino Religioso',10.0,10.0),
  ('JOAO PEDRO LOPES DOS REIS','Ciencias',8.0,8.4),
  ('JOAO PEDRO LOPES DOS REIS','Matematica',7.4,7.1),
  ('JOAO PEDRO LOPES DOS REIS','Redacao',8.8,8.8),
  ('JOAO PEDRO LOPES DOS REIS','Maker',10.0,10.0),
  ('JOAO PEDRO LOPES DOS REIS','Projeto Semear',10.0,10.0),
  ('JOAO PEDRO LOPES DOS REIS','Socioemocional',10.0,10.0),
  ('JOAO PEDRO LOPES DOS REIS','Portugues',7.5,7.8),
  ('JOAO PEDRO LOPES DOS REIS','Historia',8.1,8.6),
  ('JOAO PEDRO LOPES DOS REIS','Geografia',8.5,9.0),
  ('JOAO PEDRO LOPES DOS REIS','Artes',10.0,10.0),
  ('JOAO PEDRO LOPES DOS REIS','Educacao Fisica',10.0,10.0),
  ('JOAO PEDRO LOPES DOS REIS','Ingles',8.5,9.4),
  ('JOAO PEDRO LOPES DOS REIS','Ensino Religioso',10.0,10.0),
  ('JORGE HENRIQUE MESSIAS CALDAS','Ciencias',8.7,8.7),
  ('JORGE HENRIQUE MESSIAS CALDAS','Matematica',8.2,7.7),
  ('JORGE HENRIQUE MESSIAS CALDAS','Redacao',9.0,8.2),
  ('JORGE HENRIQUE MESSIAS CALDAS','Maker',10.0,10.0),
  ('JORGE HENRIQUE MESSIAS CALDAS','Projeto Semear',10.0,10.0),
  ('JORGE HENRIQUE MESSIAS CALDAS','Socioemocional',10.0,10.0),
  ('JORGE HENRIQUE MESSIAS CALDAS','Portugues',8.1,8.2),
  ('JORGE HENRIQUE MESSIAS CALDAS','Historia',8.8,9.3),
  ('JORGE HENRIQUE MESSIAS CALDAS','Geografia',8.1,9.2),
  ('JORGE HENRIQUE MESSIAS CALDAS','Artes',10.0,10.0),
  ('JORGE HENRIQUE MESSIAS CALDAS','Educacao Fisica',10.0,10.0),
  ('JORGE HENRIQUE MESSIAS CALDAS','Ingles',8.3,9.6),
  ('JORGE HENRIQUE MESSIAS CALDAS','Ensino Religioso',10.0,10.0),
  ('LORENZO MONTEIRO TAVARES','Ciencias',8.6,9.1),
  ('LORENZO MONTEIRO TAVARES','Matematica',8.4,8.4),
  ('LORENZO MONTEIRO TAVARES','Redacao',9.0,8.5),
  ('LORENZO MONTEIRO TAVARES','Maker',10.0,10.0),
  ('LORENZO MONTEIRO TAVARES','Projeto Semear',10.0,10.0),
  ('LORENZO MONTEIRO TAVARES','Socioemocional',10.0,10.0),
  ('LORENZO MONTEIRO TAVARES','Portugues',8.2,9.1),
  ('LORENZO MONTEIRO TAVARES','Historia',9.2,9.8),
  ('LORENZO MONTEIRO TAVARES','Geografia',8.5,9.3),
  ('LORENZO MONTEIRO TAVARES','Artes',10.0,10.0),
  ('LORENZO MONTEIRO TAVARES','Educacao Fisica',10.0,10.0),
  ('LORENZO MONTEIRO TAVARES','Ingles',8.3,9.5),
  ('LORENZO MONTEIRO TAVARES','Ensino Religioso',10.0,10.0),
  ('MARIA FERNANDA XAVIER DE OLIVEIRA','Ciencias',7.8,8.3),
  ('MARIA FERNANDA XAVIER DE OLIVEIRA','Matematica',7.9,8.3),
  ('MARIA FERNANDA XAVIER DE OLIVEIRA','Redacao',9.8,8.3),
  ('MARIA FERNANDA XAVIER DE OLIVEIRA','Maker',10.0,10.0),
  ('MARIA FERNANDA XAVIER DE OLIVEIRA','Projeto Semear',10.0,10.0),
  ('MARIA FERNANDA XAVIER DE OLIVEIRA','Socioemocional',10.0,10.0),
  ('MARIA FERNANDA XAVIER DE OLIVEIRA','Portugues',8.7,8.7),
  ('MARIA FERNANDA XAVIER DE OLIVEIRA','Historia',8.0,8.8),
  ('MARIA FERNANDA XAVIER DE OLIVEIRA','Geografia',8.1,8.5),
  ('MARIA FERNANDA XAVIER DE OLIVEIRA','Artes',10.0,10.0),
  ('MARIA FERNANDA XAVIER DE OLIVEIRA','Educacao Fisica',10.0,10.0),
  ('MARIA FERNANDA XAVIER DE OLIVEIRA','Ingles',8.1,9.2),
  ('MARIA FERNANDA XAVIER DE OLIVEIRA','Ensino Religioso',10.0,10.0),
  ('MARIA JULIA VIEIRA MARTINS','Ciencias',9.9,9.6),
  ('MARIA JULIA VIEIRA MARTINS','Matematica',9.9,10.0),
  ('MARIA JULIA VIEIRA MARTINS','Redacao',9.9,9.9),
  ('MARIA JULIA VIEIRA MARTINS','Maker',10.0,10.0),
  ('MARIA JULIA VIEIRA MARTINS','Projeto Semear',10.0,10.0),
  ('MARIA JULIA VIEIRA MARTINS','Socioemocional',10.0,10.0),
  ('MARIA JULIA VIEIRA MARTINS','Portugues',9.9,9.8),
  ('MARIA JULIA VIEIRA MARTINS','Historia',9.7,10.0),
  ('MARIA JULIA VIEIRA MARTINS','Geografia',9.8,10.0),
  ('MARIA JULIA VIEIRA MARTINS','Artes',10.0,10.0),
  ('MARIA JULIA VIEIRA MARTINS','Educacao Fisica',10.0,10.0),
  ('MARIA JULIA VIEIRA MARTINS','Ingles',9.1,9.7),
  ('MARIA JULIA VIEIRA MARTINS','Ensino Religioso',10.0,10.0),
  ('MARIANA OLIVEIRA BARCELOS DA COSTA','Ciencias',9.6,9.5),
  ('MARIANA OLIVEIRA BARCELOS DA COSTA','Matematica',9.6,9.6),
  ('MARIANA OLIVEIRA BARCELOS DA COSTA','Redacao',9.8,9.0),
  ('MARIANA OLIVEIRA BARCELOS DA COSTA','Maker',10.0,10.0),
  ('MARIANA OLIVEIRA BARCELOS DA COSTA','Projeto Semear',10.0,10.0),
  ('MARIANA OLIVEIRA BARCELOS DA COSTA','Socioemocional',10.0,10.0),
  ('MARIANA OLIVEIRA BARCELOS DA COSTA','Portugues',9.7,9.9),
  ('MARIANA OLIVEIRA BARCELOS DA COSTA','Historia',9.4,9.2),
  ('MARIANA OLIVEIRA BARCELOS DA COSTA','Geografia',9.6,9.8),
  ('MARIANA OLIVEIRA BARCELOS DA COSTA','Artes',10.0,10.0),
  ('MARIANA OLIVEIRA BARCELOS DA COSTA','Educacao Fisica',10.0,10.0),
  ('MARIANA OLIVEIRA BARCELOS DA COSTA','Ingles',8.8,9.6),
  ('MARIANA OLIVEIRA BARCELOS DA COSTA','Ensino Religioso',10.0,10.0),
  ('MIGUEL ALVES MARTINS','Ciencias',9.8,9.7),
  ('MIGUEL ALVES MARTINS','Matematica',9.6,9.2),
  ('MIGUEL ALVES MARTINS','Redacao',9.8,9.8),
  ('MIGUEL ALVES MARTINS','Maker',10.0,10.0),
  ('MIGUEL ALVES MARTINS','Projeto Semear',10.0,10.0),
  ('MIGUEL ALVES MARTINS','Socioemocional',10.0,10.0),
  ('MIGUEL ALVES MARTINS','Portugues',9.6,9.8),
  ('MIGUEL ALVES MARTINS','Historia',9.7,9.7),
  ('MIGUEL ALVES MARTINS','Geografia',9.8,9.6),
  ('MIGUEL ALVES MARTINS','Artes',10.0,10.0),
  ('MIGUEL ALVES MARTINS','Educacao Fisica',10.0,10.0),
  ('MIGUEL ALVES MARTINS','Ingles',9.4,9.6),
  ('MIGUEL ALVES MARTINS','Ensino Religioso',10.0,10.0),
  ('VALENTINA CHAVES RIBEIRO SOUZA','Ciencias',9.1,9.4),
  ('VALENTINA CHAVES RIBEIRO SOUZA','Matematica',8.5,8.5),
  ('VALENTINA CHAVES RIBEIRO SOUZA','Redacao',9.8,8.8),
  ('VALENTINA CHAVES RIBEIRO SOUZA','Maker',10.0,10.0),
  ('VALENTINA CHAVES RIBEIRO SOUZA','Projeto Semear',10.0,10.0),
  ('VALENTINA CHAVES RIBEIRO SOUZA','Socioemocional',10.0,10.0),
  ('VALENTINA CHAVES RIBEIRO SOUZA','Portugues',9.6,9.5),
  ('VALENTINA CHAVES RIBEIRO SOUZA','Historia',9.6,9.3),
  ('VALENTINA CHAVES RIBEIRO SOUZA','Geografia',9.7,9.7),
  ('VALENTINA CHAVES RIBEIRO SOUZA','Artes',10.0,10.0),
  ('VALENTINA CHAVES RIBEIRO SOUZA','Educacao Fisica',10.0,10.0),
  ('VALENTINA CHAVES RIBEIRO SOUZA','Ingles',9.4,9.8),
  ('VALENTINA CHAVES RIBEIRO SOUZA','Ensino Religioso',10.0,10.0);

-- Turma A (Matutino)
create temp table stg_turma_alvo_4a (turma_id uuid) on commit drop;

insert into stg_turma_alvo_4a (turma_id)
select m.turma_id
from stg_boletim_4ano_a s
join alunos al on pg_temp.norm_nome(al.nome) = pg_temp.norm_nome(s.aluno_nome)
join matriculas m on m.aluno_id = al.id and m.ano_letivo = 2026
group by m.turma_id
order by count(*) desc
limit 1;

do $$
begin
  if (select count(*) from stg_turma_alvo_4a) <> 1 then
    raise exception 'nao foi possivel resolver uma unica turma para os alunos do boletim (4o ANO A)';
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
from stg_boletim_4ano_a s
join disciplinas d on d.serie_id = '27bed718-b6e6-406b-ae55-15477c430a57' and d.nome = s.disciplina
cross join stg_turma_alvo_4a t
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
from stg_boletim_4ano_a s
join alunos al on pg_temp.norm_nome(al.nome) = pg_temp.norm_nome(s.aluno_nome)
cross join stg_turma_alvo_4a t
join matriculas m on m.aluno_id = al.id and m.ano_letivo = 2026 and m.turma_id = t.turma_id
join disciplinas d on d.serie_id = '27bed718-b6e6-406b-ae55-15477c430a57' and d.nome = s.disciplina
join avaliacoes a on a.turma_id = t.turma_id and a.disciplina_id = d.id
  and a.bimestre = 1 and a.ano_letivo = 2026 and a.titulo = 'Media Bimestral'
on conflict (avaliacao_id, aluno_id) do update set valor = excluded.valor;

insert into notas (escola_id, avaliacao_id, aluno_id, matricula_id, valor)
select '00000000-0000-0000-0000-000000000001'::uuid, a.id, al.id, m.id, s.b2
from stg_boletim_4ano_a s
join alunos al on pg_temp.norm_nome(al.nome) = pg_temp.norm_nome(s.aluno_nome)
cross join stg_turma_alvo_4a t
join matriculas m on m.aluno_id = al.id and m.ano_letivo = 2026 and m.turma_id = t.turma_id
join disciplinas d on d.serie_id = '27bed718-b6e6-406b-ae55-15477c430a57' and d.nome = s.disciplina
join avaliacoes a on a.turma_id = t.turma_id and a.disciplina_id = d.id
  and a.bimestre = 2 and a.ano_letivo = 2026 and a.titulo = 'Media Bimestral'
on conflict (avaliacao_id, aluno_id) do update set valor = excluded.valor;

-- Turma B (Vespertino)
create temp table stg_turma_alvo_4b (turma_id uuid) on commit drop;

insert into stg_turma_alvo_4b (turma_id)
select m.turma_id
from stg_boletim_4ano_b s
join alunos al on pg_temp.norm_nome(al.nome) = pg_temp.norm_nome(s.aluno_nome)
join matriculas m on m.aluno_id = al.id and m.ano_letivo = 2026
group by m.turma_id
order by count(*) desc
limit 1;

do $$
begin
  if (select count(*) from stg_turma_alvo_4b) <> 1 then
    raise exception 'nao foi possivel resolver uma unica turma para os alunos do boletim (4o ANO B)';
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
from stg_boletim_4ano_b s
join disciplinas d on d.serie_id = '27bed718-b6e6-406b-ae55-15477c430a57' and d.nome = s.disciplina
cross join stg_turma_alvo_4b t
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
from stg_boletim_4ano_b s
join alunos al on pg_temp.norm_nome(al.nome) = pg_temp.norm_nome(s.aluno_nome)
cross join stg_turma_alvo_4b t
join matriculas m on m.aluno_id = al.id and m.ano_letivo = 2026 and m.turma_id = t.turma_id
join disciplinas d on d.serie_id = '27bed718-b6e6-406b-ae55-15477c430a57' and d.nome = s.disciplina
join avaliacoes a on a.turma_id = t.turma_id and a.disciplina_id = d.id
  and a.bimestre = 1 and a.ano_letivo = 2026 and a.titulo = 'Media Bimestral'
on conflict (avaliacao_id, aluno_id) do update set valor = excluded.valor;

insert into notas (escola_id, avaliacao_id, aluno_id, matricula_id, valor)
select '00000000-0000-0000-0000-000000000001'::uuid, a.id, al.id, m.id, s.b2
from stg_boletim_4ano_b s
join alunos al on pg_temp.norm_nome(al.nome) = pg_temp.norm_nome(s.aluno_nome)
cross join stg_turma_alvo_4b t
join matriculas m on m.aluno_id = al.id and m.ano_letivo = 2026 and m.turma_id = t.turma_id
join disciplinas d on d.serie_id = '27bed718-b6e6-406b-ae55-15477c430a57' and d.nome = s.disciplina
join avaliacoes a on a.turma_id = t.turma_id and a.disciplina_id = d.id
  and a.bimestre = 2 and a.ano_letivo = 2026 and a.titulo = 'Media Bimestral'
on conflict (avaliacao_id, aluno_id) do update set valor = excluded.valor;
