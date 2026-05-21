"use client";

import { useState } from "react";
import { Save, Send } from "lucide-react";
import { Panel } from "@/components/ui/card";
import {
  salvarConfigLembretesAction,
  enviarLembretesAgoraAction,
} from "@/lib/actions/lembretes";

export function ConfigLembretesForm({
  autoAtivo,
  pendentes,
}: {
  autoAtivo: boolean;
  pendentes: number;
}) {
  const [salvando, setSalvando] = useState(false);
  const [enviando, setEnviando] = useState(false);

  return (
    <div className="grid gap-6">
      <Panel className="grid gap-4">
        <h2 className="font-bold text-ink">Configuração dos lembretes</h2>
        <form
          action={salvarConfigLembretesAction}
          onSubmit={() => setSalvando(true)}
          className="grid gap-4"
        >
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="auto_ativo"
              defaultChecked={autoAtivo}
              className="h-4 w-4"
            />
            Enviar lembretes automaticamente (uma vez por dia)
          </label>

          <p className="rounded-ui bg-muted/40 p-3 text-xs text-ink/60">
            O texto do lembrete é um modelo aprovado pelo WhatsApp e não é editável aqui.
            Para alterá-lo, é necessário aprovar um novo modelo na conta WhatsApp Business.
          </p>

          <div className="flex justify-end">
            <button className="ds-button ds-button-primary" disabled={salvando}>
              <Save size={14} /> {salvando ? "Salvando…" : "Salvar configuração"}
            </button>
          </div>
        </form>
      </Panel>

      <Panel className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-ink">
            {pendentes} cobrança(s) vencida(s) sem lembrete
          </p>
          <p className="text-xs text-ink/55">
            Envio manual ignora a configuração automática.
          </p>
        </div>
        <form action={enviarLembretesAgoraAction} onSubmit={() => setEnviando(true)}>
          <button
            className="ds-button ds-button-accent"
            disabled={enviando || pendentes === 0}
          >
            <Send size={14} /> {enviando ? "Enviando…" : "Enviar lembretes agora"}
          </button>
        </form>
      </Panel>
    </div>
  );
}
