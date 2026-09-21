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
- `ActionResult` em `src/lib/actions/types.ts`; os dois duplicados reexportam dele.
- `Button` com prop `loading`.
- `useAction` com tratamento de `isRedirectError`.
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

- **Unitário (`useAction`):** sucesso → `toast.success`; erro retornado → `toast.error` com a mensagem; `throw` → `toast.error`; **`NEXT_REDIRECT` → tratado como sucesso, sem toast de erro** (o teste de regressão dos três bugs); `confirm` cancelado → action não é chamada; `redirectTo` → `router.push` chamado.
- **Unitário (`Button`):** `loading` aplica `disabled` e `aria-busy`; em botão de ícone o spinner substitui o ícone.
- **Compatibilidade de contrato:** o interpretador reconhece `{ok:false,error}`, `{ok:false,reason}` e `{success:false,error}`.

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
