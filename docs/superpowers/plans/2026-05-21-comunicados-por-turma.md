# Comunicados por Turma/Série — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que um comunicado seja direcionado a turmas e/ou séries específicas (alcance `segmentado`), além de `geral`/`individual`.

**Architecture:** Novo valor de enum `segmentado` + coluna `alvos` jsonb em `comunicados`. `resolverDestinatarios` ganha o caso `segmentado`: expande séries em turmas, junta com turmas diretas, resolve os alunos ativos dessas turmas → responsável financeiro. Form ganha multi-seleção de turmas/séries.

**Tech Stack:** TypeScript, Next.js 14, Supabase, Vitest.

**Spec:** `docs/superpowers/specs/2026-05-21-comunicados-por-turma-design.md`
**Branch:** criar `feature/comunicados-por-turma` a partir de `developer`.

---

## File Structure

**Criar:**
- `supabase/migrations/202605310006_comunicados_segmentado.sql` — enum + coluna alvos

**Modificar:**
- `src/lib/comunicados/destinatarios.ts` — caso `segmentado`, `coletarTurmaIds`, tipo `Alvo`
- `src/lib/comunicados/destinatarios.test.ts` — testes de `coletarTurmaIds`
- `src/lib/data/comunicados.ts` — `getComunicado` retorna `alvos`; nova `listTurmasESeries`
- `src/lib/actions/comunicados.ts` — `criarComunicadoAction` aceita `segmentado` + `alvos`
- `src/components/comunicados/novo-comunicado-form.tsx` — modo segmentado + multi-select
- `src/app/(app)/comunicados/novo/page.tsx` — carrega turmas + séries
- `src/app/(app)/comunicados/[id]/page.tsx` — exibe alvos do comunicado segmentado

---

## Task 0: Branch

- [ ] **Step 1: Criar a branch a partir de `developer`**

Run:
```bash
git checkout developer
git checkout -b feature/comunicados-por-turma
```
Expected: `Switched to a new branch 'feature/comunicados-por-turma'`.

---

## Task 1: Migração — enum `segmentado` + coluna `alvos`

`ALTER TYPE ... ADD VALUE` não pode rodar dentro de um bloco de transação junto com uso
imediato do valor. Por isso a migração só adiciona o valor e a coluna — nenhum uso do
valor novo no mesmo script.

**Files:**
- Create: `supabase/migrations/202605310006_comunicados_segmentado.sql`

- [ ] **Step 1: Criar a migração**

`supabase/migrations/202605310006_comunicados_segmentado.sql`:

```sql
-- Comunicados por turma/série: novo alcance "segmentado" + coluna de alvos.

alter type alcance_comunicado add value if not exists 'segmentado';

alter table comunicados
  add column if not exists alvos jsonb not null default '[]'::jsonb;
```

- [ ] **Step 2: Aplicar via MCP Supabase**

Aplicar `202605310006_comunicados_segmentado.sql` no projeto `fljkjhmwnjehsodvqaqk` via MCP
`apply_migration` (name: `202605310006_comunicados_segmentado`).
Expected: `{"success": true}`.

- [ ] **Step 3: Verificar**

Via MCP `execute_sql` no projeto `fljkjhmwnjehsodvqaqk`:

```sql
SELECT enumlabel FROM pg_enum
  WHERE enumtypid = 'alcance_comunicado'::regtype ORDER BY enumsortorder;
SELECT column_name FROM information_schema.columns
  WHERE table_name='comunicados' AND column_name='alvos';
```

Expected: enum lista `geral`, `individual`, `segmentado`; coluna `alvos` existe.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/202605310006_comunicados_segmentado.sql
git commit -m "feat(comunicados): add segmentado alcance and alvos column"
```

---

## Task 2: Função pura `coletarTurmaIds` (TDD)

Dado os alvos (turmas + séries) e um mapa `serieId → turmaId[]`, retorna o conjunto único
de ids de turma.

**Files:**
- Modify: `src/lib/comunicados/destinatarios.ts`
- Modify: `src/lib/comunicados/destinatarios.test.ts`

- [ ] **Step 1: Adicionar o teste**

Acrescentar ao final de `src/lib/comunicados/destinatarios.test.ts`:

```typescript
import { coletarTurmaIds } from "./destinatarios";

describe("coletarTurmaIds", () => {
  const turmasPorSerie: Record<string, string[]> = {
    "serie-1": ["turma-a", "turma-b"],
    "serie-2": ["turma-c"],
  };

  it("só turmas diretas", () => {
    const r = coletarTurmaIds(
      [
        { tipo: "turma", id: "turma-x" },
        { tipo: "turma", id: "turma-y" },
      ],
      turmasPorSerie,
    );
    expect(r.sort()).toEqual(["turma-x", "turma-y"]);
  });

  it("série expande para suas turmas", () => {
    const r = coletarTurmaIds([{ tipo: "serie", id: "serie-1" }], turmasPorSerie);
    expect(r.sort()).toEqual(["turma-a", "turma-b"]);
  });

  it("mistura turmas diretas e séries", () => {
    const r = coletarTurmaIds(
      [
        { tipo: "turma", id: "turma-x" },
        { tipo: "serie", id: "serie-2" },
      ],
      turmasPorSerie,
    );
    expect(r.sort()).toEqual(["turma-c", "turma-x"]);
  });

  it("deduplica turma que aparece direta e via série", () => {
    const r = coletarTurmaIds(
      [
        { tipo: "turma", id: "turma-a" },
        { tipo: "serie", id: "serie-1" },
      ],
      turmasPorSerie,
    );
    expect(r.sort()).toEqual(["turma-a", "turma-b"]);
  });

  it("série sem turmas conhecidas é ignorada", () => {
    const r = coletarTurmaIds([{ tipo: "serie", id: "serie-inexistente" }], turmasPorSerie);
    expect(r).toEqual([]);
  });

  it("alvos vazios retornam lista vazia", () => {
    expect(coletarTurmaIds([], turmasPorSerie)).toEqual([]);
  });
});
```

- [ ] **Step 2: Rodar — deve FALHAR**

Run: `npx vitest run src/lib/comunicados/destinatarios.test.ts`
Expected: FAIL — `coletarTurmaIds` não existe.

- [ ] **Step 3: Implementar**

Em `src/lib/comunicados/destinatarios.ts`, no topo (após o import), adicionar o tipo `Alvo`:

```typescript
export type Alvo = { tipo: "turma" | "serie"; id: string };
```

E adicionar a função `coletarTurmaIds` (pode ser logo após `filtrarDestinatarios`):

```typescript
// Parte pura: junta as turmas diretas com as turmas expandidas das séries.
// turmasPorSerie mapeia serieId → lista de turmaIds. Resultado deduplicado.
export function coletarTurmaIds(
  alvos: Alvo[],
  turmasPorSerie: Record<string, string[]>,
): string[] {
  const ids = new Set<string>();
  for (const alvo of alvos) {
    if (alvo.tipo === "turma") {
      ids.add(alvo.id);
    } else {
      for (const turmaId of turmasPorSerie[alvo.id] ?? []) {
        ids.add(turmaId);
      }
    }
  }
  return Array.from(ids);
}
```

- [ ] **Step 4: Rodar — deve PASSAR**

Run: `npx vitest run src/lib/comunicados/destinatarios.test.ts`
Expected: PASS — os testes de `coletarTurmaIds` (6) + os existentes de `filtrarDestinatarios`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/comunicados/destinatarios.ts src/lib/comunicados/destinatarios.test.ts
git commit -m "feat(comunicados): add coletarTurmaIds pure function"
```

---

## Task 3: `resolverDestinatarios` trata o caso `segmentado`

A função ganha o parâmetro `alvos` e o caminho `segmentado`.

**Files:**
- Modify: `src/lib/comunicados/destinatarios.ts`

- [ ] **Step 1: Reescrever `resolverDestinatarios`**

Substituir a função `resolverDestinatarios` inteira por:

```typescript
type SupabaseLike = {
  from: (table: string) => any;
};

// Parte com I/O: resolve os destinatários conforme o alcance do comunicado.
export async function resolverDestinatarios(
  supabase: SupabaseLike,
  alcance: "geral" | "individual" | "segmentado",
  alunoId: string | null,
  alvos: Alvo[],
  escolaId: string = DEFAULT_SCHOOL_ID,
): Promise<Destinatario[]> {
  // Guard: individual sem aluno definido não vira envio geral.
  if (alcance === "individual" && !alunoId) {
    return [];
  }
  // Guard: segmentado sem alvos não vira envio geral.
  if (alcance === "segmentado" && alvos.length === 0) {
    return [];
  }

  let query = supabase
    .from("alunos")
    .select("id, responsaveis_aluno(celular, responsavel_financeiro), matriculas!inner(status, turma_id)")
    .eq("escola_id", escolaId)
    .eq("matriculas.status", "ativa");

  if (alcance === "individual" && alunoId) {
    query = query.eq("id", alunoId);
  }

  if (alcance === "segmentado") {
    // Expande as séries dos alvos em turmas.
    const serieIds = alvos.filter((a) => a.tipo === "serie").map((a) => a.id);
    const turmasPorSerie: Record<string, string[]> = {};
    if (serieIds.length > 0) {
      const { data: turmasData } = await supabase
        .from("turmas")
        .select("id, serie_id")
        .eq("escola_id", escolaId)
        .in("serie_id", serieIds);
      for (const t of (turmasData ?? []) as Array<{ id: string; serie_id: string }>) {
        (turmasPorSerie[t.serie_id] ??= []).push(t.id);
      }
    }
    const turmaIds = coletarTurmaIds(alvos, turmasPorSerie);
    if (turmaIds.length === 0) return [];
    query = query.in("matriculas.turma_id", turmaIds);
  }

  const { data } = await query;

  // Dedup de alunos (o join com matriculas pode repetir a linha do aluno).
  const vistos = new Set<string>();
  const unicos: AlunoRow[] = [];
  for (const row of (data ?? []) as AlunoRow[]) {
    if (vistos.has(row.id)) continue;
    vistos.add(row.id);
    unicos.push(row);
  }

  return filtrarDestinatarios(unicos);
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: ERRO esperado em `src/lib/actions/comunicados.ts` (chama `resolverDestinatarios`
com a assinatura antiga — corrigido na Task 5). Confirmar que NÃO há erro dentro de
`destinatarios.ts`.

- [ ] **Step 3: Rodar os testes**

Run: `npx vitest run src/lib/comunicados/destinatarios.test.ts`
Expected: PASS — todos (a função pura `coletarTurmaIds` e `filtrarDestinatarios` não
mudaram comportamento).

- [ ] **Step 4: Commit**

```bash
git add src/lib/comunicados/destinatarios.ts
git commit -m "feat(comunicados): resolve recipients for segmentado alcance"
```

---

## Task 4: Data layer — `alvos` e `listTurmasESeries`

`getComunicado` passa a retornar `alvos`; nova função leve lista turmas + séries.

**Files:**
- Modify: `src/lib/data/comunicados.ts`

- [ ] **Step 1: Adicionar `alvos` ao tipo e ao mapper**

Em `src/lib/data/comunicados.ts`:

(a) Importar o tipo `Alvo` no topo:
```typescript
import type { Alvo } from "@/lib/comunicados/destinatarios";
```

(b) No tipo `ComunicadoRow`, adicionar o campo `alvos`:
```typescript
  alvos: Alvo[];
```
Colocá-lo logo após `alunoId`.

(c) Atualizar o `alcance` no tipo `ComunicadoRow` para incluir `segmentado`:
```typescript
  alcance: "geral" | "individual" | "segmentado";
```

(d) Na função `mapComunicado`, adicionar ao objeto retornado:
```typescript
    alvos: Array.isArray(row.alvos) ? row.alvos : [],
```

- [ ] **Step 2: Adicionar `listTurmasESeries`**

Acrescentar ao final de `src/lib/data/comunicados.ts`:

```typescript
export type TurmaLite = { id: string; nome: string; anoLetivo: number; serieNome: string };
export type SerieLite = { id: string; nome: string };

export async function listTurmasESeries(
  escolaId: string = DEFAULT_SCHOOL_ID,
): Promise<{ turmas: TurmaLite[]; series: SerieLite[] }> {
  const supabase = await createServerClient();

  const [turmasRes, seriesRes] = await Promise.all([
    supabase
      .from("turmas")
      .select("id, nome, ano_letivo, series(nome)")
      .eq("escola_id", escolaId)
      .eq("ativo", true)
      .order("ano_letivo", { ascending: false }),
    supabase
      .from("series")
      .select("id, nome")
      .eq("escola_id", escolaId)
      .order("ordem"),
  ]);

  const turmas: TurmaLite[] = ((turmasRes.data ?? []) as any[]).map((t) => ({
    id: t.id,
    nome: t.nome,
    anoLetivo: t.ano_letivo,
    serieNome: Array.isArray(t.series) ? (t.series[0]?.nome ?? "") : (t.series?.nome ?? ""),
  }));

  const series: SerieLite[] = ((seriesRes.data ?? []) as any[]).map((s) => ({
    id: s.id,
    nome: s.nome,
  }));

  return { turmas, series };
}
```

- [ ] **Step 3: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: erro ainda só em `actions/comunicados.ts` (Task 5). Sem erro em `data/comunicados.ts`.

- [ ] **Step 4: Commit**

```bash
git add src/lib/data/comunicados.ts
git commit -m "feat(comunicados): add alvos to data layer and listTurmasESeries"
```

---

## Task 5: Server action aceita `segmentado` + `alvos`

`criarComunicadoAction` valida o novo alcance, lê os alvos e os grava.

**Files:**
- Modify: `src/lib/actions/comunicados.ts`

- [ ] **Step 1: Importar o tipo `Alvo`**

No topo de `src/lib/actions/comunicados.ts`, junto aos imports:
```typescript
import type { Alvo } from "@/lib/comunicados/destinatarios";
```

- [ ] **Step 2: Adicionar a função de parse dos alvos**

Após as constantes `MAX_IMAGEM_BYTES`/`TIPOS_IMAGEM`, adicionar:

```typescript
// Lê e valida o campo "alvos" (JSON) do formulário do comunicado segmentado.
function parseAlvos(formData: FormData): Alvo[] {
  const raw = formData.get("alvos");
  if (typeof raw !== "string" || raw.trim() === "") return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (a): a is Alvo =>
        a &&
        typeof a === "object" &&
        (a.tipo === "turma" || a.tipo === "serie") &&
        typeof a.id === "string" &&
        a.id.length > 0,
    );
  } catch {
    return [];
  }
}
```

- [ ] **Step 3: Atualizar a validação do alcance**

Localizar o bloco:
```typescript
  if (alcance !== "geral" && alcance !== "individual") {
    redirect("/comunicados/novo?erro=alcance_invalido");
  }
  if (alcance === "individual" && !alunoId) {
    redirect("/comunicados/novo?erro=aluno_obrigatorio");
  }
```

Substituir por:
```typescript
  if (alcance !== "geral" && alcance !== "individual" && alcance !== "segmentado") {
    redirect("/comunicados/novo?erro=alcance_invalido");
  }
  if (alcance === "individual" && !alunoId) {
    redirect("/comunicados/novo?erro=aluno_obrigatorio");
  }

  const alvos = alcance === "segmentado" ? parseAlvos(formData) : [];
  if (alcance === "segmentado" && alvos.length === 0) {
    redirect("/comunicados/novo?erro=alvos_obrigatorios");
  }
```

- [ ] **Step 4: Gravar `alvos` no insert do comunicado**

No `insert` da tabela `comunicados`, adicionar o campo `alvos`:
```typescript
    .insert({
      escola_id: session.profile.escola_id,
      titulo,
      mensagem,
      imagem_path: imagemPath,
      alcance,
      aluno_id: alcance === "individual" ? alunoId : null,
      alvos,
      status: "processando",
      criado_por: session.profile.id,
    })
```

- [ ] **Step 5: Passar `alvos` para `resolverDestinatarios`**

A chamada atual é:
```typescript
  const destinatarios = await resolverDestinatarios(
    supabase,
    alcance,
    alcance === "individual" ? alunoId : null,
    session.profile.escola_id,
  );
```

Substituir por (a assinatura nova é `(supabase, alcance, alunoId, alvos, escolaId)`):
```typescript
  const destinatarios = await resolverDestinatarios(
    supabase,
    alcance,
    alcance === "individual" ? alunoId : null,
    alvos,
    session.profile.escola_id,
  );
```

- [ ] **Step 6: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 7: Commit**

```bash
git add src/lib/actions/comunicados.ts
git commit -m "feat(comunicados): accept segmentado alcance with alvos"
```

---

## Task 6: Form de novo comunicado com modo segmentado

O form ganha o alcance `segmentado` com multi-seleção de turmas e séries.

**Files:**
- Modify: `src/components/comunicados/novo-comunicado-form.tsx`

- [ ] **Step 1: Reescrever o componente**

Substituir TODO o conteúdo de `src/components/comunicados/novo-comunicado-form.tsx` por:

```typescript
"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { Panel } from "@/components/ui/card";
import { criarComunicadoAction } from "@/lib/actions/comunicados";

type AlunoLite = { id: string; nome: string };
type TurmaLite = { id: string; nome: string; anoLetivo: number; serieNome: string };
type SerieLite = { id: string; nome: string };

type Alvo = { tipo: "turma" | "serie"; id: string };

export function NovoComunicadoForm({
  alunos,
  turmas,
  series,
}: {
  alunos: AlunoLite[];
  turmas: TurmaLite[];
  series: SerieLite[];
}) {
  const [alcance, setAlcance] = useState<"geral" | "segmentado" | "individual">("geral");
  const [turmasSel, setTurmasSel] = useState<Set<string>>(new Set());
  const [seriesSel, setSeriesSel] = useState<Set<string>>(new Set());
  const [enviando, setEnviando] = useState(false);

  function toggle(set: Set<string>, id: string): Set<string> {
    const novo = new Set(set);
    if (novo.has(id)) novo.delete(id);
    else novo.add(id);
    return novo;
  }

  const alvos: Alvo[] = [
    ...Array.from(turmasSel).map((id) => ({ tipo: "turma" as const, id })),
    ...Array.from(seriesSel).map((id) => ({ tipo: "serie" as const, id })),
  ];

  return (
    <Panel className="grid gap-4">
      <h2 className="font-bold text-ink">Novo comunicado</h2>
      <form
        action={criarComunicadoAction}
        encType="multipart/form-data"
        onSubmit={() => setEnviando(true)}
        className="grid gap-4"
      >
        <label className="grid gap-1 text-sm">
          Título
          <input type="text" name="titulo" required maxLength={120} />
        </label>

        <label className="grid gap-1 text-sm">
          Mensagem
          <textarea name="mensagem" required rows={5} maxLength={2000} />
        </label>

        <label className="grid gap-1 text-sm">
          Imagem (opcional)
          <input type="file" name="imagem" accept="image/png,image/jpeg,image/webp" />
          <span className="text-xs text-ink/55">PNG, JPG ou WEBP — máx 5MB.</span>
        </label>

        <fieldset className="grid gap-2">
          <legend className="text-sm font-semibold text-ink">Alcance</legend>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="alcance"
              value="geral"
              checked={alcance === "geral"}
              onChange={() => setAlcance("geral")}
            />
            Todos os responsáveis financeiros (alunos ativos)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="alcance"
              value="segmentado"
              checked={alcance === "segmentado"}
              onChange={() => setAlcance("segmentado")}
            />
            Turmas e séries específicas
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="alcance"
              value="individual"
              checked={alcance === "individual"}
              onChange={() => setAlcance("individual")}
            />
            Aluno específico
          </label>
        </fieldset>

        {alcance === "segmentado" && (
          <div className="grid gap-4 rounded-ui border border-line p-3">
            <input type="hidden" name="alvos" value={JSON.stringify(alvos)} />

            <div className="grid gap-1.5">
              <p className="text-sm font-semibold text-ink">Turmas</p>
              <div className="grid gap-1 sm:grid-cols-2">
                {turmas.map((t) => (
                  <label key={t.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={turmasSel.has(t.id)}
                      onChange={() => setTurmasSel((s) => toggle(s, t.id))}
                      className="h-4 w-4"
                    />
                    {t.serieNome} {t.nome} ({t.anoLetivo})
                  </label>
                ))}
                {turmas.length === 0 && (
                  <span className="text-xs text-ink/55">Nenhuma turma ativa.</span>
                )}
              </div>
            </div>

            <div className="grid gap-1.5">
              <p className="text-sm font-semibold text-ink">Séries</p>
              <div className="grid gap-1 sm:grid-cols-2">
                {series.map((s) => (
                  <label key={s.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={seriesSel.has(s.id)}
                      onChange={() => setSeriesSel((set) => toggle(set, s.id))}
                      className="h-4 w-4"
                    />
                    {s.nome}
                  </label>
                ))}
                {series.length === 0 && (
                  <span className="text-xs text-ink/55">Nenhuma série cadastrada.</span>
                )}
              </div>
            </div>

            {alvos.length === 0 && (
              <p className="text-xs text-danger">Selecione ao menos uma turma ou série.</p>
            )}
          </div>
        )}

        {alcance === "individual" && (
          <label className="grid gap-1 text-sm">
            Aluno
            <select name="aluno_id" required={alcance === "individual"}>
              <option value="">Selecione…</option>
              {alunos.map((a) => (
                <option key={a.id} value={a.id}>{a.nome}</option>
              ))}
            </select>
          </label>
        )}

        <div className="flex justify-end">
          <button
            className="ds-button ds-button-primary"
            disabled={enviando || (alcance === "segmentado" && alvos.length === 0)}
          >
            <Send size={14} /> {enviando ? "Enviando…" : "Enviar comunicado"}
          </button>
        </div>
      </form>
    </Panel>
  );
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: ERRO esperado em `comunicados/novo/page.tsx` (ainda não passa `turmas`/`series`
ao form) — corrigido na Task 7.

- [ ] **Step 3: Commit**

```bash
git add src/components/comunicados/novo-comunicado-form.tsx
git commit -m "feat(comunicados): add segmentado mode with turma/serie multi-select"
```

---

## Task 7: Página de novo comunicado carrega turmas e séries

**Files:**
- Modify: `src/app/(app)/comunicados/novo/page.tsx`

- [ ] **Step 1: Atualizar a página**

Em `src/app/(app)/comunicados/novo/page.tsx`:

(a) Importar `listTurmasESeries`:
```typescript
import { listTurmasESeries } from "@/lib/data/comunicados";
```

(b) Adicionar `alvos_obrigatorios` ao mapa `ERRO_LABEL`:
```typescript
const ERRO_LABEL: Record<string, string> = {
  campos_obrigatorios: "Preencha o título e a mensagem.",
  alcance_invalido: "Selecione um alcance válido.",
  aluno_obrigatorio: "Selecione o aluno para o comunicado individual.",
  alvos_obrigatorios: "Selecione ao menos uma turma ou série.",
  imagem_tipo: "A imagem deve ser PNG, JPG ou WEBP.",
  imagem_grande: "A imagem excede o limite de 5MB.",
};
```

(c) Após o bloco que monta `alunos`, carregar turmas e séries:
```typescript
  const { turmas, series } = await listTurmasESeries(session.profile.escola_id);
```

(d) Passar ao componente:
```typescript
      <NovoComunicadoForm alunos={alunos} turmas={turmas} series={series} />
```

- [ ] **Step 2: Verificar tipos e build**

Run: `npx tsc --noEmit && npm run build`
Expected: sem erros; build passa.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(app)/comunicados/novo/page.tsx"
git commit -m "feat(comunicados): load turmas and series for new comunicado page"
```

---

## Task 8: Detalhe do comunicado exibe os alvos

A página de detalhe mostra as turmas/séries do comunicado segmentado.

**Files:**
- Modify: `src/app/(app)/comunicados/[id]/page.tsx`

- [ ] **Step 1: Ler a página atual**

Run: `cat "src/app/(app)/comunicados/[id]/page.tsx"`
Expected: ver como o comunicado é exibido — `comunicado.alcance`, o `PageHeader`, os
`kpis`.

- [ ] **Step 2: Exibir o alcance segmentado com os alvos**

A página recebe `comunicado` de `getComunicado`, que agora tem `comunicado.alvos`.
Onde o `description` ou o corpo da página descreve o alcance (hoje algo como
`comunicado.alcance === "geral" ? "Geral" : "Individual"`), substituir por uma função que
trate os 3 casos. Adicionar, antes do `return` da página:

```typescript
  function alcanceLabel(): string {
    if (comunicado.alcance === "geral") return "Geral";
    if (comunicado.alcance === "individual") return "Individual";
    const nTurmas = comunicado.alvos.filter((a) => a.tipo === "turma").length;
    const nSeries = comunicado.alvos.filter((a) => a.tipo === "serie").length;
    const partes: string[] = [];
    if (nTurmas > 0) partes.push(`${nTurmas} turma(s)`);
    if (nSeries > 0) partes.push(`${nSeries} série(s)`);
    return `Segmentado · ${partes.join(", ")}`;
  }
```

Trocar a expressão que renderiza o texto do alcance (ex: dentro do `description` do
`PageHeader` ou num KPI) por `alcanceLabel()`. Adaptar ao código real visto no Step 1 —
substituir a expressão `comunicado.alcance === "geral" ? "Geral" : "Individual"` (ou
equivalente) por `alcanceLabel()`.

- [ ] **Step 3: Verificar tipos e build**

Run: `npx tsc --noEmit && npm run build`
Expected: sem erros; build passa.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/comunicados/[id]/page.tsx"
git commit -m "feat(comunicados): show segmentado targets on detail page"
```

---

## Task 9: Verificação final

- [ ] **Step 1: Rodar todos os testes**

Run: `npm test`
Expected: os 6 testes de `coletarTurmaIds` entram na suíte de `destinatarios.test.ts`.
Total cresce de 59 para 65 testes, todos passando.

- [ ] **Step 2: Build final**

Run: `npm run build`
Expected: passa sem erros.

- [ ] **Step 3: Smoke test manual** (requer dev server)

1. `/comunicados/novo` — escolher alcance "Turmas e séries específicas" → aparecem os
   grupos de checkboxes de turmas e séries.
2. Marcar uma turma e uma série → "Enviar comunicado".
3. O comunicado é criado; o detalhe mostra "Segmentado · 1 turma(s), 1 série(s)".
4. Conferir `mensagens_whatsapp` — uma linha `pendente` por responsável financeiro dos
   alunos das turmas selecionadas (turma direta + turmas da série), sem duplicar.
5. Alcance "segmentado" sem marcar nada → botão "Enviar" desabilitado; se forçar o
   submit, a action redireciona com `?erro=alvos_obrigatorios`.

---

## Notas de execução

- **`ALTER TYPE ADD VALUE`:** o valor `segmentado` é adicionado na Task 1 e só usado nas
  tasks seguintes (script de migração separado do uso) — evita o erro de "unsafe use of
  new enum value" do Postgres.
- **`alvos` é critério, não destinatário:** os destinatários reais são resolvidos na
  criação e viram linhas em `mensagens_whatsapp`. `alvos` registra o critério para a tela
  e auditoria.
- **Ordem das tasks:** Task 3 quebra o build de propósito (a action ainda usa a
  assinatura antiga de `resolverDestinatarios`); Task 5 conserta. Task 6 quebra
  (page não passa props); Task 7 conserta. Seguir a ordem.
- **Dedup:** aluno numa turma que aparece tanto direta quanto via série não duplica — o
  `Set` em `coletarTurmaIds` e o dedup de `aluno_id` em `resolverDestinatarios` cobrem.
- **Migração:** Task 1 aplica via MCP direto em produção (`fljkjhmwnjehsodvqaqk`).
- **Sem RBAC novo:** reusa o módulo `comunicados`.
