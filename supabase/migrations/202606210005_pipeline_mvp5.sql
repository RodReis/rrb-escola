-- supabase/migrations/202606210005_pipeline_mvp5.sql
-- Pipeline MVP5: anamnese, LGPD, permissões finas, indicadores

-- ─── 1) Módulo RBAC pipeline_sensivel ────────────────────────────────────────

insert into modulos (codigo, nome, descricao)
values ('pipeline_sensivel', 'Pipeline Sensível', 'Anamnese e dados pedagógicos sensíveis do lead')
on conflict (codigo) do nothing;

insert into role_permissoes (role_codigo, modulo_codigo, pode_ler, pode_criar, pode_editar, pode_deletar)
values ('admin', 'pipeline_sensivel', true, true, true, true)
on conflict (role_codigo, modulo_codigo) do update
  set pode_ler = true, pode_criar = true, pode_editar = true, pode_deletar = true;

insert into role_permissoes (role_codigo, modulo_codigo, pode_ler, pode_criar, pode_editar, pode_deletar)
values ('coordenacao', 'pipeline_sensivel', true, true, true, true)
on conflict (role_codigo, modulo_codigo) do update
  set pode_ler = true, pode_criar = true, pode_editar = true, pode_deletar = true;

-- secretaria: sem acesso (ausência de row = sem permissão)

-- ─── 2) Tabela pipeline_anamnese ─────────────────────────────────────────────

create table pipeline_anamnese (
  id                              uuid primary key default gen_random_uuid(),
  escola_id                       uuid not null references escolas(id) on delete cascade,
  card_id                         uuid not null unique references pipeline_card(id) on delete cascade,
  aluno_id                        uuid null references alunos(id) on delete set null,
  status                          text not null default 'nao_iniciada',
  necessidade_especial            boolean not null default false,
  necessidade_especial_descricao  text,
  alergias                        text,
  medicamentos_continuos          text,
  restricoes_alimentares          text,
  acomp_psicologico               boolean not null default false,
  acomp_psicologico_descricao     text,
  acomp_fonoaudiologico           boolean not null default false,
  acomp_fonoaudiologico_descricao text,
  acomp_psicopedagogico           boolean not null default false,
  acomp_psicopedagogico_descricao text,
  historico_desenvolvimento       text,
  comportamento_social            text,
  rotina_familiar                 text,
  observacoes_responsaveis        text,
  observacoes_coordenacao         text,
  consentimento_em                timestamptz null,
  consentimento_por               uuid null references perfis(id) on delete set null,
  termo_versao                    text null,
  created_at                      timestamptz not null default now(),
  updated_at                      timestamptz not null default now()
);

alter table pipeline_anamnese add constraint pipeline_anamnese_status_valido
  check (status in ('nao_iniciada','enviada','pendente','em_analise','concluida','requer_atencao'));

create index pipeline_anamnese_card_idx   on pipeline_anamnese(card_id);
create index pipeline_anamnese_escola_idx on pipeline_anamnese(escola_id);
create index pipeline_anamnese_aluno_idx  on pipeline_anamnese(aluno_id) where aluno_id is not null;

create trigger pipeline_anamnese_updated_at
  before update on pipeline_anamnese
  for each row execute function pipeline_set_updated_at();

alter table pipeline_anamnese enable row level security;

create policy pipeline_anamnese_rw on pipeline_anamnese for all to authenticated
  using (escola_id = (select escola_id from current_perfil())
    and pipeline_pode('pipeline_sensivel', 'read'))
  with check (escola_id = (select escola_id from current_perfil())
    and pipeline_pode('pipeline_sensivel', 'create'));

grant select, insert, update on pipeline_anamnese to authenticated;

-- ─── 3) Tabela pipeline_anamnese_arquivo ─────────────────────────────────────

create table pipeline_anamnese_arquivo (
  id          uuid primary key default gen_random_uuid(),
  escola_id   uuid not null references escolas(id) on delete cascade,
  anamnese_id uuid not null references pipeline_anamnese(id) on delete cascade,
  card_id     uuid not null references pipeline_card(id) on delete cascade,
  nome        text not null,
  url         text not null,
  mime_type   text,
  created_at  timestamptz not null default now()
);

create index pipeline_anamnese_arquivo_anamnese_idx on pipeline_anamnese_arquivo(anamnese_id);
create index pipeline_anamnese_arquivo_card_idx     on pipeline_anamnese_arquivo(card_id);

alter table pipeline_anamnese_arquivo enable row level security;

create policy pipeline_anamnese_arquivo_rw on pipeline_anamnese_arquivo for all to authenticated
  using (escola_id = (select escola_id from current_perfil())
    and pipeline_pode('pipeline_sensivel', 'read'))
  with check (escola_id = (select escola_id from current_perfil())
    and pipeline_pode('pipeline_sensivel', 'create'));

grant select, insert, delete on pipeline_anamnese_arquivo to authenticated;

-- ─── 4) Tabela pipeline_acesso_log (append-only) ─────────────────────────────

create table pipeline_acesso_log (
  id          uuid primary key default gen_random_uuid(),
  escola_id   uuid not null,
  usuario_id  uuid not null references perfis(id) on delete cascade,
  card_id     uuid not null references pipeline_card(id) on delete cascade,
  recurso     text not null,
  acao        text not null,
  created_at  timestamptz not null default now()
);

alter table pipeline_acesso_log add constraint pipeline_acesso_log_recurso_valido
  check (recurso in ('anamnese', 'anamnese_arquivo'));
alter table pipeline_acesso_log add constraint pipeline_acesso_log_acao_valida
  check (acao in ('read', 'write'));

create index pipeline_acesso_log_idx on pipeline_acesso_log (escola_id, card_id, created_at);

alter table pipeline_acesso_log enable row level security;

-- Leitura restrita a quem tem pipeline_sensivel:read
create policy pipeline_acesso_log_select on pipeline_acesso_log for select to authenticated
  using (escola_id = (select escola_id from current_perfil())
    and pipeline_pode('pipeline_sensivel', 'read'));

-- Insert apenas via função SECURITY DEFINER (sem policy de insert = RLS bloqueia insert direto)
grant select on pipeline_acesso_log to authenticated;

-- Função SECURITY DEFINER para gravar log (bypassa RLS na escrita)
create or replace function pipeline_gravar_acesso_log(
  p_escola_id  uuid,
  p_usuario_id uuid,
  p_card_id    uuid,
  p_recurso    text,
  p_acao       text
) returns void language plpgsql security definer as $$
begin
  insert into pipeline_acesso_log (escola_id, usuario_id, card_id, recurso, acao)
  values (p_escola_id, p_usuario_id, p_card_id, p_recurso, p_acao);
end;
$$;

grant execute on function pipeline_gravar_acesso_log(uuid, uuid, uuid, text, text) to authenticated;

-- ─── 5) Atualizar pipeline_promover_card — espelhamento anamnese ──────────────
-- Recria a função integralmente (mantém corpo MVP2 + adiciona step 10b)

create or replace function pipeline_promover_card(
  p_card_id    uuid,
  p_usuario_id uuid
)
returns jsonb language plpgsql security definer as $$
declare
  v_card            pipeline_card%rowtype;
  v_lead            pipeline_lead%rowtype;
  v_reserva         pipeline_reserva%rowtype;
  v_escola_id       uuid;
  v_responsaveis    pipeline_lead_responsavel[];
  v_aluno_id        uuid;
  v_matricula_id    uuid;
  v_matricula_cod   text;
  v_coluna_final_id uuid;
  v_anamnese        pipeline_anamnese%rowtype;
  v_tem_anamnese    boolean := false;
begin
  -- 1) Carrega card e valida escola
  select * into v_card from pipeline_card where id = p_card_id;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Card não encontrado');
  end if;
  v_escola_id := v_card.escola_id;

  -- 2) Idempotência: já convertido
  if v_card.aluno_id is not null then
    return jsonb_build_object('ok', true, 'data', jsonb_build_object('matricula_codigo', null));
  end if;

  -- 3) Carrega lead
  select * into v_lead from pipeline_lead where card_id = p_card_id;
  if not found or v_lead.nome is null or trim(v_lead.nome) = '' then
    return jsonb_build_object('ok', false, 'error', 'Nome do lead obrigatório para promover');
  end if;

  -- 4) Carrega reserva
  select * into v_reserva from pipeline_reserva where card_id = p_card_id;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Reserva não cadastrada (série e turma obrigatórias)');
  end if;
  if v_reserva.serie_id is null then
    return jsonb_build_object('ok', false, 'error', 'Série não informada na reserva');
  end if;
  if v_reserva.turma_id is null then
    return jsonb_build_object('ok', false, 'error', 'Turma não informada na reserva');
  end if;

  -- 5) Carrega responsáveis (mínimo 1 com nome)
  select array_agg(r order by r.created_at)
  into v_responsaveis
  from pipeline_lead_responsavel r
  where r.card_id = p_card_id
    and r.nome is not null
    and trim(r.nome) <> '';

  if v_responsaveis is null or array_length(v_responsaveis, 1) = 0 then
    return jsonb_build_object('ok', false, 'error', 'Ao menos um responsável com nome é obrigatório');
  end if;

  -- 6) Gera código de matrícula
  v_matricula_cod := 'MAT' || extract(year from now())::text
    || lpad(nextval('pipeline_matricula_seq')::text, 5, '0');

  -- 7) Insere aluno
  insert into alunos (
    escola_id, nome, data_nascimento, matricula_codigo
  ) values (
    v_escola_id,
    v_lead.nome,
    v_lead.data_nascimento,
    v_matricula_cod
  ) returning id into v_aluno_id;

  -- 8) Insere endereço (logradouro NOT NULL — usa placeholder vazio)
  insert into enderecos_aluno (aluno_id, logradouro)
  values (v_aluno_id, '');

  -- 9) Insere responsáveis
  declare
    v_resp    pipeline_lead_responsavel;
    v_is_first boolean := true;
  begin
    foreach v_resp in array v_responsaveis loop
      insert into responsaveis_aluno (
        aluno_id, nome, parentesco,
        responsavel_pedagogico, responsavel_financeiro,
        cpf, email, celular, telefone
      ) values (
        v_aluno_id,
        v_resp.nome,
        coalesce(v_resp.parentesco, 'responsavel'),
        coalesce(v_resp.pedagogico, true),
        coalesce(v_resp.financeiro, true),
        v_resp.cpf,
        v_resp.email,
        coalesce(v_resp.whatsapp, v_resp.telefone),
        v_resp.telefone
      );

      if v_is_first then
        v_is_first := false;
        insert into contatos_aluno (aluno_id, nome, celular, telefone, principal)
        values (v_aluno_id, v_resp.nome,
          coalesce(v_resp.whatsapp, v_resp.telefone),
          v_resp.telefone,
          true);
      end if;
    end loop;
  end;

  -- 10) Informações médicas (defaults)
  insert into informacoes_medicas (aluno_id)
  values (v_aluno_id)
  on conflict (aluno_id) do nothing;

  -- 10b) Espelhar anamnese → informacoes_medicas (condicional — só se anamnese existe)
  select * into v_anamnese
  from pipeline_anamnese
  where card_id = p_card_id;

  if found then
    v_tem_anamnese := true;

    update informacoes_medicas im
    set
      alergia                        = (v_anamnese.alergias is not null and v_anamnese.alergias <> ''),
      alergia_descricao              = v_anamnese.alergias,
      necessidade_especial           = v_anamnese.necessidade_especial,
      necessidade_especial_descricao = v_anamnese.necessidade_especial_descricao,
      remedio_especial               = (v_anamnese.medicamentos_continuos is not null and v_anamnese.medicamentos_continuos <> ''),
      remedio_especial_descricao     = v_anamnese.medicamentos_continuos,
      necessita_apoio                = (v_anamnese.acomp_psicologico or v_anamnese.acomp_fonoaudiologico or v_anamnese.acomp_psicopedagogico),
      necessita_apoio_descricao      = nullif(trim(
        coalesce(case when v_anamnese.acomp_psicologico      then 'Psicológico: '      || coalesce(v_anamnese.acomp_psicologico_descricao,      '') end, '') || ' ' ||
        coalesce(case when v_anamnese.acomp_fonoaudiologico  then 'Fonoaudiológico: '  || coalesce(v_anamnese.acomp_fonoaudiologico_descricao,  '') end, '') || ' ' ||
        coalesce(case when v_anamnese.acomp_psicopedagogico  then 'Psicopedagógico: '  || coalesce(v_anamnese.acomp_psicopedagogico_descricao,  '') end, '')
      ), '')
    where im.aluno_id = v_aluno_id;

    -- Associa aluno_id na anamnese (histórico pós-promoção)
    update pipeline_anamnese
    set aluno_id = v_aluno_id, updated_at = now()
    where card_id = p_card_id;
  end if;

  -- 11) Matrícula
  insert into matriculas (
    escola_id, aluno_id, serie_id, turma_id,
    ano_letivo, status, codigo
  ) values (
    v_escola_id, v_aluno_id,
    v_reserva.serie_id, v_reserva.turma_id,
    coalesce(v_lead.ano_letivo, extract(year from now())::int),
    'ativa'::status_matricula,
    v_matricula_cod
  ) returning id into v_matricula_id;

  -- 12) Coluna final do quadro (etapa_final = true)
  select id into v_coluna_final_id
  from pipeline_coluna
  where quadro_id = v_card.quadro_id
    and etapa_final = true
  order by ordem
  limit 1;

  -- 13) Atualiza card
  update pipeline_card set
    aluno_id     = v_aluno_id,
    status_lead  = 'convertido',
    coluna_id    = coalesce(v_coluna_final_id, v_card.coluna_id),
    updated_at   = now()
  where id = p_card_id;

  -- 14) Registra atividade
  insert into pipeline_card_atividade (card_id, escola_id, usuario_id, tipo, descricao)
  values (p_card_id, v_escola_id, p_usuario_id, 'sistema',
    'Convertido em matrícula ' || v_matricula_cod);

  return jsonb_build_object(
    'ok', true,
    'data', jsonb_build_object('matricula_codigo', v_matricula_cod)
  );

exception when others then
  return jsonb_build_object('ok', false, 'error', sqlerrm);
end;
$$;
