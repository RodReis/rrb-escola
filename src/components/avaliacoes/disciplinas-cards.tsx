"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import {
  BookOpen,
  Palette,
  Calculator,
  Globe,
  Languages,
  History,
  FlaskConical,
  Music,
  Activity,
  PenTool,
  Leaf,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import type { DisciplinaOption } from "@/lib/data/lancamento-notas";

type Theme = {
  icon: LucideIcon;
  bg: string;        // bg do ícone inativo
  text: string;      // text do ícone inativo
  ring: string;      // ring/border ativo
  activeBg: string;  // bg card ativo
  activeIconBg: string;
  activeText: string;
};

const THEMES: Record<string, Theme> = {
  artes: {
    icon: Palette,
    bg: "bg-rose-100",
    text: "text-rose-600",
    ring: "border-rose-500",
    activeBg: "bg-gradient-to-br from-rose-100 to-rose-50",
    activeIconBg: "bg-rose-500 text-white",
    activeText: "text-rose-700",
  },
  matematica: {
    icon: Calculator,
    bg: "bg-blue-100",
    text: "text-blue-600",
    ring: "border-blue-500",
    activeBg: "bg-gradient-to-br from-blue-100 to-blue-50",
    activeIconBg: "bg-blue-500 text-white",
    activeText: "text-blue-700",
  },
  portugues: {
    icon: PenTool,
    bg: "bg-amber-100",
    text: "text-amber-600",
    ring: "border-amber-500",
    activeBg: "bg-gradient-to-br from-amber-100 to-amber-50",
    activeIconBg: "bg-amber-500 text-white",
    activeText: "text-amber-700",
  },
  linguagem: {
    icon: PenTool,
    bg: "bg-amber-100",
    text: "text-amber-600",
    ring: "border-amber-500",
    activeBg: "bg-gradient-to-br from-amber-100 to-amber-50",
    activeIconBg: "bg-amber-500 text-white",
    activeText: "text-amber-700",
  },
  producaotextual: {
    icon: PenTool,
    bg: "bg-amber-100",
    text: "text-amber-600",
    ring: "border-amber-500",
    activeBg: "bg-gradient-to-br from-amber-100 to-amber-50",
    activeIconBg: "bg-amber-500 text-white",
    activeText: "text-amber-700",
  },
  ingles: {
    icon: Languages,
    bg: "bg-indigo-100",
    text: "text-indigo-600",
    ring: "border-indigo-500",
    activeBg: "bg-gradient-to-br from-indigo-100 to-indigo-50",
    activeIconBg: "bg-indigo-500 text-white",
    activeText: "text-indigo-700",
  },
  historia: {
    icon: History,
    bg: "bg-orange-100",
    text: "text-orange-600",
    ring: "border-orange-500",
    activeBg: "bg-gradient-to-br from-orange-100 to-orange-50",
    activeIconBg: "bg-orange-500 text-white",
    activeText: "text-orange-700",
  },
  geografia: {
    icon: Globe,
    bg: "bg-teal-100",
    text: "text-teal-600",
    ring: "border-teal-500",
    activeBg: "bg-gradient-to-br from-teal-100 to-teal-50",
    activeIconBg: "bg-teal-500 text-white",
    activeText: "text-teal-700",
  },
  ciencias: {
    icon: FlaskConical,
    bg: "bg-emerald-100",
    text: "text-emerald-600",
    ring: "border-emerald-500",
    activeBg: "bg-gradient-to-br from-emerald-100 to-emerald-50",
    activeIconBg: "bg-emerald-500 text-white",
    activeText: "text-emerald-700",
  },
  natureza: {
    icon: Leaf,
    bg: "bg-emerald-100",
    text: "text-emerald-600",
    ring: "border-emerald-500",
    activeBg: "bg-gradient-to-br from-emerald-100 to-emerald-50",
    activeIconBg: "bg-emerald-500 text-white",
    activeText: "text-emerald-700",
  },
  naturezaesociedade: {
    icon: Leaf,
    bg: "bg-emerald-100",
    text: "text-emerald-600",
    ring: "border-emerald-500",
    activeBg: "bg-gradient-to-br from-emerald-100 to-emerald-50",
    activeIconBg: "bg-emerald-500 text-white",
    activeText: "text-emerald-700",
  },
  musica: {
    icon: Music,
    bg: "bg-fuchsia-100",
    text: "text-fuchsia-600",
    ring: "border-fuchsia-500",
    activeBg: "bg-gradient-to-br from-fuchsia-100 to-fuchsia-50",
    activeIconBg: "bg-fuchsia-500 text-white",
    activeText: "text-fuchsia-700",
  },
  movimento: {
    icon: Activity,
    bg: "bg-lime-100",
    text: "text-lime-700",
    ring: "border-lime-500",
    activeBg: "bg-gradient-to-br from-lime-100 to-lime-50",
    activeIconBg: "bg-lime-500 text-white",
    activeText: "text-lime-700",
  },
  educacaofisica: {
    icon: Activity,
    bg: "bg-lime-100",
    text: "text-lime-700",
    ring: "border-lime-500",
    activeBg: "bg-gradient-to-br from-lime-100 to-lime-50",
    activeIconBg: "bg-lime-500 text-white",
    activeText: "text-lime-700",
  },
  biologia: {
    icon: Leaf,
    bg: "bg-emerald-100",
    text: "text-emerald-600",
    ring: "border-emerald-500",
    activeBg: "bg-gradient-to-br from-emerald-100 to-emerald-50",
    activeIconBg: "bg-emerald-500 text-white",
    activeText: "text-emerald-700",
  },
  fisica: {
    icon: Sparkles,
    bg: "bg-violet-100",
    text: "text-violet-600",
    ring: "border-violet-500",
    activeBg: "bg-gradient-to-br from-violet-100 to-violet-50",
    activeIconBg: "bg-violet-500 text-white",
    activeText: "text-violet-700",
  },
  quimica: {
    icon: FlaskConical,
    bg: "bg-cyan-100",
    text: "text-cyan-600",
    ring: "border-cyan-500",
    activeBg: "bg-gradient-to-br from-cyan-100 to-cyan-50",
    activeIconBg: "bg-cyan-500 text-white",
    activeText: "text-cyan-700",
  },
};

const FALLBACK_THEME: Theme = {
  icon: BookOpen,
  bg: "bg-slate-100",
  text: "text-slate-600",
  ring: "border-slate-500",
  activeBg: "bg-gradient-to-br from-slate-100 to-slate-50",
  activeIconBg: "bg-slate-500 text-white",
  activeText: "text-slate-700",
};

function pickTheme(nome: string): Theme {
  const key = nome
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, "");
  return THEMES[key] ?? FALLBACK_THEME;
}

export function DisciplinasCards({
  disciplinas,
  disciplinaSel,
}: {
  disciplinas: DisciplinaOption[];
  disciplinaSel: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  function select(id: string) {
    const params = new URLSearchParams(sp?.toString() ?? "");
    if (params.get("disciplina") === id) return;
    params.set("disciplina", id);
    router.replace(`${pathname}?${params.toString()}`);
  }

  if (disciplinas.length === 0) {
    return (
      <div className="rounded-ui bg-muted/30 p-6 text-center text-sm text-ink/40">
        Esta série não tem disciplinas cadastradas.
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {disciplinas.map((d) => {
        const ativo = d.id === disciplinaSel;
        const t = pickTheme(d.nome);
        const Icon = t.icon;
        return (
          <button
            key={d.id}
            type="button"
            onClick={() => select(d.id)}
            className={`group inline-flex items-center gap-2 rounded-pill border-2 px-3 py-1.5 text-xs font-bold transition ${
              ativo
                ? `${t.ring} ${t.activeBg} ${t.activeText} shadow-soft`
                : "border-line bg-surface text-ink/70 hover:border-ink/30 hover:bg-muted/40"
            }`}
          >
            <span
              className={`grid h-6 w-6 place-items-center rounded-full transition ${
                ativo ? t.activeIconBg : `${t.bg} ${t.text}`
              }`}
            >
              <Icon size={12} />
            </span>
            <span className="whitespace-nowrap">{d.nome}</span>
          </button>
        );
      })}
    </div>
  );
}
