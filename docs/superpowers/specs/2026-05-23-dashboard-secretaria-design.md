# Dashboard Secretaria — Design

**Data:** 2026-05-23
**Status:** aprovado para implementação

## Objetivo

Renomear aba "Alunos" → "Secretaria" no dashboard principal. Adicionar widgets focados no dia-a-dia da secretaria: **Próximos Feriados** + **Próximos Eventos**. Manter todos os widgets atuais da aba.

Criar entidade `eventos_escola` independente do calendário letivo, com CRUD em página dedicada `/eventos`. Integração com calendário letivo fica para próxima sprint.

## Motivação

Aba "Alunos" do dashboard já cobre 80% do que a secretaria precisa diariamente (aniversariantes, ocupação, frequência, etapas). Renomeação reflete o uso real. Adição de feriados e eventos centraliza a agenda da escola — secretaria não precisa abrir o calendário separado para conferir o que vem na semana.

## Schema

### Tabela `eventos_escola`

```sql
create table eventos_escola (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references escolas(id) on delete cascade,
  titulo text not null,
  data_inicio date not null,
  data_fim date not null,
  descricao text,
  local text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (data_fim >= data_inicio)
);

create index idx_eventos_escola_data on eventos_escola (escola_id, data_inicio);

alter table eventos_escola enable row level security;
-- RLS padrão: admin full, demais via requirePermission no server action.
```

Trigger `updated_at` no padrão das outras tabelas.

### RBAC

- Novo módulo `eventos`, grupo `secretaria`.
- Seed em `modulos` + `role_permissoes` (read/create/update/delete).
- `MODULOS` em `src/lib/auth/permissions.ts` recebe `eventos`.
- `ROTA_PARA_MODULO` recebe `"/eventos": "eventos"`.

## Arquitetura

### Data layer — `src/lib/data/eventos.ts`

- `getEventos(escolaId)` — lista todos, ordenado por `data_inicio` desc.
- `getEventosProximos(escolaId, limit = 5)` — eventos com `data_fim >= today`, ordenado por `data_inicio` asc, limite configurável.

### Server actions — `src/lib/actions/eventos.ts`

- `salvarEventoAction(formData)` — upsert. Valida `data_fim >= data_inicio`. `requirePermission("eventos", id ? "update" : "create")`.
- `excluirEventoAction(formData)` — delete. `requirePermission("eventos", "delete")`.
- `revalidatePath` em `/eventos` e `/` (dashboard).

### UI

**Rota `/eventos`** (`src/app/(app)/eventos/page.tsx`):
- Lista de eventos com ações editar/excluir.
- Botão "Novo evento" abre modal.
- Header padrão `PageHeader`.

**Componentes:**
- `src/components/eventos/eventos-list.tsx` — tabela/grid de eventos.
- `src/components/eventos/evento-form.tsx` — modal com `titulo`, `data_inicio`, `data_fim`, `descricao`, `local`.

**Widget dashboard** (`src/components/dashboard/eventos-card.tsx`):
- Lista 5 próximos eventos.
- Cada item: data formatada, título, local (se houver).
- Mesma estética do `FeriadosCard` (ver para referência).

## Mudanças no Dashboard

Arquivo: `src/app/(app)/page.tsx`

1. `DashTab = "financeiro" | "secretaria" | "pedagogico"` — renomear `alunos` → `secretaria`.
2. `tabSecretariaVisible` (renome de `tabAlunosVisible`).
3. `parseTab` em `dashboard-tabs.tsx` — aceitar `secretaria`. Legado: `?aba=alunos` redireciona para `?aba=secretaria` (1 linha defensiva).
4. Label do tab: "Alunos" → "Secretaria".
5. Bloco `tabEfetiva === "alunos"` → `tabEfetiva === "secretaria"`.
6. No fim do bloco "secretaria", adicionar nova seção:

```tsx
{((showFrequencias && feriadosProximos) || (showEventos && eventosProximos)) && (
  <>
    <SectionHeader title="Agenda" subtitle="Próximos feriados e eventos" />
    <section className="grid gap-6 lg:grid-cols-2">
      {showFrequencias && feriadosProximos && <FeriadosCard items={feriadosProximos} />}
      {showEventos && eventosProximos && <EventosCard items={eventosProximos} />}
    </section>
  </>
)}
```

7. Adicionar `getEventosProximos` no `Promise.all` (gated por `showEventos = has("eventos")`).
8. Remover `FeriadosCard` da aba "pedagogico" (move exclusivamente para secretaria).

## Menu

`src/components/layout/sidebar.tsx` + `src/components/layout/topbar.tsx`:
- Verificar se existe grupo "Secretaria". Se "Alunos" é label de grupo, renomear.
- Adicionar link `/eventos` (label "Eventos", icon `CalendarHeart` ou similar do lucide).
- Posicionar próximo a `/alunos`, `/matriculas`, `/calendario`.

## Validações

- `data_fim >= data_inicio` no check do DB + no action (defesa em profundidade).
- `titulo` não vazio (NOT NULL no DB).
- Aceitar eventos passados (histórico). Widget só mostra futuros.

## Testes

- **Unit (`getEventosProximos`):** filtra `data_fim >= today`; ordena `data_inicio` asc; respeita limite; retorna [] quando sem eventos.
- **Unit (`salvarEventoAction`):** rejeita `data_fim < data_inicio`; aceita 1 dia (`data_fim = data_inicio`); upsert correto.
- **Manual smoke:** criar evento via `/eventos`, validar no dashboard Secretaria.

## Fora de escopo (YAGNI)

- Categoria do evento (pedagogico/administrativo/etc).
- Notificação automática (email/whatsapp) ao criar evento.
- Recorrência (eventos semanais/mensais).
- Integração com `calendario_excecoes` — sprint futura.
- Convites/participantes.
- Anexos (PDF, imagem).

## Arquivos

**Criar:**
- `supabase/migrations/2026MMDD_eventos_escola.sql`
- `src/lib/data/eventos.ts`
- `src/lib/data/eventos.test.ts`
- `src/lib/actions/eventos.ts`
- `src/lib/actions/eventos.test.ts`
- `src/app/(app)/eventos/page.tsx`
- `src/components/eventos/eventos-list.tsx`
- `src/components/eventos/evento-form.tsx`
- `src/components/dashboard/eventos-card.tsx`

**Modificar:**
- `src/lib/auth/permissions.ts` — módulo `eventos`
- `src/components/dashboard/dashboard-tabs.tsx` — label + parseTab
- `src/app/(app)/page.tsx` — rename tab + widget Agenda
- `src/components/layout/sidebar.tsx`
- `src/components/layout/topbar.tsx`

## Risco

- Baixo. Schema novo isolado. Renomeação tab tem fallback de legado. Dashboard widget é puro server component.
