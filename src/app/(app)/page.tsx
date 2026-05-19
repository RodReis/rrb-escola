import { Download, Plus, Upload } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { requireSession } from "@/lib/auth/session";
import { can, type ModuloCodigo } from "@/lib/auth/permissions";
import {
  currentCompetencia,
  getAlertas,
  getAniversariantes,
  getAniversariantesMatricula,
  getAniversariantesSemana,
  getBeneficios,
  getEscolaConfig,
  getFolhaPorEmpresa,
  getFolhaRatio,
  getFrequenciaPorTurma,
  getFrequenciaResumo,
  getHero,
  getInadimplencia,
  getOcupacao,
  getProximasCobrancas,
  getRankingTurmas,
  getSaldoYTD,
  getRealizadoVsProjetado,
  getRenovacoesPendentes,
  getRepasseRecebido,
  getRevenueTrend,
  getSaudeSistema,
  getStageBreakdown,
  getTicketMedio,
  getTopCategoriasDespesas,
  getTopDevedores,
  type DevedorRow,
  type RenovacaoRow,
} from "@/lib/data/dashboard-executive";
import { AlertList } from "@/components/dashboard/alert-list";
import { AniversariantesCard } from "@/components/dashboard/aniversariantes-card";
import { AniversariantesSemanaCard } from "@/components/dashboard/aniversariantes-semana-card";
import { AniversarioMatriculaCard } from "@/components/dashboard/aniversario-matricula-card";
import { BeneficiosCard } from "@/components/dashboard/beneficios-card";
import { BolsistasReceitaCard } from "@/components/dashboard/bolsistas-receita-card";
import { CompetenciaPicker } from "@/components/dashboard/competencia-picker";
import { DashboardTabs, parseTab } from "@/components/dashboard/dashboard-tabs";
import { FolhaEmpresas } from "@/components/dashboard/folha-empresas";
import { HeroFinancial } from "@/components/dashboard/hero-financial";
import { FolhaRatioCard } from "@/components/dashboard/folha-ratio-card";
import { FrequenciaCard } from "@/components/dashboard/frequencia-card";
import { EvasaoCard } from "@/components/dashboard/evasao-card";
import { FrequenciaHeatmap } from "@/components/dashboard/frequencia-heatmap";
import { MediasDisciplinasCard } from "@/components/dashboard/medias-disciplinas-card";
import { PedagogicoOverviewSection } from "@/components/dashboard/pedagogico-overview-section";
import { ProximasCobrancasCard } from "@/components/dashboard/proximas-cobrancas-card";
import { RankingAlunosCard } from "@/components/dashboard/ranking-alunos-card";
import { RankingTurmasCard } from "@/components/dashboard/ranking-turmas-card";
import { RealizadoProjetadoCard } from "@/components/dashboard/realizado-projetado-card";
import { ResumoAlunosCard } from "@/components/dashboard/resumo-alunos-card";
import { SaldoYTDCard } from "@/components/dashboard/saldo-ytd-card";
import { SaudeSistemaCard } from "@/components/dashboard/saude-sistema-card";
import { TopCategoriasCard } from "@/components/dashboard/top-categorias-card";
import {
  getEvasao,
  getFrequenciaDetalhada,
  getMediasPorDisciplina,
  getPedagogicoOverview,
  getPedagogicoSummary,
  getRankingAlunos,
} from "@/lib/data/pedagogico";
import { MetricRing } from "@/components/dashboard/metric-ring";
import { RenovacoesPendentes } from "@/components/dashboard/renovacoes-pendentes";
import { RevenueTrendChart } from "@/components/dashboard/revenue-trend-chart";
import { StageTable } from "@/components/dashboard/stage-table";
import { TicketCard } from "@/components/dashboard/ticket-card";
import { TopDevedores } from "@/components/dashboard/top-devedores";

const MESES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

function mesLabel(competencia: string): string {
  const [y, m] = competencia.split("-").map(Number);
  return `${MESES[(m as number) - 1]}/${y}`;
}

function isValidCompetencia(v: string | undefined): v is string {
  return typeof v === "string" && /^\d{4}-\d{2}$/.test(v);
}

function isValidAno(val: string | undefined): boolean {
  if (!val) return false;
  const n = Number(val);
  return Number.isInteger(n) && n >= 2000 && n <= 2100;
}

type DashTab = "financeiro" | "alunos" | "pedagogico";

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="flex items-baseline gap-3 border-l-2 border-brand/40 pl-3">
      <h2 className="text-base font-bold text-ink">{title}</h2>
      {subtitle && <p className="text-xs text-ink/55">{subtitle}</p>}
    </header>
  );
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ aba?: string; competencia?: string; ano?: string }>;
}) {
  const params = await searchParams;

  const session = await requireSession();
  const escolaId = session.profile.escola_id;
  const perms = session.permissions;
  const isAdmin = session.profile.perfil === "admin";

  const has = (modulo: ModuloCodigo): boolean => isAdmin || can(perms, modulo, "read");

  // Module flags
  const showFinanceiroCobrancas = has("financeiro.cobrancas");
  const showDespesas = has("despesas");
  const showBolsistas = has("bolsistas");
  const showRhFolha = has("rh.folha");
  const showAlunos = has("alunos");
  const showMatriculas = has("matriculas");
  const showFrequencias = has("frequencias");
  const showTurmas = has("turmas");
  const showAvaliacoes = has("avaliacoes");

  // Tab visibility
  const tabFinanceiroVisible =
    showFinanceiroCobrancas || showDespesas || showBolsistas || showRhFolha;
  const tabAlunosVisible =
    showAlunos || showMatriculas || showFrequencias || showTurmas;
  const tabPedagogicoVisible = showAvaliacoes || showFrequencias;

  const tabsVisiveis: DashTab[] = [];
  if (tabFinanceiroVisible) tabsVisiveis.push("financeiro");
  if (tabAlunosVisible) tabsVisiveis.push("alunos");
  if (tabPedagogicoVisible) tabsVisiveis.push("pedagogico");

  const competencia = isValidCompetencia(params.competencia) ? params.competencia : currentCompetencia();
  const anoLetivo = isValidAno(params.ano) ? Number(params.ano) : new Date().getFullYear();

  // Header action button flags
  const showExportar = isAdmin || can(perms, "relatorios", "read");
  const showImportar = isAdmin || can(perms, "importacoes", "create");
  const showNovoAluno = isAdmin || can(perms, "alunos", "create");

  // Empty state when zero tabs available
  if (tabsVisiveis.length === 0) {
    return (
      <div className="grid gap-8">
        <PageHeader
          breadcrumb={[{ label: "Gestão" }, { label: "Dashboard" }]}
          title="Dashboard"
          counter={mesLabel(competencia)}
          description="Visão executiva para tomada de decisão."
        />
        <div className="rounded-ui bg-muted p-12 text-center text-ink/55">
          Seu perfil não tem permissão para visualizar nenhum dashboard. Contate um administrador.
        </div>
      </div>
    );
  }

  // Resolve active tab against visible set
  const abaRequested = parseTab(params.aba);
  const tabEfetiva: DashTab = tabsVisiveis.includes(abaRequested)
    ? abaRequested
    : (tabsVisiveis[0] as DashTab);

  const config = await getEscolaConfig(escolaId);
  const isPropria = config.gestaoFinanceira === "propria";

  // Build gated query slots. Order MUST match the destructure below.
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
    frequencia,
    rankingTurmas,
    topCategorias,
    realizadoVsProjetado,
    frequenciaPorTurma,
    evasao,
    freqDetalhada,
    mediasDisc,
    pedagogicoSummary,
    rankingAlunos,
    aniversariantesMatricula,
    proximasCobrancas,
    saudeSistema,
    saldoYTD,
    pedagogicoOverview,
    slot2,
    slot5,
    aniversariantesSemana,
  ] = await Promise.all([
    showFinanceiroCobrancas ? getHero(competencia, escolaId) : null,
    showFinanceiroCobrancas ? getRevenueTrend(6, escolaId) : null,
    showAlunos ? getOcupacao(escolaId, anoLetivo) : null,
    showMatriculas ? getStageBreakdown(competencia, escolaId, anoLetivo) : null,
    showFinanceiroCobrancas ? getTicketMedio(6, escolaId) : null,
    showRhFolha ? getFolhaRatio(competencia, escolaId) : null,
    showRhFolha ? getFolhaPorEmpresa(competencia, escolaId) : null,
    getAlertas(competencia, config.gestaoFinanceira, escolaId, anoLetivo),
    showBolsistas ? getBeneficios(escolaId, anoLetivo) : null,
    showAlunos ? getAniversariantes(escolaId, 10) : null,
    showFrequencias ? getFrequenciaResumo(escolaId, 30, anoLetivo) : null,
    showTurmas ? getRankingTurmas(escolaId, 10, anoLetivo) : null,
    showDespesas ? getTopCategoriasDespesas(competencia, escolaId, 6) : null,
    showFinanceiroCobrancas ? getRealizadoVsProjetado(competencia, escolaId, anoLetivo) : null,
    showFrequencias ? getFrequenciaPorTurma(escolaId, 30, anoLetivo) : null,
    showAlunos ? getEvasao(escolaId) : null,
    showFrequencias ? getFrequenciaDetalhada(escolaId, 60) : null,
    showAvaliacoes ? getMediasPorDisciplina(escolaId) : null,
    showAvaliacoes ? getPedagogicoSummary(escolaId) : null,
    showAvaliacoes ? getRankingAlunos(escolaId, undefined, 10) : null,
    showAlunos ? getAniversariantesMatricula(escolaId, 10, anoLetivo) : null,
    showFinanceiroCobrancas ? getProximasCobrancas(escolaId, 7) : null,
    getSaudeSistema(escolaId),
    showFinanceiroCobrancas ? getSaldoYTD(escolaId, anoLetivo) : null,
    showAvaliacoes ? getPedagogicoOverview(escolaId) : null,
    showFinanceiroCobrancas
      ? (isPropria
          ? getInadimplencia(competencia, escolaId)
          : getRepasseRecebido(competencia, escolaId))
      : null,
    (showFinanceiroCobrancas || showMatriculas)
      ? (isPropria
          ? getTopDevedores(5, escolaId)
          : getRenovacoesPendentes(5, escolaId))
      : null,
    showAlunos ? getAniversariantesSemana(escolaId) : null,
  ]);

  // slot2 currently is computed but not rendered in the original page (was unused).
  // Keep variable to preserve ordering.
  void slot2;

  const ocupacaoPct = ocupacao && ocupacao.total > 0 ? ocupacao.ocupadas / ocupacao.total : 0;

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
            {showExportar && (
              <ButtonLink href="/relatorios/alunos" variant="secondary">
                <Download size={14} /> Exportar
              </ButtonLink>
            )}
            {showImportar && (
              <ButtonLink href="/importacoes" variant="secondary">
                <Upload size={14} /> Importar
              </ButtonLink>
            )}
            {showNovoAluno && (
              <ButtonLink href="/alunos/novo" variant="primary">
                <Plus size={14} /> Novo aluno
              </ButtonLink>
            )}
          </>
        }
      />

      <DashboardTabs active={tabEfetiva} competencia={competencia} visible={tabsVisiveis} />

      {tabEfetiva === "financeiro" && (
        <>
          {showFinanceiroCobrancas && hero && <HeroFinancial data={hero} />}

          <section className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {showRhFolha && folhaRatio && <FolhaRatioCard data={folhaRatio} />}
            {showFinanceiroCobrancas && ticket && <TicketCard data={ticket} />}
            {showBolsistas && beneficios && <BolsistasReceitaCard data={beneficios} />}
            {showFinanceiroCobrancas && saldoYTD && <SaldoYTDCard data={saldoYTD} />}
          </section>

          {showFinanceiroCobrancas && realizadoVsProjetado && (
            <>
              <SectionHeader title="Performance e projeção" subtitle="Realizado vs projetado por etapa" />
              <RealizadoProjetadoCard data={realizadoVsProjetado} />
            </>
          )}

          <SectionHeader title="Alertas e tendência" subtitle="Sinais de atenção e evolução mensal" />
          <section className="grid gap-6 lg:grid-cols-3">
            <AlertList items={alertas} />
            {showFinanceiroCobrancas && trend && (
              <div className="lg:col-span-2">
                <RevenueTrendChart data={trend} />
              </div>
            )}
          </section>

          {((showFinanceiroCobrancas && isPropria && proximasCobrancas) ||
            (showDespesas && topCategorias) ||
            (showRhFolha && folhaEmpresas)) && (
            <SectionHeader title="Operação" subtitle="Cobranças, despesas e folha do mês" />
          )}

          {showFinanceiroCobrancas && isPropria && proximasCobrancas && (
            <ProximasCobrancasCard items={proximasCobrancas} />
          )}

          <section className="grid gap-6 lg:grid-cols-2">
            {showDespesas && topCategorias && <TopCategoriasCard items={topCategorias} />}
            {showRhFolha && folhaEmpresas && <FolhaEmpresas items={folhaEmpresas} />}
          </section>
        </>
      )}

      {tabEfetiva === "alunos" && (
        <>
          <section className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {showAlunos && ocupacao && (
              <MetricRing
                label="Ocupação"
                percent={ocupacaoPct}
                centerLabel="Vagas"
                centerValue={`${ocupacao.ocupadas}/${ocupacao.total}`}
              />
            )}
            {showFrequencias && frequencia && frequenciaPorTurma && (
              <FrequenciaCard data={frequencia} porTurma={frequenciaPorTurma} />
            )}
            {showBolsistas && beneficios && <BeneficiosCard data={beneficios} />}
            {showAlunos && ocupacao && <ResumoAlunosCard ocupacao={ocupacao} />}
          </section>

          {showMatriculas && stages && (
            <>
              <SectionHeader title="Matrículas e ocupação" subtitle="Distribuição por etapa de ensino" />
              <StageTable rows={stages} />
            </>
          )}

          <SectionHeader title="Aniversários e fidelidade" subtitle="Datas para celebrar com os alunos" />

          {showAlunos && aniversariantesSemana && (
            <AniversariantesSemanaCard items={aniversariantesSemana} />
          )}

          <section className="grid gap-6 lg:grid-cols-2">
            {showTurmas && rankingTurmas && <RankingTurmasCard items={rankingTurmas} />}
            {showAlunos && aniversariantes && <AniversariantesCard items={aniversariantes} />}
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            {showAlunos && aniversariantesMatricula && (
              <AniversarioMatriculaCard items={aniversariantesMatricula} />
            )}
            <SaudeSistemaCard data={saudeSistema} />
          </section>

          {((!isPropria && showMatriculas && slot5) ||
            (isPropria && showFinanceiroCobrancas && slot5)) && (
            <SectionHeader title="Operação" subtitle="Renovações e inadimplência" />
          )}

          {!isPropria && showMatriculas && slot5 && (
            <RenovacoesPendentes items={slot5 as RenovacaoRow[]} />
          )}
          {isPropria && showFinanceiroCobrancas && slot5 && (
            <TopDevedores items={slot5 as DevedorRow[]} />
          )}
        </>
      )}

      {tabEfetiva === "pedagogico" && (
        <>
          {showAvaliacoes && pedagogicoOverview && (
            <PedagogicoOverviewSection data={pedagogicoOverview} />
          )}

          {(showAlunos || showFrequencias) && (evasao || freqDetalhada) && (
            <>
              <SectionHeader title="Permanência e frequência" subtitle="Como os alunos estão comparecendo e mantendo vínculo" />
              <section className="grid gap-6 lg:grid-cols-2">
                {showAlunos && evasao && <EvasaoCard data={evasao} />}
                {showFrequencias && freqDetalhada && <FrequenciaHeatmap data={freqDetalhada} />}
              </section>
            </>
          )}

          {showAvaliacoes && (mediasDisc || rankingAlunos) && (
            <>
              <SectionHeader title="Desempenho acadêmico" subtitle="Notas, médias e destaques" />
              {mediasDisc && pedagogicoSummary && (
                <MediasDisciplinasCard rows={mediasDisc} summary={pedagogicoSummary} />
              )}
              {rankingAlunos && <RankingAlunosCard items={rankingAlunos} />}
            </>
          )}
        </>
      )}
    </div>
  );
}
