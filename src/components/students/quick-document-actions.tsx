"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Download, FileText, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { generateFromTemplateAction } from "@/lib/actions/documents-generate-v2";
import { downloadBase64Docx } from "@/lib/documents/download-client";
import { cn } from "@/lib/utils";

type MatriculaAtiva = { id: string; codigo: string | null };
type TemplateLite = { id: string; nome: string; categoria?: string | null };

type Props = {
  matriculaAtiva: MatriculaAtiva | null;
  templates: TemplateLite[];
  onExportFichaPdf?: () => void;
};

/** Rótulo e ordem das seções. Categoria fora desta lista cai em "Outros". */
const CATEGORIAS: Array<{ chave: string; label: string }> = [
  { chave: "contrato", label: "Contratos" },
  { chave: "declaracao", label: "Declarações" },
  { chave: "termo", label: "Termos" },
  { chave: "outro", label: "Outros" }
];

function normalizar(texto: string): string {
  return texto
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export function QuickDocumentActions({ matriculaAtiva, templates, onExportFichaPdf }: Props) {
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const buscaRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setAberto(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setAberto(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  // Foco na busca ao abrir: com dezenas de templates, digitar é mais rápido que rolar.
  useEffect(() => {
    if (aberto) buscaRef.current?.focus();
    else setBusca("");
  }, [aberto]);

  const grupos = useMemo(() => {
    const termo = normalizar(busca.trim());
    const filtrados = termo
      ? templates.filter((t) => normalizar(t.nome).includes(termo))
      : templates;

    return CATEGORIAS.map(({ chave, label }) => ({
      label,
      itens: filtrados.filter((t) => (t.categoria ?? "outro") === chave)
    })).filter((g) => g.itens.length > 0);
  }, [templates, busca]);

  const totalFiltrado = grupos.reduce((soma, g) => soma + g.itens.length, 0);

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
      if (res.warning) {
        toast.warning(res.warning, { duration: 8000 });
      }
    } catch {
      toast.error("Erro inesperado ao gerar documento.");
    } finally {
      setLoadingId(null);
      setAberto(false);
    }
  }

  // Sem matrícula ativa não há documento a gerar; o botão de matricular fica no header.
  if (!matriculaAtiva) return null;
  if (templates.length === 0 && !onExportFichaPdf) return null;

  return (
    <div ref={containerRef} className="relative">
      <Button
        variant="secondary"
        onClick={() => setAberto((v) => !v)}
        disabled={loadingId !== null}
        aria-haspopup="dialog"
        aria-expanded={aberto}
      >
        {loadingId !== null ? (
          <Loader2 size={14} className="animate-spin" />
        ) : (
          <FileText size={14} />
        )}
        Gerar documento
        <span className="rounded-pill bg-muted px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-ink/70">
          {templates.length}
        </span>
        <ChevronDown
          size={13}
          className={cn("transition-transform duration-150", aberto && "rotate-180")}
        />
      </Button>

      {aberto && (
        <div
          role="dialog"
          aria-label="Gerar documento do aluno"
          className="absolute right-0 top-full z-30 mt-1.5 w-[340px] overflow-hidden rounded-ui border border-line bg-surface shadow-soft"
        >
          {templates.length > 0 && (
            <div className="border-b border-line p-2">
              <div className="relative">
                <Search
                  size={13}
                  className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted"
                />
                <input
                  ref={buscaRef}
                  type="text"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar documento…"
                  aria-label="Buscar documento"
                  className="w-full !pl-8 text-xs"
                />
              </div>
            </div>
          )}

          <div className="max-h-[320px] overflow-y-auto p-1.5">
            {templates.length > 0 && totalFiltrado === 0 && (
              <p className="px-2.5 py-6 text-center text-xs text-muted">
                Nenhum documento para “{busca}”.
              </p>
            )}

            {grupos.map((grupo) => (
              <div key={grupo.label} className="mb-1 last:mb-0">
                <p className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-muted">
                  {grupo.label}
                </p>
                {grupo.itens.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => handleGerar(t.id)}
                    disabled={loadingId !== null}
                    title={t.nome}
                    className="flex w-full items-center gap-2 rounded-ui px-2.5 py-2 text-left text-sm text-ink transition-colors hover:bg-muted/60 disabled:opacity-50"
                  >
                    {loadingId === t.id ? (
                      <Loader2 size={14} className="shrink-0 animate-spin text-brand" />
                    ) : (
                      <FileText size={14} className="shrink-0 text-muted" />
                    )}
                    <span className="min-w-0 flex-1 truncate">{t.nome}</span>
                    <span className="shrink-0 font-mono text-[9px] uppercase text-muted">docx</span>
                  </button>
                ))}
              </div>
            ))}
          </div>

          {onExportFichaPdf && (
            <div className="border-t border-line p-1.5">
              <button
                type="button"
                disabled={loadingId !== null}
                onClick={() => {
                  setAberto(false);
                  onExportFichaPdf();
                }}
                className="flex w-full items-center gap-2 rounded-ui px-2.5 py-2 text-left text-sm text-ink transition-colors hover:bg-muted/60 disabled:opacity-50"
              >
                <Download size={14} className="shrink-0 text-muted" />
                <span className="flex-1">Exportar ficha</span>
                <span className="shrink-0 font-mono text-[9px] uppercase text-muted">pdf</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
