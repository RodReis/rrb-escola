-- Importa notas do boletim (1o, 2o e 3o bimestre 2026) da turma 2o ANO A - Matutino.
-- Mesmo padrao das migrations 202609110002/003: avaliacao sintetica "Media Bimestral"
-- por disciplina x bimestre, nota = MB do boletim. Bimestre sem nota no boletim (null)
-- nao gera avaliacao/nota.
-- Fonte: Resultado - 2 ANO - MATUTINO.pdf.
-- Correcoes de cadastro feitas em prod antes desta migration:
--   - Anthonny Miguel e Nicole Emanuelly: matricula 2026 estava com status 'concluida'
--     apontando pra turma de ano_letivo=2025; corrigido status=ativa e turma_id pra
--     turma 2026 correta.
-- Turma resolvida dinamicamente pela matricula 2026 dos alunos do boletim.

-- Disciplinas do 2o ANO que ainda nao existiam no seed padrao
insert into disciplinas (escola_id, serie_id, nome, ordem)
select '00000000-0000-0000-0000-000000000001'::uuid, 'c36d3af8-c910-4e1a-90f3-231f0f7bbc2a'::uuid, nome, ordem
from (values
  ('Matematica Concreta', 8),
  ('Socioemocional', 9),
  ('Leitura', 10),
  ('Musicalizacao', 11),
  ('Projeto Semear', 12),
  ('Ensino Religioso', 13)
) as novas(nome, ordem)
on conflict (escola_id, serie_id, nome) do nothing;

create temp table stg_boletim_2ano_a (
  aluno_nome text,
  disciplina text,
  b1 numeric(5,2),
  b2 numeric(5,2),
  b3 numeric(5,2)
) on commit drop;

insert into stg_boletim_2ano_a (aluno_nome, disciplina, b1, b2, b3) values
  ('ANTHONNY MIGUEL JORGE DE SOUZA NEVES','Ciencias',9.5,8.8,3.1),
  ('ANTHONNY MIGUEL JORGE DE SOUZA NEVES','Matematica',9.0,9.2,3.1),
  ('ANTHONNY MIGUEL JORGE DE SOUZA NEVES','Matematica Concreta',10.0,10.0,null),
  ('ANTHONNY MIGUEL JORGE DE SOUZA NEVES','Socioemocional',10.0,10.0,10.0),
  ('ANTHONNY MIGUEL JORGE DE SOUZA NEVES','Leitura',8.7,9.1,4.0),
  ('ANTHONNY MIGUEL JORGE DE SOUZA NEVES','Musicalizacao',10.0,10.0,10.0),
  ('ANTHONNY MIGUEL JORGE DE SOUZA NEVES','Projeto Semear',10.0,10.0,10.0),
  ('ANTHONNY MIGUEL JORGE DE SOUZA NEVES','Portugues',9.5,9.1,3.1),
  ('ANTHONNY MIGUEL JORGE DE SOUZA NEVES','Historia',9.6,9.8,3.3),
  ('ANTHONNY MIGUEL JORGE DE SOUZA NEVES','Geografia',10.0,9.4,3.3),
  ('ANTHONNY MIGUEL JORGE DE SOUZA NEVES','Artes',10.0,10.0,null),
  ('ANTHONNY MIGUEL JORGE DE SOUZA NEVES','Educacao Fisica',10.0,10.0,10.0),
  ('ANTHONNY MIGUEL JORGE DE SOUZA NEVES','Ingles',9.5,10.0,null),
  ('ANTHONNY MIGUEL JORGE DE SOUZA NEVES','Ensino Religioso',10.0,10.0,null),
  ('EDUARDO HENRIQUE BARBOSA SILVA','Ciencias',9.6,9.3,2.8),
  ('EDUARDO HENRIQUE BARBOSA SILVA','Matematica',9.5,9.1,2.5),
  ('EDUARDO HENRIQUE BARBOSA SILVA','Matematica Concreta',10.0,10.0,null),
  ('EDUARDO HENRIQUE BARBOSA SILVA','Socioemocional',10.0,10.0,10.0),
  ('EDUARDO HENRIQUE BARBOSA SILVA','Leitura',10.0,10.0,4.7),
  ('EDUARDO HENRIQUE BARBOSA SILVA','Musicalizacao',10.0,10.0,10.0),
  ('EDUARDO HENRIQUE BARBOSA SILVA','Projeto Semear',10.0,10.0,10.0),
  ('EDUARDO HENRIQUE BARBOSA SILVA','Portugues',9.3,9.7,3.0),
  ('EDUARDO HENRIQUE BARBOSA SILVA','Historia',9.9,9.8,2.7),
  ('EDUARDO HENRIQUE BARBOSA SILVA','Geografia',10.0,9.6,3.3),
  ('EDUARDO HENRIQUE BARBOSA SILVA','Artes',10.0,10.0,null),
  ('EDUARDO HENRIQUE BARBOSA SILVA','Educacao Fisica',10.0,10.0,10.0),
  ('EDUARDO HENRIQUE BARBOSA SILVA','Ingles',9.7,10.0,null),
  ('EDUARDO HENRIQUE BARBOSA SILVA','Ensino Religioso',10.0,10.0,null),
  ('ENZO GABRIEL DE FREITAS COUTO','Ciencias',8.5,7.0,2.3),
  ('ENZO GABRIEL DE FREITAS COUTO','Matematica',8.2,7.8,2.9),
  ('ENZO GABRIEL DE FREITAS COUTO','Matematica Concreta',10.0,10.0,null),
  ('ENZO GABRIEL DE FREITAS COUTO','Socioemocional',10.0,10.0,10.0),
  ('ENZO GABRIEL DE FREITAS COUTO','Leitura',7.0,7.1,3.5),
  ('ENZO GABRIEL DE FREITAS COUTO','Musicalizacao',10.0,10.0,10.0),
  ('ENZO GABRIEL DE FREITAS COUTO','Projeto Semear',10.0,10.0,10.0),
  ('ENZO GABRIEL DE FREITAS COUTO','Portugues',7.9,7.0,1.9),
  ('ENZO GABRIEL DE FREITAS COUTO','Historia',7.4,7.9,2.6),
  ('ENZO GABRIEL DE FREITAS COUTO','Geografia',9.0,7.4,2.8),
  ('ENZO GABRIEL DE FREITAS COUTO','Artes',10.0,10.0,null),
  ('ENZO GABRIEL DE FREITAS COUTO','Educacao Fisica',10.0,10.0,10.0),
  ('ENZO GABRIEL DE FREITAS COUTO','Ingles',9.0,9.0,null),
  ('ENZO GABRIEL DE FREITAS COUTO','Ensino Religioso',10.0,10.0,null),
  ('HELENA ALVES SANTOS','Ciencias',9.8,9.4,3.1),
  ('HELENA ALVES SANTOS','Matematica',9.5,9.0,3.0),
  ('HELENA ALVES SANTOS','Matematica Concreta',10.0,10.0,null),
  ('HELENA ALVES SANTOS','Socioemocional',10.0,10.0,10.0),
  ('HELENA ALVES SANTOS','Leitura',8.7,8.2,4.2),
  ('HELENA ALVES SANTOS','Musicalizacao',10.0,10.0,10.0),
  ('HELENA ALVES SANTOS','Projeto Semear',10.0,10.0,10.0),
  ('HELENA ALVES SANTOS','Portugues',9.3,8.4,2.3),
  ('HELENA ALVES SANTOS','Historia',9.1,9.2,2.9),
  ('HELENA ALVES SANTOS','Geografia',9.7,9.2,3.0),
  ('HELENA ALVES SANTOS','Artes',10.0,10.0,null),
  ('HELENA ALVES SANTOS','Educacao Fisica',10.0,10.0,10.0),
  ('HELENA ALVES SANTOS','Ingles',9.5,9.0,null),
  ('HELENA ALVES SANTOS','Ensino Religioso',10.0,10.0,null),
  ('HELENA GARCIA PASSOS','Ciencias',10.0,9.9,3.3),
  ('HELENA GARCIA PASSOS','Matematica',9.7,10.0,2.6),
  ('HELENA GARCIA PASSOS','Matematica Concreta',10.0,10.0,null),
  ('HELENA GARCIA PASSOS','Socioemocional',10.0,10.0,10.0),
  ('HELENA GARCIA PASSOS','Leitura',10.0,10.0,5.0),
  ('HELENA GARCIA PASSOS','Musicalizacao',10.0,10.0,10.0),
  ('HELENA GARCIA PASSOS','Projeto Semear',10.0,10.0,10.0),
  ('HELENA GARCIA PASSOS','Portugues',9.7,10.0,3.1),
  ('HELENA GARCIA PASSOS','Historia',9.9,10.0,3.3),
  ('HELENA GARCIA PASSOS','Geografia',9.8,10.0,3.3),
  ('HELENA GARCIA PASSOS','Artes',10.0,10.0,null),
  ('HELENA GARCIA PASSOS','Educacao Fisica',10.0,10.0,10.0),
  ('HELENA GARCIA PASSOS','Ingles',9.9,10.0,null),
  ('HELENA GARCIA PASSOS','Ensino Religioso',10.0,10.0,null),
  ('HELOÍSA DE MELO NOLETO','Ciencias',10.0,9.4,3.3),
  ('HELOÍSA DE MELO NOLETO','Matematica',9.8,9.8,3.3),
  ('HELOÍSA DE MELO NOLETO','Matematica Concreta',10.0,10.0,null),
  ('HELOÍSA DE MELO NOLETO','Socioemocional',10.0,10.0,10.0),
  ('HELOÍSA DE MELO NOLETO','Leitura',10.0,9.8,4.7),
  ('HELOÍSA DE MELO NOLETO','Musicalizacao',10.0,10.0,10.0),
  ('HELOÍSA DE MELO NOLETO','Projeto Semear',10.0,10.0,10.0),
  ('HELOÍSA DE MELO NOLETO','Portugues',9.9,9.7,3.2),
  ('HELOÍSA DE MELO NOLETO','Historia',9.2,10.0,3.3),
  ('HELOÍSA DE MELO NOLETO','Geografia',10.0,9.8,3.3),
  ('HELOÍSA DE MELO NOLETO','Artes',10.0,10.0,null),
  ('HELOÍSA DE MELO NOLETO','Educacao Fisica',10.0,10.0,10.0),
  ('HELOÍSA DE MELO NOLETO','Ingles',9.5,10.0,null),
  ('HELOÍSA DE MELO NOLETO','Ensino Religioso',10.0,10.0,null),
  ('HENRIQUE DELMÔNICO CARDOSO MIRANDA','Ciencias',9.9,9.0,3.3),
  ('HENRIQUE DELMÔNICO CARDOSO MIRANDA','Matematica',10.0,9.8,3.1),
  ('HENRIQUE DELMÔNICO CARDOSO MIRANDA','Matematica Concreta',10.0,10.0,null),
  ('HENRIQUE DELMÔNICO CARDOSO MIRANDA','Socioemocional',10.0,10.0,10.0),
  ('HENRIQUE DELMÔNICO CARDOSO MIRANDA','Leitura',9.0,8.1,4.0),
  ('HENRIQUE DELMÔNICO CARDOSO MIRANDA','Musicalizacao',10.0,10.0,10.0),
  ('HENRIQUE DELMÔNICO CARDOSO MIRANDA','Projeto Semear',10.0,10.0,10.0),
  ('HENRIQUE DELMÔNICO CARDOSO MIRANDA','Portugues',10.0,9.8,2.9),
  ('HENRIQUE DELMÔNICO CARDOSO MIRANDA','Historia',10.0,10.0,3.3),
  ('HENRIQUE DELMÔNICO CARDOSO MIRANDA','Geografia',10.0,10.0,3.2),
  ('HENRIQUE DELMÔNICO CARDOSO MIRANDA','Artes',10.0,10.0,null),
  ('HENRIQUE DELMÔNICO CARDOSO MIRANDA','Educacao Fisica',10.0,10.0,10.0),
  ('HENRIQUE DELMÔNICO CARDOSO MIRANDA','Ingles',10.0,10.0,null),
  ('HENRIQUE DELMÔNICO CARDOSO MIRANDA','Ensino Religioso',10.0,10.0,null),
  ('JASMIM OLIVEIRA BERNARDES','Ciencias',8.2,8.9,2.7),
  ('JASMIM OLIVEIRA BERNARDES','Matematica',7.4,7.4,2.0),
  ('JASMIM OLIVEIRA BERNARDES','Matematica Concreta',10.0,10.0,null),
  ('JASMIM OLIVEIRA BERNARDES','Socioemocional',10.0,10.0,10.0),
  ('JASMIM OLIVEIRA BERNARDES','Leitura',6.7,7.0,2.5),
  ('JASMIM OLIVEIRA BERNARDES','Musicalizacao',10.0,10.0,10.0),
  ('JASMIM OLIVEIRA BERNARDES','Projeto Semear',10.0,10.0,10.0),
  ('JASMIM OLIVEIRA BERNARDES','Portugues',8.2,7.7,2.5),
  ('JASMIM OLIVEIRA BERNARDES','Historia',7.8,8.7,2.5),
  ('JASMIM OLIVEIRA BERNARDES','Geografia',8.2,8.0,2.7),
  ('JASMIM OLIVEIRA BERNARDES','Artes',10.0,10.0,null),
  ('JASMIM OLIVEIRA BERNARDES','Educacao Fisica',10.0,10.0,10.0),
  ('JASMIM OLIVEIRA BERNARDES','Ingles',9.0,9.5,null),
  ('JASMIM OLIVEIRA BERNARDES','Ensino Religioso',10.0,10.0,null),
  ('JOÃO FELIPE MAGNO DANTAS FERNANDES','Ciencias',9.2,9.2,3.0),
  ('JOÃO FELIPE MAGNO DANTAS FERNANDES','Matematica',8.9,9.5,2.5),
  ('JOÃO FELIPE MAGNO DANTAS FERNANDES','Matematica Concreta',10.0,10.0,null),
  ('JOÃO FELIPE MAGNO DANTAS FERNANDES','Socioemocional',10.0,10.0,10.0),
  ('JOÃO FELIPE MAGNO DANTAS FERNANDES','Leitura',6.7,7.0,3.5),
  ('JOÃO FELIPE MAGNO DANTAS FERNANDES','Musicalizacao',10.0,10.0,10.0),
  ('JOÃO FELIPE MAGNO DANTAS FERNANDES','Projeto Semear',10.0,10.0,10.0),
  ('JOÃO FELIPE MAGNO DANTAS FERNANDES','Portugues',9.0,9.7,3.0),
  ('JOÃO FELIPE MAGNO DANTAS FERNANDES','Historia',8.5,9.3,2.8),
  ('JOÃO FELIPE MAGNO DANTAS FERNANDES','Geografia',9.0,9.2,3.3),
  ('JOÃO FELIPE MAGNO DANTAS FERNANDES','Artes',10.0,10.0,null),
  ('JOÃO FELIPE MAGNO DANTAS FERNANDES','Educacao Fisica',10.0,10.0,10.0),
  ('JOÃO FELIPE MAGNO DANTAS FERNANDES','Ingles',9.5,9.0,null),
  ('JOÃO FELIPE MAGNO DANTAS FERNANDES','Ensino Religioso',10.0,10.0,null),
  ('JOÃO MIGUEL MARIANO DA CUNHA','Ciencias',9.9,9.5,3.1),
  ('JOÃO MIGUEL MARIANO DA CUNHA','Matematica',9.8,8.3,3.1),
  ('JOÃO MIGUEL MARIANO DA CUNHA','Matematica Concreta',10.0,10.0,null),
  ('JOÃO MIGUEL MARIANO DA CUNHA','Socioemocional',10.0,10.0,10.0),
  ('JOÃO MIGUEL MARIANO DA CUNHA','Leitura',10.0,9.8,4.5),
  ('JOÃO MIGUEL MARIANO DA CUNHA','Musicalizacao',10.0,10.0,10.0),
  ('JOÃO MIGUEL MARIANO DA CUNHA','Projeto Semear',10.0,10.0,10.0),
  ('JOÃO MIGUEL MARIANO DA CUNHA','Portugues',9.8,9.6,3.0),
  ('JOÃO MIGUEL MARIANO DA CUNHA','Historia',9.9,9.4,2.9),
  ('JOÃO MIGUEL MARIANO DA CUNHA','Geografia',9.9,9.6,3.3),
  ('JOÃO MIGUEL MARIANO DA CUNHA','Artes',10.0,10.0,null),
  ('JOÃO MIGUEL MARIANO DA CUNHA','Educacao Fisica',10.0,10.0,10.0),
  ('JOÃO MIGUEL MARIANO DA CUNHA','Ingles',9.5,10.0,null),
  ('JOÃO MIGUEL MARIANO DA CUNHA','Ensino Religioso',10.0,10.0,null),
  ('JÚLIA AMARAL VIEIRA','Ciencias',9.5,8.3,2.7),
  ('JÚLIA AMARAL VIEIRA','Matematica',8.8,8.9,3.0),
  ('JÚLIA AMARAL VIEIRA','Matematica Concreta',10.0,10.0,null),
  ('JÚLIA AMARAL VIEIRA','Socioemocional',10.0,10.0,10.0),
  ('JÚLIA AMARAL VIEIRA','Leitura',7.7,8.0,4.0),
  ('JÚLIA AMARAL VIEIRA','Musicalizacao',10.0,10.0,10.0),
  ('JÚLIA AMARAL VIEIRA','Projeto Semear',10.0,10.0,10.0),
  ('JÚLIA AMARAL VIEIRA','Portugues',8.7,8.6,2.8),
  ('JÚLIA AMARAL VIEIRA','Historia',9.9,9.3,2.4),
  ('JÚLIA AMARAL VIEIRA','Geografia',9.9,9.1,2.9),
  ('JÚLIA AMARAL VIEIRA','Artes',10.0,10.0,null),
  ('JÚLIA AMARAL VIEIRA','Educacao Fisica',10.0,10.0,10.0),
  ('JÚLIA AMARAL VIEIRA','Ingles',9.2,9.0,null),
  ('JÚLIA AMARAL VIEIRA','Ensino Religioso',10.0,10.0,null),
  ('KAUANNE DA COSTA SILVA SIMÕES','Ciencias',9.8,8.4,3.3),
  ('KAUANNE DA COSTA SILVA SIMÕES','Matematica',9.5,9.5,2.8),
  ('KAUANNE DA COSTA SILVA SIMÕES','Matematica Concreta',10.0,10.0,null),
  ('KAUANNE DA COSTA SILVA SIMÕES','Socioemocional',10.0,10.0,10.0),
  ('KAUANNE DA COSTA SILVA SIMÕES','Leitura',10.0,9.6,4.7),
  ('KAUANNE DA COSTA SILVA SIMÕES','Musicalizacao',10.0,10.0,10.0),
  ('KAUANNE DA COSTA SILVA SIMÕES','Projeto Semear',10.0,10.0,10.0),
  ('KAUANNE DA COSTA SILVA SIMÕES','Portugues',9.7,8.3,3.1),
  ('KAUANNE DA COSTA SILVA SIMÕES','Historia',9.6,8.8,3.2),
  ('KAUANNE DA COSTA SILVA SIMÕES','Geografia',10.0,9.9,3.3),
  ('KAUANNE DA COSTA SILVA SIMÕES','Artes',10.0,10.0,null),
  ('KAUANNE DA COSTA SILVA SIMÕES','Educacao Fisica',10.0,10.0,10.0),
  ('KAUANNE DA COSTA SILVA SIMÕES','Ingles',9.5,9.5,null),
  ('KAUANNE DA COSTA SILVA SIMÕES','Ensino Religioso',10.0,10.0,null),
  ('LAVÍNIA TORRES SANTOS','Ciencias',9.9,9.1,3.2),
  ('LAVÍNIA TORRES SANTOS','Matematica',9.8,8.8,3.2),
  ('LAVÍNIA TORRES SANTOS','Matematica Concreta',10.0,10.0,null),
  ('LAVÍNIA TORRES SANTOS','Socioemocional',10.0,10.0,10.0),
  ('LAVÍNIA TORRES SANTOS','Leitura',10.0,10.0,5.0),
  ('LAVÍNIA TORRES SANTOS','Musicalizacao',10.0,10.0,10.0),
  ('LAVÍNIA TORRES SANTOS','Projeto Semear',10.0,10.0,10.0),
  ('LAVÍNIA TORRES SANTOS','Portugues',9.7,9.9,3.1),
  ('LAVÍNIA TORRES SANTOS','Historia',9.9,9.9,2.9),
  ('LAVÍNIA TORRES SANTOS','Geografia',10.0,9.5,3.3),
  ('LAVÍNIA TORRES SANTOS','Artes',10.0,10.0,null),
  ('LAVÍNIA TORRES SANTOS','Educacao Fisica',10.0,10.0,10.0),
  ('LAVÍNIA TORRES SANTOS','Ingles',9.7,10.0,null),
  ('LAVÍNIA TORRES SANTOS','Ensino Religioso',10.0,10.0,null),
  ('MANUELLA LIMA FARIAS','Ciencias',10.0,9.0,3.3),
  ('MANUELLA LIMA FARIAS','Matematica',9.1,9.8,2.9),
  ('MANUELLA LIMA FARIAS','Matematica Concreta',10.0,10.0,null),
  ('MANUELLA LIMA FARIAS','Socioemocional',10.0,10.0,10.0),
  ('MANUELLA LIMA FARIAS','Leitura',10.0,10.0,5.0),
  ('MANUELLA LIMA FARIAS','Musicalizacao',10.0,10.0,10.0),
  ('MANUELLA LIMA FARIAS','Projeto Semear',10.0,10.0,10.0),
  ('MANUELLA LIMA FARIAS','Portugues',9.9,9.8,3.2),
  ('MANUELLA LIMA FARIAS','Historia',9.9,10.0,2.7),
  ('MANUELLA LIMA FARIAS','Geografia',9.9,9.8,3.3),
  ('MANUELLA LIMA FARIAS','Artes',10.0,10.0,null),
  ('MANUELLA LIMA FARIAS','Educacao Fisica',10.0,10.0,10.0),
  ('MANUELLA LIMA FARIAS','Ingles',9.5,10.0,null),
  ('MANUELLA LIMA FARIAS','Ensino Religioso',10.0,10.0,null),
  ('MARIANA COELHO FELICIANO','Ciencias',9.9,9.2,3.1),
  ('MARIANA COELHO FELICIANO','Matematica',9.8,8.9,3.3),
  ('MARIANA COELHO FELICIANO','Matematica Concreta',10.0,10.0,null),
  ('MARIANA COELHO FELICIANO','Socioemocional',10.0,10.0,10.0),
  ('MARIANA COELHO FELICIANO','Leitura',10.0,10.0,4.7),
  ('MARIANA COELHO FELICIANO','Musicalizacao',10.0,10.0,10.0),
  ('MARIANA COELHO FELICIANO','Projeto Semear',10.0,10.0,10.0),
  ('MARIANA COELHO FELICIANO','Portugues',9.4,9.6,3.0),
  ('MARIANA COELHO FELICIANO','Historia',9.9,9.8,2.8),
  ('MARIANA COELHO FELICIANO','Geografia',9.5,9.8,3.3),
  ('MARIANA COELHO FELICIANO','Artes',10.0,10.0,null),
  ('MARIANA COELHO FELICIANO','Educacao Fisica',10.0,10.0,10.0),
  ('MARIANA COELHO FELICIANO','Ingles',9.6,10.0,null),
  ('MARIANA COELHO FELICIANO','Ensino Religioso',10.0,10.0,null),
  ('MIRELLA MULLER BUENO','Ciencias',9.7,9.1,3.0),
  ('MIRELLA MULLER BUENO','Matematica',9.2,9.2,2.9),
  ('MIRELLA MULLER BUENO','Matematica Concreta',10.0,10.0,null),
  ('MIRELLA MULLER BUENO','Socioemocional',10.0,10.0,10.0),
  ('MIRELLA MULLER BUENO','Leitura',9.5,10.0,4.2),
  ('MIRELLA MULLER BUENO','Musicalizacao',10.0,10.0,10.0),
  ('MIRELLA MULLER BUENO','Projeto Semear',10.0,10.0,10.0),
  ('MIRELLA MULLER BUENO','Portugues',9.7,8.7,3.0),
  ('MIRELLA MULLER BUENO','Historia',9.7,9.6,2.9),
  ('MIRELLA MULLER BUENO','Geografia',9.8,9.4,3.2),
  ('MIRELLA MULLER BUENO','Artes',10.0,10.0,null),
  ('MIRELLA MULLER BUENO','Educacao Fisica',10.0,10.0,10.0),
  ('MIRELLA MULLER BUENO','Ingles',9.0,9.5,null),
  ('MIRELLA MULLER BUENO','Ensino Religioso',10.0,10.0,null),
  ('MISAEL SENA MENEZES','Ciencias',9.8,8.6,3.3),
  ('MISAEL SENA MENEZES','Matematica',9.7,9.8,3.2),
  ('MISAEL SENA MENEZES','Matematica Concreta',10.0,10.0,null),
  ('MISAEL SENA MENEZES','Socioemocional',10.0,10.0,10.0),
  ('MISAEL SENA MENEZES','Leitura',10.0,9.6,4.5),
  ('MISAEL SENA MENEZES','Musicalizacao',10.0,10.0,10.0),
  ('MISAEL SENA MENEZES','Projeto Semear',10.0,10.0,10.0),
  ('MISAEL SENA MENEZES','Portugues',9.5,9.8,3.2),
  ('MISAEL SENA MENEZES','Historia',9.9,9.4,3.3),
  ('MISAEL SENA MENEZES','Geografia',9.4,9.5,3.2),
  ('MISAEL SENA MENEZES','Artes',10.0,10.0,null),
  ('MISAEL SENA MENEZES','Educacao Fisica',10.0,10.0,10.0),
  ('MISAEL SENA MENEZES','Ingles',9.1,10.0,null),
  ('MISAEL SENA MENEZES','Ensino Religioso',10.0,10.0,null),
  ('NICOLE EMANUELLY RODRIGUES SANTOS','Ciencias',9.9,9.3,3.1),
  ('NICOLE EMANUELLY RODRIGUES SANTOS','Matematica',9.8,9.4,3.2),
  ('NICOLE EMANUELLY RODRIGUES SANTOS','Matematica Concreta',10.0,10.0,null),
  ('NICOLE EMANUELLY RODRIGUES SANTOS','Socioemocional',10.0,10.0,10.0),
  ('NICOLE EMANUELLY RODRIGUES SANTOS','Leitura',10.0,10.0,5.0),
  ('NICOLE EMANUELLY RODRIGUES SANTOS','Musicalizacao',10.0,10.0,10.0),
  ('NICOLE EMANUELLY RODRIGUES SANTOS','Projeto Semear',10.0,10.0,10.0),
  ('NICOLE EMANUELLY RODRIGUES SANTOS','Portugues',10.0,10.0,3.2),
  ('NICOLE EMANUELLY RODRIGUES SANTOS','Historia',9.9,9.9,3.2),
  ('NICOLE EMANUELLY RODRIGUES SANTOS','Geografia',10.0,10.0,3.3),
  ('NICOLE EMANUELLY RODRIGUES SANTOS','Artes',10.0,10.0,null),
  ('NICOLE EMANUELLY RODRIGUES SANTOS','Educacao Fisica',10.0,10.0,10.0),
  ('NICOLE EMANUELLY RODRIGUES SANTOS','Ingles',9.2,10.0,null),
  ('NICOLE EMANUELLY RODRIGUES SANTOS','Ensino Religioso',10.0,10.0,null),
  ('ROMEO OLIVEIRA ALVES DE AGUIAR','Ciencias',9.9,9.7,2.8),
  ('ROMEO OLIVEIRA ALVES DE AGUIAR','Matematica',10.0,9.5,3.2),
  ('ROMEO OLIVEIRA ALVES DE AGUIAR','Matematica Concreta',10.0,10.0,null),
  ('ROMEO OLIVEIRA ALVES DE AGUIAR','Socioemocional',10.0,10.0,10.0),
  ('ROMEO OLIVEIRA ALVES DE AGUIAR','Leitura',9.7,10.0,4.5),
  ('ROMEO OLIVEIRA ALVES DE AGUIAR','Musicalizacao',10.0,10.0,10.0),
  ('ROMEO OLIVEIRA ALVES DE AGUIAR','Projeto Semear',10.0,10.0,10.0),
  ('ROMEO OLIVEIRA ALVES DE AGUIAR','Portugues',9.9,9.9,3.3),
  ('ROMEO OLIVEIRA ALVES DE AGUIAR','Historia',9.9,9.7,3.3),
  ('ROMEO OLIVEIRA ALVES DE AGUIAR','Geografia',10.0,9.8,3.2),
  ('ROMEO OLIVEIRA ALVES DE AGUIAR','Artes',10.0,10.0,null),
  ('ROMEO OLIVEIRA ALVES DE AGUIAR','Educacao Fisica',10.0,10.0,10.0),
  ('ROMEO OLIVEIRA ALVES DE AGUIAR','Ingles',9.3,9.8,null),
  ('ROMEO OLIVEIRA ALVES DE AGUIAR','Ensino Religioso',10.0,10.0,null),
  ('SARA VIEIRA DE CARVALHO JORGE','Ciencias',8.7,7.8,3.0),
  ('SARA VIEIRA DE CARVALHO JORGE','Matematica',7.7,7.5,2.5),
  ('SARA VIEIRA DE CARVALHO JORGE','Matematica Concreta',10.0,10.0,null),
  ('SARA VIEIRA DE CARVALHO JORGE','Socioemocional',10.0,10.0,10.0),
  ('SARA VIEIRA DE CARVALHO JORGE','Leitura',7.0,7.0,3.5),
  ('SARA VIEIRA DE CARVALHO JORGE','Musicalizacao',10.0,10.0,10.0),
  ('SARA VIEIRA DE CARVALHO JORGE','Projeto Semear',10.0,10.0,10.0),
  ('SARA VIEIRA DE CARVALHO JORGE','Portugues',7.9,8.8,2.9),
  ('SARA VIEIRA DE CARVALHO JORGE','Historia',8.4,7.7,2.7),
  ('SARA VIEIRA DE CARVALHO JORGE','Geografia',8.8,7.8,2.9),
  ('SARA VIEIRA DE CARVALHO JORGE','Artes',10.0,10.0,null),
  ('SARA VIEIRA DE CARVALHO JORGE','Educacao Fisica',10.0,10.0,10.0),
  ('SARA VIEIRA DE CARVALHO JORGE','Ingles',8.7,9.5,null),
  ('SARA VIEIRA DE CARVALHO JORGE','Ensino Religioso',10.0,10.0,null);

create temp table stg_turma_alvo_2a (turma_id uuid) on commit drop;

insert into stg_turma_alvo_2a (turma_id)
select m.turma_id
from stg_boletim_2ano_a s
join alunos al on upper(al.nome) = upper(s.aluno_nome)
join matriculas m on m.aluno_id = al.id and m.ano_letivo = 2026
group by m.turma_id
order by count(*) desc
limit 1;

do $$
begin
  if (select count(*) from stg_turma_alvo_2a) <> 1 then
    raise exception 'nao foi possivel resolver uma unica turma para os alunos do boletim (2o ANO A)';
  end if;
end $$;

-- Avaliacao sintetica por disciplina x bimestre (idempotente), so pros bimestres com nota
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
from stg_boletim_2ano_a s
join disciplinas d on d.serie_id = 'c36d3af8-c910-4e1a-90f3-231f0f7bbc2a' and d.nome = s.disciplina
cross join stg_turma_alvo_2a t
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
from stg_boletim_2ano_a s
join alunos al on upper(al.nome) = upper(s.aluno_nome)
cross join stg_turma_alvo_2a t
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
from stg_boletim_2ano_a s
join alunos al on upper(al.nome) = upper(s.aluno_nome)
cross join stg_turma_alvo_2a t
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
from stg_boletim_2ano_a s
join alunos al on upper(al.nome) = upper(s.aluno_nome)
cross join stg_turma_alvo_2a t
join matriculas m on m.aluno_id = al.id and m.ano_letivo = 2026 and m.turma_id = t.turma_id
join disciplinas d on d.serie_id = 'c36d3af8-c910-4e1a-90f3-231f0f7bbc2a' and d.nome = s.disciplina
join avaliacoes a on a.turma_id = t.turma_id and a.disciplina_id = d.id
  and a.bimestre = 3 and a.ano_letivo = 2026 and a.titulo = 'Media Bimestral'
where s.b3 is not null
on conflict (avaliacao_id, aluno_id) do update set valor = excluded.valor;
