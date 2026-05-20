# Despesas Mensais Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a CRUD for monthly general school expenses with categories, payment tracking, receipt uploads, and month-to-month duplication.

**Architecture:** Two new Postgres tables (`categorias_despesa`, `despesas`) behind RLS, a private Supabase Storage bucket for receipts, Next.js App Router pages under `/despesas`, server actions in `src/lib/actions/despesas.ts`, and a sidebar entry in the top nav. UI follows the existing `/financeiro` pattern (monthly nav, total cards, table).

**Tech Stack:** Next.js 14 App Router + Server Actions, Supabase (Postgres + Storage), TypeScript, Tailwind, Zod, lucide-react icons.

**Spec:** `docs/superpowers/specs/2026-05-16-despesas-mensais-design.md`

---

## File Map

**Create:**
- `supabase/migrations/202605270001_despesas.sql`
- `src/app/(app)/despesas/page.tsx`
- `src/app/(app)/despesas/nova/page.tsx`
- `src/app/(app)/despesas/[id]/editar/page.tsx`
- `src/app/(app)/despesas/categorias/page.tsx`
- `src/lib/data/despesas.ts`
- `src/lib/actions/despesas.ts`
- `src/lib/actions/categorias-despesa.ts`
- `src/lib/validation/despesas.ts`
- `src/lib/despesas/status.ts`
- `src/lib/despesas/totals.ts`
- `src/components/despesas/despesa-row.tsx`
- `src/components/despesas/despesa-form.tsx`
- `src/components/despesas/upload-comprovante.tsx`
- `src/components/despesas/categoria-form.tsx`

**Modify:**
- `src/components/layout/topbar.tsx` (add Despesas nav link)

---

## Task 1: Migration schema + RLS + storage bucket

**Files:**
- Create: `supabase/migrations/202605270001_despesas.sql`

- [ ] **Step 1: Write migration SQL**

```sql
-- Despesas mensais: categorias, despesas, storage bucket de comprovantes, RLS.

create table if not exists categorias_despesa (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

do $$ begin
  create type forma_pagamento_despesa as enum ('pix','dinheiro','cartao','boleto','transferencia');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type status_despesa as enum ('aberta','paga','cancelada');
exception when duplicate_object then null;
end $$;

create table if not exists despesas (
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
  criado_por uuid references perfis(id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists despesas_competencia_idx on despesas (competencia);
create index if not exists despesas_categoria_idx on despesas (categoria_id);
create index if not exists despesas_status_idx on despesas (status);

create or replace function set_despesas_atualizado_em()
returns trigger as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists despesas_atualizado_em on despesas;
create trigger despesas_atualizado_em
  before update on despesas
  for each row execute function set_despesas_atualizado_em();

-- Storage bucket privado para comprovantes
insert into storage.buckets (id, name, public)
values ('despesas-comprovantes', 'despesas-comprovantes', false)
on conflict (id) do nothing;

-- RLS
alter table categorias_despesa enable row level security;
alter table despesas enable row level security;

drop policy if exists categorias_despesa_rw on categorias_despesa;
create policy categorias_despesa_rw on categorias_despesa
  for all
  using (
    exists (
      select 1 from perfis p
      where p.id = auth.uid()
        and p.role in ('admin','financeiro')
    )
  )
  with check (
    exists (
      select 1 from perfis p
      where p.id = auth.uid()
        and p.role in ('admin','financeiro')
    )
  );

drop policy if exists despesas_rw on despesas;
create policy despesas_rw on despesas
  for all
  using (
    exists (
      select 1 from perfis p
      where p.id = auth.uid()
        and p.role in ('admin','financeiro')
    )
  )
  with check (
    exists (
      select 1 from perfis p
      where p.id = auth.uid()
        and p.role in ('admin','financeiro')
    )
  );

-- Storage policies para o bucket
drop policy if exists despesas_comprovantes_rw on storage.objects;
create policy despesas_comprovantes_rw on storage.objects
  for all
  using (
    bucket_id = 'despesas-comprovantes'
    and exists (
      select 1 from perfis p
      where p.id = auth.uid()
        and p.role in ('admin','financeiro')
    )
  )
  with check (
    bucket_id = 'despesas-comprovantes'
    and exists (
      select 1 from perfis p
      where p.id = auth.uid()
        and p.role in ('admin','financeiro')
    )
  );

-- Seed mínimo de categorias comuns (opcional, pode remover)
insert into categorias_despesa (nome) values
  ('Aluguel'),
  ('Água'),
  ('Luz'),
  ('Internet'),
  ('Material escolar'),
  ('Manutenção'),
  ('Fornecedores'),
  ('Outros')
on conflict (nome) do nothing;
```

- [ ] **Step 2: Apply migration locally**

Run: `npx supabase db reset` (or `npx supabase migration up` if data must be preserved)
Expected: migration applied, no errors.

- [ ] **Step 3: Verify tables exist**

Run via psql or Supabase Studio:
```sql
select count(*) from categorias_despesa;  -- 8
select count(*) from despesas;             -- 0
select id from storage.buckets where id = 'despesas-comprovantes';  -- 1 row
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/202605270001_despesas.sql
git commit -m "feat(despesas): migration schema, RLS, storage bucket"
```

---

## Task 2: Status + totals helpers

**Files:**
- Create: `src/lib/despesas/status.ts`
- Create: `src/lib/despesas/totals.ts`

- [ ] **Step 1: Write `status.ts`**

```ts
export type StatusDespesa = "aberta" | "paga" | "cancelada";
export type DisplayStatusDespesa = StatusDespesa | "vencida";

export interface DespesaStatusInput {
  status: StatusDespesa;
  data_vencimento: string;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

export function displayDespesaStatus(d: DespesaStatusInput): DisplayStatusDespesa {
  if (d.status === "aberta" && d.data_vencimento < today()) return "vencida";
  return d.status;
}

export function isVencida(d: DespesaStatusInput): boolean {
  return displayDespesaStatus(d) === "vencida";
}
```

- [ ] **Step 2: Write `totals.ts`**

```ts
import { displayDespesaStatus, type DespesaStatusInput } from "./status";

export interface DespesaTotalInput extends DespesaStatusInput {
  valor: number;
}

export function totalDespesas(rows: DespesaTotalInput[]): number {
  return rows
    .filter((r) => r.status !== "cancelada")
    .reduce((acc, r) => acc + Number(r.valor), 0);
}

export function totalPago(rows: DespesaTotalInput[]): number {
  return rows
    .filter((r) => r.status === "paga")
    .reduce((acc, r) => acc + Number(r.valor), 0);
}

export function totalAberto(rows: DespesaTotalInput[]): number {
  return rows
    .filter((r) => displayDespesaStatus(r) === "aberta")
    .reduce((acc, r) => acc + Number(r.valor), 0);
}

export function totalVencido(rows: DespesaTotalInput[]): number {
  return rows
    .filter((r) => displayDespesaStatus(r) === "vencida")
    .reduce((acc, r) => acc + Number(r.valor), 0);
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/despesas/
git commit -m "feat(despesas): status display helper and totals"
```

---

## Task 3: Zod validation schemas

**Files:**
- Create: `src/lib/validation/despesas.ts`

- [ ] **Step 1: Write schemas**

```ts
import { z } from "zod";

export const FORMAS_PAGAMENTO = ["pix", "dinheiro", "cartao", "boleto", "transferencia"] as const;

export const despesaSchema = z.object({
  descricao: z.string().min(1, "Descrição obrigatória").max(200),
  categoria_id: z.string().uuid("Categoria inválida"),
  fornecedor: z.string().max(200).optional().nullable(),
  valor: z.number().positive("Valor deve ser maior que zero"),
  data_vencimento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida"),
  data_pagamento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  forma_pagamento: z.enum(FORMAS_PAGAMENTO).optional().nullable()
});

export type DespesaInput = z.infer<typeof despesaSchema>;

export const MAX_COMPROVANTE_BYTES = 5 * 1024 * 1024;
export const COMPROVANTE_MIMES = ["image/png", "image/jpeg", "image/webp", "application/pdf"] as const;

export const comprovanteSchema = z.object({
  size: z.number().max(MAX_COMPROVANTE_BYTES, "Arquivo maior que 5MB"),
  type: z.enum(COMPROVANTE_MIMES, { message: "Tipo de arquivo não suportado" })
});

export const categoriaSchema = z.object({
  nome: z.string().min(1).max(80),
  ativo: z.boolean().default(true)
});
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/validation/despesas.ts
git commit -m "feat(despesas): zod schemas"
```

---

## Task 4: Data layer

**Files:**
- Create: `src/lib/data/despesas.ts`

- [ ] **Step 1: Write data functions**

```ts
import { createServerClient } from "@/lib/supabase/server";

export interface CategoriaDespesa {
  id: string;
  nome: string;
  ativo: boolean;
}

export interface DespesaRow {
  id: string;
  competencia: string;
  descricao: string;
  categoria_id: string | null;
  categoria_nome: string | null;
  fornecedor: string | null;
  valor: number;
  data_vencimento: string;
  data_pagamento: string | null;
  forma_pagamento: string | null;
  comprovante_path: string | null;
  status: "aberta" | "paga" | "cancelada";
  criado_em: string;
}

export interface DespesaFilters {
  categoria_id?: string;
  status?: string[];
}

export async function getCategorias(opts: { onlyAtivos?: boolean } = {}): Promise<CategoriaDespesa[]> {
  const supabase = await createServerClient();
  let q = supabase.from("categorias_despesa").select("id, nome, ativo").order("nome");
  if (opts.onlyAtivos) q = q.eq("ativo", true);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function getDespesasMensais(
  competencia: string,
  filters: DespesaFilters = {}
): Promise<DespesaRow[]> {
  const supabase = await createServerClient();
  let q = supabase
    .from("despesas")
    .select("id, competencia, descricao, categoria_id, fornecedor, valor, data_vencimento, data_pagamento, forma_pagamento, comprovante_path, status, criado_em, categorias_despesa(nome)")
    .eq("competencia", competencia)
    .order("data_vencimento");

  if (filters.categoria_id) q = q.eq("categoria_id", filters.categoria_id);
  if (filters.status && filters.status.length > 0) q = q.in("status", filters.status);

  const { data, error } = await q;
  if (error) throw error;

  return (data ?? []).map((r: any) => ({
    id: r.id,
    competencia: r.competencia,
    descricao: r.descricao,
    categoria_id: r.categoria_id,
    categoria_nome: r.categorias_despesa?.nome ?? null,
    fornecedor: r.fornecedor,
    valor: Number(r.valor),
    data_vencimento: r.data_vencimento,
    data_pagamento: r.data_pagamento,
    forma_pagamento: r.forma_pagamento,
    comprovante_path: r.comprovante_path,
    status: r.status,
    criado_em: r.criado_em
  }));
}

export async function getDespesaById(id: string): Promise<DespesaRow | null> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("despesas")
    .select("id, competencia, descricao, categoria_id, fornecedor, valor, data_vencimento, data_pagamento, forma_pagamento, comprovante_path, status, criado_em, categorias_despesa(nome)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    id: data.id,
    competencia: data.competencia,
    descricao: data.descricao,
    categoria_id: data.categoria_id,
    categoria_nome: (data as any).categorias_despesa?.nome ?? null,
    fornecedor: data.fornecedor,
    valor: Number(data.valor),
    data_vencimento: data.data_vencimento,
    data_pagamento: data.data_pagamento,
    forma_pagamento: data.forma_pagamento,
    comprovante_path: data.comprovante_path,
    status: data.status,
    criado_em: data.criado_em
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/data/despesas.ts
git commit -m "feat(despesas): data layer (categorias + despesas)"
```

---

## Task 5: Categoria server actions

**Files:**
- Create: `src/lib/actions/categorias-despesa.ts`

- [ ] **Step 1: Write actions**

```ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { createServerClient } from "@/lib/supabase/server";
import { formText, formBoolean } from "@/lib/utils";
import { categoriaSchema } from "@/lib/validation/despesas";

export async function createCategoriaAction(formData: FormData) {
  await requireSession();
  const parsed = categoriaSchema.safeParse({
    nome: formText(formData, "nome"),
    ativo: formBoolean(formData, "ativo")
  });
  if (!parsed.success) redirect("/despesas/categorias?erro=validacao");

  const supabase = await createServerClient();
  const { error } = await supabase.from("categorias_despesa").insert(parsed.data);
  if (error) redirect(`/despesas/categorias?erro=${encodeURIComponent(error.message)}`);
  revalidatePath("/despesas/categorias");
  revalidatePath("/despesas");
}

export async function updateCategoriaAction(formData: FormData) {
  await requireSession();
  const id = formText(formData, "id");
  if (!id) redirect("/despesas/categorias?erro=id");
  const parsed = categoriaSchema.safeParse({
    nome: formText(formData, "nome"),
    ativo: formBoolean(formData, "ativo")
  });
  if (!parsed.success) redirect("/despesas/categorias?erro=validacao");

  const supabase = await createServerClient();
  const { error } = await supabase.from("categorias_despesa").update(parsed.data).eq("id", id);
  if (error) redirect(`/despesas/categorias?erro=${encodeURIComponent(error.message)}`);
  revalidatePath("/despesas/categorias");
}

export async function deleteCategoriaAction(formData: FormData) {
  await requireSession();
  const id = formText(formData, "id");
  if (!id) redirect("/despesas/categorias?erro=id");

  const supabase = await createServerClient();
  const { error } = await supabase.from("categorias_despesa").delete().eq("id", id);
  if (error) redirect(`/despesas/categorias?erro=${encodeURIComponent(error.message)}`);
  revalidatePath("/despesas/categorias");
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/actions/categorias-despesa.ts
git commit -m "feat(despesas): server actions de categorias"
```

---

## Task 6: Categoria CRUD page + form

**Files:**
- Create: `src/components/despesas/categoria-form.tsx`
- Create: `src/app/(app)/despesas/categorias/page.tsx`

- [ ] **Step 1: Write `categoria-form.tsx`**

```tsx
"use client";

import { createCategoriaAction } from "@/lib/actions/categorias-despesa";

export function CategoriaCreateForm() {
  return (
    <form action={createCategoriaAction} className="flex items-end gap-2">
      <div className="flex-1">
        <label className="block text-sm font-medium">Nome</label>
        <input name="nome" required maxLength={80} className="ds-input w-full" />
      </div>
      <label className="flex items-center gap-2 text-sm pb-2">
        <input type="checkbox" name="ativo" defaultChecked />
        Ativo
      </label>
      <button type="submit" className="ds-btn ds-btn-primary">Adicionar</button>
    </form>
  );
}
```

- [ ] **Step 2: Write `categorias/page.tsx`**

```tsx
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/card";
import { CategoriaCreateForm } from "@/components/despesas/categoria-form";
import {
  deleteCategoriaAction,
  updateCategoriaAction
} from "@/lib/actions/categorias-despesa";
import { getCategorias } from "@/lib/data/despesas";

export default async function CategoriasDespesaPage({
  searchParams
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  const { erro } = await searchParams;
  const categorias = await getCategorias();

  return (
    <div className="space-y-6">
      <PageHeader title="Categorias de Despesa" subtitle="Gerencie categorias para classificar despesas." />
      {erro ? <div className="ds-alert ds-alert-error">Erro: {erro}</div> : null}

      <Panel title="Nova categoria">
        <CategoriaCreateForm />
      </Panel>

      <Panel title="Categorias cadastradas">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left">
              <th>Nome</th>
              <th>Ativa</th>
              <th className="text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {categorias.map((c) => (
              <tr key={c.id} className="border-t">
                <td className="py-2">
                  <form action={updateCategoriaAction} className="flex items-center gap-2">
                    <input type="hidden" name="id" value={c.id} />
                    <input name="nome" defaultValue={c.nome} className="ds-input" />
                    <label className="flex items-center gap-1 text-xs">
                      <input type="checkbox" name="ativo" defaultChecked={c.ativo} />
                      ativa
                    </label>
                    <button type="submit" className="ds-btn ds-btn-secondary">Salvar</button>
                  </form>
                </td>
                <td>{c.ativo ? "Sim" : "Não"}</td>
                <td className="text-right">
                  <form action={deleteCategoriaAction}>
                    <input type="hidden" name="id" value={c.id} />
                    <button type="submit" className="ds-btn ds-btn-danger">Excluir</button>
                  </form>
                </td>
              </tr>
            ))}
            {categorias.length === 0 ? (
              <tr><td colSpan={3} className="py-3 text-center text-gray-500">Nenhuma categoria.</td></tr>
            ) : null}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}
```

- [ ] **Step 3: Manually test**

Run: `npm run dev`
Navigate to `/despesas/categorias`, create "Telefone", edit it, try to delete one that has no despesa (should succeed).

- [ ] **Step 4: Commit**

```bash
git add src/components/despesas/categoria-form.tsx src/app/\(app\)/despesas/categorias/page.tsx
git commit -m "feat(despesas): pagina CRUD categorias"
```

---

## Task 7: Despesa server actions (create, update, pay, cancel)

**Files:**
- Create: `src/lib/actions/despesas.ts`

- [ ] **Step 1: Write actions**

```ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { createServerClient } from "@/lib/supabase/server";
import { formNumber, formText } from "@/lib/utils";
import { despesaSchema, FORMAS_PAGAMENTO } from "@/lib/validation/despesas";

function competenciaFromDate(d: string) {
  return d.slice(0, 7);
}

export async function createDespesaAction(formData: FormData) {
  const session = await requireSession();
  const parsed = despesaSchema.safeParse({
    descricao: formText(formData, "descricao"),
    categoria_id: formText(formData, "categoria_id"),
    fornecedor: formText(formData, "fornecedor"),
    valor: formNumber(formData, "valor"),
    data_vencimento: formText(formData, "data_vencimento"),
    data_pagamento: formText(formData, "data_pagamento"),
    forma_pagamento: formText(formData, "forma_pagamento")
  });
  if (!parsed.success) {
    redirect(`/despesas/nova?erro=${encodeURIComponent(parsed.error.issues[0]?.message ?? "validacao")}`);
  }

  const supabase = await createServerClient();
  const status = parsed.data.data_pagamento ? "paga" : "aberta";
  const { data, error } = await supabase
    .from("despesas")
    .insert({
      ...parsed.data,
      competencia: competenciaFromDate(parsed.data.data_vencimento),
      status,
      criado_por: session.profile.id
    })
    .select("id, competencia")
    .single();
  if (error) redirect(`/despesas/nova?erro=${encodeURIComponent(error.message)}`);

  revalidatePath("/despesas");
  redirect(`/despesas?mes=${data.competencia}`);
}

export async function updateDespesaAction(formData: FormData) {
  await requireSession();
  const id = formText(formData, "id");
  if (!id) redirect("/despesas?erro=id");

  const parsed = despesaSchema.safeParse({
    descricao: formText(formData, "descricao"),
    categoria_id: formText(formData, "categoria_id"),
    fornecedor: formText(formData, "fornecedor"),
    valor: formNumber(formData, "valor"),
    data_vencimento: formText(formData, "data_vencimento"),
    data_pagamento: formText(formData, "data_pagamento"),
    forma_pagamento: formText(formData, "forma_pagamento")
  });
  if (!parsed.success) {
    redirect(`/despesas/${id}/editar?erro=${encodeURIComponent(parsed.error.issues[0]?.message ?? "validacao")}`);
  }

  const supabase = await createServerClient();
  const { error } = await supabase
    .from("despesas")
    .update({
      ...parsed.data,
      competencia: competenciaFromDate(parsed.data.data_vencimento)
    })
    .eq("id", id);
  if (error) redirect(`/despesas/${id}/editar?erro=${encodeURIComponent(error.message)}`);

  revalidatePath("/despesas");
  redirect(`/despesas?mes=${competenciaFromDate(parsed.data.data_vencimento)}`);
}

export async function payDespesaAction(formData: FormData) {
  await requireSession();
  const id = formText(formData, "id");
  const data_pagamento = formText(formData, "data_pagamento") ?? new Date().toISOString().slice(0, 10);
  const forma_pagamento = formText(formData, "forma_pagamento");
  if (!id) redirect("/despesas?erro=id");
  if (forma_pagamento && !FORMAS_PAGAMENTO.includes(forma_pagamento as any)) {
    redirect("/despesas?erro=forma_invalida");
  }

  const supabase = await createServerClient();
  const { error } = await supabase
    .from("despesas")
    .update({ status: "paga", data_pagamento, forma_pagamento })
    .eq("id", id);
  if (error) redirect(`/despesas?erro=${encodeURIComponent(error.message)}`);

  revalidatePath("/despesas");
}

export async function cancelDespesaAction(formData: FormData) {
  await requireSession();
  const id = formText(formData, "id");
  if (!id) redirect("/despesas?erro=id");

  const supabase = await createServerClient();
  const { error } = await supabase.from("despesas").update({ status: "cancelada" }).eq("id", id);
  if (error) redirect(`/despesas?erro=${encodeURIComponent(error.message)}`);

  revalidatePath("/despesas");
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/actions/despesas.ts
git commit -m "feat(despesas): server actions create/update/pay/cancel"
```

---

## Task 8: Duplicate month action

**Files:**
- Modify: `src/lib/actions/despesas.ts` (append)

- [ ] **Step 1: Append `duplicateMonthAction`**

```ts
function adjacentMes(competencia: string, delta: number) {
  const [y, m] = competencia.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function shiftVencimento(dataOrigem: string, fromMes: string, toMes: string): string {
  const day = dataOrigem.slice(8, 10);
  const [y, m] = toMes.split("-").map(Number);
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const useDay = Math.min(Number(day), lastDay);
  return `${toMes}-${String(useDay).padStart(2, "0")}`;
}

export async function duplicateMonthAction(formData: FormData) {
  await requireSession();
  const toCompetencia = formText(formData, "to") ?? new Date().toISOString().slice(0, 7);
  const fromCompetencia = adjacentMes(toCompetencia, -1);

  const supabase = await createServerClient();

  const { data: existentes, error: errCheck } = await supabase
    .from("despesas")
    .select("id")
    .eq("competencia", toCompetencia)
    .limit(1);
  if (errCheck) redirect(`/despesas?mes=${toCompetencia}&erro=${encodeURIComponent(errCheck.message)}`);
  if ((existentes?.length ?? 0) > 0) {
    redirect(`/despesas?mes=${toCompetencia}&erro=mes_destino_nao_vazio`);
  }

  const { data: origem, error: errOrigem } = await supabase
    .from("despesas")
    .select("descricao, categoria_id, fornecedor, valor, data_vencimento")
    .eq("competencia", fromCompetencia)
    .neq("status", "cancelada");
  if (errOrigem) redirect(`/despesas?mes=${toCompetencia}&erro=${encodeURIComponent(errOrigem.message)}`);
  if (!origem || origem.length === 0) {
    redirect(`/despesas?mes=${toCompetencia}&erro=mes_origem_vazio`);
  }

  const novas = origem.map((row) => ({
    descricao: row.descricao,
    categoria_id: row.categoria_id,
    fornecedor: row.fornecedor,
    valor: row.valor,
    data_vencimento: shiftVencimento(row.data_vencimento, fromCompetencia, toCompetencia),
    competencia: toCompetencia,
    status: "aberta" as const
  }));

  const { error: errInsert } = await supabase.from("despesas").insert(novas);
  if (errInsert) redirect(`/despesas?mes=${toCompetencia}&erro=${encodeURIComponent(errInsert.message)}`);

  revalidatePath("/despesas");
  redirect(`/despesas?mes=${toCompetencia}`);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/actions/despesas.ts
git commit -m "feat(despesas): action duplicar mes anterior"
```

---

## Task 9: Upload comprovante actions + component

**Files:**
- Modify: `src/lib/actions/despesas.ts` (append upload/remove/url actions)
- Create: `src/components/despesas/upload-comprovante.tsx`

- [ ] **Step 1: Append upload actions**

```ts
import { comprovanteSchema } from "@/lib/validation/despesas";

export async function uploadComprovanteAction(formData: FormData) {
  await requireSession();
  const id = formText(formData, "id");
  const file = formData.get("file");
  if (!id) redirect("/despesas?erro=id");
  if (!(file instanceof File) || file.size === 0) {
    redirect(`/despesas/${id}/editar?erro=arquivo_vazio`);
  }

  const parsed = comprovanteSchema.safeParse({ size: file.size, type: file.type });
  if (!parsed.success) {
    redirect(`/despesas/${id}/editar?erro=${encodeURIComponent(parsed.error.issues[0]?.message ?? "comprovante_invalido")}`);
  }

  const supabase = await createServerClient();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${id}/${Date.now()}-${safeName}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: errUpload } = await supabase.storage
    .from("despesas-comprovantes")
    .upload(path, buffer, { contentType: file.type, upsert: false });
  if (errUpload) redirect(`/despesas/${id}/editar?erro=${encodeURIComponent(errUpload.message)}`);

  const { error: errUpdate } = await supabase
    .from("despesas")
    .update({ comprovante_path: path })
    .eq("id", id);
  if (errUpdate) redirect(`/despesas/${id}/editar?erro=${encodeURIComponent(errUpdate.message)}`);

  revalidatePath("/despesas");
  redirect(`/despesas/${id}/editar`);
}

export async function removeComprovanteAction(formData: FormData) {
  await requireSession();
  const id = formText(formData, "id");
  const path = formText(formData, "path");
  if (!id || !path) redirect("/despesas?erro=id");

  const supabase = await createServerClient();
  await supabase.storage.from("despesas-comprovantes").remove([path]);
  await supabase.from("despesas").update({ comprovante_path: null }).eq("id", id);

  revalidatePath("/despesas");
  redirect(`/despesas/${id}/editar`);
}

export async function getComprovanteUrlAction(path: string): Promise<string | null> {
  await requireSession();
  const supabase = await createServerClient();
  const { data, error } = await supabase.storage
    .from("despesas-comprovantes")
    .createSignedUrl(path, 60);
  if (error) return null;
  return data?.signedUrl ?? null;
}
```

- [ ] **Step 2: Write `upload-comprovante.tsx`**

```tsx
"use client";

import { useState } from "react";
import { removeComprovanteAction, uploadComprovanteAction } from "@/lib/actions/despesas";

export function UploadComprovante({
  despesaId,
  currentPath
}: {
  despesaId: string;
  currentPath: string | null;
}) {
  const [pending, setPending] = useState(false);

  return (
    <div className="space-y-2">
      {currentPath ? (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-600">Anexo: {currentPath.split("/").pop()}</span>
          <form action={removeComprovanteAction}>
            <input type="hidden" name="id" value={despesaId} />
            <input type="hidden" name="path" value={currentPath} />
            <button type="submit" className="ds-btn ds-btn-danger ds-btn-sm">Remover</button>
          </form>
        </div>
      ) : null}

      <form
        action={uploadComprovanteAction}
        encType="multipart/form-data"
        onSubmit={() => setPending(true)}
        className="flex items-center gap-2"
      >
        <input type="hidden" name="id" value={despesaId} />
        <input
          type="file"
          name="file"
          accept="image/png,image/jpeg,image/webp,application/pdf"
          required
          className="ds-input"
        />
        <button type="submit" disabled={pending} className="ds-btn ds-btn-primary">
          {pending ? "Enviando..." : "Anexar"}
        </button>
      </form>
      <p className="text-xs text-gray-500">PNG, JPG, WEBP ou PDF — máx 5MB.</p>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/actions/despesas.ts src/components/despesas/upload-comprovante.tsx
git commit -m "feat(despesas): upload comprovante (storage)"
```

---

## Task 10: Despesa form component

**Files:**
- Create: `src/components/despesas/despesa-form.tsx`

- [ ] **Step 1: Write form**

```tsx
import { FORMAS_PAGAMENTO } from "@/lib/validation/despesas";
import type { CategoriaDespesa, DespesaRow } from "@/lib/data/despesas";

export function DespesaForm({
  action,
  categorias,
  initial,
  submitLabel
}: {
  action: (formData: FormData) => void | Promise<void>;
  categorias: CategoriaDespesa[];
  initial?: Partial<DespesaRow>;
  submitLabel: string;
}) {
  return (
    <form action={action} className="space-y-4">
      {initial?.id ? <input type="hidden" name="id" value={initial.id} /> : null}

      <div>
        <label className="block text-sm font-medium">Descrição *</label>
        <input
          name="descricao"
          required
          maxLength={200}
          defaultValue={initial?.descricao ?? ""}
          className="ds-input w-full"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium">Categoria *</label>
          <select name="categoria_id" required defaultValue={initial?.categoria_id ?? ""} className="ds-input w-full">
            <option value="">Selecione...</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium">Fornecedor</label>
          <input
            name="fornecedor"
            maxLength={200}
            defaultValue={initial?.fornecedor ?? ""}
            className="ds-input w-full"
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium">Valor (R$) *</label>
          <input
            name="valor"
            required
            inputMode="decimal"
            placeholder="0,00"
            defaultValue={initial?.valor ?? ""}
            className="ds-input w-full"
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Vencimento *</label>
          <input
            type="date"
            name="data_vencimento"
            required
            defaultValue={initial?.data_vencimento ?? ""}
            className="ds-input w-full"
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Data pagamento</label>
          <input
            type="date"
            name="data_pagamento"
            defaultValue={initial?.data_pagamento ?? ""}
            className="ds-input w-full"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium">Forma pagamento</label>
        <select name="forma_pagamento" defaultValue={initial?.forma_pagamento ?? ""} className="ds-input w-full">
          <option value="">—</option>
          {FORMAS_PAGAMENTO.map((f) => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>
      </div>

      <button type="submit" className="ds-btn ds-btn-primary">{submitLabel}</button>
    </form>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/despesas/despesa-form.tsx
git commit -m "feat(despesas): form component reusavel"
```

---

## Task 11: Create + edit pages

**Files:**
- Create: `src/app/(app)/despesas/nova/page.tsx`
- Create: `src/app/(app)/despesas/[id]/editar/page.tsx`

- [ ] **Step 1: Write `nova/page.tsx`**

```tsx
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/card";
import { DespesaForm } from "@/components/despesas/despesa-form";
import { createDespesaAction } from "@/lib/actions/despesas";
import { getCategorias } from "@/lib/data/despesas";

export default async function NovaDespesaPage({
  searchParams
}: {
  searchParams: Promise<{ erro?: string; mes?: string }>;
}) {
  const { erro } = await searchParams;
  const categorias = await getCategorias({ onlyAtivos: true });

  return (
    <div className="space-y-6">
      <PageHeader title="Nova despesa" subtitle="Cadastre uma despesa do mês." />
      {erro ? <div className="ds-alert ds-alert-error">Erro: {erro}</div> : null}
      <Panel>
        <DespesaForm action={createDespesaAction} categorias={categorias} submitLabel="Salvar" />
      </Panel>
    </div>
  );
}
```

- [ ] **Step 2: Write `[id]/editar/page.tsx`**

```tsx
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/card";
import { DespesaForm } from "@/components/despesas/despesa-form";
import { UploadComprovante } from "@/components/despesas/upload-comprovante";
import { updateDespesaAction } from "@/lib/actions/despesas";
import { getCategorias, getDespesaById } from "@/lib/data/despesas";

export default async function EditarDespesaPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ erro?: string }>;
}) {
  const { id } = await params;
  const { erro } = await searchParams;
  const [despesa, categorias] = await Promise.all([
    getDespesaById(id),
    getCategorias()
  ]);
  if (!despesa) notFound();

  return (
    <div className="space-y-6">
      <PageHeader title="Editar despesa" subtitle={despesa.descricao} />
      {erro ? <div className="ds-alert ds-alert-error">Erro: {erro}</div> : null}

      <Panel title="Dados">
        <DespesaForm
          action={updateDespesaAction}
          categorias={categorias}
          initial={despesa}
          submitLabel="Atualizar"
        />
      </Panel>

      <Panel title="Comprovante">
        <UploadComprovante despesaId={despesa.id} currentPath={despesa.comprovante_path} />
      </Panel>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/despesas/nova/page.tsx src/app/\(app\)/despesas/\[id\]/editar/page.tsx
git commit -m "feat(despesas): paginas nova e editar"
```

---

## Task 12: Despesa row component

**Files:**
- Create: `src/components/despesas/despesa-row.tsx`

- [ ] **Step 1: Write row**

```tsx
import Link from "next/link";
import { StatusPill, type StatusTone } from "@/components/ui/status-pill";
import { money } from "@/lib/constants";
import {
  cancelDespesaAction,
  payDespesaAction
} from "@/lib/actions/despesas";
import { displayDespesaStatus } from "@/lib/despesas/status";
import type { DespesaRow as DespesaRowType } from "@/lib/data/despesas";

const tones: Record<string, StatusTone> = {
  aberta: "warning",
  vencida: "danger",
  paga: "success",
  cancelada: "neutral"
};

function dateText(value: string | null) {
  if (!value) return "-";
  return new Date(`${value}T00:00:00`).toLocaleDateString("pt-BR");
}

export function DespesaRow({ d }: { d: DespesaRowType }) {
  const status = displayDespesaStatus(d);
  return (
    <tr className="border-t">
      <td className="py-2">
        <Link href={`/despesas/${d.id}/editar`} className="hover:underline">
          {d.descricao}
        </Link>
      </td>
      <td>{d.categoria_nome ?? "-"}</td>
      <td>{d.fornecedor ?? "-"}</td>
      <td>{dateText(d.data_vencimento)}</td>
      <td>{dateText(d.data_pagamento)}</td>
      <td className="text-right">{money.format(d.valor)}</td>
      <td><StatusPill tone={tones[status]}>{status}</StatusPill></td>
      <td className="text-right space-x-1">
        {d.status === "aberta" ? (
          <form action={payDespesaAction} className="inline">
            <input type="hidden" name="id" value={d.id} />
            <input type="hidden" name="data_pagamento" value={new Date().toISOString().slice(0, 10)} />
            <button type="submit" className="ds-btn ds-btn-sm ds-btn-success">Pagar</button>
          </form>
        ) : null}
        <Link href={`/despesas/${d.id}/editar`} className="ds-btn ds-btn-sm">Editar</Link>
        {d.status !== "cancelada" ? (
          <form action={cancelDespesaAction} className="inline">
            <input type="hidden" name="id" value={d.id} />
            <button type="submit" className="ds-btn ds-btn-sm ds-btn-danger">Cancelar</button>
          </form>
        ) : null}
      </td>
    </tr>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/despesas/despesa-row.tsx
git commit -m "feat(despesas): row component com acoes"
```

---

## Task 13: Monthly list page

**Files:**
- Create: `src/app/(app)/despesas/page.tsx`

- [ ] **Step 1: Write list page**

```tsx
import Link from "next/link";
import { ChevronLeft, ChevronRight, Plus, Copy } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/card";
import { DespesaRow } from "@/components/despesas/despesa-row";
import { duplicateMonthAction } from "@/lib/actions/despesas";
import { money } from "@/lib/constants";
import { getCategorias, getDespesasMensais } from "@/lib/data/despesas";
import {
  totalAberto,
  totalDespesas,
  totalPago,
  totalVencido
} from "@/lib/despesas/totals";

function mesLabel(competencia: string) {
  const [y, m] = competencia.split("-");
  const meses = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
  return `${meses[Number(m) - 1]} ${y}`;
}

function adjacentMes(competencia: string, delta: number) {
  const [y, m] = competencia.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default async function DespesasPage({
  searchParams
}: {
  searchParams: Promise<{ mes?: string; categoria_id?: string; status?: string; erro?: string }>;
}) {
  const params = await searchParams;
  const now = new Date();
  const defaultMes = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const competencia = params.mes ?? defaultMes;
  const statusFilter = params.status ? params.status.split(",") : undefined;

  const [categorias, despesas] = await Promise.all([
    getCategorias(),
    getDespesasMensais(competencia, {
      categoria_id: params.categoria_id || undefined,
      status: statusFilter
    })
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="Despesas" subtitle="Despesas operacionais por mês." />

      {params.erro ? (
        <div className="ds-alert ds-alert-error">Erro: {params.erro}</div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link href={`/despesas?mes=${adjacentMes(competencia, -1)}`} className="ds-btn ds-btn-icon">
            <ChevronLeft size={16} />
          </Link>
          <div className="text-lg font-semibold">{mesLabel(competencia)}</div>
          <Link href={`/despesas?mes=${adjacentMes(competencia, 1)}`} className="ds-btn ds-btn-icon">
            <ChevronRight size={16} />
          </Link>
        </div>
        <div className="flex gap-2">
          <form action={duplicateMonthAction} className="inline">
            <input type="hidden" name="to" value={competencia} />
            <button type="submit" className="ds-btn ds-btn-secondary">
              <Copy size={14} /> Duplicar mês anterior
            </button>
          </form>
          <Link href={`/despesas/nova?mes=${competencia}`} className="ds-btn ds-btn-primary">
            <Plus size={14} /> Nova despesa
          </Link>
          <Link href="/despesas/categorias" className="ds-btn">Categorias</Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Panel><div className="text-xs text-gray-500">Total</div><div className="text-xl font-semibold">{money.format(totalDespesas(despesas))}</div></Panel>
        <Panel><div className="text-xs text-gray-500">Pago</div><div className="text-xl font-semibold text-emerald-600">{money.format(totalPago(despesas))}</div></Panel>
        <Panel><div className="text-xs text-gray-500">Em aberto</div><div className="text-xl font-semibold text-amber-600">{money.format(totalAberto(despesas))}</div></Panel>
        <Panel><div className="text-xs text-gray-500">Vencido</div><div className="text-xl font-semibold text-red-600">{money.format(totalVencido(despesas))}</div></Panel>
      </div>

      <Panel title="Filtros">
        <form className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="mes" value={competencia} />
          <div>
            <label className="block text-xs">Categoria</label>
            <select name="categoria_id" defaultValue={params.categoria_id ?? ""} className="ds-input">
              <option value="">Todas</option>
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs">Status</label>
            <select name="status" defaultValue={params.status ?? ""} className="ds-input">
              <option value="">Todos</option>
              <option value="aberta">Aberta</option>
              <option value="paga">Paga</option>
              <option value="cancelada">Cancelada</option>
            </select>
          </div>
          <button type="submit" className="ds-btn ds-btn-secondary">Aplicar</button>
          <Link href={`/despesas?mes=${competencia}`} className="ds-btn">Limpar</Link>
        </form>
      </Panel>

      <Panel title="Despesas do mês">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-gray-500">
              <th>Descrição</th>
              <th>Categoria</th>
              <th>Fornecedor</th>
              <th>Venc.</th>
              <th>Pago em</th>
              <th className="text-right">Valor</th>
              <th>Status</th>
              <th className="text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {despesas.map((d) => <DespesaRow key={d.id} d={d} />)}
            {despesas.length === 0 ? (
              <tr><td colSpan={8} className="py-6 text-center text-gray-500">Nenhuma despesa neste mês.</td></tr>
            ) : null}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}
```

- [ ] **Step 2: Manually test in browser**

Run: `npm run dev`
Test:
- `/despesas` shows current month, empty table, 4 zeroed cards.
- Click "Nova despesa", create one with vencimento today, valor 100.
- Back at `/despesas` — totals reflect new row.
- Click "Pagar" — status flips to `paga`, totals shift.
- Navigate to previous month via ChevronLeft.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/despesas/page.tsx
git commit -m "feat(despesas): pagina mensal com cards e filtros"
```

---

## Task 14: Sidebar nav entry

**Files:**
- Modify: `src/components/layout/topbar.tsx:10-14`

- [ ] **Step 1: Add Despesas to `primaryItems`**

Replace:

```ts
const primaryItems: Array<{ href: string; label: string; icon: TopbarIconName }> = [
  { href: "/", label: "Dashboard", icon: "LayoutDashboard" },
  { href: "/financeiro", label: "Financeiro", icon: "BarChart3" },
  { href: "/portaria", label: "Portaria", icon: "DoorOpen" }
];
```

With:

```ts
const primaryItems: Array<{ href: string; label: string; icon: TopbarIconName }> = [
  { href: "/", label: "Dashboard", icon: "LayoutDashboard" },
  { href: "/financeiro", label: "Financeiro", icon: "BarChart3" },
  { href: "/despesas", label: "Despesas", icon: "ReceiptText" },
  { href: "/portaria", label: "Portaria", icon: "DoorOpen" }
];
```

- [ ] **Step 2: Verify `ReceiptText` icon name is exported by topbar-nav-link**

Run: `grep -n ReceiptText src/components/layout/topbar-nav-link.tsx`
Expected: at least one match (already used by Inadimplência item). If missing, add it to the `icons` map there.

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/topbar.tsx
git commit -m "feat(despesas): link no topbar"
```

---

## Task 15: End-to-end manual verification

- [ ] **Step 1: Run dev server**

Run: `npm run dev`

- [ ] **Step 2: Walk the full flow**

1. Login as user with role `admin` or `financeiro`.
2. Click "Despesas" in topbar.
3. Create category "Telefone" at `/despesas/categorias`.
4. Create despesa: "Vivo abril", Telefone, R$ 250, vencimento dia 10 do mês corrente.
5. Verify card "Em aberto" = R$ 250.
6. Edit despesa, upload PDF comprovante (<5MB).
7. Verify file appears in Supabase Storage `despesas-comprovantes/{id}/...`.
8. Click "Pagar" — status → `paga`, "Pago" card = R$ 250.
9. Navigate to next month (empty). Click "Duplicar mês anterior". Verify Vivo April was copied with `status='aberta'`, `data_pagamento=null`, no comprovante, vencimento on day 10 of new month.
10. Try "Duplicar mês anterior" again — should redirect with `erro=mes_destino_nao_vazio`.
11. Filter by status `paga` in original month — only paid rows.
12. Cancel a despesa — status `cancelada`, not counted in Total/Aberto.

- [ ] **Step 3: Run typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: no errors.

- [ ] **Step 4: Final commit if anything fixed**

```bash
git status
# if changes:
git add -A
git commit -m "fix(despesas): ajustes pos-QA"
```

---

## Out of scope

- Recorrência automática (cron)
- Aprovação multi-etapa
- Centro de custo
- Relatório anual / DRE
- Conciliação bancária
