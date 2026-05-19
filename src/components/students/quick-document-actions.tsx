"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, FileText, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button, ButtonLink } from "@/components/ui/button";
import { generateFromTemplateAction } from "@/lib/actions/documents-generate-v2";
import { downloadBase64Docx } from "@/lib/documents/download-client";

type MatriculaAtiva = { id: string; codigo: string | null };
type TemplateLite = { id: string; nome: string };

type Props = {
  alunoId: string;
  matriculaAtiva: MatriculaAtiva | null;
  templates: TemplateLite[];
  onExportFichaPdf?: () => void;
};

export function QuickDocumentActions({ alunoId, matriculaAtiva, templates, onExportFichaPdf }: Props) {
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setDropdownOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  async function handleGerar(templateId: string) {
    if (!matriculaAtiva) return;
    if (loadingId) return;
    setLoadingId(templateId);
    try {
      const res = await generateFromTemplateAction(matriculaAtiva.id, templateId);
      if (!res.success || !res.base64 || !res.nomeArquivo) {
        toast.error(res.error ?? "Erro ao gerar documento.");
        return;
      }
      try {
        downloadBase64Docx(res.base64, res.nomeArquivo);
      } catch {
        toast.error("Documento gerado no servidor, mas falha ao iniciar download.");
        return;
      }
      toast.success(`Documento gerado: ${res.nomeArquivo}`);
    } catch {
      toast.error("Erro inesperado ao gerar documento.");
    } finally {
      setLoadingId(null);
      setDropdownOpen(false);
    }
  }

  if (!matriculaAtiva) {
    return (
      <ButtonLink href={`/matriculas?aluno_id=${alunoId}`} variant="primary" className="gap-1">
        <Plus size={14} />
        Matricular aluno
      </ButtonLink>
    );
  }

  const quick = templates.slice(0, 3);
  const more = templates.slice(3);

  if (templates.length === 0) {
    return (
      <ButtonLink href="/rh/documentos/novo" variant="secondary" className="gap-1">
        <Plus size={14} /> Configurar templates
      </ButtonLink>
    );
  }

  return (
    <div
      ref={containerRef}
      className="flex flex-wrap items-center gap-1.5 rounded-ui border border-gold/40 bg-surface px-2.5 py-1.5"
    >
      <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted">Gerar:</span>
      {quick.map((t) => (
        <Button
          key={t.id}
          variant="accent"
          onClick={() => handleGerar(t.id)}
          disabled={loadingId !== null}
          className="!py-1.5 !px-2.5 text-xs"
        >
          {loadingId === t.id ? <Loader2 size={12} className="animate-spin" /> : <FileText size={12} />}
          {t.nome}
        </Button>
      ))}
      {(more.length > 0 || onExportFichaPdf) && (
        <div className="relative">
          <Button
            variant="secondary"
            onClick={() => setDropdownOpen((v) => !v)}
            disabled={loadingId !== null}
            aria-haspopup="true"
            aria-expanded={dropdownOpen}
            aria-label="Mais documentos"
            className="!py-1.5 !px-2.5 text-xs"
          >
            Mais
            <ChevronDown size={12} />
          </Button>
          {dropdownOpen && (
            <div
              role="menu"
              aria-label="Mais documentos"
              className="absolute right-0 top-full z-20 mt-1 w-72 rounded-ui border border-line bg-surface p-1.5 shadow-soft"
            >
              <p className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-muted">
                Mais documentos
              </p>
              {more.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="menuitem"
                  onClick={() => handleGerar(t.id)}
                  disabled={loadingId !== null}
                  className="flex w-full items-center gap-2 rounded-ui px-2.5 py-2 text-left text-sm text-ink hover:bg-muted/60 disabled:opacity-50"
                >
                  {loadingId === t.id ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} className="text-moss" />}
                  {t.nome}
                </button>
              ))}
              {onExportFichaPdf && (
                <>
                  <div className="my-1 border-t border-line" />
                  <button
                    type="button"
                    role="menuitem"
                    disabled={loadingId !== null}
                    onClick={() => { setDropdownOpen(false); onExportFichaPdf(); }}
                    className="flex w-full items-center gap-2 rounded-ui px-2.5 py-2 text-left text-sm italic text-muted hover:bg-muted/60 disabled:opacity-50"
                  >
                    ⬇ Exportar ficha (PDF)
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
