"use client";

import Link from "next/link";
import Image from "next/image";
import { Eye, FileText, Inbox, Power, PowerOff } from "lucide-react";
import { toggleEnrollmentStatusAction } from "@/lib/actions/academics";
import { DataTableShell } from "@/components/ui/data-table";
import { StatusPill } from "@/components/ui/status-pill";
import { RowActionButton } from "@/components/ui/row-action-button";
import { MatriculaFullEditDialog } from "@/components/matriculas/matricula-full-edit-dialog";
import { TIPO_VAGA_LABEL } from "@/components/matriculas/tipo-vaga";

type Option = { id: string; nome: string };
type TurmaOption = { id: string; nome: string; serieId: string };

const statusTone = {
  ativa: "success",
  cancelada: "danger",
  transferida: "warning",
  concluida: "neutral",
} as const;

function dateText(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(`${value}T00:00:00`).toLocaleDateString("pt-BR");
}

type Matricula = {
  id: string;
  aluno_id: string;
  serie_id: string | null;
  turma_id: string | null;
  plano_id: string | null;
  ano_letivo: number | null;
  data_matricula: string | null;
  status: string;
  tipo_vaga: string;
  alunos: { nome: string | null; matricula_codigo: string | null; foto_url: string | null } | null;
  series: { nome: string | null } | null;
  turmas: { nome: string | null } | null;
  planos: { nome: string | null } | null;
};

function MatriculaRow({
  item,
  series,
  turmas,
  planos,
}: {
  item: Matricula;
  series: Option[];
  turmas: TurmaOption[];
  planos: Option[];
}) {
  const tone = statusTone[item.status as keyof typeof statusTone] ?? "neutral";
  const ativa = item.status === "ativa";
  const podeAlternarStatus = item.status === "ativa" || item.status === "cancelada";

  return (
    <tr>
      <td>
        <Link href={`/alunos/${item.aluno_id}`} className="group flex items-center gap-3">
          {item.alunos?.foto_url ? (
            <Image
              src={item.alunos.foto_url}
              alt={item.alunos.nome ?? ""}
              width={32}
              height={32}
              className="size-8 shrink-0 rounded-full object-cover"
            />
          ) : (
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-line text-xs font-bold text-ink/50">
              {(item.alunos?.nome ?? "?")[0].toUpperCase()}
            </span>
          )}
          <div className="flex flex-col leading-tight">
            <span className="font-semibold text-ink group-hover:text-brand">{item.alunos?.nome}</span>
            <span className="text-xs text-ink/60">#{item.alunos?.matricula_codigo}</span>
          </div>
        </Link>
      </td>
      <td className="text-ink/80">{item.series?.nome ?? "—"}</td>
      <td className="text-ink/80">{item.turmas?.nome ?? "—"}</td>
      <td className="text-ink/80">{item.planos?.nome ?? "Sem plano"}</td>
      <td className="text-ink/80">{item.ano_letivo}</td>
      <td className="text-ink/80">{dateText(item.data_matricula)}</td>
      <td>
        <StatusPill tone="neutral">{TIPO_VAGA_LABEL[item.tipo_vaga] ?? item.tipo_vaga}</StatusPill>
      </td>
      <td>
        <StatusPill tone={tone}>{item.status}</StatusPill>
      </td>
      <td className="text-right">
        <div className="inline-flex items-center justify-end gap-1">
          <MatriculaFullEditDialog
            matriculaId={item.id}
            alunoId={item.aluno_id}
            alunoNome={item.alunos?.nome ?? ""}
            serieId={item.serie_id ?? ""}
            turmaId={item.turma_id ?? ""}
            planoId={item.plano_id}
            tipoVaga={item.tipo_vaga}
            status={item.status}
            series={series}
            turmas={turmas}
            planos={planos}
          />
          {podeAlternarStatus ? (
            <RowActionButton
              action={toggleEnrollmentStatusAction}
              args={{ id: item.id, aluno_id: item.aluno_id, status: ativa ? "cancelada" : "ativa" }}
              icon={ativa ? PowerOff : Power}
              label={ativa ? "Cancelar matrícula" : "Reativar matrícula"}
              tone={ativa ? "warning" : "success"}
              confirm={{
                title: ativa ? "Cancelar matrícula" : "Reativar matrícula",
                message: `Tem certeza que quer ${ativa ? "cancelar" : "reativar"} a matrícula de "${item.alunos?.nome}"?`,
                confirmLabel: ativa ? "Cancelar" : "Reativar",
                variant: ativa ? "warning" : "default",
              }}
              success={ativa ? "Matrícula cancelada." : "Matrícula reativada."}
              error="Falha ao alterar status."
            />
          ) : null}
          <Link
            href={`/matriculas/${item.id}`}
            title="Histórico"
            aria-label="Histórico"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-brand hover:bg-brand/10"
          >
            <Eye size={15} />
          </Link>
          <Link
            href={`/alunos/${item.aluno_id}`}
            title="Ficha"
            aria-label="Ficha"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-brand hover:bg-brand/10"
          >
            <FileText size={15} />
          </Link>
        </div>
      </td>
    </tr>
  );
}

export function MatriculasTable({
  matriculas,
  series,
  turmas,
  planos,
}: {
  matriculas: Matricula[];
  series: Option[];
  turmas: TurmaOption[];
  planos: Option[];
}) {
  return (
    <DataTableShell>
      <table className="ds-dt min-w-[1120px]">
        <thead>
          <tr>
            <th>Aluno</th>
            <th>Série</th>
            <th>Turma</th>
            <th>Plano</th>
            <th>Ano</th>
            <th>Data</th>
            <th>Tipo de vaga</th>
            <th>Status</th>
            <th className="text-right">Ações</th>
          </tr>
        </thead>
        <tbody>
          {matriculas.length === 0 ? (
            <tr>
              <td colSpan={9} className="py-12">
                <div className="flex flex-col items-center justify-center gap-2 text-ink/60">
                  <Inbox size={28} />
                  <p className="text-sm font-medium">Nenhuma matrícula encontrada.</p>
                </div>
              </td>
            </tr>
          ) : null}
          {matriculas.map((item) => (
            <MatriculaRow key={item.id} item={item} series={series} turmas={turmas} planos={planos} />
          ))}
        </tbody>
      </table>
    </DataTableShell>
  );
}
