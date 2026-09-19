"use client";

import { useEffect, useRef, useState } from "react";
import { renderCertificados } from "@/lib/documents/certificado-pdf";
import type { CertificadoData, CertificadoOptions } from "@/lib/documents/certificado-tipos";
import type { HistoricoData } from "@/lib/historico/tipos";

type Props = {
  aluno: CertificadoData | null;
  historico: HistoricoData | null;
  opts: CertificadoOptions;
  logoDataUrl?: string;
};

/** Espera antes de regerar: o preview acompanha digitação, não cada tecla. */
const DEBOUNCE_MS = 400;

/**
 * Preview do certificado num iframe. Chama a **mesma** `renderCertificados` da
 * emissão: o que se vê é o que sai.
 */
export function CertificadoPreview({ aluno, historico, opts, logoDataUrl }: Props) {
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
        const imagens = logoDataUrl && aluno.escola.logoPath
          ? new Map([[aluno.escola.logoPath, { data: logoDataUrl, w: 400, h: 220 }]])
          : new Map();

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
  }, [aluno, historico, opts, logoDataUrl]);

  // Revoga a última URL ao desmontar: o cleanup do efeito acima só cancela o
  // timer, não libera o blob que ficou em uso.
  useEffect(() => {
    return () => {
      if (urlAnterior.current) URL.revokeObjectURL(urlAnterior.current);
    };
  }, []);

  if (erro) {
    return (
      <div className="rounded-lg border border-clay p-4 text-sm text-clay">
        <p className="font-medium">Não foi possível gerar a pré-visualização.</p>
        <p className="mt-1">{erro}</p>
      </div>
    );
  }

  if (!aluno || !url) {
    return (
      <div className="flex h-full min-h-[24rem] items-center justify-center rounded-lg border border-line p-6 text-center text-sm text-muted">
        Selecione um aluno para ver a pré-visualização.
      </div>
    );
  }

  return (
    <iframe
      // A chave força o iframe a recarregar quando o blob troca; sem ela o
      // Chrome mantém o PDF anterior em cache.
      key={url}
      src={url}
      title="Pré-visualização do certificado"
      className="h-full min-h-[32rem] w-full rounded-lg border border-line"
    />
  );
}
