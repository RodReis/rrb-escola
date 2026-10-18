# Ano de Referência + Requerimento de Matrícula Implementation Plan

> **Status: executado (2026-10-18).** Tasks 1–11 entregues no PR #48; migrations aplicadas em
> prod. Depois da entrega, a tela e o PDF do requerimento foram revistos a pedido do usuário
> (commits `3bf7520a`, `ba091b5c`, `722e0249` no `main`) e **divergem das Tasks 7–9 abaixo**:
> tela no padrão de `historico/emissao` (tabela com seleção, sem preview individual — a
> `previsualizarRequerimentoAction` foi removida), PDF em tabela de 1 página A4 com foto,
> razão social + nome fantasia e "Irmãos na Escola"/"Novo Endereço" em branco. O registro
> atual dessas decisões é o spec (`docs/superpowers/specs/2026-10-18-ano-referencia-requerimento-matricula-design.md`,
> itens marcados **(revisto)**); este plano fica como histórico da execução original.
>
> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduzir um "ano letivo ativo" por escola (hoje inexistente — cada tela deriva o ano de `new Date()`) e, usando esse ano, uma nova emissão de PDF "Requerimento de Matrícula" (ficha aluno/pai/mãe/matrícula/responsável, assinada por secretário e responsável financeiro).

**Architecture:** Migration adiciona `escolas.ano_referencia_atual`; um helper de leitura (`getAnoReferenciaAtual`) substitui `new Date().getFullYear()` nos pontos que hoje usam esse fallback, incluindo uma mudança de assinatura em `anoLetivoDaData`. O requerimento clona a arquitetura já existente de `declaracoes/emitir` (filtro via querystring → preview/lote → jsPDF client-side) ponta a ponta: página, form, actions, data layer, renderer PDF — cada peça nova espelha sua contraparte em `declaracao-*`.

**Tech Stack:** Next.js 14 App Router, Supabase (Postgres + RLS), jsPDF, Zod, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-18-ano-referencia-requerimento-matricula-design.md`

## Global Constraints

- RLS: nenhuma policy nova — todas as colunas novas entram em tabelas já cobertas (`escolas`, `alunos`, `responsaveis_aluno`).
- RBAC: nenhum módulo novo. Emissão do requerimento usa `requirePermission("historico", "read")`. Troca de ano de referência usa `requirePermission("configuracoes.escola", "update")`.
- `anoLetivoDaData` muda de assinatura para `anoLetivoDaData(data: Date, anoReferencia: number)` — todo call site (incluindo o encadeamento client `matriculas/page.tsx` → `NovaMatriculaDialog` → `NovaMatriculaFields`) precisa ser atualizado na mesma task que muda a assinatura, senão o build quebra.
- O computed `ano_letivo_atual` (`src/lib/documents/resolver.ts`) só troca a fonte do valor (`String(anoReferencia)`), **não** ganha a regra de corte de setembro.
- Sem imagem de assinatura escaneada — `renderAssinaturas` do requerimento segue o padrão nome caixa-alta + cargo, como `certificado-pdf.ts`/`declaracao-pdf.ts`.
- Sem campos "Irmãos na Escola" / "Novo Endereço" no PDF do requerimento.
- Troca de ano de referência: sempre `+1`, sem campo de escolha, sem desfazer.
- `npm run typecheck && npm run build` verdes antes de fechar; `npm run test` antes do PR; migration exige `supabase db push --linked` manual (Vercel não aplica).

## Review Focus

- **Responsável financeiro ausente no modo lote**: aluno sem nenhuma linha `responsaveis_aluno.responsavel_financeiro = true` não pode derrubar a emissão dos demais — precisa cair em `falhas[]`, igual ao padrão de `carregarDeclaracoesAction`. Teste: lote com 1 aluno sem responsável financeiro entre 2 com → PDF sai com 2 páginas, `falhas` com 1 item.
- **Modo lote não deve vazar override de um aluno para os outros**: mesma regra "CRITICAL" já documentada em `declaracao-emissao-form.tsx` — o formulário do requerimento não pode ter nenhum campo de edição manual (Observações é o único campo livre, e é o mesmo para todos os alunos do lote, não por-aluno). Teste: Observações preenchida aparece idêntica em todas as páginas do PDF de um lote de 2+ alunos.
- **`anoLetivoDaData` com ano de referência indefinido/0** (escola sem linha migrada, ou config corrompida): `getAnoReferenciaAtual` precisa de um fallback explícito (`new Date().getFullYear()`) em vez de propagar `0`/`NaN` para o cálculo do corte de setembro — um ano letivo "0" quebraria todo filtro que o usa como padrão. Teste: `getAnoReferenciaAtual` retorna o ano do relógio quando a coluna é `null`/ausente.
- **Troca de ano de referência sem permissão**: usuário sem `configuracoes.escola:update` não pode acionar a troca mesmo manipulando o form diretamente (a action, não só a tela, precisa checar). Teste: action chamada sem permissão lança/redireciona antes de tocar no banco.
- **Aluno com dois responsáveis marcados como `responsavel_financeiro = true`** (dado inconsistente que o schema não impede — é `boolean`, não `unique`): a query de responsável financeiro do requerimento precisa de critério determinístico (ex. primeiro por nome, ou `limit(1)` com ordem fixa) em vez de comportamento indefinido do Supabase. Teste: dois responsáveis financeiros → página gerada usa sempre o mesmo (ordem estável), não lança erro.

---

## Task 1: Migration — ano de referência e campos do requerimento

**Files:**
- Create: `supabase/migrations/202610180001_ano_referencia.sql`
- Create: `supabase/migrations/202610180002_requerimento_matricula_campos.sql`

**Interfaces:**
- Produces: coluna `public.escolas.ano_referencia_atual int not null default extract(year from now())::int`; colunas `public.alunos.religiao text`; colunas `public.responsaveis_aluno.data_nascimento date`, `.estado_civil text`, `.escolaridade text`, `.profissao text`, `.endereco_trabalho text`, `.telefone_trabalho text`, `.cnpj text`.

- [ ] **Step 1: Escrever `202610180001_ano_referencia.sql`**

```sql
alter table public.escolas
  add column if not exists ano_referencia_atual int not null
    default extract(year from now())::int;
```

- [ ] **Step 2: Escrever `202610180002_requerimento_matricula_campos.sql`**

```sql
alter table public.alunos
  add column if not exists religiao text;

alter table public.responsaveis_aluno
  add column if not exists data_nascimento date,
  add column if not exists estado_civil text,
  add column if not exists escolaridade text,
  add column if not exists profissao text,
  add column if not exists endereco_trabalho text,
  add column if not exists telefone_trabalho text,
  add column if not exists cnpj text;
```

- [ ] **Step 3: Aplicar localmente e conferir**

Run: `supabase db push --linked` (ou o fluxo local do projeto, se diferente — ver nota do design doc: `db reset --local` está quebrado por bug de ordem preexistente, validar por revisão).
Expected: migrations aplicadas sem erro; `select ano_referencia_atual from escolas limit 1;` retorna o ano corrente.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/202610180001_ano_referencia.sql supabase/migrations/202610180002_requerimento_matricula_campos.sql
git commit -m "feat(db): adiciona ano_referencia_atual e campos do requerimento de matricula"
```

---

## Task 2: `getAnoReferenciaAtual` + migração de `anoLetivoDaData`

**Files:**
- Create: `src/lib/escola/ano-referencia.ts`
- Test: `src/lib/escola/ano-referencia.test.ts`
- Modify: `src/lib/matriculas/ano-letivo.ts`
- Modify: `src/lib/matriculas/ano-letivo.test.ts`
- Modify: `src/app/(app)/matriculas/page.tsx`
- Modify: `src/components/matriculas/nova-matricula-dialog.tsx`
- Modify: `src/components/matriculas/nova-matricula-fields.tsx`

**Interfaces:**
- Produces: `getAnoReferenciaAtual(supabase: SupabaseClient, escolaId: string): Promise<number>` em `src/lib/escola/ano-referencia.ts` — lê `escolas.ano_referencia_atual`; se a linha/coluna vier `null` ou a query falhar, retorna `new Date().getFullYear()` (nunca propaga `0`/`NaN`, ver Review Focus).
- Produces: `anoLetivoDaData(data: Date, anoReferencia: number): number` (assinatura alterada — era `anoLetivoDaData(data: Date)`). `anoLetivoSugerido(data: Date, anosOcupados: Iterable<number>, anoReferencia: number): number` (assinatura alterada, repassa `anoReferencia` para `anoLetivoDaData` internamente).
- Consumes (Task 5+ e qualquer outro consumidor futuro): `getAnoReferenciaAtual`.

- [ ] **Step 1: Escrever o teste de `getAnoReferenciaAtual`**

```ts
// src/lib/escola/ano-referencia.test.ts
import { describe, expect, it, vi } from "vitest";
import { getAnoReferenciaAtual } from "./ano-referencia";

function fakeSupabase(row: { ano_referencia_atual: number } | null, error: unknown = null) {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: row, error })
        })
      })
    })
  } as never;
}

describe("getAnoReferenciaAtual", () => {
  it("retorna o ano_referencia_atual da escola", async () => {
    const ano = await getAnoReferenciaAtual(fakeSupabase({ ano_referencia_atual: 2031 }), "escola-1");
    expect(ano).toBe(2031);
  });

  it("cai para o ano do relógio quando a linha não existe", async () => {
    vi.useFakeTimers().setSystemTime(new Date("2026-05-01"));
    const ano = await getAnoReferenciaAtual(fakeSupabase(null), "escola-1");
    expect(ano).toBe(2026);
    vi.useRealTimers();
  });

  it("cai para o ano do relógio quando a query falha", async () => {
    vi.useFakeTimers().setSystemTime(new Date("2026-05-01"));
    const ano = await getAnoReferenciaAtual(fakeSupabase(null, new Error("boom")), "escola-1");
    expect(ano).toBe(2026);
    vi.useRealTimers();
  });
});
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `npx vitest run src/lib/escola/ano-referencia.test.ts`
Expected: FAIL — módulo `./ano-referencia` não existe.

- [ ] **Step 3: Implementar `getAnoReferenciaAtual`**

Em `src/lib/escola/ano-referencia.ts`, usar o tipo de client Supabase já usado em `src/lib/data/declaracao-emissao.ts` (`SupabaseClient` de `@supabase/supabase-js` ou o tipo do projeto, conferir import padrão em qualquer `src/lib/data/*.ts`). `select("ano_referencia_atual").eq("id", escolaId).maybeSingle()` em `escolas`; `try/catch` ou checagem de `error`/`data` cobrindo os 3 casos do teste.

- [ ] **Step 4: Rodar e confirmar passagem**

Run: `npx vitest run src/lib/escola/ano-referencia.test.ts`
Expected: PASS (3 testes).

- [ ] **Step 5: Atualizar os testes existentes de `anoLetivoDaData`/`anoLetivoSugerido` para a nova assinatura**

Em `src/lib/matriculas/ano-letivo.test.ts`, adicionar o parâmetro `anoReferencia` em toda chamada (ex. `anoLetivoDaData(new Date("2026-10-01"), 2026)`), ajustando os valores esperados onde o teste hoje assume `data.getFullYear()` implícito — o ano de referência passa a ser a base, não mais `data.getFullYear()`.

- [ ] **Step 6: Rodar e confirmar falha**

Run: `npx vitest run src/lib/matriculas/ano-letivo.test.ts`
Expected: FAIL — assinatura ainda não mudou em `ano-letivo.ts`.

- [ ] **Step 7: Mudar a assinatura em `src/lib/matriculas/ano-letivo.ts`**

```ts
export function anoLetivoDaData(data: Date, anoReferencia: number): number {
  const mes = data.getMonth() + 1;
  return mes >= MES_CORTE_ANO_LETIVO ? anoReferencia + 1 : anoReferencia;
}

export function anoLetivoSugerido(
  data: Date,
  anosOcupados: Iterable<number>,
  anoReferencia: number
): number {
  const ocupados = new Set(anosOcupados);
  let ano = anoLetivoDaData(data, anoReferencia);
  while (ocupados.has(ano)) ano += 1;
  return ano;
}
```

Nota: a regra de corte passa a avançar a partir do **ano de referência**, não de `data.getFullYear()` — mantém o comportamento de negócio (matrícula de set-dez conta pro ano seguinte), mas ancorado na config, não no relógio da máquina.

- [ ] **Step 8: Rodar e confirmar passagem**

Run: `npx vitest run src/lib/matriculas/ano-letivo.test.ts`
Expected: PASS.

- [ ] **Step 9: Atualizar `src/app/(app)/matriculas/page.tsx`**

Buscar `escolaId` da sessão (mesmo padrão de `configuracoes/escola/page.tsx`: `session.profile.escola_id`) ou `DEFAULT_SCHOOL_ID` (confirmar qual este arquivo já usa hoje para outras queries — manter consistente). Chamar `const anoReferencia = await getAnoReferenciaAtual(supabase, escolaId);` antes do `Promise.all`, e trocar a linha 26 para `getAlunosSemMatriculaNoAno(anoLetivoDaData(new Date(), anoReferencia))`. Passar `anoReferencia` como nova prop para `<NovaMatriculaDialog anoReferencia={anoReferencia} ... />`.

- [ ] **Step 10: Atualizar `src/components/matriculas/nova-matricula-dialog.tsx`**

Adicionar prop `anoReferencia: number` à interface de props do componente e repassar para `<NovaMatriculaFields anoReferencia={anoReferencia} ... />`.

- [ ] **Step 11: Atualizar `src/components/matriculas/nova-matricula-fields.tsx`**

Adicionar prop `anoReferencia: number`. Trocar a chamada da linha 82 para `anoLetivoSugerido(hoje, ocupados, anoReferencia)`.

- [ ] **Step 12: Rodar typecheck**

Run: `npm run typecheck`
Expected: sem erros nos 3 arquivos de `matriculas/*` tocados.

- [ ] **Step 13: Commit**

```bash
git add src/lib/escola/ano-referencia.ts src/lib/escola/ano-referencia.test.ts src/lib/matriculas/ano-letivo.ts src/lib/matriculas/ano-letivo.test.ts "src/app/(app)/matriculas/page.tsx" src/components/matriculas/nova-matricula-dialog.tsx src/components/matriculas/nova-matricula-fields.tsx
git commit -m "feat: getAnoReferenciaAtual e anoLetivoDaData ancorados no ano de referencia"
```

---

## Task 3: Ação e tela de troca do ano de referência

**Files:**
- Create: `src/lib/actions/ano-referencia.ts`
- Test: `src/lib/actions/ano-referencia.test.ts`
- Create: `src/app/(app)/configuracoes/ano-referencia/page.tsx`

**Interfaces:**
- Consumes: `requirePermission` de `@/lib/auth/session` (`(modulo: ModuloCodigo, acao: Acao) => Promise<Session>`); `createServerClient` de `@/lib/supabase/server`.
- Produces: server action `avancarAnoReferenciaAction(): Promise<void>` (chamada via `<form action={...}>`, redireciona de volta para `/configuracoes/ano-referencia?salvo=1` ao final, mesmo padrão de `updateEscolaAction`).

- [ ] **Step 1: Escrever o teste da action**

```ts
// src/lib/actions/ano-referencia.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  client: null as unknown,
  requirePermission: vi.fn(),
  redirect: vi.fn()
}));
vi.mock("@/lib/auth/session", () => ({ requirePermission: h.requirePermission }));
vi.mock("next/navigation", () => ({ redirect: h.redirect }));
vi.mock("@/lib/supabase/server", () => ({ createServerClient: async () => h.client }));

import { avancarAnoReferenciaAction } from "./ano-referencia";

describe("avancarAnoReferenciaAction", () => {
  beforeEach(() => {
    h.requirePermission.mockReset().mockResolvedValue({ profile: { escola_id: "escola-1" } });
    h.redirect.mockReset();
  });

  it("checa a permissão configuracoes.escola:update antes de gravar", async () => {
    const update = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
    h.client = { from: () => ({ update, select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { ano_referencia_atual: 2026 }, error: null }) }) }) }) };

    await avancarAnoReferenciaAction();

    expect(h.requirePermission).toHaveBeenCalledWith("configuracoes.escola", "update");
  });

  it("propaga erro de permissão sem tocar no banco", async () => {
    h.requirePermission.mockRejectedValue(new Error("sem acesso"));
    const update = vi.fn();
    h.client = { from: () => ({ update }) };

    await expect(avancarAnoReferenciaAction()).rejects.toThrow("sem acesso");
    expect(update).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `npx vitest run src/lib/actions/ano-referencia.test.ts`
Expected: FAIL — `./ano-referencia` não existe.

- [ ] **Step 3: Implementar `avancarAnoReferenciaAction` em `src/lib/actions/ano-referencia.ts`**

`"use server"`. `requirePermission("configuracoes.escola", "update")` primeiro. Ler `ano_referencia_atual` atual de `escolas` (via `session.profile.escola_id`), gravar `+1` com `update(...).eq("id", escolaId)`, `revalidatePath("/configuracoes/ano-referencia")`, `redirect("/configuracoes/ano-referencia?salvo=1")` (padrão de `updateEscolaAction`).

- [ ] **Step 4: Rodar e confirmar passagem**

Run: `npx vitest run src/lib/actions/ano-referencia.test.ts`
Expected: PASS.

- [ ] **Step 5: Criar a página `src/app/(app)/configuracoes/ano-referencia/page.tsx`**

Seguir o padrão exato de `src/app/(app)/configuracoes/escola/page.tsx`: `export const dynamic = "force-dynamic";`, `requirePermission("configuracoes.escola", "read")`, busca `ano_referencia_atual` via `createServerClient()`, mapa `SUCESSOS`/`ERROS` para feedback via querystring. Campo readonly "Ano de referência atual". Toggle client Sim/Não (componente client pequeno, só estado local de UI — sem chamar a action até o Sim ser confirmado). Texto explicativo estático (por quê/quando/o que acontece, adaptado da tela de referência). `<form action={avancarAnoReferenciaAction}>` com botão "Confirmar", habilitado apenas quando o toggle estiver em "Sim".

- [ ] **Step 6: Rodar typecheck e build**

Run: `npm run typecheck && npm run build`
Expected: verdes.

- [ ] **Step 7: Commit**

```bash
git add src/lib/actions/ano-referencia.ts src/lib/actions/ano-referencia.test.ts "src/app/(app)/configuracoes/ano-referencia/page.tsx"
git commit -m "feat: tela e action de troca do ano de referencia"
```

---

## Task 4: Migrar os demais filtros de Ano para `getAnoReferenciaAtual`

**Files:**
- Modify: `src/app/(app)/alunos/page.tsx`
- Modify: `src/app/(app)/avaliacoes/*/page.tsx` (todas as rotas que hoje fazem o fallback `new Date().getFullYear()` em filtro de Ano)
- Modify: `src/app/(app)/declaracoes/emitir/page.tsx`
- Modify: `src/app/(app)/historico/*/page.tsx` (idem)
- Modify: `src/app/(app)/matriculas/saidas/page.tsx`
- Modify: `src/app/(app)/turmas/page.tsx`

**Interfaces:**
- Consumes: `getAnoReferenciaAtual(supabase, escolaId)` de `src/lib/escola/ano-referencia.ts` (Task 2).

- [ ] **Step 1: Listar os call sites exatos**

Run: `grep -rn "getFullYear()" src/app/\(app\)/`
Expected: lista os arquivos acima (e confirma se há mais algum fora da lista do design doc — se houver, decidir caso a caso se é "filtro de Ano" ou outro uso de `getFullYear` fora de escopo, conforme a seção "Fora de escopo" do design doc).

- [ ] **Step 2: Em cada arquivo, trocar o fallback**

Padrão: onde hoje é `const ano = Number(searchParams.ano) || new Date().getFullYear();` (ou equivalente), buscar `escolaId` já disponível na página (a maioria já faz outras queries com `DEFAULT_SCHOOL_ID`/`session.profile.escola_id`) e trocar para `const anoReferencia = await getAnoReferenciaAtual(supabase, escolaId); const ano = Number(searchParams.ano) || anoReferencia;`. A ação do usuário de escolher outro ano no filtro da tela continua sobrepondo normalmente (querystring sempre tem prioridade).

- [ ] **Step 3: Rodar typecheck e build**

Run: `npm run typecheck && npm run build`
Expected: verdes, nenhuma página quebrada.

- [ ] **Step 4: Rodar a suíte de testes completa**

Run: `npm run test`
Expected: sem regressão nos testes existentes dessas páginas/componentes.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(app)/alunos/page.tsx" "src/app/(app)/avaliacoes" "src/app/(app)/declaracoes/emitir/page.tsx" "src/app/(app)/historico" "src/app/(app)/matriculas/saidas/page.tsx" "src/app/(app)/turmas/page.tsx"
git commit -m "feat: filtros de Ano usam ano de referencia como padrao"
```

---

## Task 5: Computed `ano_letivo_atual` usa o ano de referência

**Files:**
- Modify: `src/lib/documents/resolver.ts`
- Test: localizar/criar `src/lib/documents/resolver.test.ts` (conferir se já existe; se sim, estender)

**Interfaces:**
- Consumes: `getAnoReferenciaAtual` (Task 2). `runComputed` já recebe `ResolverContext { supabase, matriculaId, alunoId, escolaId }` (conforme design doc) — usar `ctx.escolaId`.

- [ ] **Step 1: Escrever/estender o teste do computed**

```ts
it("ano_letivo_atual usa o ano de referência da escola, sem corte de mês", async () => {
  // arrange: fakeSupabase com escolas.ano_referencia_atual = 2031, data do sistema em dezembro
  const resultado = await runComputed("ano_letivo_atual", ctx);
  expect(resultado).toBe("2031");
});
```
Ajustar ao harness de teste real de `resolver.ts` (mock de Supabase já usado nos testes existentes desse arquivo, se houver; senão seguir o padrão `fakeSupabase` de `questionario/test-support`).

- [ ] **Step 2: Rodar e confirmar falha**

Run: `npx vitest run src/lib/documents/resolver.test.ts`
Expected: FAIL (ainda retorna `String(now.getFullYear())`).

- [ ] **Step 3: Trocar a linha 192-193 de `resolver.ts`**

```ts
case "ano_letivo_atual":
  return String(await getAnoReferenciaAtual(ctx.supabase, ctx.escolaId));
```
Importar `getAnoReferenciaAtual` de `@/lib/escola/ano-referencia`. Confirmar que `runComputed` já é `async` (se não for, propagar `async`/`await` pelos chamadores — checar assinatura real antes de aplicar).

- [ ] **Step 4: Rodar e confirmar passagem**

Run: `npx vitest run src/lib/documents/resolver.test.ts`
Expected: PASS.

- [ ] **Step 5: Rodar typecheck**

Run: `npm run typecheck`
Expected: verde (nenhum chamador de `runComputed` quebrado por `async`, se a assinatura mudou).

- [ ] **Step 6: Commit**

```bash
git add src/lib/documents/resolver.ts src/lib/documents/resolver.test.ts
git commit -m "feat: computed ano_letivo_atual usa o ano de referencia"
```

---

## Task 6: Data layer do requerimento — `listarAlunosParaRequerimento` e `buscarDadosRequerimento`

**Files:**
- Create: `src/lib/data/requerimento-matricula.ts`
- Test: `src/lib/data/requerimento-matricula.test.ts`

**Interfaces:**
- Produces:
  - `type AlunoParaRequerimento = { matriculaId: string; alunoId: string; nome: string }`
  - `type FiltroRequerimento = { anoLetivo: number; serieId?: string; turmaId?: string; alunoId?: string }`
  - `listarAlunosParaRequerimento(filtro: FiltroRequerimento): Promise<AlunoParaRequerimento[]>`
  - `type DadosRequerimento` — shape com todos os campos do PDF listados na seção "Layout do PDF" do design doc: dados do aluno (matrícula, nome, sexo, data nascimento, naturalidade, telefones, endereço, cpf, rg, etnia, religião), pai (objeto ou null), mãe (objeto ou null) — cada um com nome/rg/cpfOuCnpj/telefones/email/dataNascimento/estadoCivil/escolaridade/localTrabalho/profissao/telefoneTrabalho —, dados da matrícula (série, turma, turno, tipoEnsino, dataMatricula), responsável financeiro (nome, cpfOuCnpj, parentesco) ou `null`.
  - `buscarDadosRequerimento(matriculaId: string): Promise<DadosRequerimento>` — lança se a matrícula não existir (igual `buscarDadosDeclaracao`); responsável financeiro ausente vira `responsavelFinanceiro: null` no retorno (não lança) — quem decide se isso é falha é o caller (Task 8), conforme Review Focus.
- Consumes: `DEFAULT_SCHOOL_ID` de `@/lib/constants` (ou `escolaId` explícito — seguir o mesmo padrão de `listarAlunosParaDeclaracao`); `createServerClient` de `@/lib/supabase/server`.

- [ ] **Step 1: Escrever os testes de `listarAlunosParaRequerimento`**

```ts
// src/lib/data/requerimento-matricula.test.ts
describe("listarAlunosParaRequerimento", () => {
  it("filtra por ano letivo, série, turma e aluno quando informados", async () => { /* ... */ });
  it("ordena por nome (pt-BR)", async () => { /* ... */ });
});
```
Seguir o padrão de mock de `createServerClient` já usado nos testes de `declaracao-emissao` (buscar arquivo de teste irmão, se existir, para o mesmo helper de query builder encadeado; senão, mock manual do encadeamento `.from().select().eq().eq()...`).

- [ ] **Step 2: Rodar e confirmar falha**

Run: `npx vitest run src/lib/data/requerimento-matricula.test.ts`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar `listarAlunosParaRequerimento`**

Mesma forma de `listarAlunosParaDeclaracao` (`src/lib/data/declaracao-emissao.ts:21-45`): query em `matriculas` com `.select("id, aluno_id, alunos(nome)")`, filtros condicionais de `serieId`/`turmaId`/`alunoId`, `status in (...)` — para o requerimento, usar `["ativa"]` apenas (matrícula vigente; diferente da declaração, que inclui cancelada/transferida — o requerimento é documento de quem está matriculando, não de quem já saiu). Ordena por nome.

- [ ] **Step 4: Rodar e confirmar passagem**

Run: `npx vitest run src/lib/data/requerimento-matricula.test.ts`
Expected: PASS.

- [ ] **Step 5: Escrever os testes de `buscarDadosRequerimento`**

Casos: matrícula completa (aluno + pai + mãe + responsável financeiro) → todos os campos preenchidos; matrícula sem pai cadastrado → `pai: null`, resto preenchido; **dois responsáveis financeiros** (Review Focus) → retorna sempre o mesmo de forma determinística (ex. ordenado por `nome`, pega o primeiro) sem lançar; matrícula inexistente → lança `Error`.

- [ ] **Step 6: Rodar e confirmar falha**

Run: `npx vitest run src/lib/data/requerimento-matricula.test.ts`
Expected: FAIL (função ainda não implementada).

- [ ] **Step 7: Implementar `buscarDadosRequerimento`**

Query única em `matriculas` com nested select trazendo `alunos(*, responsaveis_aluno(*))`, `series(nome, segmento_id -> segmentos(nome))` (para tipo de ensino — reaproveitar a mesma lógica de `tipo_ensino_via_series_segmentos` referenciada no design doc; se for uma função SQL/RPC, chamá-la; se for lógica de resolver, replicar a consulta equivalente), `turmas(nome, turno)`. Separar `responsaveis_aluno` em pai/mãe por `parentesco` (comparação case-insensitive contendo "pai"/"mãe", já que o campo é texto livre — conferir valores reais usados no seed, ex. `"MÃE"`/`"Pai"`). Responsável financeiro: filtra `responsavel_financeiro = true`, ordena por `nome`, pega o primeiro (critério determinístico do Review Focus).

- [ ] **Step 8: Rodar e confirmar passagem**

Run: `npx vitest run src/lib/data/requerimento-matricula.test.ts`
Expected: PASS (todos os casos).

- [ ] **Step 9: Commit**

```bash
git add src/lib/data/requerimento-matricula.ts src/lib/data/requerimento-matricula.test.ts
git commit -m "feat: data layer de listagem e montagem do requerimento de matricula"
```

---

## Task 7: Renderer PDF `requerimento-matricula-pdf.ts`

**Files:**
- Create: `src/lib/documents/requerimento-matricula-pdf.ts`
- Test: `src/lib/documents/requerimento-matricula-pdf.test.ts`

**Interfaces:**
- Consumes: `DadosRequerimento` (Task 6); `ImagemCache` (`Map<string, { data: string; w: number; h: number }>`, já definido em `src/lib/documents/certificado-pdf.ts`); `companyLogoUrl(logoPath: string | null | undefined): string | null` de `@/lib/storage/company-logo-url`; `imgFitInBox` de `./pdf-utils`.
- Produces:
  - `type RequerimentoPdfDados = { dados: DadosRequerimento; observacoes: string | null; escola: { nome: string; cnpj: string | null; endereco: string | null; cidade: string | null; uf: string | null; cep: string | null; telefones: string | null; email: string | null; logoPath: string | null }; secretario: { nome: string | null; cargo: string } }`
  - `renderRequerimentos(paginas: RequerimentoPdfDados[], imagens: ImagemCache): jsPDF` — uma página A4 retrato por item de `paginas` (mesmo padrão de `renderDeclaracoes`).

- [ ] **Step 1: Escrever um teste de fumaça do renderer**

```ts
// src/lib/documents/requerimento-matricula-pdf.test.ts
import { describe, expect, it } from "vitest";
import { renderRequerimentos } from "./requerimento-matricula-pdf";

describe("renderRequerimentos", () => {
  it("gera uma página por item de entrada", () => {
    const doc = renderRequerimentos([paginaFake(), paginaFake()], new Map());
    expect(doc.getNumberOfPages()).toBe(2);
  });

  it("omite o bloco de um responsável ausente sem lançar", () => {
    const pagina = paginaFake();
    pagina.dados.pai = null;
    expect(() => renderRequerimentos([pagina], new Map())).not.toThrow();
  });
});

function paginaFake(): RequerimentoPdfDados { /* fixture mínima válida */ }
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `npx vitest run src/lib/documents/requerimento-matricula-pdf.test.ts`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar `requerimento-matricula-pdf.ts`**

Estrutura espelhando `declaracao-pdf.ts` (`new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" })`, `doc.addPage(...)` entre páginas) e o cabeçalho de `certificado-pdf.ts` (logo via `companyLogoUrl`/`imgFitInBox`, fonte `"times"`, conversão `mm()` se preciso). Seções em sequência conforme "Layout do PDF" do design doc: cabeçalho da escola, título com ano, bloco Dados do Aluno, bloco Pai (se não-null), bloco Mãe (se não-null), bloco Dados da Matrícula, bloco Responsável Financeiro (se não-null — caller já garantiu presença antes de chegar aqui no modo lote, conforme Task 8; no preview individual pode faltar e o bloco é omitido), Observações (se não-null/não-vazio), rodapé com local/data por extenso e `renderAssinaturas` privada do próprio arquivo (duas colunas: nome do secretário caixa-alta + "Secretário(a)" à esquerda, nome do responsável financeiro caixa-alta + "Responsável" à direita — `null` em qualquer um dos dois só omite aquela coluna, não lança).

- [ ] **Step 4: Rodar e confirmar passagem**

Run: `npx vitest run src/lib/documents/requerimento-matricula-pdf.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/documents/requerimento-matricula-pdf.ts src/lib/documents/requerimento-matricula-pdf.test.ts
git commit -m "feat: renderer jsPDF do requerimento de matricula"
```

---

## Task 8: Actions `previsualizarRequerimentoAction` / `carregarRequerimentosAction`

**Files:**
- Create: `src/lib/actions/requerimento-matricula.ts`
- Test: `src/lib/actions/requerimento-matricula.test.ts`

**Interfaces:**
- Consumes: `buscarDadosRequerimento`, `listarAlunosParaRequerimento` (Task 6); `requirePermission` de `@/lib/auth/session`.
- Produces:
  - `previsualizarRequerimentoAction(matriculaId: string): Promise<DadosRequerimento>` — `requirePermission("historico", "read")`, chama `buscarDadosRequerimento`, lança `Error("Responsável financeiro não cadastrado para este aluno.")` se `responsavelFinanceiro` vier `null` (bloqueia o preview individual, conforme design doc).
  - `carregarRequerimentosAction(matriculaIds: string[], observacoes: string | null): Promise<{ paginas: RequerimentoPdfDados[]; falhas: Array<{ nome: string; motivo: string }> }>` — `requirePermission("historico", "read")`, itera `matriculaIds` com `try/catch` por item (padrão exato de `carregarDeclaracoesAction`), responsável financeiro ausente vira entrada em `falhas` com motivo `"Responsável financeiro não cadastrado."` em vez de interromper o lote (Review Focus).

- [ ] **Step 1: Escrever o teste de `previsualizarRequerimentoAction` — responsável financeiro ausente bloqueia**

```ts
it("lança quando o aluno não tem responsável financeiro cadastrado", async () => {
  h.buscarDadosRequerimento.mockResolvedValue({ ...dadosFake, responsavelFinanceiro: null });
  await expect(previsualizarRequerimentoAction("matricula-1")).rejects.toThrow(/[Rr]esponsável financeiro/);
});
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `npx vitest run src/lib/actions/requerimento-matricula.test.ts`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar `previsualizarRequerimentoAction`**

Conforme Interfaces acima.

- [ ] **Step 4: Rodar e confirmar passagem**

Run: `npx vitest run src/lib/actions/requerimento-matricula.test.ts`
Expected: PASS.

- [ ] **Step 5: Escrever os testes de `carregarRequerimentosAction` — tolerância a falha por aluno**

```ts
it("lote com um aluno sem responsável financeiro: os outros saem normalmente e ele cai em falhas", async () => {
  h.buscarDadosRequerimento
    .mockResolvedValueOnce({ ...dadosFake, nomeAluno: "Ana", responsavelFinanceiro: dadosFake.responsavelFinanceiro })
    .mockResolvedValueOnce({ ...dadosFake, nomeAluno: "Beto", responsavelFinanceiro: null })
    .mockResolvedValueOnce({ ...dadosFake, nomeAluno: "Carla", responsavelFinanceiro: dadosFake.responsavelFinanceiro });

  const resultado = await carregarRequerimentosAction(["m1", "m2", "m3"], null);

  expect(resultado.paginas).toHaveLength(2);
  expect(resultado.falhas).toEqual([{ nome: "Beto", motivo: "Responsável financeiro não cadastrado." }]);
});

it("propaga a mesma observação para todas as páginas do lote", async () => {
  const resultado = await carregarRequerimentosAction(["m1", "m2"], "Observação do dia");
  expect(resultado.paginas.every((p) => p.observacoes === "Observação do dia")).toBe(true);
});
```

- [ ] **Step 6: Rodar e confirmar falha**

Run: `npx vitest run src/lib/actions/requerimento-matricula.test.ts`
Expected: FAIL.

- [ ] **Step 7: Implementar `carregarRequerimentosAction`**

Loop `for...of matriculaIds` com `try/catch` idêntico ao de `carregarDeclaracoesAction` (linhas 55-77 do arquivo de referência), com o caso extra de `responsavelFinanceiro === null` empurrando para `falhas` antes mesmo de tentar montar a página (não é uma exceção lançada por `buscarDadosRequerimento`, é checado explicitamente pela action).

- [ ] **Step 8: Rodar e confirmar passagem**

Run: `npx vitest run src/lib/actions/requerimento-matricula.test.ts`
Expected: PASS (todos os casos, incluindo Review Focus de responsável financeiro e de observação consistente no lote).

- [ ] **Step 9: Commit**

```bash
git add src/lib/actions/requerimento-matricula.ts src/lib/actions/requerimento-matricula.test.ts
git commit -m "feat: actions de preview e emissao do requerimento de matricula"
```

---

## Task 9: Tela `matriculas/requerimento` (form + página)

**Files:**
- Create: `src/app/(app)/matriculas/requerimento/page.tsx`
- Create: `src/components/matriculas/requerimento-emissao-form.tsx`
- Test: `src/components/matriculas/requerimento-emissao-form.test.tsx`

**Interfaces:**
- Consumes: `getAnoReferenciaAtual` (Task 2); `listarAlunosParaRequerimento` (Task 6); `previsualizarRequerimentoAction`, `carregarRequerimentosAction` (Task 8); `renderRequerimentos` (Task 7); `carregarImagens(urls: Array<string | null>): Promise<ImagemCache>` de `@/lib/documents/pdf-utils`.
- Produces: rota `/matriculas/requerimento`.

- [ ] **Step 1: Criar `src/app/(app)/matriculas/requerimento/page.tsx`**

Server Component espelhando `src/app/(app)/declaracoes/emitir/page.tsx`: `requirePermission("historico", "read")`, busca séries/turmas (`DEFAULT_SCHOOL_ID`, igual ao arquivo de referência), `anoLetivo = Number(searchParams.ano) || await getAnoReferenciaAtual(supabase, escolaId)`, busca alunos elegíveis via `listarAlunosParaRequerimento`, passa tudo como props para `<RequerimentoEmissaoForm />`.

- [ ] **Step 2: Escrever o teste de distinção Coletivo/Individual do form**

```tsx
// src/components/matriculas/requerimento-emissao-form.test.tsx
it("sem aluno selecionado, emite para todos os elegíveis (modo coletivo)", () => { /* ... */ });
it("com aluno selecionado, mostra preview antes de habilitar emitir (modo individual)", () => { /* ... */ });
it("observações preenchidas vão junto no payload de carregarRequerimentosAction", () => { /* ... */ });
```
Seguir o setup de mock de `declaracao-emissao-form.test.tsx`, se existir (`grep -l "declaracao-emissao-form" src/components/declaracoes/*.test.tsx`) como referência de harness (mock de `next/navigation`, mock das actions).

- [ ] **Step 3: Rodar e confirmar falha**

Run: `npx vitest run src/components/matriculas/requerimento-emissao-form.test.tsx`
Expected: FAIL — componente não existe.

- [ ] **Step 4: Implementar `requerimento-emissao-form.tsx`**

Clone estrutural de `declaracao-emissao-form.tsx`: filtros via `useSearchParams`/`router.push` (Ano, Série/Turma, Tipo de emissão Coletivo/Individual — campo novo que não existe na declaração, implementar como toggle que só altera se o filtro `aluno` fica ativo/desabilitado, já que a elegibilidade real continua sendo "aluno vazio = lote"), campo Aluno (obrigatório só se Individual), campo Observações (textarea controlado, **não** persiste em querystring — é estado local, enviado só no momento de emitir, igual seria um override de lote mas aqui é intencionalmente compartilhado por todas as páginas do lote, ver Review Focus). Botão "Emitir": modo individual chama `previsualizarRequerimentoAction` antes (preview), lote chama `carregarRequerimentosAction(matriculaIds, observacoes)` direto; ambos terminam com `carregarImagens([...]).then((imagens) => renderRequerimentos(paginas, imagens).save(nomeArquivo))`. Exibir `falhas` ao final, igual à declaração.

- [ ] **Step 5: Rodar e confirmar passagem**

Run: `npx vitest run src/components/matriculas/requerimento-emissao-form.test.tsx`
Expected: PASS.

- [ ] **Step 6: Rodar typecheck e build**

Run: `npm run typecheck && npm run build`
Expected: verdes.

- [ ] **Step 7: Commit**

```bash
git add "src/app/(app)/matriculas/requerimento/page.tsx" src/components/matriculas/requerimento-emissao-form.tsx src/components/matriculas/requerimento-emissao-form.test.tsx
git commit -m "feat: tela de emissao do requerimento de matricula"
```

---

## Task 10: Campos novos no cadastro de aluno/responsável + menu

**Files:**
- Modify: componente de cadastro/edição de aluno-responsável (confirmar o arquivo exato ao implementar — candidato principal `src/components/matriculas/matricula-full-edit-dialog.tsx`, conferir se há um form de responsável separado)
- Modify: `src/components/layout/topbar.tsx`
- Modify: `src/lib/documents/schema-catalog.ts` (remover o comentário/observação de desalinhamento, se houver, agora que `profissao`/`endereco_trabalho` existem de fato)

**Interfaces:**
- Consumes: nenhuma nova — usa as colunas da Task 1 direto via Server Action de atualização de aluno/responsável já existente (localizar a action real antes de editar — não criar uma nova).

- [ ] **Step 1: Localizar o form real de edição de aluno e de responsável**

Run: `grep -rln "responsavel_financeiro\|parentesco" src/components/`
Expected: aponta o(s) componente(s) de formulário que hoje editam `responsaveis_aluno` — confirmar se é um único dialog ou telas separadas antes do próximo passo.

- [ ] **Step 2: Adicionar os campos novos ao formulário encontrado**

Aluno: campo "Religião" (texto livre). Responsável: campos "Data de nascimento", "Estado civil" (select com valores livres observados no PDF: Casado(a)/Solteiro(a)/etc — usar texto livre se o schema não tiver enum, conforme Migration B), "Escolaridade", "Profissão", "Local de trabalho", "Telefone do trabalho", "CNPJ" (ao lado do CPF existente, mesma seção). Sem validação obrigatória — todos nullable.

- [ ] **Step 3: Rodar typecheck**

Run: `npm run typecheck`
Expected: verde.

- [ ] **Step 4: Adicionar os itens de menu em `topbar.tsx`**

"Requerimento de Matrícula" como item irmão de Associações/Entrada de Notas/Emissão/Certificado dentro do submenu Secretaria › Histórico Escolar (array hardcoded — seguir exatamente o padrão dos itens vizinhos). "Mudança do Ano de Referência" dentro do menu Configurações.

- [ ] **Step 5: Rodar o teste de RBAC de rotas, se existir**

Run: `grep -rl "ROTA_PARA_MODULO" src/lib/auth/*.test.ts` e rodar os testes encontrados — ex. `npx vitest run src/lib/auth/questionario-rbac.test.ts` (ou o teste geral de rotas, se as duas novas rotas (`/matriculas/requerimento`, `/configuracoes/ano-referencia`) precisarem de entrada em `ROTA_PARA_MODULO`).
Expected: se o teste existente cobrir todas as rotas do app, adicionar as duas novas entradas a `ROTA_PARA_MODULO` (`"/matriculas/requerimento": "historico"`, `"/configuracoes/ano-referencia": "configuracoes.escola"`) e rodar de novo até passar.

- [ ] **Step 6: Commit**

```bash
git add src/components/layout/topbar.tsx src/lib/auth/permissions.ts src/lib/documents/schema-catalog.ts
git commit -m "feat: campos de cadastro, menu e RBAC do requerimento e ano de referencia"
```

(ajustar a lista de `git add` ao form real localizado no Step 1)

---

## Task 11: Verificação final

- [ ] **Step 1: Rodar a suíte completa**

Run: `npm run typecheck && npm run build && npm run test`
Expected: tudo verde (o *unhandled error* pré-existente em `src/lib/hooks/use-action.test.tsx`, já conhecido e fora deste módulo conforme a spec do Questionário, pode persistir — não é regressão deste plano).

- [ ] **Step 2: Conferir manualmente a migration em staging/local antes do PR**

Run: `supabase db push --linked`
Expected: aplicada sem erro — sem isso, as duas telas novas quebram em Server Component com erro genérico (mesma classe de incidente do PR #43 do Questionário).

- [ ] **Step 3: Commit final (se houver ajustes de revisão pendentes)**

```bash
git add -A
git commit -m "chore: ajustes finais ano de referencia e requerimento de matricula"
```
