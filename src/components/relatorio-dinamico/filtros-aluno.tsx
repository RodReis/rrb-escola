"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FilterDropdown, type DropdownOption } from "@/components/ui/filter-dropdown";
import type { OpcoesAluno } from "@/lib/relatorio-dinamico/dados/opcoes";
import { STATUS_MATRICULA, type FiltrosAluno } from "@/lib/relatorio-dinamico/tipos";

const SEGMENTOS = [
  { id: "INFANTIL", nome: "Educação Infantil" }, { id: "FUNDAMENTAL1", nome: "Fundamental I" },
  { id: "FUNDAMENTAL2", nome: "Fundamental II" }, { id: "MEDIO", nome: "Ensino Médio" },
];
const STATUS_LABEL: Record<(typeof STATUS_MATRICULA)[number], string> = { ativa: "Ativa", cancelada: "Cancelada", transferida: "Transferida", concluida: "Concluída" };
const EIXO_LABEL: Record<FiltrosAluno["filtrarPor"], string> = { serie: "Série", turma: "Turma", segmento: "Segmento" };

type Props = { opcoes: OpcoesAluno; onChange: (f: FiltrosAluno) => void };

export function FiltrosAlunoForm({ opcoes, onChange }: Props) {
  const [f, setF] = useState<FiltrosAluno>({ ano: opcoes.anos[0] ?? new Date().getFullYear(), filtrarPor: "serie", valores: [], status: ["ativa"] });

  const serieNome = new Map(opcoes.series.map((s) => [s.id, s.nome]));
  const valoresPossiveis: DropdownOption[] =
    f.filtrarPor === "serie" ? opcoes.series.map((s) => ({ value: s.id, label: s.nome }))
    : f.filtrarPor === "turma" ? opcoes.turmas.filter((t) => t.ano_letivo === f.ano).map((t) => ({ value: t.id, label: `${serieNome.get(t.serie_id) ?? ""} ${t.nome}`.trim() }))
    : SEGMENTOS.map((s) => ({ value: s.id, label: s.nome }));
  const valorAtual = f.valores[0] ?? "";

  const alternarStatus = (s: (typeof STATUS_MATRICULA)[number]) => {
    const marcado = f.status.includes(s);
    const nova = marcado ? f.status.filter((x) => x !== s) : [...f.status, s];
    if (nova.length) setF({ ...f, status: nova });
  };

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="w-32">
          Ano referência *
          <select value={f.ano} onChange={(e) => setF({ ...f, ano: Number(e.target.value), valores: f.filtrarPor === "turma" ? [] : f.valores })}>
            {opcoes.anos.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </label>
        <label className="w-28">
          Filtrar por
          <select value={f.filtrarPor} onChange={(e) => setF({ ...f, filtrarPor: e.target.value as FiltrosAluno["filtrarPor"], valores: [] })}>
            <option value="serie">Série</option>
            <option value="turma">Turma</option>
            <option value="segmento">Segmento</option>
          </select>
        </label>
        <FilterDropdown
          label={EIXO_LABEL[f.filtrarPor]}
          value={valorAtual}
          options={valoresPossiveis}
          onChange={(v) => setF({ ...f, valores: v ? [v] : [] })}
          emptyLabel="Todas"
        />
        <Button type="button" onClick={() => onChange(f)} className="ml-auto">
          <Search size={14} /> Aplicar filtros
        </Button>
      </div>
      <fieldset>
        <legend className="mb-1.5 text-sm font-medium text-ink">Situação da matrícula</legend>
        <div className="flex flex-wrap items-center gap-1">
          {STATUS_MATRICULA.map((s) => (
            <button key={s} type="button" data-active={f.status.includes(s)} className="ds-chip" onClick={() => alternarStatus(s)}>
              {STATUS_LABEL[s]}
            </button>
          ))}
        </div>
      </fieldset>
    </div>
  );
}
