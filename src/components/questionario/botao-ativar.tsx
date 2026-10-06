"use client";

import { Power } from "lucide-react";
import { useAction } from "@/lib/hooks/use-action";
import type { ActionResult } from "@/lib/questionario/tipos";

type Props = {
  acao: (formData: FormData) => Promise<ActionResult>;
  id: string;
  ativo: boolean;
  nome: string;
};

export function BotaoAtivar({ acao, id, ativo, nome }: Props) {
  const verbo = ativo ? "Inativar" : "Ativar";
  // Função inline de propósito: `useAction` só relê `opts` quando `action` muda de
  // identidade; sem isso a mensagem de confirmação ficaria presa no estado anterior.
  const { run, pending } = useAction((fd: FormData) => acao(fd), {
    confirm: {
      title: `${verbo} registro`,
      message: `${verbo} "${nome}"?`,
      confirmLabel: verbo,
      variant: ativo ? "warning" : "default",
    },
  });

  return (
    <button
      type="button"
      disabled={pending}
      aria-label={`${verbo} ${nome}`}
      title={verbo}
      onClick={() => {
        const fd = new FormData();
        fd.set("id", id);
        fd.set("ativo", String(!ativo));
        run(fd);
      }}
      className={`rounded-ui p-1.5 hover:bg-muted ${ativo ? "text-danger" : "text-brand"}`}
    >
      <Power size={16} />
    </button>
  );
}
