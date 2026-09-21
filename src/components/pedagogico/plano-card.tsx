"use client";

import { useRef } from "react";
import { Save } from "lucide-react";
import { updatePlanAction, togglePlanAction } from "@/lib/actions/academics";
import { useAction } from "@/lib/hooks/use-action";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/status-pill";
import { money } from "@/lib/constants";

type Plano = {
  id: string;
  nome: string;
  descricao: string | null;
  ativo: boolean;
  valor_matricula: number | string | null;
  valor_mensalidade: number | string | null;
  quantidade_parcelas: number;
  dia_vencimento: number;
};

// updatePlanAction/togglePlanAction sao contrato C (void+revalidatePath no
// sucesso) — toast ja funciona sem migrar as actions.
export function PlanoCard({ item }: { item: Plano }) {
  const formRef = useRef<HTMLFormElement>(null);
  const save = useAction(updatePlanAction, {
    success: "Plano salvo.",
    error: "Falha ao salvar o plano.",
  });
  const toggle = useAction(togglePlanAction, {
    confirm: {
      message: `Tem certeza que quer ${item.ativo ? "desativar" : "ativar"} o plano "${item.nome}"?`,
    },
    success: `Plano ${item.ativo ? "desativado" : "ativado"}.`,
    error: "Falha ao alterar status.",
  });

  function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    save.run(new FormData(e.currentTarget));
  }

  function handleToggle() {
    const fd = new FormData();
    fd.set("id", item.id);
    fd.set("ativo", item.ativo ? "" : "on");
    toggle.run(fd);
  }

  return (
    <Panel className="grid gap-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-ink">{item.nome}</h2>
          <p className="mt-1 text-sm text-ink/65">{item.descricao || "Sem descrição"}</p>
        </div>
        <StatusPill tone={item.ativo ? "success" : "danger"}>{item.ativo ? "Ativo" : "Inativo"}</StatusPill>
      </div>

      <form ref={formRef} onSubmit={handleSave} className="grid gap-3">
        <input type="hidden" name="id" value={item.id} />
        <div className="grid gap-3 md:grid-cols-2">
          <label>
            Nome
            <input name="nome" defaultValue={item.nome} required />
          </label>
          <label>
            Vencimento
            <input name="dia_vencimento" type="number" defaultValue={item.dia_vencimento} />
          </label>
          <label>
            Matrícula
            <input name="valor_matricula" inputMode="decimal" defaultValue={Number(item.valor_matricula ?? 0)} />
          </label>
          <label>
            Mensalidade
            <input name="valor_mensalidade" inputMode="decimal" defaultValue={Number(item.valor_mensalidade ?? 0)} />
          </label>
          <label>
            Parcelas
            <input name="quantidade_parcelas" type="number" defaultValue={item.quantidade_parcelas} />
          </label>
          <label className="flex grid-cols-none items-center gap-2 self-end pb-3">
            <input name="ativo" type="checkbox" className="h-4 w-4" defaultChecked={item.ativo} />
            Ativo
          </label>
        </div>
        <label>
          Descrição
          <input name="descricao" defaultValue={item.descricao ?? ""} />
        </label>
        <Button type="submit" loading={save.pending} className="justify-self-start">
          <Save size={14} /> Salvar plano
        </Button>
      </form>

      <div className="grid grid-cols-2 gap-3 border-y border-line py-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.12em] text-ink/60">Mensalidade</p>
          <strong className="mt-2 block text-xl text-brand">{money.format(Number(item.valor_mensalidade))}</strong>
        </div>
        <div>
          <p className="text-xs font-black uppercase tracking-[0.12em] text-ink/60">Matrícula</p>
          <strong className="mt-2 block text-xl text-brand">{money.format(Number(item.valor_matricula))}</strong>
        </div>
        <div>
          <p className="text-xs font-black uppercase tracking-[0.12em] text-ink/60">Parcelas</p>
          <strong className="mt-2 block text-xl text-ink">{item.quantidade_parcelas}</strong>
        </div>
        <div>
          <p className="text-xs font-black uppercase tracking-[0.12em] text-ink/60">Vencimento</p>
          <strong className="mt-2 block text-xl text-ink">Dia {item.dia_vencimento}</strong>
        </div>
      </div>

      <button
        type="button"
        onClick={handleToggle}
        disabled={toggle.pending}
        className="text-xs font-black text-clay disabled:opacity-50 justify-self-start"
      >
        {toggle.pending ? "Aguarde…" : item.ativo ? "Desativar plano" : "Ativar plano"}
      </button>
    </Panel>
  );
}
