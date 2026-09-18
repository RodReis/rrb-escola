"use client";

import { removerAssociacaoAction } from "@/lib/actions/historico";
import type { NivelEnsinoRow } from "@/lib/data/historico";

const NIVEL_ROTULO: Record<string, string> = {
  infantil: "Educação Infantil",
  fund1: "Fundamental I",
  fund2: "Fundamental II",
  medio: "Ensino Médio"
};

export function AssociacoesTabela({ associacoes }: { associacoes: NivelEnsinoRow[] }) {
  if (associacoes.length === 0) {
    return (
      <p className="rounded-lg border border-border p-6 text-center text-sm text-muted-foreground">
        Não há nada para mostrar aqui
      </p>
    );
  }

  return (
    <table className="w-full text-sm">
      <thead className="bg-muted text-left">
        <tr>
          <th className="p-2">Série</th>
          <th className="p-2">Empresa</th>
          <th className="p-2">Nível</th>
          <th className="p-2">Período</th>
          <th className="p-2" />
        </tr>
      </thead>
      <tbody>
        {associacoes.map((a) => (
          <tr key={a.id} className="border-t border-border">
            <td className="p-2">{a.serieNome}</td>
            <td className="p-2">{a.credenciamentoNome}</td>
            <td className="p-2">{NIVEL_ROTULO[a.nivel] ?? a.nivel}</td>
            <td className="p-2">{a.anoInicio} – {a.anoFim}</td>
            <td className="p-2 text-right">
              <form action={removerAssociacaoAction}>
                <input type="hidden" name="id" value={a.id} />
                <button type="submit" className="text-sm text-destructive">Remover</button>
              </form>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
