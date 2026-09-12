-- Corrige ano_letivo de matriculas ativas gravadas como 2025.
--
-- Tres matriculas ficaram com ano_letivo = 2025 embora apontem para turma de
-- 2026 e tenham data_matricula em 2026-01-01: o ano foi digitado errado no
-- cadastro, nao e historico. Como varias consultas contam matricula ativa sem
-- filtrar ano, elas inflavam os totais do ano corrente (o card "Visao geral
-- pedagogica" somava 507 em vez de 504).
--
-- Criterio, deliberadamente estreito: so corrige matricula ativa cujo
-- ano_letivo diverge do ano_letivo da turma para a qual ela aponta. Matricula
-- de ano anterior com turma do mesmo ano e historico legitimo e nao e tocada.
begin;

-- Nao pode existir outra matricula do mesmo aluno no ano de destino: corrigir
-- o ano criaria duas matriculas concorrentes para o mesmo aluno no mesmo ano.
do $$
declare
  conflitos int;
begin
  select count(*) into conflitos
  from matriculas m
  join turmas t on t.id = m.turma_id
  where m.status = 'ativa'
    and m.ano_letivo <> t.ano_letivo
    and exists (
      select 1 from matriculas outra
      where outra.aluno_id = m.aluno_id
        and outra.ano_letivo = t.ano_letivo
        and outra.id <> m.id
    );
  if conflitos > 0 then
    raise exception
      'Ha % matricula(s) cujo aluno ja possui matricula no ano de destino. Revise manualmente.',
      conflitos;
  end if;
end $$;

update matriculas m
set ano_letivo = t.ano_letivo,
    updated_at = now()
from turmas t
where t.id = m.turma_id
  and m.status = 'ativa'
  and m.ano_letivo <> t.ano_letivo;

-- Nenhuma matricula ativa pode continuar divergindo do ano da propria turma.
do $$
declare
  restantes int;
begin
  select count(*) into restantes
  from matriculas m
  join turmas t on t.id = m.turma_id
  where m.status = 'ativa'
    and m.ano_letivo <> t.ano_letivo;
  if restantes > 0 then
    raise exception 'Restaram % matricula(s) ativa(s) com ano divergente da turma.', restantes;
  end if;
end $$;

commit;
