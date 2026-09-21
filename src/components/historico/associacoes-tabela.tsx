"use client";

import { removerAssociacaoAction } from "@/lib/actions/historico";
import { useAction } from "@/lib/hooks/use-action";
import type { NivelEnsinoRow } from "@/lib/data/historico";

const NIVEL_ROTULO: Record<string, string> = {
  infantil: "Educação Infantil",
  fund1: "Fundamental I",
  fund2: "Fundamental II",
  medio: "Ensino Médio"
};

function AssociacaoRow({ a }: { a: NivelEnsinoRow }) {
  const { run, pending } = useAction(removerAssociacaoAction, {
    confirm: {
      title: "Remover associação",
      message: `Tem certeza que quer remover a associação de "${a.serieNome}"?`,
      confirmLabel: "Remover",
      variant: "danger",
    },
    success: "Associação removida.",
    error: "Falha ao remover a associação.",
  });

  function handleClick() {
    const fd = new FormData();
    fd.set("id", a.id);
    run(fd);
  }

  return (
    <tr className="border-t border-line">
      <td className="p-2">{a.serieNome}</td>
      <td className="p-2">{a.companyNome}</td>
      <td className="p-2">{NIVEL_ROTULO[a.nivel] ?? a.nivel}</td>
      <td className="p-2">{a.anoInicio} – {a.anoFim}</td>
      <td className="p-2 text-right">
        <button type="button" onClick={handleClick} disabled={pending} className="text-sm text-clay disabled:opacity-50">
          {pending ? "Removendo…" : "Remover"}
        </button>
      </td>
    </tr>
  );
}

export function AssociacoesTabela({ associacoes }: { associacoes: NivelEnsinoRow[] }) {
  if (associacoes.length === 0) {
    return (
      <p className="rounded-lg border border-line p-6 text-center text-sm text-muted">
        Não há nada para mostrar aqui
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
    <table className="w-full min-w-[560px] text-sm">
      <thead className="bg-muted text-left">
        <tr>
          <th className="p-2">Série</th>
          <th className="p-2">Empresa</th>
          <th className="p-2">Nível</th>
          <th className="p-2">Período</th>
          <th className="p-2" />
        </tr>
      </thead>
      <tbody>
        {associacoes.map((a) => (
          <AssociacaoRow key={a.id} a={a} />
        ))}
      </tbody>
    </table>
    </div>
  );
}
