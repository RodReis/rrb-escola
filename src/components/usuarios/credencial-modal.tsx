"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import type { CredencialGerada } from "@/lib/actions/users";

/**
 * Senha gerada e exibida uma unica vez (o backend nao a guarda em texto
 * plano). Substitui o antigo banner via flash cookie + redirect — agora a
 * action devolve a senha no ActionResult.data e o modal mostra sem navegar.
 */
export function CredencialModal({
  credencial,
  onClose,
}: {
  credencial: CredencialGerada | null;
  onClose: () => void;
}) {
  const [copiado, setCopiado] = useState(false);

  async function handleCopy() {
    if (!credencial) return;
    await navigator.clipboard.writeText(credencial.senha);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  return (
    <Dialog open={credencial !== null} title="Senha gerada" onClose={onClose}>
      {credencial && (
        <div className="grid gap-3 text-sm">
          <p className="text-ink/80">
            Senha de <strong>{credencial.email}</strong>:
          </p>
          <div className="flex items-center gap-2 rounded-ui border border-line bg-muted px-3 py-2">
            <code className="flex-1 font-mono text-sm font-semibold text-ink">{credencial.senha}</code>
            <button
              type="button"
              onClick={handleCopy}
              className="flex h-7 w-7 items-center justify-center rounded-md text-ink/60 hover:bg-surface hover:text-ink"
              aria-label="Copiar senha"
            >
              {copiado ? <Check size={14} className="text-success" /> : <Copy size={14} />}
            </button>
          </div>
          <p className="text-xs text-ink/60">
            {credencial.emailEnviado
              ? "Email enviado com as credenciais. Esta senha não será exibida novamente."
              : "Email NÃO enviado (Resend não configurado). Anote agora — não será exibida novamente."}
          </p>
        </div>
      )}
    </Dialog>
  );
}
