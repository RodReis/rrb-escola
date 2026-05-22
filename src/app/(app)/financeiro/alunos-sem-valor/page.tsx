import { AlertTriangle } from "lucide-react";
import { Panel } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { DataTableShell } from "@/components/ui/data-table";
import { StatusPill } from "@/components/ui/status-pill";
import { AlunosSemValorFilters } from "@/components/finance/alunos-sem-valor-filters";
import { ExportAlunosSemValorButton } from "@/components/finance/export-alunos-sem-valor-button";
import {
  getAlunosSemValor,
  MOTIVO_LABEL,
  motivoTone,
  type AlunosSemValorFilters as Filters,
  type MotivoSemValor,
} from "@/lib/data/alunos-sem-valor";
import { getAcademicData } from "@/lib/data/lookups";
import { requirePermission } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

const VALID_MOTIVOS = Object.keys(MOTIVO_LABEL) as MotivoSemValor[];

function parseFilters(sp: {
  nome?: string;
  motivo?: string;
  serie?: string;
  turma?: string;
}): Filters {
  const motivo =
    sp.motivo && VALID_MOTIVOS.includes(sp.motivo as MotivoSemValor)
      ? (sp.motivo as MotivoSemValor)
      : null;
  return {
    nome: sp.nome?.trim() || null,
    motivo,
    serieId: sp.serie || null,
    turmaId: sp.turma || null,
  };
}

export default async function AlunosSemValorPage({
  searchParams,
}: {
  searchParams: { nome?: string; motivo?: string; serie?: string; turma?: string };
}) {
  await requirePermission("relatorios", "read");

  const filters = parseFilters(searchParams);
  const [rows, academic] = await Promise.all([
    getAlunosSemValor(filters),
    getAcademicData(),
  ]);

  const semValor = rows.filter((r) => r.motivo === "sem_valor").length;
  const bolsistas = rows.filter(
    (r) => r.motivo === "bolsa_integral" || r.motivo === "bolsa_parcial"
  ).length;
  const permutaGratuita = rows.filter(
    (r) => r.motivo === "permuta" || r.motivo === "gratuita"
  ).length;

  return (
    <div className="grid gap-8">
      <PageHeader
        breadcrumb={[{ label: "Financeiro", href: "/financeiro" }, { label: "Alunos sem valor" }]}
        title="Alunos sem valor de matrícula"
        description="Matrículas ativas de 2026 sem valor de matrícula definido ou com vaga não-pagante."
        actions={<ExportAlunosSemValorButton rows={rows} />}
        kpis={[
          { label: "Total", value: rows.length.toLocaleString("pt-BR") },
          { label: "Sem valor", value: semValor.toLocaleString("pt-BR"), tone: "danger" },
          { label: "Bolsistas", value: bolsistas.toLocaleString("pt-BR"), tone: "warning" },
          { label: "Permuta/Gratuita", value: permutaGratuita.toLocaleString("pt-BR") },
        ]}
      />

      <AlunosSemValorFilters
        defaults={{
          nome: filters.nome ?? "",
          motivo: filters.motivo ?? "",
          serieId: filters.serieId ?? "",
          turmaId: filters.turmaId ?? "",
        }}
        series={academic.series.map((s) => ({ id: s.id, nome: s.nome }))}
        turmas={academic.turmas.map((t) => ({ id: t.id, nome: t.nome }))}
      />

      {rows.length === 0 ? (
        <Panel>
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-ink/40">
            <AlertTriangle size={28} />
            <p className="text-sm font-medium">Nenhum aluno sem valor encontrado.</p>
          </div>
        </Panel>
      ) : (
        <DataTableShell>
          <table className="ds-dt min-w-[880px]">
            <thead>
              <tr>
                <th>Aluno</th>
                <th>Série</th>
                <th>Turma</th>
                <th>Motivo</th>
                <th>Responsáveis</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.matriculaId}>
                  <td className="font-semibold text-ink">{r.nome}</td>
                  <td>{r.serie}</td>
                  <td>{r.turma}</td>
                  <td>
                    <StatusPill tone={motivoTone(r.motivo)}>
                      {MOTIVO_LABEL[r.motivo]}
                    </StatusPill>
                  </td>
                  <td>
                    {r.responsaveis.length === 0 ? (
                      <span className="text-ink/40">—</span>
                    ) : (
                      <div className="grid gap-1">
                        {r.responsaveis.map((resp, idx) => (
                          <div key={idx} className="text-sm">
                            <span className="font-medium text-ink">{resp.nome}</span>
                            {resp.parentesco ? (
                              <span className="text-ink/50"> ({resp.parentesco})</span>
                            ) : null}
                            {resp.telefone ? (
                              <span className="text-ink/60"> · {resp.telefone}</span>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataTableShell>
      )}
    </div>
  );
}
