"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useAction } from "@/lib/hooks/use-action";
import { resolverPendenciaIsaacAction } from "@/lib/actions/isaac";

type AlunoOpcao = { id: string; nome: string };

export function ResolverPendenciaForm({
  parcelaId,
  nomeIsaac,
  alunos,
}: {
  parcelaId: string;
  nomeIsaac: string;
  alunos: AlunoOpcao[];
}) {
  const [busca, setBusca] = useState("");
  const resolver = useAction(resolverPendenciaIsaacAction);

  // Sugestão por sobrenome, nunca casamento automático: irmãos compartilham
  // sobrenome e um match errado lança a mensalidade no aluno errado.
  const termo = (busca || nomeIsaac)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
  const palavras = termo.split(/\s+/).filter((p) => p.length > 2);
  const sugeridos = alunos
    .filter((a) => {
      const nome = a.nome.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
      return palavras.some((p) => nome.includes(p));
    })
    .slice(0, 30);

  return (
    <form
      className="grid gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        resolver.run(new FormData(e.currentTarget));
      }}
    >
      <input type="hidden" name="parcela_id" value={parcelaId} />
      <input
        type="search"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Buscar aluno..."
        className="rounded-ui border border-line bg-surface px-2 py-1 text-xs text-ink"
      />
      <div className="flex gap-2">
        <select
          name="aluno_id"
          required
          defaultValue=""
          className="min-w-0 flex-1 rounded-ui border border-line bg-surface px-2 py-1 text-xs text-ink"
        >
          <option value="" disabled>
            {sugeridos.length === 0 ? "Nenhum aluno parecido" : `${sugeridos.length} sugestão(ões)`}
          </option>
          {sugeridos.map((a) => (
            <option key={a.id} value={a.id}>
              {a.nome}
            </option>
          ))}
        </select>
        <Button type="submit" variant="secondary" loading={resolver.pending}>
          Vincular
        </Button>
      </div>
    </form>
  );
}
