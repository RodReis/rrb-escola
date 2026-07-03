"use client";

import { useMemo, useState } from "react";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { saveTemplateMappingsAction } from "@/lib/actions/templates";
import { ALLOWED_TABLES, COMPUTED_FNS, type Mapping, type ComputedFn } from "@/lib/documents/schema-catalog";

type RowState =
  | { placeholder: string; type: "tabela"; table: string; column: string; filter: string }
  | { placeholder: string; type: "computed"; fn: string };

const TABLES = Object.keys(ALLOWED_TABLES);

function toRow(m: Mapping): RowState {
  if (m.type === "computed") return { placeholder: m.placeholder, type: "computed", fn: m.fn };
  return { placeholder: m.placeholder, type: "tabela", table: m.table, column: m.column, filter: m.filter ?? "" };
}

function toMapping(r: RowState): Mapping | null {
  if (r.type === "computed") {
    if (!(COMPUTED_FNS as readonly string[]).includes(r.fn)) return null;
    return { placeholder: r.placeholder, type: "computed", fn: r.fn as ComputedFn };
  }
  if (!ALLOWED_TABLES[r.table]) return null;
  if (!ALLOWED_TABLES[r.table].columns.includes(r.column)) return null;
  const filter = r.filter || null;
  if (filter && !ALLOWED_TABLES[r.table].filters.includes(filter as never)) return null;
  return { placeholder: r.placeholder, type: "tabela", table: r.table, column: r.column, filter };
}

export function MappingForm({
  templateId,
  initial,
  placeholders,
  activate,
}: {
  templateId: string;
  initial: Mapping[];
  placeholders: string[];
  activate: boolean;
}) {
  // Combina placeholders detectados no .docx com qualquer mapping existente.
  const initialRows: RowState[] = useMemo(() => {
    const byName = new Map(initial.map((m) => [m.placeholder, m]));
    const merged: RowState[] = placeholders.map((ph) => {
      const existing = byName.get(ph);
      return existing
        ? toRow(existing)
        : { placeholder: ph, type: "tabela", table: "alunos", column: "nome", filter: "" };
    });
    // Inclui também mappings antigos para placeholders que não estão mais no template — para auditar.
    byName.forEach((m, ph) => {
      if (!placeholders.includes(ph)) merged.push(toRow(m));
    });
    return merged;
  }, [initial, placeholders]);

  const [rows, setRows] = useState<RowState[]>(initialRows);
  const [pending, setPending] = useState(false);

  function updateRow(idx: number, patch: Partial<RowState>) {
    setRows((prev) => {
      const next = [...prev];
      const cur = next[idx] as RowState;
      // Switching type resets the type-specific fields.
      if (patch.type && patch.type !== cur.type) {
        if (patch.type === "computed") {
          next[idx] = { placeholder: cur.placeholder, type: "computed", fn: COMPUTED_FNS[0] };
        } else {
          next[idx] = { placeholder: cur.placeholder, type: "tabela", table: "alunos", column: "nome", filter: "" };
        }
        return next;
      }
      next[idx] = { ...cur, ...patch } as RowState;
      return next;
    });
  }

  async function onSave() {
    setPending(true);
    try {
      const mappings: Mapping[] = [];
      for (const r of rows) {
        const m = toMapping(r);
        if (!m) {
          toast.error(`Mapping inválido para ${r.placeholder}.`);
          return;
        }
        mappings.push(m);
      }
      const fd = new FormData();
      fd.set("template_id", templateId);
      fd.set("mappings", JSON.stringify(mappings));
      if (activate) fd.set("ativar", "1");
      await saveTemplateMappingsAction(fd);
      toast.success("Mappings salvos.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao salvar.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid gap-4">
      <p className="text-sm text-muted">
        {placeholders.length} placeholders detectados no template.
      </p>

      <div className="overflow-hidden rounded-ui border border-line bg-surface">
        <table className="w-full text-sm">
          <thead className="bg-paper text-left text-xs uppercase tracking-kicker text-ink/60">
            <tr>
              <th className="px-3 py-2">Placeholder</th>
              <th className="px-3 py-2">Tipo</th>
              <th className="px-3 py-2">Origem</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => (
              <tr key={r.placeholder + idx} className="border-t border-line align-top">
                <td className="px-3 py-2 font-mono text-xs">{r.placeholder}</td>
                <td className="px-3 py-2">
                  <select
                    value={r.type}
                    onChange={(e) => updateRow(idx, { type: e.target.value as RowState["type"] })}
                    className="rounded-ui border border-line bg-surface px-2 py-1 text-xs"
                  >
                    <option value="tabela">tabela</option>
                    <option value="computed">computed</option>
                  </select>
                </td>
                <td className="px-3 py-2">
                  {r.type === "tabela" ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="text-xs text-muted">Tabela</label>
                      <select
                        value={r.table}
                        onChange={(e) => updateRow(idx, { table: e.target.value, column: ALLOWED_TABLES[e.target.value].columns[0], filter: "" })}
                        className="rounded-ui border border-line bg-surface px-2 py-1 text-xs"
                      >
                        {TABLES.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                      <label className="text-xs text-muted">Coluna</label>
                      <select
                        value={r.column}
                        onChange={(e) => updateRow(idx, { column: e.target.value })}
                        className="rounded-ui border border-line bg-surface px-2 py-1 text-xs"
                      >
                        {ALLOWED_TABLES[r.table].columns.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                      {ALLOWED_TABLES[r.table].filters.length > 0 && (
                        <>
                          <label className="text-xs text-muted">Filtro</label>
                          <select
                            value={r.filter}
                            onChange={(e) => updateRow(idx, { filter: e.target.value })}
                            className="rounded-ui border border-line bg-surface px-2 py-1 text-xs"
                          >
                            <option value="">— sem filtro —</option>
                            {ALLOWED_TABLES[r.table].filters.map((f) => <option key={f} value={f}>{f}</option>)}
                          </select>
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-muted">Função</label>
                      <select
                        value={r.fn}
                        onChange={(e) => updateRow(idx, { fn: e.target.value })}
                        className="rounded-ui border border-line bg-surface px-2 py-1 text-xs"
                      >
                        {COMPUTED_FNS.map((f) => <option key={f} value={f}>{f}</option>)}
                      </select>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end gap-2">
        <a href="/rh/documentos" className="ds-button ds-button-secondary">Cancelar</a>
        <button onClick={onSave} disabled={pending} className="ds-button ds-button-primary">
          <Save size={14} /> {activate ? "Salvar e ativar" : "Salvar"}
        </button>
      </div>
    </div>
  );
}
