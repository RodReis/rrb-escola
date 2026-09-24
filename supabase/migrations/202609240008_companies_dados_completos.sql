-- Campos completos de Empresa: endereco estruturado, contato, identificacao
-- e assinaturas de coordenacao/financeiro. Aditivo, sem dropar nada.

alter table public.companies
  add column if not exists numero text,
  add column if not exists complemento text,
  add column if not exists bairro text,
  add column if not exists site text,
  add column if not exists whatsapp text,
  add column if not exists nome_fantasia text,
  add column if not exists codigo_inep text,
  add column if not exists mantenedora text,
  add column if not exists coordenacao_nome text,
  add column if not exists coordenacao_cargo text not null default 'Coordenador(a)',
  add column if not exists financeiro_nome text,
  add column if not exists financeiro_cargo text not null default 'Financeiro';

comment on column companies.endereco is 'Logradouro (nome mantido por compatibilidade — numero/complemento/bairro sao colunas separadas)';
