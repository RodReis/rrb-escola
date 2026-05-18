# Year Picker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ativar o seletor de ano letivo na topbar, sincronizando `?ano=` e `?competencia=` na URL para que dashboard e organograma respondam ao ano selecionado.

**Architecture:** URL como fonte de verdade (`?ano=2026&competencia=2026-05`). AppLayout busca anos disponíveis do DB e passa para Topbar. Client Component `<AnoLetivoPicker>` substitui botão estático. Data layer ganha parâmetro `anoLetivo` com default em todas as funções que antes usavam `new Date().getFullYear()` fixo.

**Tech Stack:** Next.js 14 App Router (Server + Client Components), TypeScript, Supabase, Tailwind, lucide-react.

**Spec:** `docs/superpowers/specs/2026-05-18-year-picker-design.md`

**Validation:** `npm run typecheck && npm run lint`. Erro pré-existente `student-edit-tabs` OK.

---

## File Structure

**Criar:**
- `src/components/layout/ano-letivo-picker.tsx` — Client Component seletor de ano

**Modificar:**
- `src/lib/data/dashboard-executive.ts` — 9 funções ganham parâmetro `anoLetivo`
- `src/lib/data/organograma.ts` — `getOrganogramaTree` + `getOrganogramaDrill` param `anoLetivo`
- `src/components/layout/topbar.tsx` — recebe `anosLetivos`, renderiza `<AnoLetivoPicker>`
- `src/app/(app)/layout.tsx` — busca anos disponíveis, passa para Topbar
- `src/app/(app)/page.tsx` — lê `?ano`, passa para funções parametrizadas
- `src/app/(app)/organograma/page.tsx` — lê `?ano`, passa para funções

---

## Task 1: Parametrizar data layer — `getOcupacao` e `getStageBreakdown`

**Files:**
- Modify: `src/lib/data/dashboard-executive.ts:278-350` e `352-392`

- [ ] **Step 1: Atualizar `getOcupacao`**

Localize linha 278. Substitua a assinatura e a linha `const anoLetivo = new Date().getFullYear();` dentro da função:

```typescript
export async function getOcupacao(
  escolaId: string = DEFAULT_SCHOOL_ID,
  anoLetivo: number = new Date().getFullYear()
): Promise<OcupacaoData> {
  const supabase = await createServerClient();
  // remover: const anoLetivo = new Date().getFullYear();
```

- [ ] **Step 2: Atualizar `getStageBreakdown`**

Localize linha 352. Substitua assinatura:

```typescript
export async function getStageBreakdown(
  competencia: string,
  escolaId: string = DEFAULT_SCHOOL_ID,
  anoLetivo: number = new Date().getFullYear()
): Promise<StageBreakdownRow[]> {
```

Dentro da função, `getStageBreakdown` chama `getOcupacao(escolaId)` — atualizar para `getOcupacao(escolaId, anoLetivo)`.

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck 2>&1 | grep -v "student-edit-tabs" | tail -20
```

Expected: sem novos erros.

- [ ] **Step 4: Commit**

```bash
git add src/lib/data/dashboard-executive.ts
git commit -m "feat(dashboard): getOcupacao + getStageBreakdown aceitam anoLetivo param"
```

---

## Task 2: Parametrizar `getBeneficios`, `getAlertas`, `getFrequenciaResumo`

**Files:**
- Modify: `src/lib/data/dashboard-executive.ts`

- [ ] **Step 1: Atualizar `getBeneficios` (linha 763)**

```typescript
export async function getBeneficios(
  escolaId: string = DEFAULT_SCHOOL_ID,
  anoLetivo: number = new Date().getFullYear()
): Promise<BeneficiosData> {
  const supabase = await createServerClient();
  // remover: const anoLetivo = new Date().getFullYear();
```

- [ ] **Step 2: Atualizar `getAlertas` (linha 710)**

```typescript
export async function getAlertas(
  competencia: string,
  gestaoFinanceira: GestaoFinanceira,
  escolaId: string = DEFAULT_SCHOOL_ID,
  anoLetivo: number = new Date().getFullYear()
): Promise<AlertaItem[]> {
  // remover: const anoLetivo = hoje.getFullYear(); (ou new Date().getFullYear())
```

- [ ] **Step 3: Atualizar `getFrequenciaResumo` (linha 840)**

```typescript
export async function getFrequenciaResumo(
  escolaId: string = DEFAULT_SCHOOL_ID,
  days: number = 30,
  anoLetivo: number = new Date().getFullYear()
): Promise<FrequenciaResumo> {
  // remover: const anoLetivo = new Date().getFullYear(); se existir
```

- [ ] **Step 4: Typecheck**

```bash
npm run typecheck 2>&1 | grep -v "student-edit-tabs" | tail -20
```

Expected: sem novos erros.

- [ ] **Step 5: Commit**

```bash
git add src/lib/data/dashboard-executive.ts
git commit -m "feat(dashboard): getBeneficios + getAlertas + getFrequenciaResumo aceitam anoLetivo"
```

---

## Task 3: Parametrizar `getRankingTurmas`, `getFrequenciaPorTurma`, `getAniversariantesMatricula`, `getRealizadoVsProjetado`

**Files:**
- Modify: `src/lib/data/dashboard-executive.ts`

- [ ] **Step 1: Atualizar `getRankingTurmas` (linha 956)**

```typescript
export async function getRankingTurmas(
  escolaId: string = DEFAULT_SCHOOL_ID,
  limit: number = 10,
  anoLetivo: number = new Date().getFullYear()
): Promise<TurmaRankingRow[]> {
  // remover: const anoLetivo = new Date().getFullYear();
```

- [ ] **Step 2: Atualizar `getFrequenciaPorTurma` (linha 1145)**

```typescript
export async function getFrequenciaPorTurma(
  escolaId: string = DEFAULT_SCHOOL_ID,
  days: number = 30,
  anoLetivo: number = new Date().getFullYear()
): Promise<FrequenciaPorTurmaRow[]> {
  // remover: const anoLetivo = hoje.getFullYear();
```

- [ ] **Step 3: Atualizar `getAniversariantesMatricula` (linha 1293)**

```typescript
export async function getAniversariantesMatricula(
  escolaId: string = DEFAULT_SCHOOL_ID,
  limit: number = 10,
  anoLetivo: number = new Date().getFullYear()
): Promise<AniversarioMatriculaRow[]> {
  // remover: const anoLetivo = new Date().getFullYear();
```

- [ ] **Step 4: Atualizar `getRealizadoVsProjetado` (linha 1067)**

```typescript
export async function getRealizadoVsProjetado(
  competencia: string,
  escolaId: string = DEFAULT_SCHOOL_ID,
  anoLetivo: number = new Date().getFullYear()
): Promise<RealizadoVsProjetadoData> {
  // remover: const anoLetivo = Number(competencia.split("-")[0]);
  // ATENÇÃO: esta função derivava anoLetivo da competencia — agora usa o parâmetro explícito
```

- [ ] **Step 5: Typecheck**

```bash
npm run typecheck 2>&1 | grep -v "student-edit-tabs" | tail -20
```

Expected: sem novos erros.

- [ ] **Step 6: Commit**

```bash
git add src/lib/data/dashboard-executive.ts
git commit -m "feat(dashboard): getRankingTurmas + getFrequenciaPorTurma + getAniversariantesMatricula + getRealizadoVsProjetado aceitam anoLetivo"
```

---

## Task 4: Parametrizar organograma

**Files:**
- Modify: `src/lib/data/organograma.ts`

- [ ] **Step 1: Atualizar `getOrganogramaTree`**

Localize função. Substitua assinatura e todas as ocorrências de `.eq("ano_letivo", 2026)`:

```typescript
export async function getOrganogramaTree(
  anoLetivo: number = new Date().getFullYear()
) {
  // ...
  // substituir todas as .eq("ano_letivo", 2026) por .eq("ano_letivo", anoLetivo)
```

- [ ] **Step 2: Atualizar `getOrganogramaDrill`**

```typescript
export async function getOrganogramaDrill(
  turmaId: string,
  anoLetivo: number = new Date().getFullYear()
) {
  // substituir .eq("ano_letivo", 2026) por .eq("ano_letivo", anoLetivo)
```

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck 2>&1 | grep -v "student-edit-tabs" | tail -20
```

Expected: sem novos erros.

- [ ] **Step 4: Commit**

```bash
git add src/lib/data/organograma.ts
git commit -m "feat(organograma): getOrganogramaTree + getOrganogramaDrill aceitam anoLetivo param"
```

---

## Task 5: Componente `<AnoLetivoPicker>`

**Files:**
- Create: `src/components/layout/ano-letivo-picker.tsx`

- [ ] **Step 1: Criar componente**

```tsx
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ChevronDown } from "lucide-react";

export function AnoLetivoPicker({ anos }: { anos: number[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const current = Number(searchParams.get("ano")) || new Date().getFullYear();

  function handleChange(ano: number) {
    const sp = new URLSearchParams(searchParams.toString());
    sp.set("ano", String(ano));
    sp.set("competencia", `${ano}-01`);
    router.push(`/?${sp.toString()}`);
  }

  return (
    <div className="relative inline-flex items-center gap-1.5 h-[30px] px-2.5 rounded-[7px] text-[11.5px] font-medium text-white/70 bg-white/10 border border-white/[0.12]">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
        <line x1="16" y1="2" x2="16" y2="6"/>
        <line x1="8" y1="2" x2="8" y2="6"/>
        <line x1="3" y1="10" x2="21" y2="10"/>
      </svg>
      <select
        value={current}
        onChange={(e) => handleChange(Number(e.target.value))}
        className="appearance-none bg-transparent text-white font-semibold focus:outline-none cursor-pointer pr-4"
      >
        {anos.map((ano) => (
          <option key={ano} value={ano} className="bg-[#1B3FB8] text-white">
            {ano}
          </option>
        ))}
      </select>
      <ChevronDown size={10} className="pointer-events-none absolute right-2 text-white/70" />
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck 2>&1 | grep -v "student-edit-tabs" | tail -10
```

Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/ano-letivo-picker.tsx
git commit -m "feat(topbar): AnoLetivoPicker client component"
```

---

## Task 6: Atualizar `AppLayout` e `Topbar`

**Files:**
- Modify: `src/app/(app)/layout.tsx`
- Modify: `src/components/layout/topbar.tsx`

- [ ] **Step 1: Atualizar `AppLayout` para buscar anos disponíveis**

```typescript
import { Topbar } from "@/components/layout/topbar";
import { requireSession } from "@/lib/auth/session";
import { runDailyNotifications } from "@/lib/server/notify-daily";
import { createServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  runDailyNotifications(session.profile.escola_id).catch(() => {});

  const supabase = await createServerClient();
  const { data: anosData } = await supabase
    .from("turmas")
    .select("ano_letivo")
    .eq("escola_id", session.profile.escola_id)
    .eq("ativo", true);

  const anosSet = new Set<number>();
  for (const row of anosData ?? []) {
    if (row.ano_letivo) anosSet.add(Number(row.ano_letivo));
  }
  const anosLetivos = Array.from(anosSet).sort((a, b) => b - a);
  if (anosLetivos.length === 0) anosLetivos.push(new Date().getFullYear());

  return (
    <div className="ds-shell">
      <Topbar perfil={session.profile} anosLetivos={anosLetivos} />
      <main>
        <div className="mx-auto min-h-[calc(100vh-72px)] max-w-7xl px-4 py-6 sm:px-6 lg:px-8">{children}</div>
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Atualizar `Topbar` para aceitar `anosLetivos` e renderizar `<AnoLetivoPicker>`**

Localize a assinatura da função `Topbar` e a prop type:

```typescript
import { AnoLetivoPicker } from "@/components/layout/ano-letivo-picker";

// Atualizar assinatura:
export async function Topbar({ perfil, anosLetivos }: { perfil: SessionProfile; anosLetivos: number[] }) {
```

Localize o bloco `{/* Year picker */}` e substitua o `<button>` estático por:

```tsx
<AnoLetivoPicker anos={anosLetivos} />
```

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck 2>&1 | grep -v "student-edit-tabs" | tail -20
```

Expected: sem novos erros.

- [ ] **Step 4: Commit**

```bash
git add src/app/(app)/layout.tsx src/components/layout/topbar.tsx src/components/layout/ano-letivo-picker.tsx
git commit -m "feat(topbar): year picker funcional com anos do DB"
```

---

## Task 7: Atualizar `page.tsx` do dashboard

**Files:**
- Modify: `src/app/(app)/page.tsx`

- [ ] **Step 1: Adicionar `ano` em `searchParams` e helper de validação**

Localize o topo da função `DashboardPage` e adicione lógica de leitura do ano:

```typescript
// No início da função, após ler params.competencia:
const anoParam = params.ano ? Number(params.ano) : null;
const anoLetivo = anoParam && Number.isInteger(anoParam) && anoParam >= 2000 && anoParam <= 2100
  ? anoParam
  : new Date().getFullYear();
```

Atualizar type de `searchParams`:

```typescript
searchParams: Promise<{ aba?: string; competencia?: string; ano?: string }>;
```

- [ ] **Step 2: Passar `anoLetivo` para todas as funções parametrizadas**

No `Promise.all`, atualizar cada chamada:

```typescript
getOcupacao(escolaId, anoLetivo),
getStageBreakdown(competencia, escolaId, anoLetivo),
getAlertas(competencia, config.gestaoFinanceira, escolaId, anoLetivo),
getBeneficios(escolaId, anoLetivo),
getFrequenciaResumo(escolaId, 30, anoLetivo),
getRankingTurmas(escolaId, 10, anoLetivo),
getTopCategoriasDespesas(competencia, escolaId, 6),   // sem anoLetivo — usa competencia
getRealizadoVsProjetado(competencia, escolaId, anoLetivo),
getFrequenciaPorTurma(escolaId, 30, anoLetivo),
getAniversariantesMatricula(escolaId, 10, anoLetivo),
getSaldoYTD(escolaId, anoLetivo),
```

Funções que **não** recebem anoLetivo (financeiro puro derivado de `competencia`): `getHero`, `getRevenueTrend`, `getTicketMedio`, `getFolhaRatio`, `getFolhaPorEmpresa`, `getInadimplencia`, `getTopDevedores`, `getRepasseRecebido`, `getRenovacoesPendentes`, `getProximasCobrancas`, `getSaudeSistema`.

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck 2>&1 | grep -v "student-edit-tabs" | tail -20
```

Expected: sem novos erros.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/page.tsx"
git commit -m "feat(dashboard): lê ?ano= e passa anoLetivo para todas as queries"
```

---

## Task 8: Atualizar página do organograma

**Files:**
- Modify: `src/app/(app)/organograma/page.tsx`

- [ ] **Step 1: Ler `?ano` e passar para as funções**

Localize `searchParams` na função. Adicionar `ano?: string`:

```typescript
export default async function OrganogramaPage({
  searchParams
}: {
  searchParams: Promise<{ turma?: string; ano?: string }>;
}) {
  const params = await searchParams;
  const turmaId = params.turma ?? null;
  const anoParam = params.ano ? Number(params.ano) : null;
  const anoLetivo = anoParam && Number.isInteger(anoParam) && anoParam >= 2000 && anoParam <= 2100
    ? anoParam
    : new Date().getFullYear();

  const [{ tree, totalAlunos }, drillData] = await Promise.all([
    getOrganogramaTree(anoLetivo),
    turmaId
      ? getOrganogramaDrill(turmaId, anoLetivo)
      : Promise.resolve({ turma: null, alunos: [], somaSala: 0, ticketMedio: 0, competencia: "" })
  ]);
```

- [ ] **Step 2: Typecheck + lint**

```bash
npm run typecheck && npm run lint 2>&1 | grep -v "student-edit-tabs" | tail -20
```

Expected: limpo.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(app)/organograma/page.tsx"
git commit -m "feat(organograma): lê ?ano= para filtrar por ano letivo"
```

---

## Task 9: Smoke test manual

**Files:** nenhum

- [ ] **Step 1: Subir dev server**

```bash
npm run dev
```

- [ ] **Step 2: Verificar picker na topbar**

Abrir `http://localhost:3000`. Confirmar:
- Botão de ano mostra o ano atual (ex: `2026`) com chevron clicável
- Clicar no select mostra lista de anos do DB (ex: `2026`, `2025`)

- [ ] **Step 3: Mudar para 2025**

Selecionar `2025`. Confirmar:
- URL muda para `/?ano=2025&competencia=2025-01`
- `CompetenciaPicker` salta para `Jan/2025`
- Cards de ocupação/matrículas mudam (2025 tem números diferentes de 2026)
- StageTable mostra turmas/bolsistas de 2025

- [ ] **Step 4: Verificar organograma**

Navegar para `http://localhost:3000/organograma?ano=2025`. Confirmar:
- Sidebar carrega com turmas de 2025 (ou vazio se não houver)

- [ ] **Step 5: Verificar fallback**

Navegar para `http://localhost:3000/?ano=abc`. Confirmar:
- Dashboard funciona normalmente com ano atual (fallback)

---

## Self-Review

**Spec coverage:**
- `<AnoLetivoPicker>` client component → Task 5 ✓
- AppLayout busca anos do DB → Task 6 ✓
- Topbar substitui botão estático → Task 6 ✓
- Mudar ano seta `competencia={ano}-01` → Task 5 (no `handleChange`) ✓
- 9 funções data layer ganham `anoLetivo` param → Tasks 1-3 ✓
- Organograma parametrizado → Task 4 ✓
- Dashboard `page.tsx` lê `?ano` → Task 7 ✓
- Organograma `page.tsx` lê `?ano` → Task 8 ✓
- Fallback para ano atual se inválido → Tasks 6, 7, 8 ✓
- `getSaldoYTD` já tem param, só precisava ser passado → Task 7 ✓

**Type consistency:**
- `anoLetivo: number = new Date().getFullYear()` — padrão uniforme em todas as funções ✓
- `AnoLetivoPicker` recebe `anos: number[]` (sem `current` — lê da URL via `useSearchParams`) ✓
- `Topbar` ganha `anosLetivos: number[]` na prop type ✓
- `searchParams` em page.tsx e organograma ganham `ano?: string` ✓

**Riscos:**
- `getRealizadoVsProjetado` antes derivava `anoLetivo` de `competencia`. Agora usa parâmetro explícito. Se chamado sem `ano` mas com `competencia=2025-06`, o anoLetivo default será `new Date().getFullYear()` (2026), divergindo da competencia. Mitigação: no `page.tsx` sempre passamos `anoLetivo` explícito derivado de `?ano`, que está sincronizado com `competencia`. Para callers externos (sem `?ano`), o comportamento anterior era derivar da competencia — agora usa ano atual. Aceitável para fase 1.
