import { money } from "@/lib/constants";
import { CancelPaymentForm } from "./cancel-payment-form";
import { ExportPaymentReceiptButton } from "@/components/pdf/export-payment-receipt-button";

type PaymentRowProps = {
  pagamento: {
    id: string;
    valor_pago: number | string;
    data_pagamento: string;
    forma_pagamento: string;
    cancelado_em: string | null;
    motivo_cancelamento: string | null;
    perfis: { nome: string } | null;
  };
  cobranca: {
    id: string;
    descricao: string;
    competencia: string;
    numero_parcela: number | null;
    valor_final: number | string;
    valor_original: number | string;
    valor_desconto: number | string;
    valor_acrescimo: number | string;
  };
  aluno: { nome: string; matricula_codigo: string };
  saldoApos: number;
};

function dateText(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("pt-BR");
}

export function PaymentRow({ pagamento, cobranca, aluno, saldoApos }: PaymentRowProps) {
  const isCanceled = Boolean(pagamento.cancelado_em);
  return (
    <div className={`grid gap-2 border-t border-line py-2 text-sm md:grid-cols-[1fr_120px_120px_160px_220px] ${isCanceled ? "opacity-60 line-through" : ""}`}>
      <span>{dateText(pagamento.data_pagamento)}</span>
      <span className="font-bold">{money.format(Number(pagamento.valor_pago))}</span>
      <span>{pagamento.forma_pagamento}</span>
      <span className="text-muted">{pagamento.perfis?.nome ?? "—"}</span>
      <div className="flex flex-wrap items-center gap-2 justify-end">
        {!isCanceled ? (
          <>
            <ExportPaymentReceiptButton
              pagamento={pagamento}
              cobranca={cobranca}
              aluno={aluno}
              saldoApos={saldoApos}
            />
            <CancelPaymentForm pagamentoId={pagamento.id} />
          </>
        ) : (
          <span className="text-xs italic text-muted">Estornado: {pagamento.motivo_cancelamento ?? ""}</span>
        )}
      </div>
    </div>
  );
}
