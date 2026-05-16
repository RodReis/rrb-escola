"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback } from "react";
import { FilterChips } from "@/components/ui/filter-chips";
import { FilterDropdown } from "@/components/ui/filter-dropdown";
import { SearchInline } from "@/components/ui/search-inline";
import type { Company } from "@/lib/data/rh";
import type { EmployeeSegmentCounts } from "@/lib/data/rh";

type Props = {
  companies: Company[];
  counts: EmployeeSegmentCounts;
  canViewInactive: boolean;
};

export function EmployeeFilters({ companies, counts, canViewInactive }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const search = searchParams.get("search") ?? "";
  const segmento = searchParams.get("segmento") ?? "";
  const companyId = searchParams.get("empresa") ?? "";
  const statusContrato = searchParams.get("contrato") ?? "";
  const incluirInativos = searchParams.get("inativos") === "1";

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
    { value: "",      label: "Todos",     count: counts.all },
    { value: "admin", label: "Admin",     count: counts.admin },
    { value: "fund1", label: "Fund. I",   count: counts.fund1 },
    { value: "fund2", label: "Fund. II",  count: counts.fund2 },
    { value: "medio", label: "Médio",     count: counts.medio }
  ];

  return (
    <div className="flex w-full flex-wrap items-center gap-4">
      <FilterChips
        items={chips}
        value={segmento}
        onChange={(v) => update("segmento", v)}
      />

      <div className="flex flex-1 min-w-[260px] items-center gap-2 rounded-ui border border-line bg-paper px-3 py-1.5 focus-within:border-brand/60 focus-within:bg-surface focus-within:shadow-ring transition">
        <SearchInline
          defaultValue={search}
          placeholder="Buscar por nome, CPF ou e-mail..."
          onChange={(e) => {
            const value = (e.target as HTMLInputElement).value;
            clearTimeout((window as unknown as Record<string, ReturnType<typeof setTimeout>>)._empSearchTimer);
            (window as unknown as Record<string, ReturnType<typeof setTimeout>>)._empSearchTimer = setTimeout(
              () => update("search", value),
              300
            );
          }}
        />
      </div>

      <FilterDropdown
        label="Empresa"
        value={companyId}
        options={companies.map((c) => ({ value: c.id, label: c.name }))}
        onChange={(v) => update("empresa", v)}
        emptyLabel="Todas"
      />

      <FilterDropdown
        label="Contrato"
        value={statusContrato}
        options={[
          { value: "CLT", label: "CLT" },
          { value: "PJ", label: "PJ" },
          { value: "Estagio", label: "Estágio" },
          { value: "Temporario", label: "Temporário" }
        ]}
        onChange={(v) => update("contrato", v)}
        emptyLabel="Todos"
      />

      {canViewInactive ? (
        <label className="inline-flex items-center gap-2 text-xs font-semibold text-ink/70">
          <input
            type="checkbox"
            checked={incluirInativos}
            onChange={(e) => update("inativos", e.target.checked ? "1" : "")}
            className="h-4 w-4 accent-brand"
          />
          Incluir inativos
        </label>
      ) : null}

      {(search || segmento || companyId || statusContrato || incluirInativos) && (
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
