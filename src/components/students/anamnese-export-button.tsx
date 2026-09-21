"use client";

import { useState } from "react";
import { FileDown } from "lucide-react";
import { exportarAnamneseDocxAction } from "@/lib/actions/anamnese-export";
import { downloadBase64Docx } from "@/lib/documents/download-client";

export function AnamneseExportButton({ alunoId }: { alunoId: string }) {
  const [exportando, setExportando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function handle() {
    setExportando(true);
    setErro(null);
    try {
      const res = await exportarAnamneseDocxAction({ alunoId });
      if (!res.ok) { setErro(res.error); return; }
      downloadBase64Docx(res.base64, res.nomeArquivo);
    } finally {
      setExportando(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handle}
        disabled={exportando}
        className="flex items-center gap-1 rounded-md border border-line px-3 py-1.5 text-sm text-ink hover:border-brand/40 hover:text-brand disabled:opacity-50"
      >
        <FileDown size={14} />
        {exportando ? "Gerando…" : "Exportar DOCX"}
      </button>
      {erro ? <p className="text-xs text-danger">{erro}</p> : null}
    </div>
  );
}
