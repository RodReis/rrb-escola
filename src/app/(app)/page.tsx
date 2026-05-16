import { Download, FileText, Plus, Upload, UsersRound } from "lucide-react";
import { FinanceChart } from "@/components/dashboard/finance-chart";
import { ButtonLink } from "@/components/ui/button";
import { Card, Panel } from "@/components/ui/card";
import { getDashboard } from "@/lib/data/dashboard";
import { money } from "@/lib/constants";

export default async function DashboardPage() {
  const dashboard = await getDashboard();

  const mesLabel = dashboard.mesCompetencia.replace(/^(\d{4})-(\d{2})$/, (_, y, m) => {
    const meses = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
    return `${meses[Number(m) - 1]}/${y}`;
  });

  const headerMetrics = [
    ["Alunos", String(dashboard.alunos)],
    ["Matriculas ativas", String(dashboard.matriculas)],
    [`A vencer ${mesLabel}`, money.format(dashboard.totalAberto)],
    ["Pago total", money.format(dashboard.totalPago)]
  ];

  const monthMetrics = [
    [`Previsto ${mesLabel}`, money.format(dashboard.previstoMes)],
    [`Recebido ${mesLabel}`, money.format(dashboard.recebidoMes)],
  ];

  return (
    <div className="grid gap-6">
      <section className="-mx-4 -mt-6 border-b border-line bg-surface px-4 py-8 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-8 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="flex items-center gap-3 text-[0.66rem] font-black uppercase tracking-[0.16em] text-ink/58">
              <span>Gestao</span>
              <span className="text-line">/</span>
              <span className="text-brand">Dashboard</span>
            </p>
            <h1 className="mt-8 text-4xl font-black leading-none text-brand md:text-5xl">
              Dashboard <span className="font-serif italic text-ink/42">2026</span>
            </h1>
            <p className="mt-4 max-w-2xl text-sm font-medium leading-6 text-ink/68">
              Visao geral da secretaria, matriculas, cobrancas e pagamentos do Supabase local.
            </p>
          </div>

          <div className="grid gap-7">
            <div className="flex flex-wrap gap-2 xl:justify-end">
              <ButtonLink href="/relatorios/alunos" variant="secondary">
                <Download size={16} /> Exportar
              </ButtonLink>
              <ButtonLink href="/importacoes" variant="secondary">
                <Upload size={16} /> Importar
              </ButtonLink>
              <ButtonLink href="/alunos/novo" variant="accent" className="shadow-[0_12px_26px_rgba(255,36,36,0.28)]">
                <Plus size={16} /> Novo aluno
              </ButtonLink>
            </div>

            <dl className="grid gap-0 sm:grid-cols-4">
              {headerMetrics.map(([label, value]) => (
                <div key={label} className="border-line py-1 sm:border-l sm:px-6 first:sm:border-l-0">
                  <dt className="text-xs font-medium text-ink/62">{label}</dt>
                  <dd className="mt-1 font-serif text-2xl italic leading-none text-brand">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        {headerMetrics.map(([label, value]) => (
          <Card key={label} className="p-5">
            <p className="ds-kicker">{label}</p>
            <strong className="mt-3 block text-3xl font-black text-ink">{value}</strong>
          </Card>
        ))}
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        {monthMetrics.map(([label, value]) => (
          <Card key={label} className="p-5">
            <p className="ds-kicker">{label}</p>
            <strong className="mt-3 block text-3xl font-black text-brand">{value}</strong>
          </Card>
        ))}
      </section>

      <Panel className="grid gap-5">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-ui bg-muted text-brand">
            <FileText />
          </span>
          <div>
            <h2 className="text-xl font-black">Receita por competencia</h2>
            <p className="text-sm text-ink/65">Cobrancas pagas e abertas vindas do Supabase local.</p>
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
            <h2 className="text-xl font-black">Atalhos administrativos</h2>
            <p className="text-sm text-ink/65">Acesso rapido aos cadastros usados no dia a dia.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <ButtonLink href="/alunos" variant="secondary">Alunos</ButtonLink>
          <ButtonLink href="/matriculas" variant="secondary">Matriculas</ButtonLink>
          <ButtonLink href="/financeiro" variant="secondary">Financeiro</ButtonLink>
        </div>
      </Panel>
    </div>
  );
}
