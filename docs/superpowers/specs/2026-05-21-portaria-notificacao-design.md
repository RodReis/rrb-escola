# Notificação de Portaria — Design

**Data:** 2026-05-21
**Contexto:** Sub-projeto B da expansão do WhatsApp (ver `2026-05-21-migracao-meta-cloud-api-design.md`).

## Objetivo

Avisar o responsável via WhatsApp quando o aluno entra ou sai da escola, com a foto
capturada na portaria no momento da passagem. Notificação em tempo real (síncrona).

## Contexto

- A portaria já tem o fluxo: `POST /api/portaria/evento` → `registerGateEvent` (grava
  `eventos_acesso`, marca frequência na entrada, e — hoje — notifica via webhook genérico).
- A notificação atual usa `WHATSAPP_WEBHOOK_URL` + tabela `notificacoes_responsavel` +
  `sendGuardianNotification`. Será substituída.
- `preferencias_notificacao_aluno` controla quem recebe (`notificar_entrada`,
  `notificar_saida`, responsável, telefone de destino). Mantida.
- A camada Meta Cloud API (`src/lib/whatsapp/`) já existe: `enviarWhatsApp` envia template
  (com header de imagem opcional via `imagemUrl`) e loga em `mensagens_whatsapp`.
- `notificacoes_responsavel` está vazia em produção (0 linhas) — drop é seguro.

## Decisões de escopo

- **Foto:** capturada na portaria no momento da passagem (não a foto cadastral).
- **Entrega da foto:** o `POST /api/portaria/evento` recebe a imagem em base64; o servidor
  decodifica, sobe no Supabase Storage e gera URL assinada.
- **Sempre notifica:** com foto quando a captura veio; sem foto (fallback) quando não veio.
- **Dois templates Meta:** `portaria_acesso_foto` (header de imagem) e
  `portaria_acesso_texto` (sem header) — a Meta não permite imagem opcional num único
  template. O código escolhe conforme a foto.
- **Envio síncrono:** o WhatsApp é enviado dentro do `POST /api/portaria/evento`. Tempo
  real — o responsável recebe em segundos.
- **Unificação:** o log de notificações de portaria passa a usar `mensagens_whatsapp`
  (`referencia_tipo = "portaria"`). A tabela `notificacoes_responsavel` e
  `sendGuardianNotification` são removidos.

## Templates Meta (pré-requisito externo)

Dois templates, categoria "Utility", idioma `pt_BR`, a aprovar no Meta Business Manager:

1. **`portaria_acesso_foto`** — header de imagem + corpo com 3 variáveis:
   `{{1}} {{2}} na escola às {{3}}.` — `{{1}}` nome do aluno, `{{2}}` "entrou"/"saiu",
   `{{3}}` horário.
2. **`portaria_acesso_texto`** — só corpo, mesmas 3 variáveis, sem header de imagem.

## Modelo de dados

### Bucket de Storage `portaria-eventos`

Novo bucket privado. As fotos capturadas ficam em
`{aluno_id}/{evento_id}-{timestamp}.jpg`.

### `mensagens_whatsapp`

Sem mudança de schema. Notificações de portaria gravam linhas com
`referencia_tipo = "portaria"` e `referencia_id = eventos_acesso.id`. A coluna `imagem_url`
(já existente) guarda a URL assinada da foto.

### Remoção: `notificacoes_responsavel`

A tabela é dropada na migração (está vazia). `preferencias_notificacao_aluno` permanece.

## Arquitetura

### API — `src/app/api/portaria/evento/route.ts`

O payload `GateEventPayload` ganha um campo opcional:
- `foto_base64?: string` — a imagem JPEG/PNG capturada, em base64.

Fluxo da rota:
1. Autentica (`isGateRequestAuthorized` — `GATE_API_TOKEN`).
2. Valida o payload (igual hoje).
3. Se `foto_base64` presente: decodifica, valida tamanho (limite 2MB) e tipo; sobe no
   bucket `portaria-eventos`; gera URL assinada (validade 1h — o envio é síncrono em
   seguida). Em caso de falha no upload, segue sem foto (não bloqueia o evento).
4. Chama `registerGateEvent` passando a URL da foto (ou `null`).

### `registerGateEvent` — `src/lib/server/gate-events.ts`

Recebe um novo parâmetro `fotoUrl: string | null`. O trecho de notificação é reescrito:

- Remove o uso de `notificacoes_responsavel` e `sendGuardianNotification`.
- Após gravar `eventos_acesso` (e marcar frequência na entrada — inalterado), checa
  `preferencias_notificacao_aluno` (`notificar_entrada`/`notificar_saida`, `ativo`).
- Se deve notificar, resolve o telefone (`telefone_destino` ou celular/telefone do
  responsável).
- Decide o template:
  - `fotoUrl` presente → `templateName = META_TEMPLATE_PORTARIA_FOTO`,
    `imagemUrl = fotoUrl`.
  - `fotoUrl` ausente → `templateName = META_TEMPLATE_PORTARIA_TEXTO`, sem `imagemUrl`.
- Monta as variáveis: `[nomeAluno, verbo, horario]` — `verbo` = "entrou"/"saiu",
  `horario` formatado em `America/Sao_Paulo`.
- Chama `enviarWhatsApp` com `referenciaTipo: "portaria"`,
  `referenciaId: eventos_acesso.id`, `textoLog` legível, passando o admin client
  (`registerGateEvent` já usa `createAdminClient`).

### Função pura — `src/lib/portaria/notificacao.ts`

Extraída para teste:
- `montarNotificacaoPortaria({ nomeAluno, tipo, dataEvento, fotoUrl }, templates)` —
  retorna `{ templateName, variaveis, imagemUrl }`. Decide o template pela presença da
  foto e monta as variáveis (verbo, horário). `templates` = `{ comFoto, semFoto }`.

### Tela `/portaria/notificacoes`

`getGateNotifications` (`src/lib/data/gate.ts`) passa a ler `mensagens_whatsapp` filtrado
por `referencia_tipo = "portaria"` em vez de `notificacoes_responsavel`. Os status
mudam para os de `mensagens_whatsapp` (`pendente`/`enviada`/`falha`) — o filtro de status
e os tons da tela são ajustados (some `simulada`/`erro`, entra `falha`).

`retryGuardianNotificationAction` — sem a tabela antiga, o reenvio manual de uma
notificação de portaria fica **fora de escopo** desta frente (a notificação é síncrona;
falhas ficam registradas em `mensagens_whatsapp`). A ação de retry é removida; o botão
de retry sai da tela.

### Remoções

- `src/lib/server/guardian-notifications.ts` — apagado.
- Tabela `notificacoes_responsavel` — dropada na migração.
- `retryGuardianNotificationAction` em `src/lib/actions/gate.ts` — removida.
- Env `WHATSAPP_WEBHOOK_URL`, `WHATSAPP_WEBHOOK_TOKEN` — removidas.

## Variáveis de ambiente

**Adicionar:**
```
META_TEMPLATE_PORTARIA_FOTO=portaria_acesso_foto
META_TEMPLATE_PORTARIA_TEXTO=portaria_acesso_texto
```

**Remover:** `WHATSAPP_WEBHOOK_URL`, `WHATSAPP_WEBHOOK_TOKEN`.

Reusa `META_WHATSAPP_TOKEN`, `META_PHONE_NUMBER_ID` (da migração Meta).

## Migração de banco

- Criar bucket `portaria-eventos` (privado) + policies (padrão dos buckets existentes).
- Dropar a tabela `notificacoes_responsavel`.

## Testes

Unit (Vitest):
- `montarNotificacaoPortaria` — com foto → template foto + `imagemUrl`; sem foto →
  template texto sem `imagemUrl`; verbo correto para entrada/saída; horário formatado.

A rota da portaria e `registerGateEvent` (I/O, upload) são validados manualmente.

## Fora de escopo

- Reenvio manual de notificação de portaria (a notificação é síncrona; sem retry).
- Filtro de comunicados por turma (Sub-projeto C).
- Cooldown de evento — a lógica atual (`gateCooldownSeconds`, dedup de evento recente)
  é preservada como está.
- Notificação por outros canais (email, SMS) — apenas WhatsApp.
