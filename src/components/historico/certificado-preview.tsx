"use client";

import { AlertTriangle, FileText } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { renderCertificados, type ImagemCache } from "@/lib/documents/certificado-pdf";
import type { CertificadoData, CertificadoOptions } from "@/lib/documents/certificado-tipos";
import type { HistoricoData } from "@/lib/historico/tipos";

type Props = {
  aluno: CertificadoData | null;
  historico: HistoricoData | null;
  opts: CertificadoOptions;
  imagens?: ImagemCache;
};

/** Espera antes de regerar: o preview acompanha digitação, não cada tecla. */
const DEBOUNCE_MS = 400;

/**
 * Preview do certificado num iframe. Chama a **mesma** `renderCertificados` da
 * emissão: o que se vê é o que sai.
 */
export function CertificadoPreview({ aluno, historico, opts, imagens = new Map() }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  // A URL anterior precisa ser revogada: sem isso cada tecla digitada deixaria
  // um blob preso na memória da aba até o reload.
  const urlAnterior = useRef<string | null>(null);

  useEffect(() => {
    if (!aluno) {
      setUrl(null);
      return;
    }

    const timer = setTimeout(() => {
      try {
        const historicos = historico ? new Map([[aluno.aluno.id, historico]]) : new Map();
        const blob = renderCertificados([aluno], opts, historicos, imagens).output("blob");
        const nova = URL.createObjectURL(blob);
        if (urlAnterior.current) URL.revokeObjectURL(urlAnterior.current);
        urlAnterior.current = nova;
        setUrl(nova);
        setErro(null);
      } catch (e) {
        setErro(e instanceof Error ? e.message : "Falha ao gerar a pré-visualização.");
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [aluno, historico, opts, imagens]);

  // Revoga a última URL ao desmontar: o cleanup do efeito acima só cancela o
  // timer, não libera o blob que ficou em uso.
  useEffect(() => {
    return () => {
      if (urlAnterior.current) URL.revokeObjectURL(urlAnterior.current);
    };
  }, []);

  if (erro) {
    return (
      <div className="flex h-full min-h-[46rem] flex-col items-center justify-center gap-2 rounded-panel border border-clay/30 bg-clay/5 p-6 text-center">
        <AlertTriangle size={24} className="text-clay" />
        <p className="text-sm font-semibold text-clay">Não foi possível gerar a pré-visualização.</p>
        <p className="text-xs text-clay/80">{erro}</p>
      </div>
    );
  }

  if (!aluno || !url) {
    return (
      <div className="flex h-full min-h-[46rem] flex-col items-center justify-center gap-2 rounded-panel border border-dashed border-line p-6 text-center">
        <FileText size={24} className="text-ink/30" />
        <p className="text-sm font-medium text-ink/60">Selecione um aluno para ver a pré-visualização.</p>
      </div>
    );
  }

  return (
    <iframe
      // A chave força o iframe a recarregar quando o blob troca; sem ela o
      // Chrome mantém o PDF anterior em cache. Fragmentos `#zoom=`/`#view=`
      // não têm efeito confiável em blob: URLs (só em http/https) — por isso
      // o ajuste de largura vem do layout (ver `CertificadoForm`), não daqui.
      key={url}
      src={url}
      title="Pré-visualização do certificado"
      className="h-full min-h-[46rem] w-full rounded-panel border border-line shadow-soft"
    />
  );
}
