"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { BookOpen } from "lucide-react";
import type { DisciplinaOption } from "@/lib/data/lancamento-notas";

export function DisciplinasCards({
  disciplinas,
  disciplinaSel,
}: {
  disciplinas: DisciplinaOption[];
  disciplinaSel: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  function select(id: string) {
    const params = new URLSearchParams(sp?.toString() ?? "");
    if (params.get("disciplina") === id) return;
    params.set("disciplina", id);
    router.replace(`${pathname}?${params.toString()}`);
  }

  if (disciplinas.length === 0) {
    return (
      <div className="rounded-ui bg-muted/30 p-6 text-center text-sm text-ink/40">
        Esta série não tem disciplinas cadastradas.
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {disciplinas.map((d) => {
        const ativo = d.id === disciplinaSel;
        return (
          <button
            key={d.id}
            type="button"
            onClick={() => select(d.id)}
            className={`group flex flex-col items-start gap-2 rounded-panel border p-3 text-left transition ${
              ativo
                ? "border-brand bg-brand/10 shadow-soft"
                : "border-line bg-surface hover:border-brand/40 hover:bg-muted/40"
            }`}
          >
            <span
              className={`grid h-8 w-8 place-items-center rounded-ui ${
                ativo ? "bg-brand text-paper" : "bg-muted text-ink/60 group-hover:bg-brand/20"
              }`}
            >
              <BookOpen size={14} />
            </span>
            <p className={`text-sm font-bold ${ativo ? "text-brand" : "text-ink"}`}>
              {d.nome}
            </p>
          </button>
        );
      })}
    </div>
  );
}
