"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Panel } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

/**
 * Fronteira de erro de toda a área autenticada.
 *
 * Sem ela, qualquer `throw` de Server Action ou falha de leitura cai na tela
 * de erro crua do Next. As mensagens das actions são escritas em PT-BR para o
 * usuário ("Data fim deve ser posterior à data início") — aqui elas aparecem.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app]", error);
  }, [error]);

  return (
    <Panel className="grid justify-items-center gap-3 py-12 text-center">
      <AlertTriangle size={28} className="text-clay" />
      <h2 className="font-display text-xl text-ink">Não foi possível concluir a operação</h2>
      <p className="max-w-prose text-sm text-ink/70">{error.message}</p>
      {error.digest ? <p className="text-xs text-ink/50">Digest: {error.digest}</p> : null}
      <div className="flex flex-wrap justify-center gap-2">
        <Button type="button" variant="secondary" onClick={reset}>
          Tentar novamente
        </Button>
        <Button type="button" variant="ghost" onClick={() => window.history.back()}>
          Voltar
        </Button>
      </div>
    </Panel>
  );
}
