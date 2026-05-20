"use client";

import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/utils";
import { useConfirm } from "./confirm-dialog";

type Variant = "danger" | "warning" | "default";

type Props = Omit<ComponentPropsWithoutRef<"button">, "type" | "onClick"> & {
  message: string;
  confirmTitle?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: Variant;
};

export function ConfirmButton({
  message,
  confirmTitle,
  confirmLabel,
  cancelLabel,
  variant = "danger",
  className,
  children,
  ...props
}: Props) {
  const confirm = useConfirm();

  return (
    <button
      type="button"
      className={cn(className)}
      onClick={async (e) => {
        e.preventDefault();
        const ok = await confirm({
          title: confirmTitle,
          message,
          confirmLabel,
          cancelLabel,
          variant,
        });
        if (ok) {
          (e.target as HTMLButtonElement)
            .closest("form")
            ?.requestSubmit();
        }
      }}
      {...props}
    >
      {children}
    </button>
  );
}
