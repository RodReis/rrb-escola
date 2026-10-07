"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import {
  atualizarAssociacaoAction,
  criarAssociacoesAction,
} from "@/lib/actions/questionario-associacoes";
import type { ProfessorOption } from "@/lib/data/pedagogico";
import { useAction } from "@/lib/hooks/use-action";
import { anoPadrao, rotuloTurma, unicos } from "@/lib/questionario/associacoes";
import type { AssociacaoRow, QuestionarioRow, TurmaOpcao } from "@/lib/questionario/tipos";

type Props = {
  questionarios: QuestionarioRow[];
  turmas: TurmaOpcao[];
  professores: ProfessorOption[];
  edicao: AssociacaoRow | null;
  onConcluir: () => void;
};

const ROTULO = "text-sm font-medium text-ink/80";
const ETAPAS = [1, 2, 3, 4];

export function AssociacoesForm({ questionarios, turmas, professores, edicao, onConcluir }: Props) {
  const anos = unicos(turmas.map((t) => t.anoLetivo)).sort((a, b) => b - a);
  const [ano, setAno] = useState<number>(edicao?.anoLetivo ?? anoPadrao(anos, new Date().getFullYear()) ?? 0);
  const [serieId, setSerieId] = useState(edicao?.serieId ?? "");
  const [etapas, setEtapas] = useState<number[]>([]);
  const [turmasMarcadas, setTurmasMarcadas] = useState<string[]>([]);

  const salvar = useAction(
    (fd: FormData) => (fd.get("id") ? atualizarAssociacaoAction(fd) : criarAssociacoesAction(fd)),
    {
      onSuccess: () => {
        setEtapas([]);
        setTurmasMarcadas([]);
        onConcluir();
      },
    },
  );

  const series = turmas
    .filter((t) => t.anoLetivo === ano)
    .reduce<TurmaOpcao[]>((acc, t) => (acc.some((s) => s.serieId === t.serieId) ? acc : [...acc, t]), [])
    .sort((a, b) => a.serieOrdem - b.serieOrdem);
  const visiveis = turmas.filter(
    (t) =>
      t.anoLetivo === ano &&
      (!serieId || t.serieId === serieId) &&
      (t.ativo || t.id === edicao?.turmaId),
  );
  const todasMarcadas = visiveis.length > 0 && visiveis.every((t) => turmasMarcadas.indexOf(t.id) >= 0);
  const questionariosDisponiveis = questionarios.filter((q) => q.ativo || q.id === edicao?.questionarioId);
  const professorAtualFora = edicao && !professores.some((p) => p.id === edicao.professorId);

  function alternar<T>(lista: T[], valor: T): T[] {
    return lista.indexOf(valor) >= 0 ? lista.filter((x) => x !== valor) : [...lista, valor];
  }

  function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    salvar.run(new FormData(e.currentTarget));
  }

  return (
    <form onSubmit={enviar} className="grid gap-4">
      {edicao ? <input type="hidden" name="id" value={edicao.id} /> : null}

      <div className="grid gap-4 md:grid-cols-4">
        <div className="grid gap-1">
          <label htmlFor="assoc-ano" className={ROTULO}>Ano</label>
          <select
            id="assoc-ano"
            value={ano}
            onChange={(e) => {
              setAno(Number(e.target.value));
              setSerieId("");
              setTurmasMarcadas([]);
            }}
          >
            {anos.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>
        <div className="grid gap-1">
          <label htmlFor="assoc-serie" className={ROTULO}>Série</label>
          <select
            id="assoc-serie"
            value={serieId}
            onChange={(e) => {
              setSerieId(e.target.value);
              setTurmasMarcadas([]);
            }}
          >
            <option value="">Todas</option>
            {series.map((s) => (
              <option key={s.serieId} value={s.serieId}>{s.serieNome}</option>
            ))}
          </select>
        </div>
        <div className="grid gap-1 md:col-span-2">
          <label htmlFor="assoc-questionario" className={ROTULO}>Questionário</label>
          <select id="assoc-questionario" name="questionarioId" required defaultValue={edicao?.questionarioId ?? ""}>
            <option value="" disabled>Selecione</option>
            {questionariosDisponiveis.map((q) => (
              <option key={q.id} value={q.id}>{q.descricao}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-1">
        <label htmlFor="assoc-professor" className={ROTULO}>Professor</label>
        <select id="assoc-professor" name="professorId" required defaultValue={edicao?.professorId ?? ""}>
          <option value="" disabled>Selecione</option>
          {professorAtualFora ? <option value={edicao.professorId}>{edicao.professorNome}</option> : null}
          {professores.map((p) => (
            <option key={p.id} value={p.id}>{p.nome}</option>
          ))}
        </select>
      </div>

      {edicao ? (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="grid gap-1">
            <label htmlFor="assoc-etapa" className={ROTULO}>Etapa</label>
            <select id="assoc-etapa" name="etapa" required defaultValue={String(edicao.etapa)}>
              {ETAPAS.map((n) => (
                <option key={n} value={n}>{n}ª</option>
              ))}
            </select>
          </div>
          <div className="grid gap-1">
            <label htmlFor="assoc-turma" className={ROTULO}>Turma</label>
            <select id="assoc-turma" name="turmaId" required defaultValue={edicao.turmaId}>
              {visiveis.map((t) => (
                <option key={t.id} value={t.id}>{rotuloTurma(t.nome, t.turno)}</option>
              ))}
            </select>
          </div>
        </div>
      ) : (
        <>
          <fieldset className="flex flex-wrap gap-4">
            <legend className={`${ROTULO} mb-1`}>Etapas</legend>
            {ETAPAS.map((n) => (
              <label key={n} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="etapas"
                  value={n}
                  checked={etapas.indexOf(n) >= 0}
                  onChange={() => setEtapas(alternar(etapas, n))}
                  className="h-4 w-auto"
                  aria-label={`${n}ª etapa`}
                />
                {n}ª
              </label>
            ))}
          </fieldset>

          <fieldset className="grid gap-2">
            <legend className={`${ROTULO} mb-1`}>Turmas</legend>
            {visiveis.length === 0 ? (
              <p className="text-sm text-ink/60">Nenhuma turma ativa neste ano e série.</p>
            ) : (
              <>
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={todasMarcadas}
                    onChange={() => setTurmasMarcadas(todasMarcadas ? [] : visiveis.map((t) => t.id))}
                    className="h-4 w-auto"
                    aria-label="Todas as turmas"
                  />
                  Todas
                </label>
                <div className="flex flex-wrap gap-x-6 gap-y-2">
                  {visiveis.map((t) => (
                    <label key={t.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        name="turmaIds"
                        value={t.id}
                        checked={turmasMarcadas.indexOf(t.id) >= 0}
                        onChange={() => setTurmasMarcadas(alternar(turmasMarcadas, t.id))}
                        className="h-4 w-auto"
                        aria-label={rotuloTurma(t.nome, t.turno)}
                      />
                      {t.serieNome} · {rotuloTurma(t.nome, t.turno)}
                    </label>
                  ))}
                </div>
              </>
            )}
          </fieldset>
        </>
      )}

      <div className="flex gap-3">
        <Button type="submit" variant="primary" loading={salvar.pending}>
          {edicao ? "Salvar" : "Cadastrar"}
        </Button>
        {edicao ? (
          <Button type="button" variant="secondary" onClick={onConcluir}>
            Cancelar
          </Button>
        ) : null}
      </div>
    </form>
  );
}
