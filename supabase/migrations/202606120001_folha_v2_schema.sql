create table if not exists public.folha_rubricas (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references escolas(id) on delete cascade,
  codigo text not null,
  nome text not null,
  tipo text not null check (tipo in ('provento','desconto','base','informativa')),
  metodo_calculo text not null,
  incide_inss boolean not null default false,
  incide_irrf boolean not null default false,
  incide_fgts boolean not null default false,
  incide_dsr boolean not null default false,
  ordem_holerite int not null default 100,
  ativa boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (escola_id, codigo)
);

create table if not exists public.folha_perfis_calculo (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references escolas(id) on delete cascade,
  codigo text not null,
  nome text not null,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  unique (escola_id, codigo)
);

create table if not exists public.folha_perfis_rubricas (
  id uuid primary key default gen_random_uuid(),
  perfil_id uuid not null references folha_perfis_calculo(id) on delete cascade,
  rubrica_id uuid not null references folha_rubricas(id) on delete cascade,
  automatica boolean not null default true,
  ordem_execucao int not null default 100,
  unique (perfil_id, rubrica_id)
);

create table if not exists public.folha_contratos (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references escolas(id) on delete cascade,
  employee_id uuid not null references employees(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  perfil_calculo_id uuid not null references folha_perfis_calculo(id),
  salario_base numeric(12,2),
  valor_hora_aula numeric(12,2),
  aulas_semanais int,
  dependentes_irrf int not null default 0,
  data_admissao date not null,
  data_desligamento date,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists folha_contratos_um_ativo
  on folha_contratos (employee_id) where ativo;

create table if not exists public.folha_contratos_rubricas (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid not null references folha_contratos(id) on delete cascade,
  rubrica_id uuid not null references folha_rubricas(id) on delete restrict,
  valor numeric(12,2),
  percentual numeric(7,4),
  ativa boolean not null default true,
  unique (contrato_id, rubrica_id)
);

create table if not exists public.folha_runs (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references escolas(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  competencia text not null check (competencia ~ '^\d{4}-\d{2}$'),
  status text not null default 'rascunho'
    check (status in ('rascunho','em_revisao','aprovada','paga','fechada')),
  total_proventos numeric(12,2) not null default 0,
  total_descontos numeric(12,2) not null default 0,
  total_liquido numeric(12,2) not null default 0,
  total_encargos numeric(12,2) not null default 0,
  gerada_por text not null default 'cron',
  aprovada_por uuid references auth.users(id),
  fechada_por uuid references auth.users(id),
  aprovada_em timestamptz,
  paga_em timestamptz,
  fechada_em timestamptz,
  reaberta_motivo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, competencia)
);

create table if not exists public.folha_itens (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references folha_runs(id) on delete cascade,
  contrato_id uuid not null references folha_contratos(id),
  status text not null default 'ativo' check (status in ('ativo','excluido')),
  total_proventos numeric(12,2) not null default 0,
  total_descontos numeric(12,2) not null default 0,
  liquido numeric(12,2) not null default 0,
  base_inss numeric(12,2) not null default 0,
  base_irrf numeric(12,2) not null default 0,
  base_fgts numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  unique (run_id, contrato_id)
);

create table if not exists public.folha_lancamentos (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references folha_itens(id) on delete cascade,
  rubrica_id uuid not null references folha_rubricas(id),
  referencia text,
  valor numeric(12,2) not null,
  origem text not null default 'auto' check (origem in ('auto','manual','recorrente')),
  valor_calculado numeric(12,2),
  editado_por uuid references auth.users(id),
  recorrente_parcelas int,
  recorrente_parcela_atual int,
  created_at timestamptz not null default now()
);
create index if not exists folha_lancamentos_item_idx on folha_lancamentos (item_id);

create table if not exists public.folha_provisoes (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid not null references folha_contratos(id) on delete cascade,
  competencia text not null check (competencia ~ '^\d{4}-\d{2}$'),
  tipo text not null check (tipo in ('decimo_terceiro','ferias','fgts','inss_patronal')),
  valor_mes numeric(12,2) not null,
  saldo_acumulado numeric(12,2) not null,
  baixada_em timestamptz,
  created_at timestamptz not null default now(),
  unique (contrato_id, competencia, tipo)
);

create table if not exists public.folha_config (
  company_id uuid primary key references companies(id) on delete cascade,
  escola_id uuid not null references escolas(id) on delete cascade,
  dia_fechamento int not null default 1,
  regra_pagamento jsonb not null default '{"tipo":"dia_util","n":5}',
  divisor_dsr int not null default 6,
  percentual_hora_atividade numeric(7,4) not null default 5,
  semanas_mes numeric(4,2) not null default 4.5,
  dia_vencimento_gps int not null default 20,
  dia_vencimento_fgts int not null default 20,
  categoria_despesa_folha uuid references categorias_despesa(id),
  categoria_despesa_encargos uuid references categorias_despesa(id),
  feriados_locais jsonb not null default '[]',
  jobs jsonb not null default '{"gerar_folha":true,"alertas":true}',
  updated_at timestamptz not null default now()
);

create table if not exists public.irrf_redutor (
  id uuid primary key default gen_random_uuid(),
  valido_de date not null,
  valido_ate date,
  limite_isencao numeric(12,2) not null,
  limite_reducao numeric(12,2) not null
);

create table if not exists public.jobs_log (
  id uuid primary key default gen_random_uuid(),
  job text not null,
  executado_em timestamptz not null default now(),
  sucesso boolean not null,
  detalhe jsonb
);

do $$
declare t text;
begin
  foreach t in array array['folha_rubricas','folha_perfis_calculo','folha_perfis_rubricas',
    'folha_contratos','folha_contratos_rubricas','folha_runs','folha_itens',
    'folha_lancamentos','folha_provisoes','folha_config']
  loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

create policy "folha_rubricas_rw" on folha_rubricas for all to authenticated
  using (
    escola_id = (select escola_id from current_perfil())
    and (select perfil from current_perfil()) in ('admin','financeiro')
  )
  with check (
    escola_id = (select escola_id from current_perfil())
    and (select perfil from current_perfil()) in ('admin','financeiro')
  );

create policy "folha_perfis_calculo_rw" on folha_perfis_calculo for all to authenticated
  using (
    escola_id = (select escola_id from current_perfil())
    and (select perfil from current_perfil()) in ('admin','financeiro')
  )
  with check (
    escola_id = (select escola_id from current_perfil())
    and (select perfil from current_perfil()) in ('admin','financeiro')
  );

create policy "folha_perfis_rubricas_rw" on folha_perfis_rubricas for all to authenticated
  using (exists (
    select 1 from folha_perfis_calculo p
    where p.id = perfil_id
      and p.escola_id = (select escola_id from current_perfil())
      and (select perfil from current_perfil()) in ('admin','financeiro')
  ));

create policy "folha_contratos_rw" on folha_contratos for all to authenticated
  using (
    escola_id = (select escola_id from current_perfil())
    and (select perfil from current_perfil()) in ('admin','financeiro')
  )
  with check (
    escola_id = (select escola_id from current_perfil())
    and (select perfil from current_perfil()) in ('admin','financeiro')
  );

create policy "folha_contratos_rubricas_rw" on folha_contratos_rubricas for all to authenticated
  using (exists (
    select 1 from folha_contratos c
    where c.id = contrato_id
      and c.escola_id = (select escola_id from current_perfil())
      and (select perfil from current_perfil()) in ('admin','financeiro')
  ));

create policy "folha_runs_rw" on folha_runs for all to authenticated
  using (
    escola_id = (select escola_id from current_perfil())
    and (select perfil from current_perfil()) in ('admin','financeiro')
  )
  with check (
    escola_id = (select escola_id from current_perfil())
    and (select perfil from current_perfil()) in ('admin','financeiro')
  );

create policy "folha_itens_rw" on folha_itens for all to authenticated
  using (exists (
    select 1 from folha_runs r
    where r.id = run_id
      and r.escola_id = (select escola_id from current_perfil())
      and (select perfil from current_perfil()) in ('admin','financeiro')
  ));

create policy "folha_lancamentos_rw" on folha_lancamentos for all to authenticated
  using (exists (
    select 1 from folha_itens i
    join folha_runs r on r.id = i.run_id
    where i.id = item_id
      and r.escola_id = (select escola_id from current_perfil())
      and (select perfil from current_perfil()) in ('admin','financeiro')
  ));

create policy "folha_provisoes_rw" on folha_provisoes for all to authenticated
  using (exists (
    select 1 from folha_contratos c
    where c.id = contrato_id
      and c.escola_id = (select escola_id from current_perfil())
      and (select perfil from current_perfil()) in ('admin','financeiro')
  ));

create policy "folha_config_rw" on folha_config for all to authenticated
  using (
    escola_id = (select escola_id from current_perfil())
    and (select perfil from current_perfil()) in ('admin','financeiro')
  )
  with check (
    escola_id = (select escola_id from current_perfil())
    and (select perfil from current_perfil()) in ('admin','financeiro')
  );

drop trigger if exists folha_rubricas_updated_at on folha_rubricas;
create trigger folha_rubricas_updated_at before update on folha_rubricas
  for each row execute function public.set_updated_at();

drop trigger if exists folha_contratos_updated_at on folha_contratos;
create trigger folha_contratos_updated_at before update on folha_contratos
  for each row execute function public.set_updated_at();

drop trigger if exists folha_runs_updated_at on folha_runs;
create trigger folha_runs_updated_at before update on folha_runs
  for each row execute function public.set_updated_at();

drop trigger if exists folha_config_updated_at on folha_config;
create trigger folha_config_updated_at before update on folha_config
  for each row execute function public.set_updated_at();
