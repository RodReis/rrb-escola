"use client";

import { useState, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, ChevronRight, Search } from "lucide-react";
import { cn } from "@/lib/utils";

type Turma = { id: string; nome: string; alunos: number; serieNome: string };
type Segmento = { id: string; nome: string; alunos: number; turmas: Turma[] };

const segmentoBulletColor: Record<string, string> = {
  "Educação Infantil": "bg-yellow-400",
  "Ensino Fundamental I": "bg-blue-500",
  "Ensino Fundamental II": "bg-green-500",
  "Ensino Médio": "bg-red-500"
};

export function OrganogramaSidebar({
  tree,
  totalAlunos,
  escolaNome
}: {
  tree: Segmento[];
  totalAlunos: number;
  escolaNome: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const turmaAtiva = searchParams.get("turma");

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [busca, setBusca] = useState("");

  function toggleSegmento(id: string) {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function selectTurma(id: string) {
    router.push(`/organograma?turma=${id}`);
  }

  const filtered = useMemo(() => {
    if (!busca.trim()) return tree;
    const q = busca.toLowerCase();
    return tree
      .map((seg) => ({
        ...seg,
        turmas: seg.turmas.filter(
          (t) => t.nome.toLowerCase().includes(q) || t.serieNome.toLowerCase().includes(q)
        )
      }))
      .filter((seg) => seg.turmas.length > 0);
  }, [tree, busca]);

  return (
    <aside className="flex w-[280px] shrink-0 flex-col gap-4 border-r border-line pr-4">
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink/40" />
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar aluno ou turma..."
          className="w-full rounded-ui border border-line bg-surface py-2 pl-8 pr-3 text-sm outline-none focus:border-brand"
        />
      </div>

      <div className="flex items-center gap-2 rounded-ui bg-muted px-3 py-2">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand/10 text-brand text-xs font-black">
          {escolaNome.slice(0, 2).toUpperCase()}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-black text-ink">{escolaNome}</p>
          <p className="text-xs text-ink/55">{totalAlunos} alunos · {tree.length} segmentos</p>
        </div>
      </div>

      <nav className="flex flex-col gap-1">
        {filtered.map((seg) => {
          const isOpen = expanded[seg.id] ?? false;
          const bullet = segmentoBulletColor[seg.nome] ?? "bg-ink/30";

          return (
            <div key={seg.id}>
              <button
                onClick={() => toggleSegmento(seg.id)}
                className="flex w-full items-center gap-2 rounded-ui px-2 py-2 text-left text-sm font-black text-ink hover:bg-muted"
              >
                <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", bullet)} />
                <span className="flex-1 truncate">{seg.nome}</span>
                <span className="text-xs font-medium text-ink/50">
                  {seg.alunos} · {seg.turmas.length} turmas
                </span>
                {isOpen
                  ? <ChevronDown size={14} className="shrink-0 text-ink/40" />
                  : <ChevronRight size={14} className="shrink-0 text-ink/40" />
                }
              </button>

              {isOpen && (
                <div className="ml-4 mt-0.5 flex flex-col gap-0.5 border-l border-line pl-3">
                  {seg.turmas.map((turma) => {
                    const isActive = turmaAtiva === turma.id;
                    return (
                      <button
                        key={turma.id}
                        onClick={() => selectTurma(turma.id)}
                        className={cn(
                          "flex w-full items-center justify-between rounded-ui px-2 py-1.5 text-left text-sm transition",
                          isActive
                            ? "border-l-2 border-brand bg-brand/8 font-black text-brand -ml-[1px]"
                            : "font-medium text-ink/75 hover:bg-muted hover:text-ink"
                        )}
                      >
                        <span className="truncate">{turma.serieNome} - {turma.nome}</span>
                        <span className="ml-2 shrink-0 text-xs text-ink/45">{turma.alunos} alunos</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
