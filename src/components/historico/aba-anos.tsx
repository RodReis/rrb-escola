"use client";

import { useState } from "react";
import { removerAnoHistoricoAction, salvarAnoHistoricoAction } from "@/lib/actions/historico";
import type { HistoricoData, NivelEnsino } from "@/lib/historico/tipos";

type Props = {
  alunoId: string;
  nivel: NivelEnsino;
  series: Array<{ id: string; nome: string }>;
  historico: HistoricoData | null;
  anosMatriculados: Array<{ ano: number; serieId: string; serieNome: string }>;
};

const RESULTADOS = [
  { valor: "aprovado", rotulo: "Aprovado" },
  { valor: "reprovado", rotulo: "Reprovado" },
  { valor: "cursando", rotulo: "Cursando" },
  { valor: "transferido", rotulo: "Transferido" }
];

export function AbaAnos({ alunoId, nivel, series, historico, anosMatriculados }: Props) {
  const anos = historico?.anos ?? [];

  const jaNoHistorico = new Set(anos.map((a) => `${a.ano}-${a.serieId}`));
  const anosDisponiveis = anosMatriculados.filter((m) => !jaNoHistorico.has(`${m.ano}-${m.serieId}`));
  const [anoInternoSelecionado, setAnoInternoSelecionado] = useState<
    { ano: number; serieId: string; serieNome: string } | null
  >(anosDisponiveis[0] ?? null);

  return (
    <div className="space-y-4">
      {anosDisponiveis.length > 0 && (
        <form
          action={salvarAnoHistoricoAction}
          className="grid gap-4 rounded-lg border border-line bg-muted p-4 md:grid-cols-3"
        >
          <input type="hidden" name="alunoId" value={alunoId} />
          <input type="hidden" name="nivel" value={nivel} />
          <input type="hidden" name="origem" value="interna" />
          <input type="hidden" name="resultado" value="cursando" />
          <input type="hidden" name="ano" value={anoInternoSelecionado?.ano ?? ""} />
          <input type="hidden" name="serieId" value={anoInternoSelecionado?.serieId ?? ""} />
          <input type="hidden" name="serieNome" value={anoInternoSelecionado?.serieNome ?? ""} />

          <label className="flex flex-col gap-1 text-sm md:col-span-2">
            Ano cursado na escola
            <select
              value={anoInternoSelecionado ? `${anoInternoSelecionado.ano}-${anoInternoSelecionado.serieId}` : ""}
              onChange={(e) => {
                const encontrado = anosDisponiveis.find(
                  (m) => `${m.ano}-${m.serieId}` === e.target.value
                );
                setAnoInternoSelecionado(encontrado ?? null);
              }}
              required
              className="rounded border border-line bg-surface p-2"
            >
              {anosDisponiveis.map((m) => (
                <option key={`${m.ano}-${m.serieId}`} value={`${m.ano}-${m.serieId}`}>
                  {m.ano} — {m.serieNome}
                </option>
              ))}
            </select>
          </label>

          <button type="submit" className="self-end rounded bg-brand px-4 py-2 text-paper">
            Adicionar ano interno (EPG)
          </button>
        </form>
      )}

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
                <td className="p-2">
                  {a.origem === "interna" && !a.congelado ? (
                    <form action={salvarAnoHistoricoAction}>
                      <input type="hidden" name="alunoId" value={alunoId} />
                      <input type="hidden" name="nivel" value={nivel} />
                      <input type="hidden" name="origem" value="interna" />
                      <input type="hidden" name="ano" value={a.ano} />
                      <input type="hidden" name="serieId" value={a.serieId ?? ""} />
                      <input type="hidden" name="serieNome" value={a.serieNome} />
                      <select
                        name="resultado"
                        defaultValue={a.resultado}
                        onChange={(e) => e.currentTarget.form?.requestSubmit()}
                        className="rounded border border-line bg-surface p-1 text-sm"
                      >
                        {RESULTADOS.map((r) => (
                          <option key={r.valor} value={r.valor}>{r.rotulo}</option>
                        ))}
                      </select>
                    </form>
                  ) : (
                    a.resultado
                  )}
                </td>
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
