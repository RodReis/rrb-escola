# Lembretes de Inadimplência — Design

**Data:** 2026-05-21
**Frente:** MVP2 — Frente 4, segunda parte (ver `2026-05-20-mvp2-roadmap.md`)

## Objetivo

Enviar lembretes via WhatsApp ao responsável financeiro quando uma cobrança vence e
continua em aberto. Reduz inadimplência com aviso automático, sem trabalho manual.

## Contexto

- Camada de mensageria WhatsApp (Frente 3) já existe: `enviarWhatsApp` + log em
  `mensagens_whatsapp`, com `referencia_tipo`/`referencia_id` genéricos.
- Frente 4a (Comunicados) estabeleceu o padrão de cron processador + rota protegida por
  `CRON_SECRET` + `vercel.json` com `crons`.
- `cobrancas` tem `status` (enum `status_cobranca`: `aberta`, `parcial`, `paga`,
  `vencida`, `cancelada`), `data_vencimento`, `valor_final`, `descricao`, `aluno_id`.
- `responsaveis_aluno` tem `celular`, `nome`, `responsavel_financeiro`.
- `escolas` já guarda configs (`webhook_url`, etc).

## Decisões de escopo

- **Gatilho:** apenas após o vencimento (cobrança atrasada). Sem lembrete preventivo.
- **Disparo:** híbrido — cron diário automático + botão manual. Uma flag de configuração
  liga/desliga o envio automático.
- **Frequência:** uma vez por cobrança. O lembrete automático nunca repete para a mesma
  cobrança. O botão manual pode forçar reenvio.
- **Mensagem:** template editável em Configurações, com placeholders.
- **Destinatário:** responsável financeiro do aluno (campo `responsavel_financeiro`).
- **RBAC:** reusa o módulo `financeiro.cobrancas` — sem módulo novo.

## Modelo de dados

### Extensão de `escolas`

Duas colunas novas:

| Coluna | Tipo | Notas |
|--------|------|-------|
| `lembrete_auto_ativo` | boolean not null default false | liga/desliga o cron diário |
| `lembrete_template` | text | texto do lembrete; default de fábrica na migração |

Template default de fábrica:

```
Olá {responsavel}, a mensalidade de {aluno} ({descricao}) no valor de {valor}, vencida em {vencimento}, está em aberto há {dias_atraso} dia(s). Por favor, regularize. Em caso de dúvida, entre em contato.
```

Placeholders suportados: `{responsavel}`, `{aluno}`, `{descricao}`, `{valor}`,
`{vencimento}`, `{dias_atraso}`.

### Registro de lembrete

Sem tabela nova. Cada lembrete enviado é uma linha em `mensagens_whatsapp` (Frente 3),
com `referencia_tipo = 'lembrete_cobranca'` e `referencia_id = cobranca.id`.

### Detecção de cobrança elegível

Uma cobrança merece lembrete automático quando:
1. `data_vencimento < hoje` (vencida), **E**
2. `status` ∈ (`aberta`, `parcial`, `vencida`) — exclui `paga` e `cancelada`, **E**
3. não existe linha em `mensagens_whatsapp` com `referencia_tipo = 'lembrete_cobranca'`
   e `referencia_id` igual ao id da cobrança.

A condição 3 garante "uma vez por cobrança". O botão manual ignora a condição 3 (reenvio
intencional cria nova linha de log).

## Arquitetura

### Lógica — `src/lib/lembretes/`

**`montar-mensagem.ts`** — função pura, testável:
- `montarMensagem(template, dados): string` — substitui os placeholders pelos valores.
- `dados`: `{ responsavel, aluno, descricao, valor, vencimento, diasAtraso }`.

**`detectar.ts`** — resolução de cobranças elegíveis:
- `resolverLembretesPendentes(supabase, escolaId, ignorarJaEnviados): Promise<LembretePendente[]>`
- `LembretePendente`: `{ cobrancaId, alunoId, responsavelNome, telefone, descricao, valor, vencimento, diasAtraso }`.
- Busca cobranças vencidas em aberto, junta aluno + responsável financeiro com celular.
- `ignorarJaEnviados = true` (cron) → exclui cobranças que já têm lembrete.
  `false` (botão manual) → inclui todas.
- Parte pura `filtrarElegiveis` separada para teste (recebe linhas cruas, aplica regras).

**`processar.ts`** — orquestra o envio:
- `processarLembretes(opts: { forcarReenvio: boolean }): Promise<ResultadoLembretes>`
- Usa `createAdminClient` (service_role — cron roda sem usuário).
- Resolve pendentes; para cada um, busca o template da escola, monta a mensagem,
  chama `enviarWhatsApp` com `referenciaTipo: "lembrete_cobranca"`,
  `referenciaId: cobrancaId`.
- Lote limitado a 50 por execução.
- `ResultadoLembretes`: `{ processados, enviados, falhas }`.

### Data layer — `src/lib/data/lembretes.ts`

- `getConfigLembretes(escolaId)` — retorna `{ autoAtivo, template }`.
- `contarLembretesPendentes(escolaId)` — quantas cobranças vencidas sem lembrete hoje
  (para o resumo na tela).

### Server actions — `src/lib/actions/lembretes.ts`

- `salvarConfigLembretesAction(formData)` — `requirePermission("financeiro.cobrancas", "update")`;
  grava `lembrete_auto_ativo` e `lembrete_template` em `escolas`.
- `enviarLembretesAgoraAction()` — `requirePermission("financeiro.cobrancas", "update")`;
  chama `processarLembretes({ forcarReenvio: false })` imediatamente (envio manual —
  respeita "uma vez por cobrança", não força reenvio de cobrança já avisada).

### Rota do cron — `src/app/api/lembretes/processar/route.ts`

- `GET` protegido por `CRON_SECRET` (header `Authorization: Bearer`), igual à rota de
  comunicados.
- Lê a config da escola: se `lembrete_auto_ativo` for `false`, retorna sem processar.
- Se `true`, chama `processarLembretes({ forcarReenvio: false })`.

### Cron no `vercel.json`

Adicionar um segundo cron (já existe o de comunicados):
- path `/api/lembretes/processar`, schedule `0 9 * * *` (todo dia às 9h UTC).

### UI — `/configuracoes/lembretes`

Tela própria:
- Toggle `lembrete_auto_ativo` (envio automático ligado/desligado).
- Textarea do `lembrete_template`, com a lista de placeholders disponíveis exibida ao lado.
- Resumo: "X cobranças vencidas sem lembrete" (via `contarLembretesPendentes`).
- Botão "Enviar lembretes agora" (envio manual imediato).
- `requirePermission("financeiro.cobrancas", "read")` na página.

## RBAC

Reusa o módulo existente `financeiro.cobrancas`. Sem módulo novo, sem seed. A tela e as
actions usam `requirePermission("financeiro.cobrancas", "read"/"update")`. O item de menu
para `/configuracoes/lembretes` entra no grupo de Configurações.

## Variáveis de ambiente

Nenhuma nova. Reusa `CRON_SECRET` (já criado na Frente 4a) e as `EVOLUTION_*` (Frente 3).

## Migração

- coluna `escolas.lembrete_auto_ativo` boolean default false
- coluna `escolas.lembrete_template` text com default de fábrica

Sem tabela nova, sem enum novo, sem RBAC novo.

## Testes

Unit (Vitest):
- `montarMensagem` — substitui todos os placeholders; placeholder sem valor; template sem
  placeholders.
- `filtrarElegiveis` — cobrança vencida em aberto entra; cobrança paga/cancelada sai;
  cobrança não vencida sai; cobrança sem responsável financeiro/celular sai; com
  `ignorarJaEnviados`, cobrança já avisada sai.

Validação manual: configurar template, ligar a flag, rodar a rota do cron manualmente,
conferir o envio e o registro em `mensagens_whatsapp`.

## Fora de escopo

- Lembrete preventivo (antes do vencimento).
- Reenvio automático periódico (a cada X dias / marcos D+7, D+15).
- Lembrete por email.
- Tela de histórico de lembretes enviados (o log fica em `mensagens_whatsapp`; uma
  tela dedicada pode vir depois).
- Cálculo de juros/multa na mensagem — usa `valor_final` como está.
