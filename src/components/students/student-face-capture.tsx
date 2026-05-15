"use client";

/* eslint-disable @next/next/no-img-element */

import { useRouter } from "next/navigation";
import { Camera, CameraOff, ScanFace, Upload } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { deactivateStudentFaceReferenceAction, uploadStudentFaceReferenceAction } from "@/lib/actions/gate";

type Biometric = {
  id: string;
  modelo: string;
  ativo: boolean;
  data_cadastro: string;
  data_revogacao: string | null;
  observacao: string | null;
  foto_url: string | null;
};

export function StudentFaceCapture({ alunoId, biometrics }: { alunoId: string; biometrics: Biometric[] }) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function startCamera() {
    setMessage(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 960 }, height: { ideal: 720 } },
        audio: false
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setCameraActive(true);
    } catch {
      setMessage("Nao foi possivel acessar a camera.");
      setCameraActive(false);
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraActive(false);
  }

  async function captureReference() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.videoWidth === 0) {
      setMessage("Inicie a camera antes de capturar.");
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
    if (!blob) {
      setMessage("Nao foi possivel gerar a imagem.");
      return;
    }

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(blob));

    const formData = new FormData();
    formData.append("aluno_id", alunoId);
    formData.append("modelo", "captura-web-v1");
    formData.append("observacao", "Referencia facial capturada pela camera do navegador.");
    formData.append("foto_referencia", new File([blob], "referencia-facial.jpg", { type: "image/jpeg" }));

    startTransition(async () => {
      try {
        await uploadStudentFaceReferenceAction(formData);
        setMessage("Referencia facial cadastrada.");
        router.refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Falha ao cadastrar a referencia facial.");
      }
    });
  }

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
      <div className="rounded-panel border border-line bg-surface p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-ink">Captura facial</h3>
          <div className="flex gap-2">
            <Button type="button" onClick={startCamera} variant="accent" className="px-3 py-2 text-xs">
              <Camera size={15} />
              Iniciar
            </Button>
            <Button type="button" onClick={stopCamera} variant="secondary" className="px-3 py-2 text-xs">
              <CameraOff size={15} />
              Parar
            </Button>
          </div>
        </div>

        <div className="aspect-video overflow-hidden rounded-ui border border-line bg-ink">
          <video ref={videoRef} autoPlay muted playsInline className="h-full w-full object-cover" />
        </div>
        <canvas ref={canvasRef} className="hidden" />

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <span className={cameraActive ? "text-sm font-bold text-moss" : "text-sm font-bold text-clay"}>
            {cameraActive ? "Camera ativa" : "Camera inativa"}
          </span>
          <Button
            type="button"
            onClick={captureReference}
            disabled={isPending}
            variant="primary"
            className="px-4 py-2 text-xs disabled:opacity-50"
          >
            <ScanFace size={15} />
            Capturar referencia
          </Button>
        </div>

        {previewUrl ? (
          <div className="mt-3">
            <p className="ds-kicker mb-2">Ultima captura</p>
            <img src={previewUrl} alt="Previa da referencia facial" className="h-[180px] w-[240px] rounded-ui border border-line object-cover" />
          </div>
        ) : null}

        {message ? <p className="mt-3 text-sm font-bold text-clay">{message}</p> : null}
      </div>

      <div className="rounded-panel border border-line bg-surface p-4">
        <h3 className="mb-3 text-sm font-bold text-ink">Referencias cadastradas</h3>
        <form action={uploadStudentFaceReferenceAction} className="mb-4 grid gap-3">
          <input type="hidden" name="aluno_id" value={alunoId} />
          <input type="hidden" name="modelo" value="arquivo-web-v1" />
          <label>
            Enviar foto manualmente
            <input name="foto_referencia" type="file" accept="image/jpeg,image/png,image/webp" />
          </label>
          <label>
            Observacao
            <input name="observacao" placeholder="Ex.: referencia autorizada pelo responsavel" />
          </label>
          <Button className="w-fit px-4 py-2 text-xs" variant="secondary">
            <Upload size={15} />
            Enviar arquivo
          </Button>
        </form>

        <div className="grid gap-2">
          {biometrics.length === 0 ? <p className="text-sm text-muted">Nenhuma referencia facial cadastrada.</p> : null}
          {biometrics.map((item) => (
            <div key={item.id} className="grid gap-3 border-b border-line py-3 text-sm last:border-b-0 sm:grid-cols-[72px_1fr_auto]">
              <div className="h-[72px] w-[72px] overflow-hidden rounded-ui border border-line bg-paper">
                {item.foto_url ? <img src={item.foto_url} alt="Referencia facial" className="h-full w-full object-cover" /> : null}
              </div>
              <div>
                <strong>{item.modelo}</strong>
                <span className="block text-muted">{new Date(item.data_cadastro).toLocaleString("pt-BR")}</span>
                <span className={item.ativo ? "font-bold text-moss" : "font-bold text-clay"}>{item.ativo ? "Ativa" : "Inativa"}</span>
                {item.observacao ? <p className="mt-1 text-muted">{item.observacao}</p> : null}
              </div>
              {item.ativo ? (
                <form action={deactivateStudentFaceReferenceAction}>
                  <input type="hidden" name="aluno_id" value={alunoId} />
                  <input type="hidden" name="biometria_id" value={item.id} />
                  <Button className="px-3 py-2 text-xs text-clay" variant="secondary">Desativar</Button>
                </form>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
