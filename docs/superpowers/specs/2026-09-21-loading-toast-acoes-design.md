# Padrão de Loading e Toast para Ações — Design

**Data:** 2026-09-21
**Status:** Aprovado para implementação
**Escopo:** Todos os botões de ação do sistema (Salvar, Alterar, Excluir, Adicionar, Ativar/Inativar), incluindo botões de ícone dentro de grids/tabelas.

## Problema

Hoje o usuário clica num botão de ação e a tela fica parada. Não há indicação de que algo está acontecendo, e nem toda ação informa o resultado. A auditoria do código confirmou três problemas distintos:

### 1. Três mecanismos de "pending" coexistem

| Mecanismo | Onde | Feedback |
|---|---|---|
| `useTransition` + `isPending` | 18 arquivos (`excluir-contrato-button.tsx`, `run-acoes.tsx`, `criar-card-modal.tsx`) | Só `disabled`, sem toast |
| `useState` + `try/finally` manual | `aluno-row-actions.tsx`, `delete-template-button.tsx` | `disabled` + toast |
| Nenhum | `toggle-employee-button.tsx`, todas as páginas com `<form action>` puro | Nada |

### 2. Bugs reais em produção: `NEXT_REDIRECT` tratado como erro

`redirect()` do Next.js funciona lançando uma exceção especial. Três componentes chamam actions que redirecionam dentro de um `try/catch` com toast, e portanto **transformam sucesso em mensagem de erro**:

- `src/components/students/aluno-row-actions.tsx:75-79` — toda exclusão bem-sucedida de aluno exibe "Falha ao excluir aluno." O `toast.success` da linha 76 é inalcançável.
- `src/components/rh/documentos/delete-template-button.tsx:17-27` — exibe o texto interno `NEXT_REDIRECT;...` como mensagem ao usuário.
- `src/components/rh/documentos/mapping-form.tsx:96-99` — mesmo problema ao salvar mapeamentos.

Não existe nenhum tratamento de `isRedirectError` no repositório.

### 3. Cinco contratos de Server Action diferentes

As 53 actions em `src/lib/actions/` se dividem em:

| Contrato | Comportamento | Exemplos |
|---|---|---|
| **A** | `redirect()` no sucesso e no erro (`?erro=`) | todo `users.ts`, `rh.ts`, `lancamentos.ts` |
| **B** | `throw` no erro + `redirect()` no sucesso | `folha.ts`, `templates.ts` |
| **C** | `throw` no erro + `revalidatePath()` + void | `disciplinas.ts`, maior parte de `academics.ts` |
| **D** | `throw` + `revalidatePath` + `redirect` | `createStudentAction`, `deleteStudentAction` |
| **E** | retorna objeto, sem redirect | `pipeline.ts`, `sicoob.ts`, `eventos.ts` |

O contrato E é internamente inconsistente: `{ok:false, error}` em `pipeline.ts`, `{ok:false, reason}` em `sicoob.ts`/`asaas.ts`/`conciliacao.ts`, `{success:false, error}` em `anamnese-export.ts`/`documents-generate-v2.ts`. `ActionResult<T>` está declarado duas vezes, independentemente (`pipeline.ts:41` e `whatsapp-inbox.ts:12`).

**Consequência crítica:** só o contrato E funciona com chamada client-side. Os contratos A/B/D entregam o refresh da tela *através* da navegação do redirect. Engolir o `NEXT_REDIRECT` para mostrar um toast deixa a tela com dados velhos.

## Decisões tomadas

1. **Converter todos os botões de ação para client-side**, inclusive os que hoje são `<form action>` nativo.
2. **`useTransition` é o mecanismo único** de pending.
3. **`Button` ganha prop `loading` nativa** (spinner interno + disabled automático).
4. **Helper centralizado** (`useAction`) cuida de transition + toast, para não depender de disciplina manual.
5. **Autorizado alterar Server Actions** — migrar contratos A/B/D para retorno `{ok, redirectTo}`. A regra "não alterar Server Actions" do `CLAUDE.md` pertence ao escopo da conversão visual do Design System; esta é outra frente.
6. **Banners `?erro=` viram toast** — remover a leitura de `searchParams.erro` e o markup do banner estático nas páginas afetadas.
7. **Permanecer em React 18.3** — `useTransition` funciona idêntico no 18.3; nada aqui precisa de React 19.
8. **Instalar `jsdom` + `@testing-library/react`** — o projeto não tem infraestrutura de teste de componente hoje.

### Por que não React 19

A spec original mencionava `useTransition` como "idiomático em React 19". O projeto está em React 18.3.1 + Next 14.2.35, e a verificação mostrou que subir para React 19 **não é um upgrade isolado**:

- `node_modules/next/package.json` (14.2.35) declara `peerDependencies: { "react": "^18.2.0", "react-dom": "^18.2.0" }` — sem entrada para React 19. Instalar React 19 aqui produz `ERESOLVE`; só passa com `--force`/`--legacy-peer-deps`. React 19 entrou no peer range a partir da linha do Next 15.
- A superfície de breaking change do React 19 **neste repo é mínima**: 3 arquivos usam `useFormState` (→ `useActionState`); zero ocorrências de `forwardRef`, `propTypes`, `defaultProps`, `ReactDOM.render`/`hydrate`, string refs, `useRef()` sem argumento, `React.FC` ou `JSX.Element`.
- Das 7 dependências que renderizam React, 6 já declaram suporte a React 19. Só `lucide-react@0.468.0` trava (`^19.0.0-rc` não satisfaz `19.x` estável), resolvido com bump de minor.
- **O custo real é o Next 14→15**: 339 arquivos `.tsx`, 148 com `"use client"`, mais migração de `params`/`searchParams`/`cookies()`/`headers()` para async e mudança dos defaults de cache.
- Next 16 ainda suporta React 18 (deprecado, remoção mirada para o Next 17) — não há prazo forçando a migração agora.

Conclusão: o upgrade Next 15 + React 19 é uma frente separada, com spec própria. `useAction` nasce compatível com ambos, já que `useTransition` não muda no React 19.

### Infraestrutura de teste

`vitest.config.ts` hoje usa `environment: "node"` e `include: ["src/**/*.test.ts"]` — só `.ts`, sem `.tsx`. Não há nenhum teste de componente React no repositório, nem `jsdom`, nem `@testing-library/react`.

Como o bug do `NEXT_REDIRECT` precisa de teste de regressão e o spinner do `Button` precisa de verificação de render, a Fase 1 instala:

- `jsdom` (devDependency)
- `@testing-library/react` (devDependency)
- `@testing-library/jest-dom` (devDependency, para matchers como `toBeDisabled`)

E ajusta `vitest.config.ts` para incluir `.tsx` e usar `environment: "jsdom"` nos testes de componente. Os testes `.ts` existentes (que rodam em `node`) continuam funcionando — a configuração usa `environmentMatchGlobs` para não forçar `jsdom` em tudo.

## Arquitetura

Três peças novas, em ordem de dependência.

### 1. Contrato único: `src/lib/actions/types.ts`

```ts
export type ActionResult<T = void> =
  | { ok: true; data: T; redirectTo?: string; message?: string }
  | { ok: false; error: string };
```

`redirectTo` é a peça que resolve o problema dos contratos A/B/D: em vez de a action chamar `redirect()`, ela **devolve** o destino e o cliente navega via `router.push()`. Assim o toast aparece *e* a navegação acontece.

`message` permite que a action sobrescreva a mensagem de sucesso padrão quando o resultado é dinâmico (ex: "12 alunos rematriculados, 3 ignorados").

Os dois `ActionResult` duplicados (`pipeline.ts:41`, `whatsapp-inbox.ts:12`) passam a reexportar deste arquivo.

### 2. `Button` com prop `loading`

`src/components/ui/button.tsx` hoje é um wrapper fino sem nenhum suporte a estado pendente. Passa a aceitar:

```tsx
<Button loading={pending}>Salvar</Button>
```

Comportamento:
- Renderiza spinner usando o token `@keyframes sp` já definido no Design System (`DESIGN-SYSTEM.md:703`, hoje sem uso em botões).
- Aplica `disabled` automaticamente — o CSS `.rb-btn:disabled { opacity:.5 }` já existe.
- Aplica `aria-busy="true"`.
- **Botão só de ícone:** quando não há texto (caso das grids), o spinner **substitui** o ícone no mesmo espaço de 8×8, preservando o layout da linha da tabela. Quando há texto, o spinner aparece à esquerda do label e o texto permanece visível.

A prop é opcional — nenhum call site existente quebra.

### 3. Hook `useAction` — `src/lib/hooks/use-action.ts`

```tsx
const { run, pending } = useAction(deleteStudentAction, {
  success: "Aluno excluído.",
  confirm: "Excluir este aluno?",   // opcional — usa o useConfirm existente
});

<Button loading={pending} onClick={() => run(formData)}>Excluir</Button>
```

Responsabilidades, em ordem:

1. Se `confirm` foi passado, abre o `useConfirm` existente e aborta se o usuário cancelar.
2. `startTransition` → chama a action.
3. **Detecta `isRedirectError`** e trata como sucesso (deixa o redirect propagar) — corrige os três bugs atuais e impede que se multipliquem.
4. Interpreta o resultado aceitando as três convenções legadas (`error`, `reason`, `success:false`) além do contrato novo, para permitir migração incremental.
5. Dispara `toast.success` / `toast.error`.
6. Se veio `redirectTo`, navega via `router.push()`.

O helper aceita `FormData` ou argumentos posicionais, cobrindo os dois estilos de action existentes.

### 4. Botões de ação em grid

As grids (`usuarios/page.tsx`, `matriculas-table.tsx`, `brackets-table.tsx`, e as tabelas de `disciplinas`/`series`/`turmas`) usam botões de ícone dentro de `<form>` invisíveis. Ganham um componente dedicado:

```tsx
<RowActionButton
  action={deactivateUserAction}
  args={{ perfilId: p.id }}
  icon={UserX}
  label="Desativar"
  confirm="Desativar este usuário?"
  success="Usuário desativado."
  tone="danger"
/>
```

Encapsula: `useAction`, o `title`/`aria-label`, as classes de cor por tom (`danger`/`warning`/`success`/`brand`), e a troca ícone↔spinner. Substitui o par `<form>` + `<button>` cru.

## Relação com `ConfirmButton`

`src/components/ui/confirm-button.tsx` hoje é **apenas um portão de confirmação**: chama `useConfirm()` e, se confirmado, faz `closest("form")?.requestSubmit()`. Não sabe se a submissão deu certo, nem que está em andamento — sem `disabled`, sem spinner, sem toast.

Como o novo padrão chama a action diretamente (sem `requestSubmit`), `ConfirmButton` torna-se redundante nos call sites migrados. **Não será removido nesta frente** — a opção `confirm` do `useAction` cobre o mesmo caso, e os call sites restantes de `ConfirmButton` (`disciplinas`, `series`, `turmas`) serão migrados para `useAction`/`RowActionButton`. A remoção do componente fica para uma limpeza posterior, quando não houver mais usos.

`useConfirm` / `confirm-dialog.tsx` permanecem como estão — são a base da opção `confirm`.

## Fases de implementação

Cada fase fecha com `npm run typecheck && npm run build` verdes.

**Fase 1 — Fundação (sem mudança de comportamento visível)**
- Infra de teste: `jsdom` + `@testing-library/react` + `@testing-library/jest-dom`; `vitest.config.ts` passa a incluir `.tsx` com `environmentMatchGlobs`.
- `ActionResult` em `src/lib/actions/types.ts`; os dois duplicados reexportam dele.
- `interpretActionResult` (função pura) + testes, incluindo o de regressão do `NEXT_REDIRECT`.
- `Button` com prop `loading`.
- `useAction` (casca fina sobre `interpretActionResult`).
- `RowActionButton`.

**Fase 2 — Correção dos bugs conhecidos**
- `aluno-row-actions.tsx`, `delete-template-button.tsx`, `mapping-form.tsx` migram para `useAction`. Isso já elimina os três falsos "erro" em sucesso.

**Fase 3 — Grids**
- `usuarios/page.tsx` (maior ofensor: resetar senha e desativar usuário sem confirmação alguma), `matriculas-table.tsx` (zero feedback hoje), `brackets-table.tsx`, e as ações de linha de `disciplinas`/`series`/`turmas`.

**Fase 4 — Formulários de página**
- `disciplinas`, `series`, `turmas`, `usuarios/[id]/editar`, `categoria-financeira-form`, `associacao-form`, páginas de `rh/folha-v2` (rubricas, contratos), `importacoes`, `portaria/dispositivos`.
- Migração das actions correspondentes para `{ok, redirectTo}` e remoção dos banners `?erro=`.

**Fase 5 — Uniformização do contrato E**
- `reason` → `error` em `sicoob.ts`, `asaas.ts`, `conciliacao.ts`; `success` → `ok` em `anamnese-export.ts`, `documents-generate-v2.ts`. Atualizar os 3 call sites de `useFormState` (`evento-form.tsx`, `atualizar-extrato-button.tsx`, `pix-avulso-form.tsx`).

## Testes

A lógica de risco fica numa função pura separada do hook, para ser testável sem React e para manter o hook como casca fina:

```ts
// src/lib/actions/interpret-result.ts
export function interpretActionResult(
  outcome: { kind: "value"; value: unknown } | { kind: "error"; error: unknown },
  opts: { success?: string; error?: string }
): {
  toast: "success" | "error" | "none";
  message: string;
  redirectTo?: string;
  refresh: boolean;
  /** Excecoes de controle do Next (redirect/notFound) precisam subir. */
  rethrow: boolean;
}
```

- **Unitário (`interpretActionResult`) — `.test.ts`, sem React:**
  - `{ok:true}` → `success`, mensagem padrão.
  - `{ok:true, message}` → `success` com a mensagem da action.
  - `{ok:true, redirectTo}` → `success` + `redirectTo` preenchido.
  - `{ok:false, error}` → `error` com a mensagem.
  - `{ok:false, reason}` → `error` (convenção legada de `sicoob`/`asaas`/`conciliacao`).
  - `{success:false, error}` → `error` (convenção legada de `anamnese-export`/`documents-generate-v2`).
  - `{success:true}` → `success` (mesma convenção legada, ramo de sucesso).
  - `undefined` (contrato C, void) → `success` + `refresh: true`.
  - **erro com `digest` começando em `NEXT_REDIRECT`** → `toast: "none"`, `rethrow: true`, e a exceção é relançada pelo hook. **Este é o teste de regressão dos três bugs atuais.**
  - erro com `digest === "NEXT_NOT_FOUND"` → idem (`notFound()` também é fluxo de controle do Next).
  - `Error` comum → `error` com `error.message`.
  - exceção que não é `Error` → `error` com a mensagem padrão.
- **Componente (`Button`) — `.test.tsx`, jsdom:** `loading` aplica `disabled` e `aria-busy="true"`; com texto o label continua visível; sem texto (botão de ícone) o spinner ocupa o lugar do ícone.
- **Hook (`useAction`) — `.test.tsx`, jsdom:** `confirm` cancelado não chama a action; `pending` é `true` durante a execução; `redirectTo` dispara `router.push`.

## Riscos

| Risco | Mitigação |
|---|---|
| Migrar action de `redirect()` para `redirectTo` quebra um fluxo de navegação | Migração fase a fase, com `typecheck`+`build` por fase; fases 1-3 não tocam em actions de redirect |
| `revalidatePath` acontece mas a tela não atualiza sem o redirect | Quando a action devolve `redirectTo`, o `router.push()` dispara o re-render. Quando a action só revalida e não navega (contrato C — `disciplinas`, `academics`), o `useAction` chama `router.refresh()` após o sucesso. |
| Duplicação de mensagem (banner + toast) durante a transição | Remoção do banner na mesma fase que migra a página |

## Fora de escopo

- Remoção do `ConfirmButton` (fica para limpeza posterior).
- `revalidateTag` (não usado em lugar nenhum hoje; não será introduzido).
- Páginas sem ações de mutação — `organograma` é read-only e não entra.
