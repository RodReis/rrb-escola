import { AlertTriangle } from "lucide-react";
import { Panel } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { DataTableShell } from "@/components/ui/data-table";
import { StatusPill } from "@/components/ui/status-pill";
import { AlunosSemValorFilters } from "@/components/finance/alunos-sem-valor-filters";
import { ExportAlunosSemValorButton } from "@/components/finance/export-alunos-sem-valor-button";
import { MatriculaEditDialog } from "@/components/finance/matricula-edit-dialog";
import {
  getAlunosSemValor,
  MOTIVO_LABEL,
  motivoTone,
  type AlunosSemValorFilters as Filters,
  type MotivoSemValor,
} from "@/lib/data/alunos-sem-valor";
import { getAcademicData } from "@/lib/data/lookups";
import { requirePermission } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";

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
  searchParams: Promise<{ nome?: string; motivo?: string; serie?: string; turma?: string }>;
}) {
  const session = await requirePermission("relatorios", "read");
  const isAdmin = session.profile.perfil === "admin";
  const canUpdate = isAdmin || can(session.permissions, "matriculas", "update");
  const canCreate = isAdmin || can(session.permissions, "matriculas", "create");
  // The "Ações" column shows if the user can do at least one of the two.
  const canEditAny = canUpdate || canCreate;

  const sp = await searchParams;
  const filters = parseFilters(sp);
  const [rows, academic] = await Promise.all([
    getAlunosSemValor(filters),
    getAcademicData(),
  ]);

  const semMatricula = rows.filter((r) => r.motivo === "sem_matricula").length;
  const semValor = rows.filter((r) => r.motivo === "sem_valor").length;
  const bolsistas = rows.filter(
    (r) => r.motivo === "bolsa_integral" || r.motivo === "bolsa_parcial"
  ).length;
  const permutaGratuita = rows.filter(
    (r) => r.motivo === "permuta" || r.motivo === "gratuita"
  ).length;

  const series = academic.series.map((s) => ({ id: s.id, nome: s.nome }));
  const turmas = academic.turmas.map((t) => ({
    id: t.id,
    nome: t.nome,
    serieId: (t as { serie_id: string | null }).serie_id ?? "",
  }));
  const planos = academic.planos.map((p) => ({ id: p.id, nome: p.nome }));

  return (
    <div className="grid gap-8">
      <PageHeader
        breadcrumb={[{ label: "Financeiro", href: "/financeiro" }, { label: "Alunos sem valor" }]}
        title="Alunos sem valor de matrícula"
        description="Alunos ativos sem matrícula 2026, sem valor de matrícula definido ou com vaga não-pagante."
        actions={<ExportAlunosSemValorButton rows={rows} />}
        kpis={[
          { label: "Total", value: rows.length.toLocaleString("pt-BR") },
          { label: "Sem matrícula", value: semMatricula.toLocaleString("pt-BR"), tone: "danger" },
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
        series={series}
        turmas={turmas.map((t) => ({ id: t.id, nome: t.nome }))}
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
          <table className="ds-dt min-w-[940px]">
            <thead>
              <tr>
                <th>Aluno</th>
                <th>Série</th>
                <th>Turma</th>
                <th>Motivo</th>
                <th>Responsáveis</th>
                {canEditAny ? <th>Ações</th> : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.alunoId}>
                  <td className="font-semibold text-ink">{r.nome}</td>
                  <td>{r.serie || "—"}</td>
                  <td>{r.turma || "—"}</td>
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
                        {r.responsaveis.map((resp) => (
                          <div key={`${resp.nome}-${resp.parentesco ?? ""}`} className="text-sm">
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
                  {canEditAny ? (
                    <td>
                      {(r.matriculaId ? canUpdate : canCreate) ? (
                        <MatriculaEditDialog
                          row={r}
                          series={series}
                          turmas={turmas}
                          planos={planos}
                        />
                      ) : null}
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </DataTableShell>
      )}
    </div>
  );
}
