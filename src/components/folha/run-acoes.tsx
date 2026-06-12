"use client";

import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { transicionarRunAction, reabrirRunAction, validarRunAction } from "@/lib/actions/folha";
import { TRANSICOES } from "@/lib/folha/estados";

const DESTINO_LABEL: Record<string, string> = {
  em_revisao: "Enviar para revisão",
  aprovada: "Aprovar folha",
  paga: "Marcar como paga",
  fechada: "Fechar folha",
  rascunho: "Voltar a rascunho",
};

const DESTINO_VARIANT: Record<string, "primary" | "secondary" | "accent" | "ghost"> = {
  em_revisao: "secondary",
  aprovada: "primary",
  paga: "accent",
  fechada: "secondary",
  rascunho: "ghost",
};

const CONFIRMAR_DESTINOS = new Set(["aprovada", "fechada"]);

type Props = {
  runId: string;
  status: string;
};

export function RunAcoes({ runId, status }: Props) {
  const confirm = useConfirm();
  const formRef = useRef<HTMLFormElement>(null);
  const reabrirFormRef = useRef<HTMLFormElement>(null);
  const [motivo, setMotivo] = useState("");
  const [showReabrir, setShowReabrir] = useState(false);
  const [pendencias, setPendencias] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();

  const destinos = TRANSICOES[status] ?? [];
  const podeReabrir = ["aprovada", "paga", "fechada"].includes(status);

  function handleTransicionar(destino: string) {
    startTransition(async () => {
      if (!CONFIRMAR_DESTINOS.has(destino)) {
        if (formRef.current) {
          const input = formRef.current.elements.namedItem("destino") as HTMLInputElement;
          if (input) input.value = destino;
          formRef.current.requestSubmit();
        }
        return;
      }

      const msgs: Record<string, string> = {
        aprovada: "Aprovar esta folha gerará as despesas de pagamento. Confirmar aprovação?",
        fechada: "Fechar esta folha registrará as provisões definitivas. Confirmar fechamento?",
      };
      const titles: Record<string, string> = {
        aprovada: "Aprovar folha",
        fechada: "Fechar folha",
      };

      if (destino === "aprovada") {
        const pends = await validarRunAction(runId);
        if (pends.length > 0) {
          setPendencias(pends);
          return;
        }
      }

      const ok = await confirm({
        title: titles[destino],
        message: msgs[destino],
        confirmLabel: DESTINO_LABEL[destino],
        variant: destino === "fechada" ? "warning" : "default",
      });

      if (ok && formRef.current) {
        const input = formRef.current.elements.namedItem("destino") as HTMLInputElement;
        if (input) input.value = destino;
        formRef.current.requestSubmit();
      }
    });
  }

  async function handleReabrir() {
    if (!motivo.trim()) return;
    const ok = await confirm({
      title: "Reabrir folha",
      message: `Reabrir esta folha excluirá as despesas abertas e provisões geradas. Motivo registrado: "${motivo}". Confirmar?`,
      confirmLabel: "Reabrir folha",
      variant: "danger",
    });
    if (ok && reabrirFormRef.current) {
      reabrirFormRef.current.requestSubmit();
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <form ref={formRef} action={transicionarRunAction}>
        <input type="hidden" name="run_id" value={runId} />
        <input type="hidden" name="destino" value="" />
        <div className="flex flex-wrap gap-2">
          {destinos.map((destino) => (
            <Button
              key={destino}
              type="button"
              variant={DESTINO_VARIANT[destino] ?? "secondary"}
              disabled={isPending}
              onClick={() => handleTransicionar(destino)}
            >
              {DESTINO_LABEL[destino] ?? destino}
            </Button>
          ))}
          {podeReabrir && (
            <Button
              type="button"
              variant="ghost"
              disabled={isPending}
              onClick={() => setShowReabrir((v) => !v)}
            >
              Reabrir folha
            </Button>
          )}
        </div>
      </form>

      {showReabrir && (
        <form ref={reabrirFormRef} action={reabrirRunAction} className="flex items-end gap-2">
          <input type="hidden" name="run_id" value={runId} />
          <input type="hidden" name="motivo" value={motivo} />
          <label className="flex flex-col gap-1 text-sm font-medium text-ink/80">
            Motivo da reabertura
            <input
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Descreva o motivo…"
              className="w-72"
              required
            />
          </label>
          <Button
            type="button"
            variant="secondary"
            disabled={!motivo.trim() || isPending}
            onClick={handleReabrir}
          >
            Confirmar reabertura
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => { setShowReabrir(false); setMotivo(""); }}
          >
            Cancelar
          </Button>
        </form>
      )}

      {pendencias.length > 0 && (
        <ul className="rounded-md border border-danger/30 bg-danger/5 px-4 py-3 text-sm space-y-1">
          <li className="font-semibold text-danger">Pendências bloqueiam a aprovação:</li>
          {pendencias.map((p, i) => (
            <li key={i} className="text-danger/80">· {p}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
