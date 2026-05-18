"use client";

import { useState } from "react";
import { FileText, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/card";
import { generateDocumentoAction, generateDocxAction } from "@/lib/actions/documents-generate";
import { TIPO_TEMPLATE, TEMPLATE_META, type TipoTemplate } from "@/lib/documents/templates";
import type { StudentDocument } from "@/lib/data/documents";

function sizeLabel(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR");
}

interface Props {
  matriculaId: string;
  documentosIniciais: StudentDocument[];
}

export function DocumentGenerator({ matriculaId, documentosIniciais }: Props) {
  const [tipoSelecionado, setTipoSelecionado] = useState<TipoTemplate>(
    TIPO_TEMPLATE.CONTRATO_COLEGIO
  );
  const [loading, setLoading] = useState<"pdf" | "docx" | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [documentos, setDocumentos] = useState<StudentDocument[]>(documentosIniciais);

  async function handleGerarDocx() {
    setLoading("docx");
    setErro(null);
    try {
      const result = await generateDocxAction(matriculaId, tipoSelecionado);
      if (!result.success || !result.base64 || !result.nomeArquivo) {
        setErro(result.error ?? "Erro desconhecido.");
        return;
      }
      const bytes = Uint8Array.from(atob(result.base64), (c) => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.nomeArquivo;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setLoading(null);
    }
  }

  async function handleGerarPdf() {
    setLoading("pdf");
    setErro(null);
    try {
      const result = await generateDocumentoAction(matriculaId, tipoSelecionado);
      if (!result.success) {
        setErro(result.error ?? "Erro desconhecido.");
      } else {
        if (result.url) {
          window.open(result.url, "_blank");
        }
        const res = await fetch(`/api/matriculas/${matriculaId}/documentos`);
        if (res.ok) {
          const novos = await res.json();
          setDocumentos(novos);
        }
      }
    } finally {
      setLoading(null);
    }
  }

  return (
    <Panel className="grid gap-5">
      <h2 className="font-serif text-2xl text-ink">Documentos</h2>

      <div className="flex flex-wrap items-end gap-3">
        <label className="grid gap-1 text-sm">
          <span className="text-muted">Tipo de documento</span>
          <select
            value={tipoSelecionado}
            onChange={(e) => setTipoSelecionado(e.target.value as TipoTemplate)}
            className="rounded-ui border border-line bg-surface px-3 py-2 text-sm text-ink"
            disabled={loading !== null}
          >
            {Object.values(TIPO_TEMPLATE).map((tipo) => (
              <option key={tipo} value={tipo}>
                {TEMPLATE_META[tipo].label}
              </option>
            ))}
          </select>
        </label>
        <Button variant="accent" onClick={handleGerarDocx} disabled={loading !== null}>
          {loading === "docx" ? (
            <><Loader2 size={16} className="animate-spin" /> Gerando...</>
          ) : (
            "Baixar .docx"
          )}
        </Button>
        <Button variant="secondary" onClick={handleGerarPdf} disabled={loading !== null}>
          {loading === "pdf" ? (
            <><Loader2 size={16} className="animate-spin" /> Gerando...</>
          ) : (
            "Gerar PDF"
          )}
        </Button>
      </div>

      {erro && (
        <p className="rounded-ui border border-clay/30 bg-clay/10 p-3 text-sm text-clay">
          {erro}
        </p>
      )}

      {documentos.length > 0 && (
        <div className="grid gap-2">
          <p className="text-sm font-semibold text-ink">Documentos gerados</p>
          {documentos.map((doc) => (
            <article
              key={doc.id}
              className="flex items-center justify-between gap-3 border-b border-line py-3 last:border-b-0"
            >
              <div className="flex items-start gap-3">
                <FileText className="mt-0.5 shrink-0 text-moss" size={18} />
                <div>
                  <strong className="block text-sm text-ink">{doc.nome_arquivo}</strong>
                  <span className="text-xs text-muted">
                    {formatDate(doc.created_at)} · {sizeLabel(doc.tamanho_bytes)}
                  </span>
                </div>
              </div>
              {doc.signed_url && (
                <a
                  href={doc.signed_url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex shrink-0 items-center gap-1 text-sm font-bold text-brand"
                >
                  <Download size={14} />
                  Baixar
                </a>
              )}
            </article>
          ))}
        </div>
      )}
    </Panel>
  );
}
