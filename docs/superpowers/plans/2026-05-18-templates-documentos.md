# Templates de Documentos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que a secretária faça upload de templates `.docx`, mapeie placeholders a campos do banco via UI no módulo RH, e os templates apareçam automaticamente disponíveis para download na ficha do aluno — sem deploy.

**Architecture:** Tabela `templates_documentos` armazena metadata + mappings jsonb. Bucket privado `templates-documentos` armazena os arquivos. Um resolver runtime executa as queries dinamicamente com base no mapping e injeta valores em `docxtemplater`. A UI no menu RH faz CRUD. Os 6 templates atuais migram via seed script. Top 3 mais gerados viram botões quick na ficha do aluno automaticamente.

**Tech Stack:** Next.js 14 App Router, TypeScript, Supabase (Postgres + Storage + Auth/RLS), docxtemplater, pizzip, Tailwind, sonner, lucide-react.

**Spec:** `docs/superpowers/specs/2026-05-18-templates-documentos-design.md`

**Testing note:** Sem framework de teste UI. Verificação manual via dev server descrita em cada task + smoke test final na Task 14.

---

## File Structure

**Novos:**
- `supabase/migrations/202605290007_templates_documentos.sql` — tabela + RLS + indexes
- `scripts/seed_templates.mjs` — migra os 6 templates do filesystem pro banco/Storage
- `src/lib/documents/schema-catalog.ts` — allowlist tabelas/colunas/filtros + nomes das fns computed
- `src/lib/documents/resolver.ts` — `resolveMappings(mappings, ctx)` + funções computed
- `src/lib/documents/placeholders.ts` — `extractPlaceholders(docxBuffer)` via inspeção do XML
- `src/lib/documents/generator-v2.ts` — `generateDocxFromBuffer(buffer, vars)` (similar a `generateDocx`, mas recebe buffer em vez de ler do filesystem)
- `src/lib/data/templates.ts` — `listTemplates`, `getTemplate`, `getTemplatesAtivos` (split between server data fns)
- `src/lib/actions/templates.ts` — `uploadTemplateAction`, `saveTemplateMappingsAction`, `updateTemplateAction`, `deleteTemplateAction`, `toggleTemplateAtivoAction`
- `src/lib/actions/documents-generate-v2.ts` — `generateFromTemplateAction(matriculaId, templateId)`
- `src/app/(app)/rh/documentos/page.tsx` — lista
- `src/app/(app)/rh/documentos/novo/page.tsx` — wizard step 1 (upload + metadata)
- `src/app/(app)/rh/documentos/[id]/page.tsx` — edit metadata + delete
- `src/app/(app)/rh/documentos/[id]/mapeamento/page.tsx` — wizard step 2 / edit mappings
- `src/components/rh/documentos/templates-table.tsx` — tabela de listagem
- `src/components/rh/documentos/template-meta-form.tsx` — form nome/categoria/ativo
- `src/components/rh/documentos/mapping-form.tsx` — client component com linhas de mapping
- `src/components/rh/documentos/delete-template-button.tsx` — confirm + soft/hard delete

**Modificados:**
- `src/components/layout/rh-dropdown.tsx` — item "Documentos"
- `src/components/students/quick-document-actions.tsx` — recebe prop `templates`, top 3 quick, action v2
- `src/components/students/student-header-actions.tsx` — propaga `templates`
- `src/app/(app)/alunos/[id]/page.tsx` — fetch templates ativos
- `src/components/matriculas/document-generator.tsx` — lê templates do banco, action v2

**Deletar (cleanup final Task 13):**
- `src/lib/documents/templates.ts` (TIPO_TEMPLATE enum)
- `src/lib/documents/variables.ts` (`buildVariables`)
- `src/lib/actions/documents-generate.ts` (`generateDocxAction`, `generateDocumentoAction`)
- `public/templates/*.docx`

---

## Task 1: Migration + bucket Storage

**Files:**
- Create: `supabase/migrations/202605290007_templates_documentos.sql`

- [ ] **Step 1: Create the migration**

Conteúdo exato:

```sql
-- templates_documentos: parametrizáveis pela secretária
create table if not exists public.templates_documentos (
  id            uuid primary key default gen_random_uuid(),
  escola_id     uuid not null references public.escolas(id) on delete cascade,
  nome          text not null check (char_length(nome) >= 3),
  categoria     text not null check (categoria in ('declaracao','termo','contrato','outro')),
  storage_path  text not null,
  ativo         boolean not null default true,
  gerado_count  integer not null default 0,
  mappings      jsonb not null default '[]'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists templates_documentos_escola_ativo_idx
  on public.templates_documentos (escola_id, ativo);
create index if not exists templates_documentos_escola_ranking_idx
  on public.templates_documentos (escola_id, gerado_count desc);

alter table public.templates_documentos enable row level security;

create policy "templates_select_own_escola"
  on public.templates_documentos for select
  using (escola_id = (select escola_id from public.perfis where user_id = auth.uid()));

create policy "templates_insert_own_escola"
  on public.templates_documentos for insert
  with check (escola_id = (select escola_id from public.perfis where user_id = auth.uid()));

create policy "templates_update_own_escola"
  on public.templates_documentos for update
  using (escola_id = (select escola_id from public.perfis where user_id = auth.uid()));

create policy "templates_delete_own_escola"
  on public.templates_documentos for delete
  using (escola_id = (select escola_id from public.perfis where user_id = auth.uid()));

-- bucket privado para os arquivos .docx dos templates
insert into storage.buckets (id, name, public)
values ('templates-documentos', 'templates-documentos', false)
on conflict (id) do nothing;

-- policies do bucket: acesso restrito à escola do usuário (path = "<escola_id>/...")
create policy "templates_storage_select_own_escola"
  on storage.objects for select
  using (
    bucket_id = 'templates-documentos'
    and (storage.foldername(name))[1] = (
      select escola_id::text from public.perfis where user_id = auth.uid()
    )
  );

create policy "templates_storage_insert_own_escola"
  on storage.objects for insert
  with check (
    bucket_id = 'templates-documentos'
    and (storage.foldername(name))[1] = (
      select escola_id::text from public.perfis where user_id = auth.uid()
    )
  );

create policy "templates_storage_update_own_escola"
  on storage.objects for update
  using (
    bucket_id = 'templates-documentos'
    and (storage.foldername(name))[1] = (
      select escola_id::text from public.perfis where user_id = auth.uid()
    )
  );

create policy "templates_storage_delete_own_escola"
  on storage.objects for delete
  using (
    bucket_id = 'templates-documentos'
    and (storage.foldername(name))[1] = (
      select escola_id::text from public.perfis where user_id = auth.uid()
    )
  );
```

- [ ] **Step 2: Aplicar migration**

Run:
```
npx supabase db push
```
ou (se ambiente local rodar via CLI específica do projeto) a sequência usual de aplicação de migration. Confirmar que `templates_documentos` existe:

```
npx supabase db query "select count(*) from public.templates_documentos;"
```
Expected: `0`.

Confirmar bucket:
```
npx supabase storage list templates-documentos
```
Expected: bucket existe (vazio).

- [ ] **Step 3: Commit**

```
git add supabase/migrations/202605290007_templates_documentos.sql
git commit -m "feat(db): tabela templates_documentos + bucket privado"
```

---

## Task 2: Schema catalog

**Files:**
- Create: `src/lib/documents/schema-catalog.ts`

- [ ] **Step 1: Create the file**

```ts
// Allowlist de tabelas/colunas/filtros disponíveis para mapping de templates.
// Backend valida contra esta lista. Frontend só oferece o que está aqui.

export type AllowedFilter =
  | "pai" | "mae" | "financeiro" | "first"
  | "principal" | "ativa" | "ultima";

export type AllowedTableConfig = {
  columns: readonly string[];
  filters: readonly AllowedFilter[];
};

export const ALLOWED_TABLES: Record<string, AllowedTableConfig> = {
  alunos: {
    columns: [
      "nome", "cpf", "rg", "data_nascimento", "sexo", "naturalidade",
      "email", "celular", "etnia", "codigo_inep",
      "informacoes_adicionais", "matricula_codigo",
    ],
    filters: [],
  },
  responsaveis_aluno: {
    columns: [
      "nome", "cpf", "rg", "celular", "telefone", "email",
      "parentesco", "profissao", "endereco_trabalho",
    ],
    filters: ["pai", "mae", "financeiro", "first"],
  },
  enderecos_aluno: {
    columns: ["logradouro", "numero", "complemento", "bairro", "cidade", "uf", "cep"],
    filters: ["principal", "first"],
  },
  contatos_aluno: {
    columns: ["nome", "telefone", "email", "parentesco"],
    filters: ["first"],
  },
  informacoes_medicas: {
    columns: [
      "alergia", "necessidade_especial", "medico",
      "telefone_medico", "plano_saude", "telefone_plano", "observacoes",
    ],
    filters: [],
  },
  matriculas: {
    columns: ["codigo", "ano_letivo", "data_matricula", "idade_na_matricula", "observacoes", "status"],
    filters: ["ativa", "ultima"],
  },
  series:  { columns: ["nome"],          filters: [] },
  turmas:  { columns: ["nome", "turno"], filters: [] },
  planos:  { columns: ["nome", "valor"], filters: [] },
  escolas: { columns: ["nome"],          filters: [] },
};

export const COMPUTED_FNS = [
  "data_hoje_extenso",
  "cidade_data_extenso",
  "idade_atual",
  "ano_letivo_atual",
  "endereco_principal_formatado",
  "tipo_ensino_via_series_segmentos",
] as const;

export type ComputedFn = (typeof COMPUTED_FNS)[number];

export function isAllowedTable(t: string): t is keyof typeof ALLOWED_TABLES {
  return Object.prototype.hasOwnProperty.call(ALLOWED_TABLES, t);
}

export function isAllowedColumn(table: string, column: string): boolean {
  if (!isAllowedTable(table)) return false;
  return (ALLOWED_TABLES[table].columns as readonly string[]).includes(column);
}

export function isAllowedFilter(table: string, filter: string): boolean {
  if (!isAllowedTable(table)) return false;
  return (ALLOWED_TABLES[table].filters as readonly string[]).includes(filter);
}

export function isComputedFn(fn: string): fn is ComputedFn {
  return (COMPUTED_FNS as readonly string[]).includes(fn);
}

export type Mapping =
  | { placeholder: string; type: "tabela"; table: string; column: string; filter: string | null }
  | { placeholder: string; type: "computed"; fn: ComputedFn };

export function validateMapping(m: unknown): m is Mapping {
  if (!m || typeof m !== "object") return false;
  const obj = m as Record<string, unknown>;
  if (typeof obj.placeholder !== "string" || !obj.placeholder.trim()) return false;
  if (obj.type === "tabela") {
    if (typeof obj.table !== "string" || !isAllowedTable(obj.table)) return false;
    if (typeof obj.column !== "string" || !isAllowedColumn(obj.table, obj.column)) return false;
    if (obj.filter !== null && obj.filter !== undefined) {
      if (typeof obj.filter !== "string" || !isAllowedFilter(obj.table, obj.filter)) return false;
    }
    return true;
  }
  if (obj.type === "computed") {
    return typeof obj.fn === "string" && isComputedFn(obj.fn);
  }
  return false;
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: zero new errors.

- [ ] **Step 3: Commit**

```
git add src/lib/documents/schema-catalog.ts
git commit -m "feat(documents): schema catalog (allowlist + validador)"
```

---

## Task 3: Placeholder extractor

**Files:**
- Create: `src/lib/documents/placeholders.ts`

- [ ] **Step 1: Create the file**

```ts
import PizZip from "pizzip";

/**
 * Extrai placeholders {NOME} de um .docx (em Buffer).
 * Lê word/document.xml do zip, regex em [A-Z0-9_]+ entre chaves.
 * Retorna nomes deduplicados, ordem de primeira aparição.
 */
export function extractPlaceholders(docxBuffer: Buffer): string[] {
  const zip = new PizZip(docxBuffer);
  const doc = zip.file("word/document.xml");
  if (!doc) return [];
  const xml = doc.asText();
  // Remove tags XML para não pegar { dentro de atributos
  const text = xml.replace(/<[^>]+>/g, "");
  const seen = new Set<string>();
  const out: string[] = [];
  const re = /\{([A-Z0-9_]+)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const name = m[1];
    if (!seen.has(name)) {
      seen.add(name);
      out.push(name);
    }
  }
  return out;
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: zero new errors.

- [ ] **Step 3: Manual sanity check via node**

Run (PowerShell, project root):
```
node -e "const fs=require('fs');const {extractPlaceholders}=require('./.next/server/chunks/missing');"
```

Skip — sem necessidade de runtime check; a função é exercitada no Task 5 quando o upload action chamar.

- [ ] **Step 4: Commit**

```
git add src/lib/documents/placeholders.ts
git commit -m "feat(documents): extractor de placeholders de .docx"
```

---

## Task 4: Resolver

**Files:**
- Create: `src/lib/documents/resolver.ts`

- [ ] **Step 1: Create the file**

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ALLOWED_TABLES,
  isAllowedTable,
  isComputedFn,
  type Mapping,
  type ComputedFn,
} from "./schema-catalog";

const MESES = [
  "janeiro","fevereiro","março","abril","maio","junho",
  "julho","agosto","setembro","outubro","novembro","dezembro",
];

export type ResolverContext = {
  supabase: SupabaseClient;
  matriculaId: string;
  alunoId: string;
  escolaId: string;
};

type MatriculaRow = {
  id: string;
  ano_letivo: number | null;
  data_matricula: string | null;
  idade_na_matricula: number | null;
  observacoes: string | null;
  status: string | null;
  codigo: string | null;
  serie_id: string | null;
  turma_id: string | null;
  plano_id: string | null;
  escola_id: string;
};

function formatDataExtenso(d: Date): string {
  return `${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;
}

function formatCidadeDataExtenso(cidade: string | null, d: Date): string {
  const c = cidade && cidade.trim() ? cidade.trim() : "Trindade";
  return `${c}, ${formatDataExtenso(d)}`;
}

function formatEndereco(e: Record<string, unknown> | null): string {
  if (!e) return "";
  const parts = [
    e.logradouro,
    e.numero ? `nº ${e.numero}` : null,
    e.complemento,
    e.bairro,
    e.cidade && e.uf ? `${e.cidade}/${e.uf}` : e.cidade,
    e.cep,
  ]
    .filter((v) => typeof v === "string" && v)
    .map((v) => String(v));
  return parts.join(", ");
}

function calcularIdade(dataNasc: string | null): string {
  if (!dataNasc) return "";
  const nasc = new Date(`${dataNasc}T00:00:00Z`);
  if (Number.isNaN(nasc.getTime())) return "";
  const hoje = new Date();
  let idade = hoje.getFullYear() - nasc.getUTCFullYear();
  const m = hoje.getMonth() - nasc.getUTCMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < nasc.getUTCDate())) idade--;
  return String(idade);
}

function applyFilter(rows: Record<string, unknown>[], filter: string | null): Record<string, unknown> | null {
  if (rows.length === 0) return null;
  if (!filter || filter === "first") return rows[0];
  switch (filter) {
    case "pai":
      return rows.find((r) => ["pai","padrasto"].includes(String(r.parentesco ?? "").toLowerCase())) ?? null;
    case "mae":
      return rows.find((r) => ["mae","mãe","madrasta"].includes(String(r.parentesco ?? "").toLowerCase())) ?? null;
    case "financeiro":
      return rows.find((r) => r.responsavel_financeiro === true) ?? null;
    case "principal":
      return rows.find((r) => r.principal === true) ?? rows[0];
    case "ativa":
      return rows.find((r) => r.status === "ativa") ?? null;
    case "ultima": {
      const sorted = [...rows].sort((a, b) => {
        const ta = String(a.created_at ?? "");
        const tb = String(b.created_at ?? "");
        return tb.localeCompare(ta);
      });
      return sorted[0] ?? null;
    }
    default:
      return rows[0];
  }
}

async function loadTableRows(
  supabase: SupabaseClient,
  table: string,
  ctx: ResolverContext,
  matricula: MatriculaRow | null,
  columns: Set<string>,
): Promise<Record<string, unknown>[]> {
  const colsForSelect = Array.from(columns);
  // Sempre incluir campos usados pelos filtros para evitar refetch
  const extraByTable: Record<string, string[]> = {
    responsaveis_aluno: ["parentesco", "responsavel_financeiro"],
    enderecos_aluno: ["principal"],
    matriculas: ["status", "created_at"],
  };
  for (const extra of (extraByTable[table] ?? [])) {
    if (!columns.has(extra)) colsForSelect.push(extra);
  }
  const select = colsForSelect.join(", ");

  switch (table) {
    case "alunos": {
      const { data } = await supabase.from("alunos").select(select).eq("id", ctx.alunoId);
      return (data as Record<string, unknown>[] | null) ?? [];
    }
    case "responsaveis_aluno":
    case "enderecos_aluno":
    case "contatos_aluno":
    case "informacoes_medicas": {
      const { data } = await supabase.from(table).select(select).eq("aluno_id", ctx.alunoId);
      return (data as Record<string, unknown>[] | null) ?? [];
    }
    case "matriculas": {
      const { data } = await supabase.from("matriculas").select(select).eq("id", ctx.matriculaId);
      return (data as Record<string, unknown>[] | null) ?? [];
    }
    case "series": {
      if (!matricula?.serie_id) return [];
      const { data } = await supabase.from("series").select(select).eq("id", matricula.serie_id);
      return (data as Record<string, unknown>[] | null) ?? [];
    }
    case "turmas": {
      if (!matricula?.turma_id) return [];
      const { data } = await supabase.from("turmas").select(select).eq("id", matricula.turma_id);
      return (data as Record<string, unknown>[] | null) ?? [];
    }
    case "planos": {
      if (!matricula?.plano_id) return [];
      const { data } = await supabase.from("planos").select(select).eq("id", matricula.plano_id);
      return (data as Record<string, unknown>[] | null) ?? [];
    }
    case "escolas": {
      const { data } = await supabase.from("escolas").select(select).eq("id", ctx.escolaId);
      return (data as Record<string, unknown>[] | null) ?? [];
    }
    default:
      return [];
  }
}

async function runComputed(
  fn: ComputedFn,
  ctx: ResolverContext,
  matricula: MatriculaRow | null,
): Promise<string> {
  const supabase = ctx.supabase;
  const now = new Date();
  switch (fn) {
    case "data_hoje_extenso":
      return formatDataExtenso(now);
    case "ano_letivo_atual":
      return String(now.getFullYear());
    case "cidade_data_extenso": {
      const { data } = await supabase.from("escolas").select("nome").eq("id", ctx.escolaId).maybeSingle();
      // No schema atual, escolas só tem `nome`. Usamos "Trindade" como padrão da cidade.
      void data;
      return formatCidadeDataExtenso(null, now);
    }
    case "idade_atual": {
      const { data } = await supabase.from("alunos").select("data_nascimento").eq("id", ctx.alunoId).maybeSingle();
      return calcularIdade((data?.data_nascimento as string | null) ?? null);
    }
    case "endereco_principal_formatado": {
      const { data } = await supabase
        .from("enderecos_aluno")
        .select("logradouro,numero,complemento,bairro,cidade,uf,cep,principal")
        .eq("aluno_id", ctx.alunoId);
      const rows = (data as Record<string, unknown>[] | null) ?? [];
      const principal = rows.find((r) => r.principal === true) ?? rows[0] ?? null;
      return formatEndereco(principal);
    }
    case "tipo_ensino_via_series_segmentos": {
      if (!matricula?.serie_id) return "";
      const { data } = await supabase
        .from("series")
        .select("segmentos(nome)")
        .eq("id", matricula.serie_id)
        .maybeSingle();
      const seg = data?.segmentos as { nome?: string } | { nome?: string }[] | null | undefined;
      const segObj = Array.isArray(seg) ? seg[0] ?? null : seg ?? null;
      return segObj?.nome ?? "";
    }
  }
}

export async function resolveMappings(
  mappings: Mapping[],
  ctx: ResolverContext,
): Promise<Record<string, string>> {
  // Busca a matrícula uma única vez (precisa de serie_id/turma_id/plano_id para outras queries).
  const { data: matricula } = await ctx.supabase
    .from("matriculas")
    .select("id, ano_letivo, data_matricula, idade_na_matricula, observacoes, status, codigo, serie_id, turma_id, plano_id, escola_id")
    .eq("id", ctx.matriculaId)
    .maybeSingle();
  const mat = (matricula as MatriculaRow | null) ?? null;

  // Agrupar mappings por tabela + acumular colunas necessárias.
  const tableCols = new Map<string, Set<string>>();
  for (const m of mappings) {
    if (m.type !== "tabela") continue;
    if (!isAllowedTable(m.table)) continue;
    if (!tableCols.has(m.table)) tableCols.set(m.table, new Set());
    tableCols.get(m.table)!.add(m.column);
  }

  // Carregar todas as tabelas em paralelo.
  const tableEntries = Array.from(tableCols.entries());
  const loaded: Map<string, Record<string, unknown>[]> = new Map();
  await Promise.all(
    tableEntries.map(async ([table, cols]) => {
      const rows = await loadTableRows(ctx.supabase, table, ctx, mat, cols);
      loaded.set(table, rows);
    }),
  );

  // Resolver cada mapping.
  const out: Record<string, string> = {};
  for (const m of mappings) {
    if (m.type === "computed") {
      if (!isComputedFn(m.fn)) {
        out[m.placeholder] = "";
        continue;
      }
      out[m.placeholder] = (await runComputed(m.fn, ctx, mat)) ?? "";
      continue;
    }
    if (m.type === "tabela") {
      if (!isAllowedTable(m.table)) {
        out[m.placeholder] = "";
        continue;
      }
      const rows = loaded.get(m.table) ?? [];
      const row = applyFilter(rows, m.filter);
      const v = row ? row[m.column] : null;
      out[m.placeholder] = v === null || v === undefined ? "" : String(v);
      continue;
    }
    out[m.placeholder] = "";
  }
  return out;
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: zero new errors.

- [ ] **Step 3: Commit**

```
git add src/lib/documents/resolver.ts
git commit -m "feat(documents): resolver dinâmico de mappings"
```

---

## Task 5: Generator v2 (a partir de buffer)

**Files:**
- Create: `src/lib/documents/generator-v2.ts`

- [ ] **Step 1: Create the file**

```ts
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";

export function generateDocxFromBuffer(
  docxBuffer: Buffer,
  variables: Record<string, string>,
): Buffer {
  const zip = new PizZip(docxBuffer);
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    nullGetter: () => "",
  });
  doc.render(variables);
  return doc.getZip().generate({ type: "nodebuffer" }) as Buffer;
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: zero new errors.

- [ ] **Step 3: Commit**

```
git add src/lib/documents/generator-v2.ts
git commit -m "feat(documents): generateDocxFromBuffer (template via Storage)"
```

---

## Task 6: Data helpers para templates

**Files:**
- Create: `src/lib/data/templates.ts`

- [ ] **Step 1: Create the file**

```ts
import { createServerClient } from "@/lib/supabase/server";
import type { Mapping } from "@/lib/documents/schema-catalog";

export type TemplateRow = {
  id: string;
  escola_id: string;
  nome: string;
  categoria: "declaracao" | "termo" | "contrato" | "outro";
  storage_path: string;
  ativo: boolean;
  gerado_count: number;
  mappings: Mapping[];
  created_at: string;
  updated_at: string;
};

export async function listTemplates(escolaId: string, opts?: {
  categoria?: TemplateRow["categoria"];
  status?: "ativo" | "inativo" | "todos";
}): Promise<TemplateRow[]> {
  const supabase = await createServerClient();
  let q = supabase
    .from("templates_documentos")
    .select("id, escola_id, nome, categoria, storage_path, ativo, gerado_count, mappings, created_at, updated_at")
    .eq("escola_id", escolaId)
    .order("gerado_count", { ascending: false });

  if (opts?.categoria) q = q.eq("categoria", opts.categoria);
  if (opts?.status === "ativo") q = q.eq("ativo", true);
  if (opts?.status === "inativo") q = q.eq("ativo", false);

  const { data, error } = await q;
  if (error) throw error;
  return (data as TemplateRow[] | null) ?? [];
}

export async function getTemplate(id: string, escolaId: string): Promise<TemplateRow | null> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("templates_documentos")
    .select("id, escola_id, nome, categoria, storage_path, ativo, gerado_count, mappings, created_at, updated_at")
    .eq("id", id)
    .eq("escola_id", escolaId)
    .maybeSingle();
  if (error) throw error;
  return (data as TemplateRow | null) ?? null;
}

export async function getTemplatesAtivos(escolaId: string): Promise<TemplateRow[]> {
  return listTemplates(escolaId, { status: "ativo" });
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: zero new errors.

- [ ] **Step 3: Commit**

```
git add src/lib/data/templates.ts
git commit -m "feat(data): helpers de templates_documentos"
```

---

## Task 7: Server actions de CRUD de templates

**Files:**
- Create: `src/lib/actions/templates.ts`

- [ ] **Step 1: Create the file**

```ts
"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { createServerClient } from "@/lib/supabase/server";
import { extractPlaceholders } from "@/lib/documents/placeholders";
import { validateMapping, type Mapping } from "@/lib/documents/schema-catalog";

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const MAX_BYTES = 5 * 1024 * 1024;
const VALID_CATEGORIAS = new Set(["declaracao", "termo", "contrato", "outro"]);

function sanitizeNome(nome: string): string {
  return nome.trim().slice(0, 120);
}

export async function uploadTemplateAction(formData: FormData) {
  const session = await requireSession();
  const escolaId = session.profile.escola_id;

  const file = formData.get("arquivo");
  const nomeRaw = String(formData.get("nome") ?? "");
  const categoria = String(formData.get("categoria") ?? "");

  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Arquivo .docx obrigatório.");
  }
  if (file.size > MAX_BYTES) throw new Error("Arquivo maior que 5 MB.");
  if (file.type !== DOCX_MIME && !file.name.toLowerCase().endsWith(".docx")) {
    throw new Error("Envie um arquivo .docx.");
  }
  if (sanitizeNome(nomeRaw).length < 3) throw new Error("Nome do template precisa ter pelo menos 3 caracteres.");
  if (!VALID_CATEGORIAS.has(categoria)) throw new Error("Categoria inválida.");

  const supabase = await createServerClient();
  const buffer = Buffer.from(await file.arrayBuffer());

  // Parse antes do upload — se falhar, abortamos.
  let placeholders: string[] = [];
  try {
    placeholders = extractPlaceholders(buffer);
  } catch {
    throw new Error("Falha ao ler o arquivo .docx. Verifique se está válido.");
  }

  const templateId = randomUUID();
  const storagePath = `${escolaId}/templates/${templateId}.docx`;

  const { error: upErr } = await supabase.storage
    .from("templates-documentos")
    .upload(storagePath, buffer, { contentType: DOCX_MIME, upsert: false });
  if (upErr) throw upErr;

  const initialMappings: Mapping[] = placeholders.map((p) => ({
    placeholder: p,
    type: "tabela",
    table: "alunos",
    column: "nome",
    filter: null,
  }));

  const { error: insErr } = await supabase.from("templates_documentos").insert({
    id: templateId,
    escola_id: escolaId,
    nome: sanitizeNome(nomeRaw),
    categoria,
    storage_path: storagePath,
    ativo: false, // só ativa depois do mapeamento
    mappings: initialMappings,
  });
  if (insErr) {
    await supabase.storage.from("templates-documentos").remove([storagePath]);
    throw insErr;
  }

  revalidatePath("/rh/documentos");
  redirect(`/rh/documentos/${templateId}/mapeamento`);
}

export async function saveTemplateMappingsAction(formData: FormData) {
  const session = await requireSession();
  const escolaId = session.profile.escola_id;
  const templateId = String(formData.get("template_id") ?? "");
  const mappingsJson = String(formData.get("mappings") ?? "[]");
  const ativarRaw = String(formData.get("ativar") ?? "");

  if (!templateId) throw new Error("template_id obrigatório.");

  let parsed: unknown;
  try {
    parsed = JSON.parse(mappingsJson);
  } catch {
    throw new Error("Mappings JSON inválido.");
  }
  if (!Array.isArray(parsed)) throw new Error("Mappings precisa ser array.");
  for (const m of parsed) {
    if (!validateMapping(m)) throw new Error(`Mapping inválido: ${JSON.stringify(m)}`);
  }
  const mappings = parsed as Mapping[];

  const supabase = await createServerClient();
  const update: Record<string, unknown> = {
    mappings,
    updated_at: new Date().toISOString(),
  };
  if (ativarRaw === "1") update.ativo = true;

  const { error } = await supabase
    .from("templates_documentos")
    .update(update)
    .eq("id", templateId)
    .eq("escola_id", escolaId);
  if (error) throw error;

  revalidatePath("/rh/documentos");
  revalidatePath(`/rh/documentos/${templateId}`);
  revalidatePath(`/rh/documentos/${templateId}/mapeamento`);
  redirect("/rh/documentos");
}

export async function updateTemplateAction(formData: FormData) {
  const session = await requireSession();
  const escolaId = session.profile.escola_id;
  const templateId = String(formData.get("template_id") ?? "");
  const nome = sanitizeNome(String(formData.get("nome") ?? ""));
  const categoria = String(formData.get("categoria") ?? "");

  if (!templateId) throw new Error("template_id obrigatório.");
  if (nome.length < 3) throw new Error("Nome inválido.");
  if (!VALID_CATEGORIAS.has(categoria)) throw new Error("Categoria inválida.");

  const supabase = await createServerClient();
  const { error } = await supabase
    .from("templates_documentos")
    .update({ nome, categoria, updated_at: new Date().toISOString() })
    .eq("id", templateId)
    .eq("escola_id", escolaId);
  if (error) throw error;

  revalidatePath("/rh/documentos");
  revalidatePath(`/rh/documentos/${templateId}`);
}

export async function toggleTemplateAtivoAction(formData: FormData) {
  const session = await requireSession();
  const escolaId = session.profile.escola_id;
  const templateId = String(formData.get("template_id") ?? "");
  const ativo = String(formData.get("ativo") ?? "") === "1";
  if (!templateId) throw new Error("template_id obrigatório.");

  const supabase = await createServerClient();
  const { error } = await supabase
    .from("templates_documentos")
    .update({ ativo, updated_at: new Date().toISOString() })
    .eq("id", templateId)
    .eq("escola_id", escolaId);
  if (error) throw error;

  revalidatePath("/rh/documentos");
}

export async function deleteTemplateAction(formData: FormData) {
  const session = await requireSession();
  const escolaId = session.profile.escola_id;
  const templateId = String(formData.get("template_id") ?? "");
  if (!templateId) throw new Error("template_id obrigatório.");

  const supabase = await createServerClient();
  const { data: tpl } = await supabase
    .from("templates_documentos")
    .select("id, escola_id, storage_path, gerado_count")
    .eq("id", templateId)
    .eq("escola_id", escolaId)
    .maybeSingle();

  if (!tpl) throw new Error("Template não encontrado.");
  if ((tpl.gerado_count ?? 0) > 0) {
    throw new Error("Template já gerou documentos. Use Desativar em vez de Excluir.");
  }

  await supabase.storage.from("templates-documentos").remove([tpl.storage_path]);
  const { error } = await supabase
    .from("templates_documentos")
    .delete()
    .eq("id", templateId)
    .eq("escola_id", escolaId);
  if (error) throw error;

  revalidatePath("/rh/documentos");
  redirect("/rh/documentos");
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: zero new errors.

- [ ] **Step 3: Commit**

```
git add src/lib/actions/templates.ts
git commit -m "feat(templates): server actions CRUD de templates"
```

---

## Task 8: Action v2 — gerar a partir de templateId

**Files:**
- Create: `src/lib/actions/documents-generate-v2.ts`

- [ ] **Step 1: Create the file**

```ts
"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth/session";
import { createServerClient } from "@/lib/supabase/server";
import { generateDocxFromBuffer } from "@/lib/documents/generator-v2";
import { resolveMappings, type ResolverContext } from "@/lib/documents/resolver";
import { validateMapping, type Mapping } from "@/lib/documents/schema-catalog";

export async function generateFromTemplateAction(
  matriculaId: string,
  templateId: string,
): Promise<{ success: boolean; base64?: string; nomeArquivo?: string; error?: string }> {
  const session = await requireSession();
  const escolaId = session.profile.escola_id;
  const supabase = await createServerClient();

  // 1) Carrega template (escopo de escola)
  const { data: tpl, error: tplErr } = await supabase
    .from("templates_documentos")
    .select("id, nome, categoria, storage_path, mappings, ativo, escola_id")
    .eq("id", templateId)
    .eq("escola_id", escolaId)
    .maybeSingle();
  if (tplErr || !tpl) return { success: false, error: "Template não encontrado." };
  if (!tpl.ativo) return { success: false, error: "Template inativo." };

  // 2) Carrega matrícula
  const { data: mat, error: matErr } = await supabase
    .from("matriculas")
    .select("aluno_id, ano_letivo")
    .eq("id", matriculaId)
    .maybeSingle();
  if (matErr || !mat) return { success: false, error: "Matrícula não encontrada." };
  const alunoId = mat.aluno_id as string;

  // 3) Baixa template do Storage
  const { data: dl, error: dlErr } = await supabase
    .storage.from("templates-documentos").download(tpl.storage_path as string);
  if (dlErr || !dl) return { success: false, error: "Falha ao baixar template." };
  const templateBuffer = Buffer.from(await dl.arrayBuffer());

  // 4) Resolve mappings (validados antes — mas filtramos por segurança)
  const rawMappings = (tpl.mappings as unknown as unknown[]) ?? [];
  const mappings: Mapping[] = rawMappings.filter((m): m is Mapping => validateMapping(m));

  const ctx: ResolverContext = { supabase, matriculaId, alunoId, escolaId };
  const variables = await resolveMappings(mappings, ctx);

  // 5) Gera .docx
  let docxBuffer: Buffer;
  try {
    docxBuffer = generateDocxFromBuffer(templateBuffer, variables);
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro ao gerar docx." };
  }

  // 6) Monta nome de arquivo, faz upload em documentos-alunos, registra
  const nomeAluno = (variables.NOME_ALUNO || "Aluno")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
  const anoLetivo = variables.ANO_LETIVO || String(new Date().getFullYear());
  const nomeArquivo = `${tpl.nome} - ${nomeAluno} - ${anoLetivo}.docx`.replace(/[/\\:*?"<>|]/g, "-");
  const safeName = nomeArquivo
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "-");
  const storagePath = `${alunoId}/${Date.now()}-${safeName}`;
  const contentType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

  const { error: upErr } = await supabase.storage
    .from("documentos-alunos")
    .upload(storagePath, docxBuffer, { contentType, upsert: false });
  if (upErr) return { success: false, error: upErr.message };

  const { error: insErr } = await supabase.from("documentos_aluno").insert({
    aluno_id: alunoId,
    nome_arquivo: nomeArquivo,
    tipo_documento: tpl.categoria,
    storage_path: storagePath,
    content_type: contentType,
    tamanho_bytes: docxBuffer.length,
  });
  if (insErr) {
    await supabase.storage.from("documentos-alunos").remove([storagePath]);
    return { success: false, error: insErr.message };
  }

  // 7) Incrementa contagem (atômico)
  await supabase.rpc("increment_template_gerado_count", { p_template_id: templateId }).then(() => {}, () => {});
  // Fallback: caso a RPC não exista, faz um update simples.
  await supabase
    .from("templates_documentos")
    .update({ gerado_count: (tpl as { gerado_count?: number }).gerado_count != null ? undefined : undefined })
    .eq("id", templateId)
    .then(() => {}, () => {});
  // Atômico via SQL:
  await supabase.rpc("noop").then(() => {}, () => {});

  // Best-effort increment usando .from().update() com expression não é suportado direto pelo client.
  // Vamos chamar via supabase.from().update({ gerado_count: tpl.gerado_count + 1 }) com leitura recente.
  const { data: cur } = await supabase
    .from("templates_documentos")
    .select("gerado_count")
    .eq("id", templateId)
    .maybeSingle();
  const next = ((cur?.gerado_count as number | null) ?? 0) + 1;
  await supabase
    .from("templates_documentos")
    .update({ gerado_count: next })
    .eq("id", templateId);

  revalidatePath(`/matriculas/${matriculaId}`);
  revalidatePath(`/alunos/${alunoId}`);

  return {
    success: true,
    base64: docxBuffer.toString("base64"),
    nomeArquivo,
  };
}
```

> Nota de design: o increment "atômico" via RPC não existe no projeto. O fluxo acima usa um `select`+`update` simples. Em caso de concorrência o pior que acontece é perder 1 contagem — aceitável para um ranking de UI. Tasks futuras podem trocar por uma RPC SQL `increment_template_gerado_count(uuid)`.

- [ ] **Step 2: Limpar código morto do bloco "Fallback"**

O bloco entre os comentários `// Fallback:` e `// Best-effort increment...` deixa noop calls. Substitua o trecho:

```ts
  // 7) Incrementa contagem (atômico)
  await supabase.rpc("increment_template_gerado_count", { p_template_id: templateId }).then(() => {}, () => {});
  // Fallback: caso a RPC não exista, faz um update simples.
  await supabase
    .from("templates_documentos")
    .update({ gerado_count: (tpl as { gerado_count?: number }).gerado_count != null ? undefined : undefined })
    .eq("id", templateId)
    .then(() => {}, () => {});
  // Atômico via SQL:
  await supabase.rpc("noop").then(() => {}, () => {});

  // Best-effort increment usando .from().update() com expression não é suportado direto pelo client.
  // Vamos chamar via supabase.from().update({ gerado_count: tpl.gerado_count + 1 }) com leitura recente.
  const { data: cur } = await supabase
```

Por (mantém só o select + update):

```ts
  // 7) Incrementa contagem (read+update; perda raríssima sob concorrência é aceitável)
  const { data: cur } = await supabase
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: zero new errors.

- [ ] **Step 4: Commit**

```
git add src/lib/actions/documents-generate-v2.ts
git commit -m "feat(documents): generateFromTemplateAction (resolver dinâmico)"
```

---

## Task 9: Página de lista + item de menu

**Files:**
- Create: `src/components/rh/documentos/templates-table.tsx`
- Create: `src/components/rh/documentos/delete-template-button.tsx`
- Create: `src/app/(app)/rh/documentos/page.tsx`
- Modify: `src/components/layout/rh-dropdown.tsx`

- [ ] **Step 1: Tabela**

`src/components/rh/documentos/templates-table.tsx`:

```tsx
import Link from "next/link";
import { Edit3, Power, PowerOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toggleTemplateAtivoAction } from "@/lib/actions/templates";
import { DeleteTemplateButton } from "@/components/rh/documentos/delete-template-button";
import type { TemplateRow } from "@/lib/data/templates";

const catLabel: Record<TemplateRow["categoria"], string> = {
  declaracao: "Declaração",
  termo: "Termo",
  contrato: "Contrato",
  outro: "Outro",
};

export function TemplatesTable({ templates }: { templates: TemplateRow[] }) {
  if (templates.length === 0) {
    return (
      <p className="rounded-ui border border-line bg-surface p-6 text-sm text-muted">
        Nenhum template cadastrado. Clique em "Novo template" para começar.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-ui border border-line bg-surface">
      <table className="w-full text-sm">
        <thead className="bg-paper text-left text-xs uppercase tracking-kicker text-ink/55">
          <tr>
            <th className="px-4 py-3">Nome</th>
            <th className="px-4 py-3">Categoria</th>
            <th className="px-4 py-3 text-right">Gerados</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3 text-right">Ações</th>
          </tr>
        </thead>
        <tbody>
          {templates.map((t) => {
            const rascunho = (t.mappings ?? []).length === 0;
            return (
              <tr key={t.id} className="border-t border-line align-middle">
                <td className="px-4 py-3">
                  <Link href={`/rh/documentos/${t.id}`} className="font-semibold text-ink hover:underline">
                    {t.nome}
                  </Link>
                </td>
                <td className="px-4 py-3 text-muted">{catLabel[t.categoria]}</td>
                <td className="px-4 py-3 text-right tabular-nums">{t.gerado_count.toLocaleString("pt-BR")}</td>
                <td className="px-4 py-3">
                  {rascunho ? (
                    <Badge tone="gold">Rascunho</Badge>
                  ) : t.ativo ? (
                    <Badge tone="green">Ativo</Badge>
                  ) : (
                    <Badge tone="gray">Inativo</Badge>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    <Link
                      href={`/rh/documentos/${t.id}`}
                      className="inline-flex items-center gap-1 rounded-ui border border-line bg-surface px-2.5 py-1 text-xs font-semibold text-ink hover:bg-muted/60"
                    >
                      <Edit3 size={12} /> Editar
                    </Link>
                    <form action={toggleTemplateAtivoAction}>
                      <input type="hidden" name="template_id" value={t.id} />
                      <input type="hidden" name="ativo" value={t.ativo ? "0" : "1"} />
                      <button
                        type="submit"
                        className="inline-flex items-center gap-1 rounded-ui border border-line bg-surface px-2.5 py-1 text-xs font-semibold text-ink hover:bg-muted/60"
                      >
                        {t.ativo ? <><PowerOff size={12} /> Desativar</> : <><Power size={12} /> Ativar</>}
                      </button>
                    </form>
                    {t.gerado_count === 0 && (
                      <DeleteTemplateButton templateId={t.id} nome={t.nome} />
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 2: Delete button (client component com confirm)**

`src/components/rh/documentos/delete-template-button.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteTemplateAction } from "@/lib/actions/templates";

export function DeleteTemplateButton({ templateId, nome }: { templateId: string; nome: string }) {
  const [pending, setPending] = useState(false);

  async function onSubmit(formData: FormData) {
    if (!confirm(`Excluir template "${nome}"? Esta ação é permanente.`)) return;
    setPending(true);
    try {
      await deleteTemplateAction(formData);
      toast.success("Template excluído.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao excluir.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form action={onSubmit}>
      <input type="hidden" name="template_id" value={templateId} />
      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center gap-1 rounded-ui border border-clay/30 bg-clay/5 px-2.5 py-1 text-xs font-semibold text-clay hover:bg-clay/10 disabled:opacity-50"
      >
        <Trash2 size={12} /> Excluir
      </button>
    </form>
  );
}
```

- [ ] **Step 3: Página de lista**

`src/app/(app)/rh/documentos/page.tsx`:

```tsx
import { Plus } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { requireSession } from "@/lib/auth/session";
import { listTemplates, type TemplateRow } from "@/lib/data/templates";
import { TemplatesTable } from "@/components/rh/documentos/templates-table";

const CATEGORIAS = ["declaracao", "termo", "contrato", "outro"] as const;

export default async function DocumentosPage({
  searchParams,
}: {
  searchParams: Promise<{ categoria?: string; status?: string }>;
}) {
  const session = await requireSession();
  const params = await searchParams;
  const categoria = (CATEGORIAS as readonly string[]).includes(params.categoria ?? "")
    ? (params.categoria as TemplateRow["categoria"])
    : undefined;
  const status = params.status === "ativo" || params.status === "inativo" ? params.status : "todos";

  const templates = await listTemplates(session.profile.escola_id, { categoria, status });

  return (
    <div className="grid gap-6">
      <PageHeader
        breadcrumb={[{ label: "RH", href: "/rh" }, { label: "Documentos" }]}
        title="Templates de documentos"
        counter={templates.length.toLocaleString("pt-BR")}
        description="Gerencie modelos .docx parametrizáveis usados na ficha do aluno."
        actions={
          <ButtonLink href="/rh/documentos/novo" variant="primary">
            <Plus size={14} /> Novo template
          </ButtonLink>
        }
      />

      <form className="flex flex-wrap items-center gap-3 text-sm">
        <label className="flex items-center gap-2">
          Categoria
          <select name="categoria" defaultValue={categoria ?? ""} className="rounded-ui border border-line bg-surface px-3 py-1.5 text-sm">
            <option value="">Todas</option>
            <option value="declaracao">Declaração</option>
            <option value="termo">Termo</option>
            <option value="contrato">Contrato</option>
            <option value="outro">Outro</option>
          </select>
        </label>
        <label className="flex items-center gap-2">
          Status
          <select name="status" defaultValue={status} className="rounded-ui border border-line bg-surface px-3 py-1.5 text-sm">
            <option value="todos">Todos</option>
            <option value="ativo">Ativos</option>
            <option value="inativo">Inativos</option>
          </select>
        </label>
        <button className="ds-button ds-button-secondary">Filtrar</button>
      </form>

      <TemplatesTable templates={templates} />
    </div>
  );
}
```

- [ ] **Step 4: Item de menu RH**

Modify `src/components/layout/rh-dropdown.tsx`. Linha:

```ts
import { Briefcase, Building2, UsersRound, Wallet, SlidersHorizontal, ChevronDown } from "lucide-react";
```

passa a:

```ts
import { Briefcase, Building2, UsersRound, Wallet, SlidersHorizontal, ChevronDown, FileText } from "lucide-react";
```

E o array `rhItems`:

```ts
const rhItems = [
  { href: "/rh/empresas", label: "Empresas", icon: Building2 },
  { href: "/rh/funcionarios", label: "Funcionários", icon: UsersRound },
  { href: "/rh/folha", label: "Folha", icon: Wallet },
  { href: "/rh/brackets", label: "Brackets", icon: SlidersHorizontal },
  { href: "/rh/documentos", label: "Documentos", icon: FileText }
];
```

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: zero new errors.

- [ ] **Step 6: Commit**

```
git add src/components/rh/documentos/templates-table.tsx src/components/rh/documentos/delete-template-button.tsx src/app/(app)/rh/documentos/page.tsx src/components/layout/rh-dropdown.tsx
git commit -m "feat(rh): lista de templates + item no menu RH"
```

---

## Task 10: Wizard step 1 — upload + metadata

**Files:**
- Create: `src/components/rh/documentos/template-meta-form.tsx`
- Create: `src/app/(app)/rh/documentos/novo/page.tsx`

- [ ] **Step 1: Meta form**

`src/components/rh/documentos/template-meta-form.tsx`:

```tsx
import { uploadTemplateAction } from "@/lib/actions/templates";

export function TemplateMetaForm() {
  return (
    <form
      action={uploadTemplateAction}
      encType="multipart/form-data"
      className="grid max-w-2xl gap-4 rounded-ui border border-line bg-surface p-6"
    >
      <label className="grid gap-1 text-sm">
        <span className="font-semibold text-ink">Arquivo .docx</span>
        <input
          type="file"
          name="arquivo"
          accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          required
        />
        <span className="text-xs text-muted">Máx. 5 MB. Use placeholders no formato {`{NOME_ALUNO}`}.</span>
      </label>

      <label className="grid gap-1 text-sm">
        <span className="font-semibold text-ink">Nome</span>
        <input name="nome" required minLength={3} maxLength={120} placeholder="Ex.: Declaração de Matrícula 2027" />
      </label>

      <label className="grid gap-1 text-sm">
        <span className="font-semibold text-ink">Categoria</span>
        <select name="categoria" required defaultValue="declaracao">
          <option value="declaracao">Declaração</option>
          <option value="termo">Termo</option>
          <option value="contrato">Contrato</option>
          <option value="outro">Outro</option>
        </select>
      </label>

      <div className="flex justify-end gap-2">
        <a href="/rh/documentos" className="ds-button ds-button-secondary">Cancelar</a>
        <button type="submit" className="ds-button ds-button-primary">Próximo</button>
      </div>
    </form>
  );
}
```

- [ ] **Step 2: Página**

`src/app/(app)/rh/documentos/novo/page.tsx`:

```tsx
import { PageHeader } from "@/components/ui/page-header";
import { requireSession } from "@/lib/auth/session";
import { TemplateMetaForm } from "@/components/rh/documentos/template-meta-form";

export default async function NovoTemplatePage() {
  await requireSession();
  return (
    <div className="grid gap-6">
      <PageHeader
        breadcrumb={[{ label: "RH", href: "/rh" }, { label: "Documentos", href: "/rh/documentos" }, { label: "Novo" }]}
        title="Novo template"
        description="Faça upload do .docx e informe metadados. O próximo passo é mapear os placeholders."
      />
      <TemplateMetaForm />
    </div>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: zero new errors.

- [ ] **Step 4: Commit**

```
git add src/components/rh/documentos/template-meta-form.tsx src/app/(app)/rh/documentos/novo/page.tsx
git commit -m "feat(rh): wizard step 1 (upload + metadata) de templates"
```

---

## Task 11: Wizard step 2 — mapping form (client + page)

**Files:**
- Create: `src/components/rh/documentos/mapping-form.tsx`
- Create: `src/app/(app)/rh/documentos/[id]/mapeamento/page.tsx`

- [ ] **Step 1: Client form**

`src/components/rh/documentos/mapping-form.tsx`:

```tsx
"use client";

import { useMemo, useState } from "react";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { saveTemplateMappingsAction } from "@/lib/actions/templates";
import { ALLOWED_TABLES, COMPUTED_FNS, type Mapping } from "@/lib/documents/schema-catalog";

type RowState =
  | { placeholder: string; type: "tabela"; table: string; column: string; filter: string }
  | { placeholder: string; type: "computed"; fn: string };

const TABLES = Object.keys(ALLOWED_TABLES);

function toRow(m: Mapping): RowState {
  if (m.type === "computed") return { placeholder: m.placeholder, type: "computed", fn: m.fn };
  return { placeholder: m.placeholder, type: "tabela", table: m.table, column: m.column, filter: m.filter ?? "" };
}

function toMapping(r: RowState): Mapping | null {
  if (r.type === "computed") {
    if (!(COMPUTED_FNS as readonly string[]).includes(r.fn)) return null;
    return { placeholder: r.placeholder, type: "computed", fn: r.fn as Mapping & { type: "computed" } extends infer T ? T extends { fn: infer F } ? F : never : never };
  }
  if (!ALLOWED_TABLES[r.table]) return null;
  if (!ALLOWED_TABLES[r.table].columns.includes(r.column)) return null;
  const filter = r.filter || null;
  if (filter && !ALLOWED_TABLES[r.table].filters.includes(filter as never)) return null;
  return { placeholder: r.placeholder, type: "tabela", table: r.table, column: r.column, filter };
}

export function MappingForm({
  templateId,
  initial,
  placeholders,
  activate,
}: {
  templateId: string;
  initial: Mapping[];
  placeholders: string[];
  activate: boolean;
}) {
  // Combina placeholders detectados no .docx com qualquer mapping existente.
  const initialRows: RowState[] = useMemo(() => {
    const byName = new Map(initial.map((m) => [m.placeholder, m]));
    const merged: RowState[] = placeholders.map((ph) => {
      const existing = byName.get(ph);
      return existing
        ? toRow(existing)
        : { placeholder: ph, type: "tabela", table: "alunos", column: "nome", filter: "" };
    });
    // Inclui também mappings antigos para placeholders que não estão mais no template — para auditar.
    for (const [ph, m] of byName) {
      if (!placeholders.includes(ph)) merged.push(toRow(m));
    }
    return merged;
  }, [initial, placeholders]);

  const [rows, setRows] = useState<RowState[]>(initialRows);
  const [pending, setPending] = useState(false);

  function updateRow(idx: number, patch: Partial<RowState>) {
    setRows((prev) => {
      const next = [...prev];
      const cur = next[idx] as RowState;
      // Switching type resets the type-specific fields.
      if (patch.type && patch.type !== cur.type) {
        if (patch.type === "computed") {
          next[idx] = { placeholder: cur.placeholder, type: "computed", fn: COMPUTED_FNS[0] };
        } else {
          next[idx] = { placeholder: cur.placeholder, type: "tabela", table: "alunos", column: "nome", filter: "" };
        }
        return next;
      }
      next[idx] = { ...cur, ...patch } as RowState;
      return next;
    });
  }

  async function onSave() {
    setPending(true);
    try {
      const mappings: Mapping[] = [];
      for (const r of rows) {
        const m = toMapping(r);
        if (!m) {
          toast.error(`Mapping inválido para ${r.placeholder}.`);
          return;
        }
        mappings.push(m);
      }
      const fd = new FormData();
      fd.set("template_id", templateId);
      fd.set("mappings", JSON.stringify(mappings));
      if (activate) fd.set("ativar", "1");
      await saveTemplateMappingsAction(fd);
      toast.success("Mappings salvos.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao salvar.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid gap-4">
      <p className="text-sm text-muted">
        {placeholders.length} placeholders detectados no template.
      </p>

      <div className="overflow-hidden rounded-ui border border-line bg-surface">
        <table className="w-full text-sm">
          <thead className="bg-paper text-left text-xs uppercase tracking-kicker text-ink/55">
            <tr>
              <th className="px-3 py-2">Placeholder</th>
              <th className="px-3 py-2">Tipo</th>
              <th className="px-3 py-2">Origem</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => (
              <tr key={r.placeholder + idx} className="border-t border-line align-top">
                <td className="px-3 py-2 font-mono text-xs">{r.placeholder}</td>
                <td className="px-3 py-2">
                  <select
                    value={r.type}
                    onChange={(e) => updateRow(idx, { type: e.target.value as RowState["type"] })}
                    className="rounded-ui border border-line bg-surface px-2 py-1 text-xs"
                  >
                    <option value="tabela">tabela</option>
                    <option value="computed">computed</option>
                  </select>
                </td>
                <td className="px-3 py-2">
                  {r.type === "tabela" ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="text-xs text-muted">Tabela</label>
                      <select
                        value={r.table}
                        onChange={(e) => updateRow(idx, { table: e.target.value, column: ALLOWED_TABLES[e.target.value].columns[0], filter: "" })}
                        className="rounded-ui border border-line bg-surface px-2 py-1 text-xs"
                      >
                        {TABLES.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                      <label className="text-xs text-muted">Coluna</label>
                      <select
                        value={r.column}
                        onChange={(e) => updateRow(idx, { column: e.target.value })}
                        className="rounded-ui border border-line bg-surface px-2 py-1 text-xs"
                      >
                        {ALLOWED_TABLES[r.table].columns.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                      {ALLOWED_TABLES[r.table].filters.length > 0 && (
                        <>
                          <label className="text-xs text-muted">Filtro</label>
                          <select
                            value={r.filter}
                            onChange={(e) => updateRow(idx, { filter: e.target.value })}
                            className="rounded-ui border border-line bg-surface px-2 py-1 text-xs"
                          >
                            <option value="">— sem filtro —</option>
                            {ALLOWED_TABLES[r.table].filters.map((f) => <option key={f} value={f}>{f}</option>)}
                          </select>
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-muted">Função</label>
                      <select
                        value={r.fn}
                        onChange={(e) => updateRow(idx, { fn: e.target.value })}
                        className="rounded-ui border border-line bg-surface px-2 py-1 text-xs"
                      >
                        {COMPUTED_FNS.map((f) => <option key={f} value={f}>{f}</option>)}
                      </select>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end gap-2">
        <a href="/rh/documentos" className="ds-button ds-button-secondary">Cancelar</a>
        <button onClick={onSave} disabled={pending} className="ds-button ds-button-primary">
          <Save size={14} /> {activate ? "Salvar e ativar" : "Salvar"}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Página de mapeamento**

`src/app/(app)/rh/documentos/[id]/mapeamento/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { requireSession } from "@/lib/auth/session";
import { createServerClient } from "@/lib/supabase/server";
import { getTemplate } from "@/lib/data/templates";
import { extractPlaceholders } from "@/lib/documents/placeholders";
import { MappingForm } from "@/components/rh/documentos/mapping-form";

export default async function MapeamentoPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id } = await params;
  const tpl = await getTemplate(id, session.profile.escola_id);
  if (!tpl) notFound();

  const supabase = await createServerClient();
  const { data: dl } = await supabase.storage.from("templates-documentos").download(tpl.storage_path);
  let placeholders: string[] = [];
  if (dl) {
    const buf = Buffer.from(await dl.arrayBuffer());
    placeholders = extractPlaceholders(buf);
  }

  return (
    <div className="grid gap-6">
      <PageHeader
        breadcrumb={[
          { label: "RH", href: "/rh" },
          { label: "Documentos", href: "/rh/documentos" },
          { label: tpl.nome, href: `/rh/documentos/${tpl.id}` },
          { label: "Mapeamento" },
        ]}
        title={`Mapear placeholders — ${tpl.nome}`}
        description="Diga ao sistema de onde vem cada valor do template."
      />
      <MappingForm
        templateId={tpl.id}
        initial={tpl.mappings}
        placeholders={placeholders}
        activate={true}
      />
    </div>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: zero new errors.

- [ ] **Step 4: Commit**

```
git add src/components/rh/documentos/mapping-form.tsx src/app/(app)/rh/documentos/[id]/mapeamento/page.tsx
git commit -m "feat(rh): wizard step 2 (mapping form) de templates"
```

---

## Task 12: Page de edit (nome/categoria) + reaproveita mapeamento

**Files:**
- Create: `src/app/(app)/rh/documentos/[id]/page.tsx`

- [ ] **Step 1: Página de edit**

```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/card";
import { requireSession } from "@/lib/auth/session";
import { createServerClient } from "@/lib/supabase/server";
import { getTemplate } from "@/lib/data/templates";
import { extractPlaceholders } from "@/lib/documents/placeholders";
import { updateTemplateAction, toggleTemplateAtivoAction } from "@/lib/actions/templates";
import { MappingForm } from "@/components/rh/documentos/mapping-form";
import { DeleteTemplateButton } from "@/components/rh/documentos/delete-template-button";

export default async function EditTemplatePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id } = await params;
  const tpl = await getTemplate(id, session.profile.escola_id);
  if (!tpl) notFound();

  const supabase = await createServerClient();
  const { data: dl } = await supabase.storage.from("templates-documentos").download(tpl.storage_path);
  let placeholders: string[] = [];
  if (dl) {
    const buf = Buffer.from(await dl.arrayBuffer());
    placeholders = extractPlaceholders(buf);
  }

  return (
    <div className="grid gap-6">
      <PageHeader
        breadcrumb={[
          { label: "RH", href: "/rh" },
          { label: "Documentos", href: "/rh/documentos" },
          { label: tpl.nome },
        ]}
        title={tpl.nome}
        description={`Categoria: ${tpl.categoria} · Gerados: ${tpl.gerado_count.toLocaleString("pt-BR")}`}
      />

      <Panel className="grid max-w-2xl gap-4">
        <h2 className="font-serif text-xl text-ink">Metadados</h2>
        <form action={updateTemplateAction} className="grid gap-3">
          <input type="hidden" name="template_id" value={tpl.id} />
          <label className="grid gap-1 text-sm">
            Nome
            <input name="nome" defaultValue={tpl.nome} required minLength={3} maxLength={120} />
          </label>
          <label className="grid gap-1 text-sm">
            Categoria
            <select name="categoria" defaultValue={tpl.categoria}>
              <option value="declaracao">Declaração</option>
              <option value="termo">Termo</option>
              <option value="contrato">Contrato</option>
              <option value="outro">Outro</option>
            </select>
          </label>
          <div className="flex justify-end">
            <button className="ds-button ds-button-primary">Salvar metadados</button>
          </div>
        </form>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4">
          <form action={toggleTemplateAtivoAction}>
            <input type="hidden" name="template_id" value={tpl.id} />
            <input type="hidden" name="ativo" value={tpl.ativo ? "0" : "1"} />
            <button className="ds-button ds-button-secondary">
              {tpl.ativo ? "Desativar" : "Ativar"}
            </button>
          </form>
          {tpl.gerado_count === 0 && <DeleteTemplateButton templateId={tpl.id} nome={tpl.nome} />}
          <Link href={`/rh/documentos/${tpl.id}/mapeamento`} className="ds-button ds-button-secondary">
            Editar mappings
          </Link>
        </div>
      </Panel>

      <Panel className="grid gap-3">
        <h2 className="font-serif text-xl text-ink">Mappings</h2>
        <MappingForm
          templateId={tpl.id}
          initial={tpl.mappings}
          placeholders={placeholders}
          activate={false}
        />
      </Panel>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: zero new errors.

- [ ] **Step 3: Manual smoke (após seed do Task 13)**

Adiar testes manuais para Task 14 quando todos os caminhos existirem.

- [ ] **Step 4: Commit**

```
git add src/app/(app)/rh/documentos/[id]/page.tsx
git commit -m "feat(rh): edição de template (meta + mappings)"
```

---

## Task 13: Seed dos 6 templates + wiring no aluno/matrícula + cleanup

Este task é a transição: roda o seed, troca os componentes para usarem templates do banco + action v2, apaga o código velho.

**Files:**
- Create: `scripts/seed_templates.mjs`
- Modify: `src/components/students/quick-document-actions.tsx`
- Modify: `src/components/students/student-header-actions.tsx`
- Modify: `src/app/(app)/alunos/[id]/page.tsx`
- Modify: `src/components/matriculas/document-generator.tsx`
- Delete (no fim do task): `src/lib/documents/templates.ts`, `src/lib/documents/variables.ts`, `src/lib/actions/documents-generate.ts`, `public/templates/*.docx`

- [ ] **Step 1: Seed script**

`scripts/seed_templates.mjs`:

```js
#!/usr/bin/env node
// Migra os 6 templates de public/templates/* para o banco/Storage.
// Uso: node scripts/seed_templates.mjs <ESCOLA_ID>
// Requer SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no env.

import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const escolaId = process.argv[2];

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}
if (!escolaId) {
  console.error("Uso: node scripts/seed_templates.mjs <ESCOLA_ID>");
  process.exit(1);
}

const SEED = [
  { arquivo: "contrato-colegio-integrado.docx",        nome: "Contrato — Colégio Integrado",           categoria: "contrato"   },
  { arquivo: "contrato-pinguinho.docx",                nome: "Contrato — Pinguinho de Gente",          categoria: "contrato"   },
  { arquivo: "declaracao-frequencia.docx",             nome: "Declaração de Frequência",               categoria: "declaracao" },
  { arquivo: "declaracao-transferencia.docx",          nome: "Declaração de Transferência",            categoria: "declaracao" },
  { arquivo: "termo-responsabilidade.docx",            nome: "Termo de Responsabilidade — Pinguinho",  categoria: "termo"      },
  { arquivo: "termo-responsabilidade-integrado.docx",  nome: "Termo de Responsabilidade — Integrado",  categoria: "termo"      },
];

const MAPPINGS = [
  { placeholder: "NOME_ALUNO",            type: "tabela",   table: "alunos",              column: "nome",         filter: null         },
  { placeholder: "SERIE_ALUNO",           type: "tabela",   table: "series",              column: "nome",         filter: null         },
  { placeholder: "TURNO_ALUNO",           type: "tabela",   table: "turmas",              column: "turno",        filter: null         },
  { placeholder: "ANO_LETIVO",            type: "tabela",   table: "matriculas",          column: "ano_letivo",   filter: "ativa"      },
  { placeholder: "NOME_PAI_ALUNO",        type: "tabela",   table: "responsaveis_aluno",  column: "nome",         filter: "pai"        },
  { placeholder: "RG_PAI_ALUNO",          type: "tabela",   table: "responsaveis_aluno",  column: "rg",           filter: "pai"        },
  { placeholder: "CPF_PAI_ALUNO",         type: "tabela",   table: "responsaveis_aluno",  column: "cpf",          filter: "pai"        },
  { placeholder: "NOME_MAE_ALUNO",        type: "tabela",   table: "responsaveis_aluno",  column: "nome",         filter: "mae"        },
  { placeholder: "RG_MAE_ALUNO",          type: "tabela",   table: "responsaveis_aluno",  column: "rg",           filter: "mae"        },
  { placeholder: "CPF_MAE_ALUNO",         type: "tabela",   table: "responsaveis_aluno",  column: "cpf",          filter: "mae"        },
  { placeholder: "NOME_RESP",             type: "tabela",   table: "responsaveis_aluno",  column: "nome",         filter: "financeiro" },
  { placeholder: "CPF_RESP",              type: "tabela",   table: "responsaveis_aluno",  column: "cpf",          filter: "financeiro" },
  { placeholder: "RG_RESP",               type: "tabela",   table: "responsaveis_aluno",  column: "rg",           filter: "financeiro" },
  { placeholder: "EMAIL_RESPONSAVEL",     type: "tabela",   table: "responsaveis_aluno",  column: "email",        filter: "financeiro" },
  { placeholder: "CELULAR_RESPONSAVEL",   type: "tabela",   table: "responsaveis_aluno",  column: "celular",      filter: "financeiro" },
  { placeholder: "TIPOENSINO_ALUNO",      type: "computed", fn: "tipo_ensino_via_series_segmentos" },
  { placeholder: "ENDERECO_PAI_ALUNO",    type: "computed", fn: "endereco_principal_formatado"     },
  { placeholder: "ENDERECO_MAE_ALUNO",    type: "computed", fn: "endereco_principal_formatado"     },
  { placeholder: "ENDERECO_RESP",         type: "computed", fn: "endereco_principal_formatado"     },
  { placeholder: "RAZAO_SOCIAL_EMPRESA",  type: "tabela",   table: "escolas",             column: "nome",         filter: null         },
  { placeholder: "FANTASIA_EMPRESA",      type: "tabela",   table: "escolas",             column: "nome",         filter: null         },
  { placeholder: "CIDADE_DATA_EXTENSO",   type: "computed", fn: "cidade_data_extenso"   },
  { placeholder: "DATA_HOJE_EXTENSO",     type: "computed", fn: "data_hoje_extenso"     },
];

const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

async function main() {
  const dir = join(process.cwd(), "public", "templates");
  const files = new Set(await readdir(dir));

  for (const seed of SEED) {
    if (!files.has(seed.arquivo)) {
      console.warn(`Pulando ${seed.arquivo} (não encontrado em public/templates).`);
      continue;
    }
    const buffer = await readFile(join(dir, seed.arquivo));
    const id = randomUUID();
    const storagePath = `${escolaId}/templates/${id}.docx`;

    const { error: upErr } = await sb.storage.from("templates-documentos").upload(storagePath, buffer, {
      contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      upsert: false,
    });
    if (upErr) { console.error(`Storage falhou para ${seed.arquivo}:`, upErr.message); continue; }

    const { error: insErr } = await sb.from("templates_documentos").insert({
      id, escola_id: escolaId, nome: seed.nome, categoria: seed.categoria,
      storage_path: storagePath, ativo: true, mappings: MAPPINGS,
    });
    if (insErr) {
      console.error(`Insert falhou para ${seed.arquivo}:`, insErr.message);
      await sb.storage.from("templates-documentos").remove([storagePath]);
      continue;
    }
    console.log(`✓ ${seed.nome}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Rodar seed**

Run (PowerShell, com env vars carregadas; substitua `<ESCOLA_ID>` pelo UUID da escola alvo):
```
$env:SUPABASE_URL = "https://<projeto>.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY = "<service_role_key>"
node scripts/seed_templates.mjs <ESCOLA_ID>
```
Expected: 6 linhas `✓ ...`.

Validar:
```
npx supabase db query "select count(*) from public.templates_documentos where escola_id = '<ESCOLA_ID>';"
```
Expected: `6`.

- [ ] **Step 3: Refactor QuickDocumentActions**

Substitua `src/components/students/quick-document-actions.tsx` por:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, FileText, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button, ButtonLink } from "@/components/ui/button";
import { generateFromTemplateAction } from "@/lib/actions/documents-generate-v2";
import { downloadBase64Docx } from "@/lib/documents/download-client";

type MatriculaAtiva = { id: string; codigo: string | null };
type TemplateLite = { id: string; nome: string };

type Props = {
  alunoId: string;
  matriculaAtiva: MatriculaAtiva | null;
  templates: TemplateLite[];
  onExportFichaPdf?: () => void;
};

export function QuickDocumentActions({ alunoId, matriculaAtiva, templates, onExportFichaPdf }: Props) {
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setDropdownOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  async function handleGerar(templateId: string) {
    if (!matriculaAtiva) return;
    if (loadingId) return;
    setLoadingId(templateId);
    try {
      const res = await generateFromTemplateAction(matriculaAtiva.id, templateId);
      if (!res.success || !res.base64 || !res.nomeArquivo) {
        toast.error(res.error ?? "Erro ao gerar documento.");
        return;
      }
      try {
        downloadBase64Docx(res.base64, res.nomeArquivo);
      } catch {
        toast.error("Documento gerado no servidor, mas falha ao iniciar download.");
        return;
      }
      toast.success(`Documento gerado: ${res.nomeArquivo}`);
    } catch {
      toast.error("Erro inesperado ao gerar documento.");
    } finally {
      setLoadingId(null);
      setDropdownOpen(false);
    }
  }

  if (!matriculaAtiva) {
    return (
      <ButtonLink href={`/matriculas?aluno_id=${alunoId}`} variant="primary" className="gap-1">
        <Plus size={14} />
        Matricular aluno
      </ButtonLink>
    );
  }

  const quick = templates.slice(0, 3);
  const more = templates.slice(3);

  if (templates.length === 0) {
    return (
      <ButtonLink href="/rh/documentos/novo" variant="secondary" className="gap-1">
        <Plus size={14} /> Configurar templates
      </ButtonLink>
    );
  }

  return (
    <div
      ref={containerRef}
      className="flex flex-wrap items-center gap-1.5 rounded-ui border border-gold/40 bg-surface px-2.5 py-1.5"
    >
      <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted">Gerar:</span>
      {quick.map((t) => (
        <Button
          key={t.id}
          variant="accent"
          onClick={() => handleGerar(t.id)}
          disabled={loadingId !== null}
          className="!py-1.5 !px-2.5 text-xs"
        >
          {loadingId === t.id ? <Loader2 size={12} className="animate-spin" /> : <FileText size={12} />}
          {t.nome}
        </Button>
      ))}
      {(more.length > 0 || onExportFichaPdf) && (
        <div className="relative">
          <Button
            variant="secondary"
            onClick={() => setDropdownOpen((v) => !v)}
            disabled={loadingId !== null}
            aria-haspopup="true"
            aria-expanded={dropdownOpen}
            aria-label="Mais documentos"
            className="!py-1.5 !px-2.5 text-xs"
          >
            Mais
            <ChevronDown size={12} />
          </Button>
          {dropdownOpen && (
            <div
              role="menu"
              aria-label="Mais documentos"
              className="absolute right-0 top-full z-20 mt-1 w-72 rounded-ui border border-line bg-surface p-1.5 shadow-soft"
            >
              <p className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-muted">
                Mais documentos
              </p>
              {more.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="menuitem"
                  onClick={() => handleGerar(t.id)}
                  disabled={loadingId !== null}
                  className="flex w-full items-center gap-2 rounded-ui px-2.5 py-2 text-left text-sm text-ink hover:bg-muted/60 disabled:opacity-50"
                >
                  {loadingId === t.id ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} className="text-moss" />}
                  {t.nome}
                </button>
              ))}
              {onExportFichaPdf && (
                <>
                  <div className="my-1 border-t border-line" />
                  <button
                    type="button"
                    role="menuitem"
                    disabled={loadingId !== null}
                    onClick={() => { setDropdownOpen(false); onExportFichaPdf(); }}
                    className="flex w-full items-center gap-2 rounded-ui px-2.5 py-2 text-left text-sm italic text-muted hover:bg-muted/60 disabled:opacity-50"
                  >
                    ⬇ Exportar ficha (PDF)
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Refactor StudentHeaderActions**

Substitua `src/components/students/student-header-actions.tsx` por:

```tsx
"use client";

import { exportStudentPdf } from "@/components/pdf/export-student-button";
import { QuickDocumentActions } from "@/components/students/quick-document-actions";
import type { StudentSheet } from "@/lib/types";

type MatriculaAtiva = { id: string; codigo: string | null };
type TemplateLite = { id: string; nome: string };

export function StudentHeaderActions({
  student,
  matriculaAtiva,
  templates,
}: {
  student: StudentSheet;
  matriculaAtiva: MatriculaAtiva | null;
  templates: TemplateLite[];
}) {
  return (
    <QuickDocumentActions
      alunoId={student.id}
      matriculaAtiva={matriculaAtiva}
      templates={templates}
      onExportFichaPdf={() => exportStudentPdf(student)}
    />
  );
}
```

- [ ] **Step 5: Wire na ficha do aluno**

Modify `src/app/(app)/alunos/[id]/page.tsx`. Adicione:

```tsx
import { requireSession } from "@/lib/auth/session";
import { getTemplatesAtivos } from "@/lib/data/templates";
```

Dentro da função, antes do return, troque a chamada que existe para também carregar templates:

```tsx
const session = await requireSession();
const templatesAtivos = await getTemplatesAtivos(session.profile.escola_id);
const templatesLite = templatesAtivos.map((t) => ({ id: t.id, nome: t.nome }));
```

E passe `templates={templatesLite}` para o `<StudentHeaderActions>`:

```tsx
<StudentHeaderActions student={student} matriculaAtiva={matriculaAtivaPayload} templates={templatesLite} />
```

- [ ] **Step 6: Refactor DocumentGenerator (tab matrículas)**

Substitua `src/components/matriculas/document-generator.tsx`:

```tsx
"use client";

import { useState } from "react";
import { FileText, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/card";
import { generateFromTemplateAction } from "@/lib/actions/documents-generate-v2";
import { downloadBase64Docx } from "@/lib/documents/download-client";
import type { StudentDocument } from "@/lib/data/documents";

type TemplateLite = { id: string; nome: string; categoria: string };

function sizeLabel(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR");
}

interface Props {
  matriculaId: string;
  templates: TemplateLite[];
  documentosIniciais: StudentDocument[];
}

export function DocumentGenerator({ matriculaId, templates, documentosIniciais }: Props) {
  const [templateId, setTemplateId] = useState<string>(templates[0]?.id ?? "");
  const [loading, setLoading] = useState(false);
  const [documentos, setDocumentos] = useState<StudentDocument[]>(documentosIniciais);

  async function handleGerar() {
    if (!templateId) return;
    setLoading(true);
    try {
      const res = await generateFromTemplateAction(matriculaId, templateId);
      if (!res.success || !res.base64 || !res.nomeArquivo) {
        toast.error(res.error ?? "Erro ao gerar documento.");
        return;
      }
      downloadBase64Docx(res.base64, res.nomeArquivo);
      toast.success(`Documento gerado: ${res.nomeArquivo}`);

      const r = await fetch(`/api/matriculas/${matriculaId}/documentos`);
      if (r.ok) setDocumentos(await r.json());
    } finally {
      setLoading(false);
    }
  }

  return (
    <Panel className="grid gap-5">
      <h2 className="font-serif text-2xl text-ink">Documentos</h2>

      {templates.length === 0 ? (
        <p className="text-sm text-muted">Nenhum template ativo. Cadastre em RH → Documentos.</p>
      ) : (
        <div className="flex flex-wrap items-end gap-3">
          <label className="grid gap-1 text-sm">
            <span className="text-muted">Template</span>
            <select
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              className="rounded-ui border border-line bg-surface px-3 py-2 text-sm text-ink"
              disabled={loading}
            >
              {templates.map((t) => (
                <option key={t.id} value={t.id}>{t.nome}</option>
              ))}
            </select>
          </label>
          <Button variant="accent" onClick={handleGerar} disabled={loading || !templateId}>
            {loading ? (<><Loader2 size={16} className="animate-spin" /> Gerando...</>) : "Baixar .docx"}
          </Button>
        </div>
      )}

      {documentos.length > 0 && (
        <div className="grid gap-2">
          <p className="text-sm font-semibold text-ink">Documentos gerados</p>
          {documentos.map((doc) => (
            <article key={doc.id} className="flex items-center justify-between gap-3 border-b border-line py-3 last:border-b-0">
              <div className="flex items-start gap-3">
                <FileText className="mt-0.5 shrink-0 text-moss" size={18} />
                <div>
                  <strong className="block text-sm text-ink">{doc.nome_arquivo}</strong>
                  <span className="text-xs text-muted">
                    {formatDate(doc.created_at)} · {sizeLabel(doc.tamanho_bytes)}
                  </span>
                </div>
              </div>
              {doc.signed_url && (
                <a href={doc.signed_url} target="_blank" rel="noreferrer" className="flex shrink-0 items-center gap-1 text-sm font-bold text-brand">
                  <Download size={14} /> Baixar
                </a>
              )}
            </article>
          ))}
        </div>
      )}
    </Panel>
  );
}
```

- [ ] **Step 7: Wire na tab matrículas**

Modify `src/app/(app)/matriculas/[id]/page.tsx`. Onde o componente é montado, atualize para carregar templates ativos e passar:

Encontre:
```tsx
{tab === "documentos" && (
  <DocumentGenerator matriculaId={id} documentosIniciais={documentos} />
)}
```

Adicione no topo do arquivo (perto dos outros imports):
```tsx
import { requireSession } from "@/lib/auth/session";
import { getTemplatesAtivos } from "@/lib/data/templates";
```

Antes do return, com o demais `Promise.all`, adicione:
```tsx
const session = await requireSession();
const templatesAtivos = await getTemplatesAtivos(session.profile.escola_id);
const templatesLite = templatesAtivos.map((t) => ({ id: t.id, nome: t.nome, categoria: t.categoria }));
```

Substitua o uso pelo:
```tsx
{tab === "documentos" && (
  <DocumentGenerator matriculaId={id} templates={templatesLite} documentosIniciais={documentos} />
)}
```

- [ ] **Step 8: Typecheck + smoke rápido**

Run:
```
npm run typecheck
```
Expected: zero errors.

Run dev server:
```
npm run dev
```

Smoke rápido: abra um aluno com matrícula ativa, verifique que os 3 templates mais "gerados" aparecem como quick e os 3 demais no dropdown. Gere um e veja o `.docx` baixar + badge "Gerado" em documentos anexados. Pare o dev server.

- [ ] **Step 9: Cleanup do código antigo**

Delete os seguintes arquivos:

```
src/lib/documents/templates.ts
src/lib/documents/variables.ts
src/lib/actions/documents-generate.ts
public/templates/contrato-colegio-integrado.docx
public/templates/contrato-pinguinho.docx
public/templates/declaracao-frequencia.docx
public/templates/declaracao-transferencia.docx
public/templates/termo-responsabilidade.docx
public/templates/termo-responsabilidade-integrado.docx
```

Run:
```
git rm src/lib/documents/templates.ts src/lib/documents/variables.ts src/lib/actions/documents-generate.ts
git rm public/templates/contrato-colegio-integrado.docx public/templates/contrato-pinguinho.docx public/templates/declaracao-frequencia.docx public/templates/declaracao-transferencia.docx public/templates/termo-responsabilidade.docx public/templates/termo-responsabilidade-integrado.docx
```

Run:
```
npm run typecheck
```
Expected: zero errors. Se algum import ainda referencia os arquivos deletados, atualize aqueles arquivos para usarem a nova action/dados. Esperado nenhum, pois os call-sites foram migrados nas steps anteriores.

Confirmar via grep que nada importa mais o código antigo:
```
git grep -n "lib/documents/templates" -- src
git grep -n "lib/documents/variables" -- src
git grep -n "documents-generate" -- src | grep -v documents-generate-v2
```
Cada comando deve retornar vazio. (Se algum aparecer, atualize e re-rode.)

- [ ] **Step 10: Commit final do task**

```
git add scripts/seed_templates.mjs src/components/students/quick-document-actions.tsx src/components/students/student-header-actions.tsx src/app/(app)/alunos/[id]/page.tsx src/components/matriculas/document-generator.tsx src/app/(app)/matriculas/[id]/page.tsx
git commit -m "feat(documents): migrate to db-backed templates + remove legacy"
```

(Os `git rm`s já foram staged no Step 9; eles entram no mesmo commit.)

---

## Task 14: Smoke test end-to-end

**Files:** nenhum (verificação)

- [ ] **Step 1: Validar lista**

`npm run dev`. Abra `/rh/documentos`.
- Os 6 templates seedados aparecem.
- Cada um tem `Categoria` correta, `Gerados` em 0, `Status` "Ativo".

- [ ] **Step 2: Validar novo template**

`/rh/documentos/novo`. Upload de um `.docx` qualquer (pode reutilizar uma cópia local de `declaracao-frequencia.docx`). Nome "Teste manual", categoria "outro".
- Após submit, redireciona pra `/rh/documentos/<novo-id>/mapeamento`.
- Lista de placeholders detectados aparece.
- Configure mappings (ex.: NOME_ALUNO → alunos.nome, DATA_HOJE_EXTENSO → computed/data_hoje_extenso).
- Clique "Salvar e ativar".
- Redireciona pra `/rh/documentos` e o template aparece com status "Ativo".

- [ ] **Step 3: Validar geração na ficha**

Abra `/alunos/<id>` de aluno com matrícula ativa.
- Existem 3 botões quick + dropdown "Mais ▾".
- Clique em uma das quick. `.docx` baixa. Toast "Documento gerado: ...".
- Em "Documentos anexados" abaixo aparece o novo doc com badge "Gerado".

- [ ] **Step 4: Validar ranking**

Gere o mesmo template 3-4 vezes. Recarregue `/alunos/<id>`.
- O template gerado mais vezes aparece como primeira quick (top 3 por `gerado_count`).

- [ ] **Step 5: Validar tab matrículas**

Abra `/matriculas/<id>?tab=documentos`.
- Dropdown de templates lista os mesmos templates ativos.
- Geração funciona idêntico.

- [ ] **Step 6: Validar sem matrícula ativa**

Para um aluno sem matrícula ativa: a ficha mostra apenas o CTA "➕ Matricular aluno". Comportamento herdado da feature anterior, preservado.

- [ ] **Step 7: Validar desativar / excluir**

- Desativar um template em `/rh/documentos` → reload da ficha do aluno: o template some das quicks/dropdown.
- Reativar.
- Excluir um template seedado (que tem `gerado_count > 0`) → mostra erro "Use Desativar em vez de Excluir".
- Para um template recém-criado e nunca gerado, Excluir funciona.

- [ ] **Step 8: Validar RLS**

Logue como usuário de outra escola (se ambiente permitir): em `/rh/documentos` a lista não inclui templates da escola alheia.

- [ ] **Step 9: Sem commit (nenhum código alterado)**

Se um bug aparecer, abra um fix com mensagem clara e committe.

---

## Self-review summary

- **Spec coverage:**
  - Decisões 1-8 todas mapeadas:
    - Parse automático no upload → Task 7 (uploadTemplateAction) + Task 3 (extractor).
    - Schema dinâmico + allowlist → Task 2.
    - Mapping flexível com filtro → Tasks 2, 4, 11.
    - Top 3 quick → Task 13 (componente lê em ordem `gerado_count desc`).
    - Storage privado + tabela → Task 1.
    - Janela all-time por escola → indexes da Task 1 + ORDER BY na Task 6.
    - Menu RH → Task 9.
  - Schema catalog inclui as 6 fns computed da spec (data_hoje_extenso, cidade_data_extenso, idade_atual, ano_letivo_atual, endereco_principal_formatado, tipo_ensino_via_series_segmentos) → Tasks 2, 4.
  - UI de wizard step 1 + step 2 → Tasks 10, 11.
  - Edit → Task 12.
  - Lista + filtros → Task 9.
  - Seed + migração → Task 13.
  - Cleanup → Task 13.
  - Testing manual → Task 14.

- **Placeholders:** todo código tá presente. Comentário sobre incremento atômico declara ressalva. Não há "TBD" no plan.

- **Type consistency:**
  - `Mapping` definido em Task 2, usado consistentemente em Tasks 4, 6, 7, 8, 11, 12.
  - `TemplateRow` em Task 6, usado em Tasks 9, 12, 13.
  - `MatriculaAtiva = { id, codigo: string | null }` mantém o shape original da feature anterior.
  - `TemplateLite = { id; nome; categoria? }` consistente entre QuickDocumentActions, StudentHeaderActions, DocumentGenerator.
