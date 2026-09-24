"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { updateEnrollmentFullAction } from "@/lib/actions/academics";
import { useAction } from "@/lib/hooks/use-action";
import { TIPO_VAGA_LABEL } from "@/components/matriculas/tipo-vaga";

const TIPOS = Object.entries(TIPO_VAGA_LABEL).map(([value, label]) => ({ value, label }));

const STATUSES_BASE = [
  { value: "ativa", label: "Ativa" },
  { value: "transferida", label: "Transferida" },
  { value: "concluida", label: "Concluída" },
];
const STATUS_CANCELADA = { value: "cancelada", label: "Cancelada" };

type Option = { id: string; nome: string };
type TurmaOption = { id: string; nome: string; serieId: string };

type Props = {
  matriculaId: string;
  alunoId: string;
  alunoNome: string;
  serieId: string;
  turmaId: string;
  planoId: string | null;
  tipoVaga: string;
  status: string;
  series: Option[];
  turmas: TurmaOption[];
  planos: Option[];
};

export function MatriculaFullEditDialog({
  matriculaId,
  alunoId,
  alunoNome,
  serieId,
  turmaId,
  planoId,
  tipoVaga,
  status,
  series,
  turmas,
  planos,
}: Props) {
  const [open, setOpen] = useState(false);
  const [selSerie, setSelSerie] = useState(serieId);
  const [selTurma, setSelTurma] = useState(turmaId);
  const [selPlano, setSelPlano] = useState(planoId ?? "");
  const [selTipoVaga, setSelTipoVaga] = useState(tipoVaga);
  const [selStatus, setSelStatus] = useState(status);
  const { run, pending } = useAction(updateEnrollmentFullAction, {
    success: "Matrícula atualizada.",
    error: "Falha ao atualizar a matrícula.",
    onSuccess: () => setOpen(false),
  });

  const turmasDaSerie = turmas.filter((t) => t.serieId === selSerie);
  // "Cancelada" só aparece na lista se a matrícula já estava cancelada — esse
  // diálogo manual não deve ser um atalho para cancelar por fora do fluxo
  // dedicado (motivo, data, cientes, cobranças). Ver achado I4(b).
  const statuses = status === "cancelada" ? [...STATUSES_BASE, STATUS_CANCELADA] : STATUSES_BASE;

  function openDialog() {
    setSelSerie(serieId);
    setSelTurma(turmaId);
    setSelPlano(planoId ?? "");
    setSelTipoVaga(tipoVaga);
    setSelStatus(status);
    setOpen(true);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    run(new FormData(e.currentTarget));
  }

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        title="Editar"
        aria-label="Editar"
        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-brand hover:bg-brand/10"
      >
        <Pencil size={15} />
      </button>

      <Dialog open={open} title={`Editar matrícula — ${alunoNome}`} onClose={() => setOpen(false)}>
        <form onSubmit={handleSubmit} className="grid gap-3">
          <input type="hidden" name="id" value={matriculaId} />
          <input type="hidden" name="aluno_id" value={alunoId} />

          <label className="text-xs font-medium text-ink/70">
            Série
            <select
              name="serie_id"
              value={selSerie}
              onChange={(e) => { setSelSerie(e.target.value); setSelTurma(""); }}
              required
            >
              <option value="">Selecione…</option>
              {series.map((s) => (
                <option key={s.id} value={s.id}>{s.nome}</option>
              ))}
            </select>
          </label>

          <label className="text-xs font-medium text-ink/70">
            Turma
            <select
              name="turma_id"
              value={selTurma}
              onChange={(e) => setSelTurma(e.target.value)}
              required
            >
              <option value="">Selecione…</option>
              {turmasDaSerie.map((t) => (
                <option key={t.id} value={t.id}>{t.nome}</option>
              ))}
            </select>
          </label>

          <label className="text-xs font-medium text-ink/70">
            Plano
            <select name="plano_id" value={selPlano} onChange={(e) => setSelPlano(e.target.value)}>
              <option value="">Sem plano</option>
              {planos.map((p) => (
                <option key={p.id} value={p.id}>{p.nome}</option>
              ))}
            </select>
          </label>

          <label className="text-xs font-medium text-ink/70">
            Tipo de vaga
            <select name="tipo_vaga" value={selTipoVaga} onChange={(e) => setSelTipoVaga(e.target.value)}>
              {TIPOS.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </label>

          <label className="text-xs font-medium text-ink/70">
            Status
            <select name="status" value={selStatus} onChange={(e) => setSelStatus(e.target.value)}>
              {statuses.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </label>

          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="ds-button ds-button-secondary text-xs"
            >
              Cancelar
            </button>
            <button type="submit" disabled={pending} className="ds-button ds-button-primary text-xs">
              {pending ? "Salvando…" : "Salvar"}
            </button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
