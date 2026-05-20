// src/components/perfis/permissions-matrix.tsx
"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  GRUPOS,
  GRUPO_LABEL,
  MODULOS,
  MODULO_CODIGOS,
  modulosDoGrupo,
  type Acao,
  type Grupo,
  type ModuloCodigo,
} from "@/lib/auth/permissions";
import { cn } from "@/lib/utils";

type Matrix = Record<ModuloCodigo, Record<Acao, boolean>>;

const ACOES: Acao[] = ["read", "create", "update", "delete"];
const ACAO_LABEL: Record<Acao, string> = {
  read: "R",
  create: "C",
  update: "U",
  delete: "D",
};

export function PermissionsMatrix({
  initial,
  disabled,
}: {
  initial: Matrix;
  disabled?: boolean;
}) {
  const [matrix, setMatrix] = useState<Matrix>(() => {
    const full = {} as Matrix;
    for (const m of MODULO_CODIGOS) {
      full[m] = initial[m] ?? { read: false, create: false, update: false, delete: false };
    }
    return full;
  });
  const [expandido, setExpandido] = useState<Record<Grupo, boolean>>(
    () => Object.fromEntries(GRUPOS.map((g) => [g, false])) as Record<Grupo, boolean>,
  );

  function toggle(modulo: ModuloCodigo, acao: Acao) {
    if (disabled) return;
    setMatrix((prev) => ({
      ...prev,
      [modulo]: { ...prev[modulo], [acao]: !prev[modulo][acao] },
    }));
  }

  function bulkGrupo(grupo: Grupo, acao: Acao, valor: boolean) {
    if (disabled) return;
    setMatrix((prev) => {
      const next = { ...prev };
      for (const m of modulosDoGrupo(grupo)) {
        next[m] = { ...next[m], [acao]: valor };
      }
      return next;
    });
  }

  function countGrupo(grupo: Grupo): { ativas: number; total: number } {
    const mods = modulosDoGrupo(grupo);
    let ativas = 0;
    for (const m of mods) {
      for (const a of ACOES) if (matrix[m][a]) ativas++;
    }
    return { ativas, total: mods.length * 4 };
  }

  function allInGrupo(grupo: Grupo, acao: Acao): boolean {
    return modulosDoGrupo(grupo).every((m) => matrix[m][acao]);
  }

  return (
    <div className="grid gap-2">
      {GRUPOS.map((grupo) => {
        const open = expandido[grupo];
        const { ativas, total } = countGrupo(grupo);
        const mods = modulosDoGrupo(grupo);
        return (
          <div key={grupo} className="rounded-ui border border-line bg-surface">
            <div className="flex items-center gap-3 px-4 py-3">
              <button
                type="button"
                onClick={() => setExpandido((p) => ({ ...p, [grupo]: !p[grupo] }))}
                className="flex items-center gap-2 text-left flex-1"
              >
                <ChevronDown
                  size={14}
                  className={cn("transition-transform", open && "rotate-180")}
                />
                <span className="font-semibold text-ink">{GRUPO_LABEL[grupo]}</span>
                <span className="text-xs text-ink/55">
                  {ativas}/{total} permissões
                </span>
              </button>
              <div className="flex items-center gap-3">
                {ACOES.map((a) => (
                  <label key={a} className="flex items-center gap-1 text-xs text-ink/65">
                    <input
                      type="checkbox"
                      checked={allInGrupo(grupo, a)}
                      onChange={(e) => bulkGrupo(grupo, a, e.target.checked)}
                      disabled={disabled}
                      className="h-3.5 w-3.5"
                    />
                    {ACAO_LABEL[a]}
                  </label>
                ))}
              </div>
            </div>

            {open && (
              <div className="border-t border-line">
                {mods.map((m) => (
                  <div
                    key={m}
                    className="flex items-center px-4 py-2.5 border-b border-line last:border-b-0"
                  >
                    <span className="flex-1 text-sm text-ink/80">{MODULOS[m].nome}</span>
                    <div className="flex items-center gap-3">
                      {ACOES.map((a) => (
                        <label key={a} className="flex items-center gap-1 text-xs text-ink/65">
                          <input
                            type="checkbox"
                            name={`perm.${m}.${a}`}
                            checked={matrix[m][a]}
                            onChange={() => toggle(m, a)}
                            disabled={disabled}
                            className="h-3.5 w-3.5"
                          />
                          {ACAO_LABEL[a]}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!open &&
              mods.map((m) =>
                ACOES.map((a) =>
                  matrix[m][a] ? (
                    <input
                      key={`${m}.${a}`}
                      type="hidden"
                      name={`perm.${m}.${a}`}
                      value="on"
                    />
                  ) : null,
                ),
              )}
          </div>
        );
      })}
    </div>
  );
}
