"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { AlertTriangle, Trash2, X } from "lucide-react";
import { createPortal } from "react-dom";

type Variant = "danger" | "warning" | "default";

type ConfirmOptions = {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: Variant;
};

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

type DialogState = ConfirmOptions & { resolve: (value: boolean) => void };

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const resolveRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      setDialog({ ...options, resolve });
    });
  }, []);

  function close(result: boolean) {
    dialog?.resolve(result);
    setDialog(null);
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {dialog && typeof window !== "undefined"
        ? createPortal(<ConfirmModal dialog={dialog} onClose={close} />, document.body)
        : null}
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used inside ConfirmProvider");
  return ctx;
}

function ConfirmModal({
  dialog,
  onClose,
}: {
  dialog: DialogState;
  onClose: (result: boolean) => void;
}) {
  const variant = dialog.variant ?? "default";
  const isDanger = variant === "danger";
  const isWarning = variant === "warning";

  const iconColor = isDanger
    ? "text-danger"
    : isWarning
    ? "text-warning"
    : "text-brand";

  const iconBg = isDanger
    ? "bg-danger/10"
    : isWarning
    ? "bg-warning/10"
    : "bg-brand/10";

  const confirmClass = isDanger
    ? "bg-danger text-white hover:bg-danger/90 shadow-[0_4px_12px_rgba(190,50,50,0.28)]"
    : isWarning
    ? "bg-warning text-white hover:bg-warning/90"
    : "ds-button-primary";

  const Icon = isDanger ? Trash2 : AlertTriangle;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose(false);
      }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-ink/30 backdrop-blur-[2px]" />

      {/* Modal */}
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-message"
        className="relative w-full max-w-sm rounded-[10px] border border-line bg-surface p-6 shadow-lift"
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose(false);
          if (e.key === "Enter") onClose(true);
        }}
      >
        {/* Close X */}
        <button
          type="button"
          onClick={() => onClose(false)}
          className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-md text-ink/40 hover:bg-muted hover:text-ink"
          aria-label="Fechar"
        >
          <X size={14} />
        </button>

        {/* Icon + Title */}
        <div className="flex items-start gap-4">
          <span className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ${iconBg}`}>
            <Icon size={18} className={iconColor} />
          </span>
          <div className="min-w-0 flex-1 pt-0.5">
            {dialog.title && (
              <p id="confirm-title" className="text-sm font-semibold text-ink">
                {dialog.title}
              </p>
            )}
            <p
              id="confirm-message"
              className={`text-sm leading-relaxed text-ink/70 ${dialog.title ? "mt-1" : ""}`}
            >
              {dialog.message}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => onClose(false)}
            className="ds-button ds-button-secondary text-xs"
          >
            {dialog.cancelLabel ?? "Cancelar"}
          </button>
          <button
            type="button"
            autoFocus
            onClick={() => onClose(true)}
            className={`ds-button text-xs ${confirmClass}`}
          >
            {dialog.confirmLabel ?? "Confirmar"}
          </button>
        </div>
      </div>
    </div>
  );
}
