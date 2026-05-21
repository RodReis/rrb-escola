"use client";

import { useState } from "react";
import { Save, Send } from "lucide-react";
import { Panel } from "@/components/ui/card";
import {
  salvarConfigLembretesAction,
  enviarLembretesAgoraAction,
} from "@/lib/actions/lembretes";

const PLACEHOLDERS = [
  "{responsavel}",
  "{aluno}",
  "{descricao}",
  "{valor}",
  "{vencimento}",
  "{dias_atraso}",
];

export function ConfigLembretesForm({
  autoAtivo,
  template,
  pendentes,
}: {
  autoAtivo: boolean;
  template: string;
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

          <label className="grid gap-1 text-sm">
            Mensagem do lembrete
            <textarea
              name="template"
              required
              rows={5}
              defaultValue={template}
              maxLength={2000}
            />
          </label>

          <div className="rounded-ui bg-muted/40 p-3 text-xs text-ink/60">
            <span className="font-semibold text-ink/75">Placeholders disponíveis:</span>{" "}
            {PLACEHOLDERS.join("  ")}
          </div>

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
