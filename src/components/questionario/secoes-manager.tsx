"use client";

import { useState, type FormEvent } from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/card";
import { DataTableShell } from "@/components/ui/data-table";
import { SearchInline } from "@/components/ui/search-inline";
import { StatusPill } from "@/components/ui/status-pill";
import { Switch } from "@/components/ui/switch";
import { BotaoAtivar } from "@/components/questionario/botao-ativar";
import {
  alternarAtivoSecaoAction,
  atualizarSecaoAction,
  criarSecaoAction,
} from "@/lib/actions/questionario-secoes";
import { useAction } from "@/lib/hooks/use-action";
import { normalizarBusca } from "@/lib/questionario/lista";
import type { SecaoRow } from "@/lib/questionario/tipos";

type Props = { secoes: SecaoRow[]; podeCriar: boolean; podeEditar: boolean };

export function SecoesManager({ secoes, podeCriar, podeEditar }: Props) {
  const [editando, setEditando] = useState<SecaoRow | null>(null);
  const [coletivo, setColetivo] = useState(false);
  const [busca, setBusca] = useState("");
  const [formKey, setFormKey] = useState(0);

  const salvar = useAction(
    (fd: FormData) => (fd.get("id") ? atualizarSecaoAction(fd) : criarSecaoAction(fd)),
    { onSuccess: () => limpar() },
  );

  function limpar() {
    setEditando(null);
    setColetivo(false);
    setFormKey((k) => k + 1);
  }

  function editar(secao: SecaoRow) {
    setEditando(secao);
    setColetivo(secao.permiteLancamentoColetivo);
  }

  function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    salvar.run(new FormData(e.currentTarget));
  }

  const termo = normalizarBusca(busca);
  const visiveis = secoes.filter((s) => normalizarBusca(s.descricao).includes(termo));
  const mostrarForm = editando ? podeEditar : podeCriar;

  return (
    <div className="grid gap-6">
      {mostrarForm ? (
        <Panel>
          <form key={`${editando?.id ?? "novo"}-${formKey}`} onSubmit={enviar} className="flex flex-wrap items-end gap-4">
            {editando ? <input type="hidden" name="id" value={editando.id} /> : null}
            <input type="hidden" name="permiteLancamentoColetivo" value={coletivo ? "on" : ""} />
            <div className="grid min-w-[16rem] flex-1 gap-1">
              <label htmlFor="secao-descricao" className="text-sm font-medium text-ink/80">
                Descrição *
              </label>
              <input id="secao-descricao" name="descricao" required defaultValue={editando?.descricao ?? ""} />
            </div>
            <Switch checked={coletivo} onChange={setColetivo} label="Permite lançamento coletivo" />
            <Button type="submit" variant="primary" loading={salvar.pending}>
              {editando ? "Salvar" : "Cadastrar"}
            </Button>
            {editando ? (
              <Button type="button" variant="secondary" onClick={limpar}>
                Cancelar
              </Button>
            ) : null}
          </form>
        </Panel>
      ) : null}

      <DataTableShell
        toolbar={<SearchInline value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Pesquisar" />}
      >
        <table className="ds-dt min-w-[640px]">
          <thead>
            <tr>
              <th className="w-[110px]">Código</th>
              <th>Descrição</th>
              <th className="w-[220px]">Permite lançamento coletivo</th>
              <th className="w-[130px]">Situação</th>
              <th className="w-[110px] text-right">Ação</th>
            </tr>
          </thead>
          <tbody>
            {visiveis.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center text-sm text-ink/60">
                  Nenhuma seção encontrada.
                </td>
              </tr>
            ) : null}
            {visiveis.map((s) => (
              <tr key={s.id}>
                <td className="pl-4 font-semibold text-ink">{s.codigo}</td>
                <td className="text-ink">{s.descricao}</td>
                <td className="text-ink/80">{s.permiteLancamentoColetivo ? "Sim" : "Não"}</td>
                <td>
                  <StatusPill tone={s.ativo ? "success" : "neutral"}>{s.ativo ? "Ativa" : "Inativa"}</StatusPill>
                </td>
                <td className="pr-4">
                  {podeEditar ? (
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        aria-label={`Editar ${s.descricao}`}
                        onClick={() => editar(s)}
                        className="rounded-ui p-1.5 text-brand hover:bg-brand/10"
                      >
                        <Pencil size={16} />
                      </button>
                      <BotaoAtivar acao={alternarAtivoSecaoAction} id={s.id} ativo={s.ativo} nome={s.descricao} />
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
