create extension if not exists "pgcrypto";

create type perfil_usuario as enum ('admin', 'secretaria', 'financeiro', 'professor');
create type turno_turma as enum ('matutino', 'vespertino', 'noturno', 'integral');
create type status_matricula as enum ('ativa', 'cancelada', 'transferida', 'concluida');
create type status_cobranca as enum ('aberta', 'parcial', 'paga', 'vencida', 'cancelada');
create type forma_pagamento as enum ('dinheiro', 'pix', 'cartao', 'boleto', 'transferencia');
create type tipo_arquivo as enum ('pdf_alunos', 'foto_aluno', 'documento_aluno');
create type status_arquivo as enum ('pendente', 'processado', 'erro');

create table escolas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  cnpj text,
  telefone text,
  email text,
  endereco text,
  cidade text,
  uf text,
  cep text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table perfis (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  escola_id uuid not null references escolas(id) on delete cascade,
  nome text not null,
  email text not null,
  perfil perfil_usuario not null default 'admin',
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id),
  unique (escola_id, email)
);

create table alunos (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references escolas(id) on delete cascade,
  matricula_codigo text not null,
  nome text not null,
  sexo text,
  data_nascimento date,
  naturalidade text,
  celular text,
  cpf text,
  rg text,
  certidao_nascimento text,
  certidao_livro text,
  certidao_folha text,
  certidao_numero text,
  certidao_cartorio text,
  email text,
  codigo_inep text,
  etnia text,
  informacoes_adicionais text,
  foto_url text,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (escola_id, matricula_codigo)
);

create table enderecos_aluno (
  id uuid primary key default gen_random_uuid(),
  aluno_id uuid not null references alunos(id) on delete cascade,
  logradouro text not null,
  numero text,
  complemento text,
  bairro text,
  cidade text,
  uf text,
  cep text,
  principal boolean not null default false
);

create table contatos_aluno (
  id uuid primary key default gen_random_uuid(),
  aluno_id uuid not null references alunos(id) on delete cascade,
  nome text not null,
  telefone text,
  celular text,
  parentesco text,
  observacao text,
  principal boolean not null default false
);

create table responsaveis_aluno (
  id uuid primary key default gen_random_uuid(),
  aluno_id uuid not null references alunos(id) on delete cascade,
  nome text not null,
  cpf text,
  telefone text,
  celular text,
  parentesco text,
  email text,
  responsavel_financeiro boolean not null default false,
  responsavel_pedagogico boolean not null default false
);

create table pessoas_autorizadas (
  id uuid primary key default gen_random_uuid(),
  aluno_id uuid not null references alunos(id) on delete cascade,
  nome text not null,
  telefone text,
  documento text,
  observacao text,
  ativo boolean not null default true
);

create table informacoes_medicas (
  id uuid primary key default gen_random_uuid(),
  aluno_id uuid not null unique references alunos(id) on delete cascade,
  alergia boolean not null default false,
  alergia_descricao text,
  necessidade_especial boolean not null default false,
  necessidade_especial_descricao text,
  necessita_apoio boolean not null default false,
  necessita_apoio_descricao text,
  doenca_grave boolean not null default false,
  doenca_grave_descricao text,
  remedio_especial boolean not null default false,
  remedio_especial_descricao text,
  tipo_sanguineo text,
  medico text,
  telefone_medico text,
  plano_saude text,
  telefone_plano text
);

create table autorizacoes_aluno (
  id uuid primary key default gen_random_uuid(),
  aluno_id uuid not null unique references alunos(id) on delete cascade,
  nao_entregar_boletim boolean not null default false,
  assinar_comunicados boolean not null default false,
  requerer_prova_substitutiva boolean not null default false,
  observacoes text
);

create table series (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references escolas(id) on delete cascade,
  nome text not null,
  ordem integer not null default 0,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (escola_id, nome)
);

create table turmas (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references escolas(id) on delete cascade,
  serie_id uuid not null references series(id) on delete restrict,
  nome text not null,
  ano_letivo integer not null,
  turno turno_turma not null default 'matutino',
  capacidade integer not null default 30,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (escola_id, serie_id, nome, ano_letivo)
);

create table planos (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references escolas(id) on delete cascade,
  nome text not null,
  descricao text,
  valor_matricula numeric(12,2) not null default 0,
  valor_mensalidade numeric(12,2) not null default 0,
  quantidade_parcelas integer not null default 12,
  dia_vencimento integer not null default 10,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (escola_id, nome)
);

create table matriculas (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references escolas(id) on delete cascade,
  aluno_id uuid not null references alunos(id) on delete cascade,
  serie_id uuid not null references series(id) on delete restrict,
  turma_id uuid not null references turmas(id) on delete restrict,
  plano_id uuid references planos(id) on delete set null,
  codigo text,
  data_matricula date not null default current_date,
  ano_letivo integer not null,
  idade_na_matricula integer,
  status status_matricula not null default 'ativa',
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table frequencias (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references escolas(id) on delete cascade,
  aluno_id uuid not null references alunos(id) on delete cascade,
  matricula_id uuid references matriculas(id) on delete cascade,
  data_aula date not null,
  presente boolean not null default true,
  justificativa text,
  registrado_por uuid references perfis(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (aluno_id, data_aula)
);

create table cobrancas (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references escolas(id) on delete cascade,
  aluno_id uuid not null references alunos(id) on delete cascade,
  matricula_id uuid references matriculas(id) on delete cascade,
  plano_id uuid references planos(id) on delete set null,
  descricao text not null,
  competencia text not null,
  numero_parcela integer,
  valor_original numeric(12,2) not null default 0,
  valor_desconto numeric(12,2) not null default 0,
  valor_acrescimo numeric(12,2) not null default 0,
  valor_final numeric(12,2) generated always as (valor_original - valor_desconto + valor_acrescimo) stored,
  data_vencimento date not null,
  status status_cobranca not null default 'aberta',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table pagamentos (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references escolas(id) on delete cascade,
  cobranca_id uuid not null references cobrancas(id) on delete cascade,
  aluno_id uuid not null references alunos(id) on delete cascade,
  matricula_id uuid references matriculas(id) on delete cascade,
  data_pagamento date not null default current_date,
  valor_pago numeric(12,2) not null,
  forma_pagamento forma_pagamento not null,
  observacao text,
  registrado_por uuid references perfis(id) on delete set null,
  created_at timestamptz not null default now()
);

create table arquivos_importados (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references escolas(id) on delete cascade,
  nome_arquivo text not null,
  tipo tipo_arquivo not null,
  storage_path text not null,
  status status_arquivo not null default 'pendente',
  observacao text,
  created_at timestamptz not null default now()
);

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger escolas_updated_at before update on escolas for each row execute function set_updated_at();
create trigger perfis_updated_at before update on perfis for each row execute function set_updated_at();
create trigger alunos_updated_at before update on alunos for each row execute function set_updated_at();
create trigger series_updated_at before update on series for each row execute function set_updated_at();
create trigger turmas_updated_at before update on turmas for each row execute function set_updated_at();
create trigger planos_updated_at before update on planos for each row execute function set_updated_at();
create trigger matriculas_updated_at before update on matriculas for each row execute function set_updated_at();
create trigger cobrancas_updated_at before update on cobrancas for each row execute function set_updated_at();

create index alunos_escola_nome_idx on alunos (escola_id, nome);
create index matriculas_aluno_idx on matriculas (aluno_id);
create index cobrancas_status_idx on cobrancas (escola_id, status, data_vencimento);
create index pagamentos_data_idx on pagamentos (escola_id, data_pagamento);
create index frequencias_data_idx on frequencias (escola_id, data_aula);

alter table escolas enable row level security;
alter table perfis enable row level security;
alter table alunos enable row level security;
alter table enderecos_aluno enable row level security;
alter table contatos_aluno enable row level security;
alter table responsaveis_aluno enable row level security;
alter table pessoas_autorizadas enable row level security;
alter table informacoes_medicas enable row level security;
alter table autorizacoes_aluno enable row level security;
alter table series enable row level security;
alter table turmas enable row level security;
alter table planos enable row level security;
alter table matriculas enable row level security;
alter table frequencias enable row level security;
alter table cobrancas enable row level security;
alter table pagamentos enable row level security;
alter table arquivos_importados enable row level security;

create policy "service role full access escolas" on escolas for all to service_role using (true) with check (true);
create policy "service role full access perfis" on perfis for all to service_role using (true) with check (true);
create policy "service role full access alunos" on alunos for all to service_role using (true) with check (true);
create policy "service role full access enderecos" on enderecos_aluno for all to service_role using (true) with check (true);
create policy "service role full access contatos" on contatos_aluno for all to service_role using (true) with check (true);
create policy "service role full access responsaveis" on responsaveis_aluno for all to service_role using (true) with check (true);
create policy "service role full access autorizadas" on pessoas_autorizadas for all to service_role using (true) with check (true);
create policy "service role full access medicas" on informacoes_medicas for all to service_role using (true) with check (true);
create policy "service role full access aut aluno" on autorizacoes_aluno for all to service_role using (true) with check (true);
create policy "service role full access series" on series for all to service_role using (true) with check (true);
create policy "service role full access turmas" on turmas for all to service_role using (true) with check (true);
create policy "service role full access planos" on planos for all to service_role using (true) with check (true);
create policy "service role full access matriculas" on matriculas for all to service_role using (true) with check (true);
create policy "service role full access frequencias" on frequencias for all to service_role using (true) with check (true);
create policy "service role full access cobrancas" on cobrancas for all to service_role using (true) with check (true);
create policy "service role full access pagamentos" on pagamentos for all to service_role using (true) with check (true);
create policy "service role full access arquivos" on arquivos_importados for all to service_role using (true) with check (true);

insert into storage.buckets (id, name, public)
values
  ('alunos-fotos', 'alunos-fotos', true),
  ('documentos-alunos', 'documentos-alunos', false),
  ('importacoes', 'importacoes', false)
on conflict (id) do nothing;
