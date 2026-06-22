# Pipeline Kanban — Design MVP4 (Automação por regras)

- Data: 2026-06-21
- Status: aprovado para planejamento (depende do MVP1–MVP3)
- Pré-requisitos: specs MVP1–MVP3; cron Vercel `/api/jobs/dispatch`; `jobs_log`; `pipeline_tarefa`;
  `enviarWhatsApp`; `notificacoes`.

## 1. Objetivo e decisões

Reduzir trabalho manual e padronizar o atendimento com automações. **Não** é um motor de regras
genérico: é um **conjunto curado de automações pré-definidas**, cada uma ligável/desligável e
parametrizável por quadro/coluna.

Decisões firmadas (brainstorming):

1. **Motor**: conjunto curado toggleável (não builder genérico).
2. **Scheduler**: reusar o cron diário existente (`/api/jobs/dispatch`, 07:00) — gatilhos de
   tempo são avaliados **1x/dia**. Sem nova infra.
3. **Gatilhos**: evento (mudança de coluna, síncrono na action) **e** tempo (job diário).
4. **Ações**: criar tarefa, enviar template WhatsApp, mover card, notificar responsável interno,
   mudar status do card.

Consequência aceita: automações de tempo têm granularidade diária. "24h parado" significa, na
prática, "detectado no próximo run das 07:00".

## 2. Catálogo de automações (curado)

Cada `tipo` tem parâmetros tipados (`params jsonb`). Mapeamento dos exemplos da spec original:

| tipo | gatilho | ação | params |
|---|---|---|---|
| `card_parado_cria_tarefa` | tempo | criar tarefa | `dias` (ou usa `coluna.prazo_max_dias`), `titulo` |
| `coluna_entrada_envia_template` | evento | enviar template WhatsApp | `coluna_id`, `template_name`, mapa de variáveis |
| `coluna_entrada_cria_tarefa` | evento | criar tarefa | `coluna_id`, `titulo`, `due_em_dias` |
| `coluna_entrada_solicita_dado` | evento | (UI) exigir dado ao mover | `coluna_id`, `campo` (ex.: data da visita) |
| `coluna_entrada_muda_status` | evento | mudar `status_lead` | `coluna_id`, `status_destino` |
| `entrada_etapa_final_boas_vindas` | evento | enviar template | `template_name` (ex.: boas-vindas) |
| `mover_card_condicional` | evento | mover card | `de_coluna_id`, `para_coluna_id` |

Notas:

- A "Regra 1 — novo lead via WhatsApp cria card" depende de **inbound** (fora do escopo até a
  fase futura de WhatsApp); fica registrada como não suportada no MVP4.
- "Sem vaga → mover para reserva" usa `mover_card_condicional`/`coluna_entrada_muda_status`
  (reserva é coluna, conforme MVP2).
- `coluna_entrada_solicita_dado` é validação na UI/action de mover (não roda no job).

## 3. Modelo de dados

### 3.1 `pipeline_automacao` (configuração)
| coluna | tipo | nota |
|---|---|---|
| id | uuid pk | |
| escola_id | uuid not null → escolas | |
| quadro_id | uuid null → pipeline_quadro | null = aplica a todos os quadros da escola |
| coluna_id | uuid null → pipeline_coluna | quando o tipo é específico de coluna |
| tipo | text not null | um valor do catálogo (§2) |
| ativo | boolean not null default true | toggle |
| params | jsonb not null default '{}' | parâmetros tipados por `tipo` — ver §3.3 |
| created_at / updated_at | timestamptz | |

Índice: `(escola_id, quadro_id, ativo)`.

### 3.2 `pipeline_automacao_execucao` (log + dedupe)
| coluna | tipo | nota |
|---|---|---|
| id | uuid pk | |
| escola_id | uuid not null | |
| automacao_id | uuid not null → pipeline_automacao (cascade) | |
| card_id | uuid not null → pipeline_card (cascade) | |
| coluna_id | uuid null | contexto de entrada de coluna (para dedupe por entrada) |
| executed_at | timestamptz not null default now() | |
| resultado | text not null | `ok` / `erro` / `ignorado` |
| detalhe | text | mensagem/erro |

**Políticas de dedupe por tipo** (definidas no §2 — coluna `coluna_id` compõe o contexto quando relevante):

| tipo | política | índice único |
|---|---|---|
| `card_parado_cria_tarefa` | uma_vez por card | `unique (automacao_id, card_id)` |
| `coluna_entrada_envia_template` | uma_vez por entrada na coluna | `unique (automacao_id, card_id, coluna_id)` |
| `coluna_entrada_cria_tarefa` | uma_vez por entrada na coluna | `unique (automacao_id, card_id, coluna_id)` |
| `coluna_entrada_solicita_dado` | sem dedupe (validação UI, não grava execução) | — |
| `coluna_entrada_muda_status` | sem dedupe (idempotente) | — |
| `entrada_etapa_final_boas_vindas` | uma_vez por card | `unique (automacao_id, card_id)` |
| `mover_card_condicional` | uma_vez por entrada na coluna | `unique (automacao_id, card_id, coluna_id)` |

Os dois índices únicos necessários:

```sql
-- uma_vez por card
create unique index pipeline_exec_card_uniq
  on pipeline_automacao_execucao(automacao_id, card_id)
  where coluna_id is null;

-- uma_vez por entrada de coluna
create unique index pipeline_exec_coluna_uniq
  on pipeline_automacao_execucao(automacao_id, card_id, coluna_id)
  where coluna_id is not null;
```

### 3.3 Shape de `params` por tipo

```typescript
// card_parado_cria_tarefa
// (usa coluna.prazo_max_dias se dias não informado; mínimo efetivo: 2)
{ dias?: number, titulo: string, assigned_to?: string /* uuid */ }

// coluna_entrada_envia_template
// (template_id referencia pipeline_template_whatsapp — já tem nome_template e fontes)
{ coluna_id: string, template_id: string, variaveis_fontes?: FonteWpp[] }

// coluna_entrada_cria_tarefa
{ coluna_id: string, titulo: string, due_em_dias?: number, assigned_to?: string }

// coluna_entrada_solicita_dado
// (validação UI/action — não grava em pipeline_automacao_execucao)
{ coluna_id: string, campo: string, label: string, obrigatorio: boolean }

// coluna_entrada_muda_status
{ coluna_id: string, status_destino: StatusLead }

// entrada_etapa_final_boas_vindas
// (coluna de etapa final identificada via pipeline_coluna.etapa_final = true)
{ template_id: string }

// mover_card_condicional
{ de_coluna_id: string, para_coluna_id: string }
```

**Nota sobre `card_parado_cria_tarefa`:** granularidade é diária (job 07:00). O mínimo efetivo
para `dias` é 2 — um card que para hoje só será detectado no run do dia seguinte.

## 4. Execução

### Gatilhos de evento (síncrono)
Na Server Action `moverCard` (e em criação/edição de card quando aplicável), após persistir o
movimento, avaliar as automações `ativo=true` cujo gatilho casa com a transição
(`para_coluna_id`), na ordem: validações de UI (`solicita_dado`) → ações. Cada ação executada
grava `pipeline_automacao_execucao` + `pipeline_card_atividade` (`tipo='sistema'`).

**Execução das ações de rede (WhatsApp, notificações):** disparar com `Promise.allSettled` sem
bloquear o retorno ao usuário — o resultado chega de forma assíncrona e é gravado em
`pipeline_automacao_execucao`. Isso evita que latência de rede (envio de template) atrase o
feedback de drag-and-drop. Ações de banco (criar tarefa, mudar status, mover card) podem ser
aguardadas diretamente pois são rápidas.

**Anti-loop:** automações de evento disparadas por uma ação de automação (ex.: `mover_card_condicional`
move um card que recai em outra coluna com automação) **não reaprovocam** novas automações de evento.
A `moverCard` interna recebe `triggered_by_automation: true` e pula a avaliação de gatilhos.
Profundidade máxima: 1.

### Gatilhos de tempo (job diário)
Nova função `jobPipelineAutomacoes(hoje)` (padrão de `folha-jobs.ts`), chamada por
`/api/jobs/dispatch`:

1. Para cada escola, varre automações de tempo `ativo=true`.
2. Seleciona cards elegíveis (ex.: `now() - ultimo_contato_at > dias`), respeitando o dedupe
   (`pipeline_automacao_execucao`).
3. Executa a ação, grava execução + atividade.
4. Ao final, grava um registro em `jobs_log` (`job='pipeline_automacoes'`, `sucesso`, `detalhe`).

## 5. Ações (reuso dos blocos MVP2/MVP3)

- **Criar tarefa** → insere `pipeline_tarefa` (MVP3).
- **Enviar template WhatsApp** → `enviarWhatsappCard` (MVP3); respeita telefone válido.
- **Mover card** → mesma lógica de `moverCard` (recalcula `ordem`), grava movimentação.
- **Notificar responsável** → insere em `notificacoes`.
- **Mudar status** → atualiza `pipeline_card.status_lead`.

## 6. Guardrails

- **Anti-spam WhatsApp**: automações de envio respeitam o dedupe (uma vez por card por regra) e,
  opcionalmente, um teto diário por escola (`params.max_por_dia`). Sem isso, um erro de config
  poderia disparar muitos templates.
- **Falha isolada**: erro em uma ação não aborta o restante do job; grava `resultado='erro'`.
- **Permissão**: gerenciar automações exige `pipeline_admin` (MVP2). As ações executadas pelo
  job rodam como sistema (SECURITY DEFINER), com `escola_id` do card.

## 7. UI

Tela de automações por quadro (gated por `pipeline_admin`): lista o catálogo, toggle ativo, e
formulário de parâmetros por tipo. Sem editor de lógica livre.

## 8. Critérios de aceite

1. Mover card para coluna com automação de evento dispara a ação e registra execução + atividade.
2. Job diário cria tarefa para card parado além do prazo **uma única vez** (dedupe comprovado por
   teste rodando o job 2x).
3. Envio automático de template respeita dedupe e teto; telefone inválido → `resultado='erro'`
   sem abortar o lote.
4. Toggle off de uma automação interrompe novas execuções.
5. `jobs_log` recebe o resumo de cada run; ações ficam auditáveis em `pipeline_card_atividade`.
6. Gerência de automação bloqueada para quem não tem `pipeline_admin` (servidor).
7. `typecheck` + `build` verdes; testes do dedupe e da avaliação de elegibilidade por tempo.

## 9. Riscos

- **Granularidade diária**: se o negócio exigir reação em horas, será preciso um cron mais
  frequente (entrada extra no `vercel.json`); decisão adiável até haver necessidade real.
- **Loops de automação**: "mover card" disparando outra automação de entrada de coluna pode
  encadear. Mitigar: não reavaliar automações de evento disparadas por ações automáticas
  (flag de origem na execução) — profundidade 1.
- **Config incorreta** gerando envios em massa → guardrails do §6.

## 10. Fora de escopo do MVP4

Builder de regras genérico; inbound de WhatsApp e criação automática de card; granularidade
sub-diária; indicadores/relatórios e anamnese (MVP5).
