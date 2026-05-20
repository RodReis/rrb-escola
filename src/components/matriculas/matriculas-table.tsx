"use client";

import Link from "next/link";
import Image from "next/image";
import { Eye, Inbox } from "lucide-react";
import { updateEnrollmentStatusAction } from "@/lib/actions/academics";
import { DataTableShell } from "@/components/ui/data-table";
import { StatusPill } from "@/components/ui/status-pill";

const statuses = ["ativa", "cancelada", "transferida", "concluida"];

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
  ano_letivo: number | null;
  data_matricula: string | null;
  status: string;
  alunos: { nome: string | null; matricula_codigo: string | null; foto_url: string | null } | null;
  series: { nome: string | null } | null;
  turmas: { nome: string | null } | null;
  planos: { nome: string | null } | null;
};

export function MatriculasTable({ matriculas }: { matriculas: Matricula[] }) {
  return (
    <DataTableShell>
      <table className="ds-dt min-w-[1020px]">
        <thead>
          <tr>
            <th>Aluno</th>
            <th>Série</th>
            <th>Turma</th>
            <th>Plano</th>
            <th>Ano</th>
            <th>Data</th>
            <th>Status</th>
            <th className="text-right">Ações</th>
          </tr>
        </thead>
        <tbody>
          {matriculas.length === 0 ? (
            <tr>
              <td colSpan={8} className="py-12">
                <div className="flex flex-col items-center justify-center gap-2 text-ink/40">
                  <Inbox size={28} />
                  <p className="text-sm font-medium">Nenhuma matrícula encontrada.</p>
                </div>
              </td>
            </tr>
          ) : null}
          {matriculas.map((item) => {
            const tone = statusTone[item.status as keyof typeof statusTone] ?? "neutral";
            return (
              <tr key={item.id}>
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
                      <span className="text-xs text-ink/50">#{item.alunos?.matricula_codigo}</span>
                    </div>
                  </Link>
                </td>
                <td className="text-ink/80">{item.series?.nome ?? "—"}</td>
                <td className="text-ink/80">{item.turmas?.nome ?? "—"}</td>
                <td className="text-ink/80">{item.planos?.nome ?? "Sem plano"}</td>
                <td className="text-ink/80">{item.ano_letivo}</td>
                <td className="text-ink/80">{dateText(item.data_matricula)}</td>
                <td>
                  <form action={updateEnrollmentStatusAction} className="flex items-center gap-2">
                    <input type="hidden" name="id" value={item.id} />
                    <input type="hidden" name="aluno_id" value={item.aluno_id} />
                    <StatusPill tone={tone}>{item.status}</StatusPill>
                    <select name="status" defaultValue={item.status} className="min-w-[120px]">
                      {statuses.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                    <button className="ds-button ds-button-secondary min-h-0 px-2.5 py-1.5 text-xs">Salvar</button>
                  </form>
                </td>
                <td className="text-right">
                  <div className="inline-flex gap-2">
                    <Link href={`/matriculas/${item.id}`} className="ds-button ds-button-secondary min-h-0 px-2.5 py-1.5 text-xs">
                      <Eye size={12} /> Histórico
                    </Link>
                    <Link href={`/alunos/${item.aluno_id}`} className="ds-button ds-button-secondary min-h-0 px-2.5 py-1.5 text-xs">
                      Ficha
                    </Link>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </DataTableShell>
  );
}
