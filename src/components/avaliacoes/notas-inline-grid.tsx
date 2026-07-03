"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { Check, X, Loader2 } from "lucide-react";
import { salvarNotaInlineAction } from "@/lib/actions/avaliacoes";

type Aluno = {
  matriculaId: string;
  alunoId: string;
  nome: string;
  valorAtual: number | null;
};

type Status = "idle" | "saving" | "saved" | "error";

type RowState = {
  valor: string;
  status: Status;
  error?: string;
};

export function NotasInlineGrid({
  avaliacaoId,
  valorMaximo,
  alunos,
}: {
  avaliacaoId: string;
  valorMaximo: number;
  alunos: Aluno[];
}) {
  const [rows, setRows] = useState<Map<string, RowState>>(() => {
    const m = new Map<string, RowState>();
    for (const a of alunos) {
      m.set(a.matriculaId, {
        valor: a.valorAtual != null ? String(a.valorAtual) : "",
        status: "idle",
      });
    }
    return m;
  });
  const initial = useRef<Map<string, string>>(
    new Map(alunos.map((a) => [a.matriculaId, a.valorAtual != null ? String(a.valorAtual) : ""])),
  );
  const [, startTransition] = useTransition();

  function setRow(matriculaId: string, patch: Partial<RowState>) {
    setRows((prev) => {
      const next = new Map(prev);
      const cur = next.get(matriculaId) ?? { valor: "", status: "idle" as Status };
      next.set(matriculaId, { ...cur, ...patch });
      return next;
    });
  }

  // Auto-limpa status "saved" após 2s
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    rows.forEach((row, id) => {
      if (row.status === "saved") {
        const t = setTimeout(() => setRow(id, { status: "idle" }), 2000);
        timers.push(t);
      }
    });
    return () => timers.forEach(clearTimeout);
  }, [rows]);

  async function persist(matriculaId: string, alunoId: string) {
    const row = rows.get(matriculaId);
    if (!row) return;
    const raw = row.valor.trim();
    const prev = initial.current.get(matriculaId) ?? "";
    if (raw === prev) return; // sem mudança

    let valor: number | null;
    if (raw === "") {
      valor = null;
    } else {
      valor = Number(raw.replace(",", "."));
      if (!Number.isFinite(valor)) {
        setRow(matriculaId, { status: "error", error: "Valor inválido" });
        return;
      }
      if (valor < 0 || valor > valorMaximo) {
        setRow(matriculaId, { status: "error", error: `Entre 0 e ${valorMaximo}` });
        return;
      }
    }

    setRow(matriculaId, { status: "saving", error: undefined });
    startTransition(async () => {
      const res = await salvarNotaInlineAction({ avaliacaoId, matriculaId, alunoId, valor });
      if (res.ok) {
        initial.current.set(matriculaId, raw);
        setRow(matriculaId, { status: "saved", error: undefined });
      } else {
        setRow(matriculaId, { status: "error", error: res.error });
      }
    });
  }

  function StatusIcon({ status, error }: { status: Status; error?: string }) {
    if (status === "saving") return <Loader2 size={14} className="animate-spin text-ink/40" />;
    if (status === "saved") return <Check size={14} className="text-success" />;
    if (status === "error")
      return (
        <span title={error} className="inline-flex items-center gap-1 text-danger">
          <X size={14} />
          <span className="text-[0.66rem] font-semibold">{error}</span>
        </span>
      );
    return null;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-[0.66rem] uppercase tracking-kicker text-ink/60">
            <th className="px-2 py-2 text-left">Aluno</th>
            <th className="px-2 py-2 text-right w-32">Nota (0 a {valorMaximo})</th>
            <th className="px-2 py-2 text-left w-40">&nbsp;</th>
          </tr>
        </thead>
        <tbody>
          {alunos.map((a, idx) => {
            const row = rows.get(a.matriculaId) ?? { valor: "", status: "idle" as Status };
            return (
              <tr key={a.matriculaId} className="border-t border-line">
                <td className="px-2 py-2 font-medium text-ink">{a.nome}</td>
                <td className="px-2 py-2 text-right">
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    max={valorMaximo}
                    value={row.valor}
                    tabIndex={idx + 1}
                    onChange={(e) => setRow(a.matriculaId, { valor: e.target.value })}
                    onBlur={() => persist(a.matriculaId, a.alunoId)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        (e.target as HTMLInputElement).blur();
                        const next = document.querySelector<HTMLInputElement>(
                          `[tabindex="${idx + 2}"]`,
                        );
                        next?.focus();
                      }
                    }}
                    placeholder="—"
                    className="w-24 rounded-ui border border-line bg-surface px-2 py-1 text-right text-sm font-semibold"
                  />
                </td>
                <td className="px-2 py-2">
                  <StatusIcon status={row.status} error={row.error} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
