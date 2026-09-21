"use client";

import { useRef } from "react";
import { Save } from "lucide-react";
import { updateSerieAction, toggleSerieAction } from "@/lib/actions/academics";
import { useAction } from "@/lib/hooks/use-action";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/status-pill";

type Serie = {
  id: string;
  nome: string;
  ordem: number | null;
  ativo: boolean;
};

// updateSerieAction/toggleSerieAction sao contrato C (void + revalidatePath
// no sucesso) — toast ja funciona sem migrar as actions.
export function SerieCard({ item }: { item: Serie }) {
  const formRef = useRef<HTMLFormElement>(null);
  const save = useAction(updateSerieAction, {
    success: "Série salva.",
    error: "Falha ao salvar a série.",
  });
  const toggle = useAction(toggleSerieAction, {
    confirm: {
      message: `Tem certeza que quer ${item.ativo ? "desativar" : "ativar"} a série "${item.nome}"?`,
    },
    success: `Série ${item.ativo ? "desativada" : "ativada"}.`,
    error: "Falha ao alterar status.",
  });

  function handleSave() {
    if (formRef.current) save.run(new FormData(formRef.current));
  }

  function handleToggle() {
    const fd = new FormData();
    fd.set("id", item.id);
    fd.set("ativo", item.ativo ? "" : "on");
    toggle.run(fd);
  }

  return (
    <Panel className="grid gap-4">
      <form ref={formRef} className="grid gap-3 md:grid-cols-[1fr_130px_120px_120px]" onSubmit={(e) => e.preventDefault()}>
        <input type="hidden" name="id" value={item.id} />
        <label>
          Nome
          <input name="nome" defaultValue={item.nome} required />
        </label>
        <label>
          Ordem
          <input name="ordem" type="number" defaultValue={item.ordem ?? 0} />
        </label>
        <label className="flex grid-cols-none items-center gap-2 self-end pb-3">
          <input name="ativo" type="checkbox" className="h-4 w-4" defaultChecked={item.ativo} />
          Ativa
        </label>
        <Button type="button" loading={save.pending} onClick={handleSave} className="self-end">
          <Save size={14} /> Salvar
        </Button>
      </form>
      <div className="flex items-center justify-between gap-3 border-t border-line pt-3">
        <StatusPill tone={item.ativo ? "success" : "danger"}>{item.ativo ? "Ativa" : "Inativa"}</StatusPill>
        <button
          type="button"
          onClick={handleToggle}
          disabled={toggle.pending}
          className="text-xs font-black text-clay disabled:opacity-50"
        >
          {toggle.pending ? "Aguarde…" : item.ativo ? "Desativar" : "Ativar"}
        </button>
      </div>
    </Panel>
  );
}
