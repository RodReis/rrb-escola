import { Plus } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { QuickLinks } from "@/components/dashboard/quick-links";
import { requireSession } from "@/lib/auth/session";
import { createServerClient } from "@/lib/supabase/server";
import { can, ROTA_PARA_MODULO, type ModuloCodigo } from "@/lib/auth/permissions";
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
import { AniversariantesHojeCard, AniversariantesProximosRow } from "@/components/dashboard/aniversariantes-semana-card";
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
import { FeriadosCard } from "@/components/dashboard/feriados-card";
import { EventosCard } from "@/components/dashboard/eventos-card";
import { getFeriadosProximos } from "@/lib/data/calendario";
import { getEventosProximos } from "@/lib/data/eventos";
import { FrequenciaHeatmap } from "@/components/dashboard/frequencia-heatmap";
import { MediasDisciplinasCard } from "@/components/dashboard/medias-disciplinas-card";
import { PedagogicoOverviewSection } from "@/components/dashboard/pedagogico-overview-section";
import { ProximasCobrancasCard } from "@/components/dashboard/proximas-cobrancas-card";
import { RankingAlunosCard } from "@/components/dashboard/ranking-alunos-card";
import { RankingTurmasCard } from "@/components/dashboard/ranking-turmas-card";
import { RealizadoProjetadoCard } from "@/components/dashboard/realizado-projetado-card";
import { ResumoAlunosCard } from "@/components/dashboard/resumo-alunos-card";
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

type DashTab = "financeiro" | "secretaria" | "pedagogico";

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

  const supabase = await createServerClient();
  const { data: perfilData } = await supabase
    .from("perfis")
    .select("quick_links")
    .eq("id", session.profile.id)
    .maybeSingle();
  const savedLinks: string[] = Array.isArray(perfilData?.quick_links) ? perfilData.quick_links : [];

  // Filter quick links by permission — same logic as topbar filterByPermissions
  function canAccessRoute(href: string): boolean {
    if (isAdmin) return true;
    const modulo = ROTA_PARA_MODULO[href];
    if (!modulo) return true;
    return can(perms, modulo, "read");
  }
  const quickLinks = savedLinks.filter(canAccessRoute);

  // All hrefs the user can access — passed to modal so it only shows allowed routes
  const allowedHrefs = Object.keys(ROTA_PARA_MODULO).filter(canAccessRoute);

  const has = (modulo: ModuloCodigo): boolean => isAdmin || can(perms, modulo, "read");

  // Module flags
  const showFinanceiroCobrancas = has("financeiro.cobrancas");
  const showDespesas = has("despesas");
  const showBolsistas = has("bolsistas");
  const showRhFolha = has("rh.folha-v2");
  const showAlunos = has("alunos");
  const showMatriculas = has("matriculas");
  const showFrequencias = has("frequencias");
  const showTurmas = has("turmas");
  const showAvaliacoes = has("avaliacoes");

  // Tab visibility
  const tabFinanceiroVisible =
    showFinanceiroCobrancas || showDespesas || showBolsistas || showRhFolha;
  const showEventos = has("eventos");
  const tabSecretariaVisible =
    showAlunos || showMatriculas || showFrequencias || showTurmas || showEventos;
  const tabPedagogicoVisible = showAvaliacoes || showFrequencias;

  const tabsVisiveis: DashTab[] = [];
  if (tabFinanceiroVisible) tabsVisiveis.push("financeiro");
  if (tabSecretariaVisible) tabsVisiveis.push("secretaria");
  if (tabPedagogicoVisible) tabsVisiveis.push("pedagogico");

  const competencia = isValidCompetencia(params.competencia) ? params.competencia : currentCompetencia();
  const anoLetivo = isValidAno(params.ano) ? Number(params.ano) : new Date().getFullYear();

  // Header action button flags
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
    pedagogicoOverview,
    slot2,
    slot5,
    aniversariantesSemana,
    feriadosProximos,
    eventosProximos,
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
    showFrequencias ? getFeriadosProximos(escolaId) : null,
    showEventos ? getEventosProximos(escolaId, 5) : null,
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
            {showNovoAluno && (
              <ButtonLink href="/alunos/novo" variant="primary">
                <Plus size={14} /> Novo aluno
              </ButtonLink>
            )}
          </>
        }
      />

      <QuickLinks initialLinks={quickLinks} allowedHrefs={allowedHrefs} />

      <DashboardTabs active={tabEfetiva} competencia={competencia} visible={tabsVisiveis} />

      {tabEfetiva === "financeiro" && (
        <>
          {showFinanceiroCobrancas && hero && <HeroFinancial data={hero} />}

          <section className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {showRhFolha && folhaRatio && <FolhaRatioCard data={folhaRatio} />}
            {showFinanceiroCobrancas && ticket && <TicketCard data={ticket} />}
            {showBolsistas && beneficios && <BolsistasReceitaCard data={beneficios} />}
            {showBolsistas && beneficios && <BeneficiosCard data={beneficios} />}
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
            (showFinanceiroCobrancas && slot5) ||
            (showMatriculas && slot5) ||
            (showDespesas && topCategorias) ||
            (showRhFolha && folhaEmpresas)) && (
            <SectionHeader title="Operação" subtitle="Cobranças, despesas e folha do mês" />
          )}

          {(showFinanceiroCobrancas && isPropria && proximasCobrancas) ||
            (isPropria && showFinanceiroCobrancas && slot5) ||
            (!isPropria && showMatriculas && slot5) ? (
            <section className="grid gap-6 lg:grid-cols-2">
              {showFinanceiroCobrancas && isPropria && proximasCobrancas && (
                <ProximasCobrancasCard items={proximasCobrancas} />
              )}
              {isPropria && showFinanceiroCobrancas && slot5 && (
                <TopDevedores items={slot5 as DevedorRow[]} />
              )}
              {!isPropria && showMatriculas && slot5 && (
                <RenovacoesPendentes items={slot5 as RenovacaoRow[]} />
              )}
            </section>
          ) : null}

          <section className="grid gap-6 lg:grid-cols-2">
            {showDespesas && topCategorias && <TopCategoriasCard items={topCategorias} />}
            {showRhFolha && folhaEmpresas && <FolhaEmpresas items={folhaEmpresas} />}
          </section>
        </>
      )}

      {tabEfetiva === "secretaria" && (
        <>
          {/* ESTA SEMANA — agenda primeiro: próximos aniversariantes, eventos, feriados, aniv. matrícula */}
          <SectionHeader title="Esta semana" subtitle="Próximos dias da agenda" />
          {showAlunos && aniversariantesSemana && (
            <AniversariantesProximosRow items={aniversariantesSemana} />
          )}
          {((showFrequencias && feriadosProximos) || (showEventos && eventosProximos)) && (
            <section className="grid gap-6 lg:grid-cols-2">
              {showFrequencias && feriadosProximos && <FeriadosCard items={feriadosProximos} />}
              {showEventos && eventosProximos && <EventosCard items={eventosProximos} />}
            </section>
          )}
          {showAlunos && aniversariantesMatricula && (
            <AniversarioMatriculaCard items={aniversariantesMatricula} />
          )}

          {/* HOJE — aniversariantes do dia + frequência atual */}
          <SectionHeader title="Hoje" subtitle="O que acontece agora" />
          <section className="grid gap-6 lg:grid-cols-[1fr_auto]">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              {showFrequencias && frequencia && frequenciaPorTurma && (
                <FrequenciaCard data={frequencia} porTurma={frequenciaPorTurma} />
              )}
              <SaudeSistemaCard data={saudeSistema} />
            </div>
            {showAlunos && aniversariantesSemana && (
              <div className="w-80 shrink-0">
                <AniversariantesHojeCard items={aniversariantesSemana} />
              </div>
            )}
          </section>

          {/* VISÃO GERAL — indicadores estruturais */}
          <SectionHeader title="Visão geral" subtitle="Indicadores estruturais" />
          <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {showAlunos && ocupacao && (
              <MetricRing
                label="Ocupação"
                percent={ocupacaoPct}
                centerLabel="Vagas"
                centerValue={`${ocupacao.ocupadas}/${ocupacao.total}`}
              />
            )}
            {showAlunos && ocupacao && <ResumoAlunosCard ocupacao={ocupacao} />}
          </section>

          {showMatriculas && stages && <StageTable rows={stages} />}

          <section className="grid gap-6 lg:grid-cols-2">
            {showTurmas && rankingTurmas && <RankingTurmasCard items={rankingTurmas} />}
            {showAlunos && aniversariantes && <AniversariantesCard items={aniversariantes} />}
          </section>

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
