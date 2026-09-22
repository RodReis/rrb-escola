-- Credencial Sicoob por conta bancária (multi-CNPJ).
--
-- Cada CNPJ tem app próprio no portal do Sicoob e certificado e-CNPJ A1
-- próprio. Hoje o sistema lê um único SICOOB_CLIENT_ID e um único certificado
-- do ambiente, então a segunda conta usaria a credencial da primeira — e o
-- extrato viria da conta errada, sem erro nenhum.
--
-- `credencial_ref` é o sufixo das variáveis de ambiente daquela conta:
--   SICOOB_<REF>_CLIENT_ID
--   SICOOB_<REF>_CERT_PEM_B64
--   SICOOB_<REF>_KEY_PEM_B64
--   SICOOB_<REF>_CERT_NOT_AFTER
--
-- Conta com credencial_ref nulo continua usando as variáveis atuais
-- (SICOOB_CLIENT_ID etc.), para não quebrar o que já está em produção.
--
-- Ref: docs/superpowers/specs/2026-09-21-financeiro-isaac-multicnpj-design.md

alter table contas_bancarias add column if not exists credencial_ref text;

-- Só letras, números e underscore: o valor vira parte de um nome de variável
-- de ambiente. Sem isso, um apelido com hífen ou acento geraria uma variável
-- que nunca existe e a conta falharia com "Sicoob não configurado".
do $$ begin
  alter table contas_bancarias add constraint contas_bancarias_credencial_ref_check
    check (credencial_ref is null or credencial_ref ~ '^[A-Z0-9_]{1,40}$');
exception when duplicate_object then null; end $$;

comment on column contas_bancarias.credencial_ref is
  'Sufixo das variáveis SICOOB_<REF>_*. Nulo = usa as variáveis globais.';

comment on column contas_bancarias.company_id is
  'CNPJ dono da conta. Usado para casar o repasse isaac com o crédito certo.';
