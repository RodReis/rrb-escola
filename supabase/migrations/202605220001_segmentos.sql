-- Cria tabela segmentos, adiciona FK em series, seed dos 4 segmentos RRB.

create table segmentos (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references escolas(id) on delete cascade,
  nome text not null,
  ordem integer not null default 0,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  unique (escola_id, nome)
);

alter table series
  add column if not exists segmento_id uuid references segmentos(id) on delete set null;

-- RLS
alter table segmentos enable row level security;
create policy "service role full access segmentos" on segmentos for all to service_role using (true) with check (true);
create policy "authenticated read segmentos" on segmentos for select to authenticated
  using (escola_id in (select escola_id from perfis where user_id = auth.uid()));

-- Garante escola default antes de seed (seed.sql roda apos migrations)
insert into escolas (id, nome, cnpj, telefone, email, endereco, cidade, uf, cep)
values (
  '00000000-0000-0000-0000-000000000001',
  'RRB Escola',
  '00.000.000/0001-00',
  '(62) 3333-0000',
  'secretaria@rrbescola.local',
  'Rua Principal, 100',
  'Goiânia',
  'GO',
  '74000-000'
)
on conflict (id) do nothing;

-- Seed: 4 segmentos para escola 00000000-0000-0000-0000-000000000001
insert into segmentos (id, escola_id, nome, ordem) values
  ('a0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Educação Infantil', 1),
  ('a0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Ensino Fundamental I', 2),
  ('a0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'Ensino Fundamental II', 3),
  ('a0000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'Ensino Médio', 4)
on conflict (escola_id, nome) do nothing;

-- Educação Infantil: Maternal, Infantil 3, 4, 5
update series set segmento_id = 'a0000000-0000-0000-0000-000000000001'
  where id in (
    'd8f736c7-1b07-4c23-8212-6893a28d0d9e',
    'c98fb4b5-7400-4b77-bdc7-7e1da7721158',
    '4318deaa-148c-4091-9c00-1e44265c1b9f',
    '7bf3b47f-f27b-47f9-8cdf-d42d964f752d'
  );

-- Ensino Fundamental I: 1º ao 5º Ano
update series set segmento_id = 'a0000000-0000-0000-0000-000000000002'
  where id in (
    '10000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000003',
    '10000000-0000-0000-0000-000000000004',
    '10000000-0000-0000-0000-000000000005'
  );

-- Ensino Fundamental II: 6º ao 9º Ano
update series set segmento_id = 'a0000000-0000-0000-0000-000000000003'
  where id in (
    '3b91be2e-f658-48dd-b7ef-112dae9c7815',
    '2b215070-7f42-4734-bd76-751f4c965f25',
    '701c834e-8eb0-4228-9f75-9eb41b4eb5d0',
    '3ff76f09-57bf-4775-ab29-322b6b621aa7'
  );

-- Ensino Médio: 1ª, 2ª, 3ª Série
update series set segmento_id = 'a0000000-0000-0000-0000-000000000004'
  where id in (
    'fc34bde5-c1d7-4986-a827-06d71be3a5a3',
    '7a93f03a-65b8-4b5f-97e4-3beda47d640d',
    '5a69fca7-1935-4c53-a89a-982601705a90'
  );
