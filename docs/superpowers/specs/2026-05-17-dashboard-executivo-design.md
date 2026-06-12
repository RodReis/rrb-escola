# Dashboard Executivo — Design

**Data:** 2026-05-17
**Autor:** brainstorm com diretor
**Status:** aprovado para implementação

## Objetivo

Substituir dashboard atual (`src/app/(app)/page.tsx`) por painel executivo orientado à **decisão do diretor**. Cada card responde uma pergunta de negócio, não exibe dado cru.

## Perguntas de negócio que o dashboard responde

1. Qual a **saúde financeira** do mês? (receita, despesa, folha, margem)
2. Como estamos vs. **mês anterior**? (deltas)
3. Qual a **tendência** dos últimos 6 meses? (receita × despesa)
4. Quanto perco com **inadimplência**? Quem deve? *(somente escolas com gestão financeira própria)*
5. Folha pesa **quanto da receita**? (limite saudável ~50%)
6. Estamos com **vagas ociosas**? Onde?
7. Qual etapa rende mais? **Ticket médio** por etapa?
8. Há **alertas urgentes**? (inadimplência, vagas críticas, contratos vencendo, aniversários)

## Configuração por escola — gestão financeira

Nem toda escola opera o financeiro internamente. CRM Escola **terceiriza** a cobrança (não há inadimplência visível no sistema). Outras escolas operam **gestão própria** (cobram alunos, controlam inadimplência).

Dashboard deve **se adaptar ao modelo da escola logada**.

### Schema

Adicionar coluna em `escolas`:

```sql
alter table escolas
  add column gestao_financeira text not null default 'propria'
  check (gestao_financeira in ('propria', 'terceirizada'));
```

Migration: `supabase/migrations/202605280001_escolas_gestao_financeira.sql`

Seed: marcar CRM Escola como `terceirizada`.

### Comportamento

| Modelo | Mostra | Oculta / Substitui |
|--------|--------|--------------------|
| `propria` | Inadimplência ring, Top devedores, alertas de inadimplência | — |
| `terceirizada` | Repasse recebido (substitui inadimplência), Contratos ativos (substitui devedores) | Inadimplência ring, Top devedores, alertas inadimplência |

**Cards substitutos** (terceirizada):
- **Repasse recebido**: valor recebido do operador terceirizado no mês + delta vs mês anterior
- **Contratos ativos**: matrículas ativas vencendo nos próximos 30/60/90 dias

### Decisão no código

Função `getEscolaConfig(escolaId)` retorna `{ gestaoFinanceira: 'propria' | 'terceirizada' }`. Página decide quais blocos renderizar com base nesse flag.

## Layout

Três zonas verticais, espaçamento generoso (`gap-6` a `gap-8`).

### Zona 1 — Hero financeiro (largura total)

Linha de 4 KPIs grandes com delta vs mês anterior:

| Card | Valor | Sublegenda | Delta |
|------|-------|-----------|-------|
| Receita | R$ X | mês corrente | ↑/↓ % vs mês anterior |
| Despesas | R$ Y | fixas + variáveis | ↑/↓ % |
| Folha | R$ Z | bruta consolidada | ↑/↓ % |
| **Margem** | R$ W | receita − despesa − folha | destaque verde/vermelho |

Margem em destaque (background diferenciado, ícone trending).

### Zona 2 — Alertas (esquerda 1/3) + Gráfico tendência (direita 2/3)

**Alertas** — lista priorizada, máx 5 itens:
- 🔴 crítico (inadimplência > 10%, vagas críticas)
- 🟡 atenção (contratos vencendo 30 dias)
- 🔵 informativo (aniversariantes semana)

Cada item: ícone + texto curto + chevron link.

**Gráfico tendência** — recharts area chart, 6 meses:
- Eixo X: meses
- Linha 1: receita (brand)
- Linha 2: despesa+folha (vermelho)
- Sem gridlines pesadas, eixo Y discreto, tooltip clean.

### Zona 3 — Métricas operacionais (4 cards)

Grid 4 colunas. Slot 2 muda conforme `gestao_financeira`:

| Slot | `propria` | `terceirizada` |
|------|-----------|----------------|
| 1 | Ocupação (donut SVG) — 491/520 (94%) | idem |
| 2 | **Inadimplência** (ring SVG) — 8.2% / R$ 26k | **Repasse recebido** (valor + delta) |
| 3 | Folha/Receita (barra horizontal) — 68% semáforo | idem |
| 4 | Ticket Médio (valor + sparkline 6m) — R$ 642 | idem

### Zona 4 — Detalhamento por etapa (tabela leve)

Tabela densa, sem bordas pesadas:

| Etapa | Alunos | Receita | Ticket | Ocupação |
|-------|--------|---------|--------|----------|
| Ed Infantil | 112 | R$ 70.526 | R$ 629 | 80% |
| Fund I | 223 | R$ 141.067 | R$ 632 | 91% |
| Fund II | 117 | R$ 81.587 | R$ 697 | 78% |
| Médio | 38 | R$ 27.507 | R$ 723 | 62% |

Linha total no final.

### Zona 5 — duas colunas (esquerda depende do modelo) + Folha por empresa

Coluna esquerda:
- `propria`: **Top 5 devedores** — avatar + nome + R$ + vence em N dias
- `terceirizada`: **Contratos ativos vencendo** — lista 5 matrículas vencendo em 30/60/90 dias

Coluna direita (sempre):
- **Folha por empresa** — 2 barras comparativas (Escola Pinguinho × Colégio EPG) com bruto/inss/irrf/líquido

## Princípios visuais

- **Cards**: `bg-surface` (claro/dark via theme), `shadow-sm`, `rounded-2xl`, `p-6`, sem borda
- **Tipografia**:
  - Valor KPI principal: `text-3xl font-bold` (32px+)
  - Label: `text-[0.66rem] uppercase tracking-[0.14em] text-ink/55 font-bold`
  - Sublegenda: `text-sm text-ink/60`
- **Cor com propósito**:
  - `brand` apenas para destaques principais
  - verde/vermelho **só** em delta e margem
  - cinza neutro pro resto
  - Etapas mantêm paleta atual (amarelo/azul/vermelho/verde)
- **Espaçamento**: `gap-6` entre cards, `gap-8` entre zonas
- **Ícones**: `lucide-react`, 14-16px, dentro de chip `bg-muted rounded-ui h-9 w-9 grid place-items-center`
- **Sem chartjunk**: zero gradients exagerados, sem 3D, sem sombras pesadas

## Componentes novos

```
src/components/dashboard/
  hero-financial.tsx          # Zona 1
  alert-list.tsx              # Zona 2 esquerda
  revenue-trend-chart.tsx     # Zona 2 direita (recharts)
  metric-ring.tsx             # SVG donut (ocupação, inadimplência)
  metric-bar.tsx              # barra horizontal (folha/receita)
  ticket-card.tsx             # valor + sparkline
  repasse-card.tsx            # terceirizada: repasse recebido + delta
  trend-spark.tsx             # SVG sparkline inline (reutilizável)
  delta-badge.tsx             # ↑+12% verde / ↓-3% vermelho
  stage-table.tsx             # Zona 4
  top-devedores.tsx           # Zona 5 esquerda (propria)
  contratos-vencendo.tsx      # Zona 5 esquerda (terceirizada)
  folha-empresas.tsx          # Zona 5 direita
```

`finance-chart.tsx` atual é removido (substituído por `revenue-trend-chart.tsx`).

## Data layer

Novo arquivo `src/lib/data/dashboard-executive.ts`. Não estender `dashboard.ts` (manter histórico legível).

Funções:

```ts
getEscolaConfig(escolaId): {
  gestaoFinanceira: 'propria' | 'terceirizada';
}

getHero(competencia): {
  receita: number; receitaPrev: number;
  despesa: number; despesaPrev: number;
  folha: number; folhaPrev: number;
  margem: number; margemPrev: number;
  competenciaLabel: string;
}

getRevenueTrend(months = 6): Array<{
  competencia: string;
  receita: number;
  custos: number;  // despesa + folha
}>

getOcupacao(): {
  total: number;
  ocupadas: number;
  porEtapa: Array<{ etapa: string; capacidade: number; matriculados: number; cor: string }>;
}

// só chamada quando gestaoFinanceira === 'propria'
getInadimplencia(competencia): {
  percentual: number;
  valor: number;
  count: number;
}

// só chamada quando gestaoFinanceira === 'terceirizada'
getRepasseRecebido(competencia): {
  valor: number;
  valorPrev: number;
}

// só chamada quando gestaoFinanceira === 'terceirizada'
getContratosVencendo(limit = 5): Array<{
  matriculaId: string;
  alunoNome: string;
  fimVigencia: string;
  diasRestantes: number;
}>


getStageBreakdown(competencia): Array<{
  etapa: string;
  alunos: number;
  receita: number;
  ticket: number;
  ocupacao: number;
}>

getTicketMedio(months = 6): {
  atual: number;
  serie: number[];  // pra sparkline
}

getFolhaRatio(competencia): {
  ratio: number;     // folha / receita
  receita: number;
  folha: number;
}

// só chamada quando gestaoFinanceira === 'propria'
getTopDevedores(limit = 5): Array<{
  alunoId: string;
  nome: string;
  valor: number;
  diasVencimento: number;
}>

getFolhaPorEmpresa(competencia): Array<{
  empresa: string;
  headcount: number;
  bruto: number;
  inss: number;
  irrf: number;
  liquido: number;
}>

getAlertas(): Array<{
  id: string;
  severidade: "critico" | "atencao" | "info";
  titulo: string;
  descricao: string;
  href?: string;
}>
```

Composição em `page.tsx` via `Promise.all`. **Primeiro** resolve `getEscolaConfig`, depois dispara somente as funções aplicáveis ao modelo.

## Página

`src/app/(app)/page.tsx` reescrita do zero:

```tsx
export default async function DashboardPage() {
  const config = await getEscolaConfig(escolaId);
  const isPropria = config.gestaoFinanceira === 'propria';

  const [hero, trend, ocupacao, stages, ticket, folhaRatio, folhaEmpresas, alertas, slot2, slot5] =
    await Promise.all([
      getHero(competencia),
      getRevenueTrend(),
      getOcupacao(),
      getStageBreakdown(competencia),
      getTicketMedio(),
      getFolhaRatio(competencia),
      getFolhaPorEmpresa(competencia),
      getAlertas(),
      isPropria ? getInadimplencia(competencia) : getRepasseRecebido(competencia),
      isPropria ? getTopDevedores() : getContratosVencendo(),
    ]);

  return (
    <div className="grid gap-8">
      <PageHeader title="Dashboard" counter={mesLabel} ... />
      <HeroFinancial data={hero} />
      <section className="grid gap-6 lg:grid-cols-3">
        <AlertList items={alertas} />
        <div className="lg:col-span-2"><RevenueTrendChart data={trend} /></div>
      </section>
      <section className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <MetricRing label="Ocupação" data={ocupacao} />
        {isPropria
          ? <MetricRing label="Inadimplência" data={slot2} variant="warning" />
          : <RepasseCard data={slot2} />}
        <MetricBar label="Folha/Receita" data={folhaRatio} />
        <TicketCard data={ticket} />
      </section>
      <StageTable rows={stages} />
      <section className="grid gap-6 lg:grid-cols-2">
        {isPropria
          ? <TopDevedores items={slot5} />
          : <ContratosVencendo items={slot5} />}
        <FolhaEmpresas items={folhaEmpresas} />
      </section>
    </div>
  );
}
```

## Decisões técnicas

- **Server Component** (sem `"use client"`), exceto recharts wrapper
- **SVG puro** para donut/ring/sparkline (evita peso recharts em coisa simples)
- **Recharts** apenas no `revenue-trend-chart.tsx` (já dependência)
- **Cores semáforo Folha/Receita**: <50% verde, 50–65% amarelo, >65% vermelho
- **Cores semáforo Inadimplência**: <5% verde, 5–10% amarelo, >10% vermelho
- **Ocupação**: usar `turmas.capacidade` × matrículas ativas (verificar campo no schema)
- **Inadimplência**: cobranças status `vencida` no mês corrente / total previsto
- **Tendência 6m**: rolling window últimos 6 meses competências
- **Top devedores**: agregar `cobrancas` status `vencida`/`parcial`, group by aluno, order desc

## Fora de escopo (fase 2)

- Filtro de competência interativo (UI)
- Drilldown click → página detalhe
- Export PDF do dashboard
- Comparativo ano anterior (mesmo mês)
- Forecasting / projeção
- Personalização de cards visíveis

## Critério de pronto

- [ ] Migration `escolas.gestao_financeira` aplicada + seed RRB marcado terceirizada
- [ ] `page.tsx` reescrita renderiza todas 5 zonas
- [ ] Branch `propria` × `terceirizada` muda slots 2 e 5 corretamente
- [ ] Todos componentes novos criados em `src/components/dashboard/`
- [ ] `dashboard-executive.ts` com funções, todas tipadas, branch-aware
- [ ] `finance-chart.tsx` antigo removido
- [ ] Tipagem `tsc --noEmit` limpa
- [ ] Visual no navegador conferido (modelo terceirizada com RRB; modelo própria com escola teste)
- [ ] Cores semáforo funcionam (testar com dados de borda)
