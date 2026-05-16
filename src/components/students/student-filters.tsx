"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback } from "react";
import { FilterChips } from "@/components/ui/filter-chips";
import { SearchInline } from "@/components/ui/search-inline";

type Counts = { all: number; infantil: number; fund1: number; fund2: number; medio: number };

export function StudentFilters({ counts }: { counts?: Counts }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const nome     = searchParams.get("nome") ?? "";
  const segmento = searchParams.get("segmento") ?? "";

  const update = useCallback(
    (key: string, value: string, clear?: string[]) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) params.set(key, value);
      else params.delete(key);
      for (const k of clear ?? []) params.delete(k);
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams]
  );

  const chips = [
    { value: "",             label: "Todos",    count: counts?.all },
    { value: "INFANTIL",     label: "Infantil", count: counts?.infantil },
    { value: "FUNDAMENTAL1", label: "Fund. I",  count: counts?.fund1 },
    { value: "FUNDAMENTAL2", label: "Fund. II", count: counts?.fund2 },
    { value: "MEDIO",        label: "Médio",    count: counts?.medio }
  ];

  return (
    <div className="flex w-full flex-wrap items-center gap-4">
      <FilterChips
        items={chips}
        value={segmento}
        onChange={(v) => update("segmento", v, ["serie", "turma"])}
      />

      <div className="flex flex-1 min-w-[280px] items-center gap-2 rounded-ui border border-line bg-paper px-3 py-1.5 focus-within:border-brand/60 focus-within:bg-surface focus-within:shadow-ring transition">
        <SearchInline
          defaultValue={nome}
          placeholder="Buscar por nome, matrícula ou responsável..."
          onChange={(e) => {
            const value = (e.target as HTMLInputElement).value;
            clearTimeout((window as unknown as Record<string, ReturnType<typeof setTimeout>>)._nomeTimer);
            (window as unknown as Record<string, ReturnType<typeof setTimeout>>)._nomeTimer = setTimeout(
              () => update("nome", value),
              300
            );
          }}
        />
      </div>

      {(nome || segmento) && (
        <button
          type="button"
          className="text-xs font-semibold text-ink/55 hover:text-brand"
          onClick={() => router.push(pathname)}
        >
          Limpar
        </button>
      )}
    </div>
  );
}
