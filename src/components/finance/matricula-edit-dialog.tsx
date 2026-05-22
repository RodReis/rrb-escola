"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { upsertMatriculaSemValorAction } from "@/lib/actions/alunos-sem-valor";
import type { AlunoSemValorRow } from "@/lib/data/alunos-sem-valor";

type Option = { id: string; nome: string };
type TurmaOption = { id: string; nome: string; serieId: string };

type Props = {
  row: AlunoSemValorRow;
  series: Option[];
  turmas: TurmaOption[];
  planos: Option[];
};

const TIPOS = [
  { value: "paga", label: "Paga" },
  { value: "bolsa_integral", label: "Bolsa integral" },
  { value: "bolsa_parcial", label: "Bolsa parcial" },
  { value: "permuta", label: "Permuta" },
  { value: "gratuita", label: "Gratuita" },
];

const STATUSES = [
  { value: "ativa", label: "Ativa" },
  { value: "cancelada", label: "Cancelada" },
  { value: "transferida", label: "Transferida" },
  { value: "concluida", label: "Concluída" },
];

export function MatriculaEditDialog({ row, series, turmas, planos }: Props) {
  const [open, setOpen] = useState(false);
  const [tipoVaga, setTipoVaga] = useState<string>(row.tipoVaga ?? "paga");
  const [planoId, setPlanoId] = useState<string>(row.planoId ?? "");
  const [status, setStatus] = useState<string>(row.status ?? "ativa");
  const [serieId, setSerieId] = useState(row.serieId ?? "");
  const [turmaId, setTurmaId] = useState(row.turmaId ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const isCreate = row.matriculaId === null;
  const title = isCreate ? "Criar matrícula 2026" : "Editar matrícula";
  const turmasDaSerie = turmas.filter((t) => t.serieId === serieId);

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    const result = await upsertMatriculaSemValorAction(formData);
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setOpen(false);
  }

  function openDialog() {
    // Reset local state to the row's current values each time the modal opens.
    setTipoVaga(row.tipoVaga ?? "paga");
    setPlanoId(row.planoId ?? "");
    setStatus(row.status ?? "ativa");
    setSerieId(row.serieId ?? "");
    setTurmaId(row.turmaId ?? "");
    setError(null);
    setOpen(true);
  }

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        className="ds-button ds-button-secondary min-h-0 px-2.5 py-1.5 text-xs"
      >
        <Pencil size={13} /> Editar
      </button>

      <Dialog open={open} title={title} onClose={() => setOpen(false)}>
        <form action={handleSubmit} className="grid gap-3">
          <input type="hidden" name="aluno_id" value={row.alunoId} />
          {row.matriculaId ? (
            <input type="hidden" name="matricula_id" value={row.matriculaId} />
          ) : null}

          <p className="text-xs text-ink/60">{row.nome}</p>

          {error ? (
            <p className="rounded-ui bg-danger/10 px-3 py-2 text-xs font-medium text-danger">
              {error}
            </p>
          ) : null}

          <label className="text-xs font-medium text-ink/70">
            Tipo de vaga
            <select name="tipo_vaga" value={tipoVaga} onChange={(e) => setTipoVaga(e.target.value)}>
              {TIPOS.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </label>

          {tipoVaga === "bolsa_parcial" ? (
            <label className="text-xs font-medium text-ink/70">
              Percentual da bolsa (1-99)
              <input name="percentual_bolsa" type="number" min={1} max={99} inputMode="numeric" required />
            </label>
          ) : null}

          <label className="text-xs font-medium text-ink/70">
            Plano
            <select name="plano_id" value={planoId} onChange={(e) => setPlanoId(e.target.value)}>
              <option value="">Sem plano</option>
              {planos.map((p) => (
                <option key={p.id} value={p.id}>{p.nome}</option>
              ))}
            </select>
          </label>

          <label className="text-xs font-medium text-ink/70">
            Série
            <select
              name="serie_id"
              value={serieId}
              onChange={(e) => {
                setSerieId(e.target.value);
                setTurmaId("");
              }}
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
              value={turmaId}
              onChange={(e) => setTurmaId(e.target.value)}
              required
            >
              <option value="">Selecione…</option>
              {turmasDaSerie.map((t) => (
                <option key={t.id} value={t.id}>{t.nome}</option>
              ))}
            </select>
          </label>

          {!isCreate ? (
            <label className="text-xs font-medium text-ink/70">
              Status
              <select name="status" value={status} onChange={(e) => setStatus(e.target.value)}>
                {STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </label>
          ) : null}

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
