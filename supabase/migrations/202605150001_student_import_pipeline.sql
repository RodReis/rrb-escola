alter type tipo_arquivo add value if not exists 'planilha_alunos';

create table if not exists importacao_alunos_linhas (
  id uuid primary key default gen_random_uuid(),
  arquivo_id uuid not null references arquivos_importados(id) on delete cascade,
  escola_id uuid not null references escolas(id) on delete cascade,
  linha integer not null,
  status text not null default 'pendente',
  dados jsonb not null default '{}'::jsonb,
  erros text[] not null default '{}',
  aluno_id uuid references alunos(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (arquivo_id, linha)
);

create index if not exists importacao_alunos_linhas_arquivo_idx on importacao_alunos_linhas (arquivo_id);
create index if not exists importacao_alunos_linhas_status_idx on importacao_alunos_linhas (arquivo_id, status);

create trigger importacao_alunos_linhas_set_updated_at
before update on importacao_alunos_linhas
for each row execute function set_updated_at();
