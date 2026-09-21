-- Importa notas do boletim (1o e 2o bimestre 2026) da turma 1a SERIE EM A - Matutino.
-- Cadastro corrigido antes desta migration:
--   - Rodrigo Otavio Vaz Araujo: cursou 1a SERIE em 2025, cadastro promoveu ele
--     para 2a SERIE 2026, mas o boletim mostra ele cursando 1a SERIE 2026
--     (repetiu o ano). Corrigido serie_id/turma_id da matricula 2026.
--   - Karine Silva Matias: nao existia cadastro em alunos. Criado cadastro
--     basico (matricula 1743) + matricula 2026 ativa na 1a SERIE EM A -
--     Matutino, com base em dados fornecidos pela escola. Documentos
--     (CPF/RG) foram preenchidos direto no sistema, fora desta migration:
--     dado pessoal de menor nao entra no historico do repositorio.
-- Perfil de disciplinas do Ensino Medio (1a SERIE) e bem mais granular que o
-- Fundamental: 29 disciplinas no boletim, com desmembramentos por frente
-- (Quimica/Quimica Frente A/B, Fisica/Fisica Frente A/B, Matematica/Matem
-- Frente A/B-C/D, Biologia/Biologia Frente A/B) e por escopo de Historia
-- (Historia/Historia Geral/Historia do Brasil + Historia da Arte) e Geografia
-- (Geografia/Geografia Politica/Geografia Fisica). Reaproveita a seed
-- renomeando Portugues -> Lingua Portuguesa; cria as demais 17 novas.
-- Artes (seed) fica sem uso: nao aparece no boletim desta turma.
-- Varios alunos tem campos em branco no boletim (nota nao lancada pela
-- escola ainda) - tratados como NULL, nao inserida linha de nota.
-- Fonte: Resultado - 1a SERIE - EM A - MATUTINO.pdf.
-- Turma resolvida dinamicamente pela matricula 2026 dos alunos do boletim.

create or replace function pg_temp.norm_nome(txt text) returns text as $$
  select upper(translate(txt,
    'áàâãäÁÀÂÃÄéèêëÉÈÊËíìîïÍÌÎÏóòôõöÓÒÔÕÖúùûüÚÙÛÜçÇñÑ',
    'aaaaaAAAAAeeeeEEEEiiiiIIIIooooOOOOOOuuuuUUUUcCnN'
  ));
$$ language sql immutable;

-- Cadastro: garante Karine Silva Matias (nao existia em alunos).
-- Cria so o minimo necessario para a matricula e as notas abaixo resolverem.
-- CPF, RG e demais documentos sao preenchidos pela secretaria no sistema.
insert into alunos (escola_id, matricula_codigo, nome, sexo, data_nascimento, naturalidade, ativo)
select '00000000-0000-0000-0000-000000000001'::uuid, '1743', 'KARINE SILVA MATIAS',
       'feminino', '2010-07-20', 'SÃO GOTARDO', true
where not exists (
  select 1 from alunos
  where escola_id = '00000000-0000-0000-0000-000000000001'::uuid
    and (matricula_codigo = '1743'
         or pg_temp.norm_nome(nome) = pg_temp.norm_nome('KARINE SILVA MATIAS'))
);

-- Cadastro: corrige serie/turma de Rodrigo Otavio Vaz Araujo (repetiu 1a SERIE).
update matriculas m
set serie_id = s1.id, turma_id = t1.id
from series s1
join turmas t1 on t1.serie_id = s1.id and t1.ano_letivo = 2026 and t1.turno = 'matutino'
where s1.nome = '1ª SÉRIE'
  and m.ano_letivo = 2026
  and m.aluno_id in (
    select al.id from alunos al
    where pg_temp.norm_nome(al.nome) = pg_temp.norm_nome('RODRIGO OTÁVIO VAZ ARAÚJO')
  );

-- Cria matricula 2026 de Karine, na mesma turma dos demais.
insert into matriculas (escola_id, aluno_id, serie_id, turma_id, ano_letivo, status, tipo_vaga, percentual_bolsa)
select '00000000-0000-0000-0000-000000000001'::uuid, al.id, t1.serie_id, t1.id, 2026, 'ativa'::status_matricula, 'paga'::tipo_vaga, 0
from alunos al
join turmas t1 on t1.serie_id = (select id from series where nome = '1ª SÉRIE') and t1.ano_letivo = 2026 and t1.turno = 'matutino'
where pg_temp.norm_nome(al.nome) = pg_temp.norm_nome('KARINE SILVA MATIAS')
  and not exists (
    select 1 from matriculas m2 where m2.aluno_id = al.id and m2.ano_letivo = 2026
  );

update disciplinas set nome = 'Lingua Portuguesa'
where serie_id = '17061e9e-2a34-485a-ba11-bd061458fbf8' and nome = 'Portugues';

insert into disciplinas (escola_id, serie_id, nome, ordem)
select '00000000-0000-0000-0000-000000000001'::uuid, '17061e9e-2a34-485a-ba11-bd061458fbf8'::uuid, nome, ordem
from (values
  ('Projeto de Vida', 13),
  ('Sociologia', 14),
  ('Espanhol', 15),
  ('Literatura', 16),
  ('Quimica Frente A', 17),
  ('Quimica Frente B', 18),
  ('Geografia Politica', 19),
  ('Geografia Fisica', 20),
  ('Historia Geral', 21),
  ('Historia do Brasil', 22),
  ('Fisica Frente A', 23),
  ('Fisica Frente B', 24),
  ('Matem Frente A', 25),
  ('Matem Frente B/C', 26),
  ('Matem Frente D', 27),
  ('Biologia Frente A', 28),
  ('Biologia Frente B', 29),
  ('Historia da Arte', 30)
) as novas(nome, ordem)
on conflict (escola_id, serie_id, nome) do nothing;

create temp table stg_boletim_1serie_a (
  aluno_nome text,
  disciplina text,
  b1 numeric(5,2),
  b2 numeric(5,2)
) on commit drop;

insert into stg_boletim_1serie_a (aluno_nome, disciplina, b1, b2) values
  ('EMILLY NICOLE BARBOSA ASSUNCAO','Filosofia',9.5,10.0),
  ('EMILLY NICOLE BARBOSA ASSUNCAO','Projeto de Vida',10.0,10.0),
  ('EMILLY NICOLE BARBOSA ASSUNCAO','Sociologia',9.5,10.0),
  ('EMILLY NICOLE BARBOSA ASSUNCAO','Redacao',8.6,8.9),
  ('EMILLY NICOLE BARBOSA ASSUNCAO','Espanhol',10.0,10.0),
  ('EMILLY NICOLE BARBOSA ASSUNCAO','Literatura',10.0,9.1),
  ('EMILLY NICOLE BARBOSA ASSUNCAO','Quimica',6.6,9.3),
  ('EMILLY NICOLE BARBOSA ASSUNCAO','Quimica Frente A',8.2,8.6),
  ('EMILLY NICOLE BARBOSA ASSUNCAO','Quimica Frente B',5.1,10.0),
  ('EMILLY NICOLE BARBOSA ASSUNCAO','Geografia',8.0,8.4),
  ('EMILLY NICOLE BARBOSA ASSUNCAO','Geografia Politica',8.2,8.4),
  ('EMILLY NICOLE BARBOSA ASSUNCAO','Geografia Fisica',7.9,8.5),
  ('EMILLY NICOLE BARBOSA ASSUNCAO','Historia',7.8,10.0),
  ('EMILLY NICOLE BARBOSA ASSUNCAO','Historia Geral',8.2,10.0),
  ('EMILLY NICOLE BARBOSA ASSUNCAO','Historia do Brasil',7.4,10.0),
  ('EMILLY NICOLE BARBOSA ASSUNCAO','Fisica',6.4,8.7),
  ('EMILLY NICOLE BARBOSA ASSUNCAO','Fisica Frente A',5.2,9.3),
  ('EMILLY NICOLE BARBOSA ASSUNCAO','Matematica',7.0,8.2),
  ('EMILLY NICOLE BARBOSA ASSUNCAO','Matem Frente B/C',7.4,7.6),
  ('EMILLY NICOLE BARBOSA ASSUNCAO','Matem Frente A',5.9,8.7),
  ('EMILLY NICOLE BARBOSA ASSUNCAO','Matem Frente D',7.9,8.5),
  ('EMILLY NICOLE BARBOSA ASSUNCAO','Fisica Frente B',7.7,8.1),
  ('EMILLY NICOLE BARBOSA ASSUNCAO','Biologia',8.4,9.2),
  ('EMILLY NICOLE BARBOSA ASSUNCAO','Biologia Frente A',9.5,8.5),
  ('EMILLY NICOLE BARBOSA ASSUNCAO','Biologia Frente B',7.3,10.0),
  ('EMILLY NICOLE BARBOSA ASSUNCAO','Historia da Arte',7.9,9.4),
  ('EMILLY NICOLE BARBOSA ASSUNCAO','Lingua Portuguesa',8.3,8.1),
  ('EMILLY NICOLE BARBOSA ASSUNCAO','Educacao Fisica',10.0,10.0),
  ('EMILLY NICOLE BARBOSA ASSUNCAO','Ingles',9.6,10.0),
  ('JUAN PAULO FERNANDES BATISTA ROQUE','Filosofia',7.0,9.0),
  ('JUAN PAULO FERNANDES BATISTA ROQUE','Projeto de Vida',10.0,10.0),
  ('JUAN PAULO FERNANDES BATISTA ROQUE','Sociologia',8.9,8.0),
  ('JUAN PAULO FERNANDES BATISTA ROQUE','Redacao',9.0,6.5),
  ('JUAN PAULO FERNANDES BATISTA ROQUE','Espanhol',10.0,10.0),
  ('JUAN PAULO FERNANDES BATISTA ROQUE','Literatura',7.3,9.8),
  ('JUAN PAULO FERNANDES BATISTA ROQUE','Quimica',6.2,6.3),
  ('JUAN PAULO FERNANDES BATISTA ROQUE','Quimica Frente A',7.1,7.1),
  ('JUAN PAULO FERNANDES BATISTA ROQUE','Quimica Frente B',5.4,5.6),
  ('JUAN PAULO FERNANDES BATISTA ROQUE','Geografia',7.3,8.0),
  ('JUAN PAULO FERNANDES BATISTA ROQUE','Geografia Politica',7.6,7.9),
  ('JUAN PAULO FERNANDES BATISTA ROQUE','Geografia Fisica',7.0,8.1),
  ('JUAN PAULO FERNANDES BATISTA ROQUE','Historia',7.1,7.4),
  ('JUAN PAULO FERNANDES BATISTA ROQUE','Historia Geral',7.5,8.1),
  ('JUAN PAULO FERNANDES BATISTA ROQUE','Historia do Brasil',6.7,6.7),
  ('JUAN PAULO FERNANDES BATISTA ROQUE','Fisica',6.1,5.6),
  ('JUAN PAULO FERNANDES BATISTA ROQUE','Fisica Frente A',8.1,3.6),
  ('JUAN PAULO FERNANDES BATISTA ROQUE','Matematica',6.1,6.6),
  ('JUAN PAULO FERNANDES BATISTA ROQUE','Matem Frente B/C',6.3,6.0),
  ('JUAN PAULO FERNANDES BATISTA ROQUE','Matem Frente A',5.0,5.5),
  ('JUAN PAULO FERNANDES BATISTA ROQUE','Matem Frente D',7.1,8.3),
  ('JUAN PAULO FERNANDES BATISTA ROQUE','Fisica Frente B',4.1,7.7),
  ('JUAN PAULO FERNANDES BATISTA ROQUE','Biologia',7.1,9.4),
  ('JUAN PAULO FERNANDES BATISTA ROQUE','Biologia Frente A',8.1,9.3),
  ('JUAN PAULO FERNANDES BATISTA ROQUE','Biologia Frente B',6.2,9.5),
  ('JUAN PAULO FERNANDES BATISTA ROQUE','Historia da Arte',7.7,9.2),
  ('JUAN PAULO FERNANDES BATISTA ROQUE','Lingua Portuguesa',7.6,7.6),
  ('JUAN PAULO FERNANDES BATISTA ROQUE','Educacao Fisica',10.0,10.0),
  ('JUAN PAULO FERNANDES BATISTA ROQUE','Ingles',9.5,9.0),
  ('MARCELA KAROLYNY DE JESUS BORGES','Filosofia',7.0,10.0),
  ('MARCELA KAROLYNY DE JESUS BORGES','Projeto de Vida',10.0,10.0),
  ('MARCELA KAROLYNY DE JESUS BORGES','Sociologia',9.9,8.5),
  ('MARCELA KAROLYNY DE JESUS BORGES','Redacao',7.1,7.1),
  ('MARCELA KAROLYNY DE JESUS BORGES','Espanhol',10.0,10.0),
  ('MARCELA KAROLYNY DE JESUS BORGES','Literatura',9.5,7.5),
  ('MARCELA KAROLYNY DE JESUS BORGES','Quimica',8.5,7.2),
  ('MARCELA KAROLYNY DE JESUS BORGES','Quimica Frente A',8.5,8.5),
  ('MARCELA KAROLYNY DE JESUS BORGES','Quimica Frente B',null,5.9),
  ('MARCELA KAROLYNY DE JESUS BORGES','Geografia',7.0,7.7),
  ('MARCELA KAROLYNY DE JESUS BORGES','Geografia Politica',7.0,7.9),
  ('MARCELA KAROLYNY DE JESUS BORGES','Geografia Fisica',7.1,7.5),
  ('MARCELA KAROLYNY DE JESUS BORGES','Historia',6.2,7.6),
  ('MARCELA KAROLYNY DE JESUS BORGES','Historia Geral',7.0,7.7),
  ('MARCELA KAROLYNY DE JESUS BORGES','Historia do Brasil',5.4,7.5),
  ('MARCELA KAROLYNY DE JESUS BORGES','Fisica',4.6,5.6),
  ('MARCELA KAROLYNY DE JESUS BORGES','Fisica Frente A',5.6,4.2),
  ('MARCELA KAROLYNY DE JESUS BORGES','Matematica',5.6,7.2),
  ('MARCELA KAROLYNY DE JESUS BORGES','Matem Frente B/C',4.1,6.1),
  ('MARCELA KAROLYNY DE JESUS BORGES','Matem Frente A',5.6,8.3),
  ('MARCELA KAROLYNY DE JESUS BORGES','Matem Frente D',7.1,7.2),
  ('MARCELA KAROLYNY DE JESUS BORGES','Fisica Frente B',3.6,7.1),
  ('MARCELA KAROLYNY DE JESUS BORGES','Biologia',6.9,7.4),
  ('MARCELA KAROLYNY DE JESUS BORGES','Biologia Frente A',8.7,5.7),
  ('MARCELA KAROLYNY DE JESUS BORGES','Biologia Frente B',5.1,9.1),
  ('MARCELA KAROLYNY DE JESUS BORGES','Historia da Arte',7.6,6.8),
  ('MARCELA KAROLYNY DE JESUS BORGES','Lingua Portuguesa',7.1,7.0),
  ('MARCELA KAROLYNY DE JESUS BORGES','Educacao Fisica',10.0,9.0),
  ('MARCELA KAROLYNY DE JESUS BORGES','Ingles',9.6,10.0),
  ('MARIA CLARA OLIVEIRA LISITA','Filosofia',8.5,10.0),
  ('MARIA CLARA OLIVEIRA LISITA','Projeto de Vida',10.0,10.0),
  ('MARIA CLARA OLIVEIRA LISITA','Sociologia',10.0,9.0),
  ('MARIA CLARA OLIVEIRA LISITA','Redacao',8.6,9.5),
  ('MARIA CLARA OLIVEIRA LISITA','Espanhol',10.0,10.0),
  ('MARIA CLARA OLIVEIRA LISITA','Literatura',7.7,8.0),
  ('MARIA CLARA OLIVEIRA LISITA','Quimica',7.9,8.5),
  ('MARIA CLARA OLIVEIRA LISITA','Quimica Frente A',8.8,8.5),
  ('MARIA CLARA OLIVEIRA LISITA','Quimica Frente B',7.1,8.5),
  ('MARIA CLARA OLIVEIRA LISITA','Geografia',7.7,8.4),
  ('MARIA CLARA OLIVEIRA LISITA','Geografia Politica',8.5,8.6),
  ('MARIA CLARA OLIVEIRA LISITA','Geografia Fisica',7.0,8.2),
  ('MARIA CLARA OLIVEIRA LISITA','Historia',7.0,9.1),
  ('MARIA CLARA OLIVEIRA LISITA','Historia Geral',7.7,9.2),
  ('MARIA CLARA OLIVEIRA LISITA','Historia do Brasil',6.4,9.0),
  ('MARIA CLARA OLIVEIRA LISITA','Fisica',5.1,6.8),
  ('MARIA CLARA OLIVEIRA LISITA','Fisica Frente A',6.1,6.2),
  ('MARIA CLARA OLIVEIRA LISITA','Matematica',6.3,7.9),
  ('MARIA CLARA OLIVEIRA LISITA','Matem Frente B/C',6.7,8.2),
  ('MARIA CLARA OLIVEIRA LISITA','Matem Frente A',5.4,7.8),
  ('MARIA CLARA OLIVEIRA LISITA','Matem Frente D',7.0,7.7),
  ('MARIA CLARA OLIVEIRA LISITA','Fisica Frente B',4.1,7.5),
  ('MARIA CLARA OLIVEIRA LISITA','Biologia',8.9,7.4),
  ('MARIA CLARA OLIVEIRA LISITA','Biologia Frente A',10.0,7.5),
  ('MARIA CLARA OLIVEIRA LISITA','Biologia Frente B',7.9,7.4),
  ('MARIA CLARA OLIVEIRA LISITA','Historia da Arte',6.4,8.5),
  ('MARIA CLARA OLIVEIRA LISITA','Lingua Portuguesa',7.5,7.7),
  ('MARIA CLARA OLIVEIRA LISITA','Educacao Fisica',10.0,8.5),
  ('MARIA CLARA OLIVEIRA LISITA','Ingles',9.5,10.0),
  ('MARIA JULIA OLIVEIRA RENZETTI','Filosofia',9.8,10.0),
  ('MARIA JULIA OLIVEIRA RENZETTI','Projeto de Vida',10.0,10.0),
  ('MARIA JULIA OLIVEIRA RENZETTI','Sociologia',10.0,10.0),
  ('MARIA JULIA OLIVEIRA RENZETTI','Redacao',8.4,9.8),
  ('MARIA JULIA OLIVEIRA RENZETTI','Espanhol',10.0,10.0),
  ('MARIA JULIA OLIVEIRA RENZETTI','Literatura',9.8,8.6),
  ('MARIA JULIA OLIVEIRA RENZETTI','Quimica',8.9,9.2),
  ('MARIA JULIA OLIVEIRA RENZETTI','Quimica Frente A',9.6,9.3),
  ('MARIA JULIA OLIVEIRA RENZETTI','Quimica Frente B',8.2,9.1),
  ('MARIA JULIA OLIVEIRA RENZETTI','Geografia',8.5,8.5),
  ('MARIA JULIA OLIVEIRA RENZETTI','Geografia Politica',9.1,9.5),
  ('MARIA JULIA OLIVEIRA RENZETTI','Geografia Fisica',7.9,7.6),
  ('MARIA JULIA OLIVEIRA RENZETTI','Historia',8.9,9.5),
  ('MARIA JULIA OLIVEIRA RENZETTI','Historia Geral',9.0,9.1),
  ('MARIA JULIA OLIVEIRA RENZETTI','Historia do Brasil',8.8,10.0),
  ('MARIA JULIA OLIVEIRA RENZETTI','Fisica',7.3,7.2),
  ('MARIA JULIA OLIVEIRA RENZETTI','Fisica Frente A',7.9,6.7),
  ('MARIA JULIA OLIVEIRA RENZETTI','Matematica',7.7,7.5),
  ('MARIA JULIA OLIVEIRA RENZETTI','Matem Frente B/C',6.8,8.4),
  ('MARIA JULIA OLIVEIRA RENZETTI','Matem Frente A',7.7,6.2),
  ('MARIA JULIA OLIVEIRA RENZETTI','Matem Frente D',8.6,8.1),
  ('MARIA JULIA OLIVEIRA RENZETTI','Fisica Frente B',6.8,7.7),
  ('MARIA JULIA OLIVEIRA RENZETTI','Biologia',8.8,9.3),
  ('MARIA JULIA OLIVEIRA RENZETTI','Biologia Frente A',10.0,8.6),
  ('MARIA JULIA OLIVEIRA RENZETTI','Biologia Frente B',7.6,10.0),
  ('MARIA JULIA OLIVEIRA RENZETTI','Historia da Arte',8.8,9.6),
  ('MARIA JULIA OLIVEIRA RENZETTI','Lingua Portuguesa',8.1,7.9),
  ('MARIA JULIA OLIVEIRA RENZETTI','Educacao Fisica',10.0,9.0),
  ('MARIA JULIA OLIVEIRA RENZETTI','Ingles',10.0,10.0),
  ('MATHEUS RIBEIRO MENDANHA','Filosofia',7.5,9.0),
  ('MATHEUS RIBEIRO MENDANHA','Projeto de Vida',10.0,10.0),
  ('MATHEUS RIBEIRO MENDANHA','Sociologia',10.0,9.5),
  ('MATHEUS RIBEIRO MENDANHA','Redacao',9.8,9.8),
  ('MATHEUS RIBEIRO MENDANHA','Espanhol',10.0,10.0),
  ('MATHEUS RIBEIRO MENDANHA','Literatura',7.8,7.2),
  ('MATHEUS RIBEIRO MENDANHA','Quimica',7.0,7.8),
  ('MATHEUS RIBEIRO MENDANHA','Quimica Frente A',7.9,7.7),
  ('MATHEUS RIBEIRO MENDANHA','Quimica Frente B',6.2,7.9),
  ('MATHEUS RIBEIRO MENDANHA','Geografia',7.4,7.7),
  ('MATHEUS RIBEIRO MENDANHA','Geografia Politica',7.5,7.8),
  ('MATHEUS RIBEIRO MENDANHA','Geografia Fisica',7.3,7.6),
  ('MATHEUS RIBEIRO MENDANHA','Historia',7.0,9.3),
  ('MATHEUS RIBEIRO MENDANHA','Historia Geral',7.2,9.8),
  ('MATHEUS RIBEIRO MENDANHA','Historia do Brasil',6.8,8.8),
  ('MATHEUS RIBEIRO MENDANHA','Fisica',7.0,7.3),
  ('MATHEUS RIBEIRO MENDANHA','Fisica Frente A',7.0,7.0),
  ('MATHEUS RIBEIRO MENDANHA','Matematica',7.0,7.1),
  ('MATHEUS RIBEIRO MENDANHA','Matem Frente B/C',6.9,7.1),
  ('MATHEUS RIBEIRO MENDANHA','Matem Frente A',7.0,7.0),
  ('MATHEUS RIBEIRO MENDANHA','Matem Frente D',7.1,7.3),
  ('MATHEUS RIBEIRO MENDANHA','Fisica Frente B',7.0,7.6),
  ('MATHEUS RIBEIRO MENDANHA','Biologia',7.0,9.5),
  ('MATHEUS RIBEIRO MENDANHA','Biologia Frente A',8.5,9.6),
  ('MATHEUS RIBEIRO MENDANHA','Biologia Frente B',5.6,9.5),
  ('MATHEUS RIBEIRO MENDANHA','Historia da Arte',7.0,7.5),
  ('MATHEUS RIBEIRO MENDANHA','Lingua Portuguesa',8.2,8.1),
  ('MATHEUS RIBEIRO MENDANHA','Educacao Fisica',10.0,10.0),
  ('MATHEUS RIBEIRO MENDANHA','Ingles',8.0,10.0),
  ('ROBERTA MONTEIRO FORTUNA','Filosofia',8.7,9.0),
  ('ROBERTA MONTEIRO FORTUNA','Projeto de Vida',10.0,10.0),
  ('ROBERTA MONTEIRO FORTUNA','Sociologia',10.0,9.0),
  ('ROBERTA MONTEIRO FORTUNA','Redacao',8.6,9.4),
  ('ROBERTA MONTEIRO FORTUNA','Espanhol',10.0,10.0),
  ('ROBERTA MONTEIRO FORTUNA','Literatura',9.4,9.4),
  ('ROBERTA MONTEIRO FORTUNA','Quimica',8.5,8.5),
  ('ROBERTA MONTEIRO FORTUNA','Quimica Frente A',10.0,9.9),
  ('ROBERTA MONTEIRO FORTUNA','Quimica Frente B',7.0,7.1),
  ('ROBERTA MONTEIRO FORTUNA','Geografia',8.7,8.3),
  ('ROBERTA MONTEIRO FORTUNA','Geografia Politica',9.2,8.5),
  ('ROBERTA MONTEIRO FORTUNA','Geografia Fisica',8.2,8.2),
  ('ROBERTA MONTEIRO FORTUNA','Historia',7.9,9.0),
  ('ROBERTA MONTEIRO FORTUNA','Historia Geral',8.0,9.3),
  ('ROBERTA MONTEIRO FORTUNA','Historia do Brasil',7.9,8.7),
  ('ROBERTA MONTEIRO FORTUNA','Fisica',8.7,5.7),
  ('ROBERTA MONTEIRO FORTUNA','Fisica Frente A',10.0,3.7),
  ('ROBERTA MONTEIRO FORTUNA','Matematica',7.3,7.6),
  ('ROBERTA MONTEIRO FORTUNA','Matem Frente B/C',6.5,8.8),
  ('ROBERTA MONTEIRO FORTUNA','Matem Frente A',7.1,5.1),
  ('ROBERTA MONTEIRO FORTUNA','Matem Frente D',8.5,8.9),
  ('ROBERTA MONTEIRO FORTUNA','Fisica Frente B',7.4,7.7),
  ('ROBERTA MONTEIRO FORTUNA','Biologia',8.5,8.8),
  ('ROBERTA MONTEIRO FORTUNA','Biologia Frente A',9.4,7.6),
  ('ROBERTA MONTEIRO FORTUNA','Biologia Frente B',7.6,10.0),
  ('ROBERTA MONTEIRO FORTUNA','Historia da Arte',8.2,10.0),
  ('ROBERTA MONTEIRO FORTUNA','Lingua Portuguesa',8.4,7.9),
  ('ROBERTA MONTEIRO FORTUNA','Educacao Fisica',10.0,9.0),
  ('ROBERTA MONTEIRO FORTUNA','Ingles',9.5,10.0),
  ('RODRIGO OTAVIO VAZ ARAUJO','Filosofia',9.3,10.0),
  ('RODRIGO OTAVIO VAZ ARAUJO','Projeto de Vida',10.0,10.0),
  ('RODRIGO OTAVIO VAZ ARAUJO','Sociologia',10.0,8.0),
  ('RODRIGO OTAVIO VAZ ARAUJO','Redacao',8.0,9.1),
  ('RODRIGO OTAVIO VAZ ARAUJO','Espanhol',10.0,10.0),
  ('RODRIGO OTAVIO VAZ ARAUJO','Literatura',9.0,8.7),
  ('RODRIGO OTAVIO VAZ ARAUJO','Quimica',7.8,7.0),
  ('RODRIGO OTAVIO VAZ ARAUJO','Quimica Frente A',8.7,7.5),
  ('RODRIGO OTAVIO VAZ ARAUJO','Quimica Frente B',7.0,6.5),
  ('RODRIGO OTAVIO VAZ ARAUJO','Geografia',7.8,7.1),
  ('RODRIGO OTAVIO VAZ ARAUJO','Geografia Politica',8.1,8.0),
  ('RODRIGO OTAVIO VAZ ARAUJO','Geografia Fisica',7.5,6.3),
  ('RODRIGO OTAVIO VAZ ARAUJO','Historia',6.7,8.8),
  ('RODRIGO OTAVIO VAZ ARAUJO','Historia Geral',7.4,9.9),
  ('RODRIGO OTAVIO VAZ ARAUJO','Historia do Brasil',6.0,7.8),
  ('RODRIGO OTAVIO VAZ ARAUJO','Fisica',6.2,6.2),
  ('RODRIGO OTAVIO VAZ ARAUJO','Fisica Frente A',7.3,4.9),
  ('RODRIGO OTAVIO VAZ ARAUJO','Matematica',6.8,7.6),
  ('RODRIGO OTAVIO VAZ ARAUJO','Matem Frente B/C',6.0,8.1),
  ('RODRIGO OTAVIO VAZ ARAUJO','Matem Frente A',5.8,5.7),
  ('RODRIGO OTAVIO VAZ ARAUJO','Matem Frente D',8.6,9.0),
  ('RODRIGO OTAVIO VAZ ARAUJO','Fisica Frente B',5.1,7.5),
  ('RODRIGO OTAVIO VAZ ARAUJO','Biologia',8.4,9.6),
  ('RODRIGO OTAVIO VAZ ARAUJO','Biologia Frente A',9.0,9.2),
  ('RODRIGO OTAVIO VAZ ARAUJO','Biologia Frente B',7.9,10.0),
  ('RODRIGO OTAVIO VAZ ARAUJO','Historia da Arte',7.4,8.1),
  ('RODRIGO OTAVIO VAZ ARAUJO','Lingua Portuguesa',8.7,7.2),
  ('RODRIGO OTAVIO VAZ ARAUJO','Educacao Fisica',10.0,10.0),
  ('RODRIGO OTAVIO VAZ ARAUJO','Ingles',8.0,10.0),
  ('TACIO DENNER GOMES FILHO','Filosofia',7.3,8.0),
  ('TACIO DENNER GOMES FILHO','Projeto de Vida',10.0,10.0),
  ('TACIO DENNER GOMES FILHO','Sociologia',8.3,7.0),
  ('TACIO DENNER GOMES FILHO','Redacao',7.0,7.1),
  ('TACIO DENNER GOMES FILHO','Espanhol',10.0,10.0),
  ('TACIO DENNER GOMES FILHO','Literatura',6.6,7.6),
  ('TACIO DENNER GOMES FILHO','Quimica',6.4,7.6),
  ('TACIO DENNER GOMES FILHO','Quimica Frente A',8.8,8.6),
  ('TACIO DENNER GOMES FILHO','Quimica Frente B',4.0,6.7),
  ('TACIO DENNER GOMES FILHO','Geografia',6.8,7.0),
  ('TACIO DENNER GOMES FILHO','Geografia Politica',8.0,6.8),
  ('TACIO DENNER GOMES FILHO','Geografia Fisica',5.7,7.2),
  ('TACIO DENNER GOMES FILHO','Historia',5.9,7.3),
  ('TACIO DENNER GOMES FILHO','Historia Geral',6.6,9.0),
  ('TACIO DENNER GOMES FILHO','Historia do Brasil',5.3,5.6),
  ('TACIO DENNER GOMES FILHO','Fisica',3.8,7.0),
  ('TACIO DENNER GOMES FILHO','Fisica Frente A',4.6,7.5),
  ('TACIO DENNER GOMES FILHO','Matematica',5.0,6.1),
  ('TACIO DENNER GOMES FILHO','Matem Frente B/C',4.6,4.4),
  ('TACIO DENNER GOMES FILHO','Matem Frente A',2.4,7.0),
  ('TACIO DENNER GOMES FILHO','Matem Frente D',8.0,7.0),
  ('TACIO DENNER GOMES FILHO','Fisica Frente B',3.1,6.5),
  ('TACIO DENNER GOMES FILHO','Biologia',7.0,8.8),
  ('TACIO DENNER GOMES FILHO','Biologia Frente A',8.5,9.7),
  ('TACIO DENNER GOMES FILHO','Biologia Frente B',5.6,8.0),
  ('TACIO DENNER GOMES FILHO','Historia da Arte',6.8,5.6),
  ('TACIO DENNER GOMES FILHO','Lingua Portuguesa',8.1,7.6),
  ('TACIO DENNER GOMES FILHO','Educacao Fisica',10.0,9.0),
  ('TACIO DENNER GOMES FILHO','Ingles',8.0,9.0),
  ('VITORIA GABRIELE MENEZES MORAIS','Filosofia',7.7,8.0),
  ('VITORIA GABRIELE MENEZES MORAIS','Projeto de Vida',10.0,9.5),
  ('VITORIA GABRIELE MENEZES MORAIS','Sociologia',10.0,10.0),
  ('VITORIA GABRIELE MENEZES MORAIS','Redacao',8.0,8.8),
  ('VITORIA GABRIELE MENEZES MORAIS','Espanhol',10.0,10.0),
  ('VITORIA GABRIELE MENEZES MORAIS','Literatura',10.0,9.2),
  ('VITORIA GABRIELE MENEZES MORAIS','Quimica',7.7,8.9),
  ('VITORIA GABRIELE MENEZES MORAIS','Quimica Frente A',null,8.9),
  ('VITORIA GABRIELE MENEZES MORAIS','Quimica Frente B',7.7,9.0),
  ('VITORIA GABRIELE MENEZES MORAIS','Geografia',7.5,8.2),
  ('VITORIA GABRIELE MENEZES MORAIS','Geografia Politica',null,8.7),
  ('VITORIA GABRIELE MENEZES MORAIS','Geografia Fisica',7.5,7.7),
  ('VITORIA GABRIELE MENEZES MORAIS','Historia',8.5,8.2),
  ('VITORIA GABRIELE MENEZES MORAIS','Historia Geral',8.5,7.5),
  ('VITORIA GABRIELE MENEZES MORAIS','Historia do Brasil',null,8.9),
  ('VITORIA GABRIELE MENEZES MORAIS','Fisica',8.0,8.7),
  ('VITORIA GABRIELE MENEZES MORAIS','Fisica Frente A',null,9.0),
  ('VITORIA GABRIELE MENEZES MORAIS','Matematica',7.5,8.7),
  ('VITORIA GABRIELE MENEZES MORAIS','Matem Frente B/C',8.0,9.0),
  ('VITORIA GABRIELE MENEZES MORAIS','Matem Frente A',null,9.2),
  ('VITORIA GABRIELE MENEZES MORAIS','Matem Frente D',8.0,8.0),
  ('VITORIA GABRIELE MENEZES MORAIS','Fisica Frente B',null,8.5),
  ('VITORIA GABRIELE MENEZES MORAIS','Biologia',9.0,9.0),
  ('VITORIA GABRIELE MENEZES MORAIS','Biologia Frente A',9.0,9.0),
  ('VITORIA GABRIELE MENEZES MORAIS','Biologia Frente B',null,null),
  ('VITORIA GABRIELE MENEZES MORAIS','Historia da Arte',null,8.5),
  ('VITORIA GABRIELE MENEZES MORAIS','Lingua Portuguesa',null,8.9),
  ('VITORIA GABRIELE MENEZES MORAIS','Educacao Fisica',10.0,9.0),
  ('VITORIA GABRIELE MENEZES MORAIS','Ingles',8.0,10.0),
  ('KARINE SILVA MATIAS','Filosofia',9.0,10.0),
  ('KARINE SILVA MATIAS','Projeto de Vida',null,null),
  ('KARINE SILVA MATIAS','Sociologia',8.7,6.0),
  ('KARINE SILVA MATIAS','Redacao',null,null),
  ('KARINE SILVA MATIAS','Espanhol',null,null),
  ('KARINE SILVA MATIAS','Literatura',null,null),
  ('KARINE SILVA MATIAS','Quimica',7.7,6.1),
  ('KARINE SILVA MATIAS','Quimica Frente A',7.7,6.1),
  ('KARINE SILVA MATIAS','Quimica Frente B',7.7,6.1),
  ('KARINE SILVA MATIAS','Geografia',8.1,7.4),
  ('KARINE SILVA MATIAS','Geografia Politica',8.1,7.4),
  ('KARINE SILVA MATIAS','Geografia Fisica',8.1,7.4),
  ('KARINE SILVA MATIAS','Historia',9.8,8.3),
  ('KARINE SILVA MATIAS','Historia Geral',9.8,8.3),
  ('KARINE SILVA MATIAS','Historia do Brasil',9.8,8.3),
  ('KARINE SILVA MATIAS','Fisica',8.1,7.9),
  ('KARINE SILVA MATIAS','Fisica Frente A',8.1,7.9),
  ('KARINE SILVA MATIAS','Matematica',6.7,7.3),
  ('KARINE SILVA MATIAS','Matem Frente B/C',6.7,7.3),
  ('KARINE SILVA MATIAS','Matem Frente A',6.7,7.3),
  ('KARINE SILVA MATIAS','Matem Frente D',6.7,7.3),
  ('KARINE SILVA MATIAS','Fisica Frente B',8.1,7.9),
  ('KARINE SILVA MATIAS','Biologia',9.0,7.0),
  ('KARINE SILVA MATIAS','Biologia Frente A',9.0,7.0),
  ('KARINE SILVA MATIAS','Biologia Frente B',9.0,7.0),
  ('KARINE SILVA MATIAS','Historia da Arte',9.8,8.3),
  ('KARINE SILVA MATIAS','Lingua Portuguesa',9.0,9.8),
  ('KARINE SILVA MATIAS','Educacao Fisica',9.0,9.4),
  ('KARINE SILVA MATIAS','Ingles',8.9,7.5);

create temp table stg_turma_alvo_1serie (turma_id uuid) on commit drop;

insert into stg_turma_alvo_1serie (turma_id)
select m.turma_id
from stg_boletim_1serie_a s
join alunos al on pg_temp.norm_nome(al.nome) = pg_temp.norm_nome(s.aluno_nome)
join matriculas m on m.aluno_id = al.id and m.ano_letivo = 2026
group by m.turma_id
order by count(*) desc
limit 1;

do $$
begin
  if (select count(*) from stg_turma_alvo_1serie) <> 1 then
    raise exception 'nao foi possivel resolver uma unica turma para os alunos do boletim (1a SERIE EM A)';
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
from stg_boletim_1serie_a s
join disciplinas d on d.serie_id = '17061e9e-2a34-485a-ba11-bd061458fbf8' and d.nome = s.disciplina
cross join stg_turma_alvo_1serie t
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
from stg_boletim_1serie_a s
join alunos al on pg_temp.norm_nome(al.nome) = pg_temp.norm_nome(s.aluno_nome)
cross join stg_turma_alvo_1serie t
join matriculas m on m.aluno_id = al.id and m.ano_letivo = 2026 and m.turma_id = t.turma_id
join disciplinas d on d.serie_id = '17061e9e-2a34-485a-ba11-bd061458fbf8' and d.nome = s.disciplina
join avaliacoes a on a.turma_id = t.turma_id and a.disciplina_id = d.id
  and a.bimestre = 1 and a.ano_letivo = 2026 and a.titulo = 'Media Bimestral'
where s.b1 is not null
on conflict (avaliacao_id, aluno_id) do update set valor = excluded.valor;

insert into notas (escola_id, avaliacao_id, aluno_id, matricula_id, valor)
select '00000000-0000-0000-0000-000000000001'::uuid, a.id, al.id, m.id, s.b2
from stg_boletim_1serie_a s
join alunos al on pg_temp.norm_nome(al.nome) = pg_temp.norm_nome(s.aluno_nome)
cross join stg_turma_alvo_1serie t
join matriculas m on m.aluno_id = al.id and m.ano_letivo = 2026 and m.turma_id = t.turma_id
join disciplinas d on d.serie_id = '17061e9e-2a34-485a-ba11-bd061458fbf8' and d.nome = s.disciplina
join avaliacoes a on a.turma_id = t.turma_id and a.disciplina_id = d.id
  and a.bimestre = 2 and a.ano_letivo = 2026 and a.titulo = 'Media Bimestral'
where s.b2 is not null
on conflict (avaliacao_id, aluno_id) do update set valor = excluded.valor;
