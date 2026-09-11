"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Panel } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function TesourariaError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[tesouraria]", error);
  }, [error]);

  return (
    <Panel className="grid justify-items-center gap-3 py-12 text-center">
      <AlertTriangle size={28} className="text-clay" />
      <h2 className="font-display text-xl text-ink">Não foi possível carregar a Tesouraria</h2>
      <p className="max-w-prose text-sm text-ink/70">{error.message}</p>
      {error.digest ? <p className="text-xs text-ink/50">Digest: {error.digest}</p> : null}
      <Button type="button" variant="secondary" onClick={reset}>
        Tentar novamente
      </Button>
    </Panel>
  );
}
