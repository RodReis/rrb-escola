"use client";

import { useState } from "react";
import { MessageCircle, Send, ChevronDown, ChevronRight } from "lucide-react";
import type { TemplateWpp } from "@/lib/actions/pipeline";
import { enviarWhatsappCardAction } from "@/lib/actions/pipeline";

type Atividade = {
  id: string;
  tipo: string;
  descricao: string;
  created_at: string;
};

type Props = {
  cardId: string;
  templates: TemplateWpp[];
  atividades: Atividade[];
  onUpdated: () => void;
};

export function WhatsappSection({ cardId, templates, atividades, onUpdated }: Props) {
  const [templateId, setTemplateId] = useState<string>("");
  const [variaveis, setVariaveis] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [showHistorico, setShowHistorico] = useState(false);

  const template = templates.find((t) => t.id === templateId) ?? null;

  function handleTemplateChange(id: string) {
    setTemplateId(id);
    setErro(null);
    const t = templates.find((x) => x.id === id);
    if (t) {
      setVariaveis(Array.from({ length: t.variaveis_count }, () => ""));
    } else {
      setVariaveis([]);
    }
  }

  async function handleEnviar() {
    if (!templateId) return;
    setSending(true);
    setErro(null);
    const result = await enviarWhatsappCardAction(cardId, templateId, variaveis);
    setSending(false);
    if (!result.ok) {
      setErro(result.error);
      return;
    }
    setTemplateId("");
    setVariaveis([]);
    onUpdated();
  }

  const historico = atividades.filter((a) => a.tipo === "whatsapp");

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <MessageCircle size={15} style={{ color: "rgb(var(--color-success-600))" }} />
        <span className="text-sm font-medium" style={{ color: "rgb(var(--color-ink))" }}>
          WhatsApp
        </span>
      </div>

      <div className="space-y-2">
        <select
          value={templateId}
          onChange={(e) => handleTemplateChange(e.target.value)}
          className="w-full rounded-md border px-3 py-1.5 text-sm"
          style={{
            borderColor: "rgb(var(--color-line))",
            background: "rgb(var(--color-surface))",
            color: "rgb(var(--color-ink))",
          }}
        >
          <option value="">Escolha um template…</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.descricao}
            </option>
          ))}
        </select>

        {template && template.variaveis_count > 0 && (
          <div className="space-y-1.5 rounded-md border p-3"
            style={{ borderColor: "rgb(var(--color-line))", background: "rgb(var(--color-surface-raised))" }}>
            {Array.from({ length: template.variaveis_count }, (_, i) => (
              <div key={i} className="space-y-0.5">
                <label className="text-xs" style={{ color: "rgb(var(--color-text-muted))" }}>
                  {`Variável {{${i + 1}}}`}
                </label>
                <input
                  type="text"
                  value={variaveis[i] ?? ""}
                  onChange={(e) => {
                    const next = [...variaveis];
                    next[i] = e.target.value;
                    setVariaveis(next);
                  }}
                  className="w-full rounded border px-2 py-1 text-sm"
                  style={{
                    borderColor: "rgb(var(--color-line))",
                    background: "rgb(var(--color-surface))",
                    color: "rgb(var(--color-ink))",
                  }}
                />
              </div>
            ))}
          </div>
        )}

        {erro && (
          <p className="text-xs" style={{ color: "rgb(var(--color-danger-600))" }}>
            {erro}
          </p>
        )}

        {templateId && (
          <button
            onClick={handleEnviar}
            disabled={sending}
            className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium disabled:opacity-50"
            style={{
              background: "rgb(var(--color-success-600))",
              color: "#fff",
            }}
          >
            <Send size={13} />
            {sending ? "Enviando…" : "Enviar WhatsApp"}
          </button>
        )}
      </div>

      {historico.length > 0 && (
        <div>
          <button
            className="flex items-center gap-1 text-xs mb-1"
            style={{ color: "rgb(var(--color-text-muted))" }}
            onClick={() => setShowHistorico((v) => !v)}
          >
            {showHistorico ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            Enviados ({historico.length})
          </button>
          {showHistorico && (
            <ul className="space-y-1">
              {historico.map((a) => (
                <li
                  key={a.id}
                  className="text-xs rounded px-2 py-1"
                  style={{ background: "rgb(var(--color-surface-raised))", color: "rgb(var(--color-text-muted))" }}
                >
                  <span>📱 {a.descricao}</span>
                  <span className="ml-2">
                    {new Date(a.created_at).toLocaleDateString("pt-BR")}{" "}
                    {new Date(a.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
