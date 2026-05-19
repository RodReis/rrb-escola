"use client";

import { useState } from "react";
import { FileText, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/card";
import { generateFromTemplateAction } from "@/lib/actions/documents-generate-v2";
import { downloadBase64Docx } from "@/lib/documents/download-client";
import type { StudentDocument } from "@/lib/data/documents";

type TemplateLite = { id: string; nome: string; categoria: string };

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
  templates: TemplateLite[];
  documentosIniciais: StudentDocument[];
}

export function DocumentGenerator({ matriculaId, templates, documentosIniciais }: Props) {
  const [templateId, setTemplateId] = useState<string>(templates[0]?.id ?? "");
  const [loading, setLoading] = useState(false);
  const [documentos, setDocumentos] = useState<StudentDocument[]>(documentosIniciais);

  async function handleGerar() {
    if (!templateId) return;
    setLoading(true);
    try {
      const res = await generateFromTemplateAction(matriculaId, templateId);
      if (!res.success || !res.base64 || !res.nomeArquivo) {
        toast.error(res.error ?? "Erro ao gerar documento.");
        return;
      }
      downloadBase64Docx(res.base64, res.nomeArquivo);
      toast.success(`Documento gerado: ${res.nomeArquivo}`);

      const r = await fetch(`/api/matriculas/${matriculaId}/documentos`);
      if (r.ok) setDocumentos(await r.json());
    } finally {
      setLoading(false);
    }
  }

  return (
    <Panel className="grid gap-5">
      <h2 className="font-serif text-2xl text-ink">Documentos</h2>

      {templates.length === 0 ? (
        <p className="text-sm text-muted">Nenhum template ativo. Cadastre em RH → Documentos.</p>
      ) : (
        <div className="flex flex-wrap items-end gap-3">
          <label className="grid gap-1 text-sm">
            <span className="text-muted">Template</span>
            <select
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              className="rounded-ui border border-line bg-surface px-3 py-2 text-sm text-ink"
              disabled={loading}
            >
              {templates.map((t) => (
                <option key={t.id} value={t.id}>{t.nome}</option>
              ))}
            </select>
          </label>
          <Button variant="accent" onClick={handleGerar} disabled={loading || !templateId}>
            {loading ? (<><Loader2 size={16} className="animate-spin" /> Gerando...</>) : "Baixar .docx"}
          </Button>
        </div>
      )}

      {documentos.length > 0 && (
        <div className="grid gap-2">
          <p className="text-sm font-semibold text-ink">Documentos gerados</p>
          {documentos.map((doc) => (
            <article key={doc.id} className="flex items-center justify-between gap-3 border-b border-line py-3 last:border-b-0">
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
                <a href={doc.signed_url} target="_blank" rel="noreferrer" className="flex shrink-0 items-center gap-1 text-sm font-bold text-brand">
                  <Download size={14} /> Baixar
                </a>
              )}
            </article>
          ))}
        </div>
      )}
    </Panel>
  );
}
