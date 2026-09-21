-- Contrato de receita recorrente (Fase 3) — ex.: terceirização da lanchonete.
-- RPC gerar_lancamentos_contratos(competencia) idempotente: não duplica lançamento
-- já gerado para a competência (guard via origem_tipo='contrato' + origem_id + competencia).
-- RLS admin/financeiro (é parte do livro-razão). RBAC: financeiro.contratos.

-- 1) Enum
do $$ begin
  create type periodicidade as enum ('mensal');
exception when duplicate_object then null;
end $$;

-- 2) Tabela
create table if not exists contrato_receita (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references escolas(id) on delete cascade,
  descricao text not null,
  contraparte text,
  valor numeric(12,2) not null check (valor > 0),
  periodicidade periodicidade not null default 'mensal',
  dia_vencimento smallint not null check (dia_vencimento between 1 and 28),
  categoria_id uuid references categorias_financeiras(id) on delete restrict,
  ativo boolean not null default true,
  inicio date not null,
  fim date,
  criado_em timestamptz not null default now()
);
create index if not exists contrato_receita_escola_idx on contrato_receita (escola_id);

-- 3) RPC geração idempotente
create or replace function gerar_lancamentos_contratos(p_competencia text)
returns integer                 -- nº de lançamentos criados
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
  v_contrato record;
  v_venc date;
  v_inicio_mes date;
  v_fim_mes date;
begin
  if p_competencia !~ '^\d{4}-\d{2}$' then
    raise exception 'Competência inválida: % (use YYYY-MM)', p_competencia;
  end if;

  v_inicio_mes := to_date(p_competencia || '-01', 'YYYY-MM-DD');
  v_fim_mes := (v_inicio_mes + interval '1 month - 1 day')::date;

  for v_contrato in
    select * from contrato_receita
    where ativo = true
      and inicio <= v_fim_mes
      and (fim is null or fim >= v_inicio_mes)
  loop
    v_venc := to_date(p_competencia || '-' || lpad(v_contrato.dia_vencimento::text, 2, '0'), 'YYYY-MM-DD');

    -- idempotência: pula se já existe lançamento deste contrato nesta competência
    if exists (
      select 1 from lancamento_financeiro
      where origem_tipo = 'contrato'
        and origem_id = v_contrato.id
        and competencia = p_competencia
    ) then
      continue;
    end if;

    insert into lancamento_financeiro (
      escola_id, tipo, competencia, descricao, categoria_id, contraparte,
      valor, data_vencimento, status, origem_tipo, origem_id
    ) values (
      v_contrato.escola_id, 'receita', p_competencia, v_contrato.descricao,
      v_contrato.categoria_id, v_contrato.contraparte, v_contrato.valor,
      v_venc, 'aberta', 'contrato', v_contrato.id
    );
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

grant execute on function gerar_lancamentos_contratos(text) to authenticated;

-- 4) RLS — admin/financeiro
alter table contrato_receita enable row level security;

drop policy if exists contrato_receita_rw on contrato_receita;
create policy contrato_receita_rw on contrato_receita for all
  using (escola_id = (select escola_id from current_perfil())
    and (select perfil from current_perfil()) in ('admin','financeiro'))
  with check (escola_id = (select escola_id from current_perfil())
    and (select perfil from current_perfil()) in ('admin','financeiro'));

-- 5) RBAC
insert into modulos (codigo, grupo, nome, ordem) values
  ('financeiro.contratos', 'financeiro', 'Contratos de Receita', 17)
on conflict (codigo) do nothing;

insert into role_permissoes (role_codigo, modulo_codigo, pode_ler, pode_criar, pode_editar, pode_deletar) values
  ('admin',      'financeiro.contratos', true,  true,  true,  true),
  ('financeiro', 'financeiro.contratos', true,  true,  true,  true),
  ('secretaria', 'financeiro.contratos', false, false, false, false),
  ('professor',  'financeiro.contratos', false, false, false, false)
on conflict (role_codigo, modulo_codigo) do nothing;
