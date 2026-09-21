"use client";

import { salvarAssociacaoAction } from "@/lib/actions/historico";
import { useAction } from "@/lib/hooks/use-action";
import { Button } from "@/components/ui/button";

type Props = {
  series: Array<{ id: string; nome: string }>;
  empresas: Array<{ id: string; nomeFantasia: string }>;
};

const NIVEIS = [
  { valor: "infantil", rotulo: "Educação Infantil" },
  { valor: "fund1", rotulo: "Fundamental I" },
  { valor: "fund2", rotulo: "Fundamental II" },
  { valor: "medio", rotulo: "Ensino Médio" }
];

export function AssociacaoForm({ series, empresas }: Props) {
  const anoAtual = new Date().getFullYear();
  const { run, pending } = useAction(salvarAssociacaoAction, {
    error: "Falha ao gravar a associação.",
  });

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    run(new FormData(e.currentTarget));
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 rounded-lg border border-line p-4 md:grid-cols-5">
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
        <select name="companyId" required className="rounded border border-line bg-surface p-2">
          <option value="">Selecione</option>
          {empresas.map((e) => (
            <option key={e.id} value={e.id}>{e.nomeFantasia}</option>
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

      <Button type="submit" loading={pending} className="md:col-span-5">
        Gravar
      </Button>
    </form>
  );
}
