"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback } from "react";
import { SearchInline } from "@/components/ui/search-inline";

export function PayrollFilters({
  companies
}: {
  companies: { id: string; name: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const search    = searchParams.get("search") ?? "";
  const companyId = searchParams.get("companyId") ?? "";

  const update = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) params.set(key, value);
      else params.delete(key);
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams]
  );

  return (
    <div className="flex w-full flex-wrap items-center gap-3">
      <SearchInline
        defaultValue={search}
        placeholder="Buscar por nome ou CPF..."
        bordered
        containerClassName="flex-1 min-w-[240px]"
        onChange={(e) => {
          const value = (e.target as HTMLInputElement).value;
          clearTimeout((window as unknown as Record<string, ReturnType<typeof setTimeout>>)._payrollSearchTimer);
          (window as unknown as Record<string, ReturnType<typeof setTimeout>>)._payrollSearchTimer = setTimeout(
            () => update("search", value),
            300
          );
        }}
      />

      <select
        value={companyId}
        onChange={(e) => update("companyId", e.target.value)}
        className="h-9 rounded-ui border border-line bg-surface px-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand/40"
      >
        <option value="">Todas as empresas</option>
        {companies.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>

      {(search || companyId) && (
        <button
          type="button"
          className="text-xs font-semibold text-ink/55 hover:text-brand"
          onClick={() => router.push(pathname)}
        >
          Limpar filtros
        </button>
      )}
    </div>
  );
}
