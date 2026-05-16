"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type ThemeMode = "system" | "light" | "dark";

const STORAGE_KEY = "theme";

const modes: Array<{ mode: ThemeMode; label: string; icon: typeof Monitor }> = [
  { mode: "system", label: "Usar tema do sistema", icon: Monitor },
  { mode: "light",  label: "Tema claro",           icon: Sun },
  { mode: "dark",   label: "Tema escuro",           icon: Moon },
];

function readStored(): ThemeMode {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "light" || v === "dark" || v === "system") return v;
  } catch {}
  return "system";
}

function applyTheme(mode: ThemeMode) {
  if (mode === "system") {
    delete document.documentElement.dataset.theme;
  } else {
    document.documentElement.dataset.theme = mode;
  }
}

export function ThemeToggle({ className }: { className?: string }) {
  const [mode, setMode] = useState<ThemeMode>("system");

  // Sync from localStorage after hydration
  useEffect(() => {
    const stored = readStored();
    setMode(stored);
    applyTheme(stored);
  }, []);

  function choose(next: ThemeMode) {
    setMode(next);
    applyTheme(next);
    try { localStorage.setItem(STORAGE_KEY, next); } catch {}
  }

  return (
    <div className={cn("inline-flex h-10 items-center gap-1 rounded-ui border border-line bg-surface p-1", className)}>
      {modes.map(({ mode: itemMode, label, icon: Icon }) => (
        <button
          key={itemMode}
          type="button"
          aria-label={label}
          title={label}
          onClick={() => choose(itemMode)}
          className={cn(
            "grid h-8 w-8 place-items-center rounded-ui text-ink/62 transition hover:bg-muted hover:text-ink",
            mode === itemMode && "bg-brand text-paper hover:bg-brand hover:text-paper",
          )}
        >
          <Icon size={16} />
        </button>
      ))}
    </div>
  );
}
