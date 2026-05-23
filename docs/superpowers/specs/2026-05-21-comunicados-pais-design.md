# Comunicados aos Pais — Design

**Data:** 2026-05-21
**Frente:** MVP2 — Frente 4, primeira parte (ver `2026-05-20-mvp2-roadmap.md`)

## Objetivo

Permitir que a escola envie comunicados (avisos gerais) aos responsáveis dos alunos via
WhatsApp. O envio é processado em background para não travar a interface nem estourar
timeout. Comunicados podem incluir uma imagem.

## Contexto

- A camada de mensageria WhatsApp (Frente 3) já existe: `src/lib/whatsapp/` com
  `enviarWhatsApp` (envio de texto + log na tabela `mensagens_whatsapp`).
- `mensagens_whatsapp` tem `referencia_tipo`/`referencia_id` genéricos — esta frente os usa
  para vincular cada envio a um comunicado.
- `responsaveis_aluno` tem `celular`, `responsavel_financeiro` (boolean).
- Não há cron configurado no projeto. `vercel.json` existe mas sem `crons`.
- A Frente 3 só envia texto — esta frente estende a camada com envio de imagem.

## Decisões de escopo

- **Apenas comunicados gerais** nesta frente. Lembretes de inadimplência viram spec
  separado depois (Frente 4 — segunda parte).
- **Alcance:** `geral` (todos os responsáveis financeiros de alunos ativos) ou
  `individual` (um aluno escolhido).
- **Destinatário:** apenas o responsável financeiro do aluno (campo
  `responsavel_financeiro`). Um WhatsApp por aluno.
- **Processamento:** assíncrono via Vercel Cron + lotes de 30 mensagens/minuto.
- **Imagem:** opcional. Estende a camada WhatsApp (Frente 3) com envio de mídia.
- **Bucket de imagem:** novo bucket `comunicados`.
- **Menu:** item novo "Comunicados", grupo RH. Módulo RBAC `comunicados` no grupo `rh`.

## Modelo de dados

### Extensão da Frente 3 — `mensagens_whatsapp`

Adicionar uma coluna:

| Coluna | Tipo | Notas |
|--------|------|-------|
| `imagem_url` | text null | URL da imagem; preenchida quando a mensagem tem mídia |

### Tabela `comunicados`

Cabeçalho do comunicado.

| Coluna | Tipo | Notas |
|--------|------|-------|
| `id` | uuid PK | |
| `escola_id` | uuid FK → escolas (ON DELETE CASCADE) | |
| `titulo` | text | |
| `mensagem` | text | corpo enviado (vira legenda quando há imagem) |
| `imagem_path` | text null | caminho no Storage bucket `comunicados` |
| `alcance` | enum `alcance_comunicado` | `geral` \| `individual` |
| `aluno_id` | uuid null FK → alunos (ON DELETE SET NULL) | preenchido se `alcance = individual` |
| `status` | enum `status_comunicado` | `processando` \| `concluido` |
| `total_destinatarios` | integer not null default 0 | |
| `total_enviados` | integer not null default 0 | atualizado pelo processador |
| `total_falhas` | integer not null default 0 | atualizado pelo processador |
| `criado_por` | uuid null FK → perfis (ON DELETE SET NULL) | |
| `created_at` | timestamptz default now() | |
| `concluido_em` | timestamptz null | |

Enums novos: `alcance_comunicado = ('geral', 'individual')`,
`status_comunicado = ('processando', 'concluido')`.

### Registro de destinatário

Não há tabela própria de destinatário. Cada envio individual é uma linha em
`mensagens_whatsapp` (Frente 3), vinculada via `referencia_tipo = 'comunicado'` e
`referencia_id = comunicados.id`. Os contadores em `comunicados` são derivados desses logs.

### Bucket de Storage

Novo bucket `comunicados` (privado). Imagens dos comunicados ficam em
`{comunicado_id}/{nome-arquivo}`.

## Arquitetura

### Extensão da camada WhatsApp (Frente 3)

**`src/lib/whatsapp/evolution.ts`** — nova função:
- `sendWhatsAppMedia({ telefone, mensagem, imagemUrl }): Promise<EvolutionResult>`
- POST para `${url}/message/sendMedia/${instance}`, body com `number`, `mediatype: "image"`,
  `media: imagemUrl`, `caption: mensagem`.

**`src/lib/whatsapp/send.ts`** — `enviarWhatsApp` ganha parâmetro opcional `imagemUrl`:
- Se `imagemUrl` presente → chama `sendWhatsAppMedia`, grava `imagem_url` no log.
- Se ausente → chama `sendWhatsApp` (texto puro), como hoje.

### Comunicados

**`src/lib/data/comunicados.ts`** — data layer:
- `listComunicados(escolaId)` — lista para a página principal.
- `getComunicado(id, escolaId)` — cabeçalho de um comunicado.
- `getDestinatarios(comunicadoId)` — linhas de `mensagens_whatsapp` desse comunicado.

**`src/lib/comunicados/destinatarios.ts`** — lógica pura/dados de resolução:
- `resolverDestinatarios(supabase, escolaId, alcance, alunoId?)` — retorna a lista de
  `{ alunoId, telefone }` dos responsáveis financeiros com celular válido.
- `geral` → todos os alunos com matrícula ativa; `individual` → só o aluno informado.

**`src/lib/actions/comunicados.ts`** — server action:
- `criarComunicadoAction(formData)` — `requirePermission("comunicados", "create")`;
  faz upload da imagem (se houver) para o bucket `comunicados`; insere `comunicados`
  (`status: processando`); resolve destinatários; insere N linhas `pendente` em
  `mensagens_whatsapp`; grava `total_destinatarios`; `revalidatePath`.

**`src/lib/comunicados/processar.ts`** — processador:
- `processarLote(): Promise<{ processadas: number }>` — pega até 30 mensagens
  `pendente` com `referencia_tipo = 'comunicado'`, envia cada uma via `enviarWhatsApp`,
  atualiza contadores do comunicado pai; marca comunicado `concluido` quando não há mais
  `pendente` dele.

**`src/app/api/comunicados/processar/route.ts`** — rota do cron:
- `GET` protegido por header/token `CRON_SECRET` (env). Chama `processarLote`.
- Retorna 401 se o token não bater.

**`vercel.json`** — adicionar bloco `crons` apontando para
`/api/comunicados/processar`, schedule `* * * * *` (a cada minuto).

### UI

**Rota `/comunicados`:**
- **Página principal** — lista de comunicados (título, alcance, data, contador
  `enviados/destinatários`, badge `processando`/`concluído`). Botão "Novo comunicado".
- **Novo comunicado** (`/comunicados/novo`) — form: título, mensagem (textarea), imagem
  (upload opcional), alcance (`geral`/`individual`); se `individual`, seletor de aluno.
- **Detalhe** (`/comunicados/[id]`) — cabeçalho + lista de destinatários com status
  individual (`pendente`/`enviada`/`falha`) lidos de `mensagens_whatsapp`.

## RBAC

Módulo novo `comunicados`, grupo `rh`. Seed no DB (`modulos` + `role_permissoes`):
admin full; demais roles sem acesso (apenas admin gerencia comunicados — consistente
com o grupo `rh`, que hoje só admin acessa). Registro em `MODULOS` e `ROTA_PARA_MODULO`
no código (`src/lib/auth/permissions.ts`).

## Variáveis de ambiente

- `CRON_SECRET` — token que protege a rota do cron. Adicionar ao `.env.local` e à Vercel.

## Migração

- coluna `mensagens_whatsapp.imagem_url`
- enums `alcance_comunicado`, `status_comunicado`
- tabela `comunicados` + RLS por escola
- bucket de Storage `comunicados` + policies (padrão dos buckets existentes)
- seed RBAC do módulo `comunicados`

## Testes

Unit (Vitest):
- `resolverDestinatarios` — caso `geral` (só responsáveis financeiros, só alunos ativos,
  só com celular válido), caso `individual`, aluno sem responsável financeiro → vazio.
- Seleção de lote do processador — respeita o limite de 30, filtra por
  `referencia_tipo = 'comunicado'` e `status = 'pendente'`.

Validação manual: criar um comunicado de teste, ver o cron processar, confirmar status.

## Fora de escopo

- Lembretes de inadimplência (Frente 4 — segunda parte, spec separado).
- Filtro de destinatários por turma/série.
- Agendamento de comunicado para data futura.
- Recebimento de respostas dos pais.
- Retry automático de mensagens com falha (admin pode recriar o comunicado).
- Vídeo/áudio/PDF — apenas imagem nesta frente.
