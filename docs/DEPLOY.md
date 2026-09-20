# Deploy — Ambientes e Processo

> Fontes: screenshots do dashboard Vercel (fornecidos pelo usuário) + arquivos do repo (`vercel.json`, `.env.example`, `.vercel/repo.json`, `supabase/config.toml`) + confirmação direta do usuário. Onde não foi possível confirmar, está marcado **[NÃO VERIFICADO]**.
>
> **Correção de rota:** a investigação inicial desta sessão consultou um projeto chamado `escola-api` no Railway, achando que fosse a API deste sistema. **Não é** — o usuário confirmou que `escola-api` é um projeto Railway não relacionado (o repo de origem já foi deletado do GitHub). A arquitetura real deste sistema é **Next.js (front + rotas `/api/*` internas) hospedado só na Vercel, com Supabase como backend/banco** — não há serviço separado tipo Railway. Nenhuma menção a Railway abaixo se aplica a este projeto.
>
> Nome do produto mudou para "CRM Escola" (visível na preview do deployment Vercel; commit `6a1c4d0` "RRb para CRm"), mas os identificadores técnicos (repo `rrb-escola`, projeto Vercel `rrb-escola`) permanecem os antigos.

## Arquitetura

Um único app Next.js 14 (App Router) no repo `RodReis/rrb-escola`:
- **Front + API**: tudo hospedado na Vercel. As rotas `/api/*` (ex.: `/api/jobs/dispatch`, usada pelo cron do `vercel.json`) rodam como serverless functions da própria Vercel — não é um serviço backend separado.
- **Banco/Auth/Storage**: Supabase (projeto referenciado em `supabase/config.toml` e migrations em `supabase/migrations/`).

Não há Railway, nem repositório separado para "a API".

## Tabela de ambientes

| | **Vercel (front + API routes)** | **Supabase (banco/auth)** |
|---|---|---|
| Projeto | `rrb-escola` — `https://vercel.com/rodrigo-reis-projects-c27ab31c/rrb-escola` (org/team `rodrigo-reis-projects-c27ab31c`, id local `.vercel/repo.json`: `prj_PbsT2HudpMwtKmdjZg6GZrzSdNFb`) | **[NÃO VERIFICADO]** — nome/ref do projeto Supabase de produção não confirmado nesta sessão (MCP Supabase não foi consultado; `.env.example` só mostra placeholder local `http://127.0.0.1:55421`) |
| URL pública | Domínio customizado: **`gestao.epgtrindade.com.br`** (+1 domínio adicional não detalhado no screenshot). Domínio de deployment: `rrb-escola-dmvds396z-rodrigo-reis-projects-c27ab31c.vercel.app`. Confirmado por screenshot. | **[NÃO VERIFICADO]** |
| Repo GitHub | `RodReis/rrb-escola`, branch `main`. Confirmado por screenshot: "Connect Git Repository" ✓ no checklist, Source mostra branch `main`, commit `6a1c4d0` "RRb para CRm". | N/A (Supabase não é deployado a partir de push de app code; migrations em `supabase/migrations/` são aplicadas via CLI, ver abaixo) |
| Deploy automático? | **Sim, confirmado por screenshot**: "To update your Production Deployment, push to the main branch." | N/A — migrations do schema são aplicadas manualmente (`supabase db push`), não há auto-deploy de schema no push de código |
| Branch que dispara | `main` — confirmado por screenshot. | N/A |
| Env vars exigidas | **Confirmado por screenshot da aba Variables** (nomes e escopo; valores nunca expostos — todas marcadas "Sensitive"). Ver tabela detalhada abaixo — a captura mostra 11 vars, pode haver mais fora da rolagem visível (**[NÃO VERIFICADO]** se a lista é exaustiva). | N/A do lado do app; Supabase tem suas próprias chaves (`anon`, `service_role`) que são consumidas como env vars no lado Vercel |
| Build/start | `buildCommand: npm run build`, `outputDirectory: .next`, framework Next.js (`vercel.json`). Cron interno: `POST /api/jobs/dispatch` às 07:00 UTC diariamente (`vercel.json` → `crons`). | N/A |
| Último deploy confirmado | Jul 3 (2026), commit `6a1c4d0` "RRb para CRm", status **Ready** — confirmado por screenshot da página Production Deployment. | Em 2026-09-20, `npx supabase migration list --linked` mostrou as 125 migrations aplicadas (`local` = `remote`), sem pendências. |
| Rollback disponível | **"Instant Rollback"** — botão visível no topo da página Production Deployment do dashboard. | Não há "rollback" de schema — mudanças de banco são incrementais via novas migrations (ver seção Rollback abaixo). |

### Env vars de produção (Vercel) — confirmadas por screenshot

Nomes e escopo exatos, direto da aba Variables. Todos os valores estão ocultos ("Sensitive") — não capturados nem necessários para este doc.

| Variável | Escopo | Última atualização |
|---|---|---|
| `META_PHONE_NUMBER_ID` | Production and Preview | Jul 1 |
| `META_WHATSAPP_TOKEN` | Production and Preview | Jul 1 |
| `META_VERIFY_TOKEN` | Production and Preview | Jul 1 |
| `META_APP_SECRET` | Production and Preview | Adicionada Jul 1 |
| `NEXT_PUBLIC_APP_URL` | Production | Jun 22 |
| `RESEND_FROM` | Production | Adicionada May 20 |
| `RESEND_API_KEY` | Production | Adicionada May 20 |
| `GATE_API_TOKEN` | Production | Adicionada May 20 |
| `SUPABASE_SERVICE_ROLE_KEY` | Production | Adicionada May 20 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Production | Adicionada May 20 (nome truncado na tela como `NEXT_PUBLIC_SU…BASE_ANON_KEY`, mais provável esse) |
| `NEXT_PUBLIC_SUPABASE_URL` | Production | Adicionada May 20 |

Notas:
- A captura mostra 11 vars visíveis; **pode haver mais fora da rolagem** — não confirmado que esta seja a lista completa.
- Comparado ao `.env.example` local: `RESEND_FROM`/`RESEND_API_KEY` e `NEXT_PUBLIC_APP_URL` aparecem em produção mas **não estão** no `.env.example` do repo (arquivo de exemplo desatualizado). Por outro lado, várias vars do `.env.example` (`ASAAS_*`, `GATE_MATCH_THRESHOLD`, `GATE_EVENT_COOLDOWN_SECONDS`, `META_TEMPLATE_*`, `APP_DEFAULT_ADMIN_*`) **não apareceram** nesta captura — ou estão fora da rolagem, ou não estão configuradas em produção (features ainda não ativadas em prod, ou usam default no código).
- `META_PHONE_NUMBER_ID`, `META_WHATSAPP_TOKEN`, `META_VERIFY_TOKEN`, `META_APP_SECRET` com escopo **Production and Preview** — as demais são só **Production**.

## Sicoob Pix e Conciliação

Status em 2026-09-11: código preparado; credenciais/portal ainda precisam ser validados com a cooperativa.

Endpoints sandbox confirmados no portal Sicoob em 2026-09-11:

- Pix Recebimentos: `https://sandbox.sicoob.com.br/sicoob/sandbox/pix/api/v2`
- Conta Corrente: `https://sandbox.sicoob.com.br/sicoob/sandbox/conta-corrente/v4`
- Cobrança Bancária: `https://sandbox.sicoob.com.br/sicoob/sandbox/cobranca-bancaria/v3`

Pagamentos Pix/SPB/API de saída não entram nesta frente.

Checklist:

- [ ] Criar app sandbox em `developers.sicoob.com.br` e preencher `SICOOB_CLIENT_ID`, `SICOOB_SANDBOX_TOKEN`, `SICOOB_ENV=sandbox`.
- [ ] Emitir e-CNPJ A1 e converter para PEM antes de publicar env: `SICOOB_CERT_PEM_B64` e `SICOOB_KEY_PEM_B64`.
- [ ] Preencher `SICOOB_CERT_NOT_AFTER`, `SICOOB_WEBHOOK_SECRET`.
- [ ] Cadastrar conta Sicoob e chave Pix em `contas_bancarias`.
- [ ] Criar app produção, subir certificado público e solicitar escopos `cob.read`, `cob.write`, `pix.read`, `webhook.read`, `webhook.write`, `cco_extrato`, `cco_saldo`.
- [ ] Aplicar migration `202609110001_sicoob_tesouraria_core.sql` antes do deploy do código.
- [ ] Validar `GET /api/sicoob/health` autenticado como admin/financeiro.
- [ ] Registrar webhook com `SICOOB_WEBHOOK_URL=https://gestao.epgtrindade.com.br node scripts/sicoob-registrar-webhook.mjs <chave-pix>`.
- [ ] Em preview, gerar Pix de teste e reenviar webhook 3 vezes confirmando uma única linha em `pix_recebido`.

### Pendências para fechar esta tabela

- [ ] Confirmar se há mais env vars de Production fora da rolagem capturada (rolar a aba Variables até o fim).
- [ ] Investigar por que `ASAAS_*`, `GATE_MATCH_THRESHOLD`/`GATE_EVENT_COOLDOWN_SECONDS`, `META_TEMPLATE_*` não apareceram — feature desativada em prod, valor default no código, ou var realmente faltando.
- [ ] Confirmar nome/ref do projeto Supabase de produção e se há mais de um ambiente (staging/prod) configurado.
- [x] Cruzar `docs/DEPLOY_PENDENTE_PROD.md` (migrations Supabase pendentes de aplicar em produção, conhecidas em 2026-06) com o estado atual — feito em 2026-09-20: todas aplicadas, o documento virou registro histórico.

## Passo a passo de deploy

### Ordem entre front/API (Vercel) e banco (Supabase)

Como front e API vivem no mesmo deploy Vercel, a "ordem" que importa de fato é entre **schema do banco (Supabase)** e **código que depende dele (Vercel)** — não existe mais uma API separada para sequenciar.

**Regra: aplique migrations do Supabase antes de fazer merge do código que depende delas em `main`.**

Motivo: o deploy da Vercel é automático no push a `main` — não há uma etapa manual entre "código mergeado" e "código em produção" para você aplicar a migration no meio do caminho. Se o código novo (Server Actions, rotas `/api/*`, queries) espera uma coluna/tabela que a migration ainda não criou em produção, as chamadas falham em runtime assim que o deploy da Vercel terminar.

1. Aplicar a migration em produção: `npx supabase db push --linked` (nunca `db reset` em produção — ver `docs/DEPLOY_PENDENTE_PROD.md` para o aviso já registrado sobre isso).
2. Validar que a migration rodou sem erro (checar `supabase_migrations.schema_migrations` ou rodar uma query manual de smoke test).
3. Só então mergear/push o código que depende do novo schema em `main` — a Vercel builda e publica automaticamente.

### O que quebra se a ordem inverter

- **Código sobe antes da migration:** queries que referenciam coluna/tabela/policy nova falham (erro Postgres tipo `column does not exist` ou RLS bloqueando por falta de `GRANT`/policy — já aconteceu neste projeto, ver `docs/DEPLOY_PENDENTE_PROD.md`, migration `202606130003_grants_authenticated.sql`). Como o deploy da Vercel é instantâneo no push, não há margem de tempo para aplicar a migration "logo depois" sem uma janela de erro real para quem estiver usando o sistema.
- **Migration remove/renomeia algo que o código antigo (ainda em produção) usa:** o código velho quebra até o deploy novo da Vercel terminar. Nesse caso a ordem se inverte: migration compatível com o código atual primeiro, deploy do código novo depois — mudanças destrutivas de schema (como o drop de `payroll*` documentado em `DEPLOY_PENDENTE_PROD.md`) precisam que o código que dependia da tabela antiga já esteja fora do ar antes do drop.

### Deploy do app (Vercel)

1. Push/merge em `main` no repo `RodReis/rrb-escola`.
2. A Vercel builda automaticamente (`npm run build`) e publica em produção — sem etapa manual.
3. Validar a URL de produção (`gestao.epgtrindade.com.br`) e, se a mudança envolveu o cron `/api/jobs/dispatch`, conferir que ele segue com o schedule configurado (`vercel.json`).

### Deploy do banco (Supabase)

1. Escrever a migration em `supabase/migrations/`.
2. Testar localmente: `supabase db reset` (local) — nunca em produção. Para testar contra os dados atuais de produção, espelhe o banco com `bash scripts/sync_local_from_prod.sh` e rode `npx supabase migration up --local` (ver `docs/db-seed-workflow.md`).
3. Aplicar em produção: `npx supabase db push --linked`.
4. Seguir o checklist específico de migrations destrutivas/sensíveis quando aplicável (ver `docs/DEPLOY_PENDENTE_PROD.md`, que já documenta pendências e um caso de drop irreversível com checklist próprio).

### Rollback

**App (Vercel):** botão **"Instant Rollback"** no dashboard (Deployments → escolher um deployment anterior com status `Ready` → promover). Confirmado disponível por screenshot desta sessão.

**Banco (Supabase):** não há rollback automático de schema. Reverter significa escrever e aplicar uma nova migration que desfaça a anterior (drop da coluna/tabela adicionada, ou recriar o que foi removido a partir de backup). Para mudanças destrutivas, o projeto já segue a prática de checklist manual pré-aplicação (ver `DEPLOY_PENDENTE_PROD.md`) — a prevenção substitui o rollback quando o dado já foi apagado. Se a migration só adicionou algo (coluna, tabela, policy) sem apagar dados, a "reversão" é uma migration de `DROP`/downgrade; se ela apagou dados, só backup restaura.

**Combinação dos dois:** se um deploy de app quebrou por causa de uma migration incompatível, o caminho mais rápido é **rollback do app pela Vercel primeiro** (para parar o erro visível ao usuário), depois corrigir a migration com calma e re-deployar quando o schema e o código estiverem alinhados de novo.
