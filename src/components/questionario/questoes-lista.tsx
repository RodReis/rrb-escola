"use client";

import Link from "next/link";
import { useState } from "react";
import { Pencil } from "lucide-react";
import { DataTableShell } from "@/components/ui/data-table";
import { SearchInline } from "@/components/ui/search-inline";
import { StatusPill } from "@/components/ui/status-pill";
import { BotaoAtivar } from "@/components/questionario/botao-ativar";
import { alternarAtivoQuestaoAction } from "@/lib/actions/questionario-questoes";
import { normalizarBusca } from "@/lib/questionario/lista";
import type { QuestaoLinha } from "@/lib/questionario/tipos";
import { QUESTAO_TIPO_LABEL } from "@/lib/validation/questionario";

type Props = { questoes: QuestaoLinha[]; podeEditar: boolean };

export function QuestoesLista({ questoes, podeEditar }: Props) {
  const [busca, setBusca] = useState("");
  const termo = normalizarBusca(busca);
  const visiveis = questoes.filter((q) =>
    normalizarBusca(`${QUESTAO_TIPO_LABEL[q.tipo]} ${q.grupoDescricao} ${q.pergunta} ${q.escalaDescricao ?? ""}`).includes(termo),
  );

  return (
    <DataTableShell
      toolbar={<SearchInline value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Pesquisar" />}
    >
      <table className="ds-dt min-w-[860px]">
        <thead>
          <tr>
            <th className="w-[240px]">Tipo</th>
            <th className="w-[240px]">Grupo</th>
            <th>Pergunta</th>
            <th className="w-[180px]">Escala</th>
            <th className="w-[110px]">Situação</th>
            <th className="w-[110px] text-right">Ação</th>
          </tr>
        </thead>
        <tbody>
          {visiveis.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-5 py-10 text-center text-sm text-ink/60">
                Nenhuma questão encontrada.
              </td>
            </tr>
          ) : null}
          {visiveis.map((q) => (
            <tr key={q.id}>
              <td className="pl-4 text-ink">{QUESTAO_TIPO_LABEL[q.tipo]}</td>
              <td className="text-ink/80">{q.grupoDescricao}</td>
              <td className="max-w-[28rem] truncate text-ink" title={q.pergunta}>{q.pergunta}</td>
              <td className="text-ink/80">{q.escalaDescricao ?? "—"}</td>
              <td>
                <StatusPill tone={q.ativa ? "success" : "neutral"}>{q.ativa ? "Ativa" : "Inativa"}</StatusPill>
              </td>
              <td className="pr-4">
                {podeEditar ? (
                  <div className="flex items-center justify-end gap-1">
                    <Link
                      href={`/questionario/questoes/${q.id}/editar`}
                      aria-label={`Editar ${q.pergunta}`}
                      className="rounded-ui p-1.5 text-brand hover:bg-brand/10"
                    >
                      <Pencil size={16} />
                    </Link>
                    <BotaoAtivar acao={alternarAtivoQuestaoAction} id={q.id} ativo={q.ativa} nome={q.pergunta} />
                  </div>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </DataTableShell>
  );
}
