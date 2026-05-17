create table if not exists historico_matriculas (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references escolas(id) on delete cascade,
  matricula_id uuid not null references matriculas(id) on delete cascade,
  aluno_id uuid not null references alunos(id) on delete cascade,
  acao text not null check (acao in ('criacao', 'alteracao', 'snapshot')),
  status_anterior status_matricula,
  status_novo status_matricula,
  dados_anteriores jsonb,
  dados_novos jsonb,
  criado_por text not null default 'sistema',
  created_at timestamptz not null default now()
);

create index if not exists historico_matriculas_matricula_idx on historico_matriculas (matricula_id, created_at desc);
create index if not exists historico_matriculas_aluno_idx on historico_matriculas (aluno_id, created_at desc);

alter table historico_matriculas enable row level security;

drop policy if exists "service role full access historico matriculas" on historico_matriculas;
create policy "service role full access historico matriculas"
on historico_matriculas for all to service_role using (true) with check (true);

create or replace function registrar_historico_matricula()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.historico_matriculas (escola_id, matricula_id, aluno_id, acao, status_novo, dados_novos)
    values (new.escola_id, new.id, new.aluno_id, 'criacao', new.status, to_jsonb(new));
    return new;
  end if;

  if tg_op = 'UPDATE' then
    insert into public.historico_matriculas (
      escola_id,
      matricula_id,
      aluno_id,
      acao,
      status_anterior,
      status_novo,
      dados_anteriores,
      dados_novos
    )
    values (
      new.escola_id,
      new.id,
      new.aluno_id,
      'alteracao',
      old.status,
      new.status,
      to_jsonb(old),
      to_jsonb(new)
    );
    return new;
  end if;

  return new;
end;
$$;

drop trigger if exists matriculas_historico_trigger on matriculas;
create trigger matriculas_historico_trigger
after insert or update on matriculas
for each row execute function registrar_historico_matricula();

insert into historico_matriculas (escola_id, matricula_id, aluno_id, acao, status_novo, dados_novos)
select m.escola_id, m.id, m.aluno_id, 'snapshot', m.status, to_jsonb(m)
from matriculas m
where not exists (
  select 1 from historico_matriculas h
  where h.matricula_id = m.id
);
