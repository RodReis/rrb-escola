import { cancelPaymentAction } from "@/lib/actions/finance";

export function CancelPaymentForm({ pagamentoId }: { pagamentoId: string }) {
  return (
    <form action={cancelPaymentAction} className="inline-flex items-center gap-2">
      <input type="hidden" name="pagamento_id" value={pagamentoId} />
      <input name="motivo" placeholder="Motivo do estorno" className="w-44" />
      <button className="text-xs font-black text-clay" type="submit">Estornar</button>
    </form>
  );
}
