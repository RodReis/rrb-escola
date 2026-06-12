# Organograma de Alunos + Menu Secretaria — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar tabela `segmentos` no banco, menu "Secretaria" com dropdown na topbar, e página `/organograma` com sidebar hierárquica (Escola → Segmento → Turma) e painel de drill por turma com métricas financeiras.

**Architecture:** Migration SQL cria `segmentos` + FK em `series`. Dropdown de Secretaria é Client Component isolado inserido na Topbar (server). Organograma é Server Component com sidebar Client (collapse/busca) + painel de drill server via `searchParams`.

**Tech Stack:** Next.js App Router, Supabase (PostgreSQL + RLS), TypeScript, Tailwind CSS, Lucide React, `cn()` utilitário do projeto.

---

## Mapa de Arquivos

### Criar
- `supabase/migrations/202605220001_segmentos.sql` — tabela segmentos + FK series + seed + RLS
- `src/lib/data/organograma.ts` — queries: sidebar data + drill turma
- `src/app/(app)/organograma/page.tsx` — Server Component raiz da rota
- `src/components/organograma/sidebar.tsx` — Client Component: collapse, busca, seleção de turma
- `src/components/organograma/drill-panel.tsx` — Server Component: cards + tabela de turma
- `src/components/layout/secretaria-dropdown.tsx` — Client Component: dropdown menu Secretaria

### Modificar
- `src/components/layout/topbar.tsx` — inserir SecretariaDropdown, reorganizar primaryItems/secondaryItems
- `src/components/layout/topbar-nav-link.tsx` — adicionar ícone `BookOpen` e `Network` ao mapa

---

## Task 1: Migration — tabela `segmentos` + FK em `series` + seed

**Files:**
- Create: `supabase/migrations/202605220001_segmentos.sql`

- [ ] **Step 1: Criar arquivo de migration**

```sql
-- supabase/migrations/202605220001_segmentos.sql
-- Cria tabela segmentos, adiciona FK em series, seed dos 4 segmentos RRB.

create table segmentos (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references escolas(id) on delete cascade,
  nome text not null,
  ordem integer not null default 0,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  unique (escola_id, nome)
);

alter table series
  add column if not exists segmento_id uuid references segmentos(id) on delete set null;

-- RLS
alter table segmentos enable row level security;
create policy "service role full access segmentos" on segmentos for all to service_role using (true) with check (true);
create policy "authenticated read segmentos" on segmentos for select to authenticated
  using (escola_id in (select escola_id from perfis where user_id = auth.uid()));

-- Trigger updated_at para series (segmento_id change)
-- (series já tem trigger set_updated_at, não precisa recriar)

-- Seed: 4 segmentos para escola 00000000-0000-0000-0000-000000000001
insert into segmentos (id, escola_id, nome, ordem) values
  ('a0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Educação Infantil', 1),
  ('a0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Ensino Fundamental I', 2),
  ('a0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'Ensino Fundamental II', 3),
  ('a0000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'Ensino Médio', 4)
on conflict (escola_id, nome) do nothing;

-- Associar séries aos segmentos (usando IDs exatos do banco)
-- Educação Infantil: Maternal, Infantil 3, 4, 5 (Infantil I/II/III ficam sem segmento)
update series set segmento_id = 'a0000000-0000-0000-0000-000000000001'
  where id in (
    'd8f736c7-1b07-4c23-8212-6893a28d0d9e', -- Maternal
    'c98fb4b5-7400-4b77-bdc7-7e1da7721158', -- Infantil 3
    '4318deaa-148c-4091-9c00-1e44265c1b9f', -- Infantil 4
    '7bf3b47f-f27b-47f9-8cdf-d42d964f752d'  -- Infantil 5
  );

-- Ensino Fundamental I: 1º ao 5º Ano
update series set segmento_id = 'a0000000-0000-0000-0000-000000000002'
  where id in (
    '10000000-0000-0000-0000-000000000001', -- 1º Ano
    '10000000-0000-0000-0000-000000000002', -- 2º Ano
    '10000000-0000-0000-0000-000000000003', -- 3º Ano
    '10000000-0000-0000-0000-000000000004', -- 4º Ano
    '10000000-0000-0000-0000-000000000005'  -- 5º Ano
  );

-- Ensino Fundamental II: 6º ao 9º Ano
update series set segmento_id = 'a0000000-0000-0000-0000-000000000003'
  where id in (
    '3b91be2e-f658-48dd-b7ef-112dae9c7815', -- 6º Ano
    '2b215070-7f42-4734-bd76-751f4c965f25', -- 7º Ano
    '701c834e-8eb0-4228-9f75-9eb41b4eb5d0', -- 8º Ano
    '3ff76f09-57bf-4775-ab29-322b6b621aa7'  -- 9º Ano
  );

-- Ensino Médio: 1ª, 2ª, 3ª Série
update series set segmento_id = 'a0000000-0000-0000-0000-000000000004'
  where id in (
    'fc34bde5-c1d7-4986-a827-06d71be3a5a3', -- 1ª Série
    '7a93f03a-65b8-4b5f-97e4-3beda47d640d', -- 2ª Série
    '5a69fca7-1935-4c53-a89a-982601705a90'  -- 3ª Série
  );
```

- [ ] **Step 2: Aplicar migration**

```bash
npx supabase migration up --local
```

Expected output:
```
Applying migration 202605220001_segmentos.sql...
Local database is up to date.
```

- [ ] **Step 3: Verificar seed**

```bash
node -e "
const { createClient } = require('./node_modules/@supabase/supabase-js');
const fs = require('fs');
const envLines = fs.readFileSync('.env.local','utf8').split('\n');
for (const line of envLines) { const m = line.match(/^([^#=]+)=(.*)\$/); if (m) process.env[m[1].trim()]=m[2].trim(); }
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function main() {
  const { data } = await sb.from('segmentos').select('nome, ordem').order('ordem');
  console.log('Segmentos:', data);
  const { data: s } = await sb.from('series').select('nome, segmento_id').not('segmento_id','is',null).order('nome');
  console.log('Series com segmento:', s.length);
}
main();
"
```

Expected: 4 segmentos, 16 séries com `segmento_id` preenchido.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/202605220001_segmentos.sql
git commit -m "feat(db): add segmentos table, FK on series, seed RRB segments"
```

---

## Task 2: Query data — `src/lib/data/organograma.ts`

**Files:**
- Create: `src/lib/data/organograma.ts`

- [ ] **Step 1: Criar arquivo com duas funções**

```typescript
// src/lib/data/organograma.ts
import { createServerClient } from "@/lib/supabase/server";
import { DEFAULT_SCHOOL_ID } from "@/lib/constants";

// Retorna hierarquia completa para a sidebar: segmentos → turmas com contagem de alunos.
export async function getOrganogramaTree() {
  const supabase = await createServerClient();

  const { data: segmentos, error: segErr } = await supabase
    .from("segmentos")
    .select("id, nome, ordem")
    .eq("escola_id", DEFAULT_SCHOOL_ID)
    .eq("ativo", true)
    .order("ordem");

  if (segErr) throw segErr;

  const { data: series, error: serErr } = await supabase
    .from("series")
    .select("id, nome, ordem, segmento_id")
    .eq("escola_id", DEFAULT_SCHOOL_ID)
    .not("segmento_id", "is", null)
    .order("ordem");

  if (serErr) throw serErr;

  const { data: turmas, error: turErr } = await supabase
    .from("turmas")
    .select("id, nome, serie_id")
    .eq("escola_id", DEFAULT_SCHOOL_ID)
    .eq("ano_letivo", 2026)
    .order("nome");

  if (turErr) throw turErr;

  const { data: matriculas, error: matErr } = await supabase
    .from("matriculas")
    .select("turma_id")
    .eq("escola_id", DEFAULT_SCHOOL_ID)
    .eq("ano_letivo", 2026)
    .eq("status", "ativa");

  if (matErr) throw matErr;

  // Conta alunos por turma
  const countByTurma = new Map<string, number>();
  for (const m of matriculas ?? []) {
    if (m.turma_id) {
      countByTurma.set(m.turma_id, (countByTurma.get(m.turma_id) ?? 0) + 1);
    }
  }

  // Monta árvore: segmento → turmas (via série)
  const serieBySegmento = new Map<string, typeof series>();
  for (const s of series ?? []) {
    if (!s.segmento_id) continue;
    const arr = serieBySegmento.get(s.segmento_id) ?? [];
    arr.push(s);
    serieBySegmento.set(s.segmento_id, arr);
  }

  const turmasBySerie = new Map<string, Array<{ id: string; nome: string; alunos: number }>>();
  for (const t of turmas ?? []) {
    const arr = turmasBySerie.get(t.serie_id) ?? [];
    arr.push({ id: t.id, nome: t.nome, alunos: countByTurma.get(t.id) ?? 0 });
    turmasBySerie.set(t.serie_id, arr);
  }

  const tree = (segmentos ?? []).map((seg) => {
    const segs = serieBySegmento.get(seg.id) ?? [];
    const turmasDoSegmento = segs.flatMap((s) =>
      (turmasBySerie.get(s.id) ?? []).map((t) => ({
        ...t,
        serieNome: s.nome
      }))
    );
    return {
      id: seg.id,
      nome: seg.nome,
      alunos: turmasDoSegmento.reduce((sum, t) => sum + t.alunos, 0),
      turmas: turmasDoSegmento
    };
  });

  const totalAlunos = tree.reduce((sum, seg) => sum + seg.alunos, 0);

  return { tree, totalAlunos };
}

// Retorna dados de drill de uma turma específica.
export async function getOrganogramaDrill(turmaId: string) {
  const supabase = await createServerClient();
  const now = new Date();
  const competencia = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const { data: matriculas, error: matErr } = await supabase
    .from("matriculas")
    .select("id, aluno_id, alunos(id, nome, matricula_codigo), turmas(id, nome, series(nome, segmentos(nome)))")
    .eq("turma_id", turmaId)
    .eq("escola_id", DEFAULT_SCHOOL_ID)
    .eq("status", "ativa")
    .eq("ano_letivo", 2026)
    .order("alunos(nome)");

  if (matErr) throw matErr;

  if (!matriculas || matriculas.length === 0) {
    return { turma: null, alunos: [], somaSala: 0, ticketMedio: 0 };
  }

  const alunoIds = matriculas.map((m) => m.aluno_id).filter(Boolean) as string[];

  // Cobranças do mês atual para os alunos desta turma
  const { data: cobrancas, error: cobErr } = await supabase
    .from("cobrancas")
    .select("aluno_id, valor_final")
    .eq("escola_id", DEFAULT_SCHOOL_ID)
    .eq("competencia", competencia)
    .neq("status", "cancelada")
    .in("aluno_id", alunoIds);

  if (cobErr) throw cobErr;

  const valorByAluno = new Map<string, number>();
  for (const c of cobrancas ?? []) {
    if (c.aluno_id) valorByAluno.set(c.aluno_id, Number(c.valor_final ?? 0));
  }

  // Responsáveis financeiros
  const { data: responsaveis, error: respErr } = await supabase
    .from("responsaveis_aluno")
    .select("aluno_id, nome")
    .eq("responsavel_financeiro", true)
    .in("aluno_id", alunoIds);

  if (respErr) throw respErr;

  const respByAluno = new Map<string, string>();
  for (const r of responsaveis ?? []) {
    if (r.aluno_id && !respByAluno.has(r.aluno_id)) {
      respByAluno.set(r.aluno_id, r.nome);
    }
  }

  // Monta lista de alunos
  const alunosList = matriculas.map((m) => {
    const aluno = Array.isArray(m.alunos) ? m.alunos[0] : m.alunos;
    return {
      id: aluno?.id ?? "",
      nome: aluno?.nome ?? "",
      respFinanceiro: respByAluno.get(aluno?.id ?? "") ?? null,
      mensalidade: valorByAluno.get(aluno?.id ?? "") ?? null
    };
  });

  const somaSala = alunosList.reduce((sum, a) => sum + (a.mensalidade ?? 0), 0);
  const ticketMedio = alunosList.length > 0 ? somaSala / alunosList.length : 0;

  // Info da turma
  const primeiraMatricula = matriculas[0];
  const turmaInfo = Array.isArray(primeiraMatricula.turmas)
    ? primeiraMatricula.turmas[0]
    : primeiraMatricula.turmas;
  const serieInfo = turmaInfo
    ? (Array.isArray((turmaInfo as { series: unknown }).series)
        ? (turmaInfo as { series: Array<{ nome: string; segmentos: unknown }> }).series[0]
        : (turmaInfo as { series: { nome: string; segmentos: unknown } }).series)
    : null;
  const segmentoInfo = serieInfo
    ? (Array.isArray(serieInfo.segmentos)
        ? (serieInfo as { nome: string; segmentos: Array<{ nome: string }> }).segmentos[0]
        : (serieInfo as { nome: string; segmentos: { nome: string } }).segmentos)
    : null;

  return {
    turma: {
      id: turmaId,
      nome: turmaInfo?.nome ?? "",
      serieNome: serieInfo?.nome ?? "",
      segmentoNome: (segmentoInfo as { nome: string } | null)?.nome ?? ""
    },
    alunos: alunosList,
    somaSala,
    ticketMedio,
    competencia
  };
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/lib/data/organograma.ts
git commit -m "feat(data): add organograma queries - tree sidebar + drill turma"
```

---

## Task 3: Sidebar Client Component

**Files:**
- Create: `src/components/organograma/sidebar.tsx`

- [ ] **Step 1: Criar componente**

```tsx
// src/components/organograma/sidebar.tsx
"use client";

import { useState, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, ChevronRight, Search } from "lucide-react";
import { cn } from "@/lib/utils";

type Turma = { id: string; nome: string; alunos: number; serieNome: string };
type Segmento = { id: string; nome: string; alunos: number; turmas: Turma[] };

const segmentoBulletColor: Record<string, string> = {
  "Educação Infantil": "bg-yellow-400",
  "Ensino Fundamental I": "bg-blue-500",
  "Ensino Fundamental II": "bg-green-500",
  "Ensino Médio": "bg-red-500"
};

export function OrganogramaSidebar({
  tree,
  totalAlunos,
  escolaNome
}: {
  tree: Segmento[];
  totalAlunos: number;
  escolaNome: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const turmaAtiva = searchParams.get("turma");

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [busca, setBusca] = useState("");

  function toggleSegmento(id: string) {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function selectTurma(id: string) {
    router.push(`/organograma?turma=${id}`);
  }

  const filtered = useMemo(() => {
    if (!busca.trim()) return tree;
    const q = busca.toLowerCase();
    return tree
      .map((seg) => ({
        ...seg,
        turmas: seg.turmas.filter(
          (t) => t.nome.toLowerCase().includes(q) || t.serieNome.toLowerCase().includes(q)
        )
      }))
      .filter((seg) => seg.turmas.length > 0);
  }, [tree, busca]);

  return (
    <aside className="flex w-[280px] shrink-0 flex-col gap-4 border-r border-line pr-4">
      {/* Busca */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink/40" />
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar aluno ou turma..."
          className="w-full rounded-ui border border-line bg-surface py-2 pl-8 pr-3 text-sm outline-none focus:border-brand"
        />
      </div>

      {/* Escola */}
      <div className="flex items-center gap-2 rounded-ui bg-muted px-3 py-2">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand/10 text-brand text-xs font-black">
          {escolaNome.slice(0, 2).toUpperCase()}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-black text-ink">{escolaNome}</p>
          <p className="text-xs text-ink/55">{totalAlunos} alunos · {tree.length} segmentos</p>
        </div>
      </div>

      {/* Árvore */}
      <nav className="flex flex-col gap-1">
        {filtered.map((seg) => {
          const isOpen = expanded[seg.id] ?? false;
          const bullet = segmentoBulletColor[seg.nome] ?? "bg-ink/30";

          return (
            <div key={seg.id}>
              <button
                onClick={() => toggleSegmento(seg.id)}
                className="flex w-full items-center gap-2 rounded-ui px-2 py-2 text-left text-sm font-black text-ink hover:bg-muted"
              >
                <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", bullet)} />
                <span className="flex-1 truncate">{seg.nome}</span>
                <span className="text-xs font-medium text-ink/50">
                  {seg.alunos} · {seg.turmas.length} turmas
                </span>
                {isOpen
                  ? <ChevronDown size={14} className="shrink-0 text-ink/40" />
                  : <ChevronRight size={14} className="shrink-0 text-ink/40" />
                }
              </button>

              {isOpen && (
                <div className="ml-4 mt-0.5 flex flex-col gap-0.5 border-l border-line pl-3">
                  {seg.turmas.map((turma) => {
                    const isActive = turmaAtiva === turma.id;
                    return (
                      <button
                        key={turma.id}
                        onClick={() => selectTurma(turma.id)}
                        className={cn(
                          "flex w-full items-center justify-between rounded-ui px-2 py-1.5 text-left text-sm transition",
                          isActive
                            ? "border-l-2 border-brand bg-brand/8 font-black text-brand -ml-[1px]"
                            : "font-medium text-ink/75 hover:bg-muted hover:text-ink"
                        )}
                      >
                        <span className="truncate">{turma.serieNome} - {turma.nome}</span>
                        <span className="ml-2 shrink-0 text-xs text-ink/45">{turma.alunos} alunos</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/components/organograma/sidebar.tsx
git commit -m "feat(organograma): add sidebar client component with collapse and search"
```

---

## Task 4: Drill Panel Server Component

**Files:**
- Create: `src/components/organograma/drill-panel.tsx`

- [ ] **Step 1: Criar componente**

```tsx
// src/components/organograma/drill-panel.tsx
import { money } from "@/lib/constants";
import { Card } from "@/components/ui/card";
import type { getOrganogramaDrill } from "@/lib/data/organograma";

type DrillData = Awaited<ReturnType<typeof getOrganogramaDrill>>;

export function OrganogramaDrillPanel({ data }: { data: DrillData }) {
  if (!data.turma) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-ink/50">
        Selecione uma turma na sidebar para ver o detalhamento.
      </div>
    );
  }

  const { turma, alunos, somaSala, ticketMedio } = data;

  return (
    <div className="flex flex-1 flex-col gap-6 min-w-0">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <p className="text-sm font-black text-ink/60">Detalhamento da turma</p>
            <span className="rounded bg-accent/15 px-2 py-0.5 text-[0.65rem] font-black uppercase tracking-wider text-accent">
              DRILL
            </span>
          </div>
          <h2 className="mt-1 text-2xl font-black text-ink">{turma.serieNome} - {turma.nome}</h2>
          <p className="text-sm text-ink/55">{turma.segmentoNome}</p>
        </div>
        <p className="text-xs text-ink/40 text-right">
          {turma.segmentoNome} · {turma.serieNome} - {turma.nome}
        </p>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="p-5">
          <p className="ds-kicker">Alunos</p>
          <strong className="mt-2 block text-3xl font-black text-ink">{alunos.length}</strong>
        </Card>
        <Card className="p-5">
          <p className="ds-kicker">Soma da Sala</p>
          <strong className="mt-2 block text-2xl font-black text-green-600">
            {money.format(somaSala)}
          </strong>
        </Card>
        <Card className="p-5">
          <p className="ds-kicker">Ticket Médio</p>
          <strong className="mt-2 block text-2xl font-black text-yellow-600">
            {money.format(ticketMedio)}
          </strong>
        </Card>
      </div>

      {/* Tabela */}
      <div className="overflow-x-auto rounded-ui border border-line">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line bg-muted">
              <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider text-ink/50">#</th>
              <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider text-ink/50">Aluno</th>
              <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider text-ink/50">Resp. Financ.</th>
              <th className="px-4 py-3 text-right text-xs font-black uppercase tracking-wider text-ink/50">Mensalidade</th>
            </tr>
          </thead>
          <tbody>
            {alunos.map((aluno, idx) => (
              <tr key={aluno.id} className="border-b border-line last:border-0 hover:bg-muted/50">
                <td className="px-4 py-3 text-ink/40">{idx + 1}</td>
                <td className="px-4 py-3 font-medium text-ink">{aluno.nome}</td>
                <td className="px-4 py-3 text-brand">{aluno.respFinanceiro ?? "-"}</td>
                <td className="px-4 py-3 text-right font-medium text-ink">
                  {aluno.mensalidade != null ? money.format(aluno.mensalidade) : "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/components/organograma/drill-panel.tsx
git commit -m "feat(organograma): add drill panel component - cards + table"
```

---

## Task 5: Page `/organograma`

**Files:**
- Create: `src/app/(app)/organograma/page.tsx`

- [ ] **Step 1: Criar page**

```tsx
// src/app/(app)/organograma/page.tsx
import { OrganogramaSidebar } from "@/components/organograma/sidebar";
import { OrganogramaDrillPanel } from "@/components/organograma/drill-panel";
import { getOrganogramaTree, getOrganogramaDrill } from "@/lib/data/organograma";

export default async function OrganogramaPage({
  searchParams
}: {
  searchParams: Promise<{ turma?: string }>;
}) {
  const params = await searchParams;
  const turmaId = params.turma ?? null;

  const [{ tree, totalAlunos }, drillData] = await Promise.all([
    getOrganogramaTree(),
    turmaId ? getOrganogramaDrill(turmaId) : Promise.resolve({ turma: null, alunos: [], somaSala: 0, ticketMedio: 0, competencia: "" })
  ]);

  return (
    <div className="grid gap-6">
      <section className="-mx-4 -mt-6 border-b border-line bg-surface px-4 py-6 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <p className="flex items-center gap-3 text-[0.66rem] font-black uppercase tracking-[0.16em] text-ink/58">
            <span>Secretaria</span>
            <span className="text-line">/</span>
            <span className="text-brand">Organograma</span>
          </p>
          <h1 className="mt-4 text-4xl font-black leading-none text-brand md:text-5xl">
            Organograma <span className="font-serif italic text-ink/42">de alunos</span>
          </h1>
        </div>
      </section>

      <div className="mx-auto flex w-full max-w-7xl gap-8">
        <OrganogramaSidebar
          tree={tree}
          totalAlunos={totalAlunos}
          escolaNome="Colégio RRB"
        />
        <OrganogramaDrillPanel data={drillData} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Expected: sem erros.

- [ ] **Step 3: Testar no browser**

```bash
npm run dev
```

Navegar para `http://localhost:3000/organograma`. Verificar:
- Sidebar aparece com segmentos colapsáveis
- Clicar num segmento expande as turmas
- Clicar numa turma navega para `?turma=<id>` e mostra drill panel

- [ ] **Step 4: Commit**

```bash
git add src/app/(app)/organograma/page.tsx
git commit -m "feat(organograma): add /organograma page with sidebar + drill"
```

---

## Task 6: Dropdown Secretaria + Reorganizar Topbar

**Files:**
- Create: `src/components/layout/secretaria-dropdown.tsx`
- Modify: `src/components/layout/topbar.tsx`
- Modify: `src/components/layout/topbar-nav-link.tsx`

- [ ] **Step 1: Adicionar ícones `BookOpen` e `Network` ao topbar-nav-link**

Em `src/components/layout/topbar-nav-link.tsx`, adicionar ao import lucide e ao objeto `icons`:

```tsx
import {
  BarChart3,
  BookOpen,
  CalendarCheck,
  CreditCard,
  DoorOpen,
  FileText,
  GraduationCap,
  Inbox,
  Layers3,
  LayoutDashboard,
  Network,
  ReceiptText,
  UsersRound
} from "lucide-react";

const icons = {
  BarChart3,
  BookOpen,
  CalendarCheck,
  CreditCard,
  DoorOpen,
  FileText,
  GraduationCap,
  Inbox,
  Layers3,
  LayoutDashboard,
  Network,
  ReceiptText,
  UsersRound
};
```

- [ ] **Step 2: Criar SecretariaDropdown**

```tsx
// src/components/layout/secretaria-dropdown.tsx
"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  FileText,
  GraduationCap,
  Inbox,
  Layers3,
  Network,
  UsersRound,
  ChevronDown
} from "lucide-react";
import { cn } from "@/lib/utils";

const secretariaItems = [
  { href: "/alunos", label: "Alunos", icon: UsersRound },
  { href: "/matriculas", label: "Matrículas", icon: FileText },
  { href: "/series", label: "Séries", icon: Layers3 },
  { href: "/turmas", label: "Turmas", icon: GraduationCap },
  { href: "/organograma", label: "Organograma", icon: Network },
  { href: "/importacoes", label: "Importações", icon: Inbox }
];

const secretariaHrefs = secretariaItems.map((i) => i.href);

export function SecretariaDropdown() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const isActive = secretariaHrefs.some(
    (href) => pathname === href || pathname.startsWith(`${href}/`)
  );

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex h-10 shrink-0 items-center gap-2 rounded-ui px-3 text-sm font-black transition",
          isActive
            ? "bg-brand text-paper shadow-soft"
            : "text-ink hover:bg-muted"
        )}
      >
        <BookOpen size={17} />
        Secretaria
        <ChevronDown size={14} className={cn("transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-48 rounded-ui border border-line bg-surface shadow-soft">
          {secretariaItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 text-sm transition first:rounded-t-ui last:rounded-b-ui",
                  active
                    ? "bg-brand/10 font-black text-brand"
                    : "font-medium text-ink hover:bg-muted"
                )}
              >
                <Icon size={15} />
                {item.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Atualizar topbar.tsx**

Substituir conteúdo de `src/components/layout/topbar.tsx`:

```tsx
import Link from "next/link";
import { TopbarNavLink, type TopbarIconName } from "@/components/layout/topbar-nav-link";
import { SecretariaDropdown } from "@/components/layout/secretaria-dropdown";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { LogOut, School } from "lucide-react";
import { logoutAction } from "@/lib/actions/auth";
import type { SessionProfile } from "@/lib/auth/session";

const primaryItems: Array<{ href: string; label: string; icon: TopbarIconName }> = [
  { href: "/", label: "Dashboard", icon: "LayoutDashboard" },
  { href: "/financeiro", label: "Financeiro", icon: "BarChart3" },
  { href: "/portaria", label: "Portaria", icon: "DoorOpen" }
];

const secondaryItems: Array<{ href: string; label: string; icon: TopbarIconName }> = [
  { href: "/usuarios", label: "Usuários", icon: "UsersRound" },
  { href: "/planos", label: "Planos", icon: "CreditCard" },
  { href: "/frequencias", label: "Frequência", icon: "CalendarCheck" },
  { href: "/relatorios/alunos", label: "Rel. Alunos", icon: "UsersRound" },
  { href: "/relatorios/inadimplencia", label: "Inadimplência", icon: "ReceiptText" },
  { href: "/relatorios/frequencia", label: "Rel. Frequência", icon: "CalendarCheck" }
];

function BrandMark() {
  return (
    <span className="relative grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-ui bg-brand text-paper">
      <span className="absolute -right-2 top-0 h-14 w-8 rotate-[34deg] bg-accent" />
      <School className="relative z-10" size={22} />
    </span>
  );
}

export function Topbar({ perfil }: { perfil: SessionProfile }) {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface/90 backdrop-blur-xl">
      <div className="mx-auto flex min-h-[72px] max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex min-w-[190px] items-center gap-3">
          <BrandMark />
          <span className="leading-none">
            <strong className="block text-lg font-black text-ink">Lectiva</strong>
            <small className="text-[0.68rem] font-black uppercase tracking-[0.16em] text-accent">CRM Escola</small>
          </span>
        </Link>

        <nav className="no-scrollbar flex min-w-0 flex-1 items-center gap-1 overflow-x-auto py-3">
          {primaryItems.map((item) => (
            <TopbarNavLink key={item.href} href={item.href} label={item.label} icon={item.icon} variant="primary" />
          ))}
          <SecretariaDropdown />
          <span className="mx-2 h-7 w-px shrink-0 bg-line" />
          {secondaryItems.map((item) => (
            <TopbarNavLink key={item.href} href={item.href} label={item.label} icon={item.icon} variant="secondary" />
          ))}
        </nav>

        <ThemeToggle className="shrink-0" />
        <div className="hidden text-right text-xs leading-tight md:block">
          <strong className="block font-bold text-ink">{perfil.nome}</strong>
          <span className="block font-medium text-muted">{perfil.email}</span>
        </div>
        <form action={logoutAction} className="shrink-0">
          <button className="ds-button ds-button-secondary h-10 min-h-10 px-3" title="Sair do sistema" aria-label="Sair do sistema">
            <LogOut size={16} />
          </button>
        </form>
      </div>
    </header>
  );
}
```

- [ ] **Step 4: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Expected: sem erros.

- [ ] **Step 5: Testar no browser**

```bash
npm run dev
```

Verificar:
- Topbar mostra Dashboard, Financeiro, Portaria, **Secretaria** (dropdown), separador, itens secundários
- Clicar "Secretaria" abre dropdown com 6 itens
- Clicar fora fecha dropdown
- Navegar para `/alunos` → "Secretaria" fica highlighted (active)
- Navegar para `/organograma` → "Secretaria" fica highlighted

- [ ] **Step 6: Commit**

```bash
git add src/components/layout/secretaria-dropdown.tsx src/components/layout/topbar.tsx src/components/layout/topbar-nav-link.tsx
git commit -m "feat(nav): add Secretaria dropdown menu, move cadastros items, add Organograma"
```

---

## Task 7: Commit final e verificação integrada

- [ ] **Step 1: Build de produção**

```bash
npm run build
```

Expected: sem erros de build. Warnings de tipo são aceitáveis, erros não.

- [ ] **Step 2: Verificação visual completa**

```bash
npm run dev
```

Cheklist:
- [ ] `/organograma` — sidebar carrega com 4 segmentos
- [ ] Clicar "Educação Infantil" → expande turmas com contagem
- [ ] Clicar turma → URL muda para `?turma=<id>`, drill panel mostra cards e tabela
- [ ] Soma da Sala bate com soma manual de 2-3 alunos na planilha
- [ ] Resp. Financeiro aparece para alunos que têm `responsavel_financeiro=true`
- [ ] Busca filtra turmas em tempo real
- [ ] Dropdown "Secretaria" abre/fecha, fecha ao navegar
- [ ] Páginas /alunos, /matriculas, /series, /turmas, /organograma, /importacoes acessíveis via dropdown

- [ ] **Step 3: Commit final**

```bash
git add -A
git commit -m "feat(organograma): complete organograma feature + Secretaria menu"
```
