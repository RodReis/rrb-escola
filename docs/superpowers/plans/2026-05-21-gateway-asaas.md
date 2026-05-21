# Gateway de Pagamento Asaas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrar o Asaas como gateway: gerar boleto/PIX para uma cobrança e confirmar o pagamento via webhook, dando baixa automática.

**Architecture:** Cliente HTTP do Asaas (`criarCustomer`, `criarCobranca`). Server action gera a cobrança sob demanda — cria o customer lazy, grava `asaas_payment_id`/`invoice_url` na `cobranca`. Webhook recebe a confirmação do Asaas, cria a baixa em `pagamentos` e marca a cobrança `paga`.

**Tech Stack:** TypeScript, Next.js 14, Supabase, Vitest, Asaas API v3.

**Spec:** `docs/superpowers/specs/2026-05-21-gateway-asaas-design.md`
**Branch:** criar `feature/gateway-asaas` a partir de `developer`.

---

## File Structure

**Criar:**
- `supabase/migrations/202605310007_asaas.sql` — colunas Asaas em cobrancas/responsaveis
- `src/lib/asaas/webhook.ts` — `eventoConfirmaPagamento` + `processarWebhookAsaas`
- `src/lib/asaas/webhook.test.ts` — testes
- `src/lib/asaas/client.ts` — cliente HTTP Asaas
- `src/lib/actions/asaas.ts` — `gerarCobrancaAsaasAction`
- `src/app/api/asaas/webhook/route.ts` — rota do webhook
- `src/components/finance/gerar-boleto-button.tsx` — botão (client component)

**Modificar:**
- `src/lib/data/finance.ts` — `getStudentStatement` retorna as colunas Asaas
- `src/components/finance/student-statement-section.tsx` — botão na linha de cobrança
- `.env.local` — vars Asaas

---

## Task 0: Branch

- [ ] **Step 1: Criar a branch a partir de `developer`**

Run:
```bash
git checkout developer
git checkout -b feature/gateway-asaas
```
Expected: `Switched to a new branch 'feature/gateway-asaas'`.

---

## Task 1: Migração — colunas Asaas

**Files:**
- Create: `supabase/migrations/202605310007_asaas.sql`

- [ ] **Step 1: Criar a migração**

`supabase/migrations/202605310007_asaas.sql`:

```sql
-- Gateway Asaas: ids e status do Asaas em cobrancas e responsaveis_aluno.

alter table responsaveis_aluno
  add column if not exists asaas_customer_id text;

alter table cobrancas
  add column if not exists asaas_payment_id text;

alter table cobrancas
  add column if not exists asaas_invoice_url text;

alter table cobrancas
  add column if not exists asaas_status text;

create index if not exists cobrancas_asaas_payment_idx
  on cobrancas (asaas_payment_id);
```

- [ ] **Step 2: Aplicar via MCP Supabase**

Aplicar `202605310007_asaas.sql` no projeto `fljkjhmwnjehsodvqaqk` via MCP
`apply_migration` (name: `202605310007_asaas`).
Expected: `{"success": true}`.

- [ ] **Step 3: Verificar**

Via MCP `execute_sql` no projeto `fljkjhmwnjehsodvqaqk`:

```sql
SELECT column_name FROM information_schema.columns
WHERE table_name='cobrancas' AND column_name LIKE 'asaas%';
SELECT column_name FROM information_schema.columns
WHERE table_name='responsaveis_aluno' AND column_name='asaas_customer_id';
```

Expected: `asaas_payment_id`, `asaas_invoice_url`, `asaas_status` na `cobrancas`;
`asaas_customer_id` na `responsaveis_aluno`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/202605310007_asaas.sql
git commit -m "feat(asaas): add Asaas id and status columns"
```

---

## Task 2: Lógica do webhook — `eventoConfirmaPagamento` (TDD)

Função pura que decide quais eventos do Asaas contam como pagamento confirmado.

**Files:**
- Create: `src/lib/asaas/webhook.ts`
- Create: `src/lib/asaas/webhook.test.ts`

- [ ] **Step 1: Escrever o teste**

`src/lib/asaas/webhook.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { eventoConfirmaPagamento } from "./webhook";

describe("eventoConfirmaPagamento", () => {
  it("PAYMENT_RECEIVED confirma pagamento", () => {
    expect(eventoConfirmaPagamento("PAYMENT_RECEIVED")).toBe(true);
  });

  it("PAYMENT_CONFIRMED confirma pagamento", () => {
    expect(eventoConfirmaPagamento("PAYMENT_CONFIRMED")).toBe(true);
  });

  it("PAYMENT_OVERDUE não confirma", () => {
    expect(eventoConfirmaPagamento("PAYMENT_OVERDUE")).toBe(false);
  });

  it("PAYMENT_CREATED não confirma", () => {
    expect(eventoConfirmaPagamento("PAYMENT_CREATED")).toBe(false);
  });

  it("evento desconhecido não confirma", () => {
    expect(eventoConfirmaPagamento("ALGO_ESTRANHO")).toBe(false);
  });

  it("string vazia não confirma", () => {
    expect(eventoConfirmaPagamento("")).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar — deve FALHAR**

Run: `npx vitest run src/lib/asaas/webhook.test.ts`
Expected: FAIL — `eventoConfirmaPagamento` não existe.

- [ ] **Step 3: Implementar (só a função pura por ora)**

`src/lib/asaas/webhook.ts`:

```typescript
import "server-only";

const EVENTOS_PAGAMENTO = new Set(["PAYMENT_RECEIVED", "PAYMENT_CONFIRMED"]);

// Decide se um evento de webhook do Asaas representa pagamento confirmado.
export function eventoConfirmaPagamento(evento: string): boolean {
  return EVENTOS_PAGAMENTO.has(evento);
}
```

- [ ] **Step 4: Rodar — deve PASSAR**

Run: `npx vitest run src/lib/asaas/webhook.test.ts`
Expected: PASS — 6 testes.

- [ ] **Step 5: Commit**

```bash
git add src/lib/asaas/webhook.ts src/lib/asaas/webhook.test.ts
git commit -m "feat(asaas): add payment event classification"
```

---

## Task 3: Cliente Asaas

Cliente HTTP de baixo nível. `server-only`. Degrada graciosamente sem config.

**Files:**
- Create: `src/lib/asaas/client.ts`

- [ ] **Step 1: Criar `src/lib/asaas/client.ts`**

```typescript
import "server-only";

export type AsaasResult<T> =
  | { ok: true; data: T }
  | { ok: false; reason: string };

type AsaasConfig = {
  apiKey: string;
  apiUrl: string;
};

function getConfig(): AsaasConfig | null {
  const apiKey = process.env.ASAAS_API_KEY;
  const apiUrl = process.env.ASAAS_API_URL;
  if (!apiKey || !apiUrl) return null;
  return { apiKey, apiUrl: apiUrl.replace(/\/$/, "") };
}

async function asaasPost<T>(
  config: AsaasConfig,
  path: string,
  body: Record<string, unknown>,
): Promise<AsaasResult<T>> {
  try {
    const res = await fetch(`${config.apiUrl}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        access_token: config.apiKey,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });

    const json = (await res.json().catch(() => null)) as any;

    if (!res.ok) {
      const erro = json?.errors?.[0]?.description ?? `Asaas HTTP ${res.status}`;
      return { ok: false, reason: String(erro).slice(0, 200) };
    }

    return { ok: true, data: json as T };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : "falha Asaas" };
  }
}

// Cria um customer (pagador) no Asaas.
export async function criarCustomer(input: {
  nome: string;
  cpfCnpj: string;
  email?: string | null;
  celular?: string | null;
}): Promise<AsaasResult<{ id: string }>> {
  const config = getConfig();
  if (!config) return { ok: false, reason: "Asaas não configurado" };

  return asaasPost<{ id: string }>(config, "/customers", {
    name: input.nome,
    cpfCnpj: input.cpfCnpj.replace(/\D/g, ""),
    email: input.email ?? undefined,
    mobilePhone: input.celular ? input.celular.replace(/\D/g, "") : undefined,
  });
}

// Cria uma cobrança (boleto/PIX) no Asaas.
export async function criarCobranca(input: {
  customerId: string;
  valor: number;
  vencimento: string; // YYYY-MM-DD
  descricao: string;
}): Promise<AsaasResult<{ id: string; invoiceUrl: string; status: string }>> {
  const config = getConfig();
  if (!config) return { ok: false, reason: "Asaas não configurado" };

  return asaasPost<{ id: string; invoiceUrl: string; status: string }>(
    config,
    "/payments",
    {
      customer: input.customerId,
      billingType: "UNDEFINED",
      value: input.valor,
      dueDate: input.vencimento,
      description: input.descricao,
    },
  );
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/lib/asaas/client.ts
git commit -m "feat(asaas): add Asaas API client"
```

---

## Task 4: `processarWebhookAsaas`

A função que dá baixa: recebe o payload, acha a cobrança, cria o pagamento, marca paga.

**Files:**
- Modify: `src/lib/asaas/webhook.ts`

- [ ] **Step 1: Acrescentar `processarWebhookAsaas`**

Acrescentar ao final de `src/lib/asaas/webhook.ts`:

```typescript
import { createAdminClient } from "@/lib/supabase/admin";

export type WebhookResult =
  | { ok: true; acao: "pago" | "status_atualizado" | "ignorado" }
  | { ok: false; reason: string };

type AsaasWebhookPayload = {
  event?: string;
  payment?: {
    id?: string;
    status?: string;
    value?: number;
    billingType?: string;
  };
};

// Mapeia o billingType do Asaas para a forma_pagamento local.
function formaPagamento(billingType: string | undefined): "pix" | "boleto" {
  return billingType === "BOLETO" ? "boleto" : "pix";
}

export async function processarWebhookAsaas(
  payload: AsaasWebhookPayload,
): Promise<WebhookResult> {
  const event = payload.event ?? "";
  const paymentId = payload.payment?.id;
  if (!paymentId) {
    return { ok: false, reason: "payload sem payment.id" };
  }

  const supabase = createAdminClient();

  // Acha a cobrança pelo id do payment Asaas.
  const { data: cobranca } = await supabase
    .from("cobrancas")
    .select("id, escola_id, aluno_id, matricula_id, valor_final, status")
    .eq("asaas_payment_id", paymentId)
    .maybeSingle();

  if (!cobranca) {
    // Payment que não corresponde a nenhuma cobrança local — ignora sem erro.
    return { ok: true, acao: "ignorado" };
  }

  // Atualiza sempre o status reportado pelo Asaas.
  await supabase
    .from("cobrancas")
    .update({ asaas_status: payload.payment?.status ?? event })
    .eq("id", cobranca.id);

  // Só dá baixa se o evento confirma pagamento e a cobrança ainda não está paga.
  if (!eventoConfirmaPagamento(event)) {
    return { ok: true, acao: "status_atualizado" };
  }
  if (cobranca.status === "paga") {
    return { ok: true, acao: "ignorado" };
  }

  const { error: pagErr } = await supabase.from("pagamentos").insert({
    escola_id: cobranca.escola_id,
    cobranca_id: cobranca.id,
    aluno_id: cobranca.aluno_id,
    matricula_id: cobranca.matricula_id,
    data_pagamento: new Date().toISOString().slice(0, 10),
    valor_pago: payload.payment?.value ?? cobranca.valor_final,
    forma_pagamento: formaPagamento(payload.payment?.billingType),
    observacao: "Pagamento confirmado via Asaas",
  });

  if (pagErr) {
    return { ok: false, reason: pagErr.message };
  }

  await supabase
    .from("cobrancas")
    .update({ status: "paga" })
    .eq("id", cobranca.id);

  return { ok: true, acao: "pago" };
}
```

- [ ] **Step 2: Verificar tipos e testes**

Run: `npx tsc --noEmit && npx vitest run src/lib/asaas/webhook.test.ts`
Expected: sem erros de tipo; os 6 testes de `eventoConfirmaPagamento` continuam passando.

- [ ] **Step 3: Commit**

```bash
git add src/lib/asaas/webhook.ts
git commit -m "feat(asaas): add webhook payment processing"
```

---

## Task 5: Rota do webhook

`POST /api/asaas/webhook` — protegida por token, chama `processarWebhookAsaas`.

**Files:**
- Create: `src/app/api/asaas/webhook/route.ts`

- [ ] **Step 1: Criar a rota**

`src/app/api/asaas/webhook/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { processarWebhookAsaas } from "@/lib/asaas/webhook";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const token = process.env.ASAAS_WEBHOOK_TOKEN;
  const header = req.headers.get("asaas-access-token");

  if (!token || header !== token) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const payload = await req.json().catch(() => null);
  if (!payload) {
    return NextResponse.json({ error: "payload inválido" }, { status: 400 });
  }

  const resultado = await processarWebhookAsaas(payload);

  // Retorna 200 mesmo em erro de negócio — o Asaas só precisa saber que recebemos.
  // Erros são reportados no corpo para inspeção.
  return NextResponse.json(resultado);
}
```

- [ ] **Step 2: Verificar tipos e build**

Run: `npx tsc --noEmit && npm run build`
Expected: sem erros; rota `/api/asaas/webhook` aparece no build.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/asaas/webhook/route.ts
git commit -m "feat(asaas): add webhook route"
```

---

## Task 6: Server action — gerar cobrança Asaas

`gerarCobrancaAsaasAction` — cria customer lazy, gera a cobrança, grava os ids.

**Files:**
- Create: `src/lib/actions/asaas.ts`

- [ ] **Step 1: Criar `src/lib/actions/asaas.ts`**

```typescript
"use server";

import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/session";
import { criarCustomer, criarCobranca } from "@/lib/asaas/client";

export type GerarCobrancaResult =
  | { ok: true; invoiceUrl: string }
  | { ok: false; reason: string };

export async function gerarCobrancaAsaasAction(
  cobrancaId: string,
): Promise<GerarCobrancaResult> {
  await requirePermission("financeiro.cobrancas", "update");
  const supabase = await createServerClient();

  // Carrega a cobrança.
  const { data: cobranca } = await supabase
    .from("cobrancas")
    .select("id, aluno_id, descricao, valor_final, data_vencimento, status, asaas_payment_id")
    .eq("id", cobrancaId)
    .maybeSingle();

  if (!cobranca) return { ok: false, reason: "Cobrança não encontrada" };
  if (cobranca.status === "paga" || cobranca.status === "cancelada") {
    return { ok: false, reason: "Cobrança já está paga ou cancelada" };
  }
  if (cobranca.asaas_payment_id) {
    return { ok: false, reason: "Cobrança já tem boleto gerado" };
  }

  // Responsável financeiro do aluno.
  const { data: responsavel } = await supabase
    .from("responsaveis_aluno")
    .select("id, nome, cpf, email, celular, asaas_customer_id")
    .eq("aluno_id", cobranca.aluno_id)
    .eq("responsavel_financeiro", true)
    .maybeSingle();

  if (!responsavel) {
    return { ok: false, reason: "Aluno sem responsável financeiro cadastrado" };
  }
  if (!responsavel.cpf || !responsavel.nome) {
    return { ok: false, reason: "Responsável financeiro precisa de nome e CPF cadastrados" };
  }

  // Customer lazy: cria no Asaas na primeira vez.
  let customerId = responsavel.asaas_customer_id;
  if (!customerId) {
    const cliente = await criarCustomer({
      nome: responsavel.nome,
      cpfCnpj: responsavel.cpf,
      email: responsavel.email,
      celular: responsavel.celular,
    });
    if (!cliente.ok) return { ok: false, reason: cliente.reason };
    customerId = cliente.data.id;
    await supabase
      .from("responsaveis_aluno")
      .update({ asaas_customer_id: customerId })
      .eq("id", responsavel.id);
  }

  // Cria a cobrança no Asaas.
  const pagamento = await criarCobranca({
    customerId,
    valor: Number(cobranca.valor_final),
    vencimento: cobranca.data_vencimento,
    descricao: cobranca.descricao,
  });
  if (!pagamento.ok) return { ok: false, reason: pagamento.reason };

  // Grava os dados do Asaas na cobrança.
  await supabase
    .from("cobrancas")
    .update({
      asaas_payment_id: pagamento.data.id,
      asaas_invoice_url: pagamento.data.invoiceUrl,
      asaas_status: pagamento.data.status,
    })
    .eq("id", cobranca.id);

  revalidatePath(`/alunos/${cobranca.aluno_id}`);
  return { ok: true, invoiceUrl: pagamento.data.invoiceUrl };
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/lib/actions/asaas.ts
git commit -m "feat(asaas): add gerarCobrancaAsaas server action"
```

---

## Task 7: Data layer — colunas Asaas no extrato

`getStudentStatement` passa a retornar `asaas_payment_id` e `asaas_invoice_url`.

**Files:**
- Modify: `src/lib/data/finance.ts`

- [ ] **Step 1: Adicionar as colunas ao select de `getStudentStatement`**

Em `src/lib/data/finance.ts`, na função `getStudentStatement`, o select de `cobrancas` é:

```typescript
    .select(`
      id, descricao, competencia, numero_parcela, valor_final, data_vencimento, status,
      pagamentos(id, valor_pago, data_pagamento, forma_pagamento, cancelado_em, registrado_por, perfis:registrado_por(nome))
    `)
```

Substituir por (acrescenta as 2 colunas Asaas):

```typescript
    .select(`
      id, descricao, competencia, numero_parcela, valor_final, data_vencimento, status,
      asaas_payment_id, asaas_invoice_url,
      pagamentos(id, valor_pago, data_pagamento, forma_pagamento, cancelado_em, registrado_por, perfis:registrado_por(nome))
    `)
```

- [ ] **Step 2: Verificar tipos e build**

Run: `npx tsc --noEmit && npm run build`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/lib/data/finance.ts
git commit -m "feat(asaas): include Asaas columns in student statement"
```

---

## Task 8: Botão "Gerar boleto/PIX" (client component)

**Files:**
- Create: `src/components/finance/gerar-boleto-button.tsx`

- [ ] **Step 1: Criar `src/components/finance/gerar-boleto-button.tsx`**

```typescript
"use client";

import { useState } from "react";
import { Barcode, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { gerarCobrancaAsaasAction } from "@/lib/actions/asaas";

export function GerarBoletoButton({
  cobrancaId,
  invoiceUrl,
}: {
  cobrancaId: string;
  invoiceUrl: string | null;
}) {
  const [loading, setLoading] = useState(false);
  const [url, setUrl] = useState<string | null>(invoiceUrl);

  // Já tem fatura — mostra o link.
  if (url) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1 text-xs font-semibold text-brand"
      >
        <ExternalLink size={12} /> Ver fatura
      </a>
    );
  }

  async function handleGerar() {
    setLoading(true);
    try {
      const res = await gerarCobrancaAsaasAction(cobrancaId);
      if (res.ok) {
        setUrl(res.invoiceUrl);
        toast.success("Boleto/PIX gerado.");
      } else {
        toast.error(res.reason);
      }
    } catch {
      toast.error("Erro ao gerar boleto.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleGerar}
      disabled={loading}
      className="inline-flex items-center gap-1 text-xs font-semibold text-brand disabled:opacity-50"
    >
      {loading ? <Loader2 size={12} className="animate-spin" /> : <Barcode size={12} />}
      {loading ? "Gerando…" : "Gerar boleto/PIX"}
    </button>
  );
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros. (`sonner`/`toast` já é usado no projeto — ex:
`src/components/matriculas/document-generator.tsx`.)

- [ ] **Step 3: Commit**

```bash
git add src/components/finance/gerar-boleto-button.tsx
git commit -m "feat(asaas): add generate boleto button component"
```

---

## Task 9: Botão no extrato financeiro do aluno

A linha de cobrança do extrato ganha a ação de gerar/ver boleto.

**Files:**
- Modify: `src/components/finance/student-statement-section.tsx`

- [ ] **Step 1: Adicionar o botão na linha de cobrança**

Em `src/components/finance/student-statement-section.tsx`:

(a) Importar o botão no topo:
```typescript
import { GerarBoletoButton } from "@/components/finance/gerar-boleto-button";
```

(b) A linha de cobrança atual é:
```typescript
          <div key={c.id} className="grid gap-2 border-b border-line py-2 md:grid-cols-[1fr_120px_120px_120px]">
            <strong className="text-ink">{c.descricao}</strong>
            <span>Vence {new Date(`${c.data_vencimento}T00:00:00`).toLocaleDateString("pt-BR")}</span>
            <span className="font-bold">{Number(c.valor_final).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
            <span className="text-muted">{displayStatus(c.status, c.data_vencimento)}</span>
          </div>
```

Substituir por (acrescenta uma 5ª coluna com a ação; cobrança paga/cancelada não mostra
botão):
```typescript
          <div key={c.id} className="grid gap-2 border-b border-line py-2 md:grid-cols-[1fr_120px_120px_120px_120px]">
            <strong className="text-ink">{c.descricao}</strong>
            <span>Vence {new Date(`${c.data_vencimento}T00:00:00`).toLocaleDateString("pt-BR")}</span>
            <span className="font-bold">{Number(c.valor_final).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
            <span className="text-muted">{displayStatus(c.status, c.data_vencimento)}</span>
            <span>
              {c.status !== "paga" && c.status !== "cancelada" ? (
                <GerarBoletoButton cobrancaId={c.id} invoiceUrl={c.asaas_invoice_url ?? null} />
              ) : null}
            </span>
          </div>
```

NOTA: `c.asaas_invoice_url` vem do select ampliado na Task 7. Se o TypeScript reclamar
que a propriedade não existe no tipo inferido do Supabase, a causa é o tipo gerado — nesse
caso, fazer um cast local mínimo no map: `(c as typeof c & { asaas_invoice_url: string | null })`.

- [ ] **Step 2: Verificar tipos e build**

Run: `npx tsc --noEmit && npm run build`
Expected: sem erros; build passa.

- [ ] **Step 3: Commit**

```bash
git add "src/components/finance/student-statement-section.tsx"
git commit -m "feat(asaas): add boleto action to student statement"
```

---

## Task 10: Variáveis de ambiente

**Files:**
- Modify: `.env.local`, `.env.example`

- [ ] **Step 1: Adicionar ao `.env.local`**

Acrescentar ao `.env.local` (NÃO commitar — gitignore):
```
# Asaas (gateway de pagamento)
ASAAS_API_KEY=
ASAAS_API_URL=https://api-sandbox.asaas.com/v3
ASAAS_WEBHOOK_TOKEN=
```

- [ ] **Step 2: Adicionar ao `.env.example`**

Acrescentar as mesmas 3 chaves ao `.env.example` (este é versionado — commitar):
```
# Asaas (gateway de pagamento)
ASAAS_API_KEY=
ASAAS_API_URL=https://api-sandbox.asaas.com/v3
ASAAS_WEBHOOK_TOKEN=
```

- [ ] **Step 3: Commit**

```bash
git add .env.example
git commit -m "feat(asaas): document Asaas env vars"
```

- [ ] **Step 4: Avisar o usuário**

Reportar ao final que o usuário deve:
1. Criar conta Asaas, obter a API key (sandbox para testes).
2. Preencher `ASAAS_API_KEY`, `ASAAS_API_URL`, `ASAAS_WEBHOOK_TOKEN` no `.env.local` e na
   Vercel. `ASAAS_API_URL` = `https://api-sandbox.asaas.com/v3` (testes) ou
   `https://api.asaas.com/v3` (produção).
3. No painel Asaas, configurar o webhook apontando para
   `https://<dominio>/api/asaas/webhook`, com o token igual a `ASAAS_WEBHOOK_TOKEN`.

---

## Task 11: Verificação final

- [ ] **Step 1: Rodar todos os testes**

Run: `npm test`
Expected: `webhook.test.ts` (6) + suítes existentes (`meta` 5, `telefone` 10,
`dias-letivos` 10, `feriados` 14, `destinatarios` 12, `detectar` 8, `montar-mensagem`
não existe mais, `notificacao` 6) = 71 passando.

- [ ] **Step 2: Build final**

Run: `npm run build`
Expected: passa; rota `/api/asaas/webhook` listada.

- [ ] **Step 3: Smoke test manual** (requer API key sandbox Asaas)

Com `ASAAS_*` configurado (sandbox):
1. Abrir o extrato financeiro de um aluno cujo responsável financeiro tenha CPF.
2. Numa cobrança em aberto → "Gerar boleto/PIX" → o botão vira "Ver fatura"; o link abre
   a fatura Asaas.
3. Conferir na `cobranca`: `asaas_payment_id`, `asaas_invoice_url`, `asaas_status`
   preenchidos; no responsável, `asaas_customer_id` preenchido.
4. Pagar a cobrança no sandbox Asaas (ou simular o webhook). O webhook
   `/api/asaas/webhook` deve criar uma linha em `pagamentos` e marcar a cobrança `paga`.
5. Responsável sem CPF → "Gerar boleto/PIX" retorna erro claro ("precisa de nome e CPF").

Sem `ASAAS_*` configurado: a action retorna `{ ok: false, reason: "Asaas não configurado" }`
— o app não quebra.

---

## Notas de execução

- **Customer lazy:** o customer Asaas é criado na primeira cobrança gerada para o
  responsável e o `asaas_customer_id` é reusado depois.
- **Webhook idempotente:** se a cobrança já está `paga`, o webhook não cria pagamento
  duplicado (o Asaas pode reenviar o mesmo evento).
- **Webhook retorna 200:** mesmo em erro de negócio, a rota retorna 200 com o resultado no
  corpo — o Asaas só precisa saber que a requisição foi recebida; o status real fica no
  payload de resposta para inspeção.
- **Sem env = sem quebra:** sem `ASAAS_*`, o cliente retorna falha controlada; sem
  `ASAAS_WEBHOOK_TOKEN`, a rota retorna 401.
- **Migração:** Task 1 aplica via MCP direto em produção (`fljkjhmwnjehsodvqaqk`).
- **RBAC:** sem módulo novo — reusa `financeiro.cobrancas`.
- **`forma_pagamento`:** o enum já tem `pix` e `boleto`; o webhook mapeia o `billingType`
  do Asaas para um desses (fallback `pix`).
