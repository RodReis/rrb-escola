import Link from "next/link";
import { Eye } from "lucide-react";
import { ExportStudentsReportButton } from "@/components/pdf/export-students-report-button";
import { PageHeader } from "@/components/ui/page-header";
import { DataTableShell } from "@/components/ui/data-table";
import { StatusPill } from "@/components/ui/status-pill";
import { getStudentsReport } from "@/lib/data/students";
import { requirePermission } from "@/lib/auth/session";

export default async function RelatorioAlunosPage() {
  await requirePermission("relatorios", "read");
  const rows = await getStudentsReport();
  const ativos = rows.filter((item) => item.ativo).length;
  const inativos = rows.length - ativos;
  const matriculados = rows.filter((item) => item.statusMatricula === "ativa").length;

  return (
    <div className="grid gap-8">
      <PageHeader
        breadcrumb={[{ label: "Relatórios", href: "/" }, { label: "Alunos" }]}
        title="Relatório de Alunos"
        counter={rows.length.toLocaleString("pt-BR")}
        description="Visão consolidada de alunos, responsáveis, série, turma e status."
        actions={<ExportStudentsReportButton rows={rows} />}
        kpis={[
          { label: "Total",        value: rows.length.toLocaleString("pt-BR") },
          { label: "Ativos",       value: ativos.toLocaleString("pt-BR"), tone: "success" },
          { label: "Inativos",     value: inativos.toLocaleString("pt-BR"), tone: "danger" },
          { label: "Matriculados", value: matriculados.toLocaleString("pt-BR") }
        ]}
      />

      <DataTableShell>
        <table className="ds-dt min-w-[1040px]">
          <thead>
            <tr>
              <th>Matrícula</th>
              <th>Aluno</th>
              <th>CPF</th>
              <th>Responsável</th>
              <th>Série</th>
              <th>Turma</th>
              <th>Ano</th>
              <th>Status</th>
              <th className="text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((item) => (
              <tr key={item.id}>
                <td className="font-semibold text-brand">{item.matricula}</td>
                <td className="font-semibold text-ink">{item.nome}</td>
                <td className="text-ink/75">{item.cpf || "—"}</td>
                <td className="text-ink/75">{item.responsavel || "—"}</td>
                <td className="text-ink/75">{item.serie || "—"}</td>
                <td className="text-ink/75">{item.turma || "—"}</td>
                <td className="text-ink/75">{item.anoLetivo || "—"}</td>
                <td>
                  <StatusPill tone={item.ativo ? "success" : "danger"}>
                    {item.ativo ? "Ativo" : "Inativo"}
                  </StatusPill>
                </td>
                <td className="text-right">
                  <Link href={`/alunos/${item.id}`} className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline">
                    <Eye size={12} /> Ficha
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </DataTableShell>
    </div>
  );
}
