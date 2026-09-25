"use client";

import { useState, useTransition } from "react";
import { FilePlus2, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { excluirTemplateAction, salvarTemplateAction } from "@/app/(app)/relatorios/dinamico/actions";
import type { Entidade, TemplateConfig, TemplateResumo } from "@/lib/relatorio-dinamico/tipos";

type Props = {
  entidade: Entidade;
  templates: TemplateResumo[];
  selecionadoId: string | null;
  config: TemplateConfig;
  permissoes: { criar: boolean; editar: boolean; excluir: boolean };
  onSelecionar: (id: string | null) => void;
  onSalvo: (t: TemplateResumo) => void;
  onExcluido: (id: string) => void;
};

export function TemplateBar({ entidade, templates, selecionadoId, config, permissoes, onSelecionar, onSalvo, onExcluido }: Props) {
  const confirm = useConfirm();
  const [pendente, iniciar] = useTransition();
  const [dialogo, setDialogo] = useState(false);
  const [nome, setNome] = useState("");
  const atual = templates.find((t) => t.id === selecionadoId) ?? null;

  const salvar = (payload: { id?: string; nome: string }) =>
    iniciar(async () => {
      const r = await salvarTemplateAction({ ...payload, entidade, config });
      if (!r.ok) return void toast.error(r.error);
      toast.success("Template salvo.");
      setDialogo(false);
      onSalvo(r.template);
    });

  const aoSalvar = () => {
    if (atual && permissoes.editar) return salvar({ id: atual.id, nome: atual.nome });
    setNome("");
    setDialogo(true);
  };

  const aoExcluir = async () => {
    if (!atual) return;
    const ok = await confirm({ title: "Excluir template", message: `Excluir o template "${atual.nome}"? Essa ação não pode ser desfeita.`, confirmLabel: "Excluir template", variant: "danger" });
    if (!ok) return;
    iniciar(async () => {
      const r = await excluirTemplateAction({ id: atual.id, entidade });
      if (!r.ok) return void toast.error(r.error);
      toast.success("Template excluído.");
      onExcluido(atual.id);
    });
  };

  return (
    <div className="flex flex-wrap items-end gap-3">
      <label className="min-w-56 flex-1">
        Template
        <select value={selecionadoId ?? ""} onChange={(e) => onSelecionar(e.target.value || null)}>
          <option value="">— Sem template —</option>
          {templates.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
        </select>
      </label>
      <Button type="button" variant="secondary" loading={pendente} disabled={!(permissoes.criar || (atual && permissoes.editar))} onClick={aoSalvar}>
        <Save size={14} /> Salvar
      </Button>
      <Button type="button" variant="secondary" onClick={() => onSelecionar(null)}>
        <FilePlus2 size={14} /> Novo
      </Button>
      <Button type="button" variant="warn" disabled={!atual || !permissoes.excluir || pendente} onClick={aoExcluir}>
        <Trash2 size={14} /> Excluir
      </Button>

      <Dialog open={dialogo} title="Salvar template" onClose={() => setDialogo(false)}>
        <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); salvar({ nome }); }}>
          <label>
            Nome do template
            <input value={nome} onChange={(e) => setNome(e.target.value)} maxLength={120} required autoFocus />
          </label>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setDialogo(false)}>Cancelar</Button>
            <Button type="submit" loading={pendente} disabled={!nome.trim()}>Criar template</Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
