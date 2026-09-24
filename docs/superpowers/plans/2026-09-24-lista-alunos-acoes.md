# Lista de Alunos — Ícones de Ação e Status Financeiro Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir o botão Desativar/Ativar da lista de alunos por dois ícones condicionais (Matricular/Cancelar matrícula) ligados às ações de negócio reais, aumentar o tamanho/cor dos ícones por token do DS, adicionar coluna+filtro de status financeiro do mês corrente, e mostrar a origem (isaac/manual) de cada cobrança no extrato da ficha.

**Architecture:** Reaproveita `RowActionButton`/`activeEnrollment()` já existentes na lista; reaproveita `CancelarMatriculaDialog` da frente de Cancelamento de Matrícula (já mergeada nesta branch); adiciona uma função pura de derivação de status financeiro, testável isoladamente, consumida tanto pela lista (consulta em lote) quanto potencialmente por outras telas no futuro.

**Tech Stack:** Next.js 14 App Router (Server Components + Client Components), Supabase, Vitest, Tailwind com tokens do DS.

**Spec:** `docs/superpowers/specs/2026-09-24-lista-alunos-acoes-design.md`

## Global Constraints

- Ativar/desativar aluno deixa de ter botão dedicado na lista — só acontece como efeito de **Matricular** (ativa implícito) ou **Cancelar matrícula** (inativa via RPC `cancelar_matricula`, já existente).
- Ícone **Matricular** aparece quando o aluno está inativo OU sem matrícula ativa no ano corrente. Ícone **Cancelar matrícula** aparece quando há matrícula ativa no ano corrente. Nunca os dois ao mesmo tempo.
- Cor por ação via token do DS, nunca hex/rgb cru: Editar = `text-brand`, Boletim = neutra (já existente), Matricular = `text-success`, Cancelar = `text-danger`.
- Coluna Financeiro cobre só o **mês corrente** — nunca meses anteriores (fora de escopo explícito da spec).
- `toggleStudentAction` (`src/lib/actions/students.ts:368-383`) é removida junto com o botão, por não ter nenhum outro chamador (confirmado: único uso é em `aluno-row-actions.tsx`) — regra do projeto de não deixar código morto.
- Filtro novo de status financeiro (`financeiro=pago_isaac|pago_manual|aberto|vencido`) segue o mesmo padrão de URL dos filtros já existentes (`situacao`, `serie`, `turma`), usando `FilterDropdown` e a função `update()` já existente em `student-filters.tsx`.
- Extrato da ficha do aluno (`StudentStatementSection`) ganha selo de origem por cobrança, usando o campo `cobrancas.origem` (`'manual'` | `'isaac'`, já existente desde a migration `202609220004_isaac_repasse.sql`).

## Desvio deliberado da spec

A spec diz "reaproveitando `RowActionButton`" para os ícones novos. Este plano usa `<Link>` (Matricular, é navegação pura) e `<button>` cru que abre `CancelarMatriculaDialog` (Cancelar, é um diálogo completo, não um confirm simples) em vez de `RowActionButton` — que é desenhado para chamar uma Server Action direto via FormData com um confirm simples embutido, e não serve a nenhum dos dois casos reais. É a mesma decisão já tomada e aprovada em revisão na frente de Cancelamento de Matrícula (Task 6 daquele plano, botão de cancelar na lista de matrículas). Editar/Boletim continuam como `<Link>` puro, sem mudança de padrão.

## Review Focus

- **Aluno com múltiplas matrículas históricas, uma ativa noutro ano e nenhuma no ano corrente** — `activeEnrollment(matriculas, anoLetivo)` já filtra por ano antes de cair no fallback; o ícone certo (Matricular) depende de reaproveitar exatamente essa função, não reimplementar a lógica.
- **Aluno com cobrança de mês corrente cancelada (`status='cancelada'`)** — a spec não lista esse status entre os 4 mapeados; sem tratamento explícito, cairia num `else` indevido. Deve resultar em "—" (tratado como se não houvesse cobrança relevante no mês), não em um status inventado.
- **Aluno com múltiplas cobranças no mês corrente** (ex.: mensalidade + material didático) — a spec assume "a cobrança do mês corrente", singular; precisa de uma regra de desempate explícita (mais recente por `data_vencimento`, ou prioridade por status mais "grave": vencida > aberta/parcial > paga).
- **Filtro de Financeiro combinado com paginação** — o filtro precisa reduzir a lista ANTES de paginar (mudar a query de listagem), não só colorir a coluna depois; senão a paginação mostra "30 alunos" quando só 5 batem o filtro.
- **Extrato com cobrança sem `pagamentos` associado e sem `origem` preenchida** (dado legado anterior à integração isaac) — `origem` tem default `'manual'` desde a migration, mas o teste deve confirmar que o selo não quebra em cobrança antiga sem essa coluna populada por engano.

---

### Task 1: Remover `toggleStudentAction` e o par Desativar/Ativar de `aluno-row-actions.tsx`

**Files:**
- Modify: `src/lib/actions/students.ts:368-383` (remover `toggleStudentAction`)
- Modify: `src/components/students/aluno-row-actions.tsx` (remover import de `toggleStudentAction`, `UserX`, `UserCheck`, e o bloco condicional `ativo ? (...) : (...)`)
- Test: `src/lib/actions/students.test.ts` (remover/não criar teste para a action removida — se já existir um teste de `toggleStudentAction`, removê-lo)

**Interfaces:**
- Consumes: nada de tasks anteriores (task inicial).
- Produces: `AlunoRowActions` sem a prop implícita de toggle — a prop `ativo: boolean` do componente **permanece** (ainda é usada para decidir tom do `StatusPill` fora deste componente, e será reaproveitada na Task 2 para decidir qual dos dois ícones novos mostrar).

- [ ] **Step 1: Confirmar que não há outro chamador de `toggleStudentAction`**

Run: `grep -rn "toggleStudentAction" src/`
Expected: só 2 ocorrências, ambas em `src/components/students/aluno-row-actions.tsx` (import e uso) — nenhuma em outro arquivo. Se aparecer uso em outro lugar, PARE e ajuste o plano antes de prosseguir (não remova a action).

- [ ] **Step 2: Remover a action**

Editar `src/lib/actions/students.ts`, removendo as linhas 368-383 inteiras:

```typescript
export async function toggleStudentAction(formData: FormData) {
  await requirePermission("alunos", "update");
  const alunoId = formText(formData, "aluno_id");
  const ativo = formBoolean(formData, "ativo");
  if (!alunoId) return;

  const supabase = await createServerClient();
  await supabase
    .from("alunos")
    .update({ ativo })
    .eq("id", alunoId)
    .eq("escola_id", DEFAULT_SCHOOL_ID);

  revalidatePath("/alunos");
  revalidatePath(`/alunos/${alunoId}`);
}
```

- [ ] **Step 3: Remover o par Desativar/Ativar de `aluno-row-actions.tsx`**

O arquivo atual (antes desta task) é:

```tsx
"use client";

import Link from "next/link";
import { Pencil, UserCheck, UserX, FileText } from "lucide-react";
import { toggleStudentAction } from "@/lib/actions/students";
import { RowActionButton } from "@/components/ui/row-action-button";

type Props = {
  alunoId: string;
  alunoNome: string;
  ativo: boolean;
};

// "Ver ficha" nao vira icone: clicar no nome do aluno (celula anterior) ja
// leva pra la — repetir a acao aqui seria redundante.
export function AlunoRowActions({ alunoId, alunoNome, ativo }: Props) {
  return (
    <div className="inline-flex items-center justify-center gap-1">
      <Link
        href={`/alunos/${alunoId}/editar`}
        title="Editar"
        aria-label="Editar"
        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-brand hover:bg-brand/10"
      >
        <Pencil size={15} />
      </Link>

      {ativo ? (
        <RowActionButton
          action={toggleStudentAction}
          args={{ aluno_id: alunoId, ativo: "" }}
          icon={UserX}
          label="Desativar"
          tone="warning"
          confirm={{
            title: "Desativar aluno",
            message: `Tem certeza que quer desativar o aluno "${alunoNome}"?`,
            confirmLabel: "Desativar",
            variant: "warning",
          }}
          success="Aluno desativado."
          error="Falha ao alterar status."
        />
      ) : (
        <RowActionButton
          action={toggleStudentAction}
          args={{ aluno_id: alunoId, ativo: "on" }}
          icon={UserCheck}
          label="Ativar"
          tone="success"
          confirm={{
            title: "Ativar aluno",
            message: `Tem certeza que quer ativar o aluno "${alunoNome}"?`,
            confirmLabel: "Ativar",
          }}
          success="Aluno ativado."
          error="Falha ao alterar status."
        />
      )}

      <Link
        href={`/alunos/${alunoId}/boletim`}
        title="Boletim"
        aria-label="Boletim"
        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-brand hover:bg-brand/10"
      >
        <FileText size={15} />
      </Link>
    </div>
  );
}
```

Substituir por (só remove o par Desativar/Ativar; os ícones novos entram na Task 3, mantendo o componente compilável entre tasks):

```tsx
"use client";

import Link from "next/link";
import { Pencil, FileText } from "lucide-react";

type Props = {
  alunoId: string;
  alunoNome: string;
  ativo: boolean;
};

// "Ver ficha" nao vira icone: clicar no nome do aluno (celula anterior) ja
// leva pra la — repetir a acao aqui seria redundante.
export function AlunoRowActions({ alunoId, alunoNome, ativo }: Props) {
  return (
    <div className="inline-flex items-center justify-center gap-1">
      <Link
        href={`/alunos/${alunoId}/editar`}
        title="Editar"
        aria-label="Editar"
        className="inline-flex h-9 w-9 items-center justify-center rounded-md text-brand hover:bg-brand/10"
      >
        <Pencil size={18} />
      </Link>

      <Link
        href={`/alunos/${alunoId}/boletim`}
        title="Boletim"
        aria-label="Boletim"
        className="inline-flex h-9 w-9 items-center justify-center rounded-md text-ink/60 hover:bg-ink/10"
      >
        <FileText size={18} />
      </Link>
    </div>
  );
}
```

Nota: `ativo`/`alunoNome` ficam sem uso nesta task intermediária (o TypeScript vai reclamar de prop não usada só se houver lint estrito sobre isso — confirme rodando o Step 5; se `noUnusedParameters` acusar erro, prefixe com `_` temporariamente: `_ativo`, `_alunoNome` — a Task 3 volta a usá-los).

- [ ] **Step 4: Verificar se há teste dedicado à action removida**

Run: `grep -rn "toggleStudentAction" src/lib/actions/students.test.ts 2>/dev/null || echo "sem teste dedicado"`
Se houver teste, remova o bloco `describe`/`it` correspondente.

- [ ] **Step 5: Rodar typecheck**

Run: `npx tsc --noEmit`
Expected: sem erros novos relacionados a `aluno-row-actions.tsx` ou `students.ts`.

- [ ] **Step 6: Rodar suíte de alunos**

Run: `npx vitest run src/lib/actions/students.test.ts src/components/students`
Expected: nenhum teste falha por causa da remoção.

- [ ] **Step 7: Commit**

```bash
git add src/lib/actions/students.ts src/components/students/aluno-row-actions.tsx
git commit -m "refactor(alunos): remove botao Desativar/Ativar e toggleStudentAction (codigo morto apos ligar status a matricula)"
```

---

### Task 2: Função pura `derivarIconeAcao` (regra de qual ícone mostrar)

**Files:**
- Create: `src/lib/students/icone-acao.ts`
- Test: `src/lib/students/icone-acao.test.ts`

**Interfaces:**
- Consumes: nada de código externo — função pura de decisão, recebendo os dados já resolvidos pela função `activeEnrollment` que já existe em `src/app/(app)/alunos/page.tsx:36-40`.
- Produces: `type IconeAcao = "matricular" | "cancelar"`; `function derivarIconeAcao(alunoAtivo: boolean, matriculaAtivaNoAno: boolean): IconeAcao`.

Extrair a regra de decisão para uma função pura, isolada e testável — evita reimplementar a lógica de "tem matrícula ativa no ano" dentro do componente de ação (que só deve orquestrar UI), e possibilita testar as 4 combinações de entrada sem montar um componente React.

- [ ] **Step 1: Escrever o teste (falha)**

```typescript
// src/lib/students/icone-acao.test.ts
import { describe, it, expect } from "vitest";
import { derivarIconeAcao } from "./icone-acao";

describe("derivarIconeAcao", () => {
  it("aluno ativo com matricula ativa no ano -> cancelar", () => {
    expect(derivarIconeAcao(true, true)).toBe("cancelar");
  });

  it("aluno ativo sem matricula ativa no ano -> matricular", () => {
    expect(derivarIconeAcao(true, false)).toBe("matricular");
  });

  it("aluno inativo com matricula ativa no ano (estado inconsistente, mas nao deve crashar) -> matricular", () => {
    // Um aluno "inativo" nunca deveria ter matricula "ativa" simultaneamente
    // (a RPC de cancelamento sempre inativa o aluno ao cancelar a matricula),
    // mas a função não deve confiar nessa invariante silenciosamente — aluno
    // inativo sempre precisa do caminho de reativação (Matricular), mesmo que
    // o dado de matrícula esteja inconsistente por algum motivo externo.
    expect(derivarIconeAcao(false, true)).toBe("matricular");
  });

  it("aluno inativo sem matricula ativa no ano -> matricular", () => {
    expect(derivarIconeAcao(false, false)).toBe("matricular");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/students/icone-acao.test.ts`
Expected: FAIL — módulo `./icone-acao` não existe.

- [ ] **Step 3: Implementar**

```typescript
// src/lib/students/icone-acao.ts

export type IconeAcao = "matricular" | "cancelar";

/**
 * Decide qual ícone de ação de negócio mostrar na lista de alunos:
 * "cancelar" só quando o aluno está ativo E tem matrícula ativa no ano
 * corrente; "matricular" em qualquer outro caso (inativo, ou ativo mas sem
 * matrícula no ano — este último é o aluno que a secretaria precisa achar
 * para rematricular).
 *
 * Aluno inativo sempre cai em "matricular", mesmo que o dado de matrícula
 * pareça mostrar uma "ativa" simultânea (estado que não deveria existir,
 * já que cancelar_matricula sempre inativa o aluno junto) — o ícone de
 * reativação é sempre seguro de mostrar; o de cancelamento sobre um aluno já
 * inativo não faria sentido nenhum.
 */
export function derivarIconeAcao(alunoAtivo: boolean, matriculaAtivaNoAno: boolean): IconeAcao {
  if (!alunoAtivo) return "matricular";
  return matriculaAtivaNoAno ? "cancelar" : "matricular";
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/students/icone-acao.test.ts`
Expected: PASS (4 testes).

- [ ] **Step 5: Commit**

```bash
git add src/lib/students/icone-acao.ts src/lib/students/icone-acao.test.ts
git commit -m "feat(alunos): funcao pura derivarIconeAcao para regra de Matricular/Cancelar"
```

---

### Task 3: Ícones Matricular/Cancelar em `aluno-row-actions.tsx`, integrados ao diálogo de cancelamento

**Files:**
- Modify: `src/components/students/aluno-row-actions.tsx`
- Modify: `src/app/(app)/alunos/page.tsx:245-311` (passar dados de matrícula ativa por linha para `AlunoRowActions`)
- Test: `src/components/students/aluno-row-actions.test.tsx` (novo)

**Interfaces:**
- Consumes: `derivarIconeAcao` (Task 2); `CancelarMatriculaDialog` (já existente, `src/components/matriculas/cancelar-matricula-dialog.tsx`, props: `matriculaId, alunoId, alunoNome, serieNome, turmaNome, anoLetivo, open, onOpenChange, onSuccess` — **sem** prop `temCobrancaIsaac`, computada internamente pelo próprio componente).
- Produces: `AlunoRowActions` ganha props novas: `matriculaAtivaNoAno: boolean`, e quando `matriculaAtivaNoAno` é `true`, também precisa de `matriculaId: string`, `serieNome: string`, `turmaNome: string`, `anoLetivo: number` (dados da matrícula ativa, para abrir o diálogo). Quando `matriculaAtivaNoAno` é `false`, esses 4 campos podem vir vazios/irrelevantes (o botão nesse caso é um `Link`, não abre diálogo).

- [ ] **Step 1: Escrever o teste (falha)**

```tsx
// src/components/students/aluno-row-actions.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("@/components/matriculas/cancelar-matricula-dialog", () => ({
  CancelarMatriculaDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="cancelar-dialog">dialog aberto</div> : null,
}));

import { AlunoRowActions } from "./aluno-row-actions";

function renderComponent(overrides: Partial<React.ComponentProps<typeof AlunoRowActions>> = {}) {
  render(
    <AlunoRowActions
      alunoId="aluno-1"
      alunoNome="Ana Souza"
      ativo={true}
      matriculaAtivaNoAno={true}
      matriculaId="matricula-1"
      serieNome="5º Ano"
      turmaNome="A"
      anoLetivo={2026}
      {...overrides}
    />
  );
}

describe("AlunoRowActions", () => {
  it("mostra icone de Cancelar matricula quando ha matricula ativa no ano", () => {
    renderComponent({ matriculaAtivaNoAno: true });
    expect(screen.getByLabelText(/cancelar matr[ií]cula/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/^matricular$/i)).not.toBeInTheDocument();
  });

  it("mostra icone de Matricular quando nao ha matricula ativa no ano", () => {
    renderComponent({ matriculaAtivaNoAno: false });
    expect(screen.getByLabelText(/^matricular$/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/cancelar matr[ií]cula/i)).not.toBeInTheDocument();
  });

  it("mostra icone de Matricular quando aluno inativo, mesmo com matriculaAtivaNoAno true", () => {
    renderComponent({ ativo: false, matriculaAtivaNoAno: true });
    expect(screen.getByLabelText(/^matricular$/i)).toBeInTheDocument();
  });

  it("link de Matricular aponta para /matriculas com aluno_id e ancora", () => {
    renderComponent({ matriculaAtivaNoAno: false });
    const link = screen.getByLabelText(/^matricular$/i) as HTMLAnchorElement;
    expect(link.getAttribute("href")).toBe("/matriculas?aluno_id=aluno-1#nova-matricula");
  });

  it("clicar em Cancelar matricula abre o dialogo", () => {
    renderComponent({ matriculaAtivaNoAno: true });
    fireEvent.click(screen.getByLabelText(/cancelar matr[ií]cula/i));
    expect(screen.getByTestId("cancelar-dialog")).toBeInTheDocument();
  });

  it("Editar e Boletim continuam presentes independente da matricula", () => {
    renderComponent({ matriculaAtivaNoAno: true });
    expect(screen.getByLabelText("Editar")).toBeInTheDocument();
    expect(screen.getByLabelText("Boletim")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/components/students/aluno-row-actions.test.tsx`
Expected: FAIL — props novas não existem, ícones novos não existem.

- [ ] **Step 3: Implementar**

```tsx
// src/components/students/aluno-row-actions.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { Pencil, FileText, UserPlus, XCircle } from "lucide-react";
import { CancelarMatriculaDialog } from "@/components/matriculas/cancelar-matricula-dialog";
import { derivarIconeAcao } from "@/lib/students/icone-acao";

type Props = {
  alunoId: string;
  alunoNome: string;
  ativo: boolean;
  matriculaAtivaNoAno: boolean;
  matriculaId: string;
  serieNome: string;
  turmaNome: string;
  anoLetivo: number;
};

// "Ver ficha" nao vira icone: clicar no nome do aluno (celula anterior) ja
// leva pra la — repetir a acao aqui seria redundante.
export function AlunoRowActions({
  alunoId,
  alunoNome,
  ativo,
  matriculaAtivaNoAno,
  matriculaId,
  serieNome,
  turmaNome,
  anoLetivo,
}: Props) {
  const [dialogAberto, setDialogAberto] = useState(false);
  const icone = derivarIconeAcao(ativo, matriculaAtivaNoAno);

  return (
    <div className="inline-flex items-center justify-center gap-1">
      <Link
        href={`/alunos/${alunoId}/editar`}
        title="Editar"
        aria-label="Editar"
        className="inline-flex h-9 w-9 items-center justify-center rounded-md text-brand hover:bg-brand/10"
      >
        <Pencil size={18} />
      </Link>

      {icone === "cancelar" ? (
        <button
          type="button"
          onClick={() => setDialogAberto(true)}
          title="Cancelar matrícula"
          aria-label="Cancelar matrícula"
          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-danger hover:bg-danger/10"
        >
          <XCircle size={18} />
        </button>
      ) : (
        <Link
          href={`/matriculas?aluno_id=${alunoId}#nova-matricula`}
          title="Matricular"
          aria-label="Matricular"
          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-success hover:bg-success/10"
        >
          <UserPlus size={18} />
        </Link>
      )}

      <Link
        href={`/alunos/${alunoId}/boletim`}
        title="Boletim"
        aria-label="Boletim"
        className="inline-flex h-9 w-9 items-center justify-center rounded-md text-ink/60 hover:bg-ink/10"
      >
        <FileText size={18} />
      </Link>

      {icone === "cancelar" ? (
        <CancelarMatriculaDialog
          matriculaId={matriculaId}
          alunoId={alunoId}
          alunoNome={alunoNome}
          serieNome={serieNome}
          turmaNome={turmaNome}
          anoLetivo={anoLetivo}
          open={dialogAberto}
          onOpenChange={setDialogAberto}
          onSuccess={() => setDialogAberto(false)}
        />
      ) : null}
    </div>
  );
}
```

Nota: `onSuccess` aqui só fecha o diálogo — diferente da ficha do aluno (que faz `window.location.reload()`) e da lista de matrículas (`router.refresh()`). Na lista de alunos, o Server Component pai (`page.tsx`) só re-renderiza no próximo request de navegação; para refletir a mudança imediatamente, adicione `router.refresh()` também (ver Step 3 revisado abaixo — importar `useRouter` de `next/navigation` e chamar `router.refresh()` dentro de `onSuccess`, mesmo padrão já usado em `matriculas-table.tsx` da frente de Cancelamento de Matrícula).

```tsx
// Revisão do Step 3: adicionar router.refresh()
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Pencil, FileText, UserPlus, XCircle } from "lucide-react";
import { CancelarMatriculaDialog } from "@/components/matriculas/cancelar-matricula-dialog";
import { derivarIconeAcao } from "@/lib/students/icone-acao";

type Props = {
  alunoId: string;
  alunoNome: string;
  ativo: boolean;
  matriculaAtivaNoAno: boolean;
  matriculaId: string;
  serieNome: string;
  turmaNome: string;
  anoLetivo: number;
};

export function AlunoRowActions({
  alunoId,
  alunoNome,
  ativo,
  matriculaAtivaNoAno,
  matriculaId,
  serieNome,
  turmaNome,
  anoLetivo,
}: Props) {
  const router = useRouter();
  const [dialogAberto, setDialogAberto] = useState(false);
  const icone = derivarIconeAcao(ativo, matriculaAtivaNoAno);

  return (
    <div className="inline-flex items-center justify-center gap-1">
      <Link
        href={`/alunos/${alunoId}/editar`}
        title="Editar"
        aria-label="Editar"
        className="inline-flex h-9 w-9 items-center justify-center rounded-md text-brand hover:bg-brand/10"
      >
        <Pencil size={18} />
      </Link>

      {icone === "cancelar" ? (
        <button
          type="button"
          onClick={() => setDialogAberto(true)}
          title="Cancelar matrícula"
          aria-label="Cancelar matrícula"
          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-danger hover:bg-danger/10"
        >
          <XCircle size={18} />
        </button>
      ) : (
        <Link
          href={`/matriculas?aluno_id=${alunoId}#nova-matricula`}
          title="Matricular"
          aria-label="Matricular"
          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-success hover:bg-success/10"
        >
          <UserPlus size={18} />
        </Link>
      )}

      <Link
        href={`/alunos/${alunoId}/boletim`}
        title="Boletim"
        aria-label="Boletim"
        className="inline-flex h-9 w-9 items-center justify-center rounded-md text-ink/60 hover:bg-ink/10"
      >
        <FileText size={18} />
      </Link>

      {icone === "cancelar" ? (
        <CancelarMatriculaDialog
          matriculaId={matriculaId}
          alunoId={alunoId}
          alunoNome={alunoNome}
          serieNome={serieNome}
          turmaNome={turmaNome}
          anoLetivo={anoLetivo}
          open={dialogAberto}
          onOpenChange={setDialogAberto}
          onSuccess={() => { setDialogAberto(false); router.refresh(); }}
        />
      ) : null}
    </div>
  );
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/components/students/aluno-row-actions.test.tsx`
Expected: PASS (6 testes).

- [ ] **Step 5: Passar os dados de matrícula ativa em `page.tsx`**

Ler `src/app/(app)/alunos/page.tsx` (já lido durante o planejamento — a função `activeEnrollment(student.matriculas, anoLetivo)` já é chamada dentro do `.map()`, linha 246). Estender o uso de `enrollment` já resolvido para alimentar as props novas de `AlunoRowActions`:

```tsx
// src/app/(app)/alunos/page.tsx — trecho do .map(), substituindo o JSX de AlunoRowActions
                  <td className="pr-4 text-right">
                    <AlunoRowActions
                      alunoId={student.id}
                      alunoNome={student.nome}
                      ativo={student.ativo ?? false}
                      matriculaAtivaNoAno={enrollment?.status === "ativa"}
                      matriculaId={"id" in (enrollment ?? {}) ? String((enrollment as { id?: string })?.id ?? "") : ""}
                      serieNome={series?.nome ?? ""}
                      turmaNome={turma?.nome ?? ""}
                      anoLetivo={anoLetivo}
                    />
                  </td>
```

**Atenção**: o tipo `EnrollmentRef` (linha 22-28 do arquivo) não inclui `id` hoje. Antes de aplicar o trecho acima, verifique se a query de `listStudents` (`src/lib/data/students.ts`, função `runStudentsQuery`) já traz `matriculas.id` no `select` — se não trouxer, adicione `id` à seleção de `matriculas(...)` (tanto na variante com `serie!inner` quanto na variante left join, linhas ~54-56 do arquivo) e estenda `EnrollmentRef` em `page.tsx` com `id?: string | null`.

- [ ] **Step 6: Verificar se `matriculas.id` já vem na query e ajustar se necessário**

Run: `grep -n "matriculaSelect\s*=" src/lib/data/students.ts`

Ler as duas linhas de `matriculaSelect` (com e sem `!inner`). Se `id` não estiver na lista de colunas de `matriculas(...)`, adicionar como primeiro campo: `matriculas(id, status, serie_id, ...)`.

- [ ] **Step 7: Rodar typecheck**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 8: Rodar suíte de alunos e matrículas**

Run: `npx vitest run src/components/students src/lib/data/students.test.ts`
Expected: todos passam.

- [ ] **Step 9: Commit**

```bash
git add src/components/students/aluno-row-actions.tsx src/components/students/aluno-row-actions.test.tsx "src/app/(app)/alunos/page.tsx" src/lib/data/students.ts
git commit -m "feat(alunos): icones Matricular/Cancelar condicionais, integrados ao dialogo de cancelamento"
```

---

### Task 4: Função pura de derivação do status financeiro do mês corrente

**Files:**
- Create: `src/lib/finance/status-mes-corrente.ts`
- Test: `src/lib/finance/status-mes-corrente.test.ts`

**Interfaces:**
- Consumes: `displayStatus` (já existente, `src/lib/finance/charge-status.ts`) para derivar "vencida" a partir de status+data.
- Produces: `type StatusFinanceiroMes = "pago_isaac" | "pago_manual" | "aberto" | "vencido" | null`; `function derivarStatusFinanceiroMes(cobrancas: { origem: string; status: string; data_vencimento: string }[], hoje?: string): StatusFinanceiroMes`.

Isolar a regra de "qual status mostrar quando há mais de uma cobrança no mês, e como mapear origem+status para os 4 rótulos" numa função pura testável, separada da consulta em lote (Task 5) e da renderização (Task 6).

- [ ] **Step 1: Escrever o teste (falha)**

```typescript
// src/lib/finance/status-mes-corrente.test.ts
import { describe, it, expect } from "vitest";
import { derivarStatusFinanceiroMes } from "./status-mes-corrente";

const HOJE = "2026-09-24";

describe("derivarStatusFinanceiroMes", () => {
  it("retorna null sem nenhuma cobranca no mes", () => {
    expect(derivarStatusFinanceiroMes([], HOJE)).toBeNull();
  });

  it("isaac paga -> pago_isaac", () => {
    const result = derivarStatusFinanceiroMes(
      [{ origem: "isaac", status: "paga", data_vencimento: "2026-09-10" }],
      HOJE
    );
    expect(result).toBe("pago_isaac");
  });

  it("manual paga -> pago_manual", () => {
    const result = derivarStatusFinanceiroMes(
      [{ origem: "manual", status: "paga", data_vencimento: "2026-09-10" }],
      HOJE
    );
    expect(result).toBe("pago_manual");
  });

  it("aberta com vencimento futuro -> aberto", () => {
    const result = derivarStatusFinanceiroMes(
      [{ origem: "manual", status: "aberta", data_vencimento: "2026-09-30" }],
      HOJE
    );
    expect(result).toBe("aberto");
  });

  it("aberta com vencimento passado -> vencido", () => {
    const result = derivarStatusFinanceiroMes(
      [{ origem: "manual", status: "aberta", data_vencimento: "2026-09-01" }],
      HOJE
    );
    expect(result).toBe("vencido");
  });

  it("parcial com vencimento passado -> vencido", () => {
    const result = derivarStatusFinanceiroMes(
      [{ origem: "isaac", status: "parcial", data_vencimento: "2026-09-01" }],
      HOJE
    );
    expect(result).toBe("vencido");
  });

  it("cobranca cancelada -> null (nao conta como relevante no mes)", () => {
    const result = derivarStatusFinanceiroMes(
      [{ origem: "manual", status: "cancelada", data_vencimento: "2026-09-10" }],
      HOJE
    );
    expect(result).toBeNull();
  });

  it("duas cobrancas no mes: vencida tem prioridade sobre aberta", () => {
    const result = derivarStatusFinanceiroMes(
      [
        { origem: "manual", status: "aberta", data_vencimento: "2026-09-30" },
        { origem: "manual", status: "aberta", data_vencimento: "2026-09-01" },
      ],
      HOJE
    );
    expect(result).toBe("vencido");
  });

  it("duas cobrancas no mes: paga isaac tem prioridade sobre aberta (paga é o status mais definitivo)", () => {
    const result = derivarStatusFinanceiroMes(
      [
        { origem: "manual", status: "aberta", data_vencimento: "2026-09-30" },
        { origem: "isaac", status: "paga", data_vencimento: "2026-09-05" },
      ],
      HOJE
    );
    expect(result).toBe("pago_isaac");
  });

  it("mistura cancelada + aberta: ignora a cancelada, considera so a aberta", () => {
    const result = derivarStatusFinanceiroMes(
      [
        { origem: "manual", status: "cancelada", data_vencimento: "2026-09-05" },
        { origem: "manual", status: "aberta", data_vencimento: "2026-09-30" },
      ],
      HOJE
    );
    expect(result).toBe("aberto");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/finance/status-mes-corrente.test.ts`
Expected: FAIL — módulo `./status-mes-corrente` não existe.

- [ ] **Step 3: Implementar**

```typescript
// src/lib/finance/status-mes-corrente.ts
import { displayStatus } from "./charge-status";

export type StatusFinanceiroMes = "pago_isaac" | "pago_manual" | "aberto" | "vencido" | null;

type CobrancaMinima = { origem: string; status: string; data_vencimento: string };

/** Prioridade de exibição quando há mais de uma cobrança no mês: um status já
 * pago é a informação mais definitiva e vence qualquer outra; entre não-pagas,
 * vencida é mais urgente que aberta. */
const PRIORIDADE: Record<string, number> = {
  pago_isaac: 3,
  pago_manual: 3,
  vencido: 2,
  aberto: 1,
};

function statusUnico(cobranca: CobrancaMinima, hoje: string): StatusFinanceiroMes {
  const status = displayStatus(cobranca.status, cobranca.data_vencimento, hoje);
  if (status === "cancelada") return null;
  if (status === "paga") return cobranca.origem === "isaac" ? "pago_isaac" : "pago_manual";
  if (status === "vencida") return "vencido";
  return "aberto";
}

/**
 * Deriva o status financeiro do mês corrente para exibição em lista — quando
 * há mais de uma cobrança no mês, prioriza a mais definitiva (paga > vencida
 * > aberta) em vez de pegar "a primeira" ou "a mais recente", porque o que
 * importa para a secretaria é o pior/mais urgente estado, não uma ordem
 * arbitrária.
 */
export function derivarStatusFinanceiroMes(
  cobrancas: CobrancaMinima[],
  hoje: string = new Date().toISOString().slice(0, 10)
): StatusFinanceiroMes {
  let melhor: StatusFinanceiroMes = null;
  let melhorPrioridade = -1;

  for (const cobranca of cobrancas) {
    const status = statusUnico(cobranca, hoje);
    if (status === null) continue;
    const prioridade = PRIORIDADE[status] ?? 0;
    if (prioridade > melhorPrioridade) {
      melhor = status;
      melhorPrioridade = prioridade;
    }
  }

  return melhor;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/finance/status-mes-corrente.test.ts`
Expected: PASS (10 testes).

- [ ] **Step 5: Commit**

```bash
git add src/lib/finance/status-mes-corrente.ts src/lib/finance/status-mes-corrente.test.ts
git commit -m "feat(financeiro): funcao pura de derivacao do status financeiro do mes corrente"
```

---

### Task 5: Consulta em lote de cobranças do mês corrente + filtro na listagem

**Files:**
- Modify: `src/lib/data/students.ts` (nova função `getFinanceiroMesCorrentePorAluno`, e extensão de `StudentFilters`/`runStudentsQuery` para filtrar por status financeiro)
- Test: `src/lib/data/students.test.ts` (estender, se já existir; senão criar)

**Interfaces:**
- Consumes: `derivarStatusFinanceiroMes` (Task 4).
- Produces:
  - `export type StatusFinanceiroFiltro = "pago_isaac" | "pago_manual" | "aberto" | "vencido";`
  - `export async function getFinanceiroMesCorrentePorAluno(alunoIds: string[]): Promise<Map<string, StatusFinanceiroMes>>` — uma consulta só para todos os ids da página atual.
  - `StudentFilters` ganha campo opcional `financeiro?: StatusFinanceiroFiltro`.

- [ ] **Step 1: Escrever o teste da consulta em lote (falha)**

```typescript
// acrescentar em src/lib/data/students.test.ts (criar o arquivo se não existir)
import { describe, it, expect, vi, beforeEach } from "vitest";

const { fromMock } = vi.hoisted(() => ({ fromMock: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createServerClient: vi.fn(async () => ({ from: fromMock })) }));

import { getFinanceiroMesCorrentePorAluno } from "./students";

beforeEach(() => {
  fromMock.mockReset();
});

describe("getFinanceiroMesCorrentePorAluno", () => {
  it("retorna um mapa aluno_id -> status, usando so cobrancas do mes corrente", async () => {
    const gte = vi.fn().mockReturnThis();
    const lte = vi.fn().mockReturnThis();
    const inFn = vi.fn().mockResolvedValue({
      data: [
        { aluno_id: "aluno-1", origem: "isaac", status: "paga", data_vencimento: "2026-09-10" },
        { aluno_id: "aluno-2", origem: "manual", status: "aberta", data_vencimento: "2026-09-01" },
      ],
      error: null,
    });
    const select = vi.fn().mockReturnValue({ in: inFn, gte, lte });
    fromMock.mockReturnValue({ select });

    const result = await getFinanceiroMesCorrentePorAluno(["aluno-1", "aluno-2", "aluno-3"]);

    expect(result.get("aluno-1")).toBe("pago_isaac");
    expect(result.get("aluno-2")).toBe("vencido");
    expect(result.has("aluno-3")).toBe(false);
  });

  it("retorna mapa vazio para lista de ids vazia, sem consultar o banco", async () => {
    const result = await getFinanceiroMesCorrentePorAluno([]);
    expect(result.size).toBe(0);
    expect(fromMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/data/students.test.ts`
Expected: FAIL — `getFinanceiroMesCorrentePorAluno` não existe.

- [ ] **Step 3: Implementar a consulta em lote**

Adicionar em `src/lib/data/students.ts` (perto de `listStudents`, mesma seção de funções exportadas de leitura):

```typescript
import { derivarStatusFinanceiroMes, type StatusFinanceiroMes } from "@/lib/finance/status-mes-corrente";

export type StatusFinanceiroFiltro = "pago_isaac" | "pago_manual" | "aberto" | "vencido";

/**
 * Status financeiro do mês corrente para um lote de alunos (a página atual
 * da lista), numa única consulta — nunca uma por aluno. Alunos sem nenhuma
 * cobrança relevante no mês simplesmente não aparecem no mapa (a UI trata
 * ausência como "—").
 */
export async function getFinanceiroMesCorrentePorAluno(
  alunoIds: string[]
): Promise<Map<string, StatusFinanceiroMes>> {
  const resultado = new Map<string, StatusFinanceiroMes>();
  if (alunoIds.length === 0) return resultado;

  const hoje = new Date().toISOString().slice(0, 10);
  const inicioMes = `${hoje.slice(0, 7)}-01`;

  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("cobrancas")
    .select("aluno_id, origem, status, data_vencimento")
    .in("aluno_id", alunoIds)
    .gte("data_vencimento", inicioMes)
    .lte("data_vencimento", hoje);

  if (error) throw error;

  const porAluno = new Map<string, { origem: string; status: string; data_vencimento: string }[]>();
  for (const row of data ?? []) {
    const lista = porAluno.get(row.aluno_id as string) ?? [];
    lista.push({
      origem: row.origem as string,
      status: row.status as string,
      data_vencimento: row.data_vencimento as string,
    });
    porAluno.set(row.aluno_id as string, lista);
  }

  for (const [alunoId, cobrancas] of porAluno) {
    const status = derivarStatusFinanceiroMes(cobrancas, hoje);
    if (status !== null) resultado.set(alunoId, status);
  }

  return resultado;
}
```

Nota: a janela `gte(inicioMes).lte(hoje)` deliberadamente não vai até o fim do mês — cobranças com vencimento futuro dentro do mesmo mês (ex.: dia 24, vencimento dia 30) também são relevantes. Ajustar para `lte(fimDoMes)`:

```typescript
  const hoje = new Date().toISOString().slice(0, 10);
  const inicioMes = `${hoje.slice(0, 7)}-01`;
  const [ano, mes] = hoje.split("-").map(Number);
  const fimMes = new Date(ano, mes, 0).toISOString().slice(0, 10); // dia 0 do mês seguinte = último dia deste mês
```

E trocar `.lte(hoje)` por `.lte(fimMes)` na query. Atualizar o teste do Step 1 se necessário para uma data de vencimento dentro do mês mas após "hoje" (ex.: dia 30 com hoje sendo dia 24) para confirmar que ainda é capturada.

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/data/students.test.ts`
Expected: PASS.

- [ ] **Step 5: Estender `StudentFilters` e `runStudentsQuery` com o filtro `financeiro`**

Ler `runStudentsQuery` (função interna, não exportada, dentro de `src/lib/data/students.ts`) por completo antes de editar — ela já filtra por `nome`, `situacao`, `matriculas.status`. O filtro de `financeiro` **não pode** ser um `.eq()` direto na query de `alunos` (o status financeiro é derivado, não uma coluna) — precisa ser aplicado **depois** de buscar o lote de cobranças, restringindo os `alunoIds` retornados antes da paginação final.

Isto muda a ordem de operações em `listStudents`: quando `filters.financeiro` está presente, a função precisa:
1. Buscar TODOS os alunos que passam nos outros filtros (sem paginação ainda) — ou uma aproximação razoável: buscar os ids de alunos + suas cobranças do mês, filtrar em memória, paginar o resultado filtrado.

Como isso é uma mudança de fluxo maior que só adicionar uma cláusula, implemente como uma função auxiliar dentro de `students.ts`:

```typescript
export type StudentFilters = {
  nome?: string;
  serieId?: string;
  turmaId?: string;
  segmento?: string;
  anoLetivo?: number;
  situacao?: SituacaoAluno;
  financeiro?: StatusFinanceiroFiltro;
  page?: number;
  pageSize?: number;
};
```

```typescript
export async function listStudents(filters?: StudentFilters): Promise<PaginatedStudents> {
  const supabase = await createServerClient();
  const page = Math.max(1, filters?.page ?? 1);
  const pageSize = filters?.pageSize ?? STUDENTS_PAGE_SIZE;

  if (filters?.financeiro) {
    // Filtro por status financeiro não é uma coluna — precisa resolver o
    // status derivado de TODOS os alunos que passam nos demais filtros antes
    // de paginar, senão a paginação corta o conjunto errado (mostraria 30
    // linhas onde só algumas batem o filtro, com contagem total errada).
    const { data: todosIds, error: idsError } = await runStudentsQuery(
      supabase,
      { ...filters, financeiro: undefined },
      0,
      100000 // sem paginação nesta primeira passada — lote pequeno o suficiente para uma escola
    );
    if (idsError) throw idsError;

    const idsCandidatos = (todosIds ?? []).map((r) => r.id as string);
    const statusPorAluno = await getFinanceiroMesCorrentePorAluno(idsCandidatos);
    const idsFiltrados = idsCandidatos.filter((id) => statusPorAluno.get(id) === filters.financeiro);

    const from = (page - 1) * pageSize;
    const to = from + pageSize;
    const idsDaPagina = idsFiltrados.slice(from, to);

    const rows = (todosIds ?? []).filter((r) => idsDaPagina.includes(r.id as string));
    return { rows, total: idsFiltrados.length, page, pageSize };
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await runStudentsQuery(supabase, filters, from, to);
  if (error) throw error;

  return { rows: data ?? [], total: count ?? 0, page, pageSize };
}
```

**Atenção**: `runStudentsQuery` tem assinatura `(supabase, filters, from, to)` — confirme a assinatura real lendo o código (já visto na investigação: linha 34-89 do arquivo) antes de chamar com `(supabase, {...filters, financeiro: undefined}, 0, 100000)`; o campo `financeiro` não é usado dentro de `runStudentsQuery` (é tratado só aqui em `listStudents`), então passá-lo ou não nesse objeto não muda o resultado da query em si — é só higiene de tipo.

- [ ] **Step 6: Escrever teste do filtro combinado com paginação**

```typescript
// acrescentar em src/lib/data/students.test.ts
describe("listStudents com filtro financeiro", () => {
  it("filtra por status financeiro antes de paginar", async () => {
    // Este teste de integração exige mockar tanto runStudentsQuery (via mock
    // do supabase client) quanto getFinanceiroMesCorrentePorAluno. Como
    // listStudents chama runStudentsQuery internamente (não exportada),
    // monte o mock do zero: 5 alunos retornados pela query base, 2 deles com
    // status "vencido" no mapa financeiro, pageSize=1 força a paginação a
    // cortar mesmo dentro do subconjunto filtrado.
    const alunosBase = [
      { id: "a1", nome: "Ana" },
      { id: "a2", nome: "Bruno" },
      { id: "a3", nome: "Carla" },
      { id: "a4", nome: "Davi" },
      { id: "a5", nome: "Elis" },
    ];
    const order = vi.fn().mockReturnThis();
    const range = vi.fn().mockResolvedValue({ data: alunosBase, error: null, count: alunosBase.length });
    const eq = vi.fn().mockReturnThis();
    const select = vi.fn().mockReturnValue({ eq, order, range });
    fromMock.mockImplementation((table: string) => {
      if (table === "cobrancas") {
        const gte = vi.fn().mockReturnThis();
        const lte = vi.fn().mockReturnThis();
        const inFn = vi.fn().mockResolvedValue({
          data: [
            { aluno_id: "a2", origem: "manual", status: "aberta", data_vencimento: "2026-09-01" },
            { aluno_id: "a4", origem: "manual", status: "aberta", data_vencimento: "2026-09-02" },
          ],
          error: null,
        });
        return { select: vi.fn().mockReturnValue({ in: inFn, gte, lte }) };
      }
      return { select };
    });

    const result = await listStudents({ financeiro: "vencido", page: 1, pageSize: 1 });

    expect(result.total).toBe(2); // so a2 e a4 batem "vencido"
    expect(result.rows).toHaveLength(1); // pageSize=1 corta dentro do subconjunto de 2
  });
});
```

Nota: este teste depende fortemente de como `runStudentsQuery` monta a chain do supabase client — como ele não é exportado e sua implementação real já existe, adapte os mocks acima para bater com a chain REAL vista em `runStudentsQuery` (ler o código antes de escrever o mock final; o mock acima é um esqueleto de intenção, não literal).

- [ ] **Step 7: Rodar e ver passar**

Run: `npx vitest run src/lib/data/students.test.ts`
Expected: PASS.

- [ ] **Step 8: Rodar typecheck**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 9: Commit**

```bash
git add src/lib/data/students.ts src/lib/data/students.test.ts
git commit -m "feat(alunos): consulta em lote de status financeiro do mes e filtro na listagem"
```

---

### Task 6: Coluna Financeiro na tabela + filtro na UI

**Files:**
- Modify: `src/app/(app)/alunos/page.tsx` (nova coluna na tabela, chamando `getFinanceiroMesCorrentePorAluno`)
- Modify: `src/components/students/student-filters.tsx` (novo `FilterDropdown` "Financeiro")
- Create: `src/components/students/financeiro-status-badge.tsx`
- Test: `src/components/students/financeiro-status-badge.test.tsx`

**Interfaces:**
- Consumes: `getFinanceiroMesCorrentePorAluno` (Task 5), `StatusFinanceiroMes` (Task 4).
- Produces: `<FinanceiroStatusBadge status={StatusFinanceiroMes} />` — client-safe presentational component (pode ser Server Component também, sem estado).

- [ ] **Step 1: Escrever o teste do badge (falha)**

```tsx
// src/components/students/financeiro-status-badge.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { FinanceiroStatusBadge } from "./financeiro-status-badge";

describe("FinanceiroStatusBadge", () => {
  it("mostra Pago (isaac) para pago_isaac", () => {
    render(<FinanceiroStatusBadge status="pago_isaac" />);
    expect(screen.getByText(/pago \(isaac\)/i)).toBeInTheDocument();
  });

  it("mostra Pago (manual) para pago_manual", () => {
    render(<FinanceiroStatusBadge status="pago_manual" />);
    expect(screen.getByText(/pago \(manual\)/i)).toBeInTheDocument();
  });

  it("mostra Em aberto para aberto", () => {
    render(<FinanceiroStatusBadge status="aberto" />);
    expect(screen.getByText(/em aberto/i)).toBeInTheDocument();
  });

  it("mostra Vencido para vencido", () => {
    render(<FinanceiroStatusBadge status="vencido" />);
    expect(screen.getByText(/vencido/i)).toBeInTheDocument();
  });

  it("mostra travessao para null", () => {
    render(<FinanceiroStatusBadge status={null} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/components/students/financeiro-status-badge.test.tsx`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar o badge**

```tsx
// src/components/students/financeiro-status-badge.tsx
import { Badge } from "@/components/ui/badge";
import type { StatusFinanceiroMes } from "@/lib/finance/status-mes-corrente";

const LABEL: Record<Exclude<StatusFinanceiroMes, null>, string> = {
  pago_isaac: "Pago (isaac)",
  pago_manual: "Pago (manual)",
  aberto: "Em aberto",
  vencido: "Vencido",
};

const TONE: Record<Exclude<StatusFinanceiroMes, null>, "green" | "gray" | "gold" | "red"> = {
  pago_isaac: "green",
  pago_manual: "green",
  aberto: "gray",
  vencido: "red",
};

export function FinanceiroStatusBadge({ status }: { status: StatusFinanceiroMes }) {
  if (status === null) return <span className="text-ink/38">—</span>;
  return <Badge tone={TONE[status]}>{LABEL[status]}</Badge>;
}
```

Confirme que `Badge` aceita as tones `"green"`, `"gray"`, `"gold"`, `"red"` lendo `src/components/ui/badge.tsx` antes de finalizar — se algum desses tokens não existir, use o que já está disponível no componente real (não invente um novo).

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/components/students/financeiro-status-badge.test.tsx`
Expected: PASS (5 testes).

- [ ] **Step 5: Adicionar a coluna na tabela**

Em `src/app/(app)/alunos/page.tsx`, adicionar ao array de `filters` a leitura do novo param, buscar o mapa financeiro, e renderizar a coluna:

```tsx
// no topo da função StudentsPage, junto dos outros filtros:
  const filters = {
    nome:      params.nome     || undefined,
    serieId:   params.serie    || undefined,
    turmaId:   params.turma    || undefined,
    segmento:  params.segmento || undefined,
    situacao:  (params.situacao as "ativos" | "inativos" | "todos") || undefined,
    financeiro: (params.financeiro as "pago_isaac" | "pago_manual" | "aberto" | "vencido") || undefined,
    anoLetivo,
    page:      Number.isNaN(pageParam) ? 1 : pageParam
  };
```

```tsx
// depois de listStudents resolver, antes do return:
  const financeiroPorAluno = await getFinanceiroMesCorrentePorAluno(students.map((s) => s.id));
```

```tsx
// no <thead>, adicionar coluna antes de "Ação":
              <th className="w-[160px]">Status</th>
              <th className="w-[140px]">Financeiro</th>
              <th className="w-[132px] text-right">Ação</th>
```

```tsx
// no <tbody>, dentro do .map(), adicionar célula antes da célula de Ação:
                  <td>
                    <StatusPill tone={student.ativo ? "success" : "neutral"}>
                      {student.ativo ? "Ativo" : "Inativo"}
                    </StatusPill>
                  </td>
                  <td>
                    <FinanceiroStatusBadge status={financeiroPorAluno.get(student.id) ?? null} />
                  </td>
                  <td className="pr-4 text-right">
```

Importar `getFinanceiroMesCorrentePorAluno` de `@/lib/data/students` e `FinanceiroStatusBadge` de `@/components/students/financeiro-status-badge` no topo do arquivo.

Também atualizar `colSpan={7}` para `colSpan={8}` no `<td>` da linha "Nenhum aluno encontrado" (uma coluna a mais na tabela).

- [ ] **Step 6: Adicionar o filtro Financeiro em `student-filters.tsx`**

Ler o arquivo completo (já lido durante o planejamento). Adicionar, próximo do `FilterDropdown` de "Situação":

```tsx
        <FilterDropdown
          label="Financeiro"
          value={searchParams.get("financeiro") ?? ""}
          options={[
            { value: "pago_isaac", label: "Pago (isaac)" },
            { value: "pago_manual", label: "Pago (manual)" },
            { value: "aberto", label: "Em aberto" },
            { value: "vencido", label: "Vencido" },
          ]}
          emptyLabel="Todos"
          onChange={(v) => update("financeiro", v, ["page"])}
        />
```

- [ ] **Step 7: Rodar typecheck**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 8: Rodar suíte de alunos**

Run: `npx vitest run src/components/students src/lib/data/students.test.ts`
Expected: todos passam.

- [ ] **Step 9: Commit**

```bash
git add "src/app/(app)/alunos/page.tsx" src/components/students/financeiro-status-badge.tsx src/components/students/financeiro-status-badge.test.tsx src/components/students/student-filters.tsx
git commit -m "feat(alunos): coluna e filtro de status financeiro do mes corrente"
```

---

### Task 7: Selo de origem (isaac/manual) no extrato da ficha do aluno

**Files:**
- Modify: `src/lib/data/finance.ts:37-68` (`getStudentStatement` — incluir `origem` na seleção)
- Modify: `src/components/finance/student-statement-section.tsx`
- Test: `src/lib/data/finance.test.ts` (estender ou criar, cobrindo só a seleção de campos, não a lógica de negócio — é leitura simples)

**Interfaces:**
- Consumes: `cobrancas.origem` (coluna já existente, `'manual' | 'isaac'`, default `'manual'`).
- Produces: `getStudentStatement` retorna `charges` com campo `origem` em cada item.

- [ ] **Step 1: Adicionar `origem` à seleção de `getStudentStatement`**

```typescript
// src/lib/data/finance.ts — trecho de getStudentStatement, substituindo o select
  const charges = await supabase
    .from("cobrancas")
    .select(`
      id, descricao, competencia, numero_parcela, valor_final, data_vencimento, status, origem,
      asaas_payment_id, asaas_invoice_url,
      pagamentos(id, valor_pago, data_pagamento, forma_pagamento, cancelado_em, registrado_por, perfis:registrado_por(nome))
    `)
    .eq("aluno_id", alunoId)
    .gte("data_vencimento", de)
    .lte("data_vencimento", ate)
    .order("data_vencimento", { ascending: true });
```

- [ ] **Step 2: Adicionar o selo em `student-statement-section.tsx`**

Ler o arquivo completo (já lido durante o planejamento — 51 linhas). Adicionar o selo de origem ao lado do status, dentro do `.map()` de `statement.charges`:

```tsx
// src/components/finance/student-statement-section.tsx — dentro do .map(), célula de status
            <span className="text-muted">
              {displayStatus(c.status, c.data_vencimento)}
              {" "}
              <span
                className={
                  c.origem === "isaac"
                    ? "rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase bg-brand/10 text-brand"
                    : "rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase bg-ink/10 text-ink/60"
                }
              >
                {c.origem === "isaac" ? "isaac" : "manual"}
              </span>
            </span>
```

Nota: `c.origem` pode ser `undefined` em dado legado sem essa coluna populada (embora a coluna tenha default `'manual'` desde sua criação) — o operador ternário acima já trata qualquer valor que não seja `"isaac"` como `"manual"`, então não quebra visualmente mesmo se `origem` vier `null`/`undefined`.

- [ ] **Step 3: Rodar typecheck**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 4: Rodar suíte de financeiro**

Run: `npx vitest run src/lib/data/finance.test.ts src/components/finance`
Expected: passam (ou não há teste dedicado ainda — nesse caso confirmar manualmente via typecheck que o componente compila).

- [ ] **Step 5: Commit**

```bash
git add src/lib/data/finance.ts src/components/finance/student-statement-section.tsx
git commit -m "feat(financeiro): selo de origem isaac/manual no extrato da ficha do aluno"
```

---

### Task 8: Verificação final

**Files:** nenhum arquivo novo — só validação.

- [ ] **Step 1: Rodar a suíte inteira**

Run: `npm run test`
Expected: todos os testes novos passando. Falha conhecida e pré-existente: `conferencia-planilha.test.ts` (fixture externa ausente, `public/11714876000116.xlsx`) — não relacionada a este plano, documentar no ledger se aparecer.

- [ ] **Step 2: Typecheck e build**

Run: `npm run typecheck && npm run build`
Expected: ambos verdes.

- [ ] **Step 3: Smoke test manual (documentar como pendente se não houver navegador disponível na execução)**

Roteiro: abrir `/alunos` → confirmar que não há mais botão Desativar/Ativar → aluno com matrícula ativa no ano mostra ícone Cancelar (vermelho) → aluno sem matrícula no ano mostra ícone Matricular (verde) → clicar Cancelar abre o diálogo completo da frente de Cancelamento → clicar Matricular navega para `/matriculas?aluno_id=X#nova-matricula` → coluna Financeiro mostra o status correto pra pelo menos um aluno com cobrança isaac e um com cobrança manual → filtro Financeiro reduz a lista corretamente combinado com paginação → abrir uma ficha de aluno com cobrança isaac e uma manual, confirmar que o extrato mostra os dois selos.

- [ ] **Step 4: Commit final (se houver ajustes de smoke test)**

```bash
git add -A
git commit -m "chore(alunos): ajustes finais de verificacao da lista de acoes e financeiro"
```
