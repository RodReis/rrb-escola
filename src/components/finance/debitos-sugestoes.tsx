"use client";

import { useMemo, useState } from "react";
import { Panel } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { money } from "@/lib/constants";
import { classificarDebitoAction } from "@/lib/actions/debitos";
import { useAction } from "@/lib/hooks/use-action";
import type { DebitosData, SugestaoDebito } from "@/lib/data/debitos";

function dateText(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("pt-BR");
}

type Grupo = {
  regraId: string;
  categoriaNome: string;
  categoriaId: string;
  companyId: string | null;
  classeDespesa: "fixa" | "variavel" | null;
  sugestoes: SugestaoDebito[];
  total: number;
};

/**
 * Uma sugestão por movimento viraria N cliques individuais para um lote
 * coberto pela mesma regra (ex.: 124 débitos da Task 9) — I3 agrupa por
 * `regraId` (mesma categoria/empresa/classe), com checkbox por movimento
 * (todos marcados por padrão) e "confirmar selecionados" numa única chamada
 * à RPC (classificarDebitoAction já aceita array de ids).
 */
function GrupoSugestoes({ grupo }: { grupo: Grupo }) {
  const [selecionados, setSelecionados] = useState<Set<string>>(
    () => new Set(grupo.sugestoes.map((s) => s.id)),
  );
  const { run, pending } = useAction((formData: FormData) => classificarDebitoAction(formData));

  function toggle(id: string) {
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const ids = grupo.sugestoes.filter((s) => selecionados.has(s.id)).map((s) => s.id);

  return (
    <Panel className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-semibold text-brand">Sugestão: {grupo.categoriaNome}</span>
        <strong className="tabular-nums text-clay">{money.format(grupo.total)}</strong>
      </div>

      <div className="grid gap-1">
        {grupo.sugestoes.map((s) => (
          <label key={s.id} className="flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={selecionados.has(s.id)}
              onChange={() => toggle(s.id)}
            />
            <span className="w-24 shrink-0 text-ink/60">{dateText(s.data)}</span>
            <span className="flex-1 truncate text-ink/70">{s.descricao}</span>
            <strong className="tabular-nums text-clay">{money.format(s.valor)}</strong>
          </label>
        ))}
      </div>

      <div className="flex justify-end">
        <form
          action={(formData) => run(formData)}
        >
          {ids.map((id) => (
            <input key={id} type="hidden" name="extrato_id" value={id} />
          ))}
          <input type="hidden" name="categoria_id" value={grupo.categoriaId} />
          <input type="hidden" name="company_id" value={grupo.companyId ?? ""} />
          <input type="hidden" name="classe_despesa" value={grupo.classeDespesa ?? ""} />
          <Button type="submit" variant="primary" className="text-xs" loading={pending} disabled={ids.length === 0}>
            Confirmar selecionados ({ids.length})
          </Button>
        </form>
      </div>
    </Panel>
  );
}

/** O que a regra de contraparte já reconheceu. Confirmar cria o lançamento; a sugestão nunca lança sozinha (D1). */
export function DebitosSugestoes({ data }: { data: DebitosData }) {
  const grupos = useMemo(() => {
    const porRegra = new Map<string, Grupo>();
    for (const s of data.sugestoes) {
      const existente = porRegra.get(s.regraId);
      if (existente) {
        existente.sugestoes.push(s);
        existente.total += s.valor;
      } else {
        porRegra.set(s.regraId, {
          regraId: s.regraId,
          categoriaNome: s.categoriaNome,
          categoriaId: s.categoriaId,
          companyId: s.companyId,
          classeDespesa: s.classeDespesa,
          sugestoes: [s],
          total: s.valor,
        });
      }
    }
    return Array.from(porRegra.values()).sort((a, b) => b.total - a.total);
  }, [data.sugestoes]);

  if (grupos.length === 0) {
    return (
      <Panel>
        <p className="py-8 text-center text-sm text-ink/60">Nenhuma sugestão no momento.</p>
      </Panel>
    );
  }

  return (
    <section className="grid gap-3">
      {grupos.map((grupo) => (
        <GrupoSugestoes key={grupo.regraId} grupo={grupo} />
      ))}
    </section>
  );
}
