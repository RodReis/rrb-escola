# Comunicados por Turma/Série — Design

**Data:** 2026-05-21
**Contexto:** Sub-projeto C da expansão do WhatsApp (ver `2026-05-21-migracao-meta-cloud-api-design.md`).

## Objetivo

Permitir que um comunicado seja direcionado a turmas e/ou séries específicas, além dos
alcances `geral` e `individual` já existentes. O admin escolhe um conjunto de turmas e/ou
séries; só os responsáveis financeiros dos alunos dessas turmas recebem.

## Contexto

- A feature de Comunicados (Frente 4a) já existe: tabela `comunicados`, alcance
  `geral`/`individual`, envio via Meta, processamento por cron, log em
  `mensagens_whatsapp`.
- `resolverDestinatarios` (`src/lib/comunicados/destinatarios.ts`) resolve os alunos →
  responsável financeiro. Hoje trata `geral` e `individual`.
- `matriculas` tem `turma_id`; `turmas` tem `serie_id`. `getAcademicData` em
  `lookups.ts` já lista séries e turmas (mas é pesada — traz planos e alunos também).

## Decisões de escopo

- **Níveis:** turma e série. Uma série expande para todas as suas turmas.
- **Múltiplos alvos:** um comunicado pode mirar várias turmas e/ou séries de uma vez.
- **Mistura permitida:** turmas e séries podem coexistir no mesmo comunicado.
- **Novo alcance:** `segmentado` — um valor único de `alcance_comunicado` que cobre
  turma+série. Os alvos concretos ficam numa coluna jsonb.
- **`alvos` é registro do critério:** o destinatário real (aluno → responsável) é
  resolvido na criação e vira linhas em `mensagens_whatsapp`. `alvos` serve para a tela
  exibir o critério e para auditoria.

## Modelo de dados

### Extensão de `comunicados`

| Coluna | Tipo | Notas |
|--------|------|-------|
| `alvos` | jsonb not null default `'[]'` | lista de `{ tipo: "turma" \| "serie", id: uuid }` |

O enum `alcance_comunicado` ganha o valor `segmentado` (hoje: `geral`, `individual`).
Valores finais: `geral`, `individual`, `segmentado`.

`alvos` fica vazio (`[]`) para `geral` e `individual`. `aluno_id` continua só para
`individual`.

Migração:
- `ALTER TYPE alcance_comunicado ADD VALUE IF NOT EXISTS 'segmentado';`
- `ALTER TABLE comunicados ADD COLUMN IF NOT EXISTS alvos jsonb NOT NULL DEFAULT '[]'::jsonb;`

## Arquitetura

### Tipo compartilhado

```
Alvo = { tipo: "turma" | "serie"; id: string }
```

### Resolução de destinatários — `src/lib/comunicados/destinatarios.ts`

`resolverDestinatarios` ganha o caso `segmentado`. Assinatura passa a aceitar os `alvos`:

```
resolverDestinatarios(supabase, alcance, alunoId, alvos, escolaId?)
```

Fluxo para `alcance === "segmentado"`:
1. Separar os `alvos` por tipo: ids de turmas diretas, ids de séries.
2. Para as séries, consultar `turmas` (`serie_id IN [...]`, `escola_id`) → ids de turmas.
3. Unir turmas diretas + turmas das séries → conjunto único de `turma_id`.
4. Consultar `alunos` com `matriculas` (status `ativa`, `turma_id IN [conjunto]`) +
   `responsaveis_aluno`.
5. Aplicar `filtrarDestinatarios` (já existe — responsável financeiro com celular).

Função pura testável:
- `coletarTurmaIds(alvos, turmasPorSerie): string[]` — recebe os alvos e um mapa
  `serieId → turmaId[]`, retorna o conjunto único de ids de turma (turmas diretas +
  turmas expandidas das séries, deduplicado).

Guard: `segmentado` com `alvos` vazio → retorna `[]` (não vira envio geral).

### Data layer — `src/lib/data/comunicados.ts`

- `getComunicado` passa a retornar `alvos` (no tipo `ComunicadoRow`).
- Nova função leve `listTurmasESeries(escolaId)` — retorna `{ turmas: {id, nome, anoLetivo, serieNome}[], series: {id, nome}[] }`. Dedicada ao form de comunicado (mais enxuta que `getAcademicData`).

### Server action — `src/lib/actions/comunicados.ts`

`criarComunicadoAction`:
- `alcance` aceita `segmentado`.
- Lê os `alvos` do formulário (campo hidden com JSON, ou checkboxes — ver UI).
- Valida: cada item tem `tipo` ∈ {`turma`,`serie`} e `id` não-vazio; lista não-vazia
  quando `alcance = segmentado`.
- Grava `alvos` na coluna jsonb.
- Chama `resolverDestinatarios` passando os `alvos`.

### UI

**`src/components/comunicados/novo-comunicado-form.tsx`** (client component):
- O radio de alcance ganha a opção `segmentado` ("Turmas e séries").
- Com `segmentado` selecionado, exibe dois grupos de seleção: **Turmas** e **Séries** —
  o admin marca quantos quiser de cada (checkboxes). O estado dos alvos marcados é
  mantido no client; submetido como um campo hidden `alvos` com JSON.

**`src/app/(app)/comunicados/novo/page.tsx`** (server component):
- Carrega `listTurmasESeries` e passa turmas + séries ao form.

**Tela de lista / detalhe** (`/comunicados`, `/comunicados/[id]`):
- O alcance `segmentado` é exibido com um resumo: "Segmentado · N turma(s), M série(s)".
- A página de detalhe lista os nomes das turmas/séries alvo.

## RBAC

Sem mudança — a feature reusa o módulo `comunicados` já existente.

## Banco de dados

Migração: novo valor de enum `segmentado` + coluna `comunicados.alvos`. Sem tabela nova,
sem bucket novo.

## Testes

Unit (Vitest):
- `coletarTurmaIds` — só turmas diretas; série expande para suas turmas; mistura de
  turmas e séries; dedup (turma que aparece direta e via série); alvos vazios → `[]`.

`resolverDestinatarios` (I/O) e a UI são validados manualmente.

## Fora de escopo

- Filtro por outros critérios (turno, segmento, faixa etária).
- Edição dos alvos de um comunicado já criado.
- Pré-visualização da contagem de destinatários antes de enviar.
