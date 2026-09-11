"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback } from "react";
import { FilterChips } from "@/components/ui/filter-chips";
import { FilterDropdown, type DropdownOption } from "@/components/ui/filter-dropdown";
import { SearchInline } from "@/components/ui/search-inline";

type Counts = { all: number; infantil: number; fund1: number; fund2: number; medio: number };

export type SerieOption = { id: string; nome: string; segmento: string | null };
export type TurmaOption = { id: string; nome: string; serie_id: string | null; turno?: string | null };

const TURNO_LABEL: Record<string, string> = {
  matutino: "Matutino",
  vespertino: "Vespertino",
  noturno: "Noturno",
  integral: "Integral"
};

const SEGMENTO_LABEL: Record<string, string> = {
  INFANTIL: "Educação Infantil",
  FUNDAMENTAL1: "Ensino Fundamental I",
  FUNDAMENTAL2: "Ensino Fundamental II",
  MEDIO: "Ensino Médio"
};

export function StudentFilters({
  counts,
  series = [],
  turmas = []
}: {
  counts?: Counts;
  series?: SerieOption[];
  turmas?: TurmaOption[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const nome     = searchParams.get("nome") ?? "";
  const segmento = searchParams.get("segmento") ?? "";
  const serie    = searchParams.get("serie") ?? "";
  const turma    = searchParams.get("turma") ?? "";

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

  // Segmento escolhido nos chips restringe as series ofertadas no combo.
  const seriesVisiveis = segmento ? series.filter((s) => s.segmento === segmento) : series;

  const serieOptions: DropdownOption[] = seriesVisiveis.map((s) => ({
    value: s.id,
    label: s.nome,
    group: SEGMENTO_LABEL[s.segmento ?? ""] ?? "Outros"
  }));

  // Sem serie escolhida varias turmas repetem o mesmo nome ("A"), entao prefixa a serie.
  const nomeSeriePorId = new Map(series.map((s) => [s.id, s.nome]));

  const turmaOptions: DropdownOption[] = turmas
    .filter((t) => (serie ? t.serie_id === serie : seriesVisiveis.some((s) => s.id === t.serie_id)))
    .map((t) => {
      const nomeSerie = t.serie_id ? nomeSeriePorId.get(t.serie_id) : null;
      return {
        value: t.id,
        label: serie || !nomeSerie ? t.nome : `${nomeSerie} · ${t.nome}`,
        group: TURNO_LABEL[t.turno ?? ""] ?? "Outros turnos"
      };
    });

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
        onChange={(v) => update("segmento", v, ["serie", "turma", "page"])}
      />

      <FilterDropdown
        label="Série"
        value={serie}
        options={serieOptions}
        emptyLabel="Todas"
        onChange={(v) => update("serie", v, ["turma", "page"])}
      />

      <FilterDropdown
        label="Turma"
        value={turma}
        options={turmaOptions}
        emptyLabel="Todas"
        disabled={turmaOptions.length === 0}
        onChange={(v) => update("turma", v, ["page"])}
      />

      <SearchInline
        defaultValue={nome}
        placeholder="Buscar por nome, matrícula ou responsável..."
        bordered
        containerClassName="flex-1 min-w-[280px]"
        onChange={(e) => {
          const value = (e.target as HTMLInputElement).value;
          clearTimeout((window as unknown as Record<string, ReturnType<typeof setTimeout>>)._nomeTimer);
          (window as unknown as Record<string, ReturnType<typeof setTimeout>>)._nomeTimer = setTimeout(
            () => update("nome", value, ["page"]),
            300
          );
        }}
      />

      {(nome || segmento || serie || turma) && (
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
