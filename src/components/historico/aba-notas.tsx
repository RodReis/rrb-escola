"use client";

import { useEffect, useState } from "react";
import { salvarNotasAnoAction } from "@/lib/actions/historico";
import type { HistoricoData, HistoricoNota } from "@/lib/historico/tipos";

function linhaVazia(): HistoricoNota {
  return { disciplinaId: null, disciplinaNome: "", nota: null, cargaHoraria: null, faltas: null, ordem: 0 };
}

export function AbaNotas({ historico }: { historico: HistoricoData | null }) {
  const anos = historico?.anos ?? [];
  const [anoId, setAnoId] = useState(anos[0]?.id ?? "");
  const ano = anos.find((a) => a.id === anoId);

  const somenteLeitura = ano ? ano.origem === "interna" && !ano.congelado : false;

  // Cópia local editável das notas do ano selecionado — reinicializada sempre que o ano muda.
  const [notas, setNotas] = useState<HistoricoNota[]>(ano?.notas ?? []);
  useEffect(() => {
    setNotas(ano?.notas ?? []);
  }, [anoId, ano?.notas]);

  if (anos.length === 0) {
    return (
      <p className="rounded-lg border border-line p-6 text-sm text-muted">
        Cadastre um ano na aba “Escolas anteriores” antes de lançar notas.
      </p>
    );
  }

  function atualizarLinha(indice: number, campo: keyof HistoricoNota, valor: string) {
    setNotas((atual) =>
      atual.map((n, i) => {
        if (i !== indice) return n;
        if (campo === "disciplinaNome") return { ...n, disciplinaNome: valor };
        const numero = valor === "" ? null : Number(valor);
        return { ...n, [campo]: numero };
      })
    );
  }

  function removerLinha(indice: number) {
    setNotas((atual) => atual.filter((_, i) => i !== indice));
  }

  function adicionarLinha() {
    setNotas((atual) => [...atual, { ...linhaVazia(), ordem: atual.length }]);
  }

  return (
    <div className="space-y-4">
      <label className="flex max-w-sm flex-col gap-1 text-sm">
        Ano do histórico
        <select
          value={anoId}
          onChange={(e) => setAnoId(e.target.value)}
          className="rounded border border-line bg-surface p-2"
        >
          {anos.map((a) => (
            <option key={a.id} value={a.id}>{a.ano} — {a.serieNome}</option>
          ))}
        </select>
      </label>

      {somenteLeitura && (
        <p className="rounded border border-line bg-muted p-3 text-sm text-muted">
          Notas calculadas das avaliações da EPG. Congelam quando este ano receber um resultado final.
        </p>
      )}

      <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-sm">
        <thead className="bg-muted text-left">
          <tr>
            <th className="p-2">Disciplina</th>
            <th className="p-2">Nota</th>
            <th className="p-2">C.H.</th>
            <th className="p-2">Faltas</th>
            {!somenteLeitura && <th className="p-2" />}
          </tr>
        </thead>
        <tbody>
          {somenteLeitura
            ? (ano?.notas ?? []).map((n, i) => (
                <tr key={`${n.disciplinaNome}-${i}`} className="border-t border-line">
                  <td className="p-2">{n.disciplinaNome}</td>
                  <td className="p-2 text-muted">
                    {n.nota === null ? "—" : n.nota.toFixed(1).replace(".", ",")}
                  </td>
                  <td className="p-2">{n.cargaHoraria ?? "—"}</td>
                  <td className="p-2">{n.faltas ?? "—"}</td>
                </tr>
              ))
            : notas.map((n, i) => (
                <tr key={i} className="border-t border-line">
                  <td className="p-2">
                    <input
                      value={n.disciplinaNome}
                      onChange={(e) => atualizarLinha(i, "disciplinaNome", e.target.value)}
                      className="w-full rounded border border-line bg-surface p-1"
                    />
                  </td>
                  <td className="p-2">
                    <input
                      type="number"
                      step="0.1"
                      value={n.nota ?? ""}
                      onChange={(e) => atualizarLinha(i, "nota", e.target.value)}
                      className="w-20 rounded border border-line bg-surface p-1"
                    />
                  </td>
                  <td className="p-2">
                    <input
                      type="number"
                      value={n.cargaHoraria ?? ""}
                      onChange={(e) => atualizarLinha(i, "cargaHoraria", e.target.value)}
                      className="w-20 rounded border border-line bg-surface p-1"
                    />
                  </td>
                  <td className="p-2">
                    <input
                      type="number"
                      value={n.faltas ?? ""}
                      onChange={(e) => atualizarLinha(i, "faltas", e.target.value)}
                      className="w-20 rounded border border-line bg-surface p-1"
                    />
                  </td>
                  <td className="p-2 text-right">
                    <button
                      type="button"
                      onClick={() => removerLinha(i)}
                      className="text-sm text-clay"
                    >
                      Remover
                    </button>
                  </td>
                </tr>
              ))}
        </tbody>
      </table>
      </div>

      {!somenteLeitura && ano && (
        <div className="flex items-center gap-3">
          <button type="button" onClick={adicionarLinha} className="rounded border border-line px-3 py-2 text-sm">
            Adicionar disciplina
          </button>

          <form action={salvarNotasAnoAction}>
            <input type="hidden" name="historicoAnoId" value={ano.id} />
            <input type="hidden" name="notas" value={JSON.stringify(notas)} />
            <button type="submit" className="rounded bg-brand px-4 py-2 text-paper">
              Gravar notas
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
