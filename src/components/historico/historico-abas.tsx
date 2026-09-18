"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AbaAluno } from "./aba-aluno";
import { AbaAnos } from "./aba-anos";
import { AbaNotas } from "./aba-notas";
import { AbaObservacao } from "./aba-observacao";
import type { HistoricoData, NivelEnsino } from "@/lib/historico/tipos";

type Props = {
  alunos: Array<{ id: string; nome: string }>;
  series: Array<{ id: string; nome: string }>;
  alunoId: string;
  nivel: NivelEnsino;
  historico: HistoricoData | null;
};

const ABAS = [
  { id: "aluno", rotulo: "Aluno selecionado" },
  { id: "anos", rotulo: "Escolas anteriores" },
  { id: "notas", rotulo: "Notas" },
  { id: "observacao", rotulo: "Observação" }
] as const;

const NIVEIS: Array<{ valor: NivelEnsino; rotulo: string }> = [
  { valor: "fund1", rotulo: "Fundamental I" },
  { valor: "fund2", rotulo: "Fundamental II" },
  { valor: "medio", rotulo: "Ensino Médio" }
];

export function HistoricoAbas({ alunos, series, alunoId, nivel, historico }: Props) {
  const router = useRouter();
  const [aba, setAba] = useState<(typeof ABAS)[number]["id"]>("aluno");

  function navegar(novoAluno: string, novoNivel: string) {
    if (!novoAluno) return;
    router.push(`/historico/notas?aluno=${novoAluno}&nivel=${novoNivel}`);
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          Aluno
          <select
            value={alunoId}
            onChange={(e) => navegar(e.target.value, nivel)}
            className="rounded border border-line bg-surface p-2"
          >
            <option value="">Selecione um aluno</option>
            {alunos.map((a) => (
              <option key={a.id} value={a.id}>{a.nome}</option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Tipo de ensino
          <select
            value={nivel}
            onChange={(e) => navegar(alunoId, e.target.value)}
            className="rounded border border-line bg-surface p-2"
          >
            {NIVEIS.map((n) => (
              <option key={n.valor} value={n.valor}>{n.rotulo}</option>
            ))}
          </select>
        </label>
      </div>

      {!alunoId ? (
        <p className="rounded-lg border border-line p-6 text-center text-sm text-muted">
          Selecione um aluno para carregar o histórico.
        </p>
      ) : (
        <>
          <nav className="flex flex-wrap gap-2">
            {ABAS.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => setAba(a.id)}
                className={
                  aba === a.id
                    ? "rounded bg-brand px-4 py-2 text-sm text-paper"
                    : "rounded border border-line px-4 py-2 text-sm"
                }
              >
                {a.rotulo}
              </button>
            ))}
          </nav>

          {aba === "aluno" && <AbaAluno historico={historico} />}
          {aba === "anos" && (
            <AbaAnos alunoId={alunoId} nivel={nivel} series={series} historico={historico} />
          )}
          {aba === "notas" && <AbaNotas historico={historico} />}
          {aba === "observacao" && (
            <AbaObservacao alunoId={alunoId} nivel={nivel} historico={historico} />
          )}
        </>
      )}
    </div>
  );
}
