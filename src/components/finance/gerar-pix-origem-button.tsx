"use client";

import { useState } from "react";
import { Copy, Loader2, QrCode } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { gerarPixOrigemAction } from "@/lib/actions/sicoob";
import type { OrigemRecebimento } from "@/lib/pagamentos/provider";

export function GerarPixOrigemButton({
  origemTipo,
  origemId,
  valor,
  descricao,
}: {
  origemTipo: OrigemRecebimento;
  origemId: string;
  valor: number;
  descricao: string;
}) {
  const [loading, setLoading] = useState(false);
  const [copiaCola, setCopiaCola] = useState<string | null>(null);

  async function gerar() {
    setLoading(true);
    try {
      const result = await gerarPixOrigemAction({ origemTipo, origemId, valor, descricao });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setCopiaCola(result.copiaCola);
      toast.success("Pix gerado.");
    } catch {
      toast.error("Erro ao gerar Pix.");
    } finally {
      setLoading(false);
    }
  }

  async function copiar() {
    if (!copiaCola) return;
    await navigator.clipboard.writeText(copiaCola);
    toast.success("Pix copiado.");
  }

  return (
    <div className="inline-flex items-center gap-1">
      <button
        type="button"
        onClick={gerar}
        disabled={loading}
        className="inline-flex h-7 items-center gap-1 rounded-ui px-2 text-xs font-semibold text-brand hover:bg-brand/10 disabled:opacity-50"
      >
        {loading ? <Loader2 size={14} className="animate-spin" /> : <QrCode size={14} />}
        Pix
      </button>
      {copiaCola ? (
        <button type="button" onClick={copiar} className="inline-flex h-7 items-center rounded-ui px-2 text-brand hover:bg-brand/10">
          <Copy size={14} />
        </button>
      ) : null}
      {copiaCola ? (
        <div className="absolute z-50 mt-36 rounded-ui border border-line bg-surface p-3 shadow-lg">
          <QRCodeSVG value={copiaCola} size={120} />
        </div>
      ) : null}
    </div>
  );
}
