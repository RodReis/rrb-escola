# Padrão de Loading e Toast para Ações — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

## Status: concluído (2026-09-21)

As 12 tasks (5 fases) deste plano foram implementadas e commitadas em `main`. Verificação manual (Step de cada task pedindo `npm run dev`) não rodou durante a implementação original — foi feita depois, em sessão de QA com o usuário, e revelou telas fora do escopo original que também precisavam do padrão. Ver **Trabalho adicional pós-plano** no fim deste arquivo.

Trava de qualidade (`npm run typecheck && npm run build && npm run test`) verde em cada commit.

**Goal:** Todo botão de ação do sistema (Salvar, Excluir, Ativar/Inativar, Adicionar), incluindo os botões de ícone das grids, mostra estado de carregamento e informa o resultado por toast.

**Architecture:** Três peças novas em `src/`: um contrato único `ActionResult` para Server Actions, uma função pura `interpretActionResult` que traduz qualquer retorno/exceção de action em instrução de toast, e um hook `useAction` que combina `useTransition` + confirmação + toast + navegação. O `Button` existente ganha prop `loading` opcional. A lógica de risco fica na função pura para ser testável sem React.

**Tech Stack:** Next.js 14.2.35 (App Router), React 18.3.1, TypeScript 5.4, Tailwind, sonner 1.7.4 (toast, já instalado), vitest 4.1.7. Fase 1 adiciona `jsdom` + `@testing-library/react` + `@testing-library/jest-dom`.

**Spec:** `docs/superpowers/specs/2026-09-21-loading-toast-acoes-design.md`

## Global Constraints

- **Permanecer em React 18.3.1 e Next 14.2.35.** Não subir versão de framework neste plano. `useTransition` funciona idêntico no 18.3.
- **Português (PT-BR)** em toda mensagem visível ao usuário (toasts, confirmações, labels).
- **Cor só via token** (`var(--token)` ou classes Tailwind tokenizadas). Proibido hex/rgb cru. Regra de `CLAUDE.md`.
- **Sem serifa.** Títulos em Bricolage Grotesque.
- **Reaproveitar nomes existentes** (`ds-*`, `src/components/ui/*`): trocar o visual interno, não a API pública.
- **Trava de qualidade por fase:** `npm run typecheck && npm run build` verdes antes de fechar cada fase. `npm run test` antes do PR.
- **Branch dedicada**, um commit por tarefa.
- O spinner usa o token já existente no Design System: `@keyframes sp` (`DESIGN-SYSTEM.md:703`), `width:13px;height:13px;border:2px solid color-mix(in oklab,var(--brand-600) 30%,transparent);border-top-color:var(--brand-600);border-radius:50%;animation:sp .7s linear infinite`.
- **Nunca engolir `NEXT_REDIRECT`.** Toda exceção cujo `digest` comece com `NEXT_REDIRECT` deve ser relançada, nunca transformada em toast de erro.

---

## Estrutura de arquivos

**Criar:**

| Arquivo | Responsabilidade |
|---|---|
| `src/lib/actions/types.ts` | Tipo `ActionResult<T>` — contrato único de retorno |
| `src/lib/actions/interpret-result.ts` | Função pura: traduz retorno/exceção de action em instrução de toast |
| `src/lib/actions/interpret-result.test.ts` | Testes da função pura, incluindo regressão do `NEXT_REDIRECT` |
| `src/lib/hooks/use-action.ts` | Hook `useAction` — `useTransition` + confirm + toast + navegação |
| `src/components/ui/spinner.tsx` | Spinner isolado, usado pelo `Button` e pelo `RowActionButton` |
| `src/components/ui/row-action-button.tsx` | Botão de ícone para ações de linha de grid |
| `src/components/ui/button.test.tsx` | Testes do `Button` com `loading` |
| `src/lib/hooks/use-action.test.tsx` | Testes do hook |

**Modificar:**

| Arquivo | Mudança |
|---|---|
| `vitest.config.ts` | Incluir `.tsx`, `environmentMatchGlobs` para jsdom |
| `package.json` | 3 devDependencies de teste |
| `src/components/ui/button.tsx` | Prop `loading` |
| `src/lib/actions/pipeline.ts:41` | Reexportar `ActionResult` de `types.ts` |
| `src/lib/actions/whatsapp-inbox.ts:12` | Reexportar `ActionResult` de `types.ts` |

---

### Task 1: Infraestrutura de teste de componente

O projeto não tem nenhum teste de componente React. `vitest.config.ts` usa `environment: "node"` e `include: ["src/**/*.test.ts"]` — só `.ts`. Esta tarefa habilita `.tsx` sem quebrar os ~40 testes `.ts` existentes, que devem continuar rodando em `node`.

**Files:**
- Modify: `vitest.config.ts`
- Modify: `package.json`
- Create: `src/test-setup.ts`

**Interfaces:**
- Consumes: nada (primeira tarefa)
- Produces: capacidade de escrever `*.test.tsx` com `render`/`screen` de `@testing-library/react` e matchers `toBeDisabled()`/`toHaveAttribute()`.

- [x] **Step 1: Instalar as dependências de teste**

```bash
npm install -D jsdom@^25.0.1 @testing-library/react@^16.1.0 @testing-library/jest-dom@^6.6.3
```

Nota: `@testing-library/react` 16.x suporta React 18 e 19. Não instalar a 15.x.

- [x] **Step 2: Criar o arquivo de setup**

`src/test-setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => {
  cleanup();
});
```

- [x] **Step 3: Ajustar a configuração do vitest**

`vitest.config.ts` — substituir o bloco `test` inteiro por:

```ts
  test: {
    environment: "node",
    environmentMatchGlobs: [["src/**/*.test.tsx", "jsdom"]],
    setupFiles: ["src/test-setup.ts"],
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    passWithNoTests: true,
    fileParallelism: false,
  },
```

Manter o bloco `resolve.alias` como está (o alias `@` e o mock de `server-only` continuam necessários).

- [x] **Step 4: Verificar que os testes existentes continuam passando**

Run: `npm run test`
Expected: PASS — mesma quantidade de testes de antes, nenhum quebrado. Se algum teste `.ts` falhar, a causa provável é o `setupFiles` rodando em ambiente `node`; nesse caso o import de `@testing-library/jest-dom/vitest` precisa ser condicional.

- [x] **Step 5: Commit**

```bash
git add vitest.config.ts package.json package-lock.json src/test-setup.ts
git commit -m "test: habilita testes de componente com jsdom e testing-library"
```

---

### Task 2: Contrato `ActionResult`

**Files:**
- Create: `src/lib/actions/types.ts`
- Modify: `src/lib/actions/pipeline.ts:41`
- Modify: `src/lib/actions/whatsapp-inbox.ts:12`

**Interfaces:**
- Consumes: nada
- Produces: `ActionResult<T>` — usado pelas Tasks 3, 4, 6 e por todas as actions migradas nas fases 4 e 5.

- [x] **Step 1: Criar o tipo**

`src/lib/actions/types.ts`:

```ts
/**
 * Contrato único de retorno das Server Actions.
 *
 * `redirectTo` substitui a chamada de `redirect()` dentro da action:
 * a action devolve o destino e o cliente navega, para que o toast
 * apareça e a navegação aconteça — as duas coisas.
 *
 * `message` sobrescreve a mensagem de sucesso padrão quando o
 * resultado é dinâmico (ex: "12 rematriculados, 3 ignorados").
 */
export type ActionResult<T = void> =
  | { ok: true; data: T; redirectTo?: string; message?: string }
  | { ok: false; error: string };
```

- [x] **Step 2: Reexportar nos dois arquivos que declaram o tipo em duplicata**

Em `src/lib/actions/pipeline.ts`, remover a declaração local de `ActionResult` (linha 41) e colocar no lugar:

```ts
export type { ActionResult } from "./types";
```

Fazer o mesmo em `src/lib/actions/whatsapp-inbox.ts` (linha 12).

Atenção: `pipeline-anamnese.ts:14` e `pipeline-indicadores.ts:5` fazem `import type { ActionResult } from "@/lib/actions/pipeline"` — a reexportação mantém esses imports funcionando sem alteração.

- [x] **Step 3: Verificar que nada quebrou**

Run: `npm run typecheck`
Expected: PASS sem erros. O tipo antigo e o novo são estruturalmente compatíveis nos campos `ok`/`data`/`error`; os campos `redirectTo` e `message` são opcionais e novos.

- [x] **Step 4: Commit**

```bash
git add src/lib/actions/types.ts src/lib/actions/pipeline.ts src/lib/actions/whatsapp-inbox.ts
git commit -m "refactor(actions): contrato unico ActionResult"
```

---

### Task 3: `interpretActionResult` — a lógica de risco, testada

Esta é a tarefa mais importante do plano. Ela contém o teste de regressão dos três bugs que hoje mostram erro quando a ação dá certo.

Contexto do bug: `redirect()` do Next.js funciona lançando uma exceção cujo `digest` é a string `"NEXT_REDIRECT;push;/destino;307;"`. Um `try/catch` genérico captura essa exceção como se fosse falha. Hoje `aluno-row-actions.tsx:77-79`, `delete-template-button.tsx:22-24` e `mapping-form.tsx:98-99` fazem exatamente isso.

**Files:**
- Create: `src/lib/actions/interpret-result.ts`
- Create: `src/lib/actions/interpret-result.test.ts`

**Interfaces:**
- Consumes: `ActionResult` de `src/lib/actions/types.ts` (Task 2)
- Produces:
  ```ts
  type Outcome =
    | { kind: "value"; value: unknown }
    | { kind: "error"; error: unknown };

  type Instruction = {
    toast: "success" | "error" | "none";
    message: string;
    redirectTo?: string;
    refresh: boolean;
    rethrow: boolean;
  };

  function interpretActionResult(
    outcome: Outcome,
    opts: { success?: string; error?: string }
  ): Instruction;
  ```
  Usado pela Task 5 (`useAction`).

- [x] **Step 1: Escrever os testes que falham**

`src/lib/actions/interpret-result.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { interpretActionResult } from "./interpret-result";

const opts = { success: "Salvo.", error: "Falhou." };

function value(v: unknown) {
  return { kind: "value" as const, value: v };
}
function thrown(e: unknown) {
  return { kind: "error" as const, error: e };
}

describe("interpretActionResult", () => {
  it("trata retorno {ok:true} como sucesso com a mensagem padrao", () => {
    const r = interpretActionResult(value({ ok: true, data: undefined }), opts);
    expect(r.toast).toBe("success");
    expect(r.message).toBe("Salvo.");
    expect(r.rethrow).toBe(false);
  });

  it("usa a mensagem da action quando ela vem em message", () => {
    const r = interpretActionResult(
      value({ ok: true, data: undefined, message: "12 rematriculados." }),
      opts
    );
    expect(r.toast).toBe("success");
    expect(r.message).toBe("12 rematriculados.");
  });

  it("propaga redirectTo do retorno", () => {
    const r = interpretActionResult(
      value({ ok: true, data: undefined, redirectTo: "/alunos" }),
      opts
    );
    expect(r.toast).toBe("success");
    expect(r.redirectTo).toBe("/alunos");
  });

  it("trata {ok:false,error} como erro com a mensagem da action", () => {
    const r = interpretActionResult(value({ ok: false, error: "CPF invalido." }), opts);
    expect(r.toast).toBe("error");
    expect(r.message).toBe("CPF invalido.");
  });

  it("aceita a convencao legada {ok:false,reason} de sicoob/asaas/conciliacao", () => {
    const r = interpretActionResult(value({ ok: false, reason: "Sem saldo." }), opts);
    expect(r.toast).toBe("error");
    expect(r.message).toBe("Sem saldo.");
  });

  it("aceita a convencao legada {success:false,error} de anamnese-export", () => {
    const r = interpretActionResult(value({ success: false, error: "Template ausente." }), opts);
    expect(r.toast).toBe("error");
    expect(r.message).toBe("Template ausente.");
  });

  it("aceita a convencao legada {success:true}", () => {
    const r = interpretActionResult(value({ success: true }), opts);
    expect(r.toast).toBe("success");
    expect(r.message).toBe("Salvo.");
  });

  it("trata retorno void (contrato C) como sucesso e pede refresh", () => {
    const r = interpretActionResult(value(undefined), opts);
    expect(r.toast).toBe("success");
    expect(r.refresh).toBe(true);
  });

  // REGRESSAO: hoje aluno-row-actions.tsx:77 mostra "Falha ao excluir aluno."
  // em toda exclusao BEM-SUCEDIDA, porque redirect() lanca NEXT_REDIRECT.
  it("nao transforma NEXT_REDIRECT em erro; relanca para o Next navegar", () => {
    const redirectError = Object.assign(new Error("NEXT_REDIRECT"), {
      digest: "NEXT_REDIRECT;push;/alunos;307;",
    });
    const r = interpretActionResult(thrown(redirectError), opts);
    expect(r.toast).toBe("none");
    expect(r.rethrow).toBe(true);
  });

  it("nao transforma NEXT_NOT_FOUND em erro; relanca", () => {
    const notFound = Object.assign(new Error("NEXT_NOT_FOUND"), {
      digest: "NEXT_NOT_FOUND",
    });
    const r = interpretActionResult(thrown(notFound), opts);
    expect(r.toast).toBe("none");
    expect(r.rethrow).toBe(true);
  });

  it("trata Error comum como erro usando error.message", () => {
    const r = interpretActionResult(thrown(new Error("Serie e nome obrigatorios")), opts);
    expect(r.toast).toBe("error");
    expect(r.message).toBe("Serie e nome obrigatorios");
    expect(r.rethrow).toBe(false);
  });

  it("usa a mensagem de erro padrao quando a excecao nao e Error", () => {
    const r = interpretActionResult(thrown("qualquer coisa"), opts);
    expect(r.toast).toBe("error");
    expect(r.message).toBe("Falhou.");
  });
});
```

- [x] **Step 2: Rodar os testes e confirmar que falham**

Run: `npx vitest run src/lib/actions/interpret-result.test.ts`
Expected: FAIL — "Failed to resolve import ./interpret-result" ou "interpretActionResult is not a function".

- [x] **Step 3: Implementar a função**

`src/lib/actions/interpret-result.ts`:

```ts
export type Outcome =
  | { kind: "value"; value: unknown }
  | { kind: "error"; error: unknown };

export type Instruction = {
  toast: "success" | "error" | "none";
  message: string;
  redirectTo?: string;
  refresh: boolean;
  /** Excecoes de controle do Next (redirect/notFound) precisam subir. */
  rethrow: boolean;
};

const DEFAULT_SUCCESS = "Operação concluída.";
const DEFAULT_ERROR = "Não foi possível concluir a operação.";

/**
 * `redirect()` e `notFound()` do Next funcionam lançando uma exceção
 * cujo `digest` identifica a intenção. Capturar isso como falha é o
 * bug que faz uma exclusão bem-sucedida exibir "Falha ao excluir".
 */
function isNextControlFlowError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const digest = (error as { digest?: unknown }).digest;
  if (typeof digest !== "string") return false;
  return digest.startsWith("NEXT_REDIRECT") || digest === "NEXT_NOT_FOUND";
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function firstString(...values: unknown[]): string | null {
  for (const v of values) {
    if (typeof v === "string" && v.trim() !== "") return v;
  }
  return null;
}

export function interpretActionResult(
  outcome: Outcome,
  opts: { success?: string; error?: string } = {}
): Instruction {
  const successMsg = opts.success ?? DEFAULT_SUCCESS;
  const errorMsg = opts.error ?? DEFAULT_ERROR;

  if (outcome.kind === "error") {
    if (isNextControlFlowError(outcome.error)) {
      return { toast: "none", message: "", refresh: false, rethrow: true };
    }
    const fromError =
      outcome.error instanceof Error ? outcome.error.message : null;
    return {
      toast: "error",
      message: firstString(fromError) ?? errorMsg,
      refresh: false,
      rethrow: false,
    };
  }

  const record = asRecord(outcome.value);

  // Contrato C: action retorna void apos revalidatePath.
  if (record === null) {
    return { toast: "success", message: successMsg, refresh: true, rethrow: false };
  }

  // `ok` (contrato novo e pipeline/whatsapp) ou `success` (anamnese-export,
  // documents-generate-v2). Ausencia dos dois = objeto de dados, tratado
  // como sucesso.
  const flag = record.ok ?? record.success;
  const failed = flag === false;

  if (failed) {
    // `error` no contrato novo; `reason` em sicoob/asaas/conciliacao.
    const message = firstString(record.error, record.reason) ?? errorMsg;
    return { toast: "error", message, refresh: false, rethrow: false };
  }

  const redirectTo = firstString(record.redirectTo) ?? undefined;
  return {
    toast: "success",
    message: firstString(record.message) ?? successMsg,
    redirectTo,
    // Sem navegacao, a tela precisa de refresh para refletir o revalidatePath.
    refresh: redirectTo === undefined,
    rethrow: false,
  };
}
```

- [x] **Step 4: Rodar os testes e confirmar que passam**

Run: `npx vitest run src/lib/actions/interpret-result.test.ts`
Expected: PASS — 12 testes.

- [x] **Step 5: Commit**

```bash
git add src/lib/actions/interpret-result.ts src/lib/actions/interpret-result.test.ts
git commit -m "feat(actions): interpretActionResult trata os 5 contratos e NEXT_REDIRECT"
```

---

### Task 4: `Button` com prop `loading`

**Files:**
- Create: `src/components/ui/spinner.tsx`
- Modify: `src/components/ui/button.tsx`
- Create: `src/components/ui/button.test.tsx`

**Interfaces:**
- Consumes: nada
- Produces:
  - `<Spinner size?: number, className?: string />`
  - `<Button loading?: boolean>` — quando `true`, aplica `disabled` e `aria-busy="true"`.
  Usado pelas Tasks 6 em diante.

- [x] **Step 1: Escrever os testes que falham**

`src/components/ui/button.test.tsx`:

```tsx
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Button } from "./button";

describe("Button loading", () => {
  it("nao fica desabilitado quando loading e false", () => {
    render(<Button loading={false}>Salvar</Button>);
    expect(screen.getByRole("button")).not.toBeDisabled();
  });

  it("desabilita e marca aria-busy quando loading e true", () => {
    render(<Button loading>Salvar</Button>);
    const btn = screen.getByRole("button");
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute("aria-busy", "true");
  });

  it("mantem o texto visivel durante o loading", () => {
    render(<Button loading>Salvar</Button>);
    expect(screen.getByRole("button")).toHaveTextContent("Salvar");
  });

  it("renderiza o spinner quando loading", () => {
    render(<Button loading>Salvar</Button>);
    expect(screen.getByTestId("spinner")).toBeInTheDocument();
  });

  it("nao renderiza spinner quando nao esta carregando", () => {
    render(<Button>Salvar</Button>);
    expect(screen.queryByTestId("spinner")).not.toBeInTheDocument();
  });

  it("respeita disabled explicito mesmo sem loading", () => {
    render(<Button disabled>Salvar</Button>);
    expect(screen.getByRole("button")).toBeDisabled();
  });
});
```

- [x] **Step 2: Rodar e confirmar que falham**

Run: `npx vitest run src/components/ui/button.test.tsx`
Expected: FAIL — o `Button` atual não aceita `loading`, então `aria-busy` e o spinner não existem. O teste de `disabled` explícito deve passar já.

- [x] **Step 3: Criar o Spinner**

`src/components/ui/spinner.tsx`:

```tsx
import { cn } from "@/lib/utils";

/**
 * Usa o token `sp` do Design System (DESIGN-SYSTEM.md:703).
 * `currentColor` faz o spinner herdar a cor do botao que o contem,
 * para funcionar em qualquer variante (primary, danger, ghost).
 */
export function Spinner({
  size = 13,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <span
      data-testid="spinner"
      aria-hidden="true"
      className={cn("ds-spinner inline-block flex-shrink-0", className)}
      style={{ width: size, height: size }}
    />
  );
}
```

Adicionar em `src/app/globals.css` (junto das outras classes `ds-*`):

```css
@keyframes ds-spin {
  to {
    transform: rotate(360deg);
  }
}

.ds-spinner {
  border: 2px solid color-mix(in oklab, currentColor 25%, transparent);
  border-top-color: currentColor;
  border-radius: 50%;
  animation: ds-spin 0.7s linear infinite;
}

@media (prefers-reduced-motion: reduce) {
  .ds-spinner {
    animation-duration: 2s;
  }
}
```

- [x] **Step 4: Adicionar a prop `loading` ao Button**

`src/components/ui/button.tsx` — substituir o tipo `ButtonProps` e a função `Button`:

```tsx
type ButtonProps = ComponentPropsWithoutRef<"button"> & {
  variant?: keyof typeof variants;
  /** Mostra spinner, desabilita o botao e marca aria-busy. */
  loading?: boolean;
};

export function Button({
  className,
  variant = "primary",
  loading = false,
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn("ds-button", variants[variant], className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <Spinner className="mr-1.5" />}
      {children}
    </button>
  );
}
```

Adicionar o import no topo do arquivo:

```tsx
import { Spinner } from "./spinner";
```

Manter `ButtonLink` e o objeto `variants` exatamente como estão.

- [x] **Step 5: Rodar os testes e confirmar que passam**

Run: `npx vitest run src/components/ui/button.test.tsx`
Expected: PASS — 6 testes.

- [x] **Step 6: Verificar que nenhum call site existente quebrou**

Run: `npm run typecheck`
Expected: PASS. A prop `loading` é opcional com default `false`, então os ~100 usos existentes de `<Button>` continuam válidos.

- [x] **Step 7: Commit**

```bash
git add src/components/ui/spinner.tsx src/components/ui/button.tsx src/components/ui/button.test.tsx src/app/globals.css
git commit -m "feat(ui): Button com prop loading e spinner tokenizado"
```

---

### Task 5: Hook `useAction`

**Files:**
- Create: `src/lib/hooks/use-action.ts`
- Create: `src/lib/hooks/use-action.test.tsx`

**Interfaces:**
- Consumes: `interpretActionResult` de `src/lib/actions/interpret-result.ts` (Task 3); `useConfirm` de `src/components/ui/confirm-dialog.tsx` (já existe)
- Produces:
  ```ts
  function useAction<Args extends unknown[]>(
    action: (...args: Args) => Promise<unknown> | unknown,
    opts?: {
      success?: string;
      error?: string;
      confirm?: string | {
        title?: string;
        message: string;
        confirmLabel?: string;
        cancelLabel?: string;
        variant?: "danger" | "warning" | "default";
      };
      onSuccess?: () => void;
    }
  ): { run: (...args: Args) => void; pending: boolean };
  ```
  Usado pelas Tasks 6, 7 e por todas as fases seguintes.

- [x] **Step 1: Escrever os testes que falham**

`src/lib/hooks/use-action.test.tsx`:

```tsx
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { useAction } from "./use-action";

const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
}));

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    success: (m: string) => toastSuccess(m),
    error: (m: string) => toastError(m),
  },
}));

const confirmFn = vi.fn();
vi.mock("@/components/ui/confirm-dialog", () => ({
  useConfirm: () => confirmFn,
}));

function Harness({
  action,
  opts,
}: {
  action: (...a: unknown[]) => unknown;
  opts?: Parameters<typeof useAction>[1];
}) {
  const { run, pending } = useAction(action, opts);
  return (
    <button onClick={() => run()} data-pending={pending}>
      Executar
    </button>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  confirmFn.mockResolvedValue(true);
});

describe("useAction", () => {
  it("chama a action e mostra toast de sucesso", async () => {
    const action = vi.fn().mockResolvedValue({ ok: true, data: undefined });
    render(<Harness action={action} opts={{ success: "Salvo." }} />);
    screen.getByRole("button").click();
    await waitFor(() => expect(action).toHaveBeenCalledOnce());
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("Salvo."));
  });

  it("mostra toast de erro quando a action devolve ok:false", async () => {
    const action = vi.fn().mockResolvedValue({ ok: false, error: "CPF invalido." });
    render(<Harness action={action} />);
    screen.getByRole("button").click();
    await waitFor(() => expect(toastError).toHaveBeenCalledWith("CPF invalido."));
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it("nao chama a action quando a confirmacao e cancelada", async () => {
    confirmFn.mockResolvedValue(false);
    const action = vi.fn();
    render(<Harness action={action} opts={{ confirm: "Tem certeza?" }} />);
    screen.getByRole("button").click();
    await waitFor(() => expect(confirmFn).toHaveBeenCalledOnce());
    expect(action).not.toHaveBeenCalled();
  });

  it("navega quando a action devolve redirectTo", async () => {
    const action = vi
      .fn()
      .mockResolvedValue({ ok: true, data: undefined, redirectTo: "/alunos" });
    render(<Harness action={action} />);
    screen.getByRole("button").click();
    await waitFor(() => expect(push).toHaveBeenCalledWith("/alunos"));
  });

  it("chama refresh quando a action retorna void", async () => {
    const action = vi.fn().mockResolvedValue(undefined);
    render(<Harness action={action} />);
    screen.getByRole("button").click();
    await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
  });

  it("nao mostra toast de erro quando a action redireciona", async () => {
    const action = vi.fn().mockRejectedValue(
      Object.assign(new Error("NEXT_REDIRECT"), {
        digest: "NEXT_REDIRECT;push;/alunos;307;",
      })
    );
    render(<Harness action={action} />);
    screen.getByRole("button").click();
    await waitFor(() => expect(action).toHaveBeenCalledOnce());
    expect(toastError).not.toHaveBeenCalled();
  });

  it("chama onSuccess apos sucesso", async () => {
    const onSuccess = vi.fn();
    const action = vi.fn().mockResolvedValue({ ok: true, data: undefined });
    render(<Harness action={action} opts={{ onSuccess }} />);
    screen.getByRole("button").click();
    await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce());
  });
});
```

- [x] **Step 2: Rodar e confirmar que falham**

Run: `npx vitest run src/lib/hooks/use-action.test.tsx`
Expected: FAIL — "Failed to resolve import ./use-action".

- [x] **Step 3: Implementar o hook**

`src/lib/hooks/use-action.ts`:

```ts
"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { interpretActionResult } from "@/lib/actions/interpret-result";

type ConfirmOption =
  | string
  | {
      title?: string;
      message: string;
      confirmLabel?: string;
      cancelLabel?: string;
      variant?: "danger" | "warning" | "default";
    };

export type UseActionOptions = {
  /** Mensagem do toast de sucesso. */
  success?: string;
  /** Mensagem do toast de erro, quando a action nao fornece uma. */
  error?: string;
  /** Pede confirmacao antes de executar. String = a mensagem. */
  confirm?: ConfirmOption;
  /** Roda depois do sucesso (fechar modal, limpar formulario). */
  onSuccess?: () => void;
};

export function useAction<Args extends unknown[]>(
  action: (...args: Args) => Promise<unknown> | unknown,
  opts: UseActionOptions = {}
): { run: (...args: Args) => void; pending: boolean } {
  const [isPending, startTransition] = useTransition();
  // `useTransition` nao cobre a janela da confirmacao nem o await da
  // action fora da transition, entao mantemos um flag proprio.
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const confirm = useConfirm();

  const run = useCallback(
    (...args: Args) => {
      void (async () => {
        if (opts.confirm) {
          const cfg =
            typeof opts.confirm === "string"
              ? { message: opts.confirm }
              : opts.confirm;
          const ok = await confirm(cfg);
          if (!ok) return;
        }

        setBusy(true);
        let instruction;
        try {
          const value = await action(...args);
          instruction = interpretActionResult({ kind: "value", value }, opts);
        } catch (error) {
          instruction = interpretActionResult({ kind: "error", error }, opts);
          if (instruction.rethrow) {
            // redirect()/notFound() do Next: deixa a excecao subir para o
            // framework navegar. NAO virar toast de erro.
            setBusy(false);
            throw error;
          }
        }

        if (instruction.toast === "success") toast.success(instruction.message);
        if (instruction.toast === "error") toast.error(instruction.message);

        setBusy(false);

        if (instruction.toast !== "error") {
          opts.onSuccess?.();
          if (instruction.redirectTo) {
            startTransition(() => router.push(instruction.redirectTo as string));
          } else if (instruction.refresh) {
            startTransition(() => router.refresh());
          }
        }
      })();
    },
    // `opts` e recriado a cada render pelos call sites; as suas
    // propriedades sao lidas dentro do closure, entao nao entram no array.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [action, confirm, router]
  );

  return { run, pending: busy || isPending };
}
```

- [x] **Step 4: Rodar os testes e confirmar que passam**

Run: `npx vitest run src/lib/hooks/use-action.test.tsx`
Expected: PASS — 7 testes.

- [x] **Step 5: Commit**

```bash
git add src/lib/hooks/use-action.ts src/lib/hooks/use-action.test.tsx
git commit -m "feat(hooks): useAction com loading, confirm, toast e navegacao"
```

---

### Task 6: `RowActionButton` para ações de grid

Botões de ícone dentro de tabelas. Sem texto ao lado, o spinner ocupa o lugar do ícone para não mudar a largura da célula.

**Files:**
- Create: `src/components/ui/row-action-button.tsx`
- Create: `src/components/ui/row-action-button.test.tsx`

**Interfaces:**
- Consumes: `useAction` (Task 5), `Spinner` (Task 4)
- Produces: `<RowActionButton action icon label confirm? success? error? tone? args? />`
  Usado pela Task 8 (grids).

- [x] **Step 1: Escrever os testes que falham**

`src/components/ui/row-action-button.test.tsx`:

```tsx
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { UserX } from "lucide-react";
import { RowActionButton } from "./row-action-button";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));
const confirmFn = vi.fn();
vi.mock("@/components/ui/confirm-dialog", () => ({
  useConfirm: () => confirmFn,
}));

beforeEach(() => {
  vi.clearAllMocks();
  confirmFn.mockResolvedValue(true);
});

describe("RowActionButton", () => {
  it("expoe o label como aria-label e title", () => {
    render(
      <RowActionButton action={vi.fn()} icon={UserX} label="Desativar" />
    );
    const btn = screen.getByRole("button", { name: "Desativar" });
    expect(btn).toHaveAttribute("title", "Desativar");
  });

  it("chama a action com os args declarados", async () => {
    const action = vi.fn().mockResolvedValue({ ok: true, data: undefined });
    render(
      <RowActionButton
        action={action}
        args={{ perfilId: "abc" }}
        icon={UserX}
        label="Desativar"
      />
    );
    screen.getByRole("button").click();
    await waitFor(() => expect(action).toHaveBeenCalledOnce());
    const fd = action.mock.calls[0][0] as FormData;
    expect(fd.get("perfilId")).toBe("abc");
  });

  it("pede confirmacao antes de executar quando confirm e passado", async () => {
    confirmFn.mockResolvedValue(false);
    const action = vi.fn();
    render(
      <RowActionButton
        action={action}
        icon={UserX}
        label="Desativar"
        confirm="Desativar este usuario?"
      />
    );
    screen.getByRole("button").click();
    await waitFor(() => expect(confirmFn).toHaveBeenCalledOnce());
    expect(action).not.toHaveBeenCalled();
  });
});
```

- [x] **Step 2: Rodar e confirmar que falham**

Run: `npx vitest run src/components/ui/row-action-button.test.tsx`
Expected: FAIL — "Failed to resolve import ./row-action-button".

- [x] **Step 3: Implementar o componente**

`src/components/ui/row-action-button.tsx`:

```tsx
"use client";

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Spinner } from "./spinner";
import { useAction, type UseActionOptions } from "@/lib/hooks/use-action";

type Tone = "brand" | "danger" | "warning" | "success";

const tones: Record<Tone, string> = {
  brand: "text-brand hover:bg-brand/10",
  danger: "text-danger hover:bg-danger/10",
  warning: "text-warning hover:bg-warning/10",
  success: "text-success hover:bg-success/10",
};

type Props = {
  action: (formData: FormData) => Promise<unknown> | unknown;
  /** Vira campos da FormData enviada para a action. */
  args?: Record<string, string>;
  icon: LucideIcon;
  /** Usado como title e aria-label. */
  label: string;
  tone?: Tone;
  confirm?: UseActionOptions["confirm"];
  success?: string;
  error?: string;
};

export function RowActionButton({
  action,
  args,
  icon: Icon,
  label,
  tone = "brand",
  confirm,
  success,
  error,
}: Props) {
  const { run, pending } = useAction(action, { confirm, success, error });

  function handleClick() {
    const fd = new FormData();
    for (const [key, value] of Object.entries(args ?? {})) {
      fd.append(key, value);
    }
    run(fd);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      title={label}
      aria-label={label}
      aria-busy={pending || undefined}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-md transition disabled:opacity-40",
        tones[tone]
      )}
    >
      {/* Spinner ocupa o lugar do icone para a largura da celula nao mudar. */}
      {pending ? <Spinner size={15} /> : <Icon size={15} />}
    </button>
  );
}
```

- [x] **Step 4: Rodar os testes e confirmar que passam**

Run: `npx vitest run src/components/ui/row-action-button.test.tsx`
Expected: PASS — 3 testes.

- [x] **Step 5: Fechar a Fase 1 com a trava de qualidade**

Run: `npm run typecheck && npm run build && npm run test`
Expected: os três verdes.

- [x] **Step 6: Commit**

```bash
git add src/components/ui/row-action-button.tsx src/components/ui/row-action-button.test.tsx
git commit -m "feat(ui): RowActionButton para acoes de grid"
```

---

### Task 7: Corrigir os três bugs de `NEXT_REDIRECT`

Fase 2. Esta tarefa elimina erros que o usuário vê hoje em produção.

**Files:**
- Modify: `src/components/students/aluno-row-actions.tsx:38-82`
- Modify: `src/components/rh/documentos/delete-template-button.tsx`
- Modify: `src/components/rh/documentos/mapping-form.tsx:82-100`

**Interfaces:**
- Consumes: `useAction` (Task 5)
- Produces: nada que outras tarefas consumam.

- [x] **Step 1: Migrar `aluno-row-actions.tsx`**

Substituir as duas funções `handleToggle` (linhas 38-60) e `handleDelete` (linhas 62-82) e o estado `pending` (linha 17).

Remover a linha 17 (`const [pending, setPending] = useState(false);`), remover o import de `toast` (linha 5) e o de `useConfirm` (linha 7) — o hook cuida dos dois.

Adicionar o import:

```tsx
import { useAction } from "@/lib/hooks/use-action";
```

Substituir o estado e os dois handlers por:

```tsx
  const label = ativo ? "desativar" : "ativar";

  const toggle = useAction(toggleStudentAction, {
    confirm: {
      title: ativo ? "Desativar aluno" : "Ativar aluno",
      message: `Tem certeza que quer ${label} o aluno "${alunoNome}"?`,
      confirmLabel: ativo ? "Desativar" : "Ativar",
      variant: ativo ? "warning" : "default",
    },
    success: `Aluno ${ativo ? "desativado" : "ativado"}.`,
    error: "Falha ao alterar status.",
  });

  const remove = useAction(deleteStudentAction, {
    confirm: {
      title: "Excluir aluno",
      message: `Tem certeza que quer excluir "${alunoNome}"? Esta operação remove todos os dados vinculados e não pode ser desfeita.`,
      confirmLabel: "Excluir",
      variant: "danger",
    },
    // deleteStudentAction faz redirect() no sucesso: o useAction deixa a
    // excecao NEXT_REDIRECT subir e o Next navega para /alunos.
    error: "Falha ao excluir aluno.",
  });

  const pending = toggle.pending || remove.pending;

  function handleToggle() {
    setOpen(false);
    const fd = new FormData();
    fd.append("aluno_id", alunoId);
    fd.append("ativo", ativo ? "" : "on");
    toggle.run(fd);
  }

  function handleDelete() {
    setOpen(false);
    const fd = new FormData();
    fd.append("aluno_id", alunoId);
    remove.run(fd);
  }
```

O JSX (linhas 84-158) não muda — `pending` continua existindo e `handleToggle`/`handleDelete` mantêm os mesmos nomes.

- [x] **Step 2: Migrar `delete-template-button.tsx`**

Ler o arquivo inteiro antes de editar. O padrão atual é `try { await deleteTemplateAction(formData); toast.success(...) } catch (err) { toast.error(...) }` dentro do `action` de um `<form>`.

Substituir por `useAction`, trocando o `<form action={...}>` por um botão que chama `run` com a `FormData` montada. `deleteTemplateAction` faz `redirect()` em `templates.ts:187`, então não passar `success` — a navegação é o feedback.

- [x] **Step 3: Migrar `mapping-form.tsx`**

Ler o arquivo inteiro antes de editar. Mesma substituição: o `try/catch` das linhas 82-100 vira `useAction(saveTemplateMappingsAction, { error: "..." })`. `saveTemplateMappingsAction` redireciona em `templates.ts:115`, então sem `success`.

O botão de submit passa a usar `<Button loading={pending}>`.

- [x] **Step 4: Verificar manualmente os três fluxos**

Run: `npm run dev`

Verificar, com o servidor rodando:
1. `/alunos` → menu de ações de um aluno → Excluir → confirmar. **Esperado:** navega para `/alunos` sem nenhum toast de erro. (Antes desta tarefa: exibia "Falha ao excluir aluno.")
2. `/alunos` → menu de ações → Desativar → confirmar. **Esperado:** toast "Aluno desativado." e a linha atualiza.
3. `/rh/documentos` → excluir um template. **Esperado:** navega sem exibir `NEXT_REDIRECT;...`.

- [x] **Step 5: Fechar a fase com a trava de qualidade**

Run: `npm run typecheck && npm run build && npm run test`
Expected: os três verdes.

- [x] **Step 6: Commit**

```bash
git add src/components/students/aluno-row-actions.tsx src/components/rh/documentos/delete-template-button.tsx src/components/rh/documentos/mapping-form.tsx
git commit -m "fix: exclusao bem-sucedida deixa de exibir erro (NEXT_REDIRECT)"
```

---

### Task 8: Grid de usuários

Fase 3. O maior ofensor da auditoria: resetar senha e desativar usuário são ações destrutivas sem confirmação, sem loading e sem toast.

**Files:**
- Modify: `src/app/(app)/usuarios/page.tsx:193-236`

**Interfaces:**
- Consumes: `RowActionButton` (Task 6)
- Produces: nada.

- [x] **Step 1: Verificar se a página é Server Component**

Run: `head -5 "src/app/(app)/usuarios/page.tsx"`

`RowActionButton` é client component (`"use client"`). Se a página for Server Component (sem `"use client"` no topo), ela pode importar e renderizar `RowActionButton` normalmente, passando a Server Action como prop — esse é o padrão suportado pelo App Router. Nenhuma mudança adicional é necessária.

- [x] **Step 2: Substituir os três `<form>` + `<button>` por `RowActionButton`**

Em `src/app/(app)/usuarios/page.tsx`, dentro da `<td>` de ações (linhas 193-236), manter o `<Link>` de editar como está (é navegação, não ação) e substituir os três blocos `<form>` restantes por:

```tsx
                      <RowActionButton
                        action={resetPasswordAction}
                        args={{ perfilId: p.id }}
                        icon={KeyRound}
                        label="Resetar senha"
                        tone="warning"
                        confirm={{
                          title: "Resetar senha",
                          message: `Resetar a senha de "${p.nome}"? O usuário receberá uma senha nova.`,
                          confirmLabel: "Resetar",
                          variant: "warning",
                        }}
                        success="Senha resetada."
                        error="Falha ao resetar a senha."
                      />
                      {p.ativo ? (
                        <RowActionButton
                          action={deactivateUserAction}
                          args={{ perfilId: p.id }}
                          icon={UserX}
                          label="Desativar"
                          tone="danger"
                          confirm={{
                            title: "Desativar usuário",
                            message: `Desativar "${p.nome}"? Ele perde o acesso ao sistema.`,
                            confirmLabel: "Desativar",
                            variant: "danger",
                          }}
                          success="Usuário desativado."
                          error="Falha ao desativar o usuário."
                        />
                      ) : (
                        <RowActionButton
                          action={reactivateUserAction}
                          args={{ perfilId: p.id }}
                          icon={UserCheck}
                          label="Reativar"
                          tone="success"
                          success="Usuário reativado."
                          error="Falha ao reativar o usuário."
                        />
                      )}
```

Adicionar o import:

```tsx
import { RowActionButton } from "@/components/ui/row-action-button";
```

Nota: as três actions (`resetPasswordAction`, `deactivateUserAction`, `reactivateUserAction`) são contrato A — fazem `redirect()` tanto no sucesso quanto no erro (`users.ts:104-160`). Nesta fase elas **não** são migradas; o `useAction` relança o `NEXT_REDIRECT` e o Next navega. Os `success` declarados acima só terão efeito depois da Fase 4, quando as actions passarem a devolver `{ok, redirectTo}`. A confirmação e o loading funcionam desde já.

- [x] **Step 3: Verificar manualmente**

Run: `npm run dev`

Em `/usuarios`:
1. Clicar em Desativar. **Esperado:** modal de confirmação (antes: nenhuma).
2. Confirmar. **Esperado:** spinner no lugar do ícone durante a execução, a largura da coluna não muda, a lista atualiza.
3. Cancelar no modal. **Esperado:** nada acontece.

- [x] **Step 4: Fechar com a trava de qualidade**

Run: `npm run typecheck && npm run build`
Expected: verdes.

- [x] **Step 5: Commit**

```bash
git add "src/app/(app)/usuarios/page.tsx"
git commit -m "feat(usuarios): confirmacao, loading e toast nas acoes da grid"
```

---

### Task 9: Demais grids

**Files:**
- Modify: `src/components/matriculas/matriculas-table.tsx`
- Modify: `src/components/rh/brackets/brackets-table.tsx`
- Modify: `src/app/(app)/disciplinas/page.tsx` (ações de linha)
- Modify: `src/app/(app)/series/page.tsx` (ações de linha)
- Modify: `src/app/(app)/turmas/page.tsx` (ações de linha)

**Interfaces:**
- Consumes: `RowActionButton` (Task 6), `useAction` (Task 5)
- Produces: nada.

- [x] **Step 1: Ler cada arquivo antes de editar**

Estes arquivos não foram lidos integralmente durante o planejamento. Para cada um: ler o arquivo, localizar as ações de linha (excluir, ativar/desativar) e identificar se usam `ConfirmButton`, `<form>` puro ou já têm algum estado.

`matriculas-table.tsx` não tem nenhum `toast`, `useState` ou `useTransition` — provavelmente usa `<form>` puro.
`brackets-table.tsx` usa um padrão incomum: forms ocultos ligados por atributo HTML `form`. Verificar antes de converter.

- [x] **Step 2: Converter as ações de linha para `RowActionButton`**

Para cada ação destrutiva (excluir, desativar), passar `confirm`. Para as demais, só `success`/`error`.

As ações de `disciplinas`, `series` e `turmas` são contrato C (`throw` no erro, `revalidatePath` + void no sucesso) — o `useAction` trata como sucesso com `refresh: true`, então o toast de sucesso já funciona nesta fase sem migrar a action.

Onde hoje existe `ConfirmButton`, substituir pelo `RowActionButton` com `confirm` (mesma mensagem), já que o `RowActionButton` cobre confirmação + loading + toast.

- [x] **Step 3: Verificar manualmente cada grid**

Run: `npm run dev`

Para cada uma das cinco telas: executar uma ação de linha e verificar que aparece spinner, que a confirmação aparece nas destrutivas, e que o toast de resultado aparece.

- [x] **Step 4: Fechar com a trava de qualidade**

Run: `npm run typecheck && npm run build && npm run test`
Expected: verdes.

- [x] **Step 5: Commit**

```bash
git add src/components/matriculas/matriculas-table.tsx src/components/rh/brackets/brackets-table.tsx "src/app/(app)/disciplinas/page.tsx" "src/app/(app)/series/page.tsx" "src/app/(app)/turmas/page.tsx"
git commit -m "feat(grids): loading e toast nas acoes de linha"
```

---

### Task 10: Migrar as actions de `usuarios` para `{ok, redirectTo}`

Fase 4, primeira parte. A partir daqui as Server Actions mudam de contrato. `users.ts` é o alvo inicial porque é contrato A puro (seis actions, todas redirecionando) e porque a Task 8 já preparou a UI.

**Files:**
- Modify: `src/lib/actions/users.ts`
- Modify: `src/app/(app)/usuarios/page.tsx` (remover leitura de `searchParams`)
- Modify: `src/app/(app)/usuarios/[id]/editar/page.tsx` (remover banner `?erro=`)

**Interfaces:**
- Consumes: `ActionResult` (Task 2)
- Produces: `deactivateUserAction`, `reactivateUserAction`, `resetPasswordAction`, `createUserAction`, `updateUserAction` passam a retornar `Promise<ActionResult>` em vez de `Promise<never>`.

- [x] **Step 1: Ler `users.ts` inteiro**

Necessário para mapear cada `redirect()` de erro ao seu código e transformar em mensagem em português.

- [x] **Step 2: Converter cada action**

Padrão da conversão, usando `deactivateUserAction` como exemplo. Antes:

```ts
  if (!perfilId) redirect(`/usuarios?erro=id`);
  // ...
  revalidatePath("/usuarios");
  redirect("/usuarios?desativado=1");
```

Depois:

```ts
  if (!perfilId) return { ok: false, error: "Usuário não informado." };
  // ...
  revalidatePath("/usuarios");
  return { ok: true, data: undefined };
```

Regras da conversão:
- Assinatura passa a ser `Promise<ActionResult>`.
- Todo `redirect('...?erro=X')` vira `return { ok: false, error: "<mensagem em português>" }`.
- Todo `redirect('/destino?ok=1')` de uma action que **muda de página** vira `return { ok: true, data: undefined, redirectTo: "/destino" }`.
- Todo `redirect()` de uma action que **permanece na mesma página** (toggle, reset) vira `return { ok: true, data: undefined }` — o `useAction` chama `router.refresh()`.
- Manter todos os `revalidatePath` existentes. Eles continuam necessários.
- Remover o import de `redirect` se não sobrar nenhum uso.

Traduzir os códigos de erro existentes para mensagens ao usuário: `campos` → "Preencha todos os campos obrigatórios.", `auth` → "Falha ao criar o acesso.", `perfil` → "Falha ao salvar o perfil.", `self` → "Você não pode desativar o próprio usuário.", `id` → "Usuário não informado."

- [x] **Step 3: Remover os banners de query string**

Em `src/app/(app)/usuarios/page.tsx` e `src/app/(app)/usuarios/[id]/editar/page.tsx`: remover a leitura de `searchParams.erro` / `searchParams.criado` / `searchParams.atualizado` e o markup do banner (o bloco com `AlertCircle`). O feedback agora é toast.

Se a página deixar de usar `searchParams` por completo, remover o parâmetro da assinatura do componente.

- [x] **Step 4: Ajustar o formulário de edição**

`src/app/(app)/usuarios/[id]/editar/page.tsx` usa `<form action={updateUserAction}>`. Como a action agora retorna em vez de redirecionar, o form precisa virar client-side com `useAction` e `<Button loading>`. Se a página for Server Component, extrair o formulário para um client component novo em `src/components/usuarios/`.

- [x] **Step 5: Verificar manualmente**

Run: `npm run dev`

Em `/usuarios`:
1. Desativar um usuário. **Esperado:** toast "Usuário desativado." e a lista atualiza sem recarregar a página inteira.
2. Tentar desativar o próprio usuário. **Esperado:** toast de erro "Você não pode desativar o próprio usuário."
3. Editar um usuário deixando o nome em branco. **Esperado:** toast de erro, sem banner.
4. Editar um usuário com dados válidos. **Esperado:** toast de sucesso e navegação para `/usuarios`.

- [x] **Step 6: Fechar com a trava de qualidade**

Run: `npm run typecheck && npm run build && npm run test`
Expected: verdes.

- [x] **Step 7: Commit**

```bash
git add src/lib/actions/users.ts "src/app/(app)/usuarios"
git commit -m "refactor(usuarios): actions retornam ActionResult, feedback via toast"
```

---

### Task 11: Migrar os formulários de página restantes

Fase 4, segunda parte. Mesmo padrão da Task 10, aplicado às demais áreas.

**Files:**
- Modify: `src/app/(app)/disciplinas/page.tsx` (forms de criar/editar)
- Modify: `src/app/(app)/series/page.tsx` (forms de criar/editar)
- Modify: `src/app/(app)/turmas/page.tsx` (forms de criar/editar)
- Modify: `src/components/lancamentos/categoria-financeira-form.tsx`
- Modify: `src/components/historico/associacao-form.tsx`
- Modify: `src/app/(app)/rh/folha-v2/rubricas/nova/page.tsx`
- Modify: `src/app/(app)/rh/folha-v2/rubricas/[id]/editar/page.tsx`
- Modify: `src/app/(app)/rh/folha-v2/contratos/[id]/editar/page.tsx`
- Modify: `src/app/(app)/importacoes/page.tsx`
- Modify: `src/app/(app)/portaria/dispositivos/page.tsx`
- Modify: as actions correspondentes em `src/lib/actions/`

**Interfaces:**
- Consumes: `useAction` (Task 5), `Button loading` (Task 4), `ActionResult` (Task 2)
- Produces: nada.

- [x] **Step 1: Tratar um arquivo por vez, na ordem da lista**

Para cada um: ler o arquivo, identificar o(s) `<form action={...}>`, identificar a action correspondente em `src/lib/actions/` e seu contrato atual.

- [x] **Step 2: Converter o formulário**

Se a página for Server Component, extrair o formulário para um client component. Padrão:

```tsx
"use client";

import { useAction } from "@/lib/hooks/use-action";
import { Button } from "@/components/ui/button";
import { criarDisciplinaAction } from "@/lib/actions/disciplinas";

export function DisciplinaForm() {
  const { run, pending } = useAction(criarDisciplinaAction, {
    success: "Disciplina adicionada.",
    error: "Falha ao adicionar a disciplina.",
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        run(new FormData(e.currentTarget));
      }}
    >
      {/* campos existentes, sem alteração */}
      <Button type="submit" loading={pending}>
        Adicionar
      </Button>
    </form>
  );
}
```

- [x] **Step 3: Migrar a action quando ela for contrato A/B/D**

Aplicar as mesmas regras da Task 10, Step 2. Actions de contrato C (`disciplinas.ts`, maior parte de `academics.ts`) **não precisam mudar** — o `useAction` já trata `throw` como erro e void como sucesso.

- [x] **Step 4: Remover os banners `?erro=` da página correspondente**

- [x] **Step 5: Verificar manualmente cada tela após convertê-la**

Run: `npm run dev`

Para cada formulário: submeter com dados válidos (esperado: toast de sucesso) e com dados inválidos (esperado: toast de erro, sem banner).

- [x] **Step 6: Fechar com a trava de qualidade**

Run: `npm run typecheck && npm run build && npm run test`
Expected: verdes.

- [x] **Step 7: Commit**

Commitar por área, não tudo de uma vez:

```bash
git add "src/app/(app)/disciplinas/page.tsx" src/lib/actions/disciplinas.ts
git commit -m "feat(disciplinas): loading e toast nos formularios"
```

Repetir para cada área.

---

### Task 12: Uniformizar o contrato E

Fase 5. Limpeza técnica sem efeito visível — o `useAction` já aceita as três convenções. Pode ser adiada sem bloquear nada.

**Files:**
- Modify: `src/lib/actions/sicoob.ts:11`
- Modify: `src/lib/actions/asaas.ts:8`
- Modify: `src/lib/actions/conciliacao.ts:8`
- Modify: `src/lib/actions/anamnese-export.ts:21`
- Modify: `src/lib/actions/documents-generate-v2.ts`
- Modify: `src/components/eventos/evento-form.tsx`
- Modify: `src/components/finance/atualizar-extrato-button.tsx`
- Modify: `src/components/finance/pix-avulso-form.tsx`

**Interfaces:**
- Consumes: `ActionResult` (Task 2)
- Produces: todas as actions passam a usar `{ok, data, error}`.

- [x] **Step 1: Renomear `reason` para `error`**

Em `sicoob.ts`, `asaas.ts` e `conciliacao.ts`: trocar o campo `reason` por `error` no ramo de falha dos tipos `GerarPixResult`, `GerarCobrancaResult` e `AtualizarExtratoResult`, e em todos os `return` correspondentes.

- [x] **Step 2: Renomear `success` para `ok`**

Em `anamnese-export.ts` e `documents-generate-v2.ts`: trocar `success: true/false` por `ok: true/false`.

- [x] **Step 3: Atualizar os três call sites de `useFormState`**

`evento-form.tsx`, `atualizar-extrato-button.tsx` e `pix-avulso-form.tsx` leem `state.reason` (linhas 40 e 41 respectivamente). Trocar para `state.error`.

Estes três arquivos usam `useFormState` de `react-dom` — **manter como está**, não migrar para `useActionState` (o projeto está em React 18.3; `useActionState` não existe ainda).

- [x] **Step 4: Verificar que os testes existentes cobrem a mudança**

Run: `npx vitest run src/lib/actions/anamnese-export.test.ts`
Expected: PASS. Se o teste verificava `success`, atualizá-lo para `ok`.

- [x] **Step 5: Verificar manualmente**

Run: `npm run dev`

1. `/financeiro` → Atualizar extrato. **Esperado:** toast de resultado.
2. `/financeiro` → gerar PIX avulso com dados inválidos. **Esperado:** toast de erro com a mensagem real, não "undefined".

- [x] **Step 6: Fechar com a trava de qualidade**

Run: `npm run typecheck && npm run build && npm run test`
Expected: verdes.

- [x] **Step 7: Commit**

```bash
git add src/lib/actions/sicoob.ts src/lib/actions/asaas.ts src/lib/actions/conciliacao.ts src/lib/actions/anamnese-export.ts src/lib/actions/documents-generate-v2.ts src/components/eventos/evento-form.tsx src/components/finance/atualizar-extrato-button.tsx src/components/finance/pix-avulso-form.tsx
git commit -m "refactor(actions): uniformiza contrato para ok/error"
```

---

## Notas de execução

**Ordem das fases:** Tasks 1-6 são Fase 1 (fundação), Task 7 é Fase 2 (bugs), Tasks 8-9 são Fase 3 (grids), Tasks 10-11 são Fase 4 (formulários), Task 12 é Fase 5 (limpeza). A Task 7 vem antes das grids de propósito: corrige erros que o usuário vê hoje.

**Arquivos não lidos no planejamento:** as Tasks 9, 11 e partes da 7 tocam arquivos que não foram abertos integralmente durante o planejamento. Cada uma dessas tarefas começa com um passo explícito de leitura. Não editar antes de ler.

**`ConfirmButton`:** não é removido neste plano. Conforme os call sites migram para `RowActionButton`/`useAction`, ele fica sem uso; a remoção fica para uma limpeza posterior, quando `grep -r "ConfirmButton" src/` não retornar nada.

---

## Trabalho adicional pós-plano

Verificação manual em `npm run dev`, feita após a implementação das 12 tasks, revelou telas com o mesmo problema (form nativo, sem loading/toast) que não estavam listadas em nenhuma task — o levantamento original não cobriu 100% dos call sites. Corrigidas na mesma sessão, mesmo padrão (`useAction` + `ActionResult` + `Button loading`):

- **`044d7357`** `feat(planos,alunos): loading e toast em planos e ficha do aluno` — `/planos` (criar/salvar/ativar-desativar, contrato C) e a aba Dados da ficha do aluno (`updateStudentAction`, contrato híbrido throw+redirect fixo com `?saved=1&ftab=X`; migrado para `ActionResult` com `redirectTo` dinâmico preservando a aba ativa).
- **`fce76eba`** `feat(ui): PageNotice — padrão para avisos persistentes de página` — `FieldNote` (nota pequena de campo, sem fundo/borda) estava sendo usado como bloco de aviso de página (lista de alunos sem histórico, em `/historico/emissao` e `/historico/certificado`), resultando em texto corrido sem hierarquia. Novo componente `src/components/ui/page-notice.tsx`: card com borda+fundo tintado, título opcional, tons `info`/`warning`/`danger`/`success`, paridade claro/escuro. O padrão `bg-{tone}/10 rounded-ui p-3` repetido em outros lugares (`beneficios-card`, `evasao-card`, etc.) não foi migrado — fora do pedido, mas `PageNotice` fica disponível.
- **`9817fe52`** `feat(login): loading e toast no formulário de acesso` — `loginAction` era contrato A puro (redirect em toda saída, inclusive sucesso); migrado para `ActionResult` com `redirectTo: "/"`. Form extraído para `LoginForm` (client component); botão usa `rb-btn` nativo (não o `Button` tokenizado), spinner adicionado manualmente.
- **`4f55150f`** `feat(dashboard): loading na troca de aba` — `DashboardTabs` usava `<Link href="/?aba=X">`: navegação entre páginas RSC, não Server Action, `useAction` não se aplica. Migrado para client component com `useTransition`; `<button>` no lugar de `<Link>` perde `Ctrl/Cmd+click` para nova aba e prefetch automático, mantém back/forward do browser.
- **`3ca786b9`** `fix(dashboard): parseTab quebrava em runtime após virar client boundary` — bug real introduzido pelo commit anterior: `parseTab()` (função pura, sem JSX) ficou no mesmo arquivo que virou `"use client"`; o Server Component (`page.tsx`) importando os dois do mesmo módulo causava `parseTab is not a function` em runtime, intermitente, sobrevivendo a reinício de processo e hard refresh do browser (não era cache — o bug estava no código). Corrigido extraindo `parseTab`/`DashTab` para `src/components/dashboard/parse-tab.ts`, sem `"use client"`.
- **`29fd733c`** `fix(login): suprime toast "Operação concluída." genérico após entrar` — `loginAction` sem `success` declarado caía no default do `interpretActionResult` ("Operação concluída."); como `sonner` é global, o toast sobrevivia ao `redirectTo` e aparecia flutuando sobre o dashboard já carregado. `useAction` ganhou opção `silent?: boolean` (suprime só o toast de sucesso — erro nunca é suprimido), usada no login.

Essas mudanças não alteraram o contrato de `useAction`/`ActionResult` além da adição de `silent`, documentada em `src/lib/hooks/use-action.ts`.
