"use client";

import { salvarAssociacaoAction } from "@/lib/actions/historico";

type Props = {
  series: Array<{ id: string; nome: string }>;
  credenciamentos: Array<{ id: string; nomeFantasia: string }>;
};

const NIVEIS = [
  { valor: "infantil", rotulo: "Educação Infantil" },
  { valor: "fund1", rotulo: "Fundamental I" },
  { valor: "fund2", rotulo: "Fundamental II" },
  { valor: "medio", rotulo: "Ensino Médio" }
];

export function AssociacaoForm({ series, credenciamentos }: Props) {
  const anoAtual = new Date().getFullYear();

  return (
    <form action={salvarAssociacaoAction} className="grid gap-4 rounded-lg border border-line p-4 md:grid-cols-5">
      <label className="flex flex-col gap-1 text-sm">
        Série
        <select name="serieId" required className="rounded border border-line bg-surface p-2">
          <option value="">Selecione</option>
          {series.map((s) => (
            <option key={s.id} value={s.id}>{s.nome}</option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Empresa
        <select name="credenciamentoId" required className="rounded border border-line bg-surface p-2">
          <option value="">Selecione</option>
          {credenciamentos.map((c) => (
            <option key={c.id} value={c.id}>{c.nomeFantasia}</option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Nível de ensino
        <select name="nivel" required className="rounded border border-line bg-surface p-2">
          {NIVEIS.map((n) => (
            <option key={n.valor} value={n.valor}>{n.rotulo}</option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Ano início
        <input type="number" name="anoInicio" required defaultValue={anoAtual}
          className="rounded border border-line bg-surface p-2" />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Ano final
        <input type="number" name="anoFim" required defaultValue={anoAtual}
          className="rounded border border-line bg-surface p-2" />
      </label>

      <button type="submit" className="md:col-span-5 rounded bg-brand px-4 py-2 text-paper">
        Gravar
      </button>
    </form>
  );
}
