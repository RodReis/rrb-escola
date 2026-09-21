"use client";

import { useRef } from "react";
import { Save } from "lucide-react";
import { updateTurmaAction, toggleTurmaAction } from "@/lib/actions/academics";
import { useAction } from "@/lib/hooks/use-action";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/status-pill";

type Serie = { id: string; nome: string };
type Turma = {
  id: string;
  serie_id: string;
  nome: string;
  ano_letivo: number | null;
  turno: string | null;
  capacidade: number | null;
  ativo: boolean;
  series?: { nome: string | null } | null;
};

// updateTurmaAction devolve ActionResult (Task 11 — precisava diferenciar
// erro de duplicidade de outros erros). toggleTurmaAction continua contrato
// C (void + revalidatePath no sucesso).
export function TurmaCard({ item, series }: { item: Turma; series: Serie[] }) {
  const formRef = useRef<HTMLFormElement>(null);
  const save = useAction(updateTurmaAction, {
    success: "Turma salva.",
    error: "Falha ao salvar a turma.",
  });
  const toggle = useAction(toggleTurmaAction, {
    confirm: {
      message: `Tem certeza que quer ${item.ativo ? "desativar" : "ativar"} a turma "${item.nome}"?`,
    },
    success: `Turma ${item.ativo ? "desativada" : "ativada"}.`,
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
      <form
        ref={formRef}
        className="grid gap-3 lg:grid-cols-[1fr_1fr_120px_150px_120px_110px_120px]"
        onSubmit={(e) => e.preventDefault()}
      >
        <input type="hidden" name="id" value={item.id} />
        <label>
          Serie
          <select name="serie_id" defaultValue={item.serie_id} required>
            {series.map((serie) => (
              <option key={serie.id} value={serie.id}>{serie.nome}</option>
            ))}
          </select>
        </label>
        <label>
          Nome
          <input name="nome" defaultValue={item.nome} required />
        </label>
        <label>
          Ano
          <input name="ano_letivo" type="number" defaultValue={item.ano_letivo ?? undefined} />
        </label>
        <label>
          Turno
          <select name="turno" defaultValue={item.turno ?? "matutino"}>
            <option value="matutino">Matutino</option>
            <option value="vespertino">Vespertino</option>
            <option value="noturno">Noturno</option>
            <option value="integral">Integral</option>
          </select>
        </label>
        <label>
          Capacidade
          <input name="capacidade" type="number" defaultValue={item.capacidade ?? undefined} />
        </label>
        <label className="flex grid-cols-none items-center gap-2 self-end pb-3">
          <input name="ativo" type="checkbox" className="h-4 w-4" defaultChecked={item.ativo} />
          Ativa
        </label>
        <Button type="button" loading={save.pending} onClick={handleSave} className="self-end">
          <Save size={14} /> Salvar
        </Button>
      </form>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
        <StatusPill tone={item.ativo ? "success" : "danger"}>{item.ativo ? "Ativa" : "Inativa"}</StatusPill>
        <span className="text-sm font-medium text-ink/60">{item.series?.nome} - {item.ano_letivo}</span>
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
