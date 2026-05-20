-- Cria matriculas 2026 (tipo_vaga=bolsa_integral) para os 33 ex-alunos identificados como bolsistas.
-- Estrategia: para cada aluno sem matricula ativa, pega a ultima matricula concluida e progride
-- (anos_ate_2026 = 2026 - ano_concluido) series. Turno default = MATUTINO.
-- Aluno cuja serie projetada nao existe (ex: 3a SERIE concluida em 2025 -> formado) e ignorado.

-- Tabela auxiliar de progressao
create temp table progressao (de text, para text);
insert into progressao values
  ('MATERNAL',    'INFANTIL2'),
  ('INFANTIL2',   'INFANTIL3'),
  ('INFANTIL3',   'INFANTIL4'),
  ('INFANTIL4',   '1º ANO'),
  ('1º ANO',      '2º ANO'),
  ('2º ANO',      '3º ANO'),
  ('3º ANO',      '4º ANO'),
  ('4º ANO',      '5º ANO'),
  ('5º ANO',      '6º ANO'),
  ('6º ANO',      '7º ANO'),
  ('7º ANO',      '8º ANO'),
  ('8º ANO',      '9º ANO'),
  ('9º ANO',      '1ª SÉRIE'),
  ('1ª SÉRIE',    '2ª SÉRIE'),
  ('2ª SÉRIE',    '3ª SÉRIE'),
  ('3ª SÉRIE',    null);  -- formado

-- Funcao recursiva: aplica progressao N vezes
create or replace function progredir(serie_atual text, n int)
returns text language plpgsql as $$
declare
  s text := serie_atual;
  i int := 0;
begin
  while i < n and s is not null loop
    select para into s from progressao where de = s;
    i := i + 1;
  end loop;
  return s;
end;
$$;

-- Insert: nova matricula 2026 com tipo_vaga=bolsa_integral
with ex_alunos as (
  select distinct on (m.aluno_id)
    a.id as aluno_id,
    a.matricula_codigo,
    s_old.nome as serie_antiga,
    m.ano_letivo as ano_concluido,
    m.plano_id
  from alunos a
  join matriculas m on m.aluno_id = a.id and m.status = 'concluida'
  join series s_old on s_old.id = m.serie_id
  where a.escola_id = '00000000-0000-0000-0000-000000000001'
    and not exists (
      select 1 from matriculas mx where mx.aluno_id = a.id and mx.status = 'ativa'
    )
  order by m.aluno_id, m.ano_letivo desc, m.created_at desc
),
projecao as (
  select
    e.aluno_id,
    e.matricula_codigo,
    e.plano_id,
    progredir(e.serie_antiga, 2026 - e.ano_concluido) as serie_2026_nome
  from ex_alunos e
),
alvo as (
  select
    p.aluno_id,
    p.matricula_codigo,
    p.plano_id,
    s.id as serie_id,
    s.nome as serie_nome,
    -- pega 1a turma 2026 matutino disponivel da serie
    (
      select t.id from turmas t
      where t.serie_id = s.id
        and t.ano_letivo = 2026
        and t.ativo = true
        and t.escola_id = '00000000-0000-0000-0000-000000000001'
      order by case when t.nome = 'MATUTINO' then 0 else 1 end
      limit 1
    ) as turma_id
  from projecao p
  join series s on s.nome = p.serie_2026_nome
  where p.serie_2026_nome is not null
)
insert into matriculas (
  escola_id, aluno_id, serie_id, turma_id, plano_id,
  codigo, data_matricula, ano_letivo, status, tipo_vaga, percentual_bolsa
)
select
  '00000000-0000-0000-0000-000000000001',
  a.aluno_id,
  a.serie_id,
  a.turma_id,
  coalesce(a.plano_id, (
    select id from planos
    where escola_id = '00000000-0000-0000-0000-000000000001'
    order by valor_mensalidade desc
    limit 1
  )),
  coalesce(a.matricula_codigo, '') || '-2026-BOLSA',
  '2026-01-01',
  2026,
  'ativa',
  'bolsa_integral',
  0
from alvo a
where a.turma_id is not null;

drop function if exists progredir(text, int);
