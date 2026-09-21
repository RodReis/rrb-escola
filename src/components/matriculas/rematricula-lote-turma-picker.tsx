"use client";

import { useState } from "react";
import { FieldNote } from "@/components/ui/field-note";

const TURNO_LABEL: Record<string, string> = {
  matutino: "MATUTINO",
  vespertino: "VESPERTINO",
  noturno: "NOTURNO",
  integral: "INTEGRAL",
};

type Turma = {
  id: string;
  nome: string;
  ano_letivo: number;
  turno: string;
  serieNome: string | null;
  serieOrdem: number;
};

const ORDEM_TURNO = ["matutino", "vespertino", "noturno", "integral"];

export function RematriculaLoteTurmaPicker({ anos, turmas }: { anos: number[]; turmas: Turma[] }) {
  const anoInicial = anos.includes(new Date().getFullYear()) ? new Date().getFullYear() : anos[0];
  const [ano, setAno] = useState(anoInicial);

  const doAno = turmas
    .filter((t) => t.ano_letivo === ano)
    .sort(
      (a, b) =>
        a.serieOrdem - b.serieOrdem ||
        ORDEM_TURNO.indexOf(a.turno) - ORDEM_TURNO.indexOf(b.turno) ||
        a.nome.localeCompare(b.nome, "pt-BR")
    );

  return (
    <>
      <label>
        Ano letivo origem
        <select name="ano" required value={ano} onChange={(e) => setAno(Number(e.target.value))}>
          {anos.map((item) => (
            <option key={item} value={item}>{item}</option>
          ))}
        </select>
      </label>

      <div className="grid content-start">
        <label>
          Turma
          <select key={ano} name="turma_id" required disabled={doAno.length === 0} defaultValue="">
            <option value="">Selecione…</option>
            {doAno.map((t) => {
              const turno = TURNO_LABEL[t.turno] ?? t.turno.toUpperCase();
              const nome = t.nome.trim().toUpperCase() === turno ? turno : `${t.nome} — ${turno}`;
              return (
                <option key={t.id} value={t.id}>
                  {t.serieNome ? `${t.serieNome} — ${nome}` : nome}
                </option>
              );
            })}
          </select>
        </label>
        {doAno.length === 0 ? (
          <FieldNote tone="warn">Nenhuma turma ativa em {ano}.</FieldNote>
        ) : null}
      </div>
    </>
  );
}
