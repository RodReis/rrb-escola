import { updateChargeAction } from "@/lib/actions/finance";

type Props = {
  charge: {
    id: string;
    descricao: string;
    data_vencimento: string;
    valor_desconto: number | string;
    valor_acrescimo: number | string;
  };
};

export function ChargeEditForm({ charge }: Props) {
  return (
    <form action={updateChargeAction} className="grid gap-3 rounded-ui border border-line bg-muted/30 p-3 md:grid-cols-5">
      <input type="hidden" name="cobranca_id" value={charge.id} />
      <label className="md:col-span-2">
        Descrição
        <input name="descricao" defaultValue={charge.descricao} required />
      </label>
      <label>
        Vencimento
        <input name="data_vencimento" type="date" defaultValue={charge.data_vencimento} required />
      </label>
      <label>
        Desconto
        <input name="valor_desconto" inputMode="decimal" defaultValue={String(charge.valor_desconto)} />
      </label>
      <label>
        Acréscimo
        <input name="valor_acrescimo" inputMode="decimal" defaultValue={String(charge.valor_acrescimo)} />
      </label>
      <button className="ds-button ds-button-secondary self-end md:col-span-5 md:justify-self-end" type="submit">
        Salvar
      </button>
    </form>
  );
}
