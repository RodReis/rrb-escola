-- supabase/migrations/202609240013_rpc_cancelar_matricula_has_permission.sql
--
-- Defesa em profundidade (achado I6 da revisão final): a RPC cancelar_matricula
-- só validava perfil ativo, nunca a permissão em si — a Server Action já chama
-- requirePermission("matriculas", "update") antes, mas a RPC é security definer
-- e pode ser chamada diretamente, então checa de novo aqui.
--
-- has_permission(p_modulo text, p_acao text) já existe (202605300001_rbac_permissoes.sql),
-- lê o perfil da sessão via auth.uid() internamente — não recebe id de perfil.

create or replace function cancelar_matricula(
  p_matricula_id uuid,
  p_data date,
  p_motivo text,
  p_obs text,
  p_ciente_coordenacao boolean,
  p_ciente_diretoria boolean,
  p_isaac_cancelado_confirmado boolean,
  p_cobranca_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_perfil     perfis%rowtype;
  v_matricula  matriculas%rowtype;
begin
  select * into v_perfil from current_perfil();
  if v_perfil.id is null then
    return jsonb_build_object('ok', false, 'error', 'Sessão sem perfil ativo.');
  end if;

  if not has_permission('matriculas', 'update') then
    return jsonb_build_object('ok', false, 'error', 'Sem permissão.');
  end if;

  select * into v_matricula
  from matriculas
  where id = p_matricula_id and escola_id = v_perfil.escola_id;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'Matrícula não encontrada.');
  end if;

  if v_matricula.status <> 'ativa' then
    return jsonb_build_object('ok', false, 'error', 'Matrícula não está ativa.');
  end if;

  if not p_ciente_coordenacao or not p_ciente_diretoria then
    return jsonb_build_object('ok', false, 'error', 'Confirme ciência da coordenação e da diretoria.');
  end if;

  if p_motivo not in ('transferencia', 'desistencia', 'mudanca_cidade', 'inadimplencia', 'outro') then
    return jsonb_build_object('ok', false, 'error', 'Motivo inválido.');
  end if;

  update matriculas set
    status = 'cancelada',
    cancelamento_data = p_data,
    cancelamento_motivo = p_motivo,
    cancelamento_obs = p_obs,
    cancelado_por = v_perfil.id,
    ciente_coordenacao = p_ciente_coordenacao,
    ciente_diretoria = p_ciente_diretoria,
    isaac_cancelado_confirmado = p_isaac_cancelado_confirmado
  where id = p_matricula_id;

  -- Cancela só as cobranças explicitamente marcadas — nunca mexe em
  -- pagamentos já registrados (cobrança cancelada mantém seu histórico).
  if p_cobranca_ids is not null and array_length(p_cobranca_ids, 1) > 0 then
    update cobrancas set status = 'cancelada'
    where id = any(p_cobranca_ids)
      and escola_id = v_perfil.escola_id
      and aluno_id = v_matricula.aluno_id;
  end if;

  update alunos set ativo = false
  where id = v_matricula.aluno_id and escola_id = v_perfil.escola_id;

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function cancelar_matricula(uuid, date, text, text, boolean, boolean, boolean, uuid[]) to authenticated;
