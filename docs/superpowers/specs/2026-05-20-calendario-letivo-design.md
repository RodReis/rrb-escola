# Calendário Letivo — Design

**Data:** 2026-05-20
**Frente:** MVP2 — Frente 1 (ver `2026-05-20-mvp2-roadmap.md`)
**Branch:** `feature/calendario-letivo`

## Objetivo

Permitir que a escola defina o calendário letivo de cada ano (período, dias da semana
letivos, feriados e recessos). A chamada de frequência passa a validar contra os dias
letivos reais, bloqueando lançamento em datas não-letivas.

## Contexto

- `turmas.ano_letivo` é um `integer` — não existe entidade "ano letivo" própria.
- A chamada de frequência (`/frequencias/chamada`) já é funcional, usa `data_aula`
  livre, sem validação de calendário.
- Padrão BR exige mínimo de 200 dias letivos/ano.

## Decisões de escopo

- **Granularidade:** um calendário único por ano letivo (escola toda). Sem variação por
  segmento, turno ou turma.
- **Definição de dias letivos:** regra (dias da semana + período início/fim) + exceções
  cadastradas. Sistema calcula os dias letivos automaticamente.
- **Tipos de exceção:** apenas `feriado` e `recesso`. (`letivo_extra` foi descartado
  como over-engineering.)
- **Integração com a chamada:** bloquear data não-letiva — seletor de data e server
  action rejeitam datas fora dos dias letivos.

## Modelo de dados

### Tabela `calendario_letivo`

Um registro por ano letivo, por escola.

| Coluna | Tipo | Notas |
|--------|------|-------|
| `id` | uuid PK | |
| `escola_id` | uuid FK → escolas | |
| `ano_letivo` | integer | único por `(escola_id, ano_letivo)` |
| `data_inicio` | date | início do ano letivo |
| `data_fim` | date | fim do ano letivo; `> data_inicio` |
| `dias_semana_letivos` | integer[] | ex: `{1,2,3,4,5}` (0=dom … 6=sáb); não vazio |
| `created_at` | timestamptz | default now() |
| `updated_at` | timestamptz | default now() |

Constraint: `UNIQUE (escola_id, ano_letivo)`.

### Tabela `calendario_excecoes`

Feriados e recessos — exceções à regra.

| Coluna | Tipo | Notas |
|--------|------|-------|
| `id` | uuid PK | |
| `calendario_id` | uuid FK → calendario_letivo (ON DELETE CASCADE) | |
| `escola_id` | uuid FK → escolas | |
| `data_inicio` | date | início da exceção |
| `data_fim` | date | fim da exceção; 1 dia = `data_inicio = data_fim` |
| `tipo` | enum `tipo_excecao_calendario` | `feriado` \| `recesso` |
| `descricao` | text | ex: "Carnaval", "Recesso de julho" |
| `created_at` | timestamptz | default now() |

Novo enum: `tipo_excecao_calendario` = `('feriado', 'recesso')`.

### Regra de dia letivo

Uma data é **letiva** quando:
1. está dentro de `[data_inicio, data_fim]` do calendário, **E**
2. seu dia-da-semana ∈ `dias_semana_letivos`, **E**
3. não cai dentro de nenhuma exceção (`feriado` ou `recesso`).

## Arquitetura

### Lógica pura — `src/lib/calendario/dias-letivos.ts`

Funções puras, sem I/O, totalmente testáveis:

- `isDiaLetivo(date, calendario, excecoes): boolean`
- `contarDiasLetivos(calendario, excecoes): number` — itera o período e conta
- `listarDiasLetivos(calendario, excecoes): Date[]` — usado pela grade visual

### Data layer — `src/lib/data/calendario.ts`

- `getCalendario(escolaId, anoLetivo)` — retorna o calendário + suas exceções (ou null).
- Segue o padrão dos demais `src/lib/data/*`.

### Server actions — `src/lib/actions/calendario.ts`

- `salvarCalendarioAction` — upsert da config (`calendario_letivo`).
- `salvarExcecaoAction` — cria/edita exceção.
- `excluirExcecaoAction` — remove exceção.
- Cada action: `requirePermission("calendario", <ação>)` no início, `revalidatePath`
  ao final.

### Validações

- `data_fim > data_inicio` (calendário e exceção).
- exceção contida no período do calendário.
- `dias_semana_letivos` não vazio.
- na chamada: data não-letiva rejeitada no server action `saveClassAttendanceAction`
  (defesa em profundidade — front também bloqueia).

## UI

### Rota `/calendario` (módulo novo)

**Página principal:**
- Seletor de ano letivo no topo.
- Card resumo: período, dias-da-semana letivos, **total de dias letivos calculado** vs
  mínimo 200 — badge verde (≥200) / vermelho (<200).
- **Grade visual de 12 meses** do ano: cada dia colorido por estado —
  letivo (neutro), feriado (vermelho), recesso (amarelo), não-letivo/fim de semana (cinza).
- Lista de exceções cadastradas, com ações editar / excluir.

**Form de configuração:** define/edita `calendario_letivo` — data início, data fim,
checkboxes para dias da semana.

**Form de exceção:** modal — tipo (`feriado`/`recesso`), data início, data fim, descrição.

### Integração na chamada — `/frequencias/chamada`

- O `<input type="date">` valida contra os dias letivos do ano selecionado.
- Data não-letiva → botão "Carregar" bloqueado + mensagem explicativa.
- `saveClassAttendanceAction` revalida no servidor antes de gravar `frequencias`.

## RBAC

Módulo novo `calendario`, grupo `academico`. Exige (conforme comentário em
`src/lib/auth/permissions.ts` linha ~65):

1. Entrada em `MODULOS` (`src/lib/auth/permissions.ts`).
2. Entrada em `ROTA_PARA_MODULO` (`"/calendario": "calendario"`).
3. Seed no DB — tabelas `modulos` + `role_permissoes`.

## Migração

Nova migração em `supabase/migrations/`:
- enum `tipo_excecao_calendario`
- tabela `calendario_letivo`
- tabela `calendario_excecoes`
- RLS nas duas tabelas (seguir padrão das tabelas existentes)
- seed RBAC do módulo `calendario`

## Testes

Unit nas funções puras de `dias-letivos.ts`:
- dia comum letivo
- fim de semana → não letivo
- feriado de 1 dia → não letivo
- recesso de vários dias → todos não letivos
- data antes de `data_inicio` / depois de `data_fim` → não letivo
- `contarDiasLetivos` num ano com feriados conhecidos → número esperado

## Fora de escopo

- Calendário por segmento / turno / turma.
- Reposição de aula em dia não-letivo (`letivo_extra`).
- Importação de calendário por arquivo.
- Eventos não-letivos (reunião de pais, festa) — calendário só trata letivo/não-letivo.
