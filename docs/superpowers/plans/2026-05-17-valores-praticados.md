# Valores Praticados — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tabela de referência de valores (matrícula + mensalidade) por ano letivo / segmento / ordem de filho, CRUD simples, sem vínculo com matrícula. Aplicar capacidade real por etapa em turmas 2026 e criar `segmento_config` para defaults.

**Architecture:** Duas migrations (tabelas + seeds). Data layer + actions em arquivos novos. UI em `/valores-praticados` com edição inline (autosave on blur). Dashboard `getBeneficios` consulta `valores_praticados` ano corrente + segmento + ordem=1, fallback para `planos.valor_mensalidade`.

**Tech Stack:** PostgreSQL (Supabase), Next.js 14 App Router (Server Actions), TypeScript, Tailwind, lucide-react.

**Spec:** `docs/superpowers/specs/2026-05-17-valores-praticados-design.md`

**Validation:** `npm run typecheck && npm run lint`. Pre-existing error `student-edit-tabs` OK.

**Schema confirmado:**
- `series.segmento` (enum `segmento_serie`: INFANTIL | FUNDAMENTAL1 | FUNDAMENTAL2 | MEDIO)
- `turmas` tem `serie_id` + `ano_letivo` + `capacidade`
- `planos` continua existindo (legado)

---

## File Structure

**Criar:**
- `supabase/migrations/202605280006_valores_praticados.sql` — tabelas + RLS + seeds
- `supabase/migrations/202605280007_turmas_capacidade_por_segmento.sql` — UPDATE capacidade turmas 2026
- `src/lib/data/valores-praticados.ts` — list, getByKey
- `src/lib/actions/valores-praticados.ts` — upsert, criar-ano, remover-ano
- `src/app/(app)/valores-praticados/page.tsx` — listagem por ano
- `src/components/valores/valor-praticado-input.tsx` — input inline com autosave
- `src/components/valores/criar-ano-form.tsx` — form criar ano

**Modificar:**
- `src/components/layout/topbar.tsx` — adicionar item no secondaryItems
- `src/lib/data/dashboard-executive.ts` — `getBeneficios` consulta valores_praticados

---

## Task 1: Migration — tabelas `valores_praticados` + `segmento_config` + seeds

**Files:**
- Create: `supabase/migrations/202605280006_valores_praticados.sql`

- [ ] **Step 1: Escrever migration**

```sql
-- Tabela de referencia: valores praticados por ano/segmento/ordem de filho
create table valores_praticados (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references escolas(id) on delete cascade,
  ano_letivo integer not null,
  segmento text not null check (segmento in ('INFANTIL', 'FUNDAMENTAL1', 'FUNDAMENTAL2', 'MEDIO')),
  ordem_filho integer not null check (ordem_filho between 1 and 3),
  valor_matricula numeric(12,2) not null default 0,
  valor_mensalidade numeric(12,2) not null default 0,
  observacao text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (escola_id, ano_letivo, segmento, ordem_filho)
);

create trigger valores_praticados_updated_at
  before update on valores_praticados
  for each row execute function set_updated_at();

alter table valores_praticados enable row level security;
create policy "service role full access valores_praticados"
  on valores_praticados for all to service_role using (true) with check (true);
create policy "authenticated read valores_praticados"
  on valores_praticados for select to authenticated using (true);
create policy "authenticated write valores_praticados"
  on valores_praticados for all to authenticated using (true) with check (true);

-- Capacidade default por segmento (referencia para novos cadastros)
create table segmento_config (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references escolas(id) on delete cascade,
  segmento text not null check (segmento in ('INFANTIL', 'FUNDAMENTAL1', 'FUNDAMENTAL2', 'MEDIO')),
  capacidade_default integer not null check (capacidade_default > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (escola_id, segmento)
);

create trigger segmento_config_updated_at
  before update on segmento_config
  for each row execute function set_updated_at();

alter table segmento_config enable row level security;
create policy "service role full access segmento_config"
  on segmento_config for all to service_role using (true) with check (true);
create policy "authenticated read segmento_config"
  on segmento_config for select to authenticated using (true);
create policy "authenticated write segmento_config"
  on segmento_config for all to authenticated using (true) with check (true);

-- Seeds segmento_config
insert into segmento_config (escola_id, segmento, capacidade_default) values
  ('00000000-0000-0000-0000-000000000001', 'INFANTIL', 20),
  ('00000000-0000-0000-0000-000000000001', 'FUNDAMENTAL1', 20),
  ('00000000-0000-0000-0000-000000000001', 'FUNDAMENTAL2', 35),
  ('00000000-0000-0000-0000-000000000001', 'MEDIO', 35)
on conflict (escola_id, segmento) do nothing;

-- Seeds valores_praticados 2026
insert into valores_praticados (escola_id, ano_letivo, segmento, ordem_filho, valor_matricula, valor_mensalidade) values
  ('00000000-0000-0000-0000-000000000001', 2026, 'INFANTIL',     1, 690, 690),
  ('00000000-0000-0000-0000-000000000001', 2026, 'INFANTIL',     2, 650, 650),
  ('00000000-0000-0000-0000-000000000001', 2026, 'INFANTIL',     3, 600, 600),
  ('00000000-0000-0000-0000-000000000001', 2026, 'FUNDAMENTAL1', 1, 745, 745),
  ('00000000-0000-0000-0000-000000000001', 2026, 'FUNDAMENTAL1', 2, 690, 690),
  ('00000000-0000-0000-0000-000000000001', 2026, 'FUNDAMENTAL1', 3, 650, 650),
  ('00000000-0000-0000-0000-000000000001', 2026, 'FUNDAMENTAL2', 1, 890, 890),
  ('00000000-0000-0000-0000-000000000001', 2026, 'FUNDAMENTAL2', 2, 825, 825),
  ('00000000-0000-0000-0000-000000000001', 2026, 'FUNDAMENTAL2', 3, 750, 750),
  ('00000000-0000-0000-0000-000000000001', 2026, 'MEDIO',        1, 955, 955),
  ('00000000-0000-0000-0000-000000000001', 2026, 'MEDIO',        2, 900, 900),
  ('00000000-0000-0000-0000-000000000001', 2026, 'MEDIO',        3, 850, 850)
on conflict (escola_id, ano_letivo, segmento, ordem_filho) do nothing;

-- Seeds valores_praticados 2025 (historico)
insert into valores_praticados (escola_id, ano_letivo, segmento, ordem_filho, valor_matricula, valor_mensalidade) values
  ('00000000-0000-0000-0000-000000000001', 2025, 'INFANTIL',     1, 650, 650),
  ('00000000-0000-0000-0000-000000000001', 2025, 'INFANTIL',     2, 595, 595),
  ('00000000-0000-0000-0000-000000000001', 2025, 'INFANTIL',     3, 540, 540),
  ('00000000-0000-0000-0000-000000000001', 2025, 'FUNDAMENTAL1', 1, 690, 690),
  ('00000000-0000-0000-0000-000000000001', 2025, 'FUNDAMENTAL1', 2, 650, 650),
  ('00000000-0000-0000-0000-000000000001', 2025, 'FUNDAMENTAL1', 3, 600, 600),
  ('00000000-0000-0000-0000-000000000001', 2025, 'FUNDAMENTAL2', 1, 830, 830),
  ('00000000-0000-0000-0000-000000000001', 2025, 'FUNDAMENTAL2', 2, 775, 775),
  ('00000000-0000-0000-0000-000000000001', 2025, 'FUNDAMENTAL2', 3, 625, 625),
  ('00000000-0000-0000-0000-000000000001', 2025, 'MEDIO',        1, 920, 920),
  ('00000000-0000-0000-0000-000000000001', 2025, 'MEDIO',        2, 880, 880),
  ('00000000-0000-0000-0000-000000000001', 2025, 'MEDIO',        3, 830, 830)
on conflict (escola_id, ano_letivo, segmento, ordem_filho) do nothing;
```

- [ ] **Step 2: Aplicar**

```bash
npx supabase migration up
```
Expected: `Local database is up to date.`

- [ ] **Step 3: Smoke SQL**

```bash
docker exec supabase_db_rrb-escola psql -U postgres -d postgres -c "
select ano_letivo, segmento, ordem_filho, valor_mensalidade
from valores_praticados
where escola_id = '00000000-0000-0000-0000-000000000001'
order by ano_letivo desc, segmento, ordem_filho;
"
```
Expected: 24 linhas (12 por ano). 2026 INFANTIL ordem 1 = 690.

```bash
docker exec supabase_db_rrb-escola psql -U postgres -d postgres -c "
select segmento, capacidade_default from segmento_config
where escola_id = '00000000-0000-0000-0000-000000000001';
"
```
Expected: 4 linhas (INFANTIL=20, FUND1=20, FUND2=35, MEDIO=35).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/202605280006_valores_praticados.sql
git commit -m "feat(financeiro): tabelas valores_praticados + segmento_config + seeds 2025-2026"
```

---

## Task 2: Migration — atualizar capacidade turmas 2026 por segmento

**Files:**
- Create: `supabase/migrations/202605280007_turmas_capacidade_por_segmento.sql`

- [ ] **Step 1: Escrever migration**

```sql
-- Aplica capacidade por etapa nas turmas 2026
-- INFANTIL=20, FUNDAMENTAL1=20, FUNDAMENTAL2=35, MEDIO=35

update turmas t
set capacidade = case s.segmento
  when 'INFANTIL'      then 20
  when 'FUNDAMENTAL1'  then 20
  when 'FUNDAMENTAL2'  then 35
  when 'MEDIO'         then 35
  else t.capacidade
end
from series s
where t.serie_id = s.id
  and t.escola_id = '00000000-0000-0000-0000-000000000001'
  and t.ano_letivo = 2026;
```

- [ ] **Step 2: Aplicar**

```bash
npx supabase migration up
```
Expected: migration aplicada.

- [ ] **Step 3: Smoke SQL**

```bash
docker exec supabase_db_rrb-escola psql -U postgres -d postgres -c "
select s.segmento, t.capacidade, count(*) as turmas
from turmas t join series s on s.id = t.serie_id
where t.escola_id = '00000000-0000-0000-0000-000000000001'
  and t.ano_letivo = 2026
group by s.segmento, t.capacidade
order by s.segmento;
"
```
Expected:
- INFANTIL | 20 | 7
- FUNDAMENTAL1 | 20 | 10
- FUNDAMENTAL2 | 35 | 4
- MEDIO | 35 | 3

Total vagas 2026 = 7×20 + 10×20 + 4×35 + 3×35 = 140 + 200 + 140 + 105 = **585**.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/202605280007_turmas_capacidade_por_segmento.sql
git commit -m "feat(turmas): capacidade real por segmento 2026 (Inf/F1=20, F2/M=35)"
```

---

## Task 3: Data layer `valores-praticados.ts`

**Files:**
- Create: `src/lib/data/valores-praticados.ts`

- [ ] **Step 1: Implementar**

```typescript
import { createServerClient } from "@/lib/supabase/server";
import { DEFAULT_SCHOOL_ID } from "@/lib/constants";

export type SegmentoSerie = "INFANTIL" | "FUNDAMENTAL1" | "FUNDAMENTAL2" | "MEDIO";

export const SEGMENTOS: SegmentoSerie[] = ["INFANTIL", "FUNDAMENTAL1", "FUNDAMENTAL2", "MEDIO"];

export type ValorPraticado = {
  id: string;
  anoLetivo: number;
  segmento: SegmentoSerie;
  ordemFilho: 1 | 2 | 3;
  valorMatricula: number;
  valorMensalidade: number;
  observacao: string | null;
};

export async function listValoresPraticados(
  escolaId: string = DEFAULT_SCHOOL_ID
): Promise<ValorPraticado[]> {
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("valores_praticados")
    .select("id, ano_letivo, segmento, ordem_filho, valor_matricula, valor_mensalidade, observacao")
    .eq("escola_id", escolaId)
    .order("ano_letivo", { ascending: false })
    .order("segmento", { ascending: true })
    .order("ordem_filho", { ascending: true });

  return ((data ?? []) as any[]).map((r) => ({
    id: r.id,
    anoLetivo: r.ano_letivo,
    segmento: r.segmento as SegmentoSerie,
    ordemFilho: r.ordem_filho as 1 | 2 | 3,
    valorMatricula: Number(r.valor_matricula),
    valorMensalidade: Number(r.valor_mensalidade),
    observacao: r.observacao ?? null,
  }));
}

export async function listAnosLetivos(
  escolaId: string = DEFAULT_SCHOOL_ID
): Promise<number[]> {
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("valores_praticados")
    .select("ano_letivo")
    .eq("escola_id", escolaId);

  const set = new Set<number>();
  for (const r of (data ?? []) as Array<{ ano_letivo: number }>) {
    set.add(r.ano_letivo);
  }
  return Array.from(set).sort((a, b) => b - a);
}

export async function getValorPraticado(
  anoLetivo: number,
  segmento: SegmentoSerie,
  ordemFilho: 1 | 2 | 3,
  escolaId: string = DEFAULT_SCHOOL_ID
): Promise<ValorPraticado | null> {
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("valores_praticados")
    .select("id, ano_letivo, segmento, ordem_filho, valor_matricula, valor_mensalidade, observacao")
    .eq("escola_id", escolaId)
    .eq("ano_letivo", anoLetivo)
    .eq("segmento", segmento)
    .eq("ordem_filho", ordemFilho)
    .maybeSingle();

  if (!data) return null;
  return {
    id: data.id,
    anoLetivo: data.ano_letivo,
    segmento: data.segmento as SegmentoSerie,
    ordemFilho: data.ordem_filho as 1 | 2 | 3,
    valorMatricula: Number(data.valor_matricula),
    valorMensalidade: Number(data.valor_mensalidade),
    observacao: data.observacao ?? null,
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
git add src/lib/data/valores-praticados.ts
git commit -m "feat(financeiro): data layer valores_praticados (list, listAnos, getByKey)"
```

---

## Task 4: Server actions

**Files:**
- Create: `src/lib/actions/valores-praticados.ts`

- [ ] **Step 1: Implementar**

```typescript
"use server";

import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/auth/session";
import { DEFAULT_SCHOOL_ID } from "@/lib/constants";
import { SEGMENTOS, type SegmentoSerie } from "@/lib/data/valores-praticados";

function formText(formData: FormData, key: string): string | null {
  const v = formData.get(key);
  if (typeof v !== "string") return null;
  const trimmed = v.trim();
  return trimmed === "" ? null : trimmed;
}

function formNumber(formData: FormData, key: string): number | null {
  const raw = formText(formData, key);
  if (raw === null) return null;
  const n = Number(raw.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function readSegmento(formData: FormData): SegmentoSerie {
  const raw = formText(formData, "segmento");
  if (raw && (SEGMENTOS as string[]).includes(raw)) return raw as SegmentoSerie;
  throw new Error("Segmento invalido");
}

function readOrdemFilho(formData: FormData): 1 | 2 | 3 {
  const n = formNumber(formData, "ordem_filho");
  if (n === 1 || n === 2 || n === 3) return n;
  throw new Error("Ordem do filho invalida (1, 2 ou 3)");
}

function readAnoLetivo(formData: FormData): number {
  const n = formNumber(formData, "ano_letivo");
  if (!n || n < 2000 || n > 2100) {
    throw new Error("Ano letivo invalido");
  }
  return Math.trunc(n);
}

export async function upsertValorPraticadoAction(formData: FormData) {
  await requireSession();
  const supabase = await createServerClient();

  const anoLetivo = readAnoLetivo(formData);
  const segmento = readSegmento(formData);
  const ordemFilho = readOrdemFilho(formData);
  const valorMatricula = formNumber(formData, "valor_matricula") ?? 0;
  const valorMensalidade = formNumber(formData, "valor_mensalidade") ?? 0;
  const observacao = formText(formData, "observacao");

  await supabase.from("valores_praticados").upsert({
    escola_id: DEFAULT_SCHOOL_ID,
    ano_letivo: anoLetivo,
    segmento,
    ordem_filho: ordemFilho,
    valor_matricula: valorMatricula,
    valor_mensalidade: valorMensalidade,
    observacao,
  }, { onConflict: "escola_id,ano_letivo,segmento,ordem_filho" });

  revalidatePath("/valores-praticados");
}

export async function criarAnoLetivoAction(formData: FormData) {
  await requireSession();
  const supabase = await createServerClient();
  const anoLetivo = readAnoLetivo(formData);

  const rows = SEGMENTOS.flatMap((segmento) =>
    ([1, 2, 3] as const).map((ordem) => ({
      escola_id: DEFAULT_SCHOOL_ID,
      ano_letivo: anoLetivo,
      segmento,
      ordem_filho: ordem,
      valor_matricula: 0,
      valor_mensalidade: 0,
    }))
  );

  await supabase
    .from("valores_praticados")
    .upsert(rows, { onConflict: "escola_id,ano_letivo,segmento,ordem_filho", ignoreDuplicates: true });

  revalidatePath("/valores-praticados");
}

export async function removerAnoLetivoAction(formData: FormData) {
  await requireSession();
  const supabase = await createServerClient();
  const anoLetivo = readAnoLetivo(formData);

  await supabase
    .from("valores_praticados")
    .delete()
    .eq("escola_id", DEFAULT_SCHOOL_ID)
    .eq("ano_letivo", anoLetivo);

  revalidatePath("/valores-praticados");
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```
Expected: só erro pré-existente.

- [ ] **Step 3: Commit**

```bash
git add src/lib/actions/valores-praticados.ts
git commit -m "feat(financeiro): actions upsert/criar-ano/remover-ano valores_praticados"
```

---

## Task 5: Componente input inline com autosave

**Files:**
- Create: `src/components/valores/valor-praticado-input.tsx`

- [ ] **Step 1: Implementar**

```tsx
"use client";

import { useState, useTransition } from "react";
import { upsertValorPraticadoAction } from "@/lib/actions/valores-praticados";
import type { SegmentoSerie } from "@/lib/data/valores-praticados";

type Props = {
  anoLetivo: number;
  segmento: SegmentoSerie;
  ordemFilho: 1 | 2 | 3;
  campo: "valor_matricula" | "valor_mensalidade";
  initialValue: number;
  outroCampo: { campo: "valor_matricula" | "valor_mensalidade"; valor: number };
};

export function ValorPraticadoInput({
  anoLetivo,
  segmento,
  ordemFilho,
  campo,
  initialValue,
  outroCampo,
}: Props) {
  const [value, setValue] = useState(initialValue.toFixed(2));
  const [saved, setSaved] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [, startTransition] = useTransition();

  function handleBlur() {
    const n = Number(value.replace(",", "."));
    if (!Number.isFinite(n) || n < 0) {
      setSaved("error");
      return;
    }
    if (n === initialValue) {
      setSaved("idle");
      return;
    }
    setSaved("saving");
    const fd = new FormData();
    fd.set("ano_letivo", String(anoLetivo));
    fd.set("segmento", segmento);
    fd.set("ordem_filho", String(ordemFilho));
    fd.set(campo, String(n));
    fd.set(outroCampo.campo, String(outroCampo.valor));
    startTransition(async () => {
      try {
        await upsertValorPraticadoAction(fd);
        setSaved("saved");
        setTimeout(() => setSaved("idle"), 1500);
      } catch {
        setSaved("error");
      }
    });
  }

  const border =
    saved === "saving" ? "border-warning" :
    saved === "saved"  ? "border-success" :
    saved === "error"  ? "border-danger"  :
    "border-line";

  return (
    <input
      type="text"
      inputMode="decimal"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={handleBlur}
      className={`w-full rounded-ui border ${border} bg-surface px-2 py-1 text-right text-sm font-semibold text-ink focus:outline-none focus:ring-2 focus:ring-brand/20`}
    />
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
git add src/components/valores/valor-praticado-input.tsx
git commit -m "feat(financeiro): ValorPraticadoInput com autosave on blur"
```

---

## Task 6: Componente criar ano

**Files:**
- Create: `src/components/valores/criar-ano-form.tsx`

- [ ] **Step 1: Implementar**

```tsx
"use client";

import { Plus } from "lucide-react";
import { criarAnoLetivoAction } from "@/lib/actions/valores-praticados";

export function CriarAnoForm() {
  const proximoAno = new Date().getFullYear() + 1;
  return (
    <form action={criarAnoLetivoAction} className="flex items-center gap-2">
      <input
        name="ano_letivo"
        type="number"
        min={2000}
        max={2100}
        defaultValue={proximoAno}
        className="w-24 rounded-ui border border-line bg-surface px-2 py-1.5 text-sm"
      />
      <button
        type="submit"
        className="inline-flex items-center gap-1 rounded-ui bg-brand px-3 py-1.5 text-sm font-semibold text-paper hover:bg-brand/90"
      >
        <Plus size={14} /> Novo ano
      </button>
    </form>
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
git add src/components/valores/criar-ano-form.tsx
git commit -m "feat(financeiro): CriarAnoForm cria 12 linhas zeradas"
```

---

## Task 7: Página `/valores-praticados`

**Files:**
- Create: `src/app/(app)/valores-praticados/page.tsx`

- [ ] **Step 1: Criar diretório**

```bash
mkdir -p "src/app/(app)/valores-praticados"
```

- [ ] **Step 2: Implementar**

```tsx
import { Trash2 } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { ValorPraticadoInput } from "@/components/valores/valor-praticado-input";
import { CriarAnoForm } from "@/components/valores/criar-ano-form";
import { listValoresPraticados, SEGMENTOS, type SegmentoSerie, type ValorPraticado } from "@/lib/data/valores-praticados";
import { removerAnoLetivoAction } from "@/lib/actions/valores-praticados";

const SEG_LABEL: Record<SegmentoSerie, string> = {
  INFANTIL: "Educação Infantil",
  FUNDAMENTAL1: "Fundamental I",
  FUNDAMENTAL2: "Fundamental II",
  MEDIO: "Ensino Médio",
};

const SEG_COLOR: Record<SegmentoSerie, string> = {
  INFANTIL: "bg-gold/15 text-gold",
  FUNDAMENTAL1: "bg-brand/15 text-brand",
  FUNDAMENTAL2: "bg-clay/15 text-clay",
  MEDIO: "bg-moss/15 text-moss",
};

const ORDEM_LABEL: Record<1 | 2 | 3, string> = {
  1: "1 Aluno",
  2: "2º Irmão",
  3: "3º Irmão",
};

function buildMatrix(valores: ValorPraticado[]): Map<number, Map<SegmentoSerie, Map<1 | 2 | 3, ValorPraticado>>> {
  const out = new Map<number, Map<SegmentoSerie, Map<1 | 2 | 3, ValorPraticado>>>();
  for (const v of valores) {
    if (!out.has(v.anoLetivo)) out.set(v.anoLetivo, new Map());
    const byAno = out.get(v.anoLetivo)!;
    if (!byAno.has(v.segmento)) byAno.set(v.segmento, new Map());
    byAno.get(v.segmento)!.set(v.ordemFilho, v);
  }
  return out;
}

export default async function ValoresPraticadosPage() {
  const valores = await listValoresPraticados();
  const matrix = buildMatrix(valores);
  const anos = Array.from(matrix.keys()).sort((a, b) => b - a);

  return (
    <div className="grid gap-6">
      <PageHeader
        breadcrumb={[{ label: "Financeiro" }, { label: "Valores praticados" }]}
        title="Valores praticados"
        counter={`${anos.length}`}
        description="Tabela de referência. Não vincula matrícula nem gera cobrança."
        actions={<CriarAnoForm />}
      />

      {anos.length === 0 && (
        <article className="rounded-panel bg-surface p-8 text-center shadow-soft">
          <p className="text-ink/60">Nenhum ano cadastrado. Crie um novo ano acima.</p>
        </article>
      )}

      {anos.map((ano) => {
        const porSegmento = matrix.get(ano)!;
        return (
          <article key={ano} className="rounded-panel bg-surface p-6 shadow-soft">
            <header className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-ink">Ano letivo {ano}</h2>
                <p className="text-sm text-ink/60">Valores em R$. Edite e clique fora para salvar.</p>
              </div>
              <form action={removerAnoLetivoAction}>
                <input type="hidden" name="ano_letivo" value={ano} />
                <button
                  type="submit"
                  className="inline-flex items-center gap-1 rounded-ui border border-danger/20 bg-danger/5 px-3 py-1.5 text-xs font-semibold text-danger hover:bg-danger/10"
                >
                  <Trash2 size={12} /> Remover ano
                </button>
              </form>
            </header>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[0.66rem] uppercase tracking-kicker text-ink/55">
                    <th className="px-3 py-2 text-left">Segmento</th>
                    {([1, 2, 3] as const).map((o) => (
                      <th key={o} colSpan={2} className="px-3 py-2 text-center border-l border-line">
                        {ORDEM_LABEL[o]}
                      </th>
                    ))}
                  </tr>
                  <tr className="text-[0.66rem] uppercase tracking-kicker text-ink/40">
                    <th />
                    {([1, 2, 3] as const).flatMap((o) => [
                      <th key={`m${o}`} className="px-3 py-1 text-right border-l border-line">Matrícula</th>,
                      <th key={`s${o}`} className="px-3 py-1 text-right">Mensalidade</th>,
                    ])}
                  </tr>
                </thead>
                <tbody>
                  {SEGMENTOS.map((seg) => {
                    const porOrdem = porSegmento.get(seg);
                    return (
                      <tr key={seg} className="border-t border-line">
                        <td className="px-3 py-3">
                          <span className={`inline-flex items-center rounded-pill px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${SEG_COLOR[seg]}`}>
                            {SEG_LABEL[seg]}
                          </span>
                        </td>
                        {([1, 2, 3] as const).map((o) => {
                          const v = porOrdem?.get(o);
                          if (!v) {
                            return (
                              <td key={o} colSpan={2} className="px-3 py-3 text-center text-ink/40 border-l border-line">
                                —
                              </td>
                            );
                          }
                          return [
                            <td key={`m${o}`} className="px-3 py-3 border-l border-line">
                              <ValorPraticadoInput
                                anoLetivo={ano}
                                segmento={seg}
                                ordemFilho={o}
                                campo="valor_matricula"
                                initialValue={v.valorMatricula}
                                outroCampo={{ campo: "valor_mensalidade", valor: v.valorMensalidade }}
                              />
                            </td>,
                            <td key={`s${o}`} className="px-3 py-3">
                              <ValorPraticadoInput
                                anoLetivo={ano}
                                segmento={seg}
                                ordemFilho={o}
                                campo="valor_mensalidade"
                                initialValue={v.valorMensalidade}
                                outroCampo={{ campo: "valor_matricula", valor: v.valorMatricula }}
                              />
                            </td>,
                          ];
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </article>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 3: Typecheck + lint**

```bash
npm run typecheck && npm run lint
```
Expected: só erro pré-existente.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/valores-praticados/"
git commit -m "feat(financeiro): pagina /valores-praticados com matriz por ano/segmento/ordem"
```

---

## Task 8: Adicionar link no menu

**Files:**
- Modify: `src/components/layout/topbar.tsx`

- [ ] **Step 1: Adicionar item em `secondaryItems`**

Localize o array `secondaryItems`. Adicione a linha entre `/planos` e `/frequencias`:

```typescript
const secondaryItems: Array<{ href: string; label: string; icon: TopbarIconName }> = [
  { href: "/usuarios", label: "Usuários", icon: "UsersRound" },
  { href: "/planos", label: "Planos", icon: "CreditCard" },
  { href: "/valores-praticados", label: "Valores", icon: "ReceiptText" },
  { href: "/frequencias", label: "Frequência", icon: "CalendarCheck" },
  { href: "/relatorios/alunos", label: "Rel. Alunos", icon: "UsersRound" },
  { href: "/relatorios/inadimplencia", label: "Inadimplência", icon: "ReceiptText" },
  { href: "/relatorios/frequencia", label: "Rel. Frequência", icon: "CalendarCheck" }
];
```

Verificar se ícone `ReceiptText` existe em `topbar-nav-link.tsx`. Já é usado em outros itens — OK.

- [ ] **Step 2: Typecheck + lint**

```bash
npm run typecheck && npm run lint
```
Expected: só erro pré-existente.

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/topbar.tsx
git commit -m "feat(menu): link Valores praticados no menu secundario"
```

---

## Task 9: Atualizar `getBeneficios` para usar valores_praticados

**Files:**
- Modify: `src/lib/data/dashboard-executive.ts`

- [ ] **Step 1: Localizar função `getBeneficios`**

A função atual usa `planos.valor_mensalidade` da matrícula. Vai mudar pra: consulta `valores_praticados` por (ano corrente, segmento da matrícula, ordem=1). Fallback: `planos.valor_mensalidade`.

- [ ] **Step 2: Substituir função `getBeneficios`**

Localize a função e substitua INTEIRA por:

```typescript
export async function getBeneficios(
  escolaId: string = DEFAULT_SCHOOL_ID
): Promise<BeneficiosData> {
  const supabase = await createServerClient();
  const anoLetivo = new Date().getFullYear();

  const { data: matriculas } = await supabase
    .from("matriculas")
    .select("tipo_vaga, percentual_bolsa, series(segmento), planos(valor_mensalidade)")
    .eq("escola_id", escolaId)
    .eq("status", "ativa")
    .in("tipo_vaga", BENEFICIARIO_TIPOS);

  // Carrega valores praticados do ano corrente (ordem_filho = 1)
  const { data: valoresPraticados } = await supabase
    .from("valores_praticados")
    .select("segmento, valor_mensalidade")
    .eq("escola_id", escolaId)
    .eq("ano_letivo", anoLetivo)
    .eq("ordem_filho", 1);

  const valorPorSegmento = new Map<string, number>();
  for (const v of (valoresPraticados ?? []) as Array<{ segmento: string; valor_mensalidade: number | string }>) {
    valorPorSegmento.set(v.segmento, Number(v.valor_mensalidade));
  }

  const porTipo: Record<TipoVaga, number> = {
    paga: 0,
    bolsa_integral: 0,
    bolsa_parcial: 0,
    permuta: 0,
    gratuita: 0,
  };

  let receitaPerdida = 0;

  for (const m of ((matriculas ?? []) as any[])) {
    const tipo = m.tipo_vaga as TipoVaga;
    porTipo[tipo] = (porTipo[tipo] ?? 0) + 1;

    const seriesRel = m.series;
    const serie = Array.isArray(seriesRel) ? seriesRel[0] : seriesRel;
    const segmento = serie?.segmento as string | undefined;

    const planosRel = m.planos;
    const plano = Array.isArray(planosRel) ? planosRel[0] : planosRel;
    const fallback = Number(plano?.valor_mensalidade ?? 0);

    const valorReferencia = (segmento && valorPorSegmento.get(segmento)) ?? fallback;

    if (tipo === "bolsa_parcial") {
      const pct = Number(m.percentual_bolsa ?? 0) / 100;
      receitaPerdida += valorReferencia * pct;
    } else {
      receitaPerdida += valorReferencia;
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

- [ ] **Step 3: Typecheck + lint**

```bash
npm run typecheck && npm run lint
```
Expected: só erro pré-existente.

- [ ] **Step 4: Smoke SQL**

Conferir cálculo esperado:

```bash
docker exec supabase_db_rrb-escola psql -U postgres -d postgres -c "
select s.segmento, count(*) as bolsistas, vp.valor_mensalidade,
       count(*) * vp.valor_mensalidade as receita_perdida
from matriculas m
join series s on s.id = m.serie_id
join valores_praticados vp on vp.segmento = s.segmento
  and vp.ano_letivo = 2026
  and vp.ordem_filho = 1
  and vp.escola_id = '00000000-0000-0000-0000-000000000001'
where m.escola_id = '00000000-0000-0000-0000-000000000001'
  and m.status = 'ativa'
  and m.tipo_vaga = 'bolsa_integral'
group by s.segmento, vp.valor_mensalidade;
"
```

Soma das colunas `receita_perdida` é o valor esperado no dashboard.

- [ ] **Step 5: Commit**

```bash
git add src/lib/data/dashboard-executive.ts
git commit -m "feat(dashboard): getBeneficios usa valores_praticados (ano corrente, ordem 1) com fallback"
```

---

## Task 10: Atualizar `listBolsistas` para refletir valor real

**Files:**
- Modify: `src/lib/data/bolsistas.ts`

- [ ] **Step 1: Substituir função `listBolsistas`**

Atualmente usa `planos.valor_mensalidade`. Vai usar `valores_praticados` por segmento + ordem=1 (com fallback). Substitua INTEIRA:

```typescript
import { createServerClient } from "@/lib/supabase/server";
import { DEFAULT_SCHOOL_ID } from "@/lib/constants";

export type TipoVagaBolsa = "bolsa_integral" | "bolsa_parcial" | "permuta" | "gratuita";

export type BolsistaRow = {
  matriculaId: string;
  alunoId: string;
  nome: string;
  fotoUrl: string | null;
  matriculaCodigo: string | null;
  celular: string | null;
  email: string | null;
  serie: string;
  turma: string;
  segmento: string;
  tipoVaga: TipoVagaBolsa;
  percentualBolsa: number;
  responsavelNome: string | null;
  responsavelCelular: string | null;
  responsavelParentesco: string | null;
  planoNome: string | null;
  valorMensalidade: number;
  receitaPerdidaMes: number;
};

function pickOne<T>(v: T | T[] | null | undefined): T | null {
  return Array.isArray(v) ? v[0] ?? null : v ?? null;
}

export async function listBolsistas(escolaId: string = DEFAULT_SCHOOL_ID): Promise<BolsistaRow[]> {
  const supabase = await createServerClient();
  const anoLetivo = new Date().getFullYear();

  const [matriculasRes, valoresRes] = await Promise.all([
    supabase
      .from("matriculas")
      .select(`
        id, tipo_vaga, percentual_bolsa,
        alunos (
          id, nome, foto_url, matricula_codigo, celular, email,
          responsaveis_aluno ( nome, celular, telefone, parentesco, responsavel_financeiro )
        ),
        series ( nome, segmento ),
        turmas ( nome ),
        planos ( nome, valor_mensalidade )
      `)
      .eq("escola_id", escolaId)
      .eq("status", "ativa")
      .eq("ano_letivo", anoLetivo)
      .in("tipo_vaga", ["bolsa_integral", "bolsa_parcial", "permuta", "gratuita"]),
    supabase
      .from("valores_praticados")
      .select("segmento, valor_mensalidade")
      .eq("escola_id", escolaId)
      .eq("ano_letivo", anoLetivo)
      .eq("ordem_filho", 1),
  ]);

  const valorPorSegmento = new Map<string, number>();
  for (const v of (valoresRes.data ?? []) as Array<{ segmento: string; valor_mensalidade: number | string }>) {
    valorPorSegmento.set(v.segmento, Number(v.valor_mensalidade));
  }

  return ((matriculasRes.data ?? []) as any[]).map((m): BolsistaRow => {
    const aluno = pickOne(m.alunos);
    const serie = pickOne(m.series);
    const turma = pickOne(m.turmas);
    const plano = pickOne(m.planos);
    const responsaveis = (aluno?.responsaveis_aluno ?? []) as Array<{
      nome?: string;
      celular?: string;
      telefone?: string;
      parentesco?: string;
      responsavel_financeiro?: boolean;
    }>;
    const responsavel =
      responsaveis.find((r) => r.responsavel_financeiro) ??
      responsaveis[0] ??
      null;

    const segmento = serie?.segmento ?? "outros";
    const valorReferencia = valorPorSegmento.get(segmento) ?? Number(plano?.valor_mensalidade ?? 0);
    const tipoVaga = m.tipo_vaga as TipoVagaBolsa;
    const percentualBolsa = Number(m.percentual_bolsa ?? 0);
    const receitaPerdidaMes =
      tipoVaga === "bolsa_parcial"
        ? valorReferencia * (percentualBolsa / 100)
        : valorReferencia;

    return {
      matriculaId: m.id,
      alunoId: aluno?.id ?? "",
      nome: aluno?.nome ?? "—",
      fotoUrl: aluno?.foto_url ?? null,
      matriculaCodigo: aluno?.matricula_codigo ?? null,
      celular: aluno?.celular ?? null,
      email: aluno?.email ?? null,
      serie: serie?.nome ?? "—",
      turma: turma?.nome ?? "—",
      segmento,
      tipoVaga,
      percentualBolsa,
      responsavelNome: responsavel?.nome ?? null,
      responsavelCelular: responsavel?.celular ?? responsavel?.telefone ?? null,
      responsavelParentesco: responsavel?.parentesco ?? null,
      planoNome: plano?.nome ?? null,
      valorMensalidade: valorReferencia,
      receitaPerdidaMes,
    };
  }).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}
```

- [ ] **Step 2: Typecheck + lint**

```bash
npm run typecheck && npm run lint
```
Expected: só erro pré-existente.

- [ ] **Step 3: Commit**

```bash
git add src/lib/data/bolsistas.ts
git commit -m "feat(bolsistas): valorMensalidade usa valores_praticados por segmento (ordem 1)"
```

---

## Self-Review

**Spec coverage:**
- Tabela `valores_praticados` + RLS → Task 1 ✓
- Tabela `segmento_config` → Task 1 ✓
- Seeds 2025 + 2026 → Task 1 ✓
- Seed `segmento_config` → Task 1 ✓
- UPDATE turmas 2026 com capacidade real → Task 2 ✓
- Data layer (list, listAnos, getByKey) → Task 3 ✓
- Actions (upsert, criar-ano, remover-ano) → Task 4 ✓
- Input inline com autosave → Task 5 ✓
- Form criar ano → Task 6 ✓
- Página com matriz + edição inline + criar/remover ano → Task 7 ✓
- Item menu → Task 8 ✓
- Dashboard `getBeneficios` usa valores_praticados → Task 9 ✓
- Página Bolsistas reflete valor real → Task 10 ✓

**Type consistency:**
- `SegmentoSerie` exportado em Task 3, reusado em Tasks 4, 5, 7, 9, 10 ✓
- `ValorPraticado` exportado em Task 3, consumido em Task 7 ✓
- Action signatures (`upsertValorPraticadoAction`, `criarAnoLetivoAction`, `removerAnoLetivoAction`) batem entre Task 4 e Tasks 5/6/7 ✓
- `BeneficiosData` shape inalterado (mantém `total`, `porTipo`, `receitaPerdidaEstimada`) ✓
- `BolsistaRow.valorMensalidade` significado mudou (era plano fixo → agora valor referência segmento). Componente `/bolsistas/page.tsx` continua exibindo como mensalidade — aceitável.

**Riscos:**
- `valor_matricula` igual a `valor_mensalidade` por enquanto. Diretor pode pedir distinção depois — schema já comporta.
- Aluno em série sem segmento mapeado → fallback para `planos`. Se nem isso existir, valor=0.
- Migrations idempotentes (`on conflict do nothing`) — seguro re-aplicar.
