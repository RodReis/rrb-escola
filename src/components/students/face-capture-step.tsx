"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useRef, useState } from "react";
import { extractEmbedding, type ExtractionResult } from "@/lib/face/extract-embedding";

export type CaptureResult = { embedding: number[]; score: number; fotoBase64: string };

type Props = {
  label: string;
  hint: string;
  onCaptured: (result: CaptureResult) => void;
};

const errorMessages: Record<Exclude<ExtractionResult, { ok: true }>["error"], string> = {
  no_face: "Nenhum rosto detectado. Aproxime-se da camera.",
  multiple_faces: "Varios rostos detectados. Apenas o aluno deve aparecer.",
  low_score: "Foto pouco nitida. Melhore a iluminacao.",
  too_small: "Rosto muito pequeno. Aproxime-se.",
  off_center: "Centralize o rosto no quadro."
};

export function FaceCaptureStep({ label, hint, onCaptured }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<string>("Iniciando camera...");
  const [valid, setValid] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let timer: number | null = null;

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 960 }, height: { ideal: 720 } },
          audio: false
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setStatus("Posicione o rosto");
        tick();
      } catch {
        setStatus("Câmera não disponível. Use upload de fotos.");
      }
    }

    async function tick() {
      if (cancelled) return;
      const v = videoRef.current;
      if (v && v.readyState >= 2) {
        const r = await extractEmbedding(v);
        if (cancelled) return;
        if (r.ok) {
          setStatus("Rosto detectado. Clique em Capturar.");
          setValid(true);
        } else {
          setStatus(errorMessages[r.error]);
          setValid(false);
        }
      }
      timer = window.setTimeout(tick, 250);
    }

    start();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  async function handleCapture() {
    if (!valid || busy) return;
    setBusy(true);
    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas) return;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(video, 0, 0);

      const r = await extractEmbedding(canvas);
      if (!r.ok) {
        setStatus(errorMessages[r.error]);
        return;
      }
      const fotoBase64 = canvas.toDataURL("image/jpeg", 0.9);
      onCaptured({ embedding: r.embedding, score: r.score, fotoBase64 });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-3 rounded-panel border border-line bg-surface p-4">
      <div>
        <p className="ds-kicker">{label}</p>
        <p className="text-sm text-muted">{hint}</p>
      </div>
      <div className="aspect-video overflow-hidden rounded-ui border border-line bg-ink">
        <video ref={videoRef} autoPlay muted playsInline className="h-full w-full object-cover" />
      </div>
      <canvas ref={canvasRef} className="hidden" />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className={`text-sm font-bold ${valid ? "text-moss" : "text-clay"}`}>{status}</span>
        <button
          className="ds-button ds-button-primary px-4 py-2 text-xs disabled:opacity-50"
          type="button"
          disabled={!valid || busy}
          onClick={handleCapture}
        >
          Capturar
        </button>
      </div>
    </div>
  );
}
