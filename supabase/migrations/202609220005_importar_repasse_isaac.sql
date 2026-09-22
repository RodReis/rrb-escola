-- RPC transacional do importador de repasse isaac.
--
-- Recebe o repasse inteiro já parseado e validado no servidor (analítico .xlsx
-- + resumo .pdf) e grava tudo numa transação: ou o mês entra completo, ou não
-- entra. É o que a importação de alunos não tem — lá o laço grava linha a linha
-- e uma falha no meio deixa metade do lote dentro.
--
-- Não decide nada: quem classifica pendência, casa aluno e confere fechamento é
-- o TypeScript, que tem os parsers testados. Aqui só grava, e recusa o que
-- violar invariante.
--
-- Ref: docs/superpowers/specs/2026-09-21-financeiro-isaac-multicnpj-design.md

create or replace function importar_repasse_isaac(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_perfil            perfis%rowtype;
  v_unidade           isaac_unidade%rowtype;
  v_repasse_id        uuid;
  v_competencia       text;
  v_data_repasse      date;
  v_parcela           jsonb;
  v_linha             jsonb;
  v_aluno_id          uuid;
  v_matricula         matriculas%rowtype;
  v_cobranca_id       uuid;
  v_pagamento_id      uuid;
  v_categoria_id      uuid;
  v_categoria_taxa    uuid;
  v_categoria_credito uuid;
  v_escola_id         uuid;
  v_company_id        uuid;
  v_valor_base        numeric(12,2);
  v_motivo            text;
  v_credito           numeric(12,2);
  v_taxa_total        numeric(12,2);
  v_cobrancas         int := 0;
  v_pendencias        int := 0;
  v_parcelas          int := 0;
begin
  -- current_perfil() é `returns perfis` e, sem sessão, devolve UMA linha de
  -- nulos em vez de zero linhas — `found` fica true e um guard baseado nele
  -- passa direto. Por isso o teste é sobre o id, não sobre found.
  select * into v_perfil from current_perfil();
  if v_perfil.id is null then
    return jsonb_build_object('ok', false, 'error', 'Sessão sem perfil ativo.');
  end if;
  if v_perfil.perfil not in ('admin', 'financeiro') then
    return jsonb_build_object('ok', false, 'error', 'Sem permissão para importar repasse.');
  end if;

  select * into v_unidade
  from isaac_unidade
  where id = (p_payload->>'unidade_id')::uuid;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'Unidade isaac não encontrada.');
  end if;

  -- Guard cross-tenant: a unidade tem que ser da escola de quem importa.
  if v_unidade.escola_id is distinct from v_perfil.escola_id then
    return jsonb_build_object('ok', false, 'error', 'Unidade não pertence à sua escola.');
  end if;

  v_escola_id   := v_unidade.escola_id;
  v_company_id  := v_unidade.company_id;
  v_competencia := p_payload->>'competencia_repasse';
  v_data_repasse := (p_payload->>'data_repasse')::date;

  -- Reimport: apaga o repasse anterior desta unidade/competência e regrava.
  -- O cascade leva parcelas, linhas, mudanças e transferências. As cobranças
  -- NÃO são apagadas — elas são reconciliadas por (origem, id_externo) mais
  -- abaixo, senão o histórico de pagamento do aluno sumiria a cada reimport.
  select id into v_repasse_id
  from isaac_repasse
  where unidade_id = v_unidade.id and competencia_repasse = v_competencia;

  if v_repasse_id is not null then
    -- lancamento_financeiro referencia o repasse por origem_id sem FK, então o
    -- cascade não o alcança. Sem este delete, o reimport deixa os lançamentos
    -- do repasse anterior órfãos no razão e a despesa DOBRA a cada reimport —
    -- o crédito usa um uuid derivado do repasse, por isso os dois somem juntos.
    delete from lancamento_financeiro
    where origem_tipo = 'isaac'
      and origem_id in (v_repasse_id, md5(v_repasse_id::text || ':credito-curto-prazo')::uuid);

    delete from isaac_repasse where id = v_repasse_id;
  end if;

  insert into isaac_repasse (
    escola_id, unidade_id, competencia_repasse, data_repasse,
    bruto, ajustes, base, taxa, liquido,
    alunos_informados, cobrancas_informadas,
    arquivo_analitico_path, arquivo_resumo_path, importado_por
  ) values (
    v_escola_id, v_unidade.id, v_competencia, v_data_repasse,
    (p_payload->>'bruto')::numeric,
    (p_payload->>'ajustes')::numeric,
    (p_payload->>'base')::numeric,
    (p_payload->>'taxa')::numeric,
    (p_payload->>'liquido')::numeric,
    nullif(p_payload->>'alunos_informados', '')::int,
    nullif(p_payload->>'cobrancas_informadas', '')::int,
    nullif(p_payload->>'arquivo_analitico_path', ''),
    nullif(p_payload->>'arquivo_resumo_path', ''),
    v_perfil.id
  )
  returning id into v_repasse_id;

  -- Linhas do resumo (com sinal, como o PDF mostra).
  for v_linha in select * from jsonb_array_elements(coalesce(p_payload->'linhas', '[]'::jsonb))
  loop
    insert into isaac_repasse_linha (repasse_id, grupo, tipo, valor)
    values (v_repasse_id, v_linha->>'grupo', v_linha->>'tipo', (v_linha->>'valor')::numeric);
  end loop;

  -- Transferências programadas (dia 05 e dia 15).
  for v_linha in select * from jsonb_array_elements(coalesce(p_payload->'transferencias', '[]'::jsonb))
  loop
    insert into isaac_transferencia (repasse_id, data_prevista, valor)
    values (v_repasse_id, (v_linha->>'data')::date, (v_linha->>'valor')::numeric);
  end loop;

  -- Aba "Mudanças" do analítico, gravada como veio.
  for v_linha in select * from jsonb_array_elements(coalesce(p_payload->'mudancas', '[]'::jsonb))
  loop
    insert into isaac_mudanca (
      repasse_id, id_parcela, nome_isaac, produto, competencia, valor, data_mudanca, tipo
    ) values (
      v_repasse_id,
      v_linha->>'idParcela',
      v_linha->>'nomeIsaac',
      v_linha->>'produto',
      v_linha->>'competencia',
      (v_linha->>'valor')::numeric,
      nullif(v_linha->>'dataMudanca', '')::date,
      v_linha->>'tipo'
    );
  end loop;

  -- Categorias do razão, criadas sob demanda (mesmo padrão do trigger
  -- espelhar_pagamento_cobranca_razao).
  select id into v_categoria_taxa from categorias_financeiras
  where escola_id = v_escola_id and nome = 'Taxa isaac' and tipo = 'despesa';
  if v_categoria_taxa is null then
    insert into categorias_financeiras (escola_id, nome, tipo)
    values (v_escola_id, 'Taxa isaac', 'despesa')
    returning id into v_categoria_taxa;
  end if;

  ---------------------------------------------------------------------------
  -- Parcelas
  ---------------------------------------------------------------------------
  for v_parcela in select * from jsonb_array_elements(coalesce(p_payload->'parcelas', '[]'::jsonb))
  loop
    v_parcelas := v_parcelas + 1;
    v_aluno_id := nullif(v_parcela->>'alunoId', '')::uuid;
    v_motivo := nullif(v_parcela->>'motivoPendencia', '');
    v_valor_base := (v_parcela->>'valorBase')::numeric;
    v_cobranca_id := null;

    -- Só vira cobrança a parcela com aluno casado, sem pendência e com valor
    -- positivo. Valor <= 0 é estorno ou ajuste de centavo: fica registrado em
    -- isaac_parcela (o espelho do que o isaac mandou) mas não gera receita.
    if v_aluno_id is not null and v_motivo is null and v_valor_base > 0 then
      select * into v_matricula
      from matriculas
      where aluno_id = v_aluno_id
        and escola_id = v_escola_id
        and status = 'ativa'
      order by ano_letivo desc
      limit 1;

      -- Categoria pelo tipo do produto: material por segmento, mensalidade no
      -- balde único. O nome vem pronto do TS, que conhece a série do aluno.
      select id into v_categoria_id from categorias_financeiras
      where escola_id = v_escola_id
        and nome = coalesce(v_parcela->>'categoriaNome', 'Mensalidades')
        and tipo = 'receita';
      if v_categoria_id is null then
        insert into categorias_financeiras (escola_id, nome, tipo)
        values (v_escola_id, coalesce(v_parcela->>'categoriaNome', 'Mensalidades'), 'receita')
        returning id into v_categoria_id;
      end if;

      insert into cobrancas (
        escola_id, aluno_id, matricula_id, descricao, competencia,
        valor_original, valor_desconto, valor_acrescimo, data_vencimento,
        origem, id_externo, categoria_id, company_id
      ) values (
        v_escola_id, v_aluno_id, v_matricula.id,
        v_parcela->>'produto',
        v_parcela->>'competencia',
        -- valor_final é coluna GENERATED (original - desconto + acrescimo). O
        -- desconto já vem aplicado pelo isaac, então grava-se o valor pós-ajuste
        -- em valor_original e zera-se o resto: recalcular aqui produziria um
        -- número que não existe em lugar nenhum.
        v_valor_base, 0, 0,
        v_data_repasse,
        'isaac', v_parcela->>'idParcela', v_categoria_id, v_company_id
      )
      on conflict (origem, id_externo) where id_externo is not null
      do update set
        valor_original = excluded.valor_original,
        competencia    = excluded.competencia,
        descricao      = excluded.descricao,
        categoria_id   = excluded.categoria_id,
        company_id     = excluded.company_id,
        updated_at     = now()
      returning id into v_cobranca_id;

      -- pagamentos tem índice único parcial (cobranca_id) where cancelado_em
      -- is null: só existe UM pagamento ativo por cobrança. Insert direto
      -- quebraria todo reimport, então atualiza o que já está lá.
      select id into v_pagamento_id
      from pagamentos
      where cobranca_id = v_cobranca_id and cancelado_em is null;

      if v_pagamento_id is null then
        insert into pagamentos (
          escola_id, cobranca_id, aluno_id, matricula_id,
          data_pagamento, valor_pago, forma_pagamento, observacao, registrado_por
        ) values (
          v_escola_id, v_cobranca_id, v_aluno_id, v_matricula.id,
          v_data_repasse, v_valor_base, 'transferencia',
          'isaac ' || v_competencia, v_perfil.id
        );
      else
        update pagamentos set
          data_pagamento = v_data_repasse,
          valor_pago     = v_valor_base,
          observacao     = 'isaac ' || v_competencia
        where id = v_pagamento_id;
      end if;

      v_cobrancas := v_cobrancas + 1;
    elsif v_motivo is not null then
      v_pendencias := v_pendencias + 1;
    end if;

    insert into isaac_parcela (
      repasse_id, id_parcela, aluno_id, nome_isaac, produto, tipo, competencia,
      valor_mensalidade, valor_mudanca, valor_base, taxa, valor_final,
      tipo_mudanca, cobranca_id, motivo_pendencia
    ) values (
      v_repasse_id,
      v_parcela->>'idParcela',
      v_aluno_id,
      v_parcela->>'nomeIsaac',
      v_parcela->>'produto',
      v_parcela->>'tipo',
      v_parcela->>'competencia',
      (v_parcela->>'valorMensalidade')::numeric,
      (v_parcela->>'valorMudanca')::numeric,
      v_valor_base,
      (v_parcela->>'taxa')::numeric,
      (v_parcela->>'valorFinal')::numeric,
      nullif(v_parcela->>'tipoMudanca', ''),
      v_cobranca_id,
      v_motivo
    );
  end loop;

  ---------------------------------------------------------------------------
  -- Razão: taxa isaac e amortização do crédito
  ---------------------------------------------------------------------------

  -- A taxa é despesa operacional: o isaac retém 7,3% antes de repassar. Um
  -- lançamento por repasse, não por parcela.
  v_taxa_total := (p_payload->>'taxa')::numeric;
  if v_taxa_total > 0 then
    insert into lancamento_financeiro (
      escola_id, tipo, classe_despesa, competencia, descricao, categoria_id,
      contraparte, valor, data_vencimento, data_pagamento, forma_pagamento,
      status, origem_tipo, origem_id, company_id, criado_por
    ) values (
      v_escola_id, 'despesa', 'variavel', v_competencia,
      'Taxa isaac ' || v_competencia, v_categoria_taxa,
      'isaac', v_taxa_total, v_data_repasse, v_data_repasse, 'transferencia',
      'paga', 'isaac', v_repasse_id, v_company_id, v_perfil.id
    )
    on conflict (origem_tipo, origem_id) where origem_id is not null
    do update set
      valor          = excluded.valor,
      data_pagamento = excluded.data_pagamento,
      company_id     = excluded.company_id;
  end if;

  -- Amortização do crédito de curto prazo: existe só no resumo .pdf, é
  -- financiamento e não pode entrar no resultado operacional. Categoria
  -- separada justamente para ficar fora do EBITDA — o valuation da escola
  -- trata esse empréstimo da mesma forma.
  -- Alias distinto da variável PL/pgSQL: reusar `v_linha` aqui torna a
  -- referência ambígua e a função falha em tempo de execução.
  select abs((linha_credito.valor->>'valor')::numeric) into v_credito
  from jsonb_array_elements(coalesce(p_payload->'linhas', '[]'::jsonb)) as linha_credito(valor)
  where linha_credito.valor->>'tipo' = 'Débito da parcela do crédito de curto prazo'
  limit 1;

  if v_credito is not null and v_credito > 0 then
    select id into v_categoria_credito from categorias_financeiras
    where escola_id = v_escola_id and nome = 'Amortização crédito isaac' and tipo = 'despesa';
    if v_categoria_credito is null then
      insert into categorias_financeiras (escola_id, nome, tipo)
      values (v_escola_id, 'Amortização crédito isaac', 'despesa')
      returning id into v_categoria_credito;
    end if;

    -- origem_id NÃO pode ser o repasse_id: a taxa já usa esse valor e o índice
    -- lancamento_origem_unico_idx é (origem_tipo, origem_id). Os dois
    -- lançamentos colidiriam e o segundo — o crédito — sumiria em silêncio.
    -- Por isso o crédito recebe um uuid próprio, derivado do repasse de forma
    -- determinística (md5 do repasse + rótulo), o que mantém o reimport
    -- idempotente sem precisar de outra coluna.
    insert into lancamento_financeiro (
      escola_id, tipo, classe_despesa, competencia, descricao, categoria_id,
      contraparte, valor, data_vencimento, data_pagamento, forma_pagamento,
      status, origem_tipo, origem_id, company_id, criado_por
    ) values (
      v_escola_id, 'despesa', 'fixa', v_competencia,
      'Amortização crédito isaac ' || v_competencia, v_categoria_credito,
      'isaac', v_credito, v_data_repasse, v_data_repasse, 'transferencia',
      'paga', 'isaac',
      md5(v_repasse_id::text || ':credito-curto-prazo')::uuid,
      v_company_id, v_perfil.id
    )
    on conflict (origem_tipo, origem_id) where origem_id is not null
    do update set
      valor          = excluded.valor,
      data_pagamento = excluded.data_pagamento,
      company_id     = excluded.company_id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'repasse_id', v_repasse_id,
    'parcelas', v_parcelas,
    'cobrancas', v_cobrancas,
    'pendencias', v_pendencias
  );
end;
$$;

grant execute on function importar_repasse_isaac(jsonb) to authenticated;
