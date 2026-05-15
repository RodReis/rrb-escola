-- Auth real: substitui policies "service role full access" por policies scoped por escola_id via current_perfil().
-- Service role bypassa RLS por natureza, então as policies antigas são redundantes e foram removidas.

-- 1) Drop policies antigas
drop policy if exists "service role full access escolas" on escolas;
drop policy if exists "service role full access perfis" on perfis;
drop policy if exists "service role full access alunos" on alunos;
drop policy if exists "service role full access enderecos" on enderecos_aluno;
drop policy if exists "service role full access contatos" on contatos_aluno;
drop policy if exists "service role full access responsaveis" on responsaveis_aluno;
drop policy if exists "service role full access autorizadas" on pessoas_autorizadas;
drop policy if exists "service role full access medicas" on informacoes_medicas;
drop policy if exists "service role full access aut aluno" on autorizacoes_aluno;
drop policy if exists "service role full access series" on series;
drop policy if exists "service role full access turmas" on turmas;
drop policy if exists "service role full access planos" on planos;
drop policy if exists "service role full access matriculas" on matriculas;
drop policy if exists "service role full access frequencias" on frequencias;
drop policy if exists "service role full access cobrancas" on cobrancas;
drop policy if exists "service role full access pagamentos" on pagamentos;
drop policy if exists "service role full access arquivos" on arquivos_importados;
drop policy if exists "service role full access documentos aluno" on documentos_aluno;
drop policy if exists "service role full access consentimentos biometria" on consentimentos_biometria;
drop policy if exists "service role full access preferencias notificacao" on preferencias_notificacao_aluno;
drop policy if exists "service role full access dispositivos acesso" on dispositivos_acesso;
drop policy if exists "service role full access eventos acesso" on eventos_acesso;
drop policy if exists "service role full access notificacoes responsavel" on notificacoes_responsavel;
drop policy if exists "service role full access biometrias aluno" on biometrias_aluno;
drop policy if exists "service role full access historico matriculas" on historico_matriculas;

-- 2) Helper function
create or replace function current_perfil()
returns perfis as $$
  select * from perfis
  where user_id = auth.uid() and ativo = true
  limit 1;
$$ language sql stable security definer set search_path = public;

-- 3) Policies escolas + perfis
create policy "perfil ativo read escolas" on escolas
  for select to authenticated
  using (id = (select escola_id from current_perfil()));

create policy "perfil ativo update escolas" on escolas
  for update to authenticated
  using (id = (select escola_id from current_perfil()))
  with check (id = (select escola_id from current_perfil()));

create policy "perfil self read" on perfis
  for select to authenticated
  using (user_id = auth.uid() or escola_id = (select escola_id from current_perfil()));

create policy "perfil admin manage" on perfis
  for all to authenticated
  using (
    escola_id = (select escola_id from current_perfil())
    and (select perfil from current_perfil()) = 'admin'
  )
  with check (
    escola_id = (select escola_id from current_perfil())
    and (select perfil from current_perfil()) = 'admin'
  );

-- 4) Policies tabelas com escola_id direto
create policy "perfil ativo full access alunos" on alunos
  for all to authenticated
  using (escola_id = (select escola_id from current_perfil()))
  with check (escola_id = (select escola_id from current_perfil()));

create policy "perfil ativo full access series" on series
  for all to authenticated
  using (escola_id = (select escola_id from current_perfil()))
  with check (escola_id = (select escola_id from current_perfil()));

create policy "perfil ativo full access turmas" on turmas
  for all to authenticated
  using (escola_id = (select escola_id from current_perfil()))
  with check (escola_id = (select escola_id from current_perfil()));

create policy "perfil ativo full access planos" on planos
  for all to authenticated
  using (escola_id = (select escola_id from current_perfil()))
  with check (escola_id = (select escola_id from current_perfil()));

create policy "perfil ativo full access matriculas" on matriculas
  for all to authenticated
  using (escola_id = (select escola_id from current_perfil()))
  with check (escola_id = (select escola_id from current_perfil()));

create policy "perfil ativo full access frequencias" on frequencias
  for all to authenticated
  using (escola_id = (select escola_id from current_perfil()))
  with check (escola_id = (select escola_id from current_perfil()));

create policy "perfil ativo full access cobrancas" on cobrancas
  for all to authenticated
  using (escola_id = (select escola_id from current_perfil()))
  with check (escola_id = (select escola_id from current_perfil()));

create policy "perfil ativo full access pagamentos" on pagamentos
  for all to authenticated
  using (escola_id = (select escola_id from current_perfil()))
  with check (escola_id = (select escola_id from current_perfil()));

create policy "perfil ativo full access arquivos" on arquivos_importados
  for all to authenticated
  using (escola_id = (select escola_id from current_perfil()))
  with check (escola_id = (select escola_id from current_perfil()));

create policy "perfil ativo full access dispositivos acesso" on dispositivos_acesso
  for all to authenticated
  using (escola_id = (select escola_id from current_perfil()))
  with check (escola_id = (select escola_id from current_perfil()));

create policy "perfil ativo full access eventos acesso" on eventos_acesso
  for all to authenticated
  using (escola_id = (select escola_id from current_perfil()))
  with check (escola_id = (select escola_id from current_perfil()));

create policy "perfil ativo full access notificacoes responsavel" on notificacoes_responsavel
  for all to authenticated
  using (escola_id = (select escola_id from current_perfil()))
  with check (escola_id = (select escola_id from current_perfil()));

create policy "perfil ativo full access historico matriculas" on historico_matriculas
  for all to authenticated
  using (escola_id = (select escola_id from current_perfil()))
  with check (escola_id = (select escola_id from current_perfil()));

-- 5) Importação alunos linhas (RLS não estava habilitada)
alter table importacao_alunos_linhas enable row level security;

create policy "perfil ativo full access importacao linhas" on importacao_alunos_linhas
  for all to authenticated
  using (escola_id = (select escola_id from current_perfil()))
  with check (escola_id = (select escola_id from current_perfil()));

-- 6) Policies tabelas filhas via aluno_id
create policy "perfil ativo full access enderecos" on enderecos_aluno
  for all to authenticated
  using (exists (
    select 1 from alunos a
    where a.id = aluno_id and a.escola_id = (select escola_id from current_perfil())
  ))
  with check (exists (
    select 1 from alunos a
    where a.id = aluno_id and a.escola_id = (select escola_id from current_perfil())
  ));

create policy "perfil ativo full access contatos" on contatos_aluno
  for all to authenticated
  using (exists (
    select 1 from alunos a
    where a.id = aluno_id and a.escola_id = (select escola_id from current_perfil())
  ))
  with check (exists (
    select 1 from alunos a
    where a.id = aluno_id and a.escola_id = (select escola_id from current_perfil())
  ));

create policy "perfil ativo full access responsaveis" on responsaveis_aluno
  for all to authenticated
  using (exists (
    select 1 from alunos a
    where a.id = aluno_id and a.escola_id = (select escola_id from current_perfil())
  ))
  with check (exists (
    select 1 from alunos a
    where a.id = aluno_id and a.escola_id = (select escola_id from current_perfil())
  ));

create policy "perfil ativo full access autorizadas" on pessoas_autorizadas
  for all to authenticated
  using (exists (
    select 1 from alunos a
    where a.id = aluno_id and a.escola_id = (select escola_id from current_perfil())
  ))
  with check (exists (
    select 1 from alunos a
    where a.id = aluno_id and a.escola_id = (select escola_id from current_perfil())
  ));

create policy "perfil ativo full access medicas" on informacoes_medicas
  for all to authenticated
  using (exists (
    select 1 from alunos a
    where a.id = aluno_id and a.escola_id = (select escola_id from current_perfil())
  ))
  with check (exists (
    select 1 from alunos a
    where a.id = aluno_id and a.escola_id = (select escola_id from current_perfil())
  ));

create policy "perfil ativo full access aut aluno" on autorizacoes_aluno
  for all to authenticated
  using (exists (
    select 1 from alunos a
    where a.id = aluno_id and a.escola_id = (select escola_id from current_perfil())
  ))
  with check (exists (
    select 1 from alunos a
    where a.id = aluno_id and a.escola_id = (select escola_id from current_perfil())
  ));

create policy "perfil ativo full access documentos aluno" on documentos_aluno
  for all to authenticated
  using (exists (
    select 1 from alunos a
    where a.id = aluno_id and a.escola_id = (select escola_id from current_perfil())
  ))
  with check (exists (
    select 1 from alunos a
    where a.id = aluno_id and a.escola_id = (select escola_id from current_perfil())
  ));

create policy "perfil ativo full access consentimentos biometria" on consentimentos_biometria
  for all to authenticated
  using (exists (
    select 1 from alunos a
    where a.id = aluno_id and a.escola_id = (select escola_id from current_perfil())
  ))
  with check (exists (
    select 1 from alunos a
    where a.id = aluno_id and a.escola_id = (select escola_id from current_perfil())
  ));

create policy "perfil ativo full access preferencias notificacao" on preferencias_notificacao_aluno
  for all to authenticated
  using (exists (
    select 1 from alunos a
    where a.id = aluno_id and a.escola_id = (select escola_id from current_perfil())
  ))
  with check (exists (
    select 1 from alunos a
    where a.id = aluno_id and a.escola_id = (select escola_id from current_perfil())
  ));

create policy "perfil ativo full access biometrias aluno" on biometrias_aluno
  for all to authenticated
  using (exists (
    select 1 from alunos a
    where a.id = aluno_id and a.escola_id = (select escola_id from current_perfil())
  ))
  with check (exists (
    select 1 from alunos a
    where a.id = aluno_id and a.escola_id = (select escola_id from current_perfil())
  ));

-- 7) Storage buckets — privatizar alunos-fotos e adicionar policies para todos os 3 buckets
update storage.buckets set public = false where id = 'alunos-fotos';

create policy "perfil ativo read fotos" on storage.objects
  for select to authenticated
  using (bucket_id = 'alunos-fotos' and exists (select 1 from current_perfil()));

create policy "perfil ativo write fotos" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'alunos-fotos' and exists (select 1 from current_perfil()));

create policy "perfil ativo update fotos" on storage.objects
  for update to authenticated
  using (bucket_id = 'alunos-fotos' and exists (select 1 from current_perfil()))
  with check (bucket_id = 'alunos-fotos' and exists (select 1 from current_perfil()));

create policy "perfil ativo delete fotos" on storage.objects
  for delete to authenticated
  using (bucket_id = 'alunos-fotos' and exists (select 1 from current_perfil()));

create policy "perfil ativo read documentos" on storage.objects
  for select to authenticated
  using (bucket_id = 'documentos-alunos' and exists (select 1 from current_perfil()));

create policy "perfil ativo write documentos" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'documentos-alunos' and exists (select 1 from current_perfil()));

create policy "perfil ativo update documentos" on storage.objects
  for update to authenticated
  using (bucket_id = 'documentos-alunos' and exists (select 1 from current_perfil()))
  with check (bucket_id = 'documentos-alunos' and exists (select 1 from current_perfil()));

create policy "perfil ativo delete documentos" on storage.objects
  for delete to authenticated
  using (bucket_id = 'documentos-alunos' and exists (select 1 from current_perfil()));

create policy "perfil ativo read importacoes" on storage.objects
  for select to authenticated
  using (bucket_id = 'importacoes' and exists (select 1 from current_perfil()));

create policy "perfil ativo write importacoes" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'importacoes' and exists (select 1 from current_perfil()));
