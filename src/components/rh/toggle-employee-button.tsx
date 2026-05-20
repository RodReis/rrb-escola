"use client";

import { useRef } from "react";
import { Power, PowerOff } from "lucide-react";
import { toggleEmployeeAction } from "@/lib/actions/rh";
import { useConfirm } from "@/components/ui/confirm-dialog";

export function ToggleEmployeeButton({ id, name, ativo }: { id: string; name: string; ativo: boolean }) {
  const confirm = useConfirm();
  const formRef = useRef<HTMLFormElement>(null);
  const label = ativo ? "Desativar" : "Ativar";
  const Icon = ativo ? PowerOff : Power;

  return (
    <form ref={formRef} action={toggleEmployeeAction} className="inline">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="ativo" value={ativo ? "" : "on"} />
      <button
        type="button"
        className={`inline-flex items-center gap-1 text-xs font-semibold hover:underline ${ativo ? "text-warning" : "text-success"}`}
        title={label}
        onClick={async () => {
          const ok = await confirm({
            title: `${label} funcionário`,
            message: `Tem certeza que quer ${label.toLowerCase()} "${name}"?`,
            confirmLabel: label,
            variant: ativo ? "warning" : "default",
          });
          if (ok) formRef.current?.requestSubmit();
        }}
      >
        <Icon size={14} /> {label}
      </button>
    </form>
  );
}
