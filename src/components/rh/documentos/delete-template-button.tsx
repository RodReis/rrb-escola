"use client";

import { useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteTemplateAction } from "@/lib/actions/templates";
import { useConfirm } from "@/components/ui/confirm-dialog";

export function DeleteTemplateButton({ templateId, nome }: { templateId: string; nome: string }) {
  const confirm = useConfirm();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, setPending] = useState(false);

  return (
    <form
      ref={formRef}
      action={async (formData) => {
        setPending(true);
        try {
          await deleteTemplateAction(formData);
          toast.success("Template excluído.");
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Falha ao excluir.");
        } finally {
          setPending(false);
        }
      }}
    >
      <input type="hidden" name="template_id" value={templateId} />
      <button
        type="button"
        disabled={pending}
        className="inline-flex items-center gap-1 rounded-ui border border-clay/30 bg-clay/5 px-2.5 py-1 text-xs font-semibold text-clay hover:bg-clay/10 disabled:opacity-50"
        onClick={async () => {
          const ok = await confirm({
            title: "Excluir template",
            message: `Tem certeza que quer excluir o template "${nome}"? Esta ação é permanente.`,
            confirmLabel: "Excluir",
            variant: "danger",
          });
          if (ok) formRef.current?.requestSubmit();
        }}
      >
        <Trash2 size={12} /> Excluir
      </button>
    </form>
  );
}
