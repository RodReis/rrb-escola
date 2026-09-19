# Fonte única de contagem/consulta de alunos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar uma fonte única e reutilizável de "alunos ativos com matrícula no ano corrente" (a regra "527"), consumida por dashboards, contagens e o combo de matrícula, eliminando os 5 tipos de divergência mapeados (filtro `ativo` inconsistente, contagem `alunos` vs `matriculas`, ano hardcoded, falta de normalização de acento, dedup manual inconsistente).

**Architecture:** Uma função TypeScript canônica (`getAlunosAtivosAnoCorrente`) em `src/lib/data/students.ts`, mais duas funções de apoio (`contarAlunosAtivos`, `getAlunosSemMatriculaNoAno`) — todas finas (I/O puro), delegando qualquer decisão testável para funções puras extraídas em `src/lib/data/students-shared-constants.ts`. Um utilitário de normalização de nome compartilhado (`src/lib/format/normalize-nome.ts`) substitui as 2 reimplementações existentes usadas para comparação de nomes (`imports.ts`, `student-import-parser.ts`) e alimenta a nova busca com acento. Migration adiciona `unaccent` + coluna gerada `nome_normalizado` em `alunos`. Consumidores trocam sua query manual pela nova função, um arquivo por task.

**Tech Stack:** Next.js 14 App Router, TypeScript, Supabase (Postgres), Vitest.

**Spec:** `docs/superpowers/specs/2026-09-19-fonte-unica-alunos-design.md`

## Global Constraints

- `escola_id` sempre `DEFAULT_SCHOOL_ID` (de `src/lib/constants.ts`) — não existe multi-escola pra aluno.
- Ano letivo default = `new Date().getFullYear()`, nunca hardcoded.
- Toda função de dado (`src/lib/data/*`) propaga erro do Supabase com `throw error` — sem try/catch silencioso.
- `npm run typecheck && npm run build` verdes antes de fechar; `npm run test` verde antes do PR (regra do CLAUDE.md do projeto).
- Commit por task, mensagens `feat:`/`test:`/`refactor:` conforme o conteúdo.
- Regra 527 = `alunos.ativo = true` AND existe `matriculas` com `status = 'ativa'` AND `ano_letivo = :anoLetivo`.
- `/alunos` (`listStudents`) e `/relatorios/alunos` (`getStudentsReport`) ficam **fora** da regra 527 deliberadamente — não tocar seu comportamento de filtro.

---

### Task 1: Utilitário de normalização de nome compartilhado

**Files:**
- Create: `src/lib/format/normalize-nome.ts`
- Test: `src/lib/format/normalize-nome.test.ts`
- Modify: `src/lib/actions/imports.ts:29-34` (troca a função local `normalize` por import)
- Modify: `src/lib/server/student-import-parser.ts:95-99` (troca a função local `normalize` por import — conferir assinatura exata antes de editar, pode ter parâmetro diferente)

**Interfaces:**
- Produces: `normalizeNome(value: string | null | undefined): string` — trim, lowercase, NFD, remove diacríticos. Usado por Task 2 (busca com acento) e pelo combo (Task 6).

- [ ] **Step 1: Ler as duas implementações existentes antes de escrever a nova**

Rode:
```bash
sed -n '90,100p' src/lib/server/student-import-parser.ts
```
Confirme se a assinatura e o corpo batem com `normalize()` de `imports.ts:29-34` (mostrado abaixo). Se `student-import-parser.ts` tiver comportamento adicional (ex.: remove espaços extras, trata maiúsculas de forma diferente), preserve esse comportamento na função nova — não regrida.

```ts
// src/lib/actions/imports.ts:29-34 (referência)
function normalize(value: string | null | undefined) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();
}
```

- [ ] **Step 2: Escrever o teste primeiro**

```ts
// src/lib/format/normalize-nome.test.ts
import { describe, expect, it } from "vitest";
import { normalizeNome } from "./normalize-nome";

describe("normalizeNome", () => {
  it("remove acentos", () => {
    expect(normalizeNome("CÔRTES")).toBe("cortes");
  });

  it("resultado bate independente de acento no input", () => {
    expect(normalizeNome("José")).toBe(normalizeNome("Jose"));
  });

  it("lowercase", () => {
    expect(normalizeNome("MARIA")).toBe("maria");
  });

  it("trim espaços nas pontas", () => {
    expect(normalizeNome("  Ana  ")).toBe("ana");
  });

  it("null/undefined vira string vazia", () => {
    expect(normalizeNome(null)).toBe("");
    expect(normalizeNome(undefined)).toBe("");
  });

  it("cedilha", () => {
    expect(normalizeNome("MARÇAL")).toBe("marcal");
  });
});
```

- [ ] **Step 2b: Rodar teste, confirmar que falha (função ainda não existe)**

Run: `npx vitest run src/lib/format/normalize-nome.test.ts`
Expected: FAIL — módulo `./normalize-nome` não encontrado.

- [ ] **Step 3: Implementar**

```ts
// src/lib/format/normalize-nome.ts

/**
 * Normaliza nome para comparação sem sensibilidade a acento/caixa: trim,
 * lowercase, remove diacríticos via NFD. Usado em toda busca/comparação de
 * nome de aluno — fonte única para evitar reimplementações divergentes
 * (ex.: "CORTES" não achava "CÔRTES" antes desta função existir).
 */
export function normalizeNome(value: string | null | undefined): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();
}
```

- [ ] **Step 4: Rodar teste, confirmar que passa**

Run: `npx vitest run src/lib/format/normalize-nome.test.ts`
Expected: PASS — 6 testes.

- [ ] **Step 5: Trocar as duas reimplementações pelo import**

Em `src/lib/actions/imports.ts`: remova a função local `normalize` (linhas 29-34) e adicione `import { normalizeNome } from "@/lib/format/normalize-nome";` no topo; troque toda chamada `normalize(` por `normalizeNome(` no arquivo (linhas 54-56, 67, 69, 74, 79, 234-235, 239, 242, 245 — usar find/replace, não editar uma a uma).

Em `src/lib/server/student-import-parser.ts`: mesma troca, ajustando ao comportamento confirmado no Step 1.

- [ ] **Step 6: Rodar typecheck**

Run: `npx tsc --noEmit --pretty false`
Expected: sem erro nos dois arquivos modificados.

- [ ] **Step 7: Rodar suíte completa de testes**

Run: `npm run test`
Expected: PASS — nenhum teste existente quebrou (a lógica da função é idêntica, só mudou de arquivo).

- [ ] **Step 8: Commit**

```bash
git add src/lib/format/normalize-nome.ts src/lib/format/normalize-nome.test.ts src/lib/actions/imports.ts src/lib/server/student-import-parser.ts
git commit -m "refactor: extrai normalizeNome compartilhado, remove 2 reimplementacoes

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Migration — extensão unaccent + coluna nome_normalizado

**Files:**
- Create: `supabase/migrations/202609190010_alunos_nome_normalizado.sql` (verificar o próximo número livre antes de nomear — rodar `ls supabase/migrations | tail -5` e usar o timestamp seguinte ao mais recente do dia)

**Interfaces:**
- Produces: coluna `alunos.nome_normalizado` (gerada, sempre em sincronia com `nome`) — consumida pela query de Task 3 (`getAlunosAtivosAnoCorrente` com filtro `nome`).

- [ ] **Step 1: Confirmar o próximo timestamp de migration livre**

Run: `ls supabase/migrations | tail -5`
Use um timestamp maior que o último listado, mesmo padrão `YYYYMMDDHHMM_descricao.sql`.

- [ ] **Step 2: Escrever a migration**

```sql
-- supabase/migrations/202609190010_alunos_nome_normalizado.sql
-- Extensão para normalizar acento em buscas de nome. Sem ela, "CORTES" nao
-- encontra "CÔRTES" (nenhuma busca de nome no sistema normaliza acento hoje).
create extension if not exists unaccent;

-- Coluna gerada: sempre em sincronia com `nome`, sem trigger manual.
alter table alunos
  add column nome_normalizado text
  generated always as (lower(unaccent(nome))) stored;

create index idx_alunos_nome_normalizado on alunos (nome_normalizado);
```

- [ ] **Step 3: Aplicar a migration localmente e verificar**

Run: `npx supabase db push` (ou o comando de migration já usado no projeto — conferir `docs/DEPLOY.md` se `db push` não for o padrão local).

Depois rode uma query manual de smoke-test via `npx supabase db execute` ou painel local:
```sql
select nome, nome_normalizado from alunos where nome ilike '%ô%' limit 3;
```
Expected: `nome_normalizado` sem acento, correspondendo ao `nome` original.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/202609190010_alunos_nome_normalizado.sql
git commit -m "feat(db): adiciona unaccent e coluna nome_normalizado em alunos

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Função canônica `getAlunosAtivosAnoCorrente` + `contarAlunosAtivos`

**Files:**
- Modify: `src/lib/data/students.ts` (adiciona as duas funções novas ao arquivo existente, não cria arquivo novo — ver árvore de consumidores na spec)
- Test: `src/lib/data/students-shared.test.ts`

**Interfaces:**
- Consumes: `normalizeNome` de `src/lib/format/normalize-nome.ts` (Task 1); `DEFAULT_SCHOOL_ID` de `src/lib/constants.ts`; `createServerClient` de `@/lib/supabase/server`.
- Produces:
  ```ts
  export type AlunoAtivoAnoCorrente = {
    id: string;
    nome: string;
    matriculaCodigo: string | null;
    cpf: string | null;
    matriculaId: string;
    serieId: string;
    turmaId: string;
    anoLetivo: number;
  };

  export type FiltroAlunosAtivos = {
    anoLetivo?: number;
    serieId?: string;
    turmaId?: string;
    nome?: string;
  };

  export async function getAlunosAtivosAnoCorrente(
    filtro?: FiltroAlunosAtivos
  ): Promise<AlunoAtivoAnoCorrente[]>;

  export async function contarAlunosAtivos(
    filtro?: Omit<FiltroAlunosAtivos, "nome">
  ): Promise<number>;
  ```
  Consumido por Task 4 (pedagogico.ts), Task 5 (dashboard-executive.ts), Task 7 (dashboard-comercial.ts, bolsistas.ts, alunos-com-desconto.ts, alunos-sem-valor.ts).

- [ ] **Step 1: Escrever teste primeiro, com mock do client Supabase**

Antes de escrever, confira o padrão de mock de `createServerClient` já usado no projeto (nenhum dos testes de `src/lib/data/*.test.ts` existentes mocka Supabase diretamente — todos testam função pura extraída). Para manter esse padrão, a query em si (I/O) fica sem teste unitário direto aqui; em vez disso, extraia a lógica de shape/filtro para uma função pura testável:

```ts
// src/lib/data/students-shared.test.ts
import { describe, expect, it } from "vitest";
import { montarFiltroAlunosAtivos } from "./students-shared-constants";

describe("montarFiltroAlunosAtivos", () => {
  it("usa ano corrente quando anoLetivo nao informado", () => {
    const anoAtual = new Date().getFullYear();
    expect(montarFiltroAlunosAtivos({}).anoLetivo).toBe(anoAtual);
  });

  it("usa anoLetivo explicito quando informado", () => {
    expect(montarFiltroAlunosAtivos({ anoLetivo: 2024 }).anoLetivo).toBe(2024);
  });

  it("normaliza nome de busca para comparacao sem acento", () => {
    expect(montarFiltroAlunosAtivos({ nome: "CÔRTES" }).nomeNormalizado).toBe("cortes");
  });

  it("nome ausente nao gera filtro de nome", () => {
    expect(montarFiltroAlunosAtivos({}).nomeNormalizado).toBeUndefined();
  });

  it("repassa serieId e turmaId sem alteracao", () => {
    const r = montarFiltroAlunosAtivos({ serieId: "s1", turmaId: "t1" });
    expect(r.serieId).toBe("s1");
    expect(r.turmaId).toBe("t1");
  });
});
```

- [ ] **Step 2: Rodar teste, confirmar que falha**

Run: `npx vitest run src/lib/data/students-shared.test.ts`
Expected: FAIL — módulo `./students-shared-constants` não encontrado.

- [ ] **Step 3: Implementar a função pura**

```ts
// src/lib/data/students-shared-constants.ts
import { normalizeNome } from "@/lib/format/normalize-nome";

export type FiltroAlunosAtivosResolvido = {
  anoLetivo: number;
  serieId?: string;
  turmaId?: string;
  nomeNormalizado?: string;
};

/**
 * Resolve o filtro de entrada da fonte unica de alunos ativos: aplica o
 * default de ano corrente e normaliza o termo de busca por nome (sem
 * acento/caixa), para comparar contra `alunos.nome_normalizado`.
 */
export function montarFiltroAlunosAtivos(filtro: {
  anoLetivo?: number;
  serieId?: string;
  turmaId?: string;
  nome?: string;
}): FiltroAlunosAtivosResolvido {
  return {
    anoLetivo: filtro.anoLetivo ?? new Date().getFullYear(),
    serieId: filtro.serieId,
    turmaId: filtro.turmaId,
    nomeNormalizado: filtro.nome ? normalizeNome(filtro.nome) : undefined,
  };
}
```

- [ ] **Step 4: Rodar teste, confirmar que passa**

Run: `npx vitest run src/lib/data/students-shared.test.ts`
Expected: PASS — 5 testes.

- [ ] **Step 5: Implementar as funções de I/O em `students.ts`, usando a função pura**

Adicione ao final de `src/lib/data/students.ts` (após `getStudentsReport`, mantendo os imports existentes no topo do arquivo):

```ts
import { montarFiltroAlunosAtivos, type FiltroAlunosAtivosResolvido } from "./students-shared-constants";

export type AlunoAtivoAnoCorrente = {
  id: string;
  nome: string;
  matriculaCodigo: string | null;
  cpf: string | null;
  matriculaId: string;
  serieId: string;
  turmaId: string;
  anoLetivo: number;
};

export type FiltroAlunosAtivos = {
  anoLetivo?: number;
  serieId?: string;
  turmaId?: string;
  nome?: string;
};

function buildAlunosAtivosQuery(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  filtro: FiltroAlunosAtivosResolvido,
  opts: { countOnly: boolean }
) {
  let query = supabase
    .from("alunos")
    .select(
      opts.countOnly
        ? "id"
        : "id, nome, matricula_codigo, cpf, matriculas!inner(id, serie_id, turma_id, ano_letivo, status)",
      { count: "exact", head: opts.countOnly }
    )
    .eq("escola_id", DEFAULT_SCHOOL_ID)
    .eq("ativo", true)
    .eq("matriculas.status", "ativa")
    .eq("matriculas.ano_letivo", filtro.anoLetivo);

  if (filtro.serieId) query = query.eq("matriculas.serie_id", filtro.serieId);
  if (filtro.turmaId) query = query.eq("matriculas.turma_id", filtro.turmaId);
  if (filtro.nomeNormalizado) query = query.ilike("nome_normalizado", `%${filtro.nomeNormalizado}%`);

  return query;
}

/**
 * Fonte única: alunos com `ativo=true` e matrícula `status='ativa'` no ano
 * letivo informado (ou corrente). Base de todo KPI/contagem "oficial" do
 * sistema — a regra "527". Não usar para telas que precisam ver aluno ativo
 * sem matrícula no ano (ver `listStudents`) nem para o combo de nova
 * matrícula (ver `getAlunosSemMatriculaNoAno`).
 */
export async function getAlunosAtivosAnoCorrente(
  filtro?: FiltroAlunosAtivos
): Promise<AlunoAtivoAnoCorrente[]> {
  const supabase = await createServerClient();
  const resolvido = montarFiltroAlunosAtivos(filtro ?? {});
  const { data, error } = await buildAlunosAtivosQuery(supabase, resolvido, { countOnly: false });
  if (error) throw error;

  return (data ?? []).map((row) => {
    const matricula = Array.isArray(row.matriculas) ? row.matriculas[0] : row.matriculas;
    return {
      id: row.id,
      nome: row.nome,
      matriculaCodigo: row.matricula_codigo,
      cpf: row.cpf,
      matriculaId: matricula?.id ?? "",
      serieId: matricula?.serie_id ?? "",
      turmaId: matricula?.turma_id ?? "",
      anoLetivo: matricula?.ano_letivo ?? resolvido.anoLetivo,
    };
  });
}

/**
 * Mesma base de `getAlunosAtivosAnoCorrente`, mas devolve só a contagem
 * (`head: true`) — evita trazer linhas quando só o número importa.
 */
export async function contarAlunosAtivos(
  filtro?: Omit<FiltroAlunosAtivos, "nome">
): Promise<number> {
  const supabase = await createServerClient();
  const resolvido = montarFiltroAlunosAtivos(filtro ?? {});
  const { count, error } = await buildAlunosAtivosQuery(supabase, resolvido, { countOnly: true });
  if (error) throw error;
  return count ?? 0;
}
```

- [ ] **Step 6: Rodar typecheck**

Run: `npx tsc --noEmit --pretty false`
Expected: sem erro. Se o shape de `matriculas!inner(...)` do Supabase gerar tipo `any`/incompatível, ajuste o cast seguindo o padrão já usado em `runStudentsQuery` no mesmo arquivo (`as unknown as ...` só se necessário — preferir tipar o `.select()` corretamente primeiro).

- [ ] **Step 7: Rodar suíte de testes**

Run: `npm run test`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/lib/data/students.ts src/lib/data/students-shared-constants.ts src/lib/data/students-shared.test.ts
git commit -m "feat: fonte unica getAlunosAtivosAnoCorrente e contarAlunosAtivos

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: `getAlunosSemMatriculaNoAno` (universo do combo de nova matrícula)

**Files:**
- Modify: `src/lib/data/students.ts` (adiciona a função)
- Test: `src/lib/data/students-shared.test.ts` (estende o arquivo da Task 3)

**Interfaces:**
- Consumes: `DEFAULT_SCHOOL_ID`, `createServerClient` (mesmos da Task 3).
- Produces:
  ```ts
  export async function getAlunosSemMatriculaNoAno(
    anoLetivo?: number
  ): Promise<{ id: string; nome: string; matriculaCodigo: string | null }[]>;
  ```
  Consumido por Task 6 (combo de nova matrícula).

- [ ] **Step 1: Escrever teste da função pura de decisão (quem entra/sai)**

```ts
// adicionar a students-shared.test.ts
import { alunoSemMatriculaAtivaNoAno } from "./students-shared-constants";

describe("alunoSemMatriculaAtivaNoAno", () => {
  it("aluno sem nenhuma matricula -> true (entra no combo)", () => {
    expect(alunoSemMatriculaAtivaNoAno([], 2026)).toBe(true);
  });

  it("aluno com matricula concluida no ano (nao ativa) -> true", () => {
    expect(
      alunoSemMatriculaAtivaNoAno([{ ano_letivo: 2026, status: "concluida" }], 2026)
    ).toBe(true);
  });

  it("aluno com matricula ativa no ano -> false (ja matriculado, sai do combo)", () => {
    expect(
      alunoSemMatriculaAtivaNoAno([{ ano_letivo: 2026, status: "ativa" }], 2026)
    ).toBe(false);
  });

  it("aluno com matricula ativa em outro ano -> true (ano corrente livre)", () => {
    expect(
      alunoSemMatriculaAtivaNoAno([{ ano_letivo: 2025, status: "ativa" }], 2026)
    ).toBe(true);
  });
});
```

- [ ] **Step 2: Rodar teste, confirmar que falha**

Run: `npx vitest run src/lib/data/students-shared.test.ts`
Expected: FAIL — `alunoSemMatriculaAtivaNoAno` não exportado.

- [ ] **Step 3: Implementar a função pura em `students-shared-constants.ts`**

```ts
// adicionar a src/lib/data/students-shared-constants.ts

/**
 * true quando o aluno NAO tem matricula `ativa` no ano informado — universo
 * do combo de nova matricula/rematricula (quem ainda pode ser matriculado
 * nesse ano). Contexto oposto ao de `getAlunosAtivosAnoCorrente`.
 */
export function alunoSemMatriculaAtivaNoAno(
  matriculas: { ano_letivo: number; status: string }[],
  anoLetivo: number
): boolean {
  return !matriculas.some((m) => m.ano_letivo === anoLetivo && m.status === "ativa");
}
```

- [ ] **Step 4: Rodar teste, confirmar que passa**

Run: `npx vitest run src/lib/data/students-shared.test.ts`
Expected: PASS — 4 testes novos + 5 anteriores = 9.

- [ ] **Step 5: Implementar a função de I/O em `students.ts`**

```ts
// adicionar a src/lib/data/students.ts
import { alunoSemMatriculaAtivaNoAno } from "./students-shared-constants";

/**
 * Universo do combo de NOVA matrícula/rematrícula: alunos `ativo=true` que
 * NÃO têm matrícula `status='ativa'` no ano letivo informado — quem ainda
 * pode ser matriculado nesse ano. Sem esta função, o combo alinhado à regra
 * 527 ficaria vazio para quem ainda não tem matrícula no ano (caso comum:
 * matricular aluno novo ou reativar aluno com lacuna de anos).
 */
export async function getAlunosSemMatriculaNoAno(
  anoLetivo: number = new Date().getFullYear()
): Promise<{ id: string; nome: string; matriculaCodigo: string | null }[]> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("alunos")
    .select("id, nome, matricula_codigo, matriculas(ano_letivo, status)")
    .eq("escola_id", DEFAULT_SCHOOL_ID)
    .eq("ativo", true)
    .order("nome");
  if (error) throw error;

  return (data ?? [])
    .filter((row) =>
      alunoSemMatriculaAtivaNoAno(
        (row.matriculas ?? []) as { ano_letivo: number; status: string }[],
        anoLetivo
      )
    )
    .map((row) => ({
      id: row.id,
      nome: row.nome,
      matriculaCodigo: row.matricula_codigo,
    }));
}
```

- [ ] **Step 6: Rodar typecheck e suíte de testes**

Run: `npx tsc --noEmit --pretty false && npm run test`
Expected: sem erro, todos os testes passam.

- [ ] **Step 7: Commit**

```bash
git add src/lib/data/students.ts src/lib/data/students-shared-constants.ts src/lib/data/students-shared.test.ts
git commit -m "feat: getAlunosSemMatriculaNoAno para combo de nova matricula

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: Migrar `pedagogico.ts` e `dashboard-executive.ts` para a fonte única

**Files:**
- Modify: `src/lib/data/pedagogico.ts` (funções `getPedagogicoOverview`, `getEvasao` — ler o arquivo inteiro antes de editar, os nomes de campo exatos do relatório do agente anterior podem ter mudado linha desde então)
- Modify: `src/lib/data/dashboard-executive.ts` (função `getOcupacao`)

**Interfaces:**
- Consumes: `contarAlunosAtivos` de `src/lib/data/students.ts` (Task 3).

- [ ] **Step 1: Ler `getPedagogicoOverview` e `getEvasao` por inteiro**

Run: `grep -n "export async function get" src/lib/data/pedagogico.ts`
Leia as duas funções completas antes de editar — o relatório de investigação apontou linhas aproximadas (874-905, 56-90) que podem ter deslocado.

- [ ] **Step 2: Trocar a contagem manual de `matriculas.status='ativa'` por `contarAlunosAtivos`**

Dentro de `getPedagogicoOverview`, localize o trecho que faz `count:"exact", head:true` sobre `matriculas` com `status='ativa'` e `ano_letivo` corrente. Troque por:

```ts
import { contarAlunosAtivos } from "./students";
// ...
const totalAlunosAtivos = await contarAlunosAtivos({ anoLetivo });
```

Mantenha o restante da função (outros KPIs) intacto — troque só esse número.

- [ ] **Step 3: Repetir para `getEvasao` onde aplicável**

`getEvasao` soma todos os status de `matriculas` (evasão precisa dos status não-ativos também) — **não** trocar essa parte por `contarAlunosAtivos` (que só devolve ativos). Trocar apenas o subtotal "ativos" dentro do resultado, se ele existir separado, por uma chamada a `contarAlunosAtivos`. Se `getEvasao` não expõe um subtotal isolado de "ativos" (só o total geral), documentar com comentário por que a função não muda aqui — não forçar uma troca que não se aplica.

- [ ] **Step 4: Repetir em `getOcupacao` (`dashboard-executive.ts`)**

Localize a contagem de `matriculas.status='ativa'` sem filtro explícito de `ano_letivo` (o relatório apontou que o filtro de ano é implícito via turmas do ano). Troque por `contarAlunosAtivos({ anoLetivo })`, tornando o filtro de ano explícito — isso corrige a divergência #4 do mapa original (mecanismo implícito vs explícito).

- [ ] **Step 5: Rodar typecheck**

Run: `npx tsc --noEmit --pretty false`
Expected: sem erro.

- [ ] **Step 6: Rodar suíte de testes**

Run: `npm run test`
Expected: PASS — atenção especial a qualquer teste existente de `pedagogico.ts`/`dashboard-executive.ts` (`grep -rl "getPedagogicoOverview\|getOcupacao" src/**/*.test.ts`) — se existir teste com valor esperado fixo, ele pode precisar de ajuste se o número mudar de fonte (mesma regra, mas caminho de query diferente pode revelar um número antes errado).

- [ ] **Step 7: Build**

Run: `npm run build`
Expected: sucesso.

- [ ] **Step 8: Commit**

```bash
git add src/lib/data/pedagogico.ts src/lib/data/dashboard-executive.ts
git commit -m "refactor: pedagogico e dashboard-executive usam contarAlunosAtivos

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 6: Combo de nova matrícula usa `getAlunosSemMatriculaNoAno`; combo geral normaliza acento

**Files:**
- Modify: arquivo Server Component que hoje monta o combo de `createEnrollmentAction` (localizar com `grep -rl "createEnrollmentAction\|StudentCombobox" src/app` antes de editar — provavelmente em `src/app/(app)/matriculas/`)
- Modify: `src/components/matriculas/student-combobox.tsx:28-35` (filtro client-side)

**Interfaces:**
- Consumes: `getAlunosSemMatriculaNoAno` de `src/lib/data/students.ts` (Task 4); `normalizeNome` de `src/lib/format/normalize-nome.ts` (Task 1).

- [ ] **Step 1: Localizar o Server Component da tela de nova matrícula**

Run: `grep -rln "createEnrollmentAction" src/app`
Leia o arquivo encontrado por inteiro — confirme como ele hoje monta a lista de `alunos` passada para `<StudentCombobox alunos={...} />` (provavelmente via `getAcademicData()`).

- [ ] **Step 2: Trocar a fonte de dados do combo nessa tela**

Troque a chamada que popula `alunos` de `getAcademicData()` (ou equivalente) para `getAlunosSemMatriculaNoAno(anoLetivo)`. Ajuste o mapeamento de campos conforme o tipo que `StudentCombobox` espera (`id`, `nome`, `matricula_codigo`) — o retorno de `getAlunosSemMatriculaNoAno` usa `matriculaCodigo` (camelCase); adapte no ponto de chamada:

```ts
const alunosDisponiveis = await getAlunosSemMatriculaNoAno(anoLetivo);
const alunosParaCombo = alunosDisponiveis.map((a) => ({
  id: a.id,
  nome: a.nome,
  matricula_codigo: a.matriculaCodigo ?? "",
}));
```

- [ ] **Step 3: Normalizar acento no filtro client-side do combo**

Em `src/components/matriculas/student-combobox.tsx`, troque:

```tsx
const filtered = query.length < 1
  ? []
  : alunos
      .filter((a) =>
        a.nome.toLowerCase().includes(query.toLowerCase()) ||
        a.matricula_codigo.includes(query)
      )
      .slice(0, 10);
```

por:

```tsx
import { normalizeNome } from "@/lib/format/normalize-nome";
// ...
const queryNormalizada = normalizeNome(query);
const filtered = query.length < 1
  ? []
  : alunos
      .filter((a) =>
        normalizeNome(a.nome).includes(queryNormalizada) ||
        a.matricula_codigo.includes(query)
      )
      .slice(0, 10);
```

- [ ] **Step 4: Rodar typecheck**

Run: `npx tsc --noEmit --pretty false`
Expected: sem erro.

- [ ] **Step 5: Rodar suíte de testes**

Run: `npm run test`
Expected: PASS.

- [ ] **Step 6: Build**

Run: `npm run build`
Expected: sucesso.

- [ ] **Step 7: Teste manual no navegador (checklist, sem automação)**

Rode `npm run dev`, abra a tela de nova matrícula, confirme:
- Combo lista aluno sem matrícula 2026 (ex.: um dos 19 pendentes, se já existir em `alunos`).
- Buscar "cortes" no combo encontra "CÔRTES" (se existir esse registro; senão, testar com qualquer par acentuado real da base).

- [ ] **Step 8: Commit**

```bash
git add <arquivo-tela-nova-matricula> src/components/matriculas/student-combobox.tsx
git commit -m "feat: combo de nova matricula usa alunos sem matricula no ano; busca ignora acento

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 7: Migrar `dashboard-comercial.ts`, `bolsistas.ts`, `alunos-com-desconto.ts`, `alunos-sem-valor.ts`

**Files:**
- Modify: `src/lib/data/dashboard-comercial.ts` (top devedores, renovações, aniversariantes — linhas aproximadas 602-660, 684-730, 940-990, 1263-1340, 1365-1430 conforme mapa; confirmar linha atual antes de editar)
- Modify: `src/lib/data/bolsistas.ts`
- Modify: `src/lib/data/alunos-com-desconto.ts:47-49` (remove `ano_letivo = 2026` hardcoded)
- Modify: `src/lib/data/alunos-sem-valor.ts`

**Interfaces:**
- Consumes: `getAlunosAtivosAnoCorrente` de `src/lib/data/students.ts` (Task 3).

- [ ] **Step 1: `alunos-com-desconto.ts` — remover ano hardcoded primeiro (menor risco, mudança isolada)**

Leia o arquivo (já lido nesta sessão: linhas 47-49 e 61-63 usam `.eq("ano_letivo", 2026)` fixo). Troque:

```ts
.eq("ano_letivo", 2026)
```

por:

```ts
.eq("ano_letivo", filters.anoLetivo ?? new Date().getFullYear())
```

Confira se `AlunosComDescontoFilters` (em `alunos-com-desconto-constants.ts`) já tem campo `anoLetivo`; se não tiver, adicione como opcional e propague no chamador (`grep -rl "getAlunosComDesconto" src/app`).

- [ ] **Step 2: Rodar teste existente de `alunos-com-desconto.test.ts`**

Run: `npx vitest run src/lib/data/alunos-com-desconto.test.ts`
Expected: PASS — a mudança não afeta `buildDescontoRow` (lógica pura testada), só a query em `alunos-com-desconto.ts`.

- [ ] **Step 3: Commit isolado deste passo (menor risco, mais fácil reverter sozinho)**

```bash
git add src/lib/data/alunos-com-desconto.ts src/lib/data/alunos-com-desconto-constants.ts
git commit -m "fix: remove ano_letivo 2026 hardcoded em alunos-com-desconto

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

- [ ] **Step 4: `alunos-sem-valor.ts` — usar `getAlunosAtivosAnoCorrente` como base**

Leia o arquivo por inteiro. Ele hoje faz `alunos.ativo=true` + filtra em JS por `matriculas` do ano 2026 (constante embutida). Troque a base da query para usar `getAlunosAtivosAnoCorrente({ anoLetivo })` e aplique o filtro específico de "sem valor de mensalidade" por cima do resultado, preservando a lógica de negócio existente (não a reescreva do zero — só troque a origem dos dados).

- [ ] **Step 5: `bolsistas.ts` — usar `getAlunosAtivosAnoCorrente` como base**

Mesma abordagem: troque a query própria de `matriculas.status='ativa'` + `tipo_vaga in [...]` para partir de `getAlunosAtivosAnoCorrente({ anoLetivo })`, aplicando o filtro de `tipo_vaga` como filtro adicional sobre o resultado (verificar se `tipo_vaga` está disponível no retorno de `getAlunosAtivosAnoCorrente` — se não estiver, adicionar esse campo ao tipo `AlunoAtivoAnoCorrente` e ao `.select()` da Task 3, revisitando essa task se necessário).

- [ ] **Step 6: `dashboard-comercial.ts` — top devedores, renovações, aniversariantes**

Leia as 3 funções por inteiro antes de editar. Cada uma tem dedup manual via `Set<string>` — ao trocar a origem para `getAlunosAtivosAnoCorrente`, o dedup manual pode deixar de ser necessário (a função já retorna 1 linha por aluno). Confirme isso por leitura antes de remover o `Set`; se a função combina múltiplas fontes (ex.: matrícula + cobranças), o dedup pode continuar necessário por outro motivo — não remover às cegas.

- [ ] **Step 7: Rodar typecheck**

Run: `npx tsc --noEmit --pretty false`
Expected: sem erro.

- [ ] **Step 8: Rodar suíte de testes completa**

Run: `npm run test`
Expected: PASS.

- [ ] **Step 9: Build**

Run: `npm run build`
Expected: sucesso.

- [ ] **Step 10: Teste manual nos dashboards afetados**

Rode `npm run dev`, abra as telas de dashboard comercial, bolsistas, alunos sem valor — confirme que os números batem com o total mostrado no dashboard executivo/pedagógico (mesma regra 527 agora).

- [ ] **Step 11: Commit**

```bash
git add src/lib/data/dashboard-comercial.ts src/lib/data/bolsistas.ts src/lib/data/alunos-sem-valor.ts
git commit -m "refactor: dashboard-comercial, bolsistas e alunos-sem-valor usam fonte unica

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 8: Verificação final e checklist de aceite

**Files:** nenhum arquivo novo — validação end-to-end.

- [ ] **Step 1: Typecheck completo**

Run: `npm run typecheck` (ou `npx tsc --noEmit --pretty false` se não houver script dedicado — conferir `package.json`)
Expected: 0 erros.

- [ ] **Step 2: Build completo**

Run: `npm run build`
Expected: sucesso, sem warning novo relacionado aos arquivos tocados.

- [ ] **Step 3: Suíte de testes completa**

Run: `npm run test`
Expected: PASS, incluindo os novos arquivos de teste desta plan (`normalize-nome.test.ts`, `students-shared.test.ts`) e todos os pré-existentes.

- [ ] **Step 4: Conferir critério de aceite da spec, um por um**

Percorrer `docs/superpowers/specs/2026-09-19-fonte-unica-alunos-design.md#critério-de-aceite` e confirmar cada item manualmente (checklist, sem novo código):
- [ ] Badge/KPI que usa `contarAlunosAtivos`/`getAlunosAtivosAnoCorrente` mostra o mesmo número entre si, para o mesmo ano letivo (testar dashboard pedagógico vs. executivo lado a lado no navegador).
- [ ] Busca por nome com/sem acento retorna o mesmo resultado, no combo e na tela `/alunos`.
- [ ] `alunos-com-desconto.ts` não tem mais ano hardcoded (`grep -n "2026" src/lib/data/alunos-com-desconto.ts` só deve aparecer se for parte de um comentário ou de um default explícito documentado, não de um `.eq()`).

- [ ] **Step 5: Commit final se houver ajustes de checklist**

Se o Step 4 revelar algo pendente, corrija e comite normalmente antes de abrir o PR. Caso contrário, nenhum commit novo aqui — a branch já está pronta para revisão/PR (seguindo `git-workflow.md`: diff completo com `git diff main...HEAD`, PR com plano de teste).
