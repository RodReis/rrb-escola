"use client";

/* eslint-disable @next/next/no-img-element */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BiometricConsentForm } from "./biometric-consent-form";
import { FaceCaptureStep, type CaptureResult } from "./face-capture-step";
import { FaceUploadFallback } from "./face-upload-fallback";
import { computeCentroid } from "@/lib/face/centroid";
import { saveBiometryAction, setConsentAction } from "@/lib/actions/biometrics";

type Props = {
  alunoId: string;
  responsaveis: Array<{ id: string; nome: string }>;
  consentimento: { autorizado: boolean; observacao: string | null } | null;
  biometriaAtiva: { id: string; data_cadastro: string; score_qualidade: number | null } | null;
  fotoReferenciaSignedUrl: string | null;
};

type Phase = "consent" | "idle" | "capturing" | "uploading" | "review" | "saving" | "done" | "error";

const stepLabels = [
  { label: "Foto 1 — frontal", hint: "Olhe diretamente para a camera." },
  { label: "Foto 2 — leve esquerda", hint: "Vire o rosto cerca de 20° para a esquerda." },
  { label: "Foto 3 — leve direita", hint: "Vire o rosto cerca de 20° para a direita." }
];

export function BiometricEnrollment({ alunoId, responsaveis, consentimento, biometriaAtiva, fotoReferenciaSignedUrl }: Props) {
  const router = useRouter();
  const consentAtivo = consentimento?.autorizado === true;
  const [phase, setPhase] = useState<Phase>(consentAtivo ? "idle" : "consent");
  const [stepIndex, setStepIndex] = useState(0);
  const [captures, setCaptures] = useState<CaptureResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleCaptured(r: CaptureResult) {
    const next = [...captures, r];
    setCaptures(next);
    if (next.length >= 3) setPhase("review");
    else setStepIndex(stepIndex + 1);
  }

  async function handleSave() {
    setPhase("saving");
    setError(null);
    try {
      const centroid = computeCentroid(captures.map((c) => c.embedding));
      const scoreMedio = captures.reduce((s, c) => s + c.score, 0) / captures.length;
      const best = [...captures].sort((a, b) => b.score - a.score)[0];
      await saveBiometryAction({
        alunoId,
        embedding: centroid,
        scoreMedio,
        fotoBase64: best.fotoBase64
      });
      setPhase("done");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao salvar biometria");
      setPhase("error");
    }
  }

  function reset() {
    setCaptures([]);
    setStepIndex(0);
    setPhase("idle");
    setError(null);
  }

  function revoke() {
    const fd = new FormData();
    fd.set("aluno_id", alunoId);
    fd.set("autorizado", "false");
    fd.set("observacao", "Revogado pelo operador");
    startTransition(() => {
      setConsentAction(fd);
    });
  }

  if (phase === "consent" || !consentAtivo) {
    return <BiometricConsentForm alunoId={alunoId} responsaveis={responsaveis} consentimento={consentimento} />;
  }

  return (
    <div className="grid gap-4">
      {biometriaAtiva && phase === "idle" ? (
        <div className="grid gap-3 rounded-panel border border-line bg-surface p-4 md:grid-cols-[180px_1fr_auto]">
          <div className="h-44 w-44 overflow-hidden rounded-ui border border-line bg-paper">
            {fotoReferenciaSignedUrl ? <img src={fotoReferenciaSignedUrl} alt="Referencia" className="h-full w-full object-cover" /> : null}
          </div>
          <div>
            <p className="ds-kicker">Biometria ativa</p>
            <p className="mt-1 text-sm">Cadastrada em {new Date(biometriaAtiva.data_cadastro).toLocaleString("pt-BR")}.</p>
            <p className="text-sm">Score medio: {biometriaAtiva.score_qualidade ?? "—"}.</p>
          </div>
          <div className="grid gap-2">
            <button className="ds-button ds-button-secondary" type="button" onClick={() => setPhase("capturing")}>Refazer cadastro</button>
            <button className="ds-button ds-button-ghost text-clay" type="button" onClick={revoke} disabled={pending}>Revogar consentimento</button>
          </div>
        </div>
      ) : null}

      {phase === "idle" && !biometriaAtiva ? (
        <div className="grid gap-3">
          <p className="text-sm">Consentimento ativo. Pronto para cadastrar biometria.</p>
          <div className="flex flex-wrap gap-2">
            <button className="ds-button ds-button-primary" type="button" onClick={() => setPhase("capturing")}>Iniciar cadastro com camera</button>
            <button className="ds-button ds-button-secondary" type="button" onClick={() => setPhase("uploading")}>Usar upload de fotos</button>
            <button className="ds-button ds-button-ghost text-clay" type="button" onClick={revoke} disabled={pending}>Revogar consentimento</button>
          </div>
        </div>
      ) : null}

      {phase === "capturing" ? (
        <div className="grid gap-3">
          <p className="text-sm">Etapa {captures.length + 1} de 3.</p>
          <FaceCaptureStep
            key={stepIndex}
            label={stepLabels[stepIndex].label}
            hint={stepLabels[stepIndex].hint}
            onCaptured={handleCaptured}
          />
          <button type="button" className="ds-button ds-button-ghost w-fit" onClick={() => setPhase("uploading")}>Mudar para upload</button>
        </div>
      ) : null}

      {phase === "uploading" ? (
        <FaceUploadFallback
          onComplete={(results) => {
            setCaptures(results);
            setPhase("review");
          }}
        />
      ) : null}

      {phase === "review" ? (
        <div className="grid gap-3 rounded-panel border border-line bg-surface p-4">
          <p className="ds-kicker">Revisao</p>
          <div className="grid gap-2 md:grid-cols-3">
            {captures.map((c, idx) => (
              <div key={idx}>
                <img src={c.fotoBase64} alt={`Foto ${idx + 1}`} className="h-40 w-full rounded-ui object-cover" />
                <p className="mt-1 text-xs text-muted">Score {c.score.toFixed(2)}</p>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="ds-button ds-button-primary" type="button" onClick={handleSave}>Salvar biometria</button>
            <button className="ds-button ds-button-secondary" type="button" onClick={reset}>Refazer</button>
          </div>
        </div>
      ) : null}

      {phase === "saving" ? <p className="text-sm">Salvando...</p> : null}
      {phase === "done" ? <p className="text-sm text-moss">Biometria cadastrada.</p> : null}
      {phase === "error" ? (
        <div className="grid gap-2 rounded-ui border border-clay bg-clay/10 p-3 text-sm text-clay">
          <span>{error}</span>
          <button type="button" className="ds-button ds-button-secondary w-fit" onClick={reset}>Voltar</button>
        </div>
      ) : null}
    </div>
  );
}
