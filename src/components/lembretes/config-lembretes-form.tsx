"use client";

import { useState } from "react";
import { Save, Send } from "lucide-react";
import { Panel } from "@/components/ui/card";
import {
  salvarConfigLembretesAction,
  enviarLembretesAgoraAction,
} from "@/lib/actions/lembretes";

type LembretePendente = {
  cobrancaId: string;
  alunoNome: string;
  responsavelNome: string;
  descricao: string;
  valor: number;
  vencimento: string;
  diasAtraso: number;
};

function moeda(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function dataBR(iso: string): string {
  return iso.split("-").reverse().join("/");
}

export function ConfigLembretesForm({
  autoAtivo,
  pendentes,
}: {
  autoAtivo: boolean;
  pendentes: LembretePendente[];
}) {
  const [salvando, setSalvando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setSelecionados((prev) => {
      const novo = new Set(prev);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }

  const idsSelecionados = Array.from(selecionados);

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

      <Panel className="grid gap-3">
        <div>
          <h2 className="font-bold text-ink">
            Cobranças vencidas sem lembrete ({pendentes.length})
          </h2>
          <p className="text-xs text-ink/60">
            Marque as cobranças e use "Enviar selecionados", ou envie todas de uma vez.
          </p>
        </div>

        {pendentes.length === 0 ? (
          <p className="py-6 text-center text-sm text-ink/60">
            Nenhuma cobrança vencida sem lembrete.
          </p>
        ) : (
          <>
            <div className="grid gap-1.5">
              {pendentes.map((p) => (
                <label
                  key={p.cobrancaId}
                  className="flex items-center gap-3 rounded-ui border border-line p-2.5 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={selecionados.has(p.cobrancaId)}
                    onChange={() => toggle(p.cobrancaId)}
                    className="h-4 w-4 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-ink">{p.alunoNome}</p>
                    <p className="text-xs text-ink/60">
                      Resp.: {p.responsavelNome} · {p.descricao}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-bold text-ink">{moeda(p.valor)}</p>
                    <p className="text-xs text-danger">
                      Venceu {dataBR(p.vencimento)} · {p.diasAtraso} dia(s)
                    </p>
                  </div>
                </label>
              ))}
            </div>

            <div className="flex flex-wrap justify-end gap-2">
              <form
                action={enviarLembretesAgoraAction}
                onSubmit={() => setEnviando(true)}
              >
                <input
                  type="hidden"
                  name="cobranca_ids"
                  value={JSON.stringify(idsSelecionados)}
                />
                <button
                  className="ds-button ds-button-secondary"
                  disabled={enviando || idsSelecionados.length === 0}
                >
                  <Send size={14} /> Enviar selecionados ({idsSelecionados.length})
                </button>
              </form>

              <form
                action={enviarLembretesAgoraAction}
                onSubmit={() => setEnviando(true)}
              >
                <input type="hidden" name="cobranca_ids" value="[]" />
                <button
                  className="ds-button ds-button-accent"
                  disabled={enviando}
                >
                  <Send size={14} /> {enviando ? "Enviando…" : "Enviar todos"}
                </button>
              </form>
            </div>
          </>
        )}
      </Panel>
    </div>
  );
}
