# Módulo Questionário Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cadastros de Grupo de Questão, Escala, Questão e Questionário (com clonar e ativar/inativar), no menu Acadêmico, com RBAC.

**Architecture:** Migration única (7 tabelas + enum + RLS por `escola_id` + 4 módulos RBAC). Regras puras (validação zod, vínculos, clone, lista) em `src/lib/` com testes; Server Actions finas que validam, gravam via `assertOk` e compensam falhas parciais; telas Next 14 App Router (server page + componente client com `useAction`), DS do projeto.

**Tech Stack:** Next.js 14 (App Router), Supabase (`@supabase/ssr`, sem tipos gerados), zod 3, vitest 4 + Testing Library, Tailwind/DS (`ds-*`), `sonner` via `useAction`.

**Spec:** `docs/superpowers/specs/2026-10-06-questionario-design.md`

## Global Constraints

- Branch `feat/questionario`. `git add` só dos arquivos de cada task (a árvore tem arquivos modificados alheios: `package.json`, `package-lock.json`, spec do financeiro). **Nunca** `git add -A`.
- Conversão de DS vigente (CLAUDE.md): sem hex/rgb cru, sem serifa, usar `src/components/ui/*` (`PageHeader`, `Panel`, `DataTableShell`, `StatusPill`, `Button`, `Switch`, `SearchInline`). Tema por `data-theme`; não mexer em lógica fora deste módulo.
- Nunca `confirm()` nativo: usar `useAction({ confirm })` / `useConfirm`.
- Todo texto de UI em PT-BR.
- Ativar/inativar = coluna `ativo` (em `questoes`, `ativa`); **sem delete físico** de grupo/escala/questão/questionário.
- Server Actions: `requirePermission(modulo, acao)` primeiro; escrita sempre por `assertOk(...)`; arquivos `"use server"` exportam só funções async.
- Retorno das actions: `ActionResult` (`{ ok: true, message?, redirectTo? } | { ok: false, error }`), compatível com `interpretActionResult`.
- Módulos RBAC: `questionario.grupo`, `questionario.escala`, `questionario.questao`, `questionario.questionario` (grupo `academico`). admin e secretaria: leitura/criação/edição/exclusão; financeiro e professor: nada.
- Tipos de questão (enum `questao_tipo`): `subjetiva`, `objetiva_unica`, `objetiva_multipla`, `objetiva_escala`, `matriz_descritiva`. Matriz: só campos base (fase 2).
- Migration `202610060001_questionario.sql`. **Não aplicar em produção** (`supabase db push --linked` é decisão do dono do projeto); `db reset --local` está quebrado por bug preexistente.
- Gates antes de fechar: `npm run typecheck && npm run test && npm run build` verdes.
- Commits: `feat(questionario): <descrição>` + trailer `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Review Focus

Entradas/falhas que o spec implica e nenhuma task óbvia testaria; cada uma tem teste na task indicada.

1. **Trocar o tipo de questão já usada em questionário** → recusado, nada gravado (Task 6).
2. **Descrição duplicada de grupo/escala** (índice único por `lower(descricao)`) → mensagem "Já existe um registro…", sem estourar erro cru (Task 4).
3. **Falha no meio do salvar** (pai gravado, filhos falham: opções, alternativas, vínculos, clone) → pai removido, sem registro órfão (Tasks 3, 5, 6, 7).
4. **Questão inativa entrando em *novo* vínculo** pelo servidor (UI já esconde, mas o POST pode vir de fora) → recusado; vínculo antigo com questão inativa continua salvando (Task 7).
5. **Acesso direto por URL/POST sem permissão** (financeiro/professor) → rota mapeada ao módulo no menu e `requirePermission` com o módulo/ação certos em toda action (Tasks 1, 4).
6. **Clonar questionário vazio** → clone sem vínculos, inativo (Tasks 2, 7).

---

## File Structure

| Arquivo | Responsabilidade |
|---|---|
| `supabase/migrations/202610060001_questionario.sql` | Schema, RLS, RBAC seed |
| `src/lib/auth/permissions.ts` (mod.) | `MODULOS` + `ROTA_PARA_MODULO` |
| `src/lib/validation/questionario.ts` | Schemas zod, tipos, rótulos |
| `src/lib/questionario/lista.ts` | `moverItem`, `lerLista`, `lerTexto`, `normalizarBusca` |
| `src/lib/questionario/vinculos.ts` | `normalizarVinculos`, `diffVinculos`, `questoesParaAdicionar` |
| `src/lib/questionario/clone.ts` | `montarClone` |
| `src/lib/questionario/tipos.ts` | `ActionResult`, `primeiroErro`, tipos de linha |
| `src/lib/questionario/filhos.ts` | `substituirFilhos` (opções/alternativas, insere antes de apagar) |
| `src/lib/questionario/ativo.ts` | `alternarAtivo` (toggle genérico) |
| `src/lib/questionario/acesso.ts` | `podeAcao(session, modulo, acao)` |
| `src/lib/questionario/test-support.ts` | `fakeSupabase`, `formData` (só testes) |
| `src/lib/data/questionario.ts` | Queries de leitura |
| `src/lib/actions/questionario-{grupos,escalas,questoes,questionarios}.ts` | Server Actions |
| `src/components/questionario/*` | `botao-ativar`, `lista-rotulos`, managers/listas/forms |
| `src/app/(app)/questionario/**/page.tsx` | Rotas |
| `src/components/layout/topbar.tsx` (mod.) | Item de menu |

---

### Task 1: RBAC e migration

**Files:**
- Modify: `src/lib/auth/permissions.ts` (bloco `academico` de `MODULOS`; `ROTA_PARA_MODULO`)
- Create: `supabase/migrations/202610060001_questionario.sql`
- Create: `src/lib/auth/questionario-rbac.test.ts`
- Modify: `docs/superpowers/specs/2026-10-06-questionario-design.md` (grupo RBAC = `academico`; menu = item irmão de "Acadêmico", ver Task 8)

**Interfaces:**
- Produces: `ModuloCodigo` passa a aceitar `"questionario.grupo" | "questionario.escala" | "questionario.questao" | "questionario.questionario"`; tabelas `questao_grupos`, `escalas`, `escala_opcoes`, `questoes`, `questao_alternativas`, `questionarios`, `questionario_questoes`; enum `questao_tipo`.

- [ ] **Step 1: Teste que falha**

```ts
// src/lib/auth/questionario-rbac.test.ts
import { describe, expect, it } from "vitest";
import { MODULOS, ROTA_PARA_MODULO } from "./permissions";

// Rota sem entrada em ROTA_PARA_MODULO é "liberada" nos filtros de menu:
// este teste impede um módulo novo de escapar do RBAC.
const ROTAS = {
  "/questionario/grupos": "questionario.grupo",
  "/questionario/escalas": "questionario.escala",
  "/questionario/questoes": "questionario.questao",
  "/questionario/questionarios": "questionario.questionario",
} as const;

describe("RBAC do módulo Questionário", () => {
  it.each(Object.entries(ROTAS))("rota %s exige o módulo %s", (rota, modulo) => {
    expect(ROTA_PARA_MODULO[rota]).toBe(modulo);
    expect(MODULOS).toHaveProperty(modulo);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/auth/questionario-rbac.test.ts`
Expected: FAIL (`expected undefined to be "questionario.grupo"`).

- [ ] **Step 3: Registrar módulos e rotas**

Em `src/lib/auth/permissions.ts`, logo após a linha `calendario: { grupo: "academico", nome: "Calendário Letivo" },` adicionar:

```ts
  "questionario.grupo": { grupo: "academico", nome: "Questionário — Grupos de Questão" },
  "questionario.escala": { grupo: "academico", nome: "Questionário — Escalas" },
  "questionario.questao": { grupo: "academico", nome: "Questionário — Questões" },
  "questionario.questionario": { grupo: "academico", nome: "Questionário — Questionários" },
```

E em `ROTA_PARA_MODULO`, logo após `"/calendario": "calendario",`:

```ts
  "/questionario/grupos": "questionario.grupo",
  "/questionario/escalas": "questionario.escala",
  "/questionario/questoes": "questionario.questao",
  "/questionario/questionarios": "questionario.questionario",
```

- [ ] **Step 4: Migration**

```sql
-- supabase/migrations/202610060001_questionario.sql
-- Módulo Questionário (spec 2026-10-06): grupos, escalas, questões e questionários.
-- Só cadastros; respostas ficam para o ciclo seguinte (por isso questionario_questoes
-- tem PK própria: respostas futuras apontam para ela).

-- 1) RBAC
insert into modulos (codigo, grupo, nome, ordem) values
  ('questionario.grupo',        'academico', 'Questionário — Grupos de Questão', 70),
  ('questionario.escala',       'academico', 'Questionário — Escalas', 71),
  ('questionario.questao',      'academico', 'Questionário — Questões', 72),
  ('questionario.questionario', 'academico', 'Questionário — Questionários', 73)
on conflict (codigo) do nothing;

insert into role_permissoes (role_codigo, modulo_codigo, pode_ler, pode_criar, pode_editar, pode_deletar)
select r.codigo, m.codigo,
       r.codigo in ('admin', 'secretaria'), r.codigo in ('admin', 'secretaria'),
       r.codigo in ('admin', 'secretaria'), r.codigo in ('admin', 'secretaria')
from roles r
cross join (values
  ('questionario.grupo'), ('questionario.escala'),
  ('questionario.questao'), ('questionario.questionario')
) as m(codigo)
where r.codigo in ('admin', 'secretaria', 'financeiro', 'professor')
on conflict (role_codigo, modulo_codigo) do nothing;

-- 2) Enum
do $$ begin
  create type questao_tipo as enum (
    'subjetiva', 'objetiva_unica', 'objetiva_multipla', 'objetiva_escala', 'matriz_descritiva'
  );
exception when duplicate_object then null;
end $$;

-- 3) Tabelas
create table if not exists public.questao_grupos (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references escolas(id) on delete cascade,
  codigo serial,
  descricao text not null check (length(btrim(descricao)) > 0),
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists questao_grupos_descricao_uq
  on questao_grupos (escola_id, lower(descricao));

create table if not exists public.escalas (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references escolas(id) on delete cascade,
  descricao text not null check (length(btrim(descricao)) > 0),
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists escalas_descricao_uq on escalas (escola_id, lower(descricao));

create table if not exists public.escala_opcoes (
  id uuid primary key default gen_random_uuid(),
  escala_id uuid not null references escalas(id) on delete cascade,
  rotulo text not null check (length(btrim(rotulo)) > 0),
  ordem int not null
);
create index if not exists escala_opcoes_escala_idx on escala_opcoes (escala_id);

create table if not exists public.questoes (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references escolas(id) on delete cascade,
  grupo_id uuid not null references questao_grupos(id) on delete restrict,
  tipo questao_tipo not null,
  pergunta text not null check (length(btrim(pergunta)) > 0),
  ativa boolean not null default true,
  obrigatoria boolean not null default false,
  limitar_caracteres boolean not null default false,
  qtde_caracteres int not null default 0 check (qtde_caracteres >= 0),
  qtde_linhas int not null default 0 check (qtde_linhas >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists questoes_grupo_idx on questoes (grupo_id);
create index if not exists questoes_escola_idx on questoes (escola_id);

create table if not exists public.questao_alternativas (
  id uuid primary key default gen_random_uuid(),
  questao_id uuid not null references questoes(id) on delete cascade,
  rotulo text not null check (length(btrim(rotulo)) > 0),
  ordem int not null
);
create index if not exists questao_alternativas_questao_idx on questao_alternativas (questao_id);

create table if not exists public.questionarios (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references escolas(id) on delete cascade,
  descricao text not null check (length(btrim(descricao)) > 0),
  observacoes text,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists questionarios_escola_idx on questionarios (escola_id);

create table if not exists public.questionario_questoes (
  id uuid primary key default gen_random_uuid(),
  questionario_id uuid not null references questionarios(id) on delete cascade,
  questao_id uuid not null references questoes(id) on delete restrict,
  escala_id uuid references escalas(id) on delete restrict,
  ordem int not null,
  unique (questionario_id, questao_id)
);
create index if not exists questionario_questoes_questao_idx on questionario_questoes (questao_id);

-- 4) updated_at
create trigger questao_grupos_updated_at before update on questao_grupos
  for each row execute function set_updated_at();
create trigger escalas_updated_at before update on escalas
  for each row execute function set_updated_at();
create trigger questoes_updated_at before update on questoes
  for each row execute function set_updated_at();
create trigger questionarios_updated_at before update on questionarios
  for each row execute function set_updated_at();

-- 5) RLS — tabelas com escola_id
do $$
declare t text;
begin
  foreach t in array array['questao_grupos', 'escalas', 'questoes', 'questionarios'] loop
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

-- 6) RLS — tabelas filhas (escola via pai)
alter table public.escala_opcoes enable row level security;
create policy escala_opcoes_service on public.escala_opcoes
  for all to service_role using (true) with check (true);
create policy escala_opcoes_escola on public.escala_opcoes
  for all to authenticated
  using (exists (select 1 from escalas p
                 where p.id = escala_opcoes.escala_id
                   and p.escola_id = (select escola_id from current_perfil())))
  with check (exists (select 1 from escalas p
                      where p.id = escala_opcoes.escala_id
                        and p.escola_id = (select escola_id from current_perfil())));
grant select, insert, update, delete on public.escala_opcoes to authenticated;

alter table public.questao_alternativas enable row level security;
create policy questao_alternativas_service on public.questao_alternativas
  for all to service_role using (true) with check (true);
create policy questao_alternativas_escola on public.questao_alternativas
  for all to authenticated
  using (exists (select 1 from questoes p
                 where p.id = questao_alternativas.questao_id
                   and p.escola_id = (select escola_id from current_perfil())))
  with check (exists (select 1 from questoes p
                      where p.id = questao_alternativas.questao_id
                        and p.escola_id = (select escola_id from current_perfil())));
grant select, insert, update, delete on public.questao_alternativas to authenticated;

alter table public.questionario_questoes enable row level security;
create policy questionario_questoes_service on public.questionario_questoes
  for all to service_role using (true) with check (true);
create policy questionario_questoes_escola on public.questionario_questoes
  for all to authenticated
  using (exists (select 1 from questionarios p
                 where p.id = questionario_questoes.questionario_id
                   and p.escola_id = (select escola_id from current_perfil())))
  with check (exists (select 1 from questionarios p
                      where p.id = questionario_questoes.questionario_id
                        and p.escola_id = (select escola_id from current_perfil())));
grant select, insert, update, delete on public.questionario_questoes to authenticated;
```

- [ ] **Step 5: Alinhar o spec**

Em `docs/superpowers/specs/2026-10-06-questionario-design.md`: trocar "(grupo `operacional`)" por "(grupo `academico`)" na seção RBAC e, na seção Código, trocar a linha do menu por: `Menu: item "Questionário" (irmão de "Acadêmico" em SECRETARIA_ITEMS, pois o dropdown só suporta 2 níveis) com filhos Grupo de Questão, Escala, Questão, Questionário.`

- [ ] **Step 6: Rodar e ver passar**

Run: `npx vitest run src/lib/auth/questionario-rbac.test.ts && npm run typecheck`
Expected: PASS, typecheck sem erro.

- [ ] **Step 7: Commit**

```bash
git add src/lib/auth/permissions.ts src/lib/auth/questionario-rbac.test.ts supabase/migrations/202610060001_questionario.sql docs/superpowers/specs/2026-10-06-questionario-design.md
git commit -m "feat(questionario): migration, tabelas e RBAC do modulo" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Regras puras (validação, lista, vínculos, clone)

**Files:**
- Create: `src/lib/validation/questionario.ts`, `src/lib/validation/questionario.test.ts`
- Create: `src/lib/questionario/lista.ts`, `src/lib/questionario/lista.test.ts`
- Create: `src/lib/questionario/vinculos.ts`, `src/lib/questionario/vinculos.test.ts`
- Create: `src/lib/questionario/clone.ts`, `src/lib/questionario/clone.test.ts`

**Interfaces:**
- Produces (`validation/questionario.ts`): `QUESTAO_TIPOS`, `type QuestaoTipo`, `QUESTAO_TIPO_LABEL`, `IdSchema`, `GrupoSchema`, `EscalaSchema`, `QuestaoSchema` (output: `QuestaoInput`), `QuestionarioSchema`.
- Produces (`lista.ts`): `moverItem<T>(lista, de, para): T[]`, `lerLista(fd, chave): string[]`, `lerTexto(fd, chave): string`, `normalizarBusca(texto): string`.
- Produces (`vinculos.ts`): `type VinculoInput = { id?: string; questaoId: string; escalaId: string | null }`, `type QuestaoInfo = { tipo: QuestaoTipo; pergunta: string; ativa: boolean }`, `type VinculoNormalizado = VinculoInput & { ordem: number }`, `normalizarVinculos(vinculos, questoes: Map<string, QuestaoInfo>)`, `diffVinculos(atuais: {id; questaoId}[], novos)`, `questoesParaAdicionar(todas: {id; grupoId}[], jaAdicionadas: Set<string>, grupoId: string | null, questaoId: string | null): string[]`.
- Produces (`clone.ts`): `montarClone(origem, vinculos)`.

- [ ] **Step 1: Testes que falham**

```ts
// src/lib/validation/questionario.test.ts
import { describe, expect, it } from "vitest";
import { EscalaSchema, GrupoSchema, QuestaoSchema, QuestionarioSchema } from "./questionario";

const GRUPO = "11111111-1111-4111-8111-111111111111";
const base = {
  grupoId: GRUPO,
  tipo: "subjetiva",
  pergunta: "Como foi?",
  ativa: true,
  obrigatoria: false,
  limitarCaracteres: false,
  qtdeCaracteres: 0,
  qtdeLinhas: 0,
  alternativas: [] as string[],
};

describe("GrupoSchema", () => {
  it("recusa descrição vazia ou só espaços", () => {
    expect(GrupoSchema.safeParse({ descricao: "   " }).success).toBe(false);
  });
  it("apara a descrição", () => {
    expect(GrupoSchema.parse({ descricao: "  Corpo  " }).descricao).toBe("Corpo");
  });
});

describe("EscalaSchema", () => {
  it("exige ao menos 2 opções", () => {
    const r = EscalaSchema.safeParse({ descricao: "E", opcoes: ["Sim"] });
    expect(r.success).toBe(false);
  });
  it("recusa opções repetidas ignorando caixa e espaços", () => {
    const r = EscalaSchema.safeParse({ descricao: "E", opcoes: ["Sim", "  sim "] });
    expect(r.success).toBe(false);
  });
  it("aceita e apara", () => {
    const r = EscalaSchema.parse({ descricao: " E ", opcoes: [" A ", "B"] });
    expect(r).toEqual({ descricao: "E", opcoes: ["A", "B"] });
  });
});

describe("QuestaoSchema", () => {
  it("subjetiva limitando caracteres exige a quantidade", () => {
    const r = QuestaoSchema.safeParse({ ...base, limitarCaracteres: true, qtdeCaracteres: 0 });
    expect(r.success).toBe(false);
  });
  it("subjetiva mantém limites e linhas", () => {
    const r = QuestaoSchema.parse({ ...base, limitarCaracteres: true, qtdeCaracteres: 200, qtdeLinhas: 4 });
    expect(r).toMatchObject({ limitarCaracteres: true, qtdeCaracteres: 200, qtdeLinhas: 4 });
  });
  it("única escolha exige 2 alternativas", () => {
    const r = QuestaoSchema.safeParse({ ...base, tipo: "objetiva_unica", alternativas: ["A"] });
    expect(r.success).toBe(false);
  });
  it("múltipla escolha recusa alternativas repetidas", () => {
    const r = QuestaoSchema.safeParse({ ...base, tipo: "objetiva_multipla", alternativas: ["A", " a"] });
    expect(r.success).toBe(false);
  });
  it("única escolha com 2 alternativas passa e zera limites", () => {
    const r = QuestaoSchema.parse({
      ...base, tipo: "objetiva_unica", alternativas: ["A", "B"],
      limitarCaracteres: true, qtdeCaracteres: 50, qtdeLinhas: 3,
    });
    expect(r).toMatchObject({ alternativas: ["A", "B"], limitarCaracteres: false, qtdeCaracteres: 0, qtdeLinhas: 0 });
  });
  it("tipos sem alternativas descartam as que vieram", () => {
    const r = QuestaoSchema.parse({ ...base, tipo: "objetiva_escala", alternativas: ["X", "Y"] });
    expect(r.alternativas).toEqual([]);
  });
  it("matriz descritiva salva só os campos base", () => {
    const r = QuestaoSchema.parse({ ...base, tipo: "matriz_descritiva" });
    expect(r).toMatchObject({ tipo: "matriz_descritiva", alternativas: [], qtdeLinhas: 0 });
  });
  it("recusa grupo que não é uuid", () => {
    expect(QuestaoSchema.safeParse({ ...base, grupoId: "" }).success).toBe(false);
  });
});

describe("QuestionarioSchema", () => {
  it("observação vazia vira null e aceita questionário sem vínculos", () => {
    const r = QuestionarioSchema.parse({ descricao: "Q", observacoes: "  ", ativo: true, vinculos: [] });
    expect(r.observacoes).toBeNull();
    expect(r.vinculos).toEqual([]);
  });
  it("recusa vínculo com questão que não é uuid", () => {
    const r = QuestionarioSchema.safeParse({
      descricao: "Q", observacoes: "", ativo: true, vinculos: [{ questaoId: "x", escalaId: null }],
    });
    expect(r.success).toBe(false);
  });
});
```

```ts
// src/lib/questionario/lista.test.ts
import { describe, expect, it } from "vitest";
import { lerLista, lerTexto, moverItem, normalizarBusca } from "./lista";

describe("moverItem", () => {
  it("move para cima e para baixo sem mutar", () => {
    const original = ["a", "b", "c"];
    expect(moverItem(original, 2, 1)).toEqual(["a", "c", "b"]);
    expect(moverItem(original, 0, 1)).toEqual(["b", "a", "c"]);
    expect(original).toEqual(["a", "b", "c"]);
  });
  it("ignora índices fora da lista", () => {
    expect(moverItem(["a", "b"], 0, -1)).toEqual(["a", "b"]);
    expect(moverItem(["a", "b"], 1, 2)).toEqual(["a", "b"]);
  });
});

describe("leitura de FormData", () => {
  it("lerLista apara e descarta vazios, preservando a ordem", () => {
    const fd = new FormData();
    fd.append("opcoes", " Sim ");
    fd.append("opcoes", "");
    fd.append("opcoes", "Não");
    expect(lerLista(fd, "opcoes")).toEqual(["Sim", "Não"]);
  });
  it("lerTexto devolve string aparada ('' se ausente)", () => {
    const fd = new FormData();
    fd.set("a", "  x ");
    expect(lerTexto(fd, "a")).toBe("x");
    expect(lerTexto(fd, "b")).toBe("");
  });
});

describe("normalizarBusca", () => {
  it("ignora acento, caixa e espaços das pontas", () => {
    expect(normalizarBusca("  AÇÃO ")).toBe("acao");
  });
});
```

```ts
// src/lib/questionario/vinculos.test.ts
import { describe, expect, it } from "vitest";
import { diffVinculos, normalizarVinculos, questoesParaAdicionar, type QuestaoInfo } from "./vinculos";

const info = (tipo: QuestaoInfo["tipo"], pergunta = "P", ativa = true): QuestaoInfo => ({ tipo, pergunta, ativa });

describe("normalizarVinculos", () => {
  const questoes = new Map<string, QuestaoInfo>([
    ["q1", info("subjetiva", "Pergunta 1")],
    ["q2", info("objetiva_escala", "Pergunta 2")],
  ]);

  it("numera por posição e zera a escala de tipo que não usa escala", () => {
    const r = normalizarVinculos(
      [{ questaoId: "q1", escalaId: "e1" }, { questaoId: "q2", escalaId: "e1" }],
      questoes,
    );
    expect(r).toEqual({
      ok: true,
      vinculos: [
        { id: undefined, questaoId: "q1", escalaId: null, ordem: 1 },
        { id: undefined, questaoId: "q2", escalaId: "e1", ordem: 2 },
      ],
    });
  });
  it("exige escala para questão com escala", () => {
    const r = normalizarVinculos([{ questaoId: "q2", escalaId: null }], questoes);
    expect(r).toEqual({ ok: false, error: 'Escolha a escala da questão "Pergunta 2".' });
  });
  it("recusa questão repetida", () => {
    const r = normalizarVinculos([{ questaoId: "q1", escalaId: null }, { questaoId: "q1", escalaId: null }], questoes);
    expect(r.ok).toBe(false);
  });
  it("recusa questão desconhecida", () => {
    const r = normalizarVinculos([{ questaoId: "zzz", escalaId: null }], questoes);
    expect(r.ok).toBe(false);
  });
});

describe("diffVinculos", () => {
  const atuais = [{ id: "v1", questaoId: "q1" }, { id: "v2", questaoId: "q2" }];

  it("separa manter/atualizar, inserir e remover", () => {
    const d = diffVinculos(atuais, [
      { id: "v1", questaoId: "q1", escalaId: null, ordem: 2 },
      { questaoId: "q3", escalaId: null, ordem: 1 },
    ]);
    expect(d.atualizar).toEqual([{ id: "v1", questaoId: "q1", escalaId: null, ordem: 2 }]);
    expect(d.inserir).toEqual([{ id: undefined, questaoId: "q3", escalaId: null, ordem: 1 }]);
    expect(d.remover).toEqual(["v2"]);
  });
  it("id que não pertence ao questionário vira inserção (nunca atualiza linha alheia)", () => {
    const d = diffVinculos(atuais, [{ id: "estranho", questaoId: "q9", escalaId: null, ordem: 1 }]);
    expect(d.atualizar).toEqual([]);
    expect(d.inserir).toHaveLength(1);
    expect(d.remover).toEqual(["v1", "v2"]);
  });
});

describe("questoesParaAdicionar", () => {
  const todas = [
    { id: "a", grupoId: "g1" },
    { id: "b", grupoId: "g1" },
    { id: "c", grupoId: "g2" },
  ];
  it("'Todos' do grupo adiciona as que faltam", () => {
    expect(questoesParaAdicionar(todas, new Set(["a"]), "g1", null)).toEqual(["b"]);
  });
  it("sem grupo nem questão adiciona todas as que faltam", () => {
    expect(questoesParaAdicionar(todas, new Set(), null, null)).toEqual(["a", "b", "c"]);
  });
  it("questão específica já adicionada não duplica", () => {
    expect(questoesParaAdicionar(todas, new Set(["c"]), null, "c")).toEqual([]);
    expect(questoesParaAdicionar(todas, new Set(), null, "c")).toEqual(["c"]);
  });
});
```

```ts
// src/lib/questionario/clone.test.ts
import { describe, expect, it } from "vitest";
import { montarClone } from "./clone";

describe("montarClone", () => {
  it("nasce inativo, com sufixo, copiando questões, escala e ordem", () => {
    const r = montarClone(
      { descricao: "Quadro Infantil 3", observacoes: "obs" },
      [
        { questao_id: "b", escala_id: null, ordem: 5 },
        { questao_id: "a", escala_id: "e1", ordem: 2 },
      ],
    );
    expect(r.questionario).toEqual({ descricao: "Quadro Infantil 3 (cópia)", observacoes: "obs", ativo: false });
    expect(r.vinculos).toEqual([
      { questao_id: "a", escala_id: "e1", ordem: 1 },
      { questao_id: "b", escala_id: null, ordem: 2 },
    ]);
  });
  it("clone de questionário vazio não tem vínculos", () => {
    const r = montarClone({ descricao: "Vazio", observacoes: null }, []);
    expect(r.vinculos).toEqual([]);
    expect(r.questionario.ativo).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/validation/questionario.test.ts src/lib/questionario`
Expected: FAIL (módulos não existem).

- [ ] **Step 3: Implementar**

```ts
// src/lib/validation/questionario.ts
import { z } from "zod";

export const QUESTAO_TIPOS = [
  "subjetiva",
  "objetiva_unica",
  "objetiva_multipla",
  "objetiva_escala",
  "matriz_descritiva",
] as const;
export type QuestaoTipo = (typeof QUESTAO_TIPOS)[number];

export const QUESTAO_TIPO_LABEL: Record<QuestaoTipo, string> = {
  subjetiva: "Questão Subjetiva",
  objetiva_unica: "Questão Objetiva de Única Escolha",
  objetiva_multipla: "Questão Objetiva de Múltipla Escolha",
  objetiva_escala: "Questão Objetiva Com Escala",
  matriz_descritiva: "Questão de Matriz Descritiva",
};

const textoObrigatorio = (mensagem: string) => z.string().trim().min(1, mensagem);

function distintos(valores: string[]): boolean {
  const norm = valores.map((v) => v.trim().toLowerCase());
  return new Set(norm).size === norm.length;
}

export const IdSchema = z.string().uuid("Registro inválido.");

export const GrupoSchema = z.object({
  descricao: textoObrigatorio("Descrição é obrigatória"),
});

export const EscalaSchema = z
  .object({
    descricao: textoObrigatorio("Descrição é obrigatória"),
    opcoes: z
      .array(textoObrigatorio("Toda opção precisa de um rótulo"))
      .min(2, "A escala precisa de ao menos 2 opções"),
  })
  .refine((v) => distintos(v.opcoes), {
    message: "As opções da escala não podem se repetir",
    path: ["opcoes"],
  });

export const QuestaoSchema = z
  .object({
    grupoId: z.string().uuid("Grupo é obrigatório"),
    tipo: z.enum(QUESTAO_TIPOS, { errorMap: () => ({ message: "Tipo de questão é obrigatório" }) }),
    pergunta: textoObrigatorio("Pergunta é obrigatória"),
    ativa: z.boolean(),
    obrigatoria: z.boolean(),
    limitarCaracteres: z.boolean(),
    qtdeCaracteres: z.number().int("Informe um número inteiro").min(0),
    qtdeLinhas: z.number().int("Informe um número inteiro").min(0),
    alternativas: z.array(z.string().trim()),
  })
  .superRefine((v, ctx) => {
    if (v.tipo === "subjetiva" && v.limitarCaracteres && v.qtdeCaracteres < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["qtdeCaracteres"],
        message: "Informe a quantidade de caracteres",
      });
    }
    if (v.tipo === "objetiva_unica" || v.tipo === "objetiva_multipla") {
      const msg = v.alternativas.some((a) => a === "")
        ? "Toda alternativa precisa de texto"
        : v.alternativas.length < 2
          ? "A questão precisa de ao menos 2 alternativas"
          : !distintos(v.alternativas)
            ? "As alternativas não podem se repetir"
            : null;
      if (msg) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["alternativas"], message: msg });
    }
  })
  .transform((v) => {
    const subjetiva = v.tipo === "subjetiva";
    const comAlternativas = v.tipo === "objetiva_unica" || v.tipo === "objetiva_multipla";
    return {
      ...v,
      limitarCaracteres: subjetiva && v.limitarCaracteres,
      qtdeCaracteres: subjetiva && v.limitarCaracteres ? v.qtdeCaracteres : 0,
      qtdeLinhas: subjetiva ? v.qtdeLinhas : 0,
      alternativas: comAlternativas ? v.alternativas : [],
    };
  });
export type QuestaoInput = z.output<typeof QuestaoSchema>;

const VinculoSchema = z.object({
  id: z.string().uuid().optional(),
  questaoId: z.string().uuid("Questão inválida"),
  escalaId: z.string().uuid("Escala inválida").nullable(),
});

export const QuestionarioSchema = z.object({
  descricao: textoObrigatorio("Descrição é obrigatória"),
  observacoes: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v)),
  ativo: z.boolean(),
  vinculos: z.array(VinculoSchema),
});
```

```ts
// src/lib/questionario/lista.ts
export function moverItem<T>(lista: readonly T[], de: number, para: number): T[] {
  const copia = [...lista];
  if (de === para || de < 0 || para < 0 || de >= copia.length || para >= copia.length) return copia;
  const [item] = copia.splice(de, 1);
  copia.splice(para, 0, item);
  return copia;
}

/** Valores repetidos de um campo (`name` igual), aparados, sem os vazios. */
export function lerLista(formData: FormData, chave: string): string[] {
  return formData
    .getAll(chave)
    .map((v) => String(v).trim())
    .filter(Boolean);
}

export function lerTexto(formData: FormData, chave: string): string {
  const valor = formData.get(chave);
  return typeof valor === "string" ? valor.trim() : "";
}

export function normalizarBusca(texto: string): string {
  return texto.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
}
```

```ts
// src/lib/questionario/vinculos.ts
import type { QuestaoTipo } from "@/lib/validation/questionario";

export type VinculoInput = { id?: string; questaoId: string; escalaId: string | null };
export type VinculoNormalizado = VinculoInput & { ordem: number };
export type QuestaoInfo = { tipo: QuestaoTipo; pergunta: string; ativa: boolean };

export type ResultadoVinculos =
  | { ok: true; vinculos: VinculoNormalizado[] }
  | { ok: false; error: string };

/** Ordem = posição na lista. Só `objetiva_escala` guarda escala (e a exige). */
export function normalizarVinculos(
  vinculos: VinculoInput[],
  questoes: Map<string, QuestaoInfo>,
): ResultadoVinculos {
  const vistos = new Set<string>();
  const saida: VinculoNormalizado[] = [];
  for (const [i, v] of vinculos.entries()) {
    const info = questoes.get(v.questaoId);
    if (!info) return { ok: false, error: "Questão inexistente no questionário." };
    if (vistos.has(v.questaoId)) return { ok: false, error: `A questão "${info.pergunta}" está repetida.` };
    vistos.add(v.questaoId);
    const comEscala = info.tipo === "objetiva_escala";
    if (comEscala && !v.escalaId) return { ok: false, error: `Escolha a escala da questão "${info.pergunta}".` };
    saida.push({ id: v.id, questaoId: v.questaoId, escalaId: comEscala ? v.escalaId : null, ordem: i + 1 });
  }
  return { ok: true, vinculos: saida };
}

/**
 * Compara o que está gravado com o que o formulário mandou. Só atualiza ids que
 * realmente pertencem ao questionário: id desconhecido vira inserção.
 */
export function diffVinculos(
  atuais: Array<{ id: string; questaoId: string }>,
  novos: VinculoNormalizado[],
) {
  const idsAtuais = new Set(atuais.map((a) => a.id));
  const mantidos = new Set<string>();
  const atualizar: Array<VinculoNormalizado & { id: string }> = [];
  const inserir: VinculoNormalizado[] = [];
  for (const n of novos) {
    if (n.id && idsAtuais.has(n.id)) {
      mantidos.add(n.id);
      atualizar.push({ ...n, id: n.id });
    } else {
      inserir.push({ ...n, id: undefined });
    }
  }
  const remover = atuais.filter((a) => !mantidos.has(a.id)).map((a) => a.id);
  return { inserir, atualizar, remover };
}

/** Botão "Adicionar": questão escolhida, ou "Todos" (as do grupo, ou de todos os grupos). */
export function questoesParaAdicionar(
  todas: Array<{ id: string; grupoId: string }>,
  jaAdicionadas: Set<string>,
  grupoId: string | null,
  questaoId: string | null,
): string[] {
  if (questaoId) return jaAdicionadas.has(questaoId) ? [] : [questaoId];
  return todas
    .filter((q) => (!grupoId || q.grupoId === grupoId) && !jaAdicionadas.has(q.id))
    .map((q) => q.id);
}
```

```ts
// src/lib/questionario/clone.ts
export type QuestionarioOrigem = { descricao: string; observacoes: string | null };
export type VinculoOrigem = { questao_id: string; escala_id: string | null; ordem: number };

/** Clone nasce inativo, com " (cópia)", questões/escalas/ordem preservadas (renumeradas 1..n). */
export function montarClone(origem: QuestionarioOrigem, vinculos: VinculoOrigem[]) {
  const ordenados = [...vinculos].sort((a, b) => a.ordem - b.ordem);
  return {
    questionario: { descricao: `${origem.descricao} (cópia)`, observacoes: origem.observacoes, ativo: false },
    vinculos: ordenados.map((v, i) => ({ questao_id: v.questao_id, escala_id: v.escala_id, ordem: i + 1 })),
  };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/validation/questionario.test.ts src/lib/questionario && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/validation/questionario.ts src/lib/validation/questionario.test.ts src/lib/questionario/lista.ts src/lib/questionario/lista.test.ts src/lib/questionario/vinculos.ts src/lib/questionario/vinculos.test.ts src/lib/questionario/clone.ts src/lib/questionario/clone.test.ts
git commit -m "feat(questionario): regras puras de validacao, vinculos e clone" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Infra compartilhada (tipos, fake de teste, filhos, ativo, acesso, queries, componentes base)

**Files:**
- Create: `src/lib/questionario/tipos.ts`, `src/lib/questionario/test-support.ts`
- Create: `src/lib/questionario/filhos.ts`, `src/lib/questionario/filhos.test.ts`
- Create: `src/lib/questionario/ativo.ts`, `src/lib/questionario/acesso.ts`
- Create: `src/lib/data/questionario.ts`
- Create: `src/components/questionario/botao-ativar.tsx`
- Create: `src/components/questionario/lista-rotulos.tsx`, `src/components/questionario/lista-rotulos.test.tsx`

**Interfaces:**
- Consumes: `IdSchema`, `QuestaoTipo` (Task 2); `lerTexto`, `moverItem` (Task 2); `assertOk` (`src/lib/actions/assert-ok.ts`).
- Produces:
  - `tipos.ts`: `ActionResult`, `primeiroErro(error: ZodError): string`, `GrupoRow`, `EscalaRow`, `QuestaoLinha`, `QuestaoDetalhe`, `QuestionarioRow`, `QuestionarioDetalhe`.
  - `test-support.ts`: `fakeSupabase(filas)` → `{ client, calls, chamadas(table, op) }`; `formData(campos)`.
  - `filhos.ts`: `substituirFilhos(db, tabela: "escala_opcoes" | "questao_alternativas", paiId: string, rotulos: string[]): Promise<void>`.
  - `ativo.ts`: `alternarAtivo(formData, tabela: "questao_grupos" | "escalas" | "questoes" | "questionarios", escolaId: string): Promise<ActionResult>` (campos `id`, `ativo="true"|"false"`).
  - `acesso.ts`: `podeAcao(session: Session, modulo: ModuloCodigo, acao: Acao): boolean`.
  - `data/questionario.ts`: `listarGrupos()`, `listarEscalas()`, `listarQuestoes()`, `getQuestao(id)`, `listarQuestionarios()`, `getQuestionario(id)`.
  - `BotaoAtivar({ acao, id, ativo, nome })`, `ListaRotulos({ nome, rotulo, valores, onChange, placeholder? })`.

- [ ] **Step 1: Escrever `tipos.ts` e `test-support.ts`** (sem teste próprio: são base dos testes seguintes)

```ts
// src/lib/questionario/tipos.ts
import type { ZodError } from "zod";
import type { QuestaoTipo } from "@/lib/validation/questionario";

export type ActionResult =
  | { ok: true; message?: string; redirectTo?: string }
  | { ok: false; error: string };

export function primeiroErro(error: ZodError): string {
  return error.issues[0]?.message ?? "Dados inválidos.";
}

export type GrupoRow = { id: string; codigo: number; descricao: string; ativo: boolean };
export type EscalaRow = { id: string; descricao: string; ativo: boolean; opcoes: string[] };
export type QuestaoLinha = {
  id: string;
  tipo: QuestaoTipo;
  pergunta: string;
  ativa: boolean;
  grupoId: string;
  grupoDescricao: string;
};
export type QuestaoDetalhe = {
  id: string;
  grupoId: string;
  tipo: QuestaoTipo;
  pergunta: string;
  ativa: boolean;
  obrigatoria: boolean;
  limitarCaracteres: boolean;
  qtdeCaracteres: number;
  qtdeLinhas: number;
  alternativas: string[];
  emUso: boolean;
};
export type QuestionarioRow = { id: string; descricao: string; ativo: boolean };
export type QuestionarioDetalhe = QuestionarioRow & {
  observacoes: string | null;
  vinculos: Array<{ id: string; questaoId: string; escalaId: string | null }>;
};
```

```ts
// src/lib/questionario/test-support.ts
// Apenas para testes. Fake mínimo do client do Supabase: cada `await` de uma
// cadeia consome a próxima resposta da fila "<tabela>.<operação>" (vazia = ok/null).

type Resposta = { data?: unknown; error?: { message: string; code?: string } | null; count?: number | null };
export type Operacao = "select" | "insert" | "update" | "delete" | "upsert";
export type Chamada = { table: string; op: Operacao; payload?: unknown; filtros: unknown[][] };

export function fakeSupabase(filas: Record<string, Resposta[]> = {}) {
  const pendentes: Record<string, Resposta[]> = Object.fromEntries(
    Object.entries(filas).map(([chave, respostas]) => [chave, [...respostas]]),
  );
  const calls: Chamada[] = [];

  function from(table: string) {
    const chamada: Chamada = { table, op: "select", filtros: [] };
    calls.push(chamada);
    const builder: Record<string, unknown> = {};
    for (const op of ["insert", "update", "delete", "upsert"] as const) {
      builder[op] = (payload?: unknown) => {
        chamada.op = op;
        chamada.payload = payload;
        return builder;
      };
    }
    for (const nome of ["select", "eq", "neq", "in", "is", "order", "limit", "single", "maybeSingle"]) {
      builder[nome] = (...args: unknown[]) => {
        chamada.filtros.push([nome, ...args]);
        return builder;
      };
    }
    builder.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => {
      const resposta = pendentes[`${table}.${chamada.op}`]?.shift() ?? {};
      return Promise.resolve({
        data: resposta.data ?? null,
        error: resposta.error ?? null,
        count: resposta.count ?? null,
      }).then(resolve, reject);
    };
    return builder;
  }

  return {
    client: { from },
    calls,
    chamadas: (table: string, op: Operacao) => calls.filter((c) => c.table === table && c.op === op),
  };
}

export function formData(campos: Record<string, string | string[]>): FormData {
  const fd = new FormData();
  for (const [chave, valor] of Object.entries(campos)) {
    for (const v of Array.isArray(valor) ? valor : [valor]) fd.append(chave, v);
  }
  return fd;
}
```

- [ ] **Step 2: Teste que falha de `substituirFilhos`**

```ts
// src/lib/questionario/filhos.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { substituirFilhos } from "./filhos";
import { fakeSupabase } from "./test-support";

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("substituirFilhos", () => {
  it("grava os novos ANTES de apagar os antigos", async () => {
    const db = fakeSupabase({ "escala_opcoes.select": [{ data: [{ id: "o1" }, { id: "o2" }] }] });
    await substituirFilhos(db.client as never, "escala_opcoes", "e1", ["A", "B"]);

    expect(db.calls.map((c) => c.op)).toEqual(["select", "insert", "delete"]);
    expect(db.chamadas("escala_opcoes", "insert")[0].payload).toEqual([
      { escala_id: "e1", rotulo: "A", ordem: 1 },
      { escala_id: "e1", rotulo: "B", ordem: 2 },
    ]);
    expect(db.chamadas("escala_opcoes", "delete")[0].filtros).toContainEqual(["in", "id", ["o1", "o2"]]);
  });

  it("se o insert falha, não apaga os antigos e propaga o erro", async () => {
    const db = fakeSupabase({
      "questao_alternativas.select": [{ data: [{ id: "a1" }] }],
      "questao_alternativas.insert": [{ error: { message: "boom" } }],
    });
    await expect(
      substituirFilhos(db.client as never, "questao_alternativas", "q1", ["X", "Y"]),
    ).rejects.toThrow();
    expect(db.chamadas("questao_alternativas", "delete")).toHaveLength(0);
  });

  it("lista vazia só limpa os antigos", async () => {
    const db = fakeSupabase({ "questao_alternativas.select": [{ data: [{ id: "a1" }] }] });
    await substituirFilhos(db.client as never, "questao_alternativas", "q1", []);
    expect(db.chamadas("questao_alternativas", "insert")).toHaveLength(0);
    expect(db.chamadas("questao_alternativas", "delete")).toHaveLength(1);
  });
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `npx vitest run src/lib/questionario/filhos.test.ts`
Expected: FAIL (`./filhos` não existe).

- [ ] **Step 4: Implementar `filhos.ts`, `ativo.ts`, `acesso.ts`**

```ts
// src/lib/questionario/filhos.ts
import { assertOk } from "@/lib/actions/assert-ok";
import type { createServerClient } from "@/lib/supabase/server";

type Cliente = Awaited<ReturnType<typeof createServerClient>>;

const FK = { escala_opcoes: "escala_id", questao_alternativas: "questao_id" } as const;

/**
 * Troca os itens filhos de um pai. Insere os novos ANTES de apagar os antigos:
 * se o insert falhar, o pai continua com os itens que tinha (sem ficar vazio).
 */
export async function substituirFilhos(
  db: Cliente,
  tabela: keyof typeof FK,
  paiId: string,
  rotulos: string[],
): Promise<void> {
  const fk = FK[tabela];
  const antigos = assertOk(
    await db.from(tabela).select("id").eq(fk, paiId),
    "Não foi possível ler os itens atuais",
  ) as Array<{ id: string }> | null;

  if (rotulos.length > 0) {
    assertOk(
      await db.from(tabela).insert(rotulos.map((rotulo, i) => ({ [fk]: paiId, rotulo, ordem: i + 1 }))),
      "Não foi possível salvar os itens",
    );
  }

  const ids = (antigos ?? []).map((r) => r.id);
  if (ids.length > 0) {
    assertOk(await db.from(tabela).delete().in("id", ids), "Não foi possível limpar os itens antigos");
  }
}
```

```ts
// src/lib/questionario/ativo.ts
import { assertOk } from "@/lib/actions/assert-ok";
import { createServerClient } from "@/lib/supabase/server";
import { IdSchema } from "@/lib/validation/questionario";
import { lerTexto } from "./lista";
import { primeiroErro, type ActionResult } from "./tipos";

type Tabela = "questao_grupos" | "escalas" | "questoes" | "questionarios";

/** Ativar/inativar: nunca apaga. Campos do form: `id`, `ativo` ("true" | "false"). */
export async function alternarAtivo(formData: FormData, tabela: Tabela, escolaId: string): Promise<ActionResult> {
  const id = IdSchema.safeParse(lerTexto(formData, "id"));
  if (!id.success) return { ok: false, error: primeiroErro(id.error) };

  const coluna = tabela === "questoes" ? "ativa" : "ativo";
  const db = await createServerClient();
  assertOk(
    await db
      .from(tabela)
      .update({ [coluna]: formData.get("ativo") === "true" })
      .eq("id", id.data)
      .eq("escola_id", escolaId),
    "Não foi possível alterar a situação",
  );
  return { ok: true, message: "Situação atualizada." };
}
```

```ts
// src/lib/questionario/acesso.ts
import { can, type Acao, type ModuloCodigo } from "@/lib/auth/permissions";
import type { Session } from "@/lib/auth/session";

/** Admin passa direto (mesma regra de requirePermission); demais conforme role_permissoes. */
export function podeAcao(session: Session, modulo: ModuloCodigo, acao: Acao): boolean {
  return session.profile.perfil === "admin" || can(session.permissions, modulo, acao);
}
```

- [ ] **Step 5: Queries (`data/questionario.ts`)**

```ts
// src/lib/data/questionario.ts
import { createServerClient } from "@/lib/supabase/server";
import type {
  EscalaRow, GrupoRow, QuestaoDetalhe, QuestaoLinha, QuestionarioDetalhe, QuestionarioRow,
} from "@/lib/questionario/tipos";
import type { QuestaoTipo } from "@/lib/validation/questionario";

const porOrdem = <T extends { ordem: number }>(itens: T[] | null) =>
  [...(itens ?? [])].sort((a, b) => a.ordem - b.ordem);

export async function listarGrupos(): Promise<GrupoRow[]> {
  const db = await createServerClient();
  const { data, error } = await db
    .from("questao_grupos")
    .select("id, codigo, descricao, ativo")
    .order("descricao");
  if (error) throw error;
  return (data ?? []) as GrupoRow[];
}

type EscalaBruta = {
  id: string;
  descricao: string;
  ativo: boolean;
  escala_opcoes: Array<{ rotulo: string; ordem: number }> | null;
};

export async function listarEscalas(): Promise<EscalaRow[]> {
  const db = await createServerClient();
  const { data, error } = await db
    .from("escalas")
    .select("id, descricao, ativo, escala_opcoes(rotulo, ordem)")
    .order("descricao");
  if (error) throw error;
  return ((data ?? []) as EscalaBruta[]).map((e) => ({
    id: e.id,
    descricao: e.descricao,
    ativo: e.ativo,
    opcoes: porOrdem(e.escala_opcoes).map((o) => o.rotulo),
  }));
}

type QuestaoBruta = {
  id: string;
  tipo: QuestaoTipo;
  pergunta: string;
  ativa: boolean;
  grupo_id: string;
  questao_grupos: { descricao: string } | Array<{ descricao: string }> | null;
};

export async function listarQuestoes(): Promise<QuestaoLinha[]> {
  const db = await createServerClient();
  const { data, error } = await db
    .from("questoes")
    .select("id, tipo, pergunta, ativa, grupo_id, questao_grupos(descricao)")
    .order("created_at");
  if (error) throw error;
  return ((data ?? []) as QuestaoBruta[]).map((q) => {
    const grupo = Array.isArray(q.questao_grupos) ? q.questao_grupos[0] : q.questao_grupos;
    return {
      id: q.id,
      tipo: q.tipo,
      pergunta: q.pergunta,
      ativa: q.ativa,
      grupoId: q.grupo_id,
      grupoDescricao: grupo?.descricao ?? "",
    };
  });
}

type QuestaoDetalheBruta = {
  id: string;
  grupo_id: string;
  tipo: QuestaoTipo;
  pergunta: string;
  ativa: boolean;
  obrigatoria: boolean;
  limitar_caracteres: boolean;
  qtde_caracteres: number;
  qtde_linhas: number;
  questao_alternativas: Array<{ rotulo: string; ordem: number }> | null;
};

export async function getQuestao(id: string): Promise<QuestaoDetalhe | null> {
  const db = await createServerClient();
  const { data, error } = await db
    .from("questoes")
    .select(
      "id, grupo_id, tipo, pergunta, ativa, obrigatoria, limitar_caracteres, qtde_caracteres, qtde_linhas, questao_alternativas(rotulo, ordem)",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const { count, error: erroUso } = await db
    .from("questionario_questoes")
    .select("id", { count: "exact", head: true })
    .eq("questao_id", id);
  if (erroUso) throw erroUso;

  const q = data as QuestaoDetalheBruta;
  return {
    id: q.id,
    grupoId: q.grupo_id,
    tipo: q.tipo,
    pergunta: q.pergunta,
    ativa: q.ativa,
    obrigatoria: q.obrigatoria,
    limitarCaracteres: q.limitar_caracteres,
    qtdeCaracteres: q.qtde_caracteres,
    qtdeLinhas: q.qtde_linhas,
    alternativas: porOrdem(q.questao_alternativas).map((a) => a.rotulo),
    emUso: (count ?? 0) > 0,
  };
}

export async function listarQuestionarios(): Promise<QuestionarioRow[]> {
  const db = await createServerClient();
  const { data, error } = await db.from("questionarios").select("id, descricao, ativo").order("descricao");
  if (error) throw error;
  return (data ?? []) as QuestionarioRow[];
}

type QuestionarioBruto = {
  id: string;
  descricao: string;
  observacoes: string | null;
  ativo: boolean;
  questionario_questoes: Array<{ id: string; questao_id: string; escala_id: string | null; ordem: number }> | null;
};

export async function getQuestionario(id: string): Promise<QuestionarioDetalhe | null> {
  const db = await createServerClient();
  const { data, error } = await db
    .from("questionarios")
    .select("id, descricao, observacoes, ativo, questionario_questoes(id, questao_id, escala_id, ordem)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const q = data as QuestionarioBruto;
  return {
    id: q.id,
    descricao: q.descricao,
    observacoes: q.observacoes,
    ativo: q.ativo,
    vinculos: porOrdem(q.questionario_questoes).map((v) => ({
      id: v.id,
      questaoId: v.questao_id,
      escalaId: v.escala_id,
    })),
  };
}
```

- [ ] **Step 6: Componentes base + teste de `ListaRotulos`**

```tsx
// src/components/questionario/botao-ativar.tsx
"use client";

import { Power } from "lucide-react";
import { useAction } from "@/lib/hooks/use-action";
import type { ActionResult } from "@/lib/questionario/tipos";

type Props = {
  acao: (formData: FormData) => Promise<ActionResult>;
  id: string;
  ativo: boolean;
  nome: string;
};

export function BotaoAtivar({ acao, id, ativo, nome }: Props) {
  const verbo = ativo ? "Inativar" : "Ativar";
  // Função inline de propósito: `useAction` só relê `opts` quando `action` muda de
  // identidade; sem isso a mensagem de confirmação ficaria presa no estado anterior.
  const { run, pending } = useAction((fd: FormData) => acao(fd), {
    confirm: {
      title: `${verbo} registro`,
      message: `${verbo} "${nome}"?`,
      confirmLabel: verbo,
      variant: ativo ? "warning" : "default",
    },
  });

  return (
    <button
      type="button"
      disabled={pending}
      aria-label={`${verbo} ${nome}`}
      title={verbo}
      onClick={() => {
        const fd = new FormData();
        fd.set("id", id);
        fd.set("ativo", String(!ativo));
        run(fd);
      }}
      className={`rounded-ui p-1.5 hover:bg-muted ${ativo ? "text-danger" : "text-brand"}`}
    >
      <Power size={16} />
    </button>
  );
}
```

```tsx
// src/components/questionario/lista-rotulos.tsx
"use client";

import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import { moverItem } from "@/lib/questionario/lista";

type Props = {
  /** `name` dos inputs: o server lê com formData.getAll(nome). */
  nome: string;
  rotulo: string;
  valores: string[];
  onChange: (valores: string[]) => void;
  placeholder?: string;
};

const botao = "rounded-ui p-1.5 text-ink/70 hover:bg-muted disabled:opacity-30 disabled:hover:bg-transparent";

export function ListaRotulos({ nome, rotulo, valores, onChange, placeholder }: Props) {
  return (
    <fieldset className="grid gap-2">
      <legend className="text-sm font-medium text-ink/80">{rotulo}</legend>
      {valores.map((valor, i) => (
        <div key={i} className="flex items-center gap-1">
          <input
            name={nome}
            value={valor}
            placeholder={placeholder}
            aria-label={`${rotulo} ${i + 1}`}
            onChange={(e) => onChange(valores.map((v, j) => (j === i ? e.target.value : v)))}
          />
          <button type="button" className={botao} disabled={i === 0} aria-label={`Subir ${rotulo} ${i + 1}`}
            onClick={() => onChange(moverItem(valores, i, i - 1))}>
            <ArrowUp size={14} />
          </button>
          <button type="button" className={botao} disabled={i === valores.length - 1} aria-label={`Descer ${rotulo} ${i + 1}`}
            onClick={() => onChange(moverItem(valores, i, i + 1))}>
            <ArrowDown size={14} />
          </button>
          <button type="button" className={botao} aria-label={`Remover ${rotulo} ${i + 1}`}
            onClick={() => onChange(valores.filter((_, j) => j !== i))}>
            <X size={14} />
          </button>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...valores, ""])}
        className="flex w-fit items-center gap-1 text-sm font-medium text-brand hover:underline">
        <Plus size={14} /> Adicionar
      </button>
    </fieldset>
  );
}
```

```tsx
// src/components/questionario/lista-rotulos.test.tsx
// @vitest-environment jsdom
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ListaRotulos } from "./lista-rotulos";

function Harness({ inicial }: { inicial: string[] }) {
  const [valores, setValores] = useState(inicial);
  return <ListaRotulos nome="opcoes" rotulo="Opção" valores={valores} onChange={setValores} />;
}

const valoresAtuais = () =>
  screen.getAllByRole("textbox").map((el) => (el as HTMLInputElement).value);

describe("ListaRotulos", () => {
  it("adiciona uma linha vazia", () => {
    render(<Harness inicial={["A"]} />);
    fireEvent.click(screen.getByRole("button", { name: /adicionar/i }));
    expect(valoresAtuais()).toEqual(["A", ""]);
  });

  it("edita, reordena e remove", () => {
    render(<Harness inicial={["A", "B", "C"]} />);
    fireEvent.change(screen.getByLabelText("Opção 1"), { target: { value: "AA" } });
    fireEvent.click(screen.getByRole("button", { name: "Descer Opção 1" }));
    expect(valoresAtuais()).toEqual(["B", "AA", "C"]);
    fireEvent.click(screen.getByRole("button", { name: "Remover Opção 3" }));
    expect(valoresAtuais()).toEqual(["B", "AA"]);
  });

  it("desabilita subir no primeiro e descer no último", () => {
    render(<Harness inicial={["A", "B"]} />);
    expect(screen.getByRole("button", { name: "Subir Opção 1" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Descer Opção 2" })).toBeDisabled();
  });

  it("usa o mesmo name em todos os inputs (formData.getAll)", () => {
    render(<Harness inicial={["A", "B"]} />);
    for (const el of screen.getAllByRole("textbox")) expect(el).toHaveAttribute("name", "opcoes");
  });
});
```

- [ ] **Step 7: Rodar tudo**

Run: `npx vitest run src/lib/questionario src/components/questionario && npm run typecheck`
Expected: PASS (filhos 3 testes, ListaRotulos 4 testes), typecheck limpo.

- [ ] **Step 8: Commit**

```bash
git add src/lib/questionario/tipos.ts src/lib/questionario/test-support.ts src/lib/questionario/filhos.ts src/lib/questionario/filhos.test.ts src/lib/questionario/ativo.ts src/lib/questionario/acesso.ts src/lib/data/questionario.ts src/components/questionario/botao-ativar.tsx src/components/questionario/lista-rotulos.tsx src/components/questionario/lista-rotulos.test.tsx
git commit -m "feat(questionario): infra compartilhada (queries, filhos, toggle, lista de rotulos)" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Grupo de Questão (tela única)

**Files:**
- Create: `src/lib/actions/questionario-grupos.ts`, `src/lib/actions/questionario-grupos.test.ts`
- Create: `src/components/questionario/grupos-manager.tsx`
- Create: `src/app/(app)/questionario/grupos/page.tsx`

**Interfaces:**
- Consumes: `GrupoSchema`, `IdSchema` (T2); `lerTexto` (T2); `primeiroErro`, `ActionResult`, `GrupoRow` (T3); `alternarAtivo` (T3); `listarGrupos` (T3); `podeAcao` (T3); `BotaoAtivar` (T3); `fakeSupabase`, `formData` (T3).
- Produces: `criarGrupoAction(fd)`, `atualizarGrupoAction(fd)`, `alternarAtivoGrupoAction(fd)` — todas `Promise<ActionResult>`; rota `/questionario/grupos`.

- [ ] **Step 1: Teste que falha**

```ts
// src/lib/actions/questionario-grupos.test.ts
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

import { alternarAtivoGrupoAction, atualizarGrupoAction, criarGrupoAction } from "./questionario-grupos";

const ID = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  h.requirePermission.mockReset().mockResolvedValue({ profile: { escola_id: "escola-1" } });
  h.revalidatePath.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("criarGrupoAction", () => {
  it("exige create no módulo do grupo e grava na escola do usuário", async () => {
    const db = fakeSupabase();
    h.client = db.client;

    const r = await criarGrupoAction(formData({ descricao: "  Corpo, gestos  " }));

    expect(h.requirePermission).toHaveBeenCalledWith("questionario.grupo", "create");
    expect(r).toMatchObject({ ok: true });
    expect(db.chamadas("questao_grupos", "insert")[0].payload).toEqual({
      escola_id: "escola-1",
      descricao: "Corpo, gestos",
    });
    expect(h.revalidatePath).toHaveBeenCalledWith("/questionario/grupos");
  });

  it("recusa descrição vazia sem tocar no banco", async () => {
    const db = fakeSupabase();
    h.client = db.client;
    const r = await criarGrupoAction(formData({ descricao: "   " }));
    expect(r).toEqual({ ok: false, error: "Descrição é obrigatória" });
    expect(db.calls).toHaveLength(0);
  });

  it("descrição duplicada vira mensagem amigável", async () => {
    h.client = fakeSupabase({
      "questao_grupos.insert": [{ error: { message: "duplicate key", code: "23505" } }],
    }).client;
    await expect(criarGrupoAction(formData({ descricao: "Corpo" }))).rejects.toThrow(/Já existe um registro/);
  });
});

describe("atualizarGrupoAction", () => {
  it("atualiza só a descrição do grupo da escola", async () => {
    const db = fakeSupabase();
    h.client = db.client;
    const r = await atualizarGrupoAction(formData({ id: ID, descricao: "Novo" }));
    expect(h.requirePermission).toHaveBeenCalledWith("questionario.grupo", "update");
    expect(r).toMatchObject({ ok: true });
    const upd = db.chamadas("questao_grupos", "update")[0];
    expect(upd.payload).toEqual({ descricao: "Novo" });
    expect(upd.filtros).toContainEqual(["eq", "id", ID]);
    expect(upd.filtros).toContainEqual(["eq", "escola_id", "escola-1"]);
  });

  it("recusa id inválido", async () => {
    const db = fakeSupabase();
    h.client = db.client;
    const r = await atualizarGrupoAction(formData({ id: "x", descricao: "Novo" }));
    expect(r.ok).toBe(false);
    expect(db.calls).toHaveLength(0);
  });
});

describe("alternarAtivoGrupoAction", () => {
  it("inativa sem apagar", async () => {
    const db = fakeSupabase();
    h.client = db.client;
    const r = await alternarAtivoGrupoAction(formData({ id: ID, ativo: "false" }));
    expect(h.requirePermission).toHaveBeenCalledWith("questionario.grupo", "update");
    expect(r).toMatchObject({ ok: true });
    expect(db.chamadas("questao_grupos", "update")[0].payload).toEqual({ ativo: false });
    expect(db.chamadas("questao_grupos", "delete")).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/actions/questionario-grupos.test.ts`
Expected: FAIL (`./questionario-grupos` não existe).

- [ ] **Step 3: Implementar as actions**

```ts
// src/lib/actions/questionario-grupos.ts
"use server";

import { revalidatePath } from "next/cache";
import { assertOk } from "@/lib/actions/assert-ok";
import { requirePermission } from "@/lib/auth/session";
import { createServerClient } from "@/lib/supabase/server";
import { alternarAtivo } from "@/lib/questionario/ativo";
import { lerTexto } from "@/lib/questionario/lista";
import { primeiroErro, type ActionResult } from "@/lib/questionario/tipos";
import { GrupoSchema, IdSchema } from "@/lib/validation/questionario";

const ROTA = "/questionario/grupos";

export async function criarGrupoAction(formData: FormData): Promise<ActionResult> {
  const session = await requirePermission("questionario.grupo", "create");
  const parsed = GrupoSchema.safeParse({ descricao: lerTexto(formData, "descricao") });
  if (!parsed.success) return { ok: false, error: primeiroErro(parsed.error) };

  const db = await createServerClient();
  assertOk(
    await db.from("questao_grupos").insert({
      escola_id: session.profile.escola_id,
      descricao: parsed.data.descricao,
    }),
    "Não foi possível cadastrar o grupo",
  );
  revalidatePath(ROTA);
  return { ok: true, message: "Grupo cadastrado." };
}

export async function atualizarGrupoAction(formData: FormData): Promise<ActionResult> {
  const session = await requirePermission("questionario.grupo", "update");
  const id = IdSchema.safeParse(lerTexto(formData, "id"));
  if (!id.success) return { ok: false, error: primeiroErro(id.error) };
  const parsed = GrupoSchema.safeParse({ descricao: lerTexto(formData, "descricao") });
  if (!parsed.success) return { ok: false, error: primeiroErro(parsed.error) };

  const db = await createServerClient();
  assertOk(
    await db
      .from("questao_grupos")
      .update({ descricao: parsed.data.descricao })
      .eq("id", id.data)
      .eq("escola_id", session.profile.escola_id),
    "Não foi possível salvar o grupo",
  );
  revalidatePath(ROTA);
  return { ok: true, message: "Grupo atualizado." };
}

export async function alternarAtivoGrupoAction(formData: FormData): Promise<ActionResult> {
  const session = await requirePermission("questionario.grupo", "update");
  const resultado = await alternarAtivo(formData, "questao_grupos", session.profile.escola_id);
  if (resultado.ok) revalidatePath(ROTA);
  return resultado;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/actions/questionario-grupos.test.ts`
Expected: PASS (6 testes).

- [ ] **Step 5: Tela e página**

```tsx
// src/components/questionario/grupos-manager.tsx
"use client";

import { useState, type FormEvent } from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/card";
import { DataTableShell } from "@/components/ui/data-table";
import { SearchInline } from "@/components/ui/search-inline";
import { StatusPill } from "@/components/ui/status-pill";
import { BotaoAtivar } from "@/components/questionario/botao-ativar";
import {
  alternarAtivoGrupoAction,
  atualizarGrupoAction,
  criarGrupoAction,
} from "@/lib/actions/questionario-grupos";
import { useAction } from "@/lib/hooks/use-action";
import { normalizarBusca } from "@/lib/questionario/lista";
import type { GrupoRow } from "@/lib/questionario/tipos";

type Props = { grupos: GrupoRow[]; podeCriar: boolean; podeEditar: boolean };

export function GruposManager({ grupos, podeCriar, podeEditar }: Props) {
  const [editando, setEditando] = useState<GrupoRow | null>(null);
  const [busca, setBusca] = useState("");
  const [formKey, setFormKey] = useState(0);

  const salvar = useAction(
    (fd: FormData) => (fd.get("id") ? atualizarGrupoAction(fd) : criarGrupoAction(fd)),
    {
      onSuccess: () => {
        setEditando(null);
        setFormKey((k) => k + 1);
      },
    },
  );

  const termo = normalizarBusca(busca);
  const visiveis = grupos.filter((g) => normalizarBusca(g.descricao).includes(termo));
  const mostrarForm = editando ? podeEditar : podeCriar;

  function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    salvar.run(new FormData(e.currentTarget));
  }

  return (
    <div className="grid gap-6">
      {mostrarForm ? (
        <Panel>
          <form key={`${editando?.id ?? "novo"}-${formKey}`} onSubmit={enviar} className="flex flex-wrap items-end gap-3">
            {editando ? <input type="hidden" name="id" value={editando.id} /> : null}
            <div className="grid min-w-[16rem] flex-1 gap-1">
              <label htmlFor="grupo-descricao" className="text-sm font-medium text-ink/80">
                Descrição *
              </label>
              <input id="grupo-descricao" name="descricao" required defaultValue={editando?.descricao ?? ""} />
            </div>
            <Button type="submit" variant="primary" loading={salvar.pending}>
              {editando ? "Salvar" : "Cadastrar"}
            </Button>
            {editando ? (
              <Button type="button" variant="secondary" onClick={() => setEditando(null)}>
                Cancelar
              </Button>
            ) : null}
          </form>
        </Panel>
      ) : null}

      <DataTableShell
        toolbar={<SearchInline value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Pesquisar" />}
      >
        <table className="ds-dt min-w-[560px]">
          <thead>
            <tr>
              <th className="w-[110px]">Código</th>
              <th>Descrição</th>
              <th className="w-[130px]">Situação</th>
              <th className="w-[110px] text-right">Ação</th>
            </tr>
          </thead>
          <tbody>
            {visiveis.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-5 py-10 text-center text-sm text-ink/60">
                  Nenhum grupo encontrado.
                </td>
              </tr>
            ) : null}
            {visiveis.map((g) => (
              <tr key={g.id}>
                <td className="pl-4 font-semibold text-ink">{g.codigo}</td>
                <td className="text-ink">{g.descricao}</td>
                <td>
                  <StatusPill tone={g.ativo ? "success" : "neutral"}>{g.ativo ? "Ativo" : "Inativo"}</StatusPill>
                </td>
                <td className="pr-4">
                  {podeEditar ? (
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        aria-label={`Editar ${g.descricao}`}
                        onClick={() => setEditando(g)}
                        className="rounded-ui p-1.5 text-brand hover:bg-brand/10"
                      >
                        <Pencil size={16} />
                      </button>
                      <BotaoAtivar
                        acao={alternarAtivoGrupoAction}
                        id={g.id}
                        ativo={g.ativo}
                        nome={g.descricao}
                      />
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
// src/app/(app)/questionario/grupos/page.tsx
import { PageHeader } from "@/components/ui/page-header";
import { GruposManager } from "@/components/questionario/grupos-manager";
import { requirePermission } from "@/lib/auth/session";
import { listarGrupos } from "@/lib/data/questionario";
import { podeAcao } from "@/lib/questionario/acesso";

export default async function GruposPage() {
  const session = await requirePermission("questionario.grupo", "read");
  const grupos = await listarGrupos();

  return (
    <div className="grid gap-8">
      <PageHeader
        breadcrumb={[{ label: "Acadêmico" }, { label: "Questionário" }, { label: "Cadastro de grupo de questão" }]}
        title="Cadastro de Grupo de Questão"
        counter={String(grupos.length)}
      />
      <GruposManager
        grupos={grupos}
        podeCriar={podeAcao(session, "questionario.grupo", "create")}
        podeEditar={podeAcao(session, "questionario.grupo", "update")}
      />
    </div>
  );
}
```

- [ ] **Step 6: Typecheck e commit**

Run: `npm run typecheck && npx vitest run src/lib/actions/questionario-grupos.test.ts`
Expected: limpo / PASS.

```bash
git add src/lib/actions/questionario-grupos.ts src/lib/actions/questionario-grupos.test.ts src/components/questionario/grupos-manager.tsx "src/app/(app)/questionario/grupos/page.tsx"
git commit -m "feat(questionario): cadastro de grupo de questao" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Escalas (catálogo)

**Files:**
- Create: `src/lib/actions/questionario-escalas.ts`, `src/lib/actions/questionario-escalas.test.ts`
- Create: `src/components/questionario/escalas-manager.tsx`
- Create: `src/app/(app)/questionario/escalas/page.tsx`

**Interfaces:**
- Consumes: `EscalaSchema`, `IdSchema` (T2); `lerLista`, `lerTexto` (T2); `substituirFilhos`, `alternarAtivo`, `listarEscalas`, `podeAcao`, `BotaoAtivar`, `ListaRotulos`, `EscalaRow`, `primeiroErro`, `ActionResult` (T3).
- Produces: `criarEscalaAction`, `atualizarEscalaAction`, `alternarAtivoEscalaAction`; campos de form `id`, `descricao`, `opcoes` (repetido); rota `/questionario/escalas`.

- [ ] **Step 1: Teste que falha**

```ts
// src/lib/actions/questionario-escalas.test.ts
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

import { alternarAtivoEscalaAction, atualizarEscalaAction, criarEscalaAction } from "./questionario-escalas";

const ID = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  h.requirePermission.mockReset().mockResolvedValue({ profile: { escola_id: "escola-1" } });
  h.revalidatePath.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("criarEscalaAction", () => {
  it("grava a escala e as opções na ordem informada, ignorando linhas em branco", async () => {
    const db = fakeSupabase({ "escalas.insert": [{ data: { id: "e1" } }] });
    h.client = db.client;

    const r = await criarEscalaAction(
      formData({ descricao: "Desenvolvimento", opcoes: ["Não observado", "", "Em desenvolvimento", "Desenvolvido"] }),
    );

    expect(h.requirePermission).toHaveBeenCalledWith("questionario.escala", "create");
    expect(r).toMatchObject({ ok: true });
    expect(db.chamadas("escalas", "insert")[0].payload).toEqual({ escola_id: "escola-1", descricao: "Desenvolvimento" });
    expect(db.chamadas("escala_opcoes", "insert")[0].payload).toEqual([
      { escala_id: "e1", rotulo: "Não observado", ordem: 1 },
      { escala_id: "e1", rotulo: "Em desenvolvimento", ordem: 2 },
      { escala_id: "e1", rotulo: "Desenvolvido", ordem: 3 },
    ]);
  });

  it("recusa escala com 1 opção sem tocar no banco", async () => {
    const db = fakeSupabase();
    h.client = db.client;
    const r = await criarEscalaAction(formData({ descricao: "E", opcoes: ["Só uma", ""] }));
    expect(r).toEqual({ ok: false, error: "A escala precisa de ao menos 2 opções" });
    expect(db.calls).toHaveLength(0);
  });

  it("recusa opções repetidas (caixa/espaço)", async () => {
    const db = fakeSupabase();
    h.client = db.client;
    const r = await criarEscalaAction(formData({ descricao: "E", opcoes: ["Sim", " sim"] }));
    expect(r.ok).toBe(false);
    expect(db.calls).toHaveLength(0);
  });

  it("descrição duplicada vira mensagem amigável", async () => {
    h.client = fakeSupabase({ "escalas.insert": [{ error: { message: "dup", code: "23505" } }] }).client;
    await expect(criarEscalaAction(formData({ descricao: "E", opcoes: ["A", "B"] }))).rejects.toThrow(
      /Já existe um registro/,
    );
  });

  it("se as opções falham, apaga a escala recém-criada (sem órfã)", async () => {
    const db = fakeSupabase({
      "escalas.insert": [{ data: { id: "e1" } }],
      "escala_opcoes.insert": [{ error: { message: "boom" } }],
    });
    h.client = db.client;
    await expect(criarEscalaAction(formData({ descricao: "E", opcoes: ["A", "B"] }))).rejects.toThrow();
    const del = db.chamadas("escalas", "delete");
    expect(del).toHaveLength(1);
    expect(del[0].filtros).toContainEqual(["eq", "id", "e1"]);
  });
});

describe("atualizarEscalaAction", () => {
  it("atualiza a descrição e troca as opções (grava antes de apagar)", async () => {
    const db = fakeSupabase({ "escala_opcoes.select": [{ data: [{ id: "o1" }] }] });
    h.client = db.client;

    const r = await atualizarEscalaAction(formData({ id: ID, descricao: "Nova", opcoes: ["X", "Y"] }));

    expect(h.requirePermission).toHaveBeenCalledWith("questionario.escala", "update");
    expect(r).toMatchObject({ ok: true });
    expect(db.chamadas("escalas", "update")[0].payload).toEqual({ descricao: "Nova" });
    expect(db.calls.filter((c) => c.table === "escala_opcoes").map((c) => c.op)).toEqual([
      "select",
      "insert",
      "delete",
    ]);
  });
});

describe("alternarAtivoEscalaAction", () => {
  it("ativa sem apagar", async () => {
    const db = fakeSupabase();
    h.client = db.client;
    await alternarAtivoEscalaAction(formData({ id: ID, ativo: "true" }));
    expect(db.chamadas("escalas", "update")[0].payload).toEqual({ ativo: true });
    expect(db.chamadas("escalas", "delete")).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/actions/questionario-escalas.test.ts`
Expected: FAIL (módulo inexistente).

- [ ] **Step 3: Implementar**

```ts
// src/lib/actions/questionario-escalas.ts
"use server";

import { revalidatePath } from "next/cache";
import { assertOk } from "@/lib/actions/assert-ok";
import { requirePermission } from "@/lib/auth/session";
import { createServerClient } from "@/lib/supabase/server";
import { alternarAtivo } from "@/lib/questionario/ativo";
import { substituirFilhos } from "@/lib/questionario/filhos";
import { lerLista, lerTexto } from "@/lib/questionario/lista";
import { primeiroErro, type ActionResult } from "@/lib/questionario/tipos";
import { EscalaSchema, IdSchema } from "@/lib/validation/questionario";

const ROTA = "/questionario/escalas";

function lerEscala(formData: FormData) {
  return EscalaSchema.safeParse({
    descricao: lerTexto(formData, "descricao"),
    opcoes: lerLista(formData, "opcoes"),
  });
}

export async function criarEscalaAction(formData: FormData): Promise<ActionResult> {
  const session = await requirePermission("questionario.escala", "create");
  const parsed = lerEscala(formData);
  if (!parsed.success) return { ok: false, error: primeiroErro(parsed.error) };

  const db = await createServerClient();
  const nova = assertOk(
    await db
      .from("escalas")
      .insert({ escola_id: session.profile.escola_id, descricao: parsed.data.descricao })
      .select("id")
      .single(),
    "Não foi possível cadastrar a escala",
  ) as { id: string };

  try {
    await substituirFilhos(db, "escala_opcoes", nova.id, parsed.data.opcoes);
  } catch (erro) {
    await db.from("escalas").delete().eq("id", nova.id);
    throw erro;
  }

  revalidatePath(ROTA);
  return { ok: true, message: "Escala cadastrada." };
}

export async function atualizarEscalaAction(formData: FormData): Promise<ActionResult> {
  const session = await requirePermission("questionario.escala", "update");
  const id = IdSchema.safeParse(lerTexto(formData, "id"));
  if (!id.success) return { ok: false, error: primeiroErro(id.error) };
  const parsed = lerEscala(formData);
  if (!parsed.success) return { ok: false, error: primeiroErro(parsed.error) };

  const db = await createServerClient();
  assertOk(
    await db
      .from("escalas")
      .update({ descricao: parsed.data.descricao })
      .eq("id", id.data)
      .eq("escola_id", session.profile.escola_id),
    "Não foi possível salvar a escala",
  );
  await substituirFilhos(db, "escala_opcoes", id.data, parsed.data.opcoes);

  revalidatePath(ROTA);
  return { ok: true, message: "Escala atualizada." };
}

export async function alternarAtivoEscalaAction(formData: FormData): Promise<ActionResult> {
  const session = await requirePermission("questionario.escala", "update");
  const resultado = await alternarAtivo(formData, "escalas", session.profile.escola_id);
  if (resultado.ok) revalidatePath(ROTA);
  return resultado;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/actions/questionario-escalas.test.ts`
Expected: PASS (7 testes).

- [ ] **Step 5: Tela e página**

```tsx
// src/components/questionario/escalas-manager.tsx
"use client";

import { useState, type FormEvent } from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/card";
import { DataTableShell } from "@/components/ui/data-table";
import { SearchInline } from "@/components/ui/search-inline";
import { StatusPill } from "@/components/ui/status-pill";
import { BotaoAtivar } from "@/components/questionario/botao-ativar";
import { ListaRotulos } from "@/components/questionario/lista-rotulos";
import {
  alternarAtivoEscalaAction,
  atualizarEscalaAction,
  criarEscalaAction,
} from "@/lib/actions/questionario-escalas";
import { useAction } from "@/lib/hooks/use-action";
import { normalizarBusca } from "@/lib/questionario/lista";
import type { EscalaRow } from "@/lib/questionario/tipos";

type Props = { escalas: EscalaRow[]; podeCriar: boolean; podeEditar: boolean };

const OPCOES_INICIAIS = ["", ""];

export function EscalasManager({ escalas, podeCriar, podeEditar }: Props) {
  const [editando, setEditando] = useState<EscalaRow | null>(null);
  const [opcoes, setOpcoes] = useState<string[]>(OPCOES_INICIAIS);
  const [busca, setBusca] = useState("");
  const [formKey, setFormKey] = useState(0);

  const salvar = useAction(
    (fd: FormData) => (fd.get("id") ? atualizarEscalaAction(fd) : criarEscalaAction(fd)),
    { onSuccess: () => limpar() },
  );

  function limpar() {
    setEditando(null);
    setOpcoes(OPCOES_INICIAIS);
    setFormKey((k) => k + 1);
  }

  function editar(escala: EscalaRow) {
    setEditando(escala);
    setOpcoes(escala.opcoes.length > 0 ? escala.opcoes : OPCOES_INICIAIS);
  }

  function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    salvar.run(new FormData(e.currentTarget));
  }

  const termo = normalizarBusca(busca);
  const visiveis = escalas.filter((e) => normalizarBusca(e.descricao).includes(termo));
  const mostrarForm = editando ? podeEditar : podeCriar;

  return (
    <div className="grid gap-6">
      {mostrarForm ? (
        <Panel>
          <form key={`${editando?.id ?? "novo"}-${formKey}`} onSubmit={enviar} className="grid gap-4">
            {editando ? <input type="hidden" name="id" value={editando.id} /> : null}
            <div className="grid gap-1">
              <label htmlFor="escala-descricao" className="text-sm font-medium text-ink/80">
                Descrição *
              </label>
              <input id="escala-descricao" name="descricao" required defaultValue={editando?.descricao ?? ""} />
            </div>
            <ListaRotulos
              nome="opcoes"
              rotulo="Opção"
              valores={opcoes}
              onChange={setOpcoes}
              placeholder="Ex.: Em desenvolvimento"
            />
            <div className="flex gap-3">
              <Button type="submit" variant="primary" loading={salvar.pending}>
                {editando ? "Salvar" : "Cadastrar"}
              </Button>
              {editando ? (
                <Button type="button" variant="secondary" onClick={limpar}>
                  Cancelar
                </Button>
              ) : null}
            </div>
          </form>
        </Panel>
      ) : null}

      <DataTableShell
        toolbar={<SearchInline value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Pesquisar" />}
      >
        <table className="ds-dt min-w-[640px]">
          <thead>
            <tr>
              <th>Descrição</th>
              <th>Opções</th>
              <th className="w-[130px]">Situação</th>
              <th className="w-[110px] text-right">Ação</th>
            </tr>
          </thead>
          <tbody>
            {visiveis.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-5 py-10 text-center text-sm text-ink/60">
                  Nenhuma escala encontrada.
                </td>
              </tr>
            ) : null}
            {visiveis.map((e) => (
              <tr key={e.id}>
                <td className="pl-4 font-semibold text-ink">{e.descricao}</td>
                <td className="text-ink/80">{e.opcoes.join(" · ")}</td>
                <td>
                  <StatusPill tone={e.ativo ? "success" : "neutral"}>{e.ativo ? "Ativa" : "Inativa"}</StatusPill>
                </td>
                <td className="pr-4">
                  {podeEditar ? (
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        aria-label={`Editar ${e.descricao}`}
                        onClick={() => editar(e)}
                        className="rounded-ui p-1.5 text-brand hover:bg-brand/10"
                      >
                        <Pencil size={16} />
                      </button>
                      <BotaoAtivar acao={alternarAtivoEscalaAction} id={e.id} ativo={e.ativo} nome={e.descricao} />
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
// src/app/(app)/questionario/escalas/page.tsx
import { PageHeader } from "@/components/ui/page-header";
import { EscalasManager } from "@/components/questionario/escalas-manager";
import { requirePermission } from "@/lib/auth/session";
import { listarEscalas } from "@/lib/data/questionario";
import { podeAcao } from "@/lib/questionario/acesso";

export default async function EscalasPage() {
  const session = await requirePermission("questionario.escala", "read");
  const escalas = await listarEscalas();

  return (
    <div className="grid gap-8">
      <PageHeader
        breadcrumb={[{ label: "Acadêmico" }, { label: "Questionário" }, { label: "Cadastro de escala" }]}
        title="Cadastro de Escala"
        counter={String(escalas.length)}
        description="Conjuntos de opções (ex.: Não observado / Em desenvolvimento / Desenvolvido) usados em questões com escala."
      />
      <EscalasManager
        escalas={escalas}
        podeCriar={podeAcao(session, "questionario.escala", "create")}
        podeEditar={podeAcao(session, "questionario.escala", "update")}
      />
    </div>
  );
}
```

- [ ] **Step 6: Typecheck e commit**

Run: `npm run typecheck && npx vitest run src/lib/actions/questionario-escalas.test.ts`
Expected: limpo / PASS.

```bash
git add src/lib/actions/questionario-escalas.ts src/lib/actions/questionario-escalas.test.ts src/components/questionario/escalas-manager.tsx "src/app/(app)/questionario/escalas/page.tsx"
git commit -m "feat(questionario): cadastro de escala" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Cadastro de Questão

**Files:**
- Create: `src/lib/actions/questionario-questoes.ts`, `src/lib/actions/questionario-questoes.test.ts`
- Create: `src/components/questionario/questao-form.tsx`, `src/components/questionario/questao-form.test.tsx`
- Create: `src/components/questionario/questoes-lista.tsx`
- Create: `src/app/(app)/questionario/questoes/page.tsx`, `.../questoes/nova/page.tsx`, `.../questoes/[id]/editar/page.tsx`

**Interfaces:**
- Consumes: `QuestaoSchema`, `IdSchema`, `QUESTAO_TIPO_LABEL`, `QUESTAO_TIPOS`, `QuestaoTipo` (T2); `lerLista`, `lerTexto`, `normalizarBusca` (T2); `formBoolean`, `formNumber` (`src/lib/utils.ts`); `substituirFilhos`, `alternarAtivo`, `listarQuestoes`, `listarGrupos`, `getQuestao`, `podeAcao`, `BotaoAtivar`, `ListaRotulos`, `GrupoRow`, `QuestaoDetalhe`, `QuestaoLinha` (T3).
- Produces: `criarQuestaoAction`, `atualizarQuestaoAction`, `alternarAtivoQuestaoAction`; campos de form `id`, `grupoId`, `tipo`, `pergunta`, `ativa`/`obrigatoria`/`limitarCaracteres` ("on"), `qtdeCaracteres`, `qtdeLinhas`, `alternativas` (repetido); rotas `/questionario/questoes`, `/nova`, `/[id]/editar`. Ambas as actions de gravação retornam `redirectTo: "/questionario/questoes"`.

- [ ] **Step 1: Teste das actions (falha)**

```ts
// src/lib/actions/questionario-questoes.test.ts
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

import { alternarAtivoQuestaoAction, atualizarQuestaoAction, criarQuestaoAction } from "./questionario-questoes";

const ID = "11111111-1111-4111-8111-111111111111";
const GRUPO = "22222222-2222-4222-8222-222222222222";

const campos = (extra: Record<string, string | string[]> = {}) =>
  formData({ grupoId: GRUPO, tipo: "subjetiva", pergunta: "Como foi?", ativa: "on", ...extra });

beforeEach(() => {
  h.requirePermission.mockReset().mockResolvedValue({ profile: { escola_id: "escola-1" } });
  h.revalidatePath.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("criarQuestaoAction", () => {
  it("grava questão subjetiva com limite de caracteres", async () => {
    const db = fakeSupabase({ "questoes.insert": [{ data: { id: "q1" } }] });
    h.client = db.client;

    const r = await criarQuestaoAction(
      campos({ limitarCaracteres: "on", qtdeCaracteres: "300", qtdeLinhas: "5", obrigatoria: "on" }),
    );

    expect(h.requirePermission).toHaveBeenCalledWith("questionario.questao", "create");
    expect(r).toEqual({ ok: true, message: "Questão cadastrada.", redirectTo: "/questionario/questoes" });
    expect(db.chamadas("questoes", "insert")[0].payload).toEqual({
      escola_id: "escola-1",
      grupo_id: GRUPO,
      tipo: "subjetiva",
      pergunta: "Como foi?",
      ativa: true,
      obrigatoria: true,
      limitar_caracteres: true,
      qtde_caracteres: 300,
      qtde_linhas: 5,
    });
  });

  it("única escolha grava as alternativas em ordem", async () => {
    const db = fakeSupabase({ "questoes.insert": [{ data: { id: "q1" } }] });
    h.client = db.client;
    await criarQuestaoAction(campos({ tipo: "objetiva_unica", alternativas: ["Sim", "", "Não"] }));
    expect(db.chamadas("questao_alternativas", "insert")[0].payload).toEqual([
      { questao_id: "q1", rotulo: "Sim", ordem: 1 },
      { questao_id: "q1", rotulo: "Não", ordem: 2 },
    ]);
  });

  it("única escolha com 1 alternativa é recusada sem gravar nada", async () => {
    const db = fakeSupabase();
    h.client = db.client;
    const r = await criarQuestaoAction(campos({ tipo: "objetiva_unica", alternativas: ["Só uma"] }));
    expect(r).toEqual({ ok: false, error: "A questão precisa de ao menos 2 alternativas" });
    expect(db.calls).toHaveLength(0);
  });

  it("se as alternativas falham, apaga a questão recém-criada (sem órfã)", async () => {
    const db = fakeSupabase({
      "questoes.insert": [{ data: { id: "q1" } }],
      "questao_alternativas.insert": [{ error: { message: "boom" } }],
    });
    h.client = db.client;
    await expect(criarQuestaoAction(campos({ tipo: "objetiva_multipla", alternativas: ["A", "B"] }))).rejects.toThrow();
    expect(db.chamadas("questoes", "delete")[0].filtros).toContainEqual(["eq", "id", "q1"]);
  });
});

describe("atualizarQuestaoAction", () => {
  it("recusa trocar o tipo de questão já usada em questionário", async () => {
    const db = fakeSupabase({
      "questoes.select": [{ data: { tipo: "subjetiva" } }],
      "questionario_questoes.select": [{ count: 2 }],
    });
    h.client = db.client;

    const r = await atualizarQuestaoAction(campos({ id: ID, tipo: "objetiva_escala" }));

    expect(r).toEqual({
      ok: false,
      error: "Questão em uso em questionário: não é possível trocar o tipo.",
    });
    expect(db.chamadas("questoes", "update")).toHaveLength(0);
    expect(db.chamadas("questao_alternativas", "insert")).toHaveLength(0);
  });

  it("permite editar o texto de questão em uso (tipo igual)", async () => {
    const db = fakeSupabase({
      "questoes.select": [{ data: { tipo: "subjetiva" } }],
      "questionario_questoes.select": [{ count: 3 }],
    });
    h.client = db.client;
    const r = await atualizarQuestaoAction(campos({ id: ID, pergunta: "Novo texto" }));
    expect(r).toMatchObject({ ok: true });
    expect(db.chamadas("questoes", "update")[0].payload).toMatchObject({ pergunta: "Novo texto", tipo: "subjetiva" });
  });

  it("permite trocar o tipo quando não está em uso e troca as alternativas", async () => {
    const db = fakeSupabase({
      "questoes.select": [{ data: { tipo: "subjetiva" } }],
      "questionario_questoes.select": [{ count: 0 }],
      "questao_alternativas.select": [{ data: [] }],
    });
    h.client = db.client;
    const r = await atualizarQuestaoAction(campos({ id: ID, tipo: "objetiva_unica", alternativas: ["A", "B"] }));
    expect(r).toMatchObject({ ok: true });
    expect(db.chamadas("questoes", "update")[0].payload).toMatchObject({ tipo: "objetiva_unica" });
    expect(db.chamadas("questao_alternativas", "insert")).toHaveLength(1);
  });

  it("questão inexistente", async () => {
    h.client = fakeSupabase({ "questoes.select": [{ data: null }] }).client;
    const r = await atualizarQuestaoAction(campos({ id: ID }));
    expect(r).toEqual({ ok: false, error: "Questão não encontrada." });
  });
});

describe("alternarAtivoQuestaoAction", () => {
  it("usa a coluna `ativa` e não apaga", async () => {
    const db = fakeSupabase();
    h.client = db.client;
    await alternarAtivoQuestaoAction(formData({ id: ID, ativo: "false" }));
    expect(h.requirePermission).toHaveBeenCalledWith("questionario.questao", "update");
    expect(db.chamadas("questoes", "update")[0].payload).toEqual({ ativa: false });
    expect(db.chamadas("questoes", "delete")).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/actions/questionario-questoes.test.ts`
Expected: FAIL (módulo inexistente).

- [ ] **Step 3: Implementar as actions**

```ts
// src/lib/actions/questionario-questoes.ts
"use server";

import { revalidatePath } from "next/cache";
import { assertOk } from "@/lib/actions/assert-ok";
import { requirePermission } from "@/lib/auth/session";
import { createServerClient } from "@/lib/supabase/server";
import { alternarAtivo } from "@/lib/questionario/ativo";
import { substituirFilhos } from "@/lib/questionario/filhos";
import { lerLista, lerTexto } from "@/lib/questionario/lista";
import { primeiroErro, type ActionResult } from "@/lib/questionario/tipos";
import { formBoolean, formNumber } from "@/lib/utils";
import { IdSchema, QuestaoSchema, type QuestaoInput } from "@/lib/validation/questionario";

const ROTA = "/questionario/questoes";

function lerQuestao(formData: FormData) {
  return QuestaoSchema.safeParse({
    grupoId: lerTexto(formData, "grupoId"),
    tipo: lerTexto(formData, "tipo"),
    pergunta: lerTexto(formData, "pergunta"),
    ativa: formBoolean(formData, "ativa"),
    obrigatoria: formBoolean(formData, "obrigatoria"),
    limitarCaracteres: formBoolean(formData, "limitarCaracteres"),
    qtdeCaracteres: formNumber(formData, "qtdeCaracteres") ?? 0,
    qtdeLinhas: formNumber(formData, "qtdeLinhas") ?? 0,
    alternativas: lerLista(formData, "alternativas"),
  });
}

function colunas(q: QuestaoInput) {
  return {
    grupo_id: q.grupoId,
    tipo: q.tipo,
    pergunta: q.pergunta,
    ativa: q.ativa,
    obrigatoria: q.obrigatoria,
    limitar_caracteres: q.limitarCaracteres,
    qtde_caracteres: q.qtdeCaracteres,
    qtde_linhas: q.qtdeLinhas,
  };
}

export async function criarQuestaoAction(formData: FormData): Promise<ActionResult> {
  const session = await requirePermission("questionario.questao", "create");
  const parsed = lerQuestao(formData);
  if (!parsed.success) return { ok: false, error: primeiroErro(parsed.error) };

  const db = await createServerClient();
  const nova = assertOk(
    await db
      .from("questoes")
      .insert({ escola_id: session.profile.escola_id, ...colunas(parsed.data) })
      .select("id")
      .single(),
    "Não foi possível cadastrar a questão",
  ) as { id: string };

  if (parsed.data.alternativas.length > 0) {
    try {
      await substituirFilhos(db, "questao_alternativas", nova.id, parsed.data.alternativas);
    } catch (erro) {
      await db.from("questoes").delete().eq("id", nova.id);
      throw erro;
    }
  }

  revalidatePath(ROTA);
  return { ok: true, message: "Questão cadastrada.", redirectTo: ROTA };
}

export async function atualizarQuestaoAction(formData: FormData): Promise<ActionResult> {
  const session = await requirePermission("questionario.questao", "update");
  const id = IdSchema.safeParse(lerTexto(formData, "id"));
  if (!id.success) return { ok: false, error: primeiroErro(id.error) };
  const parsed = lerQuestao(formData);
  if (!parsed.success) return { ok: false, error: primeiroErro(parsed.error) };

  const db = await createServerClient();
  const atual = assertOk(
    await db.from("questoes").select("tipo").eq("id", id.data).eq("escola_id", session.profile.escola_id).maybeSingle(),
    "Não foi possível ler a questão",
  ) as { tipo: string } | null;
  if (!atual) return { ok: false, error: "Questão não encontrada." };

  if (atual.tipo !== parsed.data.tipo) {
    const uso = await db
      .from("questionario_questoes")
      .select("id", { count: "exact", head: true })
      .eq("questao_id", id.data);
    assertOk(uso, "Não foi possível verificar o uso da questão");
    if ((uso.count ?? 0) > 0) {
      return { ok: false, error: "Questão em uso em questionário: não é possível trocar o tipo." };
    }
  }

  assertOk(
    await db
      .from("questoes")
      .update(colunas(parsed.data))
      .eq("id", id.data)
      .eq("escola_id", session.profile.escola_id),
    "Não foi possível salvar a questão",
  );
  await substituirFilhos(db, "questao_alternativas", id.data, parsed.data.alternativas);

  revalidatePath(ROTA);
  return { ok: true, message: "Questão atualizada.", redirectTo: ROTA };
}

export async function alternarAtivoQuestaoAction(formData: FormData): Promise<ActionResult> {
  const session = await requirePermission("questionario.questao", "update");
  const resultado = await alternarAtivo(formData, "questoes", session.profile.escola_id);
  if (resultado.ok) revalidatePath(ROTA);
  return resultado;
}
```

Nota para o teste "permite editar o texto de questão em uso (tipo igual)": a action só consulta o uso quando o tipo muda, então a fila `questionario_questoes.select` desse teste fica sem consumo — isso é esperado e intencional (evita consulta desnecessária).

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/actions/questionario-questoes.test.ts`
Expected: PASS (9 testes).

- [ ] **Step 5: Teste do formulário (falha)**

```tsx
// src/components/questionario/questao-form.test.tsx
// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

const h = vi.hoisted(() => ({ criar: vi.fn(), atualizar: vi.fn() }));
vi.mock("@/lib/actions/questionario-questoes", () => ({
  criarQuestaoAction: h.criar,
  atualizarQuestaoAction: h.atualizar,
}));
vi.mock("@/lib/hooks/use-action", () => ({
  useAction: (fn: (...a: unknown[]) => unknown) => ({
    run: (...a: unknown[]) => void fn(...a),
    pending: false,
  }),
}));

import { QuestaoForm } from "./questao-form";
import type { GrupoRow, QuestaoDetalhe } from "@/lib/questionario/tipos";

const GRUPOS: GrupoRow[] = [
  { id: "g1", codigo: 1, descricao: "O EU", ativo: true },
  { id: "g2", codigo: 2, descricao: "CORPO", ativo: false },
];

const questao: QuestaoDetalhe = {
  id: "q1", grupoId: "g1", tipo: "subjetiva", pergunta: "Explique", ativa: true, obrigatoria: false,
  limitarCaracteres: false, qtdeCaracteres: 0, qtdeLinhas: 0, alternativas: [], emUso: false,
};

describe("QuestaoForm", () => {
  it("subjetiva mostra qtde de linhas; única escolha troca por alternativas", () => {
    render(<QuestaoForm grupos={GRUPOS} />);
    expect(screen.getByLabelText(/Qtde\. Linhas/)).toBeInTheDocument();
    expect(screen.queryByLabelText("Alternativa 1")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Tipo de Questão/), { target: { value: "objetiva_unica" } });

    expect(screen.queryByLabelText(/Qtde\. Linhas/)).not.toBeInTheDocument();
    expect(screen.getByLabelText("Alternativa 1")).toBeInTheDocument();
    expect(screen.getByLabelText("Alternativa 2")).toBeInTheDocument();
  });

  it("qtde de caracteres só habilita quando limitar = sim", () => {
    render(<QuestaoForm grupos={GRUPOS} />);
    const qtde = screen.getByLabelText(/Qtde\. Caracteres/);
    expect(qtde).toBeDisabled();
    fireEvent.click(screen.getByLabelText(/Limitar quantidade de caracteres/));
    expect(qtde).toBeEnabled();
  });

  it("grupo inativo só aparece se for o grupo da própria questão", () => {
    render(<QuestaoForm grupos={GRUPOS} />);
    expect(screen.queryByRole("option", { name: "CORPO" })).not.toBeInTheDocument();
  });

  it("questão em uso trava o tipo e avisa", () => {
    render(<QuestaoForm grupos={GRUPOS} questao={{ ...questao, emUso: true }} />);
    expect(screen.getByLabelText(/Tipo de Questão/)).toBeDisabled();
    expect(screen.getByText(/em uso em questionário/i)).toBeInTheDocument();
    expect(document.querySelector('input[type="hidden"][name="tipo"]')).toHaveValue("subjetiva");
  });

  it("envia os campos para criar (id ausente) e inclui as alternativas", () => {
    h.criar.mockResolvedValue({ ok: true });
    render(<QuestaoForm grupos={GRUPOS} />);
    fireEvent.change(screen.getByLabelText(/Grupo/), { target: { value: "g1" } });
    fireEvent.change(screen.getByLabelText(/Tipo de Questão/), { target: { value: "objetiva_unica" } });
    fireEvent.change(screen.getByLabelText(/^Pergunta/), { target: { value: "Gosta?" } });
    fireEvent.change(screen.getByLabelText("Alternativa 1"), { target: { value: "Sim" } });
    fireEvent.change(screen.getByLabelText("Alternativa 2"), { target: { value: "Não" } });
    fireEvent.submit(screen.getByRole("button", { name: /gravar/i }).closest("form")!);

    const fd = h.criar.mock.calls[0][0] as FormData;
    expect(fd.get("grupoId")).toBe("g1");
    expect(fd.get("tipo")).toBe("objetiva_unica");
    expect(fd.get("pergunta")).toBe("Gosta?");
    expect(fd.getAll("alternativas")).toEqual(["Sim", "Não"]);
    expect(fd.get("id")).toBeNull();
  });
});
```

- [ ] **Step 6: Rodar e ver falhar**

Run: `npx vitest run src/components/questionario/questao-form.test.tsx`
Expected: FAIL (`./questao-form` não existe).

- [ ] **Step 7: Implementar o formulário**

```tsx
// src/components/questionario/questao-form.tsx
"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { ListaRotulos } from "@/components/questionario/lista-rotulos";
import { atualizarQuestaoAction, criarQuestaoAction } from "@/lib/actions/questionario-questoes";
import { useAction } from "@/lib/hooks/use-action";
import type { GrupoRow, QuestaoDetalhe } from "@/lib/questionario/tipos";
import { QUESTAO_TIPOS, QUESTAO_TIPO_LABEL, type QuestaoTipo } from "@/lib/validation/questionario";

type Props = { grupos: GrupoRow[]; questao?: QuestaoDetalhe };

const ROTULO = "text-sm font-medium text-ink/80";

export function QuestaoForm({ grupos, questao }: Props) {
  const [tipo, setTipo] = useState<QuestaoTipo>(questao?.tipo ?? "subjetiva");
  const [ativa, setAtiva] = useState(questao?.ativa ?? true);
  const [obrigatoria, setObrigatoria] = useState(questao?.obrigatoria ?? false);
  const [limitar, setLimitar] = useState(questao?.limitarCaracteres ?? false);
  const [alternativas, setAlternativas] = useState<string[]>(
    questao && questao.alternativas.length > 0 ? questao.alternativas : ["", ""],
  );

  const salvar = useAction((fd: FormData) => (questao ? atualizarQuestaoAction(fd) : criarQuestaoAction(fd)), {});

  const emUso = questao?.emUso ?? false;
  const subjetiva = tipo === "subjetiva";
  const comAlternativas = tipo === "objetiva_unica" || tipo === "objetiva_multipla";
  const gruposDisponiveis = grupos.filter((g) => g.ativo || g.id === questao?.grupoId);

  function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    salvar.run(new FormData(e.currentTarget));
  }

  return (
    <form onSubmit={enviar}>
      <Panel className="grid gap-5">
        {questao ? <input type="hidden" name="id" value={questao.id} /> : null}
        {/* O select de tipo não tem `name`: o valor vai neste hidden, assim também sai quando o select está travado. */}
        <input type="hidden" name="tipo" value={tipo} />
        <input type="hidden" name="ativa" value={ativa ? "on" : ""} />
        <input type="hidden" name="obrigatoria" value={obrigatoria ? "on" : ""} />
        <input type="hidden" name="limitarCaracteres" value={subjetiva && limitar ? "on" : ""} />

        <div className="grid gap-4 md:grid-cols-2">
          <div className="grid gap-1">
            <label htmlFor="questao-grupo" className={ROTULO}>Grupo *</label>
            <select id="questao-grupo" name="grupoId" required defaultValue={questao?.grupoId ?? ""}>
              <option value="" disabled>Selecione</option>
              {gruposDisponiveis.map((g) => (
                <option key={g.id} value={g.id}>{g.descricao}</option>
              ))}
            </select>
          </div>
          <div className="grid gap-1">
            <label htmlFor="questao-tipo" className={ROTULO}>Tipo de Questão *</label>
            <select
              id="questao-tipo"
              value={tipo}
              disabled={emUso}
              onChange={(e) => setTipo(e.target.value as QuestaoTipo)}
            >
              {QUESTAO_TIPOS.map((t) => (
                <option key={t} value={t}>{QUESTAO_TIPO_LABEL[t]}</option>
              ))}
            </select>
            {emUso ? (
              <p className="text-xs text-ink/60">
                Questão em uso em questionário: o tipo não pode ser trocado.
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap gap-6">
          <Switch checked={ativa} onChange={setAtiva} label="Está ativa" />
          <Switch checked={obrigatoria} onChange={setObrigatoria} label="É obrigatória" />
        </div>

        <div className="grid gap-1">
          <label htmlFor="questao-pergunta" className={ROTULO}>Pergunta *</label>
          <textarea id="questao-pergunta" name="pergunta" required rows={3} defaultValue={questao?.pergunta ?? ""} />
        </div>

        {subjetiva ? (
          <div className="grid gap-4 md:grid-cols-3">
            <Switch checked={limitar} onChange={setLimitar} label="Limitar quantidade de caracteres" />
            <div className="grid gap-1">
              <label htmlFor="questao-caracteres" className={ROTULO}>Qtde. Caracteres</label>
              <input
                id="questao-caracteres"
                name="qtdeCaracteres"
                type="number"
                min={0}
                disabled={!limitar}
                defaultValue={questao?.qtdeCaracteres ?? 0}
              />
            </div>
            <div className="grid gap-1">
              <label htmlFor="questao-linhas" className={ROTULO}>Qtde. Linhas</label>
              <input
                id="questao-linhas"
                name="qtdeLinhas"
                type="number"
                min={0}
                defaultValue={questao?.qtdeLinhas ?? 0}
              />
            </div>
          </div>
        ) : null}

        {comAlternativas ? (
          <ListaRotulos
            nome="alternativas"
            rotulo="Alternativa"
            valores={alternativas}
            onChange={setAlternativas}
            placeholder="Texto da alternativa"
          />
        ) : null}

        {tipo === "matriz_descritiva" ? (
          <p className="text-sm text-ink/60">
            A configuração da matriz descritiva (linhas e colunas) será definida em uma próxima fase.
          </p>
        ) : null}

        <div className="flex justify-end gap-3">
          <Link href="/questionario/questoes" className="ds-button ds-button-secondary">Cancelar</Link>
          <Button type="submit" variant="primary" loading={salvar.pending}>Gravar</Button>
        </div>
      </Panel>
    </form>
  );
}
```

Nota: `Switch` precisa ser um controle associável por label para o teste `getByLabelText(/Limitar quantidade de caracteres/)`; abra `src/components/ui/switch.tsx` e confirme que renderiza um `<label>` envolvendo um input/role=switch clicável. Se o elemento clicável for só um `span role="switch"`, ajuste o teste para `getByRole("switch", { name: /Limitar/ })` (e `fireEvent.click` nele).

- [ ] **Step 8: Lista e páginas**

```tsx
// src/components/questionario/questoes-lista.tsx
"use client";

import Link from "next/link";
import { useState } from "react";
import { Pencil } from "lucide-react";
import { DataTableShell } from "@/components/ui/data-table";
import { SearchInline } from "@/components/ui/search-inline";
import { StatusPill } from "@/components/ui/status-pill";
import { BotaoAtivar } from "@/components/questionario/botao-ativar";
import { alternarAtivoQuestaoAction } from "@/lib/actions/questionario-questoes";
import { normalizarBusca } from "@/lib/questionario/lista";
import type { QuestaoLinha } from "@/lib/questionario/tipos";
import { QUESTAO_TIPO_LABEL } from "@/lib/validation/questionario";

type Props = { questoes: QuestaoLinha[]; podeEditar: boolean };

export function QuestoesLista({ questoes, podeEditar }: Props) {
  const [busca, setBusca] = useState("");
  const termo = normalizarBusca(busca);
  const visiveis = questoes.filter((q) =>
    normalizarBusca(`${QUESTAO_TIPO_LABEL[q.tipo]} ${q.grupoDescricao} ${q.pergunta}`).includes(termo),
  );

  return (
    <DataTableShell
      toolbar={<SearchInline value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Pesquisar" />}
    >
      <table className="ds-dt min-w-[860px]">
        <thead>
          <tr>
            <th className="w-[240px]">Tipo</th>
            <th className="w-[240px]">Grupo</th>
            <th>Pergunta</th>
            <th className="w-[110px]">Situação</th>
            <th className="w-[110px] text-right">Ação</th>
          </tr>
        </thead>
        <tbody>
          {visiveis.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-5 py-10 text-center text-sm text-ink/60">
                Nenhuma questão encontrada.
              </td>
            </tr>
          ) : null}
          {visiveis.map((q) => (
            <tr key={q.id}>
              <td className="pl-4 text-ink">{QUESTAO_TIPO_LABEL[q.tipo]}</td>
              <td className="text-ink/80">{q.grupoDescricao}</td>
              <td className="max-w-[28rem] truncate text-ink" title={q.pergunta}>{q.pergunta}</td>
              <td>
                <StatusPill tone={q.ativa ? "success" : "neutral"}>{q.ativa ? "Ativa" : "Inativa"}</StatusPill>
              </td>
              <td className="pr-4">
                {podeEditar ? (
                  <div className="flex items-center justify-end gap-1">
                    <Link
                      href={`/questionario/questoes/${q.id}/editar`}
                      aria-label={`Editar ${q.pergunta}`}
                      className="rounded-ui p-1.5 text-brand hover:bg-brand/10"
                    >
                      <Pencil size={16} />
                    </Link>
                    <BotaoAtivar acao={alternarAtivoQuestaoAction} id={q.id} ativo={q.ativa} nome={q.pergunta} />
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
// src/app/(app)/questionario/questoes/page.tsx
import { PageHeader } from "@/components/ui/page-header";
import { ButtonLink } from "@/components/ui/button";
import { QuestoesLista } from "@/components/questionario/questoes-lista";
import { requirePermission } from "@/lib/auth/session";
import { listarQuestoes } from "@/lib/data/questionario";
import { podeAcao } from "@/lib/questionario/acesso";

export default async function QuestoesPage() {
  const session = await requirePermission("questionario.questao", "read");
  const questoes = await listarQuestoes();

  return (
    <div className="grid gap-8">
      <PageHeader
        breadcrumb={[{ label: "Acadêmico" }, { label: "Questionário" }, { label: "Cadastro de questão" }]}
        title="Cadastro de Questão"
        counter={String(questoes.length)}
        actions={
          podeAcao(session, "questionario.questao", "create") ? (
            <ButtonLink href="/questionario/questoes/nova" variant="primary">+ Cadastrar</ButtonLink>
          ) : undefined
        }
      />
      <QuestoesLista questoes={questoes} podeEditar={podeAcao(session, "questionario.questao", "update")} />
    </div>
  );
}
```

```tsx
// src/app/(app)/questionario/questoes/nova/page.tsx
import { PageHeader } from "@/components/ui/page-header";
import { QuestaoForm } from "@/components/questionario/questao-form";
import { requirePermission } from "@/lib/auth/session";
import { listarGrupos } from "@/lib/data/questionario";

export default async function NovaQuestaoPage() {
  await requirePermission("questionario.questao", "create");
  const grupos = await listarGrupos();

  return (
    <div className="grid gap-8">
      <PageHeader
        breadcrumb={[
          { label: "Acadêmico" },
          { label: "Questionário" },
          { label: "Cadastro de questão", href: "/questionario/questoes" },
          { label: "Nova" },
        ]}
        title="Cadastro de Questão"
      />
      <QuestaoForm grupos={grupos} />
    </div>
  );
}
```

```tsx
// src/app/(app)/questionario/questoes/[id]/editar/page.tsx
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { QuestaoForm } from "@/components/questionario/questao-form";
import { requirePermission } from "@/lib/auth/session";
import { getQuestao, listarGrupos } from "@/lib/data/questionario";
import { IdSchema } from "@/lib/validation/questionario";

export default async function EditarQuestaoPage({ params }: { params: { id: string } }) {
  await requirePermission("questionario.questao", "update");
  if (!IdSchema.safeParse(params.id).success) notFound();

  const [questao, grupos] = await Promise.all([getQuestao(params.id), listarGrupos()]);
  if (!questao) notFound();

  return (
    <div className="grid gap-8">
      <PageHeader
        breadcrumb={[
          { label: "Acadêmico" },
          { label: "Questionário" },
          { label: "Cadastro de questão", href: "/questionario/questoes" },
          { label: "Editar" },
        ]}
        title="Cadastro de Questão"
      />
      <QuestaoForm grupos={grupos} questao={questao} />
    </div>
  );
}
```

- [ ] **Step 9: Rodar tudo e commit**

Run: `npx vitest run src/lib/actions/questionario-questoes.test.ts src/components/questionario/questao-form.test.tsx && npm run typecheck`
Expected: PASS / limpo.

```bash
git add src/lib/actions/questionario-questoes.ts src/lib/actions/questionario-questoes.test.ts src/components/questionario/questao-form.tsx src/components/questionario/questao-form.test.tsx src/components/questionario/questoes-lista.tsx "src/app/(app)/questionario/questoes"
git commit -m "feat(questionario): cadastro de questao com alternativas e trava de tipo em uso" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Cadastro de Questionário (vínculos, clonar)

**Files:**
- Create: `src/lib/actions/questionario-questionarios.ts`, `src/lib/actions/questionario-questionarios.test.ts`
- Create: `src/components/questionario/questionario-form.tsx`, `src/components/questionario/questionario-form.test.tsx`
- Create: `src/components/questionario/questionarios-lista.tsx`
- Create: `src/app/(app)/questionario/questionarios/page.tsx`, `.../novo/page.tsx`, `.../[id]/editar/page.tsx`

**Interfaces:**
- Consumes: `QuestionarioSchema`, `IdSchema`, `QUESTAO_TIPO_LABEL` (T2); `normalizarVinculos`, `diffVinculos`, `questoesParaAdicionar`, `QuestaoInfo` (T2); `montarClone` (T2); `moverItem`, `lerTexto`, `normalizarBusca` (T2); `alternarAtivo`, `listarQuestionarios`, `getQuestionario`, `listarQuestoes`, `listarEscalas`, `listarGrupos`, `podeAcao`, `BotaoAtivar`, tipos (T3); `formBoolean`.
- Produces: `criarQuestionarioAction`, `atualizarQuestionarioAction`, `alternarAtivoQuestionarioAction`, `clonarQuestionarioAction`; campos de form `id`, `descricao`, `observacoes`, `ativo` ("on"), `vinculos` (JSON `[{id?, questaoId, escalaId}]` na ordem exibida); `redirectTo` das gravações = `/questionario/questionarios`; clonar → `/questionario/questionarios/<novoId>/editar`.

- [ ] **Step 1: Teste das actions (falha)**

```ts
// src/lib/actions/questionario-questionarios.test.ts
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
  alternarAtivoQuestionarioAction,
  atualizarQuestionarioAction,
  clonarQuestionarioAction,
  criarQuestionarioAction,
} from "./questionario-questionarios";

const U = (n: number) => `${String(n).repeat(8)}-${String(n).repeat(4)}-4${String(n).repeat(3)}-8${String(n).repeat(3)}-${String(n).repeat(12)}`;
const Q1 = U(1), Q2 = U(2), Q3 = U(3), E1 = U(4), QQ = U(5), V1 = U(6), V2 = U(7);

const questoes = {
  "questoes.select": [
    {
      data: [
        { id: Q1, tipo: "subjetiva", pergunta: "P1", ativa: true },
        { id: Q2, tipo: "objetiva_escala", pergunta: "P2", ativa: true },
      ],
    },
  ],
};

const form = (vinculos: unknown, extra: Record<string, string> = {}) =>
  formData({ descricao: "Quadro Infantil 3", observacoes: "", ativo: "on", vinculos: JSON.stringify(vinculos), ...extra });

beforeEach(() => {
  h.requirePermission.mockReset().mockResolvedValue({ profile: { escola_id: "escola-1" } });
  h.revalidatePath.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("criarQuestionarioAction", () => {
  it("grava questionário e vínculos numerados, escala só na questão de escala", async () => {
    const db = fakeSupabase({ ...questoes, "questionarios.insert": [{ data: { id: QQ } }] });
    h.client = db.client;

    const r = await criarQuestionarioAction(
      form([{ questaoId: Q1, escalaId: E1 }, { questaoId: Q2, escalaId: E1 }]),
    );

    expect(h.requirePermission).toHaveBeenCalledWith("questionario.questionario", "create");
    expect(r).toEqual({
      ok: true,
      message: "Questionário cadastrado.",
      redirectTo: "/questionario/questionarios",
    });
    expect(db.chamadas("questionarios", "insert")[0].payload).toEqual({
      escola_id: "escola-1", descricao: "Quadro Infantil 3", observacoes: null, ativo: true,
    });
    expect(db.chamadas("questionario_questoes", "insert")[0].payload).toEqual([
      { questionario_id: QQ, questao_id: Q1, escala_id: null, ordem: 1 },
      { questionario_id: QQ, questao_id: Q2, escala_id: E1, ordem: 2 },
    ]);
  });

  it("recusa questão com escala sem escala escolhida, sem gravar nada", async () => {
    const db = fakeSupabase(questoes);
    h.client = db.client;
    const r = await criarQuestionarioAction(form([{ questaoId: Q2, escalaId: null }]));
    expect(r).toEqual({ ok: false, error: 'Escolha a escala da questão "P2".' });
    expect(db.chamadas("questionarios", "insert")).toHaveLength(0);
  });

  it("recusa questão inativa em novo vínculo", async () => {
    const db = fakeSupabase({
      "questoes.select": [{ data: [{ id: Q1, tipo: "subjetiva", pergunta: "P1", ativa: false }] }],
    });
    h.client = db.client;
    const r = await criarQuestionarioAction(form([{ questaoId: Q1, escalaId: null }]));
    expect(r).toEqual({ ok: false, error: 'A questão "P1" está inativa.' });
    expect(db.chamadas("questionarios", "insert")).toHaveLength(0);
  });

  it("recusa JSON de vínculos quebrado", async () => {
    const db = fakeSupabase();
    h.client = db.client;
    const r = await criarQuestionarioAction(form([], { vinculos: "{nao-json" }));
    expect(r).toEqual({ ok: false, error: "Lista de questões inválida." });
    expect(db.calls).toHaveLength(0);
  });

  it("aceita questionário sem questões (rascunho)", async () => {
    const db = fakeSupabase({ "questionarios.insert": [{ data: { id: QQ } }] });
    h.client = db.client;
    const r = await criarQuestionarioAction(form([]));
    expect(r).toMatchObject({ ok: true });
    expect(db.chamadas("questionario_questoes", "insert")).toHaveLength(0);
  });

  it("se os vínculos falham, apaga o questionário recém-criado (sem órfão)", async () => {
    const db = fakeSupabase({
      ...questoes,
      "questionarios.insert": [{ data: { id: QQ } }],
      "questionario_questoes.insert": [{ error: { message: "boom" } }],
    });
    h.client = db.client;
    await expect(criarQuestionarioAction(form([{ questaoId: Q1, escalaId: null }]))).rejects.toThrow();
    expect(db.chamadas("questionarios", "delete")[0].filtros).toContainEqual(["eq", "id", QQ]);
  });
});

describe("atualizarQuestionarioAction", () => {
  it("remove, atualiza (upsert por id) e insere — nessa ordem, preservando ids existentes", async () => {
    const db = fakeSupabase({
      "questoes.select": [
        {
          data: [
            { id: Q1, tipo: "subjetiva", pergunta: "P1", ativa: true },
            { id: Q3, tipo: "subjetiva", pergunta: "P3", ativa: true },
          ],
        },
      ],
      "questionario_questoes.select": [
        { data: [{ id: V1, questao_id: Q1 }, { id: V2, questao_id: Q2 }] },
      ],
    });
    h.client = db.client;

    const r = await atualizarQuestionarioAction(
      form([{ id: V1, questaoId: Q1, escalaId: null }, { questaoId: Q3, escalaId: null }], { id: QQ }),
    );

    expect(h.requirePermission).toHaveBeenCalledWith("questionario.questionario", "update");
    expect(r).toMatchObject({ ok: true, redirectTo: "/questionario/questionarios" });
    expect(db.calls.filter((c) => c.table === "questionario_questoes").map((c) => c.op)).toEqual([
      "select", "delete", "upsert", "insert",
    ]);
    expect(db.chamadas("questionario_questoes", "delete")[0].filtros).toContainEqual(["in", "id", [V2]]);
    expect(db.chamadas("questionario_questoes", "upsert")[0].payload).toEqual([
      { id: V1, questionario_id: QQ, questao_id: Q1, escala_id: null, ordem: 1 },
    ]);
    expect(db.chamadas("questionario_questoes", "insert")[0].payload).toEqual([
      { questionario_id: QQ, questao_id: Q3, escala_id: null, ordem: 2 },
    ]);
  });

  it("vínculo antigo com questão inativa continua salvando", async () => {
    const db = fakeSupabase({
      "questoes.select": [{ data: [{ id: Q1, tipo: "subjetiva", pergunta: "P1", ativa: false }] }],
      "questionario_questoes.select": [{ data: [{ id: V1, questao_id: Q1 }] }],
    });
    h.client = db.client;
    const r = await atualizarQuestionarioAction(form([{ id: V1, questaoId: Q1, escalaId: null }], { id: QQ }));
    expect(r).toMatchObject({ ok: true });
  });

  it("questão inativa em NOVO vínculo é recusada antes de gravar", async () => {
    const db = fakeSupabase({
      "questoes.select": [{ data: [{ id: Q3, tipo: "subjetiva", pergunta: "P3", ativa: false }] }],
      "questionario_questoes.select": [{ data: [] }],
    });
    h.client = db.client;
    const r = await atualizarQuestionarioAction(form([{ questaoId: Q3, escalaId: null }], { id: QQ }));
    expect(r).toEqual({ ok: false, error: 'A questão "P3" está inativa.' });
    expect(db.chamadas("questionarios", "update")).toHaveLength(0);
    expect(db.chamadas("questionario_questoes", "insert")).toHaveLength(0);
  });
});

describe("alternarAtivoQuestionarioAction", () => {
  it("inativa sem apagar", async () => {
    const db = fakeSupabase();
    h.client = db.client;
    await alternarAtivoQuestionarioAction(formData({ id: QQ, ativo: "false" }));
    expect(db.chamadas("questionarios", "update")[0].payload).toEqual({ ativo: false });
    expect(db.chamadas("questionarios", "delete")).toHaveLength(0);
  });
});

describe("clonarQuestionarioAction", () => {
  const origem = {
    "questionarios.select": [{ data: { descricao: "Infantil 3", observacoes: "obs" } }],
    "questionario_questoes.select": [
      { data: [{ questao_id: Q2, escala_id: E1, ordem: 2 }, { questao_id: Q1, escala_id: null, ordem: 1 }] },
    ],
    "questionarios.insert": [{ data: { id: QQ } }],
  };

  it("cria cópia inativa com os vínculos e manda abrir a edição", async () => {
    const db = fakeSupabase(origem);
    h.client = db.client;

    const r = await clonarQuestionarioAction(formData({ id: V1 }));

    expect(h.requirePermission).toHaveBeenCalledWith("questionario.questionario", "create");
    expect(r).toMatchObject({ ok: true, redirectTo: `/questionario/questionarios/${QQ}/editar` });
    expect(db.chamadas("questionarios", "insert")[0].payload).toEqual({
      escola_id: "escola-1", descricao: "Infantil 3 (cópia)", observacoes: "obs", ativo: false,
    });
    expect(db.chamadas("questionario_questoes", "insert")[0].payload).toEqual([
      { questionario_id: QQ, questao_id: Q1, escala_id: null, ordem: 1 },
      { questionario_id: QQ, questao_id: Q2, escala_id: E1, ordem: 2 },
    ]);
  });

  it("clona questionário vazio sem inserir vínculos", async () => {
    const db = fakeSupabase({ ...origem, "questionario_questoes.select": [{ data: [] }] });
    h.client = db.client;
    const r = await clonarQuestionarioAction(formData({ id: V1 }));
    expect(r).toMatchObject({ ok: true });
    expect(db.chamadas("questionario_questoes", "insert")).toHaveLength(0);
  });

  it("origem inexistente", async () => {
    h.client = fakeSupabase({ "questionarios.select": [{ data: null }] }).client;
    const r = await clonarQuestionarioAction(formData({ id: V1 }));
    expect(r).toEqual({ ok: false, error: "Questionário não encontrado." });
  });

  it("se os vínculos da cópia falham, apaga a cópia (sem órfã)", async () => {
    const db = fakeSupabase({ ...origem, "questionario_questoes.insert": [{ error: { message: "boom" } }] });
    h.client = db.client;
    await expect(clonarQuestionarioAction(formData({ id: V1 }))).rejects.toThrow();
    expect(db.chamadas("questionarios", "delete")[0].filtros).toContainEqual(["eq", "id", QQ]);
  });
});
```

Atenção ao helper `U(n)`: gera UUID de formato válido para `z.string().uuid()` (ex.: `11111111-1111-4111-8111-111111111111`). Os valores `Q1..V2` usam n=1..7, todos distintos.

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/actions/questionario-questionarios.test.ts`
Expected: FAIL (módulo inexistente).

- [ ] **Step 3: Implementar as actions**

```ts
// src/lib/actions/questionario-questionarios.ts
"use server";

import { revalidatePath } from "next/cache";
import { assertOk } from "@/lib/actions/assert-ok";
import { requirePermission } from "@/lib/auth/session";
import { createServerClient } from "@/lib/supabase/server";
import { alternarAtivo } from "@/lib/questionario/ativo";
import { montarClone } from "@/lib/questionario/clone";
import { lerTexto } from "@/lib/questionario/lista";
import { primeiroErro, type ActionResult } from "@/lib/questionario/tipos";
import {
  diffVinculos,
  normalizarVinculos,
  type QuestaoInfo,
  type VinculoNormalizado,
} from "@/lib/questionario/vinculos";
import { formBoolean } from "@/lib/utils";
import { IdSchema, QuestionarioSchema, type QuestaoTipo } from "@/lib/validation/questionario";

const ROTA = "/questionario/questionarios";

type Cliente = Awaited<ReturnType<typeof createServerClient>>;

type Lido =
  | { ok: false; error: string }
  | {
      ok: true;
      dados: { descricao: string; observacoes: string | null; ativo: boolean };
      vinculos: VinculoNormalizado[];
      questoes: Map<string, QuestaoInfo>;
    };

/** Lê o form, valida o schema e cruza os vínculos com as questões reais do banco. */
async function lerQuestionario(db: Cliente, formData: FormData): Promise<Lido> {
  let bruto: unknown;
  try {
    bruto = JSON.parse(lerTexto(formData, "vinculos") || "[]");
  } catch {
    return { ok: false, error: "Lista de questões inválida." };
  }

  const parsed = QuestionarioSchema.safeParse({
    descricao: lerTexto(formData, "descricao"),
    observacoes: lerTexto(formData, "observacoes"),
    ativo: formBoolean(formData, "ativo"),
    vinculos: bruto,
  });
  if (!parsed.success) return { ok: false, error: primeiroErro(parsed.error) };

  const ids = parsed.data.vinculos.map((v) => v.questaoId);
  const linhas =
    ids.length === 0
      ? []
      : (assertOk(
          await db.from("questoes").select("id, tipo, pergunta, ativa").in("id", ids),
          "Não foi possível ler as questões",
        ) as Array<{ id: string; tipo: QuestaoTipo; pergunta: string; ativa: boolean }> | null) ?? [];
  const questoes = new Map<string, QuestaoInfo>(
    linhas.map((q) => [q.id, { tipo: q.tipo, pergunta: q.pergunta, ativa: q.ativa }]),
  );

  const normalizados = normalizarVinculos(parsed.data.vinculos, questoes);
  if (!normalizados.ok) return normalizados;

  const { vinculos: _descartado, ...dados } = parsed.data;
  return { ok: true, dados, vinculos: normalizados.vinculos, questoes };
}

/** Só vínculos NOVOS precisam de questão ativa (questão inativada depois continua nos antigos). */
function questaoInativaEm(novos: VinculoNormalizado[], questoes: Map<string, QuestaoInfo>): string | null {
  for (const v of novos) {
    const info = questoes.get(v.questaoId);
    if (info && !info.ativa) return `A questão "${info.pergunta}" está inativa.`;
  }
  return null;
}

const linhaDe = (questionarioId: string, v: VinculoNormalizado) => ({
  questionario_id: questionarioId,
  questao_id: v.questaoId,
  escala_id: v.escalaId,
  ordem: v.ordem,
});

export async function criarQuestionarioAction(formData: FormData): Promise<ActionResult> {
  const session = await requirePermission("questionario.questionario", "create");
  const db = await createServerClient();
  const lido = await lerQuestionario(db, formData);
  if (!lido.ok) return lido;
  const inativa = questaoInativaEm(lido.vinculos, lido.questoes);
  if (inativa) return { ok: false, error: inativa };

  const novo = assertOk(
    await db
      .from("questionarios")
      .insert({ escola_id: session.profile.escola_id, ...lido.dados })
      .select("id")
      .single(),
    "Não foi possível cadastrar o questionário",
  ) as { id: string };

  if (lido.vinculos.length > 0) {
    try {
      assertOk(
        await db.from("questionario_questoes").insert(lido.vinculos.map((v) => linhaDe(novo.id, v))),
        "Não foi possível salvar as questões do questionário",
      );
    } catch (erro) {
      await db.from("questionarios").delete().eq("id", novo.id);
      throw erro;
    }
  }

  revalidatePath(ROTA);
  return { ok: true, message: "Questionário cadastrado.", redirectTo: ROTA };
}

export async function atualizarQuestionarioAction(formData: FormData): Promise<ActionResult> {
  const session = await requirePermission("questionario.questionario", "update");
  const id = IdSchema.safeParse(lerTexto(formData, "id"));
  if (!id.success) return { ok: false, error: primeiroErro(id.error) };

  const db = await createServerClient();
  const lido = await lerQuestionario(db, formData);
  if (!lido.ok) return lido;

  const atuais = (assertOk(
    await db.from("questionario_questoes").select("id, questao_id").eq("questionario_id", id.data),
    "Não foi possível ler as questões do questionário",
  ) as Array<{ id: string; questao_id: string }> | null) ?? [];
  const diff = diffVinculos(
    atuais.map((a) => ({ id: a.id, questaoId: a.questao_id })),
    lido.vinculos,
  );

  const inativa = questaoInativaEm(diff.inserir, lido.questoes);
  if (inativa) return { ok: false, error: inativa };

  assertOk(
    await db
      .from("questionarios")
      .update(lido.dados)
      .eq("id", id.data)
      .eq("escola_id", session.profile.escola_id),
    "Não foi possível salvar o questionário",
  );

  // Ordem importa: remover primeiro libera a unicidade (questionario, questao) para quem sai e volta.
  if (diff.remover.length > 0) {
    assertOk(
      await db.from("questionario_questoes").delete().in("id", diff.remover),
      "Não foi possível remover questões do questionário",
    );
  }
  if (diff.atualizar.length > 0) {
    assertOk(
      await db
        .from("questionario_questoes")
        .upsert(diff.atualizar.map((v) => ({ id: v.id, ...linhaDe(id.data, v) })), { onConflict: "id" }),
      "Não foi possível atualizar as questões do questionário",
    );
  }
  if (diff.inserir.length > 0) {
    assertOk(
      await db.from("questionario_questoes").insert(diff.inserir.map((v) => linhaDe(id.data, v))),
      "Não foi possível adicionar questões ao questionário",
    );
  }

  revalidatePath(ROTA);
  return { ok: true, message: "Questionário atualizado.", redirectTo: ROTA };
}

export async function alternarAtivoQuestionarioAction(formData: FormData): Promise<ActionResult> {
  const session = await requirePermission("questionario.questionario", "update");
  const resultado = await alternarAtivo(formData, "questionarios", session.profile.escola_id);
  if (resultado.ok) revalidatePath(ROTA);
  return resultado;
}

export async function clonarQuestionarioAction(formData: FormData): Promise<ActionResult> {
  const session = await requirePermission("questionario.questionario", "create");
  const id = IdSchema.safeParse(lerTexto(formData, "id"));
  if (!id.success) return { ok: false, error: primeiroErro(id.error) };

  const db = await createServerClient();
  const origem = assertOk(
    await db
      .from("questionarios")
      .select("descricao, observacoes")
      .eq("id", id.data)
      .eq("escola_id", session.profile.escola_id)
      .maybeSingle(),
    "Não foi possível ler o questionário",
  ) as { descricao: string; observacoes: string | null } | null;
  if (!origem) return { ok: false, error: "Questionário não encontrado." };

  const vinculos = (assertOk(
    await db
      .from("questionario_questoes")
      .select("questao_id, escala_id, ordem")
      .eq("questionario_id", id.data)
      .order("ordem"),
    "Não foi possível ler as questões do questionário",
  ) as Array<{ questao_id: string; escala_id: string | null; ordem: number }> | null) ?? [];

  const clone = montarClone(origem, vinculos);
  const novo = assertOk(
    await db
      .from("questionarios")
      .insert({ escola_id: session.profile.escola_id, ...clone.questionario })
      .select("id")
      .single(),
    "Não foi possível clonar o questionário",
  ) as { id: string };

  if (clone.vinculos.length > 0) {
    try {
      assertOk(
        await db
          .from("questionario_questoes")
          .insert(clone.vinculos.map((v) => ({ questionario_id: novo.id, ...v }))),
        "Não foi possível copiar as questões",
      );
    } catch (erro) {
      await db.from("questionarios").delete().eq("id", novo.id);
      throw erro;
    }
  }

  revalidatePath(ROTA);
  return {
    ok: true,
    message: "Questionário clonado (inativo). Revise e ative.",
    redirectTo: `${ROTA}/${novo.id}/editar`,
  };
}
```

Nota: o teste "origem inexistente" e os de clone passam `formData({ id: V1 })` — `V1` é só um uuid válido qualquer; o `eq("id", ...)` do fake não filtra.

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/actions/questionario-questionarios.test.ts`
Expected: PASS (15 testes). Se `const { vinculos: _descartado, ...dados }` gerar aviso de lint por variável não usada, trocar por `const dados = { descricao: parsed.data.descricao, observacoes: parsed.data.observacoes, ativo: parsed.data.ativo };`.

- [ ] **Step 5: Teste do formulário (falha)**

```tsx
// src/components/questionario/questionario-form.test.tsx
// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";

const h = vi.hoisted(() => ({ criar: vi.fn(), atualizar: vi.fn() }));
vi.mock("@/lib/actions/questionario-questionarios", () => ({
  criarQuestionarioAction: h.criar,
  atualizarQuestionarioAction: h.atualizar,
}));
vi.mock("@/lib/hooks/use-action", () => ({
  useAction: (fn: (...a: unknown[]) => unknown) => ({
    run: (...a: unknown[]) => void fn(...a),
    pending: false,
  }),
}));

import { QuestionarioForm } from "./questionario-form";
import type { EscalaRow, GrupoRow, QuestaoLinha } from "@/lib/questionario/tipos";

const GRUPOS: GrupoRow[] = [
  { id: "g1", codigo: 1, descricao: "O EU", ativo: true },
  { id: "g2", codigo: 2, descricao: "CORPO", ativo: true },
];
const QUESTOES: QuestaoLinha[] = [
  { id: "q1", tipo: "subjetiva", pergunta: "Compartilha?", ativa: true, grupoId: "g1", grupoDescricao: "O EU" },
  { id: "q2", tipo: "objetiva_escala", pergunta: "Respeita regras?", ativa: true, grupoId: "g1", grupoDescricao: "O EU" },
  { id: "q3", tipo: "objetiva_escala", pergunta: "Desloca o corpo?", ativa: true, grupoId: "g2", grupoDescricao: "CORPO" },
  { id: "q4", tipo: "subjetiva", pergunta: "Inativa", ativa: false, grupoId: "g2", grupoDescricao: "CORPO" },
];
const ESCALAS: EscalaRow[] = [{ id: "e1", descricao: "Desenv.", ativo: true, opcoes: ["A", "B"] }];

const perguntasNaTabela = () =>
  screen.getAllByTestId("linha-vinculo").map((tr) => within(tr).getByTestId("pergunta").textContent);

function renderForm() {
  return render(<QuestionarioForm grupos={GRUPOS} questoes={QUESTOES} escalas={ESCALAS} />);
}

describe("QuestionarioForm", () => {
  it("'Todos' de um grupo adiciona todas as questões ativas do grupo (e só uma vez)", () => {
    renderForm();
    fireEvent.change(screen.getByLabelText("Grupo"), { target: { value: "g1" } });
    fireEvent.click(screen.getByRole("button", { name: /adicionar/i }));
    expect(perguntasNaTabela()).toEqual(["Compartilha?", "Respeita regras?"]);

    fireEvent.click(screen.getByRole("button", { name: /adicionar/i }));
    expect(perguntasNaTabela()).toHaveLength(2);
  });

  it("não oferece questão inativa", () => {
    renderForm();
    expect(screen.queryByRole("option", { name: "Inativa" })).not.toBeInTheDocument();
  });

  it("escala só aparece para questão objetiva com escala", () => {
    renderForm();
    fireEvent.change(screen.getByLabelText("Grupo"), { target: { value: "g1" } });
    fireEvent.click(screen.getByRole("button", { name: /adicionar/i }));
    expect(screen.queryByLabelText("Escala de Compartilha?")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Escala de Respeita regras?")).toBeInTheDocument();
  });

  it("reordena e remove", () => {
    renderForm();
    fireEvent.change(screen.getByLabelText("Grupo"), { target: { value: "g1" } });
    fireEvent.click(screen.getByRole("button", { name: /adicionar/i }));
    fireEvent.click(screen.getByRole("button", { name: "Descer Compartilha?" }));
    expect(perguntasNaTabela()).toEqual(["Respeita regras?", "Compartilha?"]);
    fireEvent.click(screen.getByRole("button", { name: "Remover Respeita regras?" }));
    expect(perguntasNaTabela()).toEqual(["Compartilha?"]);
  });

  it("envia vínculos em JSON na ordem exibida, com a escala escolhida", () => {
    h.criar.mockResolvedValue({ ok: true });
    renderForm();
    fireEvent.change(screen.getByLabelText(/Descrição/), { target: { value: "Quadro" } });
    fireEvent.change(screen.getByLabelText("Grupo"), { target: { value: "g1" } });
    fireEvent.click(screen.getByRole("button", { name: /adicionar/i }));
    fireEvent.change(screen.getByLabelText("Escala de Respeita regras?"), { target: { value: "e1" } });
    fireEvent.submit(screen.getByRole("button", { name: /gravar/i }).closest("form")!);

    const fd = h.criar.mock.calls[0][0] as FormData;
    expect(fd.get("descricao")).toBe("Quadro");
    expect(JSON.parse(String(fd.get("vinculos")))).toEqual([
      { questaoId: "q1", escalaId: null },
      { questaoId: "q2", escalaId: "e1" },
    ]);
    expect(fd.get("id")).toBeNull();
  });

  it("na edição, carrega os vínculos existentes com seus ids", () => {
    h.atualizar.mockResolvedValue({ ok: true });
    render(
      <QuestionarioForm
        grupos={GRUPOS}
        questoes={QUESTOES}
        escalas={ESCALAS}
        questionario={{
          id: "qq", descricao: "Existente", observacoes: null, ativo: true,
          vinculos: [{ id: "v1", questaoId: "q3", escalaId: "e1" }],
        }}
      />,
    );
    expect(perguntasNaTabela()).toEqual(["Desloca o corpo?"]);
    fireEvent.submit(screen.getByRole("button", { name: /gravar/i }).closest("form")!);
    const fd = h.atualizar.mock.calls[0][0] as FormData;
    expect(fd.get("id")).toBe("qq");
    expect(JSON.parse(String(fd.get("vinculos")))).toEqual([{ id: "v1", questaoId: "q3", escalaId: "e1" }]);
  });
});
```

- [ ] **Step 6: Rodar e ver falhar**

Run: `npx vitest run src/components/questionario/questionario-form.test.tsx`
Expected: FAIL (`./questionario-form` não existe).

- [ ] **Step 7: Implementar o formulário**

```tsx
// src/components/questionario/questionario-form.tsx
"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { StatusPill } from "@/components/ui/status-pill";
import {
  atualizarQuestionarioAction,
  criarQuestionarioAction,
} from "@/lib/actions/questionario-questionarios";
import { useAction } from "@/lib/hooks/use-action";
import { moverItem } from "@/lib/questionario/lista";
import type { EscalaRow, GrupoRow, QuestaoLinha, QuestionarioDetalhe } from "@/lib/questionario/tipos";
import { questoesParaAdicionar, type VinculoInput } from "@/lib/questionario/vinculos";
import { QUESTAO_TIPO_LABEL } from "@/lib/validation/questionario";

type Props = {
  grupos: GrupoRow[];
  questoes: QuestaoLinha[];
  escalas: EscalaRow[];
  questionario?: QuestionarioDetalhe;
};

const ROTULO = "text-sm font-medium text-ink/80";
const BOTAO_ICONE = "rounded-ui p-1.5 text-ink/70 hover:bg-muted disabled:opacity-30 disabled:hover:bg-transparent";

export function QuestionarioForm({ grupos, questoes, escalas, questionario }: Props) {
  const [ativo, setAtivo] = useState(questionario?.ativo ?? true);
  const [linhas, setLinhas] = useState<VinculoInput[]>(
    questionario?.vinculos.map((v) => ({ id: v.id, questaoId: v.questaoId, escalaId: v.escalaId })) ?? [],
  );
  const [filtroGrupo, setFiltroGrupo] = useState("");
  const [filtroQuestao, setFiltroQuestao] = useState("");

  const salvar = useAction(
    (fd: FormData) => (questionario ? atualizarQuestionarioAction(fd) : criarQuestionarioAction(fd)),
    {},
  );

  const questaoPorId = new Map(questoes.map((q) => [q.id, q]));
  const ativas = questoes.filter((q) => q.ativa);
  const opcoesQuestao = ativas.filter((q) => !filtroGrupo || q.grupoId === filtroGrupo);
  const jaAdicionadas = new Set(linhas.map((l) => l.questaoId));
  const gruposAtivos = grupos.filter((g) => g.ativo);

  function adicionar() {
    const novos = questoesParaAdicionar(ativas, jaAdicionadas, filtroGrupo || null, filtroQuestao || null);
    if (novos.length === 0) return;
    setLinhas([...linhas, ...novos.map((questaoId) => ({ questaoId, escalaId: null }))]);
    setFiltroQuestao("");
  }

  function definirEscala(indice: number, escalaId: string) {
    setLinhas(linhas.map((l, i) => (i === indice ? { ...l, escalaId: escalaId || null } : l)));
  }

  function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("vinculos", JSON.stringify(linhas));
    salvar.run(fd);
  }

  return (
    <form onSubmit={enviar}>
      <Panel className="grid gap-5">
        {questionario ? <input type="hidden" name="id" value={questionario.id} /> : null}
        <input type="hidden" name="ativo" value={ativo ? "on" : ""} />

        <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
          <div className="grid gap-1">
            <label htmlFor="questionario-descricao" className={ROTULO}>Descrição *</label>
            <input id="questionario-descricao" name="descricao" required defaultValue={questionario?.descricao ?? ""} />
          </div>
          <Switch checked={ativo} onChange={setAtivo} label="Ativo" />
        </div>

        <div className="grid gap-1">
          <label htmlFor="questionario-obs" className={ROTULO}>Observações</label>
          <textarea id="questionario-obs" name="observacoes" rows={2} defaultValue={questionario?.observacoes ?? ""} />
        </div>

        <fieldset className="grid gap-4 border-t border-line pt-5">
          <legend className="pr-2 text-sm font-semibold text-brand">Questões adicionadas</legend>

          <div className="grid gap-3 md:grid-cols-[1fr_2fr_auto] md:items-end">
            <div className="grid gap-1">
              <label htmlFor="filtro-grupo" className={ROTULO}>Grupo</label>
              <select
                id="filtro-grupo"
                value={filtroGrupo}
                onChange={(e) => {
                  setFiltroGrupo(e.target.value);
                  setFiltroQuestao("");
                }}
              >
                <option value="">Todos</option>
                {gruposAtivos.map((g) => (
                  <option key={g.id} value={g.id}>{g.descricao}</option>
                ))}
              </select>
            </div>
            <div className="grid gap-1">
              <label htmlFor="filtro-questao" className={ROTULO}>Questão</label>
              <select id="filtro-questao" value={filtroQuestao} onChange={(e) => setFiltroQuestao(e.target.value)}>
                <option value="">Todos</option>
                {opcoesQuestao.map((q) => (
                  <option key={q.id} value={q.id} disabled={jaAdicionadas.has(q.id)}>{q.pergunta}</option>
                ))}
              </select>
            </div>
            <Button type="button" variant="secondary" onClick={adicionar}>
              <Plus size={14} /> Adicionar
            </Button>
          </div>

          <div className="overflow-x-auto rounded-panel border border-line">
            <table className="ds-dt min-w-[820px]">
              <thead>
                <tr>
                  <th>Grupo</th>
                  <th>Tipo</th>
                  <th>Questão</th>
                  <th className="w-[220px]">Escala</th>
                  <th className="w-[130px] text-right">Ação</th>
                </tr>
              </thead>
              <tbody>
                {linhas.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-8 text-center text-sm text-ink/60">
                      Não há nada para mostrar aqui
                    </td>
                  </tr>
                ) : null}
                {linhas.map((linha, i) => {
                  const q = questaoPorId.get(linha.questaoId);
                  if (!q) return null;
                  return (
                    <tr key={linha.questaoId} data-testid="linha-vinculo">
                      <td className="pl-4 text-ink/80">{q.grupoDescricao}</td>
                      <td className="text-ink/80">{QUESTAO_TIPO_LABEL[q.tipo]}</td>
                      <td className="text-ink">
                        <span data-testid="pergunta">{q.pergunta}</span>
                        {!q.ativa ? <StatusPill tone="neutral" className="ml-2">Inativa</StatusPill> : null}
                      </td>
                      <td>
                        {q.tipo === "objetiva_escala" ? (
                          <select
                            aria-label={`Escala de ${q.pergunta}`}
                            value={linha.escalaId ?? ""}
                            onChange={(e) => definirEscala(i, e.target.value)}
                          >
                            <option value="">Selecione</option>
                            {escalas
                              .filter((e) => e.ativo || e.id === linha.escalaId)
                              .map((e) => (
                                <option key={e.id} value={e.id}>{e.descricao}</option>
                              ))}
                          </select>
                        ) : (
                          <span className="text-ink/40">—</span>
                        )}
                      </td>
                      <td className="pr-4">
                        <div className="flex items-center justify-end">
                          <button type="button" className={BOTAO_ICONE} disabled={i === 0}
                            aria-label={`Subir ${q.pergunta}`}
                            onClick={() => setLinhas(moverItem(linhas, i, i - 1))}>
                            <ArrowUp size={14} />
                          </button>
                          <button type="button" className={BOTAO_ICONE} disabled={i === linhas.length - 1}
                            aria-label={`Descer ${q.pergunta}`}
                            onClick={() => setLinhas(moverItem(linhas, i, i + 1))}>
                            <ArrowDown size={14} />
                          </button>
                          <button type="button" className={BOTAO_ICONE}
                            aria-label={`Remover ${q.pergunta}`}
                            onClick={() => setLinhas(linhas.filter((_, j) => j !== i))}>
                            <X size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </fieldset>

        <div className="flex justify-end gap-3">
          <Link href="/questionario/questionarios" className="ds-button ds-button-secondary">Cancelar</Link>
          <Button type="submit" variant="primary" loading={salvar.pending}>Gravar</Button>
        </div>
      </Panel>
    </form>
  );
}
```

Nota: o botão "Adicionar" tem rótulo "Adicionar" com ícone; o teste usa `getByRole("button", { name: /adicionar/i })` — como `ListaRotulos` não está nesta tela, só existe um botão com esse nome. `getByLabelText("Grupo")` precisa casar só o label exato "Grupo" (o de filtro); os `<th>Grupo</th>` não são labels, então não conflitam.

- [ ] **Step 8: Lista e páginas**

```tsx
// src/components/questionario/questionarios-lista.tsx
"use client";

import Link from "next/link";
import { useState } from "react";
import { Copy, Pencil } from "lucide-react";
import { DataTableShell } from "@/components/ui/data-table";
import { SearchInline } from "@/components/ui/search-inline";
import { StatusPill } from "@/components/ui/status-pill";
import { BotaoAtivar } from "@/components/questionario/botao-ativar";
import {
  alternarAtivoQuestionarioAction,
  clonarQuestionarioAction,
} from "@/lib/actions/questionario-questionarios";
import { useAction } from "@/lib/hooks/use-action";
import { normalizarBusca } from "@/lib/questionario/lista";
import type { QuestionarioRow } from "@/lib/questionario/tipos";

function BotaoClonar({ id, descricao }: { id: string; descricao: string }) {
  const { run, pending } = useAction((fd: FormData) => clonarQuestionarioAction(fd), {
    confirm: {
      title: "Clonar questionário",
      message: `Criar uma cópia inativa de "${descricao}", com as mesmas questões e escalas?`,
      confirmLabel: "Clonar",
      variant: "default",
    },
  });
  return (
    <button
      type="button"
      disabled={pending}
      aria-label={`Clonar ${descricao}`}
      title="Clonar"
      onClick={() => {
        const fd = new FormData();
        fd.set("id", id);
        run(fd);
      }}
      className="rounded-ui p-1.5 text-ink/70 hover:bg-muted"
    >
      <Copy size={16} />
    </button>
  );
}

type Props = { questionarios: QuestionarioRow[]; podeCriar: boolean; podeEditar: boolean };

export function QuestionariosLista({ questionarios, podeCriar, podeEditar }: Props) {
  const [busca, setBusca] = useState("");
  const termo = normalizarBusca(busca);
  const visiveis = questionarios.filter((q) => normalizarBusca(q.descricao).includes(termo));

  return (
    <DataTableShell
      toolbar={<SearchInline value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Pesquisar" />}
    >
      <table className="ds-dt min-w-[640px]">
        <thead>
          <tr>
            <th>Descrição</th>
            <th className="w-[130px]">Situação</th>
            <th className="w-[150px] text-right">Ação</th>
          </tr>
        </thead>
        <tbody>
          {visiveis.length === 0 ? (
            <tr>
              <td colSpan={3} className="px-5 py-10 text-center text-sm text-ink/60">
                Nenhum questionário encontrado.
              </td>
            </tr>
          ) : null}
          {visiveis.map((q) => (
            <tr key={q.id}>
              <td className="pl-4 text-ink">{q.descricao}</td>
              <td>
                <StatusPill tone={q.ativo ? "success" : "neutral"}>{q.ativo ? "Ativo" : "Inativo"}</StatusPill>
              </td>
              <td className="pr-4">
                <div className="flex items-center justify-end gap-1">
                  {podeCriar ? <BotaoClonar id={q.id} descricao={q.descricao} /> : null}
                  {podeEditar ? (
                    <>
                      <Link
                        href={`/questionario/questionarios/${q.id}/editar`}
                        aria-label={`Editar ${q.descricao}`}
                        className="rounded-ui p-1.5 text-brand hover:bg-brand/10"
                      >
                        <Pencil size={16} />
                      </Link>
                      <BotaoAtivar
                        acao={alternarAtivoQuestionarioAction}
                        id={q.id}
                        ativo={q.ativo}
                        nome={q.descricao}
                      />
                    </>
                  ) : null}
                </div>
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
// src/app/(app)/questionario/questionarios/page.tsx
import { PageHeader } from "@/components/ui/page-header";
import { ButtonLink } from "@/components/ui/button";
import { QuestionariosLista } from "@/components/questionario/questionarios-lista";
import { requirePermission } from "@/lib/auth/session";
import { listarQuestionarios } from "@/lib/data/questionario";
import { podeAcao } from "@/lib/questionario/acesso";

export default async function QuestionariosPage() {
  const session = await requirePermission("questionario.questionario", "read");
  const questionarios = await listarQuestionarios();
  const podeCriar = podeAcao(session, "questionario.questionario", "create");

  return (
    <div className="grid gap-8">
      <PageHeader
        breadcrumb={[{ label: "Acadêmico" }, { label: "Questionário" }, { label: "Cadastro de questionário" }]}
        title="Cadastro de Questionário"
        counter={String(questionarios.length)}
        actions={
          podeCriar ? (
            <ButtonLink href="/questionario/questionarios/novo" variant="primary">+ Cadastrar</ButtonLink>
          ) : undefined
        }
      />
      <QuestionariosLista
        questionarios={questionarios}
        podeCriar={podeCriar}
        podeEditar={podeAcao(session, "questionario.questionario", "update")}
      />
    </div>
  );
}
```

```tsx
// src/app/(app)/questionario/questionarios/novo/page.tsx
import { PageHeader } from "@/components/ui/page-header";
import { QuestionarioForm } from "@/components/questionario/questionario-form";
import { requirePermission } from "@/lib/auth/session";
import { listarEscalas, listarGrupos, listarQuestoes } from "@/lib/data/questionario";

export default async function NovoQuestionarioPage() {
  await requirePermission("questionario.questionario", "create");
  const [grupos, questoes, escalas] = await Promise.all([listarGrupos(), listarQuestoes(), listarEscalas()]);

  return (
    <div className="grid gap-8">
      <PageHeader
        breadcrumb={[
          { label: "Acadêmico" },
          { label: "Questionário" },
          { label: "Cadastro de questionário", href: "/questionario/questionarios" },
          { label: "Novo" },
        ]}
        title="Cadastro de Questionário"
      />
      <QuestionarioForm grupos={grupos} questoes={questoes} escalas={escalas} />
    </div>
  );
}
```

```tsx
// src/app/(app)/questionario/questionarios/[id]/editar/page.tsx
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { QuestionarioForm } from "@/components/questionario/questionario-form";
import { requirePermission } from "@/lib/auth/session";
import { getQuestionario, listarEscalas, listarGrupos, listarQuestoes } from "@/lib/data/questionario";
import { IdSchema } from "@/lib/validation/questionario";

export default async function EditarQuestionarioPage({ params }: { params: { id: string } }) {
  await requirePermission("questionario.questionario", "update");
  if (!IdSchema.safeParse(params.id).success) notFound();

  const [questionario, grupos, questoes, escalas] = await Promise.all([
    getQuestionario(params.id),
    listarGrupos(),
    listarQuestoes(),
    listarEscalas(),
  ]);
  if (!questionario) notFound();

  return (
    <div className="grid gap-8">
      <PageHeader
        breadcrumb={[
          { label: "Acadêmico" },
          { label: "Questionário" },
          { label: "Cadastro de questionário", href: "/questionario/questionarios" },
          { label: "Editar" },
        ]}
        title="Cadastro de Questionário"
      />
      <QuestionarioForm grupos={grupos} questoes={questoes} escalas={escalas} questionario={questionario} />
    </div>
  );
}
```

- [ ] **Step 9: Rodar tudo e commit**

Run: `npx vitest run src/lib/actions/questionario-questionarios.test.ts src/components/questionario/questionario-form.test.tsx && npm run typecheck`
Expected: PASS / limpo.

```bash
git add src/lib/actions/questionario-questionarios.ts src/lib/actions/questionario-questionarios.test.ts src/components/questionario/questionario-form.tsx src/components/questionario/questionario-form.test.tsx src/components/questionario/questionarios-lista.tsx "src/app/(app)/questionario/questionarios"
git commit -m "feat(questionario): cadastro de questionario com vinculos e clonar" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Menu e verificação final

**Files:**
- Modify: `src/components/layout/topbar.tsx` (array `SECRETARIA_ITEMS`)

**Interfaces:**
- Consumes: rotas das Tasks 4–7; `ROTA_PARA_MODULO` (Task 1) — `filterByPermissions` esconde filhos sem leitura e o item se nenhum filho sobra.

- [ ] **Step 1: Item de menu**

O dropdown só renderiza 2 níveis (item → filhos folha), então "Questionário" entra como item irmão de "Acadêmico", logo depois dele em `SECRETARIA_ITEMS` (antes do item `Pipeline`):

```ts
  {
    href: "/questionario/questionarios",
    label: "Questionário",
    iconName: "ClipboardList",
    children: [
      { href: "/questionario/grupos", label: "Grupo de Questão", iconName: "Layers3" },
      { href: "/questionario/escalas", label: "Escala", iconName: "SlidersHorizontal" },
      { href: "/questionario/questoes", label: "Questão", iconName: "ClipboardList" },
      { href: "/questionario/questionarios", label: "Questionário", iconName: "FileText" },
    ],
  },
```

(Todos os `iconName` usados já existem em `ICON_MAP` de `dropdown-icons.tsx`.)

- [ ] **Step 2: Gates**

Run: `npm run typecheck && npm run test && npm run build`
Expected: tudo verde. Se `npm run test` falhar em arquivo fora do módulo Questionário, confirmar com `git stash`-free: rodar o mesmo teste na `main` antes de atribuir a falha a este trabalho; reportar sem corrigir código alheio.

- [ ] **Step 3: Revisão**

Rodar a skill de revisão do projeto (`/code-review` sobre `git diff main...HEAD`) e tratar CRITICAL/HIGH. Atenção a: `requirePermission` em toda action/página; nenhum `confirm()` nativo; nenhum `any`/hex cru; arquivos < 800 linhas.

- [ ] **Step 4: Verificação manual (depende de decisão do dono)**

A migration precisa estar aplicada num banco de desenvolvimento/staging para a UI funcionar. **Não rodar `supabase db push --linked` contra produção sem autorização explícita.** Com a migration aplicada: `npm run dev` e percorrer (admin e depois secretaria): criar grupo → criar escala (2+ opções) → criar questão subjetiva, única escolha e com escala → criar questionário com "Todos" de um grupo, escolher escala, reordenar, gravar → clonar → inativar/ativar → editar questão em uso (tipo travado). Conferir claro e escuro.

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/topbar.tsx
git commit -m "feat(questionario): item de menu Questionario" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Self-Review (feita)

**Cobertura do spec:** modelo de dados e RLS (T1); regras — Subjetiva limites, alternativas ≥2, escala obrigatória só em `objetiva_escala`, tipo travado em uso, inativos fora de novo vínculo, escala ≥2 opções distintas, clone inativo com sufixo, ordem ↑↓ (T2, T5–T7); telas Grupo/Escala/Questão/Questionário (T4–T7); menu e RBAC (T1, T8); Matriz Descritiva só base (T2 transform + T6 UI); testes listados no spec: validação por tipo (T2), clone (T2, T7), bloqueio de troca de tipo (T6). Gaps conhecidos e intencionais: sem delete físico; sem respostas.

**Desvios do spec (para registrar no PR):** (1) schemas em `src/lib/validation/questionario.ts` (convenção do projeto) em vez de `src/lib/questionario/validacao.ts`; (2) menu como item irmão de "Acadêmico" (dropdown só tem 2 níveis); (3) RBAC no grupo `academico`; (4) "Todos" no seletor de Questão adiciona todas as questões ativas do grupo (comportamento da tela legada, não escrito no spec).

**Placeholders:** nenhum "TBD/TODO"; todo step de código traz o código.

**Consistência de tipos:** `ActionResult`, `QuestaoInfo`, `VinculoInput/Normalizado`, `substituirFilhos(db, tabela, paiId, rotulos)`, `alternarAtivo(formData, tabela, escolaId)` usados com a mesma assinatura em T3–T7; campos de form (`grupoId`, `tipo`, `alternativas`, `opcoes`, `vinculos`) idênticos entre componentes e actions.

---

## Pós-implementação (registro)

Este plano é o registro do que foi planejado para o PR #43; o estado final está em
`docs/superpowers/specs/2026-10-06-questionario-design.md`. Divergências em relação ao texto acima:

- `tsconfig` com `target: es5`: o código final não usa `\p{Diacritic}` com flag `u` nem `for…of` sobre `.entries()`/Map/Set.
- `diffVinculos` casa o vínculo pelo id (e mesma questão) ou, na falta, pela questão; a gravação do questionário é inserir → atualizar → remover (a Task 7 acima descreve remover → atualizar → inserir).
- `criarQuestionarioAction`/`atualizarQuestionarioAction` validam a escala escolhida (existe, está ativa); `criarQuestaoAction`/`atualizarQuestaoAction` validam o grupo (existe, ativo).
- PR #44 acrescentou a **escala padrão na questão** (`questoes.escala_id`, migration `202610060002_questao_escala_padrao.sql`): campo no cadastro, coluna na lista e pré-preenchimento no questionário.
- Minors adiados da revisão final: alternativa/opção em branco descartada em silêncio; questão ativa de grupo inativo ainda é oferecida no form do questionário; delete de rollback sem `logSeFalhou`.
