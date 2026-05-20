"use client";

import { Toaster as SonnerToaster } from "sonner";

export function Toaster() {
  return (
    <SonnerToaster
      position="top-right"
      richColors
      closeButton
      toastOptions={{
        classNames: {
          toast: "rounded-ui border border-line bg-surface text-ink shadow-soft",
          title: "font-semibold text-ink",
          description: "text-muted",
          success: "border-moss/40",
          error: "border-clay/40",
        },
      }}
    />
  );
}
