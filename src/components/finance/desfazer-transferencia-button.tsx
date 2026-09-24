"use client";

import { useRef } from "react";
import { Undo2 } from "lucide-react";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { desfazerTransferenciaAction } from "@/lib/actions/debitos";

/**
 * Desfazer um par de transferência interna volta os dois movimentos para
 * "pendente" — ação destrutiva o bastante (reabre dois lançamentos já
 * resolvidos) para exigir confirmação, como o resto do projeto faz para
 * qualquer exclusão/reversão (nunca `confirm()` nativo).
 */
export function DesfazerTransferenciaButton({ id }: { id: string }) {
  const confirm = useConfirm();
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} action={desfazerTransferenciaAction} className="inline">
      <input type="hidden" name="id" value={id} />
      <button
        type="button"
        className="ds-button ds-button-secondary text-xs"
        onClick={async () => {
          const ok = await confirm({
            title: "Desfazer transferência",
            message: "Os dois movimentos deste par voltam para pendente. Confirmar?",
            confirmLabel: "Desfazer",
            variant: "warning",
          });
          if (ok) formRef.current?.requestSubmit();
        }}
      >
        <Undo2 size={13} /> Desfazer
      </button>
    </form>
  );
}
