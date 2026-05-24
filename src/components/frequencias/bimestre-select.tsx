"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";

export function BimestreSelect({ value }: { value: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  return (
    <label className="text-xs font-semibold text-ink/60">
      Bimestre:&nbsp;
      <select
        className="ml-1 rounded-ui border border-line px-2 py-1 text-xs"
        value={String(value)}
        onChange={(e) => {
          const params = new URLSearchParams(sp?.toString() ?? "");
          params.set("bim", e.target.value);
          params.set("tab", "notas");
          router.replace(`${pathname}?${params.toString()}`);
        }}
      >
        <option value="1">1º Bim</option>
        <option value="2">2º Bim</option>
        <option value="3">3º Bim</option>
        <option value="4">4º Bim</option>
      </select>
    </label>
  );
}
