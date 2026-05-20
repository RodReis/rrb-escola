# Tipo de Vaga (Bolsa/Permuta) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Modelar alunos com benefício (bolsa, permuta, gratuidade) sem gerar cobrança, mantendo-os contados em vagas/ocupação. Refletir no dashboard.

**Architecture:** Adiciona enum `tipo_vaga` + colunas em `matriculas` via migration. Backfill reclassifica 33 alunos `concluida` para `ativa+bolsa_integral`. Data layer ganha `getBeneficios`, `OcupacaoData` ganha `bolsistas` por etapa, `getStageBreakdown` ganha coluna `bolsistas`, `getTicketMedio` usa denominador pagantes. UI: `BeneficiosCard` novo + coluna Bolsistas em `StageTable`.

**Tech Stack:** PostgreSQL (Supabase), Next.js 14 RSC, TypeScript, Tailwind, lucide-react.

**Spec:** `docs/superpowers/specs/2026-05-17-tipo-vaga-bolsa-permuta-design.md`

**Validation:** sem testes automáticos. Cada task termina com `npm run typecheck && npm run lint`. Erro pré-existente permitido: `src/app/(app)/alunos/[id]/editar/page.tsx` (`student-edit-tabs`).

---

## File Structure

**Criar:**
- `supabase/migrations/202605280003_tipo_vaga.sql` — enum + colunas + constraint
- `supabase/migrations/202605280004_backfill_bolsistas.sql` — reclassifica 33 alunos
- `src/components/dashboard/beneficios-card.tsx` — card Benefícios concedidos

**Modificar:**
- `src/lib/data/dashboard-executive.ts` — `getOcupacao` (add bolsistas/pagantes/beneficiados), `getStageBreakdown` (add bolsistas), `getTicketMedio` (denominador pagantes), novo `getBeneficios`
- `src/components/dashboard/stage-table.tsx` — coluna Bolsistas
- `src/app/(app)/page.tsx` — adicionar `BeneficiosCard` na Zona 3

---

## Task 1: Migration — enum `tipo_vaga` + colunas em `matriculas`

**Files:**
- Create: `supabase/migrations/202605280003_tipo_vaga.sql`

- [ ] **Step 1: Escrever migration**

```sql
-- Tipo de vaga: classifica matrículas pagantes vs beneficiadas

create type tipo_vaga as enum (
  'paga',
  'bolsa_integral',
  'bolsa_parcial',
  'permuta',
  'gratuita'
);

alter table matriculas
  add column tipo_vaga tipo_vaga not null default 'paga',
  add column percentual_bolsa numeric(5,2) not null default 0
    check (percentual_bolsa >= 0 and percentual_bolsa <= 100);

alter table matriculas
  add constraint matriculas_percentual_bolsa_check
  check (
    (tipo_vaga = 'bolsa_parcial' and percentual_bolsa > 0 and percentual_bolsa < 100)
    or (tipo_vaga <> 'bolsa_parcial' and percentual_bolsa = 0)
  );

comment on column matriculas.tipo_vaga is
  'paga | bolsa_integral | bolsa_parcial | permuta | gratuita';
comment on column matriculas.percentual_bolsa is
  '0-100; apenas válido quando tipo_vaga=bolsa_parcial';
```

- [ ] **Step 2: Aplicar**

```bash
npx supabase migration up
```
Expected: `Applying migration 202605280003_tipo_vaga.sql... Local database is up to date.`

- [ ] **Step 3: Smoke SQL**

```bash
docker exec supabase_db_rrb-escola psql -U postgres -d postgres -c "\d matriculas" | grep -E "tipo_vaga|percentual_bolsa"
```
Expected: vê `tipo_vaga | tipo_vaga` e `percentual_bolsa | numeric(5,2)`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/202605280003_tipo_vaga.sql
git commit -m "feat(matriculas): enum tipo_vaga + percentual_bolsa"
```

---

## Task 2: Backup pré-backfill

**Files:**
- nenhum (apenas dump local)

- [ ] **Step 1: Backup completo do DB local**

```bash
docker exec supabase_db_rrb-escola pg_dump -U postgres -d postgres -t matriculas --data-only > backups/matriculas_pre_backfill_2026-05-17.sql
```

Se diretório `backups/` não existir, criar primeiro:
```bash
mkdir -p backups
```

Expected: arquivo `backups/matriculas_pre_backfill_2026-05-17.sql` criado com INSERTs de todas matrículas.

- [ ] **Step 2: Verificar backup**

```bash
wc -l backups/matriculas_pre_backfill_2026-05-17.sql
```
Expected: contém centenas de linhas (todas matrículas).

- [ ] **Step 3: Commit (sem o backup — backups ficam locais)**

Adicionar ao `.gitignore` se não estiver:
```bash
grep -q "^backups/" .gitignore || echo "backups/" >> .gitignore
git add .gitignore
git commit -m "chore: ignora pasta backups/"
```

Se `.gitignore` já tem `backups/`, pular o commit.

---

## Task 3: Migration — backfill 33 alunos `concluida` → `ativa+bolsa_integral`

**Files:**
- Create: `supabase/migrations/202605280004_backfill_bolsistas.sql`

- [ ] **Step 1: Validar contagem prevista antes**

```bash
docker exec supabase_db_rrb-escola psql -U postgres -d postgres -c "
select count(*) as candidatos
from (
  select distinct on (m.aluno_id) m.id
  from matriculas m
  where m.escola_id = '00000000-0000-0000-0000-000000000001'
    and m.status = 'concluida'
    and not exists (
      select 1 from matriculas mx
      where mx.aluno_id = m.aluno_id and mx.status = 'ativa'
    )
  order by m.aluno_id, m.created_at desc
) t;
"
```
Expected: `candidatos = 33`. Se diferente, **parar e investigar** antes de aplicar migration.

- [ ] **Step 2: Escrever migration**

```sql
-- Reclassifica alunos que estavam como 'concluida' mas conceitualmente são ativos sem cobrança.
-- Default: bolsa_integral (refinar caso-a-caso via UI depois).
-- Critério: aluno SEM matrícula ativa MAS com matrícula concluida — toma a mais recente.

with bolsistas_candidatos as (
  select distinct on (m.aluno_id) m.id
  from matriculas m
  where m.escola_id = '00000000-0000-0000-0000-000000000001'
    and m.status = 'concluida'
    and not exists (
      select 1 from matriculas mx
      where mx.aluno_id = m.aluno_id and mx.status = 'ativa'
    )
  order by m.aluno_id, m.created_at desc
)
update matriculas
  set status = 'ativa', tipo_vaga = 'bolsa_integral'
  where id in (select id from bolsistas_candidatos);
```

- [ ] **Step 3: Aplicar**

```bash
npx supabase migration up
```
Expected: migration aplicada.

- [ ] **Step 4: Smoke SQL pós-backfill**

```bash
docker exec supabase_db_rrb-escola psql -U postgres -d postgres -c "
select status, tipo_vaga, count(*)
from matriculas
where escola_id = '00000000-0000-0000-0000-000000000001'
group by status, tipo_vaga
order by status, tipo_vaga;
"
```
Expected:
- `ativa | paga | 475`
- `ativa | bolsa_integral | 33`
- `concluida | paga | 2091` (era 2124 antes; perdeu 33)

Total ativas = 508.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/202605280004_backfill_bolsistas.sql
git commit -m "feat(matriculas): backfill 33 bolsistas (concluida -> ativa+bolsa_integral)"
```

---

## Task 4: Atualizar `getOcupacao` (pagantes/beneficiados/bolsistas por etapa)

**Files:**
- Modify: `src/lib/data/dashboard-executive.ts`

- [ ] **Step 1: Adicionar tipo TipoVaga (no topo dos tipos)**

Logo após `export type GestaoFinanceira` adicionar:

```typescript
export type TipoVaga = 'paga' | 'bolsa_integral' | 'bolsa_parcial' | 'permuta' | 'gratuita';

const BENEFICIARIO_TIPOS: TipoVaga[] = ['bolsa_integral', 'bolsa_parcial', 'permuta', 'gratuita'];
```

- [ ] **Step 2: Atualizar `OcupacaoData` type**

Localize o tipo `OcupacaoData` e substitua por:

```typescript
export type OcupacaoData = {
  total: number;
  ocupadas: number;
  pagantes: number;
  beneficiados: number;
  porEtapa: Array<{
    etapa: string;
    capacidade: number;
    matriculados: number;
    bolsistas: number;
  }>;
};
```

- [ ] **Step 3: Atualizar `getOcupacao` impl**

Localize função `getOcupacao` e substitua por:

```typescript
export async function getOcupacao(escolaId: string = DEFAULT_SCHOOL_ID): Promise<OcupacaoData> {
  const supabase = await createServerClient();
  const anoLetivo = new Date().getFullYear();

  const { data: turmas } = await supabase
    .from("turmas")
    .select("id, capacidade, serie_id, series(segmento)")
    .eq("escola_id", escolaId)
    .eq("ano_letivo", anoLetivo)
    .eq("ativo", true);

  const { data: matriculas } = await supabase
    .from("matriculas")
    .select("turma_id, tipo_vaga")
    .eq("escola_id", escolaId)
    .eq("status", "ativa");

  type MatriculaCount = { total: number; bolsistas: number };
  const matriculasPorTurma = new Map<string, MatriculaCount>();
  let pagantes = 0;
  let beneficiados = 0;

  for (const m of matriculas ?? []) {
    const acc = matriculasPorTurma.get(m.turma_id) ?? { total: 0, bolsistas: 0 };
    acc.total += 1;
    const ehBeneficiario = BENEFICIARIO_TIPOS.includes(m.tipo_vaga as TipoVaga);
    if (ehBeneficiario) {
      acc.bolsistas += 1;
      beneficiados += 1;
    } else {
      pagantes += 1;
    }
    matriculasPorTurma.set(m.turma_id, acc);
  }

  type EtapaAgg = { capacidade: number; matriculados: number; bolsistas: number };
  const porEtapaMap = new Map<string, EtapaAgg>();
  let total = 0;
  let ocupadas = 0;

  for (const t of turmas ?? []) {
    const seriesRel = (t as any).series;
    const etapa = (Array.isArray(seriesRel) ? seriesRel[0]?.segmento : seriesRel?.segmento) ?? "outros";
    const cap = Number(t.capacidade ?? 0);
    const counts = matriculasPorTurma.get(t.id) ?? { total: 0, bolsistas: 0 };
    total += cap;
    ocupadas += counts.total;
    const acc = porEtapaMap.get(etapa) ?? { capacidade: 0, matriculados: 0, bolsistas: 0 };
    acc.capacidade += cap;
    acc.matriculados += counts.total;
    acc.bolsistas += counts.bolsistas;
    porEtapaMap.set(etapa, acc);
  }

  return {
    total,
    ocupadas,
    pagantes,
    beneficiados,
    porEtapa: Array.from(porEtapaMap.entries()).map(([etapa, v]) => ({ etapa, ...v })),
  };
}
```

- [ ] **Step 4: Typecheck**

```bash
npm run typecheck
```
Expected: só erro pré-existente. Se aparecer novo erro, corrigir (provavelmente em algum caller esperando shape antigo de `OcupacaoData`).

- [ ] **Step 5: Commit**

```bash
git add src/lib/data/dashboard-executive.ts
git commit -m "feat(dashboard): getOcupacao com pagantes, beneficiados e bolsistas por etapa"
```

---

## Task 5: Atualizar `getStageBreakdown` com `bolsistas`

**Files:**
- Modify: `src/lib/data/dashboard-executive.ts`

- [ ] **Step 1: Atualizar `StageBreakdownRow` type**

Localize tipo `StageBreakdownRow` e substitua por:

```typescript
export type StageBreakdownRow = {
  etapa: string;
  alunos: number;
  bolsistas: number;
  receita: number;
  ticket: number;
  ocupacao: number;
  capacidade: number;
  vagasLivres: number;
};
```

- [ ] **Step 2: Atualizar `getStageBreakdown` impl**

Localize a função e substitua por:

```typescript
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
    const matriculasRel = c.matriculas;
    const matricula = Array.isArray(matriculasRel) ? matriculasRel[0] : matriculasRel;
    const seriesRel = matricula?.series;
    const serie = Array.isArray(seriesRel) ? seriesRel[0] : seriesRel;
    const etapa = serie?.segmento ?? "outros";
    receitaPorEtapa.set(etapa, (receitaPorEtapa.get(etapa) ?? 0) + Number(c.valor_final ?? 0));
  }

  const ocup = await getOcupacao(escolaId);

  return ocup.porEtapa.map((p) => ({
    etapa: p.etapa,
    alunos: p.matriculados,
    bolsistas: p.bolsistas,
    receita: receitaPorEtapa.get(p.etapa) ?? 0,
    ticket: p.matriculados > 0 ? (receitaPorEtapa.get(p.etapa) ?? 0) / p.matriculados : 0,
    ocupacao: p.capacidade > 0 ? p.matriculados / p.capacidade : 0,
    capacidade: p.capacidade,
    vagasLivres: Math.max(0, p.capacidade - p.matriculados),
  }));
}
```

Nota: ticket continua receita/alunos (alunos = todos ativos da etapa). Bolsistas integrais não geram cobrança → não distorcem receita real do mês.

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```
Expected: só erro pré-existente.

- [ ] **Step 3: Commit**

```bash
git add src/lib/data/dashboard-executive.ts
git commit -m "feat(dashboard): getStageBreakdown com coluna bolsistas"
```

---

## Task 6: Atualizar `getTicketMedio` (denominador pagantes+parcial)

**Files:**
- Modify: `src/lib/data/dashboard-executive.ts`

- [ ] **Step 1: Substituir impl**

Localize função `getTicketMedio` e substitua por:

```typescript
export async function getTicketMedio(
  months: number = 6,
  escolaId: string = DEFAULT_SCHOOL_ID
): Promise<TicketMedioData> {
  const supabase = await createServerClient();
  const competencias = rollingCompetencias(months);

  const serie = await Promise.all(
    competencias.map(async (competencia) => {
      const [{ data: cobrancas }, { count: pagantesCount }] = await Promise.all([
        supabase
          .from("cobrancas")
          .select("valor_final")
          .eq("escola_id", escolaId)
          .eq("competencia", competencia)
          .neq("status", "cancelada"),
        supabase
          .from("matriculas")
          .select("id", { count: "exact", head: true })
          .eq("escola_id", escolaId)
          .eq("status", "ativa")
          .in("tipo_vaga", ["paga", "bolsa_parcial"]),
      ]);
      const total = (cobrancas ?? []).reduce((s, r) => s + Number(r.valor_final ?? 0), 0);
      return pagantesCount && pagantesCount > 0 ? total / pagantesCount : 0;
    })
  );

  return {
    atual: serie[serie.length - 1] ?? 0,
    serie,
  };
}
```

Nota: denominador é count atual de pagantes (snapshot), não histórico. Aceitável — escolas raramente têm flutuação grande mês a mês de bolsistas.

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```
Expected: só erro pré-existente.

- [ ] **Step 3: Commit**

```bash
git add src/lib/data/dashboard-executive.ts
git commit -m "feat(dashboard): ticket medio denominador apenas pagantes+parcial"
```

---

## Task 7: Implementar `getBeneficios`

**Files:**
- Modify: `src/lib/data/dashboard-executive.ts`

- [ ] **Step 1: Adicionar tipo + função no final do arquivo**

```typescript
export type BeneficiosData = {
  total: number;
  porTipo: Record<TipoVaga, number>;
  receitaPerdidaEstimada: number; // estimativa mensal: soma planos.valor_mensalidade dos beneficiados
};

export async function getBeneficios(
  escolaId: string = DEFAULT_SCHOOL_ID
): Promise<BeneficiosData> {
  const supabase = await createServerClient();

  const { data } = await supabase
    .from("matriculas")
    .select("tipo_vaga, percentual_bolsa, planos(valor_mensalidade)")
    .eq("escola_id", escolaId)
    .eq("status", "ativa")
    .in("tipo_vaga", BENEFICIARIO_TIPOS);

  const porTipo: Record<TipoVaga, number> = {
    paga: 0,
    bolsa_integral: 0,
    bolsa_parcial: 0,
    permuta: 0,
    gratuita: 0,
  };

  let receitaPerdida = 0;

  for (const m of ((data ?? []) as any[])) {
    const tipo = m.tipo_vaga as TipoVaga;
    porTipo[tipo] = (porTipo[tipo] ?? 0) + 1;

    const planosRel = m.planos;
    const plano = Array.isArray(planosRel) ? planosRel[0] : planosRel;
    const mensalidade = Number(plano?.valor_mensalidade ?? 0);

    if (tipo === "bolsa_parcial") {
      const pct = Number(m.percentual_bolsa ?? 0) / 100;
      receitaPerdida += mensalidade * pct;
    } else {
      // integral / permuta / gratuita = 100% do plano
      receitaPerdida += mensalidade;
    }
  }

  const total = BENEFICIARIO_TIPOS.reduce((s, t) => s + (porTipo[t] ?? 0), 0);

  return {
    total,
    porTipo,
    receitaPerdidaEstimada: receitaPerdida,
  };
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```
Expected: só erro pré-existente.

- [ ] **Step 3: Commit**

```bash
git add src/lib/data/dashboard-executive.ts
git commit -m "feat(dashboard): getBeneficios (count por tipo + receita perdida estimada)"
```

---

## Task 8: Componente `BeneficiosCard`

**Files:**
- Create: `src/components/dashboard/beneficios-card.tsx`

- [ ] **Step 1: Criar arquivo**

```tsx
import { HandHeart, GraduationCap, HandCoins, Sparkles, BookOpen } from "lucide-react";
import { money } from "@/lib/constants";
import type { BeneficiosData, TipoVaga } from "@/lib/data/dashboard-executive";

const LABELS: Record<TipoVaga, string> = {
  paga: "Pagantes",
  bolsa_integral: "Bolsa integral",
  bolsa_parcial: "Bolsa parcial",
  permuta: "Permuta",
  gratuita: "Gratuidade",
};

const ICONS: Record<TipoVaga, React.ComponentType<{ size?: number; className?: string }>> = {
  paga: BookOpen,
  bolsa_integral: GraduationCap,
  bolsa_parcial: GraduationCap,
  permuta: HandCoins,
  gratuita: Sparkles,
};

const ORDEM: TipoVaga[] = ["bolsa_integral", "bolsa_parcial", "permuta", "gratuita"];

export function BeneficiosCard({ data }: { data: BeneficiosData }) {
  return (
    <article className="rounded-panel bg-surface bg-gradient-to-br from-accent/10 to-transparent p-6 shadow-soft">
      <div className="flex items-center gap-2">
        <span className="grid h-9 w-9 place-items-center rounded-ui bg-accent/15 text-accent">
          <HandHeart size={16} />
        </span>
        <p className="text-[0.66rem] font-bold uppercase tracking-kicker text-ink/55">Benefícios concedidos</p>
      </div>

      <strong className="mt-3 block text-3xl font-bold text-ink">{data.total}</strong>
      <p className="text-sm text-ink/60">alunos beneficiados</p>

      <ul className="mt-4 grid gap-2">
        {ORDEM.map((tipo) => {
          const count = data.porTipo[tipo] ?? 0;
          if (count === 0) return null;
          const Icon = ICONS[tipo];
          return (
            <li key={tipo} className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-sm text-ink/70">
                <Icon size={14} className="text-accent" />
                {LABELS[tipo]}
              </span>
              <span className="rounded-pill bg-accent/10 px-2 py-0.5 text-xs font-bold text-accent">{count}</span>
            </li>
          );
        })}
      </ul>

      {data.receitaPerdidaEstimada > 0 && (
        <p className="mt-4 rounded-ui bg-warning/10 px-3 py-2 text-xs text-warning">
          Receita não realizada: <strong>{money.format(data.receitaPerdidaEstimada)}</strong>/mês
        </p>
      )}
    </article>
  );
}
```

- [ ] **Step 2: Typecheck + lint**

```bash
npm run typecheck && npm run lint
```
Expected: só erro pré-existente.

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/beneficios-card.tsx
git commit -m "feat(dashboard): BeneficiosCard (count por tipo + receita perdida)"
```

---

## Task 9: Atualizar `StageTable` com coluna Bolsistas

**Files:**
- Modify: `src/components/dashboard/stage-table.tsx`

- [ ] **Step 1: Adicionar header da coluna**

Localize `<thead>` e modifique a linha de headers, adicionando `<th>Bolsistas</th>` entre `Alunos` e `Capacidade`:

```tsx
<tr className="text-[0.66rem] uppercase tracking-kicker text-ink/55">
  <th className="px-2 py-2 text-left">Etapa</th>
  <th className="px-2 py-2 text-right">Alunos</th>
  <th className="px-2 py-2 text-right">Bolsistas</th>
  <th className="px-2 py-2 text-right">Capacidade</th>
  <th className="px-2 py-2 text-right">Vagas livres</th>
  <th className="px-2 py-2 text-right">Receita</th>
  <th className="px-2 py-2 text-right">Ticket</th>
  <th className="px-2 py-2 text-left w-44">Ocupação</th>
</tr>
```

- [ ] **Step 2: Adicionar célula na linha de cada row**

Dentro do `{sorted.map((r) => { ... })}`, adicione `<td>` de bolsistas entre Alunos e Capacidade:

Localize:
```tsx
<td className="px-2 py-3 text-right font-semibold text-ink">{r.alunos}</td>
<td className="px-2 py-3 text-right text-ink/70">{r.capacidade}</td>
```

Substitua por:
```tsx
<td className="px-2 py-3 text-right font-semibold text-ink">{r.alunos}</td>
<td className="px-2 py-3 text-right">
  {r.bolsistas > 0 ? (
    <span className="inline-flex items-center gap-1 rounded-pill bg-accent/10 px-2 py-0.5 text-xs font-semibold text-accent">
      {r.bolsistas} ({((r.bolsistas / r.alunos) * 100).toFixed(0)}%)
    </span>
  ) : (
    <span className="text-ink/40">—</span>
  )}
</td>
<td className="px-2 py-3 text-right text-ink/70">{r.capacidade}</td>
```

- [ ] **Step 3: Atualizar linha Total**

Localize a `<tr>` que contém `<td className="px-2 py-3 text-ink">Total</td>`. Adicione célula de bolsistas total:

Antes (parcial):
```tsx
<td className="px-2 py-3 text-ink">Total</td>
<td className="px-2 py-3 text-right">{totalAlunos}</td>
<td className="px-2 py-3 text-right">{totalCapacidade}</td>
```

Depois:
```tsx
<td className="px-2 py-3 text-ink">Total</td>
<td className="px-2 py-3 text-right">{totalAlunos}</td>
<td className="px-2 py-3 text-right">
  <span className="inline-flex items-center gap-1 rounded-pill bg-accent/10 px-2 py-0.5 text-xs font-bold text-accent">
    {totalBolsistas}
  </span>
</td>
<td className="px-2 py-3 text-right">{totalCapacidade}</td>
```

- [ ] **Step 4: Calcular `totalBolsistas`**

Localize o bloco de cálculos no topo da função `StageTable` (logo após `const sorted = [...rows].sort(...)`). Adicionar:

```typescript
const totalBolsistas = sorted.reduce((s, r) => s + r.bolsistas, 0);
```

(Junto com `totalAlunos`, `totalReceita`, etc.)

- [ ] **Step 5: Typecheck + lint**

```bash
npm run typecheck && npm run lint
```
Expected: só erro pré-existente.

- [ ] **Step 6: Commit**

```bash
git add src/components/dashboard/stage-table.tsx
git commit -m "feat(dashboard): StageTable com coluna Bolsistas"
```

---

## Task 10: Compor `BeneficiosCard` em `page.tsx`

**Files:**
- Modify: `src/app/(app)/page.tsx`

- [ ] **Step 1: Importar `getBeneficios` + tipo + componente**

No bloco de imports do `dashboard-executive`, adicionar `getBeneficios`. Próximo dos outros imports de componentes, adicionar:

```tsx
import { BeneficiosCard } from "@/components/dashboard/beneficios-card";
```

E na lista de imports do data layer:

```tsx
import {
  // ... existentes ...
  getBeneficios,
  // ...
} from "@/lib/data/dashboard-executive";
```

- [ ] **Step 2: Adicionar `beneficios` no Promise.all**

Localize o `const [hero, trend, ocupacao, stages, ticket, folhaRatio, folhaEmpresas, alertas, slot2, slot5] = await Promise.all([...])`.

Adicionar `beneficios` antes de `slot2`:

```tsx
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
```

- [ ] **Step 3: Adicionar `<BeneficiosCard>` na Zona 3**

Localize a section de 4 cards (`grid gap-6 md:grid-cols-2 lg:grid-cols-4`). Mudar para `lg:grid-cols-5` e adicionar `<BeneficiosCard>` ao final:

```tsx
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
```

- [ ] **Step 4: Typecheck + lint**

```bash
npm run typecheck && npm run lint
```
Expected: só erro pré-existente.

- [ ] **Step 5: Visual smoke**

```bash
npm run dev
```

Abrir `http://localhost:3000`. Conferir:
- Zona 3 tem 5 cards em desktop (ocupação, repasse, folha/receita, ticket, **benefícios**)
- BeneficiosCard mostra: total ~33, "Bolsa integral · 33"
- StageTable mostra coluna "Bolsistas" com valores > 0 nas etapas que têm bolsistas
- Ocupação total agora reflete 508/600 (~85%) em vez de 475/600

- [ ] **Step 6: Commit**

```bash
git add src/app/\(app\)/page.tsx
git commit -m "feat(dashboard): BeneficiosCard na Zona 3 + grid 5 colunas"
```

---

## Self-Review (executado)

**Spec coverage:**
- Migration enum + colunas → Task 1 ✓
- Backfill 33 → Tasks 2, 3 ✓
- `getOcupacao` com pagantes/beneficiados/bolsistas → Task 4 ✓
- `getStageBreakdown` com bolsistas → Task 5 ✓
- `getTicketMedio` denominador pagantes+parcial → Task 6 ✓
- `getBeneficios` novo → Task 7 ✓
- `BeneficiosCard` → Task 8 ✓
- `StageTable` coluna Bolsistas → Task 9 ✓
- `page.tsx` compõe `BeneficiosCard` → Task 10 ✓

**Type consistency:**
- `TipoVaga` exportado em Task 4, usado em Tasks 6, 7, 8 ✓
- `OcupacaoData` shape novo (porEtapa com `bolsistas`) em Task 4, consumido em Task 5 (`getStageBreakdown`) ✓
- `StageBreakdownRow` shape novo em Task 5, consumido em Task 9 (`StageTable`) ✓
- `BeneficiosData` em Task 7, consumido em Task 8 (`BeneficiosCard`) ✓
- `BENEFICIARIO_TIPOS` constante introduzida em Task 4, reusada em Task 7 ✓

**Riscos:**
- Backfill destrutivo: mitigado por Task 2 (backup)
- Ocupação Fund II vai aumentar mais (overbooking pode crescer se bolsistas concentrados lá) — diretor verá no dashboard, comportamento esperado
- `getBeneficios` faz join `matriculas → planos`; planos pode ser null (matrícula sem plano) — código já lida com `?? 0`

**Riscos NÃO mitigados (fora de escopo da fase 1):**
- Fase 2: UI pra criar/editar matrícula precisa de selector `tipo_vaga` + `percentual_bolsa` — não incluído aqui, secretaria precisa pedir refatoração separada
