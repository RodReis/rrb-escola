"use client";

import { useRef } from "react";
import { Trash2 } from "lucide-react";
import { updateDisciplinaAction, deleteDisciplinaAction } from "@/lib/actions/disciplinas";
import { useAction } from "@/lib/hooks/use-action";
import { Button } from "@/components/ui/button";
import type { DisciplinaRow } from "@/lib/data/pedagogico";

// updateDisciplinaAction/deleteDisciplinaAction sao contrato C (throw no
// erro, void + revalidatePath no sucesso) — toast ja funciona sem migrar.
export function DisciplinaListItem({ disciplina: d }: { disciplina: DisciplinaRow }) {
  const rowRef = useRef<HTMLLIElement>(null);
  const save = useAction(updateDisciplinaAction, {
    success: "Disciplina salva.",
    error: "Falha ao salvar a disciplina.",
  });
  const remove = useAction(deleteDisciplinaAction, {
    confirm: {
      message: `Tem certeza que quer remover a disciplina "${d.nome}"?`,
      confirmLabel: "Remover",
      variant: "danger",
    },
    success: "Disciplina removida.",
    error: "Falha ao remover a disciplina.",
  });

  function handleSave() {
    if (rowRef.current) save.run(new FormData(rowRef.current.querySelector("form") as HTMLFormElement));
  }

  function handleDelete() {
    const fd = new FormData();
    fd.set("id", d.id);
    remove.run(fd);
  }

  return (
    <li ref={rowRef} className="rounded-ui border border-line p-3">
      <form className="grid gap-2 md:grid-cols-[1fr_80px_80px_120px]" onSubmit={(e) => e.preventDefault()}>
        <input type="hidden" name="id" value={d.id} />
        <input name="nome" defaultValue={d.nome} required maxLength={80} />
        <input name="ordem" type="number" defaultValue={d.ordem} />
        <label className="flex items-center gap-2 text-xs">
          <input name="ativo" type="checkbox" defaultChecked={d.ativo} />
          Ativa
        </label>
        <div className="flex gap-2">
          <Button type="button" variant="secondary" loading={save.pending} onClick={handleSave} className="text-xs">
            Salvar
          </Button>
        </div>
      </form>
      <button
        type="button"
        onClick={handleDelete}
        disabled={remove.pending}
        className="mt-2 inline-flex items-center gap-1 text-xs text-danger hover:underline disabled:opacity-50"
      >
        <Trash2 size={12} /> {remove.pending ? "Removendo…" : "Remover"}
      </button>
    </li>
  );
}
