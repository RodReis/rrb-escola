"use client";

import { useState } from "react";
import { Copy, Loader2, MessageCircle, QrCode } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { enviarPixWhatsAppAction, gerarPixAction } from "@/lib/actions/sicoob";

export function GerarPixButton({ cobrancaId }: { cobrancaId: string }) {
  const [loading, setLoading] = useState(false);
  const [copiaCola, setCopiaCola] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  async function handleGerar() {
    setLoading(true);
    try {
      const res = await gerarPixAction(cobrancaId);
      if (!res.ok) {
        toast.error(res.reason);
        return;
      }
      setCopiaCola(res.copiaCola);
      setOpen(true);
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

  async function enviarWhatsApp() {
    setLoading(true);
    try {
      const res = await enviarPixWhatsAppAction(cobrancaId);
      if (res.ok) toast.success("Pix enviado por WhatsApp.");
      else toast.error(res.reason);
    } catch {
      toast.error("Erro ao enviar Pix por WhatsApp.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={handleGerar}
        disabled={loading}
        className="inline-flex items-center gap-1 text-xs font-semibold text-brand disabled:opacity-50"
        type="button"
      >
        {loading ? <Loader2 size={12} className="animate-spin" /> : <QrCode size={12} />}
        Pix
      </button>

      {open && copiaCola ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/35 p-4" onClick={() => setOpen(false)}>
          <div className="grid max-w-sm gap-4 rounded-ui bg-surface p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-display text-xl text-ink">Pix</h3>
              <button className="text-sm font-semibold text-muted" onClick={() => setOpen(false)} type="button">Fechar</button>
            </div>
            <div className="grid place-items-center rounded-ui border border-line bg-white p-4">
              <QRCodeSVG value={copiaCola} size={220} />
            </div>
            <textarea readOnly value={copiaCola} className="min-h-24 text-xs" />
            <button className="ds-button ds-button-primary" onClick={copiar} type="button">
              <Copy size={16} /> Copiar
            </button>
            <button className="ds-button ds-button-secondary" onClick={enviarWhatsApp} type="button" disabled={loading}>
              {loading ? <Loader2 size={16} className="animate-spin" /> : <MessageCircle size={16} />}
              Enviar por WhatsApp
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
