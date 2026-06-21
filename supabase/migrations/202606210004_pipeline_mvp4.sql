-- Pipeline MVP4: pipeline_automacao + pipeline_automacao_execucao + campo_obrigatorio em coluna
-- Depende: pipeline_pode() (MVP2), pipeline_card (MVP1), pipeline_tarefa (MVP3)

-- ─── campo_obrigatorio em pipeline_coluna ──────────────────────────────────────

alter table pipeline_coluna
  add column if not exists campo_obrigatorio text null;

-- ─── pipeline_automacao (configuração) ────────────────────────────────────────

create table pipeline_automacao (
  id          uuid        primary key default gen_random_uuid(),
  escola_id   uuid        not null references escolas(id) on delete cascade,
  quadro_id   uuid        null references pipeline_quadro(id) on delete cascade,
  coluna_id   uuid        null references pipeline_coluna(id) on delete set null,
  tipo        text        not null,
  ativo       boolean     not null default true,
  params      jsonb       not null default '{}',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table pipeline_automacao
  add constraint pipeline_automacao_tipo_valido check (tipo in (
    'card_parado_cria_tarefa',
    'coluna_entrada_envia_template',
    'coluna_entrada_cria_tarefa',
    'coluna_entrada_solicita_dado',
    'coluna_entrada_muda_status',
    'entrada_etapa_final_boas_vindas',
    'mover_card_condicional'
  ));

create index pipeline_automacao_escola_idx
  on pipeline_automacao(escola_id, quadro_id, ativo);

alter table pipeline_automacao enable row level security;

create policy pipeline_automacao_read on pipeline_automacao
  for select to authenticated
  using (pipeline_pode('pipeline_admin', 'read'));

create policy pipeline_automacao_write on pipeline_automacao
  for all to authenticated
  using  (pipeline_pode('pipeline_admin', 'read'))
  with check (pipeline_pode('pipeline_admin', 'create'));

grant select, insert, update, delete on pipeline_automacao to authenticated;

-- ─── pipeline_automacao_execucao (log + dedupe) ────────────────────────────────

create table pipeline_automacao_execucao (
  id            uuid        primary key default gen_random_uuid(),
  escola_id     uuid        not null,
  automacao_id  uuid        not null references pipeline_automacao(id) on delete cascade,
  card_id       uuid        not null references pipeline_card(id) on delete cascade,
  coluna_id     uuid        null,   -- contexto de entrada (para dedupe por entrada de coluna)
  executed_at   timestamptz not null default now(),
  resultado     text        not null, -- 'ok' | 'erro' | 'ignorado'
  detalhe       text
);

-- dedupe: uma_vez por card (tipos sem coluna_id)
create unique index pipeline_exec_card_uniq
  on pipeline_automacao_execucao(automacao_id, card_id)
  where coluna_id is null;

-- dedupe: uma_vez por entrada de coluna (tipos com coluna_id)
create unique index pipeline_exec_coluna_uniq
  on pipeline_automacao_execucao(automacao_id, card_id, coluna_id)
  where coluna_id is not null;

create index pipeline_exec_card_idx
  on pipeline_automacao_execucao(card_id);

create index pipeline_exec_automacao_idx
  on pipeline_automacao_execucao(automacao_id, executed_at desc);

alter table pipeline_automacao_execucao enable row level security;

create policy pipeline_exec_read on pipeline_automacao_execucao
  for select to authenticated
  using (pipeline_pode('pipeline_admin', 'read'));

-- Inserção feita via SECURITY DEFINER (job admin + actions internas)
-- Não expõe insert/update/delete para authenticated

grant select on pipeline_automacao_execucao to authenticated;
