"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback } from "react";

type Serie = { id: string; nome: string; segmento: string | null };
type Turma = { id: string; nome: string; serie_id: string };

const SEGMENTOS = [
  { value: "INFANTIL",     label: "Infantil" },
  { value: "FUNDAMENTAL1", label: "Fundamental I" },
  { value: "FUNDAMENTAL2", label: "Fundamental II" },
  { value: "MEDIO",        label: "Médio" },
];

export function StudentFilters({ series, turmas }: { series: Serie[]; turmas: Turma[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const nome      = searchParams.get("nome") ?? "";
  const segmento  = searchParams.get("segmento") ?? "";
  const serieId   = searchParams.get("serie") ?? "";
  const turmaId   = searchParams.get("turma") ?? "";

  const update = useCallback(
    (key: string, value: string, clear?: string[]) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) params.set(key, value);
      else params.delete(key);
      for (const k of clear ?? []) params.delete(k);
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams],
  );

  const filteredSeries = segmento
    ? series.filter((s) => s.segmento === segmento)
    : series;

  const filteredTurmas = serieId
    ? turmas.filter((t) => t.serie_id === serieId)
    : segmento
      ? turmas.filter((t) => filteredSeries.some((s) => s.id === t.serie_id))
      : turmas;

  return (
    <div className="flex flex-wrap gap-3">
      <input
        type="search"
        placeholder="Buscar por nome..."
        defaultValue={nome}
        className="min-w-[200px] flex-1"
        onChange={(e) => {
          clearTimeout((window as unknown as Record<string, ReturnType<typeof setTimeout>>)._nomeTimer);
          (window as unknown as Record<string, ReturnType<typeof setTimeout>>)._nomeTimer = setTimeout(
            () => update("nome", e.target.value),
            350,
          );
        }}
      />

      <select
        value={segmento}
        onChange={(e) => update("segmento", e.target.value, ["serie", "turma"])}
        className="min-w-[160px]"
      >
        <option value="">Segmento</option>
        {SEGMENTOS.map((s) => (
          <option key={s.value} value={s.value}>{s.label}</option>
        ))}
      </select>

      <select
        value={serieId}
        onChange={(e) => update("serie", e.target.value, ["turma"])}
        className="min-w-[140px]"
      >
        <option value="">Série</option>
        {filteredSeries.map((s) => (
          <option key={s.id} value={s.id}>{s.nome}</option>
        ))}
      </select>

      <select
        value={turmaId}
        onChange={(e) => update("turma", e.target.value)}
        className="min-w-[140px]"
      >
        <option value="">Turma</option>
        {filteredTurmas.map((t) => (
          <option key={t.id} value={t.id}>{t.nome}</option>
        ))}
      </select>

      {(nome || segmento || serieId || turmaId) && (
        <button
          className="ds-button ds-button-secondary min-h-0 px-3 py-2 text-xs"
          onClick={() => router.push(pathname)}
        >
          Limpar
        </button>
      )}
    </div>
  );
}
