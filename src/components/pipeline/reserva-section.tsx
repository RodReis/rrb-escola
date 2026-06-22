"use client";

import { useState, useEffect, useTransition } from "react";
import { cn } from "@/lib/utils";
import {
  getSeriesEscola,
  getTurmasPorSerie,
  getVagasTurma,
  criarOuAtualizarReservaAction,
  promoverCardAction,
} from "@/lib/actions/pipeline";
import type { getCardDetalhe } from "@/lib/actions/pipeline";

type Reserva = NonNullable<Awaited<ReturnType<typeof getCardDetalhe>>["data"]>["reserva"];
type Serie = { id: string; nome: string; ordem: number };
type Turma = { id: string; nome: string; capacidade: number | null };
type Vagas = { capacidade: number; matriculas_ativas: number; vagas_restantes: number };

type Props = {
  cardId: string;
  reserva: Reserva;
  onUpdated: () => void;
};

const ANO_LETIVO_ATUAL = new Date().getFullYear();

export function ReservaSection({ cardId, reserva, onUpdated }: Props) {
  const [series, setSeries] = useState<Serie[]>([]);
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [vagas, setVagas] = useState<Vagas | null>(null);
  const [editando, setEditando] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

  const [form, setForm] = useState({
    serie_id: reserva?.serie_id ?? "",
    turma_id: reserva?.turma_id ?? "",
    status_vaga: reserva?.status_vaga ?? "aguardando",
    observacoes_secretaria: reserva?.observacoes_secretaria ?? "",
    interesse_confirmado: reserva?.interesse_confirmado ?? false,
  });

  useEffect(() => {
    getSeriesEscola().then((r) => {
      if (r.ok) setSeries(r.data);
    });
  }, []);

  useEffect(() => {
    if (!form.serie_id) { setTurmas([]); setVagas(null); return; }
    getTurmasPorSerie(form.serie_id).then((r) => {
      if (r.ok) setTurmas(r.data);
    });
  }, [form.serie_id]);

  useEffect(() => {
    if (!form.turma_id) { setVagas(null); return; }
    getVagasTurma(form.turma_id, ANO_LETIVO_ATUAL).then((r) => {
      if (r.ok) setVagas(r.data);
    });
  }, [form.turma_id]);

  function handleSalvar() {
    setErro(null);
    startTransition(async () => {
      const r = await criarOuAtualizarReservaAction(cardId, {
        serie_id: form.serie_id || null,
        turma_id: form.turma_id || null,
        status_vaga: form.status_vaga as Parameters<typeof criarOuAtualizarReservaAction>[1]["status_vaga"],
        observacoes_secretaria: form.observacoes_secretaria || null,
        interesse_confirmado: form.interesse_confirmado,
      });
      if (r.ok) {
        setEditando(false);
        onUpdated();
      } else {
        setErro(r.error);
      }
    });
  }

  function handlePromover() {
    setErro(null);
    setSucesso(null);
    startTransition(async () => {
      const r = await promoverCardAction(cardId);
      if (r.ok) {
        setSucesso(`Convertido! Matrícula: ${r.data.matricula_codigo}`);
        onUpdated();
      } else {
        setErro(r.error);
      }
    });
  }

  const nomeSerie = series.find((s) => s.id === (reserva?.serie_id ?? form.serie_id))?.nome;
  const nomeTurma = turmas.find((t) => t.id === (reserva?.turma_id ?? form.turma_id))?.nome;

  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-[rgb(var(--color-ink)/0.45)]">
          Reserva
        </h4>
        <button
          type="button"
          onClick={() => { setEditando((v) => !v); setErro(null); }}
          className="text-xs text-[rgb(var(--color-brand))] hover:underline"
        >
          {editando ? "Cancelar" : reserva ? "Editar" : "Cadastrar"}
        </button>
      </div>

      {sucesso && (
        <p className="mb-2 rounded-md bg-[rgb(var(--color-success)/0.1)] px-3 py-2 text-xs font-medium text-[rgb(var(--color-success))]">
          {sucesso}
        </p>
      )}

      {!editando && reserva && (
        <div className="rounded-lg border border-[rgb(var(--color-line))] p-3 text-sm space-y-1">
          {nomeSerie && (
            <div className="flex justify-between">
              <span className="text-xs text-[rgb(var(--color-ink)/0.55)]">Série</span>
              <span className="text-xs font-medium text-[rgb(var(--color-ink))]">{nomeSerie}</span>
            </div>
          )}
          {nomeTurma && (
            <div className="flex justify-between">
              <span className="text-xs text-[rgb(var(--color-ink)/0.55)]">Turma</span>
              <span className="text-xs font-medium text-[rgb(var(--color-ink))]">{nomeTurma}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-xs text-[rgb(var(--color-ink)/0.55)]">Status</span>
            <span className="text-xs font-medium text-[rgb(var(--color-ink))]">
              {reserva.status_vaga?.replace(/_/g, " ") ?? "—"}
            </span>
          </div>
          {vagas && (
            <div className="flex justify-between pt-1 border-t border-[rgb(var(--color-line))]">
              <span className="text-xs text-[rgb(var(--color-ink)/0.55)]">Vagas {ANO_LETIVO_ATUAL}</span>
              <span className={cn(
                "text-xs font-semibold",
                vagas.vagas_restantes > 0
                  ? "text-[rgb(var(--color-success))]"
                  : "text-[rgb(var(--color-warning))]",
              )}>
                {vagas.vagas_restantes}/{vagas.capacidade}
              </span>
            </div>
          )}
        </div>
      )}

      {!editando && !reserva && (
        <p className="text-xs text-[rgb(var(--color-ink)/0.4)]">Nenhuma reserva cadastrada.</p>
      )}

      {editando && (
        <div className="space-y-2">
          <div>
            <label className="block text-xs text-[rgb(var(--color-ink)/0.55)] mb-1">Série</label>
            <select
              value={form.serie_id}
              onChange={(e) => setForm((p) => ({ ...p, serie_id: e.target.value, turma_id: "" }))}
              className="w-full rounded-md border border-[rgb(var(--color-line))] bg-[rgb(var(--color-surface))] px-2 py-1 text-sm text-[rgb(var(--color-ink))]"
            >
              <option value="">— Selecione —</option>
              {series.map((s) => (
                <option key={s.id} value={s.id}>{s.nome}</option>
              ))}
            </select>
          </div>

          {turmas.length > 0 && (
            <div>
              <label className="block text-xs text-[rgb(var(--color-ink)/0.55)] mb-1">Turma</label>
              <select
                value={form.turma_id}
                onChange={(e) => setForm((p) => ({ ...p, turma_id: e.target.value }))}
                className="w-full rounded-md border border-[rgb(var(--color-line))] bg-[rgb(var(--color-surface))] px-2 py-1 text-sm text-[rgb(var(--color-ink))]"
              >
                <option value="">— Selecione —</option>
                {turmas.map((t) => (
                  <option key={t.id} value={t.id}>{t.nome}</option>
                ))}
              </select>
              {vagas && (
                <p className={cn(
                  "mt-1 text-xs font-medium",
                  vagas.vagas_restantes > 0
                    ? "text-[rgb(var(--color-success))]"
                    : "text-[rgb(var(--color-warning))]",
                )}>
                  {vagas.vagas_restantes > 0
                    ? `${vagas.vagas_restantes} vaga(s) disponível(eis)`
                    : "Turma lotada (reserva ainda possível)"}
                </p>
              )}
            </div>
          )}

          <div>
            <label className="block text-xs text-[rgb(var(--color-ink)/0.55)] mb-1">Status da vaga</label>
            <select
              value={form.status_vaga}
              onChange={(e) => setForm((p) => ({ ...p, status_vaga: e.target.value }))}
              className="w-full rounded-md border border-[rgb(var(--color-line))] bg-[rgb(var(--color-surface))] px-2 py-1 text-sm text-[rgb(var(--color-ink))]"
            >
              {(["aguardando","disponivel","responsavel_contactado","aguardando_resposta","desistiu","sem_retorno"] as const).map((s) => (
                <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-[rgb(var(--color-ink)/0.55)] mb-1">Observações</label>
            <textarea
              value={form.observacoes_secretaria}
              onChange={(e) => setForm((p) => ({ ...p, observacoes_secretaria: e.target.value }))}
              rows={2}
              className="w-full rounded-md border border-[rgb(var(--color-line))] bg-[rgb(var(--color-surface))] px-2 py-1 text-sm text-[rgb(var(--color-ink))] resize-none"
              placeholder="Observações da secretaria…"
            />
          </div>

          <label className="flex items-center gap-2 text-xs text-[rgb(var(--color-ink)/0.7)]">
            <input
              type="checkbox"
              checked={form.interesse_confirmado}
              onChange={(e) => setForm((p) => ({ ...p, interesse_confirmado: e.target.checked }))}
              className="h-3.5 w-3.5 rounded"
            />
            Interesse confirmado pelo responsável
          </label>

          {erro && <p className="text-xs text-[rgb(var(--color-danger))]">{erro}</p>}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={handleSalvar}
              disabled={isPending}
              className="rounded-md bg-[rgb(var(--color-brand))] px-3 py-1 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              Salvar reserva
            </button>
          </div>
        </div>
      )}

      {/* Botão de promoção (só se reserva com série+turma) */}
      {!editando && reserva?.serie_id && reserva?.turma_id && (
        <div className="mt-3 pt-3 border-t border-[rgb(var(--color-line))]">
          {erro && <p className="mb-2 text-xs text-[rgb(var(--color-danger))]">{erro}</p>}
          <button
            type="button"
            onClick={handlePromover}
            disabled={isPending}
            className={cn(
              "w-full rounded-md px-3 py-2 text-xs font-semibold transition-colors",
              "bg-[rgb(var(--color-success)/0.1)] text-[rgb(var(--color-success))]",
              "hover:bg-[rgb(var(--color-success)/0.2)] disabled:opacity-40",
            )}
          >
            {isPending ? "Convertendo…" : "Converter em Aluno / Matrícula"}
          </button>
        </div>
      )}
    </section>
  );
}
