# Módulo Tesouraria — Sicoob (Pix e Conciliação Bancária) — Design

**Data:** 2026-09-11
**Status:** rascunho para revisão (substitui a v1 deste mesmo dia)
**Frente:** Financeiro — tesouraria da escola
**Sucede:** `2026-05-21-gateway-asaas-design.md` (não o remove)

## Correção de escopo em relação à v1

A v1 ancorou o Pix em `cobrancas` (mensalidade do aluno) e pendurou a UI no extrato do
aluno. Errado. **Pix é da escola**: a conta é da escola, a chave é da escola, e o
dinheiro que entra e sai não vem só de mensalidade — vem de venda de uniforme, contrato
da lanchonete, evento, recebimento avulso; e sai para fornecedor, folha e tarifa.

O módulo correto é **Tesouraria**: contas bancárias da escola, recebimentos, pagamentos
e extrato conciliado. O botão na ficha do aluno passa a ser **um consumidor** desse
módulo, não o dono dele.

Mas a correção não pode virar o extremo oposto:

> Um Pix de recebimento sem vínculo com uma origem é um crédito anônimo no extrato.

Se a cobrança Pix não carrega um `txid` que aponta para *alguma coisa* (mensalidade,
venda, contrato, avulso), a conciliação volta a ser 100% manual — que é exatamente o
problema que a integração existe para resolver. Então: **o Pix é da escola, mas cada
cobrança Pix tem uma origem**, polimórfica, no mesmo padrão que
`lancamento_financeiro.origem_tipo/origem_id` já usa.

## Achado durante a análise — receita de mensalidade não está no livro-razão

O enum `origem_lancamento` tem o valor `'cobranca'`, mas **nada no código escreve com
ele**. `lancamento_financeiro` recebe hoje: `despesa` (migrado de `despesas`), `venda`
(RPC `confirmar_venda`), `contrato` (RPC `gerar_lancamentos_contratos`) e `manual`.
Mensalidade paga fica só em `cobrancas`/`pagamentos`.

Consequência: o DRE (`src/lib/relatorios/dre.ts`) soma receitas do razão — ou seja, hoje
ele enxerga uniforme, lanchonete e evento, e **não enxerga a principal receita da
escola**. Isso não é causado pela integração Sicoob, mas atrapalha diretamente a
conciliação: metade dos créditos do extrato não terá contrapartida no razão.

Isso vira a **Fase 3a** abaixo. É pré-requisito real da conciliação, não um extra.

*(Baseado nas migrations e no código lido em 2026-09-11; se existir alguma rotina que
escreve `origem_tipo='cobranca'` que eu não encontrei, essa fase cai.)*

## Recebimento e pagamento são duas classes de risco diferentes

| | Recebimento (Pix in) | Pagamento (Pix out) |
|---|---|---|
| Escopo Sicoob | `cob.write cob.read pix.read webhook.*` | `pagamentos_*` / SPB — **contratação separada**, muitas cooperativas não liberam por API |
| Se der errado | cobrança duplicada, baixa errada — corrigível | **dinheiro sai e não volta**. Pix não estorna |
| Superfície de ataque | credencial vazada gera cobrança em nome da escola (ruim, não fatal) | credencial vazada = transferência para conta de terceiro |
| Webhook | sim, um por chave Pix | não existe; é consulta de status |

**Recomendação:** recebimento + conciliação agora; pagamento por API **fora desta
frente**, e provavelmente fora do produto. Para 63 funcionários e um punhado de
fornecedores, pagar pelo app do banco custa minutos por semana; automatizar isso tem ROI
baixo e risco irreversível. Se um dia entrar, exige aprovação em duas etapas, favorecidos
pré-cadastrados, teto por transação e log imutável — um projeto próprio (Fase 5, não
especificada aqui).

O que resolve 90% da dor de "pagamento" sem mover dinheiro: o **extrato** mostra o
pagamento que já foi feito pelo app e concilia com a despesa do razão automaticamente.

## Decisões mantidas da v1

- Dois provedores atrás de `PaymentProvider`: Asaas (boleto/fatura) e Sicoob (Pix + extrato).
- Ordem: Pix primeiro, extrato depois.
- Pré-requisitos: conta PJ e chave Pix existem; falta app no portal e certificado A1.

## Modelo de dados

### `contas_bancarias` — as contas da escola

`id, escola_id, apelido, banco ('756'), cooperativa, agencia, conta, chave_pix,
provedor (enum), ativo, saldo_sincronizado_em`.

Multi-tenant por `escola_id` (o sistema já é multi-escola). O cron itera as ativas.

### `pix_cobranca` — cobrança Pix da escola, com origem polimórfica

| Coluna | Tipo | Notas |
|--------|------|-------|
| id | uuid pk | |
| escola_id | uuid fk | |
| conta_id | uuid fk contas_bancarias | em qual conta cai |
| origem_tipo | enum `origem_recebimento` (`cobranca`,`venda`,`contrato`,`evento`,`lancamento`,`avulso`) | reusa a ideia de `origem_lancamento` |
| origem_id | uuid null | null só quando `avulso` |
| txid | text | 26–35 `[a-zA-Z0-9]`, determinístico a partir de (origem_tipo, origem_id) |
| valor | numeric(12,2) | |
| devedor_nome / devedor_doc | text null | opcional no Pix imediato |
| descricao | text | `solicitacaoPagador` |
| pix_copia_cola | text | |
| location | text null | |
| status | enum (`ativa`,`concluida`,`expirada`,`cancelada`) | |
| expira_em | timestamptz | default +24h |
| payload | jsonb | resposta bruta |

`unique (escola_id, txid)`; índice `(origem_tipo, origem_id)`.

### `pix_recebido` — todo Pix que entrou, com ou sem txid

`id, escola_id, conta_id, end_to_end_id, txid null, valor, pagador_nome,
pagador_doc, recebido_em, payload jsonb`.

`unique (end_to_end_id)` — **esta constraint é a idempotência do webhook**, não um `if`
no código. O webhook do Asaas hoje faz `if (status === 'paga')` e depois insere: dois
reenvios simultâneos duplicam o pagamento. Não repetir esse padrão.

Pix sem `txid` (alguém pagou direto na chave) entra aqui igual e cai na conciliação
manual — que é o caso real de "a escola recebe Pix avulso".

### `extrato_bancario`

`id, escola_id, conta_id, id_transacao, data, tipo (credito|debito), valor, descricao,
end_to_end_id null, contraparte_doc null, status_conciliacao
(pendente|auto|manual|ignorado), payload jsonb`.

`unique (conta_id, id_transacao)`.

### `conciliacao_vinculo` — N:N entre extrato e o que o sistema registrou

| Coluna | Tipo |
|--------|------|
| id | uuid pk |
| extrato_id | uuid fk extrato_bancario |
| alvo_tipo | enum (`pagamento`,`lancamento`) |
| alvo_id | uuid |
| valor | numeric(12,2) |
| origem | enum (`auto`,`manual`) |
| criado_por / criado_em | |

Tabela de ligação em vez de colunas `pagamento_id`/`lancamento_id` na linha do extrato,
porque os dois casos reais são N:N: um responsável paga duas mensalidades num Pix só, e
uma despesa grande é quitada em duas transferências. Soma dos vínculos vs valor da linha
dá o resíduo, que a tela mostra.

### `webhooks_recebidos`

`id, provedor, evento, id_externo, payload jsonb, recebido_em, processado_em, erro`.
Grava antes de processar. Permite reprocessar sem depender do reenvio do banco.

### O que acontece com as colunas `asaas_*`

Ficam. Nesta frente ganham espelho em `pix_cobranca`? Não — Asaas não é Pix Sicoob.
O adaptador `asaas.provider.ts` continua lendo/gravando as colunas atuais. Unificação
do Asaas no modelo novo fica para quando/se o Asaas for de fato ativado.

## Arquitetura

```
src/lib/tesouraria/
  provider.ts            # interface PaymentProvider + registry
  asaas.provider.ts      # adapta src/lib/asaas/* (comportamento atual intacto)
  sicoob.provider.ts
  origem.ts              # resolve origem_tipo+origem_id -> { valor, descricao, devedor }
                         # e aplica a baixa correta por tipo. Puro + I/O separados.
src/lib/sicoob/
  auth.ts http.ts endpoints.ts pix.ts conta-corrente.ts webhook.ts txid.ts
src/lib/conciliacao/
  matcher.ts             # puro
  sync-extrato.ts
src/app/(app)/financeiro/tesouraria/
  page.tsx               # contas + saldo + últimos movimentos
  conciliacao/page.tsx
  cobrancas-pix/page.tsx
src/app/api/sicoob/webhook/pix/route.ts   # runtime = 'nodejs'
src/app/api/sicoob/health/route.ts
```

`origem.ts` é o coração da mudança de escopo: ele é quem sabe que
`origem_tipo='cobranca'` dá baixa inserindo em `pagamentos` (e o trigger
`pagamentos_recalc_status` fecha a cobrança), que `'venda'` marca a venda como paga,
que `'lancamento'` seta `data_pagamento`/`status='paga'` no razão, e que `'avulso'`
cria um `lancamento_financeiro` de receita. Uma função, um lugar.

### Navegação

Novo item no `FinanceiroDropdown`: **Tesouraria**, com Contas, Conciliação e Cobranças
Pix. A ficha do aluno e a tela de venda ganham um botão "Gerar Pix" que chama a mesma
action com a origem certa.

## RBAC

Módulo novo `financeiro.tesouraria` (read/create/update) — admin e financeiro.
Secretaria não entra. Gerar Pix de mensalidade continua exigindo
`financeiro.cobrancas:update` **além** de `financeiro.tesouraria:create`.

## Variáveis de ambiente

```
SICOOB_ENV=sandbox|production
SICOOB_CLIENT_ID=
SICOOB_SANDBOX_TOKEN=
SICOOB_CERT_PEM_B64=
SICOOB_KEY_PEM_B64=
SICOOB_CERT_NOT_AFTER=
SICOOB_WEBHOOK_SECRET=
```

Chave Pix, cooperativa, agência e conta saem de `contas_bancarias` (dados, não env) —
a escola pode ter mais de uma conta e o sistema é multi-escola.

Certificado: converter o `.pfx` para PEM localmente e subir só o base64. Nunca `.pfx`
em env.

## Riscos

| # | Risco | Mitigação |
|---|-------|-----------|
| R1 | e-CNPJ A1 expira em 12 meses e derruba tudo silenciosamente | `SICOOB_CERT_NOT_AFTER` + alerta no dashboard 30 dias antes + `/api/sicoob/health` |
| R2 | Documentação Sicoob incompleta; versões de API mudam | URLs só em `endpoints.ts`; validar payloads no sandbox antes da UI |
| R3 | Webhook reenviado duplica pagamento | `unique (end_to_end_id)` em `pix_recebido` + `on conflict do nothing` dentro de RPC transacional |
| R4 | mTLS em serverless (Vercel) | `runtime = 'nodejs'`; `undici.Agent({ connect: { cert, key } })`; testar em preview antes de prod |
| R5 | Webhook Pix é por chave e o Sicoob faz POST em `<url>/pix` | registrar `https://gestao.epgtrindade.com.br/api/sicoob/webhook` |
| R6 | Webhook Sicoob talvez não autentique | segredo na URL **e** re-consulta do `e2eid` na API antes da baixa. Nunca confiar no payload |
| R7 | Escopos exigem aprovação da cooperativa (dias) | Fase 0 em paralelo ao sandbox |
| R8 | Pix avulso sem txid é indistinguível de mensalidade paga fora do sistema | tela de conciliação com sugestão por valor/documento do pagador; nunca baixa automática sem txid |

## Fases

### Fase 0 — Pré-requisitos (sem código, começa já)

1. App **sandbox** no `developers.sicoob.com.br` → `client_id` + token. Destrava a Fase 1.
2. Emitir **e-CNPJ A1**; anotar expiração.
3. App **produção**, enviar `.cer`, solicitar escopos `cob.read cob.write pix.read
   webhook.read webhook.write cco_extrato cco_saldo`. **Não** solicitar escopo de
   pagamento.
4. Confirmar no portal: URLs/versões, payload do webhook, se o webhook autentica (R6),
   se o extrato traz `endToEndId` em campo próprio (define o parser da Fase 3), e a
   tarifa por Pix recebido e por chamada de extrato.

### Fase 1 — Núcleo (sandbox)

Migration (contas, pix_cobranca, pix_recebido, webhooks_recebidos, enums, RLS
admin/financeiro) + cliente Sicoob + `PaymentProvider` + adaptador Asaas +
`/api/sicoob/health` + CRUD de contas bancárias.
Testes: `txid` determinístico, cache/expiração de token, parser de erro Sicoob,
`webhook.test.ts` do Asaas continua verde.
Aceite: `npm run typecheck && npm run build && npm run test` verdes; health ok no sandbox.

### Fase 2 — Recebimento Pix (qualquer origem)

`gerarPixAction({ origemTipo, origemId, contaId })` → `origem.ts` resolve valor/descrição
→ cria cob no Sicoob → grava `pix_cobranca`. Se já existe cobrança ativa não expirada
para a mesma origem, devolve a existente.
UI: modal com QR gerado no cliente a partir do copia-e-cola + copiar + enviar por
WhatsApp (mensageria já existe; template novo `META_TEMPLATE_PIX`). Pontos de entrada:
tesouraria (avulso), ficha do aluno (mensalidade), tela de venda.
Webhook: grava em `webhooks_recebidos` → consulta `GET /pix/{e2eid}` → `insert
pix_recebido on conflict do nothing` → se inseriu, `origem.ts` aplica a baixa, tudo em
uma RPC `registrar_pix_recebido(...)` security definer.
Aceite: sandbox — criar cob, simular pagamento, origem baixada, reenviar 3× sem duplicar.

### Fase 3a — Mensalidade no livro-razão (pré-requisito da conciliação)

Trigger ou RPC que espelha `pagamentos` (não cancelados) em `lancamento_financeiro`
com `origem_tipo='cobranca'`, `origem_id = pagamentos.id`, categoria "Mensalidades",
`status='paga'`. Backfill idempotente do histórico (o índice
`lancamento_origem_unico_idx` já garante). Estorno de pagamento cancela o lançamento.
Aceite: DRE do mês bate com o financeiro; rodar o backfill 2× não duplica.

### Fase 3b — Extrato e conciliação

`sync-extrato.ts` com janela sobreposta de 3 dias, chamado pelo cron
`/api/jobs/dispatch` (07:00) e por botão manual. `matcher.ts` puro:
automático por `end_to_end_id`; sugestão por valor+data (crédito → cobranças/pagamentos;
débito → despesas do razão); manual com criação de lançamento a partir da linha e
"ignorar" que vira despesa de tarifa em 1 clique.
Tela `/financeiro/tesouraria/conciliacao` seguindo
`docs/design_system/REGRAS-CLAUDE-CODE.md`: filtros, abas pendente/conciliado/ignorado,
KPI extrato × sistema × diferença.
Aceite: todo Pix da Fase 2 concilia sozinho; nenhum crédito fica sem status explícito.

### Fase 4 — Pix com vencimento / boleto Sicoob (só se justificar)

### Fase 5 — Pagamento por API (fora desta frente; exige projeto de controles próprio)

## Fora de escopo

Remover Asaas; cartão; devolução de Pix; split; Open Finance; pagamento a fornecedor
por API; conciliação retroativa automática de períodos anteriores à ativação.

## Perguntas abertas (fecham na Fase 0)

1. O webhook Pix do Sicoob autentica de alguma forma? (R6)
2. O extrato expõe `endToEndId` em campo próprio ou só na descrição? (parser da 3b)
3. Tarifa por Pix recebido e por chamada de extrato na sua cooperativa? (decide se o
   Asaas continua fazendo sentido para boleto)
4. Existe alguma rotina que já escreve `origem_tipo='cobranca'` no razão? Se sim, a
   Fase 3a cai.
