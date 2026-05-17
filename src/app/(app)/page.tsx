import { Download, Plus, Upload } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { requireSession } from "@/lib/auth/session";
import {
  currentCompetencia,
  getAlertas,
  getBeneficios,
  getEscolaConfig,
  getFolhaPorEmpresa,
  getFolhaRatio,
  getHero,
  getInadimplencia,
  getOcupacao,
  getRenovacoesPendentes,
  getRepasseRecebido,
  getRevenueTrend,
  getStageBreakdown,
  getTicketMedio,
  getTopDevedores,
  type DevedorRow,
  type InadimplenciaData,
  type RenovacaoRow,
  type RepasseData,
} from "@/lib/data/dashboard-executive";
import { AlertList } from "@/components/dashboard/alert-list";
import { BeneficiosCard } from "@/components/dashboard/beneficios-card";
import { FolhaEmpresas } from "@/components/dashboard/folha-empresas";
import { HeroFinancial } from "@/components/dashboard/hero-financial";
import { MetricBar } from "@/components/dashboard/metric-bar";
import { MetricRing } from "@/components/dashboard/metric-ring";
import { RenovacoesPendentes } from "@/components/dashboard/renovacoes-pendentes";
import { RepasseCard } from "@/components/dashboard/repasse-card";
import { RevenueTrendChart } from "@/components/dashboard/revenue-trend-chart";
import { StageTable } from "@/components/dashboard/stage-table";
import { TicketCard } from "@/components/dashboard/ticket-card";
import { TopDevedores } from "@/components/dashboard/top-devedores";
import { money } from "@/lib/constants";

const MESES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

function mesLabel(competencia: string): string {
  const [y, m] = competencia.split("-").map(Number);
  return `${MESES[(m as number) - 1]}/${y}`;
}

export default async function DashboardPage() {
  const session = await requireSession();
  const escolaId = session.profile.escola_id;
  const competencia = currentCompetencia();

  const config = await getEscolaConfig(escolaId);
  const isPropria = config.gestaoFinanceira === "propria";

  const [
    hero,
    trend,
    ocupacao,
    stages,
    ticket,
    folhaRatio,
    folhaEmpresas,
    alertas,
    beneficios,
    slot2,
    slot5,
  ] = await Promise.all([
    getHero(competencia, escolaId),
    getRevenueTrend(6, escolaId),
    getOcupacao(escolaId),
    getStageBreakdown(competencia, escolaId),
    getTicketMedio(6, escolaId),
    getFolhaRatio(competencia, escolaId),
    getFolhaPorEmpresa(competencia, escolaId),
    getAlertas(competencia, config.gestaoFinanceira, escolaId),
    getBeneficios(escolaId),
    isPropria
      ? getInadimplencia(competencia, escolaId)
      : getRepasseRecebido(competencia, escolaId),
    isPropria
      ? getTopDevedores(5, escolaId)
      : getRenovacoesPendentes(5, escolaId),
  ]);

  const ocupacaoPct = ocupacao.total > 0 ? ocupacao.ocupadas / ocupacao.total : 0;

  return (
    <div className="grid gap-8">
      <PageHeader
        breadcrumb={[{ label: "Gestão" }, { label: "Dashboard" }]}
        title="Dashboard"
        counter={mesLabel(competencia)}
        description="Visão executiva para tomada de decisão."
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
      />

      <HeroFinancial data={hero} />

      <section className="grid gap-6 lg:grid-cols-3">
        <AlertList items={alertas} />
        <div className="lg:col-span-2">
          <RevenueTrendChart data={trend} />
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-2 lg:grid-cols-5">
        <MetricRing
          label="Ocupação"
          percent={ocupacaoPct}
          centerLabel="Vagas"
          centerValue={`${ocupacao.ocupadas}/${ocupacao.total}`}
        />
        {isPropria ? (
          <MetricRing
            label="Inadimplência"
            percent={(slot2 as InadimplenciaData).percentual}
            centerLabel="Em atraso"
            centerValue={money.format((slot2 as InadimplenciaData).valor)}
            variant={(slot2 as InadimplenciaData).percentual > 0.1 ? "danger" : "warning"}
          />
        ) : (
          <RepasseCard data={slot2 as RepasseData} />
        )}
        <MetricBar
          label="Folha / Receita"
          percent={folhaRatio.ratio}
          caption={`${money.format(folhaRatio.folha)} / ${money.format(folhaRatio.receita)}`}
        />
        <TicketCard data={ticket} />
        <BeneficiosCard data={beneficios} />
      </section>

      <StageTable rows={stages} />

      <section className="grid gap-6 lg:grid-cols-2">
        {isPropria ? (
          <TopDevedores items={slot5 as DevedorRow[]} />
        ) : (
          <RenovacoesPendentes items={slot5 as RenovacaoRow[]} />
        )}
        <FolhaEmpresas items={folhaEmpresas} />
      </section>
    </div>
  );
}
