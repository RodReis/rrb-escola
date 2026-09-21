-- Amplia companies com os campos que o cabecalho do historico escolar
-- precisa imprimir (endereco, resolucao, contato, assinaturas), em vez de
-- manter uma tabela historico_credenciamentos separada e duplicada com
-- companies. A empresa ja existe (cadastro do RH); so faltavam campos.

alter table public.companies add column if not exists endereco text;
alter table public.companies add column if not exists cidade text;
alter table public.companies add column if not exists uf text;
alter table public.companies add column if not exists cep text;
alter table public.companies add column if not exists resolucao text;
alter table public.companies add column if not exists telefones text;
alter table public.companies add column if not exists email text;
alter table public.companies add column if not exists logo_path text;
alter table public.companies add column if not exists secretario_nome text;
alter table public.companies add column if not exists secretario_cargo text not null default 'Secretário(a)';
alter table public.companies add column if not exists diretor_nome text;
alter table public.companies add column if not exists diretor_cargo text not null default 'Diretor(a)';

-- historico_niveis_ensino passa a referenciar companies diretamente.
alter table public.historico_niveis_ensino
  drop constraint if exists historico_niveis_ensino_credenciamento_id_fkey;
alter table public.historico_niveis_ensino rename column credenciamento_id to company_id;
alter table public.historico_niveis_ensino
  add constraint historico_niveis_ensino_company_id_fkey
  foreign key (company_id) references public.companies(id) on delete restrict;

-- historico_credenciamentos nunca chegou a ser usada (nenhuma linha, sem
-- tela de cadastro) — foi substituida por companies antes de qualquer
-- emissao real acontecer.
drop table if exists public.historico_credenciamentos;
