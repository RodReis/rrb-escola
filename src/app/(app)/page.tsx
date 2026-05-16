import { Download, FileText, Plus, Upload, UsersRound } from "lucide-react";
import { FinanceChart } from "@/components/dashboard/finance-chart";
import { ButtonLink } from "@/components/ui/button";
import { Panel } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { getDashboard } from "@/lib/data/dashboard";
import { money } from "@/lib/constants";

export default async function DashboardPage() {
  const dashboard = await getDashboard();

  const mesLabel = dashboard.mesCompetencia.replace(/^(\d{4})-(\d{2})$/, (_, y, m) => {
    const meses = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
    return `${meses[Number(m) - 1]}/${y}`;
  });

  return (
    <div className="grid gap-8">
      <PageHeader
        breadcrumb={[{ label: "Gestão" }, { label: "Dashboard" }]}
        title="Dashboard"
        counter="2026"
        description="Visão geral da secretaria, matrículas, cobranças e pagamentos."
        actions={
          <>
            <ButtonLink href="/relatorios/alunos" variant="secondary">
              <Download size={14} /> Exportar
            </ButtonLink>
            <ButtonLink href="/importacoes" variant="secondary">
              <Upload size={14} /> Importar
            </ButtonLink>
            <ButtonLink href="/alunos/novo" variant="primary">
              <Plus size={14} /> Novo aluno
            </ButtonLink>
          </>
        }
        kpis={[
          { label: "Alunos",           value: dashboard.alunos.toLocaleString("pt-BR") },
          { label: "Matrículas ativas", value: dashboard.matriculas.toLocaleString("pt-BR"), tone: "success" },
          { label: `A vencer ${mesLabel}`, value: money.format(dashboard.totalAberto), tone: "warning" },
          { label: "Pago total",        value: money.format(dashboard.totalPago), tone: "success" }
        ]}
      />

      <section className="grid gap-4 md:grid-cols-2">
        <Panel>
          <p className="text-[0.66rem] font-bold uppercase tracking-[0.14em] text-ink/55">Previsto {mesLabel}</p>
          <strong className="mt-2 block text-3xl font-bold text-ink">{money.format(dashboard.previstoMes)}</strong>
        </Panel>
        <Panel>
          <p className="text-[0.66rem] font-bold uppercase tracking-[0.14em] text-ink/55">Recebido {mesLabel}</p>
          <strong className="mt-2 block text-3xl font-bold text-brand">{money.format(dashboard.recebidoMes)}</strong>
        </Panel>
      </section>

      <Panel className="grid gap-5">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-ui bg-muted text-brand">
            <FileText />
          </span>
          <div>
            <h2 className="text-xl font-bold">Receita por competência</h2>
            <p className="text-sm text-ink/60">Cobranças pagas e abertas.</p>
          </div>
        </div>
        <FinanceChart data={dashboard.chart} />
      </Panel>

      <Panel className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-ui bg-muted text-brand">
            <UsersRound />
          </span>
          <div>
            <h2 className="text-xl font-bold">Atalhos administrativos</h2>
            <p className="text-sm text-ink/60">Acesso rápido aos cadastros do dia a dia.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <ButtonLink href="/alunos" variant="secondary">Alunos</ButtonLink>
          <ButtonLink href="/matriculas" variant="secondary">Matrículas</ButtonLink>
          <ButtonLink href="/financeiro" variant="secondary">Financeiro</ButtonLink>
        </div>
      </Panel>
    </div>
  );
}
