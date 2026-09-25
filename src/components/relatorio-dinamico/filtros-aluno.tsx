"use client";

import { useEffect, useState } from "react";
import type { OpcoesAluno } from "@/lib/relatorio-dinamico/dados/opcoes";
import { STATUS_MATRICULA, type FiltrosAluno } from "@/lib/relatorio-dinamico/tipos";

const SEGMENTOS = [
  { id: "INFANTIL", nome: "Educação Infantil" }, { id: "FUNDAMENTAL1", nome: "Fundamental I" },
  { id: "FUNDAMENTAL2", nome: "Fundamental II" }, { id: "MEDIO", nome: "Ensino Médio" },
];
const STATUS_LABEL: Record<(typeof STATUS_MATRICULA)[number], string> = { ativa: "Ativa", cancelada: "Cancelada", transferida: "Transferida", concluida: "Concluída" };

type Props = { opcoes: OpcoesAluno; onChange: (f: FiltrosAluno) => void };

export function FiltrosAlunoForm({ opcoes, onChange }: Props) {
  const [f, setF] = useState<FiltrosAluno>({ ano: opcoes.anos[0] ?? new Date().getFullYear(), filtrarPor: "serie", valores: [], status: ["ativa"] });

  // Carga inicial da lista de registros (uma vez).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => onChange(f), []);

  const atualizar = (novo: FiltrosAluno) => { setF(novo); onChange(novo); };
  const serieNome = new Map(opcoes.series.map((s) => [s.id, s.nome]));
  const valoresPossiveis =
    f.filtrarPor === "serie" ? opcoes.series.map((s) => ({ id: s.id, nome: s.nome }))
    : f.filtrarPor === "turma" ? opcoes.turmas.filter((t) => t.ano_letivo === f.ano).map((t) => ({ id: t.id, nome: `${serieNome.get(t.serie_id) ?? ""} ${t.nome}`.trim() }))
    : SEGMENTOS;
  const alternar = <T extends string>(lista: T[], v: T) => (lista.includes(v) ? lista.filter((x) => x !== v) : [...lista, v]);

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 md:grid-cols-3">
        <label>
          Ano referência *
          <select value={f.ano} onChange={(e) => atualizar({ ...f, ano: Number(e.target.value), valores: f.filtrarPor === "turma" ? [] : f.valores })}>
            {opcoes.anos.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </label>
        <label>
          Filtrar por
          <select value={f.filtrarPor} onChange={(e) => atualizar({ ...f, filtrarPor: e.target.value as FiltrosAluno["filtrarPor"], valores: [] })}>
            <option value="serie">Série</option>
            <option value="turma">Turma</option>
            <option value="segmento">Segmento</option>
          </select>
        </label>
        <fieldset>
          <legend className="mb-1 text-sm font-medium text-ink">Situação da matrícula</legend>
          <div className="flex flex-wrap gap-3">
            {STATUS_MATRICULA.map((s) => (
              <label key={s} className="flex items-center gap-1.5 text-sm">
                <input type="checkbox" checked={f.status.includes(s)}
                  onChange={() => { const n = alternar(f.status, s); if (n.length) atualizar({ ...f, status: n }); }} />
                {STATUS_LABEL[s]}
              </label>
            ))}
          </div>
        </fieldset>
      </div>
      <fieldset>
        <legend className="mb-1 text-sm font-medium text-ink">
          {f.filtrarPor === "serie" ? "Séries" : f.filtrarPor === "turma" ? "Turmas" : "Segmentos"} <span className="text-ink/50">(nenhuma marcada = todas)</span>
        </legend>
        <div className="flex max-h-32 flex-wrap gap-2 overflow-y-auto">
          {valoresPossiveis.map((v) => (
            <label key={v.id} className="flex items-center gap-1.5 rounded-ui border border-line px-2.5 py-1.5 text-sm">
              <input type="checkbox" aria-label={v.nome} checked={f.valores.includes(v.id)} onChange={() => atualizar({ ...f, valores: alternar(f.valores, v.id) })} />
              {v.nome}
            </label>
          ))}
        </div>
      </fieldset>
    </div>
  );
}
