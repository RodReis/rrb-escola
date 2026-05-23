# Gateway de Pagamento Asaas — Design

**Data:** 2026-05-21
**Frente:** MVP2 — Frente 2 (ver `2026-05-20-mvp2-roadmap.md`)

## Objetivo

Integrar o Asaas como gateway de pagamento: gerar boleto/PIX para uma cobrança e
confirmar o pagamento automaticamente via webhook, dando baixa na cobrança.

## Contexto

- `cobrancas` (5558 linhas) já existe — geradas na matrícula, status `aberta`/`parcial`/
  `paga`/`vencida`/`cancelada`. Hoje o pagamento é registrado manualmente em `pagamentos`.
- `pagamentos` registra a baixa local — `forma_pagamento` enum tem `pix` e `boleto`.
- `responsaveis_aluno` tem `cpf`, `nome`, `email`, `celular`, `responsavel_financeiro`.
- O extrato financeiro do aluno (`StudentStatementSection`) lista cobranças por linha.
- Asaas tem dois objetos: **Customer** (o pagador) e **Payment** (a cobrança boleto/PIX).

## Decisões de escopo

- **Escopo:** gerar cobrança Asaas + webhook de confirmação. Sem sincronização em lote.
- **Gatilho:** sob demanda — botão "Gerar boleto/PIX" por cobrança. Sem cron, sem
  geração automática.
- **Formas de pagamento:** boleto + PIX — cobrança Asaas com `billingType: "UNDEFINED"`
  (o pagador escolhe boleto ou PIX no link da fatura Asaas). Cartão fora de escopo.
- **Customer lazy:** o customer Asaas é criado na primeira cobrança gerada para aquele
  responsável financeiro e reusado depois (`asaas_customer_id` salvo).
- **Config:** API key e URL via variáveis de ambiente.

## Modelo de dados

### Extensão de `responsaveis_aluno`

| Coluna | Tipo | Notas |
|--------|------|-------|
| `asaas_customer_id` | text null | id do customer no Asaas; preenchido na 1ª cobrança gerada |

### Extensão de `cobrancas`

| Coluna | Tipo | Notas |
|--------|------|-------|
| `asaas_payment_id` | text null | id do payment no Asaas |
| `asaas_invoice_url` | text null | link da fatura (boleto/PIX) que o pagador acessa |
| `asaas_status` | text null | status reportado pelo Asaas (`PENDING`, `RECEIVED`, `CONFIRMED`, `OVERDUE`…) |

Sem tabela nova. A baixa do pagamento continua usando `pagamentos` — o webhook, ao
confirmar, cria uma linha em `pagamentos` (igual ao registro manual de hoje).

## Arquitetura

### Cliente Asaas — `src/lib/asaas/client.ts` (`server-only`)

Lê `ASAAS_API_KEY`, `ASAAS_API_URL` do env. Sem config → retorna
`{ ok: false, reason: "Asaas não configurado" }` (degrada graciosamente).

Header de autenticação: `access_token: <ASAAS_API_KEY>`. Timeout via `AbortSignal`.

Tipo de retorno: `AsaasResult<T> = { ok: true; data: T } | { ok: false; reason: string }`.

Funções:
- `criarCustomer({ nome, cpfCnpj, email, celular }): Promise<AsaasResult<{ id: string }>>`
  — POST `/customers`.
- `criarCobranca({ customerId, valor, vencimento, descricao }): Promise<AsaasResult<{ id, invoiceUrl, status }>>`
  — POST `/payments`, `billingType: "UNDEFINED"`, `dueDate` = vencimento, `value` = valor.

### Lógica do webhook — `src/lib/asaas/webhook.ts`

- Função pura `eventoConfirmaPagamento(evento: string): boolean` — retorna `true` para
  `PAYMENT_RECEIVED` e `PAYMENT_CONFIRMED`; `false` para os demais. Testável.
- `processarWebhookAsaas(payload, supabase)` — recebe o payload do Asaas:
  1. Extrai o `payment.id` e o `event`.
  2. Acha a `cobranca` por `asaas_payment_id`.
  3. Atualiza sempre `cobrancas.asaas_status` com o status do payment.
  4. Se `eventoConfirmaPagamento(event)` e a cobrança ainda não está `paga`:
     cria uma linha em `pagamentos` (`forma_pagamento` = a forma reportada — `pix` ou
     `boleto`; fallback `pix`), `valor_pago` = valor do payment, `data_pagamento` = hoje;
     atualiza `cobrancas.status = "paga"`.
  5. Idempotente — se a cobrança já está `paga`, não cria pagamento duplicado.
  Usa `createAdminClient` (o webhook roda sem sessão de usuário).

### Server action — `src/lib/actions/asaas.ts`

`gerarCobrancaAsaasAction(cobrancaId)`:
1. `requirePermission("financeiro.cobrancas", "update")`.
2. Carrega a cobrança + aluno + responsável financeiro.
3. Valida: cobrança não está `paga`/`cancelada`; ainda não tem `asaas_payment_id`
   (não duplica); o responsável financeiro tem `cpf` e `nome`.
4. Se o responsável não tem `asaas_customer_id`: chama `criarCustomer` no Asaas, grava
   o id em `responsaveis_aluno`.
5. Chama `criarCobranca` no Asaas (`valor_final`, `data_vencimento`, `descricao`).
6. Grava `asaas_payment_id`, `asaas_invoice_url`, `asaas_status` na `cobranca`.
7. Retorna a `invoice_url` (ou erro).

### Rota do webhook — `src/app/api/asaas/webhook/route.ts`

- `POST`. Proteção: o Asaas envia um token no header (configurado no painel Asaas).
  Validar o header contra `ASAAS_WEBHOOK_TOKEN` (env). 401 se não bater.
- Chama `processarWebhookAsaas`. Retorna 200 (o Asaas reenviará se não receber 200).

### UI

No extrato financeiro do aluno (`StudentStatementSection`), cada linha de cobrança
ganha uma ação:
- Cobrança em aberto sem `asaas_payment_id` → botão **"Gerar boleto/PIX"** (chama
  `gerarCobrancaAsaasAction`).
- Cobrança com `asaas_invoice_url` → link **"Ver fatura"** (abre a URL Asaas em nova aba).
- Cobrança `paga` → sem ação.

A geração é síncrona — o admin clica, espera ~1-2s, recebe o link.

## RBAC

Reusa o módulo `financeiro.cobrancas`. Gerar boleto exige `update`. Sem módulo novo.

## Variáveis de ambiente

```
ASAAS_API_KEY=
ASAAS_API_URL=https://api-sandbox.asaas.com/v3
ASAAS_WEBHOOK_TOKEN=
```

`ASAAS_API_URL` aponta para o sandbox durante testes e para
`https://api.asaas.com/v3` em produção.

## Pré-requisitos externos (feito pelo usuário no painel Asaas)

1. Criar conta Asaas, obter a API key.
2. Configurar o webhook no painel Asaas apontando para
   `https://<dominio>/api/asaas/webhook`, com o token igual a `ASAAS_WEBHOOK_TOKEN`.

## Migração

- coluna `responsaveis_aluno.asaas_customer_id`
- colunas `cobrancas.asaas_payment_id`, `asaas_invoice_url`, `asaas_status`

Sem tabela nova, sem enum novo.

## Testes

Unit (Vitest):
- `eventoConfirmaPagamento` — `PAYMENT_RECEIVED`/`PAYMENT_CONFIRMED` → true; outros eventos
  (`PAYMENT_OVERDUE`, `PAYMENT_CREATED`, etc.) → false.
- Normalização de CPF para o customer (só dígitos) — se houver função dedicada.

O cliente Asaas (I/O HTTP), a action e o webhook são validados manualmente com a API key
de sandbox.

## Fora de escopo

- Sincronização/geração de cobranças Asaas em lote.
- Cartão de crédito.
- Geração automática por cron.
- Estorno/cancelamento de cobrança no Asaas (cancelar a cobrança local não cancela no
  Asaas nesta frente).
- Conciliação retroativa de cobranças antigas.
- Atualização de juros/multa do boleto pelo Asaas.
