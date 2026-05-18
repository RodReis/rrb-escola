-- Notificacoes: broadcast (perfil_id null) ou direcionada (perfil_id = X)
-- Realtime via supabase_realtime publication

do $$ begin
  create type severidade_notif as enum ('info', 'atencao', 'critico');
exception when duplicate_object then null;
end $$;

create table notificacoes (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references escolas(id) on delete cascade,
  perfil_id uuid references perfis(id) on delete cascade,
  tipo text not null,
  titulo text not null,
  descricao text,
  href text,
  severidade severidade_notif not null default 'info',
  lida boolean not null default false,
  lida_em timestamptz,
  criada_em timestamptz not null default now()
);

create index notificacoes_escola_idx on notificacoes (escola_id);
create index notificacoes_perfil_idx on notificacoes (perfil_id);
create index notificacoes_lida_idx on notificacoes (lida);
create index notificacoes_criada_em_idx on notificacoes (criada_em desc);

alter table notificacoes enable row level security;
create policy "notificacoes service" on notificacoes for all to service_role using (true) with check (true);
create policy "notificacoes auth" on notificacoes for all to authenticated using (true) with check (true);

-- Habilita Realtime para a tabela
alter publication supabase_realtime add table notificacoes;

-- Trigger: nova matricula gera notificacao broadcast
create or replace function notificar_nova_matricula()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nome text;
  v_serie text;
  v_tipo_vaga text;
begin
  select a.nome into v_nome from alunos a where a.id = new.aluno_id;
  select s.nome into v_serie from series s where s.id = new.serie_id;
  v_tipo_vaga := coalesce(new.tipo_vaga::text, 'paga');

  insert into notificacoes (escola_id, perfil_id, tipo, titulo, descricao, href, severidade)
  values (
    new.escola_id,
    null,
    'nova_matricula',
    'Nova matrícula',
    coalesce(v_nome, 'Aluno') || ' matriculado em ' || coalesce(v_serie, 'série') ||
      case when v_tipo_vaga <> 'paga' then ' (' || v_tipo_vaga || ')' else '' end,
    '/alunos/' || new.aluno_id::text,
    case when v_tipo_vaga <> 'paga' then 'atencao'::severidade_notif else 'info'::severidade_notif end
  );

  return new;
end;
$$;

drop trigger if exists matriculas_notificar on matriculas;
create trigger matriculas_notificar
  after insert on matriculas
  for each row execute function notificar_nova_matricula();

-- Seeds exemplo (broadcast)
insert into notificacoes (escola_id, tipo, titulo, descricao, href, severidade) values
  ('00000000-0000-0000-0000-000000000001', 'sistema', 'Bem-vindo', 'Modulo de notificacoes ativado.', null, 'info'),
  ('00000000-0000-0000-0000-000000000001', 'pedagogico', 'Disciplinas seedadas', '139 disciplinas cadastradas. Comece a criar avaliacoes.', '/disciplinas', 'info');
