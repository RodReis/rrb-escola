"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useRef, useState } from "react";
import { extractEmbedding } from "@/lib/face/extract-embedding";
import type { CaptureResult } from "./face-capture-step";

type Slot = { result: CaptureResult | null; error: string | null; previewUrl: string | null };

type Props = {
  onComplete: (captures: CaptureResult[]) => void;
};

const errorMessages: Record<string, string> = {
  no_face: "Nenhum rosto detectado.",
  multiple_faces: "Multiplos rostos.",
  low_score: "Foto pouco nitida.",
  too_small: "Rosto muito pequeno.",
  off_center: "Rosto fora do centro."
};

export function FaceUploadFallback({ onComplete }: Props) {
  const [slots, setSlots] = useState<Slot[]>([
    { result: null, error: null, previewUrl: null },
    { result: null, error: null, previewUrl: null },
    { result: null, error: null, previewUrl: null }
  ]);
  const inputs = useRef<Array<HTMLInputElement | null>>([null, null, null]);

  useEffect(() => {
    return () => {
      slots.forEach((s) => { if (s.previewUrl) URL.revokeObjectURL(s.previewUrl); });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleFile(idx: number, file: File) {
    const url = URL.createObjectURL(file);
    const img = new Image();
    await new Promise<void>((res, rej) => {
      img.onload = () => res();
      img.onerror = () => rej(new Error("falha ao carregar"));
      img.src = url;
    });
    const r = await extractEmbedding(img);
    setSlots((prev) => {
      if (prev[idx].previewUrl) URL.revokeObjectURL(prev[idx].previewUrl!);
      const next = [...prev];
      if (r.ok) {
        const fotoBase64 = toDataUrl(img);
        next[idx] = { result: { embedding: r.embedding, score: r.score, fotoBase64 }, error: null, previewUrl: url };
      } else {
        next[idx] = { result: null, error: errorMessages[r.error] ?? r.error, previewUrl: url };
      }
      return next;
    });
  }

  function toDataUrl(img: HTMLImageElement): string {
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    canvas.getContext("2d")?.drawImage(img, 0, 0);
    return canvas.toDataURL("image/jpeg", 0.9);
  }

  const allValid = slots.every((s) => s.result !== null);

  return (
    <div className="grid gap-3 rounded-panel border border-line bg-surface p-4">
      <div>
        <p className="ds-kicker">Upload de fotos</p>
        <p className="text-sm text-muted">Selecione 3 fotos do aluno (frontal, leve esquerda, leve direita).</p>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {slots.map((slot, idx) => (
          <div key={idx} className="grid gap-2 rounded-ui border border-line p-2 text-sm">
            <strong>Foto {idx + 1}</strong>
            <input
              ref={(el) => { inputs.current[idx] = el; }}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(idx, f); }}
            />
            {slot.previewUrl ? (
              <img src={slot.previewUrl} alt={`Foto ${idx + 1}`} className="h-32 w-full rounded-ui object-cover" />
            ) : null}
            {slot.result ? <span className="text-moss">OK (score {slot.result.score.toFixed(2)})</span> : null}
            {slot.error ? <span className="text-clay">{slot.error}</span> : null}
          </div>
        ))}
      </div>
      <button
        type="button"
        className="ds-button ds-button-primary w-fit disabled:opacity-50"
        disabled={!allValid}
        onClick={() => onComplete(slots.map((s) => s.result!))}
      >
        Confirmar 3 fotos
      </button>
    </div>
  );
}
