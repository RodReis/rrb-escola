# Financeiro v2 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir a geração automática de cobranças por geração sob demanda idempotente, adicionar baixa parcial via trigger SQL, estorno (soft delete) de pagamentos, status `vencida` computado em runtime, filtros + busca em inadimplência, recibo PDF por pagamento e extrato PDF por aluno em período.

**Architecture:** Migration adiciona colunas de soft delete em `pagamentos` + função/trigger que recalcula `cobrancas.status` a partir da soma de pagamentos ativos. Backfill aplica a mesma lógica em dados existentes. Helpers `displayStatus` e `totalPago` centralizam a visão de status/saldo. Server actions migram para o novo modelo; `generateChargesForEnrollment` vira sob demanda + idempotente. UI ganha 6 cards, expand de pagamentos com estornar/recibo, edição de cobrança em passo separado, e PDFs novos.

**Tech Stack:** Next.js 14.2.35 (App Router), Supabase Postgres (RLS), TypeScript, `@supabase/ssr`, `jspdf` + `jspdf-autotable` (já no projeto), Tailwind.

**Spec:** `docs/superpowers/specs/2026-05-15-financeiro-v2-design.md`

---

## File Structure

### Novos arquivos

- `supabase/migrations/202605170001_financeiro_v2.sql` — colunas soft delete, função `recalc_cobranca_status`, trigger, backfill, constraint.
- `src/lib/finance/charge-status.ts` — helper `displayStatus`, `isUnpaid`.
- `src/lib/finance/charge-totals.ts` — helpers `totalPago`, `saldoDevedor`.
- `src/components/pdf/export-payment-receipt-button.tsx` — recibo por pagamento.
- `src/components/pdf/export-student-statement-button.tsx` — extrato por aluno em período.
- `src/components/finance/charge-edit-form.tsx` — form expand "Editar valores" (client component leve).
- `src/components/finance/payment-row.tsx` — linha de pagamento com estornar/recibo.
- `src/components/finance/cancel-payment-form.tsx` — modal motivo estorno.
- `src/components/finance/generate-charges-button.tsx` — botão "Gerar cobranças" para matrícula.
- `src/components/finance/delinquency-filters.tsx` — form filtros (date range + status + busca aluno).
- `src/components/finance/student-statement-section.tsx` — seção financeiro na ficha do aluno (form de período + lista + botão extrato).

### Arquivos modificados

- `src/lib/actions/finance.ts` — refactor + novas actions (`updateChargeAction`, `cancelPaymentAction`, `generateChargesForEnrollmentAction`).
- `src/lib/actions/academics.ts` — remove chamada automática a `generateChargesForEnrollment` em `createEnrollmentAction`.
- `src/lib/server/generate-charges.ts` — adiciona filtro defensivo de duplicatas + comentário.
- `src/lib/data/finance.ts` — `getFinanceData` retorna `pagamentos` com `cancelado_em`; `getDelinquencyReport` aceita filtros (período, status, aluno); novas funções `getChargeWithPayments(id)`, `getStudentStatement(alunoId, de, ate)`, `getEnrollmentChargesPreview(matriculaId)`.
- `src/lib/data/enrollments.ts` — `getEnrollmentDetail` retorna `pagamentos` com `cancelado_em` (para riscar estornados).
- `src/lib/types.ts` — campo opcional `cancelado_em`, `cancelado_por`, `motivo_cancelamento` em `Pagamento` (se exposto pelo tipo).
- `src/app/(app)/financeiro/page.tsx` — refactor: 6 cards, lista com expand de pagamentos, botões editar/pagar/cancelar/estornar/recibo.
- `src/app/(app)/relatorios/inadimplencia/page.tsx` — refactor: ler filtros de `searchParams`, renderizar form, agrupar com base nos filtros.
- `src/components/pdf/export-delinquency-button.tsx` — recebe filtros aplicados, incluí no cabeçalho do PDF.
- `src/app/(app)/matriculas/[id]/page.tsx` — adiciona botão "Gerar cobranças desta matrícula".
- `src/app/(app)/alunos/[id]/page.tsx` — adiciona `<StudentStatementSection>`.

---

## Fase 1 — Schema + helpers

### Task 1: Migration soft delete + constraint

**Files:**
- Create: `supabase/migrations/202605170001_financeiro_v2.sql`

- [ ] **Step 1: Criar arquivo com colunas + constraint**

```sql
-- Financeiro v2: soft delete em pagamentos, trigger de recalc de status, backfill, idempotencia de geracao.

alter table pagamentos
  add column if not exists cancelado_em timestamptz,
  add column if not exists cancelado_por uuid references perfis(id) on delete set null,
  add column if not exists motivo_cancelamento text;

create index if not exists pagamentos_cobranca_ativos_idx
  on pagamentos (cobranca_id) where cancelado_em is null;

alter table pagamentos
  drop constraint if exists pagamentos_valor_positivo;

alter table pagamentos
  add constraint pagamentos_valor_positivo check (valor_pago > 0);
```

- [ ] **Step 2: Aplicar e verificar**

Run: `npx supabase db reset`
Expected: migrations aplicam clean (incluindo a nova).

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/202605170001_financeiro_v2.sql
git commit -m "feat(db): add soft-delete columns and positive-value constraint on pagamentos"
```

---

### Task 2: Migration função + trigger recalc status

**Files:**
- Modify: `supabase/migrations/202605170001_financeiro_v2.sql`

- [ ] **Step 1: Append função e trigger ao arquivo**

```sql
create or replace function recalc_cobranca_status(p_cobranca_id uuid)
returns void as $$
declare
  v_pago numeric;
  v_total numeric;
begin
  select coalesce(sum(valor_pago), 0)
    into v_pago
    from pagamentos
   where cobranca_id = p_cobranca_id and cancelado_em is null;

  select valor_final into v_total from cobrancas where id = p_cobranca_id;

  update cobrancas
     set status = case
       when status = 'cancelada' then 'cancelada'
       when v_pago <= 0 then 'aberta'
       when v_pago < v_total then 'parcial'
       else 'paga'
     end
   where id = p_cobranca_id;
end;
$$ language plpgsql security definer set search_path = public;

create or replace function trg_pagamento_status() returns trigger as $$
begin
  if tg_op = 'DELETE' then
    perform recalc_cobranca_status(old.cobranca_id);
    return old;
  end if;
  perform recalc_cobranca_status(new.cobranca_id);
  return new;
end;
$$ language plpgsql;

drop trigger if exists pagamentos_recalc_status on pagamentos;
create trigger pagamentos_recalc_status
  after insert or update or delete on pagamentos
  for each row execute function trg_pagamento_status();
```

- [ ] **Step 2: Aplicar e verificar**

Run: `npx supabase db reset`
Expected: clean. No próximo passo testaremos o comportamento.

- [ ] **Step 3: Smoke test no DB**

Run (PowerShell, via supabase CLI):

```
npx supabase db execute --local "
  with target as (select id, valor_final from cobrancas limit 1)
  select id, valor_final, (select status from cobrancas where id = target.id) as status from target;
"
```

Apenas para confirmar que o CLI responde — não é um teste funcional do trigger (smoke tests funcionais vêm na Task 4 backfill + Task 7+).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/202605170001_financeiro_v2.sql
git commit -m "feat(db): add recalc_cobranca_status trigger"
```

---

### Task 3: Migration backfill de status

**Files:**
- Modify: `supabase/migrations/202605170001_financeiro_v2.sql`

- [ ] **Step 1: Append backfill ao arquivo**

```sql
update cobrancas c
set status = case
  when c.status = 'cancelada' then 'cancelada'
  when coalesce((select sum(valor_pago) from pagamentos p where p.cobranca_id = c.id and p.cancelado_em is null), 0) <= 0 then 'aberta'
  when coalesce((select sum(valor_pago) from pagamentos p where p.cobranca_id = c.id and p.cancelado_em is null), 0) < c.valor_final then 'parcial'
  else 'paga'
end;
```

- [ ] **Step 2: Aplicar e verificar**

Run: `npx supabase db reset`
Expected: clean. Seed re-aplicado.

- [ ] **Step 3: Verificar dados pós-backfill**

Run (PowerShell):

```
npx supabase db execute --local "
  select status, count(*) from cobrancas group by status;
"
```

Expected: linhas existentes têm status coerente com pagamentos (cobranças sem pagamentos = `aberta`, totalmente pagas = `paga`, etc.).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/202605170001_financeiro_v2.sql
git commit -m "feat(db): backfill cobranca status based on existing payments"
```

---

### Task 4: Helper `displayStatus`

**Files:**
- Create: `src/lib/finance/charge-status.ts`

- [ ] **Step 1: Escrever helper**

```ts
export type CobrancaStatusDisplay = "aberta" | "parcial" | "paga" | "vencida" | "cancelada";

export function displayStatus(
  status: string,
  dataVencimento: string,
  today: string = new Date().toISOString().slice(0, 10)
): CobrancaStatusDisplay {
  if (status === "paga" || status === "cancelada") return status;
  if (dataVencimento < today && (status === "aberta" || status === "parcial")) return "vencida";
  return status as CobrancaStatusDisplay;
}

export function isUnpaid(status: CobrancaStatusDisplay): boolean {
  return status === "aberta" || status === "parcial" || status === "vencida";
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: passa.

- [ ] **Step 3: Commit**

```bash
git add src/lib/finance/charge-status.ts
git commit -m "feat(finance): add displayStatus helper for runtime vencida"
```

---

### Task 5: Helper `charge-totals`

**Files:**
- Create: `src/lib/finance/charge-totals.ts`

- [ ] **Step 1: Escrever helper**

```ts
export type PagamentoLite = {
  valor_pago: number | string;
  cancelado_em: string | null;
};

export function totalPago(pagamentos: PagamentoLite[]): number {
  return pagamentos
    .filter((p) => !p.cancelado_em)
    .reduce((sum, p) => sum + Number(p.valor_pago), 0);
}

export function saldoDevedor(valorFinal: number, pagamentos: PagamentoLite[]): number {
  return Math.max(valorFinal - totalPago(pagamentos), 0);
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: passa.

- [ ] **Step 3: Commit**

```bash
git add src/lib/finance/charge-totals.ts
git commit -m "feat(finance): add charge totals helpers"
```

---

## Fase 2 — Server actions

### Task 6: Remove auto-geração em `createEnrollmentAction`

**Files:**
- Modify: `src/lib/actions/academics.ts`

- [ ] **Step 1: Localizar a chamada**

Run (Grep): pattern `generateChargesForEnrollment` em `src/lib/actions/academics.ts`.
Expected: 1 match dentro de `createEnrollmentAction`.

- [ ] **Step 2: Remover linhas**

Remover o bloco que chama `generateChargesForEnrollment({...})` dentro de `createEnrollmentAction`. Manter o resto. Remover o import `import { generateChargesForEnrollment } from "@/lib/server/generate-charges";` (a action não usa mais).

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: passa.

- [ ] **Step 4: Commit**

```bash
git add src/lib/actions/academics.ts
git commit -m "refactor(finance): stop auto-generating charges on enrollment create"
```

---

### Task 7: Idempotência em `generateChargesForEnrollment`

**Files:**
- Modify: `src/lib/server/generate-charges.ts`

- [ ] **Step 1: Adicionar filtro de duplicatas antes do insert**

Antes do bloco `if (rows.length > 0) { ... }` adicionar:

```ts
// Idempotência: filtra linhas que já existem para esta matrícula.
type ExistingChargeQuery = {
  select: (columns: string) => {
    eq: (column: string, value: string) => Promise<{ data: Array<{ competencia: string; numero_parcela: number | null }> | null; error: unknown }>;
  };
};

const existingQuery = input.supabase.from("cobrancas") as ExistingChargeQuery;
const { data: existing } = await existingQuery
  .select("competencia, numero_parcela")
  .eq("matricula_id", input.matriculaId);

const seen = new Set<string>(
  (existing ?? []).map((row) => `${row.competencia}#${row.numero_parcela ?? 0}`)
);
const filtered = rows.filter((row) => !seen.has(`${row.competencia}#${row.numero_parcela ?? 0}`));

if (filtered.length === 0) return;
```

Trocar o bloco final para usar `filtered` em vez de `rows`:

```ts
const insertQuery = input.supabase.from("cobrancas") as InsertQuery;
await insertQuery.insert(filtered);
```

- [ ] **Step 2: Adicionar comentário no topo do arquivo**

Topo (após imports/types):

```ts
// generateChargesForEnrollment: geração sob demanda. Filtra duplicatas (matricula_id + competencia + numero_parcela) para ser idempotente.
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: passa.

- [ ] **Step 4: Commit**

```bash
git add src/lib/server/generate-charges.ts
git commit -m "refactor(finance): make generateChargesForEnrollment idempotent"
```

---

### Task 8: Action `generateChargesForEnrollmentAction`

**Files:**
- Modify: `src/lib/actions/finance.ts`

- [ ] **Step 1: Adicionar imports + função**

Adicionar imports (no topo):

```ts
import { generateChargesForEnrollment } from "@/lib/server/generate-charges";
```

Adicionar função no final do arquivo:

```ts
export async function generateChargesForEnrollmentAction(formData: FormData) {
  await requireSession();
  const matriculaId = formText(formData, "matricula_id");
  if (!matriculaId) redirect("/matriculas?erro=id");

  const supabase = await createServerClient();
  const { data: matricula } = await supabase
    .from("matriculas")
    .select("id, escola_id, aluno_id, plano_id, data_matricula, ano_letivo")
    .eq("id", matriculaId)
    .single();

  if (!matricula?.plano_id) redirect(`/matriculas/${matriculaId}?erro=plano`);

  await generateChargesForEnrollment({
    supabase,
    escolaId: matricula.escola_id,
    alunoId: matricula.aluno_id,
    matriculaId: matricula.id,
    planoId: matricula.plano_id,
    dataMatricula: matricula.data_matricula,
    anoLetivo: matricula.ano_letivo
  });

  revalidatePath(`/matriculas/${matriculaId}`);
  redirect(`/matriculas/${matriculaId}?gerado=1`);
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: passa.

- [ ] **Step 3: Commit**

```bash
git add src/lib/actions/finance.ts
git commit -m "feat(finance): add generateChargesForEnrollmentAction"
```

---

### Task 9: Action `updateChargeAction`

**Files:**
- Modify: `src/lib/actions/finance.ts`

- [ ] **Step 1: Adicionar função**

Adicionar após `createChargeAction`:

```ts
export async function updateChargeAction(formData: FormData) {
  await requireSession();
  const cobrancaId = formText(formData, "cobranca_id");
  if (!cobrancaId) redirect("/financeiro?erro=id");

  const supabase = await createServerClient();
  const { error } = await supabase
    .from("cobrancas")
    .update({
      descricao: formText(formData, "descricao") ?? undefined,
      data_vencimento: formText(formData, "data_vencimento") ?? undefined,
      valor_desconto: formNumber(formData, "valor_desconto") ?? 0,
      valor_acrescimo: formNumber(formData, "valor_acrescimo") ?? 0
    })
    .eq("id", cobrancaId)
    .neq("status", "paga");

  if (error) redirect(`/financeiro?erro=editar`);
  revalidatePath("/financeiro");
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: passa.

- [ ] **Step 3: Commit**

```bash
git add src/lib/actions/finance.ts
git commit -m "feat(finance): add updateChargeAction (blocks paga)"
```

---

### Task 10: Refactor `payChargeAction` para popular `registrado_por`

**Files:**
- Modify: `src/lib/actions/finance.ts`

- [ ] **Step 1: Trocar função inteira**

Substituir o conteúdo atual de `payChargeAction` por:

```ts
export async function payChargeAction(formData: FormData) {
  const session = await requireSession();
  const cobrancaId = formText(formData, "cobranca_id");
  const alunoId = formText(formData, "aluno_id");
  const valorPago = formNumber(formData, "valor_pago");
  if (!cobrancaId || !alunoId || !valorPago) redirect("/financeiro?erro=campos");

  const supabase = await createServerClient();
  const { error } = await supabase.from("pagamentos").insert({
    escola_id: DEFAULT_SCHOOL_ID,
    cobranca_id: cobrancaId,
    aluno_id: alunoId,
    data_pagamento: formText(formData, "data_pagamento") ?? new Date().toISOString().slice(0, 10),
    valor_pago: valorPago,
    forma_pagamento: formText(formData, "forma_pagamento") ?? "pix",
    observacao: formText(formData, "observacao"),
    registrado_por: session.profile.id
  });

  if (error) redirect("/financeiro?erro=pagamento");
  // Trigger pagamentos_recalc_status atualiza cobrancas.status automaticamente.
  revalidatePath("/financeiro");
}
```

(Note: o update manual de `cobrancas.status` foi removido — agora o trigger faz.)

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: passa.

- [ ] **Step 3: Commit**

```bash
git add src/lib/actions/finance.ts
git commit -m "refactor(finance): payChargeAction populates registrado_por and relies on trigger"
```

---

### Task 11: Action `cancelPaymentAction` (estorno)

**Files:**
- Modify: `src/lib/actions/finance.ts`

- [ ] **Step 1: Adicionar função**

Adicionar após `payChargeAction`:

```ts
export async function cancelPaymentAction(formData: FormData) {
  const session = await requireSession();
  const pagamentoId = formText(formData, "pagamento_id");
  const motivo = formText(formData, "motivo") ?? "Sem motivo informado";
  if (!pagamentoId) redirect("/financeiro?erro=id");

  const supabase = await createServerClient();
  const { error } = await supabase
    .from("pagamentos")
    .update({
      cancelado_em: new Date().toISOString(),
      cancelado_por: session.profile.id,
      motivo_cancelamento: motivo
    })
    .eq("id", pagamentoId)
    .is("cancelado_em", null);

  if (error) redirect("/financeiro?erro=estornar");
  // Trigger recalcula status da cobranca.
  revalidatePath("/financeiro");
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: passa.

- [ ] **Step 3: Commit**

```bash
git add src/lib/actions/finance.ts
git commit -m "feat(finance): add cancelPaymentAction (soft delete)"
```

---

### Checkpoint A — Fase 1 + 2 sanity

- [ ] **Step 1: Build + lint + typecheck**

Run:
```
npm run typecheck
npm run lint
npm run build
```
Expected: todos passam.

- [ ] **Step 2: Validar manualmente fluxo de pagamento e status**

(Manual; o usuário valida fora do plano automatizado.)

- Logar no app (`admin@rrbescola.local`).
- Em `/financeiro`, pagar uma cobrança parcialmente (`valor_pago` < `valor_final`).
- Verificar que ao recarregar, status é `parcial` (trigger funcionou).
- Pagar o saldo restante. Status vira `paga`.
- (Sem UI de estorno ainda — testaremos depois da Fase 3.)

---

## Fase 3 — Data layer adapta a `cancelado_em`

### Task 12: `getFinanceData` retorna pagamentos com soft-delete

**Files:**
- Modify: `src/lib/data/finance.ts`

- [ ] **Step 1: Atualizar select da query**

Trocar:

```ts
.select("*, alunos(nome), pagamentos(valor_pago, data_pagamento, forma_pagamento)")
```

por:

```ts
.select("*, alunos(nome), pagamentos(id, valor_pago, data_pagamento, forma_pagamento, observacao, cancelado_em, cancelado_por, motivo_cancelamento, registrado_por, perfis:registrado_por(nome))")
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: passa (tipo aberto via `any` no consumidor; ajustar tipos no consumer se houver erro).

- [ ] **Step 3: Commit**

```bash
git add src/lib/data/finance.ts
git commit -m "refactor(data): include payment soft-delete fields in finance query"
```

---

### Task 13: `getChargeWithPayments(id)` para detalhes

**Files:**
- Modify: `src/lib/data/finance.ts`

- [ ] **Step 1: Adicionar função**

Append:

```ts
export async function getChargeWithPayments(cobrancaId: string) {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("cobrancas")
    .select(`
      *,
      alunos(id, nome, matricula_codigo),
      pagamentos(id, valor_pago, data_pagamento, forma_pagamento, observacao, cancelado_em, cancelado_por, motivo_cancelamento, registrado_por, perfis:registrado_por(nome))
    `)
    .eq("id", cobrancaId)
    .single();

  if (error) throw error;
  return data;
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: passa.

- [ ] **Step 3: Commit**

```bash
git add src/lib/data/finance.ts
git commit -m "feat(data): add getChargeWithPayments"
```

---

### Task 14: `getStudentStatement(alunoId, de, ate)`

**Files:**
- Modify: `src/lib/data/finance.ts`

- [ ] **Step 1: Adicionar função**

Append:

```ts
export async function getStudentStatement(alunoId: string, de: string, ate: string) {
  const supabase = await createServerClient();

  const charges = await supabase
    .from("cobrancas")
    .select(`
      id, descricao, competencia, numero_parcela, valor_final, data_vencimento, status,
      pagamentos(id, valor_pago, data_pagamento, forma_pagamento, cancelado_em, registrado_por, perfis:registrado_por(nome))
    `)
    .eq("aluno_id", alunoId)
    .gte("data_vencimento", de)
    .lte("data_vencimento", ate)
    .order("data_vencimento", { ascending: true });

  if (charges.error) throw charges.error;

  const aluno = await supabase
    .from("alunos")
    .select("id, nome, matricula_codigo")
    .eq("id", alunoId)
    .single();

  if (aluno.error) throw aluno.error;

  return {
    aluno: aluno.data,
    de,
    ate,
    charges: charges.data ?? []
  };
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: passa.

- [ ] **Step 3: Commit**

```bash
git add src/lib/data/finance.ts
git commit -m "feat(data): add getStudentStatement for date-range statements"
```

---

### Task 15: `getEnrollmentChargesPreview(matriculaId)`

**Files:**
- Modify: `src/lib/data/finance.ts`

- [ ] **Step 1: Adicionar função**

Append:

```ts
export async function getEnrollmentChargesPreview(matriculaId: string) {
  const supabase = await createServerClient();
  const matricula = await supabase
    .from("matriculas")
    .select("id, plano_id, ano_letivo, planos(quantidade_parcelas, valor_matricula)")
    .eq("id", matriculaId)
    .single();

  if (matricula.error) throw matricula.error;

  const existing = await supabase
    .from("cobrancas")
    .select("id, competencia, numero_parcela", { count: "exact", head: false })
    .eq("matricula_id", matriculaId);

  if (existing.error) throw existing.error;

  const plano = Array.isArray(matricula.data?.planos) ? matricula.data?.planos?.[0] : matricula.data?.planos;
  const totalPlano = plano
    ? Number(plano.quantidade_parcelas ?? 0) + (Number(plano.valor_matricula ?? 0) > 0 ? 1 : 0)
    : 0;

  return {
    temPlano: Boolean(matricula.data?.plano_id),
    existentes: existing.data?.length ?? 0,
    totalPlano,
    aGerar: Math.max(totalPlano - (existing.data?.length ?? 0), 0)
  };
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: passa.

- [ ] **Step 3: Commit**

```bash
git add src/lib/data/finance.ts
git commit -m "feat(data): add getEnrollmentChargesPreview for generation button"
```

---

### Task 16: `getDelinquencyReport` aceita filtros

**Files:**
- Modify: `src/lib/data/finance.ts`

- [ ] **Step 1: Trocar a assinatura**

Substituir a função inteira:

```ts
export type DelinquencyFilters = {
  de: string;          // YYYY-MM-DD
  ate: string;         // YYYY-MM-DD
  statuses: string[];  // subset of ["aberta","parcial","vencida"]
  aluno: string | null;
};

export async function getDelinquencyReport(filters: DelinquencyFilters) {
  const today = new Date().toISOString().slice(0, 10);
  const supabase = await createServerClient();

  const dbStatuses = filters.statuses.filter((s) => s !== "vencida");
  // "vencida" não é status físico — vira data_vencimento < today com status in (aberta, parcial)
  const includeVencida = filters.statuses.includes("vencida");
  if (dbStatuses.length === 0 && !includeVencida) {
    return { date: today, filters, rows: [], total: 0, byStudent: [] };
  }

  let query = supabase
    .from("cobrancas")
    .select(`
      id, descricao, competencia, data_vencimento, status, valor_final,
      alunos!inner(id, matricula_codigo, nome),
      pagamentos(valor_pago, cancelado_em)
    `)
    .eq("escola_id", DEFAULT_SCHOOL_ID)
    .gte("data_vencimento", filters.de)
    .lte("data_vencimento", filters.ate);

  if (filters.aluno) {
    const term = `%${filters.aluno}%`;
    query = query.or(`nome.ilike.${term},matricula_codigo.ilike.${term}`, { foreignTable: "alunos" });
  }

  // Tratar status: pegar todas as 3 e filtrar em runtime para suportar "vencida" computada.
  query = query.in("status", ["aberta", "parcial"]);

  const { data, error } = await query.order("data_vencimento", { ascending: true });
  if (error) throw error;

  const rows = (data ?? []).filter((item) => {
    const isVencida = item.data_vencimento < today;
    const want = includeVencida && isVencida
      ? true
      : dbStatuses.includes(item.status as string) && !isVencida;
    return want;
  });

  const total = rows.reduce((sum, item) => sum + Number(item.valor_final ?? 0), 0);
  const byStudent = new Map<string, { aluno: string; matricula: string; total: number; quantidade: number }>();

  for (const item of rows) {
    const aluno = Array.isArray(item.alunos) ? item.alunos[0] : item.alunos;
    const key = aluno?.id ?? "sem-aluno";
    const current = byStudent.get(key) ?? {
      aluno: aluno?.nome ?? "Sem aluno",
      matricula: aluno?.matricula_codigo ?? "",
      total: 0,
      quantidade: 0
    };
    current.total += Number(item.valor_final ?? 0);
    current.quantidade += 1;
    byStudent.set(key, current);
  }

  return {
    date: today,
    filters,
    rows,
    total,
    byStudent: Array.from(byStudent.values()).sort((a, b) => b.total - a.total)
  };
}
```

Remover qualquer assinatura antiga (zero-args). Atualizar import de `DEFAULT_SCHOOL_ID` se necessário (já existe no arquivo).

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: erro em `/relatorios/inadimplencia/page.tsx` por chamar `getDelinquencyReport()` sem argumentos — esperado, fixado na Task 23.

- [ ] **Step 3: Commit**

```bash
git add src/lib/data/finance.ts
git commit -m "refactor(data): getDelinquencyReport accepts filters (period, status, aluno)"
```

---

### Task 17: `getEnrollmentDetail` retorna cancelado_em

**Files:**
- Modify: `src/lib/data/enrollments.ts`

- [ ] **Step 1: Atualizar select de pagamentos**

Localizar a select que retorna `payments` em `getEnrollmentDetail`. Adicionar `cancelado_em` à lista de colunas.

Antes (exemplo):
```ts
.from("pagamentos")
.select("id, valor_pago, data_pagamento, forma_pagamento, cobrancas(descricao)")
```

Depois:
```ts
.from("pagamentos")
.select("id, valor_pago, data_pagamento, forma_pagamento, cancelado_em, cobrancas(descricao)")
```

Se o cálculo de `valorPago` agregar pagamentos, filtrar por `cancelado_em is null`:
```ts
const valorPago = (payments ?? []).filter((p) => !p.cancelado_em).reduce((sum, p) => sum + Number(p.valor_pago), 0);
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: passa.

- [ ] **Step 3: Commit**

```bash
git add src/lib/data/enrollments.ts
git commit -m "refactor(data): enrollment detail filters cancelled payments"
```

---

## Fase 4 — UI Dashboard /financeiro

### Task 18: Componente `<ChargeEditForm>` (expand "Editar valores")

**Files:**
- Create: `src/components/finance/charge-edit-form.tsx`

- [ ] **Step 1: Escrever componente**

```tsx
import { updateChargeAction } from "@/lib/actions/finance";

type Props = {
  charge: {
    id: string;
    descricao: string;
    data_vencimento: string;
    valor_desconto: number | string;
    valor_acrescimo: number | string;
  };
};

export function ChargeEditForm({ charge }: Props) {
  return (
    <form action={updateChargeAction} className="grid gap-3 rounded-ui border border-line bg-muted/30 p-3 md:grid-cols-5">
      <input type="hidden" name="cobranca_id" value={charge.id} />
      <label className="md:col-span-2">
        Descricao
        <input name="descricao" defaultValue={charge.descricao} required />
      </label>
      <label>
        Vencimento
        <input name="data_vencimento" type="date" defaultValue={charge.data_vencimento} required />
      </label>
      <label>
        Desconto
        <input name="valor_desconto" inputMode="decimal" defaultValue={String(charge.valor_desconto)} />
      </label>
      <label>
        Acrescimo
        <input name="valor_acrescimo" inputMode="decimal" defaultValue={String(charge.valor_acrescimo)} />
      </label>
      <button className="ds-button ds-button-secondary self-end md:col-span-5 md:justify-self-end" type="submit">
        Salvar
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: passa.

- [ ] **Step 3: Commit**

```bash
git add src/components/finance/charge-edit-form.tsx
git commit -m "feat(finance): add ChargeEditForm component"
```

---

### Task 19: Componente `<PaymentRow>` + `<CancelPaymentForm>`

**Files:**
- Create: `src/components/finance/payment-row.tsx`
- Create: `src/components/finance/cancel-payment-form.tsx`

- [ ] **Step 1: Escrever `cancel-payment-form.tsx`**

```tsx
import { cancelPaymentAction } from "@/lib/actions/finance";

export function CancelPaymentForm({ pagamentoId }: { pagamentoId: string }) {
  return (
    <form action={cancelPaymentAction} className="inline-flex items-center gap-2">
      <input type="hidden" name="pagamento_id" value={pagamentoId} />
      <input name="motivo" placeholder="Motivo do estorno" className="w-44" />
      <button className="text-xs font-black text-clay" type="submit">Estornar</button>
    </form>
  );
}
```

- [ ] **Step 2: Escrever `payment-row.tsx`**

```tsx
import { money } from "@/lib/constants";
import { CancelPaymentForm } from "./cancel-payment-form";
import { ExportPaymentReceiptButton } from "@/components/pdf/export-payment-receipt-button";

type PaymentRowProps = {
  pagamento: {
    id: string;
    valor_pago: number | string;
    data_pagamento: string;
    forma_pagamento: string;
    cancelado_em: string | null;
    motivo_cancelamento: string | null;
    perfis: { nome: string } | null;
  };
  cobranca: {
    id: string;
    descricao: string;
    competencia: string;
    numero_parcela: number | null;
    valor_final: number | string;
    valor_original: number | string;
    valor_desconto: number | string;
    valor_acrescimo: number | string;
  };
  aluno: { nome: string; matricula_codigo: string };
  saldoApos: number;
};

function dateText(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("pt-BR");
}

export function PaymentRow({ pagamento, cobranca, aluno, saldoApos }: PaymentRowProps) {
  const isCanceled = Boolean(pagamento.cancelado_em);
  return (
    <div className={`grid gap-2 border-t border-line py-2 text-sm md:grid-cols-[1fr_120px_120px_160px_220px] ${isCanceled ? "opacity-60 line-through" : ""}`}>
      <span>{dateText(pagamento.data_pagamento)}</span>
      <span className="font-bold">{money.format(Number(pagamento.valor_pago))}</span>
      <span>{pagamento.forma_pagamento}</span>
      <span className="text-muted">{pagamento.perfis?.nome ?? "—"}</span>
      <div className="flex flex-wrap items-center gap-2 justify-end">
        {!isCanceled ? (
          <>
            <ExportPaymentReceiptButton
              pagamento={pagamento}
              cobranca={cobranca}
              aluno={aluno}
              saldoApos={saldoApos}
            />
            <CancelPaymentForm pagamentoId={pagamento.id} />
          </>
        ) : (
          <span className="text-xs italic text-muted">Estornado: {pagamento.motivo_cancelamento ?? ""}</span>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: erro: `ExportPaymentReceiptButton` ainda não existe — esperado, criado na Task 25. Ignorar até Task 25.

- [ ] **Step 4: Commit (defer typecheck até a Task 25 fechar)**

```bash
git add src/components/finance/payment-row.tsx src/components/finance/cancel-payment-form.tsx
git commit -m "feat(finance): add PaymentRow and CancelPaymentForm components"
```

---

### Task 20: Componente `<GenerateChargesButton>`

**Files:**
- Create: `src/components/finance/generate-charges-button.tsx`

- [ ] **Step 1: Escrever componente**

```tsx
import { generateChargesForEnrollmentAction } from "@/lib/actions/finance";

type Props = {
  matriculaId: string;
  preview: { temPlano: boolean; existentes: number; totalPlano: number; aGerar: number };
};

export function GenerateChargesButton({ matriculaId, preview }: Props) {
  if (!preview.temPlano) {
    return <p className="text-sm text-muted">Matricula sem plano vinculado. Adicione um plano para gerar cobrancas.</p>;
  }
  return (
    <form action={generateChargesForEnrollmentAction} className="flex items-center gap-3">
      <input type="hidden" name="matricula_id" value={matriculaId} />
      <button className="ds-button ds-button-primary" type="submit">
        Gerar cobrancas ({preview.aGerar} novas)
      </button>
      <span className="text-xs text-muted">Plano: {preview.totalPlano} parcelas. Existentes: {preview.existentes}.</span>
    </form>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: passa.

- [ ] **Step 3: Commit**

```bash
git add src/components/finance/generate-charges-button.tsx
git commit -m "feat(finance): add GenerateChargesButton component"
```

---

### Task 21: Refactor `/financeiro` page com 6 cards e expand

**Files:**
- Modify: `src/app/(app)/financeiro/page.tsx`

- [ ] **Step 1: Reescrever o componente**

Substituir o arquivo inteiro:

```tsx
import { CreditCard, Plus } from "lucide-react";
import { ExportFinanceButton } from "@/components/pdf/export-finance-button";
import { ChargeEditForm } from "@/components/finance/charge-edit-form";
import { PaymentRow } from "@/components/finance/payment-row";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, Panel } from "@/components/ui/card";
import { cancelChargeAction, createChargeAction, payChargeAction } from "@/lib/actions/finance";
import { money } from "@/lib/constants";
import { getFinanceData } from "@/lib/data/finance";
import { getAcademicData } from "@/lib/data/lookups";
import { displayStatus, isUnpaid } from "@/lib/finance/charge-status";
import { saldoDevedor, totalPago } from "@/lib/finance/charge-totals";

const statusTone = {
  aberta: "gold",
  vencida: "red",
  parcial: "gold",
  paga: "green",
  cancelada: "gray"
} as const;

const formasPagamento = ["pix", "dinheiro", "cartao", "boleto", "transferencia"];

function dateText(value: string | null | undefined) {
  if (!value) return "-";
  return new Date(`${value}T00:00:00`).toLocaleDateString("pt-BR");
}

export default async function FinanceiroPage() {
  const [{ alunos }, cobrancas] = await Promise.all([getAcademicData(), getFinanceData()]);
  const today = new Date().toISOString().slice(0, 10);

  let aVencer = 0;
  let vencido = 0;
  let pago = 0;
  let cancelado = 0;

  for (const item of cobrancas) {
    const pagamentos = (item.pagamentos ?? []) as Array<{ valor_pago: number | string; cancelado_em: string | null }>;
    const valorFinal = Number(item.valor_final ?? 0);
    const display = displayStatus(String(item.status), item.data_vencimento, today);

    if (display === "paga") {
      pago += totalPago(pagamentos);
    } else if (display === "cancelada") {
      cancelado += valorFinal;
    } else if (display === "vencida") {
      vencido += saldoDevedor(valorFinal, pagamentos);
    } else {
      aVencer += saldoDevedor(valorFinal, pagamentos);
    }
  }

  const emAbertoTotal = aVencer + vencido;

  const summary = [
    ["Cobrancas", String(cobrancas.length)],
    ["A vencer", money.format(aVencer)],
    ["Vencido", money.format(vencido)],
    ["Em aberto", money.format(emAbertoTotal)],
    ["Pago", money.format(pago)],
    ["Cancelado", money.format(cancelado)]
  ];

  return (
    <div className="grid gap-6">
      <section className="-mx-4 -mt-6 border-b border-line bg-surface px-4 py-8 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-8 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="flex items-center gap-3 text-[0.66rem] font-black uppercase tracking-[0.16em] text-ink/58">
              <span>Gestao</span>
              <span className="text-line">/</span>
              <span className="text-brand">Financeiro</span>
            </p>
            <h1 className="mt-8 text-4xl font-black leading-none text-brand md:text-5xl">
              Cobrancas <span className="font-serif italic text-ink/42">{cobrancas.length}</span>
            </h1>
            <p className="mt-4 max-w-2xl text-sm font-medium leading-6 text-ink/68">
              Lancamento, baixa parcial, estorno e exportacao de cobrancas escolares.
            </p>
          </div>

          <div className="grid gap-7">
            <div className="flex flex-wrap gap-2 xl:justify-end">
              <ExportFinanceButton rows={cobrancas} />
              <ButtonLink href="/planos" variant="secondary">
                <CreditCard size={16} /> Planos
              </ButtonLink>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-6">
        {summary.map(([label, value]) => (
          <Card key={label} className="p-5">
            <p className="ds-kicker">{label}</p>
            <strong className="mt-3 block text-2xl font-black text-ink">{value}</strong>
          </Card>
        ))}
      </section>

      <Panel className="grid gap-5">
        <div>
          <p className="ds-kicker">Nova cobranca</p>
          <h2 className="mt-2 text-xl font-black text-ink">Gerar lancamento avulso</h2>
        </div>
        <form action={createChargeAction} className="grid gap-4 md:grid-cols-6">
          <label className="md:col-span-2">
            Aluno
            <select name="aluno_id" required>
              {alunos.map((item) => (
                <option key={item.id} value={item.id}>{item.nome}</option>
              ))}
            </select>
          </label>
          <label className="md:col-span-2">Descricao<input name="descricao" required /></label>
          <label>Competencia<input name="competencia" placeholder="2026-05" /></label>
          <label>Parcela<input name="numero_parcela" type="number" /></label>
          <label>Valor<input name="valor_original" inputMode="decimal" /></label>
          <label>Desconto<input name="valor_desconto" inputMode="decimal" /></label>
          <label>Acrescimo<input name="valor_acrescimo" inputMode="decimal" /></label>
          <label>Vencimento<input name="data_vencimento" type="date" /></label>
          <button className="ds-button ds-button-accent self-end">
            <Plus size={16} /> Gerar
          </button>
        </form>
      </Panel>

      <section className="grid gap-3">
        {cobrancas.length === 0 ? (
          <Panel>
            <p className="text-sm font-medium text-ink/60">Nenhuma cobranca cadastrada.</p>
          </Panel>
        ) : null}
        {cobrancas.map((item) => {
          const pagamentos = (item.pagamentos ?? []) as Array<{
            id: string;
            valor_pago: number | string;
            data_pagamento: string;
            forma_pagamento: string;
            observacao: string | null;
            cancelado_em: string | null;
            cancelado_por: string | null;
            motivo_cancelamento: string | null;
            registrado_por: string | null;
            perfis: { nome: string } | null;
          }>;
          const display = displayStatus(String(item.status), item.data_vencimento, today);
          const settled = display === "paga" || display === "cancelada";
          const tone = statusTone[display];
          const valorFinal = Number(item.valor_final ?? 0);
          const saldo = saldoDevedor(valorFinal, pagamentos);
          const alunoInfo = item.alunos ?? { nome: "Sem aluno", matricula_codigo: "" };

          return (
            <Panel key={item.id} className="grid gap-3">
              <div className="grid gap-4 lg:grid-cols-[1fr_170px_360px] lg:items-center">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <strong className="text-ink">{item.descricao}</strong>
                    <Badge tone={tone}>{display}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-ink/65">
                    {alunoInfo.nome} - vence em {dateText(item.data_vencimento)} - {item.competencia}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-black uppercase tracking-[0.12em] text-ink/50">Saldo</p>
                  <strong className="mt-1 block text-2xl text-brand">{money.format(saldo)}</strong>
                  <span className="text-xs text-muted">de {money.format(valorFinal)}</span>
                </div>

                {settled ? (
                  <div className="justify-self-start lg:justify-self-end">
                    <Badge tone={display === "paga" ? "green" : "gray"}>
                      {display === "paga" ? "Pago" : "Cancelada"}
                    </Badge>
                  </div>
                ) : (
                  <div className="grid gap-2">
                    <form action={payChargeAction} className="grid grid-cols-[1fr_110px_96px] gap-2">
                      <input type="hidden" name="cobranca_id" value={item.id} />
                      <input type="hidden" name="aluno_id" value={item.aluno_id} />
                      <input name="valor_pago" defaultValue={saldo.toFixed(2)} inputMode="decimal" />
                      <select name="forma_pagamento" defaultValue="pix">
                        {formasPagamento.map((f) => <option key={f} value={f}>{f}</option>)}
                      </select>
                      <button className="ds-button ds-button-primary min-h-0 px-3 py-2 text-xs" type="submit">Pagar</button>
                    </form>
                    <details className="text-xs">
                      <summary className="cursor-pointer text-ink/60">Editar valores</summary>
                      <div className="mt-2">
                        <ChargeEditForm charge={{
                          id: item.id,
                          descricao: item.descricao,
                          data_vencimento: item.data_vencimento,
                          valor_desconto: item.valor_desconto ?? 0,
                          valor_acrescimo: item.valor_acrescimo ?? 0
                        }} />
                      </div>
                    </details>
                    <form action={cancelChargeAction} className="text-right">
                      <input type="hidden" name="cobranca_id" value={item.id} />
                      <button className="text-xs font-black text-clay" type="submit">Cancelar cobranca</button>
                    </form>
                  </div>
                )}
              </div>

              {pagamentos.length > 0 ? (
                <details className="rounded-ui border border-line">
                  <summary className="cursor-pointer px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-ink/60">
                    Pagamentos ({pagamentos.filter((p) => !p.cancelado_em).length}/{pagamentos.length})
                  </summary>
                  <div className="grid gap-1 px-3 pb-3">
                    {pagamentos.map((p, idx) => {
                      // Saldo após este pagamento, considerando ordem cronológica e ignorando cancelados.
                      const acumulado = pagamentos
                        .slice(0, idx + 1)
                        .filter((pp) => !pp.cancelado_em)
                        .reduce((sum, pp) => sum + Number(pp.valor_pago), 0);
                      const saldoApos = Math.max(valorFinal - acumulado, 0);
                      return (
                        <PaymentRow
                          key={p.id}
                          pagamento={p}
                          cobranca={{
                            id: item.id,
                            descricao: item.descricao,
                            competencia: item.competencia,
                            numero_parcela: item.numero_parcela,
                            valor_final: valorFinal,
                            valor_original: item.valor_original,
                            valor_desconto: item.valor_desconto ?? 0,
                            valor_acrescimo: item.valor_acrescimo ?? 0
                          }}
                          aluno={alunoInfo}
                          saldoApos={saldoApos}
                        />
                      );
                    })}
                  </div>
                </details>
              ) : null}
            </Panel>
          );
        })}
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: ainda há erro pendente sobre `ExportPaymentReceiptButton`. Esperado até a Task 25.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/financeiro/page.tsx
git commit -m "feat(finance): dashboard with 6 cards and payment expand"
```

---

## Fase 5 — Geração manual em /matriculas/[id]

### Task 22: Botão "Gerar cobranças" em `/matriculas/[id]`

**Files:**
- Modify: `src/app/(app)/matriculas/[id]/page.tsx`

- [ ] **Step 1: Importar componentes e data**

Adicionar imports no topo:

```ts
import { GenerateChargesButton } from "@/components/finance/generate-charges-button";
import { getEnrollmentChargesPreview } from "@/lib/data/finance";
```

Mudar o `Promise.all` para incluir o preview:

```ts
const [{ alunos, series, turmas, planos }, detail, chargesPreview] = await Promise.all([
  getAcademicData(),
  getEnrollmentDetail(params.id),
  getEnrollmentChargesPreview(params.id)
]);
```

Adicionar a seção dentro do Panel "Historico financeiro", logo após o `<h2>`:

```tsx
<GenerateChargesButton matriculaId={enrollment.id} preview={chargesPreview} />
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: ainda erro pendente sobre `ExportPaymentReceiptButton`. Aceitar.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/matriculas/\[id\]/page.tsx
git commit -m "feat(finance): add Generate charges button on enrollment detail"
```

---

## Fase 6 — Inadimplência com filtros

### Task 23: Componente `<DelinquencyFilters>`

**Files:**
- Create: `src/components/finance/delinquency-filters.tsx`

- [ ] **Step 1: Escrever componente**

```tsx
type Props = {
  defaults: { de: string; ate: string; statuses: string[]; aluno: string };
};

export function DelinquencyFilters({ defaults }: Props) {
  const allStatuses = ["aberta", "parcial", "vencida"];
  return (
    <form method="GET" className="grid gap-3 rounded-ui border border-line bg-muted/30 p-4 md:grid-cols-[140px_140px_1fr_180px_120px]">
      <label>
        De
        <input type="date" name="de" defaultValue={defaults.de} required />
      </label>
      <label>
        Ate
        <input type="date" name="ate" defaultValue={defaults.ate} required />
      </label>
      <fieldset className="grid gap-2">
        <legend className="text-xs font-black uppercase tracking-[0.12em] text-ink/60">Status</legend>
        <div className="flex flex-wrap gap-3">
          {allStatuses.map((s) => (
            <label key={s} className="flex items-center gap-1 text-sm">
              <input type="checkbox" name="status" value={s} defaultChecked={defaults.statuses.includes(s)} />
              {s}
            </label>
          ))}
        </div>
      </fieldset>
      <label>
        Aluno
        <input name="aluno" placeholder="Nome ou matricula" defaultValue={defaults.aluno} />
      </label>
      <button className="ds-button ds-button-primary self-end" type="submit">Filtrar</button>
    </form>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: passa (componente isolado).

- [ ] **Step 3: Commit**

```bash
git add src/components/finance/delinquency-filters.tsx
git commit -m "feat(finance): add DelinquencyFilters component"
```

---

### Task 24: Refactor `/relatorios/inadimplencia` page

**Files:**
- Modify: `src/app/(app)/relatorios/inadimplencia/page.tsx`

- [ ] **Step 1: Reescrever a página**

```tsx
import { DelinquencyFilters } from "@/components/finance/delinquency-filters";
import { ExportDelinquencyButton } from "@/components/pdf/export-delinquency-button";
import { Badge } from "@/components/ui/badge";
import { Card, Panel } from "@/components/ui/card";
import { money } from "@/lib/constants";
import { getDelinquencyReport, type DelinquencyFilters as Filters } from "@/lib/data/finance";

export const dynamic = "force-dynamic";

function dateText(value: string | null | undefined) {
  if (!value) return "-";
  return new Date(`${value}T00:00:00`).toLocaleDateString("pt-BR");
}

function parseFilters(sp: { de?: string; ate?: string; status?: string | string[]; aluno?: string }): Filters {
  const today = new Date().toISOString().slice(0, 10);
  const thirtyAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const statusParam = sp.status;
  const statuses = Array.isArray(statusParam) ? statusParam : statusParam ? [statusParam] : ["parcial", "vencida"];
  return {
    de: sp.de || thirtyAgo,
    ate: sp.ate || today,
    statuses,
    aluno: sp.aluno?.trim() || null
  };
}

export default async function InadimplenciaPage({ searchParams }: { searchParams: { de?: string; ate?: string; status?: string | string[]; aluno?: string } }) {
  const filters = parseFilters(searchParams);
  const report = await getDelinquencyReport(filters);

  const summary = [
    ["Total no filtro", money.format(report.total)],
    ["Cobrancas", String(report.rows.length)],
    ["Alunos", String(report.byStudent.length)],
    ["Data base", dateText(report.date)]
  ];

  return (
    <div className="grid gap-6">
      <section className="-mx-4 -mt-6 border-b border-line bg-surface px-4 py-8 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-8 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="flex items-center gap-3 text-[0.66rem] font-black uppercase tracking-[0.16em] text-ink/58">
              <span>Relatorios</span>
              <span className="text-line">/</span>
              <span className="text-brand">Inadimplencia</span>
            </p>
            <h1 className="mt-8 text-4xl font-black leading-none text-brand md:text-5xl">Inadimplencia</h1>
            <p className="mt-4 max-w-2xl text-sm font-medium leading-6 text-ink/68">
              Cobrancas por periodo, status e aluno.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 xl:justify-end">
            <ExportDelinquencyButton rows={report.rows} filters={filters} />
          </div>
        </div>
      </section>

      <DelinquencyFilters defaults={{ de: filters.de, ate: filters.ate, statuses: filters.statuses, aluno: filters.aluno ?? "" }} />

      <section className="grid gap-4 md:grid-cols-4">
        {summary.map(([label, value]) => (
          <Card key={label} className="p-5">
            <p className="ds-kicker">{label}</p>
            <strong className="mt-3 block text-3xl font-black text-ink">{value}</strong>
          </Card>
        ))}
      </section>

      <Panel className="grid gap-4">
        <h2 className="text-lg font-black text-ink">Resumo por aluno</h2>
        <div className="grid gap-2">
          {report.byStudent.length === 0 ? (
            <p className="text-sm text-ink/65">Nenhuma cobranca no filtro selecionado.</p>
          ) : (
            report.byStudent.map((item) => (
              <div key={`${item.matricula}-${item.aluno}`} className="grid gap-2 rounded-ui border border-line p-3 text-sm md:grid-cols-[1fr_150px_100px]">
                <strong className="text-ink">{item.aluno}</strong>
                <span className="font-black text-brand">{money.format(item.total)}</span>
                <span className="text-ink/65">{item.quantidade} itens</span>
              </div>
            ))
          )}
        </div>
      </Panel>

      <section className="overflow-hidden rounded-panel border border-line bg-surface shadow-soft">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] text-left text-sm">
            <thead className="bg-muted text-xs font-black uppercase tracking-[0.1em] text-ink/62">
              <tr>
                <th className="px-5 py-3">Aluno</th>
                <th className="px-5 py-3">Descricao</th>
                <th className="px-5 py-3">Competencia</th>
                <th className="px-5 py-3">Vencimento</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Valor</th>
              </tr>
            </thead>
            <tbody>
              {report.rows.map((item) => {
                const aluno = Array.isArray(item.alunos) ? item.alunos[0] : item.alunos;
                const isVencida = item.data_vencimento < report.date;
                const display = isVencida ? "vencida" : item.status;
                const tone = display === "vencida" ? "red" : display === "parcial" ? "gold" : "gray";
                return (
                  <tr key={item.id} className="border-t border-line transition hover:bg-muted/60">
                    <td className="px-5 py-4 font-black text-ink">{aluno?.nome}</td>
                    <td className="px-5 py-4 text-ink/70">{item.descricao}</td>
                    <td className="px-5 py-4 text-ink/70">{item.competencia}</td>
                    <td className="px-5 py-4 text-ink/70">{dateText(item.data_vencimento)}</td>
                    <td className="px-5 py-4"><Badge tone={tone}>{display}</Badge></td>
                    <td className="px-5 py-4 font-black text-brand">{money.format(Number(item.valor_final))}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Atualizar `<ExportDelinquencyButton>` para aceitar `filters`**

Editar `src/components/pdf/export-delinquency-button.tsx`:

- Adicionar prop `filters?: { de: string; ate: string; statuses: string[]; aluno: string | null }`.
- Renderizar no cabeçalho do PDF: `Período: <de> a <ate>` e `Status: <statuses.join(', ')>` e `Aluno: <aluno || 'Todos'>`.
- Manter assinatura compatível com chamada vazia.

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: ainda apenas erro pendente sobre `ExportPaymentReceiptButton`.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(app\)/relatorios/inadimplencia/page.tsx src/components/pdf/export-delinquency-button.tsx
git commit -m "feat(finance): delinquency report with period/status/aluno filters"
```

---

## Fase 7 — Recibos PDF

### Task 25: Componente `<ExportPaymentReceiptButton>`

**Files:**
- Create: `src/components/pdf/export-payment-receipt-button.tsx`

- [ ] **Step 1: Escrever componente client**

```tsx
"use client";

import jsPDF from "jspdf";
import { Receipt } from "lucide-react";

type Props = {
  pagamento: {
    id: string;
    valor_pago: number | string;
    data_pagamento: string;
    forma_pagamento: string;
    observacao: string | null;
    perfis: { nome: string } | null;
  };
  cobranca: {
    id: string;
    descricao: string;
    competencia: string;
    numero_parcela: number | null;
    valor_final: number | string;
    valor_original: number | string;
    valor_desconto: number | string;
    valor_acrescimo: number | string;
  };
  aluno: { nome: string; matricula_codigo: string };
  saldoApos: number;
};

function fmt(value: number | string) {
  return Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function dateText(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("pt-BR");
}

export function ExportPaymentReceiptButton({ pagamento, cobranca, aluno, saldoApos }: Props) {
  function exportPdf() {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a5" });
    let y = 16;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text("RRB Escola", 12, y);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text("CNPJ 00.000.000/0001-00 | (62) 3333-0000", 12, y + 5);
    doc.text(`Recibo Nº: ${pagamento.id.slice(0, 8).toUpperCase()}`, 12, y + 10);

    y += 22;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("RECIBO DE PAGAMENTO", 12, y);
    doc.setLineWidth(0.2);
    doc.line(12, y + 2, 136, y + 2);

    y += 10;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`Aluno: ${aluno.nome} (matricula ${aluno.matricula_codigo})`, 12, y);
    y += 5;
    doc.text(`Referente a: ${cobranca.descricao}`, 12, y);
    y += 5;
    doc.text(`Competencia: ${cobranca.competencia}    Parcela: ${cobranca.numero_parcela ?? "-"}`, 12, y);

    y += 8;
    doc.text(`Valor original:   ${fmt(cobranca.valor_original)}`, 12, y); y += 5;
    doc.text(`Desconto:        -${fmt(cobranca.valor_desconto)}`, 12, y); y += 5;
    doc.text(`Acrescimo:       +${fmt(cobranca.valor_acrescimo)}`, 12, y); y += 5;
    doc.setFont("helvetica", "bold");
    doc.text(`Valor cobranca:   ${fmt(cobranca.valor_final)}`, 12, y); y += 7;
    doc.line(12, y - 2, 70, y - 2);
    doc.setFont("helvetica", "normal");
    doc.text(`Valor pago:       ${fmt(pagamento.valor_pago)}`, 12, y); y += 5;
    doc.text(`Forma:            ${pagamento.forma_pagamento}`, 12, y); y += 5;
    doc.text(`Data:             ${dateText(pagamento.data_pagamento)}`, 12, y); y += 5;
    if (saldoApos > 0) {
      doc.text(`Saldo apos pagamento: ${fmt(saldoApos)}`, 12, y);
      y += 5;
    }

    y += 5;
    doc.text(`Recebido por: ${pagamento.perfis?.nome ?? "-"}`, 12, y);
    y += 5;
    doc.text(`Local e data: Goiania, ${new Date().toLocaleDateString("pt-BR")}`, 12, y);

    y += 18;
    doc.line(12, y, 90, y);
    doc.text("Assinatura", 12, y + 5);

    doc.save(`recibo-${pagamento.id.slice(0, 8)}.pdf`);
  }

  return (
    <button onClick={exportPdf} className="ds-button ds-button-ghost min-h-0 px-2 py-1 text-xs" type="button">
      <Receipt size={14} /> Recibo
    </button>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: passa (resolve erro pendente das Tasks 19/21/22).

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: passa.

- [ ] **Step 4: Commit**

```bash
git add src/components/pdf/export-payment-receipt-button.tsx
git commit -m "feat(pdf): add ExportPaymentReceiptButton (per payment)"
```

---

### Task 26: Componente `<ExportStudentStatementButton>`

**Files:**
- Create: `src/components/pdf/export-student-statement-button.tsx`

- [ ] **Step 1: Escrever**

```tsx
"use client";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { FileText } from "lucide-react";

type Pagamento = {
  id: string;
  valor_pago: number | string;
  data_pagamento: string;
  forma_pagamento: string;
  cancelado_em: string | null;
  perfis: { nome: string } | null;
};

type Charge = {
  id: string;
  descricao: string;
  competencia: string;
  numero_parcela: number | null;
  valor_final: number | string;
  data_vencimento: string;
  status: string;
  pagamentos: Pagamento[];
};

type Props = {
  aluno: { nome: string; matricula_codigo: string };
  de: string;
  ate: string;
  charges: Charge[];
};

function fmt(value: number | string) {
  return Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function dateText(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("pt-BR");
}

export function ExportStudentStatementButton({ aluno, de, ate, charges }: Props) {
  function exportPdf() {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text("RRB Escola — Extrato Financeiro", 105, 14, { align: "center" });
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`Aluno: ${aluno.nome} (matricula ${aluno.matricula_codigo})`, 12, 22);
    doc.text(`Periodo: ${dateText(de)} a ${dateText(ate)}`, 12, 27);

    const chargeRows = charges.map((c) => {
      const pago = c.pagamentos.filter((p) => !p.cancelado_em).reduce((sum, p) => sum + Number(p.valor_pago), 0);
      const saldo = Math.max(Number(c.valor_final) - pago, 0);
      return [
        dateText(c.data_vencimento),
        c.descricao,
        fmt(c.valor_final),
        fmt(pago),
        fmt(saldo),
        c.status
      ];
    });

    autoTable(doc, {
      startY: 33,
      theme: "grid",
      head: [["Vencimento", "Descricao", "Valor", "Pago", "Saldo", "Status"]],
      body: chargeRows,
      styles: { fontSize: 8, cellPadding: 1.6 },
      headStyles: { fillColor: [23, 32, 27] }
    });

    const totalCobrado = charges.reduce((s, c) => s + Number(c.valor_final), 0);
    const totalPagoVal = charges.reduce((s, c) => s + c.pagamentos.filter((p) => !p.cancelado_em).reduce((sum, p) => sum + Number(p.valor_pago), 0), 0);
    const saldoDevedor = Math.max(totalCobrado - totalPagoVal, 0);

    // @ts-expect-error autoTable adds lastAutoTable
    const finalY = doc.lastAutoTable.finalY + 6;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(`Total cobrado: ${fmt(totalCobrado)}`, 12, finalY);
    doc.text(`Total pago:    ${fmt(totalPagoVal)}`, 12, finalY + 5);
    doc.text(`Saldo devedor: ${fmt(saldoDevedor)}`, 12, finalY + 10);

    const paymentsBody = charges.flatMap((c) =>
      c.pagamentos.filter((p) => !p.cancelado_em).map((p) => [
        dateText(p.data_pagamento),
        c.descricao,
        fmt(p.valor_pago),
        p.forma_pagamento,
        p.perfis?.nome ?? "-"
      ])
    );

    autoTable(doc, {
      startY: finalY + 16,
      theme: "grid",
      head: [["Data", "Cobranca", "Valor", "Forma", "Recebido por"]],
      body: paymentsBody.length > 0 ? paymentsBody : [["—", "Sem pagamentos no periodo", "", "", ""]],
      styles: { fontSize: 8, cellPadding: 1.6 },
      headStyles: { fillColor: [23, 32, 27] }
    });

    doc.save(`extrato-${aluno.matricula_codigo}-${de}_${ate}.pdf`);
  }

  return (
    <button onClick={exportPdf} className="ds-button ds-button-secondary" type="button">
      <FileText size={16} /> Exportar extrato
    </button>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: passa.

- [ ] **Step 3: Commit**

```bash
git add src/components/pdf/export-student-statement-button.tsx
git commit -m "feat(pdf): add ExportStudentStatementButton"
```

---

### Task 27: Seção financeiro na ficha do aluno

**Files:**
- Create: `src/components/finance/student-statement-section.tsx`
- Modify: `src/app/(app)/alunos/[id]/page.tsx`

- [ ] **Step 1: Escrever `student-statement-section.tsx`**

```tsx
import { ExportStudentStatementButton } from "@/components/pdf/export-student-statement-button";
import { Panel } from "@/components/ui/card";
import { getStudentStatement } from "@/lib/data/finance";

export async function StudentStatementSection({ alunoId, searchParams }: {
  alunoId: string;
  searchParams: { ext_de?: string; ext_ate?: string };
}) {
  const today = new Date().toISOString().slice(0, 10);
  const firstDayOfMonth = `${today.slice(0, 7)}-01`;
  const de = searchParams.ext_de || firstDayOfMonth;
  const ate = searchParams.ext_ate || today;
  const statement = await getStudentStatement(alunoId, de, ate);

  return (
    <Panel className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="ds-kicker">Financeiro</p>
          <h2 className="mt-2 font-serif text-2xl text-ink">Extrato</h2>
        </div>
        <form method="GET" className="flex flex-wrap items-end gap-2">
          <label className="text-xs">De<input name="ext_de" type="date" defaultValue={de} /></label>
          <label className="text-xs">Ate<input name="ext_ate" type="date" defaultValue={ate} /></label>
          <button className="ds-button ds-button-secondary text-xs" type="submit">Atualizar</button>
          <ExportStudentStatementButton aluno={statement.aluno} de={de} ate={ate} charges={statement.charges} />
        </form>
      </div>

      <div className="grid gap-2 text-sm">
        {statement.charges.length === 0 ? (
          <p className="text-muted">Nenhuma cobranca no periodo.</p>
        ) : statement.charges.map((c) => (
          <div key={c.id} className="grid gap-2 border-b border-line py-2 md:grid-cols-[1fr_120px_120px_120px]">
            <strong className="text-ink">{c.descricao}</strong>
            <span>Vence {new Date(`${c.data_vencimento}T00:00:00`).toLocaleDateString("pt-BR")}</span>
            <span className="font-bold">{Number(c.valor_final).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
            <span className="text-muted">{c.status}</span>
          </div>
        ))}
      </div>
    </Panel>
  );
}
```

- [ ] **Step 2: Incluir na ficha**

Editar `src/app/(app)/alunos/[id]/page.tsx`. Adicionar prop `searchParams` ao componente:

```tsx
export default async function StudentDetailPage({ params, searchParams }: { params: { id: string }; searchParams: { ext_de?: string; ext_ate?: string } }) {
```

Adicionar import:
```ts
import { StudentStatementSection } from "@/components/finance/student-statement-section";
```

Inserir o componente no final do JSX (antes do fechamento da div principal):

```tsx
<StudentStatementSection alunoId={params.id} searchParams={searchParams} />
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: passa.

- [ ] **Step 4: Commit**

```bash
git add src/components/finance/student-statement-section.tsx src/app/\(app\)/alunos/\[id\]/page.tsx
git commit -m "feat(finance): add student statement section on student sheet"
```

---

## Fase 8 — Verificação final

### Task 28: Sanity completa

- [ ] **Step 1: Build / typecheck / lint**

Run:
```
npm run typecheck
npm run lint
npm run build
```
Expected: todos passam.

- [ ] **Step 2: Database reset + seed**

Run:
```
npx supabase db reset
npm run seed:auth
```
Expected: clean.

- [ ] **Step 3: Smoke tests manuais (checklist)**

(Manual; usuário valida.)

- [ ] Logar como admin.
- [ ] Em `/financeiro`, 6 cards aparecem com valores corretos.
- [ ] Cobrança com data passada e status `aberta` mostra badge `vencida`.
- [ ] Pagar cobrança parcialmente → status `parcial`.
- [ ] Pagar restante → status `paga`.
- [ ] Expandir "Pagamentos (N)" → ver lista.
- [ ] Estornar um pagamento com motivo → linha aparece riscada, status volta.
- [ ] Editar valores em cobrança aberta → vencimento/desconto atualizam.
- [ ] Tentar editar cobrança paga (via curl/dev tools) → action ignora (nada muda).
- [ ] Em `/matriculas/[id]` com plano: botão "Gerar cobranças (X novas)" → cria N cobranças.
- [ ] Clicar 2x no botão "Gerar cobranças" → não duplica (X passa a 0).
- [ ] `/relatorios/inadimplencia?de=2025-01-01&ate=2026-12-31&status=vencida&aluno=alice` filtra corretamente.
- [ ] Botão "Exportar" no relatório gera PDF com cabeçalho mostrando filtros aplicados.
- [ ] Em pagamento ativo: botão "Recibo" → PDF gerado com saldo após pagamento (se parcial).
- [ ] Ficha do aluno mostra seção "Financeiro" com filtro de período. Botão "Exportar extrato" gera PDF.

- [ ] **Step 4: Commit fechamento**

```bash
git commit --allow-empty -m "chore: financeiro v2 implementation complete"
```
