-- Financeiro v2: soft delete em pagamentos, trigger de recalc de status, backfill, idempotencia de geracao.

alter table pagamentos
  add column if not exists cancelado_em timestamptz,
  add column if not exists cancelado_por uuid references perfis(id) on delete set null,
  add column if not exists motivo_cancelamento text;

create index if not exists pagamentos_cobranca_ativos_idx
  on pagamentos (cobranca_id) where cancelado_em is null;

alter table pagamentos
  drop constraint if exists pagamentos_valor_positivo;

alter table pagamentos
  add constraint pagamentos_valor_positivo check (valor_pago > 0);
