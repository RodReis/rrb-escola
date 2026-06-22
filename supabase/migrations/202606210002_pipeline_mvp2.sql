-- supabase/migrations/202606210002_pipeline_mvp2.sql
-- Pipeline MVP2: reserva, promoção, RBAC ampliado, dados educacionais

-- ─── 1) Sequence para matrícula_codigo ───────────────────────────────────────

create sequence if not exists pipeline_matricula_seq start 1;

-- ─── 2) Campos educacionais em pipeline_lead ─────────────────────────────────

alter table pipeline_lead
  add column if not exists escola_anterior         text,
  add column if not exists motivo_transferencia    text,
  add column if not exists situacao_escolar        text,
  add column if not exists observacoes_pedagogicas text,
  add column if not exists documentos_pendentes    text[];

-- ─── 3) Tabela pipeline_reserva ──────────────────────────────────────────────

create table pipeline_reserva (
  id                          uuid primary key default gen_random_uuid(),
  card_id                     uuid not null unique references pipeline_card(id) on delete cascade,
  escola_id                   uuid not null references escolas(id),
  serie_id                    uuid references series(id),
  turma_id                    uuid references turmas(id),
  prioridade                  int not null default 0,
  status_vaga                 text not null default 'aguardando',
  data_entrada_reserva        date,
  previsao_disponibilidade    date,
  interesse_confirmado        boolean not null default false,
  observacoes_secretaria      text,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);

create index pipeline_reserva_card_idx   on pipeline_reserva(card_id);
create index pipeline_reserva_escola_idx on pipeline_reserva(escola_id);
create index pipeline_reserva_turma_idx  on pipeline_reserva(turma_id);

create trigger pipeline_reserva_updated_at
  before update on pipeline_reserva
  for each row execute function pipeline_set_updated_at();

alter table pipeline_reserva enable row level security;

-- ─── 4) Helper SQL: pipeline_pode ────────────────────────────────────────────

create or replace function pipeline_pode(p_modulo text, p_acao text)
returns boolean language sql security definer stable as $$
  select exists (
    select 1
    from perfis p
    join role_permissoes rp on rp.role_codigo = p.perfil
    join modulos m on m.codigo = rp.modulo_codigo
    where p.user_id = auth.uid()
      and m.codigo = p_modulo
      and case p_acao
            when 'read'   then rp.pode_ler
            when 'create' then rp.pode_criar
            when 'update' then rp.pode_editar
            when 'delete' then rp.pode_deletar
            else false
          end
  )
$$;

-- ─── 5) Função de vagas de turma ─────────────────────────────────────────────

create or replace function pipeline_turma_vagas(p_turma_id uuid, p_ano_letivo int)
returns table(capacidade int, matriculas_ativas bigint, vagas_restantes int)
language sql security definer stable as $$
  select
    t.capacidade,
    count(m.id) filter (where m.status = 'ativa') as matriculas_ativas,
    t.capacidade - count(m.id) filter (where m.status = 'ativa')::int as vagas_restantes
  from turmas t
  left join matriculas m
    on m.turma_id = t.id
   and m.ano_letivo = p_ano_letivo
  where t.id = p_turma_id
  group by t.capacidade
$$;

-- ─── 6) Função transacional: pipeline_promover_card ──────────────────────────

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

  -- 7) Insere aluno (matricula_codigo NOT NULL no schema real)
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
    v_resp pipeline_lead_responsavel;
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

      -- Contato do primeiro responsável
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

-- ─── 7) RLS: pipeline_reserva ────────────────────────────────────────────────

drop policy if exists pipeline_reserva_rw on pipeline_reserva;
create policy pipeline_reserva_rw on pipeline_reserva for all to authenticated
  using (escola_id = (select escola_id from current_perfil())
    and pipeline_pode('pipeline', 'read'))
  with check (escola_id = (select escola_id from current_perfil())
    and pipeline_pode('pipeline', 'create'));

-- ─── 8) Atualizar RLS das tabelas MVP1 para usar pipeline_pode ───────────────

-- pipeline_quadro
drop policy if exists pipeline_quadro_rw on pipeline_quadro;
create policy pipeline_quadro_rw on pipeline_quadro for all to authenticated
  using (escola_id = (select escola_id from current_perfil())
    and pipeline_pode('pipeline', 'read'))
  with check (escola_id = (select escola_id from current_perfil())
    and pipeline_pode('pipeline_admin', 'create'));

-- pipeline_coluna
drop policy if exists pipeline_coluna_rw on pipeline_coluna;
create policy pipeline_coluna_rw on pipeline_coluna for all to authenticated
  using (escola_id = (select escola_id from current_perfil())
    and pipeline_pode('pipeline', 'read'))
  with check (escola_id = (select escola_id from current_perfil())
    and pipeline_pode('pipeline_admin', 'create'));

-- pipeline_card
drop policy if exists pipeline_card_rw on pipeline_card;
create policy pipeline_card_rw on pipeline_card for all to authenticated
  using (escola_id = (select escola_id from current_perfil())
    and pipeline_pode('pipeline', 'read'))
  with check (escola_id = (select escola_id from current_perfil())
    and pipeline_pode('pipeline', 'create'));

-- pipeline_lead
drop policy if exists pipeline_lead_rw on pipeline_lead;
create policy pipeline_lead_rw on pipeline_lead for all to authenticated
  using (escola_id = (select escola_id from current_perfil())
    and pipeline_pode('pipeline', 'read'))
  with check (escola_id = (select escola_id from current_perfil())
    and pipeline_pode('pipeline', 'create'));

-- pipeline_lead_responsavel
drop policy if exists pipeline_lead_resp_rw on pipeline_lead_responsavel;
create policy pipeline_lead_resp_rw on pipeline_lead_responsavel for all to authenticated
  using (escola_id = (select escola_id from current_perfil())
    and pipeline_pode('pipeline', 'read'))
  with check (escola_id = (select escola_id from current_perfil())
    and pipeline_pode('pipeline', 'create'));

-- pipeline_card_movimentacao
drop policy if exists pipeline_movimentacao_rw on pipeline_card_movimentacao;
create policy pipeline_movimentacao_rw on pipeline_card_movimentacao for all to authenticated
  using (escola_id = (select escola_id from current_perfil())
    and pipeline_pode('pipeline', 'read'))
  with check (escola_id = (select escola_id from current_perfil())
    and pipeline_pode('pipeline', 'create'));

-- pipeline_card_atividade
drop policy if exists pipeline_atividade_rw on pipeline_card_atividade;
create policy pipeline_atividade_rw on pipeline_card_atividade for all to authenticated
  using (escola_id = (select escola_id from current_perfil())
    and pipeline_pode('pipeline', 'read'))
  with check (escola_id = (select escola_id from current_perfil())
    and pipeline_pode('pipeline', 'create'));

-- ─── 9) Grants ───────────────────────────────────────────────────────────────

grant select, insert, update, delete on pipeline_reserva to authenticated;
grant execute on function pipeline_pode(text, text) to authenticated;
grant execute on function pipeline_turma_vagas(uuid, int) to authenticated;
grant execute on function pipeline_promover_card(uuid, uuid) to authenticated;

-- ─── 10) RBAC: role coordenacao + módulo pipeline_admin ─────────────────────

insert into roles (codigo, nome, sistema)
values ('coordenacao', 'Coordenação', true)
on conflict (codigo) do nothing;

insert into modulos (codigo, grupo, nome, ordem)
values ('pipeline_admin', 'secretaria', 'Pipeline / Admin', 16)
on conflict (codigo) do nothing;

-- Permissões: admin
insert into role_permissoes (role_codigo, modulo_codigo, pode_ler, pode_criar, pode_editar, pode_deletar)
values ('admin', 'pipeline_admin', true, true, true, true)
on conflict (role_codigo, modulo_codigo) do update
  set pode_ler = true, pode_criar = true, pode_editar = true, pode_deletar = true;

-- Permissões: secretaria (full em pipeline_admin)
insert into role_permissoes (role_codigo, modulo_codigo, pode_ler, pode_criar, pode_editar, pode_deletar)
values ('secretaria', 'pipeline_admin', true, true, true, true)
on conflict (role_codigo, modulo_codigo) do update
  set pode_ler = true, pode_criar = true, pode_editar = true, pode_deletar = true;

-- Permissões: coordenacao (full em pipeline e pipeline_admin)
insert into role_permissoes (role_codigo, modulo_codigo, pode_ler, pode_criar, pode_editar, pode_deletar)
values ('coordenacao', 'pipeline', true, true, true, true)
on conflict (role_codigo, modulo_codigo) do update
  set pode_ler = true, pode_criar = true, pode_editar = true, pode_deletar = true;

insert into role_permissoes (role_codigo, modulo_codigo, pode_ler, pode_criar, pode_editar, pode_deletar)
values ('coordenacao', 'pipeline_admin', true, true, true, true)
on conflict (role_codigo, modulo_codigo) do update
  set pode_ler = true, pode_criar = true, pode_editar = true, pode_deletar = true;
