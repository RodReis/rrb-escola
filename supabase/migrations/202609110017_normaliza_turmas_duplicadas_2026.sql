-- Normaliza turmas duplicadas de 2026.
--
-- Seis turmas ("MAT", "A", "B") duplicam a turma canonica MATUTINO da propria
-- serie: mesma serie, mesmo turno, nome fora do padrao. Elas poluem os filtros
-- de Serie/Turma e dividem alunos que na pratica estao na mesma sala.
--
-- Move as matriculas de 2026 para a turma canonica de mesma serie+turno e
-- desativa as duplicadas. Nao apaga nenhuma turma: o historico de anos
-- anteriores continua apontando para os mesmos ids.
begin;

-- Turmas duplicadas de 2026 e seu destino canonico (mesma serie, mesmo turno).
create temporary table _turmas_dup on commit drop as
with turmas_2026 as (
  select id, nome, turno, serie_id
  from turmas
  where ano_letivo = 2026
),
canonicas as (
  select serie_id,
         turno,
         count(*) as qtd,
         (array_agg(id order by id))[1] as destino_id
  from turmas_2026
  where upper(nome) in ('MATUTINO', 'VESPERTINO')
  group by serie_id, turno
)
select d.id as dup_id, c.destino_id, c.qtd as qtd_canonicas
from turmas_2026 d
join canonicas c on c.serie_id = d.serie_id and c.turno = d.turno
where upper(d.nome) not in ('MATUTINO', 'VESPERTINO');

-- Duas canonicas no mesmo turno tornam o destino ambiguo: aborta.
do $$
declare
  ambiguas int;
begin
  select count(*) into ambiguas from _turmas_dup where qtd_canonicas > 1;
  if ambiguas > 0 then
    raise exception
      'Ha % turma(s) duplicada(s) com mais de uma turma canonica no mesmo turno. Destino ambiguo.',
      ambiguas;
  end if;
end $$;

-- Sem destino canonico a turma nao pode ser mesclada: aborta em vez de orfanar alunos.
do $$
declare
  sem_destino int;
begin
  select count(*) into sem_destino
  from turmas t
  where t.ano_letivo = 2026
    and t.ativo
    and upper(t.nome) not in ('MATUTINO', 'VESPERTINO')
    and not exists (select 1 from _turmas_dup d where d.dup_id = t.id);
  if sem_destino > 0 then
    raise exception
      'Ha % turma(s) fora do padrao sem turma canonica de mesmo turno. Revise antes de migrar.',
      sem_destino;
  end if;
end $$;

update matriculas m
set turma_id = d.destino_id,
    updated_at = now()
from _turmas_dup d
where m.turma_id = d.dup_id
  and m.ano_letivo = 2026;

update turmas t
set ativo = false,
    updated_at = now()
from _turmas_dup d
where t.id = d.dup_id;

-- Nenhuma matricula de 2026 pode ter sobrado numa turma desativada.
do $$
declare
  restantes int;
begin
  select count(*) into restantes
  from matriculas m
  join _turmas_dup d on d.dup_id = m.turma_id
  where m.ano_letivo = 2026;
  if restantes > 0 then
    raise exception 'Restaram % matricula(s) de 2026 em turma duplicada.', restantes;
  end if;
end $$;

commit;
