-- Organograma: séries sem segmento_id somem da árvore inteira.
--
-- `series.segmento_id` foi adicionado como coluna nullable em
-- 202605220001_segmentos.sql, sem backfill obrigatório. A query do organograma
-- (src/lib/data/organograma.ts) descarta série com segmento_id NULL, então a
-- série e TODOS os alunos dela desapareciam da visão — sem erro, sem aviso.
--
-- Efeito observado em produção: INFANTIL5 (39 alunos ativos) fora da árvore,
-- fazendo o total exibir 480 em vez de 519 matrículas ativas.

-- 1) Backfill das séries órfãs, casando pelo prefixo do nome.
update series s
set segmento_id = seg.id
from segmentos seg
where s.segmento_id is null
  and seg.escola_id = s.escola_id
  and seg.nome = case
    when s.nome like 'INFANTIL%' or s.nome like 'MATERNAL%' then 'Educação Infantil'
    when s.nome in ('1º ANO', '2º ANO', '3º ANO', '4º ANO', '5º ANO')  then 'Ensino Fundamental I'
    when s.nome in ('6º ANO', '7º ANO', '8º ANO', '9º ANO')            then 'Ensino Fundamental II'
    when s.nome like '%SÉRIE'                                          then 'Ensino Médio'
  end;

-- 2) Trava para não repetir o defeito: série ativa precisa de segmento.
--    Série inativa pode ficar órfã (histórico), por isso o NOT VALID +
--    validação só do estado corrente.
alter table series
  drop constraint if exists series_ativa_exige_segmento;

alter table series
  add constraint series_ativa_exige_segmento
  check (ativo is not true or segmento_id is not null)
  not valid;

alter table series validate constraint series_ativa_exige_segmento;
