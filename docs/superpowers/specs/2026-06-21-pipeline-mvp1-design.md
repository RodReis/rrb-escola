# Pipeline Kanban — Design (MVP1 a fundo + visão geral dos MVPs)

- Data: 2026-06-21
- Status: aprovado para planejamento
- Módulo: Pipeline Kanban (funil de captação / relacionamento educacional)
- Stack: Next.js 14 (App Router) + Tailwind + Supabase, PT-BR, multi-tenant por `escola_id`

## 1. Contexto e premissas

O Pipeline Kanban é um funil visual para organizar contatos, leads, responsáveis e prováveis
alunos por etapa do atendimento, do primeiro contato até a matrícula.

Premissas firmadas com o cliente (decisões de brainstorming):

1. **Modelo de dados: entidades novas + promoção.** O lead vive em tabelas `pipeline_*`
   próprias e só vira `aluno` + `matricula` no momento da conversão. Não se reusa nem se
   relaxa a tabela `alunos` (que exige `matricula_codigo NOT NULL UNIQUE`).
2. **A reserva é o estado-núcleo, não exceção.** Todo provável aluno novo entra em cadastro
   de reserva para análise (entrevista de pais e filhos), **independente de haver vaga**.
   A escola decide depois se recebe ou não o aluno e então faz o contato. A spec original
   tratava reserva como fallback de "sem vaga" — está corrigido aqui.
3. **WhatsApp: outbound primeiro.** Envio de mensagens pelo card no MVP3. Inbound (webhook,
   criação automática de card a partir de nova conversa) fica para fase posterior.
4. **Realtime sem lock.** Supabase Realtime propaga mudanças; UI otimista no drag-and-drop;
   sem bloqueio/aviso de edição simultânea no início (YAGNI).
5. **Schema genérico desde o MVP1.** Quadros e colunas são dados (tabelas), não código.
   O MVP1 entrega um único quadro semeado, mas o modelo já suporta "quadros ilimitados"
   sem migração futura.
6. **Anamnese fica para os últimos MVPs.**

### Aproveitamento do que já existe (evitar duplicação)

O sistema já possui, normalizado e com RLS: `alunos`, `enderecos_aluno`, `contatos_aluno`,
`responsaveis_aluno`, `informacoes_medicas` (= anamnese), `matriculas`, `historico_matriculas`,
`mensagens_whatsapp`, RBAC (`modulos`, `roles`/`perfis`, `role_permissoes`), `lib/whatsapp`
(Meta Cloud API, só envio) e `lib/storage`. O Pipeline **referencia** essas entidades; não as
recria. O lead é a única novidade de dados pessoais, justamente porque ainda não é um aluno.

## 2. Arquitetura

- Rota: `src/app/(app)/pipeline` (página do quadro) — protegida pelo gate de RBAC existente.
- Componentes: `src/components/pipeline/*` (board, coluna, card, modal de card, timeline, filtros).
- Server Actions: `src/lib/actions/pipeline.ts` (CRUD card, mover, nota; promoção entra no MVP2).
- Validação: `src/lib/validation/pipeline.ts` (Zod).
- Util puro testável: `src/lib/pipeline/ordenacao.ts` (cálculo de `ordem` fracionária) e,
  no MVP2, `src/lib/pipeline/promocao.ts`.
- Realtime: cliente assina `postgres_changes` de `pipeline_card`/`pipeline_card_movimentacao`
  filtrado por `escola_id` + `quadro_id`.
- Tema: somente tokens do Design System (`var(--token)` / classes tokenizadas). Sem hex cru.
  A `cor` da coluna é o **nome de um token**, não um valor hex.

### Princípio de isolamento

Cada unidade tem propósito único e interface clara:

- `ordenacao.ts` — entrada: lista ordenada + destino; saída: nova `ordem`. Sem I/O. Testável.
- `pipeline.ts` (actions) — orquestra validação + persistência + auditoria. Depende de Supabase.
- componentes — apresentação + interação; não contêm regra de negócio de persistência.

## 3. Modelo de dados

Todas as tabelas: `id uuid pk default gen_random_uuid()`, `escola_id uuid not null references
escolas(id)`, `created_at`/`updated_at timestamptz default now()`, e RLS por `escola_id`.

### 3.1 `pipeline_quadro`
| coluna | tipo | nota |
|---|---|---|
| nome | text not null | |
| descricao | text | |
| tipo | text | ex.: `captacao`, `rematricula`, `reserva` (rótulo, não enum rígido) |
| ativo | boolean not null default true | |
| ordem | int not null default 0 | ordenação na listagem de quadros |

### 3.2 `pipeline_coluna`
| coluna | tipo | nota |
|---|---|---|
| quadro_id | uuid not null → pipeline_quadro | on delete cascade |
| nome | text not null | |
| cor | text | **nome de token do DS**, não hex |
| ordem | int not null | posição da coluna no quadro |
| descricao | text | |
| prazo_max_dias | int | usado por indicadores/automação (MVP4/5) |
| etapa_final | boolean not null default false | marca colunas terminais (ex.: Matrícula/Perdido) |

### 3.3 `pipeline_card` (objeto de workflow)
| coluna | tipo | nota |
|---|---|---|
| quadro_id | uuid not null → pipeline_quadro | |
| coluna_id | uuid not null → pipeline_coluna | |
| ordem | double precision not null | indexação fracionária (ver §6) |
| titulo | text not null | nome do interessado, denormalizado p/ exibição rápida |
| origem | text | `whatsapp`, `instagram`, `indicacao`, `site`, `ligacao`, `evento`, `campanha`, `presencial` |
| status_lead | text not null default 'novo' | `novo`/`em_analise`/`reserva`/`convertido`/`perdido` |
| aluno_id | uuid null → alunos | preenchido na promoção (MVP2); null enquanto lead |
| assigned_to | uuid null → usuários | responsável pelo card |
| motivo_perda | text null | preenchido quando `perdido` |
| ultimo_contato_at | timestamptz null | alimenta filtros "sem resposta" |

Índices: `(escola_id, quadro_id, coluna_id, ordem)`; `(escola_id, assigned_to)`; `(aluno_id)`.

### 3.4 `pipeline_lead` (1:1 com card — dados pessoais pré-aluno)
| coluna | tipo | nota |
|---|---|---|
| card_id | uuid not null unique → pipeline_card | on delete cascade |
| nome | text not null | |
| data_nascimento | date | idade é **derivada**, não armazenada |
| sexo | text | |
| cpf | text | |
| rg | text | |
| foto_url | text | via `lib/storage` |
| serie_interesse | text null | usado a partir do MVP2 |
| turno | text null | MVP2 |
| ano_letivo | int null | MVP2 |

### 3.5 `pipeline_lead_responsavel` (1:N)
| coluna | tipo |
|---|---|
| card_id | uuid not null → pipeline_card (cascade) |
| nome | text not null |
| parentesco | text |
| cpf / rg | text |
| telefone / whatsapp / email | text |
| financeiro / pedagogico / autorizado_retirar | boolean default false |
| observacoes | text |

### 3.6 `pipeline_card_movimentacao` (histórico de moves)
| coluna | tipo |
|---|---|
| card_id | uuid not null → pipeline_card (cascade) |
| de_coluna_id | uuid null → pipeline_coluna |
| para_coluna_id | uuid not null → pipeline_coluna |
| usuario_id | uuid not null |
| observacao | text |
| created_at | timestamptz |

### 3.7 `pipeline_card_atividade` (timeline geral)
| coluna | tipo | nota |
|---|---|---|
| card_id | uuid not null → pipeline_card (cascade) | |
| tipo | text not null | `nota`/`ligacao`/`email`/`whatsapp`/`sistema` |
| descricao | text | |
| usuario_id | uuid not null | |
| anexo_url | text null | `lib/storage` |
| created_at | timestamptz | |

## 4. Estados do card e costura lead→aluno

Ciclo de `status_lead`: `novo → em_analise → reserva → (convertido | perdido)`.
A reserva é o estado em que o card passa a maior parte do tempo enquanto a escola analisa.

### Promoção (MVP2 — seam desenhado agora)

`promoverCardParaAluno(cardId)` — Server Action que delega a uma **função SQL/RPC transacional**
no Supabase para atomicidade:

1. Valida permissão `pipeline:promover` e `escola_id`.
2. A partir de `pipeline_lead` + `pipeline_lead_responsavel`, cria: `aluno` (gera
   `matricula_codigo`), `enderecos_aluno`, `contatos_aluno`, `responsaveis_aluno`, e a
   `matricula` (série/turma/ano).
3. Grava `pipeline_card.aluno_id`, muda `status_lead = 'convertido'`, move para coluna
   `etapa_final`, registra `pipeline_card_atividade` tipo `sistema`.
4. **Idempotente**: se `aluno_id` já preenchido, não duplica.

Isso preenche a lacuna da spec original (conversão lead→matrícula nunca especificada).

## 5. Multi-tenancy, RLS e permissões

- RLS em todas as tabelas: linha visível/editável apenas se `escola_id` = escola do usuário
  (via `auth.uid()` → vínculo de escola), seguindo o padrão das migrations existentes.
- **Sem perfis novos.** Registrar módulo `pipeline` no RBAC existente (`modulos` /
  `role_permissoes`, ver `docs/rbac-developer-guide.md`) com permissões:
  `ver | editar | mover | promover | admin`.
- Os papéis da spec original mapeiam para combinações:
  - Atendimento → `ver`, `editar`, `mover`
  - Secretaria → `ver`, `editar`, `mover`, `promover`
  - Coordenação → `ver` (+ dados pedagógicos/anamnese no MVP5)
  - Administrador → `admin`
- LGPD: auditoria via `pipeline_card_movimentacao`/`_atividade`; dados sensíveis (anamnese)
  só no MVP5, com RLS reforçada e consentimento.

## 6. Drag-and-drop e ordenação

- `ordem` é `double precision`. Ao soltar entre dois cards de posições `a` e `b`, nova
  `ordem = (a + b) / 2`. Sem vizinho, usa `a + 1` (fim) ou `b - 1` (início).
- Evita UPDATE em massa; rebalanceamento só quando o gap fica pequeno (job raro, fora do MVP1).
- UI otimista: o card move na hora; em erro de persistência, reverte e mostra toast.
- `ordenacao.ts` é util puro, coberto por testes unitários.

## 7. Realtime

- Cliente assina `postgres_changes` de `pipeline_card` e `pipeline_card_movimentacao`,
  filtrado por `escola_id` + `quadro_id`.
- Ao receber evento, faz patch local do card (sem refetch total).
- Sem lock; última escrita vence (aceitável para o volume de uma escola).

## 8. MVP1 — escopo e critérios de aceite

### Escopo (entregável)

- Migration cria as 7 tabelas + RLS + seed de **um** quadro "Captação de Novos Alunos" com
  colunas: Novo Lead, Primeiro Contato, Aguardando Retorno, Entrevista, Cadastro de Reserva,
  Em Análise, Matrícula Confirmada, Perdido.
- Board renderiza colunas e cards da escola do usuário.
- CRUD de card manual (criar/editar/excluir).
- Dados básicos do lead (nome, nascimento) + contato (telefone, whatsapp, email) + ≥1 responsável.
- Drag-and-drop persistindo `coluna_id` + `ordem`, gravando `pipeline_card_movimentacao`
  (usuário + timestamp + observação opcional).
- Nota interna (`pipeline_card_atividade` tipo `nota`).
- Timeline do card (movimentações + notas, ordem cronológica).
- Filtros: nome, coluna, responsável.
- Realtime no board.
- Tema claro/escuro só com tokens.

### Fora do MVP1

Promoção lead→aluno (MVP2), WhatsApp (MVP3), automação/regras (MVP4),
anamnese/indicadores/relatórios (MVP5), CRUD de quadros/colunas pela UI (MVP2+; no MVP1 vêm do seed).

### Critérios de aceite (verificáveis)

1. Mover um card persiste `coluna_id`+`ordem` e cria movimentação com `usuario_id` e timestamp.
2. RLS: usuário de outra escola não enxerga os cards; perfil sem `pipeline:mover` não consegue arrastar (ação bloqueada no servidor, não só na UI).
3. Criar card com nome + 1 responsável + 1 contato e recarregar mantém os dados.
4. Nota aparece na timeline junto às movimentações, em ordem cronológica.
5. Filtro por nome/coluna/responsável reduz corretamente o board.
6. `npm run typecheck && npm run build` verdes; `npm run test` cobrindo `ordenacao.ts` e regras de RLS (teste de policy).
7. Paridade visual claro/escuro usando tokens (sem hex cru fora dos tokens).

## 9. Visão geral dos MVPs seguintes

- **MVP2 — Dados educacionais + Reserva + Promoção.** Campos escolares (série/turno/ano,
  escola anterior, motivo de transferência, docs pendentes), reserva como estado-núcleo
  (prioridade, status da vaga, previsão), responsável financeiro/pedagógico, filtros por
  série/turno/status de vaga, e a **promoção transacional lead→aluno/matrícula** (§4).
  CRUD de quadros/colunas pela UI.
- **MVP3 — WhatsApp outbound + tarefas.** Envio de mensagens pelo card via `lib/whatsapp`,
  registro na timeline, tarefas/lembretes de retorno, atribuição de responsável, filtro
  "cards sem resposta", registro de ligações/contatos externos. Inbound/criação automática:
  fase futura.
- **MVP4 — Motor de regras.** Gatilhos por mudança de coluna (evento) e por tempo parado
  (scheduler: `pg_cron` ou edge function). Ações: mover card, criar tarefa, enviar mensagem,
  alertar responsável. Regras configuráveis por quadro/coluna.
- **MVP5 — Anamnese, permissões finas, indicadores.** Anamnese estendendo
  `informacoes_medicas` com RLS reforçada e consentimento; permissões granulares por perfil;
  auditoria de acesso a dados sensíveis; indicadores (conversão por origem, tempo médio até
  matrícula, reserva, pendências) e relatórios.

## 10. Riscos e mitigações

- **Divergência de fonte de verdade** entre lead e aluno → resolvido por promoção idempotente
  e `aluno_id` como ponte; lead nunca é editado após `convertido`.
- **WhatsApp inbound** (alto custo: webhook, número/templates aprovados, janela 24h) →
  fora do MVP3; outbound primeiro.
- **Scheduler de automação** (MVP4) exige `pg_cron`/edge function → decidir infra antes do MVP4.
- **Reordenação fracionária** pode degradar após muitas inserções → rebalanceamento raro.
- **Regras do Design System** (sem serifa, cor só via token, paridade de tema) são trava de
  qualidade por fase: `typecheck` + `build` verdes antes de fechar.
