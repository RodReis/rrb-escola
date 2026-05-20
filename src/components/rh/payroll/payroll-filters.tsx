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
    <div className="flex items-center gap-0 rounded-ui border border-line bg-surface shadow-soft overflow-hidden">
      <SearchInline
        defaultValue={search}
        placeholder="Buscar por nome ou CPF..."
        containerClassName="flex-1 px-3 py-2"
        onChange={(e) => {
          const value = (e.target as HTMLInputElement).value;
          clearTimeout((window as unknown as Record<string, ReturnType<typeof setTimeout>>)._payrollSearchTimer);
          (window as unknown as Record<string, ReturnType<typeof setTimeout>>)._payrollSearchTimer = setTimeout(
            () => update("search", value),
            300
          );
        }}
      />

      <div className="w-px self-stretch bg-line" />

      <select
        value={companyId}
        onChange={(e) => update("companyId", e.target.value)}
        className="h-full min-w-[180px] bg-transparent px-3 py-2 text-sm text-ink focus:outline-none cursor-pointer"
      >
        <option value="">Todas as empresas</option>
        {companies.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>

      {hasFilters && (
        <>
          <div className="w-px self-stretch bg-line" />
          <button
            type="button"
            title="Limpar filtros"
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-ink/50 hover:text-brand hover:bg-brand/5 transition-colors"
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
