-- Tabela de referencia: valores praticados por ano/segmento/ordem de filho
create table valores_praticados (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references escolas(id) on delete cascade,
  ano_letivo integer not null,
  segmento text not null check (segmento in ('INFANTIL', 'FUNDAMENTAL1', 'FUNDAMENTAL2', 'MEDIO')),
  ordem_filho integer not null check (ordem_filho between 1 and 3),
  valor_matricula numeric(12,2) not null default 0,
  valor_mensalidade numeric(12,2) not null default 0,
  observacao text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (escola_id, ano_letivo, segmento, ordem_filho)
);

create trigger valores_praticados_updated_at
  before update on valores_praticados
  for each row execute function set_updated_at();

alter table valores_praticados enable row level security;
create policy "service role full access valores_praticados"
  on valores_praticados for all to service_role using (true) with check (true);
create policy "authenticated read valores_praticados"
  on valores_praticados for select to authenticated using (true);
create policy "authenticated write valores_praticados"
  on valores_praticados for all to authenticated using (true) with check (true);

-- Capacidade default por segmento (referencia para novos cadastros)
create table segmento_config (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references escolas(id) on delete cascade,
  segmento text not null check (segmento in ('INFANTIL', 'FUNDAMENTAL1', 'FUNDAMENTAL2', 'MEDIO')),
  capacidade_default integer not null check (capacidade_default > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (escola_id, segmento)
);

create trigger segmento_config_updated_at
  before update on segmento_config
  for each row execute function set_updated_at();

alter table segmento_config enable row level security;
create policy "service role full access segmento_config"
  on segmento_config for all to service_role using (true) with check (true);
create policy "authenticated read segmento_config"
  on segmento_config for select to authenticated using (true);
create policy "authenticated write segmento_config"
  on segmento_config for all to authenticated using (true) with check (true);

-- Seeds segmento_config
insert into segmento_config (escola_id, segmento, capacidade_default) values
  ('00000000-0000-0000-0000-000000000001', 'INFANTIL', 20),
  ('00000000-0000-0000-0000-000000000001', 'FUNDAMENTAL1', 20),
  ('00000000-0000-0000-0000-000000000001', 'FUNDAMENTAL2', 35),
  ('00000000-0000-0000-0000-000000000001', 'MEDIO', 35)
on conflict (escola_id, segmento) do nothing;

-- Seeds valores_praticados 2026
insert into valores_praticados (escola_id, ano_letivo, segmento, ordem_filho, valor_matricula, valor_mensalidade) values
  ('00000000-0000-0000-0000-000000000001', 2026, 'INFANTIL',     1, 690, 690),
  ('00000000-0000-0000-0000-000000000001', 2026, 'INFANTIL',     2, 650, 650),
  ('00000000-0000-0000-0000-000000000001', 2026, 'INFANTIL',     3, 600, 600),
  ('00000000-0000-0000-0000-000000000001', 2026, 'FUNDAMENTAL1', 1, 745, 745),
  ('00000000-0000-0000-0000-000000000001', 2026, 'FUNDAMENTAL1', 2, 690, 690),
  ('00000000-0000-0000-0000-000000000001', 2026, 'FUNDAMENTAL1', 3, 650, 650),
  ('00000000-0000-0000-0000-000000000001', 2026, 'FUNDAMENTAL2', 1, 890, 890),
  ('00000000-0000-0000-0000-000000000001', 2026, 'FUNDAMENTAL2', 2, 825, 825),
  ('00000000-0000-0000-0000-000000000001', 2026, 'FUNDAMENTAL2', 3, 750, 750),
  ('00000000-0000-0000-0000-000000000001', 2026, 'MEDIO',        1, 955, 955),
  ('00000000-0000-0000-0000-000000000001', 2026, 'MEDIO',        2, 900, 900),
  ('00000000-0000-0000-0000-000000000001', 2026, 'MEDIO',        3, 850, 850)
on conflict (escola_id, ano_letivo, segmento, ordem_filho) do nothing;

-- Seeds valores_praticados 2025 (historico)
insert into valores_praticados (escola_id, ano_letivo, segmento, ordem_filho, valor_matricula, valor_mensalidade) values
  ('00000000-0000-0000-0000-000000000001', 2025, 'INFANTIL',     1, 650, 650),
  ('00000000-0000-0000-0000-000000000001', 2025, 'INFANTIL',     2, 595, 595),
  ('00000000-0000-0000-0000-000000000001', 2025, 'INFANTIL',     3, 540, 540),
  ('00000000-0000-0000-0000-000000000001', 2025, 'FUNDAMENTAL1', 1, 690, 690),
  ('00000000-0000-0000-0000-000000000001', 2025, 'FUNDAMENTAL1', 2, 650, 650),
  ('00000000-0000-0000-0000-000000000001', 2025, 'FUNDAMENTAL1', 3, 600, 600),
  ('00000000-0000-0000-0000-000000000001', 2025, 'FUNDAMENTAL2', 1, 830, 830),
  ('00000000-0000-0000-0000-000000000001', 2025, 'FUNDAMENTAL2', 2, 775, 775),
  ('00000000-0000-0000-0000-000000000001', 2025, 'FUNDAMENTAL2', 3, 625, 625),
  ('00000000-0000-0000-0000-000000000001', 2025, 'MEDIO',        1, 920, 920),
  ('00000000-0000-0000-0000-000000000001', 2025, 'MEDIO',        2, 880, 880),
  ('00000000-0000-0000-0000-000000000001', 2025, 'MEDIO',        3, 830, 830)
on conflict (escola_id, ano_letivo, segmento, ordem_filho) do nothing;
