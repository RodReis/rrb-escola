"use client";

import { useState } from "react";
import { Barcode, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { gerarCobrancaAsaasAction } from "@/lib/actions/asaas";

export function GerarBoletoButton({
  cobrancaId,
  invoiceUrl,
}: {
  cobrancaId: string;
  invoiceUrl: string | null;
}) {
  const [loading, setLoading] = useState(false);
  const [url, setUrl] = useState<string | null>(invoiceUrl);

  if (url) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1 text-xs font-semibold text-brand"
      >
        <ExternalLink size={12} /> Ver fatura
      </a>
    );
  }

  async function handleGerar() {
    setLoading(true);
    try {
      const res = await gerarCobrancaAsaasAction(cobrancaId);
      if (res.ok) {
        setUrl(res.invoiceUrl);
        toast.success("Boleto/PIX gerado.");
      } else {
        toast.error(res.error);
      }
    } catch {
      toast.error("Erro ao gerar boleto.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleGerar}
      disabled={loading}
      className="inline-flex items-center gap-1 text-xs font-semibold text-brand disabled:opacity-50"
    >
      {loading ? <Loader2 size={12} className="animate-spin" /> : <Barcode size={12} />}
      {loading ? "Gerando…" : "Gerar boleto/PIX"}
    </button>
  );
}
