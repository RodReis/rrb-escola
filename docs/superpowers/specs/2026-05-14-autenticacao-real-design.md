# Autenticação Real — Design

**Data:** 2026-05-14
**Status:** Aprovado (aguardando revisão final do usuário)
**Escopo:** Item 1 do roadmap (Auth real + RLS + perfis). Base que destrava demais itens (Auditoria, Financeiro v2, etc.).

## Contexto

O app já tem tela de login e schema com tabela `perfis`, mas:

- `loginAction` usa cliente sem cookies (`persistSession: false`, `storage: undefined`) — sessão não persiste.
- Não há middleware Next.js. Rotas `(app)/*` não checam autenticação.
- 21 arquivos usam `createAdminClient()` (service role) — bypass total de RLS.
- RLS está habilitada nas tabelas, mas a única policy é `service_role full access` (efetivamente redundante).
- `ensureDefaultAdmin()` roda toda vez que `/login` carrega (efeito colateral inesperado em página pública).
- Bucket `alunos-fotos` é público (LGPD: foto de menor de idade não deve ter URL pública adivinhável).

## Objetivo

Entregar autenticação real funcionando:

1. Login persiste sessão via cookies HTTP-only.
2. Toda rota `(app)/*` exige usuário autenticado com perfil ativo.
3. Acesso a dados via RLS (service role só onde justificado).
4. Admin pode criar e desativar outros usuários pela UI.
5. Fotos de alunos servidas via signed URL (bucket privado).

## Decisões

| # | Tema | Decisão |
|---|------|---------|
| 1 | Perfis MVP | Só `admin`. Schema mantém enum (`secretaria`, `financeiro`, `professor`) para futuro. |
| 2 | Service role | Migrar todos os 21 arquivos para cliente SSR autenticado. Service role só em casos justificados (documentados inline). |
| 3 | Lib | `@supabase/ssr` (pacote oficial). |
| 4 | RLS | Policies scoped por `escola_id` via helper `current_perfil()`. |
| 5 | Signup | Sem signup público. Admin cria outros users pela tela `/usuarios`. |
| 6 | Proteção rota | Middleware Next.js (refresh sessão + redirect) + check no `(app)/layout.tsx` (valida perfil ativo). |
| 7 | Entrega | Faseada em 4 fases dentro de 1 spec. |
| 8 | Storage | Bucket `alunos-fotos` privado. Signed URL via helper server. |
| 9 | API portaria | Mantém token estático + service role (uso máquina-a-máquina). |
| 10 | Sucesso | Checklist manual obrigatório. Testes automatizados ficam em spec dedicado. |

## Arquitetura

### Clientes Supabase

Três clientes distintos via `@supabase/ssr`:

- **`src/lib/supabase/server.ts`** — `createServerClient()` para Server Components, Server Actions, Route Handlers. Lê/escreve cookies de sessão via `next/headers`. Identidade = usuário logado. Substitui `public.ts`.
- **`src/lib/supabase/middleware.ts`** — cliente especial para middleware. Refresca tokens, atualiza cookies de resposta.
- **`src/lib/supabase/admin.ts`** — mantém. Service role. Uso restrito (documentado).

Aposentar `src/lib/supabase/public.ts`.

### Fluxo de request

1. Request entra → `src/middleware.ts` lê cookies, chama `supabase.auth.getUser()` (refresca/valida JWT), escreve cookies atualizados em response.
2. Se request → rota `(app)/*` sem usuário válido → redirect `/login`.
3. `(app)/layout.tsx` (Server Component) chama `requireSession()`. Se sem perfil ativo → redirect `/login?erro=perfil`.
4. Data fetchers (`src/lib/data/*`) e server actions (`src/lib/actions/*`) usam `createServerClient()`. RLS aplica.
5. `createAdminClient()` restrito a: criação user, seed admin, API portaria, geração cobranças em batch, processador de import PDF.

### Helpers de sessão

`src/lib/auth/session.ts`:

- `getSession()` → retorna `{ user, profile } | null` no server.
- `requireSession()` → throw `redirect("/login")` se ausente. Retorna sessão.
- `requireAdmin()` → throw `redirect("/login?erro=perfil")` se perfil ≠ `admin`.

## RLS Policies

Migration nova: `supabase/migrations/202605160001_auth_real_rls.sql`.

### Drop policies antigas

Remover as policies "service role full access *" — service role bypassa RLS por natureza; a policy é redundante e confunde leitura do esquema.

### Helper SQL

```sql
create or replace function current_perfil()
returns perfis as $$
  select * from perfis
  where user_id = auth.uid() and ativo = true
  limit 1;
$$ language sql stable security definer set search_path = public;
```

### Padrão de policy por tabela

Para cada tabela com `escola_id`:

```sql
create policy "perfil ativo full access alunos" on alunos
  for all to authenticated
  using (escola_id = (select escola_id from current_perfil()))
  with check (escola_id = (select escola_id from current_perfil()));
```

Aplicar em: `escolas` (com `id = escola_id_do_perfil`), `perfis` (self-read + admin manage), `alunos`, `series`, `turmas`, `planos`, `matriculas`, `frequencias`, `cobrancas`, `pagamentos`, `arquivos_importados`.

### Tabelas filhas sem `escola_id`

Para `enderecos_aluno`, `contatos_aluno`, `responsaveis_aluno`, `pessoas_autorizadas`, `informacoes_medicas`, `autorizacoes_aluno` (referenciam `aluno_id`):

```sql
using (exists (
  select 1 from alunos a
  where a.id = aluno_id
    and a.escola_id = (select escola_id from current_perfil())
))
```

### Migrations dependentes

Auditar tabelas criadas em:

- `202605140001_student_documents.sql`
- `202605140002_gate_access.sql`
- `202605140003_face_biometrics.sql`
- `202605140004_enrollment_history.sql`
- `202605150001_student_import_pipeline.sql`

Estender o mesmo padrão de policies para cada tabela nova na mesma migration de auth real.

### Storage policies

```sql
update storage.buckets set public = false where id = 'alunos-fotos';

create policy "perfil ativo read fotos" on storage.objects
  for select to authenticated
  using (bucket_id = 'alunos-fotos' and exists (select 1 from current_perfil()));

create policy "perfil ativo write fotos" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'alunos-fotos' and exists (select 1 from current_perfil()));
```

Mesmo padrão para `documentos-alunos` e `importacoes`.

## Login / Logout / Middleware

### `src/middleware.ts`

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

`api/portaria/*` excluído (autentica por token próprio).

### `src/lib/supabase/middleware.ts`

Função `updateSession(request)`:

1. Cria response inicial passando cookies do request.
2. Cria `createServerClient` com handlers de cookie request/response.
3. Chama `supabase.auth.getUser()` (força refresh, valida JWT).
4. Se `user == null` e pathname não inicia com `/login` → retorna `NextResponse.redirect(new URL("/login", request.url))`.
5. Caso contrário, retorna response com cookies atualizados.

### `src/lib/actions/auth.ts` (refactor)

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

- `ensureDefaultAdmin()` movido para `scripts/seed-admin.mjs` (one-shot via `npm run seed:auth`).
- Remove chamada de `ensureDefaultAdmin` de dentro de `LoginPage`.

### `(app)/layout.tsx` (refactor)

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
        <div className="mx-auto min-h-[calc(100vh-72px)] max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </div>
      </main>
    </div>
  );
}
```

### Topbar

Recebe `perfil` por prop. Exibe nome/email ao lado do botão logout. Adiciona link "Usuários" em `secondaryItems`.

### Tela `/usuarios`

- `(app)/usuarios/page.tsx` — Server Component. `requireAdmin()`. Lista `perfis` (filtrado por `escola_id` via RLS). Botão "Novo usuário".
- `(app)/usuarios/novo/page.tsx` — formulário. `requireAdmin()`.
- `createUserAction(formData)` — usa `createAdminClient()` (justificativa: `supabase.auth.admin.createUser` requer service role). Cria user em `auth.users`, insere linha em `perfis` com `escola_id` do admin chamador, perfil `admin`, `ativo=true`. Senha gerada aleatória, exibida uma vez na tela de sucesso.
- `deactivateUserAction(perfilId)` — seta `perfis.ativo = false` (não deleta).

## Plano de Migração (4 fases)

### Fase 1 — Infraestrutura

- Adicionar dep `@supabase/ssr`.
- Criar `src/lib/supabase/server.ts`, `src/lib/supabase/middleware.ts`.
- Criar `src/middleware.ts` na raiz.
- Criar `src/lib/auth/session.ts` com `getSession`, `requireSession`, `requireAdmin`.
- Migration `202605160001_auth_real_rls.sql` (policies + storage).
- Refactor `loginAction` / `logoutAction`.
- Refactor `(app)/layout.tsx` com `requireSession()`.
- Mover `ensureDefaultAdmin` para `scripts/seed-admin.mjs`.
- Remover chamada de `ensureDefaultAdmin` de `LoginPage`.
- Topbar exibe perfil.
- Aposentar `src/lib/supabase/public.ts`.

**Checkpoint 1:** login real funciona com cookies, rota `(app)/*` redireciona sem sessão, app abre dashboard. Data layer continua com service role — ainda funciona.

### Fase 2 — Data fetchers

Migrar um por vez (`createAdminClient()` → `createServerClient()`):

- `src/lib/data/dashboard.ts`
- `src/lib/data/students.ts`
- `src/lib/data/enrollments.ts`
- `src/lib/data/finance.ts`
- `src/lib/data/attendance.ts`
- `src/lib/data/lookups.ts`
- `src/lib/data/documents.ts`
- `src/lib/data/gate.ts`
- `src/lib/data/imports.ts`

Cada arquivo: substitui cliente + testa página correspondente.

**Checkpoint 2:** todas leituras passam por RLS. Páginas continuam carregando.

### Fase 3 — Server actions

Migrar:

- `src/lib/actions/academics.ts`
- `src/lib/actions/students.ts`
- `src/lib/actions/attendance.ts`
- `src/lib/actions/finance.ts`
- `src/lib/actions/documents.ts`
- `src/lib/actions/imports.ts`
- `src/lib/actions/gate.ts` (parcial — distinguir partes UI vs API)

Cada uma: troca cliente + chama `requireSession()` no topo.

**Service role mantido (com comentário inline):**

- `src/lib/server/student-import-parser.ts` — processamento batch do PDF grande (operação fora de sessão de user).
- `src/lib/actions/gate.ts` (subset) — funções chamadas pela API `/api/portaria/*`.
- `src/lib/server/generate-charges.ts` — geração automática de cobranças em batch.
- `src/lib/server/gate-events.ts`, `src/lib/server/guardian-notifications.ts` — invocados pela API portaria.

`src/lib/actions/imports.ts` migra a parte de UI (criar registro de arquivo, listar). A função interna que invoca o parser batch continua com service role.

**Checkpoint 3:** todas escritas via UI passam por RLS.

### Fase 4 — Tela usuários + storage

- Criar `(app)/usuarios/page.tsx` (lista) e `(app)/usuarios/novo/page.tsx` (form).
- Actions `createUserAction`, `deactivateUserAction`.
- Helper `getSignedFotoUrl(path)` em `src/lib/storage/photos.ts`. TTL = 1 hora. Uso server-side somente.
- Substituir uso direto de `foto_url` por chamada que gera signed URL no server (componentes Server Component que renderizam fotos).
- Atualizar import de fotos para escrever path no bucket privado.
- Adicionar link "Usuários" no Topbar.

**Checkpoint 4:** admin cria/desativa users via UI. Fotos via signed URL.

### Limpeza final

- Audit `grep createAdminClient` — cada ocorrência tem comentário `// service role: <justificativa>`.
- Remover `src/lib/supabase/public.ts`.
- Documentar variáveis env em `README.md`.

## Tratamento de erros

- `loginAction` retorna redirect com `?erro=auth` (credenciais inválidas) | `?erro=perfil` (sem perfil ativo) | `?erro=credenciais` (form vazio). `LoginPage` renderiza mensagem.
- `requireSession` / `requireAdmin` usam `redirect()` do Next.js — encerram render.
- Server actions encapsulam erros do Supabase. Violação de RLS → mensagem genérica "operação não permitida" no client (não vaza detalhe).
- API portaria mantém retorno JSON 401.

## Riscos e mitigações

| Risco | Mitigação |
|-------|-----------|
| Migration RLS quebra queries existentes durante fases 2/3 | Migration roda no início da fase 1, antes de migrar data layer. Service role bypassa RLS, então fase 1 finaliza sem quebra. Fases 2/3 migram leitor/escritor para SSR client gradualmente. |
| Cookie de sessão não persiste em dev | `@supabase/ssr` exige configuração correta de cookies. Validar em checkpoint 1 com login → reload da página. |
| Login com perfil deletado/inativo loga mesmo assim | `loginAction` valida `perfis.ativo` após signIn e faz signOut se inativo. |
| User criado direto no Supabase Studio sem linha em `perfis` | RLS bloqueia tudo (`current_perfil()` retorna null). Login chega mas qualquer query falha. |
| Service role exposto no client | `SUPABASE_SERVICE_ROLE_KEY` sem prefixo `NEXT_PUBLIC_`. Auditar nenhum import de `admin.ts` em componente client. |
| Foto pública vira privada e quebra `<img>` existentes | Helper `getSignedFotoUrl` chamado no server antes de renderizar. Auditar todos usos de `foto_url`. |
| Middleware bloqueia rotas estáticas | Matcher exclui `_next/static`, `_next/image`, `favicon.ico`, `api/portaria`. |

## Checklist de verificação manual (final)

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
- [ ] Foto de aluno renderiza via signed URL (não URL pública direta)
- [ ] Bucket `alunos-fotos` em Studio = privado
- [ ] Tela `/usuarios` lista admin seed
- [ ] Criar novo user via `/usuarios`, login com ele funciona
- [ ] Desativar user, login bloqueado
- [ ] `grep createAdminClient` — cada uso tem comentário `// service role: <justificativa>`

## Fora de escopo

Atendido por specs futuros:

- Outros perfis (`secretaria`, `financeiro`, `professor`) — schema mantém enum, policies expandem em spec próprio.
- Reset/troca de senha self-service.
- 2FA.
- Auditoria de mudanças (item próprio do roadmap).
- Testes automatizados (item próprio do roadmap).
