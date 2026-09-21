"use client";

import { createVerbaAction, deleteVerbaAction } from "@/lib/actions/folha-cadastros";
import { useAction } from "@/lib/hooks/use-action";
import { Button } from "@/components/ui/button";
import { DataTableShell } from "@/components/ui/data-table";
import { StatusPill } from "@/components/ui/status-pill";
import { CurrencyField } from "@/components/folha/currency-field";
import { money } from "@/lib/constants";

type VerbaRow = {
  id: string;
  valor: number | null;
  percentual: number | null;
  ativa: boolean;
  folha_rubricas: { id: string; codigo: string; nome: string } | null;
};

function VerbaLine({ v }: { v: VerbaRow }) {
  const { run, pending } = useAction(deleteVerbaAction, {
    success: "Verba removida.",
    error: "Falha ao remover a verba.",
  });

  function handleDelete() {
    const fd = new FormData();
    fd.set("id", v.id);
    run(fd);
  }

  return (
    <tr>
      <td className="font-medium">
        {v.folha_rubricas ? `${v.folha_rubricas.codigo} — ${v.folha_rubricas.nome}` : "—"}
      </td>
      <td className="text-right tabular-nums">
        {v.valor != null ? money.format(Number(v.valor)) : "—"}
      </td>
      <td className="text-right tabular-nums">
        {v.percentual != null ? `${Number(v.percentual).toFixed(2)}%` : "—"}
      </td>
      <td>
        <StatusPill tone={v.ativa ? "success" : "neutral"}>
          {v.ativa ? "Ativa" : "Inativa"}
        </StatusPill>
      </td>
      <td className="text-right">
        <button
          type="button"
          onClick={handleDelete}
          disabled={pending}
          className="text-xs font-semibold text-danger hover:underline disabled:opacity-50"
        >
          {pending ? "Removendo…" : "Remover"}
        </button>
      </td>
    </tr>
  );
}

export function VerbasContratuais({
  contratoId,
  verbas,
  rubricas,
}: {
  contratoId: string;
  verbas: VerbaRow[];
  rubricas: { id: string; codigo: string; nome: string; ativa: boolean }[];
}) {
  const { run, pending } = useAction(createVerbaAction, {
    success: "Verba adicionada.",
    error: "Falha ao adicionar a verba.",
  });

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    run(new FormData(e.currentTarget));
    e.currentTarget.reset();
  }

  return (
    <>
      <DataTableShell>
        <table className="ds-dt min-w-[580px]">
          <thead>
            <tr>
              <th>Rubrica</th>
              <th className="text-right">Valor (R$)</th>
              <th className="text-right">Percentual (%)</th>
              <th>Status</th>
              <th className="text-right">Remover</th>
            </tr>
          </thead>
          <tbody>
            {verbas.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-4 text-center text-sm text-ink/60">
                  Nenhuma verba contratual.
                </td>
              </tr>
            ) : null}
            {verbas.map((v) => (
              <VerbaLine key={v.id} v={v} />
            ))}
          </tbody>
        </table>
      </DataTableShell>

      <form onSubmit={handleSubmit} className="mt-4 flex flex-wrap items-end gap-3">
        <input type="hidden" name="contrato_id" value={contratoId} />
        <label className="flex flex-col gap-1 text-sm font-medium text-ink/80">
          Rubrica
          <select name="rubrica_id" required className="min-w-[220px]">
            <option value="">Selecione…</option>
            {rubricas.filter((r) => r.ativa).map((r) => (
              <option key={r.id} value={r.id}>{r.codigo} — {r.nome}</option>
            ))}
          </select>
        </label>
        <CurrencyField name="valor" label="Valor" placeholder="Ou use percentual" className="w-36" />
        <label className="flex flex-col gap-1 text-sm font-medium text-ink/80">
          Percentual (%)
          <input name="percentual" type="number" step="0.0001" min="0" placeholder="Ou use valor" className="w-28" />
        </label>
        <label className="flex items-center gap-2 text-sm font-medium text-ink/80 cursor-pointer mt-5">
          <input type="checkbox" name="ativa" defaultChecked className="h-4 w-4 shrink-0 accent-brand" /> Ativa
        </label>
        <Button type="submit" variant="secondary" loading={pending} className="mt-5">Adicionar verba</Button>
      </form>
    </>
  );
}
