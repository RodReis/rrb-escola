-- Pipeline Kanban MVP1
-- Tabelas: pipeline_quadro, pipeline_coluna, pipeline_card,
--          pipeline_lead, pipeline_lead_responsavel,
--          pipeline_card_movimentacao, pipeline_card_atividade
-- RLS: escola_id desnormalizado em todas as tabelas.
-- Perfis com acesso: admin, secretaria (atendimento = secretaria no MVP1).

-- ─── 1) Tabelas ─────────────────────────────────────────────────────────────

create table pipeline_quadro (
  id          uuid primary key default gen_random_uuid(),
  escola_id   uuid not null references escolas(id) on delete cascade,
  nome        text not null,
  descricao   text,
  tipo        text,
  ativo       boolean not null default true,
  ordem       int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index pipeline_quadro_escola_idx on pipeline_quadro(escola_id, ordem);

create table pipeline_coluna (
  id              uuid primary key default gen_random_uuid(),
  escola_id       uuid not null references escolas(id) on delete cascade,
  quadro_id       uuid not null references pipeline_quadro(id) on delete cascade,
  nome            text not null,
  cor             text,
  ordem           int not null,
  descricao       text,
  prazo_max_dias  int,
  etapa_final     boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index pipeline_coluna_quadro_idx on pipeline_coluna(quadro_id, ordem);
create index pipeline_coluna_escola_idx on pipeline_coluna(escola_id);

create table pipeline_card (
  id               uuid primary key default gen_random_uuid(),
  escola_id        uuid not null references escolas(id) on delete cascade,
  quadro_id        uuid not null references pipeline_quadro(id) on delete cascade,
  coluna_id        uuid not null references pipeline_coluna(id),
  ordem            double precision not null,
  titulo           text not null,
  origem           text,
  status_lead      text not null default 'novo',
  aluno_id         uuid references alunos(id) on delete set null,
  assigned_to      uuid references perfis(id) on delete set null,
  motivo_perda     text,
  ultimo_contato_at timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index pipeline_card_posicao_idx on pipeline_card(escola_id, quadro_id, coluna_id, ordem);
create index pipeline_card_assigned_idx on pipeline_card(escola_id, assigned_to);
create index pipeline_card_aluno_idx on pipeline_card(aluno_id);

create table pipeline_lead (
  id               uuid primary key default gen_random_uuid(),
  escola_id        uuid not null references escolas(id) on delete cascade,
  card_id          uuid not null unique references pipeline_card(id) on delete cascade,
  nome             text not null,
  data_nascimento  date,
  sexo             text,
  cpf              text,
  rg               text,
  foto_url         text,
  serie_interesse  text,
  turno            text,
  ano_letivo       int,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index pipeline_lead_escola_idx on pipeline_lead(escola_id);

create table pipeline_lead_responsavel (
  id                   uuid primary key default gen_random_uuid(),
  escola_id            uuid not null references escolas(id) on delete cascade,
  card_id              uuid not null references pipeline_card(id) on delete cascade,
  nome                 text not null,
  parentesco           text,
  cpf                  text,
  rg                   text,
  telefone             text,
  whatsapp             text,
  email                text,
  financeiro           boolean not null default false,
  pedagogico           boolean not null default false,
  autorizado_retirar   boolean not null default false,
  observacoes          text,
  created_at           timestamptz not null default now()
);
create index pipeline_lead_resp_card_idx on pipeline_lead_responsavel(card_id);
create index pipeline_lead_resp_escola_idx on pipeline_lead_responsavel(escola_id);

create table pipeline_card_movimentacao (
  id             uuid primary key default gen_random_uuid(),
  escola_id      uuid not null references escolas(id) on delete cascade,
  card_id        uuid not null references pipeline_card(id) on delete cascade,
  de_coluna_id   uuid references pipeline_coluna(id) on delete set null,
  para_coluna_id uuid not null references pipeline_coluna(id),
  usuario_id     uuid not null references perfis(id),
  observacao     text,
  created_at     timestamptz not null default now()
);
create index pipeline_movimentacao_card_idx on pipeline_card_movimentacao(card_id, created_at);
create index pipeline_movimentacao_escola_idx on pipeline_card_movimentacao(escola_id);

create table pipeline_card_atividade (
  id          uuid primary key default gen_random_uuid(),
  escola_id   uuid not null references escolas(id) on delete cascade,
  card_id     uuid not null references pipeline_card(id) on delete cascade,
  tipo        text not null,
  descricao   text,
  usuario_id  uuid not null references perfis(id),
  anexo_url   text,
  created_at  timestamptz not null default now()
);
create index pipeline_atividade_card_idx on pipeline_card_atividade(card_id, created_at);
create index pipeline_atividade_escola_idx on pipeline_card_atividade(escola_id);

-- ─── 2) Triggers updated_at ─────────────────────────────────────────────────

create or replace function pipeline_set_updated_at()
returns trigger language plpgsql security definer set search_path = public
as $$ begin new.updated_at = now(); return new; end; $$;

create trigger pipeline_quadro_updated_at before update on pipeline_quadro
  for each row execute function pipeline_set_updated_at();
create trigger pipeline_coluna_updated_at before update on pipeline_coluna
  for each row execute function pipeline_set_updated_at();
create trigger pipeline_card_updated_at before update on pipeline_card
  for each row execute function pipeline_set_updated_at();
create trigger pipeline_lead_updated_at before update on pipeline_lead
  for each row execute function pipeline_set_updated_at();

-- ─── 3) RLS ──────────────────────────────────────────────────────────────────

alter table pipeline_quadro          enable row level security;
alter table pipeline_coluna          enable row level security;
alter table pipeline_card            enable row level security;
alter table pipeline_lead            enable row level security;
alter table pipeline_lead_responsavel enable row level security;
alter table pipeline_card_movimentacao enable row level security;
alter table pipeline_card_atividade  enable row level security;

-- pipeline_quadro
drop policy if exists pipeline_quadro_rw on pipeline_quadro;
create policy pipeline_quadro_rw on pipeline_quadro for all to authenticated
  using (escola_id = (select escola_id from current_perfil())
    and (select perfil from current_perfil()) in ('admin','secretaria'))
  with check (escola_id = (select escola_id from current_perfil())
    and (select perfil from current_perfil()) in ('admin','secretaria'));

-- pipeline_coluna
drop policy if exists pipeline_coluna_rw on pipeline_coluna;
create policy pipeline_coluna_rw on pipeline_coluna for all to authenticated
  using (escola_id = (select escola_id from current_perfil())
    and (select perfil from current_perfil()) in ('admin','secretaria'))
  with check (escola_id = (select escola_id from current_perfil())
    and (select perfil from current_perfil()) in ('admin','secretaria'));

-- pipeline_card
drop policy if exists pipeline_card_rw on pipeline_card;
create policy pipeline_card_rw on pipeline_card for all to authenticated
  using (escola_id = (select escola_id from current_perfil())
    and (select perfil from current_perfil()) in ('admin','secretaria'))
  with check (escola_id = (select escola_id from current_perfil())
    and (select perfil from current_perfil()) in ('admin','secretaria'));

-- pipeline_lead
drop policy if exists pipeline_lead_rw on pipeline_lead;
create policy pipeline_lead_rw on pipeline_lead for all to authenticated
  using (escola_id = (select escola_id from current_perfil())
    and (select perfil from current_perfil()) in ('admin','secretaria'))
  with check (escola_id = (select escola_id from current_perfil())
    and (select perfil from current_perfil()) in ('admin','secretaria'));

-- pipeline_lead_responsavel
drop policy if exists pipeline_lead_resp_rw on pipeline_lead_responsavel;
create policy pipeline_lead_resp_rw on pipeline_lead_responsavel for all to authenticated
  using (escola_id = (select escola_id from current_perfil())
    and (select perfil from current_perfil()) in ('admin','secretaria'))
  with check (escola_id = (select escola_id from current_perfil())
    and (select perfil from current_perfil()) in ('admin','secretaria'));

-- pipeline_card_movimentacao
drop policy if exists pipeline_movimentacao_rw on pipeline_card_movimentacao;
create policy pipeline_movimentacao_rw on pipeline_card_movimentacao for all to authenticated
  using (escola_id = (select escola_id from current_perfil())
    and (select perfil from current_perfil()) in ('admin','secretaria'))
  with check (escola_id = (select escola_id from current_perfil())
    and (select perfil from current_perfil()) in ('admin','secretaria'));

-- pipeline_card_atividade
drop policy if exists pipeline_atividade_rw on pipeline_card_atividade;
create policy pipeline_atividade_rw on pipeline_card_atividade for all to authenticated
  using (escola_id = (select escola_id from current_perfil())
    and (select perfil from current_perfil()) in ('admin','secretaria'))
  with check (escola_id = (select escola_id from current_perfil())
    and (select perfil from current_perfil()) in ('admin','secretaria'));

-- ─── 4) GRANTS ───────────────────────────────────────────────────────────────

grant select, insert, update, delete on pipeline_quadro          to authenticated;
grant select, insert, update, delete on pipeline_coluna          to authenticated;
grant select, insert, update, delete on pipeline_card            to authenticated;
grant select, insert, update, delete on pipeline_lead            to authenticated;
grant select, insert, update, delete on pipeline_lead_responsavel to authenticated;
grant select, insert, update, delete on pipeline_card_movimentacao to authenticated;
grant select, insert, update, delete on pipeline_card_atividade  to authenticated;

-- ─── 5) Módulo RBAC ──────────────────────────────────────────────────────────

insert into modulos (codigo, grupo, nome, ordem)
values ('pipeline', 'secretaria', 'Pipeline / Captação', 15)
on conflict (codigo) do nothing;

-- Permissão admin: full
insert into role_permissoes (role_codigo, modulo_codigo, pode_ler, pode_criar, pode_editar, pode_deletar)
values ('admin', 'pipeline', true, true, true, true)
on conflict (role_codigo, modulo_codigo) do update
  set pode_ler = true, pode_criar = true, pode_editar = true, pode_deletar = true;

-- Permissão secretaria: full (exceto delete de quadros/colunas — MVP2+ gerencia pela UI)
insert into role_permissoes (role_codigo, modulo_codigo, pode_ler, pode_criar, pode_editar, pode_deletar)
values ('secretaria', 'pipeline', true, true, true, false)
on conflict (role_codigo, modulo_codigo) do update
  set pode_ler = true, pode_criar = true, pode_editar = true, pode_deletar = false;

-- ─── 6) Seed: quadro "Captação de Novos Alunos" ──────────────────────────────
-- Inserido para a primeira escola encontrada (ambiente dev).
-- Em produção multi-tenant, este seed será executado por escola via script separado.
-- A tabela já suporta múltiplos quadros por escola.

do $$
declare
  v_escola_id uuid;
  v_quadro_id uuid;
begin
  select id into v_escola_id from escolas limit 1;
  if v_escola_id is null then
    return;
  end if;

  insert into pipeline_quadro (escola_id, nome, tipo, ordem)
  values (v_escola_id, 'Captação de Novos Alunos', 'captacao', 0)
  returning id into v_quadro_id;

  insert into pipeline_coluna (escola_id, quadro_id, nome, cor, ordem, etapa_final) values
    (v_escola_id, v_quadro_id, 'Novo Lead',              'color-pipeline-novo',       0, false),
    (v_escola_id, v_quadro_id, 'Primeiro Contato',       'color-pipeline-contato',    1, false),
    (v_escola_id, v_quadro_id, 'Aguardando Retorno',     'color-pipeline-aguardando', 2, false),
    (v_escola_id, v_quadro_id, 'Entrevista',             'color-pipeline-entrevista', 3, false),
    (v_escola_id, v_quadro_id, 'Cadastro de Reserva',    'color-pipeline-reserva',    4, false),
    (v_escola_id, v_quadro_id, 'Em Análise',             'color-pipeline-analise',    5, false),
    (v_escola_id, v_quadro_id, 'Matrícula Confirmada',   'color-pipeline-convertido', 6, true),
    (v_escola_id, v_quadro_id, 'Perdido',                'color-pipeline-perdido',    7, true);
end $$;
