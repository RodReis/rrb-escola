"use client";

import { useState } from "react";
import { salvarNotasAnoAction } from "@/lib/actions/historico";
import type { HistoricoData } from "@/lib/historico/tipos";

export function AbaNotas({ historico }: { historico: HistoricoData | null }) {
  const anos = historico?.anos ?? [];
  const [anoId, setAnoId] = useState(anos[0]?.id ?? "");
  const ano = anos.find((a) => a.id === anoId);

  if (anos.length === 0) {
    return (
      <p className="rounded-lg border border-border p-6 text-sm text-muted-foreground">
        Cadastre um ano na aba “Escolas anteriores” antes de lançar notas.
      </p>
    );
  }

  const somenteLeitura = ano ? ano.origem === "interna" && !ano.congelado : false;

  return (
    <div className="space-y-4">
      <label className="flex max-w-sm flex-col gap-1 text-sm">
        Ano do histórico
        <select
          value={anoId}
          onChange={(e) => setAnoId(e.target.value)}
          className="rounded border border-border bg-background p-2"
        >
          {anos.map((a) => (
            <option key={a.id} value={a.id}>{a.ano} — {a.serieNome}</option>
          ))}
        </select>
      </label>

      {somenteLeitura && (
        <p className="rounded border border-border bg-muted p-3 text-sm text-muted-foreground">
          Notas calculadas das avaliações da EPG. Congelam quando este ano receber um resultado final.
        </p>
      )}

      <table className="w-full text-sm">
        <thead className="bg-muted text-left">
          <tr>
            <th className="p-2">Disciplina</th>
            <th className="p-2">Nota</th>
            <th className="p-2">C.H.</th>
            <th className="p-2">Faltas</th>
          </tr>
        </thead>
        <tbody>
          {(ano?.notas ?? []).map((n, i) => (
            <tr key={`${n.disciplinaNome}-${i}`} className="border-t border-border">
              <td className="p-2">{n.disciplinaNome}</td>
              <td className={somenteLeitura ? "p-2 text-muted-foreground" : "p-2"}>
                {n.nota === null ? "—" : n.nota.toFixed(1).replace(".", ",")}
              </td>
              <td className="p-2">{n.cargaHoraria ?? "—"}</td>
              <td className="p-2">{n.faltas ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {!somenteLeitura && ano && (
        <form action={salvarNotasAnoAction} className="space-y-2">
          <input type="hidden" name="historicoAnoId" value={ano.id} />
          <input type="hidden" name="notas" value={JSON.stringify(ano.notas)} />
          <button type="submit" className="rounded bg-primary px-4 py-2 text-primary-foreground">
            Gravar notas
          </button>
        </form>
      )}
    </div>
  );
}
