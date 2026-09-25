"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { money } from "@/lib/constants";
import { useAction } from "@/lib/hooks/use-action";
import {
  confirmarImportacaoAction,
  previewPlanilhaAction,
  type LinhaPreview,
  type ResultadoPreview,
} from "@/lib/actions/importar-previsto";

const MAX_BYTES = 2 * 1024 * 1024;

type Estado = Extract<ResultadoPreview, { erro: null }>;
type LinhaEditavel = LinhaPreview & { incluir: boolean };

const SITUACAO: Record<LinhaPreview["situacao"], string> = {
  novo: "Nova",
  duplicado: "Já existe",
  repetida: "Repetida no arquivo",
  invalida: "Inválida",
};

export function ImportarPrevistoForm() {
  const [pending, start] = useTransition();
  const [estado, setEstado] = useState<Estado | null>(null);
  const [linhas, setLinhas] = useState<LinhaEditavel[]>([]);

  function enviar(formData: FormData) {
    const arquivo = formData.get("arquivo");
    if (arquivo instanceof File && arquivo.size > MAX_BYTES) {
      toast.error("Arquivo maior que 2MB.");
      return;
    }
    start(async () => {
      const r = await previewPlanilhaAction(formData);
      if (r.erro !== null) {
        toast.error(r.erro);
        return;
      }
      setEstado(r);
      setLinhas(r.linhas.map((l) => ({ ...l, incluir: l.situacao === "novo" })));
    });
  }

  const atualizar = (i: number, patch: Partial<LinhaEditavel>) =>
    setLinhas((atual) => atual.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  const marcadas = linhas.filter((l) => l.incluir);
  const semEmpresaOuCategoria = marcadas.filter((l) => !l.empresaId || !l.categoriaId).length;
  const total = marcadas.reduce((s, l) => s + (l.valor ?? 0), 0);

  // `action` inline de propósito: o useAction relê a função a cada render, então a
  // mensagem de confirmação sempre mostra a contagem e o total atuais.
  const { run: importar, pending: importando } = useAction(
    () =>
      confirmarImportacaoAction(
        JSON.stringify(
          marcadas.map((l) => ({
            descricao: l.descricao, valor: l.valor, dataVencimento: l.dataVencimento,
            empresaId: l.empresaId, categoriaId: l.categoriaId, classe: l.classe, documento: l.documento,
          })),
        ),
      ),
    {
      confirm: `Importar ${marcadas.length} título(s), somando ${money.format(total)}?`,
      success: "Importação concluída.",
      onSuccess: () => {
        setEstado(null);
        setLinhas([]);
      },
    },
  );

  return (
    <div className="grid gap-4">
      <form action={enviar} className="flex flex-wrap items-end gap-3">
        <label>
          Planilha (.xlsx)
          <input name="arquivo" type="file" accept=".xlsx" required />
        </label>
        <Button type="submit" variant="primary" loading={pending}>Pré-visualizar</Button>
      </form>

      {estado ? (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-ink/60">
                  <th />
                  <th>Linha</th><th>Descrição</th><th className="text-right">Valor</th><th>Vence</th>
                  <th>Empresa</th><th>Categoria</th><th>Situação</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((l, i) => (
                  <tr key={l.linha} className={l.situacao === "novo" ? "" : "opacity-60"}>
                    <td>
                      <input
                        type="checkbox"
                        checked={l.incluir}
                        disabled={l.situacao === "invalida" || l.situacao === "duplicado"}
                        onChange={(e) => atualizar(i, { incluir: e.target.checked })}
                        aria-label={`Incluir linha ${l.linha}`}
                      />
                    </td>
                    <td>{l.linha}</td>
                    <td>{l.descricao}</td>
                    <td className="text-right tabular-nums">{l.valor === null ? "—" : money.format(l.valor)}</td>
                    <td>{l.dataVencimento ? new Date(`${l.dataVencimento}T00:00:00`).toLocaleDateString("pt-BR") : "—"}</td>
                    <td>
                      <select value={l.empresaId ?? ""} onChange={(e) => atualizar(i, { empresaId: e.target.value || null })}>
                        <option value="">{l.empresaTexto ? `? ${l.empresaTexto}` : "Selecione"}</option>
                        {estado.empresas.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
                      </select>
                    </td>
                    <td>
                      <select value={l.categoriaId ?? ""} onChange={(e) => atualizar(i, { categoriaId: e.target.value || null })}>
                        <option value="">Selecione</option>
                        {estado.categorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                      </select>
                    </td>
                    <td>{SITUACAO[l.situacao]}{l.motivoInvalida ? ` (${l.motivoInvalida})` : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-sm tabular-nums">
              {marcadas.length} linha(s) marcada(s) — {money.format(total)}
              {semEmpresaOuCategoria > 0 ? ` — ${semEmpresaOuCategoria} sem empresa ou categoria` : ""}
            </p>
            <Button variant="primary" loading={importando} disabled={marcadas.length === 0 || semEmpresaOuCategoria > 0} onClick={() => importar()}>
              Importar {marcadas.length} título(s)
            </Button>
          </div>
        </>
      ) : null}
    </div>
  );
}
