# Plano de Implementação — Pipeline MVP3

Spec: `docs/superpowers/specs/2026-06-21-pipeline-mvp3-design.md`
Data: 2026-06-21

## Ordem de execução

As fases devem ser executadas em sequência. Dentro de cada fase, os passos são ordenados por dependência.

---

## Fase 1 — Migration e schema

**Arquivo:** `supabase/migrations/202606210003_pipeline_mvp3.sql`

Passos:
1. Criar tabela `pipeline_template_whatsapp` com RLS dupla (read = `pipeline:read`, write = `pipeline_admin:read`)
2. Criar tabela `pipeline_tarefa` com RLS (`pipeline:read`), índices `(card_id, status)`, `(escola_id, assigned_to, status)`, `(escola_id, due_at) where status='aberta'`
3. `grant select, insert, update, delete on pipeline_template_whatsapp, pipeline_tarefa to authenticated`

Critério: `supabase db push` sem erro; tabelas visíveis no dashboard.

---

## Fase 2 — Validação (Zod schemas)

**Arquivo:** `src/lib/validation/pipeline.ts`

Passos:
1. Adicionar `FONTES_WPP` as const array com as 6 fontes
2. Adicionar `templateWppSchema` (nome_template, descricao, variaveis_count, variaveis_fontes, ativo)
3. Adicionar `tarefaSchema` (titulo, descricao?, due_at?, assigned_to?)
4. Exportar tipos `TemplateWppInput`, `TarefaInput`

---

## Fase 3 — Server Actions

**Arquivo:** `src/lib/actions/pipeline.ts`

Passos em ordem:

### 3a. Templates WhatsApp (CRUD admin)
- `getTemplatesWhatsapp()` — select ativos por escola
- `criarTemplateAction(input)` — requer `getAdminCtx()`
- `editarTemplateAction(id, input)` — requer `getAdminCtx()`
- `arquivarTemplateAction(id)` — set `ativo=false`, requer `getAdminCtx()`

### 3b. Envio WhatsApp
- `enviarWhatsappCardAction(card_id, template_id, variaveis_override)`:
  1. `getPipelineCtx()` com `pipeline:create`
  2. Fetch paralelo: template + card + lead + responsável + escola
  3. Resolver variáveis por fonte (função pura `resolverVariavel(fonte, ctx)`)
  4. Validar telefone via `normalizarTelefone`
  5. Chamar `enviarWhatsApp(...)` com `referenciaTipo='pipeline_card'`
  6. Insert `pipeline_card_atividade` tipo `whatsapp`
  7. Update `pipeline_card.ultimo_contato_at = now()`
  8. `revalidatePath('/pipeline')`

### 3c. Tarefas
- `getTarefasCard(card_id)` — select ordenado por `due_at asc nulls last`, status `aberta` primeiro
- `criarTarefaAction(card_id, input)`:
  1. Insert `pipeline_tarefa`
  2. Se `assigned_to`: insert `notificacoes` tipo `pipeline_tarefa_atribuida`
- `concluirTarefaAction(tarefa_id)` — update `status='concluida'`, `completed_at=now()`
- `cancelarTarefaAction(tarefa_id)` — update `status='cancelada'`

### 3d. Notificações vencidas sob demanda
- `checkTarefasVencidasAction()`:
  1. Select tarefas `status='aberta'` AND `due_at < now()` AND `assigned_to = usuario_atual`
  2. Para cada: verificar se já existe `notificacoes` não lida `tipo='pipeline_tarefa_vencida'` com `href` contendo `card_id`
  3. Insert se não existe

### 3e. Indicador "sem resposta" em `getCardsQuadro`
- Adicionar join com `pipeline_coluna.prazo_max_dias` no select existente
- Campo computado `sem_resposta` (boolean)
- Parâmetro opcional `semResposta?: boolean` no filtro

---

## Fase 4 — UI: CardModal

### 4a. `WhatsappSection` (`src/components/pipeline/whatsapp-section.tsx`)
- Select de templates (chama `getTemplatesWhatsapp`)
- Ao selecionar: renderiza `variaveis_count` inputs com valores pré-preenchidos e editáveis
- Botão "Enviar WhatsApp" chama `enviarWhatsappCardAction`
- Histórico: filtra `atividades` com `tipo='whatsapp'` passadas pelo CardModal

### 4b. `TarefasSection` (`src/components/pipeline/tarefas-section.tsx`)
- Lista tarefas abertas (badge VENCIDA se `due_at < now()`) e concluídas
- Formulário inline "+ Nova tarefa"
- Botões concluir/cancelar por tarefa
- Recebe `perfis` da escola para o select de responsável (passar via CardModal)

### 4c. Integrar no `card-modal.tsx`
- Adicionar `getTemplatesWhatsapp` e `getTarefasCard` no fetch do `getCardDetalhe` ou em fetches paralelos no modal
- Buscar perfis da escola para o select de assigned_to (novo fetch ou reutilizar existente)
- Montar `WhatsappSection` após `ReservaSection`
- Montar `TarefasSection` após `WhatsappSection`
- Chamar `checkTarefasVencidasAction()` via `useEffect` no mount do board (não do modal)

---

## Fase 5 — UI: Board

### 5a. Badge "sem resposta" em `CardKanban` (`src/components/pipeline/card-kanban.tsx` ou similar)
- Recebe `sem_resposta: boolean` e `ultimo_contato_at`
- Renderiza badge `●` vermelho com tooltip "Sem contato há N dias"

### 5b. Filtro "sem resposta" no painel de filtros
- Localizar o componente de filtros do board
- Adicionar toggle "Sem resposta"
- Passar para `getCardsQuadro` como `semResposta: true`

### 5c. `checkTarefasVencidasAction` no mount do board
- Localizar o componente raiz do board (client component)
- Adicionar `useEffect(() => { checkTarefasVencidasAction() }, [])` uma vez por mount

---

## Fase 6 — UI: `/pipeline/config` — aba Templates

### 6a. `TemplatesConfigClient` (`src/components/pipeline/config/templates-config-client.tsx`)
- Lista templates com nome, descrição, contagem de variáveis, ativo/inativo
- Modal criar/editar: campos nome_template, descricao, variaveis_count + select de fonte por variável
- Arquivar (sem excluir)

### 6b. Atualizar `/pipeline/config/page.tsx`
- Adicionar query de templates no fetch da página
- Adicionar tab "Templates WhatsApp" (ou seção abaixo dos quadros)
- Renderizar `TemplatesConfigClient`

---

## Fase 7 — Verificação final

1. `npm run typecheck` — zero erros
2. `npm run build` — zero erros
3. Smoke test manual:
   - Cadastrar template em `/pipeline/config`
   - Enviar WhatsApp de um card → verificar `mensagens_whatsapp` e `pipeline_card_atividade`
   - Criar tarefa com responsável → verificar `notificacoes`
   - Verificar badge "sem resposta" em card com `prazo_max_dias` excedido

---

## Arquivos a criar/modificar

| Arquivo | Ação |
|---|---|
| `supabase/migrations/202606210003_pipeline_mvp3.sql` | Criar |
| `src/lib/validation/pipeline.ts` | Modificar |
| `src/lib/actions/pipeline.ts` | Modificar |
| `src/components/pipeline/whatsapp-section.tsx` | Criar |
| `src/components/pipeline/tarefas-section.tsx` | Criar |
| `src/components/pipeline/card-modal.tsx` | Modificar |
| `src/components/pipeline/config/templates-config-client.tsx` | Criar |
| `src/app/(app)/pipeline/config/page.tsx` | Modificar |
| `src/components/pipeline/board.tsx` (ou card kanban) | Modificar |

## Dependências externas

- `lib/whatsapp/send.ts` — `enviarWhatsApp()` já implementada, sem mudança
- `notificacoes` — tabela existente, sem migration
- `mensagens_whatsapp` — tabela existente, sem migration
