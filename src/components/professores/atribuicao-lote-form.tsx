"use client";

import { useMemo, useState, useTransition } from "react";
import { Layers, Check, Loader2, BookOpen, UserCog } from "lucide-react";
import { toast } from "sonner";
import {
  createAtribuicoesLoteAction,
  createAtribuicoesRegenteAction,
} from "@/lib/actions/disciplinas";
import type { DisciplinaRow } from "@/lib/data/pedagogico";

type ProfessorOpt = { id: string; nome: string; schoolCategory: "fund1" | "fund2" | "medio" };
type TurmaOpt = {
  id: string;
  nome: string;
  ano_letivo: number;
  serie_id: string;
  series?: { nome?: string } | null;
};

type Modo = "disciplina" | "regente";

export function AtribuicaoLoteForm({
  professores,
  disciplinas,
  turmas,
}: {
  professores: ProfessorOpt[];
  disciplinas: DisciplinaRow[];
  turmas: TurmaOpt[];
}) {
  const [modo, setModo] = useState<Modo>("disciplina");
  const [employeeId, setEmployeeId] = useState("");

  // Filtra professores conforme o modo:
  // - disciplina: fund2 + medio (1 prof por disciplina, várias turmas)
  // - regente: fund1 (1 prof por turma, todas disciplinas)
  const professoresFiltrados =
    modo === "disciplina"
      ? professores.filter((p) => p.schoolCategory === "fund2" || p.schoolCategory === "medio")
      : professores.filter((p) => p.schoolCategory === "fund1");
  const [disciplinaId, setDisciplinaId] = useState("");
  const [turmasSel, setTurmasSel] = useState<Set<string>>(new Set());
  const [turmaRegente, setTurmaRegente] = useState("");
  const [pending, startTransition] = useTransition();

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

  // Pra modo regente: só turmas de séries Infantil/FUND1 (até ordem ~9 / 5º ANO)
  // Heurística: nome da série não começa com dígito > 5 e não tem "SÉRIE"
  const turmasRegenteOpts = useMemo(
    () =>
      [...turmas].sort(
        (a, b) =>
          b.ano_letivo - a.ano_letivo ||
          (a.series?.nome ?? "").localeCompare(b.series?.nome ?? "", "pt-BR") ||
          a.nome.localeCompare(b.nome, "pt-BR"),
      ),
    [turmas],
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
    if (turmasSel.size === turmasDaSerie.length) setTurmasSel(new Set());
    else setTurmasSel(new Set(turmasDaSerie.map((t) => t.id)));
  }

  function resetAll() {
    setDisciplinaId("");
    setTurmasSel(new Set());
    setTurmaRegente("");
  }

  function reportToast(res: { ok: boolean; inseridos?: number; ignorados?: number; error?: string }) {
    if (!res.ok) {
      toast.error(res.error ?? "Erro");
      return;
    }
    const partes: string[] = [];
    if (res.inseridos! > 0)
      partes.push(`${res.inseridos} vinculaç${res.inseridos === 1 ? "ão" : "ões"} criada${res.inseridos === 1 ? "" : "s"}`);
    if (res.ignorados! > 0)
      partes.push(`${res.ignorados} já existente${res.ignorados === 1 ? "" : "s"}`);
    toast.success(partes.join(" · ") || "Nenhuma alteração");
    resetAll();
  }

  async function onSubmitDisciplina() {
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
      reportToast(res);
    });
  }

  async function onSubmitRegente() {
    if (!employeeId || !turmaRegente) {
      toast.error("Selecione professor e turma.");
      return;
    }
    startTransition(async () => {
      const res = await createAtribuicoesRegenteAction({
        employeeId,
        turmaId: turmaRegente,
      });
      reportToast(res);
    });
  }

  const todasSelecionadas =
    turmasDaSerie.length > 0 && turmasSel.size === turmasDaSerie.length;

  return (
    <div className="grid gap-4">
      {/* Tabs modo */}
      <div className="flex gap-1 rounded-pill border border-line bg-muted/30 p-1 self-start">
        <button
          type="button"
          onClick={() => {
            setModo("disciplina");
            resetAll();
          }}
          className={`inline-flex items-center gap-1.5 rounded-pill px-3 py-1.5 text-xs font-bold transition ${
            modo === "disciplina"
              ? "bg-brand text-paper shadow-soft"
              : "text-ink/60 hover:text-ink"
          }`}
        >
          <BookOpen size={12} /> Por disciplina
        </button>
        <button
          type="button"
          onClick={() => {
            setModo("regente");
            resetAll();
          }}
          className={`inline-flex items-center gap-1.5 rounded-pill px-3 py-1.5 text-xs font-bold transition ${
            modo === "regente"
              ? "bg-brand text-paper shadow-soft"
              : "text-ink/60 hover:text-ink"
          }`}
        >
          <UserCog size={12} /> Regente da turma
        </button>
      </div>

      <p className="text-xs text-ink/60">
        {modo === "disciplina"
          ? "Use quando o professor leciona UMA disciplina em VÁRIAS turmas (FUND2/Médio)."
          : "Use quando o professor leciona TODAS disciplinas de UMA turma (Infantil/FUND1)."}
      </p>

      <label className="text-sm">
        Professor
        <select
          value={employeeId}
          onChange={(e) => setEmployeeId(e.target.value)}
          className="mt-1 w-full"
        >
          <option value="">Selecione…</option>
          {professoresFiltrados.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome}
            </option>
          ))}
        </select>
      </label>

      {modo === "disciplina" && (
        <>
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

          {disciplinaSel && (
            <div className="grid gap-3 rounded-ui border border-line bg-muted/30 p-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-ink/70">
                  Turmas de <span className="text-brand">{disciplinaSel.serie}</span> · {disciplinaSel.nome}
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
                <p className="py-2 text-center text-xs text-ink/60">
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
                          {t.nome} <span className="text-ink/60">({t.ano_letivo})</span>
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
            <p className="text-xs text-ink/60">
              {turmasSel.size > 0
                ? `${turmasSel.size} turma${turmasSel.size === 1 ? "" : "s"} selecionada${turmasSel.size === 1 ? "" : "s"}`
                : "Nenhuma turma selecionada"}
            </p>
            <button
              type="button"
              onClick={onSubmitDisciplina}
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
        </>
      )}

      {modo === "regente" && (
        <>
          <label className="text-sm">
            Turma
            <select
              value={turmaRegente}
              onChange={(e) => setTurmaRegente(e.target.value)}
              disabled={!employeeId}
              className="mt-1 w-full"
            >
              <option value="">Selecione…</option>
              {turmasRegenteOpts.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.series?.nome ?? "—"} · {t.nome} ({t.ano_letivo})
                </option>
              ))}
            </select>
          </label>

          <div className="rounded-ui bg-brand/5 p-3 text-xs text-ink/70">
            Vai criar 1 vinculação por disciplina ativa da série da turma. Duplicatas
            existentes serão ignoradas.
          </div>

          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onSubmitRegente}
              disabled={pending || !employeeId || !turmaRegente}
              className="ds-button ds-button-primary"
            >
              {pending ? (
                <>
                  <Loader2 size={14} className="animate-spin" /> Vinculando…
                </>
              ) : (
                <>
                  <UserCog size={14} /> Atribuir regente
                </>
              )}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
