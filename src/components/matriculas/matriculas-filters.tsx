"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback } from "react";
import { FilterChips } from "@/components/ui/filter-chips";
import { SearchInline } from "@/components/ui/search-inline";

type Counts = { all: number; ativa: number; concluida: number; cancelada: number; transferida: number };

export function MatriculasFilters({ counts }: { counts: Counts }) {
  const router   = useRouter();
  const pathname = usePathname();
  const params   = useSearchParams();

  const status = params.get("status") ?? "";
  const nome   = params.get("nome")   ?? "";

  const update = useCallback(
    (key: string, value: string, clear?: string[]) => {
      const p = new URLSearchParams(params.toString());
      if (value) p.set(key, value); else p.delete(key);
      for (const k of clear ?? []) p.delete(k);
      router.push(`${pathname}?${p.toString()}`);
    },
    [router, pathname, params]
  );

  const chips = [
    { value: "",           label: "Todos",       count: counts.all },
    { value: "ativa",      label: "Ativas",      count: counts.ativa },
    { value: "concluida",  label: "Concluídas",  count: counts.concluida },
    { value: "cancelada",  label: "Canceladas",  count: counts.cancelada },
    { value: "transferida",label: "Transferidas",count: counts.transferida },
  ];

  return (
    <div className="flex w-full flex-wrap items-center gap-4">
      <FilterChips
        items={chips}
        value={status}
        onChange={(v) => update("status", v)}
      />

      <SearchInline
        defaultValue={nome}
        placeholder="Buscar por aluno ou matrícula..."
        bordered
        containerClassName="flex-1 min-w-[280px]"
        onChange={(e) => {
          const val = (e.target as HTMLInputElement).value;
          clearTimeout((window as unknown as Record<string, ReturnType<typeof setTimeout>>)._matriculaTimer);
          (window as unknown as Record<string, ReturnType<typeof setTimeout>>)._matriculaTimer = setTimeout(
            () => update("nome", val),
            300
          );
        }}
      />

      {(nome || status) && (
        <button
          type="button"
          className="text-xs font-semibold text-ink/60 hover:text-brand"
          onClick={() => router.push(pathname)}
        >
          Limpar filtros
        </button>
      )}
    </div>
  );
}
