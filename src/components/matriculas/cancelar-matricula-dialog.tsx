"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cancelarMatriculaAction } from "@/lib/actions/cancelamento";
import { MOTIVOS_CANCELAMENTO, MOTIVO_CANCELAMENTO_LABEL, type MotivoCancelamento } from "@/lib/validation/cancelamento";
import { useConfirm } from "@/components/ui/confirm-dialog";
import type { CobrancaParaCancelamento } from "@/lib/data/cancelamento";

type Props = {
  matriculaId: string;
  alunoId: string;
  alunoNome: string;
  serieNome: string;
  turmaNome: string;
  anoLetivo: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
};

export function CancelarMatriculaDialog({
  matriculaId,
  alunoId,
  alunoNome,
  serieNome,
  turmaNome,
  anoLetivo,
  open,
  onOpenChange,
  onSuccess,
}: Props) {
  const confirm = useConfirm();
  const [data, setData] = useState(() => new Date().toISOString().slice(0, 10));
  const [motivo, setMotivo] = useState<MotivoCancelamento>("transferencia");
  const [obs, setObs] = useState("");
  const [cienteCoordenacao, setCienteCoordenacao] = useState(false);
  const [cienteDiretoria, setCienteDiretoria] = useState(false);
  const [isaacConfirmado, setIsaacConfirmado] = useState(false);
  const [cobrancas, setCobrancas] = useState<CobrancaParaCancelamento[]>([]);
  const [cobrancaIdsSelecionadas, setCobrancaIdsSelecionadas] = useState<Set<string>>(new Set());
  const temCobrancaIsaac = cobrancas.some((cobranca) => cobranca.origem === "isaac");
  const [submitting, setSubmitting] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);

  // Recarrega a lista de cobrancas toda vez que o dialogo abre ou a data muda -
  // a pre-selecao depende da data de cancelamento escolhida. O endpoint
  // (/api/cancelamento/cobrancas) e infraestrutura leve criada em task futura;
  // aqui tratamos falha/ausencia como lista vazia (best-effort, nao bloqueia o form).
  useEffect(() => {
    if (!open) return;
    let cancelado = false;
    fetch(`/api/cancelamento/cobrancas?aluno_id=${alunoId}&data=${data}`)
      .then((r) => r.json())
      .then((rows: CobrancaParaCancelamento[]) => {
        if (cancelado) return;
        setCobrancas(rows);
        setCobrancaIdsSelecionadas(new Set(rows.filter((r) => r.preSelecionada).map((r) => r.id)));
      })
      .catch(() => {
        if (cancelado) return;
        setCobrancas([]);
      });
    return () => {
      cancelado = true;
    };
  }, [open, alunoId, data]);

  if (!open || typeof window === "undefined") return null;

  const obsObrigatoria = motivo === "outro";
  const podeConfirmar = cienteCoordenacao && cienteDiretoria && (!obsObrigatoria || obs.trim().length > 0);

  function toggleCobranca(id: string) {
    setCobrancaIdsSelecionadas((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleConfirmar() {
    const ok = await confirm({
      title: "Cancelar matrícula",
      message: `Confirma o cancelamento da matrícula de "${alunoNome}"? Esta ação inativa o aluno.`,
      confirmLabel: "Cancelar matrícula",
      variant: "danger",
    });
    if (!ok) return;

    setSubmitting(true);
    setErro(null);
    const fd = new FormData();
    fd.set("matriculaId", matriculaId);
    fd.set("alunoId", alunoId);
    fd.set("data", data);
    fd.set("motivo", motivo);
    fd.set("obs", obs);
    if (cienteCoordenacao) fd.set("cienteCoordenacao", "on");
    if (cienteDiretoria) fd.set("cienteDiretoria", "on");
    if (temCobrancaIsaac) fd.set("isaacCanceladoConfirmado", isaacConfirmado ? "on" : "");
    Array.from(cobrancaIdsSelecionadas).forEach((id) => fd.append("cobrancaIds", id));

    const result = await cancelarMatriculaAction(fd);
    setSubmitting(false);
    if (!result.ok) {
      setErro(result.error ?? "Erro ao cancelar matrícula.");
      return;
    }
    setSucesso(true);
  }

  function handleFechar() {
    onOpenChange(false);
    onSuccess();
  }

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink/30 backdrop-blur-[2px]" onClick={() => onOpenChange(false)} />
      <div role="dialog" aria-modal="true" className="relative w-full max-w-lg rounded-[10px] border border-line bg-surface p-6 shadow-lift">
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-md text-ink/40 hover:bg-muted hover:text-ink"
          aria-label="Fechar"
        >
          <X size={14} />
        </button>

        <p className="text-sm font-semibold text-ink">Cancelar matrícula</p>
        <p className="mt-1 text-sm text-ink/70">
          {alunoNome} — {serieNome} {turmaNome} — {anoLetivo}
        </p>

        {sucesso ? (
          <div className="mt-4 grid gap-3">
            <p className="text-sm text-ink">Matrícula cancelada com sucesso.</p>
            <a
              href={`/declaracoes/emitir?aluno=${alunoId}`}
              className="ds-button ds-button-primary text-xs w-fit"
            >
              Emitir Declaração de Transferência — Não Concluído
            </a>
            <button type="button" onClick={handleFechar} className="ds-button ds-button-secondary text-xs w-fit">
              Fechar
            </button>
          </div>
        ) : (
          <>
            <div className="mt-4 grid gap-3">
              <label className="grid gap-1 text-sm">
                Data do cancelamento
                <input
                  type="date"
                  value={data}
                  onChange={(e) => setData(e.target.value)}
                  className="ds-input"
                />
              </label>

              <label className="grid gap-1 text-sm">
                Motivo
                <select value={motivo} onChange={(e) => setMotivo(e.target.value as MotivoCancelamento)} className="ds-input">
                  {MOTIVOS_CANCELAMENTO.map((m) => (
                    <option key={m} value={m}>{MOTIVO_CANCELAMENTO_LABEL[m]}</option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1 text-sm">
                Observação {obsObrigatoria ? "(obrigatória)" : "(opcional)"}
                <textarea value={obs} onChange={(e) => setObs(e.target.value)} className="ds-input" rows={2} />
              </label>

              {cobrancas.length > 0 ? (
                <div className="grid gap-1 text-sm">
                  <p className="font-medium text-ink">Cobranças em aberto</p>
                  {cobrancas.map((c) => (
                    <label key={c.id} className="flex items-center gap-2 rounded-md border border-line px-2 py-1.5">
                      <input
                        type="checkbox"
                        checked={cobrancaIdsSelecionadas.has(c.id)}
                        onChange={() => toggleCobranca(c.id)}
                      />
                      <span className="flex-1">{c.descricao} — {c.competencia} — R$ {c.valorFinal.toFixed(2)}</span>
                      {c.origem === "isaac" ? <span className="ds-badge">isaac</span> : null}
                    </label>
                  ))}
                </div>
              ) : null}

              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={cienteCoordenacao} onChange={(e) => setCienteCoordenacao(e.target.checked)} />
                A coordenação está ciente desse cancelamento de matrícula?
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={cienteDiretoria} onChange={(e) => setCienteDiretoria(e.target.checked)} />
                A diretoria está ciente desse cancelamento de matrícula?
              </label>

              {temCobrancaIsaac ? (
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={isaacConfirmado} onChange={(e) => setIsaacConfirmado(e.target.checked)} />
                  Cancelada também no isaac?
                </label>
              ) : null}

              {erro ? <p className="text-sm text-danger">{erro}</p> : null}
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => onOpenChange(false)} className="ds-button ds-button-secondary text-xs">
                Cancelar
              </button>
              <button
                type="button"
                disabled={!podeConfirmar || submitting}
                onClick={handleConfirmar}
                className="ds-button text-xs bg-danger text-white hover:bg-danger/90 disabled:opacity-40"
              >
                Confirmar
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
