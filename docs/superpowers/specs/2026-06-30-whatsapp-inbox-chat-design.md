# WhatsApp Inbox — Chat Bidirecional (Fase 6) — Design

- **Data:** 2026-06-30
- **Status:** aprovado para implementação
- **Contexto:** Fase 6 da expansão WhatsApp. Fecha a lacuna de *inbound* deixada como
  "fora de escopo" em três specs já implementadas:
  - `2026-05-21-migracao-meta-cloud-api-design.md` (Meta Provider — ✅ implementado)
  - `2026-05-21-portaria-notificacao-design.md` (✅ implementado)
  - `2026-06-21-pipeline-mvp3-design.md` §9 e `pipeline-README` ("WhatsApp inbound: chat
    bidirecional" — candidato a Fase 6).

## 1. Objetivo

Receber mensagens que os responsáveis enviam ao número WhatsApp da escola e permitir que a
equipe responda por uma **caixa de conversas (inbox)** dedicada, estilo WhatsApp Web. Hoje o
sistema só faz *outbound* (portaria, lembretes, comunicados, card do pipeline); a resposta do
responsável não chega a lugar nenhum. Esta fase adiciona o *inbound* e a conversa bidirecional.

## 2. Decisões firmadas

1. **Inbox dedicado** — tela própria `/whatsapp`, independente do contexto que originou o
   contato (lista de conversas à esquerda, thread à direita).
2. **Vínculo duplo** — cada conversa tenta casar o telefone com um **lead** (`pipeline_lead`)
   **e** com um **responsável de aluno matriculado** (`responsaveis_aluno` → `alunos`). Sem
   vínculo, a conversa vale assim mesmo (só telefone + nome do WhatsApp).
3. **Janela de 24h** — a Meta só permite texto livre dentro de 24h após a última mensagem do
   cliente. A UI exibe o status (aberta/fechada) e, quando fechada, **bloqueia texto livre** e
   oferece só o envio de **template aprovado** (reusa `pipeline_template_whatsapp`).
4. **Realtime + não lidas** — Supabase Realtime empurra mensagens novas para o inbox aberto;
   contador de não lidas por conversa, zerado ao abrir.
5. **RBAC próprio + atribuição** — módulo novo `whatsapp_inbox`; cada conversa pode ter
   `assigned_to` (atendente), com filtro "Minhas". Sem lock de edição simultânea (equipe pequena).
6. **Tabelas novas** — `pipeline_conversa` + `pipeline_conversa_mensagem`. `mensagens_whatsapp`
   **não muda**: outbound de portaria/lembrete/comunicado/card segue exatamente como hoje.
7. **Anexo de imagem** — recebimento e envio de imagem (texto + imagem no MVP). Áudio, vídeo e
   documento ficam fora.

## 3. Arquitetura

### Fluxo INBOUND (responsável → escola)

1. Responsável envia WhatsApp ao número da escola.
2. Meta Cloud API faz `POST` no webhook.
3. `POST /api/whatsapp/webhook`:
   - valida assinatura `X-Hub-Signature-256` (HMAC SHA-256 com `META_APP_SECRET`); inválida → 401;
   - responde **200 rápido** (exigência da Meta) e processa;
   - dedup por `provider_message_id` (a Meta reenvia) — `ON CONFLICT DO NOTHING`;
   - normaliza telefone (`src/lib/whatsapp/telefone.ts`, existente);
   - casa lead/aluno-responsável;
   - upsert `pipeline_conversa` (renova `janela_expira_em = now() + 24h`, `nao_lidas + 1`,
     atualiza `ultima_msg_em`/`ultima_msg_preview`);
   - insert `pipeline_conversa_mensagem` direção `entrada`;
   - usa **admin client** (sem sessão de usuário, igual ao webhook do Asaas).
4. Supabase Realtime empurra para o inbox aberto.
5. `/whatsapp` — a conversa sobe ao topo, badge de não lida aparece.

### Fluxo OUTBOUND (atendente → responsável)

1. Atendente responde no inbox.
2. Decisão pela janela:
   - **aberta** → `sendText` (texto livre — já existe em `meta.ts`) ou `sendImage` (novo);
   - **fechada** → caixa de texto bloqueada; só `sendTemplate` (templates já cadastrados).
3. insert `pipeline_conversa_mensagem` direção `saida` com `status`.
4. Outbound de portaria/lembrete/comunicado/card **não muda** (segue em `mensagens_whatsapp`).

### Reuso

`meta.ts` (sendText/sendTemplate), padrão de webhook do Asaas (`src/app/api/asaas/webhook`),
Realtime do pipeline, `current_perfil()` (RLS multi-tenant), `pipeline_template_whatsapp`,
`telefone.ts`.

## 4. Modelo de dados

Padrão `pipeline_*`: RLS por `escola_id` via `current_perfil()`, política de service_role para
o webhook (admin client), grants para `authenticated`.

### `pipeline_conversa` (nova)

| Coluna | Tipo | Nota |
|---|---|---|
| `id` | uuid PK | |
| `escola_id` | uuid not null FK escolas (cascade) | RLS |
| `telefone` | text not null | E.164 normalizado; único por escola |
| `nome_whatsapp` | text null | nome do perfil WhatsApp (vem no webhook) |
| `lead_id` | uuid null FK pipeline_lead (set null) | vínculo casado por telefone |
| `aluno_id` | uuid null FK alunos (set null) | vínculo casado por telefone |
| `responsavel_id` | uuid null FK responsaveis_aluno (set null) | qual responsável casou |
| `assigned_to` | uuid null FK perfis (set null) | atendente dono |
| `status` | text not null default 'aberta' | `aberta` \| `arquivada` |
| `nao_lidas` | int not null default 0 | zerado ao abrir |
| `janela_expira_em` | timestamptz null | última msg do cliente + 24h |
| `ultima_msg_em` | timestamptz not null default now() | ordenação do inbox |
| `ultima_msg_preview` | text null | prévia na lista |
| `created_at` | timestamptz not null default now() | |

Índices: único `(escola_id, telefone)`; `(escola_id, status, ultima_msg_em desc)`;
`(escola_id, assigned_to)`.

### `pipeline_conversa_mensagem` (nova)

| Coluna | Tipo | Nota |
|---|---|---|
| `id` | uuid PK | |
| `escola_id` | uuid not null FK escolas (cascade) | RLS |
| `conversa_id` | uuid not null FK pipeline_conversa (cascade) | |
| `direcao` | text not null | `entrada` \| `saida` |
| `tipo` | text not null default 'texto' | `texto` \| `imagem` \| `template` |
| `texto` | text null | corpo (ou legenda da imagem) |
| `midia_url` | text null | URL assinada da imagem (bucket privado) |
| `status` | text null | só saída: `enviada` \| `falha` |
| `erro` | text null | motivo da falha (Meta) |
| `provider_message_id` | text null | id Meta; único (idempotência do webhook) |
| `enviada_por` | uuid null FK perfis (set null) | atendente (saída) |
| `created_at` | timestamptz not null default now() | |

Índices: `(conversa_id, created_at)`; único parcial em `provider_message_id` (where not null).

**Notas de modelagem:**
- Prefixo `pipeline_` mantém coerência (o chat nasce do contexto de captação/relacionamento),
  mas a conversa serve lead **e** aluno matriculado.
- Vínculo é *snapshot* no recebimento. Telefone que não casa fica só com telefone + nome.
- `janela_expira_em` no passado (ou null) = janela fechada → UI bloqueia texto livre.

## 5. Webhook — `src/app/api/whatsapp/webhook/route.ts` (novo)

- **`GET`** — verificação inicial da Meta: confere `hub.verify_token === META_VERIFY_TOKEN` e
  devolve `hub.challenge` em texto puro. Configurado uma vez ao plugar o número.
- **`POST`** — recebe eventos:
  1. lê o corpo *raw* e valida `X-Hub-Signature-256` (HMAC SHA-256 com `META_APP_SECRET`);
  2. responde 200 imediatamente; processa o restante;
  3. ignora eventos de status (`delivered`/`read`/`sent`) — só processa `messages`;
  4. dedup por `provider_message_id`;
  5. upsert conversa + insert mensagem de entrada (ver §3).

## 6. Anexo de imagem

- **Recebida:** o evento de imagem traz `media_id`. Baixa via Graph API
  (`GET /{media_id}` → URL temporária → fetch dos bytes), sobe no bucket **`whatsapp-inbox`**
  (privado, novo), gera URL assinada, grava `tipo='imagem'` + `midia_url`. Limite 5MB. Se o
  download falhar, grava a mensagem como texto `"[imagem não recebida]"` (não perde o evento).
- **Enviada:** o atendente anexa imagem no inbox → upload no mesmo bucket → `meta.ts` ganha
  **`sendImage({ telefone, imagemUrl, legenda? })`** (novo, espelha `sendText`, payload Meta
  `type: "image"`, `image: { link, caption? }`). Permitido só dentro da janela de 24h, igual texto.

## 7. RBAC + atribuição

- Módulo novo `whatsapp_inbox` (read/write) em `role_permissoes`. Roles iniciais com acesso:
  `admin`, `coordenacao` (atendimento).
- Atribuição: `assigned_to` na conversa; action `atribuirConversaAction`. Filtro "Minhas" =
  `assigned_to = perfil atual`. Atribuir é livre (sem lock).
- **Menu hardcoded:** o link `/whatsapp` precisa ser adicionado manualmente ao array do
  `src/components/layout/topbar.tsx` — o RBAC apenas filtra; não cria o link. (Ver memória
  `project_menu_hardcoded`.)

## 8. Server actions — `src/lib/actions/whatsapp-inbox.ts` (novo)

Todas validam o módulo `whatsapp_inbox` + escola via helper de sessão; retornam `ActionResult<T>`.

- `getConversas(filtro)` — `filtro`: todas | minhas | não lidas; ordena por `ultima_msg_em desc`.
- `getMensagens(conversaId)` — lista a thread e **zera `nao_lidas`**.
- `responderTextoAction(conversaId, texto)` — exige janela aberta.
- `responderImagemAction(conversaId, imagemFile, legenda?)` — exige janela aberta.
- `responderTemplateAction(conversaId, templateId, variaveis)` — para janela fechada; reusa
  `pipeline_template_whatsapp` + `sendTemplate`.
- `atribuirConversaAction(conversaId, perfilId | null)`.
- `arquivarConversaAction(conversaId)`.

## 9. UI — `/whatsapp`

Layout WhatsApp-Web (tokens do Design System, sem serifa, paridade claro/escuro):

- **Lista (esquerda):** busca, filtros (Todas / Minhas / Não lidas), por conversa: nome ou
  telefone, prévia, hora, badge de não lidas, **chip de vínculo** (🎓 Lead · Captação,
  👤 Resp. · {aluno/turma}, ❓ Sem vínculo).
- **Thread (direita):** cabeçalho com vínculo clicável (→ card do pipeline / ficha do aluno),
  **badge da janela** (● aberta · tempo restante / ○ fechada), "Atribuir". Balões entrada
  (esquerda) / saída (direita) com hora e status. Imagens renderizadas inline.
- **Caixa de envio:** texto + botão de anexo de imagem quando a janela está aberta; quando
  fechada, bloco "texto livre bloqueado" com botão "Enviar template".

## 10. Realtime

Subscribe em `pipeline_conversa` e `pipeline_conversa_mensagem` filtrado por `escola_id`
(padrão do board do pipeline). Conversa sobe ao topo, badge de não lidas atualiza, thread
aberta recebe o balão novo em tempo real.

## 11. Variáveis de ambiente (novas)

```
META_VERIFY_TOKEN=      # string definida por você, casada no painel da Meta
META_APP_SECRET=        # secret do app Meta; valida a assinatura do webhook
```

Reusa `META_WHATSAPP_TOKEN` e `META_PHONE_NUMBER_ID` (já configuradas).

## 12. Pré-requisitos externos (no painel da Meta)

- Configurar a URL do webhook (`https://<dominio>/api/whatsapp/webhook`) e o `verify_token`.
- Assinar o campo `messages` do webhook.
- O número já está ativo (usado pelo outbound).

## 13. Testes (Vitest — funções puras)

- `validarAssinaturaWebhook(rawBody, signature, secret)` — válida / inválida.
- `parsearEventoWebhook(payload)` — extrai telefone/texto/media_id/nome; ignora eventos de
  status; lida com payload de imagem.
- `casarConversa(telefone, leads, responsaveis)` — casa lead; casa responsável; sem vínculo.
- `janelaAberta(janelaExpiraEm, agora)` — aberta / fechada / null.

Webhook real, download de mídia via Graph API e as server actions (I/O) → validação manual com
token e número configurados.

## 14. Migração de banco

`supabase/migrations/<timestamp>_whatsapp_inbox.sql`:
- cria `pipeline_conversa` + `pipeline_conversa_mensagem` (com RLS, políticas, índices, grants);
- registra o módulo `whatsapp_inbox` em `role_permissoes` para `admin` e `coordenacao`.

Passo manual pós-deploy: criar o bucket **`whatsapp-inbox`** (privado) no Supabase Storage.

## 15. Fora de escopo (Fase 7+)

- **Criação automática** de card no pipeline a partir de conversa sem vínculo. (No MVP: botão
  manual "criar lead" a partir da conversa — opcional; pode ficar para a Fase 7.)
- Áudio, vídeo e documento (só imagem + texto agora).
- Respostas rápidas / canned replies.
- Chatbot / automação de atendimento.
- Multi-número / múltiplas linhas WhatsApp.
- Lock / aviso de edição simultânea de conversa.

## 16. Critérios de aceite

1. Mensagem recebida da Meta cria/atualiza `pipeline_conversa` e insere
   `pipeline_conversa_mensagem` (`direcao='entrada'`), com dedup por `provider_message_id`.
2. Assinatura inválida no webhook → 401, sem gravar nada.
3. Telefone casa com lead e/ou responsável; sem vínculo, a conversa existe só com telefone+nome.
4. Janela aberta: atendente envia texto livre e imagem. Janela fechada: texto bloqueado, só
   template; envio reabre a janela ao chegar resposta do cliente.
5. Imagem recebida é baixada, salva no bucket e renderizada na thread; falha de download grava
   placeholder sem perder a mensagem.
6. Contador de não lidas incrementa no recebimento e zera ao abrir a conversa.
7. Realtime atualiza lista e thread sem refresh manual.
8. Só quem tem `whatsapp_inbox:read` vê o inbox; atribuição e filtro "Minhas" funcionam.
9. `npm run typecheck` + `npm run build` verdes; `npm run test` cobre as funções puras de §13.
