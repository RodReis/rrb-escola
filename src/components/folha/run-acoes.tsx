"use client";

import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { transicionarRunAction, reabrirRunAction, validarRunAction, excluirRunAction } from "@/lib/actions/folha";
import { TRANSICOES } from "@/lib/folha/estados";

const DESTINO_LABEL: Record<string, string> = {
  em_andamento: "Enviar para andamento",
  revisao:      "Enviar para revisão",
  aprovacao:    "Enviar para aprovação",
  aprovado:     "Aprovar folha",
  iniciada:     "Voltar para iniciada",
  em_andamento_back: "Voltar",
  revisao_back: "Voltar",
};

const DESTINO_VARIANT: Record<string, "primary" | "secondary" | "accent" | "ghost"> = {
  em_andamento: "secondary",
  revisao:      "secondary",
  aprovacao:    "secondary",
  aprovado:     "primary",
  iniciada:     "ghost",
};

const CONFIRMAR_DESTINOS = new Set(["aprovado"]);

type Props = {
  runId: string;
  status: string;
};

function destinoLabel(de: string, para: string): string {
  if (para === "iniciada") return "Voltar para iniciada";
  if (para === "em_andamento" && de !== "iniciada") return "Voltar";
  if (para === "revisao" && de !== "em_andamento") return "Voltar";
  return DESTINO_LABEL[para] ?? para;
}

function destinoVariant(de: string, para: string): "primary" | "secondary" | "accent" | "ghost" {
  if (para === "aprovado") return "primary";
  if (de !== "iniciada" && para === "iniciada") return "ghost";
  if (de !== "iniciada" && de !== "em_andamento" && para === "em_andamento") return "ghost";
  if (de !== "revisao" && para === "revisao" && de === "aprovacao") return "ghost";
  return DESTINO_VARIANT[para] ?? "secondary";
}

export function RunAcoes({ runId, status }: Props) {
  const confirm = useConfirm();
  const formRef = useRef<HTMLFormElement>(null);
  const reabrirFormRef = useRef<HTMLFormElement>(null);
  const [motivo, setMotivo] = useState("");
  const [showReabrir, setShowReabrir] = useState(false);
  const [pendencias, setPendencias] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();

  const destinos = TRANSICOES[status] ?? [];
  const podeReabrir = status === "aprovado";

  function submitDestino(destino: string) {
    if (!formRef.current) return;
    const input = formRef.current.elements.namedItem("destino") as HTMLInputElement;
    if (input) input.value = destino;
    const form = formRef.current;
    startTransition(() => {
      form.requestSubmit();
    });
  }

  async function handleTransicionar(destino: string) {
    if (!CONFIRMAR_DESTINOS.has(destino)) {
      submitDestino(destino);
      return;
    }

    if (destino === "aprovado") {
      const pends = await validarRunAction(runId);
      if (pends.length > 0) {
        setPendencias(pends);
        return;
      }
    }

    const ok = await confirm({
      title: "Aprovar folha",
      message: "Aprovar esta folha gerará as despesas de pagamento e registrará as provisões definitivas. Confirmar aprovação?",
      confirmLabel: "Aprovar folha",
      variant: "default",
    });

    if (ok) submitDestino(destino);
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
              variant={destinoVariant(status, destino)}
              disabled={isPending}
              onClick={() => handleTransicionar(destino)}
            >
              {destinoLabel(status, destino)}
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

export function ExcluirFolhaButton({ runId }: { runId: string }) {
  const confirm = useConfirm();
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();

  async function handleExcluir() {
    const ok = await confirm({
      title: "Excluir folha",
      message: "Esta ação é irreversível. Todos os itens e lançamentos desta folha serão excluídos. Confirmar exclusão?",
      confirmLabel: "Excluir folha",
      variant: "danger",
    });
    if (ok && formRef.current) {
      startTransition(() => {
        formRef.current?.requestSubmit();
      });
    }
  }

  return (
    <form ref={formRef} action={excluirRunAction}>
      <input type="hidden" name="run_id" value={runId} />
      <Button
        type="button"
        variant="ghost"
        disabled={isPending}
        onClick={handleExcluir}
        className="text-danger hover:text-danger"
      >
        Excluir
      </Button>
    </form>
  );
}
