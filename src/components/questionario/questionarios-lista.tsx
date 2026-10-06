"use client";

import Link from "next/link";
import { useState } from "react";
import { Copy, Pencil } from "lucide-react";
import { DataTableShell } from "@/components/ui/data-table";
import { SearchInline } from "@/components/ui/search-inline";
import { StatusPill } from "@/components/ui/status-pill";
import { BotaoAtivar } from "@/components/questionario/botao-ativar";
import {
  alternarAtivoQuestionarioAction,
  clonarQuestionarioAction,
} from "@/lib/actions/questionario-questionarios";
import { useAction } from "@/lib/hooks/use-action";
import { normalizarBusca } from "@/lib/questionario/lista";
import type { QuestionarioRow } from "@/lib/questionario/tipos";

function BotaoClonar({ id, descricao }: { id: string; descricao: string }) {
  const { run, pending } = useAction((fd: FormData) => clonarQuestionarioAction(fd), {
    confirm: {
      title: "Clonar questionário",
      message: `Criar uma cópia inativa de "${descricao}", com as mesmas questões e escalas?`,
      confirmLabel: "Clonar",
      variant: "default",
    },
  });
  return (
    <button
      type="button"
      disabled={pending}
      aria-label={`Clonar ${descricao}`}
      title="Clonar"
      onClick={() => {
        const fd = new FormData();
        fd.set("id", id);
        run(fd);
      }}
      className="rounded-ui p-1.5 text-ink/70 hover:bg-muted"
    >
      <Copy size={16} />
    </button>
  );
}

type Props = { questionarios: QuestionarioRow[]; podeCriar: boolean; podeEditar: boolean };

export function QuestionariosLista({ questionarios, podeCriar, podeEditar }: Props) {
  const [busca, setBusca] = useState("");
  const termo = normalizarBusca(busca);
  const visiveis = questionarios.filter((q) => normalizarBusca(q.descricao).includes(termo));

  return (
    <DataTableShell
      toolbar={<SearchInline value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Pesquisar" />}
    >
      <table className="ds-dt min-w-[640px]">
        <thead>
          <tr>
            <th>Descrição</th>
            <th className="w-[130px]">Situação</th>
            <th className="w-[150px] text-right">Ação</th>
          </tr>
        </thead>
        <tbody>
          {visiveis.length === 0 ? (
            <tr>
              <td colSpan={3} className="px-5 py-10 text-center text-sm text-ink/60">
                Nenhum questionário encontrado.
              </td>
            </tr>
          ) : null}
          {visiveis.map((q) => (
            <tr key={q.id}>
              <td className="pl-4 text-ink">{q.descricao}</td>
              <td>
                <StatusPill tone={q.ativo ? "success" : "neutral"}>{q.ativo ? "Ativo" : "Inativo"}</StatusPill>
              </td>
              <td className="pr-4">
                <div className="flex items-center justify-end gap-1">
                  {podeCriar ? <BotaoClonar id={q.id} descricao={q.descricao} /> : null}
                  {podeEditar ? (
                    <>
                      <Link
                        href={`/questionario/questionarios/${q.id}/editar`}
                        aria-label={`Editar ${q.descricao}`}
                        className="rounded-ui p-1.5 text-brand hover:bg-brand/10"
                      >
                        <Pencil size={16} />
                      </Link>
                      <BotaoAtivar
                        acao={alternarAtivoQuestionarioAction}
                        id={q.id}
                        ativo={q.ativo}
                        nome={q.descricao}
                      />
                    </>
                  ) : null}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </DataTableShell>
  );
}
