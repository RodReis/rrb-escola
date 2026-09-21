# Cards de Pipeline no dashboard pedagógico

**Data:** 2026-06-23
**Status:** Aprovado (design), aguardando revisão do spec
**Módulo afetado:** Dashboard (aba Pedagógico) · Pipeline

## Problema

O dashboard não tem visão do pipeline de captação (leads/reservas/entrevistas). Quem
acompanha o funil precisa abrir `/pipeline` ou `/pipeline/indicadores`. Falta um resumo
no próprio dashboard mostrando status dos leads, conversão, entrevistas e atividade recente.

## Objetivo

Dois cards na aba **Pedagógico** do dashboard:
1. **Pipeline — Status & Conversão**: funil por status, taxa de conversão, cards parados.
2. **Pipeline — Entrevistas & Atividade**: anamneses por status (sensível) + mini-timeline
   das últimas atividades.

## O que já existe (reusar)

| Item | Local |
|---|---|
| Dashboard com sistema de abas (financeiro/comercial/secretaria/pedagogico) | `src/app/(app)/page.tsx` |
| Padrão de card (`<article rounded-panel bg-surface p-6 shadow-soft>`) | `src/components/dashboard/frequencia-card.tsx` |
| Agregador de métricas do pipeline `getIndicadoresPipeline(periodo)` | `src/lib/actions/pipeline-indicadores.ts` |
| Tipo `IndicadoresPipeline` (captacao, conversao, parados, anamneses…) | mesma action |
| RBAC `has(modulo)` = `isAdmin || can(perms, modulo, "read")` | `src/app/(app)/page.tsx` |
| Enums `STATUS_LEAD`, `TIPOS_ATIVIDADE`, `StatusAnamnese` | `src/lib/validation/pipeline.ts` |

## Decisões de design (aprovadas)

- **Aba:** Pedagógico (não secretaria).
- **Formato:** 2 cards no grid `sm:grid-cols-2`.
- **Atividade:** mini-timeline real das últimas 5 atividades (query nova).
- **Funil por status:** adicionar `por_status` ao `getIndicadoresPipeline` (1 query a mais,
  agrupada em JS — padrão do projeto).
- **Período:** fixo 30 dias no card; seleção de período fica em `/pipeline/indicadores`.

## Cards

### Card A — Pipeline — Status & Conversão
Fonte: `getIndicadoresPipeline(30)`. Gate: `has("pipeline")`.
- Funil por `status_lead`: novo, em_analise, reserva, convertido, perdido (campo novo `por_status`).
- Conversão: taxa % + matrículas + reservas (`conversao`).
- Cards parados: `parados.total` como alerta sutil.
- Rodapé: link `ver mais → /pipeline/indicadores`.
- Empty state quando total = 0 (padrão `rounded-ui bg-muted/40 py-10`).

### Card B — Pipeline — Entrevistas & Atividade
Gate do card: `has("pipeline")`.
- **Entrevistas/anamnese**: contagem por status (`anamneses`). Renderiza só se
  `has("pipeline_sensivel")` (`showAnamnese`). Secretaria não vê (RLS já zera; escondemos
  a seção explicitamente para não exibir vazio enganoso).
- **Atividade recente**: últimas 5 de `pipeline_card_atividade` (query nova). Ícone por tipo,
  descrição curta, "há X tempo", autor. Gate só `pipeline` (não é dado sensível).
- Se sem `pipeline_sensivel` e sem atividade → empty state.

## Dados / queries

- **`getIndicadoresPipeline`** ganha campo `por_status: { status: StatusLead; total: number }[]`
  (1 query nova internamente, agrupada em JS). Sem migration.
- **Nova** `getAtividadeRecentePipeline(escolaId, limit = 5)` em `src/lib/data/pipeline-atividade.ts`:
  ```
  select tipo, descricao, created_at, usuario_id, card_id
  from pipeline_card_atividade
  where escola_id = :escolaId
  order by created_at desc
  limit :limit
  ```
  + join leve para `perfis.nome` (autor) e título do card. Retorna `AtividadeRecente[]`.
  **Não** usa filtro `deletado_em` (coluna inexistente — ver nota técnica).
- Sem migration. Apenas leitura.

## Arquivos

**Criar:**
- `src/components/dashboard/pipeline-status-card.tsx` — Card A (presentacional puro).
- `src/components/dashboard/pipeline-atividade-card.tsx` — Card B (presentacional puro).
- `src/lib/data/pipeline-atividade.ts` — `getAtividadeRecentePipeline` + tipo `AtividadeRecente`.

**Editar:**
- `src/lib/actions/pipeline-indicadores.ts` — campo `por_status` no tipo + query agrupada.
- `src/app/(app)/page.tsx` — 2 slots no `Promise.all` (gated por `showPipeline`), computar
  `showAnamnese = has("pipeline_sensivel")`, renderizar os 2 cards na aba pedagógico.

## Visual

- Wrapper `<article className="rounded-panel bg-surface p-6 shadow-soft">`.
- Header: chip ícone `h-9 w-9 rounded-ui` + `<h3>` + subtítulo `text-[0.66rem] text-ink/55`
  ("últimos 30 dias").
- Card A: barras de status + bloco conversão (`text-4xl` na taxa %) + nota de parados.
- Card B: seção anamnese (dl grid) condicional + timeline (lista com ícone por tipo).
- Ícones de atividade (lucide): nota=StickyNote, ligacao=Phone, email=Mail,
  whatsapp=MessageCircle, sistema=Settings.
- "há X tempo": reusar util de data relativa se existir; senão helper simples.
- Empty states no padrão do print de "Frequência detalhada".

## Permissões

- Os 2 cards: `has("pipeline")` (admin/secretaria/coordenação).
- Seção entrevista no Card B: `has("pipeline_sensivel")` (admin/coordenação; secretaria não).

## Testes (Vitest)

- Unit `getAtividadeRecentePipeline`: monta lista, limita a 5, ordena desc (mock supabase no
  padrão de `src/lib/data/*.test.ts`).
- Unit do agrupamento `por_status`: conta por status, zera ausentes.
- Sem teste de componente (presentacional; visual não testado por markup — regra do projeto).

## Trava de qualidade

`typecheck` + `build` verde; `test` antes do PR. Branch `feat/dashboard-pipeline-card`.

## Fora de escopo (YAGNI)

- Filtro de período no card.
- Realtime / atualização ao vivo.
- Drill-down por clique no card.
- Corrigir o bug latente do `deletado_em` em `pipeline-indicadores.ts` (registrado abaixo,
  mas não faz parte deste trabalho).

## Nota técnica

`pipeline-indicadores.ts` tem filtros `is("deletado_em", null)` sobre uma coluna que não
existe nas migrations — no-op latente. A nova função de atividade não replica esse filtro.
