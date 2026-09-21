import { AlertCircle, CheckCircle2, CalendarOff } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { DataTableShell } from "@/components/ui/data-table";
import { StatusPill, type StatusTone } from "@/components/ui/status-pill";
import { getPeriodosAquisitivos, getConfigOrNull } from "@/lib/data/folha";
import { AgendarGozoForm } from "@/components/folha/agendar-gozo-form";
import { requirePermission } from "@/lib/auth/session";
import { createServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  aberto: "Aberto",
  agendado: "Agendado",
  vencido: "Vencido",
  gozado: "Gozado",
};

const STATUS_TONE: Record<string, StatusTone> = {
  aberto: "warning",
  agendado: "neutral",
  vencido: "danger",
  gozado: "success",
};

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

type Recesso = { inicio: string; fim: string } | null;

export default async function FeriasPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; ok?: string }>;
}) {
  await requirePermission("rh.folha-v2", "read");
  const { erro, ok } = await searchParams;

  const supabase = await createServerClient();
  const companiesRes = await supabase.from("companies").select("id").limit(1);
  const firstCompanyId = companiesRes.data?.[0]?.id ?? null;

  const [{ periodos, vencendoEm60 }, config] = await Promise.all([
    getPeriodosAquisitivos(),
    firstCompanyId ? getConfigOrNull(firstCompanyId) : Promise.resolve(null),
  ]);

  const recesso = (config?.recesso as Recesso) ?? null;

  return (
    <div className="grid gap-8">
      <PageHeader
        breadcrumb={[
          { label: "RH", href: "/rh/funcionarios" },
          { label: "Folha v2", href: "/rh/folha-v2" },
          { label: "Agenda de Férias" },
        ]}
        title="Agenda de Férias"
        description="Períodos aquisitivos e agendamento de gozo de férias."
      />

      {recesso ? (
        <div className="flex items-start gap-3 rounded-ui border border-warning/30 bg-warning/8 p-4 text-sm text-ink/80">
          <CalendarOff size={16} className="mt-0.5 shrink-0 text-warning" />
          <div>
            <span className="font-semibold text-ink">Recesso escolar:</span>{" "}
            {fmtDate(`2000-${recesso.inicio}`)} a {fmtDate(`2001-${recesso.fim}`)} — convocação de férias neste período
            não é permitida (não conta como gozo).
          </div>
        </div>
      ) : null}

      {erro ? (
        <div className="flex items-center gap-2 rounded-ui bg-danger/10 p-3 text-sm font-semibold text-danger">
          <AlertCircle size={16} /> {erro}
        </div>
      ) : null}
      {ok ? (
        <div className="flex items-center gap-2 rounded-ui bg-success/10 p-3 text-sm font-semibold text-success">
          <CheckCircle2 size={16} /> Gozo agendado com sucesso.
        </div>
      ) : null}

      {vencendoEm60 > 0 ? (
        <Card>
          <p className="text-xs font-bold uppercase tracking-kicker text-ink/60 mb-1">Atenção</p>
          <p className="text-2xl font-bold tabular-nums text-danger">{vencendoEm60}</p>
          <p className="text-sm text-ink/60 mt-1">
            {vencendoEm60 === 1 ? "período vence" : "períodos vencem"} nos próximos 60 dias
          </p>
        </Card>
      ) : null}

      <DataTableShell
        footer={
          periodos.length > 0 ? (
            <span>
              <strong className="text-ink">{periodos.length}</strong> período(s) aquisitivo(s)
            </span>
          ) : undefined
        }
      >
        <table className="ds-dt min-w-[860px]">
          <thead>
            <tr>
              <th>Funcionário</th>
              <th>Empresa</th>
              <th>Janela</th>
              <th>Início aquisitivo</th>
              <th>Fim aquisitivo</th>
              <th>Status</th>
              <th>Gozo agendado</th>
              <th className="text-right">Dias</th>
            </tr>
          </thead>
          <tbody>
            {periodos.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-12">
                  <div className="flex flex-col items-center justify-center gap-2 text-ink/60">
                    <CalendarOff size={28} />
                    <p className="text-sm">Nenhum período aquisitivo encontrado.</p>
                  </div>
                </td>
              </tr>
            ) : null}
            {periodos.map((p) => {
              const canSchedule = p.status === "aberto" || p.status === "vencido";
              return (
                <tr key={p.id}>
                  <td className="font-medium">
                    {p.folha_contratos?.employees?.name ?? "—"}
                    {canSchedule ? (
                      <AgendarGozoForm periodoId={p.id} />
                    ) : null}
                  </td>
                  <td className="text-ink/80">{p.folha_contratos?.companies?.name ?? "—"}</td>
                  <td className="text-ink/60">{p.janela ?? "—"}</td>
                  <td className="tabular-nums">{fmtDate(p.inicio)}</td>
                  <td className="tabular-nums">{fmtDate(p.fim)}</td>
                  <td>
                    <StatusPill tone={STATUS_TONE[p.status] ?? "neutral"}>
                      {STATUS_LABEL[p.status] ?? p.status}
                    </StatusPill>
                  </td>
                  <td className="tabular-nums text-sm">
                    {p.gozo_inicio ? (
                      <>
                        {fmtDate(p.gozo_inicio)}
                        {p.dias_abono ? ` + ${p.dias_abono}d abono` : ""}
                      </>
                    ) : "—"}
                  </td>
                  <td className="text-right tabular-nums">{p.gozo_dias ?? "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </DataTableShell>
    </div>
  );
}
