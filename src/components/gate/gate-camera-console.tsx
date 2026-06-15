"use client";

import { Camera, CameraOff } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/card";
import { registerGateEventAction } from "@/lib/actions/gate";

type Student = {
  id: string;
  matricula_codigo: string;
  nome: string;
};

type Device = {
  id: string;
  nome: string;
};

export function GateCameraConsole({ students, devices }: { students: Student[]; devices: Device[] }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  async function startCamera() {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setCameraActive(true);
    } catch {
      setCameraError("Não foi possível acessar a câmera neste navegador.");
      setCameraActive(false);
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraActive(false);
  }

  useEffect(() => {
    return () => stopCamera();
  }, []);

  return (
    <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
      <Panel className="grid gap-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-2xl text-ink">Camera da portaria</h2>
          <div className="flex gap-2">
            <Button type="button" onClick={startCamera} variant="accent">
              <Camera size={16} />
              Iniciar
            </Button>
            <Button type="button" onClick={stopCamera} variant="secondary">
              <CameraOff size={16} />
              Parar
            </Button>
          </div>
        </div>
        <div className="aspect-video overflow-hidden rounded-ui border border-line bg-ink">
          <video ref={videoRef} autoPlay muted playsInline className="h-full w-full object-cover" />
        </div>
        <div className="mt-3 flex items-center justify-between text-sm">
          <span className={cameraActive ? "font-bold text-moss" : "font-bold text-clay"}>
            {cameraActive ? "Camera ativa" : "Camera inativa"}
          </span>
          {cameraError ? <span className="text-clay">{cameraError}</span> : null}
        </div>
      </Panel>

      <Panel className="grid gap-4">
        <h2 className="font-display text-2xl text-ink">Identificacao simulada</h2>
        <form action={registerGateEventAction} className="grid gap-4">
          <label>
            Aluno reconhecido
            <select name="aluno_id" required>
              {students.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.matricula_codigo} - {student.nome}
                </option>
              ))}
            </select>
          </label>
          <label>
            Dispositivo
            <select name="dispositivo_id" defaultValue={devices[0]?.id ?? ""}>
              {devices.map((device) => (
                <option key={device.id} value={device.id}>
                  {device.nome}
                </option>
              ))}
            </select>
          </label>
          <input type="hidden" name="origem" value="facial_simulado" />
          <label>
            Confiança simulada
            <input name="confianca" defaultValue="98.5" inputMode="decimal" />
          </label>
          <label>
            Observação
            <input name="observacao" defaultValue="Registro feito pela tela de camera simulada" />
          </label>
          <div className="grid gap-2 sm:grid-cols-2">
            <Button name="tipo" value="entrada" variant="accent">
              Registrar entrada
            </Button>
            <Button name="tipo" value="saida" className="border-clay bg-clay text-white hover:bg-clay/90">
              Registrar saida
            </Button>
          </div>
        </form>
      </Panel>
    </div>
  );
}
