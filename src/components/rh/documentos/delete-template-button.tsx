"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteTemplateAction } from "@/lib/actions/templates";

export function DeleteTemplateButton({ templateId, nome }: { templateId: string; nome: string }) {
  const [pending, setPending] = useState(false);

  async function onSubmit(formData: FormData) {
    if (!confirm(`Excluir template "${nome}"? Esta ação é permanente.`)) return;
    setPending(true);
    try {
      await deleteTemplateAction(formData);
      toast.success("Template excluído.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao excluir.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form action={onSubmit}>
      <input type="hidden" name="template_id" value={templateId} />
      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center gap-1 rounded-ui border border-clay/30 bg-clay/5 px-2.5 py-1 text-xs font-semibold text-clay hover:bg-clay/10 disabled:opacity-50"
      >
        <Trash2 size={12} /> Excluir
      </button>
    </form>
  );
}
