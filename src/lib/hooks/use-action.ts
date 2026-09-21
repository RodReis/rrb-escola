"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { interpretActionResult } from "@/lib/actions/interpret-result";

type ConfirmOption =
  | string
  | {
      title?: string;
      message: string;
      confirmLabel?: string;
      cancelLabel?: string;
      variant?: "danger" | "warning" | "default";
    };

export type UseActionOptions = {
  /** Mensagem do toast de sucesso. */
  success?: string;
  /** Mensagem do toast de erro, quando a action nao fornece uma. */
  error?: string;
  /** Pede confirmacao antes de executar. String = a mensagem. */
  confirm?: ConfirmOption;
  /** Roda depois do sucesso (fechar modal, limpar formulario). */
  onSuccess?: () => void;
};

export function useAction<Args extends unknown[]>(
  action: (...args: Args) => Promise<unknown> | unknown,
  opts: UseActionOptions = {}
): { run: (...args: Args) => void; pending: boolean } {
  const [isPending, startTransition] = useTransition();
  // `useTransition` nao cobre a janela da confirmacao nem o await da
  // action fora da transition, entao mantemos um flag proprio.
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const confirm = useConfirm();

  const run = useCallback(
    (...args: Args) => {
      void (async () => {
        if (opts.confirm) {
          const cfg =
            typeof opts.confirm === "string"
              ? { message: opts.confirm }
              : opts.confirm;
          const ok = await confirm(cfg);
          if (!ok) return;
        }

        setBusy(true);
        let instruction;
        try {
          const value = await action(...args);
          instruction = interpretActionResult({ kind: "value", value }, opts);
        } catch (error) {
          instruction = interpretActionResult({ kind: "error", error }, opts);
          if (instruction.rethrow) {
            // redirect()/notFound() do Next: deixa a excecao subir para o
            // framework navegar. NAO virar toast de erro.
            setBusy(false);
            throw error;
          }
        }

        if (instruction.toast === "success") toast.success(instruction.message);
        if (instruction.toast === "error") toast.error(instruction.message);

        setBusy(false);

        if (instruction.toast !== "error") {
          opts.onSuccess?.();
          if (instruction.redirectTo) {
            startTransition(() => router.push(instruction.redirectTo as string));
          } else if (instruction.refresh) {
            startTransition(() => router.refresh());
          }
        }
      })();
    },
    // `opts` e recriado a cada render pelos call sites; as suas
    // propriedades sao lidas dentro do closure, entao nao entram no array.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [action, confirm, router]
  );

  return { run, pending: busy || isPending };
}
