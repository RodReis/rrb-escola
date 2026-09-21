-- Importa notas do boletim (1o e 2o bimestre 2026) da turma 1o ANO B - Vespertino.
-- Mesmo padrao da migration 202609110002 (1o ANO A - Matutino): avaliacao sintetica
-- "Media Bimestral" por disciplina x bimestre, nota = MB do boletim.
-- Fonte: Resultado - 1 ANO - VESPERTINO.pdf.
-- Isabela Souza Borges fica de fora deste lote: so tem nota parcial do 3o bimestre
-- no boletim (sem 1o/2o), tratada separadamente.
-- Turma resolvida dinamicamente pela matricula 2026 dos alunos do boletim (turma_id
-- nao e' o mesmo entre ambientes local/prod).

create temp table stg_boletim_1ano_b (
  aluno_nome text,
  disciplina text,
  b1 numeric(5,2),
  b2 numeric(5,2)
) on commit drop;

insert into stg_boletim_1ano_b (aluno_nome, disciplina, b1, b2) values
  ('ALICE HELENA DE QUEIROZ','Ciencias',9.7,10.0),
  ('ALICE HELENA DE QUEIROZ','Matematica',9.8,10.0),
  ('ALICE HELENA DE QUEIROZ','Matematica Concreta',10.0,10.0),
  ('ALICE HELENA DE QUEIROZ','Socioemocional',10.0,10.0),
  ('ALICE HELENA DE QUEIROZ','Musicalizacao',10.0,10.0),
  ('ALICE HELENA DE QUEIROZ','Leitura',9.2,10.0),
  ('ALICE HELENA DE QUEIROZ','Projeto Semear',10.0,10.0),
  ('ALICE HELENA DE QUEIROZ','Portugues',8.5,9.9),
  ('ALICE HELENA DE QUEIROZ','Historia',10.0,10.0),
  ('ALICE HELENA DE QUEIROZ','Geografia',10.0,9.9),
  ('ALICE HELENA DE QUEIROZ','Artes',10.0,10.0),
  ('ALICE HELENA DE QUEIROZ','Educacao Fisica',10.0,10.0),
  ('ALICE HELENA DE QUEIROZ','Ingles',9.9,9.6),
  ('ALICE HELENA DE QUEIROZ','Ensino Religioso',10.0,10.0),
  ('ARTHUR CAVALCANTE PINHEIRO DE ANDRADE','Ciencias',10.0,10.0),
  ('ARTHUR CAVALCANTE PINHEIRO DE ANDRADE','Matematica',10.0,10.0),
  ('ARTHUR CAVALCANTE PINHEIRO DE ANDRADE','Matematica Concreta',10.0,10.0),
  ('ARTHUR CAVALCANTE PINHEIRO DE ANDRADE','Socioemocional',10.0,10.0),
  ('ARTHUR CAVALCANTE PINHEIRO DE ANDRADE','Musicalizacao',10.0,10.0),
  ('ARTHUR CAVALCANTE PINHEIRO DE ANDRADE','Leitura',10.0,10.0),
  ('ARTHUR CAVALCANTE PINHEIRO DE ANDRADE','Projeto Semear',10.0,10.0),
  ('ARTHUR CAVALCANTE PINHEIRO DE ANDRADE','Portugues',10.0,10.0),
  ('ARTHUR CAVALCANTE PINHEIRO DE ANDRADE','Historia',10.0,10.0),
  ('ARTHUR CAVALCANTE PINHEIRO DE ANDRADE','Geografia',10.0,10.0),
  ('ARTHUR CAVALCANTE PINHEIRO DE ANDRADE','Artes',10.0,10.0),
  ('ARTHUR CAVALCANTE PINHEIRO DE ANDRADE','Educacao Fisica',10.0,10.0),
  ('ARTHUR CAVALCANTE PINHEIRO DE ANDRADE','Ingles',0.0,10.0),
  ('ARTHUR CAVALCANTE PINHEIRO DE ANDRADE','Ensino Religioso',10.0,10.0),
  ('ARTHUR LOPES DE BRITO','Ciencias',10.0,10.0),
  ('ARTHUR LOPES DE BRITO','Matematica',10.0,10.0),
  ('ARTHUR LOPES DE BRITO','Matematica Concreta',10.0,10.0),
  ('ARTHUR LOPES DE BRITO','Socioemocional',10.0,10.0),
  ('ARTHUR LOPES DE BRITO','Musicalizacao',10.0,10.0),
  ('ARTHUR LOPES DE BRITO','Leitura',10.0,10.0),
  ('ARTHUR LOPES DE BRITO','Projeto Semear',10.0,10.0),
  ('ARTHUR LOPES DE BRITO','Portugues',10.0,10.0),
  ('ARTHUR LOPES DE BRITO','Historia',10.0,9.9),
  ('ARTHUR LOPES DE BRITO','Geografia',10.0,10.0),
  ('ARTHUR LOPES DE BRITO','Artes',10.0,10.0),
  ('ARTHUR LOPES DE BRITO','Educacao Fisica',10.0,10.0),
  ('ARTHUR LOPES DE BRITO','Ingles',9.7,10.0),
  ('ARTHUR LOPES DE BRITO','Ensino Religioso',10.0,10.0),
  ('AURORA BORBA FERREIRA DE FREITAS','Ciencias',10.0,10.0),
  ('AURORA BORBA FERREIRA DE FREITAS','Matematica',9.8,10.0),
  ('AURORA BORBA FERREIRA DE FREITAS','Matematica Concreta',10.0,10.0),
  ('AURORA BORBA FERREIRA DE FREITAS','Socioemocional',10.0,10.0),
  ('AURORA BORBA FERREIRA DE FREITAS','Musicalizacao',10.0,10.0),
  ('AURORA BORBA FERREIRA DE FREITAS','Leitura',9.5,10.0),
  ('AURORA BORBA FERREIRA DE FREITAS','Projeto Semear',10.0,10.0),
  ('AURORA BORBA FERREIRA DE FREITAS','Portugues',9.9,10.0),
  ('AURORA BORBA FERREIRA DE FREITAS','Historia',10.0,10.0),
  ('AURORA BORBA FERREIRA DE FREITAS','Geografia',9.9,10.0),
  ('AURORA BORBA FERREIRA DE FREITAS','Artes',10.0,10.0),
  ('AURORA BORBA FERREIRA DE FREITAS','Educacao Fisica',10.0,10.0),
  ('AURORA BORBA FERREIRA DE FREITAS','Ingles',9.5,10.0),
  ('AURORA BORBA FERREIRA DE FREITAS','Ensino Religioso',10.0,10.0),
  ('BERNARDO FLAUZINO DA SILVA','Ciencias',9.4,9.8),
  ('BERNARDO FLAUZINO DA SILVA','Matematica',9.8,9.8),
  ('BERNARDO FLAUZINO DA SILVA','Matematica Concreta',10.0,10.0),
  ('BERNARDO FLAUZINO DA SILVA','Socioemocional',10.0,10.0),
  ('BERNARDO FLAUZINO DA SILVA','Musicalizacao',10.0,10.0),
  ('BERNARDO FLAUZINO DA SILVA','Leitura',7.7,9.5),
  ('BERNARDO FLAUZINO DA SILVA','Projeto Semear',10.0,10.0),
  ('BERNARDO FLAUZINO DA SILVA','Portugues',8.6,8.5),
  ('BERNARDO FLAUZINO DA SILVA','Historia',9.9,9.8),
  ('BERNARDO FLAUZINO DA SILVA','Geografia',9.8,9.5),
  ('BERNARDO FLAUZINO DA SILVA','Artes',10.0,10.0),
  ('BERNARDO FLAUZINO DA SILVA','Educacao Fisica',10.0,10.0),
  ('BERNARDO FLAUZINO DA SILVA','Ingles',9.4,9.5),
  ('BERNARDO FLAUZINO DA SILVA','Ensino Religioso',10.0,10.0),
  ('CLARA LEMES DE ANDRADE','Ciencias',9.9,10.0),
  ('CLARA LEMES DE ANDRADE','Matematica',9.7,9.9),
  ('CLARA LEMES DE ANDRADE','Matematica Concreta',10.0,10.0),
  ('CLARA LEMES DE ANDRADE','Socioemocional',10.0,10.0),
  ('CLARA LEMES DE ANDRADE','Musicalizacao',10.0,10.0),
  ('CLARA LEMES DE ANDRADE','Leitura',9.5,10.0),
  ('CLARA LEMES DE ANDRADE','Projeto Semear',10.0,10.0),
  ('CLARA LEMES DE ANDRADE','Portugues',9.9,9.8),
  ('CLARA LEMES DE ANDRADE','Historia',10.0,9.7),
  ('CLARA LEMES DE ANDRADE','Geografia',10.0,10.0),
  ('CLARA LEMES DE ANDRADE','Artes',10.0,10.0),
  ('CLARA LEMES DE ANDRADE','Educacao Fisica',10.0,10.0),
  ('CLARA LEMES DE ANDRADE','Ingles',10.0,10.0),
  ('CLARA LEMES DE ANDRADE','Ensino Religioso',10.0,10.0),
  ('DANIEL ALVES MOREIRA','Ciencias',9.6,10.0),
  ('DANIEL ALVES MOREIRA','Matematica',9.8,10.0),
  ('DANIEL ALVES MOREIRA','Matematica Concreta',10.0,10.0),
  ('DANIEL ALVES MOREIRA','Socioemocional',10.0,10.0),
  ('DANIEL ALVES MOREIRA','Musicalizacao',10.0,10.0),
  ('DANIEL ALVES MOREIRA','Leitura',9.2,10.0),
  ('DANIEL ALVES MOREIRA','Projeto Semear',10.0,10.0),
  ('DANIEL ALVES MOREIRA','Portugues',9.8,9.8),
  ('DANIEL ALVES MOREIRA','Historia',10.0,10.0),
  ('DANIEL ALVES MOREIRA','Geografia',9.9,10.0),
  ('DANIEL ALVES MOREIRA','Artes',10.0,10.0),
  ('DANIEL ALVES MOREIRA','Educacao Fisica',10.0,10.0),
  ('DANIEL ALVES MOREIRA','Ingles',9.7,10.0),
  ('DANIEL ALVES MOREIRA','Ensino Religioso',10.0,10.0),
  ('ELISA LEMES MOREIRA FREITAS','Ciencias',10.0,10.0),
  ('ELISA LEMES MOREIRA FREITAS','Matematica',9.0,9.6),
  ('ELISA LEMES MOREIRA FREITAS','Matematica Concreta',10.0,10.0),
  ('ELISA LEMES MOREIRA FREITAS','Socioemocional',10.0,10.0),
  ('ELISA LEMES MOREIRA FREITAS','Musicalizacao',10.0,10.0),
  ('ELISA LEMES MOREIRA FREITAS','Leitura',7.5,8.7),
  ('ELISA LEMES MOREIRA FREITAS','Projeto Semear',10.0,10.0),
  ('ELISA LEMES MOREIRA FREITAS','Portugues',8.4,9.2),
  ('ELISA LEMES MOREIRA FREITAS','Historia',10.0,9.4),
  ('ELISA LEMES MOREIRA FREITAS','Geografia',9.5,9.4),
  ('ELISA LEMES MOREIRA FREITAS','Artes',10.0,10.0),
  ('ELISA LEMES MOREIRA FREITAS','Educacao Fisica',10.0,10.0),
  ('ELISA LEMES MOREIRA FREITAS','Ingles',9.5,9.7),
  ('ELISA LEMES MOREIRA FREITAS','Ensino Religioso',10.0,10.0),
  ('LIZ BUENO PEIXOTO','Ciencias',9.9,9.5),
  ('LIZ BUENO PEIXOTO','Matematica',9.5,9.4),
  ('LIZ BUENO PEIXOTO','Matematica Concreta',10.0,10.0),
  ('LIZ BUENO PEIXOTO','Socioemocional',10.0,10.0),
  ('LIZ BUENO PEIXOTO','Musicalizacao',10.0,10.0),
  ('LIZ BUENO PEIXOTO','Leitura',8.5,7.7),
  ('LIZ BUENO PEIXOTO','Projeto Semear',10.0,10.0),
  ('LIZ BUENO PEIXOTO','Portugues',8.3,8.8),
  ('LIZ BUENO PEIXOTO','Historia',10.0,9.2),
  ('LIZ BUENO PEIXOTO','Geografia',9.8,8.8),
  ('LIZ BUENO PEIXOTO','Artes',10.0,10.0),
  ('LIZ BUENO PEIXOTO','Educacao Fisica',10.0,10.0),
  ('LIZ BUENO PEIXOTO','Ingles',10.0,9.6),
  ('LIZ BUENO PEIXOTO','Ensino Religioso',10.0,10.0),
  ('LUIS ROQUE DINIZ','Ciencias',9.7,10.0),
  ('LUIS ROQUE DINIZ','Matematica',9.8,9.8),
  ('LUIS ROQUE DINIZ','Matematica Concreta',10.0,10.0),
  ('LUIS ROQUE DINIZ','Socioemocional',10.0,10.0),
  ('LUIS ROQUE DINIZ','Musicalizacao',10.0,10.0),
  ('LUIS ROQUE DINIZ','Leitura',9.5,9.5),
  ('LUIS ROQUE DINIZ','Projeto Semear',10.0,10.0),
  ('LUIS ROQUE DINIZ','Portugues',9.9,9.1),
  ('LUIS ROQUE DINIZ','Historia',9.8,9.4),
  ('LUIS ROQUE DINIZ','Geografia',9.6,9.6),
  ('LUIS ROQUE DINIZ','Artes',10.0,10.0),
  ('LUIS ROQUE DINIZ','Educacao Fisica',10.0,10.0),
  ('LUIS ROQUE DINIZ','Ingles',10.0,10.0),
  ('LUIS ROQUE DINIZ','Ensino Religioso',10.0,10.0),
  ('MANUELA BESSA GRATÃO','Ciencias',10.0,10.0),
  ('MANUELA BESSA GRATÃO','Matematica',9.8,10.0),
  ('MANUELA BESSA GRATÃO','Matematica Concreta',10.0,10.0),
  ('MANUELA BESSA GRATÃO','Socioemocional',10.0,10.0),
  ('MANUELA BESSA GRATÃO','Musicalizacao',10.0,10.0),
  ('MANUELA BESSA GRATÃO','Leitura',9.7,10.0),
  ('MANUELA BESSA GRATÃO','Projeto Semear',10.0,10.0),
  ('MANUELA BESSA GRATÃO','Portugues',10.0,10.0),
  ('MANUELA BESSA GRATÃO','Historia',10.0,9.9),
  ('MANUELA BESSA GRATÃO','Geografia',10.0,10.0),
  ('MANUELA BESSA GRATÃO','Artes',10.0,10.0),
  ('MANUELA BESSA GRATÃO','Educacao Fisica',10.0,10.0),
  ('MANUELA BESSA GRATÃO','Ingles',10.0,10.0),
  ('MANUELA BESSA GRATÃO','Ensino Religioso',10.0,10.0),
  ('MARIA EDUARDA CAVALCANTE PINHEIRO DE ANDRADE','Ciencias',9.8,10.0),
  ('MARIA EDUARDA CAVALCANTE PINHEIRO DE ANDRADE','Matematica',9.8,10.0),
  ('MARIA EDUARDA CAVALCANTE PINHEIRO DE ANDRADE','Matematica Concreta',10.0,10.0),
  ('MARIA EDUARDA CAVALCANTE PINHEIRO DE ANDRADE','Socioemocional',10.0,10.0),
  ('MARIA EDUARDA CAVALCANTE PINHEIRO DE ANDRADE','Musicalizacao',10.0,10.0),
  ('MARIA EDUARDA CAVALCANTE PINHEIRO DE ANDRADE','Leitura',9.0,10.0),
  ('MARIA EDUARDA CAVALCANTE PINHEIRO DE ANDRADE','Projeto Semear',10.0,10.0),
  ('MARIA EDUARDA CAVALCANTE PINHEIRO DE ANDRADE','Portugues',10.0,10.0),
  ('MARIA EDUARDA CAVALCANTE PINHEIRO DE ANDRADE','Historia',10.0,9.9),
  ('MARIA EDUARDA CAVALCANTE PINHEIRO DE ANDRADE','Geografia',10.0,10.0),
  ('MARIA EDUARDA CAVALCANTE PINHEIRO DE ANDRADE','Artes',10.0,10.0),
  ('MARIA EDUARDA CAVALCANTE PINHEIRO DE ANDRADE','Educacao Fisica',10.0,10.0),
  ('MARIA EDUARDA CAVALCANTE PINHEIRO DE ANDRADE','Ingles',9.8,10.0),
  ('MARIA EDUARDA CAVALCANTE PINHEIRO DE ANDRADE','Ensino Religioso',10.0,10.0),
  ('MARIA FERNANDA CALDAS ALVES','Ciencias',9.3,9.5),
  ('MARIA FERNANDA CALDAS ALVES','Matematica',9.7,9.9),
  ('MARIA FERNANDA CALDAS ALVES','Matematica Concreta',10.0,10.0),
  ('MARIA FERNANDA CALDAS ALVES','Socioemocional',10.0,10.0),
  ('MARIA FERNANDA CALDAS ALVES','Musicalizacao',10.0,10.0),
  ('MARIA FERNANDA CALDAS ALVES','Leitura',8.2,9.5),
  ('MARIA FERNANDA CALDAS ALVES','Projeto Semear',10.0,10.0),
  ('MARIA FERNANDA CALDAS ALVES','Portugues',9.4,9.9),
  ('MARIA FERNANDA CALDAS ALVES','Historia',10.0,10.0),
  ('MARIA FERNANDA CALDAS ALVES','Geografia',9.8,9.3),
  ('MARIA FERNANDA CALDAS ALVES','Artes',10.0,10.0),
  ('MARIA FERNANDA CALDAS ALVES','Educacao Fisica',10.0,10.0),
  ('MARIA FERNANDA CALDAS ALVES','Ingles',9.9,10.0),
  ('MARIA FERNANDA CALDAS ALVES','Ensino Religioso',10.0,10.0),
  ('MATEUS PRAXEDES LOBO','Ciencias',9.0,9.1),
  ('MATEUS PRAXEDES LOBO','Matematica',9.3,9.6),
  ('MATEUS PRAXEDES LOBO','Matematica Concreta',10.0,10.0),
  ('MATEUS PRAXEDES LOBO','Socioemocional',10.0,10.0),
  ('MATEUS PRAXEDES LOBO','Musicalizacao',10.0,10.0),
  ('MATEUS PRAXEDES LOBO','Leitura',7.7,8.5),
  ('MATEUS PRAXEDES LOBO','Projeto Semear',10.0,10.0),
  ('MATEUS PRAXEDES LOBO','Portugues',8.6,8.0),
  ('MATEUS PRAXEDES LOBO','Historia',10.0,9.0),
  ('MATEUS PRAXEDES LOBO','Geografia',9.8,8.2),
  ('MATEUS PRAXEDES LOBO','Artes',10.0,10.0),
  ('MATEUS PRAXEDES LOBO','Educacao Fisica',10.0,10.0),
  ('MATEUS PRAXEDES LOBO','Ingles',9.9,9.9),
  ('MATEUS PRAXEDES LOBO','Ensino Religioso',10.0,10.0),
  ('MIGUEL DE SOUZA VALERIANO','Ciencias',9.5,10.0),
  ('MIGUEL DE SOUZA VALERIANO','Matematica',9.8,9.9),
  ('MIGUEL DE SOUZA VALERIANO','Matematica Concreta',10.0,10.0),
  ('MIGUEL DE SOUZA VALERIANO','Socioemocional',10.0,10.0),
  ('MIGUEL DE SOUZA VALERIANO','Musicalizacao',10.0,10.0),
  ('MIGUEL DE SOUZA VALERIANO','Leitura',8.2,10.0),
  ('MIGUEL DE SOUZA VALERIANO','Projeto Semear',10.0,10.0),
  ('MIGUEL DE SOUZA VALERIANO','Portugues',9.7,9.4),
  ('MIGUEL DE SOUZA VALERIANO','Historia',10.0,9.6),
  ('MIGUEL DE SOUZA VALERIANO','Geografia',9.9,9.1),
  ('MIGUEL DE SOUZA VALERIANO','Artes',10.0,10.0),
  ('MIGUEL DE SOUZA VALERIANO','Educacao Fisica',10.0,10.0),
  ('MIGUEL DE SOUZA VALERIANO','Ingles',9.9,9.7),
  ('MIGUEL DE SOUZA VALERIANO','Ensino Religioso',10.0,10.0),
  ('RAFAELA SOUZA MANRIQUE','Ciencias',9.9,9.9),
  ('RAFAELA SOUZA MANRIQUE','Matematica',9.7,10.0),
  ('RAFAELA SOUZA MANRIQUE','Matematica Concreta',10.0,10.0),
  ('RAFAELA SOUZA MANRIQUE','Socioemocional',10.0,10.0),
  ('RAFAELA SOUZA MANRIQUE','Musicalizacao',10.0,10.0),
  ('RAFAELA SOUZA MANRIQUE','Leitura',8.5,10.0),
  ('RAFAELA SOUZA MANRIQUE','Projeto Semear',10.0,10.0),
  ('RAFAELA SOUZA MANRIQUE','Portugues',9.8,9.9),
  ('RAFAELA SOUZA MANRIQUE','Historia',9.9,10.0),
  ('RAFAELA SOUZA MANRIQUE','Geografia',9.9,10.0),
  ('RAFAELA SOUZA MANRIQUE','Artes',10.0,10.0),
  ('RAFAELA SOUZA MANRIQUE','Educacao Fisica',10.0,10.0),
  ('RAFAELA SOUZA MANRIQUE','Ingles',10.0,10.0),
  ('RAFAELA SOUZA MANRIQUE','Ensino Religioso',10.0,10.0),
  ('SOPHIA SOUSA DOS REIS SIPAÚBA','Ciencias',9.9,9.7),
  ('SOPHIA SOUSA DOS REIS SIPAÚBA','Matematica',9.7,8.9),
  ('SOPHIA SOUSA DOS REIS SIPAÚBA','Matematica Concreta',10.0,10.0),
  ('SOPHIA SOUSA DOS REIS SIPAÚBA','Socioemocional',10.0,10.0),
  ('SOPHIA SOUSA DOS REIS SIPAÚBA','Musicalizacao',10.0,10.0),
  ('SOPHIA SOUSA DOS REIS SIPAÚBA','Leitura',8.7,9.5),
  ('SOPHIA SOUSA DOS REIS SIPAÚBA','Projeto Semear',10.0,10.0),
  ('SOPHIA SOUSA DOS REIS SIPAÚBA','Portugues',9.8,9.3),
  ('SOPHIA SOUSA DOS REIS SIPAÚBA','Historia',9.6,10.0),
  ('SOPHIA SOUSA DOS REIS SIPAÚBA','Geografia',10.0,9.2),
  ('SOPHIA SOUSA DOS REIS SIPAÚBA','Artes',10.0,10.0),
  ('SOPHIA SOUSA DOS REIS SIPAÚBA','Educacao Fisica',10.0,10.0),
  ('SOPHIA SOUSA DOS REIS SIPAÚBA','Ingles',9.6,10.0),
  ('SOPHIA SOUSA DOS REIS SIPAÚBA','Ensino Religioso',10.0,10.0),
  ('VALENTIN CAVALCANTE PINHEIRO DE ANDRADE','Ciencias',9.9,10.0),
  ('VALENTIN CAVALCANTE PINHEIRO DE ANDRADE','Matematica',9.6,10.0),
  ('VALENTIN CAVALCANTE PINHEIRO DE ANDRADE','Matematica Concreta',10.0,10.0),
  ('VALENTIN CAVALCANTE PINHEIRO DE ANDRADE','Socioemocional',10.0,10.0),
  ('VALENTIN CAVALCANTE PINHEIRO DE ANDRADE','Musicalizacao',10.0,10.0),
  ('VALENTIN CAVALCANTE PINHEIRO DE ANDRADE','Leitura',9.5,10.0),
  ('VALENTIN CAVALCANTE PINHEIRO DE ANDRADE','Projeto Semear',10.0,10.0),
  ('VALENTIN CAVALCANTE PINHEIRO DE ANDRADE','Portugues',9.8,10.0),
  ('VALENTIN CAVALCANTE PINHEIRO DE ANDRADE','Historia',10.0,9.9),
  ('VALENTIN CAVALCANTE PINHEIRO DE ANDRADE','Geografia',10.0,10.0),
  ('VALENTIN CAVALCANTE PINHEIRO DE ANDRADE','Artes',10.0,10.0),
  ('VALENTIN CAVALCANTE PINHEIRO DE ANDRADE','Educacao Fisica',10.0,10.0),
  ('VALENTIN CAVALCANTE PINHEIRO DE ANDRADE','Ingles',10.0,10.0),
  ('VALENTIN CAVALCANTE PINHEIRO DE ANDRADE','Ensino Religioso',10.0,10.0),
  ('YASMIN CABRINI BARCELOS SILVA CARES','Ciencias',9.7,8.5),
  ('YASMIN CABRINI BARCELOS SILVA CARES','Matematica',9.5,9.3),
  ('YASMIN CABRINI BARCELOS SILVA CARES','Matematica Concreta',10.0,10.0),
  ('YASMIN CABRINI BARCELOS SILVA CARES','Socioemocional',10.0,10.0),
  ('YASMIN CABRINI BARCELOS SILVA CARES','Musicalizacao',10.0,10.0),
  ('YASMIN CABRINI BARCELOS SILVA CARES','Leitura',8.7,9.5),
  ('YASMIN CABRINI BARCELOS SILVA CARES','Projeto Semear',10.0,10.0),
  ('YASMIN CABRINI BARCELOS SILVA CARES','Portugues',9.5,8.5),
  ('YASMIN CABRINI BARCELOS SILVA CARES','Historia',9.3,9.4),
  ('YASMIN CABRINI BARCELOS SILVA CARES','Geografia',9.5,9.9),
  ('YASMIN CABRINI BARCELOS SILVA CARES','Artes',10.0,10.0),
  ('YASMIN CABRINI BARCELOS SILVA CARES','Educacao Fisica',10.0,10.0),
  ('YASMIN CABRINI BARCELOS SILVA CARES','Ingles',0.0,10.0),
  ('YASMIN CABRINI BARCELOS SILVA CARES','Ensino Religioso',10.0,10.0);

-- Turma alvo: resolvida pela matricula 2026 dos alunos do boletim.
create temp table stg_turma_alvo_1b (turma_id uuid) on commit drop;

insert into stg_turma_alvo_1b (turma_id)
select m.turma_id
from stg_boletim_1ano_b s
join alunos al on upper(al.nome) = upper(s.aluno_nome)
join matriculas m on m.aluno_id = al.id and m.ano_letivo = 2026
group by m.turma_id
order by count(*) desc
limit 1;

do $$
begin
  if (select count(*) from stg_turma_alvo_1b) <> 1 then
    raise exception 'nao foi possivel resolver uma unica turma para os alunos do boletim (1o ANO B)';
  end if;
end $$;

-- Disciplinas: a serie ja tem as 14 disciplinas cadastradas (migration 202609110002).
-- Avaliacao sintetica por disciplina x bimestre (idempotente)
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
from stg_boletim_1ano_b s
join disciplinas d on d.serie_id = '9e357537-e277-4bc1-a205-60c56055f5c7' and d.nome = s.disciplina
cross join stg_turma_alvo_1b t
cross join (values (1), (2)) as b(bimestre)
where not exists (
  select 1 from avaliacoes a
  where a.turma_id = t.turma_id
    and a.disciplina_id = d.id
    and a.bimestre = b.bimestre
    and a.ano_letivo = 2026
    and a.titulo = 'Media Bimestral'
);

-- Notas do 1o bimestre
insert into notas (escola_id, avaliacao_id, aluno_id, matricula_id, valor)
select
  '00000000-0000-0000-0000-000000000001'::uuid,
  a.id,
  al.id,
  m.id,
  s.b1
from stg_boletim_1ano_b s
join alunos al on upper(al.nome) = upper(s.aluno_nome)
cross join stg_turma_alvo_1b t
join matriculas m on m.aluno_id = al.id and m.ano_letivo = 2026 and m.turma_id = t.turma_id
join disciplinas d on d.serie_id = '9e357537-e277-4bc1-a205-60c56055f5c7' and d.nome = s.disciplina
join avaliacoes a on a.turma_id = t.turma_id and a.disciplina_id = d.id
  and a.bimestre = 1 and a.ano_letivo = 2026 and a.titulo = 'Media Bimestral'
on conflict (avaliacao_id, aluno_id) do update set valor = excluded.valor;

-- Notas do 2o bimestre
insert into notas (escola_id, avaliacao_id, aluno_id, matricula_id, valor)
select
  '00000000-0000-0000-0000-000000000001'::uuid,
  a.id,
  al.id,
  m.id,
  s.b2
from stg_boletim_1ano_b s
join alunos al on upper(al.nome) = upper(s.aluno_nome)
cross join stg_turma_alvo_1b t
join matriculas m on m.aluno_id = al.id and m.ano_letivo = 2026 and m.turma_id = t.turma_id
join disciplinas d on d.serie_id = '9e357537-e277-4bc1-a205-60c56055f5c7' and d.nome = s.disciplina
join avaliacoes a on a.turma_id = t.turma_id and a.disciplina_id = d.id
  and a.bimestre = 2 and a.ano_letivo = 2026 and a.titulo = 'Media Bimestral'
on conflict (avaliacao_id, aluno_id) do update set valor = excluded.valor;
