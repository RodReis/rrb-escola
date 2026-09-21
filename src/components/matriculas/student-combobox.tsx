"use client";

import { useState, useRef, useEffect } from "react";
import { Search } from "lucide-react";
import { normalizeNome } from "@/lib/format/normalize-nome";

type Aluno = {
  id: string;
  nome: string;
  matricula_codigo: string;
  data_nascimento?: string | null;
  matriculas?: { ano_letivo: number; status: string }[] | null;
};

export function StudentCombobox({
  alunos,
  defaultValue,
  onSelect,
}: {
  alunos: Aluno[];
  defaultValue?: Aluno;
  onSelect?: (aluno: Aluno | null) => void;
}) {
  const [query, setQuery] = useState(defaultValue?.nome ?? "");
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Aluno | null>(defaultValue ?? null);
  const containerRef = useRef<HTMLDivElement>(null);

  const queryNormalizada = normalizeNome(query);
  const filtered = query.length < 1
    ? []
    : alunos
        .filter((a) =>
          normalizeNome(a.nome).includes(queryNormalizada) ||
          a.matricula_codigo.includes(query)
        )
        .slice(0, 10);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function select(aluno: Aluno) {
    setSelected(aluno);
    setQuery(aluno.nome);
    setOpen(false);
    onSelect?.(aluno);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setQuery(e.target.value);
    setSelected(null);
    setOpen(true);
    onSelect?.(null);
  }

  return (
    <div ref={containerRef} className="relative">
      <input type="hidden" name="aluno_id" value={selected?.id ?? ""} required />
      <div className="relative">
        <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink/40" />
        <input
          type="text"
          placeholder="Buscar aluno por nome ou matrícula..."
          value={query}
          onChange={handleChange}
          onFocus={() => query.length > 0 && setOpen(true)}
          autoComplete="off"
          className="!pl-8"
          required={!selected}
        />
      </div>
      {open && filtered.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full rounded-ui border border-line bg-surface shadow-soft max-h-64 overflow-auto">
          {filtered.map((a) => (
            <li key={a.id}>
              <button
                type="button"
                onMouseDown={() => select(a)}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-subtleHover"
              >
                <span className="size-7 shrink-0 rounded-full bg-line flex items-center justify-center text-xs font-bold text-ink/50">
                  {a.nome[0].toUpperCase()}
                </span>
                <div className="flex flex-col leading-tight">
                  <span className="font-semibold text-ink">{a.nome}</span>
                  <span className="text-xs text-ink/60">#{a.matricula_codigo}</span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
      {open && query.length > 0 && filtered.length === 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-ui border border-line bg-surface shadow-soft px-4 py-3 text-sm text-ink/60">
          Nenhum aluno encontrado.
        </div>
      )}
    </div>
  );
}
