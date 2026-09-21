-- Adiciona a rubrica salario_base ao perfil clt_professor.
-- Professores cadastrados como mensalistas (salario_base preenchido) estavam
-- com proventos zerados porque o perfil so tinha hora_aula (que exige
-- valor_hora_aula + aulas_semanais). Mantem hora_aula para horistas; quem
-- tiver apenas salario_base passa a calcular por ele.
-- Idempotente.

insert into folha_perfis_rubricas (perfil_id, rubrica_id, ordem_execucao, automatica)
select p.id, r.id, 5, true
from folha_perfis_calculo p
cross join folha_rubricas r
where p.codigo = 'clt_professor'
  and r.codigo = 'salario_base'
  and p.escola_id = r.escola_id
  and not exists (
    select 1 from folha_perfis_rubricas pr
    where pr.perfil_id = p.id and pr.rubrica_id = r.id
  );
