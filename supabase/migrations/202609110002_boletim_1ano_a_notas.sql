-- Importa notas do boletim (1o e 2o bimestre 2026) da turma 1o ANO A - Matutino.
-- Boletim traz media bimestral (MB) direto, sem avaliacoes individuais, entao
-- cada disciplina x bimestre vira uma avaliacao sintetica "Media Bimestral" (peso 1)
-- e a nota do aluno = MB do boletim.
-- Fonte: Resultado - 1 ANO.pdf (1o ANO A - Matutino, ano letivo 2026).
-- Turma resolvida dinamicamente pela matricula 2026 dos alunos do boletim (turma_id
-- nao e' o mesmo entre ambientes local/prod).

-- 1. Disciplinas do 1o ANO que ainda nao existiam no seed padrao
insert into disciplinas (escola_id, serie_id, nome, ordem)
select '00000000-0000-0000-0000-000000000001'::uuid, '9e357537-e277-4bc1-a205-60c56055f5c7'::uuid, nome, ordem
from (values
  ('Matematica Concreta', 8),
  ('Socioemocional', 9),
  ('Musicalizacao', 10),
  ('Leitura', 11),
  ('Projeto Semear', 12),
  ('Ensino Religioso', 13)
) as novas(nome, ordem)
on conflict (escola_id, serie_id, nome) do nothing;

-- 2. Dados do boletim: aluno x disciplina x media do 1o e 2o bimestre
create temp table stg_boletim_1ano_a (
  aluno_nome text,
  disciplina text,
  b1 numeric(5,2),
  b2 numeric(5,2)
) on commit drop;

insert into stg_boletim_1ano_a (aluno_nome, disciplina, b1, b2) values
  ('ANA LAURA VAZ DE AZEVEDO AQUINO','Ciencias',10.0,10.0),
  ('ANA LAURA VAZ DE AZEVEDO AQUINO','Matematica',10.0,10.0),
  ('ANA LAURA VAZ DE AZEVEDO AQUINO','Matematica Concreta',10.0,10.0),
  ('ANA LAURA VAZ DE AZEVEDO AQUINO','Socioemocional',10.0,10.0),
  ('ANA LAURA VAZ DE AZEVEDO AQUINO','Musicalizacao',10.0,10.0),
  ('ANA LAURA VAZ DE AZEVEDO AQUINO','Leitura',10.0,10.0),
  ('ANA LAURA VAZ DE AZEVEDO AQUINO','Projeto Semear',10.0,10.0),
  ('ANA LAURA VAZ DE AZEVEDO AQUINO','Portugues',10.0,10.0),
  ('ANA LAURA VAZ DE AZEVEDO AQUINO','Historia',10.0,9.8),
  ('ANA LAURA VAZ DE AZEVEDO AQUINO','Geografia',10.0,10.0),
  ('ANA LAURA VAZ DE AZEVEDO AQUINO','Artes',10.0,10.0),
  ('ANA LAURA VAZ DE AZEVEDO AQUINO','Educacao Fisica',10.0,10.0),
  ('ANA LAURA VAZ DE AZEVEDO AQUINO','Ingles',9.9,10.0),
  ('ANA LAURA VAZ DE AZEVEDO AQUINO','Ensino Religioso',10.0,10.0),
  ('ANA LUÍZA VIEIRA DA FONSECA','Ciencias',10.0,10.0),
  ('ANA LUÍZA VIEIRA DA FONSECA','Matematica',10.0,9.9),
  ('ANA LUÍZA VIEIRA DA FONSECA','Matematica Concreta',10.0,10.0),
  ('ANA LUÍZA VIEIRA DA FONSECA','Socioemocional',10.0,10.0),
  ('ANA LUÍZA VIEIRA DA FONSECA','Musicalizacao',10.0,10.0),
  ('ANA LUÍZA VIEIRA DA FONSECA','Leitura',10.0,8.7),
  ('ANA LUÍZA VIEIRA DA FONSECA','Projeto Semear',10.0,10.0),
  ('ANA LUÍZA VIEIRA DA FONSECA','Portugues',10.0,9.9),
  ('ANA LUÍZA VIEIRA DA FONSECA','Historia',10.0,10.0),
  ('ANA LUÍZA VIEIRA DA FONSECA','Geografia',10.0,10.0),
  ('ANA LUÍZA VIEIRA DA FONSECA','Artes',10.0,10.0),
  ('ANA LUÍZA VIEIRA DA FONSECA','Educacao Fisica',10.0,10.0),
  ('ANA LUÍZA VIEIRA DA FONSECA','Ingles',9.7,10.0),
  ('ANA LUÍZA VIEIRA DA FONSECA','Ensino Religioso',10.0,10.0),
  ('ANTONELA ANDRADE MONTEIRO','Ciencias',10.0,10.0),
  ('ANTONELA ANDRADE MONTEIRO','Matematica',10.0,10.0),
  ('ANTONELA ANDRADE MONTEIRO','Matematica Concreta',10.0,10.0),
  ('ANTONELA ANDRADE MONTEIRO','Socioemocional',10.0,10.0),
  ('ANTONELA ANDRADE MONTEIRO','Musicalizacao',10.0,10.0),
  ('ANTONELA ANDRADE MONTEIRO','Leitura',10.0,10.0),
  ('ANTONELA ANDRADE MONTEIRO','Projeto Semear',10.0,10.0),
  ('ANTONELA ANDRADE MONTEIRO','Portugues',10.0,10.0),
  ('ANTONELA ANDRADE MONTEIRO','Historia',10.0,10.0),
  ('ANTONELA ANDRADE MONTEIRO','Geografia',10.0,10.0),
  ('ANTONELA ANDRADE MONTEIRO','Artes',10.0,10.0),
  ('ANTONELA ANDRADE MONTEIRO','Educacao Fisica',10.0,10.0),
  ('ANTONELA ANDRADE MONTEIRO','Ingles',10.0,10.0),
  ('ANTONELA ANDRADE MONTEIRO','Ensino Religioso',10.0,10.0),
  ('ARTHUR BARBOSA FLEURY','Ciencias',8.8,7.9),
  ('ARTHUR BARBOSA FLEURY','Matematica',8.6,8.1),
  ('ARTHUR BARBOSA FLEURY','Matematica Concreta',10.0,10.0),
  ('ARTHUR BARBOSA FLEURY','Socioemocional',10.0,10.0),
  ('ARTHUR BARBOSA FLEURY','Musicalizacao',10.0,10.0),
  ('ARTHUR BARBOSA FLEURY','Leitura',10.0,10.0),
  ('ARTHUR BARBOSA FLEURY','Projeto Semear',10.0,10.0),
  ('ARTHUR BARBOSA FLEURY','Portugues',8.8,8.6),
  ('ARTHUR BARBOSA FLEURY','Historia',8.4,8.5),
  ('ARTHUR BARBOSA FLEURY','Geografia',8.7,8.1),
  ('ARTHUR BARBOSA FLEURY','Artes',8.0,7.0),
  ('ARTHUR BARBOSA FLEURY','Educacao Fisica',10.0,10.0),
  ('ARTHUR BARBOSA FLEURY','Ingles',9.0,9.5),
  ('ARTHUR BARBOSA FLEURY','Ensino Religioso',10.0,10.0),
  ('ARYELLA CIPRIANO RODRIGUES OLIVEIRA','Ciencias',10.0,10.0),
  ('ARYELLA CIPRIANO RODRIGUES OLIVEIRA','Matematica',10.0,9.8),
  ('ARYELLA CIPRIANO RODRIGUES OLIVEIRA','Matematica Concreta',10.0,10.0),
  ('ARYELLA CIPRIANO RODRIGUES OLIVEIRA','Socioemocional',10.0,10.0),
  ('ARYELLA CIPRIANO RODRIGUES OLIVEIRA','Musicalizacao',10.0,10.0),
  ('ARYELLA CIPRIANO RODRIGUES OLIVEIRA','Leitura',10.0,10.0),
  ('ARYELLA CIPRIANO RODRIGUES OLIVEIRA','Projeto Semear',10.0,10.0),
  ('ARYELLA CIPRIANO RODRIGUES OLIVEIRA','Portugues',10.0,10.0),
  ('ARYELLA CIPRIANO RODRIGUES OLIVEIRA','Historia',10.0,10.0),
  ('ARYELLA CIPRIANO RODRIGUES OLIVEIRA','Geografia',10.0,10.0),
  ('ARYELLA CIPRIANO RODRIGUES OLIVEIRA','Artes',10.0,10.0),
  ('ARYELLA CIPRIANO RODRIGUES OLIVEIRA','Educacao Fisica',10.0,10.0),
  ('ARYELLA CIPRIANO RODRIGUES OLIVEIRA','Ingles',9.2,10.0),
  ('ARYELLA CIPRIANO RODRIGUES OLIVEIRA','Ensino Religioso',10.0,10.0),
  ('BÁRBARA LAUFER CARDOSO','Ciencias',10.0,10.0),
  ('BÁRBARA LAUFER CARDOSO','Matematica',10.0,10.0),
  ('BÁRBARA LAUFER CARDOSO','Matematica Concreta',10.0,10.0),
  ('BÁRBARA LAUFER CARDOSO','Socioemocional',10.0,10.0),
  ('BÁRBARA LAUFER CARDOSO','Musicalizacao',10.0,10.0),
  ('BÁRBARA LAUFER CARDOSO','Leitura',10.0,10.0),
  ('BÁRBARA LAUFER CARDOSO','Projeto Semear',10.0,10.0),
  ('BÁRBARA LAUFER CARDOSO','Portugues',10.0,10.0),
  ('BÁRBARA LAUFER CARDOSO','Historia',10.0,10.0),
  ('BÁRBARA LAUFER CARDOSO','Geografia',10.0,10.0),
  ('BÁRBARA LAUFER CARDOSO','Artes',10.0,10.0),
  ('BÁRBARA LAUFER CARDOSO','Educacao Fisica',10.0,10.0),
  ('BÁRBARA LAUFER CARDOSO','Ingles',9.4,10.0),
  ('BÁRBARA LAUFER CARDOSO','Ensino Religioso',10.0,10.0),
  ('EDIVAL DE OLIVEIRA FARIA NETO','Ciencias',9.4,8.8),
  ('EDIVAL DE OLIVEIRA FARIA NETO','Matematica',8.7,8.1),
  ('EDIVAL DE OLIVEIRA FARIA NETO','Matematica Concreta',10.0,10.0),
  ('EDIVAL DE OLIVEIRA FARIA NETO','Socioemocional',10.0,10.0),
  ('EDIVAL DE OLIVEIRA FARIA NETO','Musicalizacao',10.0,10.0),
  ('EDIVAL DE OLIVEIRA FARIA NETO','Leitura',5.5,4.5),
  ('EDIVAL DE OLIVEIRA FARIA NETO','Projeto Semear',10.0,10.0),
  ('EDIVAL DE OLIVEIRA FARIA NETO','Portugues',8.3,5.8),
  ('EDIVAL DE OLIVEIRA FARIA NETO','Historia',8.9,8.6),
  ('EDIVAL DE OLIVEIRA FARIA NETO','Geografia',9.3,8.4),
  ('EDIVAL DE OLIVEIRA FARIA NETO','Artes',9.0,10.0),
  ('EDIVAL DE OLIVEIRA FARIA NETO','Educacao Fisica',10.0,10.0),
  ('EDIVAL DE OLIVEIRA FARIA NETO','Ingles',9.5,9.5),
  ('EDIVAL DE OLIVEIRA FARIA NETO','Ensino Religioso',10.0,10.0),
  ('EDUARDA CAMPOS AGUIAR','Ciencias',9.6,8.6),
  ('EDUARDA CAMPOS AGUIAR','Matematica',9.6,8.5),
  ('EDUARDA CAMPOS AGUIAR','Matematica Concreta',10.0,10.0),
  ('EDUARDA CAMPOS AGUIAR','Socioemocional',10.0,10.0),
  ('EDUARDA CAMPOS AGUIAR','Musicalizacao',10.0,10.0),
  ('EDUARDA CAMPOS AGUIAR','Leitura',9.0,7.0),
  ('EDUARDA CAMPOS AGUIAR','Projeto Semear',10.0,10.0),
  ('EDUARDA CAMPOS AGUIAR','Portugues',9.1,8.3),
  ('EDUARDA CAMPOS AGUIAR','Historia',9.5,9.5),
  ('EDUARDA CAMPOS AGUIAR','Geografia',9.5,9.1),
  ('EDUARDA CAMPOS AGUIAR','Artes',10.0,10.0),
  ('EDUARDA CAMPOS AGUIAR','Educacao Fisica',10.0,10.0),
  ('EDUARDA CAMPOS AGUIAR','Ingles',9.5,9.7),
  ('EDUARDA CAMPOS AGUIAR','Ensino Religioso',10.0,10.0),
  ('EDUARDA CASSIMIRO SOUZA RIBEIRO','Ciencias',10.0,10.0),
  ('EDUARDA CASSIMIRO SOUZA RIBEIRO','Matematica',10.0,10.0),
  ('EDUARDA CASSIMIRO SOUZA RIBEIRO','Matematica Concreta',10.0,10.0),
  ('EDUARDA CASSIMIRO SOUZA RIBEIRO','Socioemocional',10.0,10.0),
  ('EDUARDA CASSIMIRO SOUZA RIBEIRO','Musicalizacao',10.0,10.0),
  ('EDUARDA CASSIMIRO SOUZA RIBEIRO','Leitura',10.0,10.0),
  ('EDUARDA CASSIMIRO SOUZA RIBEIRO','Projeto Semear',10.0,10.0),
  ('EDUARDA CASSIMIRO SOUZA RIBEIRO','Portugues',10.0,10.0),
  ('EDUARDA CASSIMIRO SOUZA RIBEIRO','Historia',10.0,10.0),
  ('EDUARDA CASSIMIRO SOUZA RIBEIRO','Geografia',10.0,10.0),
  ('EDUARDA CASSIMIRO SOUZA RIBEIRO','Artes',10.0,10.0),
  ('EDUARDA CASSIMIRO SOUZA RIBEIRO','Educacao Fisica',10.0,10.0),
  ('EDUARDA CASSIMIRO SOUZA RIBEIRO','Ingles',10.0,10.0),
  ('EDUARDA CASSIMIRO SOUZA RIBEIRO','Ensino Religioso',10.0,10.0),
  ('ELISA DIAS AZEVEDO','Ciencias',10.0,10.0),
  ('ELISA DIAS AZEVEDO','Matematica',10.0,10.0),
  ('ELISA DIAS AZEVEDO','Matematica Concreta',10.0,10.0),
  ('ELISA DIAS AZEVEDO','Socioemocional',10.0,10.0),
  ('ELISA DIAS AZEVEDO','Musicalizacao',10.0,10.0),
  ('ELISA DIAS AZEVEDO','Leitura',10.0,10.0),
  ('ELISA DIAS AZEVEDO','Projeto Semear',10.0,10.0),
  ('ELISA DIAS AZEVEDO','Portugues',10.0,9.9),
  ('ELISA DIAS AZEVEDO','Historia',10.0,10.0),
  ('ELISA DIAS AZEVEDO','Geografia',10.0,10.0),
  ('ELISA DIAS AZEVEDO','Artes',10.0,10.0),
  ('ELISA DIAS AZEVEDO','Educacao Fisica',10.0,10.0),
  ('ELISA DIAS AZEVEDO','Ingles',9.2,10.0),
  ('ELISA DIAS AZEVEDO','Ensino Religioso',10.0,10.0),
  ('EMANUELE DA SILVA BORGES','Ciencias',8.3,7.0),
  ('EMANUELE DA SILVA BORGES','Matematica',8.2,6.7),
  ('EMANUELE DA SILVA BORGES','Matematica Concreta',10.0,10.0),
  ('EMANUELE DA SILVA BORGES','Socioemocional',10.0,10.0),
  ('EMANUELE DA SILVA BORGES','Musicalizacao',10.0,10.0),
  ('EMANUELE DA SILVA BORGES','Leitura',6.0,4.0),
  ('EMANUELE DA SILVA BORGES','Projeto Semear',10.0,10.0),
  ('EMANUELE DA SILVA BORGES','Portugues',8.4,4.1),
  ('EMANUELE DA SILVA BORGES','Historia',8.7,7.1),
  ('EMANUELE DA SILVA BORGES','Geografia',8.8,7.0),
  ('EMANUELE DA SILVA BORGES','Artes',10.0,10.0),
  ('EMANUELE DA SILVA BORGES','Educacao Fisica',10.0,10.0),
  ('EMANUELE DA SILVA BORGES','Ingles',9.0,9.5),
  ('EMANUELE DA SILVA BORGES','Ensino Religioso',10.0,10.0),
  ('ESTER VIEIRA DE CARVALHO JORGE','Ciencias',8.7,9.0),
  ('ESTER VIEIRA DE CARVALHO JORGE','Matematica',9.0,8.0),
  ('ESTER VIEIRA DE CARVALHO JORGE','Matematica Concreta',10.0,10.0),
  ('ESTER VIEIRA DE CARVALHO JORGE','Socioemocional',10.0,10.0),
  ('ESTER VIEIRA DE CARVALHO JORGE','Musicalizacao',10.0,10.0),
  ('ESTER VIEIRA DE CARVALHO JORGE','Leitura',8.2,8.2),
  ('ESTER VIEIRA DE CARVALHO JORGE','Projeto Semear',10.0,10.0),
  ('ESTER VIEIRA DE CARVALHO JORGE','Portugues',8.5,8.4),
  ('ESTER VIEIRA DE CARVALHO JORGE','Historia',9.1,8.7),
  ('ESTER VIEIRA DE CARVALHO JORGE','Geografia',8.8,8.6),
  ('ESTER VIEIRA DE CARVALHO JORGE','Artes',10.0,10.0),
  ('ESTER VIEIRA DE CARVALHO JORGE','Educacao Fisica',10.0,10.0),
  ('ESTER VIEIRA DE CARVALHO JORGE','Ingles',9.0,10.0),
  ('ESTER VIEIRA DE CARVALHO JORGE','Ensino Religioso',10.0,10.0),
  ('HELOÍSA PEREIRA BARROS','Ciencias',8.6,9.1),
  ('HELOÍSA PEREIRA BARROS','Matematica',8.8,8.0),
  ('HELOÍSA PEREIRA BARROS','Matematica Concreta',10.0,10.0),
  ('HELOÍSA PEREIRA BARROS','Socioemocional',10.0,10.0),
  ('HELOÍSA PEREIRA BARROS','Musicalizacao',10.0,10.0),
  ('HELOÍSA PEREIRA BARROS','Leitura',5.5,4.5),
  ('HELOÍSA PEREIRA BARROS','Projeto Semear',10.0,10.0),
  ('HELOÍSA PEREIRA BARROS','Portugues',8.5,6.7),
  ('HELOÍSA PEREIRA BARROS','Historia',9.0,8.8),
  ('HELOÍSA PEREIRA BARROS','Geografia',9.5,8.6),
  ('HELOÍSA PEREIRA BARROS','Artes',10.0,10.0),
  ('HELOÍSA PEREIRA BARROS','Educacao Fisica',10.0,10.0),
  ('HELOÍSA PEREIRA BARROS','Ingles',9.5,9.5),
  ('HELOÍSA PEREIRA BARROS','Ensino Religioso',10.0,10.0),
  ('LIS FERREIRA LINKE','Ciencias',9.1,8.1),
  ('LIS FERREIRA LINKE','Matematica',9.1,8.1),
  ('LIS FERREIRA LINKE','Matematica Concreta',10.0,10.0),
  ('LIS FERREIRA LINKE','Socioemocional',10.0,10.0),
  ('LIS FERREIRA LINKE','Musicalizacao',10.0,10.0),
  ('LIS FERREIRA LINKE','Leitura',7.5,8.5),
  ('LIS FERREIRA LINKE','Projeto Semear',10.0,10.0),
  ('LIS FERREIRA LINKE','Portugues',9.1,9.1),
  ('LIS FERREIRA LINKE','Historia',9.0,8.5),
  ('LIS FERREIRA LINKE','Geografia',9.1,8.5),
  ('LIS FERREIRA LINKE','Artes',10.0,10.0),
  ('LIS FERREIRA LINKE','Educacao Fisica',10.0,10.0),
  ('LIS FERREIRA LINKE','Ingles',9.5,10.0),
  ('LIS FERREIRA LINKE','Ensino Religioso',10.0,10.0),
  ('MARIA ALICE GONÇALVES MENDES POTENCIANO','Ciencias',10.0,10.0),
  ('MARIA ALICE GONÇALVES MENDES POTENCIANO','Matematica',10.0,10.0),
  ('MARIA ALICE GONÇALVES MENDES POTENCIANO','Matematica Concreta',10.0,10.0),
  ('MARIA ALICE GONÇALVES MENDES POTENCIANO','Socioemocional',10.0,10.0),
  ('MARIA ALICE GONÇALVES MENDES POTENCIANO','Musicalizacao',10.0,10.0),
  ('MARIA ALICE GONÇALVES MENDES POTENCIANO','Leitura',10.0,10.0),
  ('MARIA ALICE GONÇALVES MENDES POTENCIANO','Projeto Semear',10.0,10.0),
  ('MARIA ALICE GONÇALVES MENDES POTENCIANO','Portugues',10.0,10.0),
  ('MARIA ALICE GONÇALVES MENDES POTENCIANO','Historia',10.0,10.0),
  ('MARIA ALICE GONÇALVES MENDES POTENCIANO','Geografia',10.0,10.0),
  ('MARIA ALICE GONÇALVES MENDES POTENCIANO','Artes',10.0,10.0),
  ('MARIA ALICE GONÇALVES MENDES POTENCIANO','Educacao Fisica',10.0,10.0),
  ('MARIA ALICE GONÇALVES MENDES POTENCIANO','Ingles',10.0,10.0),
  ('MARIA ALICE GONÇALVES MENDES POTENCIANO','Ensino Religioso',10.0,10.0),
  ('MARIANA SOUZA MENDES DIAS','Ciencias',9.4,9.6),
  ('MARIANA SOUZA MENDES DIAS','Matematica',9.6,9.6),
  ('MARIANA SOUZA MENDES DIAS','Matematica Concreta',10.0,10.0),
  ('MARIANA SOUZA MENDES DIAS','Socioemocional',10.0,10.0),
  ('MARIANA SOUZA MENDES DIAS','Musicalizacao',10.0,10.0),
  ('MARIANA SOUZA MENDES DIAS','Leitura',10.0,10.0),
  ('MARIANA SOUZA MENDES DIAS','Projeto Semear',10.0,10.0),
  ('MARIANA SOUZA MENDES DIAS','Portugues',9.6,9.8),
  ('MARIANA SOUZA MENDES DIAS','Historia',9.6,9.6),
  ('MARIANA SOUZA MENDES DIAS','Geografia',9.6,9.6),
  ('MARIANA SOUZA MENDES DIAS','Artes',10.0,10.0),
  ('MARIANA SOUZA MENDES DIAS','Educacao Fisica',10.0,10.0),
  ('MARIANA SOUZA MENDES DIAS','Ingles',9.2,10.0),
  ('MARIANA SOUZA MENDES DIAS','Ensino Religioso',10.0,10.0),
  ('MATEUS DE PAIVA VIANA','Ciencias',9.2,9.0),
  ('MATEUS DE PAIVA VIANA','Matematica',9.3,7.7),
  ('MATEUS DE PAIVA VIANA','Matematica Concreta',10.0,10.0),
  ('MATEUS DE PAIVA VIANA','Socioemocional',10.0,10.0),
  ('MATEUS DE PAIVA VIANA','Musicalizacao',10.0,10.0),
  ('MATEUS DE PAIVA VIANA','Leitura',9.5,10.0),
  ('MATEUS DE PAIVA VIANA','Projeto Semear',10.0,10.0),
  ('MATEUS DE PAIVA VIANA','Portugues',8.9,8.7),
  ('MATEUS DE PAIVA VIANA','Historia',9.3,8.7),
  ('MATEUS DE PAIVA VIANA','Geografia',9.3,9.0),
  ('MATEUS DE PAIVA VIANA','Artes',10.0,10.0),
  ('MATEUS DE PAIVA VIANA','Educacao Fisica',10.0,10.0),
  ('MATEUS DE PAIVA VIANA','Ingles',9.2,9.8),
  ('MATEUS DE PAIVA VIANA','Ensino Religioso',10.0,10.0),
  ('RENATO NUNES HANN','Ciencias',10.0,9.5),
  ('RENATO NUNES HANN','Matematica',10.0,9.3),
  ('RENATO NUNES HANN','Matematica Concreta',10.0,10.0),
  ('RENATO NUNES HANN','Socioemocional',10.0,10.0),
  ('RENATO NUNES HANN','Musicalizacao',10.0,10.0),
  ('RENATO NUNES HANN','Leitura',10.0,10.0),
  ('RENATO NUNES HANN','Projeto Semear',10.0,10.0),
  ('RENATO NUNES HANN','Portugues',10.0,9.5),
  ('RENATO NUNES HANN','Historia',10.0,9.3),
  ('RENATO NUNES HANN','Geografia',10.0,9.3),
  ('RENATO NUNES HANN','Artes',10.0,10.0),
  ('RENATO NUNES HANN','Educacao Fisica',10.0,10.0),
  ('RENATO NUNES HANN','Ingles',9.3,9.8),
  ('RENATO NUNES HANN','Ensino Religioso',10.0,10.0),
  ('SOFIA RODRIGUES DA CUNHA','Ciencias',9.7,9.8),
  ('SOFIA RODRIGUES DA CUNHA','Matematica',9.6,9.4),
  ('SOFIA RODRIGUES DA CUNHA','Matematica Concreta',10.0,10.0),
  ('SOFIA RODRIGUES DA CUNHA','Socioemocional',10.0,10.0),
  ('SOFIA RODRIGUES DA CUNHA','Musicalizacao',10.0,10.0),
  ('SOFIA RODRIGUES DA CUNHA','Leitura',7.7,9.7),
  ('SOFIA RODRIGUES DA CUNHA','Projeto Semear',10.0,10.0),
  ('SOFIA RODRIGUES DA CUNHA','Portugues',9.6,10.0),
  ('SOFIA RODRIGUES DA CUNHA','Historia',9.5,10.0),
  ('SOFIA RODRIGUES DA CUNHA','Geografia',9.7,10.0),
  ('SOFIA RODRIGUES DA CUNHA','Artes',10.0,10.0),
  ('SOFIA RODRIGUES DA CUNHA','Educacao Fisica',10.0,10.0),
  ('SOFIA RODRIGUES DA CUNHA','Ingles',9.6,10.0),
  ('SOFIA RODRIGUES DA CUNHA','Ensino Religioso',10.0,10.0);

-- 3. Turma alvo: resolvida pela matricula 2026 dos alunos do boletim (turma_id
-- nao e' deterministico entre ambientes, entao nunca hardcoded).
create temp table stg_turma_alvo (turma_id uuid) on commit drop;

insert into stg_turma_alvo (turma_id)
select m.turma_id
from stg_boletim_1ano_a s
join alunos al on upper(al.nome) = upper(s.aluno_nome)
join matriculas m on m.aluno_id = al.id and m.ano_letivo = 2026
group by m.turma_id
order by count(*) desc
limit 1;

do $$
begin
  if (select count(*) from stg_turma_alvo) <> 1 then
    raise exception 'nao foi possivel resolver uma unica turma para os alunos do boletim';
  end if;
end $$;

-- 4. Avaliacao sintetica por disciplina x bimestre (idempotente)
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
from stg_boletim_1ano_a s
join disciplinas d on d.serie_id = '9e357537-e277-4bc1-a205-60c56055f5c7' and d.nome = s.disciplina
cross join stg_turma_alvo t
cross join (values (1), (2)) as b(bimestre)
where not exists (
  select 1 from avaliacoes a
  where a.turma_id = t.turma_id
    and a.disciplina_id = d.id
    and a.bimestre = b.bimestre
    and a.ano_letivo = 2026
    and a.titulo = 'Media Bimestral'
);

-- 5. Notas do 1o bimestre
insert into notas (escola_id, avaliacao_id, aluno_id, matricula_id, valor)
select
  '00000000-0000-0000-0000-000000000001'::uuid,
  a.id,
  al.id,
  m.id,
  s.b1
from stg_boletim_1ano_a s
join alunos al on upper(al.nome) = upper(s.aluno_nome)
cross join stg_turma_alvo t
join matriculas m on m.aluno_id = al.id and m.ano_letivo = 2026 and m.turma_id = t.turma_id
join disciplinas d on d.serie_id = '9e357537-e277-4bc1-a205-60c56055f5c7' and d.nome = s.disciplina
join avaliacoes a on a.turma_id = t.turma_id and a.disciplina_id = d.id
  and a.bimestre = 1 and a.ano_letivo = 2026 and a.titulo = 'Media Bimestral'
on conflict (avaliacao_id, aluno_id) do update set valor = excluded.valor;

-- 6. Notas do 2o bimestre
insert into notas (escola_id, avaliacao_id, aluno_id, matricula_id, valor)
select
  '00000000-0000-0000-0000-000000000001'::uuid,
  a.id,
  al.id,
  m.id,
  s.b2
from stg_boletim_1ano_a s
join alunos al on upper(al.nome) = upper(s.aluno_nome)
cross join stg_turma_alvo t
join matriculas m on m.aluno_id = al.id and m.ano_letivo = 2026 and m.turma_id = t.turma_id
join disciplinas d on d.serie_id = '9e357537-e277-4bc1-a205-60c56055f5c7' and d.nome = s.disciplina
join avaliacoes a on a.turma_id = t.turma_id and a.disciplina_id = d.id
  and a.bimestre = 2 and a.ano_letivo = 2026 and a.titulo = 'Media Bimestral'
on conflict (avaliacao_id, aluno_id) do update set valor = excluded.valor;
