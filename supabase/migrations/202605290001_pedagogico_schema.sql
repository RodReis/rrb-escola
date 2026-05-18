-- Modulo pedagogico: disciplinas, atribuicoes de professor, avaliacoes, notas
-- Estrutura: avaliacao por turma/disciplina/bimestre, notas vinculadas a avaliacao,
-- consolidacao bimestral via view (media ponderada por peso).

-- Disciplinas globais por serie
create table disciplinas (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references escolas(id) on delete cascade,
  serie_id uuid not null references series(id) on delete cascade,
  nome text not null,
  ordem int not null default 0,
  ativo bool not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (escola_id, serie_id, nome)
);

create index disciplinas_serie_idx on disciplinas (serie_id);
create trigger disciplinas_updated_at before update on disciplinas
  for each row execute function set_updated_at();

-- Professor responsavel por disciplina+turma
create table professor_disciplina_turma (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references escolas(id) on delete cascade,
  perfil_id uuid not null references perfis(id) on delete cascade,
  disciplina_id uuid not null references disciplinas(id) on delete cascade,
  turma_id uuid not null references turmas(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (escola_id, perfil_id, disciplina_id, turma_id)
);

create index professor_disciplina_turma_perfil_idx on professor_disciplina_turma (perfil_id);
create index professor_disciplina_turma_turma_idx on professor_disciplina_turma (turma_id);

-- Tipo de avaliacao
do $$ begin
  create type tipo_avaliacao as enum ('prova', 'trabalho', 'participacao', 'simulado', 'outro');
exception when duplicate_object then null;
end $$;

-- Avaliacoes (provas, trabalhos)
create table avaliacoes (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references escolas(id) on delete cascade,
  disciplina_id uuid not null references disciplinas(id) on delete restrict,
  turma_id uuid not null references turmas(id) on delete cascade,
  bimestre int not null check (bimestre between 1 and 4),
  ano_letivo int not null,
  titulo text not null,
  tipo tipo_avaliacao not null default 'prova',
  peso numeric(5,2) not null default 1 check (peso > 0),
  valor_maximo numeric(5,2) not null default 10,
  data_aplicacao date,
  criado_por uuid references perfis(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index avaliacoes_turma_idx on avaliacoes (turma_id, ano_letivo, bimestre);
create index avaliacoes_disciplina_idx on avaliacoes (disciplina_id);
create trigger avaliacoes_updated_at before update on avaliacoes
  for each row execute function set_updated_at();

-- Notas (1 nota por aluno × avaliacao)
create table notas (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references escolas(id) on delete cascade,
  avaliacao_id uuid not null references avaliacoes(id) on delete cascade,
  aluno_id uuid not null references alunos(id) on delete cascade,
  matricula_id uuid not null references matriculas(id) on delete cascade,
  valor numeric(5,2),
  observacao text,
  lancada_por uuid references perfis(id) on delete set null,
  lancada_em timestamptz not null default now(),
  unique (avaliacao_id, aluno_id)
);

create index notas_aluno_idx on notas (aluno_id);
create index notas_matricula_idx on notas (matricula_id);

-- View: consolidacao bimestral (media ponderada)
create or replace view notas_consolidadas as
select
  m.id as matricula_id,
  m.aluno_id,
  m.escola_id,
  a.disciplina_id,
  a.bimestre,
  a.ano_letivo,
  case when sum(case when n.valor is not null then a.peso else 0 end) > 0
       then sum(n.valor * a.peso) / sum(case when n.valor is not null then a.peso else 0 end)
       else null
  end as media,
  count(a.id) as total_avaliacoes,
  count(n.valor) as notas_lancadas
from matriculas m
join avaliacoes a on a.turma_id = m.turma_id and a.ano_letivo = m.ano_letivo and a.escola_id = m.escola_id
left join notas n on n.avaliacao_id = a.id and n.matricula_id = m.id
group by m.id, m.aluno_id, m.escola_id, a.disciplina_id, a.bimestre, a.ano_letivo;

-- RLS
alter table disciplinas enable row level security;
alter table professor_disciplina_turma enable row level security;
alter table avaliacoes enable row level security;
alter table notas enable row level security;

-- Admin/secretaria total; professor le tudo da escola, escreve apenas o que lhe pertence (controle no app)
create policy "disciplinas service" on disciplinas for all to service_role using (true) with check (true);
create policy "disciplinas auth" on disciplinas for all to authenticated using (true) with check (true);

create policy "pdt service" on professor_disciplina_turma for all to service_role using (true) with check (true);
create policy "pdt auth" on professor_disciplina_turma for all to authenticated using (true) with check (true);

create policy "avaliacoes service" on avaliacoes for all to service_role using (true) with check (true);
create policy "avaliacoes auth" on avaliacoes for all to authenticated using (true) with check (true);

create policy "notas service" on notas for all to service_role using (true) with check (true);
create policy "notas auth" on notas for all to authenticated using (true) with check (true);

comment on table disciplinas is 'Disciplinas por serie';
comment on table professor_disciplina_turma is 'Atribuicao de professor a disciplina x turma';
comment on table avaliacoes is 'Avaliacoes (prova/trabalho/etc) por turma+disciplina+bimestre';
comment on table notas is 'Notas dos alunos em cada avaliacao';
comment on view notas_consolidadas is 'Media ponderada por aluno x disciplina x bimestre x ano';
