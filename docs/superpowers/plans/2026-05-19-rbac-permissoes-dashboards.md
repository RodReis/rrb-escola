# RBAC: Permissões por Perfil + Dashboards Derivadas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir o sistema de perfis fixos (4 strings hardcoded) por RBAC granular com matriz de permissões editável via UI, dashboards derivadas de permissões, e enforcement em pages + server actions.

**Architecture:** Tabela `roles` (FK string) + `modulos` (catálogo) + `role_permissoes` (matriz CRUD). Helper `requirePermission(modulo, acao)` substitui `requireSession`/`requireAdmin` em pages e actions. Admin = bypass hardcoded. Permissões pré-carregadas na Session via `React.cache()`. UI em `/configuracoes/perfis` com matriz accordion. Dashboard e topbar filtram cards/itens por permissão.

**Tech Stack:** Next.js 14 (App Router) + TypeScript + Supabase (Postgres + Auth + RLS) + Tailwind. Sem framework de testes unitários TS — validação via `npm run typecheck`, `npm run lint`, `npm run build`, smoke test manual.

**Spec:** `docs/superpowers/specs/2026-05-19-rbac-permissoes-dashboards-design.md`

---

## File Structure

### Novos

| Caminho | Responsabilidade |
|---|---|
| `supabase/migrations/202605300001_rbac_permissoes.sql` | Tabelas `roles`, `modulos`, `role_permissoes`; FK; RLS; seed |
| `src/lib/auth/permissions.ts` | Types `Acao`, `Grupo`, `ModuloCodigo`, `PermissionMap`; catálogo `MODULOS`; helper `can()`; mapa `ROTA_PARA_MODULO` |
| `src/lib/data/permissoes.ts` | Queries: listar roles, get role por código, get permissões de role, count usuários por role |
| `src/lib/actions/roles.ts` | Server actions: `createRoleAction`, `updateRoleAction`, `deleteRoleAction`, `updateRolePermissionsAction` |
| `src/components/perfis/permissions-matrix.tsx` | Componente client com accordion de grupos + checkboxes (R/C/U/D) + bulk |
| `src/components/perfis/permissions-matrix-input.tsx` | Helper interno: monta inputs hidden da matriz pro form |
| `src/components/layout/nav-item-gate.tsx` | Server helper `filterByPermission(items, perms)` para filtrar listas de menu |
| `src/app/(app)/configuracoes/perfis/page.tsx` | Lista de roles |
| `src/app/(app)/configuracoes/perfis/nova/page.tsx` | Form criar role custom |
| `src/app/(app)/configuracoes/perfis/[codigo]/page.tsx` | Editor da matriz |

### Modificados

| Caminho | Mudança |
|---|---|
| `src/lib/auth/session.ts` | Estender `Session` com `permissions`; adicionar `getPermissions()`, `requirePermission()` |
| `src/components/layout/topbar.tsx` | Receber items filtrados; passar pra dropdowns como prop |
| `src/components/layout/secretaria-dropdown.tsx` | Aceitar `items` via prop |
| `src/components/layout/rh-dropdown.tsx` | Idem |
| `src/components/layout/financeiro-dropdown.tsx` | Idem |
| `src/components/layout/configuracoes-dropdown.tsx` | Idem |
| `src/app/(app)/page.tsx` | Dashboard cards condicionais + queries condicionais; tabs filtradas |
| `src/app/(app)/usuarios/page.tsx` | Substituir `requireAdmin` por `requirePermission("usuarios","read")` |
| Pages top-level | Substituir `requireSession` por `requirePermission(modulo, "read")` |
| Server actions | Substituir gates por `requirePermission(modulo, acao)` |

---

## Task 1: Migration RBAC (schema + seed)

**Files:**
- Create: `supabase/migrations/202605300001_rbac_permissoes.sql`

- [ ] **Step 1: Criar migration completa**

```sql
-- supabase/migrations/202605300001_rbac_permissoes.sql

-- 1) Tabela roles
create table roles (
  codigo text primary key,
  nome text not null,
  descricao text,
  sistema boolean not null default false,
  escola_id uuid references escolas(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_roles_escola on roles(escola_id);

-- 2) Catálogo de módulos
create table modulos (
  codigo text primary key,
  grupo text not null,
  nome text not null,
  ordem int not null default 0
);

create index idx_modulos_grupo on modulos(grupo, ordem);

-- 3) Permissões
create table role_permissoes (
  role_codigo text not null references roles(codigo) on delete cascade,
  modulo_codigo text not null references modulos(codigo) on delete cascade,
  pode_ler boolean not null default false,
  pode_criar boolean not null default false,
  pode_editar boolean not null default false,
  pode_deletar boolean not null default false,
  primary key (role_codigo, modulo_codigo)
);

-- 4) Seed roles (DEVE vir ANTES da FK em perfis)
insert into roles (codigo, nome, sistema) values
  ('admin', 'Administrador', true),
  ('secretaria', 'Secretaria', true),
  ('financeiro', 'Financeiro', true),
  ('professor', 'Professor', true);

-- 5) FK perfis.perfil → roles.codigo
alter table perfis add constraint perfis_perfil_fk
  foreign key (perfil) references roles(codigo);

-- 6) Seed módulos (25 sub-módulos × 7 grupos)
insert into modulos (codigo, grupo, nome, ordem) values
  ('avaliacoes', 'pedagogico', 'Avaliações', 1),
  ('frequencias', 'pedagogico', 'Frequências', 2),
  ('disciplinas', 'pedagogico', 'Disciplinas', 3),
  ('mural', 'pedagogico', 'Mural', 4),
  ('alunos', 'secretaria', 'Alunos', 10),
  ('matriculas', 'secretaria', 'Matrículas', 11),
  ('importacoes', 'secretaria', 'Importações', 12),
  ('documentos.templates', 'secretaria', 'Templates Documentos', 13),
  ('financeiro.cobrancas', 'financeiro', 'Cobranças & Pagamentos', 20),
  ('despesas', 'financeiro', 'Despesas', 21),
  ('planos', 'financeiro', 'Planos', 22),
  ('valores-praticados', 'financeiro', 'Valores Praticados', 23),
  ('bolsistas', 'financeiro', 'Bolsistas', 24),
  ('rh.funcionarios', 'rh', 'Funcionários', 30),
  ('rh.empresas', 'rh', 'Empresas', 31),
  ('rh.folha', 'rh', 'Folha de Pagamento', 32),
  ('rh.templates', 'rh', 'Templates RH', 33),
  ('series', 'academico', 'Séries', 40),
  ('turmas', 'academico', 'Turmas', 41),
  ('professores', 'academico', 'Professores', 42),
  ('organograma', 'academico', 'Organograma', 43),
  ('portaria', 'operacional', 'Portaria', 50),
  ('relatorios', 'operacional', 'Relatórios', 51),
  ('usuarios', 'administracao', 'Usuários', 90),
  ('configuracoes.escola', 'administracao', 'Configurações da Escola', 91),
  ('configuracoes.webhook', 'administracao', 'Webhook', 92),
  ('configuracoes.perfis', 'administracao', 'Perfis e Permissões', 93);

-- 7) Seed role_permissoes — admin (full)
insert into role_permissoes (role_codigo, modulo_codigo, pode_ler, pode_criar, pode_editar, pode_deletar)
select 'admin', codigo, true, true, true, true from modulos;

-- 8) Seed role_permissoes — secretaria
insert into role_permissoes (role_codigo, modulo_codigo, pode_ler, pode_criar, pode_editar, pode_deletar)
select 'secretaria', codigo,
  true,
  case when grupo in ('secretaria','academico','operacional') then true else false end,
  case when grupo in ('secretaria','academico','operacional') then true else false end,
  case when grupo in ('secretaria','academico','operacional') then true else false end
from modulos
where grupo in ('secretaria','academico','operacional','pedagogico','financeiro');

-- 9) Seed role_permissoes — financeiro
insert into role_permissoes (role_codigo, modulo_codigo, pode_ler, pode_criar, pode_editar, pode_deletar)
select 'financeiro', codigo,
  case
    when grupo = 'financeiro' then true
    when grupo in ('secretaria','academico','rh') then true
    when codigo = 'relatorios' then true
    else false
  end,
  case when grupo = 'financeiro' then true else false end,
  case when grupo = 'financeiro' then true else false end,
  case when grupo = 'financeiro' then true else false end
from modulos
where grupo in ('financeiro','secretaria','academico','rh','operacional');

-- 10) Seed role_permissoes — professor
insert into role_permissoes (role_codigo, modulo_codigo, pode_ler, pode_criar, pode_editar, pode_deletar)
select 'professor', codigo,
  case
    when grupo = 'pedagogico' then true
    when codigo in ('alunos','matriculas') then true
    when grupo = 'academico' then true
    when codigo = 'relatorios' then true
    else false
  end,
  case when grupo = 'pedagogico' then true else false end,
  case when grupo = 'pedagogico' then true else false end,
  case when grupo = 'pedagogico' then true else false end
from modulos
where grupo in ('pedagogico','secretaria','academico','operacional');

-- 11) RLS
alter table roles enable row level security;
alter table role_permissoes enable row level security;
alter table modulos enable row level security;

create policy "roles read all" on roles for select to authenticated using (true);

create policy "roles admin manage" on roles for all to authenticated
  using (
    (select perfil from current_perfil()) = 'admin'
    and (escola_id = (select escola_id from current_perfil()) or escola_id is null)
  )
  with check (
    (select perfil from current_perfil()) = 'admin'
    and (escola_id = (select escola_id from current_perfil()) or sistema = false)
  );

create policy "role_permissoes read all" on role_permissoes for select to authenticated using (true);

create policy "role_permissoes admin manage" on role_permissoes for all to authenticated
  using ((select perfil from current_perfil()) = 'admin')
  with check ((select perfil from current_perfil()) = 'admin');

create policy "modulos read all" on modulos for select to authenticated using (true);

-- 12) Helper SQL has_permission
create or replace function has_permission(p_modulo text, p_acao text)
returns boolean as $$
  select coalesce(
    (select case p_acao
      when 'read' then pode_ler
      when 'create' then pode_criar
      when 'update' then pode_editar
      when 'delete' then pode_deletar
    end
    from role_permissoes rp
    join perfis p on p.perfil = rp.role_codigo
    where p.user_id = auth.uid() and p.ativo = true
      and rp.modulo_codigo = p_modulo
    limit 1),
    false
  );
$$ language sql stable security definer set search_path = public;
```

- [ ] **Step 2: Aplicar migration**

```bash
npx supabase db push
```

Expected: migration aplicada sem erro.

- [ ] **Step 3: Verificar seed**

```bash
npx supabase db remote query "select role_codigo, count(*) from role_permissoes group by role_codigo order by 1"
```

Expected output:
```
admin       | 27
secretaria  | 17  (4+4+4+5=17)
financeiro  | 18  (5+4+4+4+1=18)
professor   | 12  (4+2+4+1+1=12)
```

(Counts aproximados — confirmar que admin=27 e demais > 0.)

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/202605300001_rbac_permissoes.sql
git commit -m "feat(rbac): schema roles + modulos + role_permissoes + seed"
```

---

## Task 2: Catálogo TS de permissões

**Files:**
- Create: `src/lib/auth/permissions.ts`

- [ ] **Step 1: Criar arquivo de catálogo**

```ts
// src/lib/auth/permissions.ts

export type Acao = "read" | "create" | "update" | "delete";

export const GRUPOS = [
  "pedagogico",
  "secretaria",
  "financeiro",
  "rh",
  "academico",
  "operacional",
  "administracao",
] as const;
export type Grupo = (typeof GRUPOS)[number];

export const GRUPO_LABEL: Record<Grupo, string> = {
  pedagogico: "Pedagógico",
  secretaria: "Secretaria",
  financeiro: "Financeiro",
  rh: "RH",
  academico: "Acadêmico",
  operacional: "Operacional",
  administracao: "Administração",
};

export const MODULOS = {
  // pedagogico
  avaliacoes: { grupo: "pedagogico", nome: "Avaliações" },
  frequencias: { grupo: "pedagogico", nome: "Frequências" },
  disciplinas: { grupo: "pedagogico", nome: "Disciplinas" },
  mural: { grupo: "pedagogico", nome: "Mural" },
  // secretaria
  alunos: { grupo: "secretaria", nome: "Alunos" },
  matriculas: { grupo: "secretaria", nome: "Matrículas" },
  importacoes: { grupo: "secretaria", nome: "Importações" },
  "documentos.templates": { grupo: "secretaria", nome: "Templates Documentos" },
  // financeiro
  "financeiro.cobrancas": { grupo: "financeiro", nome: "Cobranças & Pagamentos" },
  despesas: { grupo: "financeiro", nome: "Despesas" },
  planos: { grupo: "financeiro", nome: "Planos" },
  "valores-praticados": { grupo: "financeiro", nome: "Valores Praticados" },
  bolsistas: { grupo: "financeiro", nome: "Bolsistas" },
  // rh
  "rh.funcionarios": { grupo: "rh", nome: "Funcionários" },
  "rh.empresas": { grupo: "rh", nome: "Empresas" },
  "rh.folha": { grupo: "rh", nome: "Folha" },
  "rh.templates": { grupo: "rh", nome: "Templates RH" },
  // academico
  series: { grupo: "academico", nome: "Séries" },
  turmas: { grupo: "academico", nome: "Turmas" },
  professores: { grupo: "academico", nome: "Professores" },
  organograma: { grupo: "academico", nome: "Organograma" },
  // operacional
  portaria: { grupo: "operacional", nome: "Portaria" },
  relatorios: { grupo: "operacional", nome: "Relatórios" },
  // administracao
  usuarios: { grupo: "administracao", nome: "Usuários" },
  "configuracoes.escola": { grupo: "administracao", nome: "Escola" },
  "configuracoes.webhook": { grupo: "administracao", nome: "Webhook" },
  "configuracoes.perfis": { grupo: "administracao", nome: "Perfis e Permissões" },
} as const satisfies Record<string, { grupo: Grupo; nome: string }>;

export type ModuloCodigo = keyof typeof MODULOS;

export const MODULO_CODIGOS = Object.keys(MODULOS) as ModuloCodigo[];

export type PermissionMap = Partial<Record<ModuloCodigo, {
  read: boolean;
  create: boolean;
  update: boolean;
  delete: boolean;
}>>;

export function can(perms: PermissionMap, modulo: ModuloCodigo, acao: Acao): boolean {
  return perms[modulo]?.[acao] ?? false;
}

export function modulosDoGrupo(grupo: Grupo): ModuloCodigo[] {
  return MODULO_CODIGOS.filter((m) => MODULOS[m].grupo === grupo);
}

// Mapa rota → módulo (usado para route gating e filtro de menus)
export const ROTA_PARA_MODULO: Record<string, ModuloCodigo> = {
  "/alunos": "alunos",
  "/matriculas": "matriculas",
  "/importacoes": "importacoes",
  "/financeiro": "financeiro.cobrancas",
  "/despesas": "despesas",
  "/planos": "planos",
  "/valores-praticados": "valores-praticados",
  "/bolsistas": "bolsistas",
  "/rh/funcionarios": "rh.funcionarios",
  "/rh/empresas": "rh.empresas",
  "/rh/folha": "rh.folha",
  "/rh/documentos": "rh.templates",
  "/rh/brackets": "rh.folha",
  "/avaliacoes": "avaliacoes",
  "/frequencias": "frequencias",
  "/disciplinas": "disciplinas",
  "/mural/aniversariantes": "mural",
  "/series": "series",
  "/turmas": "turmas",
  "/professores/atribuicoes": "professores",
  "/organograma": "organograma",
  "/portaria": "portaria",
  "/relatorios/alunos": "relatorios",
  "/relatorios/frequencia": "relatorios",
  "/relatorios/inadimplencia": "relatorios",
  "/usuarios": "usuarios",
  "/configuracoes/escola": "configuracoes.escola",
  "/configuracoes/webhook": "configuracoes.webhook",
  "/configuracoes/perfis": "configuracoes.perfis",
  "/despesas/categorias": "despesas",
};
```

- [ ] **Step 2: Validar typecheck**

```bash
npm run typecheck
```

Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/auth/permissions.ts
git commit -m "feat(rbac): catálogo TS de módulos + helpers can/modulosDoGrupo"
```

---

## Task 3: Estender Session com permissions

**Files:**
- Modify: `src/lib/auth/session.ts`

- [ ] **Step 1: Reescrever session.ts**

```ts
// src/lib/auth/session.ts
import { redirect } from "next/navigation";
import { cache } from "react";
import { createServerClient } from "@/lib/supabase/server";
import {
  can,
  type Acao,
  type ModuloCodigo,
  type PermissionMap,
} from "@/lib/auth/permissions";

export type SessionProfile = {
  id: string;
  user_id: string;
  escola_id: string;
  nome: string;
  email: string;
  perfil: string;  // antes: union literal — agora FK livre (qualquer role.codigo)
  ativo: boolean;
};

export type Session = {
  user: { id: string; email: string };
  profile: SessionProfile;
  permissions: PermissionMap;
};

export const getSession = cache(async (): Promise<Session | null> => {
  const supabase = await createServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return null;

  const { data: profile } = await supabase
    .from("perfis")
    .select("id, user_id, escola_id, nome, email, perfil, ativo")
    .eq("user_id", userData.user.id)
    .maybeSingle();

  if (!profile || !profile.ativo) return null;

  const { data: perms } = await supabase
    .from("role_permissoes")
    .select("modulo_codigo, pode_ler, pode_criar, pode_editar, pode_deletar")
    .eq("role_codigo", profile.perfil);

  const permissions: PermissionMap = {};
  for (const p of perms ?? []) {
    permissions[p.modulo_codigo as ModuloCodigo] = {
      read: p.pode_ler,
      create: p.pode_criar,
      update: p.pode_editar,
      delete: p.pode_deletar,
    };
  }

  return {
    user: { id: userData.user.id, email: userData.user.email ?? profile.email },
    profile: profile as SessionProfile,
    permissions,
  };
});

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

export async function requirePerfil(perfis: string[]): Promise<Session> {
  const session = await requireSession();
  if (!perfis.includes(session.profile.perfil)) {
    redirect("/acesso-negado");
  }
  return session;
}

export async function requirePermission(
  modulo: ModuloCodigo,
  acao: Acao,
): Promise<Session> {
  const session = await requireSession();
  if (session.profile.perfil === "admin") return session;  // bypass
  if (!can(session.permissions, modulo, acao)) redirect("/acesso-negado");
  return session;
}
```

- [ ] **Step 2: Verificar callers que usam union literal antigo**

```bash
npm run typecheck
```

Expected: pode haver erros nos lugares que esperam `"admin" | "secretaria" | "financeiro" | "professor"`. Listar e ajustar (esses lugares já fazem string compare com perfil — agora `perfil: string` aceita qualquer valor). Se erros aparecerem em `requirePerfil(["admin","secretaria"])` os types ainda batem porque o array é `string[]`.

Se erro persistir, anotar arquivo no comment do commit e corrigir cast em Step 3.

- [ ] **Step 3: Corrigir callers afetados (se houver)**

Padrão: locais que destructuram `session.profile.perfil` esperando union literal. Substituir tipos por `string` ou usar `as "admin"`.

Verificar especificamente:
- `src/lib/actions/users.ts:10` — `const PERFIS = [...] as const` (não afetado, é local).
- `src/app/(app)/usuarios/page.tsx:19` — `PERFIL_LABEL: Record<string, string>` (não afetado).

Provavelmente nenhuma correção necessária. Se typecheck passa, prosseguir.

- [ ] **Step 4: Smoke test manual**

```bash
npm run dev
```

Acessar app logado como admin. Verificar:
- Login funciona (session carrega).
- Dashboard `/` renderiza.
- Console sem erros de query Supabase.

Verificar via DevTools Network que query `role_permissoes` retorna ~27 rows.

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth/session.ts
git commit -m "feat(rbac): pré-carregar permissions na Session + requirePermission()"
```

---

## Task 4: Data layer (queries de roles/permissões)

**Files:**
- Create: `src/lib/data/permissoes.ts`

- [ ] **Step 1: Criar arquivo**

```ts
// src/lib/data/permissoes.ts
import { createServerClient } from "@/lib/supabase/server";
import type { Acao, ModuloCodigo } from "@/lib/auth/permissions";

export type Role = {
  codigo: string;
  nome: string;
  descricao: string | null;
  sistema: boolean;
  escola_id: string | null;
  created_at: string;
};

export type RolePermissao = {
  modulo_codigo: ModuloCodigo;
  pode_ler: boolean;
  pode_criar: boolean;
  pode_editar: boolean;
  pode_deletar: boolean;
};

export async function listRoles(escolaId: string): Promise<Array<Role & { usuarios: number }>> {
  const supabase = await createServerClient();
  const { data: roles } = await supabase
    .from("roles")
    .select("codigo, nome, descricao, sistema, escola_id, created_at")
    .or(`escola_id.is.null,escola_id.eq.${escolaId}`)
    .order("sistema", { ascending: false })
    .order("nome");

  const { data: counts } = await supabase
    .from("perfis")
    .select("perfil")
    .eq("escola_id", escolaId);

  const tally: Record<string, number> = {};
  for (const c of counts ?? []) tally[c.perfil] = (tally[c.perfil] ?? 0) + 1;

  return (roles ?? []).map((r) => ({ ...(r as Role), usuarios: tally[r.codigo] ?? 0 }));
}

export async function getRole(codigo: string): Promise<Role | null> {
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("roles")
    .select("codigo, nome, descricao, sistema, escola_id, created_at")
    .eq("codigo", codigo)
    .maybeSingle();
  return (data as Role) ?? null;
}

export async function getRolePermissoes(codigo: string): Promise<RolePermissao[]> {
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("role_permissoes")
    .select("modulo_codigo, pode_ler, pode_criar, pode_editar, pode_deletar")
    .eq("role_codigo", codigo);
  return (data as RolePermissao[]) ?? [];
}

export function permissoesToMap(perms: RolePermissao[]): Record<ModuloCodigo, Record<Acao, boolean>> {
  const map = {} as Record<ModuloCodigo, Record<Acao, boolean>>;
  for (const p of perms) {
    map[p.modulo_codigo] = {
      read: p.pode_ler,
      create: p.pode_criar,
      update: p.pode_editar,
      delete: p.pode_deletar,
    };
  }
  return map;
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/data/permissoes.ts
git commit -m "feat(rbac): data layer queries de roles + permissoes"
```

---

## Task 5: Server actions de roles

**Files:**
- Create: `src/lib/actions/roles.ts`

- [ ] **Step 1: Criar arquivo**

```ts
// src/lib/actions/roles.ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { MODULO_CODIGOS, type ModuloCodigo } from "@/lib/auth/permissions";
import { formText } from "@/lib/utils";

const CODIGO_RE = /^[a-z][a-z0-9_-]*$/;

export async function createRoleAction(formData: FormData) {
  const session = await requireAdmin();
  const codigo = formText(formData, "codigo");
  const nome = formText(formData, "nome");
  const descricao = formText(formData, "descricao") || null;

  if (!codigo || !nome) redirect("/configuracoes/perfis/nova?erro=campos");
  if (!CODIGO_RE.test(codigo)) redirect("/configuracoes/perfis/nova?erro=codigo");

  const admin = createAdminClient();
  const { error: roleError } = await admin.from("roles").insert({
    codigo,
    nome,
    descricao,
    sistema: false,
    escola_id: session.profile.escola_id,
  });
  if (roleError) {
    redirect(`/configuracoes/perfis/nova?erro=${encodeURIComponent(roleError.message)}`);
  }

  // Seed permissões vazias (todas false) pra evitar lacunas
  const rows = MODULO_CODIGOS.map((m) => ({
    role_codigo: codigo,
    modulo_codigo: m,
    pode_ler: false,
    pode_criar: false,
    pode_editar: false,
    pode_deletar: false,
  }));
  await admin.from("role_permissoes").insert(rows);

  revalidatePath("/configuracoes/perfis");
  redirect(`/configuracoes/perfis/${codigo}`);
}

export async function updateRoleAction(formData: FormData) {
  await requireAdmin();
  const codigo = formText(formData, "codigo");
  const nome = formText(formData, "nome");
  const descricao = formText(formData, "descricao") || null;
  if (!codigo || !nome) redirect(`/configuracoes/perfis/${codigo}?erro=campos`);

  const admin = createAdminClient();
  const { data: role } = await admin.from("roles").select("sistema").eq("codigo", codigo).maybeSingle();
  if (!role) redirect("/configuracoes/perfis?erro=notfound");

  // Sistema permite editar nome/descricao mas não código
  const { error } = await admin
    .from("roles")
    .update({ nome, descricao, updated_at: new Date().toISOString() })
    .eq("codigo", codigo);
  if (error) redirect(`/configuracoes/perfis/${codigo}?erro=${encodeURIComponent(error.message)}`);

  revalidatePath("/configuracoes/perfis");
  revalidatePath(`/configuracoes/perfis/${codigo}`);
  redirect(`/configuracoes/perfis/${codigo}?atualizado=1`);
}

export async function deleteRoleAction(formData: FormData) {
  await requireAdmin();
  const codigo = formText(formData, "codigo");
  if (!codigo) redirect("/configuracoes/perfis?erro=id");

  const admin = createAdminClient();
  const { data: role } = await admin.from("roles").select("sistema").eq("codigo", codigo).maybeSingle();
  if (!role) redirect("/configuracoes/perfis?erro=notfound");
  if (role.sistema) redirect("/configuracoes/perfis?erro=sistema");

  const { count } = await admin
    .from("perfis")
    .select("id", { count: "exact", head: true })
    .eq("perfil", codigo);
  if ((count ?? 0) > 0) redirect("/configuracoes/perfis?erro=emuso");

  const { error } = await admin.from("roles").delete().eq("codigo", codigo);
  if (error) redirect(`/configuracoes/perfis?erro=${encodeURIComponent(error.message)}`);

  revalidatePath("/configuracoes/perfis");
  redirect("/configuracoes/perfis?excluido=1");
}

export async function updateRolePermissionsAction(formData: FormData) {
  await requireAdmin();
  const codigo = formText(formData, "codigo");
  if (!codigo) redirect("/configuracoes/perfis?erro=id");
  if (codigo === "admin") redirect(`/configuracoes/perfis/${codigo}?erro=adminreadonly`);

  // Lê todos os checkboxes do form. Naming: "perm.<modulo>.<acao>"
  const rows: Array<{
    role_codigo: string;
    modulo_codigo: string;
    pode_ler: boolean;
    pode_criar: boolean;
    pode_editar: boolean;
    pode_deletar: boolean;
  }> = [];
  for (const modulo of MODULO_CODIGOS) {
    rows.push({
      role_codigo: codigo,
      modulo_codigo: modulo,
      pode_ler: formData.get(`perm.${modulo}.read`) === "on",
      pode_criar: formData.get(`perm.${modulo}.create`) === "on",
      pode_editar: formData.get(`perm.${modulo}.update`) === "on",
      pode_deletar: formData.get(`perm.${modulo}.delete`) === "on",
    });
  }

  const admin = createAdminClient();
  // Upsert (delete-then-insert é mais simples e robusto)
  await admin.from("role_permissoes").delete().eq("role_codigo", codigo);
  const { error } = await admin.from("role_permissoes").insert(rows);
  if (error) redirect(`/configuracoes/perfis/${codigo}?erro=${encodeURIComponent(error.message)}`);

  revalidatePath("/configuracoes/perfis");
  revalidatePath(`/configuracoes/perfis/${codigo}`);
  redirect(`/configuracoes/perfis/${codigo}?salvo=1`);
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/actions/roles.ts
git commit -m "feat(rbac): server actions CRUD de roles + update da matriz"
```

---

## Task 6: Componente matriz de permissões (UI client)

**Files:**
- Create: `src/components/perfis/permissions-matrix.tsx`

- [ ] **Step 1: Criar componente**

```tsx
// src/components/perfis/permissions-matrix.tsx
"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  GRUPOS,
  GRUPO_LABEL,
  MODULOS,
  MODULO_CODIGOS,
  modulosDoGrupo,
  type Acao,
  type Grupo,
  type ModuloCodigo,
} from "@/lib/auth/permissions";
import { cn } from "@/lib/utils";

type Matrix = Record<ModuloCodigo, Record<Acao, boolean>>;

const ACOES: Acao[] = ["read", "create", "update", "delete"];
const ACAO_LABEL: Record<Acao, string> = {
  read: "R",
  create: "C",
  update: "U",
  delete: "D",
};

export function PermissionsMatrix({
  initial,
  disabled,
}: {
  initial: Matrix;
  disabled?: boolean;
}) {
  const [matrix, setMatrix] = useState<Matrix>(() => {
    // Garante que todos os módulos têm entrada (default false)
    const full = {} as Matrix;
    for (const m of MODULO_CODIGOS) {
      full[m] = initial[m] ?? { read: false, create: false, update: false, delete: false };
    }
    return full;
  });
  const [expandido, setExpandido] = useState<Record<Grupo, boolean>>(
    () => Object.fromEntries(GRUPOS.map((g) => [g, false])) as Record<Grupo, boolean>,
  );

  function toggle(modulo: ModuloCodigo, acao: Acao) {
    if (disabled) return;
    setMatrix((prev) => ({
      ...prev,
      [modulo]: { ...prev[modulo], [acao]: !prev[modulo][acao] },
    }));
  }

  function bulkGrupo(grupo: Grupo, acao: Acao, valor: boolean) {
    if (disabled) return;
    setMatrix((prev) => {
      const next = { ...prev };
      for (const m of modulosDoGrupo(grupo)) {
        next[m] = { ...next[m], [acao]: valor };
      }
      return next;
    });
  }

  function countGrupo(grupo: Grupo): { ativas: number; total: number } {
    const mods = modulosDoGrupo(grupo);
    let ativas = 0;
    for (const m of mods) {
      for (const a of ACOES) if (matrix[m][a]) ativas++;
    }
    return { ativas, total: mods.length * 4 };
  }

  function allInGrupo(grupo: Grupo, acao: Acao): boolean {
    return modulosDoGrupo(grupo).every((m) => matrix[m][acao]);
  }

  return (
    <div className="grid gap-2">
      {GRUPOS.map((grupo) => {
        const open = expandido[grupo];
        const { ativas, total } = countGrupo(grupo);
        const mods = modulosDoGrupo(grupo);
        return (
          <div key={grupo} className="rounded-ui border border-line bg-surface">
            <div className="flex items-center gap-3 px-4 py-3">
              <button
                type="button"
                onClick={() => setExpandido((p) => ({ ...p, [grupo]: !p[grupo] }))}
                className="flex items-center gap-2 text-left flex-1"
              >
                <ChevronDown
                  size={14}
                  className={cn("transition-transform", open && "rotate-180")}
                />
                <span className="font-semibold text-ink">{GRUPO_LABEL[grupo]}</span>
                <span className="text-xs text-ink/55">
                  {ativas}/{total} permissões
                </span>
              </button>
              <div className="flex items-center gap-3">
                {ACOES.map((a) => (
                  <label key={a} className="flex items-center gap-1 text-xs text-ink/65">
                    <input
                      type="checkbox"
                      checked={allInGrupo(grupo, a)}
                      onChange={(e) => bulkGrupo(grupo, a, e.target.checked)}
                      disabled={disabled}
                      className="h-3.5 w-3.5"
                    />
                    {ACAO_LABEL[a]}
                  </label>
                ))}
              </div>
            </div>

            {open && (
              <div className="border-t border-line">
                {mods.map((m) => (
                  <div
                    key={m}
                    className="flex items-center px-4 py-2.5 border-b border-line last:border-b-0"
                  >
                    <span className="flex-1 text-sm text-ink/80">{MODULOS[m].nome}</span>
                    <div className="flex items-center gap-3">
                      {ACOES.map((a) => (
                        <label key={a} className="flex items-center gap-1 text-xs text-ink/65">
                          <input
                            type="checkbox"
                            name={`perm.${m}.${a}`}
                            checked={matrix[m][a]}
                            onChange={() => toggle(m, a)}
                            disabled={disabled}
                            className="h-3.5 w-3.5"
                          />
                          {ACAO_LABEL[a]}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Inputs hidden pra submit mesmo com grupo colapsado */}
            {!open &&
              mods.map((m) =>
                ACOES.map((a) =>
                  matrix[m][a] ? (
                    <input
                      key={`${m}.${a}`}
                      type="hidden"
                      name={`perm.${m}.${a}`}
                      value="on"
                    />
                  ) : null,
                ),
              )}
          </div>
        );
      })}
    </div>
  );
}
```

**Nota:** o `name={`perm.${m}.${a}`}` quando checkbox está checked é serializado como `on` (default do navegador). Quando unchecked, não envia campo — server action lê `formData.get(...) === "on"` que retorna `false` se ausente. Comportamento correto.

Detalhe: quando grupo colapsado, inputs hidden duplicam (não enviar duas vezes). Vou simplificar: sempre renderizo inputs hidden quando grupo colapsado E sempre renderizo checkboxes visíveis quando expandido. Como navegador serializa AMBOS se ambos presentes no DOM, o `!open` é mandatório. OK.

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/perfis/permissions-matrix.tsx
git commit -m "feat(rbac): componente matriz de permissoes com accordion + bulk"
```

---

## Task 7: Página lista de perfis

**Files:**
- Create: `src/app/(app)/configuracoes/perfis/page.tsx`

- [ ] **Step 1: Criar página**

```tsx
// src/app/(app)/configuracoes/perfis/page.tsx
import Link from "next/link";
import { Plus } from "lucide-react";
import { requirePermission } from "@/lib/auth/session";
import { listRoles } from "@/lib/data/permissoes";
import { deleteRoleAction } from "@/lib/actions/roles";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { DataTableShell } from "@/components/ui/data-table";
import { StatusPill } from "@/components/ui/status-pill";

export const dynamic = "force-dynamic";

const ERRO_LABEL: Record<string, string> = {
  notfound: "Role não encontrada.",
  sistema: "Roles de sistema não podem ser excluídas.",
  emuso: "Esta role está em uso por usuários. Mude o perfil dos usuários antes de excluir.",
};

export default async function PerfisPage({
  searchParams,
}: {
  searchParams: Promise<{ excluido?: string; erro?: string }>;
}) {
  const session = await requirePermission("configuracoes.perfis", "read");
  const sp = await searchParams;
  const roles = await listRoles(session.profile.escola_id);

  return (
    <div className="grid gap-6">
      <PageHeader
        breadcrumb={[{ label: "Configurações" }, { label: "Perfis e Permissões" }]}
        title="Perfis e Permissões"
        counter={roles.length.toLocaleString("pt-BR")}
        description="Gerencie roles de acesso e a matriz de permissões de cada perfil."
        actions={
          <ButtonLink href="/configuracoes/perfis/nova" variant="primary">
            <Plus size={14} /> Nova role
          </ButtonLink>
        }
      />

      {sp.excluido && (
        <div className="rounded-ui bg-success/10 p-4 text-sm font-semibold text-success">
          Role excluída.
        </div>
      )}
      {sp.erro && (
        <div className="rounded-ui bg-danger/10 p-4 text-sm font-semibold text-danger">
          {ERRO_LABEL[sp.erro] ?? `Falha: ${decodeURIComponent(sp.erro)}`}
        </div>
      )}

      <DataTableShell>
        <table className="ds-dt min-w-[720px]">
          <thead>
            <tr>
              <th>Código</th>
              <th>Nome</th>
              <th>Tipo</th>
              <th>Usuários</th>
              <th className="text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {roles.map((r) => (
              <tr key={r.codigo}>
                <td className="font-mono text-xs text-ink/70">{r.codigo}</td>
                <td className="font-semibold text-ink">{r.nome}</td>
                <td>
                  <StatusPill tone={r.sistema ? "info" : "neutral"}>
                    {r.sistema ? "Sistema" : "Custom"}
                  </StatusPill>
                </td>
                <td className="text-ink/75">{r.usuarios}</td>
                <td className="text-right">
                  <div className="inline-flex items-center gap-2">
                    <Link
                      href={`/configuracoes/perfis/${r.codigo}`}
                      className="text-xs font-semibold text-brand hover:underline"
                    >
                      Editar permissões
                    </Link>
                    {!r.sistema && (
                      <form action={deleteRoleAction} className="inline">
                        <input type="hidden" name="codigo" value={r.codigo} />
                        <button className="text-xs font-semibold text-danger hover:underline">
                          Excluir
                        </button>
                      </form>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </DataTableShell>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: zero errors. Se `StatusPill` não aceitar `tone="info"` ou `tone="neutral"`, ajustar pra valores que existem (verificar `src/components/ui/status-pill.tsx`).

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/configuracoes/perfis/page.tsx
git commit -m "feat(rbac): pagina lista de perfis em /configuracoes/perfis"
```

---

## Task 8: Página editor da matriz

**Files:**
- Create: `src/app/(app)/configuracoes/perfis/[codigo]/page.tsx`

- [ ] **Step 1: Criar página**

```tsx
// src/app/(app)/configuracoes/perfis/[codigo]/page.tsx
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth/session";
import { getRole, getRolePermissoes, permissoesToMap } from "@/lib/data/permissoes";
import { updateRoleAction, updateRolePermissionsAction } from "@/lib/actions/roles";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/card";
import { PermissionsMatrix } from "@/components/perfis/permissions-matrix";
import { MODULO_CODIGOS } from "@/lib/auth/permissions";

export const dynamic = "force-dynamic";

const ERRO_LABEL: Record<string, string> = {
  campos: "Preencha todos os campos.",
  adminreadonly: "Permissões da role admin não podem ser editadas (sempre full).",
};

export default async function EditarPerfilPage({
  params,
  searchParams,
}: {
  params: Promise<{ codigo: string }>;
  searchParams: Promise<{ salvo?: string; atualizado?: string; erro?: string }>;
}) {
  await requirePermission("configuracoes.perfis", "update");
  const { codigo } = await params;
  const sp = await searchParams;

  const role = await getRole(codigo);
  if (!role) notFound();

  const permsList = await getRolePermissoes(codigo);
  const initialMatrix = permissoesToMap(permsList);

  // admin sempre full → mostra matriz toda marcada e disabled
  const isAdmin = codigo === "admin";
  let displayMatrix = initialMatrix;
  if (isAdmin) {
    displayMatrix = {} as typeof initialMatrix;
    for (const m of MODULO_CODIGOS) {
      displayMatrix[m] = { read: true, create: true, update: true, delete: true };
    }
  }

  return (
    <div className="grid gap-6">
      <PageHeader
        breadcrumb={[
          { label: "Configurações" },
          { label: "Perfis e Permissões", href: "/configuracoes/perfis" },
          { label: role.nome },
        ]}
        title={`Editar perfil: ${role.nome}`}
        description={role.sistema ? "Role de sistema. Código não editável." : "Role custom."}
      />

      {sp.salvo && (
        <div className="rounded-ui bg-success/10 p-4 text-sm font-semibold text-success">
          Permissões salvas.
        </div>
      )}
      {sp.atualizado && (
        <div className="rounded-ui bg-success/10 p-4 text-sm font-semibold text-success">
          Dados atualizados.
        </div>
      )}
      {sp.erro && (
        <div className="rounded-ui bg-danger/10 p-4 text-sm font-semibold text-danger">
          {ERRO_LABEL[sp.erro] ?? `Falha: ${decodeURIComponent(sp.erro)}`}
        </div>
      )}

      <Panel>
        <form action={updateRoleAction} className="grid gap-3 md:grid-cols-[200px_1fr_auto] items-end">
          <input type="hidden" name="codigo" value={role.codigo} />
          <label>
            <span className="text-xs font-semibold text-ink/55">Código</span>
            <input value={role.codigo} disabled className="font-mono" />
          </label>
          <label>
            <span className="text-xs font-semibold text-ink/55">Nome</span>
            <input name="nome" defaultValue={role.nome} required />
          </label>
          <button className="ds-button ds-button-secondary">Atualizar dados</button>
          <label className="md:col-span-3">
            <span className="text-xs font-semibold text-ink/55">Descrição</span>
            <input name="descricao" defaultValue={role.descricao ?? ""} />
          </label>
        </form>
      </Panel>

      <form action={updateRolePermissionsAction} className="grid gap-4">
        <input type="hidden" name="codigo" value={role.codigo} />
        {isAdmin && (
          <div className="rounded-ui bg-info/10 p-4 text-sm font-semibold text-info">
            Admin sempre tem acesso total. Esta matriz é apenas informativa.
          </div>
        )}
        <PermissionsMatrix initial={displayMatrix} disabled={isAdmin} />
        {!isAdmin && (
          <div className="flex justify-end">
            <button className="ds-button ds-button-primary">Salvar permissões</button>
          </div>
        )}
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: zero errors. Se `Panel`, `PageHeader` ou cor `info` não existirem, ajustar para componentes/cores reais (verificar imports).

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/configuracoes/perfis/\[codigo\]/page.tsx
git commit -m "feat(rbac): editor da matriz de permissoes por role"
```

---

## Task 9: Página criar nova role

**Files:**
- Create: `src/app/(app)/configuracoes/perfis/nova/page.tsx`

- [ ] **Step 1: Criar página**

```tsx
// src/app/(app)/configuracoes/perfis/nova/page.tsx
import Link from "next/link";
import { requirePermission } from "@/lib/auth/session";
import { createRoleAction } from "@/lib/actions/roles";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/card";

export const dynamic = "force-dynamic";

const ERRO_LABEL: Record<string, string> = {
  campos: "Preencha código e nome.",
  codigo: "Código deve começar com letra minúscula e conter apenas letras, números, _ ou -.",
};

export default async function NovaRolePage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  await requirePermission("configuracoes.perfis", "create");
  const sp = await searchParams;

  return (
    <div className="grid gap-6">
      <PageHeader
        breadcrumb={[
          { label: "Configurações" },
          { label: "Perfis e Permissões", href: "/configuracoes/perfis" },
          { label: "Nova role" },
        ]}
        title="Nova role custom"
        description="Crie um novo perfil de acesso. Após criar, configure a matriz de permissões."
      />

      {sp.erro && (
        <div className="rounded-ui bg-danger/10 p-4 text-sm font-semibold text-danger">
          {ERRO_LABEL[sp.erro] ?? `Falha: ${decodeURIComponent(sp.erro)}`}
        </div>
      )}

      <Panel>
        <form action={createRoleAction} className="grid gap-4 max-w-2xl">
          <label>
            <span className="text-xs font-semibold text-ink/55">Código</span>
            <input
              name="codigo"
              required
              pattern="[a-z][a-z0-9_-]*"
              placeholder="ex: coordenador"
              className="font-mono"
            />
            <p className="mt-1 text-xs text-ink/55">
              Letras minúsculas, números, _ ou -. Começa com letra.
            </p>
          </label>
          <label>
            <span className="text-xs font-semibold text-ink/55">Nome</span>
            <input name="nome" required placeholder="ex: Coordenador Pedagógico" />
          </label>
          <label>
            <span className="text-xs font-semibold text-ink/55">Descrição (opcional)</span>
            <input name="descricao" />
          </label>
          <div className="flex gap-2 justify-end">
            <Link href="/configuracoes/perfis" className="ds-button ds-button-secondary">
              Cancelar
            </Link>
            <button className="ds-button ds-button-primary">Criar role</button>
          </div>
        </form>
      </Panel>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/configuracoes/perfis/nova/page.tsx
git commit -m "feat(rbac): pagina criar nova role custom"
```

---

## Task 10: Smoke test UI de perfis

**Files:** nenhum (validação manual)

- [ ] **Step 1: Iniciar dev server**

```bash
npm run dev
```

- [ ] **Step 2: Logar como admin e testar lista**

Acessar `http://localhost:3000/configuracoes/perfis`.

Verificar:
- Mostra 4 roles seed (admin, secretaria, financeiro, professor) marcadas como "Sistema".
- Contagem de usuários aparece.
- Roles sistema NÃO mostram botão "Excluir".

- [ ] **Step 3: Editar role secretaria**

Clicar "Editar permissões" da role `secretaria`. Verificar:
- Header mostra "Editar perfil: Secretaria".
- 7 accordions de grupos.
- Cada grupo mostra contador `X/Y permissões`.
- Expandir "Secretaria" → 4 sub-módulos com R/C/U/D marcados.
- Expandir "Pedagógico" → só R marcado.
- Bulk no header do grupo: clicar "C" no header de Secretaria desmarca/marca todos `create` do grupo.
- Salvar funciona → flash "Permissões salvas."

- [ ] **Step 4: Verificar admin é read-only**

Acessar `/configuracoes/perfis/admin`. Verificar:
- Banner: "Admin sempre tem acesso total..."
- Todos os checks marcados e disabled.
- Botão "Salvar permissões" ausente.

- [ ] **Step 5: Criar role custom**

Clicar "Nova role". Preencher `coordenador` / `Coordenador`. Submeter. Verificar:
- Redirect para `/configuracoes/perfis/coordenador`.
- Matriz aparece toda vazia (zero checks).
- Marcar alguns checks e salvar.
- Voltar pra lista → mostra "Coordenador" como Custom com botão Excluir.

- [ ] **Step 6: Excluir role custom**

Clicar Excluir em "Coordenador". Verificar redirect com flash "Role excluída."

- [ ] **Step 7: Tentar excluir role sistema via curl direto (validação backend)**

```bash
# Capturar cookie da sessão atual (devtools → application → cookies)
curl -X POST http://localhost:3000/configuracoes/perfis -H "Cookie: <session>" -F "codigo=admin"
```

Não deve excluir; redirect com `?erro=sistema` ou `?erro=emuso`.

- [ ] **Step 8: Commit (sem mudanças, só validação)**

```bash
# se algum ajuste feito durante smoke, commitar agora
git status
```

Se ajustes: commit com `fix(rbac): ajustes pós-smoke test`. Senão, prosseguir.

---

## Task 11: Adicionar `/configuracoes/perfis` ao dropdown de configurações

**Files:**
- Modify: `src/components/layout/configuracoes-dropdown.tsx`

- [ ] **Step 1: Adicionar item ao dropdown**

Editar `src/components/layout/configuracoes-dropdown.tsx`:

```tsx
import {
  Settings,
  School,
  UsersRound,
  Webhook,
  Tags,
  ShieldCheck,
  ChevronDown,
} from "lucide-react";
// ...

const items = [
  { href: "/configuracoes/escola", label: "Dados da escola", icon: School },
  { href: "/usuarios", label: "Usuários", icon: UsersRound },
  { href: "/configuracoes/perfis", label: "Perfis e Permissões", icon: ShieldCheck },
  { href: "/configuracoes/webhook", label: "Webhook", icon: Webhook },
  { href: "/despesas/categorias", label: "Categorias despesa", icon: Tags },
];
```

- [ ] **Step 2: Smoke test**

```bash
npm run dev
```

Verificar item "Perfis e Permissões" aparece no dropdown Configurações.

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/configuracoes-dropdown.tsx
git commit -m "feat(rbac): link Perfis e Permissoes no dropdown Configuracoes"
```

---

## Task 12: Refatorar dropdowns para receber items filtrados

**Files:**
- Modify: `src/components/layout/secretaria-dropdown.tsx`
- Modify: `src/components/layout/rh-dropdown.tsx`
- Modify: `src/components/layout/financeiro-dropdown.tsx`
- Modify: `src/components/layout/configuracoes-dropdown.tsx`

- [ ] **Step 1: Mover listas pra topbar + criar prop `items`**

Padrão: cada dropdown perde `const items = [...]` interno e recebe `items` como prop. Type:

```tsx
type DropdownItem = {
  href: string;
  label: string;
  icon: keyof typeof import("lucide-react");
};
```

Como icons são componentes JSX, melhor passar o componente:

```tsx
import type { LucideIcon } from "lucide-react";

type DropdownItem = {
  href: string;
  label: string;
  Icon: LucideIcon;
};
```

Refatorar **secretaria-dropdown.tsx**:

```tsx
"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, ChevronDown, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type DropdownItem = {
  href: string;
  label: string;
  Icon: LucideIcon;
};

export function SecretariaDropdown({ items }: { items: DropdownItem[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number; width: number }>({ left: 0, top: 0, width: 0 });
  const ref = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  if (items.length === 0) return null;  // dropdown vazio = some

  const hrefs = items.map((i) => i.href);
  const isActive = hrefs.some((href) => pathname === href || pathname.startsWith(`${href}/`));

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current?.contains(e.target as Node)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  useEffect(() => {
    if (!open || !btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    setPos({ left: r.left, top: r.bottom + 6, width: 192 });
  }, [open]);

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex h-[30px] shrink-0 items-center gap-[7px] rounded-[7px] px-2.5 text-[12px] font-semibold no-underline outline-none focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40 transition-all duration-150",
          isActive
            ? "bg-white text-[#1B3FB8] shadow-[0_1px_0_rgba(255,255,255,0.16)_inset,0_6px_14px_-6px_rgba(0,0,0,0.25)]"
            : "text-white/70 hover:bg-white/[0.18] hover:text-white"
        )}
      >
        <BookOpen size={13} strokeWidth={isActive ? 2 : 1.7} />
        Secretaria
        <ChevronDown size={11} strokeWidth={2} className={cn("transition-transform duration-150", open && "rotate-180")} />
      </button>

      {open && mounted
        ? createPortal(
            <div
              style={{ position: "fixed", left: pos.left, top: pos.top, width: pos.width, zIndex: 9999 }}
              className="rounded-[10px] border border-[#1B3FB8]/20 bg-white shadow-[0_14px_40px_-10px_rgba(0,0,0,0.18),0_2px_8px_-4px_rgba(0,0,0,0.08)] p-1"
              onMouseDown={(e) => e.stopPropagation()}
            >
              {items.map((item) => {
                const { Icon } = item;
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex items-center gap-2.5 px-2.5 py-2 text-[12px] rounded-[7px] transition-colors duration-100",
                      active
                        ? "bg-[#1B3FB8]/[0.07] font-semibold text-[#1B3FB8]"
                        : "font-medium text-[#1A2240] hover:bg-slate-50"
                    )}
                  >
                    <Icon size={13} strokeWidth={active ? 2 : 1.7} />
                    {item.label}
                  </Link>
                );
              })}
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
```

- [ ] **Step 2: Repetir refactor em rh-dropdown.tsx, financeiro-dropdown.tsx, configuracoes-dropdown.tsx**

Mesmo padrão: `items: DropdownItem[]` via prop, `if (items.length === 0) return null`, mapear `item.Icon`. Manter ícone do botão (BookOpen/Briefcase/BarChart3/Settings) hardcoded — só os items internos são parametrizados.

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```

Expected: erros em `topbar.tsx` porque dropdowns agora exigem prop. Próximo task corrige.

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/secretaria-dropdown.tsx src/components/layout/rh-dropdown.tsx src/components/layout/financeiro-dropdown.tsx src/components/layout/configuracoes-dropdown.tsx
git commit -m "refactor(layout): dropdowns recebem items via prop (preparacao para filtro RBAC)"
```

---

## Task 13: Topbar passa items filtrados por permissão

**Files:**
- Modify: `src/components/layout/topbar.tsx`

- [ ] **Step 1: Centralizar listas + filtrar por permissão**

Editar `src/components/layout/topbar.tsx`:

```tsx
import Link from "next/link";
import {
  BookOpen, Cake, CalendarCheck, ClipboardCheck, ClipboardList,
  DoorOpen, FileText, GraduationCap, HandHeart, Inbox, Layers3,
  Network, UserCheck, UsersRound, School, Webhook, Tags, Settings,
  ShieldCheck, Briefcase, Building2, Wallet, SlidersHorizontal,
  BarChart3, CreditCard, ReceiptText, Receipt, AlertCircle, type LucideIcon,
} from "lucide-react";
import { TopbarNavLink, type TopbarIconName } from "@/components/layout/topbar-nav-link";
import { SecretariaDropdown, type DropdownItem } from "@/components/layout/secretaria-dropdown";
import { RhDropdown } from "@/components/layout/rh-dropdown";
import { FinanceiroDropdown } from "@/components/layout/financeiro-dropdown";
import { ConfiguracoesDropdown } from "@/components/layout/configuracoes-dropdown";
import { NotificationBell } from "@/components/layout/notification-bell";
import { TopbarUserCard } from "@/components/layout/topbar-user-card";
import { logoutAction } from "@/lib/actions/auth";
import type { SessionProfile } from "@/lib/auth/session";
import { listNotificacoes } from "@/lib/data/notificacoes";
import { createServerClient } from "@/lib/supabase/server";
import { getPublicUrl } from "@/lib/storage/public-urls";
import { AnoLetivoPicker } from "@/components/layout/ano-letivo-picker";
import { can, ROTA_PARA_MODULO, type PermissionMap } from "@/lib/auth/permissions";

// Listas mestras (mesmo conteúdo que antes ficava dentro de cada dropdown)
const SECRETARIA_ITEMS: Array<DropdownItem & { rota?: string }> = [
  { href: "/alunos", label: "Alunos", Icon: UsersRound },
  { href: "/bolsistas", label: "Bolsistas", Icon: HandHeart },
  { href: "/matriculas", label: "Matrículas", Icon: FileText },
  { href: "/series", label: "Séries", Icon: Layers3 },
  { href: "/turmas", label: "Turmas", Icon: GraduationCap },
  { href: "/disciplinas", label: "Disciplinas", Icon: ClipboardList },
  { href: "/avaliacoes", label: "Avaliações", Icon: ClipboardCheck },
  { href: "/professores/atribuicoes", label: "Atribuições", Icon: UserCheck },
  { href: "/frequencias", label: "Frequência", Icon: CalendarCheck },
  { href: "/portaria", label: "Portaria", Icon: DoorOpen },
  { href: "/mural/aniversariantes", label: "Mural aniversários", Icon: Cake },
  { href: "/organograma", label: "Organograma", Icon: Network },
  { href: "/importacoes", label: "Importações", Icon: Inbox },
];

const RH_ITEMS: DropdownItem[] = [
  { href: "/rh/empresas", label: "Empresas", Icon: Building2 },
  { href: "/rh/funcionarios", label: "Funcionários", Icon: UsersRound },
  { href: "/rh/folha", label: "Folha", Icon: Wallet },
  { href: "/rh/brackets", label: "Brackets", Icon: SlidersHorizontal },
  { href: "/rh/documentos", label: "Documentos", Icon: FileText },
];

const FINANCEIRO_ITEMS: DropdownItem[] = [
  { href: "/financeiro", label: "Financeiro", Icon: BarChart3 },
  { href: "/despesas", label: "Despesas", Icon: Receipt },
  { href: "/valores-praticados", label: "Valores praticados", Icon: ReceiptText },
  { href: "/planos", label: "Planos", Icon: CreditCard },
  { href: "/relatorios/inadimplencia", label: "Inadimplência", Icon: AlertCircle },
];

const CONFIG_ITEMS: DropdownItem[] = [
  { href: "/configuracoes/escola", label: "Dados da escola", Icon: School },
  { href: "/usuarios", label: "Usuários", Icon: UsersRound },
  { href: "/configuracoes/perfis", label: "Perfis e Permissões", Icon: ShieldCheck },
  { href: "/configuracoes/webhook", label: "Webhook", Icon: Webhook },
  { href: "/despesas/categorias", label: "Categorias despesa", Icon: Tags },
];

function filterByPermissions(items: DropdownItem[], perms: PermissionMap, isAdmin: boolean): DropdownItem[] {
  if (isAdmin) return items;
  return items.filter((item) => {
    const modulo = ROTA_PARA_MODULO[item.href];
    if (!modulo) return true;  // rota não mapeada = sempre visível
    return can(perms, modulo, "read");
  });
}

export async function Topbar({
  perfil,
  anosLetivos,
  permissions,
}: {
  perfil: SessionProfile;
  anosLetivos: number[];
  permissions: PermissionMap;
}) {
  const supabase = await createServerClient();
  const [notifs, escolaRes, perfilRes] = await Promise.all([
    listNotificacoes(perfil.id, perfil.escola_id, 20),
    supabase.from("escolas").select("nome, logo_url").eq("id", perfil.escola_id).maybeSingle(),
    supabase.from("perfis").select("foto_url").eq("id", perfil.id).maybeSingle(),
  ]);
  const escolaNome = escolaRes.data?.nome ?? "RRB Escola";
  const [logoUrl, avatarUrl] = await Promise.all([
    getPublicUrl("escola-logos", escolaRes.data?.logo_url),
    getPublicUrl("perfis-fotos", perfilRes.data?.foto_url),
  ]);

  const isAdmin = perfil.perfil === "admin";
  const secretariaItems = filterByPermissions(SECRETARIA_ITEMS, permissions, isAdmin);
  const rhItems = filterByPermissions(RH_ITEMS, permissions, isAdmin);
  const financeiroItems = filterByPermissions(FINANCEIRO_ITEMS, permissions, isAdmin);
  const configItems = filterByPermissions(CONFIG_ITEMS, permissions, isAdmin);

  return (
    <header
      className="sticky top-0 z-50 border-b border-black/20"
      style={{
        height: 56,
        background: "linear-gradient(180deg, #1B3FB8 0%, #15349E 100%)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
      }}
    >
      <div className="mx-auto flex h-full max-w-7xl items-center gap-3.5 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="shrink-0">
          <BrandBlock logoUrl={logoUrl} nome={escolaNome} />
        </Link>

        <nav className="no-scrollbar flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto overflow-y-hidden h-full py-0" style={{ scrollbarWidth: "none" }}>
          <TopbarNavLink href="/" label="Dashboard" icon="LayoutDashboard" variant="primary" />
          <span className="mx-1 h-5 w-px shrink-0 bg-white/20" />
          {(isAdmin || can(permissions, "relatorios", "read")) && (
            <>
              <TopbarNavLink href="/relatorios/alunos" label="Rel. Alunos" icon="UsersRound" variant="secondary" />
              <TopbarNavLink href="/relatorios/frequencia" label="Rel. Frequência" icon="CalendarCheck" variant="secondary" />
            </>
          )}
        </nav>

        <div className="flex items-center gap-0.5 shrink-0">
          <FinanceiroDropdown items={financeiroItems} />
          <SecretariaDropdown items={secretariaItems} />
          <RhDropdown items={rhItems} />
          <ConfiguracoesDropdown items={configItems} />
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <AnoLetivoPicker anos={anosLetivos} />
          <NotificationBell perfilId={perfil.id} escolaId={perfil.escola_id} initial={notifs} />
          <TopbarUserCard perfil={perfil} logoutAction={logoutAction} avatarUrl={avatarUrl} />
        </div>
      </div>
    </header>
  );
}

function BrandBlock({ logoUrl, nome }: { logoUrl: string | null; nome: string }) {
  return (
    <div className="flex items-center gap-2.5 pr-4 border-r border-white/[0.12] shrink-0">
      <div className="relative flex h-[34px] w-[34px] shrink-0 items-center justify-center overflow-hidden rounded-[8px] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.20),inset_0_-1px_0_rgba(0,0,0,0.05)]">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt={nome} className="h-full w-full object-contain p-0.5" />
        ) : (
          <>
            <span className="absolute -right-1.5 top-0 h-9 w-5 rotate-[34deg] bg-[#ff2424] opacity-80" />
            <School className="relative z-10 text-[#1B3FB8]" size={16} strokeWidth={2} />
          </>
        )}
      </div>
      <div className="leading-[1.15] min-w-0">
        <div className="text-[12.5px] font-semibold text-white tracking-[-0.005em]">{nome}</div>
        <div className="text-[10px] text-white/50 mt-px tracking-[-0.003em]">Sistemas de Gestão Escolar</div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Atualizar layout para passar permissions**

Editar `src/app/(app)/layout.tsx`:

```tsx
import { Topbar } from "@/components/layout/topbar";
import { requireSession } from "@/lib/auth/session";
import { runDailyNotifications } from "@/lib/server/notify-daily";
import { createServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  runDailyNotifications(session.profile.escola_id).catch(() => {});

  const supabase = await createServerClient();
  const { data: anosData } = await supabase
    .from("turmas")
    .select("ano_letivo")
    .eq("escola_id", session.profile.escola_id)
    .order("ano_letivo", { ascending: false });

  const anosLetivos: number[] = Array.from(
    new Set((anosData ?? []).map((r) => r.ano_letivo))
  );
  if (!anosLetivos.includes(new Date().getFullYear())) {
    anosLetivos.push(new Date().getFullYear());
    anosLetivos.sort((a, b) => b - a);
  }

  return (
    <div className="ds-shell">
      <Topbar perfil={session.profile} anosLetivos={anosLetivos} permissions={session.permissions} />
      <main>
        <div className="mx-auto min-h-[calc(100vh-72px)] max-w-7xl px-4 py-6 sm:px-6 lg:px-8">{children}</div>
      </main>
    </div>
  );
}
```

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```

Expected: zero errors.

- [ ] **Step 4: Smoke test multi-role**

Necessário criar um user secretaria via `/usuarios/novo` e logar como ele. Verificar:
- Como **admin**: todos os 4 dropdowns aparecem com todos os itens.
- Como **secretaria**: dropdowns "Financeiro" sem write-only items, "RH" some (zero items), "Configurações" some (zero items), "Secretaria" full.
- Como **professor**: só Secretaria com `alunos/turmas/series` (read), tudo mais some.

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/topbar.tsx src/app/\(app\)/layout.tsx
git commit -m "feat(rbac): topbar filtra dropdowns por permissoes do role"
```

---

## Task 14: Dashboard derivado de permissões

**Files:**
- Modify: `src/app/(app)/page.tsx`

- [ ] **Step 1: Refatorar page.tsx para queries + cards condicionais**

Substituir todo o `Promise.all` por busca lazy condicionada por permissão, e render dos cards/tabs por gate.

```tsx
// src/app/(app)/page.tsx (versão completa)
import { Download, Plus, Upload } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { requireSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import {
  currentCompetencia,
  getAlertas,
  getAniversariantes,
  getAniversariantesMatricula,
  getBeneficios,
  getEscolaConfig,
  getFolhaPorEmpresa,
  getFolhaRatio,
  getFrequenciaPorTurma,
  getFrequenciaResumo,
  getHero,
  getInadimplencia,
  getOcupacao,
  getProximasCobrancas,
  getRankingTurmas,
  getSaldoYTD,
  getRealizadoVsProjetado,
  getRenovacoesPendentes,
  getRepasseRecebido,
  getRevenueTrend,
  getSaudeSistema,
  getStageBreakdown,
  getTicketMedio,
  getTopCategoriasDespesas,
  getTopDevedores,
  type DevedorRow,
  type InadimplenciaData,
  type RenovacaoRow,
  type RepasseData,
} from "@/lib/data/dashboard-executive";
import { AlertList } from "@/components/dashboard/alert-list";
import { AniversariantesCard } from "@/components/dashboard/aniversariantes-card";
import { AniversarioMatriculaCard } from "@/components/dashboard/aniversario-matricula-card";
import { BeneficiosCard } from "@/components/dashboard/beneficios-card";
import { BolsistasReceitaCard } from "@/components/dashboard/bolsistas-receita-card";
import { CompetenciaPicker } from "@/components/dashboard/competencia-picker";
import { DashboardTabs, parseTab } from "@/components/dashboard/dashboard-tabs";
import { FolhaEmpresas } from "@/components/dashboard/folha-empresas";
import { HeroFinancial } from "@/components/dashboard/hero-financial";
import { FolhaRatioCard } from "@/components/dashboard/folha-ratio-card";
import { FrequenciaCard } from "@/components/dashboard/frequencia-card";
import { EvasaoCard } from "@/components/dashboard/evasao-card";
import { FrequenciaHeatmap } from "@/components/dashboard/frequencia-heatmap";
import { MediasDisciplinasCard } from "@/components/dashboard/medias-disciplinas-card";
import { PedagogicoOverviewSection } from "@/components/dashboard/pedagogico-overview-section";
import { ProximasCobrancasCard } from "@/components/dashboard/proximas-cobrancas-card";
import { RankingAlunosCard } from "@/components/dashboard/ranking-alunos-card";
import { RankingTurmasCard } from "@/components/dashboard/ranking-turmas-card";
import { RealizadoProjetadoCard } from "@/components/dashboard/realizado-projetado-card";
import { SaldoYTDCard } from "@/components/dashboard/saldo-ytd-card";
import { SaudeSistemaCard } from "@/components/dashboard/saude-sistema-card";
import { TopCategoriasCard } from "@/components/dashboard/top-categorias-card";
import {
  getEvasao,
  getFrequenciaDetalhada,
  getMediasPorDisciplina,
  getPedagogicoOverview,
  getPedagogicoSummary,
  getRankingAlunos,
} from "@/lib/data/pedagogico";
import { MetricRing } from "@/components/dashboard/metric-ring";
import { RenovacoesPendentes } from "@/components/dashboard/renovacoes-pendentes";
import { RepasseCard } from "@/components/dashboard/repasse-card";
import { RevenueTrendChart } from "@/components/dashboard/revenue-trend-chart";
import { StageTable } from "@/components/dashboard/stage-table";
import { TicketCard } from "@/components/dashboard/ticket-card";
import { TopDevedores } from "@/components/dashboard/top-devedores";
import { money } from "@/lib/constants";

const MESES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

function mesLabel(competencia: string): string {
  const [y, m] = competencia.split("-").map(Number);
  return `${MESES[(m as number) - 1]}/${y}`;
}

function isValidCompetencia(v: string | undefined): v is string {
  return typeof v === "string" && /^\d{4}-\d{2}$/.test(v);
}

function isValidAno(val: string | undefined): boolean {
  if (!val) return false;
  const n = Number(val);
  return Number.isInteger(n) && n >= 2000 && n <= 2100;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ aba?: string; competencia?: string; ano?: string }>;
}) {
  const params = await searchParams;
  const aba = parseTab(params.aba);

  const session = await requireSession();
  const escolaId = session.profile.escola_id;
  const isAdmin = session.profile.perfil === "admin";
  const perms = session.permissions;
  const has = (m: Parameters<typeof can>[1]): boolean => isAdmin || can(perms, m, "read");

  // Permissões de visibilidade por card
  const showFinanceiro = has("financeiro.cobrancas");
  const showDespesas = has("despesas");
  const showBolsistas = has("bolsistas");
  const showRhFolha = has("rh.folha");
  const showAlunos = has("alunos");
  const showMatriculas = has("matriculas");
  const showFrequencias = has("frequencias");
  const showTurmas = has("turmas");
  const showAvaliacoes = has("avaliacoes");

  // Tabs derivadas
  const showTabFinanceiro = showFinanceiro || showDespesas || showBolsistas || showRhFolha;
  const showTabAlunos = showAlunos || showMatriculas || showFrequencias || showTurmas;
  const showTabPedagogico = showAvaliacoes || showFrequencias;

  const tabsVisiveis: Array<"financeiro" | "alunos" | "pedagogico"> = [];
  if (showTabFinanceiro) tabsVisiveis.push("financeiro");
  if (showTabAlunos) tabsVisiveis.push("alunos");
  if (showTabPedagogico) tabsVisiveis.push("pedagogico");

  if (tabsVisiveis.length === 0) {
    return (
      <div className="grid gap-8">
        <PageHeader
          breadcrumb={[{ label: "Gestão" }, { label: "Dashboard" }]}
          title="Dashboard"
          description="Sem dashboards configurados para o seu perfil."
        />
        <div className="rounded-ui bg-muted p-12 text-center text-ink/55">
          Seu perfil não tem permissão para visualizar nenhum dashboard. Contate um administrador.
        </div>
      </div>
    );
  }

  // Tab efetiva (se URL passar tab indisponível, usar primeira disponível)
  const tabEfetiva = (tabsVisiveis as string[]).includes(aba) ? aba : tabsVisiveis[0];

  const competencia = isValidCompetencia(params.competencia) ? params.competencia : currentCompetencia();
  const anoLetivo = isValidAno(params.ano) ? Number(params.ano) : new Date().getFullYear();
  const config = await getEscolaConfig(escolaId);
  const isPropria = config.gestaoFinanceira === "propria";

  // Queries condicionais — só roda o que será mostrado
  type Q<T> = Promise<T> | null;
  const qHero: Q<Awaited<ReturnType<typeof getHero>>> = showFinanceiro ? getHero(competencia, escolaId) : null;
  const qTrend: Q<Awaited<ReturnType<typeof getRevenueTrend>>> = showFinanceiro ? getRevenueTrend(6, escolaId) : null;
  const qTicket: Q<Awaited<ReturnType<typeof getTicketMedio>>> = showFinanceiro ? getTicketMedio(6, escolaId) : null;
  const qFolhaRatio: Q<Awaited<ReturnType<typeof getFolhaRatio>>> = showRhFolha ? getFolhaRatio(competencia, escolaId) : null;
  const qFolhaEmpresas: Q<Awaited<ReturnType<typeof getFolhaPorEmpresa>>> = showRhFolha ? getFolhaPorEmpresa(competencia, escolaId) : null;
  const qBeneficios: Q<Awaited<ReturnType<typeof getBeneficios>>> = showBolsistas ? getBeneficios(escolaId, anoLetivo) : null;
  const qSaldoYTD: Q<Awaited<ReturnType<typeof getSaldoYTD>>> = showFinanceiro ? getSaldoYTD(escolaId, anoLetivo) : null;
  const qRealProj: Q<Awaited<ReturnType<typeof getRealizadoVsProjetado>>> = showFinanceiro ? getRealizadoVsProjetado(competencia, escolaId, anoLetivo) : null;
  const qAlertas: Q<Awaited<ReturnType<typeof getAlertas>>> = getAlertas(competencia, config.gestaoFinanceira, escolaId, anoLetivo);
  const qProxCobr: Q<Awaited<ReturnType<typeof getProximasCobrancas>>> = showFinanceiro && isPropria ? getProximasCobrancas(escolaId, 7) : null;
  const qTopCat: Q<Awaited<ReturnType<typeof getTopCategoriasDespesas>>> = showDespesas ? getTopCategoriasDespesas(competencia, escolaId, 6) : null;
  const qOcupacao: Q<Awaited<ReturnType<typeof getOcupacao>>> = showAlunos ? getOcupacao(escolaId, anoLetivo) : null;
  const qFreq: Q<Awaited<ReturnType<typeof getFrequenciaResumo>>> = showFrequencias ? getFrequenciaResumo(escolaId, 30, anoLetivo) : null;
  const qFreqTurma: Q<Awaited<ReturnType<typeof getFrequenciaPorTurma>>> = showFrequencias ? getFrequenciaPorTurma(escolaId, 30, anoLetivo) : null;
  const qStages: Q<Awaited<ReturnType<typeof getStageBreakdown>>> = showMatriculas ? getStageBreakdown(competencia, escolaId, anoLetivo) : null;
  const qRankTurmas: Q<Awaited<ReturnType<typeof getRankingTurmas>>> = showTurmas ? getRankingTurmas(escolaId, 10, anoLetivo) : null;
  const qAniv: Q<Awaited<ReturnType<typeof getAniversariantes>>> = showAlunos ? getAniversariantes(escolaId, 10) : null;
  const qAnivMat: Q<Awaited<ReturnType<typeof getAniversariantesMatricula>>> = showAlunos ? getAniversariantesMatricula(escolaId, 10, anoLetivo) : null;
  const qSaude: Q<Awaited<ReturnType<typeof getSaudeSistema>>> = getSaudeSistema(escolaId);
  const qSlot2: Q<InadimplenciaData | RepasseData> = showFinanceiro
    ? (isPropria ? getInadimplencia(competencia, escolaId) : getRepasseRecebido(competencia, escolaId))
    : null;
  const qSlot5: Q<DevedorRow[] | RenovacaoRow[]> = (showFinanceiro || showMatriculas)
    ? (isPropria ? getTopDevedores(5, escolaId) : getRenovacoesPendentes(5, escolaId))
    : null;
  const qPedOverview: Q<Awaited<ReturnType<typeof getPedagogicoOverview>>> = showAvaliacoes ? getPedagogicoOverview(escolaId) : null;
  const qEvasao: Q<Awaited<ReturnType<typeof getEvasao>>> = showAlunos ? getEvasao(escolaId) : null;
  const qFreqDet: Q<Awaited<ReturnType<typeof getFrequenciaDetalhada>>> = showFrequencias ? getFrequenciaDetalhada(escolaId, 60) : null;
  const qMediasDisc: Q<Awaited<ReturnType<typeof getMediasPorDisciplina>>> = showAvaliacoes ? getMediasPorDisciplina(escolaId) : null;
  const qPedSumm: Q<Awaited<ReturnType<typeof getPedagogicoSummary>>> = showAvaliacoes ? getPedagogicoSummary(escolaId) : null;
  const qRankAlunos: Q<Awaited<ReturnType<typeof getRankingAlunos>>> = showAvaliacoes ? getRankingAlunos(escolaId, undefined, 10) : null;

  const [
    hero, trend, ticket, folhaRatio, folhaEmpresas, beneficios, saldoYTD,
    realizadoVsProjetado, alertas, proximasCobrancas, topCategorias,
    ocupacao, frequencia, frequenciaPorTurma, stages, rankingTurmas,
    aniversariantes, aniversariantesMatricula, saudeSistema, slot2, slot5,
    pedagogicoOverview, evasao, freqDetalhada, mediasDisc, pedagogicoSummary, rankingAlunos,
  ] = await Promise.all([
    qHero, qTrend, qTicket, qFolhaRatio, qFolhaEmpresas, qBeneficios, qSaldoYTD,
    qRealProj, qAlertas, qProxCobr, qTopCat,
    qOcupacao, qFreq, qFreqTurma, qStages, qRankTurmas,
    qAniv, qAnivMat, qSaude, qSlot2, qSlot5,
    qPedOverview, qEvasao, qFreqDet, qMediasDisc, qPedSumm, qRankAlunos,
  ]);

  const ocupacaoPct = ocupacao && ocupacao.total > 0 ? ocupacao.ocupadas / ocupacao.total : 0;

  return (
    <div className="grid gap-8">
      <PageHeader
        breadcrumb={[{ label: "Gestão" }, { label: "Dashboard" }]}
        title="Dashboard"
        counter={mesLabel(competencia)}
        description="Visão executiva para tomada de decisão."
        actions={
          <>
            <CompetenciaPicker current={competencia} />
            {isAdmin || can(perms, "relatorios", "read") ? (
              <ButtonLink href="/relatorios/alunos" variant="secondary">
                <Download size={14} /> Exportar
              </ButtonLink>
            ) : null}
            {(isAdmin || can(perms, "importacoes", "create")) && (
              <ButtonLink href="/importacoes" variant="secondary">
                <Upload size={14} /> Importar
              </ButtonLink>
            )}
            {(isAdmin || can(perms, "alunos", "create")) && (
              <ButtonLink href="/alunos/novo" variant="primary">
                <Plus size={14} /> Novo aluno
              </ButtonLink>
            )}
          </>
        }
      />

      <DashboardTabs active={tabEfetiva} competencia={competencia} visible={tabsVisiveis} />

      {tabEfetiva === "financeiro" && (
        <>
          {hero && <HeroFinancial data={hero} />}
          <section className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {folhaRatio && <FolhaRatioCard data={folhaRatio} />}
            {ticket && <TicketCard data={ticket} />}
            {beneficios && <BolsistasReceitaCard data={beneficios} />}
            {saldoYTD && <SaldoYTDCard data={saldoYTD} />}
          </section>
          {realizadoVsProjetado && <RealizadoProjetadoCard data={realizadoVsProjetado} />}
          <section className="grid gap-6 lg:grid-cols-3">
            {alertas && <AlertList items={alertas} />}
            {trend && (
              <div className="lg:col-span-2">
                <RevenueTrendChart data={trend} />
              </div>
            )}
          </section>
          {proximasCobrancas && isPropria && <ProximasCobrancasCard items={proximasCobrancas} />}
          <section className="grid gap-6 lg:grid-cols-2">
            {topCategorias && <TopCategoriasCard items={topCategorias} />}
            {folhaEmpresas && <FolhaEmpresas items={folhaEmpresas} />}
          </section>
        </>
      )}

      {tabEfetiva === "alunos" && (
        <>
          <section className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {ocupacao && (
              <MetricRing
                label="Ocupação"
                percent={ocupacaoPct}
                centerLabel="Vagas"
                centerValue={`${ocupacao.ocupadas}/${ocupacao.total}`}
              />
            )}
            {frequencia && frequenciaPorTurma && <FrequenciaCard data={frequencia} porTurma={frequenciaPorTurma} />}
            {beneficios && <BeneficiosCard data={beneficios} />}
            {ocupacao && (
              <article className="rounded-panel bg-surface p-6 shadow-soft">
                <p className="text-[0.66rem] font-bold uppercase tracking-kicker text-ink/55">Resumo</p>
                <dl className="mt-4 grid gap-3">
                  <div className="flex items-baseline justify-between">
                    <dt className="text-sm text-ink/70">Pagantes</dt>
                    <dd className="text-xl font-bold text-ink">{ocupacao.pagantes}</dd>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <dt className="text-sm text-ink/70">Beneficiados</dt>
                    <dd className="text-xl font-bold text-accent">{ocupacao.beneficiados}</dd>
                  </div>
                  <div className="flex items-baseline justify-between border-t border-line pt-3">
                    <dt className="text-sm font-semibold text-ink">Total ativos</dt>
                    <dd className="text-2xl font-bold text-brand">{ocupacao.ocupadas}</dd>
                  </div>
                </dl>
              </article>
            )}
          </section>

          {stages && <StageTable rows={stages} />}

          <section className="grid gap-6 lg:grid-cols-2">
            {rankingTurmas && <RankingTurmasCard items={rankingTurmas} />}
            {aniversariantes && <AniversariantesCard items={aniversariantes} />}
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            {aniversariantesMatricula && <AniversarioMatriculaCard items={aniversariantesMatricula} />}
            {saudeSistema && <SaudeSistemaCard data={saudeSistema} />}
          </section>

          {slot5 && !isPropria && <RenovacoesPendentes items={slot5 as RenovacaoRow[]} />}
          {slot5 && isPropria && <TopDevedores items={slot5 as DevedorRow[]} />}
        </>
      )}

      {tabEfetiva === "pedagogico" && (
        <>
          {pedagogicoOverview && <PedagogicoOverviewSection data={pedagogicoOverview} />}
          <section className="grid gap-6 lg:grid-cols-2">
            {evasao && <EvasaoCard data={evasao} />}
            {freqDetalhada && <FrequenciaHeatmap data={freqDetalhada} />}
          </section>
          {mediasDisc && pedagogicoSummary && <MediasDisciplinasCard rows={mediasDisc} summary={pedagogicoSummary} />}
          {rankingAlunos && <RankingAlunosCard items={rankingAlunos} />}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Estender DashboardTabs para receber `visible`**

Editar `src/components/dashboard/dashboard-tabs.tsx` (verificar primeiro com Read). Adicionar prop `visible?: Array<"financeiro" | "alunos" | "pedagogico">` e filtrar renderização. Se prop ausente, default = all three.

```tsx
// trecho relevante:
const DEFAULT_TABS = ["financeiro", "alunos", "pedagogico"] as const;

export function DashboardTabs({
  active,
  competencia,
  visible,
}: {
  active: string;
  competencia: string;
  visible?: ReadonlyArray<typeof DEFAULT_TABS[number]>;
}) {
  const tabs = visible ?? DEFAULT_TABS;
  // ... mantém resto
}
```

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```

Expected: zero errors.

- [ ] **Step 4: Smoke test dashboard multi-role**

`npm run dev` e logar como cada role:

- **admin** → 3 tabs, todos cards.
- **secretaria** → tabs alunos + pedagogico (tem read em frequencias) + financeiro (tem read em financeiro.cobrancas + despesas + bolsistas). Cards write-only somem.
- **financeiro** → tab financeiro + alunos (read em alunos, matriculas), sem tab pedagogico. Cards de despesas+folha aparecem.
- **professor** → tabs alunos + pedagogico. Sem tab financeiro. Sem cards de financeiro/despesas/folha.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(app\)/page.tsx src/components/dashboard/dashboard-tabs.tsx
git commit -m "feat(rbac): dashboard cards e tabs derivados de permissoes"
```

---

## Task 15: Route gating em pages top-level

**Files (modify):**
- `src/app/(app)/alunos/page.tsx`
- `src/app/(app)/matriculas/page.tsx`
- `src/app/(app)/importacoes/page.tsx`
- `src/app/(app)/financeiro/page.tsx`
- `src/app/(app)/despesas/page.tsx`
- `src/app/(app)/planos/page.tsx`
- `src/app/(app)/valores-praticados/page.tsx`
- `src/app/(app)/bolsistas/page.tsx`
- `src/app/(app)/rh/funcionarios/page.tsx`
- `src/app/(app)/rh/empresas/page.tsx`
- `src/app/(app)/rh/folha/page.tsx`
- `src/app/(app)/avaliacoes/page.tsx`
- `src/app/(app)/frequencias/page.tsx`
- `src/app/(app)/disciplinas/page.tsx`
- `src/app/(app)/series/page.tsx`
- `src/app/(app)/turmas/page.tsx`
- `src/app/(app)/professores/atribuicoes/page.tsx`
- `src/app/(app)/organograma/page.tsx`
- `src/app/(app)/portaria/page.tsx`
- `src/app/(app)/relatorios/alunos/page.tsx`
- `src/app/(app)/relatorios/frequencia/page.tsx`
- `src/app/(app)/relatorios/inadimplencia/page.tsx`
- `src/app/(app)/usuarios/page.tsx`
- `src/app/(app)/usuarios/novo/page.tsx`
- `src/app/(app)/usuarios/[id]/editar/page.tsx`
- `src/app/(app)/configuracoes/escola/page.tsx`
- `src/app/(app)/configuracoes/webhook/page.tsx`

- [ ] **Step 1: Substituir requireSession/requireAdmin por requirePermission em cada page**

Padrão genérico:

```tsx
// Antes
import { requireSession } from "@/lib/auth/session";
// ...
const session = await requireSession();
```

```tsx
// Depois
import { requirePermission } from "@/lib/auth/session";
// ...
const session = await requirePermission("alunos", "read");
```

Mapa rota → módulo (referência):

| Page | Módulo |
|---|---|
| `/alunos/page.tsx` | `alunos` |
| `/matriculas/page.tsx` | `matriculas` |
| `/importacoes/page.tsx` | `importacoes` |
| `/financeiro/page.tsx` | `financeiro.cobrancas` |
| `/despesas/page.tsx` | `despesas` |
| `/planos/page.tsx` | `planos` |
| `/valores-praticados/page.tsx` | `valores-praticados` |
| `/bolsistas/page.tsx` | `bolsistas` |
| `/rh/funcionarios/page.tsx` | `rh.funcionarios` |
| `/rh/empresas/page.tsx` | `rh.empresas` |
| `/rh/folha/page.tsx` | `rh.folha` |
| `/avaliacoes/page.tsx` | `avaliacoes` |
| `/frequencias/page.tsx` | `frequencias` |
| `/disciplinas/page.tsx` | `disciplinas` |
| `/series/page.tsx` | `series` |
| `/turmas/page.tsx` | `turmas` |
| `/professores/atribuicoes/page.tsx` | `professores` |
| `/organograma/page.tsx` | `organograma` |
| `/portaria/page.tsx` | `portaria` |
| `/relatorios/**/page.tsx` | `relatorios` |
| `/usuarios/**/page.tsx` | `usuarios` |
| `/configuracoes/escola/page.tsx` | `configuracoes.escola` |
| `/configuracoes/webhook/page.tsx` | `configuracoes.webhook` |

**Para pages de detalhe/editar:** usar `"update"` em vez de `"read"`. Para `/novo`: `"create"`.

Exemplo `/usuarios/page.tsx`:

```tsx
// substituir
await requireAdmin();
// por
await requirePermission("usuarios", "read");
```

`/usuarios/novo/page.tsx`:
```tsx
await requirePermission("usuarios", "create");
```

`/usuarios/[id]/editar/page.tsx`:
```tsx
await requirePermission("usuarios", "update");
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: zero errors. Se algum page usa `session.profile.perfil === "X"` para lógica de negócio (não auth), manter intacto.

- [ ] **Step 3: Build verificação**

```bash
npm run build
```

Expected: build OK.

- [ ] **Step 4: Smoke test cross-role**

`npm run dev`. Logar como `secretaria`. Tentar URL direto `/rh/folha` → deve redirecionar pra `/acesso-negado`.

Tentar `/financeiro` como `secretaria` → permite (tem read).
Tentar `/configuracoes/escola` como `secretaria` → `/acesso-negado`.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(rbac): route gating em todas as pages top-level"
```

---

## Task 16: Gating em server actions

**Files (modify):** todos arquivos sob `src/lib/actions/*.ts`

- [ ] **Step 1: Identificar actions por módulo**

```bash
ls src/lib/actions/
```

Mapa esperado de actions → módulo (atualizar conforme arquivos presentes):

| Action file | Módulo |
|---|---|
| `alunos.ts` | `alunos` |
| `matriculas.ts` | `matriculas` |
| `frequencias.ts` | `frequencias` |
| `avaliacoes.ts` | `avaliacoes` |
| `disciplinas.ts` | `disciplinas` |
| `series.ts` | `series` |
| `turmas.ts` | `turmas` |
| `planos.ts` | `planos` |
| `despesas.ts` | `despesas` |
| `bolsistas.ts` | `bolsistas` |
| `cobrancas.ts` ou similar | `financeiro.cobrancas` |
| `rh-funcionarios.ts` ou similar | `rh.funcionarios` |
| `rh-folha.ts` | `rh.folha` |
| `importacoes.ts` | `importacoes` |
| `valores-praticados.ts` | `valores-praticados` |
| `users.ts` | `usuarios` |
| `perfil.ts` | (próprio usuário — manter requireSession, é meu-perfil) |
| `notificacoes.ts` | (de leitura própria — manter requireSession) |
| `roles.ts` | (já usa requireAdmin) |

- [ ] **Step 2: Substituir gates em cada action**

Padrão: cada action determina o módulo da entidade que manipula e a ação CRUD que executa.

Exemplo `alunos.ts` (action `createAlunoAction`):
```tsx
// Antes
await requireSession();
// Depois
await requirePermission("alunos", "create");
```

Action `updateAlunoAction`:
```tsx
await requirePermission("alunos", "update");
```

Action `deleteAlunoAction`:
```tsx
await requirePermission("alunos", "delete");
```

**Actions cross-módulo** (ex: matricular aluno toca matriculas + cobrancas): protege pelo escopo principal. Comentário curto se não óbvio:
```tsx
// Cross-módulo: criação de matrícula também gera cobranças, mas é fluxo de matrícula
await requirePermission("matriculas", "create");
```

`users.ts` muda:
```tsx
// Antes
await requireAdmin();
// Depois (preservar para criar/excluir users)
await requirePermission("usuarios", "create");
// ou "update" / "delete" conforme a action
```

- [ ] **Step 3: Typecheck + build**

```bash
npm run typecheck && npm run build
```

Expected: zero errors.

- [ ] **Step 4: Smoke test**

`npm run dev`. Logar como `professor`. Tentar criar aluno via UI (se botão aparece — não deve, dropdown filtrado, mas se URL direto `/alunos/novo` chega) → redireciona pra acesso-negado.

Logar como `secretaria`. Criar aluno → OK. Editar aluno → OK. Tentar adicionar despesa (`secretaria` tem read em despesas, não create) → action deve redirecionar com `/acesso-negado` se chamada direta.

- [ ] **Step 5: Commit**

```bash
git add src/lib/actions/
git commit -m "feat(rbac): gating em server actions via requirePermission"
```

---

## Task 17: Validação final + documentação

**Files:**
- Modify: `CLAUDE.md` (se existir) ou criar `docs/rbac-developer-guide.md`

- [ ] **Step 1: Criar guia para desenvolvedores**

```markdown
<!-- docs/rbac-developer-guide.md -->
# RBAC Developer Guide

Sistema de permissões: `roles` × `modulos` × `role_permissoes` (R/C/U/D).

## Regras obrigatórias para NOVAS funcionalidades

1. **Declarar módulo em dois lugares:**
   - `src/lib/auth/permissions.ts` no objeto `MODULOS` (TS).
   - Migration nova que insere em `modulos` (SQL).

2. **Definir permissões default para as 4 roles seed:**
   - Insert em `role_permissoes` para `admin` (full), `secretaria`, `financeiro`, `professor`.
   - Decisão explícita por role.

3. **Gate em page server-side:**
   ```ts
   await requirePermission("seu.modulo", "read");
   ```

4. **Gate em server actions:**
   ```ts
   await requirePermission("seu.modulo", "create" | "update" | "delete");
   ```

5. **Mapear rota em `ROTA_PARA_MODULO`** (`src/lib/auth/permissions.ts`).

6. **Adicionar ao menu/topbar** com permissão correta (será filtrado automaticamente se `ROTA_PARA_MODULO` mapeado).

7. **Cards de dashboard** (se aplicável): declarar gate condicional `can(perms, 'modulo', 'read')`.

## Como criar uma role custom

UI: `/configuracoes/perfis` → "Nova role". Após criar, abrir editor da matriz e marcar permissões.

## Como adicionar um novo sub-módulo

1. Migration:
   ```sql
   insert into modulos (codigo, grupo, nome, ordem)
   values ('meu.modulo', 'secretaria', 'Meu Módulo', 14);

   -- Adicionar permissão default em cada role
   insert into role_permissoes (role_codigo, modulo_codigo, pode_ler, pode_criar, pode_editar, pode_deletar)
   values
     ('admin', 'meu.modulo', true, true, true, true),
     ('secretaria', 'meu.modulo', true, true, true, false),
     ('financeiro', 'meu.modulo', true, false, false, false),
     ('professor', 'meu.modulo', false, false, false, false);
   ```

2. `permissions.ts`:
   ```ts
   "meu.modulo": { grupo: "secretaria", nome: "Meu Módulo" },
   ```

3. `ROTA_PARA_MODULO`:
   ```ts
   "/meu-modulo": "meu.modulo",
   ```

4. Page:
   ```ts
   await requirePermission("meu.modulo", "read");
   ```

## Admin bypass

`requirePermission` retorna imediatamente para `perfil === "admin"` sem checar matriz. Matriz da role admin existe (todos true) só para UI.
```

- [ ] **Step 2: Validação end-to-end**

```bash
npm run lint && npm run typecheck && npm run build
```

Expected: tudo limpo.

- [ ] **Step 3: Smoke test final multi-role**

`npm run dev`. Para cada role (admin, secretaria, financeiro, professor):
- Login funciona.
- Dashboard renderiza com tabs/cards apropriados.
- Topbar mostra menus filtrados.
- Tentar URL direto de página sem permissão → `/acesso-negado`.
- Ações CRUD permitidas funcionam; ações negadas redirecionam.

- [ ] **Step 4: Commit final**

```bash
git add docs/rbac-developer-guide.md
git commit -m "docs(rbac): guia para desenvolvedores sobre como usar o sistema"
```

---

## Self-Review

**Spec coverage:**

| Seção do spec | Task |
|---|---|
| Schema (tabelas, FK, RLS, helper) | Task 1 |
| Seed roles + modulos + role_permissoes | Task 1 |
| Catálogo TS MODULOS + helpers | Task 2 |
| Session estendida + requirePermission | Task 3 |
| Data layer (queries roles) | Task 4 |
| Server actions de roles | Task 5 |
| Componente matriz UI | Task 6 |
| Páginas /configuracoes/perfis (lista/editor/nova) | Tasks 7, 8, 9 |
| Link no dropdown Configurações | Task 11 |
| Topbar filtra dropdowns | Tasks 12, 13 |
| Dashboard derivado | Task 14 |
| Route gating em pages | Task 15 |
| Server actions gating | Task 16 |
| REGRA OBRIGATÓRIA — guia dev | Task 17 |

Coverage completo.

**Placeholder scan:** Nenhum TBD/TODO. Cada step tem código completo ou comando exato.

**Type consistency:**
- `PermissionMap`, `ModuloCodigo`, `Acao`, `Grupo` definidos em Task 2; usados consistentemente daí em diante.
- `requirePermission(modulo, acao)` assinatura Task 3, mesma assinatura em Tasks 15/16.
- `DropdownItem { href, label, Icon }` definido Task 12, usado Task 13.
- `Matrix` em `permissions-matrix.tsx` deriva de `Record<ModuloCodigo, Record<Acao, boolean>>` — bate com `permissoesToMap` retorno em Task 4.
- Form field naming `perm.<modulo>.<acao>` consistente entre Task 5 (server read) e Task 6 (client write).

Sem inconsistências.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-19-rbac-permissoes-dashboards.md`. Two execution options:

**1. Subagent-Driven (recommended)** — dispatch fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
