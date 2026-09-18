"use client";

import { useState } from "react";
import { FieldNote } from "@/components/ui/field-note";

const TURNO_LABEL: Record<string, string> = {
  matutino: "MATUTINO",
  vespertino: "VESPERTINO",
  noturno: "NOTURNO",
  integral: "INTEGRAL",
};

type Serie = { id: string; nome: string };
type Turma = { id: string; nome: string; serie_id: string; turno: string };
type Plano = { id: string; nome: string };

function rotuloTurma(t: Turma): string {
  const turno = TURNO_LABEL[t.turno] ?? t.turno.toUpperCase();
  return t.nome.trim().toUpperCase() === turno ? turno : `${t.nome} — ${turno}`;
}

export function RematriculaLoteDestinoPicker({
  series,
  turmas,
  anoDestino,
  serieSugeridaId,
  serieOrigemNome,
  turnoOrigem,
  planos,
  planoOrigemNome,
  voltarHref,
}: {
  series: Serie[];
  turmas: Turma[];
  anoDestino: number;
  serieSugeridaId: string;
  serieOrigemNome: string | null;
  turnoOrigem: string;
  planos: Plano[];
  planoOrigemNome: string | null;
  voltarHref: string;
}) {
  const [serieId, setSerieId] = useState(serieSugeridaId);

  const turmasDaSerie = turmas.filter((t) => t.serie_id === serieId);
  // O lote preserva o turno de origem: a turma destino é a de mesmo turno.
  const turmaCasada = turmasDaSerie.find((t) => t.turno === turnoOrigem);
  const turnoLabel = TURNO_LABEL[turnoOrigem] ?? turnoOrigem.toUpperCase();

  return (
    <>
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <div className="grid content-start">
        <label>
          Série destino em {anoDestino}
          <select name="serie_dest_id" required value={serieId} onChange={(e) => setSerieId(e.target.value)}>
            <option value="" disabled>Selecione…</option>
            {series.map((s) => (
              <option key={s.id} value={s.id}>{s.nome}</option>
            ))}
          </select>
        </label>
        {serieId && serieId === serieSugeridaId && serieOrigemNome ? (
          <FieldNote>Série seguinte a {serieOrigemNome}.</FieldNote>
        ) : null}
      </div>

      <div className="grid content-start">
        <label>
          Turma destino
          <input
            type="text"
            readOnly
            tabIndex={-1}
            value={
              turmaCasada
                ? rotuloTurma(turmaCasada)
                : serieId
                  ? `Sem turma ${turnoLabel}`
                  : "Selecione a série primeiro"
            }
            className={turmaCasada ? undefined : "text-dim"}
          />
        </label>
        <input type="hidden" name="turma_dest_id" value={turmaCasada?.id ?? ""} />
        {serieId && !turmaCasada ? (
          <FieldNote tone="warn">
            Não há turma {turnoLabel} em {anoDestino} para esta série. Cadastre em{" "}
            <a href="/turmas" className="font-bold underline underline-offset-2 hover:text-ink">Turmas</a>.
          </FieldNote>
        ) : (
          <FieldNote>Mesmo turno da turma de origem.</FieldNote>
        )}
      </div>

      <div className="grid content-start">
        <label>
          Plano em {anoDestino}
          <select name="plano_dest_id" defaultValue="">
            <option value="">Sem plano</option>
            {planos.map((p) => (
              <option key={p.id} value={p.id}>{p.nome}</option>
            ))}
          </select>
        </label>
        {planoOrigemNome ? (
          <FieldNote tone="warn">
            Plano atual: {planoOrigemNome}. Escolha o plano de {anoDestino}.
          </FieldNote>
        ) : (
          <FieldNote>Aplicado a todos os alunos do lote.</FieldNote>
        )}
      </div>
    </div>

    <div className="flex gap-3">
      <a href={voltarHref} className="ds-button ds-button-secondary">← Voltar</a>
      <button type="submit" className="ds-button ds-button-primary" disabled={!turmaCasada}>
        Próximo →
      </button>
    </div>
    </>
  );
}
