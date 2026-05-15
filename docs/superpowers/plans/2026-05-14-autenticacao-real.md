# Autenticação Real — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir o login simulado por autenticação real com `@supabase/ssr`, proteger rotas via middleware, migrar 21 arquivos de `createAdminClient()` para cliente SSR autenticado, ativar RLS scoped por `escola_id`, adicionar tela admin de criação de usuários e privatizar bucket `alunos-fotos`.

**Architecture:** Next.js 14 App Router + `@supabase/ssr` com cookies HTTP-only. Três clientes Supabase distintos (server, middleware, admin). Middleware na raiz refresca sessão. Layout `(app)/*` valida perfil. Data fetchers e server actions usam cliente autenticado, RLS aplica policy `escola_id = (select escola_id from current_perfil())`. Service role mantido apenas em criação de user, seed admin, API portaria, geração batch de cobranças e processador de import PDF.

**Tech Stack:** Next.js 14, `@supabase/ssr`, `@supabase/supabase-js`, Supabase (Postgres + Auth + Storage), TypeScript, Zod, Tailwind.

**Spec:** `docs/superpowers/specs/2026-05-14-autenticacao-real-design.md`

---

## File Structure

### Novos arquivos

- `src/middleware.ts` — middleware raiz, delega para `updateSession`.
- `src/lib/supabase/server.ts` — `createServerClient()` lendo cookies de `next/headers`.
- `src/lib/supabase/middleware.ts` — `updateSession(request)` refresca sessão.
- `src/lib/auth/session.ts` — `getSession`, `requireSession`, `requireAdmin`.
- `src/lib/storage/photos.ts` — `getSignedFotoUrl(path)` TTL 1h, server-only.
- `src/app/(app)/usuarios/page.tsx` — listagem.
- `src/app/(app)/usuarios/novo/page.tsx` — formulário criar user.
- `src/lib/actions/users.ts` — `createUserAction`, `deactivateUserAction`.
- `supabase/migrations/202605160001_auth_real_rls.sql` — drop policies antigas, função `current_perfil`, policies novas, storage policies.
- `scripts/seed-admin.mjs` — extração de `ensureDefaultAdmin`.

### Arquivos modificados

- `src/lib/actions/auth.ts` — login/logout via SSR client + validação perfil ativo. Remove `ensureDefaultAdmin`.
- `src/app/(auth)/login/page.tsx` — remove chamada `ensureDefaultAdmin`, adiciona mensagens de erro novas.
- `src/app/(app)/layout.tsx` — chama `requireSession()`, passa `perfil` ao Topbar.
- `src/components/layout/topbar.tsx` — exibe nome/email, adiciona link "Usuários".
- `src/lib/data/{dashboard,students,enrollments,finance,attendance,lookups,documents,gate,imports}.ts` — troca para `createServerClient()`.
- `src/lib/actions/{academics,students,attendance,finance,documents,imports}.ts` — troca cliente + `requireSession()`.
- `src/lib/actions/gate.ts` — parcial: UI usa SSR, funções chamadas pela API mantêm admin.
- `src/lib/server/{generate-charges,gate-events,guardian-notifications,student-import-parser}.ts` — comentário inline justificando service role.
- `package.json` — adiciona `@supabase/ssr`, atualiza script `seed:auth`.
- `README.md` — documenta variáveis env e fluxo de auth.
- Auditar e estender RLS nas tabelas das migrations `202605140001..202605150001`.

### Arquivos removidos

- `src/lib/supabase/public.ts` — substituído por `server.ts`.

---

## Fase 1 — Infraestrutura

### Task 1: Adicionar dependência `@supabase/ssr`

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Instalar pacote**

Run: `npm install @supabase/ssr`
Expected: `package.json` recebe `"@supabase/ssr": "^0.5.x"` em `dependencies`. `package-lock.json` atualizado.

- [ ] **Step 2: Verificar build ainda funciona**

Run: `npm run typecheck`
Expected: sem erros novos.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add @supabase/ssr for cookie-based auth"
```

---

### Task 2: Criar cliente SSR para Server Components/Actions

**Files:**
- Create: `src/lib/supabase/server.ts`

- [ ] **Step 1: Escrever arquivo**

```ts
import { createServerClient as createSSRClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { requiredEnv } from "@/lib/env";

export async function createServerClient() {
  const cookieStore = cookies();
  return createSSRClient(
    requiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // chamado de Server Component — setAll vira no-op (cookies só mutáveis em actions/handlers)
          }
        }
      }
    }
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: passa.

- [ ] **Step 3: Commit**

```bash
git add src/lib/supabase/server.ts
git commit -m "feat: add SSR Supabase client for server components"
```

---

### Task 3: Criar cliente Supabase para middleware

**Files:**
- Create: `src/lib/supabase/middleware.ts`

- [ ] **Step 1: Escrever arquivo**

```ts
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { requiredEnv } from "@/lib/env";

const PUBLIC_PATHS = ["/login"];

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    requiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        }
      }
    }
  );

  const { data } = await supabase.auth.getUser();
  const pathname = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (!data.user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return response;
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: passa.

- [ ] **Step 3: Commit**

```bash
git add src/lib/supabase/middleware.ts
git commit -m "feat: add middleware session helper"
```

---

### Task 4: Criar `src/middleware.ts` na raiz

**Files:**
- Create: `src/middleware.ts`

- [ ] **Step 1: Escrever arquivo**

```ts
import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/portaria).*)"]
};
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: passa.

- [ ] **Step 3: Commit**

```bash
git add src/middleware.ts
git commit -m "feat: protect app routes via Next.js middleware"
```

---

### Task 5: Criar helpers de sessão

**Files:**
- Create: `src/lib/auth/session.ts`

- [ ] **Step 1: Escrever arquivo**

```ts
import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";

export type SessionProfile = {
  id: string;
  user_id: string;
  escola_id: string;
  nome: string;
  email: string;
  perfil: "admin" | "secretaria" | "financeiro" | "professor";
  ativo: boolean;
};

export type Session = {
  user: { id: string; email: string };
  profile: SessionProfile;
};

export async function getSession(): Promise<Session | null> {
  const supabase = await createServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return null;

  const { data: profile } = await supabase
    .from("perfis")
    .select("id, user_id, escola_id, nome, email, perfil, ativo")
    .eq("user_id", userData.user.id)
    .maybeSingle();

  if (!profile || !profile.ativo) return null;
  return {
    user: { id: userData.user.id, email: userData.user.email ?? profile.email },
    profile: profile as SessionProfile
  };
}

export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

export async function requireAdmin(): Promise<Session> {
  const session = await requireSession();
  if (session.profile.perfil !== "admin") redirect("/login?erro=perfil");
  return session;
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: passa.

- [ ] **Step 3: Commit**

```bash
git add src/lib/auth/session.ts
git commit -m "feat: add session helpers (getSession, requireSession, requireAdmin)"
```

---

### Task 6: Migration RLS — função helper + perfis + escolas

**Files:**
- Create: `supabase/migrations/202605160001_auth_real_rls.sql`

- [ ] **Step 1: Criar arquivo com header + drops + função**

```sql
-- Auth real: substitui policies "service role full access" por policies scoped por escola_id via current_perfil().

drop policy if exists "service role full access escolas" on escolas;
drop policy if exists "service role full access perfis" on perfis;
drop policy if exists "service role full access alunos" on alunos;
drop policy if exists "service role full access enderecos" on enderecos_aluno;
drop policy if exists "service role full access contatos" on contatos_aluno;
drop policy if exists "service role full access responsaveis" on responsaveis_aluno;
drop policy if exists "service role full access autorizadas" on pessoas_autorizadas;
drop policy if exists "service role full access medicas" on informacoes_medicas;
drop policy if exists "service role full access aut aluno" on autorizacoes_aluno;
drop policy if exists "service role full access series" on series;
drop policy if exists "service role full access turmas" on turmas;
drop policy if exists "service role full access planos" on planos;
drop policy if exists "service role full access matriculas" on matriculas;
drop policy if exists "service role full access frequencias" on frequencias;
drop policy if exists "service role full access cobrancas" on cobrancas;
drop policy if exists "service role full access pagamentos" on pagamentos;
drop policy if exists "service role full access arquivos" on arquivos_importados;

create or replace function current_perfil()
returns perfis as $$
  select * from perfis
  where user_id = auth.uid() and ativo = true
  limit 1;
$$ language sql stable security definer set search_path = public;

create policy "perfil ativo read escolas" on escolas
  for select to authenticated
  using (id = (select escola_id from current_perfil()));

create policy "perfil ativo update escolas" on escolas
  for update to authenticated
  using (id = (select escola_id from current_perfil()))
  with check (id = (select escola_id from current_perfil()));

create policy "perfil self read" on perfis
  for select to authenticated
  using (user_id = auth.uid() or escola_id = (select escola_id from current_perfil()));

create policy "perfil admin manage" on perfis
  for all to authenticated
  using (
    escola_id = (select escola_id from current_perfil())
    and (select perfil from current_perfil()) = 'admin'
  )
  with check (
    escola_id = (select escola_id from current_perfil())
    and (select perfil from current_perfil()) = 'admin'
  );
```

- [ ] **Step 2: Aplicar migration localmente**

Run: `npx supabase db reset` (cuidado: derruba dados locais; em dev é OK)
Expected: migrations rodam até a nova sem erro.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/202605160001_auth_real_rls.sql
git commit -m "feat(db): add current_perfil helper and policies for escolas/perfis"
```

---

### Task 7: Migration RLS — tabelas com `escola_id`

**Files:**
- Modify: `supabase/migrations/202605160001_auth_real_rls.sql`

- [ ] **Step 1: Adicionar policies ao final do arquivo**

```sql
create policy "perfil ativo full access alunos" on alunos
  for all to authenticated
  using (escola_id = (select escola_id from current_perfil()))
  with check (escola_id = (select escola_id from current_perfil()));

create policy "perfil ativo full access series" on series
  for all to authenticated
  using (escola_id = (select escola_id from current_perfil()))
  with check (escola_id = (select escola_id from current_perfil()));

create policy "perfil ativo full access turmas" on turmas
  for all to authenticated
  using (escola_id = (select escola_id from current_perfil()))
  with check (escola_id = (select escola_id from current_perfil()));

create policy "perfil ativo full access planos" on planos
  for all to authenticated
  using (escola_id = (select escola_id from current_perfil()))
  with check (escola_id = (select escola_id from current_perfil()));

create policy "perfil ativo full access matriculas" on matriculas
  for all to authenticated
  using (escola_id = (select escola_id from current_perfil()))
  with check (escola_id = (select escola_id from current_perfil()));

create policy "perfil ativo full access frequencias" on frequencias
  for all to authenticated
  using (escola_id = (select escola_id from current_perfil()))
  with check (escola_id = (select escola_id from current_perfil()));

create policy "perfil ativo full access cobrancas" on cobrancas
  for all to authenticated
  using (escola_id = (select escola_id from current_perfil()))
  with check (escola_id = (select escola_id from current_perfil()));

create policy "perfil ativo full access pagamentos" on pagamentos
  for all to authenticated
  using (escola_id = (select escola_id from current_perfil()))
  with check (escola_id = (select escola_id from current_perfil()));

create policy "perfil ativo full access arquivos" on arquivos_importados
  for all to authenticated
  using (escola_id = (select escola_id from current_perfil()))
  with check (escola_id = (select escola_id from current_perfil()));
```

- [ ] **Step 2: Aplicar migration**

Run: `npx supabase db reset`
Expected: sucesso.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/202605160001_auth_real_rls.sql
git commit -m "feat(db): add escola-scoped RLS policies for core tables"
```

---

### Task 8: Migration RLS — tabelas filhas via `aluno_id`

**Files:**
- Modify: `supabase/migrations/202605160001_auth_real_rls.sql`

- [ ] **Step 1: Adicionar policies ao final**

```sql
create policy "perfil ativo full access enderecos" on enderecos_aluno
  for all to authenticated
  using (exists (
    select 1 from alunos a
    where a.id = aluno_id and a.escola_id = (select escola_id from current_perfil())
  ))
  with check (exists (
    select 1 from alunos a
    where a.id = aluno_id and a.escola_id = (select escola_id from current_perfil())
  ));

create policy "perfil ativo full access contatos" on contatos_aluno
  for all to authenticated
  using (exists (
    select 1 from alunos a
    where a.id = aluno_id and a.escola_id = (select escola_id from current_perfil())
  ))
  with check (exists (
    select 1 from alunos a
    where a.id = aluno_id and a.escola_id = (select escola_id from current_perfil())
  ));

create policy "perfil ativo full access responsaveis" on responsaveis_aluno
  for all to authenticated
  using (exists (
    select 1 from alunos a
    where a.id = aluno_id and a.escola_id = (select escola_id from current_perfil())
  ))
  with check (exists (
    select 1 from alunos a
    where a.id = aluno_id and a.escola_id = (select escola_id from current_perfil())
  ));

create policy "perfil ativo full access autorizadas" on pessoas_autorizadas
  for all to authenticated
  using (exists (
    select 1 from alunos a
    where a.id = aluno_id and a.escola_id = (select escola_id from current_perfil())
  ))
  with check (exists (
    select 1 from alunos a
    where a.id = aluno_id and a.escola_id = (select escola_id from current_perfil())
  ));

create policy "perfil ativo full access medicas" on informacoes_medicas
  for all to authenticated
  using (exists (
    select 1 from alunos a
    where a.id = aluno_id and a.escola_id = (select escola_id from current_perfil())
  ))
  with check (exists (
    select 1 from alunos a
    where a.id = aluno_id and a.escola_id = (select escola_id from current_perfil())
  ));

create policy "perfil ativo full access aut aluno" on autorizacoes_aluno
  for all to authenticated
  using (exists (
    select 1 from alunos a
    where a.id = aluno_id and a.escola_id = (select escola_id from current_perfil())
  ))
  with check (exists (
    select 1 from alunos a
    where a.id = aluno_id and a.escola_id = (select escola_id from current_perfil())
  ));
```

- [ ] **Step 2: Aplicar migration**

Run: `npx supabase db reset`
Expected: sucesso.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/202605160001_auth_real_rls.sql
git commit -m "feat(db): add RLS policies for student child tables"
```

---

### Task 9: Migration RLS — tabelas adicionadas em migrations posteriores

**Files:**
- Modify: `supabase/migrations/202605160001_auth_real_rls.sql`

- [ ] **Step 1: Inspecionar tabelas criadas em migrations 202605140001 a 202605150001**

Run: `Get-Content supabase/migrations/202605140001_student_documents.sql, supabase/migrations/202605140002_gate_access.sql, supabase/migrations/202605140003_face_biometrics.sql, supabase/migrations/202605140004_enrollment_history.sql, supabase/migrations/202605150001_student_import_pipeline.sql | Select-String "create table"`
Expected: lista de tabelas. Anotar nomes e se possuem `escola_id` direto ou referência a `aluno_id`/`matricula_id`.

- [ ] **Step 2: Adicionar drop + create policy para cada tabela identificada**

Para cada tabela com `escola_id`:

```sql
drop policy if exists "service role full access <tabela>" on <tabela>;

create policy "perfil ativo full access <tabela>" on <tabela>
  for all to authenticated
  using (escola_id = (select escola_id from current_perfil()))
  with check (escola_id = (select escola_id from current_perfil()));
```

Para cada tabela com `aluno_id`:

```sql
drop policy if exists "service role full access <tabela>" on <tabela>;

create policy "perfil ativo full access <tabela>" on <tabela>
  for all to authenticated
  using (exists (
    select 1 from alunos a
    where a.id = aluno_id and a.escola_id = (select escola_id from current_perfil())
  ))
  with check (exists (
    select 1 from alunos a
    where a.id = aluno_id and a.escola_id = (select escola_id from current_perfil())
  ));
```

- [ ] **Step 3: Aplicar migration**

Run: `npx supabase db reset`
Expected: sucesso.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/202605160001_auth_real_rls.sql
git commit -m "feat(db): extend RLS policies to documents, gate, biometrics, enrollment history, import pipeline"
```

---

### Task 10: Migration RLS — storage buckets

**Files:**
- Modify: `supabase/migrations/202605160001_auth_real_rls.sql`

- [ ] **Step 1: Adicionar ao final**

```sql
update storage.buckets set public = false where id = 'alunos-fotos';

create policy "perfil ativo read fotos" on storage.objects
  for select to authenticated
  using (bucket_id = 'alunos-fotos' and exists (select 1 from current_perfil()));

create policy "perfil ativo write fotos" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'alunos-fotos' and exists (select 1 from current_perfil()));

create policy "perfil ativo update fotos" on storage.objects
  for update to authenticated
  using (bucket_id = 'alunos-fotos' and exists (select 1 from current_perfil()))
  with check (bucket_id = 'alunos-fotos' and exists (select 1 from current_perfil()));

create policy "perfil ativo delete fotos" on storage.objects
  for delete to authenticated
  using (bucket_id = 'alunos-fotos' and exists (select 1 from current_perfil()));

create policy "perfil ativo read documentos" on storage.objects
  for select to authenticated
  using (bucket_id = 'documentos-alunos' and exists (select 1 from current_perfil()));

create policy "perfil ativo write documentos" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'documentos-alunos' and exists (select 1 from current_perfil()));

create policy "perfil ativo update documentos" on storage.objects
  for update to authenticated
  using (bucket_id = 'documentos-alunos' and exists (select 1 from current_perfil()))
  with check (bucket_id = 'documentos-alunos' and exists (select 1 from current_perfil()));

create policy "perfil ativo delete documentos" on storage.objects
  for delete to authenticated
  using (bucket_id = 'documentos-alunos' and exists (select 1 from current_perfil()));

create policy "perfil ativo read importacoes" on storage.objects
  for select to authenticated
  using (bucket_id = 'importacoes' and exists (select 1 from current_perfil()));

create policy "perfil ativo write importacoes" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'importacoes' and exists (select 1 from current_perfil()));
```

- [ ] **Step 2: Aplicar**

Run: `npx supabase db reset`
Expected: sucesso. Verificar em `http://127.0.0.1:55423` (Studio) que bucket `alunos-fotos` aparece como privado.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/202605160001_auth_real_rls.sql
git commit -m "feat(db): privatize alunos-fotos bucket and add storage policies"
```

---

### Task 11: Extrair `ensureDefaultAdmin` para script

**Files:**
- Create: `scripts/seed-admin.mjs`
- Modify: `package.json`

- [ ] **Step 1: Escrever script**

```js
import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.env.APP_DEFAULT_ADMIN_EMAIL ?? "admin@rrbescola.local";
const password = process.env.APP_DEFAULT_ADMIN_PASSWORD ?? "rrb123456";
const escolaId = process.env.DEFAULT_SCHOOL_ID ?? "00000000-0000-0000-0000-000000000001";

if (!url || !serviceKey) {
  console.error("NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
});

const { data: list, error: listError } = await supabase.auth.admin.listUsers();
if (listError) {
  console.error("Falha ao listar usuários:", listError.message);
  process.exit(1);
}

let user = list.users.find((item) => item.email === email);
if (!user) {
  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nome: "Administrador RRB Escola" }
  });
  if (createError) {
    console.error("Falha ao criar admin:", createError.message);
    process.exit(1);
  }
  user = created.user;
  console.log("Admin criado:", email);
} else {
  console.log("Admin já existe:", email);
}

if (user) {
  const { error: upsertError } = await supabase.from("perfis").upsert(
    {
      user_id: user.id,
      escola_id: escolaId,
      nome: "Administrador RRB Escola",
      email,
      perfil: "admin",
      ativo: true
    },
    { onConflict: "user_id" }
  );
  if (upsertError) {
    console.error("Falha ao garantir perfil:", upsertError.message);
    process.exit(1);
  }
  console.log("Perfil admin garantido.");
}
```

- [ ] **Step 2: Atualizar script em `package.json`**

Substituir:
```json
"seed:auth": "node scripts/create-admin.mjs"
```
por:
```json
"seed:auth": "node scripts/seed-admin.mjs"
```

(Se `scripts/create-admin.mjs` ainda for usado, manter; senão remover em commit separado.)

- [ ] **Step 3: Rodar seed**

Run: `npm run seed:auth`
Expected: log `Admin criado: admin@rrbescola.local` (ou "já existe") + `Perfil admin garantido.`

- [ ] **Step 4: Commit**

```bash
git add scripts/seed-admin.mjs package.json
git commit -m "feat: extract ensureDefaultAdmin into seed script"
```

---

### Task 12: Refactor `loginAction` / `logoutAction`

**Files:**
- Modify: `src/lib/actions/auth.ts`

- [ ] **Step 1: Substituir conteúdo**

```ts
"use server";

import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { formText } from "@/lib/utils";

export async function loginAction(formData: FormData) {
  const email = formText(formData, "email");
  const password = formText(formData, "password");
  if (!email || !password) redirect("/login?erro=credenciais");

  const supabase = await createServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect("/login?erro=auth");

  const { data: perfil } = await supabase
    .from("perfis")
    .select("ativo")
    .maybeSingle();

  if (!perfil?.ativo) {
    await supabase.auth.signOut();
    redirect("/login?erro=perfil");
  }
  redirect("/");
}

export async function logoutAction() {
  const supabase = await createServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: passa.

- [ ] **Step 3: Commit**

```bash
git add src/lib/actions/auth.ts
git commit -m "refactor(auth): use SSR client with cookie sessions and validate active profile"
```

---

### Task 13: Remover `ensureDefaultAdmin` de `LoginPage` + tratar erro de perfil

**Files:**
- Modify: `src/app/(auth)/login/page.tsx`

- [ ] **Step 1: Remover import e chamada de `ensureDefaultAdmin`; expandir mensagens de erro**

Localizar e remover:
```ts
import { ensureDefaultAdmin, loginAction } from "@/lib/actions/auth";
```
trocando por:
```ts
import { loginAction } from "@/lib/actions/auth";
```

Remover linha:
```ts
await ensureDefaultAdmin();
```

Substituir bloco de erro:
```tsx
{error ? <p className="mb-4 rounded-ui bg-clay/10 p-3 text-sm font-bold text-clay">Credenciais invalidas.</p> : null}
```

Por:
```tsx
{error ? (
  <p className="mb-4 rounded-ui bg-clay/10 p-3 text-sm font-bold text-clay">
    {error === "perfil"
      ? "Sem perfil ativo. Solicite acesso ao administrador."
      : error === "credenciais"
        ? "Informe email e senha."
        : "Credenciais invalidas."}
  </p>
) : null}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: passa.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(auth\)/login/page.tsx
git commit -m "refactor(login): remove ensureDefaultAdmin side-effect and expand error messages"
```

---

### Task 14: Proteger `(app)/layout.tsx` com `requireSession`

**Files:**
- Modify: `src/app/(app)/layout.tsx`

- [ ] **Step 1: Substituir conteúdo**

```tsx
import { Topbar } from "@/components/layout/topbar";
import { requireSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  return (
    <div className="ds-shell">
      <Topbar perfil={session.profile} />
      <main>
        <div className="mx-auto min-h-[calc(100vh-72px)] max-w-7xl px-4 py-6 sm:px-6 lg:px-8">{children}</div>
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: erro em `Topbar` por prop nova — corrigido na Task 15. Marcar como esperado.

- [ ] **Step 3: Commit (deferido até Task 15)**

Não commit ainda; combina com mudança no Topbar.

---

### Task 15: Topbar exibe perfil + link Usuários

**Files:**
- Modify: `src/components/layout/topbar.tsx`

- [ ] **Step 1: Atualizar componente**

Adicionar import:
```ts
import type { SessionProfile } from "@/lib/auth/session";
```

Trocar assinatura:
```tsx
export function Topbar({ perfil }: { perfil: SessionProfile }) {
```

Adicionar `Usuários` em `secondaryItems`:
```ts
{ href: "/usuarios", label: "Usuarios", icon: "UsersRound" },
```

Adicionar bloco antes do `<form action={logoutAction}>`:
```tsx
<div className="hidden text-right text-xs leading-tight md:block">
  <strong className="block font-bold text-ink">{perfil.nome}</strong>
  <span className="block font-medium text-muted">{perfil.email}</span>
</div>
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: passa (Task 14 fica consistente).

- [ ] **Step 3: Commit (junto com Task 14)**

```bash
git add src/app/\(app\)/layout.tsx src/components/layout/topbar.tsx
git commit -m "feat(layout): require session in app layout and show profile in topbar"
```

---

### Task 16: Aposentar `src/lib/supabase/public.ts`

**Files:**
- Delete: `src/lib/supabase/public.ts`

- [ ] **Step 1: Confirmar nenhum import remanescente**

Run (Grep): pattern `from "@/lib/supabase/public"` no diretório `src`.
Expected: 0 matches (após Task 12 o último uso saiu).

Se houver match, parar e migrar uso para `createServerClient`.

- [ ] **Step 2: Remover arquivo**

Run: `Remove-Item src/lib/supabase/public.ts`
Expected: arquivo deletado.

- [ ] **Step 3: Typecheck + build**

Run: `npm run typecheck`
Run: `npm run build`
Expected: passam.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove obsolete public Supabase client"
```

---

### Checkpoint 1 — Validação manual da Fase 1

- [ ] **Step 1: Rodar app**

Run: `npm run dev`
Expected: server inicia em `http://localhost:3000`.

- [ ] **Step 2: Validar fluxo**

- Acessar `http://localhost:3000/` sem cookies → redirect `/login`.
- Login com `admin@rrbescola.local` / `rrb123456` → redirect `/`.
- Reload `/` → continua logado (sessão persiste).
- Clicar logout → redirect `/login`.
- Acessar `/alunos` sem cookies → redirect `/login`.

Dashboard pode mostrar dados vazios ou erros parciais; data layer ainda usa service role — esperado.

- [ ] **Step 3: Anotar issues e seguir para Fase 2**

---

## Fase 2 — Data fetchers

Padrão idêntico para todos os 9 arquivos. Cada task: trocar `createAdminClient()` por `await createServerClient()`, manter resto da lógica.

### Task 17: Migrar `src/lib/data/lookups.ts`

**Files:**
- Modify: `src/lib/data/lookups.ts`

- [ ] **Step 1: Substituir import**

Antes:
```ts
import { createAdminClient } from "@/lib/supabase/admin";
```
Depois:
```ts
import { createServerClient } from "@/lib/supabase/server";
```

- [ ] **Step 2: Substituir todas chamadas**

Trocar todas ocorrências de `createAdminClient()` por `await createServerClient()` no arquivo. Função consumidora pode precisar virar `async` (provavelmente já é).

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: passa.

- [ ] **Step 4: Testar página dependente**

Rodar dev. Acessar `/series`, `/turmas`, `/planos`. Verificar listagens funcionam.

- [ ] **Step 5: Commit**

```bash
git add src/lib/data/lookups.ts
git commit -m "refactor(data): migrate lookups to authenticated SSR client"
```

---

### Task 18: Migrar `src/lib/data/dashboard.ts`

**Files:**
- Modify: `src/lib/data/dashboard.ts`

- [ ] **Step 1: Substituir cliente**

Mesmo padrão da Task 17.

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: passa.

- [ ] **Step 3: Testar**

Acessar `/`. Dashboard deve carregar (gráficos, cards).

- [ ] **Step 4: Commit**

```bash
git add src/lib/data/dashboard.ts
git commit -m "refactor(data): migrate dashboard to authenticated SSR client"
```

---

### Task 19: Migrar `src/lib/data/students.ts`

**Files:**
- Modify: `src/lib/data/students.ts`

- [ ] **Step 1: Substituir cliente**

Mesmo padrão.

- [ ] **Step 2: Typecheck + teste página `/alunos` e `/alunos/[id]`**

Run: `npm run typecheck`. Acessar `/alunos`. Abrir ficha de aluno.

- [ ] **Step 3: Commit**

```bash
git add src/lib/data/students.ts
git commit -m "refactor(data): migrate students to authenticated SSR client"
```

---

### Task 20: Migrar `src/lib/data/enrollments.ts`

**Files:**
- Modify: `src/lib/data/enrollments.ts`

- [ ] **Step 1: Substituir cliente**

- [ ] **Step 2: Typecheck + testar `/matriculas`**

- [ ] **Step 3: Commit**

```bash
git add src/lib/data/enrollments.ts
git commit -m "refactor(data): migrate enrollments to authenticated SSR client"
```

---

### Task 21: Migrar `src/lib/data/finance.ts`

**Files:**
- Modify: `src/lib/data/finance.ts`

- [ ] **Step 1: Substituir cliente**

- [ ] **Step 2: Typecheck + testar `/financeiro` e `/relatorios/inadimplencia`**

- [ ] **Step 3: Commit**

```bash
git add src/lib/data/finance.ts
git commit -m "refactor(data): migrate finance to authenticated SSR client"
```

---

### Task 22: Migrar `src/lib/data/attendance.ts`

**Files:**
- Modify: `src/lib/data/attendance.ts`

- [ ] **Step 1: Substituir cliente**

- [ ] **Step 2: Typecheck + testar `/frequencias` e `/relatorios/frequencia`**

- [ ] **Step 3: Commit**

```bash
git add src/lib/data/attendance.ts
git commit -m "refactor(data): migrate attendance to authenticated SSR client"
```

---

### Task 23: Migrar `src/lib/data/documents.ts`

**Files:**
- Modify: `src/lib/data/documents.ts`

- [ ] **Step 1: Substituir cliente**

- [ ] **Step 2: Typecheck + testar fluxo documentos**

- [ ] **Step 3: Commit**

```bash
git add src/lib/data/documents.ts
git commit -m "refactor(data): migrate documents to authenticated SSR client"
```

---

### Task 24: Migrar `src/lib/data/gate.ts`

**Files:**
- Modify: `src/lib/data/gate.ts`

- [ ] **Step 1: Substituir cliente para chamadas vindas da UI**

Se houver função usada pela API portaria, manter `createAdminClient()` com comentário:
```ts
// service role: invocado pela API portaria (autenticação por GATE_API_TOKEN)
```

Para chamadas UI: trocar.

- [ ] **Step 2: Typecheck + testar `/portaria`**

- [ ] **Step 3: Commit**

```bash
git add src/lib/data/gate.ts
git commit -m "refactor(data): migrate gate UI fetchers to SSR client, keep service role for API"
```

---

### Task 25: Migrar `src/lib/data/imports.ts`

**Files:**
- Modify: `src/lib/data/imports.ts`

- [ ] **Step 1: Substituir cliente**

- [ ] **Step 2: Typecheck + testar `/importacoes`**

- [ ] **Step 3: Commit**

```bash
git add src/lib/data/imports.ts
git commit -m "refactor(data): migrate imports to authenticated SSR client"
```

---

### Checkpoint 2 — Validação Fase 2

- [ ] **Step 1: Rodar dev e percorrer todas rotas listando dados**

`/`, `/alunos`, `/alunos/[id]`, `/matriculas`, `/financeiro`, `/frequencias`, `/portaria`, `/series`, `/turmas`, `/planos`, `/importacoes`, `/relatorios/alunos`, `/relatorios/inadimplencia`, `/relatorios/frequencia`.

Expected: todas listagens carregam dados via RLS.

- [ ] **Step 2: Verificar erros no console do navegador**

Anotar e investigar antes de seguir.

---

## Fase 3 — Server actions

### Task 26: Migrar `src/lib/actions/academics.ts`

**Files:**
- Modify: `src/lib/actions/academics.ts`

- [ ] **Step 1: Trocar imports**

Antes: `import { createAdminClient } from "@/lib/supabase/admin";`
Depois:
```ts
import { createServerClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/auth/session";
```

- [ ] **Step 2: Adicionar `await requireSession()` no topo de cada server action exportada**

Padrão para cada função `export async function xxxAction(...)`:
```ts
export async function xxxAction(formData: FormData) {
  await requireSession();
  const supabase = await createServerClient();
  // resto da lógica
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: passa.

- [ ] **Step 4: Testar criar/editar série/turma/plano**

- [ ] **Step 5: Commit**

```bash
git add src/lib/actions/academics.ts
git commit -m "refactor(actions): migrate academics to authenticated client with requireSession"
```

---

### Task 27: Migrar `src/lib/actions/students.ts`

**Files:**
- Modify: `src/lib/actions/students.ts`

- [ ] **Step 1: Trocar cliente + requireSession** (mesmo padrão da Task 26)

- [ ] **Step 2: Typecheck + testar criar/editar aluno**

- [ ] **Step 3: Commit**

```bash
git add src/lib/actions/students.ts
git commit -m "refactor(actions): migrate students to authenticated client"
```

---

### Task 28: Migrar `src/lib/actions/attendance.ts`

**Files:**
- Modify: `src/lib/actions/attendance.ts`

- [ ] **Step 1: Trocar cliente + requireSession**

- [ ] **Step 2: Typecheck + testar registrar frequência**

- [ ] **Step 3: Commit**

```bash
git add src/lib/actions/attendance.ts
git commit -m "refactor(actions): migrate attendance to authenticated client"
```

---

### Task 29: Migrar `src/lib/actions/finance.ts`

**Files:**
- Modify: `src/lib/actions/finance.ts`

- [ ] **Step 1: Identificar funções de UI vs batch**

Funções que chamam `generate-charges` (batch) — manter chamada para `createAdminClient()` apenas naquela função interna, mas a action que dispara segue regra de `requireSession()` antes.

- [ ] **Step 2: Migrar restante para SSR client**

Padrão Task 26.

- [ ] **Step 3: Typecheck + testar registrar pagamento**

- [ ] **Step 4: Commit**

```bash
git add src/lib/actions/finance.ts
git commit -m "refactor(actions): migrate finance UI actions to authenticated client"
```

---

### Task 30: Migrar `src/lib/actions/documents.ts`

**Files:**
- Modify: `src/lib/actions/documents.ts`

- [ ] **Step 1: Trocar cliente + requireSession**

- [ ] **Step 2: Typecheck + testar upload/listagem de documento**

- [ ] **Step 3: Commit**

```bash
git add src/lib/actions/documents.ts
git commit -m "refactor(actions): migrate documents to authenticated client"
```

---

### Task 31: Migrar `src/lib/actions/imports.ts` (parcial)

**Files:**
- Modify: `src/lib/actions/imports.ts`

- [ ] **Step 1: Migrar criação/listagem de registros**

Funções tipo `criarImportacaoAction(formData)` (UI): troca cliente + `requireSession()`.

- [ ] **Step 2: Manter service role no disparo do parser batch**

Linha tipo:
```ts
// service role: processador de PDF roda fora de sessão de usuário
const admin = createAdminClient();
await processarPdfArquivo(admin, arquivoId);
```

- [ ] **Step 3: Typecheck + testar upload de PDF**

- [ ] **Step 4: Commit**

```bash
git add src/lib/actions/imports.ts
git commit -m "refactor(actions): migrate imports UI to authenticated client, keep batch admin"
```

---

### Task 32: Migrar `src/lib/actions/gate.ts` (parcial)

**Files:**
- Modify: `src/lib/actions/gate.ts`

- [ ] **Step 1: Identificar funções UI**

Server actions invocadas por componentes (CRUD de pessoas autorizadas, biometrias, etc.) — migra para SSR + `requireSession()`.

- [ ] **Step 2: Manter service role nas helpers compartilhadas com API**

Adicionar comentário inline:
```ts
// service role: chamada também pela API /api/portaria/* (autenticada por GATE_API_TOKEN)
```

- [ ] **Step 3: Typecheck + testar fluxo `/portaria`**

- [ ] **Step 4: Commit**

```bash
git add src/lib/actions/gate.ts
git commit -m "refactor(actions): migrate gate UI actions to SSR client, document service role for API"
```

---

### Task 33: Documentar service role em arquivos `src/lib/server/*`

**Files:**
- Modify: `src/lib/server/generate-charges.ts`
- Modify: `src/lib/server/gate-events.ts`
- Modify: `src/lib/server/guardian-notifications.ts`
- Modify: `src/lib/server/student-import-parser.ts`

- [ ] **Step 1: Adicionar comentário no topo de cada uso de `createAdminClient()`**

Em `generate-charges.ts`:
```ts
// service role: geração de cobranças em batch (executada por script/cron, fora de sessão)
```

Em `gate-events.ts`:
```ts
// service role: invocado pela API /api/portaria/* (autenticada por GATE_API_TOKEN)
```

Em `guardian-notifications.ts`:
```ts
// service role: notificações disparadas por evento da API portaria
```

Em `student-import-parser.ts`:
```ts
// service role: processamento batch do PDF (worker fora de sessão)
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: passa.

- [ ] **Step 3: Commit**

```bash
git add src/lib/server/
git commit -m "docs: justify remaining service role usage in server helpers"
```

---

### Checkpoint 3 — Validação Fase 3

- [ ] **Step 1: Testar CRUD via UI**

- Criar aluno → listar → editar → excluir.
- Criar matrícula → consultar.
- Registrar pagamento → ver baixa.
- Registrar frequência → consultar relatório.
- Upload de documento → listar.
- Subir PDF de importação → ver status.

Expected: tudo funciona via cliente autenticado. RLS bloqueia se sessão expirar.

- [ ] **Step 2: Verificar log do Supabase (Studio)**

Confirmar requests autenticadas (não service role para CRUD UI).

---

## Fase 4 — Tela usuários + storage

### Task 34: Helper signed URL de foto

**Files:**
- Create: `src/lib/storage/photos.ts`

- [ ] **Step 1: Escrever helper**

```ts
import "server-only";
import { createServerClient } from "@/lib/supabase/server";

const SIGNED_TTL_SECONDS = 60 * 60;

export async function getSignedFotoUrl(path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  const supabase = await createServerClient();
  const { data, error } = await supabase.storage
    .from("alunos-fotos")
    .createSignedUrl(path, SIGNED_TTL_SECONDS);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: passa.

- [ ] **Step 3: Commit**

```bash
git add src/lib/storage/photos.ts
git commit -m "feat(storage): add signed URL helper for student photos"
```

---

### Task 35: Auditar e migrar consumidores de `foto_url`

**Files:**
- Audit: todos componentes que renderizam `foto_url`

- [ ] **Step 1: Localizar usos**

Run (Grep): pattern `foto_url` em `src/`.
Listar arquivos.

- [ ] **Step 2: Para cada Server Component que renderiza `<img src={aluno.foto_url}>`**

Transformar:
```tsx
const fotoSrc = await getSignedFotoUrl(aluno.foto_url);
return <img src={fotoSrc ?? "/placeholder.png"} alt={aluno.nome} />;
```

Importar `getSignedFotoUrl` de `@/lib/storage/photos`.

- [ ] **Step 3: Para Client Components**

Receber `fotoSrc` resolvido por prop vinda do Server Component pai. Não chamar helper no client.

- [ ] **Step 4: Typecheck + testar renderização da ficha do aluno e listagem**

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor(storage): render student photos via signed URL"
```

---

### Task 36: Atualizar `foto_url` no schema para guardar path

**Files:**
- Audit: server action que faz upload de foto (provavelmente em `students.ts` ou `documents.ts`)

- [ ] **Step 1: Localizar upload**

Run (Grep): pattern `alunos-fotos` em `src/lib`.

- [ ] **Step 2: Garantir que `foto_url` armazena apenas o `path` dentro do bucket**

Se hoje armazena URL pública completa, ajustar para guardar apenas `path` (ex: `alunos/123.jpg`). Migrar dados existentes via SQL ad-hoc se necessário.

```sql
-- ad-hoc, rodado manualmente em dev se preciso
update alunos
set foto_url = regexp_replace(foto_url, '^.*?/alunos-fotos/', '')
where foto_url like 'http%';
```

- [ ] **Step 3: Typecheck + testar upload novo de foto + render**

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor(storage): store only bucket path in alunos.foto_url"
```

---

### Task 37: Server action criar/desativar usuário

**Files:**
- Create: `src/lib/actions/users.ts`

- [ ] **Step 1: Escrever actions**

```ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin"; // service role: supabase.auth.admin.createUser requer
import { formText } from "@/lib/utils";

function generatePassword() {
  return Array.from(crypto.getRandomValues(new Uint8Array(12)))
    .map((b) => b.toString(36).padStart(2, "0"))
    .join("")
    .slice(0, 16);
}

export async function createUserAction(formData: FormData) {
  const session = await requireAdmin();
  const email = formText(formData, "email");
  const nome = formText(formData, "nome");
  if (!email || !nome) redirect("/usuarios/novo?erro=campos");

  const password = generatePassword();
  const admin = createAdminClient();
  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nome }
  });
  if (error || !created.user) redirect(`/usuarios/novo?erro=auth`);

  const { error: perfilError } = await admin.from("perfis").insert({
    user_id: created.user.id,
    escola_id: session.profile.escola_id,
    nome,
    email,
    perfil: "admin",
    ativo: true
  });
  if (perfilError) {
    await admin.auth.admin.deleteUser(created.user.id);
    redirect(`/usuarios/novo?erro=perfil`);
  }

  revalidatePath("/usuarios");
  redirect(`/usuarios?criado=${encodeURIComponent(email)}&senha=${encodeURIComponent(password)}`);
}

export async function deactivateUserAction(formData: FormData) {
  await requireAdmin();
  const perfilId = formText(formData, "perfilId");
  if (!perfilId) redirect("/usuarios?erro=id");

  const admin = createAdminClient(); // service role: atualização de perfil admin
  const { error } = await admin
    .from("perfis")
    .update({ ativo: false })
    .eq("id", perfilId);
  if (error) redirect("/usuarios?erro=desativar");

  revalidatePath("/usuarios");
  redirect("/usuarios?desativado=1");
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: passa.

- [ ] **Step 3: Commit**

```bash
git add src/lib/actions/users.ts
git commit -m "feat(users): add create/deactivate user actions for admins"
```

---

### Task 38: Página de listagem `/usuarios`

**Files:**
- Create: `src/app/(app)/usuarios/page.tsx`

- [ ] **Step 1: Escrever página**

```tsx
import Link from "next/link";
import { requireAdmin } from "@/lib/auth/session";
import { createServerClient } from "@/lib/supabase/server";
import { deactivateUserAction } from "@/lib/actions/users";

export const dynamic = "force-dynamic";

export default async function UsuariosPage({ searchParams }: { searchParams: { criado?: string; senha?: string; desativado?: string; erro?: string } }) {
  await requireAdmin();
  const supabase = await createServerClient();
  const { data: perfis } = await supabase
    .from("perfis")
    .select("id, nome, email, perfil, ativo, created_at")
    .order("created_at", { ascending: false });

  return (
    <section className="ds-section">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <p className="ds-kicker">Administracao</p>
          <h1 className="font-serif text-3xl text-ink">Usuarios</h1>
        </div>
        <Link href="/usuarios/novo" className="ds-button ds-button-primary">Novo usuario</Link>
      </header>

      {searchParams.criado ? (
        <div className="mb-4 rounded-ui bg-success/10 p-4 text-sm font-bold text-success">
          Usuario {searchParams.criado} criado. Senha inicial: <code>{searchParams.senha}</code>
        </div>
      ) : null}
      {searchParams.desativado ? (
        <div className="mb-4 rounded-ui bg-success/10 p-4 text-sm font-bold text-success">Usuario desativado.</div>
      ) : null}
      {searchParams.erro ? (
        <div className="mb-4 rounded-ui bg-clay/10 p-4 text-sm font-bold text-clay">Falha: {searchParams.erro}</div>
      ) : null}

      <table className="ds-table w-full">
        <thead>
          <tr>
            <th>Nome</th><th>Email</th><th>Perfil</th><th>Status</th><th></th>
          </tr>
        </thead>
        <tbody>
          {(perfis ?? []).map((p) => (
            <tr key={p.id}>
              <td>{p.nome}</td>
              <td>{p.email}</td>
              <td>{p.perfil}</td>
              <td>{p.ativo ? "Ativo" : "Inativo"}</td>
              <td>
                {p.ativo ? (
                  <form action={deactivateUserAction}>
                    <input type="hidden" name="perfilId" value={p.id} />
                    <button className="ds-button ds-button-ghost">Desativar</button>
                  </form>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: passa.

- [ ] **Step 3: Testar `/usuarios`**

Logado como admin: ver lista contendo admin seed.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(app\)/usuarios/page.tsx
git commit -m "feat(users): add admin users listing page"
```

---

### Task 39: Página de criação `/usuarios/novo`

**Files:**
- Create: `src/app/(app)/usuarios/novo/page.tsx`

- [ ] **Step 1: Escrever página**

```tsx
import Link from "next/link";
import { requireAdmin } from "@/lib/auth/session";
import { createUserAction } from "@/lib/actions/users";

export const dynamic = "force-dynamic";

export default async function NovoUsuarioPage({ searchParams }: { searchParams: { erro?: string } }) {
  await requireAdmin();

  return (
    <section className="ds-section max-w-lg">
      <header className="mb-6">
        <p className="ds-kicker">Administracao</p>
        <h1 className="font-serif text-3xl text-ink">Novo usuario</h1>
        <p className="mt-2 text-sm text-muted">Senha aleatoria sera gerada e exibida apos criar.</p>
      </header>

      {searchParams.erro ? (
        <div className="mb-4 rounded-ui bg-clay/10 p-3 text-sm font-bold text-clay">
          {searchParams.erro === "campos"
            ? "Informe nome e email."
            : searchParams.erro === "auth"
              ? "Falha ao criar usuario no Supabase."
              : searchParams.erro === "perfil"
                ? "Falha ao criar perfil."
                : "Falha desconhecida."}
        </div>
      ) : null}

      <form action={createUserAction} className="grid gap-4">
        <label>
          Nome
          <input name="nome" type="text" required />
        </label>
        <label>
          Email
          <input name="email" type="email" required />
        </label>
        <div className="flex gap-3">
          <button className="ds-button ds-button-primary">Criar</button>
          <Link href="/usuarios" className="ds-button ds-button-secondary">Cancelar</Link>
        </div>
      </form>
    </section>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: passa.

- [ ] **Step 3: Testar criar usuário novo**

- Acessar `/usuarios/novo`, preencher, submeter.
- Confirmar tela `/usuarios` exibe senha gerada.
- Fazer logout, logar com novo user. Deve funcionar.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(app\)/usuarios/novo/page.tsx
git commit -m "feat(users): add admin create user page"
```

---

### Checkpoint 4 — Validação Fase 4

- [ ] **Step 1: Criar user novo, desativar, tentar login**

- Logar admin → `/usuarios/novo` → criar `secretaria@rrbescola.local`.
- Logout → login com novo user → deve abrir.
- Logar admin de volta → desativar.
- Logout → tentar login com user desativado → deve voltar para `/login?erro=perfil`.

- [ ] **Step 2: Verificar fotos via signed URL**

- Abrir ficha de aluno com foto cadastrada.
- DevTools → Network → ver request da foto vai para `/storage/v1/object/sign/alunos-fotos/...` (URL com token), não `/storage/v1/object/public/...`.

- [ ] **Step 3: Verificar bucket privado em Studio**

Studio `http://127.0.0.1:55423` → Storage → `alunos-fotos` → propriedade Public = false.

---

## Limpeza final

### Task 40: Audit `createAdminClient`

**Files:**
- Audit: todos arquivos em `src/`

- [ ] **Step 1: Listar todas ocorrências**

Run (Grep): pattern `createAdminClient` em `src/`.
Expected: cada match em arquivo que **não** é `src/lib/supabase/admin.ts` tem comentário inline `// service role: <razão>` na linha anterior ou na mesma.

- [ ] **Step 2: Adicionar comentário onde faltar**

Para cada ocorrência sem comentário, justificar (ou migrar para SSR client se não tiver justificativa).

- [ ] **Step 3: Commit (se houve mudanças)**

```bash
git add -A
git commit -m "docs: ensure every createAdminClient call has service role justification"
```

---

### Task 41: Atualizar README

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Adicionar seção `## Autenticacao`**

Conteúdo:

```markdown
## Autenticacao

App usa Supabase Auth com cookies HTTP-only via `@supabase/ssr`. Toda rota `(app)/*` exige usuario com perfil ativo.

### Variaveis de ambiente

| Variavel | Origem | Uso |
|----------|--------|-----|
| `NEXT_PUBLIC_SUPABASE_URL` | publico | client + server |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | publico | client + server |
| `SUPABASE_SERVICE_ROLE_KEY` | secreto | server only (criacao de user, batch jobs, API portaria) |
| `APP_DEFAULT_ADMIN_EMAIL` | secreto | seed admin |
| `APP_DEFAULT_ADMIN_PASSWORD` | secreto | seed admin |
| `GATE_API_TOKEN` | secreto | autenticacao da API `/api/portaria/*` |

### Fluxo

1. `npm run seed:auth` cria admin default e linha em `perfis`.
2. Login em `/login` cria cookies de sessao.
3. `src/middleware.ts` refresca cookies em toda request e redireciona para `/login` se sem sessao.
4. `(app)/layout.tsx` valida perfil ativo.
5. Server actions e data fetchers usam `createServerClient()` (SSR + RLS).
6. Service role permitido apenas em criacao de user, seed admin, processamento batch e API portaria.

### Criar novo usuario

Logado como admin: acessar `/usuarios/novo`. Senha gerada e exibida uma vez.
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: document real auth setup, env vars, and admin user creation"
```

---

### Task 42: Verificação final — checklist

- [ ] `npm run typecheck` passa
- [ ] `npm run build` passa
- [ ] `npm run lint` passa
- [ ] Login com admin seed → redirect `/`
- [ ] Logout → redirect `/login`
- [ ] Acessar `/` sem cookie → redirect `/login`
- [ ] Acessar `/usuarios` sem cookie → redirect `/login`
- [ ] User com `perfis.ativo=false` → login + signOut + `erro=perfil`
- [ ] Dashboard carrega dados (RLS aplicada)
- [ ] Criar aluno, salvar, listar (escritas via RLS)
- [ ] Pagamento criado aparece (financeiro RLS)
- [ ] Importação de PDF roda (service role justificado)
- [ ] API `/api/portaria/biometrias` retorna 401 sem token e 200 com token
- [ ] Foto de aluno renderiza via signed URL
- [ ] Bucket `alunos-fotos` em Studio = privado
- [ ] Tela `/usuarios` lista admin seed
- [ ] Criar novo user via `/usuarios`, login com ele funciona
- [ ] Desativar user, login bloqueado
- [ ] Grep `createAdminClient` — cada uso tem comentário `// service role: ...`

Se algum item falhar, abrir issue/task de correção antes de fechar.

- [ ] **Step final: Commit de fechamento**

```bash
git commit --allow-empty -m "chore: auth real implementation complete"
```
