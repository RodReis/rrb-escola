# Comunicados aos Pais — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que a escola envie comunicados aos responsáveis financeiros via WhatsApp, com imagem opcional, processados em background via Vercel Cron.

**Architecture:** Estende a camada WhatsApp (Frente 3) com envio de mídia. Comunicado cria N linhas `pendente` em `mensagens_whatsapp`; um cron processa em lotes de 30/min. Bucket `comunicados` guarda imagens. Rota de cron protegida por `CRON_SECRET`.

**Tech Stack:** TypeScript, Next.js 14 App Router, Supabase (Postgres + RLS + Storage), Vitest, Vercel Cron, Evolution API.

**Spec:** `docs/superpowers/specs/2026-05-21-comunicados-pais-design.md`
**Branch:** criar `feature/comunicados-pais` a partir de `developer`.

---

## File Structure

**Criar:**
- `supabase/migrations/202605310003_comunicados.sql` — coluna em mensagens_whatsapp, enums, tabela, bucket, RBAC
- `src/lib/comunicados/destinatarios.ts` — resolução de destinatários
- `src/lib/comunicados/destinatarios.test.ts` — testes
- `src/lib/comunicados/processar.ts` — processador de lote
- `src/lib/data/comunicados.ts` — data layer
- `src/lib/actions/comunicados.ts` — server action de criação
- `src/app/api/comunicados/processar/route.ts` — rota do cron
- `src/app/(app)/comunicados/page.tsx` — lista de comunicados
- `src/app/(app)/comunicados/novo/page.tsx` — form de novo comunicado
- `src/app/(app)/comunicados/[id]/page.tsx` — detalhe do comunicado
- `src/components/comunicados/novo-comunicado-form.tsx` — form (client component)

**Modificar:**
- `src/lib/whatsapp/evolution.ts` — adicionar `sendWhatsAppMedia`
- `src/lib/whatsapp/send.ts` — `enviarWhatsApp` aceita `imagemUrl` opcional
- `src/lib/auth/permissions.ts` — registrar módulo `comunicados`
- `src/components/layout/topbar.tsx` — item de menu "Comunicados" em RH
- `vercel.json` — bloco `crons`
- `.env.local` — `CRON_SECRET`

---

## Task 0: Branch

- [ ] **Step 1: Criar a branch a partir de `developer`**

Run:
```bash
git checkout developer
git checkout -b feature/comunicados-pais
```
Expected: `Switched to a new branch 'feature/comunicados-pais'`.

---

## Task 1: Migração — schema de comunicados

Coluna nova em `mensagens_whatsapp`, dois enums, tabela `comunicados`, bucket de Storage, seed RBAC.

**Files:**
- Create: `supabase/migrations/202605310003_comunicados.sql`

- [ ] **Step 1: Criar a migração**

`supabase/migrations/202605310003_comunicados.sql`:

```sql
-- Comunicados aos pais: tabela comunicados + extensão de mensagens_whatsapp + bucket + RBAC

-- 1) Coluna de imagem em mensagens_whatsapp (Frente 3)
alter table mensagens_whatsapp add column if not exists imagem_url text;

-- 2) Enums
do $$ begin
  create type alcance_comunicado as enum ('geral', 'individual');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type status_comunicado as enum ('processando', 'concluido');
exception when duplicate_object then null;
end $$;

-- 3) Tabela comunicados
create table comunicados (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references escolas(id) on delete cascade,
  titulo text not null,
  mensagem text not null,
  imagem_path text,
  alcance alcance_comunicado not null,
  aluno_id uuid references alunos(id) on delete set null,
  status status_comunicado not null default 'processando',
  total_destinatarios integer not null default 0,
  total_enviados integer not null default 0,
  total_falhas integer not null default 0,
  criado_por uuid references perfis(id) on delete set null,
  created_at timestamptz not null default now(),
  concluido_em timestamptz
);

create index comunicados_escola_idx on comunicados (escola_id);
create index comunicados_status_idx on comunicados (status);

alter table comunicados enable row level security;

create policy "comunicados service" on comunicados for all to service_role
  using (true) with check (true);

create policy "comunicados escola" on comunicados for all to authenticated
  using (escola_id = (select escola_id from current_perfil()))
  with check (escola_id = (select escola_id from current_perfil()));

-- 4) Bucket de Storage para imagens de comunicados (privado)
insert into storage.buckets (id, name, public)
values ('comunicados', 'comunicados', false)
on conflict (id) do nothing;

create policy "comunicados bucket read" on storage.objects for select to authenticated
  using (bucket_id = 'comunicados' and exists (select 1 from current_perfil()));

create policy "comunicados bucket write" on storage.objects for insert to authenticated
  with check (bucket_id = 'comunicados' and exists (select 1 from current_perfil()));

create policy "comunicados bucket delete" on storage.objects for delete to authenticated
  using (bucket_id = 'comunicados' and exists (select 1 from current_perfil()));

-- 5) Seed RBAC: módulo comunicados no grupo rh
insert into modulos (codigo, grupo, nome, ordem) values
  ('comunicados', 'rh', 'Comunicados', 34);

insert into role_permissoes (role_codigo, modulo_codigo, pode_ler, pode_criar, pode_editar, pode_deletar)
  values ('admin', 'comunicados', true, true, true, true);
```

- [ ] **Step 2: Aplicar via MCP Supabase**

Aplicar `202605310003_comunicados.sql` no projeto `fljkjhmwnjehsodvqaqk` via MCP `apply_migration` (name: `202605310003_comunicados`).
Expected: `{"success": true}`.

- [ ] **Step 3: Verificar**

Via MCP `execute_sql` no projeto `fljkjhmwnjehsodvqaqk`:

```sql
SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name='comunicados';
SELECT column_name FROM information_schema.columns WHERE table_name='mensagens_whatsapp' AND column_name='imagem_url';
SELECT codigo FROM modulos WHERE codigo='comunicados';
SELECT id FROM storage.buckets WHERE id='comunicados';
```

Expected: `comunicados` (tabela), `imagem_url` (coluna), `comunicados` (módulo), `comunicados` (bucket) — todos retornam 1 linha.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/202605310003_comunicados.sql
git commit -m "feat(comunicados): add comunicados schema, bucket and RBAC"
```

---

## Task 2: Estender camada WhatsApp — envio de mídia

`sendWhatsAppMedia` no cliente Evolution; `enviarWhatsApp` aceita `imagemUrl` opcional.

**Files:**
- Modify: `src/lib/whatsapp/evolution.ts`
- Modify: `src/lib/whatsapp/send.ts`

- [ ] **Step 1: Adicionar `sendWhatsAppMedia` em `evolution.ts`**

Em `src/lib/whatsapp/evolution.ts`, após a função `sendWhatsApp`, adicionar:

```typescript
export async function sendWhatsAppMedia({
  telefone,
  mensagem,
  imagemUrl,
}: {
  telefone: string;
  mensagem: string;
  imagemUrl: string;
}): Promise<EvolutionResult> {
  const config = getConfig();
  if (!config) {
    return { ok: false, reason: "Evolution API não configurada" };
  }

  const endpoint = `${config.url.replace(/\/$/, "")}/message/sendMedia/${config.instance}`;

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: config.apiKey,
      },
      body: JSON.stringify({
        number: telefone,
        mediatype: "image",
        media: imagemUrl,
        caption: mensagem,
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      const texto = await res.text().catch(() => "");
      return { ok: false, reason: `Evolution API HTTP ${res.status}: ${texto.slice(0, 200)}` };
    }

    const json = (await res.json().catch(() => null)) as { key?: { id?: string } } | null;
    const providerMessageId = json?.key?.id ?? "";
    return { ok: true, providerMessageId };
  } catch (err) {
    const reason = err instanceof Error ? err.message : "falha ao enviar";
    return { ok: false, reason };
  }
}
```

- [ ] **Step 2: `enviarWhatsApp` aceita `imagemUrl`**

Em `src/lib/whatsapp/send.ts`:

Atualizar o import do cliente:
```typescript
import { sendWhatsApp, sendWhatsAppMedia } from "./evolution";
```

Adicionar `imagemUrl?` ao tipo `EnviarWhatsAppParams`:
```typescript
export type EnviarWhatsAppParams = {
  telefone: string;
  mensagem: string;
  imagemUrl?: string;
  alunoId?: string;
  referenciaTipo?: string;
  referenciaId?: string;
};
```

No insert do log `pendente`, incluir o campo `imagem_url`:
```typescript
  const { data: log, error: logErr } = await supabase
    .from("mensagens_whatsapp")
    .insert({
      escola_id: DEFAULT_SCHOOL_ID,
      telefone: telefoneNormalizado,
      mensagem: params.mensagem,
      status: "pendente",
      imagem_url: params.imagemUrl ?? null,
      aluno_id: params.alunoId ?? null,
      referencia_tipo: params.referenciaTipo ?? null,
      referencia_id: params.referenciaId ?? null,
    })
    .select("id")
    .single();
```

E substituir a chamada `const resultado = await sendWhatsApp({...})` por:
```typescript
  const resultado = params.imagemUrl
    ? await sendWhatsAppMedia({
        telefone: telefoneNormalizado,
        mensagem: params.mensagem,
        imagemUrl: params.imagemUrl,
      })
    : await sendWhatsApp({
        telefone: telefoneNormalizado,
        mensagem: params.mensagem,
      });
```

No insert do log de telefone inválido, incluir também `imagem_url: params.imagemUrl ?? null`.

- [ ] **Step 3: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
git add src/lib/whatsapp/evolution.ts src/lib/whatsapp/send.ts
git commit -m "feat(whatsapp): add media sending to messaging layer"
```

---

## Task 3: Resolução de destinatários

`resolverDestinatarios` — dado o alcance, retorna os responsáveis financeiros (com celular válido) que devem receber o comunicado.

**Files:**
- Create: `src/lib/comunicados/destinatarios.ts`
- Create: `src/lib/comunicados/destinatarios.test.ts`

- [ ] **Step 1: Escrever o teste**

A função tem uma parte pura (filtrar/mapear linhas) e uma parte de I/O (query Supabase).
Testamos a parte pura: `filtrarDestinatarios` recebe linhas cruas e retorna a lista limpa.

`src/lib/comunicados/destinatarios.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { filtrarDestinatarios } from "./destinatarios";

describe("filtrarDestinatarios", () => {
  it("inclui aluno com responsável financeiro e celular", () => {
    const linhas = [
      {
        id: "aluno-1",
        responsaveis_aluno: [
          { celular: "62999990000", responsavel_financeiro: true },
        ],
      },
    ];
    expect(filtrarDestinatarios(linhas)).toEqual([
      { alunoId: "aluno-1", telefone: "62999990000" },
    ]);
  });

  it("ignora responsável não-financeiro", () => {
    const linhas = [
      {
        id: "aluno-1",
        responsaveis_aluno: [
          { celular: "62999990000", responsavel_financeiro: false },
        ],
      },
    ];
    expect(filtrarDestinatarios(linhas)).toEqual([]);
  });

  it("ignora responsável financeiro sem celular", () => {
    const linhas = [
      {
        id: "aluno-1",
        responsaveis_aluno: [
          { celular: null, responsavel_financeiro: true },
        ],
      },
    ];
    expect(filtrarDestinatarios(linhas)).toEqual([]);
  });

  it("escolhe o responsável financeiro entre vários responsáveis", () => {
    const linhas = [
      {
        id: "aluno-1",
        responsaveis_aluno: [
          { celular: "62911112222", responsavel_financeiro: false },
          { celular: "62933334444", responsavel_financeiro: true },
        ],
      },
    ];
    expect(filtrarDestinatarios(linhas)).toEqual([
      { alunoId: "aluno-1", telefone: "62933334444" },
    ]);
  });

  it("aluno sem nenhum responsável é ignorado", () => {
    const linhas = [{ id: "aluno-1", responsaveis_aluno: [] }];
    expect(filtrarDestinatarios(linhas)).toEqual([]);
  });

  it("processa vários alunos", () => {
    const linhas = [
      {
        id: "aluno-1",
        responsaveis_aluno: [{ celular: "62900000001", responsavel_financeiro: true }],
      },
      {
        id: "aluno-2",
        responsaveis_aluno: [{ celular: "62900000002", responsavel_financeiro: true }],
      },
    ];
    expect(filtrarDestinatarios(linhas)).toEqual([
      { alunoId: "aluno-1", telefone: "62900000001" },
      { alunoId: "aluno-2", telefone: "62900000002" },
    ]);
  });
});
```

- [ ] **Step 2: Rodar — deve FALHAR**

Run: `npx vitest run src/lib/comunicados/destinatarios.test.ts`
Expected: FAIL — `filtrarDestinatarios` não existe.

- [ ] **Step 3: Implementar**

`src/lib/comunicados/destinatarios.ts`:

```typescript
import { DEFAULT_SCHOOL_ID } from "@/lib/constants";

export type Destinatario = {
  alunoId: string;
  telefone: string;
};

type ResponsavelRow = {
  celular: string | null;
  responsavel_financeiro: boolean | null;
};

type AlunoRow = {
  id: string;
  responsaveis_aluno: ResponsavelRow[];
};

// Parte pura: filtra alunos que têm responsável financeiro com celular.
export function filtrarDestinatarios(linhas: AlunoRow[]): Destinatario[] {
  const resultado: Destinatario[] = [];
  for (const aluno of linhas) {
    const financeiro = (aluno.responsaveis_aluno ?? []).find(
      (r) => r.responsavel_financeiro === true && !!r.celular,
    );
    if (financeiro?.celular) {
      resultado.push({ alunoId: aluno.id, telefone: financeiro.celular });
    }
  }
  return resultado;
}

type SupabaseLike = {
  from: (table: string) => any;
};

// Parte com I/O: busca alunos ativos e seus responsáveis financeiros.
export async function resolverDestinatarios(
  supabase: SupabaseLike,
  alcance: "geral" | "individual",
  alunoId: string | null,
  escolaId: string = DEFAULT_SCHOOL_ID,
): Promise<Destinatario[]> {
  let query = supabase
    .from("alunos")
    .select("id, responsaveis_aluno(celular, responsavel_financeiro), matriculas!inner(status)")
    .eq("escola_id", escolaId)
    .eq("matriculas.status", "ativa");

  if (alcance === "individual" && alunoId) {
    query = query.eq("id", alunoId);
  }

  const { data } = await query;

  // Dedup de alunos (o join com matriculas pode repetir a linha do aluno).
  const vistos = new Set<string>();
  const unicos: AlunoRow[] = [];
  for (const row of (data ?? []) as AlunoRow[]) {
    if (vistos.has(row.id)) continue;
    vistos.add(row.id);
    unicos.push(row);
  }

  return filtrarDestinatarios(unicos);
}
```

- [ ] **Step 4: Rodar — deve PASSAR**

Run: `npx vitest run src/lib/comunicados/destinatarios.test.ts`
Expected: PASS — 6 testes.

- [ ] **Step 5: Commit**

```bash
git add src/lib/comunicados/destinatarios.ts src/lib/comunicados/destinatarios.test.ts
git commit -m "feat(comunicados): add recipient resolution"
```

---

## Task 4: Registrar módulo `comunicados` no RBAC do código

**Files:**
- Modify: `src/lib/auth/permissions.ts`

- [ ] **Step 1: Adicionar em `MODULOS`**

Em `src/lib/auth/permissions.ts`, no bloco `MODULOS`, na seção `// rh`, após a linha de
`"rh.templates"`:

```typescript
  "rh.templates": { grupo: "rh", nome: "Templates RH" },
  comunicados: { grupo: "rh", nome: "Comunicados" },
```

- [ ] **Step 2: Adicionar em `ROTA_PARA_MODULO`**

No objeto `ROTA_PARA_MODULO`, após a linha `"/rh/documentos": "rh.templates",`:

```typescript
  "/rh/documentos": "rh.templates",
  "/comunicados": "comunicados",
```

- [ ] **Step 3: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
git add src/lib/auth/permissions.ts
git commit -m "feat(comunicados): register comunicados module in RBAC"
```

---

## Task 5: Data layer de comunicados

`listComunicados`, `getComunicado`, `getDestinatarios`.

**Files:**
- Create: `src/lib/data/comunicados.ts`

- [ ] **Step 1: Criar `src/lib/data/comunicados.ts`**

```typescript
import { createServerClient } from "@/lib/supabase/server";
import { DEFAULT_SCHOOL_ID } from "@/lib/constants";

export type ComunicadoRow = {
  id: string;
  titulo: string;
  mensagem: string;
  imagemPath: string | null;
  alcance: "geral" | "individual";
  alunoId: string | null;
  status: "processando" | "concluido";
  totalDestinatarios: number;
  totalEnviados: number;
  totalFalhas: number;
  createdAt: string;
  concluidoEm: string | null;
};

export type DestinatarioMensagem = {
  id: string;
  telefone: string;
  status: "pendente" | "enviada" | "falha";
  erro: string | null;
  alunoId: string | null;
};

function mapComunicado(row: any): ComunicadoRow {
  return {
    id: row.id,
    titulo: row.titulo,
    mensagem: row.mensagem,
    imagemPath: row.imagem_path,
    alcance: row.alcance,
    alunoId: row.aluno_id,
    status: row.status,
    totalDestinatarios: row.total_destinatarios ?? 0,
    totalEnviados: row.total_enviados ?? 0,
    totalFalhas: row.total_falhas ?? 0,
    createdAt: row.created_at,
    concluidoEm: row.concluido_em,
  };
}

export async function listComunicados(
  escolaId: string = DEFAULT_SCHOOL_ID,
): Promise<ComunicadoRow[]> {
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("comunicados")
    .select("*")
    .eq("escola_id", escolaId)
    .order("created_at", { ascending: false });
  return (data ?? []).map(mapComunicado);
}

export async function getComunicado(
  id: string,
  escolaId: string = DEFAULT_SCHOOL_ID,
): Promise<ComunicadoRow | null> {
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("comunicados")
    .select("*")
    .eq("id", id)
    .eq("escola_id", escolaId)
    .maybeSingle();
  return data ? mapComunicado(data) : null;
}

export async function getDestinatarios(
  comunicadoId: string,
): Promise<DestinatarioMensagem[]> {
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("mensagens_whatsapp")
    .select("id, telefone, status, erro, aluno_id")
    .eq("referencia_tipo", "comunicado")
    .eq("referencia_id", comunicadoId)
    .order("created_at", { ascending: true });
  return (data ?? []).map((r: any) => ({
    id: r.id,
    telefone: r.telefone,
    status: r.status,
    erro: r.erro,
    alunoId: r.aluno_id,
  }));
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/lib/data/comunicados.ts
git commit -m "feat(comunicados): add data layer"
```

---

## Task 6: Server action de criação de comunicado

`criarComunicadoAction` — upload da imagem, cria o comunicado, resolve destinatários, insere mensagens `pendente`.

**Files:**
- Create: `src/lib/actions/comunicados.ts`

- [ ] **Step 1: Criar `src/lib/actions/comunicados.ts`**

```typescript
"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/session";
import { DEFAULT_SCHOOL_ID } from "@/lib/constants";
import { formText } from "@/lib/utils";
import { resolverDestinatarios } from "@/lib/comunicados/destinatarios";

const MAX_IMAGEM_BYTES = 5 * 1024 * 1024;
const TIPOS_IMAGEM = ["image/png", "image/jpeg", "image/webp"];

export async function criarComunicadoAction(formData: FormData) {
  const session = await requirePermission("comunicados", "create");
  const supabase = await createServerClient();

  const titulo = formText(formData, "titulo");
  const mensagem = formText(formData, "mensagem");
  const alcance = formText(formData, "alcance");
  const alunoId = formText(formData, "aluno_id");

  if (!titulo || !mensagem) {
    redirect("/comunicados/novo?erro=campos_obrigatorios");
  }
  if (alcance !== "geral" && alcance !== "individual") {
    redirect("/comunicados/novo?erro=alcance_invalido");
  }
  if (alcance === "individual" && !alunoId) {
    redirect("/comunicados/novo?erro=aluno_obrigatorio");
  }

  // Upload opcional da imagem.
  let imagemPath: string | null = null;
  const file = formData.get("imagem");
  if (file instanceof File && file.size > 0) {
    if (!TIPOS_IMAGEM.includes(file.type)) {
      redirect("/comunicados/novo?erro=imagem_tipo");
    }
    if (file.size > MAX_IMAGEM_BYTES) {
      redirect("/comunicados/novo?erro=imagem_grande");
    }
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${Date.now()}-${safeName}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    const { error: upErr } = await supabase.storage
      .from("comunicados")
      .upload(path, buffer, { contentType: file.type, upsert: false });
    if (upErr) {
      redirect(`/comunicados/novo?erro=${encodeURIComponent(upErr.message)}`);
    }
    imagemPath = path;
  }

  // Cria o comunicado.
  const { data: comunicado, error: comErr } = await supabase
    .from("comunicados")
    .insert({
      escola_id: DEFAULT_SCHOOL_ID,
      titulo,
      mensagem,
      imagem_path: imagemPath,
      alcance,
      aluno_id: alcance === "individual" ? alunoId : null,
      status: "processando",
      criado_por: session.profile.id,
    })
    .select("id")
    .single();

  if (comErr || !comunicado) {
    redirect(`/comunicados/novo?erro=${encodeURIComponent(comErr?.message ?? "falha")}`);
  }

  // Resolve destinatários.
  const destinatarios = await resolverDestinatarios(
    supabase,
    alcance,
    alcance === "individual" ? alunoId : null,
  );

  // URL assinada da imagem (válida por bastante tempo, pois o cron envia depois).
  let imagemUrl: string | null = null;
  if (imagemPath) {
    const { data: signed } = await supabase.storage
      .from("comunicados")
      .createSignedUrl(imagemPath, 60 * 60 * 24 * 7); // 7 dias
    imagemUrl = signed?.signedUrl ?? null;
  }

  // Insere uma mensagem pendente por destinatário.
  if (destinatarios.length > 0) {
    await supabase.from("mensagens_whatsapp").insert(
      destinatarios.map((d) => ({
        escola_id: DEFAULT_SCHOOL_ID,
        telefone: d.telefone,
        mensagem,
        status: "pendente" as const,
        imagem_url: imagemUrl,
        aluno_id: d.alunoId,
        referencia_tipo: "comunicado",
        referencia_id: comunicado.id,
      })),
    );
  }

  // Atualiza total de destinatários. Se zero, já marca concluído.
  await supabase
    .from("comunicados")
    .update({
      total_destinatarios: destinatarios.length,
      status: destinatarios.length === 0 ? "concluido" : "processando",
      concluido_em: destinatarios.length === 0 ? new Date().toISOString() : null,
    })
    .eq("id", comunicado.id);

  revalidatePath("/comunicados");
  redirect(`/comunicados/${comunicado.id}`);
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros. Confirmar que `formText` existe em `@/lib/utils` (usado em `src/lib/actions/calendario.ts`).

- [ ] **Step 3: Commit**

```bash
git add src/lib/actions/comunicados.ts
git commit -m "feat(comunicados): add create comunicado server action"
```

---

## Task 7: Processador de lote

`processarLote` — pega até 30 mensagens `pendente` de comunicados, envia cada uma, atualiza contadores.

**Files:**
- Create: `src/lib/comunicados/processar.ts`

- [ ] **Step 1: Criar `src/lib/comunicados/processar.ts`**

```typescript
import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendWhatsApp, sendWhatsAppMedia } from "@/lib/whatsapp/evolution";

const TAMANHO_LOTE = 30;

export type ResultadoLote = {
  processadas: number;
  enviadas: number;
  falhas: number;
};

export async function processarLote(): Promise<ResultadoLote> {
  const supabase = createAdminClient();

  // Pega um lote de mensagens pendentes de comunicados.
  const { data: pendentes } = await supabase
    .from("mensagens_whatsapp")
    .select("id, telefone, mensagem, imagem_url, referencia_id")
    .eq("referencia_tipo", "comunicado")
    .eq("status", "pendente")
    .order("created_at", { ascending: true })
    .limit(TAMANHO_LOTE);

  const lote = pendentes ?? [];
  if (lote.length === 0) {
    return { processadas: 0, enviadas: 0, falhas: 0 };
  }

  let enviadas = 0;
  let falhas = 0;
  const comunicadosTocados = new Set<string>();

  for (const msg of lote) {
    comunicadosTocados.add(msg.referencia_id);

    const resultado = msg.imagem_url
      ? await sendWhatsAppMedia({
          telefone: msg.telefone,
          mensagem: msg.mensagem,
          imagemUrl: msg.imagem_url,
        })
      : await sendWhatsApp({ telefone: msg.telefone, mensagem: msg.mensagem });

    if (resultado.ok) {
      enviadas += 1;
      await supabase
        .from("mensagens_whatsapp")
        .update({
          status: "enviada",
          provider_message_id: resultado.providerMessageId,
          enviada_em: new Date().toISOString(),
        })
        .eq("id", msg.id);
    } else {
      falhas += 1;
      await supabase
        .from("mensagens_whatsapp")
        .update({
          status: "falha",
          erro: resultado.reason,
          enviada_em: new Date().toISOString(),
        })
        .eq("id", msg.id);
    }
  }

  // Recalcula contadores dos comunicados tocados.
  for (const comunicadoId of comunicadosTocados) {
    const { count: enviadasTotal } = await supabase
      .from("mensagens_whatsapp")
      .select("id", { count: "exact", head: true })
      .eq("referencia_tipo", "comunicado")
      .eq("referencia_id", comunicadoId)
      .eq("status", "enviada");

    const { count: falhasTotal } = await supabase
      .from("mensagens_whatsapp")
      .select("id", { count: "exact", head: true })
      .eq("referencia_tipo", "comunicado")
      .eq("referencia_id", comunicadoId)
      .eq("status", "falha");

    const { count: pendentesTotal } = await supabase
      .from("mensagens_whatsapp")
      .select("id", { count: "exact", head: true })
      .eq("referencia_tipo", "comunicado")
      .eq("referencia_id", comunicadoId)
      .eq("status", "pendente");

    const concluido = (pendentesTotal ?? 0) === 0;
    await supabase
      .from("comunicados")
      .update({
        total_enviados: enviadasTotal ?? 0,
        total_falhas: falhasTotal ?? 0,
        status: concluido ? "concluido" : "processando",
        concluido_em: concluido ? new Date().toISOString() : null,
      })
      .eq("id", comunicadoId);
  }

  return { processadas: lote.length, enviadas, falhas };
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/lib/comunicados/processar.ts
git commit -m "feat(comunicados): add batch processor"
```

---

## Task 8: Rota do cron

Rota `GET /api/comunicados/processar` protegida por `CRON_SECRET`, chama `processarLote`.

**Files:**
- Create: `src/app/api/comunicados/processar/route.ts`
- Modify: `vercel.json`
- Modify: `.env.local`

- [ ] **Step 1: Criar a rota**

`src/app/api/comunicados/processar/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { processarLote } from "@/lib/comunicados/processar";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");

  // Vercel Cron envia "Bearer <CRON_SECRET>" no header Authorization.
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const resultado = await processarLote();
  return NextResponse.json(resultado);
}
```

- [ ] **Step 2: Adicionar o cron ao `vercel.json`**

O `vercel.json` atual é:
```json
{
  "framework": "nextjs",
  "buildCommand": "npm run build",
  "outputDirectory": ".next"
}
```

Substituir por:
```json
{
  "framework": "nextjs",
  "buildCommand": "npm run build",
  "outputDirectory": ".next",
  "crons": [
    {
      "path": "/api/comunicados/processar",
      "schedule": "* * * * *"
    }
  ]
}
```

- [ ] **Step 3: Adicionar `CRON_SECRET` ao `.env.local`**

Acrescentar ao final de `.env.local`:
```
# Token que protege a rota do cron de comunicados
CRON_SECRET=
```

NÃO commitar `.env.local` (está no `.gitignore`). O usuário preenche com um valor aleatório
e adiciona o mesmo na Vercel.

- [ ] **Step 4: Verificar tipos e build**

Run: `npx tsc --noEmit && npm run build`
Expected: sem erros; rota `/api/comunicados/processar` aparece no build.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/comunicados/processar/route.ts vercel.json
git commit -m "feat(comunicados): add cron route for batch processing"
```

---

## Task 9: Form de novo comunicado (client component)

Form com título, mensagem, imagem opcional, alcance geral/individual com seletor de aluno.

**Files:**
- Create: `src/components/comunicados/novo-comunicado-form.tsx`

- [ ] **Step 1: Criar `src/components/comunicados/novo-comunicado-form.tsx`**

```typescript
"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { Panel } from "@/components/ui/card";
import { criarComunicadoAction } from "@/lib/actions/comunicados";

type AlunoLite = { id: string; nome: string };

export function NovoComunicadoForm({ alunos }: { alunos: AlunoLite[] }) {
  const [alcance, setAlcance] = useState<"geral" | "individual">("geral");
  const [enviando, setEnviando] = useState(false);

  return (
    <Panel className="grid gap-4">
      <h2 className="font-bold text-ink">Novo comunicado</h2>
      <form
        action={criarComunicadoAction}
        encType="multipart/form-data"
        onSubmit={() => setEnviando(true)}
        className="grid gap-4"
      >
        <label className="grid gap-1 text-sm">
          Título
          <input type="text" name="titulo" required maxLength={120} />
        </label>

        <label className="grid gap-1 text-sm">
          Mensagem
          <textarea name="mensagem" required rows={5} maxLength={2000} />
        </label>

        <label className="grid gap-1 text-sm">
          Imagem (opcional)
          <input type="file" name="imagem" accept="image/png,image/jpeg,image/webp" />
          <span className="text-xs text-ink/55">PNG, JPG ou WEBP — máx 5MB.</span>
        </label>

        <fieldset className="grid gap-2">
          <legend className="text-sm font-semibold text-ink">Alcance</legend>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="alcance"
              value="geral"
              checked={alcance === "geral"}
              onChange={() => setAlcance("geral")}
            />
            Todos os responsáveis financeiros (alunos ativos)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="alcance"
              value="individual"
              checked={alcance === "individual"}
              onChange={() => setAlcance("individual")}
            />
            Aluno específico
          </label>
        </fieldset>

        {alcance === "individual" && (
          <label className="grid gap-1 text-sm">
            Aluno
            <select name="aluno_id" required={alcance === "individual"}>
              <option value="">Selecione…</option>
              {alunos.map((a) => (
                <option key={a.id} value={a.id}>{a.nome}</option>
              ))}
            </select>
          </label>
        )}

        <div className="flex justify-end">
          <button className="ds-button ds-button-primary" disabled={enviando}>
            <Send size={14} /> {enviando ? "Enviando…" : "Enviar comunicado"}
          </button>
        </div>
      </form>
    </Panel>
  );
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/components/comunicados/novo-comunicado-form.tsx
git commit -m "feat(comunicados): add new comunicado form component"
```

---

## Task 10: Página de novo comunicado

Server component que carrega a lista de alunos ativos e renderiza o form.

**Files:**
- Create: `src/app/(app)/comunicados/novo/page.tsx`

- [ ] **Step 1: Criar `src/app/(app)/comunicados/novo/page.tsx`**

```typescript
import { PageHeader } from "@/components/ui/page-header";
import { requirePermission } from "@/lib/auth/session";
import { createServerClient } from "@/lib/supabase/server";
import { NovoComunicadoForm } from "@/components/comunicados/novo-comunicado-form";

export const dynamic = "force-dynamic";

export default async function NovoComunicadoPage() {
  const session = await requirePermission("comunicados", "create");
  const supabase = await createServerClient();

  const { data: alunosData } = await supabase
    .from("alunos")
    .select("id, nome, matriculas!inner(status)")
    .eq("escola_id", session.profile.escola_id)
    .eq("matriculas.status", "ativa")
    .order("nome");

  // Dedup — o join com matriculas pode repetir o aluno.
  const vistos = new Set<string>();
  const alunos: Array<{ id: string; nome: string }> = [];
  for (const a of (alunosData ?? []) as Array<{ id: string; nome: string }>) {
    if (vistos.has(a.id)) continue;
    vistos.add(a.id);
    alunos.push({ id: a.id, nome: a.nome });
  }

  return (
    <div className="grid gap-6">
      <PageHeader
        breadcrumb={[
          { label: "RH" },
          { label: "Comunicados", href: "/comunicados" },
          { label: "Novo" },
        ]}
        title="Novo comunicado"
        description="Envie um aviso aos responsáveis via WhatsApp."
      />
      <NovoComunicadoForm alunos={alunos} />
    </div>
  );
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(app)/comunicados/novo/page.tsx"
git commit -m "feat(comunicados): add new comunicado page"
```

---

## Task 11: Página de lista de comunicados

Server component — lista os comunicados com status e contadores.

**Files:**
- Create: `src/app/(app)/comunicados/page.tsx`

- [ ] **Step 1: Criar `src/app/(app)/comunicados/page.tsx`**

```typescript
import Link from "next/link";
import { Megaphone, Plus } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { StatusPill, type StatusTone } from "@/components/ui/status-pill";
import { requirePermission } from "@/lib/auth/session";
import { listComunicados } from "@/lib/data/comunicados";

export const dynamic = "force-dynamic";

export default async function ComunicadosPage() {
  await requirePermission("comunicados", "read");
  const comunicados = await listComunicados();

  return (
    <div className="grid gap-6">
      <PageHeader
        breadcrumb={[{ label: "RH" }, { label: "Comunicados" }]}
        title="Comunicados"
        counter={comunicados.length.toString()}
        description="Avisos enviados aos responsáveis via WhatsApp."
        actions={
          <ButtonLink href="/comunicados/novo" variant="primary">
            <Plus size={14} /> Novo comunicado
          </ButtonLink>
        }
      />

      {comunicados.length === 0 ? (
        <Panel>
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-ink/40">
            <Megaphone size={28} />
            <p className="text-sm font-medium">Nenhum comunicado enviado.</p>
          </div>
        </Panel>
      ) : (
        <div className="grid gap-2">
          {comunicados.map((c) => {
            const tone: StatusTone = c.status === "concluido" ? "success" : "warning";
            return (
              <Link
                key={c.id}
                href={`/comunicados/${c.id}`}
                className="grid gap-2 rounded-ui border border-line p-4 hover:bg-muted/40 md:grid-cols-[1fr_auto_auto_auto] md:items-center"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold text-ink">{c.titulo}</p>
                  <p className="text-xs text-ink/55">
                    {c.alcance === "geral" ? "Geral" : "Individual"} ·{" "}
                    {new Date(c.createdAt).toLocaleDateString("pt-BR")}
                  </p>
                </div>
                <span className="text-xs text-ink/60">
                  {c.totalEnviados}/{c.totalDestinatarios} enviados
                </span>
                {c.totalFalhas > 0 && (
                  <span className="text-xs font-semibold text-danger">
                    {c.totalFalhas} falhas
                  </span>
                )}
                <StatusPill tone={tone}>
                  {c.status === "concluido" ? "Concluído" : "Processando"}
                </StatusPill>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros. Confirmar `StatusPill` / `StatusTone` em `@/components/ui/status-pill`
(usado em `src/app/(app)/relatorios/inadimplencia/page.tsx`).

- [ ] **Step 3: Commit**

```bash
git add "src/app/(app)/comunicados/page.tsx"
git commit -m "feat(comunicados): add comunicados list page"
```

---

## Task 12: Página de detalhe do comunicado

Mostra o comunicado + a lista de destinatários com status individual.

**Files:**
- Create: `src/app/(app)/comunicados/[id]/page.tsx`

- [ ] **Step 1: Criar `src/app/(app)/comunicados/[id]/page.tsx`**

```typescript
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/card";
import { StatusPill, type StatusTone } from "@/components/ui/status-pill";
import { requirePermission } from "@/lib/auth/session";
import { getComunicado, getDestinatarios } from "@/lib/data/comunicados";

export const dynamic = "force-dynamic";

const STATUS_TONE: Record<string, StatusTone> = {
  enviada: "success",
  falha: "danger",
  pendente: "neutral",
};

const STATUS_LABEL: Record<string, string> = {
  enviada: "Enviada",
  falha: "Falha",
  pendente: "Pendente",
};

export default async function ComunicadoDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requirePermission("comunicados", "read");
  const { id } = await params;

  const comunicado = await getComunicado(id, session.profile.escola_id);
  if (!comunicado) notFound();

  const destinatarios = await getDestinatarios(id);

  return (
    <div className="grid gap-6">
      <PageHeader
        breadcrumb={[
          { label: "RH" },
          { label: "Comunicados", href: "/comunicados" },
          { label: comunicado.titulo },
        ]}
        title={comunicado.titulo}
        description={`${comunicado.alcance === "geral" ? "Geral" : "Individual"} · ${new Date(comunicado.createdAt).toLocaleDateString("pt-BR")}`}
        kpis={[
          { label: "Destinatários", value: comunicado.totalDestinatarios.toString() },
          { label: "Enviados", value: comunicado.totalEnviados.toString() },
          { label: "Falhas", value: comunicado.totalFalhas.toString(), tone: comunicado.totalFalhas > 0 ? "danger" : undefined },
          { label: "Status", value: comunicado.status === "concluido" ? "Concluído" : "Processando" },
        ]}
      />

      <Panel className="grid gap-2">
        <h2 className="font-bold text-ink">Mensagem</h2>
        <p className="whitespace-pre-wrap text-sm text-ink/80">{comunicado.mensagem}</p>
      </Panel>

      <Panel className="grid gap-3">
        <h2 className="font-bold text-ink">Destinatários ({destinatarios.length})</h2>
        {destinatarios.length === 0 ? (
          <p className="py-6 text-center text-sm text-ink/55">
            Nenhum destinatário — nenhum responsável financeiro com WhatsApp encontrado.
          </p>
        ) : (
          <ul className="grid gap-1.5">
            {destinatarios.map((d) => (
              <li
                key={d.id}
                className="flex items-center justify-between gap-3 rounded-ui border border-line p-2.5 text-sm"
              >
                <span className="font-mono text-ink/70">{d.telefone}</span>
                <div className="flex items-center gap-2">
                  {d.erro && <span className="text-xs text-danger">{d.erro}</span>}
                  <StatusPill tone={STATUS_TONE[d.status] ?? "neutral"}>
                    {STATUS_LABEL[d.status] ?? d.status}
                  </StatusPill>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
```

- [ ] **Step 2: Verificar tipos e build**

Run: `npx tsc --noEmit && npm run build`
Expected: sem erros; rotas `/comunicados`, `/comunicados/novo`, `/comunicados/[id]` no build.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(app)/comunicados/[id]/page.tsx"
git commit -m "feat(comunicados): add comunicado detail page"
```

---

## Task 13: Link no menu RH

Adicionar "Comunicados" ao menu RH da topbar.

**Files:**
- Modify: `src/components/layout/topbar.tsx`

- [ ] **Step 1: Adicionar item em `RH_ITEMS`**

Em `src/components/layout/topbar.tsx`, no array `RH_ITEMS`, adicionar (após o último item
existente, antes do `]` que fecha o array):

```typescript
  { href: "/comunicados", label: "Comunicados", iconName: "Megaphone" },
```

- [ ] **Step 2: Garantir o ícone em `dropdown-icons.tsx`**

Abrir `src/components/layout/dropdown-icons.tsx`. Se `Megaphone` ainda não estiver no
import de `lucide-react` e no `ICON_MAP`, adicionar nos dois lugares:
- no import: `Megaphone`
- no `ICON_MAP`: `Megaphone,`

- [ ] **Step 3: Verificar tipos e build**

Run: `npx tsc --noEmit && npm run build`
Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/topbar.tsx src/components/layout/dropdown-icons.tsx
git commit -m "feat(comunicados): add comunicados link to RH menu"
```

---

## Task 14: Verificação final

- [ ] **Step 1: Rodar todos os testes**

Run: `npm test`
Expected: `destinatarios.test.ts` (6) + suítes existentes (`telefone` 10, `dias-letivos` 10,
`feriados` 14) = 40 passando.

- [ ] **Step 2: Build final**

Run: `npm run build`
Expected: passa; as 3 rotas `/comunicados*` e a rota `/api/comunicados/processar` listadas.

- [ ] **Step 3: Smoke test manual** (requer dev server e env configurado)

1. `/comunicados` abre, vazio.
2. "Novo comunicado" → preencher título, mensagem, alcance `individual`, escolher um aluno
   com responsável financeiro cadastrado → enviar.
3. Redireciona para o detalhe; comunicado aparece `processando`, 1 destinatário `pendente`.
4. Se `EVOLUTION_*` + `CRON_SECRET` configurados, chamar manualmente a rota do cron:
   `curl -H "Authorization: Bearer <CRON_SECRET>" http://localhost:3001/api/comunicados/processar`
   → mensagem vira `enviada`, comunicado vira `concluido`.
5. Sem env Evolution: a mensagem vira `falha` com motivo "Evolution API não configurada" —
   o fluxo não quebra.

---

## Notas de execução

- **Cron na Vercel:** o bloco `crons` no `vercel.json` só roda em produção (deploy Vercel).
  A Vercel injeta automaticamente o header `Authorization: Bearer ${CRON_SECRET}` se a env
  `CRON_SECRET` existir no projeto. Localmente, testar chamando a rota manualmente com o
  header.
- **Service client no processador:** `processar.ts` usa `createAdminClient` (service_role)
  porque o cron roda sem usuário autenticado. A policy `service_role` nas tabelas permite.
- **URL assinada da imagem:** gerada com validade de 7 dias na criação do comunicado,
  porque o cron pode enviar a mensagem horas depois. A Evolution baixa a imagem dessa URL
  no momento do envio.
- **Sem env = sem quebra:** sem `EVOLUTION_*`, as mensagens viram `falha` controlada; sem
  `CRON_SECRET`, a rota retorna 401. Nada quebra o build ou o resto do app.
- **Migração:** Task 1 aplica via MCP direto em produção (`fljkjhmwnjehsodvqaqk`); o `.sql`
  fica versionado em `supabase/migrations/`.
- **Lembretes de inadimplência:** fora desta frente — spec separado depois.
