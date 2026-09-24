-- Correções da rodada 2 de revisão sobre `classificar_debito`
-- (202609240004_classificar_debito_rpc.sql):
--
--   1. [HIGH] A rodada 1 removeu a edição de competência (D3) do fluxo: a RPC
--      sempre usava to_char(data,'YYYY-MM') por movimento, sem opção de
--      sobrescrever. Isso quebra o caso real "pró-labore de março pago em
--      abril" — o brief pede exatamente essa edição. Novo parâmetro opcional
--      p_competencia: preenchido, vale para TODOS os movimentos do lote;
--      null (padrão), mantém o comportamento por movimento já corrigido na
--      rodada 1 (mês da própria data de cada um).
--   2. [MEDIUM] O select de dedup de regra não filtrava `ativo`, então
--      reaproveitava silenciosamente uma regra DESATIVADA (o usuário achava
--      que tinha criado uma regra nova ativa, mas o id devolvido era de uma
--      regra morta que continuava morta). Escolhido: quando a regra
--      encontrada está inativa, REATIVA-LA (`update ... set ativo = true`)
--      em vez de criar uma segunda linha com os mesmos parâmetros — é a opção
--      mais simples das duas que o brief autorizou, e evita duas regras
--      "iguais" (uma ativa, uma morta) coexistindo pro mesmo
--      documento+categoria+janela.

-- `create or replace` só substitui no lugar quando a lista de parâmetros é
-- idêntica; acrescentar `p_competencia` no fim cria um SEGUNDO overload em
-- vez de substituir o de 9 argumentos da migration anterior. O drop evita as
-- duas versões coexistindo (o app sempre chamaria a nova por causa do
-- default, mas a antiga ficaria pendurada, exposta via grant, sem uso).
drop function if exists classificar_debito(uuid[], uuid, uuid, text, boolean, boolean, numeric, int, int);

create or replace function classificar_debito(
  p_extrato_ids uuid[],
  p_categoria_id uuid,
  p_company_id uuid,
  p_classe_despesa text,
  p_salvar_regra boolean default false,
  p_regra_so_desta_conta boolean default false,
  p_regra_valor_esperado numeric default null,
  p_regra_dia_inicio int default null,
  p_regra_dia_fim int default null,
  p_competencia text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_perfil        perfis%rowtype;
  v_linha         extrato_bancario%rowtype;
  v_primeira      extrato_bancario%rowtype;
  v_lancamento_id uuid;
  v_regra_id      uuid;
  v_regra_ativa   boolean;
  v_extrato_id    uuid;
  v_dia           int;
  v_competencia   text;
  v_classificados int := 0;
  v_fora_da_regra int := 0;
begin
  select * into v_perfil from current_perfil();
  if v_perfil.id is null then
    return jsonb_build_object('ok', false, 'error', 'Sessão sem perfil ativo.');
  end if;
  if v_perfil.perfil not in ('admin', 'financeiro') then
    return jsonb_build_object('ok', false, 'error', 'Sem permissão para classificar débitos.');
  end if;

  if p_categoria_id is null then
    return jsonb_build_object('ok', false, 'error', 'Categoria é obrigatória.');
  end if;
  if (p_regra_dia_inicio is null) <> (p_regra_dia_fim is null) then
    return jsonb_build_object('ok', false, 'error', 'Informe os dois dias da janela, ou nenhum.');
  end if;
  if p_regra_dia_inicio is not null and p_regra_dia_inicio > p_regra_dia_fim then
    return jsonb_build_object('ok', false, 'error', 'O dia inicial da janela não pode ser depois do dia final.');
  end if;
  -- competência, quando vem preenchida pelo formulário, precisa ser um mês
  -- válido (YYYY-MM) — um texto qualquer aqui quebraria to_date silenciosamente.
  if p_competencia is not null and p_competencia !~ '^\d{4}-\d{2}$' then
    return jsonb_build_object('ok', false, 'error', 'Competência inválida (use o formato AAAA-MM).');
  end if;

  -- Todo movimento do lote tem que ser débito pendente de UMA escola só —
  -- valida antes de gravar qualquer coisa (falha tudo, ou nada).
  if exists (
    select 1 from extrato_bancario
    where id = any(p_extrato_ids)
      and (tipo <> 'debito' or status_conciliacao <> 'pendente')
  ) then
    return jsonb_build_object('ok', false, 'error', 'Um ou mais movimentos não são débitos pendentes.');
  end if;
  if (select count(distinct escola_id) from extrato_bancario where id = any(p_extrato_ids)) > 1 then
    return jsonb_build_object('ok', false, 'error', 'Os movimentos do lote pertencem a escolas diferentes.');
  end if;

  -- D1: a regra só nasce de ação humana explícita, criada UMA VEZ por
  -- confirmação de grupo (não uma vez por movimento). idempotente: se o
  -- mesmo documento+janela já existir (ativa ou não), reusa em vez de
  -- duplicar — e reativa se estava desativada, em vez de fingir que criou
  -- uma regra nova que continuaria morta.
  if p_salvar_regra then
    select * into v_primeira from extrato_bancario where id = p_extrato_ids[1];

    if v_primeira.contraparte_doc is not null then
      select id, ativo into v_regra_id, v_regra_ativa
      from contraparte_regra
      where escola_id = v_primeira.escola_id
        and tipo_match = 'documento'
        and documento = v_primeira.contraparte_doc
        and categoria_id = p_categoria_id
        and coalesce(conta_id::text, '') = coalesce(case when p_regra_so_desta_conta then v_primeira.conta_id else null end::text, '')
        and coalesce(valor_esperado, -1) = coalesce(p_regra_valor_esperado, -1)
        and coalesce(dia_inicio, -1) = coalesce(p_regra_dia_inicio, -1)
        and coalesce(dia_fim, -1) = coalesce(p_regra_dia_fim, -1);

      if v_regra_id is null then
        insert into contraparte_regra (
          escola_id, tipo_match, documento, categoria_id, company_id, classe_despesa,
          conta_id, valor_esperado, dia_inicio, dia_fim, criado_por
        ) values (
          v_primeira.escola_id, 'documento', v_primeira.contraparte_doc, p_categoria_id, p_company_id, p_classe_despesa,
          case when p_regra_so_desta_conta then v_primeira.conta_id else null end,
          p_regra_valor_esperado, p_regra_dia_inicio, p_regra_dia_fim, v_perfil.id
        )
        returning id into v_regra_id;
      elsif not v_regra_ativa then
        update contraparte_regra set ativo = true where id = v_regra_id;
      end if;
    end if;
  end if;

  foreach v_extrato_id in array p_extrato_ids loop
    select * into v_linha from extrato_bancario where id = v_extrato_id for update;

    -- Se a regra tem valor/janela, cada movimento do lote precisa casar
    -- de fato — senão a classificação em grupo lançaria retirada
    -- extraordinária com a categoria do pró-labore só por estar no mesmo
    -- grupo de contraparte. Movimento fora da janela fica de fora do lote.
    if p_regra_valor_esperado is not null
       and round(v_linha.valor * 100) <> round(p_regra_valor_esperado * 100) then
      v_fora_da_regra := v_fora_da_regra + 1;
      continue;
    end if;
    if p_regra_dia_inicio is not null then
      v_dia := extract(day from v_linha.data);
      if v_dia < p_regra_dia_inicio or v_dia > p_regra_dia_fim then
        v_fora_da_regra := v_fora_da_regra + 1;
        continue;
      end if;
    end if;

    -- D3: competência editável. Preenchida, vale para o lote inteiro (uso
    -- típico: um movimento só, mês diferente do pagamento). Vazia, cada
    -- movimento usa o mês da SUA PRÓPRIA data.
    v_competencia := coalesce(p_competencia, to_char(v_linha.data, 'YYYY-MM'));

    insert into lancamento_financeiro (
      escola_id, tipo, competencia, descricao, categoria_id, company_id, classe_despesa,
      contraparte, valor, data_vencimento, data_pagamento, status,
      origem_tipo, origem_id, criado_por
    ) values (
      v_linha.escola_id, 'despesa', v_competencia,
      coalesce(v_linha.descricao, 'Débito Sicoob'), p_categoria_id, p_company_id, p_classe_despesa,
      v_linha.contraparte_doc, abs(v_linha.valor), v_linha.data, v_linha.data, 'paga',
      'extrato', v_linha.id, v_perfil.id
    )
    on conflict (origem_tipo, origem_id) where origem_tipo = 'extrato' and origem_id is not null
    do update set
      categoria_id   = excluded.categoria_id,
      company_id     = excluded.company_id,
      classe_despesa = excluded.classe_despesa,
      competencia    = excluded.competencia
    returning id into v_lancamento_id;

    insert into conciliacao_vinculo (extrato_id, alvo_tipo, alvo_id, valor, origem, criado_por)
    values (v_linha.id, 'lancamento', v_lancamento_id, abs(v_linha.valor), 'manual', v_perfil.id)
    on conflict (extrato_id, alvo_tipo, alvo_id) do nothing;

    update extrato_bancario set status_conciliacao = 'manual' where id = v_linha.id;

    v_classificados := v_classificados + 1;
  end loop;

  return jsonb_build_object(
    'ok', true,
    'classificados', v_classificados,
    'fora_da_regra', v_fora_da_regra,
    'regra_id', v_regra_id
  );
end;
$$;

grant execute on function classificar_debito(uuid[], uuid, uuid, text, boolean, boolean, numeric, int, int, text) to authenticated;
