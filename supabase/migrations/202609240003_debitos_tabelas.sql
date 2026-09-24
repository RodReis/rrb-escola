-- Par de transferência entre contas próprias.
--
-- credito_extrato_id é nullable porque a conta de destino pode não ter extrato
-- no sistema — é o caso da Caixa, que paga a folha (D2: conta do Pinguinho).
-- Nesses casos fica só a perna do débito.
create table if not exists transferencia_interna (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references escolas(id) on delete cascade,
  debito_extrato_id  uuid not null unique references extrato_bancario(id) on delete cascade,
  credito_extrato_id uuid unique references extrato_bancario(id) on delete set null,
  conta_destino_id   uuid references contas_bancarias(id) on delete restrict,
  origem origem_conciliacao not null,
  observacao text,
  criado_por uuid references perfis(id) on delete set null,
  criado_em timestamptz not null default now()
);

create index if not exists transferencia_interna_escola_idx
  on transferencia_interna (escola_id, criado_em desc);

-- Regra de contraparte.
--
-- `documento` guarda o que o banco manda: 14 dígitos para CNPJ, os 6 visíveis
-- para CPF mascarado. Não é o documento completo da pessoa física, e não deve
-- virar — a máscara vem do Sicoob e é estável, o que basta como chave.
--
-- `valor_esperado` + `dia_inicio`/`dia_fim` existem por causa da D7: o pró-labore
-- casa por VALOR EXATO dentro de uma janela de dias. Sem isso, "maior pagamento
-- do mês" classificaria retirada extraordinária como pró-labore — foi testado e
-- classificou errado os R$ 10.000 de fevereiro e os R$ 6.500 de maio.
create table if not exists contraparte_regra (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references escolas(id) on delete cascade,
  tipo_match text not null check (tipo_match in ('documento','texto')),
  documento text,
  padrao_texto text,
  valor_esperado numeric(12,2),
  dia_inicio int check (dia_inicio between 1 and 31),
  dia_fim    int check (dia_fim between 1 and 31),
  conta_id uuid references contas_bancarias(id) on delete cascade,
  categoria_id uuid not null references categorias_financeiras(id) on delete restrict,
  company_id uuid references companies(id) on delete restrict,
  classe_despesa text check (classe_despesa in ('fixa','variavel')),
  descricao_padrao text,
  ativo boolean not null default true,
  usos int not null default 0,
  ultimo_uso timestamptz,
  criado_por uuid references perfis(id) on delete set null,
  criado_em timestamptz not null default now(),
  check ((tipo_match = 'documento' and documento is not null)
      or (tipo_match = 'texto' and padrao_texto is not null)),
  -- janela de dias só faz sentido com os dois lados preenchidos
  check ((dia_inicio is null) = (dia_fim is null))
);

-- Regra mais específica primeiro: valor+janela, depois conta, depois geral.
create index if not exists contraparte_regra_doc_idx
  on contraparte_regra (escola_id, documento) where tipo_match = 'documento' and ativo;
create index if not exists contraparte_regra_texto_idx
  on contraparte_regra (escola_id) where tipo_match = 'texto' and ativo;

-- Ignorar passa a exigir motivo.
alter table extrato_bancario add column if not exists motivo_ignorado text;

-- Idempotência do lançamento criado a partir de um débito: reprocessar o
-- pipeline não pode duplicar despesa.
create unique index if not exists lancamento_financeiro_origem_extrato_uq
  on lancamento_financeiro (origem_tipo, origem_id)
  where origem_tipo = 'extrato' and origem_id is not null;

alter table transferencia_interna enable row level security;
alter table contraparte_regra      enable row level security;

drop policy if exists transferencia_interna_rw on transferencia_interna;
create policy transferencia_interna_rw on transferencia_interna for all
  using (exists (select 1 from current_perfil() p
                 where p.id is not null and p.perfil in ('admin','financeiro')))
  with check (exists (select 1 from current_perfil() p
                      where p.id is not null and p.perfil in ('admin','financeiro')));

drop policy if exists contraparte_regra_rw on contraparte_regra;
create policy contraparte_regra_rw on contraparte_regra for all
  using (exists (select 1 from current_perfil() p
                 where p.id is not null and p.perfil in ('admin','financeiro')))
  with check (exists (select 1 from current_perfil() p
                      where p.id is not null and p.perfil in ('admin','financeiro')));
