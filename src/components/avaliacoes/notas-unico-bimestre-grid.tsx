"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { Check, X, Loader2 } from "lucide-react";
import { salvarNotaBimestralAction } from "@/lib/actions/lancamento-notas";
import type { AlunoNotaBim } from "@/lib/data/notas-aula";

type Status = "idle" | "saving" | "saved" | "error";
type RowState = { valor: string; status: Status; error?: string };

export function NotasUnicoBimestreGrid({
  alunos,
  turmaId,
  disciplinaId,
  bimestre,
  anoLetivo,
  valorMaximo,
}: {
  alunos: AlunoNotaBim[];
  turmaId: string;
  disciplinaId: string;
  bimestre: number;
  anoLetivo: number;
  valorMaximo: number;
}) {
  const [rows, setRows] = useState<Map<string, RowState>>(() => {
    const m = new Map<string, RowState>();
    for (const a of alunos) {
      m.set(a.matriculaId, {
        valor: a.valor != null ? String(a.valor) : "",
        status: "idle",
      });
    }
    return m;
  });
  const initial = useRef<Map<string, string>>(
    new Map(alunos.map((a) => [a.matriculaId, a.valor != null ? String(a.valor) : ""])),
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

  async function persist(aluno: AlunoNotaBim) {
    const row = rows.get(aluno.matriculaId);
    if (!row) return;
    const raw = row.valor.trim();
    const prev = initial.current.get(aluno.matriculaId) ?? "";
    if (raw === prev) return;

    let valor: number | null;
    if (raw === "") {
      valor = null;
    } else {
      valor = Number(raw.replace(",", "."));
      if (!Number.isFinite(valor)) {
        setRow(aluno.matriculaId, { status: "error", error: "Inválido" });
        return;
      }
      if (valor < 0 || valor > valorMaximo) {
        setRow(aluno.matriculaId, { status: "error", error: `0–${valorMaximo}` });
        return;
      }
    }

    setRow(aluno.matriculaId, { status: "saving", error: undefined });
    startTransition(async () => {
      const res = await salvarNotaBimestralAction({
        turmaId,
        disciplinaId,
        bimestre,
        matriculaId: aluno.matriculaId,
        alunoId: aluno.alunoId,
        anoLetivo,
        valor,
      });
      if (res.ok) {
        initial.current.set(aluno.matriculaId, raw);
        setRow(aluno.matriculaId, { status: "saved", error: undefined });
      } else {
        setRow(aluno.matriculaId, { status: "error", error: res.error });
      }
    });
  }

  function StatusIcon({ status, error }: { status: Status; error?: string }) {
    if (status === "saving") return <Loader2 size={12} className="animate-spin text-ink/40" />;
    if (status === "saved") return <Check size={12} className="text-success" />;
    if (status === "error")
      return (
        <span title={error} className="text-[0.6rem] font-semibold text-danger">
          {error}
        </span>
      );
    return null;
  }

  if (alunos.length === 0) {
    return (
      <div className="rounded-ui bg-muted/30 p-6 text-center text-sm text-ink/60">
        Nenhum aluno matriculado nessa turma.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-panel border border-line">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr className="text-[0.66rem] uppercase tracking-kicker text-ink/60">
            <th className="px-3 py-2 text-left">Aluno</th>
            <th className="px-2 py-2 text-center w-40">{bimestre}º Bimestre (0 a {valorMaximo})</th>
          </tr>
        </thead>
        <tbody>
          {alunos.map((a, idx) => {
            const row = rows.get(a.matriculaId) ?? { valor: "", status: "idle" as Status };
            return (
              <tr key={a.matriculaId} className="border-t border-line">
                <td className="px-3 py-2 font-medium text-ink">{a.nome}</td>
                <td className="px-2 py-1 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <input
                      type="number"
                      step="0.01"
                      min={0}
                      max={valorMaximo}
                      value={row.valor}
                      tabIndex={idx + 1}
                      onChange={(e) => setRow(a.matriculaId, { valor: e.target.value })}
                      onBlur={() => persist(a)}
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
                      className="w-20 rounded-ui border border-line bg-surface px-2 py-1 text-center text-sm font-semibold"
                    />
                    <span className="w-12 inline-flex justify-start">
                      <StatusIcon status={row.status} error={row.error} />
                    </span>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
