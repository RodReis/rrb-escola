"use client";

import { Trash2 } from "lucide-react";
import { deleteTemplateAction } from "@/lib/actions/templates";
import { useAction } from "@/lib/hooks/use-action";

export function DeleteTemplateButton({ templateId, nome }: { templateId: string; nome: string }) {
  // deleteTemplateAction faz redirect() no sucesso: sem `success`, a
  // navegacao para /rh/documentos e o proprio feedback.
  const { run, pending } = useAction(deleteTemplateAction, {
    confirm: {
      title: "Excluir template",
      message: `Tem certeza que quer excluir o template "${nome}"? Esta ação é permanente.`,
      confirmLabel: "Excluir",
      variant: "danger",
    },
    error: "Falha ao excluir.",
  });

  function handleClick() {
    const fd = new FormData();
    fd.append("template_id", templateId);
    run(fd);
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={handleClick}
      className="inline-flex items-center gap-1 rounded-ui border border-clay/30 bg-clay/5 px-2.5 py-1 text-xs font-semibold text-clay hover:bg-clay/10 disabled:opacity-50"
    >
      <Trash2 size={12} /> Excluir
    </button>
  );
}
