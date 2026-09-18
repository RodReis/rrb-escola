"use client";

import { removerAnoHistoricoAction, salvarAnoHistoricoAction } from "@/lib/actions/historico";
import type { HistoricoData, NivelEnsino } from "@/lib/historico/tipos";

type Props = {
  alunoId: string;
  nivel: NivelEnsino;
  series: Array<{ id: string; nome: string }>;
  historico: HistoricoData | null;
};

const RESULTADOS = [
  { valor: "aprovado", rotulo: "Aprovado" },
  { valor: "reprovado", rotulo: "Reprovado" },
  { valor: "cursando", rotulo: "Cursando" },
  { valor: "transferido", rotulo: "Transferido" }
];

export function AbaAnos({ alunoId, nivel, series, historico }: Props) {
  const anos = historico?.anos ?? [];

  return (
    <div className="space-y-4">
      <form action={salvarAnoHistoricoAction} className="grid gap-4 rounded-lg border border-line p-4 md:grid-cols-4">
        <input type="hidden" name="alunoId" value={alunoId} />
        <input type="hidden" name="nivel" value={nivel} />
        <input type="hidden" name="origem" value="externa" />

        <label className="flex flex-col gap-1 text-sm">
          Ano
          <input type="number" name="ano" required className="rounded border border-line bg-surface p-2" />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Série
          <select name="serieNome" required className="rounded border border-line bg-surface p-2">
            {series.map((s) => (
              <option key={s.id} value={s.nome}>{s.nome}</option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Resultado
          <select name="resultado" className="rounded border border-line bg-surface p-2">
            {RESULTADOS.map((r) => (
              <option key={r.valor} value={r.valor}>{r.rotulo}</option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Média de aprovação
          <input type="number" step="0.01" name="mediaAprovacao" className="rounded border border-line bg-surface p-2" />
        </label>

        <label className="flex flex-col gap-1 text-sm md:col-span-2">
          Instituição
          <input name="instituicao" className="rounded border border-line bg-surface p-2" />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Cidade
          <input name="cidade" className="rounded border border-line bg-surface p-2" />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          UF
          <input name="uf" maxLength={2} className="rounded border border-line bg-surface p-2" />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          C.H. por série
          <input type="number" name="cargaHoraria" className="rounded border border-line bg-surface p-2" />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Faltas por série
          <input type="number" name="faltas" className="rounded border border-line bg-surface p-2" />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Dias letivos
          <input type="number" name="diasLetivos" className="rounded border border-line bg-surface p-2" />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          % Frequência
          <input type="number" step="0.01" name="percentualFrequencia" className="rounded border border-line bg-surface p-2" />
        </label>

        <button type="submit" className="md:col-span-4 rounded bg-brand px-4 py-2 text-paper">
          Adicionar
        </button>
      </form>

      {anos.length === 0 ? (
        <p className="rounded-lg border border-line p-6 text-center text-sm text-muted">
          Não há nada para mostrar aqui
        </p>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-muted text-left">
            <tr>
              <th className="p-2">Ano</th>
              <th className="p-2">Série</th>
              <th className="p-2">Origem</th>
              <th className="p-2">Instituição</th>
              <th className="p-2">Resultado</th>
              <th className="p-2">Dias letivos</th>
              <th className="p-2">C.H.</th>
              <th className="p-2" />
            </tr>
          </thead>
          <tbody>
            {anos.map((a) => (
              <tr key={a.id} className="border-t border-line">
                <td className="p-2">{a.ano}</td>
                <td className="p-2">{a.serieNome}</td>
                <td className="p-2">{a.origem === "interna" ? "EPG" : "Externa"}</td>
                <td className="p-2">{a.instituicao ?? "—"}</td>
                <td className="p-2">{a.resultado}</td>
                <td className="p-2">{a.diasLetivos ?? "—"}</td>
                <td className="p-2">{a.cargaHoraria ?? "—"}</td>
                <td className="p-2 text-right">
                  <form action={removerAnoHistoricoAction}>
                    <input type="hidden" name="id" value={a.id} />
                    <button type="submit" className="text-sm text-clay">Remover</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
