# Camada de Mensageria WhatsApp — Design

**Data:** 2026-05-21
**Frente:** MVP2 — Frente 3 (ver `2026-05-20-mvp2-roadmap.md`)

## Objetivo

Construir a camada base de envio de mensagens WhatsApp. É infra: sozinha não tem
feature visível ao usuário final — serve de fundação para a Frente 4 (lembretes de
inadimplência e comunicação com pais), que será quem consome esta camada.

## Contexto

- Já existe `src/lib/email/resend.ts` — padrão de provider opcional via env, `server-only`,
  retorno `{ ok: true } | { ok: false; reason }`. Esta camada espelha esse padrão.
- Provedor escolhido: **Evolution API** (open-source, self-hosted pelo usuário).
- Config do provedor: variáveis de ambiente.

## Decisões de escopo

- **Escopo:** apenas envio + log. Sem recebimento de mensagens, sem sistema de templates.
- **Provedor:** Evolution API. Config via env (`EVOLUTION_API_URL`, `EVOLUTION_API_KEY`,
  `EVOLUTION_INSTANCE`).
- **Log antes e depois:** insere registro `pendente` antes de chamar a API, atualiza para
  `enviada`/`falha` após. Garante rastro mesmo se a chamada travar.
- **Sem UI nesta frente.** Sem módulo RBAC — será criado na Frente 4, junto da tela de
  histórico/comunicados.

## Modelo de dados

### Tabela `mensagens_whatsapp`

Log de cada envio.

| Coluna | Tipo | Notas |
|--------|------|-------|
| `id` | uuid PK | |
| `escola_id` | uuid FK → escolas (ON DELETE CASCADE) | |
| `telefone` | text | destino normalizado E.164 (ex: `5562999999999`) |
| `mensagem` | text | corpo enviado |
| `status` | enum `status_mensagem_whatsapp` | `pendente` \| `enviada` \| `falha` |
| `erro` | text null | motivo da falha, quando `status = falha` |
| `provider_message_id` | text null | ID retornado pela Evolution API |
| `aluno_id` | uuid null FK → alunos (ON DELETE SET NULL) | referência opcional |
| `referencia_tipo` | text null | ex: `cobranca`, `comunicado` — preenchido pela Frente 4 |
| `referencia_id` | uuid null | ID do objeto referenciado |
| `created_at` | timestamptz default now() | quando o registro foi inserido (pendente) |
| `enviada_em` | timestamptz null | quando virou `enviada` ou `falha` |

Novo enum: `status_mensagem_whatsapp` = `('pendente', 'enviada', 'falha')`.

RLS por escola, padrão `current_perfil()` (igual às demais tabelas). Índices em
`escola_id`, `status`, `aluno_id`.

## Arquitetura

Três camadas, do mais baixo ao mais alto nível.

### 1. Normalização de telefone — `src/lib/whatsapp/telefone.ts`

Função pura, sem I/O, testável:

- `normalizarTelefone(raw: string): string | null`
- Remove caracteres não-dígitos.
- Trata: número com ou sem DDI `55`; com ou sem o 9º dígito do celular.
- Retorna formato E.164 sem `+` (`5562999999999`) ou `null` se inválido (menos de
  10 dígitos após DDD, DDD inexistente, etc).
- Regras:
  - 11 dígitos (DDD + 9 + 8) → prefixa `55`
  - 10 dígitos (DDD + 8, fixo ou celular antigo) → prefixa `55`
  - 12 ou 13 dígitos começando com `55` → mantém
  - Qualquer outro tamanho → `null`

### 2. Cliente Evolution API — `src/lib/whatsapp/evolution.ts`

`server-only`. Cliente de baixo nível do provedor.

- `sendWhatsApp({ telefone, mensagem }): Promise<EvolutionResult>`
- Lê `EVOLUTION_API_URL`, `EVOLUTION_API_KEY`, `EVOLUTION_INSTANCE` do `process.env`.
- Se algum env faltar → retorna `{ ok: false, reason: "Evolution API não configurada" }`
  (não lança — degrada graciosamente, igual ao `resend.ts`).
- POST para `${EVOLUTION_API_URL}/message/sendText/${EVOLUTION_INSTANCE}`, header
  `apikey: ${EVOLUTION_API_KEY}`, body JSON `{ number: telefone, text: mensagem }`.
- Timeout `AbortSignal.timeout(10000)`.
- Retorno: `{ ok: true; providerMessageId: string } | { ok: false; reason: string }`.

### 3. Envio de alto nível — `src/lib/whatsapp/send.ts`

`server-only`. É a função que a Frente 4 vai chamar.

- `enviarWhatsApp(params): Promise<EnvioResult>` onde `params`:
  - `telefone: string` (cru, será normalizado)
  - `mensagem: string`
  - `alunoId?: string`
  - `referenciaTipo?: string`
  - `referenciaId?: string`
- Fluxo:
  1. Normaliza o telefone. Se `null` → grava log direto com `status: falha`,
     `erro: "Telefone inválido"`, retorna falha (não chama a API).
  2. Insere log com `status: pendente`.
  3. Chama `sendWhatsApp`.
  4. Atualiza o mesmo registro: `enviada` (com `provider_message_id`, `enviada_em`) ou
     `falha` (com `erro`, `enviada_em`).
- Retorno: `{ ok: true; mensagemId: string } | { ok: false; reason: string }`.

## Variáveis de ambiente

Adicionar ao `.env.local` (valores preenchidos pelo usuário) e documentar:

```
EVOLUTION_API_URL=https://...
EVOLUTION_API_KEY=...
EVOLUTION_INSTANCE=...
```

## Testes

Unit (Vitest, já configurado no projeto) em `telefone.ts`:
- celular 11 dígitos sem DDI → `55` + número
- número já com `55` (13 dígitos) → mantém
- fixo 10 dígitos → `55` + número
- string com máscara (`(62) 99999-9999`) → normaliza
- número curto / inválido → `null`
- string vazia → `null`

O cliente Evolution e o `send.ts` dependem de I/O externo — validação manual
(enviar uma mensagem de teste com env configurado).

## Fora de escopo

- Recebimento de mensagens / webhook de entrada do provedor.
- Sistema de templates de mensagem.
- Tela de histórico / UI (vem na Frente 4).
- Módulo RBAC `whatsapp` (criado na Frente 4 junto da tela).
- Retry automático de mensagens com falha.
- Suporte a mídia (imagem, PDF) — só texto nesta frente.
