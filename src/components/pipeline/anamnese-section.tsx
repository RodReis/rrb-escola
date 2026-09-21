"use client";

import { useState, useTransition } from "react";
import {
  ChevronDown, ChevronUp, AlertTriangle, CheckCircle, RotateCcw, Clock,
  FileDown, ClipboardList,
} from "lucide-react";
import {
  getAnamnese,
  mudarStatusAnamnese,
  type Anamnese,
} from "@/lib/actions/pipeline-anamnese";
import type { StatusAnamnese } from "@/lib/validation/pipeline";
import { cn } from "@/lib/utils";
import { exportarAnamneseDocxAction } from "@/lib/actions/anamnese-export";
import { downloadBase64Docx } from "@/lib/documents/download-client";
import { AnamneseModal } from "./anamnese-modal";

type Props = {
  cardId: string;
  podeAcessar: boolean;
};

const STATUS_LABEL: Record<StatusAnamnese, string> = {
  nao_iniciada: "Não iniciada",
  enviada: "Enviada",
  pendente: "Pendente",
  em_analise: "Em análise",
  concluida: "Concluída",
  requer_atencao: "Requer atenção",
};

const STATUS_COLOR: Record<StatusAnamnese, string> = {
  nao_iniciada: "bg-[rgb(var(--color-muted))] text-[rgb(var(--color-ink)/0.6)]",
  enviada: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  pendente: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
  em_analise: "bg-[rgb(var(--color-brand)/0.12)] text-[rgb(var(--color-brand))]",
  concluida: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  requer_atencao: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
};

export function AnamneseSection({ cardId, podeAcessar }: Props) {
  const [aberta, setAberta] = useState(false);
  const [carregou, setCarregou] = useState(false);
  const [anamnese, setAnamnese] = useState<Anamnese | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [modalAberto, setModalAberto] = useState(false);
  const [exportando, setExportando] = useState(false);
  const [erroAcao, setErroAcao] = useState<string | null>(null);

  function carregar() {
    startTransition(async () => {
      const res = await getAnamnese(cardId);
      setCarregou(true);
      if (!res.ok) { setErro(res.error); return; }
      setAnamnese(res.data.anamnese);
    });
  }

  function abrirSecao() {
    setAberta(true);
    if (!carregou) carregar();
  }

  function toggleSecao() {
    if (!aberta) abrirSecao();
    else setAberta(false);
  }

  async function handleMudarStatus(novo: "em_analise" | "concluida" | "requer_atencao") {
    const res = await mudarStatusAnamnese({ card_id: cardId, novo_status: novo });
    if (!res.ok) { setErroAcao(res.error); return; }
    carregar();
  }

  async function handleExportarDocx() {
    setExportando(true);
    setErroAcao(null);
    try {
      const res = await exportarAnamneseDocxAction({ cardId });
      if (!res.ok) { setErroAcao(res.error); return; }
      downloadBase64Docx(res.base64, res.nomeArquivo);
    } finally {
      setExportando(false);
    }
  }

  const status = anamnese?.status as StatusAnamnese | undefined;

  return (
    <section>
      <button
        type="button"
        onClick={toggleSecao}
        className="mb-2 flex w-full items-center justify-between"
      >
        <h4 className="text-xs font-semibold uppercase tracking-wide text-[rgb(var(--color-ink)/0.45)]">
          Anamnese
        </h4>
        <span className="text-[rgb(var(--color-ink)/0.35)]">
          {aberta ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </span>
      </button>

      {aberta && (
        <div className="space-y-3 text-sm">
          {!podeAcessar && (
            <p className="text-xs text-[rgb(var(--color-ink)/0.5)]">
              Sem acesso a dados sensíveis.
            </p>
          )}

          {podeAcessar && isPending && !carregou && (
            <p className="text-xs text-[rgb(var(--color-ink)/0.4)] animate-pulse">Carregando…</p>
          )}

          {podeAcessar && carregou && erro && (
            <p className="text-xs text-[rgb(var(--color-danger))]">{erro}</p>
          )}

          {podeAcessar && carregou && !erro && (
            <>
              {/* Status + transições */}
              {status && status !== "nao_iniciada" && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className={cn("rounded px-2 py-0.5 text-xs font-medium", STATUS_COLOR[status])}>
                    {STATUS_LABEL[status]}
                  </span>
                  {status === "em_analise" && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleMudarStatus("concluida")}
                        className="flex items-center gap-1 rounded border border-green-400 px-2 py-0.5 text-xs text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20"
                      >
                        <CheckCircle size={11} /> Concluir
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMudarStatus("requer_atencao")}
                        className="flex items-center gap-1 rounded border border-red-400 px-2 py-0.5 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                      >
                        <AlertTriangle size={11} /> Requer atenção
                      </button>
                    </>
                  )}
                  {status === "concluida" && (
                    <button
                      type="button"
                      onClick={() => handleMudarStatus("requer_atencao")}
                      className="flex items-center gap-1 rounded border border-red-400 px-2 py-0.5 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                      <AlertTriangle size={11} /> Requer atenção
                    </button>
                  )}
                  {status === "requer_atencao" && (
                    <button
                      type="button"
                      onClick={() => handleMudarStatus("em_analise")}
                      className="flex items-center gap-1 rounded border border-[rgb(var(--color-brand))] px-2 py-0.5 text-xs text-[rgb(var(--color-brand))] hover:bg-[rgb(var(--color-brand)/0.06)]"
                    >
                      <RotateCcw size={11} /> Retomar análise
                    </button>
                  )}
                </div>
              )}

              {/* Consentimento (info curta) */}
              {anamnese?.consentimento_em && (
                <p className="text-xs text-[rgb(var(--color-ink)/0.45)]">
                  <Clock size={11} className="mr-1 inline" />
                  Consentimento em{" "}
                  {new Date(anamnese.consentimento_em).toLocaleDateString("pt-BR")}
                  {" · "} Termo {anamnese.termo_versao ?? "v1"}
                </p>
              )}

              {erroAcao && (
                <p className="text-xs text-[rgb(var(--color-danger))]">{erroAcao}</p>
              )}

              {/* Ações: responder (modal) + exportar */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setModalAberto(true)}
                  className="flex items-center gap-1 rounded-md bg-[rgb(var(--color-brand))] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
                >
                  <ClipboardList size={13} />
                  {anamnese?.consentimento_em ? "Responder anamnese" : "Iniciar anamnese"}
                </button>
                {anamnese?.consentimento_em && (
                  <button
                    type="button"
                    onClick={handleExportarDocx}
                    disabled={exportando}
                    className="flex items-center gap-1 rounded border border-[rgb(var(--color-line))] px-2 py-1 text-xs text-[rgb(var(--color-ink)/0.7)] hover:border-[rgb(var(--color-brand)/0.4)] hover:text-[rgb(var(--color-brand))] disabled:opacity-50"
                  >
                    <FileDown size={12} />
                    {exportando ? "Gerando…" : "Exportar DOCX"}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {modalAberto && (
        <AnamneseModal
          cardId={cardId}
          onClose={() => setModalAberto(false)}
          onSaved={carregar}
        />
      )}
    </section>
  );
}
