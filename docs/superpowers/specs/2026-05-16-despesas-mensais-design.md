# Despesas Mensais — Design

**Data:** 2026-05-16
**Status:** Aprovado (aguardando revisão final)
**Escopo:** CRUD de despesas gerais da escola por mês (aluguel, contas, fornecedores, material, manutenção etc). Não inclui folha RH (já existe em `/rh/folha`).

## Contexto

Hoje não há módulo de despesas. Módulo financeiro existente trata apenas de **receitas** (cobranças de alunos via `cobrancas` + `pagamentos`). Despesas operacionais da escola precisam ser registradas, categorizadas e acompanhadas mês a mês para visibilidade de fluxo de caixa.

Padrões existentes a reusar:
- Navegação mensal `/financeiro?mes=YYYY-MM` (ChevronLeft/Right + competência)
- Cards de totais
- Status runtime (`vencida` computado, não persistido) via helper `displayStatus`
- Server actions + zod validation
- RLS por role (admin/financeiro)

## Objetivos

1. Cadastrar despesas com categoria, fornecedor, valor, vencimento, status.
2. Marcar pagamento (data + forma).
3. Anexar comprovante (PDF/imagem) em Supabase Storage privado.
4. Visualização mensal com cards (total, pago, em aberto, vencido).
5. CRUD de categorias.
6. Duplicar despesas do mês anterior (1 clique).

## Decisões

| # | Tema | Decisão |
|---|------|---------|
| 1 | Escopo | Apenas despesas gerais. Não consolida folha RH |
| 2 | Categorias | Tabela `categorias_despesa` com CRUD próprio |
| 3 | Campos | descricao + categoria + fornecedor (texto) + valor + venc + pgto + forma + comprovante + status |
| 4 | Recorrência | Botão "Duplicar mês anterior" (sem flag recorrente) |
| 5 | Layout | Igual `/financeiro`: nav mês, cards, tabela |
| 6 | Anexo | Supabase Storage bucket privado, signed URL on demand |
| 7 | Permissões | Mesma policy do financeiro (admin + role financeiro) |
| 8 | Status vencida | Computado runtime (helper), não persistido |

## Schema

Migration: `supabase/migrations/202605270001_despesas.sql`.

### Tabela `categorias_despesa`

```sql
create table categorias_despesa (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);
```

### Enums + Tabela `despesas`

```sql
create type forma_pagamento_despesa as enum ('pix','dinheiro','cartao','boleto','transferencia');
create type status_despesa as enum ('aberta','paga','cancelada');

create table despesas (
  id uuid primary key default gen_random_uuid(),
  competencia text not null check (competencia ~ '^\d{4}-\d{2}$'),
  descricao text not null,
  categoria_id uuid references categorias_despesa(id) on delete restrict,
  fornecedor text,
  valor numeric(12,2) not null check (valor > 0),
  data_vencimento date not null,
  data_pagamento date,
  forma_pagamento forma_pagamento_despesa,
  comprovante_path text,
  status status_despesa not null default 'aberta',
  criado_por uuid references perfis(id),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index despesas_competencia_idx on despesas (competencia);
create index despesas_categoria_idx on despesas (categoria_id);
create index despesas_status_idx on despesas (status);
```

Trigger `atualizado_em` automático.

### Storage bucket

```sql
insert into storage.buckets (id, name, public)
values ('despesas-comprovantes', 'despesas-comprovantes', false)
on conflict (id) do nothing;
```

Policy: SELECT/INSERT/DELETE permitido para roles `admin` e `financeiro` (mesma regra de `pagamentos`).

### RLS

```sql
alter table categorias_despesa enable row level security;
alter table despesas enable row level security;

-- SELECT/INSERT/UPDATE/DELETE para admin + financeiro
create policy despesas_rw on despesas
  for all using (
    exists (
      select 1 from perfis p
      where p.id = auth.uid()
        and p.role in ('admin','financeiro')
    )
  );

create policy categorias_despesa_rw on categorias_despesa
  for all using (
    exists (
      select 1 from perfis p
      where p.id = auth.uid()
        and p.role in ('admin','financeiro')
    )
  );
```

## Estrutura de arquivos

```
src/app/(app)/despesas/
  page.tsx                    # lista mensal
  nova/page.tsx               # form criar
  [id]/editar/page.tsx        # form editar
  categorias/page.tsx         # CRUD categorias

src/lib/
  data/despesas.ts            # getDespesasData, getCategorias
  actions/despesas.ts
  actions/categorias-despesa.ts
  validation/despesas.ts      # zod schemas
  despesas/
    status.ts                 # displayDespesaStatus, isVencida
    totals.ts                 # totalDespesas, totalPago, totalAberto, totalVencido

src/components/despesas/
  despesa-row.tsx
  despesa-form.tsx
  upload-comprovante.tsx
  categoria-form.tsx
```

## Página mensal `/despesas?mes=YYYY-MM`

- Default `mes` = mês atual.
- Header: PageHeader + ChevronLeft/Right + `mesLabel(competencia)` + botão "Nova despesa" (link `/despesas/nova?mes=...`) + botão "Duplicar mês anterior" (server action).
- 4 cards (componente `Panel`):
  - Total do mês
  - Pago
  - Em aberto (status `aberta`, venc futuro)
  - Vencido (status `aberta`, venc < hoje)
- Filtros (querystring): `categoria_id`, `status` (multi).
- Tabela colunas: descrição | categoria | fornecedor | venc | pago em | valor | status pill | ações (pagar/editar/cancelar/baixar comprovante).
- Status pill reusa `StatusPill` com tones existentes.

## Server actions

`src/lib/actions/despesas.ts`:

- `createDespesaAction(formData)` — insert; deriva `competencia` de `data_vencimento`.
- `updateDespesaAction(id, formData)` — patch.
- `payDespesaAction(id, { data_pagamento, forma_pagamento })` — set status `paga`.
- `cancelDespesaAction(id)` — set status `cancelada`.
- `duplicateMonthAction(fromCompetencia, toCompetencia)` — copia linhas. Para cada despesa origem: novo registro com mesmo dia de venc no mês destino, `status='aberta'`, `data_pagamento=null`, `comprovante_path=null`. Idempotente: se `toCompetencia` já tem despesas, retorna erro "mes destino nao vazio".
- `uploadComprovanteAction(despesaId, file)` — valida mime/size, upload `despesas-comprovantes/{despesaId}/{uuid}-{filename}`, salva `comprovante_path`.
- `getComprovanteUrlAction(path)` — signed URL 60s.
- `removeComprovanteAction(despesaId)` — delete storage + null `comprovante_path`.

`src/lib/actions/categorias-despesa.ts`:

- `createCategoriaAction`, `updateCategoriaAction`, `toggleAtivoAction`, `deleteCategoriaAction` (FK `on delete restrict` bloqueia se houver despesas).

## Validação (`src/lib/validation/despesas.ts`)

```ts
const despesaSchema = z.object({
  descricao: z.string().min(1).max(200),
  categoria_id: z.string().uuid(),
  fornecedor: z.string().max(200).optional().nullable(),
  valor: z.number().positive(),
  data_vencimento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  data_pagamento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  forma_pagamento: z.enum(['pix','dinheiro','cartao','boleto','transferencia']).optional().nullable(),
});

const comprovanteSchema = z.object({
  size: z.number().max(5 * 1024 * 1024),
  type: z.enum(['image/png','image/jpeg','image/webp','application/pdf']),
});
```

## Helpers

`src/lib/despesas/status.ts`:

```ts
export function displayDespesaStatus(d: { status: string; data_vencimento: string }) {
  if (d.status === 'aberta' && d.data_vencimento < today()) return 'vencida';
  return d.status;
}
```

`src/lib/despesas/totals.ts`: agregações por status.

## Navegação

Adicionar entrada "Despesas" no sidebar layout (grupo financeiro), link `/despesas`.

## Out of scope (YAGNI)

- Recorrência automática (job/cron)
- Aprovação multi-etapa
- Centro de custo / departamento
- Relatório consolidado anual / DRE
- Integração contábil
- Lançamento de receitas não vinculadas a aluno
- Conciliação bancária

## Fases internas

1. Schema + RLS + bucket
2. Categorias CRUD
3. Despesa CRUD básico (sem comprovante)
4. Pagamento + cancelamento
5. Cards + filtros
6. Upload comprovante
7. Duplicar mês anterior
8. Sidebar nav
