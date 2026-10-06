"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { StatusPill } from "@/components/ui/status-pill";
import {
  atualizarQuestionarioAction,
  criarQuestionarioAction,
} from "@/lib/actions/questionario-questionarios";
import { useAction } from "@/lib/hooks/use-action";
import { moverItem } from "@/lib/questionario/lista";
import type { EscalaRow, GrupoRow, QuestaoLinha, QuestionarioDetalhe } from "@/lib/questionario/tipos";
import { questoesParaAdicionar, type VinculoInput } from "@/lib/questionario/vinculos";
import { QUESTAO_TIPO_LABEL } from "@/lib/validation/questionario";

type Props = {
  grupos: GrupoRow[];
  questoes: QuestaoLinha[];
  escalas: EscalaRow[];
  questionario?: QuestionarioDetalhe;
};

const ROTULO = "text-sm font-medium text-ink/80";
const BOTAO_ICONE = "rounded-ui p-1.5 text-ink/70 hover:bg-muted disabled:opacity-30 disabled:hover:bg-transparent";

export function QuestionarioForm({ grupos, questoes, escalas, questionario }: Props) {
  const [ativo, setAtivo] = useState(questionario?.ativo ?? true);
  const [linhas, setLinhas] = useState<VinculoInput[]>(
    questionario?.vinculos.map((v) => ({ id: v.id, questaoId: v.questaoId, escalaId: v.escalaId })) ?? [],
  );
  const [filtroGrupo, setFiltroGrupo] = useState("");
  const [filtroQuestao, setFiltroQuestao] = useState("");

  const salvar = useAction(
    (fd: FormData) => (questionario ? atualizarQuestionarioAction(fd) : criarQuestionarioAction(fd)),
    {},
  );

  const questaoPorId = new Map(questoes.map((q) => [q.id, q] as const));
  const ativas = questoes.filter((q) => q.ativa);
  const opcoesQuestao = ativas.filter((q) => !filtroGrupo || q.grupoId === filtroGrupo);
  const jaAdicionadas = new Set(linhas.map((l) => l.questaoId));
  const gruposAtivos = grupos.filter((g) => g.ativo);

  /** Escala padrão da questão, só se ela ainda estiver ativa. */
  function escalaPadrao(questaoId: string): string | null {
    const padrao = questaoPorId.get(questaoId)?.escalaId ?? null;
    return padrao && escalas.some((e) => e.id === padrao && e.ativo) ? padrao : null;
  }

  function adicionar() {
    const novos = questoesParaAdicionar(ativas, jaAdicionadas, filtroGrupo || null, filtroQuestao || null);
    if (novos.length === 0) return;
    setLinhas([...linhas, ...novos.map((questaoId) => ({ questaoId, escalaId: escalaPadrao(questaoId) }))]);
    setFiltroQuestao("");
  }

  function definirEscala(indice: number, escalaId: string) {
    setLinhas(linhas.map((l, i) => (i === indice ? { ...l, escalaId: escalaId || null } : l)));
  }

  function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("vinculos", JSON.stringify(linhas));
    salvar.run(fd);
  }

  return (
    <form onSubmit={enviar}>
      <Panel className="grid gap-5">
        {questionario ? <input type="hidden" name="id" value={questionario.id} /> : null}
        <input type="hidden" name="ativo" value={ativo ? "on" : ""} />

        <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
          <div className="grid gap-1">
            <label htmlFor="questionario-descricao" className={ROTULO}>Descrição *</label>
            <input id="questionario-descricao" name="descricao" required defaultValue={questionario?.descricao ?? ""} />
          </div>
          <Switch checked={ativo} onChange={setAtivo} label="Ativo" />
        </div>

        <div className="grid gap-1">
          <label htmlFor="questionario-obs" className={ROTULO}>Observações</label>
          <textarea id="questionario-obs" name="observacoes" rows={2} defaultValue={questionario?.observacoes ?? ""} />
        </div>

        <fieldset className="grid gap-4 border-t border-line pt-5">
          <legend className="pr-2 text-sm font-semibold text-brand">Questões adicionadas</legend>

          <div className="grid gap-3 md:grid-cols-[1fr_2fr_auto] md:items-end">
            <div className="grid gap-1">
              <label htmlFor="filtro-grupo" className={ROTULO}>Grupo</label>
              <select
                id="filtro-grupo"
                value={filtroGrupo}
                onChange={(e) => {
                  setFiltroGrupo(e.target.value);
                  setFiltroQuestao("");
                }}
              >
                <option value="">Todos</option>
                {gruposAtivos.map((g) => (
                  <option key={g.id} value={g.id}>{g.descricao}</option>
                ))}
              </select>
            </div>
            <div className="grid gap-1">
              <label htmlFor="filtro-questao" className={ROTULO}>Questão</label>
              <select id="filtro-questao" value={filtroQuestao} onChange={(e) => setFiltroQuestao(e.target.value)}>
                <option value="">Todos</option>
                {opcoesQuestao.map((q) => (
                  <option key={q.id} value={q.id} disabled={jaAdicionadas.has(q.id)}>{q.pergunta}</option>
                ))}
              </select>
            </div>
            <Button type="button" variant="secondary" onClick={adicionar}>
              <Plus size={14} /> Adicionar
            </Button>
          </div>

          <div className="overflow-x-auto rounded-panel border border-line">
            <table className="ds-dt min-w-[820px]">
              <thead>
                <tr>
                  <th>Grupo</th>
                  <th>Tipo</th>
                  <th>Questão</th>
                  <th className="w-[220px]">Escala</th>
                  <th className="w-[130px] text-right">Ação</th>
                </tr>
              </thead>
              <tbody>
                {linhas.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-8 text-center text-sm text-ink/60">
                      Não há nada para mostrar aqui
                    </td>
                  </tr>
                ) : null}
                {linhas.map((linha, i) => {
                  const q = questaoPorId.get(linha.questaoId);
                  if (!q) return null;
                  return (
                    <tr key={linha.questaoId} data-testid="linha-vinculo">
                      <td className="pl-4 text-ink/80">{q.grupoDescricao}</td>
                      <td className="text-ink/80">{QUESTAO_TIPO_LABEL[q.tipo]}</td>
                      <td className="text-ink">
                        <span data-testid="pergunta">{q.pergunta}</span>
                        {!q.ativa ? <StatusPill tone="neutral" className="ml-2">Inativa</StatusPill> : null}
                      </td>
                      <td>
                        {q.tipo === "objetiva_escala" ? (
                          <select
                            aria-label={`Escala de ${q.pergunta}`}
                            value={linha.escalaId ?? ""}
                            onChange={(e) => definirEscala(i, e.target.value)}
                          >
                            <option value="">Selecione</option>
                            {escalas
                              .filter((e) => e.ativo || e.id === linha.escalaId)
                              .map((e) => (
                                <option key={e.id} value={e.id}>{e.descricao}</option>
                              ))}
                          </select>
                        ) : (
                          <span className="text-ink/40">—</span>
                        )}
                      </td>
                      <td className="pr-4">
                        <div className="flex items-center justify-end">
                          <button type="button" className={BOTAO_ICONE} disabled={i === 0}
                            aria-label={`Subir ${q.pergunta}`}
                            onClick={() => setLinhas(moverItem(linhas, i, i - 1))}>
                            <ArrowUp size={14} />
                          </button>
                          <button type="button" className={BOTAO_ICONE} disabled={i === linhas.length - 1}
                            aria-label={`Descer ${q.pergunta}`}
                            onClick={() => setLinhas(moverItem(linhas, i, i + 1))}>
                            <ArrowDown size={14} />
                          </button>
                          <button type="button" className={BOTAO_ICONE}
                            aria-label={`Remover ${q.pergunta}`}
                            onClick={() => setLinhas(linhas.filter((_, j) => j !== i))}>
                            <X size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </fieldset>

        <div className="flex justify-end gap-3">
          <Link href="/questionario/questionarios" className="ds-button ds-button-secondary">Cancelar</Link>
          <Button type="submit" variant="primary" loading={salvar.pending}>Gravar</Button>
        </div>
      </Panel>
    </form>
  );
}
