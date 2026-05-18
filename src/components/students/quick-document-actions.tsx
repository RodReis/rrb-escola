"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, FileText, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button, ButtonLink } from "@/components/ui/button";
import { generateDocxAction } from "@/lib/actions/documents-generate";
import { downloadBase64Docx } from "@/lib/documents/download-client";
import { TIPO_TEMPLATE, type TipoTemplate } from "@/lib/documents/templates";

type MatriculaAtiva = { id: string; codigo: string | null };

type Props = {
  alunoId: string;
  matriculaAtiva: MatriculaAtiva | null;
  onExportFichaPdf?: () => void;
};

const QUICK: Array<{ tipo: TipoTemplate; label: string }> = [
  { tipo: TIPO_TEMPLATE.DECLARACAO_FREQUENCIA, label: "Decl. Frequência" },
  { tipo: TIPO_TEMPLATE.DECLARACAO_TRANSFERENCIA, label: "Decl. Transferência" },
  { tipo: TIPO_TEMPLATE.TERMO_RESPONSABILIDADE, label: "Termo Resp." },
];

const MORE: Array<{ tipo: TipoTemplate; label: string }> = [
  { tipo: TIPO_TEMPLATE.TERMO_RESPONSABILIDADE_INTEGRADO, label: "Termo Responsabilidade — Integrado" },
  { tipo: TIPO_TEMPLATE.CONTRATO_PINGUINHO, label: "Contrato — Pinguinho" },
  { tipo: TIPO_TEMPLATE.CONTRATO_COLEGIO, label: "Contrato — Colégio Integrado" },
];

export function QuickDocumentActions({ alunoId, matriculaAtiva, onExportFichaPdf }: Props) {
  const [loadingTipo, setLoadingTipo] = useState<TipoTemplate | null>(null);
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

  async function handleGerar(tipo: TipoTemplate) {
    if (!matriculaAtiva) return;
    if (loadingTipo) return;
    setLoadingTipo(tipo);
    try {
      const res = await generateDocxAction(matriculaAtiva.id, tipo);
      if (!res.success || !res.base64 || !res.nomeArquivo) {
        toast.error(res.error ?? "Erro ao gerar documento.");
        return;
      }
      downloadBase64Docx(res.base64, res.nomeArquivo);
      toast.success(`Documento gerado: ${res.nomeArquivo}`);
    } finally {
      setLoadingTipo(null);
      setDropdownOpen(false);
    }
  }

  if (!matriculaAtiva) {
    return (
      <ButtonLink
        href={`/matriculas?aluno_id=${alunoId}`}
        variant="primary"
        className="gap-1"
      >
        <Plus size={14} />
        Matricular aluno
      </ButtonLink>
    );
  }

  return (
    <div
      ref={containerRef}
      className="flex flex-wrap items-center gap-1.5 rounded-ui border border-gold/40 bg-surface px-2.5 py-1.5"
    >
      <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted">
        Gerar:
      </span>
      {QUICK.map(({ tipo, label }) => (
        <Button
          key={tipo}
          variant="accent"
          onClick={() => handleGerar(tipo)}
          disabled={loadingTipo !== null}
          className="!py-1.5 !px-2.5 text-xs"
        >
          {loadingTipo === tipo ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <FileText size={12} />
          )}
          {label}
        </Button>
      ))}
      <div className="relative">
        <Button
          variant="secondary"
          onClick={() => setDropdownOpen((v) => !v)}
          disabled={loadingTipo !== null}
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
            {MORE.map(({ tipo, label }) => (
              <button
                key={tipo}
                type="button"
                role="menuitem"
                onClick={() => handleGerar(tipo)}
                disabled={loadingTipo !== null}
                className="flex w-full items-center gap-2 rounded-ui px-2.5 py-2 text-left text-sm text-ink hover:bg-muted/60 disabled:opacity-50"
              >
                {loadingTipo === tipo ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <FileText size={14} className="text-moss" />
                )}
                {label}
              </button>
            ))}
            {onExportFichaPdf && (
              <>
                <div className="my-1 border-t border-line" />
                <button
                  type="button"
                  role="menuitem"
                  disabled={loadingTipo !== null}
                  onClick={() => {
                    setDropdownOpen(false);
                    onExportFichaPdf();
                  }}
                  className="flex w-full items-center gap-2 rounded-ui px-2.5 py-2 text-left text-sm italic text-muted hover:bg-muted/60 disabled:opacity-50"
                >
                  ⬇ Exportar ficha (PDF)
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
