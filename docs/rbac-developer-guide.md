# RBAC Developer Guide

Sistema de permissões: `roles` × `modulos` × `role_permissoes` (R/C/U/D).

## REGRA OBRIGATÓRIA para novas funcionalidades

Toda funcionalidade nova **DEVE**:

1. **Declarar sub-módulo em dois lugares:**
   - `src/lib/auth/permissions.ts` no objeto `MODULOS` (catálogo TS).
   - Nova migration inserindo em `modulos` (catálogo SQL).

2. **Definir permissões default para as 4 roles seed na migration:**
   - Insert em `role_permissoes` para `admin` (full), `secretaria`, `financeiro`, `professor`.
   - Decisão explícita por role.

3. **Gate em page server-side:**
   ```ts
   const session = await requirePermission("seu.modulo", "read");
   ```

4. **Gate em server actions:**
   ```ts
   await requirePermission("seu.modulo", "create" | "update" | "delete");
   ```

5. **Mapear rota em `ROTA_PARA_MODULO`** (`src/lib/auth/permissions.ts`).

6. **Adicionar ao menu/topbar** com permissão correta. Filtro automático se `ROTA_PARA_MODULO` mapeado.

7. **Cards de dashboard** (se aplicável): declarar gate condicional `can(perms, 'modulo', 'read')`.

### Checklist para PR

- [ ] Sub-módulo adicionado em `MODULOS` (TS) **e** em `modulos` (SQL).
- [ ] Defaults atribuídos para `admin`, `secretaria`, `financeiro`, `professor` em `role_permissoes` migration.
- [ ] Page protegida com `requirePermission`.
- [ ] Server actions protegidas.
- [ ] Item de menu condicional via `ROTA_PARA_MODULO`.
- [ ] (Se aplicável) Cards de dashboard com gate.

## Como criar uma role custom

UI: `/configuracoes/perfis` → "Nova role". Após criar, abrir editor da matriz e marcar permissões.

## Como adicionar um novo sub-módulo

### 1. Migration

```sql
insert into modulos (codigo, grupo, nome, ordem)
values ('meu.modulo', 'secretaria', 'Meu Módulo', 14);

-- Adicionar permissão default em cada role seed
insert into role_permissoes (role_codigo, modulo_codigo, pode_ler, pode_criar, pode_editar, pode_deletar)
values
  ('admin', 'meu.modulo', true, true, true, true),
  ('secretaria', 'meu.modulo', true, true, true, false),
  ('financeiro', 'meu.modulo', true, false, false, false),
  ('professor', 'meu.modulo', false, false, false, false);
```

### 2. `src/lib/auth/permissions.ts`

```ts
export const MODULOS = {
  // ...
  "meu.modulo": { grupo: "secretaria", nome: "Meu Módulo" },
} as const satisfies Record<string, { grupo: Grupo; nome: string }>;
```

### 3. `ROTA_PARA_MODULO`

```ts
export const ROTA_PARA_MODULO: Record<string, ModuloCodigo> = {
  // ...
  "/meu-modulo": "meu.modulo",
};
```

### 4. Page

```ts
// src/app/(app)/meu-modulo/page.tsx
import { requirePermission } from "@/lib/auth/session";

export default async function Page() {
  const session = await requirePermission("meu.modulo", "read");
  // ...
}
```

### 5. Server actions

```ts
"use server";
import { requirePermission } from "@/lib/auth/session";

export async function createMeuModuloAction(formData: FormData) {
  await requirePermission("meu.modulo", "create");
  // ...
}
```

### 6. Topbar item

Editar `src/components/layout/topbar.tsx`, adicionar item na lista mestra apropriada (`SECRETARIA_ITEMS`, `RH_ITEMS`, etc.). Filtro automático via `filterByPermissions`.

## Admin bypass

`requirePermission` retorna imediatamente quando `perfil === "admin"` sem checar matriz. Matriz da role admin existe (todos true) só para UI consistente. Admin é always-allow no código.

## Tabela de módulos atual

| Grupo | Módulos |
|---|---|
| Pedagógico | avaliacoes, frequencias, disciplinas, mural |
| Secretaria | alunos, matriculas, importacoes, documentos.templates |
| Financeiro | financeiro.cobrancas, despesas, planos, valores-praticados, bolsistas |
| RH | rh.funcionarios, rh.empresas, rh.folha, rh.templates |
| Acadêmico | series, turmas, professores, organograma |
| Operacional | portaria, relatorios |
| Administração | usuarios, configuracoes.escola, configuracoes.webhook, configuracoes.perfis |

## Onde tudo vive

- Catálogo TS: `src/lib/auth/permissions.ts`
- Session + helpers: `src/lib/auth/session.ts` (`requirePermission`, `requireSession`, `requireAdmin`, `requirePerfil`)
- Data queries: `src/lib/data/permissoes.ts`
- Server actions de roles: `src/lib/actions/roles.ts`
- UI matriz: `src/components/perfis/permissions-matrix.tsx`
- Pages de configuração: `src/app/(app)/configuracoes/perfis/{page,nova/page,[codigo]/page}.tsx`
- Migration: `supabase/migrations/202605300001_rbac_permissoes.sql`
- Spec: `docs/superpowers/specs/2026-05-19-rbac-permissoes-dashboards-design.md`
- Plan: `docs/superpowers/plans/2026-05-19-rbac-permissoes-dashboards.md`
