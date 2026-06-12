# Dashboard Executivo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir dashboard atual por painel executivo orientado à decisão do diretor, adaptável ao modelo de gestão financeira da escola (própria × terceirizada).

**Architecture:** Server Components Next.js 14 (App Router) compõem zonas visuais com data fetched via Supabase em paralelo. Novo arquivo `dashboard-executive.ts` agrega métricas; página resolve config da escola primeiro, depois dispara somente queries aplicáveis ao modelo (`propria` mostra inadimplência/devedores; `terceirizada` mostra repasse/renovações pendentes). SVG puro para donut/sparkline; Recharts apenas no gráfico de tendência.

**Tech Stack:** Next.js 14 App Router, React Server Components, TypeScript, Supabase (@supabase/ssr), Tailwind CSS, Recharts, lucide-react.

**Spec:** `docs/superpowers/specs/2026-05-17-dashboard-executivo-design.md`

**Convenção de cores Tailwind do projeto (já existentes):**
- `brand`, `accent`, `success`, `warning`, `danger`, `ink`, `paper`, `surface`, `muted`, `line`, `moss`, `clay`, `gold`

**Padrão de testes:** Projeto NÃO possui suite de testes automatizada (verificado: sem jest/vitest/playwright em `package.json`). Validação faz-se via:
1. `npm run typecheck` (tsc --noEmit)
2. `npm run lint`
3. `npm run dev` + verificação visual no navegador
4. Smoke test SQL onde aplicável

Cada task termina com esses três comandos antes do commit.

---

## File Structure

**Criar:**
- `supabase/migrations/202605280001_escolas_gestao_financeira.sql` — adiciona coluna `gestao_financeira` em `escolas`, seed marca RRB como `terceirizada`
- `src/lib/data/dashboard-executive.ts` — todas as queries do dashboard novo
- `src/components/dashboard/section-header.tsx` — header reutilizável (ícone, título, subtítulo)
- `src/components/dashboard/delta-badge.tsx` — badge com seta + % verde/vermelho
- `src/components/dashboard/trend-spark.tsx` — sparkline SVG inline
- `src/components/dashboard/metric-ring.tsx` — donut/ring SVG (ocupação, inadimplência)
- `src/components/dashboard/metric-bar.tsx` — barra horizontal com semáforo (folha/receita)
- `src/components/dashboard/hero-financial.tsx` — Zona 1 (receita, despesa, folha, margem)
- `src/components/dashboard/alert-list.tsx` — Zona 2 esquerda
- `src/components/dashboard/revenue-trend-chart.tsx` — Zona 2 direita (recharts client component)
- `src/components/dashboard/ticket-card.tsx` — ticket médio + sparkline
- `src/components/dashboard/repasse-card.tsx` — terceirizada: repasse recebido
- `src/components/dashboard/stage-table.tsx` — Zona 4
- `src/components/dashboard/top-devedores.tsx` — Zona 5 esquerda (própria)
- `src/components/dashboard/renovacoes-pendentes.tsx` — Zona 5 esquerda (terceirizada)
- `src/components/dashboard/folha-empresas.tsx` — Zona 5 direita

**Modificar:**
- `src/app/(app)/page.tsx` — reescrever do zero
- `src/lib/types.ts` — adicionar tipos exportáveis se necessário

**Deletar:**
- `src/components/dashboard/finance-chart.tsx` — substituído por `revenue-trend-chart.tsx`
- `src/lib/data/dashboard.ts` — substituído por `dashboard-executive.ts` (após page.tsx migrar)

---

## Task 1: Migration — coluna `gestao_financeira` em `escolas`

**Files:**
- Create: `supabase/migrations/202605280001_escolas_gestao_financeira.sql`

- [ ] **Step 1: Escrever migration**

Criar `supabase/migrations/202605280001_escolas_gestao_financeira.sql`:

```sql
-- Adiciona modelo de gestão financeira por escola
-- 'propria': escola controla cobrança/inadimplência internamente
-- 'terceirizada': cobrança operada por terceiro, sem inadimplência visível

alter table escolas
  add column if not exists gestao_financeira text not null default 'propria'
  check (gestao_financeira in ('propria', 'terceirizada'));

-- CRM Escola opera com cobrança terceirizada
update escolas
  set gestao_financeira = 'terceirizada'
  where id = '00000000-0000-0000-0000-000000000001';

comment on column escolas.gestao_financeira is
  'Modelo de cobrança: propria (escola controla) | terceirizada (operador externo)';
```

- [ ] **Step 2: Aplicar migration**

Run:
```bash
npx supabase db push
```
Expected: migration aplicada sem erro. Se Supabase local não estiver rodando, registrar e seguir — migration aplica no próximo `db reset`.

- [ ] **Step 3: Smoke test SQL**

Run (via psql ou Supabase Studio):
```sql
select id, nome, gestao_financeira from escolas;
```
Expected: CRM Escola retorna `gestao_financeira = 'terceirizada'`.

- [ ] **Step 4: Typecheck + lint**

```bash
npm run typecheck
npm run lint
```
Expected: zero erros.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/202605280001_escolas_gestao_financeira.sql
git commit -m "feat(escolas): coluna gestao_financeira (propria|terceirizada)"
```

---

## Task 2: Data layer — `getEscolaConfig`

**Files:**
- Create: `src/lib/data/dashboard-executive.ts`

- [ ] **Step 1: Criar arquivo com tipos base e `getEscolaConfig`**

```typescript
import { createServerClient } from "@/lib/supabase/server";
import { DEFAULT_SCHOOL_ID } from "@/lib/constants";

export type GestaoFinanceira = "propria" | "terceirizada";

export type EscolaConfig = {
  gestaoFinanceira: GestaoFinanceira;
};

export async function getEscolaConfig(escolaId: string = DEFAULT_SCHOOL_ID): Promise<EscolaConfig> {
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("escolas")
    .select("gestao_financeira")
    .eq("id", escolaId)
    .maybeSingle();

  const value = (data?.gestao_financeira as GestaoFinanceira | undefined) ?? "propria";
  return { gestaoFinanceira: value };
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```
Expected: zero erros.

- [ ] **Step 3: Commit**

```bash
git add src/lib/data/dashboard-executive.ts
git commit -m "feat(dashboard): data layer skeleton + getEscolaConfig"
```

---

## Task 3: Data layer — `getHero` (receita, despesa, folha, margem + delta)

**Files:**
- Modify: `src/lib/data/dashboard-executive.ts`

- [ ] **Step 1: Adicionar helper de competência e função `getHero`**

Append a `src/lib/data/dashboard-executive.ts`:

```typescript
function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function competenciaFromDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

function monthRange(competencia: string): { first: string; last: string } {
  const [y, m] = competencia.split("-").map(Number);
  const first = `${y}-${pad(m)}-01`;
  const last = `${y}-${pad(m)}-${pad(new Date(y, m, 0).getDate())}`;
  return { first, last };
}

function prevCompetencia(competencia: string): string {
  const [y, m] = competencia.split("-").map(Number);
  const d = new Date(y, m - 2, 1);
  return competenciaFromDate(d);
}

export function currentCompetencia(): string {
  return competenciaFromDate(new Date());
}

export type HeroData = {
  competencia: string;
  receita: number;
  receitaPrev: number;
  despesa: number;
  despesaPrev: number;
  folha: number;
  folhaPrev: number;
  margem: number;
  margemPrev: number;
};

async function somaPagamentos(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  escolaId: string,
  competencia: string
): Promise<number> {
  const { first, last } = monthRange(competencia);
  const { data } = await supabase
    .from("pagamentos")
    .select("valor_pago")
    .eq("escola_id", escolaId)
    .gte("data_pagamento", first)
    .lte("data_pagamento", last)
    .is("cancelado_em", null);
  return (data ?? []).reduce((s, r) => s + Number(r.valor_pago ?? 0), 0);
}

async function somaDespesas(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  escolaId: string,
  competencia: string
): Promise<number> {
  const { data } = await supabase
    .from("despesas")
    .select("valor")
    .eq("escola_id", escolaId)
    .eq("competencia", competencia);
  return (data ?? []).reduce((s, r) => s + Number(r.valor ?? 0), 0);
}

async function somaFolha(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  escolaId: string,
  competencia: string
): Promise<number> {
  const { data } = await supabase
    .from("payroll_runs")
    .select("total_bruto")
    .eq("escola_id", escolaId)
    .eq("competencia", competencia);
  return (data ?? []).reduce((s, r) => s + Number(r.total_bruto ?? 0), 0);
}

export async function getHero(
  competencia: string,
  escolaId: string = DEFAULT_SCHOOL_ID
): Promise<HeroData> {
  const supabase = await createServerClient();
  const prev = prevCompetencia(competencia);

  const [receita, receitaPrev, despesa, despesaPrev, folha, folhaPrev] = await Promise.all([
    somaPagamentos(supabase, escolaId, competencia),
    somaPagamentos(supabase, escolaId, prev),
    somaDespesas(supabase, escolaId, competencia),
    somaDespesas(supabase, escolaId, prev),
    somaFolha(supabase, escolaId, competencia),
    somaFolha(supabase, escolaId, prev),
  ]);

  return {
    competencia,
    receita,
    receitaPrev,
    despesa,
    despesaPrev,
    folha,
    folhaPrev,
    margem: receita - despesa - folha,
    margemPrev: receitaPrev - despesaPrev - folhaPrev,
  };
}
```

- [ ] **Step 2: Validar nomes das tabelas**

Antes de prosseguir, conferir nomes reais no schema:

```bash
grep -n "create table despesas\|create table payroll_runs\|total_bruto" supabase/migrations/*.sql | head
```

Se `despesas` não tiver coluna `valor` ou `competencia`, ou se `payroll_runs` tiver outro nome de coluna pra total bruto, ajustar os helpers antes do commit.

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```
Expected: zero erros.

- [ ] **Step 4: Commit**

```bash
git add src/lib/data/dashboard-executive.ts
git commit -m "feat(dashboard): getHero (receita/despesa/folha/margem + delta)"
```

---

## Task 4: Data layer — `getRevenueTrend` (6 meses)

**Files:**
- Modify: `src/lib/data/dashboard-executive.ts`

- [ ] **Step 1: Implementar série temporal**

Append:

```typescript
export type RevenueTrendPoint = {
  competencia: string;
  receita: number;
  custos: number;
};

function rollingCompetencias(months: number): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push(competenciaFromDate(d));
  }
  return out;
}

export async function getRevenueTrend(
  months: number = 6,
  escolaId: string = DEFAULT_SCHOOL_ID
): Promise<RevenueTrendPoint[]> {
  const supabase = await createServerClient();
  const competencias = rollingCompetencias(months);

  const pontos = await Promise.all(
    competencias.map(async (competencia) => {
      const [receita, despesa, folha] = await Promise.all([
        somaPagamentos(supabase, escolaId, competencia),
        somaDespesas(supabase, escolaId, competencia),
        somaFolha(supabase, escolaId, competencia),
      ]);
      return {
        competencia,
        receita,
        custos: despesa + folha,
      };
    })
  );

  return pontos;
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```
Expected: zero erros.

- [ ] **Step 3: Commit**

```bash
git add src/lib/data/dashboard-executive.ts
git commit -m "feat(dashboard): getRevenueTrend (série 6 meses)"
```

---

## Task 5: Data layer — `getOcupacao`, `getStageBreakdown`, `getTicketMedio`

**Files:**
- Modify: `src/lib/data/dashboard-executive.ts`

- [ ] **Step 1: Validar campos de etapa/segmento**

```bash
grep -rn "etapa\|segmento" supabase/migrations/202605200001_serie_segmento.sql supabase/migrations/202605220001_segmentos.sql | head -20
```

Confirmar: existe coluna `segmento` ou `etapa` em `series`. Anotar o campo correto e os valores possíveis (ex.: `educacao_infantil`, `fundamental_1`, etc.).

- [ ] **Step 2: Implementar funções**

Append (ajustando `campo_etapa` ao confirmado no step 1):

```typescript
export type OcupacaoData = {
  total: number;
  ocupadas: number;
  porEtapa: Array<{ etapa: string; capacidade: number; matriculados: number }>;
};

export async function getOcupacao(escolaId: string = DEFAULT_SCHOOL_ID): Promise<OcupacaoData> {
  const supabase = await createServerClient();

  const { data: turmas } = await supabase
    .from("turmas")
    .select("id, capacidade, serie_id, series(segmento)")
    .eq("escola_id", escolaId);

  const { data: matriculas } = await supabase
    .from("matriculas")
    .select("turma_id")
    .eq("escola_id", escolaId)
    .eq("status", "ativa");

  const matriculasPorTurma = new Map<string, number>();
  for (const m of matriculas ?? []) {
    matriculasPorTurma.set(m.turma_id, (matriculasPorTurma.get(m.turma_id) ?? 0) + 1);
  }

  const porEtapaMap = new Map<string, { capacidade: number; matriculados: number }>();
  let total = 0;
  let ocupadas = 0;

  for (const t of turmas ?? []) {
    const etapa = (t as any).series?.segmento ?? "outros";
    const cap = Number(t.capacidade ?? 0);
    const ocup = matriculasPorTurma.get(t.id) ?? 0;
    total += cap;
    ocupadas += ocup;
    const acc = porEtapaMap.get(etapa) ?? { capacidade: 0, matriculados: 0 };
    acc.capacidade += cap;
    acc.matriculados += ocup;
    porEtapaMap.set(etapa, acc);
  }

  return {
    total,
    ocupadas,
    porEtapa: Array.from(porEtapaMap.entries()).map(([etapa, v]) => ({ etapa, ...v })),
  };
}

export type StageBreakdownRow = {
  etapa: string;
  alunos: number;
  receita: number;
  ticket: number;
  ocupacao: number;
};

export async function getStageBreakdown(
  competencia: string,
  escolaId: string = DEFAULT_SCHOOL_ID
): Promise<StageBreakdownRow[]> {
  const supabase = await createServerClient();

  const { data: cobrancas } = await supabase
    .from("cobrancas")
    .select("valor_final, matriculas(serie_id, series(segmento))")
    .eq("escola_id", escolaId)
    .eq("competencia", competencia)
    .neq("status", "cancelada");

  const receitaPorEtapa = new Map<string, number>();
  for (const c of (cobrancas ?? []) as any[]) {
    const etapa = c.matriculas?.series?.segmento ?? "outros";
    receitaPorEtapa.set(etapa, (receitaPorEtapa.get(etapa) ?? 0) + Number(c.valor_final ?? 0));
  }

  const ocup = await getOcupacao(escolaId);

  return ocup.porEtapa.map((p) => ({
    etapa: p.etapa,
    alunos: p.matriculados,
    receita: receitaPorEtapa.get(p.etapa) ?? 0,
    ticket: p.matriculados > 0 ? (receitaPorEtapa.get(p.etapa) ?? 0) / p.matriculados : 0,
    ocupacao: p.capacidade > 0 ? p.matriculados / p.capacidade : 0,
  }));
}

export type TicketMedioData = {
  atual: number;
  serie: number[];
};

export async function getTicketMedio(
  months: number = 6,
  escolaId: string = DEFAULT_SCHOOL_ID
): Promise<TicketMedioData> {
  const supabase = await createServerClient();
  const competencias = rollingCompetencias(months);

  const serie = await Promise.all(
    competencias.map(async (competencia) => {
      const [{ count }, { data: cobrancas }] = await Promise.all([
        supabase
          .from("matriculas")
          .select("id", { count: "exact", head: true })
          .eq("escola_id", escolaId)
          .eq("status", "ativa"),
        supabase
          .from("cobrancas")
          .select("valor_final")
          .eq("escola_id", escolaId)
          .eq("competencia", competencia)
          .neq("status", "cancelada"),
      ]);
      const total = (cobrancas ?? []).reduce((s, r) => s + Number(r.valor_final ?? 0), 0);
      return count && count > 0 ? total / count : 0;
    })
  );

  return {
    atual: serie[serie.length - 1] ?? 0,
    serie,
  };
}
```

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```
Expected: zero erros. Se houver erro de tipo no join inline `series(segmento)`, manter cast `(c as any)` localmente — é deliberado pois o tipo do Supabase JS é fraco aí.

- [ ] **Step 4: Commit**

```bash
git add src/lib/data/dashboard-executive.ts
git commit -m "feat(dashboard): ocupação, breakdown por etapa, ticket médio"
```

---

## Task 6: Data layer — `getFolhaRatio`, `getFolhaPorEmpresa`

**Files:**
- Modify: `src/lib/data/dashboard-executive.ts`

- [ ] **Step 1: Validar nomes na tabela folha**

```bash
grep -rn "create table payroll_runs\|create table funcionarios\|empresa_id\|empresas" supabase/migrations/*.sql | head -15
```

Anotar nome real da tabela de empresas (provavelmente `empresas`) e campos de totalizadores (`total_bruto`, `total_inss`, `total_irrf`, `total_liquido` ou similar) em `payroll_runs`.

- [ ] **Step 2: Implementar**

Append (ajuste nomes a partir do step 1):

```typescript
export type FolhaRatioData = {
  ratio: number;
  receita: number;
  folha: number;
};

export async function getFolhaRatio(
  competencia: string,
  escolaId: string = DEFAULT_SCHOOL_ID
): Promise<FolhaRatioData> {
  const supabase = await createServerClient();
  const [receita, folha] = await Promise.all([
    somaPagamentos(supabase, escolaId, competencia),
    somaFolha(supabase, escolaId, competencia),
  ]);
  return {
    ratio: receita > 0 ? folha / receita : 0,
    receita,
    folha,
  };
}

export type FolhaEmpresaRow = {
  empresaId: string;
  empresa: string;
  headcount: number;
  bruto: number;
  inss: number;
  irrf: number;
  liquido: number;
};

export async function getFolhaPorEmpresa(
  competencia: string,
  escolaId: string = DEFAULT_SCHOOL_ID
): Promise<FolhaEmpresaRow[]> {
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("payroll_runs")
    .select("empresa_id, empresas(nome), headcount, total_bruto, total_inss, total_irrf, total_liquido")
    .eq("escola_id", escolaId)
    .eq("competencia", competencia);

  return ((data ?? []) as any[]).map((r) => ({
    empresaId: r.empresa_id,
    empresa: r.empresas?.nome ?? "—",
    headcount: Number(r.headcount ?? 0),
    bruto: Number(r.total_bruto ?? 0),
    inss: Number(r.total_inss ?? 0),
    irrf: Number(r.total_irrf ?? 0),
    liquido: Number(r.total_liquido ?? 0),
  }));
}
```

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```
Expected: zero erros.

- [ ] **Step 4: Commit**

```bash
git add src/lib/data/dashboard-executive.ts
git commit -m "feat(dashboard): folha/receita ratio + folha por empresa"
```

---

## Task 7: Data layer — branch `propria`: `getInadimplencia`, `getTopDevedores`

**Files:**
- Modify: `src/lib/data/dashboard-executive.ts`

- [ ] **Step 1: Implementar**

Append:

```typescript
export type InadimplenciaData = {
  percentual: number;
  valor: number;
  count: number;
};

export async function getInadimplencia(
  competencia: string,
  escolaId: string = DEFAULT_SCHOOL_ID
): Promise<InadimplenciaData> {
  const supabase = await createServerClient();
  const [vencidas, total] = await Promise.all([
    supabase
      .from("cobrancas")
      .select("valor_final")
      .eq("escola_id", escolaId)
      .eq("competencia", competencia)
      .eq("status", "vencida"),
    supabase
      .from("cobrancas")
      .select("valor_final")
      .eq("escola_id", escolaId)
      .eq("competencia", competencia)
      .neq("status", "cancelada"),
  ]);

  const valor = (vencidas.data ?? []).reduce((s, r) => s + Number(r.valor_final ?? 0), 0);
  const totalValor = (total.data ?? []).reduce((s, r) => s + Number(r.valor_final ?? 0), 0);

  return {
    percentual: totalValor > 0 ? valor / totalValor : 0,
    valor,
    count: vencidas.data?.length ?? 0,
  };
}

export type DevedorRow = {
  alunoId: string;
  nome: string;
  valor: number;
  diasVencimento: number;
};

export async function getTopDevedores(
  limit: number = 5,
  escolaId: string = DEFAULT_SCHOOL_ID
): Promise<DevedorRow[]> {
  const supabase = await createServerClient();
  const hoje = new Date();
  const hojeStr = `${hoje.getFullYear()}-${pad(hoje.getMonth() + 1)}-${pad(hoje.getDate())}`;

  const { data } = await supabase
    .from("cobrancas")
    .select("valor_final, data_vencimento, matriculas(aluno_id, alunos(nome))")
    .eq("escola_id", escolaId)
    .in("status", ["vencida", "parcial"])
    .lte("data_vencimento", hojeStr);

  const porAluno = new Map<string, { nome: string; valor: number; vencimento: string }>();
  for (const c of ((data ?? []) as any[])) {
    const alunoId = c.matriculas?.aluno_id;
    if (!alunoId) continue;
    const nome = c.matriculas?.alunos?.nome ?? "—";
    const acc = porAluno.get(alunoId) ?? { nome, valor: 0, vencimento: c.data_vencimento };
    acc.valor += Number(c.valor_final ?? 0);
    if (c.data_vencimento < acc.vencimento) acc.vencimento = c.data_vencimento;
    porAluno.set(alunoId, acc);
  }

  const rows: DevedorRow[] = Array.from(porAluno.entries()).map(([alunoId, v]) => {
    const venc = new Date(v.vencimento);
    const dias = Math.floor((hoje.getTime() - venc.getTime()) / (1000 * 60 * 60 * 24));
    return { alunoId, nome: v.nome, valor: v.valor, diasVencimento: dias };
  });

  rows.sort((a, b) => b.valor - a.valor);
  return rows.slice(0, limit);
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```
Expected: zero erros.

- [ ] **Step 3: Commit**

```bash
git add src/lib/data/dashboard-executive.ts
git commit -m "feat(dashboard): branch propria — inadimplência + top devedores"
```

---

## Task 8: Data layer — branch `terceirizada`: `getRepasseRecebido`, `getRenovacoesPendentes`

**Files:**
- Modify: `src/lib/data/dashboard-executive.ts`

- [ ] **Step 1: Implementar**

Append:

```typescript
export type RepasseData = {
  valor: number;
  valorPrev: number;
};

// Para terceirizada, "repasse recebido" = total de pagamentos creditados no mês
// (mesma fonte que receita, mas semanticamente o que a escola recebe do operador).
// Quando houver tabela dedicada de repasses, trocar aqui.
export async function getRepasseRecebido(
  competencia: string,
  escolaId: string = DEFAULT_SCHOOL_ID
): Promise<RepasseData> {
  const supabase = await createServerClient();
  const prev = prevCompetencia(competencia);
  const [valor, valorPrev] = await Promise.all([
    somaPagamentos(supabase, escolaId, competencia),
    somaPagamentos(supabase, escolaId, prev),
  ]);
  return { valor, valorPrev };
}

export type RenovacaoRow = {
  matriculaId: string;
  alunoId: string;
  alunoNome: string;
  anoLetivo: number;
  diasRestantes: number;
};

// Renovações pendentes: matrículas ativas do ano letivo corrente.
// Próximas do fim do ano = candidatas a renovação.
export async function getRenovacoesPendentes(
  limit: number = 5,
  escolaId: string = DEFAULT_SCHOOL_ID
): Promise<RenovacaoRow[]> {
  const supabase = await createServerClient();
  const hoje = new Date();
  const anoLetivo = hoje.getFullYear();

  const { data } = await supabase
    .from("matriculas")
    .select("id, aluno_id, ano_letivo, alunos(nome)")
    .eq("escola_id", escolaId)
    .eq("status", "ativa")
    .eq("ano_letivo", anoLetivo)
    .limit(limit);

  const fimAno = new Date(anoLetivo, 11, 31);
  const diasRestantes = Math.floor((fimAno.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));

  return ((data ?? []) as any[]).map((m) => ({
    matriculaId: m.id,
    alunoId: m.aluno_id,
    alunoNome: m.alunos?.nome ?? "—",
    anoLetivo: m.ano_letivo,
    diasRestantes,
  }));
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```
Expected: zero erros.

- [ ] **Step 3: Commit**

```bash
git add src/lib/data/dashboard-executive.ts
git commit -m "feat(dashboard): branch terceirizada — repasse + renovações pendentes"
```

---

## Task 9: Data layer — `getAlertas`

**Files:**
- Modify: `src/lib/data/dashboard-executive.ts`

- [ ] **Step 1: Implementar alertas com filtro por modelo**

Append:

```typescript
export type AlertaSeveridade = "critico" | "atencao" | "info";

export type AlertaItem = {
  id: string;
  severidade: AlertaSeveridade;
  titulo: string;
  descricao: string;
  href?: string;
};

export async function getAlertas(
  competencia: string,
  gestaoFinanceira: GestaoFinanceira,
  escolaId: string = DEFAULT_SCHOOL_ID
): Promise<AlertaItem[]> {
  const alertas: AlertaItem[] = [];

  const ocup = await getOcupacao(escolaId);
  for (const etapa of ocup.porEtapa) {
    if (etapa.capacidade > 0 && etapa.matriculados / etapa.capacidade < 0.5) {
      alertas.push({
        id: `vagas-${etapa.etapa}`,
        severidade: "atencao",
        titulo: `Vagas ociosas em ${etapa.etapa}`,
        descricao: `${etapa.matriculados}/${etapa.capacidade} matrículas`,
        href: "/matriculas",
      });
    }
  }

  if (gestaoFinanceira === "propria") {
    const inad = await getInadimplencia(competencia, escolaId);
    if (inad.percentual > 0.1) {
      alertas.push({
        id: "inadimplencia-alta",
        severidade: "critico",
        titulo: "Inadimplência acima de 10%",
        descricao: `${(inad.percentual * 100).toFixed(1)}% do previsto não foi pago`,
        href: "/financeiro",
      });
    }
  }

  const folhaRatio = await getFolhaRatio(competencia, escolaId);
  if (folhaRatio.ratio > 0.65) {
    alertas.push({
      id: "folha-pesada",
      severidade: "atencao",
      titulo: "Folha acima de 65% da receita",
      descricao: `${(folhaRatio.ratio * 100).toFixed(1)}% comprometido`,
      href: "/rh",
    });
  }

  return alertas.slice(0, 5);
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```
Expected: zero erros.

- [ ] **Step 3: Commit**

```bash
git add src/lib/data/dashboard-executive.ts
git commit -m "feat(dashboard): alertas priorizados por modelo de gestão"
```

---

## Task 10: Componente `delta-badge.tsx`

**Files:**
- Create: `src/components/dashboard/delta-badge.tsx`

- [ ] **Step 1: Implementar**

```tsx
import { TrendingDown, TrendingUp, Minus } from "lucide-react";

type Props = {
  current: number;
  previous: number;
  invert?: boolean; // true quando "menor é melhor" (ex.: despesas)
};

export function DeltaBadge({ current, previous, invert = false }: Props) {
  if (previous === 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-pill bg-muted px-2 py-0.5 text-[0.66rem] font-semibold uppercase tracking-kicker text-ink/55">
        <Minus size={12} /> sem base
      </span>
    );
  }

  const diff = (current - previous) / Math.abs(previous);
  const positive = diff >= 0;
  const good = invert ? !positive : positive;

  const Icon = diff === 0 ? Minus : positive ? TrendingUp : TrendingDown;
  const cls = good
    ? "bg-success/10 text-success"
    : "bg-danger/10 text-danger";

  return (
    <span className={`inline-flex items-center gap-1 rounded-pill px-2 py-0.5 text-[0.66rem] font-semibold uppercase tracking-kicker ${cls}`}>
      <Icon size={12} />
      {positive ? "+" : ""}{(diff * 100).toFixed(1)}%
    </span>
  );
}
```

- [ ] **Step 2: Typecheck + lint**

```bash
npm run typecheck && npm run lint
```
Expected: zero erros.

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/delta-badge.tsx
git commit -m "feat(dashboard): DeltaBadge component"
```

---

## Task 11: Componente `trend-spark.tsx` (SVG sparkline)

**Files:**
- Create: `src/components/dashboard/trend-spark.tsx`

- [ ] **Step 1: Implementar**

```tsx
type Props = {
  values: number[];
  width?: number;
  height?: number;
  className?: string;
};

export function TrendSpark({ values, width = 80, height = 24, className }: Props) {
  if (values.length < 2) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;

  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * width;
      const y = height - ((v - min) / span) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg width={width} height={height} className={className} aria-hidden="true">
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
```

- [ ] **Step 2: Typecheck + lint**

```bash
npm run typecheck && npm run lint
```
Expected: zero erros.

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/trend-spark.tsx
git commit -m "feat(dashboard): TrendSpark SVG sparkline"
```

---

## Task 12: Componente `metric-ring.tsx` (donut SVG)

**Files:**
- Create: `src/components/dashboard/metric-ring.tsx`

- [ ] **Step 1: Implementar**

```tsx
type Props = {
  label: string;
  percent: number; // 0..1
  centerLabel: string;
  centerValue: string;
  variant?: "default" | "warning" | "danger";
};

export function MetricRing({ label, percent, centerLabel, centerValue, variant = "default" }: Props) {
  const size = 120;
  const stroke = 12;
  const radius = (size - stroke) / 2;
  const circ = 2 * Math.PI * radius;
  const filled = circ * Math.min(Math.max(percent, 0), 1);
  const colorClass =
    variant === "danger" ? "text-danger" :
    variant === "warning" ? "text-warning" :
    "text-brand";

  return (
    <article className="rounded-panel bg-surface p-6 shadow-soft">
      <p className="text-[0.66rem] font-bold uppercase tracking-kicker text-ink/55">{label}</p>
      <div className="mt-4 flex items-center gap-4">
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={stroke}
            className="text-muted"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${filled} ${circ - filled}`}
            className={colorClass}
          />
        </svg>
        <div>
          <p className="text-[0.66rem] uppercase tracking-kicker text-ink/55">{centerLabel}</p>
          <strong className="block text-2xl font-bold text-ink">{centerValue}</strong>
        </div>
      </div>
    </article>
  );
}
```

- [ ] **Step 2: Typecheck + lint**

```bash
npm run typecheck && npm run lint
```
Expected: zero erros.

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/metric-ring.tsx
git commit -m "feat(dashboard): MetricRing SVG donut"
```

---

## Task 13: Componente `metric-bar.tsx` (barra com semáforo)

**Files:**
- Create: `src/components/dashboard/metric-bar.tsx`

- [ ] **Step 1: Implementar**

```tsx
type Props = {
  label: string;
  percent: number; // 0..1
  caption: string;
  thresholds?: { warning: number; danger: number }; // defaults para folha/receita
};

export function MetricBar({
  label,
  percent,
  caption,
  thresholds = { warning: 0.5, danger: 0.65 },
}: Props) {
  const pct = Math.min(Math.max(percent, 0), 1);
  const color =
    pct >= thresholds.danger ? "bg-danger" :
    pct >= thresholds.warning ? "bg-warning" :
    "bg-success";

  return (
    <article className="rounded-panel bg-surface p-6 shadow-soft">
      <p className="text-[0.66rem] font-bold uppercase tracking-kicker text-ink/55">{label}</p>
      <strong className="mt-3 block text-3xl font-bold text-ink">
        {(pct * 100).toFixed(1)}%
      </strong>
      <div className="mt-3 h-2 w-full rounded-pill bg-muted">
        <div
          className={`h-2 rounded-pill ${color}`}
          style={{ width: `${pct * 100}%` }}
        />
      </div>
      <p className="mt-2 text-sm text-ink/60">{caption}</p>
    </article>
  );
}
```

- [ ] **Step 2: Typecheck + lint**

```bash
npm run typecheck && npm run lint
```
Expected: zero erros.

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/metric-bar.tsx
git commit -m "feat(dashboard): MetricBar com semáforo"
```

---

## Task 14: Componente `hero-financial.tsx`

**Files:**
- Create: `src/components/dashboard/hero-financial.tsx`

- [ ] **Step 1: Implementar**

```tsx
import { DollarSign, Receipt, Users, TrendingUp } from "lucide-react";
import { money } from "@/lib/constants";
import { DeltaBadge } from "./delta-badge";
import type { HeroData } from "@/lib/data/dashboard-executive";

type CardProps = {
  icon: React.ReactNode;
  label: string;
  value: number;
  previous: number;
  invert?: boolean;
  highlight?: boolean;
};

function HeroCard({ icon, label, value, previous, invert, highlight }: CardProps) {
  const bg = highlight
    ? "bg-brand text-paper"
    : "bg-surface text-ink";
  const labelColor = highlight ? "text-paper/70" : "text-ink/55";
  return (
    <article className={`rounded-panel ${bg} p-6 shadow-soft`}>
      <div className="flex items-center gap-2">
        <span className={`grid h-9 w-9 place-items-center rounded-ui ${highlight ? "bg-paper/15" : "bg-muted text-brand"}`}>
          {icon}
        </span>
        <p className={`text-[0.66rem] font-bold uppercase tracking-kicker ${labelColor}`}>{label}</p>
      </div>
      <strong className="mt-3 block text-3xl font-bold">{money.format(value)}</strong>
      <div className="mt-2">
        <DeltaBadge current={value} previous={previous} invert={invert} />
      </div>
    </article>
  );
}

export function HeroFinancial({ data }: { data: HeroData }) {
  return (
    <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <HeroCard icon={<DollarSign size={16} />} label="Receita" value={data.receita} previous={data.receitaPrev} />
      <HeroCard icon={<Receipt size={16} />} label="Despesas" value={data.despesa} previous={data.despesaPrev} invert />
      <HeroCard icon={<Users size={16} />} label="Folha" value={data.folha} previous={data.folhaPrev} invert />
      <HeroCard icon={<TrendingUp size={16} />} label="Margem" value={data.margem} previous={data.margemPrev} highlight />
    </section>
  );
}
```

- [ ] **Step 2: Typecheck + lint**

```bash
npm run typecheck && npm run lint
```
Expected: zero erros.

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/hero-financial.tsx
git commit -m "feat(dashboard): HeroFinancial (Zona 1)"
```

---

## Task 15: Componente `alert-list.tsx`

**Files:**
- Create: `src/components/dashboard/alert-list.tsx`

- [ ] **Step 1: Implementar**

```tsx
import Link from "next/link";
import { AlertCircle, AlertTriangle, ChevronRight, Info } from "lucide-react";
import type { AlertaItem } from "@/lib/data/dashboard-executive";

const ICONS = {
  critico: AlertCircle,
  atencao: AlertTriangle,
  info: Info,
};

const COLORS = {
  critico: "text-danger bg-danger/10",
  atencao: "text-warning bg-warning/10",
  info: "text-brand bg-brand/10",
};

export function AlertList({ items }: { items: AlertaItem[] }) {
  if (items.length === 0) {
    return (
      <article className="rounded-panel bg-surface p-6 shadow-soft">
        <p className="text-[0.66rem] font-bold uppercase tracking-kicker text-ink/55">Alertas</p>
        <p className="mt-4 text-sm text-ink/60">Sem alertas no momento.</p>
      </article>
    );
  }

  return (
    <article className="rounded-panel bg-surface p-6 shadow-soft">
      <p className="text-[0.66rem] font-bold uppercase tracking-kicker text-ink/55">Alertas</p>
      <ul className="mt-4 grid gap-3">
        {items.map((a) => {
          const Icon = ICONS[a.severidade];
          const Wrapper = a.href ? Link : ("div" as const);
          const wrapperProps = a.href ? { href: a.href } : {};
          return (
            <li key={a.id}>
              <Wrapper
                {...(wrapperProps as any)}
                className="flex items-start gap-3 rounded-ui p-2 hover:bg-muted"
              >
                <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-ui ${COLORS[a.severidade]}`}>
                  <Icon size={14} />
                </span>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-ink">{a.titulo}</p>
                  <p className="text-xs text-ink/60">{a.descricao}</p>
                </div>
                {a.href && <ChevronRight size={14} className="mt-1 text-ink/40" />}
              </Wrapper>
            </li>
          );
        })}
      </ul>
    </article>
  );
}
```

- [ ] **Step 2: Typecheck + lint**

```bash
npm run typecheck && npm run lint
```
Expected: zero erros.

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/alert-list.tsx
git commit -m "feat(dashboard): AlertList (Zona 2 esquerda)"
```

---

## Task 16: Componente `revenue-trend-chart.tsx` (recharts client)

**Files:**
- Create: `src/components/dashboard/revenue-trend-chart.tsx`

- [ ] **Step 1: Implementar**

```tsx
"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { money } from "@/lib/constants";
import type { RevenueTrendPoint } from "@/lib/data/dashboard-executive";

const MESES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

function labelMes(c: string): string {
  const [, m] = c.split("-").map(Number);
  return MESES[(m as number) - 1] ?? c;
}

export function RevenueTrendChart({ data }: { data: RevenueTrendPoint[] }) {
  const chartData = data.map((p) => ({
    mes: labelMes(p.competencia),
    Receita: p.receita,
    Custos: p.custos,
  }));

  return (
    <article className="rounded-panel bg-surface p-6 shadow-soft">
      <p className="text-[0.66rem] font-bold uppercase tracking-kicker text-ink/55">Receita × Custos (6 meses)</p>
      <div className="mt-4 h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="receitaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgb(var(--color-brand))" stopOpacity={0.3} />
                <stop offset="100%" stopColor="rgb(var(--color-brand))" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="custosGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgb(var(--color-danger))" stopOpacity={0.25} />
                <stop offset="100%" stopColor="rgb(var(--color-danger))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgb(var(--color-line))" vertical={false} />
            <XAxis dataKey="mes" stroke="rgb(var(--color-ink) / 0.5)" tickLine={false} axisLine={false} fontSize={12} />
            <YAxis
              stroke="rgb(var(--color-ink) / 0.5)"
              tickLine={false}
              axisLine={false}
              fontSize={12}
              tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`}
            />
            <Tooltip
              formatter={(value: number) => money.format(value)}
              contentStyle={{
                background: "rgb(var(--color-surface))",
                border: "1px solid rgb(var(--color-line))",
                borderRadius: 8,
                fontSize: 12,
              }}
            />
            <Area type="monotone" dataKey="Receita" stroke="rgb(var(--color-brand))" fill="url(#receitaGrad)" strokeWidth={2} />
            <Area type="monotone" dataKey="Custos" stroke="rgb(var(--color-danger))" fill="url(#custosGrad)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </article>
  );
}
```

- [ ] **Step 2: Typecheck + lint**

```bash
npm run typecheck && npm run lint
```
Expected: zero erros.

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/revenue-trend-chart.tsx
git commit -m "feat(dashboard): RevenueTrendChart (recharts area)"
```

---

## Task 17: Componente `ticket-card.tsx`

**Files:**
- Create: `src/components/dashboard/ticket-card.tsx`

- [ ] **Step 1: Implementar**

```tsx
import { money } from "@/lib/constants";
import { TrendSpark } from "./trend-spark";
import type { TicketMedioData } from "@/lib/data/dashboard-executive";

export function TicketCard({ data }: { data: TicketMedioData }) {
  return (
    <article className="rounded-panel bg-surface p-6 shadow-soft">
      <p className="text-[0.66rem] font-bold uppercase tracking-kicker text-ink/55">Ticket Médio</p>
      <strong className="mt-3 block text-3xl font-bold text-ink">{money.format(data.atual)}</strong>
      <div className="mt-3 text-brand">
        <TrendSpark values={data.serie} width={120} height={32} />
      </div>
      <p className="mt-1 text-sm text-ink/60">últimos 6 meses</p>
    </article>
  );
}
```

- [ ] **Step 2: Typecheck + lint**

```bash
npm run typecheck && npm run lint
```
Expected: zero erros.

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/ticket-card.tsx
git commit -m "feat(dashboard): TicketCard com sparkline"
```

---

## Task 18: Componente `repasse-card.tsx`

**Files:**
- Create: `src/components/dashboard/repasse-card.tsx`

- [ ] **Step 1: Implementar**

```tsx
import { Wallet } from "lucide-react";
import { money } from "@/lib/constants";
import { DeltaBadge } from "./delta-badge";
import type { RepasseData } from "@/lib/data/dashboard-executive";

export function RepasseCard({ data }: { data: RepasseData }) {
  return (
    <article className="rounded-panel bg-surface p-6 shadow-soft">
      <div className="flex items-center gap-2">
        <span className="grid h-9 w-9 place-items-center rounded-ui bg-muted text-brand">
          <Wallet size={16} />
        </span>
        <p className="text-[0.66rem] font-bold uppercase tracking-kicker text-ink/55">Repasse recebido</p>
      </div>
      <strong className="mt-3 block text-3xl font-bold text-ink">{money.format(data.valor)}</strong>
      <div className="mt-2">
        <DeltaBadge current={data.valor} previous={data.valorPrev} />
      </div>
      <p className="mt-2 text-sm text-ink/60">no mês corrente</p>
    </article>
  );
}
```

- [ ] **Step 2: Typecheck + lint**

```bash
npm run typecheck && npm run lint
```
Expected: zero erros.

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/repasse-card.tsx
git commit -m "feat(dashboard): RepasseCard (terceirizada)"
```

---

## Task 19: Componente `stage-table.tsx`

**Files:**
- Create: `src/components/dashboard/stage-table.tsx`

- [ ] **Step 1: Implementar**

```tsx
import { money } from "@/lib/constants";
import type { StageBreakdownRow } from "@/lib/data/dashboard-executive";

const LABELS: Record<string, string> = {
  educacao_infantil: "Ed. Infantil",
  fundamental_1: "Fund. I",
  fundamental_2: "Fund. II",
  medio: "Médio",
  outros: "Outros",
};

export function StageTable({ rows }: { rows: StageBreakdownRow[] }) {
  const totalAlunos = rows.reduce((s, r) => s + r.alunos, 0);
  const totalReceita = rows.reduce((s, r) => s + r.receita, 0);
  const ticketMedio = totalAlunos > 0 ? totalReceita / totalAlunos : 0;

  return (
    <article className="rounded-panel bg-surface p-6 shadow-soft">
      <p className="text-[0.66rem] font-bold uppercase tracking-kicker text-ink/55">Detalhamento por etapa</p>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[0.66rem] uppercase tracking-kicker text-ink/55">
              <th className="px-2 py-2 text-left">Etapa</th>
              <th className="px-2 py-2 text-right">Alunos</th>
              <th className="px-2 py-2 text-right">Receita</th>
              <th className="px-2 py-2 text-right">Ticket</th>
              <th className="px-2 py-2 text-right">Ocupação</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.etapa} className="border-t border-line">
                <td className="px-2 py-2 font-medium text-ink">{LABELS[r.etapa] ?? r.etapa}</td>
                <td className="px-2 py-2 text-right">{r.alunos}</td>
                <td className="px-2 py-2 text-right">{money.format(r.receita)}</td>
                <td className="px-2 py-2 text-right">{money.format(r.ticket)}</td>
                <td className="px-2 py-2 text-right">{(r.ocupacao * 100).toFixed(0)}%</td>
              </tr>
            ))}
            <tr className="border-t border-line font-semibold">
              <td className="px-2 py-2">Total</td>
              <td className="px-2 py-2 text-right">{totalAlunos}</td>
              <td className="px-2 py-2 text-right">{money.format(totalReceita)}</td>
              <td className="px-2 py-2 text-right">{money.format(ticketMedio)}</td>
              <td className="px-2 py-2 text-right">—</td>
            </tr>
          </tbody>
        </table>
      </div>
    </article>
  );
}
```

- [ ] **Step 2: Typecheck + lint**

```bash
npm run typecheck && npm run lint
```
Expected: zero erros.

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/stage-table.tsx
git commit -m "feat(dashboard): StageTable (Zona 4)"
```

---

## Task 20: Componentes `top-devedores.tsx` + `renovacoes-pendentes.tsx`

**Files:**
- Create: `src/components/dashboard/top-devedores.tsx`
- Create: `src/components/dashboard/renovacoes-pendentes.tsx`

- [ ] **Step 1: Implementar `top-devedores.tsx`**

```tsx
import { money } from "@/lib/constants";
import type { DevedorRow } from "@/lib/data/dashboard-executive";

export function TopDevedores({ items }: { items: DevedorRow[] }) {
  return (
    <article className="rounded-panel bg-surface p-6 shadow-soft">
      <p className="text-[0.66rem] font-bold uppercase tracking-kicker text-ink/55">Top devedores</p>
      {items.length === 0 ? (
        <p className="mt-4 text-sm text-ink/60">Sem inadimplência registrada.</p>
      ) : (
        <ul className="mt-4 grid gap-3">
          {items.map((d) => (
            <li key={d.alunoId} className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink">{d.nome}</p>
                <p className="text-xs text-ink/55">{d.diasVencimento} dias em atraso</p>
              </div>
              <span className="text-sm font-bold text-danger">{money.format(d.valor)}</span>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
```

- [ ] **Step 2: Implementar `renovacoes-pendentes.tsx`**

```tsx
import type { RenovacaoRow } from "@/lib/data/dashboard-executive";

export function RenovacoesPendentes({ items }: { items: RenovacaoRow[] }) {
  return (
    <article className="rounded-panel bg-surface p-6 shadow-soft">
      <p className="text-[0.66rem] font-bold uppercase tracking-kicker text-ink/55">Renovações pendentes</p>
      {items.length === 0 ? (
        <p className="mt-4 text-sm text-ink/60">Nenhuma matrícula ativa no ano corrente.</p>
      ) : (
        <ul className="mt-4 grid gap-3">
          {items.map((r) => (
            <li key={r.matriculaId} className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink">{r.alunoNome}</p>
                <p className="text-xs text-ink/55">Ano letivo {r.anoLetivo}</p>
              </div>
              <span className="text-sm font-semibold text-warning">{r.diasRestantes}d</span>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
```

- [ ] **Step 3: Typecheck + lint**

```bash
npm run typecheck && npm run lint
```
Expected: zero erros.

- [ ] **Step 4: Commit**

```bash
git add src/components/dashboard/top-devedores.tsx src/components/dashboard/renovacoes-pendentes.tsx
git commit -m "feat(dashboard): TopDevedores + RenovacoesPendentes"
```

---

## Task 21: Componente `folha-empresas.tsx`

**Files:**
- Create: `src/components/dashboard/folha-empresas.tsx`

- [ ] **Step 1: Implementar**

```tsx
import { money } from "@/lib/constants";
import type { FolhaEmpresaRow } from "@/lib/data/dashboard-executive";

export function FolhaEmpresas({ items }: { items: FolhaEmpresaRow[] }) {
  const totalBruto = items.reduce((s, r) => s + r.bruto, 0);

  return (
    <article className="rounded-panel bg-surface p-6 shadow-soft">
      <p className="text-[0.66rem] font-bold uppercase tracking-kicker text-ink/55">Folha por empresa</p>
      {items.length === 0 ? (
        <p className="mt-4 text-sm text-ink/60">Sem folha processada neste mês.</p>
      ) : (
        <ul className="mt-4 grid gap-4">
          {items.map((r) => {
            const pct = totalBruto > 0 ? (r.bruto / totalBruto) * 100 : 0;
            return (
              <li key={r.empresaId}>
                <div className="flex items-baseline justify-between">
                  <p className="text-sm font-semibold text-ink">{r.empresa}</p>
                  <span className="text-xs text-ink/55">{r.headcount} func · {pct.toFixed(1)}%</span>
                </div>
                <div className="mt-2 h-2 w-full rounded-pill bg-muted">
                  <div className="h-2 rounded-pill bg-brand" style={{ width: `${pct}%` }} />
                </div>
                <dl className="mt-2 grid grid-cols-4 gap-2 text-xs">
                  <div><dt className="text-ink/55">Bruto</dt><dd className="font-semibold">{money.format(r.bruto)}</dd></div>
                  <div><dt className="text-ink/55">INSS</dt><dd className="font-semibold">{money.format(r.inss)}</dd></div>
                  <div><dt className="text-ink/55">IRRF</dt><dd className="font-semibold">{money.format(r.irrf)}</dd></div>
                  <div><dt className="text-ink/55">Líquido</dt><dd className="font-semibold">{money.format(r.liquido)}</dd></div>
                </dl>
              </li>
            );
          })}
        </ul>
      )}
    </article>
  );
}
```

- [ ] **Step 2: Typecheck + lint**

```bash
npm run typecheck && npm run lint
```
Expected: zero erros.

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/folha-empresas.tsx
git commit -m "feat(dashboard): FolhaEmpresas (Zona 5 direita)"
```

---

## Task 22: Reescrever `page.tsx` com composição condicional

**Files:**
- Modify: `src/app/(app)/page.tsx`
- Delete: `src/components/dashboard/finance-chart.tsx`
- Delete: `src/lib/data/dashboard.ts`

- [ ] **Step 1: Reescrever `src/app/(app)/page.tsx`**

```tsx
import { Download, Plus, Upload } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { requireSession } from "@/lib/auth/session";
import {
  currentCompetencia,
  getAlertas,
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

      <section className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
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
```

- [ ] **Step 2: Deletar arquivos substituídos**

```bash
git rm src/components/dashboard/finance-chart.tsx src/lib/data/dashboard.ts
```

- [ ] **Step 3: Typecheck + lint**

```bash
npm run typecheck && npm run lint
```
Expected: zero erros. Se algum import órfão de `dashboard.ts` aparecer em outro arquivo, corrigir e listar aqui antes de commit.

- [ ] **Step 4: Visual smoke — terceirizada (RRB)**

```bash
npm run dev
```

Abrir `http://localhost:3000` logado em escola com `gestao_financeira = 'terceirizada'` (RRB). Conferir:
- Zona 1: 4 cards Hero (Receita, Despesas, Folha, Margem com destaque)
- Zona 2: Alertas + gráfico tendência 6m
- Zona 3: Ocupação donut, **RepasseCard** (não inadimplência), Folha/Receita barra, Ticket sparkline
- Zona 4: tabela por etapa com totais
- Zona 5: **RenovacoesPendentes** (não Top devedores), Folha por empresa

- [ ] **Step 5: Visual smoke — propria**

Via Supabase Studio, alterar temporariamente:
```sql
update escolas set gestao_financeira = 'propria' where id = '00000000-0000-0000-0000-000000000001';
```

Recarregar dashboard. Conferir:
- Zona 3 slot 2: **MetricRing Inadimplência** aparece (no lugar de RepasseCard)
- Zona 5 esquerda: **TopDevedores** aparece (no lugar de RenovacoesPendentes)

Reverter:
```sql
update escolas set gestao_financeira = 'terceirizada' where id = '00000000-0000-0000-0000-000000000001';
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(dashboard): página executiva com branch propria/terceirizada"
```

---

## Self-Review (já executado)

**Spec coverage:**
- Migration + seed RRB → Task 1 ✓
- `getEscolaConfig` → Task 2 ✓
- Hero financeiro + delta → Tasks 3, 14 ✓
- Tendência 6m → Tasks 4, 16 ✓
- Ocupação / Inadimplência / Folha-Receita / Ticket → Tasks 5, 6, 7, 12, 13, 17 ✓
- Detalhamento etapa → Tasks 5, 19 ✓
- Top devedores / Renovações → Tasks 7, 8, 20 ✓
- Folha por empresa → Tasks 6, 21 ✓
- Alertas → Tasks 9, 15 ✓
- Branch propria/terceirizada na página → Task 22 ✓
- Remover `finance-chart.tsx` + `dashboard.ts` → Task 22 ✓
- Critério de pronto (typecheck, lint, ambos modelos) → Task 22 steps 3-5 ✓

**Type consistency:** Tipos exportados em `dashboard-executive.ts` (`HeroData`, `RevenueTrendPoint`, `OcupacaoData`, `StageBreakdownRow`, `TicketMedioData`, `FolhaRatioData`, `FolhaEmpresaRow`, `InadimplenciaData`, `DevedorRow`, `RepasseData`, `RenovacaoRow`, `AlertaItem`, `EscolaConfig`, `GestaoFinanceira`) usados consistentemente em todos os componentes.

**Riscos conhecidos a validar durante execução:**
- Nome real da coluna de segmento em `series` (Task 5 step 1 valida)
- Nome real da tabela de folha (`payroll_runs`?) e colunas de totais (Task 3 step 2 valida; Task 6 step 1 confirma)
- Tabela `despesas` ter colunas `valor` + `competencia` (Task 3 step 2 valida)
- Schema de `escolas.gestao_financeira` aplicar com sucesso em Supabase remoto (Task 1 step 2)
