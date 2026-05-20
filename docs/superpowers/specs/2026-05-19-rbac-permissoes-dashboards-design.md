# RBAC: Permissões por Perfil + Dashboards Derivadas — Design

**Data:** 2026-05-19
**Branch:** feature-mvp2
**Status:** Aprovado para implementação

## Visão Geral

Sistema RBAC (Role-Based Access Control) granular por **grupo > sub-módulo > ação CRUD**. Substitui o atual `perfis.perfil` (string fixa) por FK para nova tabela `roles`, mantendo o código string (`admin`, `secretaria`, `financeiro`, `professor`) como chave. Permissões armazenadas em `role_permissoes` (role × sub-módulo × ação boolean).

Admin configura a matriz de cada perfil via `/configuracoes/perfis`. Pode criar custom roles (ex: "Coordenador", "Diretor") além das 4 seeds protegidas.

Dashboard `/` reflete automaticamente as permissões: cards/tabs declaram `requires: <sub-módulo>` e somem se a role não tem read. Enforcement em duas camadas: UI esconde, server actions chamam `requirePermission()`.

## Decisões-Chave

| Decisão | Escolha | Motivo |
|---|---|---|
| Granularidade | Módulo × {read, create, update, delete} | Equilíbrio controle / complexidade |
| Roles fixas vs custom | 4 seeds + custom roles | Cobre atual e expande |
| Agrupamento UI | Híbrido: grupos colapsáveis com sub-módulos | 25 sub-módulos não cabem em lista plana |
| Dashboard | Derivado das permissões automaticamente | Zero UI extra, coerente |
| Enforcement | UI + server actions (sem RLS por permissão) | Defesa em profundidade prática |
| Schema | FK `perfis.perfil` → `roles.codigo` (string) | Preserva checks `perfil === 'admin'` |
| Admin | Bypass hardcoded em `requirePermission` | Impossível de quebrar |

## REGRA OBRIGATÓRIA: Novas funcionalidades

**Toda funcionalidade nova criada após esta sprint DEVE:**

1. Declarar seu sub-módulo em `src/lib/auth/permissions.ts` (catálogo `MODULOS`) **e** na migration `modulos` (insert seed).
2. Atribuir permissões default para as 4 roles seed na migration `role_permissoes` (decisão explícita: quem vê, quem edita).
3. Page server-side chamar `requirePermission(modulo, "read")` no lugar de `requireSession()`.
4. Server actions chamar `requirePermission(modulo, acao_apropriada)`.
5. Item de menu/topbar usar `NavItemGate` (ou check server-side em props) para esconder se sem permissão.
6. Cards de dashboard (se houver) declarar `requires` e renderizar condicionalmente.

**Checklist no PR de nova feature:**
- [ ] Sub-módulo adicionado em `MODULOS` (TS) e tabela `modulos` (SQL).
- [ ] Defaults atribuídos para `admin`, `secretaria`, `financeiro`, `professor` na migration.
- [ ] Page protegida com `requirePermission`.
- [ ] Server actions protegidas.
- [ ] Item de menu condicional.
- [ ] (Se aplicável) Cards de dashboard com `requires`.

## Schema (Postgres)

Migration: `supabase/migrations/202605300001_rbac_permissoes.sql`

```sql
-- 1) Tabela roles
create table roles (
  codigo text primary key,
  nome text not null,
  descricao text,
  sistema boolean not null default false,  -- true = não pode deletar/renomear
  escola_id uuid references escolas(id) on delete cascade,  -- null = global seed
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2) Catálogo de módulos
create table modulos (
  codigo text primary key,
  grupo text not null,
  nome text not null,
  ordem int not null default 0
);

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

-- 4) FK perfis.perfil → roles.codigo
alter table perfis add constraint perfis_perfil_fk
  foreign key (perfil) references roles(codigo);

-- 5) Seed roles sistema
insert into roles (codigo, nome, sistema) values
  ('admin', 'Administrador', true),
  ('secretaria', 'Secretaria', true),
  ('financeiro', 'Financeiro', true),
  ('professor', 'Professor', true);

-- 6) Seed módulos (25 sub-módulos × 7 grupos)
insert into modulos (codigo, grupo, nome, ordem) values
  -- Pedagógico
  ('avaliacoes', 'pedagogico', 'Avaliações', 1),
  ('frequencias', 'pedagogico', 'Frequências', 2),
  ('disciplinas', 'pedagogico', 'Disciplinas', 3),
  ('mural', 'pedagogico', 'Mural', 4),
  -- Secretaria
  ('alunos', 'secretaria', 'Alunos', 10),
  ('matriculas', 'secretaria', 'Matrículas', 11),
  ('importacoes', 'secretaria', 'Importações', 12),
  ('documentos.templates', 'secretaria', 'Templates Documentos', 13),
  -- Financeiro
  ('financeiro.cobrancas', 'financeiro', 'Cobranças & Pagamentos', 20),
  ('despesas', 'financeiro', 'Despesas', 21),
  ('planos', 'financeiro', 'Planos', 22),
  ('valores-praticados', 'financeiro', 'Valores Praticados', 23),
  ('bolsistas', 'financeiro', 'Bolsistas', 24),
  -- RH
  ('rh.funcionarios', 'rh', 'Funcionários', 30),
  ('rh.empresas', 'rh', 'Empresas', 31),
  ('rh.folha', 'rh', 'Folha de Pagamento', 32),
  ('rh.templates', 'rh', 'Templates RH', 33),
  -- Acadêmico
  ('series', 'academico', 'Séries', 40),
  ('turmas', 'academico', 'Turmas', 41),
  ('professores', 'academico', 'Professores', 42),
  ('organograma', 'academico', 'Organograma', 43),
  -- Operacional
  ('portaria', 'operacional', 'Portaria', 50),
  ('relatorios', 'operacional', 'Relatórios', 51),
  -- Administração
  ('usuarios', 'administracao', 'Usuários', 90),
  ('configuracoes.escola', 'administracao', 'Configurações da Escola', 91),
  ('configuracoes.webhook', 'administracao', 'Webhook', 92),
  ('configuracoes.perfis', 'administracao', 'Perfis e Permissões', 93);

-- 7) Seed role_permissoes (matriz default)

-- admin: tudo true em todos os módulos
insert into role_permissoes (role_codigo, modulo_codigo, pode_ler, pode_criar, pode_editar, pode_deletar)
select 'admin', codigo, true, true, true, true from modulos;

-- secretaria: CRUD em secretaria/academico/operacional; R em pedagogico/financeiro; nada em rh/administracao
insert into role_permissoes (role_codigo, modulo_codigo, pode_ler, pode_criar, pode_editar, pode_deletar)
select 'secretaria', codigo,
  true,
  case when grupo in ('secretaria','academico','operacional') then true else false end,
  case when grupo in ('secretaria','academico','operacional') then true else false end,
  case when grupo in ('secretaria','academico','operacional') then true else false end
from modulos
where grupo in ('secretaria','academico','operacional','pedagogico','financeiro');

-- financeiro: CRUD em financeiro; R em secretaria/academico/rh/operacional(relatorios); nada em pedagogico/administracao
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

-- professor: CRUD em pedagogico; R em secretaria(alunos,matriculas)/academico/relatorios
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

-- 8) RLS
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

-- 9) Helper SQL
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

## Matriz Default (P10)

| Grupo / Módulo | admin | secretaria | financeiro | professor |
|---|---|---|---|---|
| **Pedagógico** | CRUD | R | — | CRUD |
| avaliacoes, frequencias, disciplinas, mural | CRUD | R | — | CRUD |
| **Secretaria** | CRUD | CRUD | R | R |
| alunos, matriculas, importacoes, documentos.templates | CRUD | CRUD | R | R |
| **Financeiro** | CRUD | R | CRUD | — |
| financeiro.cobrancas, despesas, planos, valores-praticados, bolsistas | CRUD | R | CRUD | — |
| **RH** | CRUD | — | R | — |
| rh.funcionarios, rh.empresas, rh.folha, rh.templates | CRUD | — | R | — |
| **Acadêmico** | CRUD | CRUD | R | R |
| series, turmas, professores, organograma | CRUD | CRUD | R | R |
| **Operacional** | CRUD | CRUD | R (relatorios) | R (relatorios) |
| portaria, relatorios | CRUD | CRUD | R relatorios | R relatorios |
| **Administração** | CRUD | — | — | — |
| usuarios, configuracoes.* | CRUD | — | — | — |

## App Layer (TypeScript)

### Novos arquivos

```
src/lib/auth/permissions.ts     — types, catálogo, helpers
src/lib/data/permissoes.ts      — queries (listar roles, get permissões)
src/lib/actions/roles.ts        — CRUD de roles + atualização da matriz
src/components/perfis/permissions-matrix.tsx  — componente UI matriz
src/components/layout/nav-item-gate.tsx       — gate de itens de menu
src/app/(app)/configuracoes/perfis/page.tsx
src/app/(app)/configuracoes/perfis/nova/page.tsx
src/app/(app)/configuracoes/perfis/[codigo]/page.tsx
```

### Arquivos modificados

```
src/lib/auth/session.ts         — estender Session com permissions
src/components/layout/topbar.tsx + dropdowns  — filtrar por permissão
src/app/(app)/page.tsx          — cards declaram requires
src/app/(app)/layout.tsx        — passar permissions adiante
+ todas as pages e server actions (route gate)
```

### `permissions.ts`

```ts
export type Acao = "read" | "create" | "update" | "delete";

export const GRUPOS = [
  "pedagogico", "secretaria", "financeiro",
  "rh", "academico", "operacional", "administracao",
] as const;
export type Grupo = (typeof GRUPOS)[number];

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

export type PermissionMap = Partial<Record<ModuloCodigo, {
  read: boolean; create: boolean; update: boolean; delete: boolean;
}>>;

export function can(perms: PermissionMap, modulo: ModuloCodigo, acao: Acao): boolean {
  return perms[modulo]?.[acao] ?? false;
}
```

### `session.ts` (estendido)

```ts
export type Session = {
  user: { id: string; email: string };
  profile: SessionProfile;
  permissions: PermissionMap;
};

export const getSession = cache(async (): Promise<Session | null> => {
  // ... fetch user + profile como hoje
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
  return { user, profile, permissions };
});

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

`requireAdmin` permanece, usado em meta-gestão (gerenciar roles, webhook).

### Server Actions de Roles

```ts
// src/lib/actions/roles.ts
createRoleAction(formData)               // codigo, nome, descricao (admin-only)
updateRoleAction(formData)               // nome/descricao (codigo imutável)
deleteRoleAction(formData)               // bloqueia se sistema=true ou em uso
updateRolePermissionsAction(formData)    // upsert matriz inteira
```

## UI `/configuracoes/perfis`

### Lista (`page.tsx`)

Tabela: Código | Nome | Tipo (Sistema/Custom) | Usuários | Ações. Botão "Nova role". Linhas sistema não mostram "Excluir".

### Editor (`[codigo]/page.tsx`)

- Header: nome + descrição editáveis (codigo read-only).
- Matriz: 7 grupos como accordion. Cada grupo header tem contadores (`X/Y permissões`) e checkboxes bulk (R/C/U/D do grupo inteiro).
- Cada sub-módulo: nome + 4 checkboxes (R, C, U, D).
- Role `admin`: matriz disabled, todos marcados, mensagem "Admin sempre tem acesso total."
- Form submete via server action `updateRolePermissionsAction` (upsert delete+insert).

### Criar (`nova/page.tsx`)

Form: codigo (regex `^[a-z][a-z0-9_-]*$`, único), nome, descrição. Redireciona para editor após criar.

## Dashboard Derivado

### Mapa card → módulo

```
HeroFinancial           → financeiro.cobrancas
FolhaRatioCard          → rh.folha
TicketCard              → financeiro.cobrancas
BolsistasReceitaCard    → bolsistas
SaldoYTDCard            → financeiro.cobrancas
RealizadoProjetadoCard  → financeiro.cobrancas
AlertList               → (sempre)
RevenueTrendChart       → financeiro.cobrancas
ProximasCobrancasCard   → financeiro.cobrancas
TopCategoriasCard       → despesas
FolhaEmpresas           → rh.folha
MetricRing (Ocupação)   → alunos
FrequenciaCard          → frequencias
StageTable              → matriculas
RankingTurmasCard       → turmas
AniversariantesCard     → alunos
AniversarioMatricula    → alunos
SaudeSistemaCard        → (sempre)
RenovacoesPendentes     → matriculas
TopDevedores            → financeiro.cobrancas
PedagogicoOverview      → avaliacoes
EvasaoCard              → alunos
FrequenciaHeatmap       → frequencias
MediasDisciplinasCard   → avaliacoes
RankingAlunosCard       → avaliacoes
```

### Tabs

- Tab "financeiro": visível se read em qualquer módulo do grupo `financeiro`.
- Tab "alunos": visível se read em `{alunos, matriculas, frequencias}`.
- Tab "pedagogico": visível se read em `{avaliacoes, frequencias}`.
- Zero tabs visíveis: empty state "Sem dashboards configurados".
- Default = primeira tab visível.

### Otimização

`Promise.all` em `page.tsx` rodando todas queries vira lista condicional: cada query gated por `can(perms, modulo, "read")`. Cards ocultos = zero query.

## Topbar / Menus

Topbar e dropdowns recebem `permissions` via props (já vem na session). Filtram itens antes de renderizar.

Mapa rota → módulo exportado de `permissions.ts`:

```
/alunos                    → alunos
/matriculas                → matriculas
/importacoes               → importacoes
/financeiro                → financeiro.cobrancas
/despesas                  → despesas
/planos                    → planos
/valores-praticados        → valores-praticados
/bolsistas                 → bolsistas
/rh/funcionarios           → rh.funcionarios
/rh/empresas               → rh.empresas
/rh/folha                  → rh.folha
/rh/templates              → rh.templates
/avaliacoes                → avaliacoes
/frequencias               → frequencias
/disciplinas               → disciplinas
/mural                     → mural
/series                    → series
/turmas                    → turmas
/professores               → professores
/organograma               → organograma
/portaria                  → portaria
/relatorios                → relatorios
/usuarios                  → usuarios
/configuracoes/escola      → configuracoes.escola
/configuracoes/webhook     → configuracoes.webhook
/configuracoes/perfis      → configuracoes.perfis
/meu-perfil                → (público)
/                          → (dashboard, conteúdo filtrado)
```

Dropdown vazio (sem nenhum item permitido): some inteiro.

## Enforcement

### Pages

```ts
// Antes
const session = await requireSession();
// Depois
const session = await requirePermission("financeiro.cobrancas", "read");
```

Aplicar em todas as pages top-level. Admin bypass automático.

### Server Actions

```ts
// Antes
await requireSession();
// Depois
await requirePermission("alunos", "create");
```

`requireAdmin` permanece para meta-gestão.

### Sem middleware

Checks só em pages. Middleware exigiria session no edge, complica. Custo extra desprezível (permissões pré-carregadas na session via `cache()`).

## Edge Cases

1. **Role deletada com users associados** — `deleteRoleAction` checa count em `perfis` antes; bloqueia se em uso.
2. **Admin remove permissão própria** — bypass hardcoded + matriz admin read-only. Impossível.
3. **Custom role sem nenhuma permissão** — permitido. User vê só `/` (dashboard vazio) e `/meu-perfil`.
4. **Sub-módulo sem mapeamento direto de rota** — `financeiro.cobrancas` cobre `/financeiro`. Documentado em `ROTA_PARA_MODULO`.
5. **Múltiplos módulos por página** — page declara módulo principal; cards internos podem fazer check adicional via `can(...)`.
6. **Server actions cross-módulo** — checar permissão do escopo principal; documentar em comment.
7. **Backfill** — seed cobre 4 roles existentes. Users com `perfis.perfil` mantêm. Zero impacto.

## Out of Scope

- Audit log de mudanças de permissão.
- Override de permissão por usuário individual.
- Role temporária com expiração.
- RLS por permissão (defesa adicional Postgres-level).
- Permissões multi-tenant cross-escola.

## Arquivos Afetados (Sumário)

**Novos:**
- `supabase/migrations/202605300001_rbac_permissoes.sql`
- `src/lib/auth/permissions.ts`
- `src/lib/data/permissoes.ts`
- `src/lib/actions/roles.ts`
- `src/components/perfis/permissions-matrix.tsx`
- `src/components/layout/nav-item-gate.tsx`
- `src/app/(app)/configuracoes/perfis/page.tsx`
- `src/app/(app)/configuracoes/perfis/nova/page.tsx`
- `src/app/(app)/configuracoes/perfis/[codigo]/page.tsx`

**Modificados:**
- `src/lib/auth/session.ts` (estender Session, adicionar requirePermission)
- `src/components/layout/topbar.tsx` (+ dropdowns: secretaria, rh, financeiro, configuracoes)
- `src/app/(app)/page.tsx` (cards condicionais + queries condicionais)
- `src/app/(app)/layout.tsx` (passar permissions)
- Todas as pages top-level (route gate via `requirePermission`)
- Todas as server actions (gate via `requirePermission`)
