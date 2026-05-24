"use client";

import { useMemo, useState, useTransition } from "react";
import { Layers, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createAtribuicoesLoteAction } from "@/lib/actions/disciplinas";
import type { DisciplinaRow } from "@/lib/data/pedagogico";

type ProfessorOpt = { id: string; nome: string };
type TurmaOpt = {
  id: string;
  nome: string;
  ano_letivo: number;
  serie_id: string;
  series?: { nome?: string } | null;
};

export function AtribuicaoLoteForm({
  professores,
  disciplinas,
  turmas,
}: {
  professores: ProfessorOpt[];
  disciplinas: DisciplinaRow[];
  turmas: TurmaOpt[];
}) {
  const [employeeId, setPerfilId] = useState("");
  const [disciplinaId, setDisciplinaId] = useState("");
  const [turmasSel, setTurmasSel] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();

  // Disciplina escolhida → série dela → turmas dessa série
  const disciplinaSel = disciplinas.find((d) => d.id === disciplinaId);
  const turmasDaSerie = useMemo(
    () =>
      disciplinaSel
        ? turmas
            .filter((t) => t.serie_id === disciplinaSel.serieId)
            .sort(
              (a, b) =>
                b.ano_letivo - a.ano_letivo ||
                a.nome.localeCompare(b.nome, "pt-BR"),
            )
        : [],
    [disciplinaSel, turmas],
  );

  function toggleTurma(id: string) {
    setTurmasSel((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (turmasSel.size === turmasDaSerie.length) {
      setTurmasSel(new Set());
    } else {
      setTurmasSel(new Set(turmasDaSerie.map((t) => t.id)));
    }
  }

  function reset() {
    setDisciplinaId("");
    setTurmasSel(new Set());
  }

  async function onSubmit() {
    if (!employeeId || !disciplinaId || turmasSel.size === 0) {
      toast.error("Selecione professor, disciplina e ao menos uma turma.");
      return;
    }
    startTransition(async () => {
      const res = await createAtribuicoesLoteAction({
        employeeId,
        disciplinaId,
        turmaIds: Array.from(turmasSel),
      });
      if (res.ok) {
        const partes: string[] = [];
        if (res.inseridos > 0)
          partes.push(`${res.inseridos} vinculaç${res.inseridos === 1 ? "ão" : "ões"} criada${res.inseridos === 1 ? "" : "s"}`);
        if (res.ignorados > 0)
          partes.push(`${res.ignorados} já existente${res.ignorados === 1 ? "" : "s"}`);
        toast.success(partes.join(" · ") || "Nenhuma alteração");
        reset();
      } else {
        toast.error(res.error);
      }
    });
  }

  const todasSelecionadas =
    turmasDaSerie.length > 0 && turmasSel.size === turmasDaSerie.length;

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-sm">
          Professor
          <select
            value={employeeId}
            onChange={(e) => setPerfilId(e.target.value)}
            className="mt-1 w-full"
          >
            <option value="">Selecione…</option>
            {professores.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm">
          Disciplina
          <select
            value={disciplinaId}
            onChange={(e) => {
              setDisciplinaId(e.target.value);
              setTurmasSel(new Set());
            }}
            disabled={!employeeId}
            className="mt-1 w-full"
          >
            <option value="">Selecione…</option>
            {disciplinas.map((d) => (
              <option key={d.id} value={d.id}>
                {d.serie} · {d.nome}
              </option>
            ))}
          </select>
        </label>
      </div>

      {disciplinaSel && (
        <div className="grid gap-3 rounded-ui border border-line bg-muted/30 p-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-ink/70">
              Turmas de <span className="text-brand">{disciplinaSel.serie}</span> ·{" "}
              {disciplinaSel.nome}
            </p>
            {turmasDaSerie.length > 0 && (
              <button
                type="button"
                onClick={toggleAll}
                className="text-[0.66rem] font-semibold text-brand hover:underline"
              >
                {todasSelecionadas ? "Limpar tudo" : "Marcar todas"}
              </button>
            )}
          </div>

          {turmasDaSerie.length === 0 ? (
            <p className="py-2 text-center text-xs text-ink/40">
              Esta disciplina não tem turmas associadas.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {turmasDaSerie.map((t) => {
                const ativo = turmasSel.has(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => toggleTurma(t.id)}
                    className={`flex items-center justify-between gap-2 rounded-ui border px-3 py-2 text-xs transition ${
                      ativo
                        ? "border-brand bg-brand/10 text-brand"
                        : "border-line bg-surface text-ink/70 hover:border-brand/40"
                    }`}
                  >
                    <span className="truncate font-semibold">
                      {t.nome} <span className="text-ink/40">({t.ano_letivo})</span>
                    </span>
                    {ativo && <Check size={12} />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-ink/55">
          {turmasSel.size > 0
            ? `${turmasSel.size} turma${turmasSel.size === 1 ? "" : "s"} selecionada${turmasSel.size === 1 ? "" : "s"}`
            : "Nenhuma turma selecionada"}
        </p>
        <button
          type="button"
          onClick={onSubmit}
          disabled={pending || !employeeId || !disciplinaId || turmasSel.size === 0}
          className="ds-button ds-button-primary"
        >
          {pending ? (
            <>
              <Loader2 size={14} className="animate-spin" /> Vinculando…
            </>
          ) : (
            <>
              <Layers size={14} /> Vincular em lote
            </>
          )}
        </button>
      </div>
    </div>
  );
}
