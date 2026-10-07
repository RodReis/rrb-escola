# Seções da Ficha e Associação ao Questionário Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dois cadastros novos em `/questionario/*`: Seção da Ficha Avaliativa (catálogo isolado) e Associação da Série ao Questionário (questionário × turma × etapa × professor, criada em lote).

**Architecture:** Uma migration (2 tabelas, RLS por escola, 2 módulos RBAC). Regras puras (schemas zod, combinação de lote) com testes; Server Actions finas (`requirePermission` → valida → `assertOk`); telas no mesmo padrão do módulo (server page + componentes client com `useAction`). Reusa `ativo.ts`, `ActionResult`, `fakeSupabase`, `BotaoAtivar`, `listProfessores`.

**Tech Stack:** Next.js 14 App Router, Supabase (`@supabase/ssr`, sem tipos gerados), zod 3, vitest 4 + Testing Library, DS do projeto (`ds-*`).

**Spec:** `docs/superpowers/specs/2026-10-06-secoes-associacoes-questionario-design.md` (estende `docs/superpowers/specs/2026-10-06-questionario-design.md`)

## Global Constraints

- Branch `feat/secoes-associacoes` (a partir da `main`). `git add` só dos arquivos de cada task: a árvore tem arquivos alheios modificados (`package.json`, `package-lock.json`, um spec do financeiro). **Nunca** `git add -A`.
- DS do projeto (CLAUDE.md): sem hex/rgb cru, sem serifa, usar `src/components/ui/*` (`PageHeader`, `Panel`, `DataTableShell`, `StatusPill`, `Button`, `Switch`, `SearchInline`). Nunca `confirm()` nativo (usar `useAction({ confirm })`).
- UI em PT-BR.
- Ativar/inativar = coluna `ativo`; **sem delete físico**.
- Server Actions: `requirePermission(modulo, acao)` primeiro; escrita sempre por `assertOk(...)`; arquivos `"use server"` exportam só funções async; retorno `ActionResult` (`@/lib/questionario/tipos`).
- **`tsconfig` com `target: es5` (sem `downlevelIteration`)**: nada de `for…of` sobre Map/Set/`.entries()`, nem spread/`Array.from` de Set/Map; deduplicar com `filter((x, i, a) => a.indexOf(x) === i)`. `for…of` sobre array comum é permitido. Sem `\p{…}` com flag `u`.
- Módulos RBAC: `questionario.secao` e `questionario.associacao` (grupo `academico`); admin e secretaria leitura/criação/edição/exclusão; financeiro e professor nada.
- Professor = **funcionário do RH** (`employees`, `school_category in ('fund1','fund2','medio')`, `ativo`): mesma lista de `listProfessores()` (`src/lib/data/pedagogico.ts`). `questionario_associacoes.professor_id` referencia `employees(id)`.
- Etapa = inteiro 1 a 4. Ano e Série **não** são gravados (vêm de `turmas.ano_letivo` / `turmas.serie_id`).
- Migration `202610060003_secoes_associacoes_questionario.sql`. **Não aplicar em produção** sem autorização explícita do dono do projeto; `db reset --local` está quebrado por bug antigo (validar por leitura).
- Gates antes de fechar: `npm run typecheck && npm run test && npm run build`. Erros de `tsc` só em `.next/types` são resíduo de build de outra branch (ignorar). O `npm run test` tem 1 *unhandled error* antigo em `src/lib/hooks/use-action.test.tsx` (não tocar); os testes do módulo se rodam com `npx vitest run questionario`.
- Commits: `feat(questionario): <descrição>` + trailer `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Scripts Python/edições grandes: se um heredoc do Bash falhar no parse, grave o script com a ferramenta Write e rode-o por arquivo.

## Review Focus

1. **Lote com combinações já existentes** (parcial ou total): só cria as que faltam; se todas existem, responde "nenhuma nova" e **não faz insert** (Tasks 2 e 4).
2. **Lote sem etapa ou sem turma marcada**: erro claro, banco intocado (Task 4).
3. **Questionário, turma ou professor inexistente/inativo** no lote e na edição; referência já gravada e hoje inativa **continua válida** numa edição que não a troca (Task 4).
4. **Edição que duplica outra associação** (mesmo questionário+turma+etapa+professor) → mensagem amigável "Já existe um registro…", não erro cru (Task 4).
5. **Seção com descrição duplicada** (índice único sem caixa) → mensagem amigável (Task 3).
6. **Acesso direto por URL/POST sem permissão** (financeiro/professor): rotas mapeadas em `ROTA_PARA_MODULO` e `requirePermission` com módulo/ação certos em toda action (Tasks 1, 3 e 4).

---

## File Structure

| Arquivo | Responsabilidade |
|---|---|
| `supabase/migrations/202610060003_secoes_associacoes_questionario.sql` | Tabelas, RLS, RBAC |
| `src/lib/auth/permissions.ts` (mod.) + `questionario-rbac.test.ts` (mod.) | Módulos e rotas |
| `src/lib/validation/questionario.ts` (mod.) | `SecaoSchema`, `AssociacaoLoteSchema`, `AssociacaoEdicaoSchema` |
| `src/lib/questionario/associacoes.ts` | `unicos`, `combinarAssociacoes`, `anoPadrao`, `TURNO_LABEL`, `rotuloTurma` |
| `src/lib/questionario/tipos.ts` (mod.) | `SecaoRow`, `TurmaOpcao`, `AssociacaoRow` |
| `src/lib/questionario/ativo.ts` (mod.) | aceita as 2 tabelas novas |
| `src/lib/data/questionario.ts` (mod.) | `listarSecoes`, `listarTurmasOpcoes`, `listarAssociacoes` |
| `src/lib/actions/questionario-secoes.ts` | actions de Seção |
| `src/lib/actions/questionario-associacoes.ts` | actions de Associação (lote, edição, toggle) |
| `src/components/questionario/secoes-manager.tsx` | tela única de Seções |
| `src/components/questionario/associacoes-{manager,form,lista}.tsx` | tela de Associações |
| `src/app/(app)/questionario/{secoes,associacoes}/page.tsx` | rotas |
| `src/components/layout/topbar.tsx` (mod.) | 2 filhos no menu "Questionário" |

---

### Task 1: Migration e RBAC

**Files:**
- Create: `supabase/migrations/202610060003_secoes_associacoes_questionario.sql`
- Modify: `src/lib/auth/permissions.ts` (`MODULOS`, `ROTA_PARA_MODULO`)
- Modify (test): `src/lib/auth/questionario-rbac.test.ts`

**Interfaces:**
- Produces: `ModuloCodigo` passa a aceitar `"questionario.secao" | "questionario.associacao"`; tabelas `ficha_secoes` e `questionario_associacoes`.

- [ ] **Step 1: Teste que falha** — em `src/lib/auth/questionario-rbac.test.ts`, acrescentar as duas rotas ao objeto `ROTAS`:

```ts
const ROTAS = {
  "/questionario/grupos": "questionario.grupo",
  "/questionario/escalas": "questionario.escala",
  "/questionario/questoes": "questionario.questao",
  "/questionario/questionarios": "questionario.questionario",
  "/questionario/secoes": "questionario.secao",
  "/questionario/associacoes": "questionario.associacao",
} as const;
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/auth/questionario-rbac.test.ts`
Expected: FAIL nos 2 casos novos (`expected undefined to be "questionario.secao"`), os 4 antigos passam.

- [ ] **Step 3: Registrar módulos e rotas** — em `src/lib/auth/permissions.ts`, logo após a linha de `"questionario.questionario"` em `MODULOS`:

```ts
  "questionario.secao": { grupo: "academico", nome: "Questionário — Seções da Ficha" },
  "questionario.associacao": { grupo: "academico", nome: "Questionário — Associações" },
```

e em `ROTA_PARA_MODULO`, após `"/questionario/questionarios": "questionario.questionario",`:

```ts
  "/questionario/secoes": "questionario.secao",
  "/questionario/associacoes": "questionario.associacao",
```

- [ ] **Step 4: Migration**

```sql
-- supabase/migrations/202610060003_secoes_associacoes_questionario.sql
-- Seções da Ficha Avaliativa (catálogo) e Associação da Série ao Questionário
-- (spec 2026-10-06-secoes-associacoes-questionario-design).
-- Ano e Série não são gravados: vêm de turmas.ano_letivo / turmas.serie_id.

-- 1) RBAC
insert into modulos (codigo, grupo, nome, ordem) values
  ('questionario.secao',      'academico', 'Questionário — Seções da Ficha', 74),
  ('questionario.associacao', 'academico', 'Questionário — Associações', 75)
on conflict (codigo) do nothing;

insert into role_permissoes (role_codigo, modulo_codigo, pode_ler, pode_criar, pode_editar, pode_deletar)
select r.codigo, m.codigo,
       r.codigo in ('admin', 'secretaria'), r.codigo in ('admin', 'secretaria'),
       r.codigo in ('admin', 'secretaria'), r.codigo in ('admin', 'secretaria')
from roles r
cross join (values ('questionario.secao'), ('questionario.associacao')) as m(codigo)
where r.codigo in ('admin', 'secretaria', 'financeiro', 'professor')
on conflict (role_codigo, modulo_codigo) do nothing;

-- 2) Tabelas
create table if not exists public.ficha_secoes (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references escolas(id) on delete cascade,
  codigo serial,
  descricao text not null check (length(btrim(descricao)) > 0),
  permite_lancamento_coletivo boolean not null default false,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists ficha_secoes_descricao_uq
  on ficha_secoes (escola_id, lower(descricao));

create table if not exists public.questionario_associacoes (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references escolas(id) on delete cascade,
  questionario_id uuid not null references questionarios(id) on delete restrict,
  turma_id uuid not null references turmas(id) on delete restrict,
  etapa smallint not null check (etapa between 1 and 4),
  professor_id uuid not null references employees(id) on delete restrict,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (questionario_id, turma_id, etapa, professor_id)
);
create index if not exists questionario_associacoes_turma_idx on questionario_associacoes (turma_id);
create index if not exists questionario_associacoes_professor_idx on questionario_associacoes (professor_id);
create index if not exists questionario_associacoes_escola_idx on questionario_associacoes (escola_id);

-- 3) updated_at
create trigger ficha_secoes_updated_at before update on ficha_secoes
  for each row execute function set_updated_at();
create trigger questionario_associacoes_updated_at before update on questionario_associacoes
  for each row execute function set_updated_at();

-- 4) RLS por escola (mesmo padrão do módulo)
do $$
declare t text;
begin
  foreach t in array array['ficha_secoes', 'questionario_associacoes'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy %I on public.%I for all to service_role using (true) with check (true)',
      t || '_service', t);
    execute format(
      'create policy %I on public.%I for all to authenticated '
      'using (escola_id = (select escola_id from current_perfil())) '
      'with check (escola_id = (select escola_id from current_perfil()))',
      t || '_escola', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npx vitest run src/lib/auth/questionario-rbac.test.ts && npx tsc --noEmit 2>&1 | grep -v "^\.next/types"`
Expected: 6 testes passam; sem erros do `tsc` fora de `.next/types`.

- [ ] **Step 6: Commit**

```bash
git add src/lib/auth/permissions.ts src/lib/auth/questionario-rbac.test.ts supabase/migrations/202610060003_secoes_associacoes_questionario.sql
git commit -m "feat(questionario): migration e RBAC de secoes da ficha e associacoes" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Regras puras (schemas, combinação de lote) e tipos

**Files:**
- Modify: `src/lib/validation/questionario.ts`, `src/lib/validation/questionario.test.ts`
- Create: `src/lib/questionario/associacoes.ts`, `src/lib/questionario/associacoes.test.ts`
- Modify: `src/lib/questionario/tipos.ts`, `src/lib/questionario/ativo.ts`

**Interfaces:**
- Produces (`validation/questionario.ts`): `SecaoSchema` (`{ descricao, permiteLancamentoColetivo }`), `AssociacaoLoteSchema` (`{ questionarioId, professorId, etapas: number[], turmaIds: string[] }`), `AssociacaoEdicaoSchema` (`{ id, questionarioId, turmaId, professorId, etapa }`).
- Produces (`associacoes.ts`): `type Combinacao = { turmaId: string; etapa: number }`; `unicos<T>(lista: T[]): T[]`; `combinarAssociacoes(etapas: number[], turmaIds: string[], existentes: Combinacao[]): { criar: Combinacao[]; ignoradas: number }`; `anoPadrao(anos: number[], atual: number): number | null`; `TURNO_LABEL: Record<string, string>`; `rotuloTurma(nome: string, turno: string): string`.
- Produces (`tipos.ts`): `SecaoRow`, `TurmaOpcao`, `AssociacaoRow` (ver Step 3).
- Produces (`ativo.ts`): `alternarAtivo` aceita `"ficha_secoes"` e `"questionario_associacoes"` (ambas com coluna `ativo`).

- [ ] **Step 1: Testes que falham**

Acrescentar ao fim de `src/lib/validation/questionario.test.ts` (e incluir `SecaoSchema, AssociacaoLoteSchema, AssociacaoEdicaoSchema` no `import` do topo, ao lado dos já importados):

```ts
const U1 = "11111111-1111-4111-8111-111111111111";
const U2 = "22222222-2222-4222-8222-222222222222";
const U3 = "33333333-3333-4333-8333-333333333333";

describe("SecaoSchema", () => {
  it("recusa descrição vazia e apara", () => {
    expect(SecaoSchema.safeParse({ descricao: "  ", permiteLancamentoColetivo: false }).success).toBe(false);
    expect(SecaoSchema.parse({ descricao: " Expressão corporal ", permiteLancamentoColetivo: true })).toEqual({
      descricao: "Expressão corporal",
      permiteLancamentoColetivo: true,
    });
  });
});

describe("AssociacaoLoteSchema", () => {
  const ok = { questionarioId: U1, professorId: U2, etapas: [1, 2], turmaIds: [U3] };
  it("aceita um lote válido", () => {
    expect(AssociacaoLoteSchema.safeParse(ok).success).toBe(true);
  });
  it("exige ao menos uma etapa e uma turma", () => {
    expect(AssociacaoLoteSchema.safeParse({ ...ok, etapas: [] })).toMatchObject({ success: false });
    const semEtapa = AssociacaoLoteSchema.safeParse({ ...ok, etapas: [] });
    expect(!semEtapa.success && semEtapa.error.issues[0].message).toBe("Marque ao menos uma etapa");
    const semTurma = AssociacaoLoteSchema.safeParse({ ...ok, turmaIds: [] });
    expect(!semTurma.success && semTurma.error.issues[0].message).toBe("Marque ao menos uma turma");
  });
  it("recusa etapa fora de 1 a 4 e NaN", () => {
    expect(AssociacaoLoteSchema.safeParse({ ...ok, etapas: [5] }).success).toBe(false);
    expect(AssociacaoLoteSchema.safeParse({ ...ok, etapas: [0] }).success).toBe(false);
    expect(AssociacaoLoteSchema.safeParse({ ...ok, etapas: [NaN] }).success).toBe(false);
  });
});

describe("AssociacaoEdicaoSchema", () => {
  it("exige ids válidos e etapa de 1 a 4", () => {
    const ok = { id: U1, questionarioId: U2, turmaId: U3, professorId: U1, etapa: 3 };
    expect(AssociacaoEdicaoSchema.safeParse(ok).success).toBe(true);
    expect(AssociacaoEdicaoSchema.safeParse({ ...ok, etapa: 9 }).success).toBe(false);
    expect(AssociacaoEdicaoSchema.safeParse({ ...ok, turmaId: "" }).success).toBe(false);
  });
});
```

Criar `src/lib/questionario/associacoes.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { anoPadrao, combinarAssociacoes, rotuloTurma, unicos } from "./associacoes";

describe("unicos", () => {
  it("remove repetidos preservando a ordem", () => {
    expect(unicos([3, 1, 3, 2, 1])).toEqual([3, 1, 2]);
  });
});

describe("combinarAssociacoes", () => {
  it("cria todas as combinações etapa × turma quando nada existe", () => {
    const r = combinarAssociacoes([1, 2], ["t1", "t2"], []);
    expect(r.criar).toEqual([
      { turmaId: "t1", etapa: 1 },
      { turmaId: "t1", etapa: 2 },
      { turmaId: "t2", etapa: 1 },
      { turmaId: "t2", etapa: 2 },
    ]);
    expect(r.ignoradas).toBe(0);
  });
  it("ignora as que já existem e conta quantas", () => {
    const r = combinarAssociacoes([1, 2], ["t1", "t2"], [{ turmaId: "t1", etapa: 2 }, { turmaId: "t2", etapa: 1 }]);
    expect(r.criar).toEqual([{ turmaId: "t1", etapa: 1 }, { turmaId: "t2", etapa: 2 }]);
    expect(r.ignoradas).toBe(2);
  });
  it("tudo existente → nada a criar", () => {
    const r = combinarAssociacoes([1], ["t1"], [{ turmaId: "t1", etapa: 1 }]);
    expect(r).toEqual({ criar: [], ignoradas: 1 });
  });
  it("etapas e turmas repetidas na entrada não geram combinação duplicada", () => {
    const r = combinarAssociacoes([1, 1], ["t1", "t1"], []);
    expect(r.criar).toEqual([{ turmaId: "t1", etapa: 1 }]);
  });
});

describe("anoPadrao", () => {
  it("usa o ano atual se existe; senão o maior; null sem anos", () => {
    expect(anoPadrao([2026, 2025], 2026)).toBe(2026);
    expect(anoPadrao([2026, 2025], 2027)).toBe(2026);
    expect(anoPadrao([], 2026)).toBeNull();
  });
});

describe("rotuloTurma", () => {
  it("junta nome e turno legível; sem repetir quando o nome já é o turno", () => {
    expect(rotuloTurma("A", "matutino")).toBe("A (Matutino)");
    expect(rotuloTurma("Vespertino", "vespertino")).toBe("Vespertino");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/validation/questionario.test.ts src/lib/questionario/associacoes.test.ts`
Expected: FAIL (`SecaoSchema` não exportado / `./associacoes` inexistente).

- [ ] **Step 3: Implementar**

Em `src/lib/validation/questionario.ts`, ao final do arquivo:

```ts
export const SecaoSchema = z.object({
  descricao: textoObrigatorio("Descrição é obrigatória"),
  permiteLancamentoColetivo: z.boolean(),
});

const etapaSchema = z
  .number({ invalid_type_error: "Etapa inválida" })
  .int("Etapa inválida")
  .min(1, "Etapa inválida")
  .max(4, "Etapa inválida");

export const AssociacaoLoteSchema = z.object({
  questionarioId: z.string().uuid("Questionário é obrigatório"),
  professorId: z.string().uuid("Professor é obrigatório"),
  etapas: z.array(etapaSchema).min(1, "Marque ao menos uma etapa"),
  turmaIds: z.array(z.string().uuid("Turma inválida")).min(1, "Marque ao menos uma turma"),
});

export const AssociacaoEdicaoSchema = z.object({
  id: z.string().uuid("Registro inválido."),
  questionarioId: z.string().uuid("Questionário é obrigatório"),
  turmaId: z.string().uuid("Turma é obrigatória"),
  professorId: z.string().uuid("Professor é obrigatório"),
  etapa: etapaSchema,
});
```

Criar `src/lib/questionario/associacoes.ts`:

```ts
export type Combinacao = { turmaId: string; etapa: number };

export function unicos<T>(lista: T[]): T[] {
  return lista.filter((x, i) => lista.indexOf(x) === i);
}

/**
 * Lote: todas as combinações turma × etapa, menos as que já existem para o mesmo
 * questionário + professor (`existentes`). `ignoradas` = quantas já existiam.
 */
export function combinarAssociacoes(
  etapas: number[],
  turmaIds: string[],
  existentes: Combinacao[],
): { criar: Combinacao[]; ignoradas: number } {
  const criar: Combinacao[] = [];
  let ignoradas = 0;
  for (const turmaId of unicos(turmaIds)) {
    for (const etapa of unicos(etapas)) {
      if (existentes.some((x) => x.turmaId === turmaId && x.etapa === etapa)) ignoradas++;
      else criar.push({ turmaId, etapa });
    }
  }
  return { criar, ignoradas };
}

/** Ano que a tela abre selecionado: o atual, se há turmas nele; senão o mais recente. */
export function anoPadrao(anos: number[], atual: number): number | null {
  if (anos.length === 0) return null;
  if (anos.indexOf(atual) >= 0) return atual;
  return anos.reduce((a, b) => (b > a ? b : a));
}

export const TURNO_LABEL: Record<string, string> = {
  matutino: "Matutino",
  vespertino: "Vespertino",
  noturno: "Noturno",
  integral: "Integral",
};

export function rotuloTurma(nome: string, turno: string): string {
  const turnoLabel = TURNO_LABEL[turno] ?? turno;
  return nome.trim().toLowerCase() === turnoLabel.toLowerCase() ? nome : `${nome} (${turnoLabel})`;
}
```

Em `src/lib/questionario/tipos.ts`, acrescentar ao final:

```ts
export type SecaoRow = {
  id: string;
  codigo: number;
  descricao: string;
  permiteLancamentoColetivo: boolean;
  ativo: boolean;
};

export type TurmaOpcao = {
  id: string;
  nome: string;
  turno: string;
  anoLetivo: number;
  ativo: boolean;
  serieId: string;
  serieNome: string;
  serieOrdem: number;
};

export type AssociacaoRow = {
  id: string;
  ativo: boolean;
  etapa: number;
  questionarioId: string;
  questionarioDescricao: string;
  turmaId: string;
  turmaNome: string;
  turno: string;
  anoLetivo: number;
  serieId: string;
  serieNome: string;
  professorId: string;
  professorNome: string;
};
```

Em `src/lib/questionario/ativo.ts`, trocar a linha do tipo:

```ts
type Tabela =
  | "questao_grupos"
  | "escalas"
  | "questoes"
  | "questionarios"
  | "ficha_secoes"
  | "questionario_associacoes";
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/validation/questionario.test.ts src/lib/questionario/associacoes.test.ts && npx tsc --noEmit 2>&1 | grep -v "^\.next/types"`
Expected: PASS; `tsc` limpo.

- [ ] **Step 5: Commit**

```bash
git add src/lib/validation/questionario.ts src/lib/validation/questionario.test.ts src/lib/questionario/associacoes.ts src/lib/questionario/associacoes.test.ts src/lib/questionario/tipos.ts src/lib/questionario/ativo.ts
git commit -m "feat(questionario): schemas e combinacao de lote de secoes e associacoes" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Seção da Ficha (tela única)

**Files:**
- Modify: `src/lib/data/questionario.ts` (acrescentar `listarSecoes`)
- Create: `src/lib/actions/questionario-secoes.ts`, `src/lib/actions/questionario-secoes.test.ts`
- Create: `src/components/questionario/secoes-manager.tsx`
- Create: `src/app/(app)/questionario/secoes/page.tsx`

**Interfaces:**
- Consumes: `SecaoSchema`, `IdSchema` (T2); `lerTexto` (`@/lib/questionario/lista`); `alternarAtivo` (T2); `primeiroErro`, `ActionResult`, `SecaoRow`; `formBoolean` (`@/lib/utils`); `fakeSupabase`, `formData` (`@/lib/questionario/test-support`); `BotaoAtivar`; `podeAcao` (`@/lib/questionario/acesso`).
- Produces: `criarSecaoAction`, `atualizarSecaoAction`, `alternarAtivoSecaoAction` (todas `(formData: FormData) => Promise<ActionResult>`); campos do form: `id`, `descricao`, `permiteLancamentoColetivo` (`"on"` ou ausente); rota `/questionario/secoes`.

- [ ] **Step 1: Teste que falha**

```ts
// src/lib/actions/questionario-secoes.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeSupabase, formData } from "@/lib/questionario/test-support";

const h = vi.hoisted(() => ({
  client: null as unknown,
  requirePermission: vi.fn(),
  revalidatePath: vi.fn(),
}));
vi.mock("@/lib/auth/session", () => ({ requirePermission: h.requirePermission }));
vi.mock("next/cache", () => ({ revalidatePath: h.revalidatePath }));
vi.mock("@/lib/supabase/server", () => ({ createServerClient: async () => h.client }));

import { alternarAtivoSecaoAction, atualizarSecaoAction, criarSecaoAction } from "./questionario-secoes";

const ID = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  h.requirePermission.mockReset().mockResolvedValue({ profile: { escola_id: "escola-1" } });
  h.revalidatePath.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("criarSecaoAction", () => {
  it("exige create no módulo da seção e grava na escola do usuário", async () => {
    const db = fakeSupabase();
    h.client = db.client;
    const r = await criarSecaoAction(formData({ descricao: "  Expressão corporal ", permiteLancamentoColetivo: "on" }));
    expect(h.requirePermission).toHaveBeenCalledWith("questionario.secao", "create");
    expect(r).toMatchObject({ ok: true });
    expect(db.chamadas("ficha_secoes", "insert")[0].payload).toEqual({
      escola_id: "escola-1",
      descricao: "Expressão corporal",
      permite_lancamento_coletivo: true,
    });
    expect(h.revalidatePath).toHaveBeenCalledWith("/questionario/secoes");
  });

  it("sem o flag, grava lançamento coletivo = false", async () => {
    const db = fakeSupabase();
    h.client = db.client;
    await criarSecaoAction(formData({ descricao: "Registro" }));
    expect(db.chamadas("ficha_secoes", "insert")[0].payload).toMatchObject({ permite_lancamento_coletivo: false });
  });

  it("recusa descrição vazia sem tocar no banco", async () => {
    const db = fakeSupabase();
    h.client = db.client;
    const r = await criarSecaoAction(formData({ descricao: "   " }));
    expect(r).toEqual({ ok: false, error: "Descrição é obrigatória" });
    expect(db.calls).toHaveLength(0);
  });

  it("descrição duplicada vira mensagem amigável", async () => {
    h.client = fakeSupabase({
      "ficha_secoes.insert": [{ error: { message: "duplicate key", code: "23505" } }],
    }).client;
    await expect(criarSecaoAction(formData({ descricao: "Registro" }))).rejects.toThrow(/Já existe um registro/);
  });
});

describe("atualizarSecaoAction", () => {
  it("atualiza descrição e flag só da seção da escola", async () => {
    const db = fakeSupabase();
    h.client = db.client;
    const r = await atualizarSecaoAction(formData({ id: ID, descricao: "Novo", permiteLancamentoColetivo: "on" }));
    expect(h.requirePermission).toHaveBeenCalledWith("questionario.secao", "update");
    expect(r).toMatchObject({ ok: true });
    const upd = db.chamadas("ficha_secoes", "update")[0];
    expect(upd.payload).toEqual({ descricao: "Novo", permite_lancamento_coletivo: true });
    expect(upd.filtros).toContainEqual(["eq", "id", ID]);
    expect(upd.filtros).toContainEqual(["eq", "escola_id", "escola-1"]);
  });

  it("recusa id inválido", async () => {
    const db = fakeSupabase();
    h.client = db.client;
    expect((await atualizarSecaoAction(formData({ id: "x", descricao: "Novo" }))).ok).toBe(false);
    expect(db.calls).toHaveLength(0);
  });
});

describe("alternarAtivoSecaoAction", () => {
  it("inativa sem apagar", async () => {
    const db = fakeSupabase();
    h.client = db.client;
    const r = await alternarAtivoSecaoAction(formData({ id: ID, ativo: "false" }));
    expect(h.requirePermission).toHaveBeenCalledWith("questionario.secao", "update");
    expect(r).toMatchObject({ ok: true });
    expect(db.chamadas("ficha_secoes", "update")[0].payload).toEqual({ ativo: false });
    expect(db.chamadas("ficha_secoes", "delete")).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/actions/questionario-secoes.test.ts`
Expected: FAIL (`./questionario-secoes` inexistente).

- [ ] **Step 3: Implementar as actions**

```ts
// src/lib/actions/questionario-secoes.ts
"use server";

import { revalidatePath } from "next/cache";
import { assertOk } from "@/lib/actions/assert-ok";
import { requirePermission } from "@/lib/auth/session";
import { createServerClient } from "@/lib/supabase/server";
import { alternarAtivo } from "@/lib/questionario/ativo";
import { lerTexto } from "@/lib/questionario/lista";
import { primeiroErro, type ActionResult } from "@/lib/questionario/tipos";
import { formBoolean } from "@/lib/utils";
import { IdSchema, SecaoSchema } from "@/lib/validation/questionario";

const ROTA = "/questionario/secoes";

function lerSecao(formData: FormData) {
  return SecaoSchema.safeParse({
    descricao: lerTexto(formData, "descricao"),
    permiteLancamentoColetivo: formBoolean(formData, "permiteLancamentoColetivo"),
  });
}

export async function criarSecaoAction(formData: FormData): Promise<ActionResult> {
  const session = await requirePermission("questionario.secao", "create");
  const parsed = lerSecao(formData);
  if (!parsed.success) return { ok: false, error: primeiroErro(parsed.error) };

  const db = await createServerClient();
  assertOk(
    await db.from("ficha_secoes").insert({
      escola_id: session.profile.escola_id,
      descricao: parsed.data.descricao,
      permite_lancamento_coletivo: parsed.data.permiteLancamentoColetivo,
    }),
    "Não foi possível cadastrar a seção",
  );
  revalidatePath(ROTA);
  return { ok: true, message: "Seção cadastrada." };
}

export async function atualizarSecaoAction(formData: FormData): Promise<ActionResult> {
  const session = await requirePermission("questionario.secao", "update");
  const id = IdSchema.safeParse(lerTexto(formData, "id"));
  if (!id.success) return { ok: false, error: primeiroErro(id.error) };
  const parsed = lerSecao(formData);
  if (!parsed.success) return { ok: false, error: primeiroErro(parsed.error) };

  const db = await createServerClient();
  assertOk(
    await db
      .from("ficha_secoes")
      .update({
        descricao: parsed.data.descricao,
        permite_lancamento_coletivo: parsed.data.permiteLancamentoColetivo,
      })
      .eq("id", id.data)
      .eq("escola_id", session.profile.escola_id),
    "Não foi possível salvar a seção",
  );
  revalidatePath(ROTA);
  return { ok: true, message: "Seção atualizada." };
}

export async function alternarAtivoSecaoAction(formData: FormData): Promise<ActionResult> {
  const session = await requirePermission("questionario.secao", "update");
  const resultado = await alternarAtivo(formData, "ficha_secoes", session.profile.escola_id);
  if (resultado.ok) revalidatePath(ROTA);
  return resultado;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/actions/questionario-secoes.test.ts`
Expected: PASS (7 testes).

- [ ] **Step 5: Query, tela e página**

Em `src/lib/data/questionario.ts`: acrescentar `SecaoRow` ao `import type { … } from "@/lib/questionario/tipos"` e, ao final do arquivo:

```ts
export async function listarSecoes(): Promise<SecaoRow[]> {
  const db = await createServerClient();
  const { data, error } = await db
    .from("ficha_secoes")
    .select("id, codigo, descricao, permite_lancamento_coletivo, ativo")
    .order("descricao");
  if (error) throw error;
  return ((data ?? []) as Array<{
    id: string;
    codigo: number;
    descricao: string;
    permite_lancamento_coletivo: boolean;
    ativo: boolean;
  }>).map((s) => ({
    id: s.id,
    codigo: s.codigo,
    descricao: s.descricao,
    permiteLancamentoColetivo: s.permite_lancamento_coletivo,
    ativo: s.ativo,
  }));
}
```

```tsx
// src/components/questionario/secoes-manager.tsx
"use client";

import { useState, type FormEvent } from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/card";
import { DataTableShell } from "@/components/ui/data-table";
import { SearchInline } from "@/components/ui/search-inline";
import { StatusPill } from "@/components/ui/status-pill";
import { Switch } from "@/components/ui/switch";
import { BotaoAtivar } from "@/components/questionario/botao-ativar";
import {
  alternarAtivoSecaoAction,
  atualizarSecaoAction,
  criarSecaoAction,
} from "@/lib/actions/questionario-secoes";
import { useAction } from "@/lib/hooks/use-action";
import { normalizarBusca } from "@/lib/questionario/lista";
import type { SecaoRow } from "@/lib/questionario/tipos";

type Props = { secoes: SecaoRow[]; podeCriar: boolean; podeEditar: boolean };

export function SecoesManager({ secoes, podeCriar, podeEditar }: Props) {
  const [editando, setEditando] = useState<SecaoRow | null>(null);
  const [coletivo, setColetivo] = useState(false);
  const [busca, setBusca] = useState("");
  const [formKey, setFormKey] = useState(0);

  const salvar = useAction(
    (fd: FormData) => (fd.get("id") ? atualizarSecaoAction(fd) : criarSecaoAction(fd)),
    { onSuccess: () => limpar() },
  );

  function limpar() {
    setEditando(null);
    setColetivo(false);
    setFormKey((k) => k + 1);
  }

  function editar(secao: SecaoRow) {
    setEditando(secao);
    setColetivo(secao.permiteLancamentoColetivo);
  }

  function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    salvar.run(new FormData(e.currentTarget));
  }

  const termo = normalizarBusca(busca);
  const visiveis = secoes.filter((s) => normalizarBusca(s.descricao).includes(termo));
  const mostrarForm = editando ? podeEditar : podeCriar;

  return (
    <div className="grid gap-6">
      {mostrarForm ? (
        <Panel>
          <form key={`${editando?.id ?? "novo"}-${formKey}`} onSubmit={enviar} className="flex flex-wrap items-end gap-4">
            {editando ? <input type="hidden" name="id" value={editando.id} /> : null}
            <input type="hidden" name="permiteLancamentoColetivo" value={coletivo ? "on" : ""} />
            <div className="grid min-w-[16rem] flex-1 gap-1">
              <label htmlFor="secao-descricao" className="text-sm font-medium text-ink/80">
                Descrição *
              </label>
              <input id="secao-descricao" name="descricao" required defaultValue={editando?.descricao ?? ""} />
            </div>
            <Switch checked={coletivo} onChange={setColetivo} label="Permite lançamento coletivo" />
            <Button type="submit" variant="primary" loading={salvar.pending}>
              {editando ? "Salvar" : "Cadastrar"}
            </Button>
            {editando ? (
              <Button type="button" variant="secondary" onClick={limpar}>
                Cancelar
              </Button>
            ) : null}
          </form>
        </Panel>
      ) : null}

      <DataTableShell
        toolbar={<SearchInline value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Pesquisar" />}
      >
        <table className="ds-dt min-w-[640px]">
          <thead>
            <tr>
              <th className="w-[110px]">Código</th>
              <th>Descrição</th>
              <th className="w-[220px]">Permite lançamento coletivo</th>
              <th className="w-[130px]">Situação</th>
              <th className="w-[110px] text-right">Ação</th>
            </tr>
          </thead>
          <tbody>
            {visiveis.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center text-sm text-ink/60">
                  Nenhuma seção encontrada.
                </td>
              </tr>
            ) : null}
            {visiveis.map((s) => (
              <tr key={s.id}>
                <td className="pl-4 font-semibold text-ink">{s.codigo}</td>
                <td className="text-ink">{s.descricao}</td>
                <td className="text-ink/80">{s.permiteLancamentoColetivo ? "Sim" : "Não"}</td>
                <td>
                  <StatusPill tone={s.ativo ? "success" : "neutral"}>{s.ativo ? "Ativa" : "Inativa"}</StatusPill>
                </td>
                <td className="pr-4">
                  {podeEditar ? (
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        aria-label={`Editar ${s.descricao}`}
                        onClick={() => editar(s)}
                        className="rounded-ui p-1.5 text-brand hover:bg-brand/10"
                      >
                        <Pencil size={16} />
                      </button>
                      <BotaoAtivar acao={alternarAtivoSecaoAction} id={s.id} ativo={s.ativo} nome={s.descricao} />
                    </div>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </DataTableShell>
    </div>
  );
}
```

```tsx
// src/app/(app)/questionario/secoes/page.tsx
import { PageHeader } from "@/components/ui/page-header";
import { SecoesManager } from "@/components/questionario/secoes-manager";
import { requirePermission } from "@/lib/auth/session";
import { listarSecoes } from "@/lib/data/questionario";
import { podeAcao } from "@/lib/questionario/acesso";

export default async function SecoesPage() {
  const session = await requirePermission("questionario.secao", "read");
  const secoes = await listarSecoes();

  return (
    <div className="grid gap-8">
      <PageHeader
        breadcrumb={[{ label: "Acadêmico" }, { label: "Questionário" }, { label: "Seções da ficha avaliativa" }]}
        title="Seções da Ficha Avaliativa"
        counter={String(secoes.length)}
      />
      <SecoesManager
        secoes={secoes}
        podeCriar={podeAcao(session, "questionario.secao", "create")}
        podeEditar={podeAcao(session, "questionario.secao", "update")}
      />
    </div>
  );
}
```

- [ ] **Step 6: Typecheck e commit**

Run: `npx tsc --noEmit 2>&1 | grep -v "^\.next/types"; npx vitest run src/lib/actions/questionario-secoes.test.ts`
Expected: `tsc` limpo; PASS.

```bash
git add src/lib/data/questionario.ts src/lib/actions/questionario-secoes.ts src/lib/actions/questionario-secoes.test.ts src/components/questionario/secoes-manager.tsx "src/app/(app)/questionario/secoes/page.tsx"
git commit -m "feat(questionario): cadastro de secoes da ficha avaliativa" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Actions da Associação (lote, edição, ativar/inativar) e queries

**Files:**
- Create: `src/lib/actions/questionario-associacoes.ts`, `src/lib/actions/questionario-associacoes.test.ts`
- Modify: `src/lib/data/questionario.ts` (acrescentar `listarTurmasOpcoes`, `listarAssociacoes`)

**Interfaces:**
- Consumes: `AssociacaoLoteSchema`, `AssociacaoEdicaoSchema`, `IdSchema` (T2); `combinarAssociacoes`, `unicos` (T2); `alternarAtivo`; `lerLista`, `lerTexto`; `primeiroErro`, `ActionResult`, `TurmaOpcao`, `AssociacaoRow`; `fakeSupabase`, `formData`.
- Produces: `criarAssociacoesAction` (campos `questionarioId`, `professorId`, `etapas` repetido, `turmaIds` repetido), `atualizarAssociacaoAction` (campos `id`, `questionarioId`, `turmaId`, `professorId`, `etapa`), `alternarAtivoAssociacaoAction` (`id`, `ativo`); `listarTurmasOpcoes(): Promise<TurmaOpcao[]>`, `listarAssociacoes(): Promise<AssociacaoRow[]>`.

- [ ] **Step 1: Teste que falha**

```ts
// src/lib/actions/questionario-associacoes.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeSupabase, formData } from "@/lib/questionario/test-support";

const h = vi.hoisted(() => ({
  client: null as unknown,
  requirePermission: vi.fn(),
  revalidatePath: vi.fn(),
}));
vi.mock("@/lib/auth/session", () => ({ requirePermission: h.requirePermission }));
vi.mock("next/cache", () => ({ revalidatePath: h.revalidatePath }));
vi.mock("@/lib/supabase/server", () => ({ createServerClient: async () => h.client }));

import {
  alternarAtivoAssociacaoAction,
  atualizarAssociacaoAction,
  criarAssociacoesAction,
} from "./questionario-associacoes";

const U = (n: number) =>
  `${String(n).repeat(8)}-${String(n).repeat(4)}-4${String(n).repeat(3)}-8${String(n).repeat(3)}-${String(n).repeat(12)}`;
const Q = U(1), P = U(2), T1 = U(3), T2 = U(4), ID = U(5), Q2 = U(6), T3 = U(7), P2 = U(8);

const questionarioAtivo = { "questionarios.select": [{ data: { id: Q, ativo: true } }] };
const turmasAtivas = {
  "turmas.select": [
    {
      data: [
        { id: T1, nome: "Matutino", ativo: true },
        { id: T2, nome: "Vespertino", ativo: true },
      ],
    },
  ],
};
const professorValido = { "employees.select": [{ data: { id: P } }] };

const lote = (extra: Record<string, string | string[]> = {}) =>
  formData({ questionarioId: Q, professorId: P, etapas: ["1", "2"], turmaIds: [T1, T2], ...extra });

beforeEach(() => {
  h.requirePermission.mockReset().mockResolvedValue({ profile: { escola_id: "escola-1" } });
  h.revalidatePath.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("criarAssociacoesAction", () => {
  it("cria todas as combinações etapa × turma numa única inserção, na escola do usuário", async () => {
    const db = fakeSupabase({
      ...questionarioAtivo,
      ...turmasAtivas,
      ...professorValido,
      "questionario_associacoes.select": [{ data: [] }],
    });
    h.client = db.client;

    const r = await criarAssociacoesAction(lote());

    expect(h.requirePermission).toHaveBeenCalledWith("questionario.associacao", "create");
    expect(r).toEqual({ ok: true, message: "4 associações criadas." });
    const inserts = db.chamadas("questionario_associacoes", "insert");
    expect(inserts).toHaveLength(1);
    expect(inserts[0].payload).toEqual([
      { escola_id: "escola-1", questionario_id: Q, professor_id: P, turma_id: T1, etapa: 1 },
      { escola_id: "escola-1", questionario_id: Q, professor_id: P, turma_id: T1, etapa: 2 },
      { escola_id: "escola-1", questionario_id: Q, professor_id: P, turma_id: T2, etapa: 1 },
      { escola_id: "escola-1", questionario_id: Q, professor_id: P, turma_id: T2, etapa: 2 },
    ]);
    expect(h.revalidatePath).toHaveBeenCalledWith("/questionario/associacoes");
  });

  it("ignora as combinações que já existem e informa quantas", async () => {
    const db = fakeSupabase({
      ...questionarioAtivo,
      ...turmasAtivas,
      ...professorValido,
      "questionario_associacoes.select": [{ data: [{ turma_id: T1, etapa: 1 }, { turma_id: T2, etapa: 2 }] }],
    });
    h.client = db.client;
    const r = await criarAssociacoesAction(lote());
    expect(r).toEqual({ ok: true, message: "2 associações criadas; 2 já existiam." });
    expect(db.chamadas("questionario_associacoes", "insert")[0].payload).toEqual([
      { escola_id: "escola-1", questionario_id: Q, professor_id: P, turma_id: T1, etapa: 2 },
      { escola_id: "escola-1", questionario_id: Q, professor_id: P, turma_id: T2, etapa: 1 },
    ]);
  });

  it("se todas já existem, não insere e avisa", async () => {
    const db = fakeSupabase({
      ...questionarioAtivo,
      ...turmasAtivas,
      ...professorValido,
      "questionario_associacoes.select": [
        { data: [{ turma_id: T1, etapa: 1 }, { turma_id: T1, etapa: 2 }, { turma_id: T2, etapa: 1 }, { turma_id: T2, etapa: 2 }] },
      ],
    });
    h.client = db.client;
    const r = await criarAssociacoesAction(lote());
    expect(r).toEqual({ ok: true, message: "Nenhuma associação nova: as 4 já existiam." });
    expect(db.chamadas("questionario_associacoes", "insert")).toHaveLength(0);
  });

  it("sem etapa ou sem turma: erro claro e banco intocado", async () => {
    const db = fakeSupabase();
    h.client = db.client;
    expect(await criarAssociacoesAction(lote({ etapas: [] }))).toEqual({ ok: false, error: "Marque ao menos uma etapa" });
    expect(await criarAssociacoesAction(lote({ turmaIds: [] }))).toEqual({ ok: false, error: "Marque ao menos uma turma" });
    expect(db.calls).toHaveLength(0);
  });

  it("recusa questionário inexistente ou inativo", async () => {
    const inexistente = fakeSupabase({ "questionarios.select": [{ data: null }] });
    h.client = inexistente.client;
    expect(await criarAssociacoesAction(lote())).toEqual({ ok: false, error: "Questionário inválido." });

    const inativo = fakeSupabase({ "questionarios.select": [{ data: { id: Q, ativo: false } }] });
    h.client = inativo.client;
    expect(await criarAssociacoesAction(lote())).toEqual({ ok: false, error: "Questionário inativo." });
    expect(inativo.chamadas("questionario_associacoes", "insert")).toHaveLength(0);
  });

  it("recusa turma inexistente (ou de outra escola) e turma inativa", async () => {
    const faltando = fakeSupabase({ ...questionarioAtivo, "turmas.select": [{ data: [{ id: T1, nome: "Matutino", ativo: true }] }] });
    h.client = faltando.client;
    expect(await criarAssociacoesAction(lote())).toEqual({ ok: false, error: "Turma inválida." });

    const inativa = fakeSupabase({
      ...questionarioAtivo,
      "turmas.select": [{ data: [{ id: T1, nome: "Matutino", ativo: true }, { id: T2, nome: "Vespertino", ativo: false }] }],
    });
    h.client = inativa.client;
    expect(await criarAssociacoesAction(lote())).toEqual({ ok: false, error: 'A turma "Vespertino" está inativa.' });
    expect(inativa.chamadas("questionario_associacoes", "insert")).toHaveLength(0);
  });

  it("recusa professor que não é funcionário ativo de fund1/fund2/medio", async () => {
    const db = fakeSupabase({ ...questionarioAtivo, ...turmasAtivas, "employees.select": [{ data: null }] });
    h.client = db.client;
    expect(await criarAssociacoesAction(lote())).toEqual({ ok: false, error: "Professor inválido." });
    const filtros = db.chamadas("employees", "select")[0].filtros;
    expect(filtros).toContainEqual(["in", "school_category", ["fund1", "fund2", "medio"]]);
    expect(filtros).toContainEqual(["eq", "ativo", true]);
  });

  it("repetidos na entrada (turma/etapa) não duplicam linhas", async () => {
    const db = fakeSupabase({
      ...questionarioAtivo,
      "turmas.select": [{ data: [{ id: T1, nome: "Matutino", ativo: true }] }],
      ...professorValido,
      "questionario_associacoes.select": [{ data: [] }],
    });
    h.client = db.client;
    await criarAssociacoesAction(lote({ etapas: ["1", "1"], turmaIds: [T1, T1] }));
    expect(db.chamadas("questionario_associacoes", "insert")[0].payload).toHaveLength(1);
  });
});

describe("atualizarAssociacaoAction", () => {
  const edicao = (extra: Record<string, string> = {}) =>
    formData({ id: ID, questionarioId: Q, turmaId: T1, professorId: P, etapa: "2", ...extra });
  const atual = { "questionario_associacoes.select": [{ data: { questionario_id: Q, turma_id: T1, professor_id: P } }] };

  it("atualiza os 4 campos da associação da escola", async () => {
    const db = fakeSupabase(atual);
    h.client = db.client;
    const r = await atualizarAssociacaoAction(edicao());
    expect(h.requirePermission).toHaveBeenCalledWith("questionario.associacao", "update");
    expect(r).toMatchObject({ ok: true });
    const upd = db.chamadas("questionario_associacoes", "update")[0];
    expect(upd.payload).toEqual({ questionario_id: Q, turma_id: T1, professor_id: P, etapa: 2 });
    expect(upd.filtros).toContainEqual(["eq", "id", ID]);
    expect(upd.filtros).toContainEqual(["eq", "escola_id", "escola-1"]);
  });

  it("referências não trocadas não são revalidadas (continuam valendo mesmo inativas)", async () => {
    const db = fakeSupabase(atual);
    h.client = db.client;
    await atualizarAssociacaoAction(edicao({ etapa: "3" }));
    expect(db.chamadas("questionarios", "select")).toHaveLength(0);
    expect(db.chamadas("turmas", "select")).toHaveLength(0);
    expect(db.chamadas("employees", "select")).toHaveLength(0);
  });

  it("trocar para turma inativa, questionário inativo ou professor inválido é recusado antes de gravar", async () => {
    const turma = fakeSupabase({ ...atual, "turmas.select": [{ data: [{ id: T3, nome: "Noturno", ativo: false }] }] });
    h.client = turma.client;
    expect(await atualizarAssociacaoAction(edicao({ turmaId: T3 }))).toEqual({
      ok: false,
      error: 'A turma "Noturno" está inativa.',
    });
    expect(turma.chamadas("questionario_associacoes", "update")).toHaveLength(0);

    const quest = fakeSupabase({ ...atual, "questionarios.select": [{ data: { id: Q2, ativo: false } }] });
    h.client = quest.client;
    expect(await atualizarAssociacaoAction(edicao({ questionarioId: Q2 }))).toEqual({
      ok: false,
      error: "Questionário inativo.",
    });

    const prof = fakeSupabase({ ...atual, "employees.select": [{ data: null }] });
    h.client = prof.client;
    expect(await atualizarAssociacaoAction(edicao({ professorId: P2 }))).toEqual({
      ok: false,
      error: "Professor inválido.",
    });
  });

  it("edição que duplica outra associação vira mensagem amigável", async () => {
    h.client = fakeSupabase({
      ...atual,
      "questionario_associacoes.update": [{ error: { message: "duplicate key", code: "23505" } }],
    }).client;
    await expect(atualizarAssociacaoAction(edicao())).rejects.toThrow(/Já existe um registro/);
  });

  it("associação inexistente", async () => {
    h.client = fakeSupabase({ "questionario_associacoes.select": [{ data: null }] }).client;
    expect(await atualizarAssociacaoAction(edicao())).toEqual({ ok: false, error: "Associação não encontrada." });
  });

  it("recusa etapa inválida sem tocar no banco", async () => {
    const db = fakeSupabase();
    h.client = db.client;
    expect((await atualizarAssociacaoAction(edicao({ etapa: "7" }))).ok).toBe(false);
    expect(db.calls).toHaveLength(0);
  });
});

describe("alternarAtivoAssociacaoAction", () => {
  it("inativa sem apagar", async () => {
    const db = fakeSupabase();
    h.client = db.client;
    await alternarAtivoAssociacaoAction(formData({ id: ID, ativo: "false" }));
    expect(h.requirePermission).toHaveBeenCalledWith("questionario.associacao", "update");
    expect(db.chamadas("questionario_associacoes", "update")[0].payload).toEqual({ ativo: false });
    expect(db.chamadas("questionario_associacoes", "delete")).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/actions/questionario-associacoes.test.ts`
Expected: FAIL (`./questionario-associacoes` inexistente).

- [ ] **Step 3: Implementar as actions**

```ts
// src/lib/actions/questionario-associacoes.ts
"use server";

import { revalidatePath } from "next/cache";
import { assertOk } from "@/lib/actions/assert-ok";
import { requirePermission } from "@/lib/auth/session";
import { createServerClient } from "@/lib/supabase/server";
import { alternarAtivo } from "@/lib/questionario/ativo";
import { combinarAssociacoes, unicos } from "@/lib/questionario/associacoes";
import { lerLista, lerTexto } from "@/lib/questionario/lista";
import { primeiroErro, type ActionResult } from "@/lib/questionario/tipos";
import { AssociacaoEdicaoSchema, AssociacaoLoteSchema } from "@/lib/validation/questionario";

const ROTA = "/questionario/associacoes";
// Mesma lista de candidatos de listProfessores() (src/lib/data/pedagogico.ts).
const CATEGORIAS_PROFESSOR = ["fund1", "fund2", "medio"];

type Cliente = Awaited<ReturnType<typeof createServerClient>>;

async function validarQuestionario(db: Cliente, id: string): Promise<string | null> {
  const q = assertOk(
    await db.from("questionarios").select("id, ativo").eq("id", id).maybeSingle(),
    "Não foi possível ler o questionário",
  ) as { id: string; ativo: boolean } | null;
  if (!q) return "Questionário inválido.";
  return q.ativo ? null : "Questionário inativo.";
}

async function validarTurmas(db: Cliente, ids: string[]): Promise<string | null> {
  const linhas = (assertOk(
    await db.from("turmas").select("id, nome, ativo").in("id", ids),
    "Não foi possível ler as turmas",
  ) as Array<{ id: string; nome: string; ativo: boolean }> | null) ?? [];
  if (linhas.length !== ids.length) return "Turma inválida.";
  const inativa = linhas.find((t) => !t.ativo);
  return inativa ? `A turma "${inativa.nome}" está inativa.` : null;
}

async function validarProfessor(db: Cliente, id: string): Promise<string | null> {
  const p = assertOk(
    await db
      .from("employees")
      .select("id")
      .eq("id", id)
      .in("school_category", CATEGORIAS_PROFESSOR)
      .eq("ativo", true)
      .maybeSingle(),
    "Não foi possível ler o professor",
  ) as { id: string } | null;
  return p ? null : "Professor inválido.";
}

const plural = (n: number, singular: string, pluralTxt: string) => `${n} ${n === 1 ? singular : pluralTxt}`;

export async function criarAssociacoesAction(formData: FormData): Promise<ActionResult> {
  const session = await requirePermission("questionario.associacao", "create");
  const parsed = AssociacaoLoteSchema.safeParse({
    questionarioId: lerTexto(formData, "questionarioId"),
    professorId: lerTexto(formData, "professorId"),
    etapas: formData.getAll("etapas").map((v) => Number(v)),
    turmaIds: lerLista(formData, "turmaIds"),
  });
  if (!parsed.success) return { ok: false, error: primeiroErro(parsed.error) };

  const { questionarioId, professorId } = parsed.data;
  const turmaIds = unicos(parsed.data.turmaIds);
  const db = await createServerClient();
  const invalido =
    (await validarQuestionario(db, questionarioId)) ??
    (await validarTurmas(db, turmaIds)) ??
    (await validarProfessor(db, professorId));
  if (invalido) return { ok: false, error: invalido };

  const existentes = (assertOk(
    await db
      .from("questionario_associacoes")
      .select("turma_id, etapa")
      .eq("questionario_id", questionarioId)
      .eq("professor_id", professorId)
      .in("turma_id", turmaIds),
    "Não foi possível ler as associações existentes",
  ) as Array<{ turma_id: string; etapa: number }> | null) ?? [];

  const { criar, ignoradas } = combinarAssociacoes(
    parsed.data.etapas,
    turmaIds,
    existentes.map((e) => ({ turmaId: e.turma_id, etapa: e.etapa })),
  );
  if (criar.length === 0) {
    return { ok: true, message: `Nenhuma associação nova: as ${ignoradas} já existiam.` };
  }

  assertOk(
    await db.from("questionario_associacoes").insert(
      criar.map((c) => ({
        escola_id: session.profile.escola_id,
        questionario_id: questionarioId,
        professor_id: professorId,
        turma_id: c.turmaId,
        etapa: c.etapa,
      })),
    ),
    "Não foi possível criar as associações",
  );

  revalidatePath(ROTA);
  const criadas = plural(criar.length, "associação criada", "associações criadas");
  return { ok: true, message: ignoradas > 0 ? `${criadas}; ${ignoradas} já existiam.` : `${criadas}.` };
}

export async function atualizarAssociacaoAction(formData: FormData): Promise<ActionResult> {
  const session = await requirePermission("questionario.associacao", "update");
  const parsed = AssociacaoEdicaoSchema.safeParse({
    id: lerTexto(formData, "id"),
    questionarioId: lerTexto(formData, "questionarioId"),
    turmaId: lerTexto(formData, "turmaId"),
    professorId: lerTexto(formData, "professorId"),
    etapa: Number(formData.get("etapa")),
  });
  if (!parsed.success) return { ok: false, error: primeiroErro(parsed.error) };

  const d = parsed.data;
  const db = await createServerClient();
  const atual = assertOk(
    await db
      .from("questionario_associacoes")
      .select("questionario_id, turma_id, professor_id")
      .eq("id", d.id)
      .eq("escola_id", session.profile.escola_id)
      .maybeSingle(),
    "Não foi possível ler a associação",
  ) as { questionario_id: string; turma_id: string; professor_id: string } | null;
  if (!atual) return { ok: false, error: "Associação não encontrada." };

  // Só revalida o que mudou: referência já gravada continua válida mesmo se hoje estiver inativa.
  const invalido =
    (d.questionarioId !== atual.questionario_id ? await validarQuestionario(db, d.questionarioId) : null) ??
    (d.turmaId !== atual.turma_id ? await validarTurmas(db, [d.turmaId]) : null) ??
    (d.professorId !== atual.professor_id ? await validarProfessor(db, d.professorId) : null);
  if (invalido) return { ok: false, error: invalido };

  assertOk(
    await db
      .from("questionario_associacoes")
      .update({
        questionario_id: d.questionarioId,
        turma_id: d.turmaId,
        professor_id: d.professorId,
        etapa: d.etapa,
      })
      .eq("id", d.id)
      .eq("escola_id", session.profile.escola_id),
    "Não foi possível salvar a associação",
  );
  revalidatePath(ROTA);
  return { ok: true, message: "Associação atualizada." };
}

export async function alternarAtivoAssociacaoAction(formData: FormData): Promise<ActionResult> {
  const session = await requirePermission("questionario.associacao", "update");
  const resultado = await alternarAtivo(formData, "questionario_associacoes", session.profile.escola_id);
  if (resultado.ok) revalidatePath(ROTA);
  return resultado;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/actions/questionario-associacoes.test.ts`
Expected: PASS (15 testes). Se a mensagem de "2 associações criadas; 2 já existiam." ou a de 4 criadas divergir, ajustar `plural`/montagem da mensagem, nunca o teste.

- [ ] **Step 5: Queries de leitura** — em `src/lib/data/questionario.ts`, acrescentar `TurmaOpcao` e `AssociacaoRow` ao `import type { … } from "@/lib/questionario/tipos"` e, ao final:

```ts
type Um<T> = T | T[] | null;
const um = <T>(v: Um<T>): T | null => (Array.isArray(v) ? v[0] ?? null : v);

type TurmaBruta = {
  id: string;
  nome: string;
  turno: string;
  ano_letivo: number;
  ativo: boolean;
  serie_id: string;
  series: Um<{ nome: string; ordem: number }>;
};

/** Turmas com a série, para o formulário e os filtros da Associação. */
export async function listarTurmasOpcoes(): Promise<TurmaOpcao[]> {
  const db = await createServerClient();
  const { data, error } = await db
    .from("turmas")
    .select("id, nome, turno, ano_letivo, ativo, serie_id, series(nome, ordem)")
    .order("ano_letivo", { ascending: false })
    .order("nome");
  if (error) throw error;
  return ((data ?? []) as TurmaBruta[]).map((t) => {
    const serie = um(t.series);
    return {
      id: t.id,
      nome: t.nome,
      turno: t.turno,
      anoLetivo: t.ano_letivo,
      ativo: t.ativo,
      serieId: t.serie_id,
      serieNome: serie?.nome ?? "",
      serieOrdem: serie?.ordem ?? 0,
    };
  });
}

type AssociacaoBruta = {
  id: string;
  ativo: boolean;
  etapa: number;
  questionario_id: string;
  turma_id: string;
  professor_id: string;
  questionarios: Um<{ descricao: string }>;
  turmas: Um<{
    nome: string;
    turno: string;
    ano_letivo: number;
    serie_id: string;
    series: Um<{ nome: string }>;
  }>;
  employees: Um<{ name: string }>;
};

export async function listarAssociacoes(): Promise<AssociacaoRow[]> {
  const db = await createServerClient();
  const { data, error } = await db
    .from("questionario_associacoes")
    .select(
      "id, ativo, etapa, questionario_id, turma_id, professor_id, questionarios(descricao), turmas(nome, turno, ano_letivo, serie_id, series(nome)), employees(name)",
    )
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as AssociacaoBruta[]).map((a) => {
    const turma = um(a.turmas);
    return {
      id: a.id,
      ativo: a.ativo,
      etapa: a.etapa,
      questionarioId: a.questionario_id,
      questionarioDescricao: um(a.questionarios)?.descricao ?? "",
      turmaId: a.turma_id,
      turmaNome: turma?.nome ?? "",
      turno: turma?.turno ?? "",
      anoLetivo: turma?.ano_letivo ?? 0,
      serieId: turma?.serie_id ?? "",
      serieNome: um(turma?.series ?? null)?.nome ?? "",
      professorId: a.professor_id,
      professorNome: um(a.employees)?.name ?? "",
    };
  });
}
```

- [ ] **Step 6: Typecheck e commit**

Run: `npx tsc --noEmit 2>&1 | grep -v "^\.next/types"; npx vitest run src/lib/actions/questionario-associacoes.test.ts`
Expected: `tsc` limpo; PASS.

```bash
git add src/lib/actions/questionario-associacoes.ts src/lib/actions/questionario-associacoes.test.ts src/lib/data/questionario.ts
git commit -m "feat(questionario): actions de associacao (lote, edicao, ativar/inativar) e queries" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Tela de Associações (formulário de lote, lista com filtros, página)

**Files:**
- Create: `src/components/questionario/associacoes-form.tsx`, `src/components/questionario/associacoes-form.test.tsx`
- Create: `src/components/questionario/associacoes-lista.tsx`
- Create: `src/components/questionario/associacoes-manager.tsx`
- Create: `src/app/(app)/questionario/associacoes/page.tsx`

**Interfaces:**
- Consumes: `criarAssociacoesAction`, `atualizarAssociacaoAction`, `alternarAtivoAssociacaoAction` (T4); `listarAssociacoes`, `listarTurmasOpcoes`, `listarQuestionarios` (`@/lib/data/questionario`), `listProfessores` + `type ProfessorOption` (`@/lib/data/pedagogico`); `unicos`, `anoPadrao`, `rotuloTurma` (T2); `AssociacaoRow`, `TurmaOpcao`, `QuestionarioRow`; `BotaoAtivar`; `podeAcao`.
- Produces: `AssociacoesForm({ questionarios, turmas, professores, edicao, onConcluir })`, `AssociacoesLista({ associacoes, podeEditar, onEditar })`, `AssociacoesManager({ associacoes, questionarios, turmas, professores, podeCriar, podeEditar })`; rota `/questionario/associacoes`.

- [ ] **Step 1: Teste do formulário (falha)**

```tsx
// src/components/questionario/associacoes-form.test.tsx
// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

const h = vi.hoisted(() => ({ criar: vi.fn(), atualizar: vi.fn() }));
vi.mock("@/lib/actions/questionario-associacoes", () => ({
  criarAssociacoesAction: h.criar,
  atualizarAssociacaoAction: h.atualizar,
}));
vi.mock("@/lib/hooks/use-action", () => ({
  useAction: (fn: (...a: unknown[]) => unknown) => ({
    run: (...a: unknown[]) => void fn(...a),
    pending: false,
  }),
}));

import { AssociacoesForm } from "./associacoes-form";
import type { AssociacaoRow, QuestionarioRow, TurmaOpcao } from "@/lib/questionario/tipos";

const turma = (id: string, nome: string, turno: string, anoLetivo: number, serieId: string, serieNome: string, ordem: number, ativo = true): TurmaOpcao =>
  ({ id, nome, turno, anoLetivo, ativo, serieId, serieNome, serieOrdem: ordem });

const TURMAS: TurmaOpcao[] = [
  turma("t1", "Matutino", "matutino", 2026, "s3", "INFANTIL 3", 3),
  turma("t2", "Vespertino", "vespertino", 2026, "s3", "INFANTIL 3", 3),
  turma("t3", "Matutino", "matutino", 2026, "s4", "INFANTIL 4", 4),
  turma("t4", "Antiga", "matutino", 2025, "s3", "INFANTIL 3", 3),
  turma("t5", "Fechada", "noturno", 2026, "s3", "INFANTIL 3", 3, false),
];
const QUESTIONARIOS: QuestionarioRow[] = [
  { id: "q1", descricao: "QUADRO INFANTIL 3", ativo: true },
  { id: "q2", descricao: "QUADRO ANTIGO", ativo: false },
];
const PROFESSORES = [
  { id: "p1", nome: "Stéfanny Guimarães", email: "", schoolCategory: "fund1" as const },
];
const EDICAO: AssociacaoRow = {
  id: "a1", ativo: true, etapa: 2, questionarioId: "q1", questionarioDescricao: "QUADRO INFANTIL 3",
  turmaId: "t1", turmaNome: "Matutino", turno: "matutino", anoLetivo: 2026, serieId: "s3", serieNome: "INFANTIL 3",
  professorId: "p1", professorNome: "Stéfanny Guimarães",
};

function renderForm(edicao: AssociacaoRow | null = null) {
  return render(
    <AssociacoesForm questionarios={QUESTIONARIOS} turmas={TURMAS} professores={PROFESSORES} edicao={edicao} onConcluir={vi.fn()} />,
  );
}

describe("AssociacoesForm (lote)", () => {
  it("mostra só turmas ativas do ano padrão e da série escolhida", () => {
    renderForm();
    fireEvent.change(screen.getByLabelText("Série"), { target: { value: "s3" } });
    expect(screen.getByLabelText("Matutino")).toBeInTheDocument();
    expect(screen.getByLabelText("Vespertino")).toBeInTheDocument();
    expect(screen.queryByLabelText("Antiga (Matutino)")).not.toBeInTheDocument(); // 2025
    expect(screen.queryByLabelText(/Fechada/)).not.toBeInTheDocument(); // inativa
  });

  it("não oferece questionário inativo", () => {
    renderForm();
    expect(screen.queryByRole("option", { name: "QUADRO ANTIGO" })).not.toBeInTheDocument();
  });

  it("'Todas' marca todas as turmas visíveis; envia etapas e turmas repetidas", () => {
    h.criar.mockResolvedValue({ ok: true });
    renderForm();
    fireEvent.change(screen.getByLabelText("Série"), { target: { value: "s3" } });
    fireEvent.click(screen.getByLabelText("Todas as turmas"));
    fireEvent.click(screen.getByLabelText("1ª etapa"));
    fireEvent.click(screen.getByLabelText("3ª etapa"));
    fireEvent.change(screen.getByLabelText("Questionário"), { target: { value: "q1" } });
    fireEvent.change(screen.getByLabelText("Professor"), { target: { value: "p1" } });
    fireEvent.submit(screen.getByRole("button", { name: /cadastrar/i }).closest("form")!);

    const fd = h.criar.mock.calls[h.criar.mock.calls.length - 1][0] as FormData;
    expect(fd.getAll("turmaIds")).toEqual(["t1", "t2"]);
    expect(fd.getAll("etapas")).toEqual(["1", "3"]);
    expect(fd.get("questionarioId")).toBe("q1");
    expect(fd.get("professorId")).toBe("p1");
    expect(fd.get("id")).toBeNull();
  });

  it("trocar a série limpa as turmas marcadas", () => {
    renderForm();
    fireEvent.change(screen.getByLabelText("Série"), { target: { value: "s3" } });
    fireEvent.click(screen.getByLabelText("Todas as turmas"));
    fireEvent.change(screen.getByLabelText("Série"), { target: { value: "s4" } });
    expect((screen.getByLabelText("Matutino") as HTMLInputElement).checked).toBe(false);
  });
});

describe("AssociacoesForm (edição)", () => {
  it("vira modo unitário: id oculto, etapa e turma únicas, valores atuais", () => {
    h.atualizar.mockResolvedValue({ ok: true });
    renderForm(EDICAO);
    expect(screen.queryByLabelText("Todas as turmas")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Etapa")).toHaveValue("2");
    expect(screen.getByLabelText("Turma")).toHaveValue("t1");
    fireEvent.change(screen.getByLabelText("Etapa"), { target: { value: "4" } });
    fireEvent.submit(screen.getByRole("button", { name: /salvar/i }).closest("form")!);

    const fd = h.atualizar.mock.calls[h.atualizar.mock.calls.length - 1][0] as FormData;
    expect(fd.get("id")).toBe("a1");
    expect(fd.get("etapa")).toBe("4");
    expect(fd.get("turmaId")).toBe("t1");
    expect(fd.get("questionarioId")).toBe("q1");
    expect(fd.get("professorId")).toBe("p1");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/components/questionario/associacoes-form.test.tsx`
Expected: FAIL (`./associacoes-form` inexistente).

- [ ] **Step 3: Formulário**

```tsx
// src/components/questionario/associacoes-form.tsx
"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import {
  atualizarAssociacaoAction,
  criarAssociacoesAction,
} from "@/lib/actions/questionario-associacoes";
import type { ProfessorOption } from "@/lib/data/pedagogico";
import { useAction } from "@/lib/hooks/use-action";
import { anoPadrao, rotuloTurma, unicos } from "@/lib/questionario/associacoes";
import type { AssociacaoRow, QuestionarioRow, TurmaOpcao } from "@/lib/questionario/tipos";

type Props = {
  questionarios: QuestionarioRow[];
  turmas: TurmaOpcao[];
  professores: ProfessorOption[];
  edicao: AssociacaoRow | null;
  onConcluir: () => void;
};

const ROTULO = "text-sm font-medium text-ink/80";
const ETAPAS = [1, 2, 3, 4];

export function AssociacoesForm({ questionarios, turmas, professores, edicao, onConcluir }: Props) {
  const anos = unicos(turmas.map((t) => t.anoLetivo)).sort((a, b) => b - a);
  const [ano, setAno] = useState<number>(edicao?.anoLetivo ?? anoPadrao(anos, new Date().getFullYear()) ?? 0);
  const [serieId, setSerieId] = useState(edicao?.serieId ?? "");
  const [etapas, setEtapas] = useState<number[]>([]);
  const [turmasMarcadas, setTurmasMarcadas] = useState<string[]>([]);

  const salvar = useAction(
    (fd: FormData) => (fd.get("id") ? atualizarAssociacaoAction(fd) : criarAssociacoesAction(fd)),
    {
      onSuccess: () => {
        setEtapas([]);
        setTurmasMarcadas([]);
        onConcluir();
      },
    },
  );

  const series = turmas
    .filter((t) => t.anoLetivo === ano)
    .reduce<TurmaOpcao[]>((acc, t) => (acc.some((s) => s.serieId === t.serieId) ? acc : [...acc, t]), [])
    .sort((a, b) => a.serieOrdem - b.serieOrdem);
  const visiveis = turmas.filter(
    (t) =>
      t.anoLetivo === ano &&
      (!serieId || t.serieId === serieId) &&
      (t.ativo || t.id === edicao?.turmaId),
  );
  const todasMarcadas = visiveis.length > 0 && visiveis.every((t) => turmasMarcadas.indexOf(t.id) >= 0);
  const questionariosDisponiveis = questionarios.filter((q) => q.ativo || q.id === edicao?.questionarioId);
  const professorAtualFora = edicao && !professores.some((p) => p.id === edicao.professorId);

  function alternar<T>(lista: T[], valor: T): T[] {
    return lista.indexOf(valor) >= 0 ? lista.filter((x) => x !== valor) : [...lista, valor];
  }

  function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    salvar.run(new FormData(e.currentTarget));
  }

  return (
    <form onSubmit={enviar} className="grid gap-4">
      {edicao ? <input type="hidden" name="id" value={edicao.id} /> : null}

      <div className="grid gap-4 md:grid-cols-4">
        <div className="grid gap-1">
          <label htmlFor="assoc-ano" className={ROTULO}>Ano</label>
          <select
            id="assoc-ano"
            value={ano}
            onChange={(e) => {
              setAno(Number(e.target.value));
              setSerieId("");
              setTurmasMarcadas([]);
            }}
          >
            {anos.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>
        <div className="grid gap-1">
          <label htmlFor="assoc-serie" className={ROTULO}>Série</label>
          <select
            id="assoc-serie"
            value={serieId}
            onChange={(e) => {
              setSerieId(e.target.value);
              setTurmasMarcadas([]);
            }}
          >
            <option value="">Todas</option>
            {series.map((s) => (
              <option key={s.serieId} value={s.serieId}>{s.serieNome}</option>
            ))}
          </select>
        </div>
        <div className="grid gap-1 md:col-span-2">
          <label htmlFor="assoc-questionario" className={ROTULO}>Questionário</label>
          <select id="assoc-questionario" name="questionarioId" required defaultValue={edicao?.questionarioId ?? ""}>
            <option value="" disabled>Selecione</option>
            {questionariosDisponiveis.map((q) => (
              <option key={q.id} value={q.id}>{q.descricao}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-1">
        <label htmlFor="assoc-professor" className={ROTULO}>Professor</label>
        <select id="assoc-professor" name="professorId" required defaultValue={edicao?.professorId ?? ""}>
          <option value="" disabled>Selecione</option>
          {professorAtualFora ? <option value={edicao.professorId}>{edicao.professorNome}</option> : null}
          {professores.map((p) => (
            <option key={p.id} value={p.id}>{p.nome}</option>
          ))}
        </select>
      </div>

      {edicao ? (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="grid gap-1">
            <label htmlFor="assoc-etapa" className={ROTULO}>Etapa</label>
            <select id="assoc-etapa" name="etapa" required defaultValue={String(edicao.etapa)}>
              {ETAPAS.map((n) => (
                <option key={n} value={n}>{n}ª</option>
              ))}
            </select>
          </div>
          <div className="grid gap-1">
            <label htmlFor="assoc-turma" className={ROTULO}>Turma</label>
            <select id="assoc-turma" name="turmaId" required defaultValue={edicao.turmaId}>
              {visiveis.map((t) => (
                <option key={t.id} value={t.id}>{rotuloTurma(t.nome, t.turno)}</option>
              ))}
            </select>
          </div>
        </div>
      ) : (
        <>
          <fieldset className="flex flex-wrap gap-4">
            <legend className={`${ROTULO} mb-1`}>Etapas</legend>
            {ETAPAS.map((n) => (
              <label key={n} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="etapas"
                  value={n}
                  checked={etapas.indexOf(n) >= 0}
                  onChange={() => setEtapas(alternar(etapas, n))}
                  className="h-4 w-auto"
                  aria-label={`${n}ª etapa`}
                />
                {n}ª
              </label>
            ))}
          </fieldset>

          <fieldset className="grid gap-2">
            <legend className={`${ROTULO} mb-1`}>Turmas</legend>
            {visiveis.length === 0 ? (
              <p className="text-sm text-ink/60">Nenhuma turma ativa neste ano e série.</p>
            ) : (
              <>
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={todasMarcadas}
                    onChange={() => setTurmasMarcadas(todasMarcadas ? [] : visiveis.map((t) => t.id))}
                    className="h-4 w-auto"
                    aria-label="Todas as turmas"
                  />
                  Todas
                </label>
                <div className="flex flex-wrap gap-x-6 gap-y-2">
                  {visiveis.map((t) => (
                    <label key={t.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        name="turmaIds"
                        value={t.id}
                        checked={turmasMarcadas.indexOf(t.id) >= 0}
                        onChange={() => setTurmasMarcadas(alternar(turmasMarcadas, t.id))}
                        className="h-4 w-auto"
                        aria-label={rotuloTurma(t.nome, t.turno)}
                      />
                      {t.serieNome} · {rotuloTurma(t.nome, t.turno)}
                    </label>
                  ))}
                </div>
              </>
            )}
          </fieldset>
        </>
      )}

      <div className="flex gap-3">
        <Button type="submit" variant="primary" loading={salvar.pending}>
          {edicao ? "Salvar" : "Cadastrar"}
        </Button>
        {edicao ? (
          <Button type="button" variant="secondary" onClick={onConcluir}>
            Cancelar
          </Button>
        ) : null}
      </div>
    </form>
  );
}
```

- [ ] **Step 4: Rodar o teste do formulário**

Run: `npx vitest run src/components/questionario/associacoes-form.test.tsx`
Expected: PASS (5 testes). Se `getByLabelText("Matutino")` achar mais de um (turmas "Matutino" de séries diferentes), a série `s3` já está filtrada nesse teste e só há uma; se falhar por texto de label, ajuste o **teste** ao rótulo real do `aria-label` (`rotuloTurma`).

- [ ] **Step 5: Lista, manager e página**

```tsx
// src/components/questionario/associacoes-lista.tsx
"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { DataTableShell } from "@/components/ui/data-table";
import { SearchInline } from "@/components/ui/search-inline";
import { StatusPill } from "@/components/ui/status-pill";
import { BotaoAtivar } from "@/components/questionario/botao-ativar";
import { alternarAtivoAssociacaoAction } from "@/lib/actions/questionario-associacoes";
import { anoPadrao, rotuloTurma, unicos } from "@/lib/questionario/associacoes";
import { normalizarBusca } from "@/lib/questionario/lista";
import type { AssociacaoRow } from "@/lib/questionario/tipos";

type Props = {
  associacoes: AssociacaoRow[];
  podeEditar: boolean;
  onEditar: (associacao: AssociacaoRow) => void;
};

const SELECT_FILTRO = "min-w-[9rem]";

export function AssociacoesLista({ associacoes, podeEditar, onEditar }: Props) {
  const anos = unicos(associacoes.map((a) => a.anoLetivo)).sort((a, b) => b - a);
  const [ano, setAno] = useState(String(anoPadrao(anos, new Date().getFullYear()) ?? ""));
  const [etapa, setEtapa] = useState("");
  const [serie, setSerie] = useState("");
  const [turma, setTurma] = useState("");
  const [questionario, setQuestionario] = useState("");
  const [professor, setProfessor] = useState("");
  const [busca, setBusca] = useState("");

  const opcoes = (extrair: (a: AssociacaoRow) => [string, string]) =>
    associacoes
      .map(extrair)
      .filter(([id], i, todos) => todos.findIndex(([x]) => x === id) === i)
      .sort((a, b) => a[1].localeCompare(b[1]));
  const series = opcoes((a) => [a.serieId, a.serieNome]);
  const turmasOpt = opcoes((a) => [a.turmaId, `${a.serieNome} · ${rotuloTurma(a.turmaNome, a.turno)}`]);
  const questionarios = opcoes((a) => [a.questionarioId, a.questionarioDescricao]);
  const professores = opcoes((a) => [a.professorId, a.professorNome]);

  const termo = normalizarBusca(busca);
  const visiveis = associacoes.filter(
    (a) =>
      (!ano || String(a.anoLetivo) === ano) &&
      (!etapa || String(a.etapa) === etapa) &&
      (!serie || a.serieId === serie) &&
      (!turma || a.turmaId === turma) &&
      (!questionario || a.questionarioId === questionario) &&
      (!professor || a.professorId === professor) &&
      normalizarBusca(`${a.questionarioDescricao} ${a.serieNome} ${a.turmaNome} ${a.professorNome}`).includes(termo),
  );

  const filtro = (rotulo: string, valor: string, set: (v: string) => void, itens: Array<[string, string]>) => (
    <div className="grid gap-1">
      <label className="text-xs font-medium text-ink/70">
        {rotulo}
        <select className={`mt-1 block ${SELECT_FILTRO}`} value={valor} onChange={(e) => set(e.target.value)}>
          <option value="">Todos</option>
          {itens.map(([id, nome]) => (
            <option key={id} value={id}>{nome}</option>
          ))}
        </select>
      </label>
    </div>
  );

  return (
    <DataTableShell
      toolbar={
        <div className="flex w-full flex-wrap items-end gap-3">
          {filtro("Ano", ano, setAno, anos.map((a) => [String(a), String(a)]))}
          {filtro("Etapa", etapa, setEtapa, [1, 2, 3, 4].map((n) => [String(n), `${n}ª`]))}
          {filtro("Série", serie, setSerie, series)}
          {filtro("Turma", turma, setTurma, turmasOpt)}
          {filtro("Questionário", questionario, setQuestionario, questionarios)}
          {filtro("Professor", professor, setProfessor, professores)}
          <SearchInline value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Pesquisar" />
        </div>
      }
    >
      <table className="ds-dt min-w-[960px]">
        <thead>
          <tr>
            <th className="w-[80px]">Ano</th>
            <th className="w-[80px]">Etapa</th>
            <th>Questionário</th>
            <th>Série</th>
            <th>Turma</th>
            <th>Professor</th>
            <th className="w-[110px]">Situação</th>
            <th className="w-[110px] text-right">Ação</th>
          </tr>
        </thead>
        <tbody>
          {visiveis.length === 0 ? (
            <tr>
              <td colSpan={8} className="px-5 py-10 text-center text-sm text-ink/60">
                Nenhuma associação encontrada.
              </td>
            </tr>
          ) : null}
          {visiveis.map((a) => (
            <tr key={a.id}>
              <td className="pl-4 text-ink">{a.anoLetivo}</td>
              <td className="text-ink">{a.etapa}ª</td>
              <td className="text-ink">{a.questionarioDescricao}</td>
              <td className="text-ink/80">{a.serieNome}</td>
              <td className="text-ink/80">{rotuloTurma(a.turmaNome, a.turno)}</td>
              <td className="text-ink/80">{a.professorNome}</td>
              <td>
                <StatusPill tone={a.ativo ? "success" : "neutral"}>{a.ativo ? "Ativa" : "Inativa"}</StatusPill>
              </td>
              <td className="pr-4">
                {podeEditar ? (
                  <div className="flex items-center justify-end gap-1">
                    <button
                      type="button"
                      aria-label={`Editar associação de ${a.professorNome} (${a.etapa}ª etapa)`}
                      onClick={() => onEditar(a)}
                      className="rounded-ui p-1.5 text-brand hover:bg-brand/10"
                    >
                      <Pencil size={16} />
                    </button>
                    <BotaoAtivar
                      acao={alternarAtivoAssociacaoAction}
                      id={a.id}
                      ativo={a.ativo}
                      nome={`${a.questionarioDescricao} — ${a.serieNome} ${rotuloTurma(a.turmaNome, a.turno)}, ${a.etapa}ª etapa`}
                    />
                  </div>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </DataTableShell>
  );
}
```

```tsx
// src/components/questionario/associacoes-manager.tsx
"use client";

import { useState } from "react";
import { Panel } from "@/components/ui/card";
import { AssociacoesForm } from "@/components/questionario/associacoes-form";
import { AssociacoesLista } from "@/components/questionario/associacoes-lista";
import type { ProfessorOption } from "@/lib/data/pedagogico";
import type { AssociacaoRow, QuestionarioRow, TurmaOpcao } from "@/lib/questionario/tipos";

type Props = {
  associacoes: AssociacaoRow[];
  questionarios: QuestionarioRow[];
  turmas: TurmaOpcao[];
  professores: ProfessorOption[];
  podeCriar: boolean;
  podeEditar: boolean;
};

export function AssociacoesManager({ associacoes, questionarios, turmas, professores, podeCriar, podeEditar }: Props) {
  const [editando, setEditando] = useState<AssociacaoRow | null>(null);
  const [formKey, setFormKey] = useState(0);
  const mostrarForm = editando ? podeEditar : podeCriar;

  return (
    <div className="grid gap-6">
      {mostrarForm ? (
        <Panel>
          <AssociacoesForm
            key={`${editando?.id ?? "novo"}-${formKey}`}
            questionarios={questionarios}
            turmas={turmas}
            professores={professores}
            edicao={editando}
            onConcluir={() => {
              setEditando(null);
              setFormKey((k) => k + 1);
            }}
          />
        </Panel>
      ) : null}
      <AssociacoesLista associacoes={associacoes} podeEditar={podeEditar} onEditar={setEditando} />
    </div>
  );
}
```

```tsx
// src/app/(app)/questionario/associacoes/page.tsx
import { PageHeader } from "@/components/ui/page-header";
import { AssociacoesManager } from "@/components/questionario/associacoes-manager";
import { requirePermission } from "@/lib/auth/session";
import { listProfessores } from "@/lib/data/pedagogico";
import { listarAssociacoes, listarQuestionarios, listarTurmasOpcoes } from "@/lib/data/questionario";
import { podeAcao } from "@/lib/questionario/acesso";

export default async function AssociacoesPage() {
  const session = await requirePermission("questionario.associacao", "read");
  const [associacoes, questionarios, turmas, professores] = await Promise.all([
    listarAssociacoes(),
    listarQuestionarios(),
    listarTurmasOpcoes(),
    listProfessores(),
  ]);

  return (
    <div className="grid gap-8">
      <PageHeader
        breadcrumb={[{ label: "Acadêmico" }, { label: "Questionário" }, { label: "Associação da série ao questionário" }]}
        title="Associação da Série ao Questionário"
        counter={String(associacoes.length)}
        description="Define qual questionário cada professor preenche, por turma e etapa."
      />
      <AssociacoesManager
        associacoes={associacoes}
        questionarios={questionarios}
        turmas={turmas}
        professores={professores}
        podeCriar={podeAcao(session, "questionario.associacao", "create")}
        podeEditar={podeAcao(session, "questionario.associacao", "update")}
      />
    </div>
  );
}
```

- [ ] **Step 6: Typecheck, testes e commit**

Run: `npx tsc --noEmit 2>&1 | grep -v "^\.next/types"; npx vitest run questionario`
Expected: `tsc` limpo; todos os testes do módulo passam.

```bash
git add src/components/questionario/associacoes-form.tsx src/components/questionario/associacoes-form.test.tsx src/components/questionario/associacoes-lista.tsx src/components/questionario/associacoes-manager.tsx "src/app/(app)/questionario/associacoes/page.tsx"
git commit -m "feat(questionario): tela de associacao da serie ao questionario (lote, filtros, edicao)" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Menu e verificação final

**Files:**
- Modify: `src/components/layout/topbar.tsx` (filhos do item "Questionário")
- Modify: `docs/superpowers/specs/2026-10-06-questionario-design.md` (ponteiro para a extensão)

**Interfaces:**
- Consumes: rotas das Tasks 3 e 5; `ROTA_PARA_MODULO` (Task 1) para o filtro por permissão.

- [ ] **Step 1: Itens de menu** — no item `href: "/questionario/questionarios"` de `SECRETARIA_ITEMS`, acrescentar ao fim de `children` (ícones `ClipboardCheck` e `UserCheck` já existem em `ICON_MAP`):

```ts
      { href: "/questionario/secoes", label: "Seção da Ficha", iconName: "ClipboardCheck" },
      { href: "/questionario/associacoes", label: "Associação Série/Questionário", iconName: "UserCheck" },
```

- [ ] **Step 2: Ponteiro no spec do módulo** — no fim da seção "Fora de escopo" de `docs/superpowers/specs/2026-10-06-questionario-design.md`, acrescentar a linha:

```md
- Seções da Ficha Avaliativa e Associação da Série ao Questionário: ver `docs/superpowers/specs/2026-10-06-secoes-associacoes-questionario-design.md` (extensão deste módulo).
```

- [ ] **Step 3: Gates**

Run: `npx tsc --noEmit 2>&1 | grep -v "^\.next/types"; npm run test > /tmp/full.log 2>&1; grep -E "Test Files|Tests |Errors" /tmp/full.log; npm run build > /tmp/build.log 2>&1; echo "build exit $?"; grep -c "questionario/" /tmp/build.log`
Expected: `tsc` limpo; todos os testes passam (+ o 1 *unhandled error* antigo de `use-action.test.tsx`, não tocar); `build exit 0` e as rotas `/questionario/secoes` e `/questionario/associacoes` presentes no resumo do build.

- [ ] **Step 4: Revisão** — rodar `/code-review` sobre `git diff main...HEAD` e tratar CRITICAL/HIGH. Conferir: `requirePermission` em toda page/action com módulo/ação certos; nenhum `confirm()` nativo; nenhum hex/rgb cru; sem `for…of` em Map/Set; arquivos < 800 linhas.

- [ ] **Step 5: Verificação manual (depende de decisão do dono)** — exige a migration `202610060003` aplicada num banco de dev/staging; **não aplicar em produção sem autorização**. Com ela: `npm run dev` e, como admin e depois secretaria (claro e escuro): cadastrar/editar/inativar uma Seção; criar associações em lote (2 etapas × 2 turmas), repetir o mesmo lote (deve avisar "já existiam"), filtrar a lista, editar uma linha, inativar. Como financeiro/professor: itens somem do menu e a URL direta vai para acesso negado.

- [ ] **Step 6: Commit**

```bash
git add src/components/layout/topbar.tsx docs/superpowers/specs/2026-10-06-questionario-design.md
git commit -m "feat(questionario): itens de menu de secoes e associacoes" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Self-Review (feita)

**Cobertura do spec:** modelo de dados e RLS (T1); RBAC e rotas (T1); schemas e lote (T2); Seção CRUD + flag (T3); Associação — lote, edição, ativar/inativar, validações no servidor (T4); telas com formulário de lote, filtros Ano/Etapa/Série/Turma/Questionário/Professor, edição unitária (T5); menu (T6); fora de escopo respeitado (sem resposta, sem ligação Seção↔questão, sem ações em lote na lista, sem delete físico). Ano padrão = atual ou mais recente (`anoPadrao`, T2 e T5).

**Placeholders:** nenhum "TBD/TODO".

**Consistência de tipos:** `Combinacao`/`combinarAssociacoes`/`unicos`/`anoPadrao`/`rotuloTurma` (T2) usados com a mesma assinatura em T4 e T5; `TurmaOpcao`/`AssociacaoRow`/`SecaoRow` (T2) são os retornados por `listarTurmasOpcoes`/`listarAssociacoes`/`listarSecoes` (T3/T4); campos de form (`etapas`, `turmaIds`, `questionarioId`, `professorId`, `id`, `etapa`, `turmaId`, `permiteLancamentoColetivo`) idênticos entre componentes e actions; `ProfessorOption` vem de `@/lib/data/pedagogico` (type-only, sem custo de runtime no client).

**Pontos de atenção para o executor:** (1) o `ProfessorOption` na lista `PROFESSORES` do teste do formulário precisa do campo `schoolCategory` (`"fund1"`); (2) `listarAssociacoes` depende de a FK `professor_id → employees(id)` existir para o embed `employees(name)` do PostgREST funcionar (a migration cria); (3) `employees` não tem `escola_id`: a validação do professor é por categoria e `ativo`, como `listProfessores()` (sistema de uma escola).
