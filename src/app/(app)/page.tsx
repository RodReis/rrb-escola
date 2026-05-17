import { Download, Plus, Upload } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { requireSession } from "@/lib/auth/session";
import {
  currentCompetencia,
  getAlertas,
  getAniversariantes,
  getBeneficios,
  getEscolaConfig,
  getFolhaPorEmpresa,
  getFolhaRatio,
  getFrequenciaResumo,
  getHero,
  getInadimplencia,
  getMargemTrend,
  getOcupacao,
  getRankingTurmas,
  getRealizadoVsProjetado,
  getRenovacoesPendentes,
  getRepasseRecebido,
  getRevenueTrend,
  getStageBreakdown,
  getTicketMedio,
  getTopCategoriasDespesas,
  getTopDevedores,
  type DevedorRow,
  type InadimplenciaData,
  type RenovacaoRow,
  type RepasseData,
} from "@/lib/data/dashboard-executive";
import { AlertList } from "@/components/dashboard/alert-list";
import { AniversariantesCard } from "@/components/dashboard/aniversariantes-card";
import { BeneficiosCard } from "@/components/dashboard/beneficios-card";
import { CompetenciaPicker } from "@/components/dashboard/competencia-picker";
import { DashboardTabs, parseTab } from "@/components/dashboard/dashboard-tabs";
import { FolhaEmpresas } from "@/components/dashboard/folha-empresas";
import { HeroFinancial } from "@/components/dashboard/hero-financial";
import { FolhaRatioCard } from "@/components/dashboard/folha-ratio-card";
import { FrequenciaCard } from "@/components/dashboard/frequencia-card";
import { MargemTrendCard } from "@/components/dashboard/margem-trend-card";
import { RankingTurmasCard } from "@/components/dashboard/ranking-turmas-card";
import { RealizadoProjetadoCard } from "@/components/dashboard/realizado-projetado-card";
import { TopCategoriasCard } from "@/components/dashboard/top-categorias-card";
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

function isValidCompetencia(v: string | undefined): v is string {
  return typeof v === "string" && /^\d{4}-\d{2}$/.test(v);
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ aba?: string; competencia?: string }>;
}) {
  const params = await searchParams;
  const aba = parseTab(params.aba);

  const session = await requireSession();
  const escolaId = session.profile.escola_id;
  const competencia = isValidCompetencia(params.competencia) ? params.competencia : currentCompetencia();

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
    aniversariantes,
    margemTrend,
    frequencia,
    rankingTurmas,
    topCategorias,
    realizadoVsProjetado,
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
    getAniversariantes(escolaId, 10),
    getMargemTrend(6, escolaId),
    getFrequenciaResumo(escolaId, 30),
    getRankingTurmas(escolaId, 10),
    getTopCategoriasDespesas(competencia, escolaId, 6),
    getRealizadoVsProjetado(competencia, escolaId),
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
            <CompetenciaPicker current={competencia} />
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

      <DashboardTabs active={aba} competencia={competencia} />

      {aba === "financeiro" ? (
        <>
          <HeroFinancial data={hero} />

          <RealizadoProjetadoCard data={realizadoVsProjetado} />

          <section className="grid gap-6 lg:grid-cols-3">
            <AlertList items={alertas} />
            <div className="lg:col-span-2">
              <RevenueTrendChart data={trend} />
            </div>
          </section>

          <section className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
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
            <FolhaRatioCard data={folhaRatio} />
            <TicketCard data={ticket} />
            <MargemTrendCard data={margemTrend} />
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            <TopCategoriasCard items={topCategorias} />
            <FolhaEmpresas items={folhaEmpresas} />
          </section>
        </>
      ) : (
        <>
          <section className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <MetricRing
              label="Ocupação"
              percent={ocupacaoPct}
              centerLabel="Vagas"
              centerValue={`${ocupacao.ocupadas}/${ocupacao.total}`}
            />
            <FrequenciaCard data={frequencia} />
            <BeneficiosCard data={beneficios} />
            <article className="rounded-panel bg-surface p-6 shadow-soft">
              <p className="text-[0.66rem] font-bold uppercase tracking-kicker text-ink/55">Resumo</p>
              <dl className="mt-4 grid gap-3">
                <div className="flex items-baseline justify-between">
                  <dt className="text-sm text-ink/70">Pagantes</dt>
                  <dd className="text-xl font-bold text-ink">{ocupacao.pagantes}</dd>
                </div>
                <div className="flex items-baseline justify-between">
                  <dt className="text-sm text-ink/70">Beneficiados</dt>
                  <dd className="text-xl font-bold text-accent">{ocupacao.beneficiados}</dd>
                </div>
                <div className="flex items-baseline justify-between border-t border-line pt-3">
                  <dt className="text-sm font-semibold text-ink">Total ativos</dt>
                  <dd className="text-2xl font-bold text-brand">{ocupacao.ocupadas}</dd>
                </div>
              </dl>
            </article>
          </section>

          <StageTable rows={stages} />

          <section className="grid gap-6 lg:grid-cols-2">
            <RankingTurmasCard items={rankingTurmas} />
            <AniversariantesCard items={aniversariantes} />
          </section>

          {!isPropria && <RenovacoesPendentes items={slot5 as RenovacaoRow[]} />}
          {isPropria && <TopDevedores items={slot5 as DevedorRow[]} />}
        </>
      )}
    </div>
  );
}
