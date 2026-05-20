"use client";

import { useRouter } from "next/navigation";

export function VigenciaSelect({
  table,
  vigencias,
  current
}: {
  table: "inss" | "ir";
  vigencias: string[];
  current?: string;
}) {
  const router = useRouter();
  return (
    <select
      defaultValue={current ?? ""}
      onChange={(e) => router.push(`/rh/brackets?tab=${table}&vigencia=${e.target.value}`)}
      className="text-sm"
    >
      {vigencias.map((v) => (
        <option key={v} value={v}>Vigência: {v}</option>
      ))}
    </select>
  );
}
