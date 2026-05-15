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

create or replace function recalc_cobranca_status(p_cobranca_id uuid)
returns void as $$
declare
  v_pago numeric;
  v_total numeric;
begin
  select coalesce(sum(valor_pago), 0)
    into v_pago
    from pagamentos
   where cobranca_id = p_cobranca_id and cancelado_em is null;

  select valor_final into v_total from cobrancas where id = p_cobranca_id;

  update cobrancas
     set status = case
       when status = 'cancelada' then 'cancelada'
       when v_pago <= 0 then 'aberta'
       when v_pago < v_total then 'parcial'
       else 'paga'
     end
   where id = p_cobranca_id;
end;
$$ language plpgsql security definer set search_path = public;

create or replace function trg_pagamento_status() returns trigger as $$
begin
  if tg_op = 'DELETE' then
    perform recalc_cobranca_status(old.cobranca_id);
    return old;
  end if;
  perform recalc_cobranca_status(new.cobranca_id);
  return new;
end;
$$ language plpgsql;

drop trigger if exists pagamentos_recalc_status on pagamentos;
create trigger pagamentos_recalc_status
  after insert or update or delete on pagamentos
  for each row execute function trg_pagamento_status();
