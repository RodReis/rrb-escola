"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { Check, X, Loader2 } from "lucide-react";
import { salvarNotaBimestralAction } from "@/lib/actions/lancamento-notas";
import type { AlunoGridRow } from "@/lib/data/lancamento-notas";

type Status = "idle" | "saving" | "saved" | "error";
type CellState = { valor: string; status: Status; error?: string };

const BIMESTRES = [1, 2, 3, 4] as const;

function cellKey(matriculaId: string, bim: number) {
  return `${matriculaId}|${bim}`;
}

function calcMedia(notas: { 1: number | null; 2: number | null; 3: number | null; 4: number | null }) {
  const presentes = [notas[1], notas[2], notas[3], notas[4]].filter(
    (v): v is number => v != null,
  );
  if (presentes.length === 0) return null;
  return Math.round((presentes.reduce((s, v) => s + v, 0) / presentes.length) * 100) / 100;
}

export function NotasBimestraisGrid({
  alunos,
  turmaId,
  disciplinaId,
  anoLetivo,
  valorMaximo,
}: {
  alunos: AlunoGridRow[];
  turmaId: string;
  disciplinaId: string;
  anoLetivo: number;
  valorMaximo: number;
}) {
  const [cells, setCells] = useState<Map<string, CellState>>(() => {
    const m = new Map<string, CellState>();
    for (const a of alunos) {
      for (const b of BIMESTRES) {
        const v = a.notas[b];
        m.set(cellKey(a.matriculaId, b), {
          valor: v != null ? String(v) : "",
          status: "idle",
        });
      }
    }
    return m;
  });
  const initial = useRef<Map<string, string>>(
    new Map(
      alunos.flatMap((a) =>
        BIMESTRES.map<[string, string]>((b) => [
          cellKey(a.matriculaId, b),
          a.notas[b] != null ? String(a.notas[b]) : "",
        ]),
      ),
    ),
  );
  const [, startTransition] = useTransition();

  function setCell(key: string, patch: Partial<CellState>) {
    setCells((prev) => {
      const next = new Map(prev);
      const cur = next.get(key) ?? { valor: "", status: "idle" as Status };
      next.set(key, { ...cur, ...patch });
      return next;
    });
  }

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    cells.forEach((row, key) => {
      if (row.status === "saved") {
        const t = setTimeout(() => setCell(key, { status: "idle" }), 2000);
        timers.push(t);
      }
    });
    return () => timers.forEach(clearTimeout);
  }, [cells]);

  async function persist(aluno: AlunoGridRow, bim: number) {
    const key = cellKey(aluno.matriculaId, bim);
    const cell = cells.get(key);
    if (!cell) return;
    const raw = cell.valor.trim();
    const prev = initial.current.get(key) ?? "";
    if (raw === prev) return;

    let valor: number | null;
    if (raw === "") {
      valor = null;
    } else {
      valor = Number(raw.replace(",", "."));
      if (!Number.isFinite(valor)) {
        setCell(key, { status: "error", error: "Inválido" });
        return;
      }
      if (valor < 0 || valor > valorMaximo) {
        setCell(key, { status: "error", error: `0–${valorMaximo}` });
        return;
      }
    }

    setCell(key, { status: "saving", error: undefined });
    startTransition(async () => {
      const res = await salvarNotaBimestralAction({
        turmaId,
        disciplinaId,
        bimestre: bim,
        matriculaId: aluno.matriculaId,
        alunoId: aluno.alunoId,
        anoLetivo,
        valor,
      });
      if (res.ok) {
        initial.current.set(key, raw);
        setCell(key, { status: "saved", error: undefined });
      } else {
        setCell(key, { status: "error", error: res.error });
      }
    });
  }

  function StatusIcon({ status, error }: { status: Status; error?: string }) {
    if (status === "saving") return <Loader2 size={11} className="animate-spin text-ink/40" />;
    if (status === "saved") return <Check size={11} className="text-success" />;
    if (status === "error")
      return (
        <span title={error} className="text-[0.6rem] font-semibold text-danger">
          {error}
        </span>
      );
    return null;
  }

  // Recalcula média local a partir do estado atual
  function mediaAtual(aluno: AlunoGridRow): number | null {
    const notas = {
      1: parseNota(cells.get(cellKey(aluno.matriculaId, 1))?.valor),
      2: parseNota(cells.get(cellKey(aluno.matriculaId, 2))?.valor),
      3: parseNota(cells.get(cellKey(aluno.matriculaId, 3))?.valor),
      4: parseNota(cells.get(cellKey(aluno.matriculaId, 4))?.valor),
    };
    return calcMedia(notas);
  }

  return (
    <div className="overflow-x-auto rounded-panel border border-line">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr className="text-[0.66rem] uppercase tracking-kicker text-ink/60">
            <th className="px-3 py-2 text-left">Aluno</th>
            {BIMESTRES.map((b) => (
              <th key={b} className="px-2 py-2 text-center w-24">
                {b}º Bim
              </th>
            ))}
            <th className="px-3 py-2 text-right w-20">Média</th>
          </tr>
        </thead>
        <tbody>
          {alunos.map((a, rowIdx) => {
            const media = mediaAtual(a);
            return (
              <tr key={a.matriculaId} className="border-t border-line">
                <td className="px-3 py-2 font-medium text-ink">{a.nome}</td>
                {BIMESTRES.map((b, colIdx) => {
                  const key = cellKey(a.matriculaId, b);
                  const cell = cells.get(key) ?? { valor: "", status: "idle" as Status };
                  const tab = rowIdx + 1 + colIdx * alunos.length;
                  return (
                    <td key={b} className="px-1 py-1 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <input
                          type="number"
                          step="0.01"
                          min={0}
                          max={valorMaximo}
                          value={cell.valor}
                          tabIndex={tab}
                          onChange={(e) => setCell(key, { valor: e.target.value })}
                          onBlur={() => persist(a, b)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              (e.target as HTMLInputElement).blur();
                              // próximo aluno mesmo bimestre
                              const next = document.querySelector<HTMLInputElement>(
                                `[tabindex="${tab + 1}"]`,
                              );
                              next?.focus();
                            }
                          }}
                          placeholder="—"
                          className="w-16 rounded-ui border border-line bg-surface px-1 py-1 text-center text-sm font-semibold"
                        />
                        <span className="w-4 inline-flex justify-center">
                          <StatusIcon status={cell.status} error={cell.error} />
                        </span>
                      </div>
                    </td>
                  );
                })}
                <td className="px-3 py-2 text-right">
                  {media != null ? (
                    <span
                      className={`inline-block min-w-[2.5rem] rounded-pill px-2 py-0.5 text-xs font-bold ${
                        media >= 6
                          ? "bg-success/15 text-success"
                          : media >= 4
                            ? "bg-warning/15 text-warning"
                            : "bg-danger/15 text-danger"
                      }`}
                    >
                      {media.toFixed(1)}
                    </span>
                  ) : (
                    <span className="text-ink/40 text-xs">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {alunos.length === 0 && (
        <div className="py-8 text-center text-sm text-ink/60">
          Nenhum aluno matriculado nessa turma.
        </div>
      )}
    </div>
  );
}

function parseNota(raw: string | undefined): number | null {
  if (!raw || raw.trim() === "") return null;
  const v = Number(raw.replace(",", "."));
  return Number.isFinite(v) ? v : null;
}
