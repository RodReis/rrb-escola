import { AlertTriangle, BadgePercent } from "lucide-react";
import { Panel } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { DataTableShell } from "@/components/ui/data-table";
import { StatusPill } from "@/components/ui/status-pill";
import { AlunosSemValorFilters } from "@/components/finance/alunos-sem-valor-filters";
import { ExportAlunosSemValorButton } from "@/components/finance/export-alunos-sem-valor-button";
import { MatriculaEditDialog } from "@/components/finance/matricula-edit-dialog";
import { AlunosTabs, parseAlunosTab, type AlunosTab } from "@/components/finance/alunos-tabs";
import { AlunosComDescontoFilters } from "@/components/finance/alunos-com-desconto-filters";
import { ExportAlunosComDescontoButton } from "@/components/finance/export-alunos-com-desconto-button";
import {
  getAlunosSemValor,
  MOTIVO_LABEL,
  motivoTone,
  type AlunosSemValorFilters as Filters,
  type MotivoSemValor,
} from "@/lib/data/alunos-sem-valor";
import {
  getAlunosComDesconto,
  ORIGEM_LABEL,
  origemTone,
  type AlunosComDescontoFilters as DescontoFilters,
} from "@/lib/data/alunos-com-desconto";
import { getAcademicData } from "@/lib/data/lookups";
import { requirePermission } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { money } from "@/lib/constants";

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

function pctFmt(v: number) {
  return `${(v * 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`;
}

export default async function AlunosSemValorPage({
  searchParams,
}: {
  searchParams: Promise<{
    aba?: string;
    nome?: string;
    motivo?: string;
    serie?: string;
    turma?: string;
  }>;
}) {
  const session = await requirePermission("relatorios", "read");
  const isAdmin = session.profile.perfil === "admin";
  const canUpdate = isAdmin || can(session.permissions, "matriculas", "update");
  const canCreate = isAdmin || can(session.permissions, "matriculas", "create");
  const canEditAny = canUpdate || canCreate;

  const sp = await searchParams;
  const aba: AlunosTab = parseAlunosTab(sp.aba);
  const academic = await getAcademicData();

  const series = academic.series.map((s) => ({ id: s.id, nome: s.nome }));
  const turmas2026 = academic.turmas
    .filter((t) => (t as { ano_letivo: number }).ano_letivo === 2026)
    .map((t) => ({
      id: t.id,
      nome: t.nome,
      serieId: (t as { serie_id: string | null }).serie_id ?? "",
    }));
  const planos = academic.planos.map((p) => ({ id: p.id, nome: p.nome }));

  if (aba === "com-desconto") {
    const descontoFilters: DescontoFilters = {
      nome: sp.nome?.trim() || null,
      serieId: sp.serie || null,
      turmaId: sp.turma || null,
    };
    const rows = await getAlunosComDesconto(descontoFilters);

    const planoCount = rows.filter(
      (r) => r.origem === "plano" || r.origem === "plano+bolsa"
    ).length;
    const bolsaCount = rows.filter(
      (r) => r.origem === "bolsa_50" || r.origem === "plano+bolsa"
    ).length;
    const mediaDesconto =
      rows.length === 0
        ? 0
        : rows.reduce((acc, r) => acc + r.percentualDescontoEfetivo, 0) / rows.length;

    return (
      <div className="grid gap-8">
        <PageHeader
          breadcrumb={[
            { label: "Financeiro", href: "/financeiro" },
            { label: "Alunos sem valor" },
          ]}
          title="Alunos sem valor de matrícula"
          description="Alunos ativos sem matrícula 2026, sem valor de matrícula definido, com vaga não-pagante ou com desconto."
          actions={<ExportAlunosComDescontoButton rows={rows} />}
          kpis={[
            { label: "Total", value: rows.length.toLocaleString("pt-BR") },
            { label: "Plano abaixo", value: planoCount.toLocaleString("pt-BR") },
            { label: "Bolsa parcial", value: bolsaCount.toLocaleString("pt-BR"), tone: "warning" },
            { label: "Desconto médio", value: pctFmt(mediaDesconto) },
          ]}
        />

        <AlunosTabs active={aba} />

        <AlunosComDescontoFilters
          defaults={{
            nome: descontoFilters.nome ?? "",
            serieId: descontoFilters.serieId ?? "",
            turmaId: descontoFilters.turmaId ?? "",
          }}
          series={series}
          turmas={turmas2026.map((t) => ({ id: t.id, nome: t.nome }))}
        />

        {rows.length === 0 ? (
          <Panel>
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-ink/60">
              <BadgePercent size={28} />
              <p className="text-sm font-medium">Nenhum aluno com desconto encontrado.</p>
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
                  <th>Origem</th>
                  <th>% Desconto</th>
                  <th>Mensalidade</th>
                  <th>Responsável</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.matriculaId}>
                    <td className="font-semibold text-ink">{r.nome}</td>
                    <td>{r.serie}</td>
                    <td>{r.turma}</td>
                    <td>
                      <StatusPill tone={origemTone(r.origem)}>
                        {ORIGEM_LABEL[r.origem]}
                      </StatusPill>
                    </td>
                    <td>
                      {r.percentualDescontoEfetivo === 0
                        ? <span className="text-ink/40">—</span>
                        : `-${pctFmt(r.percentualDescontoEfetivo)}`}
                    </td>
                    <td>
                      <div className="font-semibold text-ink">
                        {money.format(r.valorMensalidadePlano)}
                      </div>
                      <div className="text-xs text-ink/60">
                        de {money.format(r.valorPraticadoCheio)}
                      </div>
                    </td>
                    <td>
                      {r.responsavelNome ? (
                        <div className="text-sm">
                          <span className="font-medium text-ink">{r.responsavelNome}</span>
                          {r.responsavelParentesco ? (
                            <span className="text-ink/60"> ({r.responsavelParentesco})</span>
                          ) : null}
                          {r.responsavelTelefone ? (
                            <span className="text-ink/60"> · {r.responsavelTelefone}</span>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-ink/40">—</span>
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

  // --- aba === "sem-valor" (default) ---

  const filters = parseFilters(sp);
  const rows = await getAlunosSemValor(filters);

  const semMatricula = rows.filter((r) => r.motivo === "sem_matricula").length;
  const semValor = rows.filter((r) => r.motivo === "sem_valor").length;
  const bolsistas = rows.filter(
    (r) =>
      r.motivo === "BOLSA_INTEGRAL" ||
      r.motivo === "BOLSA_50_PORCENTO" ||
      r.motivo === "FILHO_PROFESSORA" ||
      r.motivo === "FILHO_PROFESSORA_INTEGRAL"
  ).length;
  const permutaGratuita = rows.filter(
    (r) => r.motivo === "PERMUTA" || r.motivo === "ISENTO"
  ).length;

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

      <AlunosTabs active={aba} />

      <AlunosSemValorFilters
        defaults={{
          nome: filters.nome ?? "",
          motivo: filters.motivo ?? "",
          serieId: filters.serieId ?? "",
          turmaId: filters.turmaId ?? "",
        }}
        series={series}
        turmas={turmas2026.map((t) => ({ id: t.id, nome: t.nome }))}
      />

      {rows.length === 0 ? (
        <Panel>
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-ink/60">
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
                              <span className="text-ink/60"> ({resp.parentesco})</span>
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
                          turmas={turmas2026}
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
