"use client";

import { useState, type FormEvent } from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/card";
import { DataTableShell } from "@/components/ui/data-table";
import { SearchInline } from "@/components/ui/search-inline";
import { StatusPill } from "@/components/ui/status-pill";
import { BotaoAtivar } from "@/components/questionario/botao-ativar";
import { ListaRotulos } from "@/components/questionario/lista-rotulos";
import {
  alternarAtivoEscalaAction,
  atualizarEscalaAction,
  criarEscalaAction,
} from "@/lib/actions/questionario-escalas";
import { useAction } from "@/lib/hooks/use-action";
import { normalizarBusca } from "@/lib/questionario/lista";
import type { EscalaRow } from "@/lib/questionario/tipos";

type Props = { escalas: EscalaRow[]; podeCriar: boolean; podeEditar: boolean };

const OPCOES_INICIAIS = ["", ""];

export function EscalasManager({ escalas, podeCriar, podeEditar }: Props) {
  const [editando, setEditando] = useState<EscalaRow | null>(null);
  const [opcoes, setOpcoes] = useState<string[]>(OPCOES_INICIAIS);
  const [busca, setBusca] = useState("");
  const [formKey, setFormKey] = useState(0);

  const salvar = useAction(
    (fd: FormData) => (fd.get("id") ? atualizarEscalaAction(fd) : criarEscalaAction(fd)),
    { onSuccess: () => limpar() },
  );

  function limpar() {
    setEditando(null);
    setOpcoes(OPCOES_INICIAIS);
    setFormKey((k) => k + 1);
  }

  function editar(escala: EscalaRow) {
    setEditando(escala);
    setOpcoes(escala.opcoes.length > 0 ? escala.opcoes : OPCOES_INICIAIS);
  }

  function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    salvar.run(new FormData(e.currentTarget));
  }

  const termo = normalizarBusca(busca);
  const visiveis = escalas.filter((e) => normalizarBusca(e.descricao).includes(termo));
  const mostrarForm = editando ? podeEditar : podeCriar;

  return (
    <div className="grid gap-6">
      {mostrarForm ? (
        <Panel>
          <form key={`${editando?.id ?? "novo"}-${formKey}`} onSubmit={enviar} className="grid gap-4">
            {editando ? <input type="hidden" name="id" value={editando.id} /> : null}
            <div className="grid gap-1">
              <label htmlFor="escala-descricao" className="text-sm font-medium text-ink/80">
                Descrição *
              </label>
              <input id="escala-descricao" name="descricao" required defaultValue={editando?.descricao ?? ""} />
            </div>
            <ListaRotulos
              nome="opcoes"
              rotulo="Opção"
              valores={opcoes}
              onChange={setOpcoes}
              placeholder="Ex.: Em desenvolvimento"
            />
            <div className="flex gap-3">
              <Button type="submit" variant="primary" loading={salvar.pending}>
                {editando ? "Salvar" : "Cadastrar"}
              </Button>
              {editando ? (
                <Button type="button" variant="secondary" onClick={limpar}>
                  Cancelar
                </Button>
              ) : null}
            </div>
          </form>
        </Panel>
      ) : null}

      <DataTableShell
        toolbar={<SearchInline value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Pesquisar" />}
      >
        <table className="ds-dt min-w-[640px]">
          <thead>
            <tr>
              <th>Descrição</th>
              <th>Opções</th>
              <th className="w-[130px]">Situação</th>
              <th className="w-[110px] text-right">Ação</th>
            </tr>
          </thead>
          <tbody>
            {visiveis.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-5 py-10 text-center text-sm text-ink/60">
                  Nenhuma escala encontrada.
                </td>
              </tr>
            ) : null}
            {visiveis.map((e) => (
              <tr key={e.id}>
                <td className="pl-4 font-semibold text-ink">{e.descricao}</td>
                <td className="text-ink/80">{e.opcoes.join(" · ")}</td>
                <td>
                  <StatusPill tone={e.ativo ? "success" : "neutral"}>{e.ativo ? "Ativa" : "Inativa"}</StatusPill>
                </td>
                <td className="pr-4">
                  {podeEditar ? (
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        aria-label={`Editar ${e.descricao}`}
                        onClick={() => editar(e)}
                        className="rounded-ui p-1.5 text-brand hover:bg-brand/10"
                      >
                        <Pencil size={16} />
                      </button>
                      <BotaoAtivar acao={alternarAtivoEscalaAction} id={e.id} ativo={e.ativo} nome={e.descricao} />
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
