-- Reclassifica alunos que estavam como 'concluida' mas conceitualmente são ativos sem cobrança.
-- Default: bolsa_integral (refinar caso-a-caso via UI depois).
-- Critério: aluno SEM matrícula ativa MAS com matrícula concluida — toma a mais recente.

with bolsistas_candidatos as (
  select distinct on (m.aluno_id) m.id
  from matriculas m
  where m.escola_id = '00000000-0000-0000-0000-000000000001'
    and m.status = 'concluida'
    and not exists (
      select 1 from matriculas mx
      where mx.aluno_id = m.aluno_id and mx.status = 'ativa'
    )
  order by m.aluno_id, m.created_at desc
)
update matriculas
  set status = 'ativa', tipo_vaga = 'bolsa_integral'
  where id in (select id from bolsistas_candidatos);
