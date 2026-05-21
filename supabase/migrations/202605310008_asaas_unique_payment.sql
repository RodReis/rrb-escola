-- Garante unicidade do asaas_payment_id (evita pagamento duplicado por webhook concorrente).

drop index if exists cobrancas_asaas_payment_idx;

create unique index if not exists cobrancas_asaas_payment_id_uq
  on cobrancas (asaas_payment_id)
  where asaas_payment_id is not null;
