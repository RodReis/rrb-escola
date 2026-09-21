"use client";

import { useFormStatus } from "react-dom";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  label?: string;
  pendingLabel?: string;
  variant?: "primary" | "secondary" | "accent" | "ghost";
};

// Botao de submit com estado de carregamento (useFormStatus).
// Deve ser renderizado DENTRO de um <form>.
export function GerarFolhaButton({
  label = "Gerar folha",
  pendingLabel = "Gerando…",
  variant = "primary",
}: Props) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} disabled={pending} aria-busy={pending}>
      {pending ? (
        <>
          <Loader2 size={14} className="animate-spin" /> {pendingLabel}
        </>
      ) : (
        <>
          <Plus size={14} /> {label}
        </>
      )}
    </Button>
  );
}
