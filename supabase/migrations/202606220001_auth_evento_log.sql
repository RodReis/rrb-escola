-- Log de eventos críticos de autenticação e dados sensíveis.
-- Append-only: sem update/delete para authenticated; insert só via SECURITY DEFINER.
-- Cobre: login ok, login falha, logout, troca de senha, exclusão de dados.

create table if not exists auth_evento_log (
  id           uuid primary key default gen_random_uuid(),
  escola_id    uuid references escolas(id) on delete set null,
  user_id      uuid,                       -- auth.users.id (pode ser null em falha de login)
  email        text,                       -- email tentado (útil quando user_id é null)
  evento       text not null,              -- login_ok | login_falha | logout | senha_alterada | dado_excluido
  recurso      text,                       -- tabela/entidade afetada (para exclusões)
  recurso_id   text,                       -- id do registro afetado
  detalhe      text,                       -- contexto livre (motivo da falha, etc.)
  ip           text,
  user_agent   text,
  created_at   timestamptz not null default now()
);

create index if not exists auth_evento_log_escola_idx
  on auth_evento_log(escola_id, created_at desc);
create index if not exists auth_evento_log_user_idx
  on auth_evento_log(user_id, created_at desc);
create index if not exists auth_evento_log_evento_idx
  on auth_evento_log(evento, created_at desc);

alter table auth_evento_log enable row level security;

-- Leitura: apenas admin da própria escola
create policy auth_evento_log_read on auth_evento_log
  for select to authenticated
  using (
    escola_id = (select escola_id from current_perfil())
    and (select perfil from current_perfil()) = 'admin'
  );

-- Sem policy de insert/update/delete: gravação exclusivamente via função abaixo.
grant select on auth_evento_log to authenticated;

-- Função SECURITY DEFINER para gravar evento (bypassa RLS de escrita).
create or replace function auth_gravar_evento(
  p_escola_id  uuid,
  p_user_id    uuid,
  p_email      text,
  p_evento     text,
  p_recurso    text default null,
  p_recurso_id text default null,
  p_detalhe    text default null,
  p_ip         text default null,
  p_user_agent text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into auth_evento_log (
    escola_id, user_id, email, evento, recurso, recurso_id, detalhe, ip, user_agent
  ) values (
    p_escola_id, p_user_id, p_email, p_evento, p_recurso, p_recurso_id, p_detalhe, p_ip, p_user_agent
  );
end;
$$;

grant execute on function auth_gravar_evento(uuid, uuid, text, text, text, text, text, text, text)
  to authenticated;
