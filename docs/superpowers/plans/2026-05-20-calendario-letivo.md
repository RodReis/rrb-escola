# Calendário Letivo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que a escola defina o calendário letivo de cada ano (período, dias da semana letivos, feriados e recessos) e fazer a chamada de frequência validar contra os dias letivos reais.

**Architecture:** Duas tabelas novas (`calendario_letivo`, `calendario_excecoes`) com RLS por escola. Lógica de "dia letivo" isolada em funções puras testáveis. Nova rota `/calendario` com grade visual de 12 meses. Integração na chamada existente bloqueia datas não-letivas (front + server action).

**Tech Stack:** Next.js 14 App Router, Supabase (Postgres + RLS), TypeScript, Vitest (a ser adicionado para testar as funções puras).

**Spec:** `docs/superpowers/specs/2026-05-20-calendario-letivo-design.md`
**Branch:** `feature/calendario-letivo`

---

## File Structure

**Criar:**
- `supabase/migrations/202605310001_calendario_letivo.sql` — 2 tabelas, enum, RLS, seed RBAC
- `src/lib/calendario/dias-letivos.ts` — funções puras (`isDiaLetivo`, `contarDiasLetivos`, `listarDiasLetivos`)
- `src/lib/calendario/dias-letivos.test.ts` — testes unitários das funções puras
- `src/lib/calendario/types.ts` — tipos `Calendario`, `CalendarioExcecao`, `TipoExcecao`
- `src/lib/data/calendario.ts` — `getCalendario`, `listAnosLetivos`
- `src/lib/actions/calendario.ts` — server actions de save/delete
- `src/app/(app)/calendario/page.tsx` — página principal (server component)
- `src/components/calendario/calendario-config-form.tsx` — form da config do calendário
- `src/components/calendario/excecao-form.tsx` — form/modal de exceção
- `src/components/calendario/grade-anual.tsx` — grade visual de 12 meses
- `src/components/calendario/excecoes-list.tsx` — lista de exceções com editar/excluir
- `vitest.config.ts` — config do Vitest (test framework ainda não existe no projeto)

**Modificar:**
- `src/lib/auth/permissions.ts` — adicionar módulo `calendario` em `MODULOS` e `ROTA_PARA_MODULO`
- `package.json` — adicionar Vitest + script `test`
- `src/lib/data/attendance.ts` — `getClassAttendanceData` retorna info de dia letivo
- `src/app/(app)/frequencias/chamada/page.tsx` — bloquear data não-letiva
- `src/lib/actions/attendance.ts` — `saveClassAttendanceAction` revalida dia letivo no servidor

---

## Task 1: Setup do Vitest

O projeto não tem framework de teste. As funções puras de `dias-letivos.ts` precisam de testes unitários. Vitest é leve, rápido e funciona nativamente com TypeScript/ESM.

**Files:**
- Create: `vitest.config.ts`
- Modify: `package.json`

- [ ] **Step 1: Instalar Vitest**

Run: `npm install -D vitest`
Expected: `vitest` adicionado a devDependencies, sem erros.

- [ ] **Step 2: Criar `vitest.config.ts`**

```typescript
import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
});
```

- [ ] **Step 3: Adicionar script `test` ao `package.json`**

No bloco `"scripts"`, adicionar a linha:

```json
"test": "vitest run",
```

- [ ] **Step 4: Verificar que o Vitest roda**

Run: `npm test`
Expected: Vitest executa e reporta "No test files found" (ainda não há testes) — sai sem erro de config.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json vitest.config.ts
git commit -m "build: add vitest for unit testing pure functions"
```

---

## Task 2: Tipos do calendário

Tipos compartilhados entre lógica pura, data layer, actions e UI.

**Files:**
- Create: `src/lib/calendario/types.ts`

- [ ] **Step 1: Criar `src/lib/calendario/types.ts`**

```typescript
export type TipoExcecao = "feriado" | "recesso";

export type CalendarioExcecao = {
  id: string;
  calendarioId: string;
  escolaId: string;
  dataInicio: string; // YYYY-MM-DD
  dataFim: string;    // YYYY-MM-DD
  tipo: TipoExcecao;
  descricao: string;
};

export type Calendario = {
  id: string;
  escolaId: string;
  anoLetivo: number;
  dataInicio: string; // YYYY-MM-DD
  dataFim: string;    // YYYY-MM-DD
  diasSemanaLetivos: number[]; // 0=domingo … 6=sábado
};

export type CalendarioComExcecoes = {
  calendario: Calendario;
  excecoes: CalendarioExcecao[];
};
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/calendario/types.ts
git commit -m "feat(calendario): add shared types"
```

---

## Task 3: Função `isDiaLetivo`

Função pura: dada uma data, o calendário e as exceções, decide se a data é letiva.

**Files:**
- Create: `src/lib/calendario/dias-letivos.ts`
- Test: `src/lib/calendario/dias-letivos.test.ts`

- [ ] **Step 1: Escrever o teste que falha**

`src/lib/calendario/dias-letivos.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { isDiaLetivo } from "./dias-letivos";
import type { Calendario, CalendarioExcecao } from "./types";

const calendario: Calendario = {
  id: "cal-1",
  escolaId: "esc-1",
  anoLetivo: 2026,
  dataInicio: "2026-02-02",
  dataFim: "2026-12-18",
  diasSemanaLetivos: [1, 2, 3, 4, 5], // seg-sex
};

describe("isDiaLetivo", () => {
  it("dia útil dentro do período é letivo", () => {
    // 2026-03-04 é uma quarta-feira
    expect(isDiaLetivo("2026-03-04", calendario, [])).toBe(true);
  });

  it("sábado não é letivo", () => {
    // 2026-03-07 é um sábado
    expect(isDiaLetivo("2026-03-07", calendario, [])).toBe(false);
  });

  it("domingo não é letivo", () => {
    // 2026-03-08 é um domingo
    expect(isDiaLetivo("2026-03-08", calendario, [])).toBe(false);
  });

  it("data antes do início do ano não é letiva", () => {
    expect(isDiaLetivo("2026-01-15", calendario, [])).toBe(false);
  });

  it("data depois do fim do ano não é letiva", () => {
    expect(isDiaLetivo("2026-12-25", calendario, [])).toBe(false);
  });

  it("feriado de um dia não é letivo", () => {
    const excecoes: CalendarioExcecao[] = [
      {
        id: "e1", calendarioId: "cal-1", escolaId: "esc-1",
        dataInicio: "2026-03-04", dataFim: "2026-03-04",
        tipo: "feriado", descricao: "Feriado teste",
      },
    ];
    expect(isDiaLetivo("2026-03-04", calendario, excecoes)).toBe(false);
  });

  it("dia dentro de recesso de vários dias não é letivo", () => {
    const excecoes: CalendarioExcecao[] = [
      {
        id: "e2", calendarioId: "cal-1", escolaId: "esc-1",
        dataInicio: "2026-07-06", dataFim: "2026-07-24",
        tipo: "recesso", descricao: "Recesso de julho",
      },
    ];
    // 2026-07-15 é uma quarta dentro do recesso
    expect(isDiaLetivo("2026-07-15", calendario, excecoes)).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar o teste para confirmar a falha**

Run: `npx vitest run src/lib/calendario/dias-letivos.test.ts`
Expected: FAIL — `isDiaLetivo` não existe / módulo não encontrado.

- [ ] **Step 3: Implementar `isDiaLetivo`**

`src/lib/calendario/dias-letivos.ts`:

```typescript
import type { Calendario, CalendarioExcecao } from "./types";

// Datas em formato YYYY-MM-DD são comparáveis lexicograficamente.
// Para o dia-da-semana, parse explícito em UTC evita drift de timezone.
function diaDaSemana(isoDate: string): number {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

function dentroDoIntervalo(date: string, inicio: string, fim: string): boolean {
  return date >= inicio && date <= fim;
}

export function isDiaLetivo(
  date: string,
  calendario: Calendario,
  excecoes: CalendarioExcecao[],
): boolean {
  if (!dentroDoIntervalo(date, calendario.dataInicio, calendario.dataFim)) {
    return false;
  }
  if (!calendario.diasSemanaLetivos.includes(diaDaSemana(date))) {
    return false;
  }
  for (const ex of excecoes) {
    if (dentroDoIntervalo(date, ex.dataInicio, ex.dataFim)) {
      return false;
    }
  }
  return true;
}
```

- [ ] **Step 4: Rodar o teste para confirmar que passa**

Run: `npx vitest run src/lib/calendario/dias-letivos.test.ts`
Expected: PASS — 7 testes verdes.

- [ ] **Step 5: Commit**

```bash
git add src/lib/calendario/dias-letivos.ts src/lib/calendario/dias-letivos.test.ts
git commit -m "feat(calendario): add isDiaLetivo pure function"
```

---

## Task 4: Funções `contarDiasLetivos` e `listarDiasLetivos`

`contarDiasLetivos` conta os dias letivos no período (para o badge de 200 dias). `listarDiasLetivos` não é necessária — a grade visual itera os dias do mês e chama `isDiaLetivo` por célula. Implementar apenas `contarDiasLetivos`.

**Files:**
- Modify: `src/lib/calendario/dias-letivos.ts`
- Modify: `src/lib/calendario/dias-letivos.test.ts`

- [ ] **Step 1: Adicionar teste de `contarDiasLetivos`**

Acrescentar ao final de `src/lib/calendario/dias-letivos.test.ts`, antes de fechar o arquivo:

```typescript
import { contarDiasLetivos } from "./dias-letivos";

describe("contarDiasLetivos", () => {
  it("conta apenas dias úteis num período de uma semana", () => {
    const cal: Calendario = {
      id: "c", escolaId: "e", anoLetivo: 2026,
      dataInicio: "2026-03-02", // segunda
      dataFim: "2026-03-08",    // domingo
      diasSemanaLetivos: [1, 2, 3, 4, 5],
    };
    // seg a sex = 5 dias letivos
    expect(contarDiasLetivos(cal, [])).toBe(5);
  });

  it("desconta feriado dentro do período", () => {
    const cal: Calendario = {
      id: "c", escolaId: "e", anoLetivo: 2026,
      dataInicio: "2026-03-02",
      dataFim: "2026-03-08",
      diasSemanaLetivos: [1, 2, 3, 4, 5],
    };
    const excecoes: CalendarioExcecao[] = [
      {
        id: "f", calendarioId: "c", escolaId: "e",
        dataInicio: "2026-03-04", dataFim: "2026-03-04",
        tipo: "feriado", descricao: "Feriado",
      },
    ];
    // 5 dias úteis - 1 feriado = 4
    expect(contarDiasLetivos(cal, excecoes)).toBe(4);
  });
});
```

- [ ] **Step 2: Rodar o teste para confirmar a falha**

Run: `npx vitest run src/lib/calendario/dias-letivos.test.ts`
Expected: FAIL — `contarDiasLetivos` não existe.

- [ ] **Step 3: Implementar `contarDiasLetivos`**

Acrescentar ao final de `src/lib/calendario/dias-letivos.ts`:

```typescript
function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export function contarDiasLetivos(
  calendario: Calendario,
  excecoes: CalendarioExcecao[],
): number {
  let count = 0;
  let cursor = calendario.dataInicio;
  while (cursor <= calendario.dataFim) {
    if (isDiaLetivo(cursor, calendario, excecoes)) count += 1;
    cursor = addDays(cursor, 1);
  }
  return count;
}
```

- [ ] **Step 4: Rodar o teste para confirmar que passa**

Run: `npx vitest run src/lib/calendario/dias-letivos.test.ts`
Expected: PASS — 9 testes verdes (7 anteriores + 2 novos).

- [ ] **Step 5: Commit**

```bash
git add src/lib/calendario/dias-letivos.ts src/lib/calendario/dias-letivos.test.ts
git commit -m "feat(calendario): add contarDiasLetivos pure function"
```

---

## Task 5: Migração do banco

Cria as duas tabelas, o enum, RLS por escola e o seed RBAC do módulo `calendario`.

**Files:**
- Create: `supabase/migrations/202605310001_calendario_letivo.sql`

- [ ] **Step 1: Criar a migração**

`supabase/migrations/202605310001_calendario_letivo.sql`:

```sql
-- Calendário Letivo: calendario_letivo (1 por ano/escola) + calendario_excecoes (feriados/recessos)

do $$ begin
  create type tipo_excecao_calendario as enum ('feriado', 'recesso');
exception when duplicate_object then null;
end $$;

create table calendario_letivo (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references escolas(id) on delete cascade,
  ano_letivo integer not null,
  data_inicio date not null,
  data_fim date not null,
  dias_semana_letivos integer[] not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint calendario_letivo_ano_unico unique (escola_id, ano_letivo),
  constraint calendario_letivo_periodo_valido check (data_fim > data_inicio),
  constraint calendario_letivo_dias_nao_vazio check (array_length(dias_semana_letivos, 1) > 0)
);

create index calendario_letivo_escola_idx on calendario_letivo (escola_id);

create trigger calendario_letivo_updated_at
  before update on calendario_letivo
  for each row execute function set_updated_at();

create table calendario_excecoes (
  id uuid primary key default gen_random_uuid(),
  calendario_id uuid not null references calendario_letivo(id) on delete cascade,
  escola_id uuid not null references escolas(id) on delete cascade,
  data_inicio date not null,
  data_fim date not null,
  tipo tipo_excecao_calendario not null,
  descricao text not null,
  created_at timestamptz not null default now(),
  constraint calendario_excecoes_periodo_valido check (data_fim >= data_inicio)
);

create index calendario_excecoes_calendario_idx on calendario_excecoes (calendario_id);
create index calendario_excecoes_escola_idx on calendario_excecoes (escola_id);

alter table calendario_letivo enable row level security;
alter table calendario_excecoes enable row level security;

create policy "calendario letivo escola" on calendario_letivo for all to authenticated
  using (escola_id = (select escola_id from current_perfil()))
  with check (escola_id = (select escola_id from current_perfil()));

create policy "calendario excecoes escola" on calendario_excecoes for all to authenticated
  using (escola_id = (select escola_id from current_perfil()))
  with check (escola_id = (select escola_id from current_perfil()));

-- Seed RBAC: módulo calendario no grupo academico
insert into modulos (codigo, grupo, nome, ordem) values
  ('calendario', 'academico', 'Calendário Letivo', 44);

-- admin: full
insert into role_permissoes (role_codigo, modulo_codigo, pode_ler, pode_criar, pode_editar, pode_deletar)
  values ('admin', 'calendario', true, true, true, true);

-- secretaria: full (grupo academico)
insert into role_permissoes (role_codigo, modulo_codigo, pode_ler, pode_criar, pode_editar, pode_deletar)
  values ('secretaria', 'calendario', true, true, true, true);

-- financeiro: read-only
insert into role_permissoes (role_codigo, modulo_codigo, pode_ler, pode_criar, pode_editar, pode_deletar)
  values ('financeiro', 'calendario', true, false, false, false);

-- professor: read-only
insert into role_permissoes (role_codigo, modulo_codigo, pode_ler, pode_criar, pode_editar, pode_deletar)
  values ('professor', 'calendario', true, false, false, false);
```

- [ ] **Step 2: Aplicar a migração via MCP Supabase**

Aplicar `202605310001_calendario_letivo.sql` no projeto `fljkjhmwnjehsodvqaqk` usando a ferramenta MCP `apply_migration` (nome: `202605310001_calendario_letivo`).
Expected: `{"success": true}`.

- [ ] **Step 3: Verificar as tabelas**

Via MCP `execute_sql` no projeto `fljkjhmwnjehsodvqaqk`:

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema='public' AND table_name LIKE 'calendario%';
```

Expected: retorna `calendario_letivo` e `calendario_excecoes`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/202605310001_calendario_letivo.sql
git commit -m "feat(calendario): add calendario_letivo and calendario_excecoes tables with RBAC"
```

---

## Task 6: Registrar módulo `calendario` no RBAC do código

O DB já tem o módulo (Task 5). Agora o código TypeScript precisa conhecê-lo: `MODULOS` e `ROTA_PARA_MODULO`.

**Files:**
- Modify: `src/lib/auth/permissions.ts`

- [ ] **Step 1: Adicionar `calendario` em `MODULOS`**

Em `src/lib/auth/permissions.ts`, no bloco `MODULOS`, na seção `// academico`, após a linha de `organograma`:

```typescript
  organograma: { grupo: "academico", nome: "Organograma" },
  calendario: { grupo: "academico", nome: "Calendário Letivo" },
```

- [ ] **Step 2: Adicionar rota em `ROTA_PARA_MODULO`**

No objeto `ROTA_PARA_MODULO`, após a linha de `"/organograma"`:

```typescript
  "/organograma": "organograma",
  "/calendario": "calendario",
```

- [ ] **Step 3: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
git add src/lib/auth/permissions.ts
git commit -m "feat(calendario): register calendario module in RBAC map"
```

---

## Task 7: Data layer do calendário

`getCalendario` busca o calendário de um ano + suas exceções. `listAnosLetivos` retorna os anos que têm calendário (para o seletor).

**Files:**
- Create: `src/lib/data/calendario.ts`

- [ ] **Step 1: Criar `src/lib/data/calendario.ts`**

```typescript
import { createServerClient } from "@/lib/supabase/server";
import { DEFAULT_SCHOOL_ID } from "@/lib/constants";
import type { Calendario, CalendarioExcecao, CalendarioComExcecoes } from "@/lib/calendario/types";

function mapCalendario(row: any): Calendario {
  return {
    id: row.id,
    escolaId: row.escola_id,
    anoLetivo: row.ano_letivo,
    dataInicio: row.data_inicio,
    dataFim: row.data_fim,
    diasSemanaLetivos: row.dias_semana_letivos ?? [],
  };
}

function mapExcecao(row: any): CalendarioExcecao {
  return {
    id: row.id,
    calendarioId: row.calendario_id,
    escolaId: row.escola_id,
    dataInicio: row.data_inicio,
    dataFim: row.data_fim,
    tipo: row.tipo,
    descricao: row.descricao,
  };
}

export async function getCalendario(
  anoLetivo: number,
  escolaId: string = DEFAULT_SCHOOL_ID,
): Promise<CalendarioComExcecoes | null> {
  const supabase = await createServerClient();

  const { data: calRow } = await supabase
    .from("calendario_letivo")
    .select("*")
    .eq("escola_id", escolaId)
    .eq("ano_letivo", anoLetivo)
    .maybeSingle();

  if (!calRow) return null;

  const calendario = mapCalendario(calRow);

  const { data: exRows } = await supabase
    .from("calendario_excecoes")
    .select("*")
    .eq("calendario_id", calendario.id)
    .order("data_inicio", { ascending: true });

  return {
    calendario,
    excecoes: (exRows ?? []).map(mapExcecao),
  };
}

export async function listAnosLetivos(
  escolaId: string = DEFAULT_SCHOOL_ID,
): Promise<number[]> {
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("calendario_letivo")
    .select("ano_letivo")
    .eq("escola_id", escolaId)
    .order("ano_letivo", { ascending: false });
  return (data ?? []).map((r: any) => r.ano_letivo);
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/lib/data/calendario.ts
git commit -m "feat(calendario): add data layer getCalendario and listAnosLetivos"
```

---

## Task 8: Server actions do calendário

Save da config e CRUD das exceções. Cada action faz `requirePermission` e `revalidatePath`.

**Files:**
- Create: `src/lib/actions/calendario.ts`

- [ ] **Step 1: Criar `src/lib/actions/calendario.ts`**

```typescript
"use server";

import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/session";
import { DEFAULT_SCHOOL_ID } from "@/lib/constants";
import { formText, formNumber } from "@/lib/utils";

function parseDiasSemana(formData: FormData): number[] {
  // Checkboxes name="dia_semana" value="0".."6"
  return formData
    .getAll("dia_semana")
    .map((v) => Number(v))
    .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);
}

export async function salvarCalendarioAction(formData: FormData) {
  await requirePermission("calendario", "create");
  const supabase = await createServerClient();

  const id = formText(formData, "id");
  const anoLetivo = formNumber(formData, "ano_letivo");
  const dataInicio = formText(formData, "data_inicio");
  const dataFim = formText(formData, "data_fim");
  const diasSemana = parseDiasSemana(formData);

  if (!anoLetivo || !dataInicio || !dataFim) {
    throw new Error("Ano letivo, data início e data fim são obrigatórios");
  }
  if (dataFim <= dataInicio) {
    throw new Error("Data fim deve ser posterior à data início");
  }
  if (diasSemana.length === 0) {
    throw new Error("Selecione ao menos um dia da semana letivo");
  }

  const payload = {
    escola_id: DEFAULT_SCHOOL_ID,
    ano_letivo: anoLetivo,
    data_inicio: dataInicio,
    data_fim: dataFim,
    dias_semana_letivos: diasSemana,
  };

  if (id) {
    await supabase.from("calendario_letivo").update(payload).eq("id", id).eq("escola_id", DEFAULT_SCHOOL_ID);
  } else {
    await supabase.from("calendario_letivo").insert(payload);
  }

  revalidatePath("/calendario");
}

export async function salvarExcecaoAction(formData: FormData) {
  await requirePermission("calendario", "update");
  const supabase = await createServerClient();

  const id = formText(formData, "id");
  const calendarioId = formText(formData, "calendario_id");
  const dataInicio = formText(formData, "data_inicio");
  const dataFim = formText(formData, "data_fim");
  const tipo = formText(formData, "tipo");
  const descricao = formText(formData, "descricao");

  if (!calendarioId || !dataInicio || !dataFim || !tipo || !descricao) {
    throw new Error("Todos os campos da exceção são obrigatórios");
  }
  if (tipo !== "feriado" && tipo !== "recesso") {
    throw new Error("Tipo de exceção inválido");
  }
  if (dataFim < dataInicio) {
    throw new Error("Data fim não pode ser anterior à data início");
  }

  const payload = {
    calendario_id: calendarioId,
    escola_id: DEFAULT_SCHOOL_ID,
    data_inicio: dataInicio,
    data_fim: dataFim,
    tipo,
    descricao,
  };

  if (id) {
    await supabase.from("calendario_excecoes").update(payload).eq("id", id).eq("escola_id", DEFAULT_SCHOOL_ID);
  } else {
    await supabase.from("calendario_excecoes").insert(payload);
  }

  revalidatePath("/calendario");
}

export async function excluirExcecaoAction(formData: FormData) {
  await requirePermission("calendario", "delete");
  const supabase = await createServerClient();

  const id = formText(formData, "id");
  if (!id) throw new Error("ID obrigatório");

  await supabase.from("calendario_excecoes").delete().eq("id", id).eq("escola_id", DEFAULT_SCHOOL_ID);

  revalidatePath("/calendario");
}
```

- [ ] **Step 2: Confirmar que `formText` e `formNumber` existem**

Run: `npx tsc --noEmit`
Expected: sem erros. (Se `formText`/`formNumber` não existirem em `src/lib/utils.ts`, usar `String(formData.get(...) ?? "")` e `Number(formData.get(...))` inline — mas a Task 0 de exploração confirmou que existem, usados em `src/lib/actions/disciplinas.ts`.)

- [ ] **Step 3: Commit**

```bash
git add src/lib/actions/calendario.ts
git commit -m "feat(calendario): add server actions for calendario and excecoes"
```

---

## Task 9: Componente da grade visual de 12 meses

Server component (sem estado) que recebe calendário + exceções e renderiza 12 mini-calendários, cada dia colorido por estado.

**Files:**
- Create: `src/components/calendario/grade-anual.tsx`

- [ ] **Step 1: Criar `src/components/calendario/grade-anual.tsx`**

```typescript
import { isDiaLetivo } from "@/lib/calendario/dias-letivos";
import type { Calendario, CalendarioExcecao } from "@/lib/calendario/types";

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
const DIAS_SEMANA = ["D", "S", "T", "Q", "Q", "S", "S"];

type EstadoDia = "letivo" | "feriado" | "recesso" | "nao-letivo";

function iso(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function estadoDoDia(
  date: string,
  calendario: Calendario,
  excecoes: CalendarioExcecao[],
): EstadoDia {
  if (isDiaLetivo(date, calendario, excecoes)) return "letivo";
  for (const ex of excecoes) {
    if (date >= ex.dataInicio && date <= ex.dataFim) return ex.tipo;
  }
  return "nao-letivo";
}

const CELL_CLASS: Record<EstadoDia, string> = {
  letivo: "bg-surface text-ink",
  feriado: "bg-danger/15 text-danger font-semibold",
  recesso: "bg-warning/15 text-warning font-semibold",
  "nao-letivo": "bg-muted/50 text-ink/35",
};

function MesGrid({
  ano, mes, calendario, excecoes,
}: {
  ano: number; mes: number; calendario: Calendario; excecoes: CalendarioExcecao[];
}) {
  const primeiroDiaSemana = new Date(Date.UTC(ano, mes, 1)).getUTCDay();
  const diasNoMes = new Date(Date.UTC(ano, mes + 1, 0)).getUTCDate();
  const celulas: Array<number | null> = [];
  for (let i = 0; i < primeiroDiaSemana; i++) celulas.push(null);
  for (let d = 1; d <= diasNoMes; d++) celulas.push(d);

  return (
    <div className="rounded-ui border border-line p-3">
      <h3 className="mb-2 text-sm font-bold text-ink">{MESES[mes]}</h3>
      <div className="grid grid-cols-7 gap-0.5 text-center text-[0.6rem]">
        {DIAS_SEMANA.map((d, i) => (
          <span key={i} className="font-bold text-ink/45">{d}</span>
        ))}
        {celulas.map((dia, i) => {
          if (dia === null) return <span key={i} />;
          const date = iso(ano, mes, dia);
          const estado = estadoDoDia(date, calendario, excecoes);
          return (
            <span
              key={i}
              className={`rounded-sm py-1 ${CELL_CLASS[estado]}`}
              title={`${date} — ${estado}`}
            >
              {dia}
            </span>
          );
        })}
      </div>
    </div>
  );
}

export function GradeAnual({
  calendario, excecoes,
}: {
  calendario: Calendario; excecoes: CalendarioExcecao[];
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 12 }, (_, mes) => (
        <MesGrid
          key={mes}
          ano={calendario.anoLetivo}
          mes={mes}
          calendario={calendario}
          excecoes={excecoes}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/components/calendario/grade-anual.tsx
git commit -m "feat(calendario): add 12-month visual grid component"
```

---

## Task 10: Componente do form de configuração

Form para criar/editar o `calendario_letivo` de um ano. Server component que usa a action `salvarCalendarioAction`.

**Files:**
- Create: `src/components/calendario/calendario-config-form.tsx`

- [ ] **Step 1: Criar `src/components/calendario/calendario-config-form.tsx`**

```typescript
import { salvarCalendarioAction } from "@/lib/actions/calendario";
import { Panel } from "@/components/ui/card";
import type { Calendario } from "@/lib/calendario/types";

const DIAS = [
  { v: 1, label: "Seg" },
  { v: 2, label: "Ter" },
  { v: 3, label: "Qua" },
  { v: 4, label: "Qui" },
  { v: 5, label: "Sex" },
  { v: 6, label: "Sáb" },
  { v: 0, label: "Dom" },
];

export function CalendarioConfigForm({
  anoLetivo, calendario,
}: {
  anoLetivo: number; calendario: Calendario | null;
}) {
  const dias = calendario?.diasSemanaLetivos ?? [1, 2, 3, 4, 5];

  return (
    <Panel className="grid gap-4">
      <h2 className="font-bold text-ink">
        {calendario ? "Editar" : "Configurar"} calendário {anoLetivo}
      </h2>
      <form action={salvarCalendarioAction} className="grid gap-4">
        {calendario && <input type="hidden" name="id" value={calendario.id} />}
        <input type="hidden" name="ano_letivo" value={anoLetivo} />

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1 text-sm">
            Início do ano letivo
            <input
              type="date"
              name="data_inicio"
              required
              defaultValue={calendario?.dataInicio ?? ""}
            />
          </label>
          <label className="grid gap-1 text-sm">
            Fim do ano letivo
            <input
              type="date"
              name="data_fim"
              required
              defaultValue={calendario?.dataFim ?? ""}
            />
          </label>
        </div>

        <fieldset className="grid gap-2">
          <legend className="text-sm font-semibold text-ink">Dias da semana letivos</legend>
          <div className="flex flex-wrap gap-3">
            {DIAS.map((d) => (
              <label key={d.v} className="flex items-center gap-1.5 text-sm">
                <input
                  type="checkbox"
                  name="dia_semana"
                  value={d.v}
                  defaultChecked={dias.includes(d.v)}
                  className="h-4 w-4"
                />
                {d.label}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="flex justify-end">
          <button className="ds-button ds-button-primary">
            Salvar calendário
          </button>
        </div>
      </form>
    </Panel>
  );
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/components/calendario/calendario-config-form.tsx
git commit -m "feat(calendario): add calendario config form component"
```

---

## Task 11: Componente do form de exceção

Form para adicionar feriado/recesso. Server component usando `salvarExcecaoAction`.

**Files:**
- Create: `src/components/calendario/excecao-form.tsx`

- [ ] **Step 1: Criar `src/components/calendario/excecao-form.tsx`**

```typescript
import { salvarExcecaoAction } from "@/lib/actions/calendario";
import { Panel } from "@/components/ui/card";

export function ExcecaoForm({ calendarioId }: { calendarioId: string }) {
  return (
    <Panel className="grid gap-4">
      <h2 className="font-bold text-ink">Adicionar feriado ou recesso</h2>
      <form action={salvarExcecaoAction} className="grid gap-4">
        <input type="hidden" name="calendario_id" value={calendarioId} />

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1 text-sm">
            Tipo
            <select name="tipo" required defaultValue="feriado">
              <option value="feriado">Feriado</option>
              <option value="recesso">Recesso</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            Descrição
            <input
              type="text"
              name="descricao"
              required
              maxLength={120}
              placeholder="Ex: Carnaval"
            />
          </label>
          <label className="grid gap-1 text-sm">
            Data início
            <input type="date" name="data_inicio" required />
          </label>
          <label className="grid gap-1 text-sm">
            Data fim
            <input type="date" name="data_fim" required />
          </label>
        </div>

        <div className="flex justify-end">
          <button className="ds-button ds-button-accent">
            Adicionar exceção
          </button>
        </div>
      </form>
    </Panel>
  );
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/components/calendario/excecao-form.tsx
git commit -m "feat(calendario): add excecao form component"
```

---

## Task 12: Componente da lista de exceções

Lista as exceções cadastradas com botão de excluir. Usa `excluirExcecaoAction` e `ConfirmButton` (o projeto proíbe `confirm()` nativo).

**Files:**
- Create: `src/components/calendario/excecoes-list.tsx`

- [ ] **Step 1: Criar `src/components/calendario/excecoes-list.tsx`**

```typescript
import { CalendarOff } from "lucide-react";
import { Panel } from "@/components/ui/card";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { excluirExcecaoAction } from "@/lib/actions/calendario";
import type { CalendarioExcecao } from "@/lib/calendario/types";

const TIPO_LABEL: Record<string, string> = {
  feriado: "Feriado",
  recesso: "Recesso",
};

const TIPO_COLOR: Record<string, string> = {
  feriado: "bg-danger/10 text-danger",
  recesso: "bg-warning/10 text-warning",
};

function formatPeriodo(inicio: string, fim: string): string {
  const fmt = (d: string) => d.split("-").reverse().join("/");
  return inicio === fim ? fmt(inicio) : `${fmt(inicio)} – ${fmt(fim)}`;
}

export function ExcecoesList({ excecoes }: { excecoes: CalendarioExcecao[] }) {
  return (
    <Panel className="grid gap-3">
      <h2 className="font-bold text-ink">Feriados e recessos</h2>

      {excecoes.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-ink/40">
          <CalendarOff size={24} />
          <p className="text-sm">Nenhuma exceção cadastrada.</p>
        </div>
      ) : (
        <ul className="grid gap-2">
          {excecoes.map((ex) => (
            <li
              key={ex.id}
              className="flex items-center justify-between gap-3 rounded-ui border border-line p-3"
            >
              <div className="flex items-center gap-3">
                <span className={`rounded-pill px-2 py-0.5 text-[0.66rem] font-semibold uppercase ${TIPO_COLOR[ex.tipo]}`}>
                  {TIPO_LABEL[ex.tipo]}
                </span>
                <div>
                  <p className="text-sm font-semibold text-ink">{ex.descricao}</p>
                  <p className="text-xs text-ink/55">{formatPeriodo(ex.dataInicio, ex.dataFim)}</p>
                </div>
              </div>
              <form action={excluirExcecaoAction}>
                <input type="hidden" name="id" value={ex.id} />
                <ConfirmButton
                  message={`Excluir a exceção "${ex.descricao}"?`}
                  className="ds-button ds-button-ghost text-xs"
                >
                  Excluir
                </ConfirmButton>
              </form>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
```

- [ ] **Step 2: Confirmar import de `ConfirmButton`**

Run: `npx tsc --noEmit`
Expected: sem erros. (`ConfirmButton` é usado em `src/app/(app)/rh/documentos/[id]/page.tsx` — caminho `@/components/ui/confirm-button` confirmado.)

- [ ] **Step 3: Commit**

```bash
git add src/components/calendario/excecoes-list.tsx
git commit -m "feat(calendario): add excecoes list component"
```

---

## Task 13: Página principal `/calendario`

Server component que junta tudo: seletor de ano, card resumo com badge de 200 dias, grade visual e forms.

**Files:**
- Create: `src/app/(app)/calendario/page.tsx`

- [ ] **Step 1: Criar `src/app/(app)/calendario/page.tsx`**

```typescript
import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/card";
import { requirePermission } from "@/lib/auth/session";
import { getCalendario, listAnosLetivos } from "@/lib/data/calendario";
import { contarDiasLetivos } from "@/lib/calendario/dias-letivos";
import { CalendarioConfigForm } from "@/components/calendario/calendario-config-form";
import { ExcecaoForm } from "@/components/calendario/excecao-form";
import { ExcecoesList } from "@/components/calendario/excecoes-list";
import { GradeAnual } from "@/components/calendario/grade-anual";

const DIA_DEZ_LETIVOS_MIN = 200;

const DIA_LABEL: Record<number, string> = {
  0: "Dom", 1: "Seg", 2: "Ter", 3: "Qua", 4: "Qui", 5: "Sex", 6: "Sáb",
};

function isValidAno(v: string | undefined): boolean {
  if (!v) return false;
  const n = Number(v);
  return Number.isInteger(n) && n >= 2000 && n <= 2100;
}

export default async function CalendarioPage({
  searchParams,
}: {
  searchParams: Promise<{ ano?: string }>;
}) {
  await requirePermission("calendario", "read");
  const params = await searchParams;

  const anosCadastrados = await listAnosLetivos();
  const anoAtual = new Date().getFullYear();
  const anoSelecionado = isValidAno(params.ano)
    ? Number(params.ano)
    : (anosCadastrados[0] ?? anoAtual);

  const dados = await getCalendario(anoSelecionado);

  // Opções do seletor: anos cadastrados + ano atual + próximo ano (sem duplicar)
  const opcoesAno = Array.from(
    new Set([...anosCadastrados, anoAtual, anoAtual + 1]),
  ).sort((a, b) => b - a);

  const totalLetivos = dados
    ? contarDiasLetivos(dados.calendario, dados.excecoes)
    : 0;
  const atingeMinimo = totalLetivos >= DIA_DEZ_LETIVOS_MIN;

  return (
    <div className="grid gap-6">
      <PageHeader
        breadcrumb={[{ label: "Acadêmico" }, { label: "Calendário Letivo" }]}
        title="Calendário Letivo"
        description="Defina o período letivo, dias da semana, feriados e recessos."
      />

      <nav className="flex flex-wrap gap-1.5">
        {opcoesAno.map((ano) => (
          <Link
            key={ano}
            href={`/calendario?ano=${ano}`}
            className={`rounded-ui px-3 py-1.5 text-sm font-semibold transition-colors ${
              ano === anoSelecionado
                ? "bg-brand text-white"
                : "bg-muted text-ink/60 hover:text-ink"
            }`}
          >
            {ano}
          </Link>
        ))}
      </nav>

      {dados && (
        <Panel className="grid gap-3 sm:grid-cols-3 sm:items-center">
          <div>
            <p className="text-xs uppercase tracking-kicker text-ink/45">Período</p>
            <p className="text-sm font-semibold text-ink">
              {dados.calendario.dataInicio.split("-").reverse().join("/")} –{" "}
              {dados.calendario.dataFim.split("-").reverse().join("/")}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-kicker text-ink/45">Dias letivos da semana</p>
            <p className="text-sm font-semibold text-ink">
              {dados.calendario.diasSemanaLetivos
                .slice()
                .sort()
                .map((d) => DIA_LABEL[d])
                .join(", ")}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-kicker text-ink/45">Total de dias letivos</p>
            <p className="flex items-center gap-2 text-sm font-bold">
              <span className={atingeMinimo ? "text-success" : "text-danger"}>
                {totalLetivos}
              </span>
              <span
                className={`rounded-pill px-2 py-0.5 text-[0.6rem] font-semibold uppercase ${
                  atingeMinimo
                    ? "bg-success/15 text-success"
                    : "bg-danger/15 text-danger"
                }`}
              >
                {atingeMinimo ? "OK" : `mín. ${DIA_DEZ_LETIVOS_MIN}`}
              </span>
            </p>
          </div>
        </Panel>
      )}

      <CalendarioConfigForm
        anoLetivo={anoSelecionado}
        calendario={dados?.calendario ?? null}
      />

      {dados ? (
        <>
          <section className="grid gap-3">
            <h2 className="flex items-center gap-2 font-bold text-ink">
              <CalendarDays size={18} className="text-brand" />
              Visão anual {anoSelecionado}
            </h2>
            <GradeAnual calendario={dados.calendario} excecoes={dados.excecoes} />
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            <ExcecaoForm calendarioId={dados.calendario.id} />
            <ExcecoesList excecoes={dados.excecoes} />
          </div>
        </>
      ) : (
        <Panel>
          <p className="py-6 text-center text-sm text-ink/55">
            Configure o calendário acima para visualizar a grade e cadastrar feriados.
          </p>
        </Panel>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Build de verificação**

Run: `npm run build`
Expected: build passa, rota `/calendario` aparece na listagem.

- [ ] **Step 4: Commit**

```bash
git add src/app/(app)/calendario/page.tsx
git commit -m "feat(calendario): add calendario page with year selector and visual grid"
```

---

## Task 14: Link do calendário no menu

A topbar precisa expor a rota `/calendario`. Localizar o grupo "Acadêmico" / dropdown onde estão Séries, Turmas, Organograma e adicionar o item.

**Files:**
- Modify: `src/components/layout/topbar.tsx` (ou o componente de dropdown acadêmico que ele usa)

- [ ] **Step 1: Localizar onde estão os links acadêmicos**

Run: `grep -rn "organograma\|/series\|/turmas" src/components/layout/`
Expected: encontra o array/dropdown de itens acadêmicos (Séries, Turmas, Organograma, Atribuições).

- [ ] **Step 2: Adicionar item "Calendário"**

No mesmo array/lista onde aparece `{ href: "/organograma", label: "Organograma", ... }`, adicionar um item análogo:

```typescript
{ href: "/calendario", label: "Calendário Letivo" },
```

Manter o formato exato dos itens vizinhos (se eles têm `icon`, incluir um ícone — use `CalendarDays` de `lucide-react`; se não têm, omitir).

- [ ] **Step 3: Verificar tipos e build**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/topbar.tsx
git commit -m "feat(calendario): add calendario link to academic menu"
```

---

## Task 15: Integração na chamada — backend

`saveClassAttendanceAction` deve rejeitar lançamento de frequência em data não-letiva. Defesa no servidor.

**Files:**
- Modify: `src/lib/actions/attendance.ts`

- [ ] **Step 1: Ler a action atual**

Run: `cat src/lib/actions/attendance.ts`
Expected: ver `saveClassAttendanceAction`, como lê `turma_id` e `data_aula` do FormData.

- [ ] **Step 2: Adicionar validação de dia letivo**

No início de `saveClassAttendanceAction`, após extrair `data_aula` do FormData e antes de gravar as `frequencias`, adicionar:

```typescript
import { getCalendario } from "@/lib/data/calendario";
import { isDiaLetivo } from "@/lib/calendario/dias-letivos";

// ... dentro de saveClassAttendanceAction, após obter dataAula:
const anoLetivo = Number(dataAula.slice(0, 4));
const cal = await getCalendario(anoLetivo);
if (cal && !isDiaLetivo(dataAula, cal.calendario, cal.excecoes)) {
  throw new Error("Data não é um dia letivo no calendário. Verifique o calendário letivo.");
}
// Se não há calendário cadastrado (cal === null), não bloqueia — permite uso sem calendário.
```

Adaptar o nome da variável `dataAula` ao que a action já usa (pode ser `data_aula`, `dataAula`, etc. — usar o nome real encontrado no Step 1).

- [ ] **Step 3: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
git add src/lib/actions/attendance.ts
git commit -m "feat(calendario): block non-school-day attendance in server action"
```

---

## Task 16: Integração na chamada — frontend

A página `/frequencias/chamada` deve avisar e impedir seleção de data não-letiva. `getClassAttendanceData` passa a retornar se a data é letiva.

**Files:**
- Modify: `src/lib/data/attendance.ts`
- Modify: `src/app/(app)/frequencias/chamada/page.tsx`

- [ ] **Step 1: `getClassAttendanceData` retorna info de dia letivo**

Em `src/lib/data/attendance.ts`, dentro de `getClassAttendanceData`, após resolver `today` (a data efetiva), buscar o calendário e calcular se é letivo. Adicionar os imports no topo:

```typescript
import { getCalendario } from "@/lib/data/calendario";
import { isDiaLetivo } from "@/lib/calendario/dias-letivos";
```

Antes do `return` final da função, calcular:

```typescript
const anoLetivo = Number(today.slice(0, 4));
const cal = await getCalendario(anoLetivo);
const diaLetivo = cal ? isDiaLetivo(today, cal.calendario, cal.excecoes) : true;
const temCalendario = cal !== null;
```

E incluir `diaLetivo` e `temCalendario` no objeto retornado (em ambos os `return` da função — o early-return sem turma e o return final).

- [ ] **Step 2: Página da chamada mostra aviso e bloqueia salvar**

Em `src/app/(app)/frequencias/chamada/page.tsx`, após obter `data` de `getClassAttendanceData`:

Adicionar, logo acima do `<form action={saveClassAttendanceAction} ...>`, um aviso condicional:

```typescript
{data.temCalendario && !data.diaLetivo && (
  <div className="rounded-ui border border-danger/40 bg-danger/10 p-4 text-sm text-danger">
    <p className="font-semibold">Data não letiva</p>
    <p className="mt-1 text-xs">
      {data.date.split("-").reverse().join("/")} não é um dia letivo no calendário
      (feriado, recesso ou fim de semana). Não é possível lançar frequência.
    </p>
  </div>
)}
```

E no botão "Salvar chamada", ampliar a condição `disabled`:

```typescript
<button
  className="ds-button ds-button-accent"
  disabled={data.students.length === 0 || (data.temCalendario && !data.diaLetivo)}
>
  <CalendarCheck size={16} /> Salvar chamada
</button>
```

- [ ] **Step 3: Verificar tipos e build**

Run: `npx tsc --noEmit && npm run build`
Expected: sem erros, build passa.

- [ ] **Step 4: Commit**

```bash
git add src/lib/data/attendance.ts "src/app/(app)/frequencias/chamada/page.tsx"
git commit -m "feat(calendario): warn and block non-school-day attendance in UI"
```

---

## Task 17: Verificação manual e teste integrado

- [ ] **Step 1: Rodar a suíte de testes**

Run: `npm test`
Expected: 9 testes de `dias-letivos.test.ts` passam.

- [ ] **Step 2: Build final**

Run: `npm run build`
Expected: build passa sem erros; rota `/calendario` listada.

- [ ] **Step 3: Smoke test no dev server**

Run: `npm run dev`

Verificar manualmente no browser:
1. `/calendario` abre, seletor de ano aparece.
2. Configurar um calendário (ex: 2026, 02/02 a 18/12, seg-sex) → salvar.
3. Card resumo mostra total de dias letivos + badge.
4. Grade de 12 meses renderiza, dias coloridos corretamente.
5. Adicionar um feriado → aparece na lista, fica vermelho na grade, total de dias cai.
6. Excluir o feriado (ConfirmButton pede confirmação) → some da lista.
7. Em `/frequencias/chamada`, escolher uma data de feriado/sábado → aviso vermelho aparece, "Salvar chamada" desabilitado.
8. Escolher uma data letiva → aviso some, botão habilita.

- [ ] **Step 4: Commit final (se houver ajustes)**

```bash
git add -A
git commit -m "test(calendario): manual verification fixes"
```

---

## Notas de execução

- **DEFAULT_SCHOOL_ID** — o codebase usa `DEFAULT_SCHOOL_ID` constante para escopo de escola nas actions/data layer (single-tenant na prática). RLS já filtra por escola via `current_perfil()`.
- **Sem calendário = sem bloqueio** — se um ano não tem calendário cadastrado, a chamada de frequência funciona normalmente (não bloqueia). O bloqueio só vale quando há calendário.
- **Ordem das tasks** — Tasks 1-8 são backend/lógica (independentes da UI). Tasks 9-14 são UI do calendário. Tasks 15-16 integram com a chamada. Task 17 valida tudo.
- **Migração** — Task 5 aplica via MCP Supabase direto em produção (`fljkjhmwnjehsodvqaqk`). O arquivo `.sql` fica versionado em `supabase/migrations/` para histórico.
