-- Importa notas do boletim (1o, 2o e 3o bimestre 2026) da turma 2o ANO B - Vespertino.
-- Mesmo padrao das migrations anteriores: avaliacao sintetica "Media Bimestral" por
-- disciplina x bimestre, nota = MB do boletim. Bimestre sem nota (null) nao gera
-- avaliacao/nota. Apenas Geografia tem 3o bimestre lancado pra alguns alunos.
-- Fonte: Resultado - 2 ANO - VESPERTINO.pdf.
-- Correcao de cadastro feita em prod antes desta migration: Maria Angelina Gobira de
-- Carvalho nao tinha matricula 2026 (existiam 3 alunas parecidas sem matricula: Maria
-- Valentina/Angelina/Antonella Gobira de Carvalho); criada matricula 2026 dela na
-- turma 2o ANO B-Vespertino.
-- Turma resolvida dinamicamente pela matricula 2026 dos alunos do boletim.

create temp table stg_boletim_2ano_b (
  aluno_nome text,
  disciplina text,
  b1 numeric(5,2),
  b2 numeric(5,2),
  b3 numeric(5,2)
) on commit drop;

insert into stg_boletim_2ano_b (aluno_nome, disciplina, b1, b2, b3) values
  ('BENJAMIN LACERDA XAVIER','Ciencias',9.8,9.6,2.9),
  ('BENJAMIN LACERDA XAVIER','Matematica',9.1,9.3,null),
  ('BENJAMIN LACERDA XAVIER','Matematica Concreta',10.0,10.0,null),
  ('BENJAMIN LACERDA XAVIER','Socioemocional',10.0,10.0,10.0),
  ('BENJAMIN LACERDA XAVIER','Leitura',9.5,9.5,null),
  ('BENJAMIN LACERDA XAVIER','Musicalizacao',10.0,10.0,10.0),
  ('BENJAMIN LACERDA XAVIER','Projeto Semear',10.0,10.0,10.0),
  ('BENJAMIN LACERDA XAVIER','Portugues',9.8,9.2,null),
  ('BENJAMIN LACERDA XAVIER','Historia',9.6,9.7,null),
  ('BENJAMIN LACERDA XAVIER','Geografia',9.4,9.5,2.8),
  ('BENJAMIN LACERDA XAVIER','Artes',9.0,9.0,null),
  ('BENJAMIN LACERDA XAVIER','Educacao Fisica',10.0,10.0,10.0),
  ('BENJAMIN LACERDA XAVIER','Ingles',9.6,10.0,null),
  ('BENJAMIN LACERDA XAVIER','Ensino Religioso',9.5,9.5,null),
  ('BENJAMIN MESSIAS CALDAS','Ciencias',8.5,8.4,2.7),
  ('BENJAMIN MESSIAS CALDAS','Matematica',8.5,8.0,null),
  ('BENJAMIN MESSIAS CALDAS','Matematica Concreta',10.0,10.0,null),
  ('BENJAMIN MESSIAS CALDAS','Socioemocional',10.0,10.0,10.0),
  ('BENJAMIN MESSIAS CALDAS','Leitura',6.0,7.0,null),
  ('BENJAMIN MESSIAS CALDAS','Musicalizacao',10.0,10.0,10.0),
  ('BENJAMIN MESSIAS CALDAS','Projeto Semear',10.0,10.0,10.0),
  ('BENJAMIN MESSIAS CALDAS','Portugues',8.1,7.7,null),
  ('BENJAMIN MESSIAS CALDAS','Historia',8.8,8.6,null),
  ('BENJAMIN MESSIAS CALDAS','Geografia',8.5,7.6,2.5),
  ('BENJAMIN MESSIAS CALDAS','Artes',8.5,8.5,null),
  ('BENJAMIN MESSIAS CALDAS','Educacao Fisica',10.0,10.0,10.0),
  ('BENJAMIN MESSIAS CALDAS','Ingles',9.8,8.7,null),
  ('BENJAMIN MESSIAS CALDAS','Ensino Religioso',9.5,9.5,null),
  ('CLARICE SIQUEIRA AZEVEDO','Ciencias',9.6,9.6,3.1),
  ('CLARICE SIQUEIRA AZEVEDO','Matematica',9.3,9.5,null),
  ('CLARICE SIQUEIRA AZEVEDO','Matematica Concreta',10.0,10.0,null),
  ('CLARICE SIQUEIRA AZEVEDO','Socioemocional',10.0,10.0,10.0),
  ('CLARICE SIQUEIRA AZEVEDO','Leitura',9.5,9.5,null),
  ('CLARICE SIQUEIRA AZEVEDO','Musicalizacao',10.0,10.0,10.0),
  ('CLARICE SIQUEIRA AZEVEDO','Projeto Semear',10.0,10.0,10.0),
  ('CLARICE SIQUEIRA AZEVEDO','Portugues',10.0,9.7,null),
  ('CLARICE SIQUEIRA AZEVEDO','Historia',9.3,10.0,null),
  ('CLARICE SIQUEIRA AZEVEDO','Geografia',9.4,10.0,2.9),
  ('CLARICE SIQUEIRA AZEVEDO','Artes',10.0,10.0,null),
  ('CLARICE SIQUEIRA AZEVEDO','Educacao Fisica',10.0,10.0,10.0),
  ('CLARICE SIQUEIRA AZEVEDO','Ingles',10.0,10.0,null),
  ('CLARICE SIQUEIRA AZEVEDO','Ensino Religioso',10.0,10.0,null),
  ('HEITOR CHAVES DO CARMO','Ciencias',9.4,9.1,3.3),
  ('HEITOR CHAVES DO CARMO','Matematica',9.5,8.4,null),
  ('HEITOR CHAVES DO CARMO','Matematica Concreta',10.0,10.0,null),
  ('HEITOR CHAVES DO CARMO','Socioemocional',10.0,10.0,10.0),
  ('HEITOR CHAVES DO CARMO','Leitura',8.5,8.5,null),
  ('HEITOR CHAVES DO CARMO','Musicalizacao',10.0,10.0,10.0),
  ('HEITOR CHAVES DO CARMO','Projeto Semear',10.0,10.0,10.0),
  ('HEITOR CHAVES DO CARMO','Portugues',9.3,9.4,null),
  ('HEITOR CHAVES DO CARMO','Historia',9.3,9.3,null),
  ('HEITOR CHAVES DO CARMO','Geografia',9.2,9.3,2.4),
  ('HEITOR CHAVES DO CARMO','Artes',9.5,9.5,null),
  ('HEITOR CHAVES DO CARMO','Educacao Fisica',10.0,10.0,10.0),
  ('HEITOR CHAVES DO CARMO','Ingles',9.8,9.0,null),
  ('HEITOR CHAVES DO CARMO','Ensino Religioso',9.5,9.5,null),
  ('ISADORA DE CASTRO LOBO','Ciencias',9.0,9.3,3.1),
  ('ISADORA DE CASTRO LOBO','Matematica',9.4,8.8,null),
  ('ISADORA DE CASTRO LOBO','Matematica Concreta',10.0,10.0,null),
  ('ISADORA DE CASTRO LOBO','Socioemocional',10.0,10.0,10.0),
  ('ISADORA DE CASTRO LOBO','Leitura',9.2,9.2,null),
  ('ISADORA DE CASTRO LOBO','Musicalizacao',10.0,10.0,10.0),
  ('ISADORA DE CASTRO LOBO','Projeto Semear',10.0,10.0,10.0),
  ('ISADORA DE CASTRO LOBO','Portugues',9.7,8.9,null),
  ('ISADORA DE CASTRO LOBO','Historia',9.5,9.3,null),
  ('ISADORA DE CASTRO LOBO','Geografia',10.0,9.4,2.9),
  ('ISADORA DE CASTRO LOBO','Artes',10.0,10.0,null),
  ('ISADORA DE CASTRO LOBO','Educacao Fisica',10.0,10.0,10.0),
  ('ISADORA DE CASTRO LOBO','Ingles',9.2,9.5,null),
  ('ISADORA DE CASTRO LOBO','Ensino Religioso',10.0,10.0,null),
  ('JOAO ROBERTO BASTOS NASCIMENTO','Ciencias',9.4,9.3,2.4),
  ('JOAO ROBERTO BASTOS NASCIMENTO','Matematica',9.0,9.2,null),
  ('JOAO ROBERTO BASTOS NASCIMENTO','Matematica Concreta',10.0,10.0,null),
  ('JOAO ROBERTO BASTOS NASCIMENTO','Socioemocional',10.0,10.0,10.0),
  ('JOAO ROBERTO BASTOS NASCIMENTO','Leitura',7.7,7.7,null),
  ('JOAO ROBERTO BASTOS NASCIMENTO','Musicalizacao',10.0,10.0,10.0),
  ('JOAO ROBERTO BASTOS NASCIMENTO','Projeto Semear',10.0,10.0,10.0),
  ('JOAO ROBERTO BASTOS NASCIMENTO','Portugues',9.8,9.2,null),
  ('JOAO ROBERTO BASTOS NASCIMENTO','Historia',9.7,9.8,null),
  ('JOAO ROBERTO BASTOS NASCIMENTO','Geografia',10.0,9.1,2.8),
  ('JOAO ROBERTO BASTOS NASCIMENTO','Artes',10.0,10.0,null),
  ('JOAO ROBERTO BASTOS NASCIMENTO','Educacao Fisica',10.0,10.0,10.0),
  ('JOAO ROBERTO BASTOS NASCIMENTO','Ingles',9.5,10.0,null),
  ('JOAO ROBERTO BASTOS NASCIMENTO','Ensino Religioso',10.0,10.0,null),
  ('JOÃO TEODORO SOUSA SAMPAIO','Ciencias',9.3,8.9,3.1),
  ('JOÃO TEODORO SOUSA SAMPAIO','Matematica',8.3,8.2,null),
  ('JOÃO TEODORO SOUSA SAMPAIO','Matematica Concreta',10.0,10.0,null),
  ('JOÃO TEODORO SOUSA SAMPAIO','Socioemocional',10.0,10.0,10.0),
  ('JOÃO TEODORO SOUSA SAMPAIO','Leitura',9.0,9.0,null),
  ('JOÃO TEODORO SOUSA SAMPAIO','Musicalizacao',10.0,10.0,10.0),
  ('JOÃO TEODORO SOUSA SAMPAIO','Projeto Semear',10.0,10.0,10.0),
  ('JOÃO TEODORO SOUSA SAMPAIO','Portugues',9.5,9.6,null),
  ('JOÃO TEODORO SOUSA SAMPAIO','Historia',9.8,9.3,null),
  ('JOÃO TEODORO SOUSA SAMPAIO','Geografia',9.7,9.6,3.2),
  ('JOÃO TEODORO SOUSA SAMPAIO','Artes',9.5,9.5,null),
  ('JOÃO TEODORO SOUSA SAMPAIO','Educacao Fisica',10.0,10.0,10.0),
  ('JOÃO TEODORO SOUSA SAMPAIO','Ingles',0.0,10.0,null),
  ('JOÃO TEODORO SOUSA SAMPAIO','Ensino Religioso',9.5,9.5,null),
  ('LAURA SANTOS CORDEIRO','Ciencias',10.0,10.0,3.3),
  ('LAURA SANTOS CORDEIRO','Matematica',9.8,10.0,null),
  ('LAURA SANTOS CORDEIRO','Matematica Concreta',10.0,10.0,null),
  ('LAURA SANTOS CORDEIRO','Socioemocional',10.0,10.0,10.0),
  ('LAURA SANTOS CORDEIRO','Leitura',9.2,9.0,null),
  ('LAURA SANTOS CORDEIRO','Musicalizacao',10.0,10.0,10.0),
  ('LAURA SANTOS CORDEIRO','Projeto Semear',10.0,10.0,10.0),
  ('LAURA SANTOS CORDEIRO','Portugues',10.0,9.6,null),
  ('LAURA SANTOS CORDEIRO','Historia',10.0,9.8,null),
  ('LAURA SANTOS CORDEIRO','Geografia',9.5,9.8,3.3),
  ('LAURA SANTOS CORDEIRO','Artes',10.0,10.0,null),
  ('LAURA SANTOS CORDEIRO','Educacao Fisica',10.0,10.0,10.0),
  ('LAURA SANTOS CORDEIRO','Ingles',9.0,10.0,null),
  ('LAURA SANTOS CORDEIRO','Ensino Religioso',10.0,10.0,null),
  ('LEONORA BORGES TERRA','Ciencias',9.6,8.9,2.6),
  ('LEONORA BORGES TERRA','Matematica',9.6,9.2,null),
  ('LEONORA BORGES TERRA','Matematica Concreta',10.0,10.0,null),
  ('LEONORA BORGES TERRA','Socioemocional',10.0,10.0,10.0),
  ('LEONORA BORGES TERRA','Leitura',8.2,8.2,null),
  ('LEONORA BORGES TERRA','Musicalizacao',10.0,10.0,10.0),
  ('LEONORA BORGES TERRA','Projeto Semear',10.0,10.0,10.0),
  ('LEONORA BORGES TERRA','Portugues',9.6,9.3,null),
  ('LEONORA BORGES TERRA','Historia',9.1,8.9,null),
  ('LEONORA BORGES TERRA','Geografia',10.0,9.5,3.1),
  ('LEONORA BORGES TERRA','Artes',9.0,7.5,null),
  ('LEONORA BORGES TERRA','Educacao Fisica',10.0,10.0,10.0),
  ('LEONORA BORGES TERRA','Ingles',9.4,9.0,null),
  ('LEONORA BORGES TERRA','Ensino Religioso',10.0,10.0,null),
  ('LORENZO CABRINI PIRES','Ciencias',9.1,9.0,3.1),
  ('LORENZO CABRINI PIRES','Matematica',9.3,9.1,null),
  ('LORENZO CABRINI PIRES','Matematica Concreta',10.0,10.0,null),
  ('LORENZO CABRINI PIRES','Socioemocional',10.0,10.0,10.0),
  ('LORENZO CABRINI PIRES','Leitura',9.5,9.5,null),
  ('LORENZO CABRINI PIRES','Musicalizacao',10.0,10.0,10.0),
  ('LORENZO CABRINI PIRES','Projeto Semear',10.0,10.0,10.0),
  ('LORENZO CABRINI PIRES','Portugues',8.8,9.0,null),
  ('LORENZO CABRINI PIRES','Historia',9.1,8.8,null),
  ('LORENZO CABRINI PIRES','Geografia',8.9,9.4,3.2),
  ('LORENZO CABRINI PIRES','Artes',8.5,8.5,null),
  ('LORENZO CABRINI PIRES','Educacao Fisica',10.0,10.0,10.0),
  ('LORENZO CABRINI PIRES','Ingles',9.2,9.0,null),
  ('LORENZO CABRINI PIRES','Ensino Religioso',9.5,9.5,null),
  ('LUCAS SANTOS COSTA','Ciencias',8.7,8.4,2.9),
  ('LUCAS SANTOS COSTA','Matematica',8.3,8.1,null),
  ('LUCAS SANTOS COSTA','Matematica Concreta',10.0,10.0,null),
  ('LUCAS SANTOS COSTA','Socioemocional',10.0,10.0,10.0),
  ('LUCAS SANTOS COSTA','Leitura',8.5,8.5,null),
  ('LUCAS SANTOS COSTA','Musicalizacao',10.0,10.0,10.0),
  ('LUCAS SANTOS COSTA','Projeto Semear',10.0,10.0,10.0),
  ('LUCAS SANTOS COSTA','Portugues',7.8,7.9,null),
  ('LUCAS SANTOS COSTA','Historia',9.1,8.6,null),
  ('LUCAS SANTOS COSTA','Geografia',8.1,8.7,2.2),
  ('LUCAS SANTOS COSTA','Artes',8.5,8.5,null),
  ('LUCAS SANTOS COSTA','Educacao Fisica',10.0,10.0,10.0),
  ('LUCAS SANTOS COSTA','Ingles',9.5,9.7,null),
  ('LUCAS SANTOS COSTA','Ensino Religioso',9.5,9.5,null),
  ('MARIA ANGELINA GOBIRA DE CARVALHO','Ciencias',9.6,9.6,3.1),
  ('MARIA ANGELINA GOBIRA DE CARVALHO','Matematica',10.0,9.4,null),
  ('MARIA ANGELINA GOBIRA DE CARVALHO','Matematica Concreta',10.0,10.0,null),
  ('MARIA ANGELINA GOBIRA DE CARVALHO','Socioemocional',10.0,10.0,10.0),
  ('MARIA ANGELINA GOBIRA DE CARVALHO','Leitura',9.5,9.5,null),
  ('MARIA ANGELINA GOBIRA DE CARVALHO','Musicalizacao',10.0,10.0,10.0),
  ('MARIA ANGELINA GOBIRA DE CARVALHO','Projeto Semear',10.0,10.0,10.0),
  ('MARIA ANGELINA GOBIRA DE CARVALHO','Portugues',9.7,9.6,null),
  ('MARIA ANGELINA GOBIRA DE CARVALHO','Historia',9.6,9.8,null),
  ('MARIA ANGELINA GOBIRA DE CARVALHO','Geografia',9.3,9.4,2.9),
  ('MARIA ANGELINA GOBIRA DE CARVALHO','Artes',10.0,10.0,null),
  ('MARIA ANGELINA GOBIRA DE CARVALHO','Educacao Fisica',10.0,10.0,10.0),
  ('MARIA ANGELINA GOBIRA DE CARVALHO','Ingles',7.9,10.0,null),
  ('MARIA ANGELINA GOBIRA DE CARVALHO','Ensino Religioso',10.0,8.0,null),
  ('MARIA EDUARDA LIMA DE ASSIS','Ciencias',8.5,8.5,2.0),
  ('MARIA EDUARDA LIMA DE ASSIS','Matematica',8.6,7.8,null),
  ('MARIA EDUARDA LIMA DE ASSIS','Matematica Concreta',10.0,10.0,null),
  ('MARIA EDUARDA LIMA DE ASSIS','Socioemocional',10.0,10.0,10.0),
  ('MARIA EDUARDA LIMA DE ASSIS','Leitura',8.7,8.7,null),
  ('MARIA EDUARDA LIMA DE ASSIS','Musicalizacao',10.0,10.0,10.0),
  ('MARIA EDUARDA LIMA DE ASSIS','Projeto Semear',10.0,10.0,10.0),
  ('MARIA EDUARDA LIMA DE ASSIS','Portugues',8.7,8.3,null),
  ('MARIA EDUARDA LIMA DE ASSIS','Historia',9.6,8.4,null),
  ('MARIA EDUARDA LIMA DE ASSIS','Geografia',8.2,8.3,3.0),
  ('MARIA EDUARDA LIMA DE ASSIS','Artes',9.0,9.5,null),
  ('MARIA EDUARDA LIMA DE ASSIS','Educacao Fisica',10.0,10.0,10.0),
  ('MARIA EDUARDA LIMA DE ASSIS','Ingles',9.5,9.0,null),
  ('MARIA EDUARDA LIMA DE ASSIS','Ensino Religioso',10.0,10.0,null),
  ('MARIA EDUARDA MARTINS SANTOS','Ciencias',10.0,9.7,3.0),
  ('MARIA EDUARDA MARTINS SANTOS','Matematica',9.8,9.1,null),
  ('MARIA EDUARDA MARTINS SANTOS','Matematica Concreta',10.0,10.0,null),
  ('MARIA EDUARDA MARTINS SANTOS','Socioemocional',10.0,10.0,10.0),
  ('MARIA EDUARDA MARTINS SANTOS','Leitura',9.0,9.0,null),
  ('MARIA EDUARDA MARTINS SANTOS','Musicalizacao',10.0,10.0,10.0),
  ('MARIA EDUARDA MARTINS SANTOS','Projeto Semear',10.0,10.0,10.0),
  ('MARIA EDUARDA MARTINS SANTOS','Portugues',9.8,9.4,null),
  ('MARIA EDUARDA MARTINS SANTOS','Historia',9.6,9.1,null),
  ('MARIA EDUARDA MARTINS SANTOS','Geografia',9.6,9.5,3.3),
  ('MARIA EDUARDA MARTINS SANTOS','Artes',10.0,10.0,null),
  ('MARIA EDUARDA MARTINS SANTOS','Educacao Fisica',10.0,10.0,10.0),
  ('MARIA EDUARDA MARTINS SANTOS','Ingles',9.0,10.0,null),
  ('MARIA EDUARDA MARTINS SANTOS','Ensino Religioso',10.0,10.0,null),
  ('MARIA LUIZA DE PAULA','Ciencias',10.0,10.0,3.3),
  ('MARIA LUIZA DE PAULA','Matematica',10.0,9.5,null),
  ('MARIA LUIZA DE PAULA','Matematica Concreta',10.0,10.0,null),
  ('MARIA LUIZA DE PAULA','Socioemocional',10.0,10.0,10.0),
  ('MARIA LUIZA DE PAULA','Leitura',9.5,9.5,null),
  ('MARIA LUIZA DE PAULA','Musicalizacao',10.0,10.0,10.0),
  ('MARIA LUIZA DE PAULA','Projeto Semear',10.0,10.0,10.0),
  ('MARIA LUIZA DE PAULA','Portugues',10.0,10.0,null),
  ('MARIA LUIZA DE PAULA','Historia',10.0,9.9,null),
  ('MARIA LUIZA DE PAULA','Geografia',10.0,10.0,3.0),
  ('MARIA LUIZA DE PAULA','Artes',10.0,10.0,null),
  ('MARIA LUIZA DE PAULA','Educacao Fisica',10.0,10.0,10.0),
  ('MARIA LUIZA DE PAULA','Ingles',10.0,10.0,null),
  ('MARIA LUIZA DE PAULA','Ensino Religioso',10.0,10.0,null),
  ('NICOLLAS EMANUEL PONTES DA CONCEIÇÃO','Ciencias',9.6,9.3,2.7),
  ('NICOLLAS EMANUEL PONTES DA CONCEIÇÃO','Matematica',9.2,9.3,null),
  ('NICOLLAS EMANUEL PONTES DA CONCEIÇÃO','Matematica Concreta',10.0,10.0,null),
  ('NICOLLAS EMANUEL PONTES DA CONCEIÇÃO','Socioemocional',10.0,10.0,10.0),
  ('NICOLLAS EMANUEL PONTES DA CONCEIÇÃO','Leitura',9.0,9.0,null),
  ('NICOLLAS EMANUEL PONTES DA CONCEIÇÃO','Musicalizacao',10.0,10.0,10.0),
  ('NICOLLAS EMANUEL PONTES DA CONCEIÇÃO','Projeto Semear',10.0,10.0,10.0),
  ('NICOLLAS EMANUEL PONTES DA CONCEIÇÃO','Portugues',8.9,8.4,null),
  ('NICOLLAS EMANUEL PONTES DA CONCEIÇÃO','Historia',9.6,9.4,null),
  ('NICOLLAS EMANUEL PONTES DA CONCEIÇÃO','Geografia',8.9,8.6,3.3),
  ('NICOLLAS EMANUEL PONTES DA CONCEIÇÃO','Artes',9.5,9.0,null),
  ('NICOLLAS EMANUEL PONTES DA CONCEIÇÃO','Educacao Fisica',10.0,10.0,10.0),
  ('NICOLLAS EMANUEL PONTES DA CONCEIÇÃO','Ingles',9.7,9.2,null),
  ('NICOLLAS EMANUEL PONTES DA CONCEIÇÃO','Ensino Religioso',10.0,10.0,null),
  ('NOAH ALVES SANTOS','Ciencias',9.2,9.5,3.1),
  ('NOAH ALVES SANTOS','Matematica',8.1,9.2,null),
  ('NOAH ALVES SANTOS','Matematica Concreta',10.0,10.0,null),
  ('NOAH ALVES SANTOS','Socioemocional',10.0,10.0,10.0),
  ('NOAH ALVES SANTOS','Leitura',7.7,7.7,null),
  ('NOAH ALVES SANTOS','Musicalizacao',10.0,10.0,10.0),
  ('NOAH ALVES SANTOS','Projeto Semear',10.0,10.0,10.0),
  ('NOAH ALVES SANTOS','Portugues',9.3,8.9,null),
  ('NOAH ALVES SANTOS','Historia',9.6,9.0,null),
  ('NOAH ALVES SANTOS','Geografia',9.2,8.7,2.2),
  ('NOAH ALVES SANTOS','Artes',9.0,9.0,null),
  ('NOAH ALVES SANTOS','Educacao Fisica',10.0,10.0,10.0),
  ('NOAH ALVES SANTOS','Ingles',9.4,10.0,null),
  ('NOAH ALVES SANTOS','Ensino Religioso',10.0,10.0,null),
  ('PAULO FERNANDO VIEIRA FERNANDES','Ciencias',9.3,9.0,2.6),
  ('PAULO FERNANDO VIEIRA FERNANDES','Matematica',9.6,9.0,null),
  ('PAULO FERNANDO VIEIRA FERNANDES','Matematica Concreta',10.0,10.0,null),
  ('PAULO FERNANDO VIEIRA FERNANDES','Socioemocional',10.0,10.0,10.0),
  ('PAULO FERNANDO VIEIRA FERNANDES','Leitura',9.0,9.0,null),
  ('PAULO FERNANDO VIEIRA FERNANDES','Musicalizacao',10.0,10.0,10.0),
  ('PAULO FERNANDO VIEIRA FERNANDES','Projeto Semear',10.0,10.0,10.0),
  ('PAULO FERNANDO VIEIRA FERNANDES','Portugues',9.6,8.7,null),
  ('PAULO FERNANDO VIEIRA FERNANDES','Historia',8.6,9.1,null),
  ('PAULO FERNANDO VIEIRA FERNANDES','Geografia',9.3,9.0,2.5),
  ('PAULO FERNANDO VIEIRA FERNANDES','Artes',9.0,9.0,null),
  ('PAULO FERNANDO VIEIRA FERNANDES','Educacao Fisica',10.0,10.0,10.0),
  ('PAULO FERNANDO VIEIRA FERNANDES','Ingles',9.3,10.0,null),
  ('PAULO FERNANDO VIEIRA FERNANDES','Ensino Religioso',10.0,10.0,null),
  ('SOFIA MARTINS ARAÚJO','Ciencias',8.8,8.3,3.2),
  ('SOFIA MARTINS ARAÚJO','Matematica',8.5,8.2,null),
  ('SOFIA MARTINS ARAÚJO','Matematica Concreta',10.0,10.0,null),
  ('SOFIA MARTINS ARAÚJO','Socioemocional',10.0,10.0,10.0),
  ('SOFIA MARTINS ARAÚJO','Leitura',5.0,7.0,null),
  ('SOFIA MARTINS ARAÚJO','Musicalizacao',10.0,10.0,10.0),
  ('SOFIA MARTINS ARAÚJO','Projeto Semear',10.0,10.0,10.0),
  ('SOFIA MARTINS ARAÚJO','Portugues',8.0,8.1,null),
  ('SOFIA MARTINS ARAÚJO','Historia',8.8,8.4,null),
  ('SOFIA MARTINS ARAÚJO','Geografia',8.6,7.8,2.8),
  ('SOFIA MARTINS ARAÚJO','Artes',8.5,8.5,null),
  ('SOFIA MARTINS ARAÚJO','Educacao Fisica',10.0,10.0,10.0),
  ('SOFIA MARTINS ARAÚJO','Ingles',9.2,9.5,null),
  ('SOFIA MARTINS ARAÚJO','Ensino Religioso',10.0,10.0,null),
  ('YASMIN SOUZA RIBEIRO','Ciencias',9.0,8.6,2.4),
  ('YASMIN SOUZA RIBEIRO','Matematica',8.0,8.4,null),
  ('YASMIN SOUZA RIBEIRO','Matematica Concreta',10.0,10.0,null),
  ('YASMIN SOUZA RIBEIRO','Socioemocional',10.0,10.0,10.0),
  ('YASMIN SOUZA RIBEIRO','Leitura',8.5,8.5,null),
  ('YASMIN SOUZA RIBEIRO','Musicalizacao',10.0,10.0,10.0),
  ('YASMIN SOUZA RIBEIRO','Projeto Semear',10.0,10.0,10.0),
  ('YASMIN SOUZA RIBEIRO','Portugues',8.6,8.9,null),
  ('YASMIN SOUZA RIBEIRO','Historia',9.4,9.1,null),
  ('YASMIN SOUZA RIBEIRO','Geografia',8.3,8.1,2.8),
  ('YASMIN SOUZA RIBEIRO','Artes',8.5,8.5,null),
  ('YASMIN SOUZA RIBEIRO','Educacao Fisica',10.0,10.0,10.0),
  ('YASMIN SOUZA RIBEIRO','Ingles',9.0,9.9,null),
  ('YASMIN SOUZA RIBEIRO','Ensino Religioso',9.5,9.5,null);

create temp table stg_turma_alvo_2b (turma_id uuid) on commit drop;

insert into stg_turma_alvo_2b (turma_id)
select m.turma_id
from stg_boletim_2ano_b s
join alunos al on upper(al.nome) = upper(s.aluno_nome)
join matriculas m on m.aluno_id = al.id and m.ano_letivo = 2026
group by m.turma_id
order by count(*) desc
limit 1;

do $do$
begin
  if (select count(*) from stg_turma_alvo_2b) <> 1 then
    raise exception 'nao foi possivel resolver uma unica turma para os alunos do boletim (2o ANO B)';
  end if;
end $do$;

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
from stg_boletim_2ano_b s
join disciplinas d on d.serie_id = 'c36d3af8-c910-4e1a-90f3-231f0f7bbc2a' and d.nome = s.disciplina
cross join stg_turma_alvo_2b t
cross join (values (1), (2), (3)) as b(bimestre)
where (
  (b.bimestre = 1 and s.b1 is not null) or
  (b.bimestre = 2 and s.b2 is not null) or
  (b.bimestre = 3 and s.b3 is not null)
)
and not exists (
  select 1 from avaliacoes a
  where a.turma_id = t.turma_id
    and a.disciplina_id = d.id
    and a.bimestre = b.bimestre
    and a.ano_letivo = 2026
    and a.titulo = 'Media Bimestral'
);

insert into notas (escola_id, avaliacao_id, aluno_id, matricula_id, valor)
select
  '00000000-0000-0000-0000-000000000001'::uuid,
  a.id,
  al.id,
  m.id,
  s.b1
from stg_boletim_2ano_b s
join alunos al on upper(al.nome) = upper(s.aluno_nome)
cross join stg_turma_alvo_2b t
join matriculas m on m.aluno_id = al.id and m.ano_letivo = 2026 and m.turma_id = t.turma_id
join disciplinas d on d.serie_id = 'c36d3af8-c910-4e1a-90f3-231f0f7bbc2a' and d.nome = s.disciplina
join avaliacoes a on a.turma_id = t.turma_id and a.disciplina_id = d.id
  and a.bimestre = 1 and a.ano_letivo = 2026 and a.titulo = 'Media Bimestral'
where s.b1 is not null
on conflict (avaliacao_id, aluno_id) do update set valor = excluded.valor;

insert into notas (escola_id, avaliacao_id, aluno_id, matricula_id, valor)
select
  '00000000-0000-0000-0000-000000000001'::uuid,
  a.id,
  al.id,
  m.id,
  s.b2
from stg_boletim_2ano_b s
join alunos al on upper(al.nome) = upper(s.aluno_nome)
cross join stg_turma_alvo_2b t
join matriculas m on m.aluno_id = al.id and m.ano_letivo = 2026 and m.turma_id = t.turma_id
join disciplinas d on d.serie_id = 'c36d3af8-c910-4e1a-90f3-231f0f7bbc2a' and d.nome = s.disciplina
join avaliacoes a on a.turma_id = t.turma_id and a.disciplina_id = d.id
  and a.bimestre = 2 and a.ano_letivo = 2026 and a.titulo = 'Media Bimestral'
where s.b2 is not null
on conflict (avaliacao_id, aluno_id) do update set valor = excluded.valor;

insert into notas (escola_id, avaliacao_id, aluno_id, matricula_id, valor)
select
  '00000000-0000-0000-0000-000000000001'::uuid,
  a.id,
  al.id,
  m.id,
  s.b3
from stg_boletim_2ano_b s
join alunos al on upper(al.nome) = upper(s.aluno_nome)
cross join stg_turma_alvo_2b t
join matriculas m on m.aluno_id = al.id and m.ano_letivo = 2026 and m.turma_id = t.turma_id
join disciplinas d on d.serie_id = 'c36d3af8-c910-4e1a-90f3-231f0f7bbc2a' and d.nome = s.disciplina
join avaliacoes a on a.turma_id = t.turma_id and a.disciplina_id = d.id
  and a.bimestre = 3 and a.ano_letivo = 2026 and a.titulo = 'Media Bimestral'
where s.b3 is not null
on conflict (avaliacao_id, aluno_id) do update set valor = excluded.valor;
