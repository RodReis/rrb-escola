-- Fix: cast explícito para status_cobranca no recalc_cobranca_status.
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
     set status = (case
       when status = 'cancelada' then 'cancelada'
       when v_pago <= 0 then 'aberta'
       when v_pago < v_total then 'parcial'
       else 'paga'
     end)::status_cobranca
   where id = p_cobranca_id;
end;
$$ language plpgsql security definer set search_path = public;
