# Financeiro v2 — Design

**Data:** 2026-05-15
**Status:** Aprovado (aguardando revisão final do usuário)
**Escopo:** Item 3 do roadmap (Financeiro). Geração de cobranças sob demanda, baixa parcial real, inadimplência com filtros, recibos PDF, estorno de pagamento, auditoria mínima.

## Contexto

O módulo financeiro hoje:

- `cobrancas` + `pagamentos` schema completo. Status enum: `aberta, parcial, paga, vencida, cancelada`.
- `generateChargesForEnrollment` cria cobranças automaticamente ao criar matrícula.
- `payChargeAction` força `status = paga` mesmo se `valor_pago < valor_final` — não suporta baixa parcial real.
- Status `vencida` nunca aplicado — fica `aberta` para sempre.
- Relatório de inadimplência só pega `data_vencimento <= hoje`, sem filtros adicionais.
- Sem recibo PDF de pagamento. Sem extrato por aluno.
- `pagamentos.registrado_por` no schema mas sempre `null`.
- Sem estorno de pagamento.

## Objetivo

1. Geração de cobranças sob demanda (botão na matrícula), idempotente.
2. Baixa parcial via trigger SQL que recalcula `cobrancas.status` a partir da soma de pagamentos ativos.
3. Status `vencida` computado em runtime (sem update físico).
4. Inadimplência filtra por período + status + busca aluno.
5. Recibo PDF por pagamento. Extrato PDF por aluno em período.
6. `pagamentos.registrado_por` auto-populado.
7. Soft delete (estorno) de pagamento.
8. Dashboard com 6 cards.

## Decisões

| # | Tema | Decisão |
|---|------|---------|
| 1 | Geração cobranças | Sob demanda apenas (remove auto da matrícula) |
| 2 | Baixa parcial | Trigger SQL recalcula `cobrancas.status` |
| 3 | Status vencida | Computada em runtime (helper `displayStatus`) |
| 4 | Inadimplência | Filtros: período + status (multi) + busca aluno |
| 5 | Recibos | (a) por pagamento + (c) extrato por aluno em período |
| 6 | Auditoria mínima | `registrado_por` auto-populado em pagamentos |
| 7 | Formas pagamento | Select com enum atual, default Pix |
| 8 | Ajuste valores | Passo separado: editar cobrança antes de pagar |
| 9 | Estorno pagamento | Soft delete (`cancelado_em`, `cancelado_por`, `motivo_cancelamento`) |
| 10 | Dashboard | 6 cards (cobranças/em aberto/vencido/a vencer/pago/cancelado) |
| 11 | Entrega | Spec único com fases internas |

## Schema

Migration nova: `supabase/migrations/202605170001_financeiro_v2.sql`.

### Soft delete em `pagamentos`

```sql
alter table pagamentos
  add column if not exists cancelado_em timestamptz,
  add column if not exists cancelado_por uuid references perfis(id) on delete set null,
  add column if not exists motivo_cancelamento text;

create index if not exists pagamentos_cobranca_ativos_idx
  on pagamentos (cobranca_id) where cancelado_em is null;
```

### Trigger recalc status

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

create trigger pagamentos_recalc_status
  after insert or update or delete on pagamentos
  for each row execute function trg_pagamento_status();
```

### Constraint

```sql
alter table pagamentos
  add constraint pagamentos_valor_positivo check (valor_pago > 0);
```

### Backfill

Recalcula status de cobranças existentes:

```sql
update cobrancas c
set status = case
  when c.status = 'cancelada' then 'cancelada'
  when coalesce((select sum(valor_pago) from pagamentos p where p.cobranca_id = c.id and p.cancelado_em is null), 0) <= 0 then 'aberta'
  when coalesce((select sum(valor_pago) from pagamentos p where p.cobranca_id = c.id and p.cancelado_em is null), 0) < c.valor_final then 'parcial'
  else 'paga'
end;
```

## Helpers

### `src/lib/finance/charge-status.ts`

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

### `src/lib/finance/charge-totals.ts`

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

## Server actions

### `src/lib/actions/finance.ts`

Refactor + novas actions:

- `createChargeAction` — mantido.
- `updateChargeAction` (nova) — edita descrição, vencimento, desconto, acréscimo de cobrança **não paga** (`.neq("status", "paga")`).
- `payChargeAction` — adiciona `registrado_por: session.profile.id`. Remove update manual de status (trigger faz).
- `cancelPaymentAction` (nova) — soft delete pagamento. Recebe `pagamento_id` + `motivo`. Update `cancelado_em`, `cancelado_por`, `motivo_cancelamento`. Trigger recalcula.
- `cancelChargeAction` — mantido (cancela cobrança inteira).
- `generateChargesForEnrollmentAction` (nova) — server action que dispara `generateChargesForEnrollment` para uma matrícula específica.

### `src/lib/actions/academics.ts`

Remove chamada automática a `generateChargesForEnrollment` em `createEnrollmentAction`. Mantém o helper para uso manual.

### `src/lib/server/generate-charges.ts`

- Adiciona filtro defensivo: antes de inserir, busca cobranças existentes com `matricula_id`, `competencia`, `numero_parcela` da mesma matrícula. Pula linhas duplicadas.
- Comentário inline: "geração sob demanda — idempotente".

## UI

### `/financeiro` — Dashboard

Cards (6):

| Card | Cálculo |
|------|---------|
| Cobranças | `count(*)` |
| A vencer | `sum(valor_final - pago)` onde status ∈ {aberta, parcial} AND `data_vencimento >= today` |
| Vencido | `sum(valor_final - pago)` onde status ∈ {aberta, parcial} AND `data_vencimento < today` |
| Em aberto (total) | A vencer + Vencido |
| Pago | `sum(valor_pago)` de pagamentos ativos |
| Cancelado | `sum(valor_final)` onde status = `cancelada` |

Lista de cobranças (todas em um scroll):

- Status visual via `displayStatus()` — badge `Vencida` cor vermelha.
- Cobrança aberta/parcial/vencida (não cancelada/paga):
  - **Botão "Editar valores"** → form expand: `descricao`, `data_vencimento`, `valor_desconto`, `valor_acrescimo`. Submit → `updateChargeAction`.
  - **Botão "Pagar"** → form: `valor_pago` (default = saldo devedor), `forma_pagamento` (select com enum), `data_pagamento`, `observacao`. Submit → `payChargeAction`.
  - **Botão "Cancelar cobrança"** → confirma → `cancelChargeAction`.
- Cobrança com pagamentos: expandable "Pagamentos (N)":
  - Lista pagamentos ativos (data, valor, forma, registrado_por.nome).
  - Botão "Estornar" → modal pede motivo → `cancelPaymentAction`.
  - Botão "Recibo" → exporta PDF (componente client).
  - Toggle "Mostrar estornados" — exibe linhas riscadas.

### `/matriculas/[id]` — Geração manual

Botão **"Gerar cobranças desta matrícula"** visível se `plano_id != null`:

- Calcula quantidade que seria gerada (preview: "Gerar X cobranças? (existem Y já)").
- Confirma → `generateChargesForEnrollmentAction(matriculaId)`.
- Idempotente (skip duplicatas).

### `/relatorios/inadimplencia` — Filtros

Form GET com query params:

- `de` (date, default = hoje - 30d)
- `ate` (date, default = hoje)
- `status` (multi-select: aberta, parcial, vencida — default = parcial + vencida)
- `aluno` (texto, busca `ILIKE` em `nome` e `matricula_codigo`)

Query:

```sql
where escola_id = $escola
  and data_vencimento between $de and $ate
  and status in (...statusFiltrados)  -- 'vencida' vira (status in ('aberta','parcial') and data_vencimento < today)
  and (aluno_filtro is null or aluno.nome ilike $aluno or matricula_codigo ilike $aluno)
```

Resultado: tabela agrupada por aluno + total. Expand "ver detalhes" mostra cobranças.

Botão "Exportar PDF" passa filtros via query string.

## Recibos PDF

### Recibo por pagamento

Componente `src/components/pdf/receipt-payment-pdf.ts` + `<ExportPaymentReceiptButton>` (client).

Layout A5 vertical:

```
[cabeçalho escola]                      Recibo Nº: <pagamento.id curto>
RRB Escola | CNPJ | endereço | telefone

RECIBO DE PAGAMENTO
====================================================
Recebemos de: <responsável_financeiro.nome> (CPF)
Aluno: <aluno.nome> (matrícula <codigo>)

Referente a: <cobranca.descricao>
Competência: <competencia>  Parcela: <numero_parcela>

Valor original:      R$ XX,XX
Desconto:           -R$ XX,XX
Acréscimo:          +R$ XX,XX
Valor cobrança:      R$ XX,XX
─────────────────────────────────
Valor pago:          R$ XX,XX
Forma:               <pix|dinheiro|cartao|boleto|transferencia>
Data:                DD/MM/AAAA

Saldo após este pagamento: R$ XX,XX (se parcial)

Recebido por: <perfil.nome>
Local e data: <cidade>, <data>

_________________________
Assinatura
```

Botão "Recibo" em cada pagamento ativo na lista expandida.

### Extrato por aluno em período

Componente `src/components/pdf/statement-pdf.ts` + `<ExportStudentStatementButton>` (client).

Ficha do aluno ganha seção "Financeiro" com:

- Form filtro: `de`, `ate` (default mês atual).
- Botão **"Exportar extrato"** → PDF A4.

Layout:

```
[cabeçalho escola]
EXTRATO FINANCEIRO
Aluno: <nome> (mat. <codigo>)
Período: DD/MM/AAAA a DD/MM/AAAA

Cobranças
| Vencimento | Descrição | Valor | Pago | Saldo | Status |
...
─────────────────────────────────
Total cobrado:   R$ X
Total pago:      R$ Y
Saldo devedor:   R$ Z

Pagamentos no período
| Data | Cobrança | Valor | Forma | Recebido por |
...
```

## Tratamento de erros

- Actions usam `redirect("/financeiro?erro=<codigo>")` para falhas conhecidas. Códigos: `id`, `campos`, `plano`, `paga`, `valor`.
- Trigger recalc roda em `security definer`. Imune a falhas de RLS.
- Soft delete usa filtro `is("cancelado_em", null)` — idempotente.
- `generateChargesForEnrollment` filtra duplicatas — idempotente.
- Recibo PDF gerado client-side, dados via prop do server (sem fetch client).

## Riscos e mitigações

| Risco | Mitigação |
|-------|-----------|
| Trigger entra em loop | Trigger só dispara em `pagamentos`. Update de `cobrancas.status` não tem trigger. Sem ciclo. |
| Status vencida divergir entre páginas | Helper único `displayStatus()`. Inadimplência usa SQL equivalente. |
| Geração 2x duplica cobranças | Filtro por `matricula_id + competencia + numero_parcela`. |
| Recibo PDF de outro aluno | Server resolve dados via SSR client (RLS aplica). Client só renderiza. |
| Edição de cobrança paga corrompe histórico | Action filtra `.neq("status", "paga")`. |
| Estorno gera saldo negativo | `recalc_cobranca_status` calcula a partir da soma, não delta. Sempre consistente. |
| Backfill de status quebra cobrança específica | Backfill é idempotente (mesmo `case` do trigger). Pode rodar de novo. |
| Forma_pagamento enum extendida no futuro | Select renderiza enum dinamicamente (ou hardcoded; valor PG enum). Adicionar valor = ALTER TYPE no banco. |

## Checklist verificação manual

- [ ] `npm run typecheck` + `npm run build` + `npm run lint` passam
- [ ] Migration aplica clean
- [ ] Cobrança paga em 1 pagamento → `paga`
- [ ] Cobrança paga em 2 parciais → primeiro `parcial`, segundo `paga`
- [ ] Pagamento estornado → status volta para `aberta` ou `parcial`
- [ ] Cobrança vencida na lista mostra badge `Vencida`
- [ ] Editar cobrança paga é bloqueado
- [ ] Botão "Gerar cobranças" em `/matriculas/[id]` cria N
- [ ] Rodar geração 2x não duplica
- [ ] Criar matrícula nova não dispara geração automática
- [ ] Inadimplência filtra período + status + aluno
- [ ] Exportar inadimplência PDF respeita filtros
- [ ] Recibo PDF de pagamento gera com dados corretos
- [ ] Recibo de pagamento parcial mostra "Saldo após pagamento"
- [ ] Extrato por aluno PDF mostra cobranças + pagamentos do período
- [ ] `registrado_por` aparece no recibo
- [ ] Cards do dashboard mostram 6 valores corretos
- [ ] Vencido card soma saldo devedor (não valor_final cheio)
- [ ] Estorno duplo (clicar 2x) é idempotente

## Fora de escopo

Adiados para specs futuros:

- Boleto bancário / gateway de pagamento
- Notificação automática de inadimplente (WhatsApp/email)
- Multa / juros automáticos por atraso
- Renegociação / parcelamento de débitos
- Conciliação bancária
- Categorização contábil
- Auditoria completa (item próprio do roadmap)

## Fases de implementação

1. **Fase 1 — Schema + helpers**: migration, helpers `charge-status.ts` e `charge-totals.ts`. Backfill aplicado.
2. **Fase 2 — Server actions**: refactor finance.ts (todas actions), remoção do auto-generate em academics.ts, idempotência em generate-charges.ts.
3. **Fase 3 — Dashboard /financeiro**: 6 cards, lista com expand de pagamentos, botões editar/pagar/cancelar/estornar.
4. **Fase 4 — Geração manual em /matriculas/[id]**: botão + confirmação.
5. **Fase 5 — Inadimplência com filtros**: form + query + PDF respeita filtros.
6. **Fase 6 — Recibos PDF**: receipt-payment-pdf + statement-pdf + botões na UI.

Cada fase tem checkpoint manual.
