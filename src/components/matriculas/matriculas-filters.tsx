"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useTransition } from "react";
import { FilterChips } from "@/components/ui/filter-chips";
import { FilterDropdown } from "@/components/ui/filter-dropdown";
import { SearchInline } from "@/components/ui/search-inline";

type Counts = { all: number; ativa: number; concluida: number; cancelada: number; transferida: number };

const TIPO_VAGA_OPTIONS = [
  { value: "NORMAL", label: "Normal" },
  { value: "BOLSA_50_PORCENTO", label: "Bolsa 50%" },
  { value: "BOLSA_INTEGRAL", label: "Bolsa integral" },
  { value: "FILHO_PROFESSORA", label: "Filho de professora" },
  { value: "FILHO_PROFESSORA_INTEGRAL", label: "Filho de professora integral" },
  { value: "PERMUTA", label: "Permuta" },
  { value: "ISENTO", label: "Isento" },
];

export function MatriculasFilters({ counts }: { counts: Counts }) {
  const router   = useRouter();
  const pathname = usePathname();
  const params   = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const status   = params.get("status")    ?? "";
  const nome     = params.get("nome")      ?? "";
  const tipoVaga = params.get("tipo_vaga") ?? "";

  const update = useCallback(
    (key: string, value: string, clear?: string[]) => {
      const p = new URLSearchParams(params.toString());
      if (value) p.set(key, value); else p.delete(key);
      for (const k of clear ?? []) p.delete(k);
      startTransition(() => router.push(`${pathname}?${p.toString()}`));
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
    <div className="flex w-full flex-col gap-3">
      <div className="flex flex-wrap items-center gap-4">
        <FilterChips
          items={chips}
          value={status}
          onChange={(v) => update("status", v)}
        />

        <FilterDropdown
          label="Tipo da vaga"
          value={tipoVaga}
          options={TIPO_VAGA_OPTIONS}
          onChange={(v) => update("tipo_vaga", v)}
        />

        {(nome || status || tipoVaga) && (
          <button
            type="button"
            className="text-xs font-semibold text-ink/60 hover:text-brand"
            onClick={() => startTransition(() => router.push(pathname))}
          >
            Limpar filtros
          </button>
        )}
      </div>

      <div className="flex w-full items-center gap-4">
        <SearchInline
          defaultValue={nome}
          placeholder="Buscar por aluno ou matrícula..."
          bordered
          loading={isPending}
          containerClassName="flex-1 min-w-0"
          onChange={(e) => {
            const val = (e.target as HTMLInputElement).value;
            clearTimeout((window as unknown as Record<string, ReturnType<typeof setTimeout>>)._matriculaTimer);
            (window as unknown as Record<string, ReturnType<typeof setTimeout>>)._matriculaTimer = setTimeout(
              () => update("nome", val),
              300
            );
          }}
        />
      </div>
    </div>
  );
}
