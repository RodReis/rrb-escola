"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import type { TurmaComSerie, DisciplinaOption } from "@/lib/data/lancamento-notas";

export function FiltrosLancamento({
  turmasComSerie,
  disciplinas,
  serieSel,
  turmaSel,
  disciplinaSel,
  ano,
}: {
  turmasComSerie: TurmaComSerie[];
  disciplinas: DisciplinaOption[];
  serieSel: string | null;
  turmaSel: string | null;
  disciplinaSel: string | null;
  ano: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  // Séries únicas
  const seen = new Set<string>();
  const series = turmasComSerie
    .filter((t) => {
      if (seen.has(t.serieId)) return false;
      seen.add(t.serieId);
      return true;
    })
    .map((t) => ({ id: t.serieId, nome: t.serieNome, ordem: t.serieOrdem }))
    .sort((a, b) => a.ordem - b.ordem);

  // Turmas da série selecionada
  const turmasDaSerie = serieSel
    ? turmasComSerie
        .filter((t) => t.serieId === serieSel)
        .sort((a, b) => a.turmaNome.localeCompare(b.turmaNome, "pt-BR"))
    : [];

  function push(updates: Record<string, string | null>) {
    const params = new URLSearchParams(sp?.toString() ?? "");
    for (const [k, v] of Object.entries(updates)) {
      if (v == null || v === "") params.delete(k);
      else params.set(k, v);
    }
    if (!params.has("ano")) params.set("ano", String(ano));
    router.replace(`${pathname}?${params.toString()}`);
  }

  return (
    <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <label className="text-sm">
        Série
        <select
          value={serieSel ?? ""}
          onChange={(e) => push({ serie: e.target.value || null, turma: null, disciplina: null })}
          className="mt-1 w-full"
        >
          <option value="">Selecione…</option>
          {series.map((s) => (
            <option key={s.id} value={s.id}>
              {s.nome}
            </option>
          ))}
        </select>
      </label>

      <label className="text-sm">
        Turma
        <select
          value={turmaSel ?? ""}
          disabled={!serieSel}
          onChange={(e) => push({ turma: e.target.value || null, disciplina: null })}
          className="mt-1 w-full"
        >
          <option value="">Selecione…</option>
          {turmasDaSerie.map((t) => (
            <option key={t.turmaId} value={t.turmaId}>
              {t.turmaNome}
            </option>
          ))}
        </select>
      </label>

      <label className="text-sm">
        Disciplina
        <select
          value={disciplinaSel ?? ""}
          disabled={!turmaSel || disciplinas.length === 0}
          onChange={(e) => push({ disciplina: e.target.value || null })}
          className="mt-1 w-full"
        >
          <option value="">
            {disciplinas.length === 0 && turmaSel ? "Sem disciplinas" : "Selecione…"}
          </option>
          {disciplinas.map((d) => (
            <option key={d.id} value={d.id}>
              {d.nome}
            </option>
          ))}
        </select>
      </label>

      <label className="text-sm">
        Ano letivo
        <input
          type="number"
          min={2000}
          max={2100}
          defaultValue={ano}
          onBlur={(e) => {
            const v = Number(e.target.value);
            if (Number.isInteger(v) && v >= 2000 && v <= 2100 && v !== ano) {
              push({ ano: String(v) });
            }
          }}
          className="mt-1 w-full"
        />
      </label>
    </section>
  );
}
