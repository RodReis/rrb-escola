"use client";

import { useState, type FormEvent } from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/card";
import { DataTableShell } from "@/components/ui/data-table";
import { SearchInline } from "@/components/ui/search-inline";
import { StatusPill } from "@/components/ui/status-pill";
import { BotaoAtivar } from "@/components/questionario/botao-ativar";
import {
  alternarAtivoGrupoAction,
  atualizarGrupoAction,
  criarGrupoAction,
} from "@/lib/actions/questionario-grupos";
import { useAction } from "@/lib/hooks/use-action";
import { normalizarBusca } from "@/lib/questionario/lista";
import type { GrupoRow } from "@/lib/questionario/tipos";

type Props = { grupos: GrupoRow[]; podeCriar: boolean; podeEditar: boolean };

export function GruposManager({ grupos, podeCriar, podeEditar }: Props) {
  const [editando, setEditando] = useState<GrupoRow | null>(null);
  const [busca, setBusca] = useState("");
  const [formKey, setFormKey] = useState(0);

  const salvar = useAction(
    (fd: FormData) => (fd.get("id") ? atualizarGrupoAction(fd) : criarGrupoAction(fd)),
    {
      onSuccess: () => {
        setEditando(null);
        setFormKey((k) => k + 1);
      },
    },
  );

  const termo = normalizarBusca(busca);
  const visiveis = grupos.filter((g) => normalizarBusca(g.descricao).includes(termo));
  const mostrarForm = editando ? podeEditar : podeCriar;

  function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    salvar.run(new FormData(e.currentTarget));
  }

  return (
    <div className="grid gap-6">
      {mostrarForm ? (
        <Panel>
          <form key={`${editando?.id ?? "novo"}-${formKey}`} onSubmit={enviar} className="flex flex-wrap items-end gap-3">
            {editando ? <input type="hidden" name="id" value={editando.id} /> : null}
            <div className="grid min-w-[16rem] flex-1 gap-1">
              <label htmlFor="grupo-descricao" className="text-sm font-medium text-ink/80">
                Descrição *
              </label>
              <input id="grupo-descricao" name="descricao" required defaultValue={editando?.descricao ?? ""} />
            </div>
            <Button type="submit" variant="primary" loading={salvar.pending}>
              {editando ? "Salvar" : "Cadastrar"}
            </Button>
            {editando ? (
              <Button type="button" variant="secondary" onClick={() => setEditando(null)}>
                Cancelar
              </Button>
            ) : null}
          </form>
        </Panel>
      ) : null}

      <DataTableShell
        toolbar={<SearchInline value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Pesquisar" />}
      >
        <table className="ds-dt min-w-[560px]">
          <thead>
            <tr>
              <th className="w-[110px]">Código</th>
              <th>Descrição</th>
              <th className="w-[130px]">Situação</th>
              <th className="w-[110px] text-right">Ação</th>
            </tr>
          </thead>
          <tbody>
            {visiveis.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-5 py-10 text-center text-sm text-ink/60">
                  Nenhum grupo encontrado.
                </td>
              </tr>
            ) : null}
            {visiveis.map((g) => (
              <tr key={g.id}>
                <td className="pl-4 font-semibold text-ink">{g.codigo}</td>
                <td className="text-ink">{g.descricao}</td>
                <td>
                  <StatusPill tone={g.ativo ? "success" : "neutral"}>{g.ativo ? "Ativo" : "Inativo"}</StatusPill>
                </td>
                <td className="pr-4">
                  {podeEditar ? (
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        aria-label={`Editar ${g.descricao}`}
                        onClick={() => setEditando(g)}
                        className="rounded-ui p-1.5 text-brand hover:bg-brand/10"
                      >
                        <Pencil size={16} />
                      </button>
                      <BotaoAtivar
                        acao={alternarAtivoGrupoAction}
                        id={g.id}
                        ativo={g.ativo}
                        nome={g.descricao}
                      />
                    </div>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </DataTableShell>
    </div>
  );
}
