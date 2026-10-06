"use client";

import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import { moverItem } from "@/lib/questionario/lista";

type Props = {
  /** `name` dos inputs: o server lê com formData.getAll(nome). */
  nome: string;
  rotulo: string;
  valores: string[];
  onChange: (valores: string[]) => void;
  placeholder?: string;
};

const botao = "rounded-ui p-1.5 text-ink/70 hover:bg-muted disabled:opacity-30 disabled:hover:bg-transparent";

export function ListaRotulos({ nome, rotulo, valores, onChange, placeholder }: Props) {
  return (
    <fieldset className="grid gap-2">
      <legend className="text-sm font-medium text-ink/80">{rotulo}</legend>
      {valores.map((valor, i) => (
        <div key={i} className="flex items-center gap-1">
          <input
            name={nome}
            value={valor}
            placeholder={placeholder}
            aria-label={`${rotulo} ${i + 1}`}
            onChange={(e) => onChange(valores.map((v, j) => (j === i ? e.target.value : v)))}
          />
          <button type="button" className={botao} disabled={i === 0} aria-label={`Subir ${rotulo} ${i + 1}`}
            onClick={() => onChange(moverItem(valores, i, i - 1))}>
            <ArrowUp size={14} />
          </button>
          <button type="button" className={botao} disabled={i === valores.length - 1} aria-label={`Descer ${rotulo} ${i + 1}`}
            onClick={() => onChange(moverItem(valores, i, i + 1))}>
            <ArrowDown size={14} />
          </button>
          <button type="button" className={botao} aria-label={`Remover ${rotulo} ${i + 1}`}
            onClick={() => onChange(valores.filter((_, j) => j !== i))}>
            <X size={14} />
          </button>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...valores, ""])}
        className="flex w-fit items-center gap-1 text-sm font-medium text-brand hover:underline">
        <Plus size={14} /> Adicionar
      </button>
    </fieldset>
  );
}
