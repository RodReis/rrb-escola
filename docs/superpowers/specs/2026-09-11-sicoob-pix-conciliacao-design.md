# Integração Sicoob — Pix e Conciliação Bancária — Design

**Data:** 2026-09-11
**Status:** rascunho para revisão
**Frente:** Financeiro — evolução do gateway (sucede `2026-05-21-gateway-asaas-design.md`)

## Objetivo

Receber mensalidades por Pix direto na conta Sicoob da escola, dar baixa automática
na `cobranca` via webhook, e conciliar o extrato da conta corrente com o que o sistema
registrou (`pagamentos` e `lancamento_financeiro`).

## Decisões já tomadas (2026-09-11)

- **Dois provedores atrás de uma interface `PaymentProvider`**: Asaas (boleto/fatura,
  já implementado) e Sicoob (Pix + extrato). Nada do Asaas é removido nesta frente.
- **Ordem:** Pix primeiro (Fases 0–2), extrato/conciliação depois (Fase 3).
- **Pré-requisitos:** conta PJ Sicoob e chave Pix já existem. Falta app no portal e
  certificado e-CNPJ A1.

## Contexto do sistema (estado real em 2026-09-11)

- `cobrancas` (status `aberta|parcial|paga|vencida|cancelada`, `valor_final` gerado) e
  `pagamentos` (soft delete via `cancelado_em`). Trigger `pagamentos_recalc_status` →
  `recalc_cobranca_status()` fecha a cobrança sozinho após insert em `pagamentos`.
  **Qualquer provedor só precisa inserir em `pagamentos`.**
- Asaas: colunas `cobrancas.asaas_payment_id / asaas_invoice_url / asaas_status`,
  `responsaveis_aluno.asaas_customer_id`; `src/lib/asaas/{client,webhook}.ts`,
  `src/lib/actions/asaas.ts`, `/api/asaas/webhook`. Nunca ativado em produção
  (`ASAAS_*` ausentes na Vercel — ver `docs/DEPLOY.md`).
- Livro-razão: `lancamento_financeiro` (tipo receita|despesa, `origem_tipo` inclui
  `cobranca`, `forma_pagamento`, `data_pagamento`). É o alvo da conciliação de despesas.
- Cron: `vercel.json` → `POST /api/jobs/dispatch` diário 07:00 UTC. Reusar para o sync
  do extrato.
- Mensageria WhatsApp (Meta Cloud API) já envia lembretes — o QR/copia-e-cola vai por ela.
- RBAC: módulo `financeiro.cobrancas` (`update` para gerar cobrança). Conciliação ganha
  módulo próprio `financeiro.conciliacao`.

## Riscos e premissas que precisam ser verdade

| # | Risco | Mitigação |
|---|-------|-----------|
| R1 | Certificado e-CNPJ A1 expira em 12 meses e derruba a integração inteira | Guardar `SICOOB_CERT_NOT_AFTER` e alertar no dashboard financeiro 30 dias antes; `Fase 1` inclui health-check `/api/sicoob/health` |
| R2 | Documentação Sicoob é incompleta (relatado por todas as libs de terceiros); nomes de campos/URLs mudam entre versões (`conta-corrente/v2` → `v4`, `cobranca-bancaria/v2` → `v3`) | URLs e payloads ficam em um único módulo `src/lib/sicoob/endpoints.ts`; validar no sandbox antes de escrever a UI |
| R3 | Webhook Sicoob reenvia; código atual do Asaas checa status e depois insere (race) | Idempotência por **constraint**: `unique (provedor, end_to_end_id)` em `pagamentos_provedor` |
| R4 | mTLS na Vercel (serverless) | Runtime `nodejs` explícito na rota; `undici.Agent({ connect: { cert, key } })` com PEM vindo de env base64. Testar no preview antes de prod |
| R5 | Webhook Pix do Sicoob é registrado **por chave Pix** e o Sicoob faz POST em `<url>/pix` | Rota `/api/sicoob/webhook/pix`; registrar `https://gestao.epgtrindade.com.br/api/sicoob/webhook` |
| R6 | Sicoob não manda token de autenticação no webhook igual ao Asaas | Validar por (a) mTLS do cliente Sicoob se disponível, senão (b) segredo na URL (`?t=<token>`) **e** re-consulta do `e2eid` na API antes de dar baixa. Nunca confiar só no payload |
| R7 | Portal/escopos exigem aprovação da cooperativa (dias) | Fase 0 começa hoje, em paralelo ao sandbox |

## Modelo de dados

Substitui as colunas `asaas_*` soltas por um modelo genérico. As colunas `asaas_*` são
mantidas e **migradas** (backfill) para o modelo novo; removidas em frente futura.

### `cobrancas_provedor` (uma cobrança pode ter Pix Sicoob e boleto Asaas ao mesmo tempo)

| Coluna | Tipo | Notas |
|--------|------|-------|
| id | uuid pk | |
| escola_id | uuid fk | |
| cobranca_id | uuid fk cobrancas | |
| provedor | enum `provedor_pagamento` (`asaas`,`sicoob`) | |
| tipo | enum (`pix_imediato`,`pix_vencimento`,`boleto`,`fatura`) | |
| id_externo | text | Asaas `payment.id` / Sicoob `txid` |
| status_externo | text | último status reportado |
| url_fatura | text null | Asaas invoiceUrl |
| pix_copia_cola | text null | `pixCopiaECola` |
| pix_location | text null | |
| expira_em | timestamptz null | Pix imediato expira (default 24h → renovar sob demanda) |
| payload | jsonb | resposta bruta (auditoria) |
| criado_em / atualizado_em | timestamptz | |

Índices: `unique (provedor, id_externo)`; `(cobranca_id)`.

### `pagamentos_provedor` (ponte pagamento ↔ evento do provedor; garante idempotência)

| Coluna | Tipo | Notas |
|--------|------|-------|
| pagamento_id | uuid fk pagamentos | |
| provedor | enum | |
| end_to_end_id | text | Pix `endToEndId`; Asaas `payment.id` |
| txid | text null | |
| valor | numeric(12,2) | |
| recebido_em | timestamptz | horário do provedor, não `now()` |
| payload | jsonb | |

`unique (provedor, end_to_end_id)`. A baixa é `insert ... on conflict do nothing`;
se conflitou, o webhook responde 200 e não faz mais nada.

### `extrato_bancario` (Fase 3)

| Coluna | Tipo | Notas |
|--------|------|-------|
| id | uuid pk | |
| escola_id | uuid fk | |
| conta_id | uuid fk `contas_bancarias` | |
| id_transacao | text | id do Sicoob; `unique (conta_id, id_transacao)` |
| data | date | |
| tipo | enum (`credito`,`debito`) | |
| valor | numeric(12,2) | |
| descricao | text | |
| end_to_end_id | text null | extraído da descrição/campo Pix quando houver |
| contraparte_doc | text null | CPF/CNPJ quando o extrato traz |
| status_conciliacao | enum (`pendente`,`auto`,`manual`,`ignorado`) | |
| pagamento_id | uuid null fk | crédito casado com mensalidade |
| lancamento_id | uuid null fk | crédito/débito casado com livro-razão |
| conciliado_por / conciliado_em | | |
| payload | jsonb | |

### `contas_bancarias`

`id, escola_id, banco ('756'), cooperativa, agencia, conta, chave_pix, provedor,
ativo`. Uma escola pode ter mais de uma conta; o cron itera as ativas.

### `webhooks_recebidos` (todos os provedores)

`id, provedor, evento, id_externo, payload jsonb, recebido_em, processado_em,
erro text`. Gravar **antes** de processar; processar depois. Permite reprocessar.

## Arquitetura

```
src/lib/pagamentos/
  provider.ts        # interface PaymentProvider + registry por provedor
  asaas.provider.ts  # adapta src/lib/asaas/* existente
  sicoob.provider.ts
src/lib/sicoob/
  auth.ts            # token OAuth2 client_credentials por escopo, cache em memória
                     # com TTL (expires_in - 60s); mTLS via undici Agent
  http.ts            # fetch com dispatcher mTLS, header client_id, retry 429/5xx
  endpoints.ts       # URLs por ambiente (sandbox|prod) — único lugar com string de URL
  pix.ts             # criarCobImediata(txid, ...), consultarCob, consultarPix(e2eid),
                     # registrarWebhook(chave)
  conta-corrente.ts  # extrato(mes, ano, diaIni, diaFim, conta), saldo
  webhook.ts         # processarWebhookPix(payload) — puro + I/O separados
  txid.ts            # gera txid determinístico a partir de cobranca.id
                     # (26–35 chars [a-zA-Z0-9]) — função pura, testável
src/app/api/sicoob/webhook/pix/route.ts   # runtime = 'nodejs'
src/app/api/sicoob/health/route.ts        # valida cert, token e saldo (admin)
src/lib/conciliacao/
  matcher.ts         # funções puras: casarPorE2E, sugerirPorValorData
  sync-extrato.ts    # chamado pelo /api/jobs/dispatch e pelo botão manual
```

### Interface

```ts
type PaymentProvider = {
  id: "asaas" | "sicoob";
  suporta: Array<"pix_imediato" | "boleto" | "fatura">;
  criarCobranca(input: { cobranca; responsavel; tipo }): Promise<Result<CobrancaProvedor>>;
  consultarCobranca(idExterno: string): Promise<Result<StatusExterno>>;
  cancelarCobranca?(idExterno: string): Promise<Result<void>>;
};
```

### Autenticação Sicoob (a confirmar no portal na Fase 0)

- Produção: `POST https://auth.sicoob.com.br/auth/realms/cooperado/protocol/openid-connect/token`
  com `grant_type=client_credentials&client_id=…&scope=cob.write cob.read pix.read webhook.write`
  sobre mTLS com o e-CNPJ A1. Base da API: `https://api.sicoob.com.br`
  (`/pix/api/v2`, `/conta-corrente/v4`, `/cobranca-bancaria/v3`).
- Sandbox: `https://sandbox.sicoob.com.br/sicoob/sandbox/...`, sem mTLS, com `client_id`
  e Bearer fixo fornecidos no portal. Dados do sandbox são fictícios — serve para
  contrato/payload, não para testar valor real.
- Header `client_id` em toda requisição.

### Variáveis de ambiente

```
SICOOB_ENV=sandbox|production
SICOOB_CLIENT_ID=
SICOOB_SANDBOX_TOKEN=            # só sandbox
SICOOB_CERT_PEM_B64=             # produção: cert público (base64 do PEM)
SICOOB_KEY_PEM_B64=              # produção: chave privada (base64 do PEM)
SICOOB_CERT_NOT_AFTER=2027-09-01 # alerta de expiração
SICOOB_CHAVE_PIX=
SICOOB_CONTA_CORRENTE=           # número da conta para extrato
SICOOB_WEBHOOK_SECRET=           # segredo na URL do webhook
```

Nunca usar `.pfx` em env: converter para PEM local (`openssl pkcs12 -in cert.pfx
-clcerts -nokeys` / `-nocerts -nodes`) e subir só o base64.

## Fases

### Fase 0 — Pré-requisitos (sem código; começa hoje, em paralelo)

Executado por quem tem acesso ao internet banking PJ e ao portal:

1. Criar conta em `developers.sicoob.com.br` vinculada ao CNPJ da escola.
2. Criar aplicação **sandbox**: anotar `client_id` + token sandbox. Entrega: `.env.local`
   preenchido → Fase 1 pode começar.
3. Emitir **e-CNPJ A1** (AC da preferência; anotar a data de expiração).
4. Criar aplicação **produção**, enviar o `.cer` público, solicitar escopos:
   `cob.read cob.write pix.read webhook.read webhook.write cco_extrato cco_saldo`.
   Aguardar aprovação da cooperativa.
5. Confirmar no portal: URLs exatas, versão atual das APIs, formato do payload do
   webhook Pix e se o webhook envia algum header de autenticação (define R6).

Saída: checklist marcado em `docs/DEPLOY.md` seção "Sicoob".

### Fase 1 — Núcleo (sandbox)

- Migration: enums, `cobrancas_provedor`, `pagamentos_provedor`, `webhooks_recebidos`,
  `contas_bancarias`; backfill das colunas `asaas_*` para `cobrancas_provedor`.
  RLS igual a `lancamento_financeiro` (admin/financeiro).
- `src/lib/sicoob/{auth,http,endpoints,txid}.ts` + `provider.ts` + adaptador Asaas.
- `/api/sicoob/health` (admin): token ok, cert válido até X, saldo.
- Testes unitários: `txid.ts`, cache de token (TTL), parser de erro Sicoob, adaptador
  Asaas mantendo comportamento atual (`webhook.test.ts` continua verde).
- Critério de aceite: `npm run typecheck && npm run build && npm run test` verdes;
  health retorna ok no sandbox.

### Fase 2 — Pix imediato + baixa automática

- Action `gerarPixAction(cobrancaId)` → `PaymentProvider.sicoob.criarCobranca` com
  `txid` determinístico, `calendario.expiracao = 86400`, `devedor` = responsável
  financeiro (CPF/nome — mesma validação da action Asaas), `valor.original =
  valor_final`, `solicitacaoPagador = descricao`. Persistir em `cobrancas_provedor`.
  Se já existe Pix ativo não expirado → devolve o existente (não cria outro).
- UI no extrato do aluno e em `/financeiro`: botão **"Pix"** → modal com QR (gerado
  client-side a partir do copia-e-cola, sem depender de imagem do Sicoob) + botão
  copiar + **"Enviar por WhatsApp"** (template novo `META_TEMPLATE_PIX`, reusa
  `src/lib/whatsapp`).
- Webhook `/api/sicoob/webhook/pix`: grava em `webhooks_recebidos` → para cada item de
  `pix[]`: consulta `GET /pix/{e2eid}` na API (R6) → resolve `cobranca` por `txid` →
  `insert pagamentos` + `insert pagamentos_provedor on conflict do nothing` numa RPC
  transacional `registrar_pagamento_provedor(...)` (security definer). Responde 200
  sempre que o payload for válido; 500 só em erro de banco (para o Sicoob reenviar).
- Pagamento parcial/maior: Pix imediato não permite valor diferente, então não trata.
- Registro do webhook: script `scripts/sicoob-registrar-webhook.mjs` (uma vez por chave).
- Fora de escopo: devolução de Pix, Pix com vencimento, juros/multa.
- Aceite: no sandbox, criar cob → simular pagamento → `cobranca.status = 'paga'` sem
  duplicar ao reenviar o mesmo webhook 3x.

### Fase 3 — Extrato e conciliação

- `sync-extrato.ts`: para cada `contas_bancarias` ativa, busca o extrato do dia
  anterior até hoje (janela sobreposta de 3 dias para pegar atrasos) e faz upsert em
  `extrato_bancario`. Chamado pelo `/api/jobs/dispatch` (07:00) e por botão
  "Atualizar extrato" na tela.
- `matcher.ts` (puro, testado):
  1. **Automático**: `end_to_end_id` do extrato = `pagamentos_provedor.end_to_end_id`
     → `status_conciliacao = 'auto'`, vincula `pagamento_id`.
  2. **Sugestão**: crédito sem e2e → candidatos em `cobrancas` abertas/vencidas com
     `valor_final` igual (± centavos configurável) e vencimento em ±15 dias, ou
     `pagamentos` manuais do mesmo valor em ±3 dias sem vínculo. Débito → candidatos em
     `lancamento_financeiro` tipo despesa, aberta ou paga sem vínculo, valor igual,
     vencimento ±10 dias.
  3. **Manual**: usuário escolhe candidato, ou cria `pagamento` / `lancamento` a partir
     da linha do extrato, ou marca `ignorado` (ex.: tarifa bancária → vira despesa com
     categoria "Tarifas bancárias" em 1 clique).
- Tela `/financeiro/conciliacao`: filtros por conta/período/status; três abas
  (pendentes, conciliadas, ignoradas); KPI no topo: total extrato × total sistema ×
  diferença. Segue `docs/design_system/REGRAS-CLAUDE-CODE.md`.
- RBAC: novo módulo `financeiro.conciliacao` (read/update), seed para admin/financeiro.
- Aceite: 100% dos Pix da Fase 2 conciliam automático; nenhum crédito pendente fica
  sem ao menos "sem candidato" explícito.

### Fase 4 (futuro, não especificado aqui)

Pix com vencimento (`cobv`) com juros/multa e boleto via Cobrança Bancária Sicoob —
só se o Asaas se mostrar desnecessário após 2–3 meses de Fase 3.

## Testes

- Unit (Vitest): `txid`, `auth` (cache/expiração), `matcher` (casos: e2e exato, valor
  igual com dois candidatos, débito de tarifa, crédito sem candidato), `webhook`
  (payload com 2 pix, reenvio idêntico, pix de txid desconhecido).
- Integração manual: sandbox (contrato) e depois **preview da Vercel com cert de
  produção** apontando para uma cobrança de teste de R$ 1,00 antes de liberar para o
  financeiro.

## Fora de escopo desta frente

- Remover código/colunas Asaas.
- Cartão, devolução de Pix, split.
- Conciliação de meses anteriores à ativação (pode ser rodada manualmente pela tela
  ajustando período, mas sem backfill automático).
- Open Finance / múltiplos bancos além do Sicoob.

## Perguntas abertas (fecham na Fase 0)

1. O webhook Pix do Sicoob autentica de alguma forma (mTLS de cliente, header)? Define R6.
2. O extrato do Sicoob expõe `endToEndId` em campo próprio ou só na descrição? Define
   o parser da Fase 3.
3. A cooperativa cobra tarifa por Pix recebido via API / por chamada de extrato?
   Impacta se vale manter Asaas para boleto.
