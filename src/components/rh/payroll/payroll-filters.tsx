"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback } from "react";
import { X } from "lucide-react";
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

  const hasFilters = search || companyId;

  return (
    <div className="flex items-center gap-0 flex-1 overflow-hidden">
      <select
        value={companyId}
        onChange={(e) => update("companyId", e.target.value)}
        className="w-[220px] shrink-0 bg-transparent text-sm text-ink focus:outline-none cursor-pointer"
      >
        <option value="">Todas as empresas</option>
        {companies.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>

      <div className="w-px self-stretch bg-line" />

      <SearchInline
        defaultValue={search}
        placeholder="Buscar por nome ou CPF..."
        containerClassName="flex-1"
        onChange={(e) => {
          const value = (e.target as HTMLInputElement).value;
          clearTimeout((window as unknown as Record<string, ReturnType<typeof setTimeout>>)._payrollSearchTimer);
          (window as unknown as Record<string, ReturnType<typeof setTimeout>>)._payrollSearchTimer = setTimeout(
            () => update("search", value),
            300
          );
        }}
      />

      {hasFilters && (
        <>
          <div className="w-px self-stretch bg-line" />
          <button
            type="button"
            title="Limpar filtros"
            className="flex items-center gap-1.5 px-2 text-xs font-semibold text-ink/50 hover:text-brand transition-colors"
            onClick={() => router.push(pathname)}
          >
            <X size={13} strokeWidth={2.5} />
            Limpar
          </button>
        </>
      )}
    </div>
  );
}
