-- Gateway Asaas: ids e status do Asaas em cobrancas e responsaveis_aluno.

alter table responsaveis_aluno
  add column if not exists asaas_customer_id text;

alter table cobrancas
  add column if not exists asaas_payment_id text;

alter table cobrancas
  add column if not exists asaas_invoice_url text;

alter table cobrancas
  add column if not exists asaas_status text;

create index if not exists cobrancas_asaas_payment_idx
  on cobrancas (asaas_payment_id);
