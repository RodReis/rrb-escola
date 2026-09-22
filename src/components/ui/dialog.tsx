"use client";

import { useEffect, useId } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

type DialogProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  /** md (padrão, formulários curtos) ou lg (formulários com várias colunas/campos). */
  size?: "md" | "lg";
};

const SIZE_CLASS = { md: "max-w-md", lg: "max-w-2xl" } as const;

/**
 * Generic modal shell: portal to body, backdrop, ESC to close, click-outside to
 * close, X button. Contains no form logic — callers render their own content.
 */
export function Dialog({ open, title, onClose, children, size = "md" }: DialogProps) {
  const titleId = useId();
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || typeof window === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="absolute inset-0 bg-ink/30 backdrop-blur-[2px]" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`relative w-full ${SIZE_CLASS[size]} rounded-[10px] border border-line bg-surface p-6 shadow-lift max-h-[90vh] overflow-y-auto`}
      >
        <div className="flex items-start justify-between gap-4">
          <p id={titleId} className="text-sm font-semibold text-ink">{title}</p>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md text-ink/40 hover:bg-muted hover:text-ink"
            aria-label="Fechar"
          >
            <X size={14} />
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>,
    document.body
  );
}
