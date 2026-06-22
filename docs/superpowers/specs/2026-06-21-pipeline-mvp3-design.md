# Pipeline Kanban — Design MVP3 (WhatsApp outbound, Tarefas, Atribuição)

- Data: 2026-06-21
- Status: aprovado para implementação
- Pré-requisitos: MVP1 e MVP2 implementados; `lib/whatsapp`, `mensagens_whatsapp`, `notificacoes`.

## 1. Objetivo e decisões

Centralizar o relacionamento no card e reduzir perda de contato: disparo de WhatsApp por
template, tarefas de retorno, atribuição de responsável, notificações internas e indicador de
"card sem resposta".

Decisões firmadas:

1. **Templates no banco** — nova tabela `pipeline_template_whatsapp` cadastrada via
   `/pipeline/config`. O admin registra o nome exato aprovado na Meta; sem validação prévia
   com a API (responsabilidade do admin).
2. **Pré-preenchimento melhor-esforço** — posições fixas resolvidas automaticamente
   (`lead.nome`, `lead.responsavel.nome`, `escola.nome`, `hoje`, `lead.responsavel.whatsapp`);
   posições além disso ou marcadas como `campo_livre` viram inputs editáveis antes do envio.
3. **Log/timeline** — reusar `mensagens_whatsapp` via referência polimórfica
   (`referencia_tipo='pipeline_card'`, `referencia_id=card_id`, `aluno_id=null`). Sem migration
   na tabela.
4. **Tarefas** — nova tabela `pipeline_tarefa`; criadas manualmente no MVP3.
5. **"Sem resposta"** — calculado na leitura via join com `prazo_max_dias` da coluna; sem
   scheduler.
6. **Notificação vencida** — inserida sob demanda na leitura, verificando duplicata antes de
   inserir (uma notificação por tarefa).

## 2. Dados — schema

### `pipeline_template_whatsapp` (nova tabela)

```sql
create table pipeline_template_whatsapp (
  id               uuid primary key default gen_random_uuid(),
  escola_id        uuid not null references escolas(id) on delete cascade,
  nome_template    text not null,          -- nome exato aprovado na Meta
  descricao        text not null,          -- rótulo exibido na UI
  variaveis_count  int  not null default 0,
  variaveis_fontes text[] not null default '{}',
  -- array de fontes por posição (índice 0 = {{1}})
  -- valores: 'lead.nome' | 'lead.responsavel.nome' | 'lead.responsavel.whatsapp'
  --          | 'escola.nome' | 'hoje' | 'campo_livre'
  ativo            boolean not null default true,
  created_at       timestamptz not null default now()
);

create index pipeline_template_wpp_escola_idx on pipeline_template_whatsapp(escola_id, ativo);

alter table pipeline_template_whatsapp enable row level security;

create policy pipeline_template_wpp_read on pipeline_template_whatsapp
  for select to authenticated using (pipeline_pode('pipeline', 'read'));

create policy pipeline_template_wpp_write on pipeline_template_whatsapp
  for all to authenticated using (pipeline_pode('pipeline_admin', 'read'));

grant select, insert, update, delete on pipeline_template_whatsapp to authenticated;
```

### `pipeline_tarefa` (nova tabela)

```sql
create table pipeline_tarefa (
  id           uuid primary key default gen_random_uuid(),
  escola_id    uuid not null references escolas(id) on delete cascade,
  card_id      uuid not null references pipeline_card(id) on delete cascade,
  titulo       text not null,
  descricao    text,
  due_at       timestamptz,
  status       text not null default 'aberta',
  -- 'aberta' | 'concluida' | 'cancelada'
  assigned_to  uuid references perfis(id) on delete set null,
  created_by   uuid not null references perfis(id) on delete restrict,
  created_at   timestamptz not null default now(),
  completed_at timestamptz
);

create index pipeline_tarefa_card_idx       on pipeline_tarefa(card_id, status);
create index pipeline_tarefa_assigned_idx   on pipeline_tarefa(escola_id, assigned_to, status);
create index pipeline_tarefa_due_idx        on pipeline_tarefa(escola_id, due_at)
  where status = 'aberta';

alter table pipeline_tarefa enable row level security;

create policy pipeline_tarefa_rw on pipeline_tarefa
  for all to authenticated using (pipeline_pode('pipeline', 'read'));

grant select, insert, update, delete on pipeline_tarefa to authenticated;
```

### `pipeline_card` — sem alteração de schema

`assigned_to` e `ultimo_contato_at` já existem no MVP1.

### `pipeline_card_atividade` — sem alteração de schema

`tipo = 'whatsapp'` já existe no enum de valores aceitos.

## 3. Server Actions (`src/lib/actions/pipeline.ts`)

Todas usam `getPipelineCtx()` existente. Retornam `ActionResult<T>`.

### Templates WhatsApp

```typescript
// Leitura (pipeline:read)
getTemplatesWhatsapp(): Promise<ActionResult<TemplateWpp[]>>

// Admin (pipeline_admin:read)
criarTemplateAction(input: TemplateWppInput): Promise<ActionResult>
editarTemplateAction(id: string, input: TemplateWppInput): Promise<ActionResult>
arquivarTemplateAction(id: string): Promise<ActionResult>
```

**`TemplateWppInput`** (Zod schema `templateWppSchema`):
```typescript
{
  nome_template:    string (min 1)
  descricao:        string (min 1)
  variaveis_count:  number int ≥ 0
  variaveis_fontes: array de FONTES_WPP (length = variaveis_count)
  ativo:            boolean default true
}

const FONTES_WPP = [
  'lead.nome', 'lead.responsavel.nome', 'lead.responsavel.whatsapp',
  'escola.nome', 'hoje', 'campo_livre'
] as const
```

### Envio WhatsApp

**`enviarWhatsappCardAction(card_id, template_id, variaveis_override)`**

`variaveis_override: string[]` — valores finais de cada `{{n}}` (pós-edição do usuário).
Fluxo:
1. `getPipelineCtx()` — valida `pipeline:create`
2. Busca em paralelo: template, card + coluna + quadro, lead, primeiro responsável
   (`pipeline_lead_responsavel order by criado_at limit 1`), escola
3. Resolve variáveis: para cada posição `i`, se `variaveis_override[i]` não vazio usa ele;
   caso contrário resolve pela fonte do template (ver tabela abaixo)
4. Valida `telefone` — se ausente retorna `{ ok: false, error: "Responsável sem WhatsApp" }`
5. Chama `enviarWhatsApp({ telefone, templateName: template.nome_template, variaveis,
   textoLog: template.descricao, referenciaTipo: 'pipeline_card', referenciaId: card_id,
   alunoId: null })`
6. Insere em `pipeline_card_atividade`:
   `{ tipo: 'whatsapp', descricao: \`${template.descricao} — ${resultado.status}\` }`
7. `update pipeline_card set ultimo_contato_at = now() where id = card_id`
8. `revalidatePath('/pipeline')`

**Resolução de fontes:**

| Fonte | Valor resolvido |
|---|---|
| `lead.nome` | `lead.nome` |
| `lead.responsavel.nome` | `responsavel.nome` |
| `lead.responsavel.whatsapp` | `responsavel.whatsapp ?? responsavel.telefone` |
| `escola.nome` | `escola.nome` |
| `hoje` | `new Date().toLocaleDateString('pt-BR')` |
| `campo_livre` | `''` (fica em branco — usuário deve preencher) |

### Tarefas

```typescript
getTarefasCard(card_id: string): Promise<ActionResult<Tarefa[]>>

criarTarefaAction(card_id: string, input: TarefaInput): Promise<ActionResult>
// Após insert: se assigned_to definido, insere notificação (ver §4)

concluirTarefaAction(tarefa_id: string): Promise<ActionResult>
// update status='concluida', completed_at=now()

cancelarTarefaAction(tarefa_id: string): Promise<ActionResult>
// update status='cancelada'
```

**`TarefaInput`** (Zod schema `tarefaSchema`):
```typescript
{
  titulo:      string (min 1, max 200)
  descricao:   string optional
  due_at:      string (ISO datetime) optional
  assigned_to: string (uuid) optional nullable
}
```

### Indicador "sem resposta"

Calculado dentro de `getCardsQuadro` (action existente) via join:

```sql
-- campo adicional no select de cards:
(
  coluna.prazo_max_dias is not null
  and now() - coalesce(card.ultimo_contato_at, card.created_at)
      > coluna.prazo_max_dias * interval '1 day'
) as sem_resposta
```

Filtro opcional: novo parâmetro `semResposta?: boolean` em `getCardsQuadro` — quando `true`,
filtra apenas cards com `sem_resposta = true`.

### Notificações de tarefa vencida (leitura sob demanda)

```typescript
checkTarefasVencidasAction(): Promise<void>
```

Chamada pelo client ao montar o board (uma vez por sessão via `useEffect`):
1. Busca tarefas `status='aberta'` AND `due_at < now()` AND `assigned_to = usuario_atual`
2. Para cada uma, verifica se já existe notificação não lida com
   `tipo='pipeline_tarefa_vencida'` e `href` contendo o `card_id`
3. Se não existe: insere notificação
   `{ tipo: 'pipeline_tarefa_vencida', titulo: 'Tarefa vencida', descricao: tarefa.titulo,
     href: '/pipeline', severidade: 'atencao', perfil_id: assigned_to }`

## 4. Notificações internas

Reutiliza tabela `notificacoes` existente. Dois novos tipos:

| tipo | quando | perfil_id | severidade |
|---|---|---|---|
| `pipeline_tarefa_atribuida` | ao criar tarefa com `assigned_to` | `assigned_to` | `info` |
| `pipeline_tarefa_vencida` | leitura sob demanda (§3) | `assigned_to` | `atencao` |

Ambas com `href: '/pipeline'` (link para o board — sem deep-link para card específico no MVP3).

## 5. UI

### CardModal — `WhatsappSection`

Posicionada após `ReservaSection`. Estrutura:

```
[ Select "Escolha um template…" ▼ ]

// Após seleção:
[ Campo {{1}}: [pré-preenchido, editável]      ]
[ Campo {{2}}: [pré-preenchido, editável]      ]
[ Campo {{3}}: [vazio — campo livre, editável] ]
[ Botão "Enviar WhatsApp"                      ]

// Histórico (abaixo do form):
── Enviados ──
  📱 Template boas-vindas · enviada · 20/06 14:32
  📱 Template retorno · falha · 19/06 09:10
```

Histórico lido de `pipeline_card_atividade` onde `tipo='whatsapp'`.

Rótulos dos campos: `"Variável {{n}}"` — sem rótulo personalizado no MVP3 (o admin vê a fonte
configurada em `/pipeline/config`).

### CardModal — `TarefasSection`

Posicionada após `WhatsappSection`. Estrutura:

```
Tarefas  [+ Nova]

── Abertas ──
  ○ Ligar para responsável   [due: amanhã]  [João]  ✓ ✕
  ● VENCIDA: Enviar proposta  [due: ontem]  [—]     ✓ ✕

── Concluídas ──
  ✓ Confirmar visita  concluída 18/06
```

Badge "VENCIDA" em vermelho quando `due_at < now()` e status `aberta`.

Formulário inline ao clicar "+ Nova":
- Título (obrigatório)
- Descrição (textarea, opcional)
- Vencimento (date-time picker, opcional)
- Responsável (select de perfis da escola, opcional)

Sem edição de tarefa existente no MVP3.

### Board — indicador "sem resposta"

No componente `CardKanban`: badge `●` vermelho pequeno no canto superior direito do card
quando `sem_resposta = true`. Tooltip: `"Sem contato há N dias"` (calculado no client a partir
de `ultimo_contato_at ?? created_at`).

### Filtro "sem resposta"

No painel de filtros existente: novo toggle "Sem resposta" que passa `semResposta: true`
para `getCardsQuadro`.

### `/pipeline/config` — aba Templates WhatsApp

Nova aba na página (`/pipeline/config?tab=templates`). Lista templates com nome, descrição,
contagem de variáveis, status ativo/inativo.

Formulário (modal) ao criar/editar:
- Nome do template (text, obrigatório)
- Descrição / rótulo UI (text, obrigatório)
- Quantidade de variáveis (number, 0–10)
- Para cada `{{n}}`: select de fonte (`FONTES_WPP`)
- Toggle Ativo

## 6. Modelo de dados — resumo das mudanças

| Mudança | Tipo |
|---|---|
| `pipeline_template_whatsapp` | Nova tabela |
| `pipeline_tarefa` | Nova tabela |
| `pipeline_card` | Sem mudança (usa `assigned_to`, `ultimo_contato_at`) |
| `pipeline_card_atividade` | Sem mudança (usa `tipo='whatsapp'`) |
| `mensagens_whatsapp` | Sem mudança (usa referência polimórfica) |
| `notificacoes` | Sem mudança (novos tipos inseridos) |

Migration: `supabase/migrations/202606210003_pipeline_mvp3.sql`

## 7. Critérios de aceite

1. Disparar template pelo card grava em `mensagens_whatsapp` com
   `referencia_tipo='pipeline_card'` + `referencia_id`, espelha atividade `tipo='whatsapp'`
   e atualiza `ultimo_contato_at`.
2. A UI só permite templates cadastrados no banco (sem campo de texto livre para template_name).
3. Variáveis pré-preenchidas automaticamente pelas fontes configuradas; campos `campo_livre`
   editáveis; todos os campos editáveis antes do envio.
4. Responsável sem WhatsApp: mensagem de erro clara, sem envio.
5. Criar tarefa com `assigned_to` gera notificação interna `pipeline_tarefa_atribuida`.
6. Tarefa vencida: badge "VENCIDA" no card modal + notificação `pipeline_tarefa_vencida`
   inserida sob demanda (sem duplicata para mesma tarefa).
7. Badge "sem resposta" coerente com `ultimo_contato_at × prazo_max_dias`; filtro funcional.
8. Admin consegue cadastrar/editar/arquivar templates em `/pipeline/config`.
9. `typecheck` + `build` verdes.

## 8. Riscos

- **Templates não aprovados na Meta**: o admin pode cadastrar um nome errado; o envio falha
  com erro da API. Mitigação: exibir o erro retornado pela Meta na UI.
- **Telefone ausente/inválido**: `normalizarTelefone` retorna `null`; action retorna erro
  antes de chamar a API.
- **Notificação duplicada de tarefa vencida**: a verificação prévia de existência em
  `checkTarefasVencidasAction` previne duplicatas por tarefa.
- **Expectativa de "chat"**: MVP3 é disparo de template + log, não conversa bidirecional.
  Inbound (webhook, janela 24h) é fase futura.

## 9. Fora de escopo do MVP3

Inbound de WhatsApp; texto livre / sessão 24h; motor de regras e criação automática de tarefas
por tempo (MVP4); anamnese e indicadores gerenciais (MVP5); deep-link de notificação para
card específico; edição de tarefa existente.
