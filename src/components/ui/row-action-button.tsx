"use client";

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Spinner } from "./spinner";
import { useAction, type UseActionOptions } from "@/lib/hooks/use-action";

type Tone = "brand" | "danger" | "warning" | "success";

const tones: Record<Tone, string> = {
  brand: "text-brand hover:bg-brand/10",
  danger: "text-danger hover:bg-danger/10",
  warning: "text-warning hover:bg-warning/10",
  success: "text-success hover:bg-success/10",
};

type Props = {
  action: (formData: FormData) => Promise<unknown> | unknown;
  /** Vira campos da FormData enviada para a action. */
  args?: Record<string, string>;
  icon: LucideIcon;
  /** Usado como title e aria-label. */
  label: string;
  tone?: Tone;
  confirm?: UseActionOptions["confirm"];
  success?: string;
  error?: string;
  onSuccess?: UseActionOptions["onSuccess"];
};

export function RowActionButton({
  action,
  args,
  icon: Icon,
  label,
  tone = "brand",
  confirm,
  success,
  error,
  onSuccess,
}: Props) {
  const { run, pending } = useAction(action, { confirm, success, error, onSuccess });

  function handleClick() {
    const fd = new FormData();
    for (const [key, value] of Object.entries(args ?? {})) {
      fd.append(key, value);
    }
    run(fd);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      title={label}
      aria-label={label}
      aria-busy={pending || undefined}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-md transition disabled:opacity-40",
        tones[tone]
      )}
    >
      {/* Spinner ocupa o lugar do icone para a largura da celula nao mudar. */}
      {pending ? <Spinner size={15} /> : <Icon size={15} />}
    </button>
  );
}
