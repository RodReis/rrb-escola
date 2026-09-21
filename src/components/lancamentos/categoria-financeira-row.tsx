"use client";

import { Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  deleteCategoriaFinanceiraAction,
  updateCategoriaFinanceiraAction,
} from "@/lib/actions/categorias-financeiras";
import { useAction } from "@/lib/hooks/use-action";
import type { CategoriaFinanceira } from "@/lib/data/lancamentos";

export function CategoriaFinanceiraRow({ categoria: c }: { categoria: CategoriaFinanceira }) {
  const save = useAction(updateCategoriaFinanceiraAction, {
    success: "Categoria salva.",
    error: "Falha ao salvar a categoria.",
  });
  const remove = useAction(deleteCategoriaFinanceiraAction, {
    confirm: {
      title: "Excluir categoria",
      message: `Tem certeza que quer excluir a categoria "${c.nome}"?`,
    },
    success: "Categoria excluída.",
    error: "Falha ao excluir a categoria.",
  });

  function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    save.run(new FormData(e.currentTarget));
  }

  function handleDelete() {
    const fd = new FormData();
    fd.set("id", c.id);
    remove.run(fd);
  }

  return (
    <tr className="border-t border-line transition hover:bg-muted/40">
      <td className="py-2.5 px-3">
        <form onSubmit={handleSave} className="flex items-center gap-2">
          <input type="hidden" name="id" value={c.id} />
          <input type="hidden" name="tipo" value={c.tipo} />
          <input name="nome" defaultValue={c.nome} required maxLength={80} />
          <label className="flex items-center gap-1 text-xs">
            <input type="checkbox" name="ativo" defaultChecked={c.ativo} className="h-4 w-4" />
            ativa
          </label>
          <Button
            type="submit"
            variant="secondary"
            loading={save.pending}
            title="Salvar alterações"
            aria-label="Salvar"
            className="!h-8 !min-w-0 !px-2"
          >
            <Save size={14} />
          </Button>
        </form>
      </td>
      <td className="py-2.5 px-3">
        <span className={`inline-flex items-center rounded-pill px-2 py-0.5 text-xs font-semibold ${
          c.tipo === "receita" ? "bg-success/10 text-success" : "bg-danger/10 text-danger"
        }`}>
          {c.tipo === "receita" ? "Receita" : "Despesa"}
        </span>
      </td>
      <td className="py-2.5 px-3">
        <span className={`inline-flex items-center rounded-pill px-2 py-0.5 text-xs font-semibold ${
          c.ativo ? "bg-success/10 text-success" : "bg-muted text-ink/60"
        }`}>
          {c.ativo ? "Sim" : "Não"}
        </span>
      </td>
      <td className="py-2.5 px-3 text-right">
        <button
          type="button"
          onClick={handleDelete}
          disabled={remove.pending}
          title="Excluir categoria"
          aria-label="Excluir"
          className="inline-flex h-7 min-w-0 items-center justify-center rounded-ui px-2 text-danger hover:bg-danger/10 disabled:opacity-50"
        >
          <Trash2 size={14} />
        </button>
      </td>
    </tr>
  );
}
