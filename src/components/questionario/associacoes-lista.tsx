"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { DataTableShell } from "@/components/ui/data-table";
import { SearchInline } from "@/components/ui/search-inline";
import { StatusPill } from "@/components/ui/status-pill";
import { BotaoAtivar } from "@/components/questionario/botao-ativar";
import { alternarAtivoAssociacaoAction } from "@/lib/actions/questionario-associacoes";
import { anoPadrao, rotuloTurma, unicos } from "@/lib/questionario/associacoes";
import { normalizarBusca } from "@/lib/questionario/lista";
import type { AssociacaoRow } from "@/lib/questionario/tipos";

type Props = {
  associacoes: AssociacaoRow[];
  podeEditar: boolean;
  onEditar: (associacao: AssociacaoRow) => void;
};

const SELECT_FILTRO = "min-w-[9rem]";

export function AssociacoesLista({ associacoes, podeEditar, onEditar }: Props) {
  const anos = unicos(associacoes.map((a) => a.anoLetivo)).sort((a, b) => b - a);
  const [ano, setAno] = useState(String(anoPadrao(anos, new Date().getFullYear()) ?? ""));
  const [etapa, setEtapa] = useState("");
  const [serie, setSerie] = useState("");
  const [turma, setTurma] = useState("");
  const [questionario, setQuestionario] = useState("");
  const [professor, setProfessor] = useState("");
  const [busca, setBusca] = useState("");

  const opcoes = (extrair: (a: AssociacaoRow) => [string, string]) =>
    associacoes
      .map(extrair)
      .filter(([id], i, todos) => todos.findIndex(([x]) => x === id) === i)
      .sort((a, b) => a[1].localeCompare(b[1]));
  const series = opcoes((a) => [a.serieId, a.serieNome]);
  const turmasOpt = opcoes((a) => [a.turmaId, `${a.serieNome} · ${rotuloTurma(a.turmaNome, a.turno)}`]);
  const questionarios = opcoes((a) => [a.questionarioId, a.questionarioDescricao]);
  const professores = opcoes((a) => [a.professorId, a.professorNome]);

  const termo = normalizarBusca(busca);
  const visiveis = associacoes.filter(
    (a) =>
      (!ano || String(a.anoLetivo) === ano) &&
      (!etapa || String(a.etapa) === etapa) &&
      (!serie || a.serieId === serie) &&
      (!turma || a.turmaId === turma) &&
      (!questionario || a.questionarioId === questionario) &&
      (!professor || a.professorId === professor) &&
      normalizarBusca(`${a.questionarioDescricao} ${a.serieNome} ${a.turmaNome} ${a.professorNome}`).includes(termo),
  );

  const filtro = (rotulo: string, valor: string, set: (v: string) => void, itens: Array<[string, string]>) => (
    <div className="grid gap-1">
      <label className="text-xs font-medium text-ink/70">
        {rotulo}
        <select className={`mt-1 block ${SELECT_FILTRO}`} value={valor} onChange={(e) => set(e.target.value)}>
          <option value="">Todos</option>
          {itens.map(([id, nome]) => (
            <option key={id} value={id}>{nome}</option>
          ))}
        </select>
      </label>
    </div>
  );

  return (
    <DataTableShell
      toolbar={
        <div className="flex w-full flex-wrap items-end gap-3">
          {filtro("Ano", ano, setAno, anos.map((a): [string, string] => [String(a), String(a)]))}
          {filtro("Etapa", etapa, setEtapa, [1, 2, 3, 4].map((n): [string, string] => [String(n), `${n}ª`]))}
          {filtro("Série", serie, setSerie, series)}
          {filtro("Turma", turma, setTurma, turmasOpt)}
          {filtro("Questionário", questionario, setQuestionario, questionarios)}
          {filtro("Professor", professor, setProfessor, professores)}
          <SearchInline value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Pesquisar" />
        </div>
      }
    >
      <table className="ds-dt min-w-[960px]">
        <thead>
          <tr>
            <th className="w-[80px]">Ano</th>
            <th className="w-[80px]">Etapa</th>
            <th>Questionário</th>
            <th>Série</th>
            <th>Turma</th>
            <th>Professor</th>
            <th className="w-[110px]">Situação</th>
            <th className="w-[110px] text-right">Ação</th>
          </tr>
        </thead>
        <tbody>
          {visiveis.length === 0 ? (
            <tr>
              <td colSpan={8} className="px-5 py-10 text-center text-sm text-ink/60">
                Nenhuma associação encontrada.
              </td>
            </tr>
          ) : null}
          {visiveis.map((a) => (
            <tr key={a.id}>
              <td className="pl-4 text-ink">{a.anoLetivo}</td>
              <td className="text-ink">{a.etapa}ª</td>
              <td className="text-ink">{a.questionarioDescricao}</td>
              <td className="text-ink/80">{a.serieNome}</td>
              <td className="text-ink/80">{rotuloTurma(a.turmaNome, a.turno)}</td>
              <td className="text-ink/80">{a.professorNome}</td>
              <td>
                <StatusPill tone={a.ativo ? "success" : "neutral"}>{a.ativo ? "Ativa" : "Inativa"}</StatusPill>
              </td>
              <td className="pr-4">
                {podeEditar ? (
                  <div className="flex items-center justify-end gap-1">
                    <button
                      type="button"
                      aria-label={`Editar associação de ${a.professorNome} (${a.etapa}ª etapa)`}
                      onClick={() => onEditar(a)}
                      className="rounded-ui p-1.5 text-brand hover:bg-brand/10"
                    >
                      <Pencil size={16} />
                    </button>
                    <BotaoAtivar
                      acao={alternarAtivoAssociacaoAction}
                      id={a.id}
                      ativo={a.ativo}
                      nome={`${a.questionarioDescricao} — ${a.serieNome} ${rotuloTurma(a.turmaNome, a.turno)}, ${a.etapa}ª etapa`}
                    />
                  </div>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </DataTableShell>
  );
}
