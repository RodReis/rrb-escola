import { FileText, Trash2, UploadCloud } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/card";
import { removeStudentDocumentAction, uploadStudentDocumentAction } from "@/lib/actions/documents";
import type { StudentDocument } from "@/lib/data/documents";

function sizeLabel(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const GENERATED_TIPOS = new Set(["contrato", "declaracao", "termo"]);

function origemBadge(tipo: string) {
  return GENERATED_TIPOS.has(tipo) ? "generated" : "uploaded";
}

export function StudentDocumentsPanel({ alunoId, documents }: { alunoId: string; documents: StudentDocument[] }) {
  return (
    <Panel className="grid gap-5">
      <h2 className="font-display text-2xl text-ink">Documentos do aluno</h2>
      <form action={uploadStudentDocumentAction} className="grid gap-4 md:grid-cols-[180px_1fr_160px]">
        <input type="hidden" name="aluno_id" value={alunoId} />
        <label>
          Tipo
          <select name="tipo_documento" defaultValue="outro">
            <option value="certidao">Certidao</option>
            <option value="cpf_rg">CPF/RG</option>
            <option value="comprovante_endereco">Comprovante endereco</option>
            <option value="documento_responsavel">Documento responsavel</option>
            <option value="outro">Outro</option>
          </select>
        </label>
        <label>
          Arquivo
          <input name="documento" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" required />
        </label>
        <Button className="self-end" variant="accent">
          <UploadCloud size={16} />
          Enviar
        </Button>
      </form>

      <div className="grid gap-2">
        {documents.length === 0 ? (
          <p className="rounded-ui border border-line bg-surface p-4 text-sm text-muted">Nenhum documento anexado.</p>
        ) : (
          documents.map((document) => (
            <article key={document.id} className="grid gap-3 border-b border-line py-3 last:border-b-0 md:grid-cols-[1fr_150px_90px]">
              <div className="flex items-start gap-3">
                <FileText className="mt-1 text-moss" size={18} />
                <div className="grid gap-1">
                  <strong className="block text-sm text-ink">{document.nome_arquivo}</strong>
                  <div className="flex items-center gap-2 text-xs text-muted">
                    <span>{document.tipo_documento} / {sizeLabel(document.tamanho_bytes)}</span>
                    {origemBadge(document.tipo_documento) === "generated" ? (
                      <Badge tone="green">Gerado</Badge>
                    ) : (
                      <Badge tone="gray">Enviado</Badge>
                    )}
                  </div>
                </div>
              </div>
              {document.signed_url ? (
                <a href={document.signed_url} target="_blank" className="self-center text-sm font-bold text-brand">
                  Abrir documento
                </a>
              ) : (
                <span className="self-center text-sm text-muted">Sem link</span>
              )}
              <form action={removeStudentDocumentAction} className="self-center text-right">
                <input type="hidden" name="aluno_id" value={alunoId} />
                <input type="hidden" name="documento_id" value={document.id} />
                <input type="hidden" name="storage_path" value={document.storage_path} />
                <button className="inline-flex items-center gap-1 text-xs font-bold text-clay">
                  <Trash2 size={14} />
                  Remover
                </button>
              </form>
            </article>
          ))
        )}
      </div>
    </Panel>
  );
}
