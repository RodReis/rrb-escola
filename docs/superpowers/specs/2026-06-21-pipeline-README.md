# Módulo Pipeline Kanban — Índice das specs

Ponto de entrada do módulo de captação/relacionamento educacional (funil Kanban). Reúne as
cinco specs de MVP, as decisões transversais e o que ficou fora.

## Specs (ordem de implementação)

| MVP | Arquivo | Entrega |
| --- | --- | --- |
| 1 | [`...pipeline-mvp1-design.md`](./2026-06-21-pipeline-mvp1-design.md) | Kanban básico: quadro/coluna/card, drag-and-drop, lead + responsável, notas, histórico, filtros, realtime |
| 2 | [`...pipeline-mvp2-design.md`](./2026-06-21-pipeline-mvp2-design.md) | Dados educacionais, reserva com vaga real, **promoção lead→aluno/matrícula**, RBAC ampliado, CRUD de quadros |
| 3 | [`...pipeline-mvp3-design.md`](./2026-06-21-pipeline-mvp3-design.md) | WhatsApp por template, tarefas, atribuição, "card sem resposta" |
| 4 | [`...pipeline-mvp4-design.md`](./2026-06-21-pipeline-mvp4-design.md) | Automação curada toggleável (evento + tempo via cron diário) |
| 5 | [`...pipeline-mvp5-design.md`](./2026-06-21-pipeline-mvp5-design.md) | Anamnese, LGPD (consentimento + auditoria), permissões finas, indicadores |

## Decisões transversais (valem para todos os MVPs)

- **Modelo**: entidades novas `pipeline_*`; o lead vira `aluno`+`matricula` só na **promoção**
  (MVP2), nunca duplicando/relaxando `alunos`.
- **Reserva** é estado-núcleo (coluna do quadro Captação), por onde todo provável aluno passa
  para análise — com ou sem vaga.
- **Multi-tenant + RLS** por `escola_id` via `current_perfil()`; FKs de usuário → `perfis(id)`.
- **RBAC** sem perfis paralelos: módulos `pipeline`, `pipeline_admin` (MVP2) e `pipeline_sensivel`
  (MVP5); enforcement por `role_permissoes` (helper `pipeline_pode`). Role nova: `coordenacao`
  (= atendimento).
- **WhatsApp**: só **outbound por template** (Meta Cloud API); sem chat/inbound.
- **Realtime**: Supabase Realtime no board, sem lock (otimista).
- **Frontend DnD**: `@dnd-kit` (core+sortable+utilities), componentes próprios com tokens do DS;
  `ordem` fracionária; `DragOverlay`. Ver MVP1 §10.
- **Scheduler**: reuso do cron diário Vercel `/api/jobs/dispatch` + `jobs_log` (MVP4).
- **Design System**: cor só via token (incl. `color-pipeline-*`), sem serifa, paridade
  claro/escuro (regras do `CLAUDE.md`).

## Mapa de dados (tabelas novas por MVP)

- MVP1: `pipeline_quadro`, `pipeline_coluna`, `pipeline_card`, `pipeline_lead`,
  `pipeline_lead_responsavel`, `pipeline_card_movimentacao`, `pipeline_card_atividade`.
- MVP2: `pipeline_reserva`; colunas educacionais em `pipeline_lead`; módulo `pipeline_admin`;
  role `coordenacao`; RPC `pipeline_promover_card`; função `pipeline_turma_ocupacao`.
- MVP3: `pipeline_template_whatsapp`, `pipeline_tarefa` (reuso de `mensagens_whatsapp` e
  `notificacoes`).
- MVP4: `pipeline_automacao`, `pipeline_automacao_execucao`; job `jobPipelineAutomacoes`.
- MVP5: `pipeline_anamnese`, `pipeline_anamnese_arquivo`, `pipeline_acesso_log`; módulo
  `pipeline_sensivel`.

## Estado atual (2026-06-21)

Todos os MVPs implementados, typecheck + build verdes, commitados em `main`.

| MVP | Branch/commit | Migration | Status |
| --- | --- | --- | --- |
| 1 | `202606210001_pipeline_mvp1.sql` | `202606210001` | ✅ produção (aplicar db push) |
| 2 | `202606210002_pipeline_mvp2.sql` | `202606210002` | ✅ produção (aplicar db push) |
| 3 | `202606210003_pipeline_mvp3.sql` | `202606210003` | ✅ produção (aplicar db push) |
| 4 | `202606210004_pipeline_mvp4.sql` | `202606210004` | ✅ produção (aplicar db push) |
| 5 | `202606210005_pipeline_mvp5.sql` | `202606210005` | ✅ produção (aplicar db push) |

### Passos manuais pós-deploy

1. `supabase db push` — aplica as 5 migrations em ordem
2. Criar bucket **`pipeline-anamnese`** (privado) no painel Supabase Storage (MVP5)
3. Passar prop `podeVerAnamnese` para `<CardModal>` na página do pipeline, com base
   na sessão do usuário (`can(session.permissions, 'pipeline_sensivel', 'read')`)
4. Adicionar link "Indicadores" na nav do pipeline em `topbar.tsx` → `/pipeline/indicadores`

### Planos de implementação

- [`plans/2026-06-21-pipeline-mvp4-plan.md`](../plans/2026-06-21-pipeline-mvp4-plan.md)
- [`plans/2026-06-21-pipeline-mvp5-plan.md`](../plans/2026-06-21-pipeline-mvp5-plan.md)

## Pendências herdadas (rastreadas nas specs)

- **N1** tokens `color-pipeline-*` no Tailwind/DS (MVP1 §12) — cosmético, baixa prioridade.
- ~~N2 enforcement por role_permissoes~~ — resolvido no MVP2.
- ~~N3 rota /pipeline~~ — resolvido no MVP1.
- ~~N4 DEFAULT_SCHOOL_ID~~ — resolvido no MVP2.

## Fora dos 5 MVPs (candidatos a uma Fase 6)

- WhatsApp **inbound**: chat bidirecional + criação automática de card a partir de nova conversa.
- **Auto-preenchimento público** da anamnese pelo responsável (link com token).
- Automação com **granularidade sub-diária** (cron mais frequente).
- Job de **retenção/anonimização** LGPD para leads perdidos.
- Lock / aviso de edição simultânea.
