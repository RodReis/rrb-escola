alter table public.folha_runs add column if not exists tipo text not null default 'mensal'
  check (tipo in ('mensal','decimo_1a','decimo_2a','ferias'));
alter table public.folha_runs drop constraint if exists folha_runs_company_id_competencia_key;
create unique index if not exists folha_runs_company_comp_tipo
  on public.folha_runs (company_id, competencia, tipo);

create table if not exists public.folha_periodos_aquisitivos (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid not null references folha_contratos(id) on delete cascade,
  inicio date not null,
  fim date not null,
  dias_direito int not null default 30,
  janela text,
  gozo_inicio date,
  gozo_dias int,
  dias_abono int not null default 0 check (dias_abono in (0, 10)),
  status text not null default 'aberto' check (status in ('aberto','agendado','gozado','vencido')),
  run_id uuid references folha_runs(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (contrato_id, inicio)
);
alter table public.folha_periodos_aquisitivos enable row level security;
create policy folha_aquisitivos_rw on folha_periodos_aquisitivos for all
  to authenticated
  using (
    exists (
      select 1 from folha_contratos c
      where c.id = contrato_id
        and c.escola_id = (select current_perfil.escola_id from current_perfil() current_perfil)
        and (select current_perfil.perfil from current_perfil() current_perfil) = any (array['admin','financeiro'])
    )
  )
  with check (
    exists (
      select 1 from folha_contratos c
      where c.id = contrato_id
        and c.escola_id = (select current_perfil.escola_id from current_perfil() current_perfil)
        and (select current_perfil.perfil from current_perfil() current_perfil) = any (array['admin','financeiro'])
    )
  );
drop trigger if exists folha_aquisitivos_updated_at on folha_periodos_aquisitivos;
create trigger folha_aquisitivos_updated_at before update on folha_periodos_aquisitivos
for each row execute function public.set_updated_at();

alter table public.folha_itens
  add column if not exists periodo_aquisitivo_id uuid references folha_periodos_aquisitivos(id) on delete set null;

alter table public.folha_contratos
  add column if not exists antecipa_13_com_ferias boolean not null default false,
  add column if not exists janela_ferias text;

alter table public.folha_config
  add column if not exists ferias_janelas jsonb not null default
    '[{"codigo":"julho","mes_gozo":7,"mes_pagamento":6},{"codigo":"dezembro","mes_gozo":1,"mes_pagamento":12}]',
  add column if not exists decimo_1a_prazo text not null default '11-30',
  add column if not exists decimo_2a_prazo text not null default '12-20',
  add column if not exists decimo_gerar_dia jsonb not null default '{"decimo_1a":"11-01","decimo_2a":"12-01"}',
  add column if not exists ferias_gerar_antes_dias int not null default 30,
  add column if not exists ferias_pagar_antes_dias int not null default 2,
  add column if not exists alerta_aquisitivo_dias jsonb not null default '[60,30]',
  add column if not exists base_13_ferias jsonb not null default '{"clt_professor":"media_12","clt":"vigente"}',
  add column if not exists recesso jsonb not null default '{"inicio":"12-21","fim":"01-10"}';

alter table public.companies
  add column if not exists endereco text,
  add column if not exists cidade text;

insert into folha_rubricas (escola_id, codigo, nome, tipo, metodo_calculo,
  incide_inss, incide_irrf, incide_fgts, incide_dsr, ordem_holerite)
select e.id, r.codigo, r.nome, r.tipo, r.metodo, r.inss, r.irrf, r.fgts, r.dsr, r.ordem
from escolas e cross join (values
  ('decimo_1a_parcela','13º Salário — 1ª parcela','provento','decimo_1a',false,false,true,false,10),
  ('decimo_2a_parcela','13º Salário — 2ª parcela','provento','decimo_2a',false,false,true,false,10),
  ('inss_13','INSS 13º','desconto','inss_13',false,false,false,false,60),
  ('irrf_13','IRRF 13º','desconto','irrf_13',false,false,false,false,61),
  ('desconto_adiantamento_13','Adiantamento 13º (1ª parcela)','desconto','auto_decimo_2a',false,false,false,false,62),
  ('ferias_gozo','Férias','provento','ferias_gozo',true,true,true,false,10),
  ('ferias_terco','1/3 Constitucional','provento','ferias_terco',true,true,true,false,11),
  ('abono_pecuniario','Abono pecuniário','provento','abono',false,false,false,false,12),
  ('abono_terco','1/3 do abono','provento','abono_terco',false,false,false,false,13),
  ('ferias_desconto_gozo','Desconto férias gozadas','desconto','auto_mensal_gozo',false,false,false,false,68),
  ('inss_ferias','INSS Férias','desconto','inss_ferias',false,false,false,false,60),
  ('irrf_ferias','IRRF Férias','desconto','irrf_ferias',false,false,false,false,61),
  ('ferias_dobro','Dobro de férias (art. 137)','provento','manual',true,true,true,false,20),
  ('ferias_dobro_terco','1/3 do dobro','provento','manual',true,true,true,false,21)
) as r(codigo,nome,tipo,metodo,inss,irrf,fgts,dsr,ordem)
on conflict (escola_id, codigo) do nothing;

insert into folha_periodos_aquisitivos (contrato_id, inicio, fim, janela)
select c.id, c.data_admissao, c.data_admissao + interval '12 months', c.janela_ferias
from folha_contratos c
where c.ativo and not exists (select 1 from folha_periodos_aquisitivos p where p.contrato_id = c.id);
