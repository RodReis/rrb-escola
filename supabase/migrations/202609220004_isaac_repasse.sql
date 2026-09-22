-- Repasse isaac: espelho do que o isaac de fato transferiu, por unidade e por
-- competência.
--
-- A mensalidade é cobrada exclusivamente pelo isaac, que retém a taxa e repassa
-- o líquido em duas transferências (dia 05 e dia 15). Gerar cobranças a partir
-- do plano da matrícula produzia um razão que não corresponde a dinheiro
-- nenhum; essas tabelas guardam o dado real, vindo do analítico .xlsx e do
-- resumo .pdf do Meu Arco.
--
-- Depende de 202609220003 (valores de enum 'isaac' e 'repasse_isaac').
--
-- Ref: docs/superpowers/specs/2026-09-21-financeiro-isaac-multicnpj-design.md

-- ---------------------------------------------------------------------------
-- Unidades isaac ↔ CNPJ
-- ---------------------------------------------------------------------------

-- O vínculo é configurado, nunca inferido do nome. Ele é contra-intuitivo
-- (confirmado por Rodrigo em 22/09): a unidade isaac "EPG Trindade" pertence à
-- Escola Pinguinho de Gente, e "EPG Trindade - Educação Infantil" ao Colégio
-- Integrado EPG — o oposto do que os nomes sugerem. Se o isaac renomear uma
-- unidade, o vínculo quebra e a receita vai para o CNPJ errado em silêncio;
-- por isso o nome fica numa coluna com unique, e não numa heurística.
create table if not exists isaac_unidade (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references escolas(id) on delete cascade,
  company_id uuid not null references companies(id) on delete restrict,
  nome_isaac text not null,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  unique (escola_id, nome_isaac)
);

-- ---------------------------------------------------------------------------
-- Repasse (cabeçalho) e suas linhas
-- ---------------------------------------------------------------------------

-- competencia_repasse é o mês em que o isaac paga, NÃO o mês da mensalidade:
-- o repasse rotulado "Setembro de 2026" cobre atualizações de 30/jul a 31/ago.
-- A competência da mensalidade fica em isaac_parcela.competencia. O ano letivo
-- 2026 só fecha incluindo o repasse de jan/2027.
create table if not exists isaac_repasse (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references escolas(id) on delete cascade,
  unidade_id uuid not null references isaac_unidade(id) on delete restrict,
  competencia_repasse text not null check (competencia_repasse ~ '^\d{4}-\d{2}$'),
  data_repasse date not null,
  bruto numeric(12,2) not null,
  ajustes numeric(12,2) not null,
  base numeric(12,2) not null,
  taxa numeric(12,2) not null,
  liquido numeric(12,2) not null,
  -- "307 alunos | 327 cobranças" do cabeçalho do resumo. Conferência contra
  -- isaac_parcela; nunca fonte de valor.
  alunos_informados int,
  cobrancas_informadas int,
  arquivo_analitico_path text,
  arquivo_resumo_path text,
  importado_por uuid references perfis(id) on delete set null,
  importado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (unidade_id, competencia_repasse)
);

-- Linhas do resumo .pdf. É a fonte das linhas que o analítico .xlsx não traz —
-- notadamente o "Débito da parcela do crédito de curto prazo", que é
-- amortização de empréstimo e não despesa operacional.
-- Seções somem quando vazias (a unidade Educação Infantil não tem "Cancelado"
-- nem "Outros valores" em set/2026), então a ausência de uma linha é normal.
-- valor é gravado COM sinal, como vem do PDF ("- R$ ..." → negativo).
create table if not exists isaac_repasse_linha (
  id uuid primary key default gen_random_uuid(),
  repasse_id uuid not null references isaac_repasse(id) on delete cascade,
  grupo text not null check (grupo in ('recebimento','desconto','outros')),
  tipo text not null,
  valor numeric(12,2) not null,
  unique (repasse_id, grupo, tipo)
);

-- Transferências programadas: hoje dia 05 (70%) e dia 15 (30%). Cada uma é
-- casada separadamente contra um crédito do extrato, por isso extrato_id fica
-- aqui e não no cabeçalho.
create table if not exists isaac_transferencia (
  id uuid primary key default gen_random_uuid(),
  repasse_id uuid not null references isaac_repasse(id) on delete cascade,
  data_prevista date not null,
  valor numeric(12,2) not null check (valor > 0),
  extrato_id uuid references extrato_bancario(id) on delete set null,
  unique (repasse_id, data_prevista)
);

-- ---------------------------------------------------------------------------
-- Parcelas e mudanças (analítico .xlsx)
-- ---------------------------------------------------------------------------

-- Espelho fiel do que o isaac mandou: TODAS as parcelas entram, inclusive as
-- que não viram cobrança. cobranca_id null + motivo_pendencia preenchido
-- significa "gravado, mas não lançado no razão — precisa de decisão humana".
create table if not exists isaac_parcela (
  id uuid primary key default gen_random_uuid(),
  repasse_id uuid not null references isaac_repasse(id) on delete cascade,
  id_parcela text not null,
  aluno_id uuid references alunos(id) on delete set null,
  nome_isaac text not null,
  produto text not null,
  tipo text not null check (tipo in ('mensalidade','material','outro')),
  competencia text not null,
  valor_mensalidade numeric(12,2) not null,
  valor_mudanca numeric(12,2) not null,
  valor_base numeric(12,2) not null,
  taxa numeric(12,2) not null,
  valor_final numeric(12,2) not null,
  tipo_mudanca text,
  cobranca_id uuid references cobrancas(id) on delete set null,
  motivo_pendencia text check (
    motivo_pendencia in ('sem_aluno','tipo_vaga_incompativel','permuta_manual')
  ),
  resolvido_em timestamptz,
  resolvido_por uuid references perfis(id) on delete set null,
  unique (repasse_id, id_parcela)
);

create table if not exists isaac_mudanca (
  id uuid primary key default gen_random_uuid(),
  repasse_id uuid not null references isaac_repasse(id) on delete cascade,
  id_parcela text not null,
  nome_isaac text not null,
  produto text not null,
  competencia text not null,
  valor numeric(12,2) not null,
  data_mudanca date,
  tipo text not null
);

-- Nomes alternativos por aluno. O casamento automático só usa alias e
-- nome_normalizado exato; fuzzy apenas sugere, porque irmãos compartilham
-- sobrenome e um match errado lança a mensalidade no aluno errado.
create table if not exists aluno_alias (
  aluno_id uuid not null references alunos(id) on delete cascade,
  nome_normalizado text not null,
  fonte text not null default 'isaac',
  criado_em timestamptz not null default now(),
  primary key (fonte, nome_normalizado)
);

-- ---------------------------------------------------------------------------
-- Colunas novas em tabelas existentes
-- ---------------------------------------------------------------------------

-- origem distingue a cobrança espelhada do isaac da digitada à mão (caso
-- "pagou na escola"). id_externo guarda o "Identificador da parcela" do
-- analítico, que é o que torna o reimport idempotente.
alter table cobrancas add column if not exists origem text not null default 'manual';
alter table cobrancas add column if not exists id_externo text;
alter table cobrancas add column if not exists categoria_id uuid references categorias_financeiras(id) on delete set null;

do $$ begin
  alter table cobrancas add constraint cobrancas_origem_check check (origem in ('manual','isaac'));
exception when duplicate_object then null; end $$;

create unique index if not exists cobrancas_id_externo_uidx
  on cobrancas (origem, id_externo) where id_externo is not null;

-- Multi-CNPJ: o resultado precisa ser apurável por empresa. Fica nullable e
-- SEM backfill — lançamento antigo sem empresa aparece com selo "sem empresa"
-- para classificação manual. Adivinhar o CNPJ de um lançamento histórico é
-- justamente o tipo de erro que este spec existe para não repetir.
alter table contas_bancarias      add column if not exists company_id uuid references companies(id) on delete restrict;
alter table lancamento_financeiro add column if not exists company_id uuid references companies(id) on delete restrict;
alter table cobrancas             add column if not exists company_id uuid references companies(id) on delete restrict;

-- ---------------------------------------------------------------------------
-- Índices
-- ---------------------------------------------------------------------------

create index if not exists isaac_repasse_competencia_idx on isaac_repasse (escola_id, competencia_repasse);
create index if not exists isaac_parcela_aluno_idx on isaac_parcela (aluno_id) where aluno_id is not null;
-- Fila de pendências: só as não resolvidas interessam.
create index if not exists isaac_parcela_pendencia_idx on isaac_parcela (repasse_id, motivo_pendencia)
  where motivo_pendencia is not null and resolvido_em is null;
create index if not exists isaac_transferencia_pendente_idx on isaac_transferencia (data_prevista)
  where extrato_id is null;
create index if not exists lancamento_company_idx on lancamento_financeiro (company_id) where company_id is not null;
create index if not exists cobrancas_company_idx on cobrancas (company_id) where company_id is not null;

drop trigger if exists isaac_repasse_atualizado_em on isaac_repasse;
create trigger isaac_repasse_atualizado_em before update on isaac_repasse
  for each row execute function set_lancamento_atualizado_em();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table isaac_unidade enable row level security;
alter table isaac_repasse enable row level security;
alter table isaac_repasse_linha enable row level security;
alter table isaac_transferencia enable row level security;
alter table isaac_parcela enable row level security;
alter table isaac_mudanca enable row level security;
alter table aluno_alias enable row level security;

drop policy if exists isaac_unidade_rw on isaac_unidade;
create policy isaac_unidade_rw on isaac_unidade for all
  using (escola_id = (select escola_id from current_perfil()) and (select perfil from current_perfil()) in ('admin','financeiro'))
  with check (escola_id = (select escola_id from current_perfil()) and (select perfil from current_perfil()) in ('admin','financeiro'));

drop policy if exists isaac_repasse_rw on isaac_repasse;
create policy isaac_repasse_rw on isaac_repasse for all
  using (escola_id = (select escola_id from current_perfil()) and (select perfil from current_perfil()) in ('admin','financeiro'))
  with check (escola_id = (select escola_id from current_perfil()) and (select perfil from current_perfil()) in ('admin','financeiro'));

-- As tabelas filhas não têm escola_id: herdam o escopo pelo repasse, mesmo
-- padrão que conciliacao_vinculo usa via extrato_bancario.
drop policy if exists isaac_repasse_linha_rw on isaac_repasse_linha;
create policy isaac_repasse_linha_rw on isaac_repasse_linha for all
  using (exists (
    select 1 from isaac_repasse r
    where r.id = repasse_id
      and r.escola_id = (select escola_id from current_perfil())
      and (select perfil from current_perfil()) in ('admin','financeiro')
  ))
  with check (exists (
    select 1 from isaac_repasse r
    where r.id = repasse_id
      and r.escola_id = (select escola_id from current_perfil())
      and (select perfil from current_perfil()) in ('admin','financeiro')
  ));

drop policy if exists isaac_transferencia_rw on isaac_transferencia;
create policy isaac_transferencia_rw on isaac_transferencia for all
  using (exists (
    select 1 from isaac_repasse r
    where r.id = repasse_id
      and r.escola_id = (select escola_id from current_perfil())
      and (select perfil from current_perfil()) in ('admin','financeiro')
  ))
  with check (exists (
    select 1 from isaac_repasse r
    where r.id = repasse_id
      and r.escola_id = (select escola_id from current_perfil())
      and (select perfil from current_perfil()) in ('admin','financeiro')
  ));

drop policy if exists isaac_parcela_rw on isaac_parcela;
create policy isaac_parcela_rw on isaac_parcela for all
  using (exists (
    select 1 from isaac_repasse r
    where r.id = repasse_id
      and r.escola_id = (select escola_id from current_perfil())
      and (select perfil from current_perfil()) in ('admin','financeiro')
  ))
  with check (exists (
    select 1 from isaac_repasse r
    where r.id = repasse_id
      and r.escola_id = (select escola_id from current_perfil())
      and (select perfil from current_perfil()) in ('admin','financeiro')
  ));

drop policy if exists isaac_mudanca_rw on isaac_mudanca;
create policy isaac_mudanca_rw on isaac_mudanca for all
  using (exists (
    select 1 from isaac_repasse r
    where r.id = repasse_id
      and r.escola_id = (select escola_id from current_perfil())
      and (select perfil from current_perfil()) in ('admin','financeiro')
  ))
  with check (exists (
    select 1 from isaac_repasse r
    where r.id = repasse_id
      and r.escola_id = (select escola_id from current_perfil())
      and (select perfil from current_perfil()) in ('admin','financeiro')
  ));

drop policy if exists aluno_alias_rw on aluno_alias;
create policy aluno_alias_rw on aluno_alias for all
  using (exists (
    select 1 from alunos a
    where a.id = aluno_id
      and a.escola_id = (select escola_id from current_perfil())
      and (select perfil from current_perfil()) in ('admin','financeiro')
  ))
  with check (exists (
    select 1 from alunos a
    where a.id = aluno_id
      and a.escola_id = (select escola_id from current_perfil())
      and (select perfil from current_perfil()) in ('admin','financeiro')
  ));

-- ---------------------------------------------------------------------------
-- RBAC
-- ---------------------------------------------------------------------------

insert into modulos (codigo, grupo, nome, ordem) values
  ('financeiro.isaac', 'financeiro', 'Repasse isaac', 26)
on conflict (codigo) do update set grupo = excluded.grupo, nome = excluded.nome, ordem = excluded.ordem;

-- financeiro importa e resolve pendências, mas não apaga um repasse já
-- gravado: isso é refazer o fechamento de um mês.
insert into role_permissoes (role_codigo, modulo_codigo, pode_ler, pode_criar, pode_editar, pode_deletar) values
  ('admin',      'financeiro.isaac', true,  true,  true,  true),
  ('financeiro', 'financeiro.isaac', true,  true,  true,  false),
  ('secretaria', 'financeiro.isaac', false, false, false, false),
  ('professor',  'financeiro.isaac', false, false, false, false)
on conflict (role_codigo, modulo_codigo) do update set
  pode_ler = excluded.pode_ler,
  pode_criar = excluded.pode_criar,
  pode_editar = excluded.pode_editar,
  pode_deletar = excluded.pode_deletar;

-- ---------------------------------------------------------------------------
-- Seed do de-para unidade ↔ CNPJ
-- ---------------------------------------------------------------------------

-- Casado por CNPJ, não por uuid: o id da company varia entre ambientes, o CNPJ
-- não. Ver o comentário de isaac_unidade sobre a inversão dos nomes.
--
-- O join compara só os dígitos porque companies.cnpj não tem formato único: o
-- seed de 202605270002 grava '11714876000116' e o banco em uso tem
-- '11.714.876/0001-16'. Comparar a string crua casaria em um ambiente e
-- falharia no outro — sem erro, apenas sem linha inserida.
--
-- Se a company ou a escola não existirem, nada é inserido e o importador acusa
-- unidade não configurada: melhor que apontar para o CNPJ errado. A escola é a
-- do seed (DEFAULT_SCHOOL_ID); base mono-escola.
insert into isaac_unidade (escola_id, company_id, nome_isaac)
select e.id, c.id, v.nome_isaac
from (values
  ('EPG Trindade',                     '11714876000116'),  -- Escola Pinguinho de Gente LTDA
  ('EPG Trindade - Educação Infantil', '35027047000123')   -- Colégio Integrado EPG
) as v(nome_isaac, cnpj)
join companies c on regexp_replace(c.cnpj, '\D', '', 'g') = v.cnpj
join escolas e on e.id = '00000000-0000-0000-0000-000000000001'
on conflict (escola_id, nome_isaac) do nothing;
