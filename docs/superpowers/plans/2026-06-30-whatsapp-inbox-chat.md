# WhatsApp Inbox — Chat Bidirecional (Fase 6) — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Receber mensagens dos responsáveis no WhatsApp (inbound) e responder por um inbox dedicado `/whatsapp`, estilo WhatsApp Web.

**Architecture:** Webhook da Meta Cloud API grava conversas (`pipeline_conversa`) e mensagens (`pipeline_conversa_mensagem`) via admin client. Inbox React lê via server actions + Supabase Realtime. Outbound de portaria/lembrete/comunicado/card permanece intocado em `mensagens_whatsapp`. Reusa `meta.ts`, `telefone.ts`, padrão de webhook do Asaas e RLS `current_perfil()`.

**Tech Stack:** Next.js 14 (App Router, Server Actions), Supabase (Postgres + RLS + Realtime + Storage), Meta Cloud API (Graph v21.0), Vitest, Tailwind + Design System (tokens), TypeScript.

**Spec:** `docs/superpowers/specs/2026-06-30-whatsapp-inbox-chat-design.md`

## Global Constraints

- **PT-BR** em toda UI e mensagens de erro.
- **Cor só via token** do Design System (`var(--token)` ou classes tokenizadas). Sem hex/rgb cru. Sem serifa. Paridade claro/escuro (`data-theme`).
- **RLS por escola** via `current_perfil()` em toda tabela nova; política `service_role` separada para o webhook (admin client).
- **`mensagens_whatsapp` NÃO muda** — outbound existente permanece.
- **Escola única:** usar `DEFAULT_SCHOOL_ID` de `@/lib/constants` onde não há sessão (webhook), igual ao `send.ts`.
- **Server actions** retornam `ActionResult<T> = { ok: true; data: T } | { ok: false; error: string }` (padrão de `src/lib/actions/pipeline.ts`).
- **Trava de qualidade:** `npm run typecheck && npm run build` verdes ao fim de cada task; `npm run test` cobre as funções puras.
- **Menu hardcoded:** o link `/whatsapp` é adicionado manualmente em `topbar.tsx` (RBAC só filtra).
- **Idioma de template Meta:** `pt_BR` (constante `IDIOMA_TEMPLATE` em `send.ts`).

---

## Mapa de arquivos

**Criar:**
- `supabase/migrations/202606300001_whatsapp_inbox.sql` — tabelas + RLS + RBAC.
- `src/lib/whatsapp/inbox-parser.ts` — funções puras: validar assinatura, parsear evento, casar conversa, janela aberta.
- `src/lib/whatsapp/inbox-parser.test.ts` — testes das funções puras.
- `src/lib/whatsapp/inbox-receive.ts` — `server-only`: processa evento (upsert conversa + insert mensagem + download de mídia).
- `src/app/api/whatsapp/webhook/route.ts` — GET (verify) + POST (receive).
- `src/lib/actions/whatsapp-inbox.ts` — server actions do inbox.
- `src/lib/data/inbox.ts` — leitura (conversas, mensagens) para a página.
- `src/app/(app)/whatsapp/page.tsx` — página do inbox (server component).
- `src/components/whatsapp/inbox-client.tsx` — client component (estado + realtime).
- `src/components/whatsapp/conversa-lista.tsx` — lista de conversas.
- `src/components/whatsapp/conversa-thread.tsx` — thread + caixa de envio.
- `src/components/whatsapp/vinculo-chip.tsx` — chip de vínculo.

**Modificar:**
- `src/lib/whatsapp/meta.ts` — adicionar `sendImage` e `getMediaUrl`.
- `src/components/layout/topbar.tsx` — adicionar link `/whatsapp`.
- `.env.example` (ou `README`) — documentar `META_VERIFY_TOKEN`, `META_APP_SECRET`.

---

## Task 1: Migration — tabelas, RLS e RBAC

**Files:**
- Create: `supabase/migrations/202606300001_whatsapp_inbox.sql`

**Interfaces:**
- Produces: tabelas `pipeline_conversa`, `pipeline_conversa_mensagem`; módulo RBAC `whatsapp_inbox`.

- [ ] **Step 1: Escrever a migration**

```sql
-- WhatsApp Inbox (Fase 6): conversa bidirecional + RBAC.
-- Depende: escolas, pipeline_lead, alunos, responsaveis_aluno, perfis, modulos, role_permissoes.

-- ─── pipeline_conversa ────────────────────────────────────────────────────────
create table pipeline_conversa (
  id                  uuid primary key default gen_random_uuid(),
  escola_id           uuid not null references escolas(id) on delete cascade,
  telefone            text not null,
  nome_whatsapp       text,
  lead_id             uuid references pipeline_lead(id) on delete set null,
  aluno_id            uuid references alunos(id) on delete set null,
  responsavel_id      uuid references responsaveis_aluno(id) on delete set null,
  assigned_to         uuid references perfis(id) on delete set null,
  status              text not null default 'aberta',   -- 'aberta' | 'arquivada'
  nao_lidas           int  not null default 0,
  janela_expira_em    timestamptz,
  ultima_msg_em       timestamptz not null default now(),
  ultima_msg_preview  text,
  created_at          timestamptz not null default now()
);

create unique index pipeline_conversa_tel_idx
  on pipeline_conversa(escola_id, telefone);
create index pipeline_conversa_ordem_idx
  on pipeline_conversa(escola_id, status, ultima_msg_em desc);
create index pipeline_conversa_assigned_idx
  on pipeline_conversa(escola_id, assigned_to);

alter table pipeline_conversa enable row level security;

create policy pipeline_conversa_service on pipeline_conversa
  for all to service_role using (true) with check (true);

create policy pipeline_conversa_escola on pipeline_conversa
  for all to authenticated
  using (escola_id = (select escola_id from current_perfil()))
  with check (escola_id = (select escola_id from current_perfil()));

grant select, insert, update, delete on pipeline_conversa to authenticated;

-- ─── pipeline_conversa_mensagem ───────────────────────────────────────────────
create table pipeline_conversa_mensagem (
  id                   uuid primary key default gen_random_uuid(),
  escola_id            uuid not null references escolas(id) on delete cascade,
  conversa_id          uuid not null references pipeline_conversa(id) on delete cascade,
  direcao              text not null,                 -- 'entrada' | 'saida'
  tipo                 text not null default 'texto', -- 'texto' | 'imagem' | 'template'
  texto                text,
  midia_url            text,
  status               text,                          -- só saída: 'enviada' | 'falha'
  erro                 text,
  provider_message_id  text,
  enviada_por          uuid references perfis(id) on delete set null,
  created_at           timestamptz not null default now()
);

create index pipeline_conversa_msg_idx
  on pipeline_conversa_mensagem(conversa_id, created_at);
create unique index pipeline_conversa_msg_provider_idx
  on pipeline_conversa_mensagem(provider_message_id)
  where provider_message_id is not null;

alter table pipeline_conversa_mensagem enable row level security;

create policy pipeline_conversa_msg_service on pipeline_conversa_mensagem
  for all to service_role using (true) with check (true);

create policy pipeline_conversa_msg_escola on pipeline_conversa_mensagem
  for all to authenticated
  using (escola_id = (select escola_id from current_perfil()))
  with check (escola_id = (select escola_id from current_perfil()));

grant select, insert, update, delete on pipeline_conversa_mensagem to authenticated;

-- ─── RBAC ─────────────────────────────────────────────────────────────────────
insert into modulos (codigo, grupo, nome, ordem) values
  ('whatsapp_inbox', 'comunicacao', 'WhatsApp Inbox', 40)
on conflict (codigo) do nothing;

insert into role_permissoes (role_codigo, modulo_codigo, pode_ler, pode_criar, pode_editar, pode_deletar) values
  ('admin',       'whatsapp_inbox', true,  true,  true,  true),
  ('coordenacao', 'whatsapp_inbox', true,  true,  true,  false),
  ('secretaria',  'whatsapp_inbox', false, false, false, false),
  ('professor',   'whatsapp_inbox', false, false, false, false)
on conflict (role_codigo, modulo_codigo) do nothing;

-- Realtime: publicar as tabelas novas.
alter publication supabase_realtime add table pipeline_conversa;
alter publication supabase_realtime add table pipeline_conversa_mensagem;
```

- [ ] **Step 2: Validar a sintaxe localmente**

Run: `npx supabase db lint --schema public` (se disponível) ou revisar manualmente.
Antes de aplicar, confirmar os nomes reais das colunas referenciadas:
- `responsaveis_aluno(id)` existe (FK do `responsavel_id`).
- `modulos(codigo, grupo, nome, ordem)` e `role_permissoes(role_codigo, modulo_codigo, pode_ler, pode_criar, pode_editar, pode_deletar)` batem com `202606140003_rbac_lancamentos.sql`.
- A role `coordenacao` existe (criada no pipeline MVP2).

Expected: sem erros; nomes confirmados.

> **Nota:** NÃO rodar `supabase db reset --local` (quebra por ordem de migrations — ver memória `project_migration_order_bug`). Aplicar com `supabase db push` no deploy.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/202606300001_whatsapp_inbox.sql
git commit -m "feat(whatsapp): migration do inbox (conversa, mensagem, RBAC)"
```

---

## Task 2: `meta.ts` — envio de imagem e download de mídia

**Files:**
- Modify: `src/lib/whatsapp/meta.ts`
- Test: `src/lib/whatsapp/meta.test.ts` (já existe — adicionar casos)

**Interfaces:**
- Consumes: `getConfig()`, `postMessage()`, `MetaResult` (já existem em `meta.ts`).
- Produces:
  - `sendImage({ telefone: string; imagemUrl: string; legenda?: string }): Promise<MetaResult>`
  - `getMediaUrl(mediaId: string): Promise<{ ok: true; url: string } | { ok: false; reason: string }>`

- [ ] **Step 1: Escrever os testes (função pura de payload)**

A montagem do payload de imagem é a parte testável sem I/O. Extrair `montarPayloadImagem` e testar.

Adicionar em `src/lib/whatsapp/meta.test.ts`:

```typescript
import { montarPayloadImagem } from "./meta";

describe("montarPayloadImagem", () => {
  it("monta payload de imagem com legenda", () => {
    expect(montarPayloadImagem("5562999998888", "https://x/y.jpg", "oi")).toEqual({
      to: "5562999998888",
      type: "image",
      image: { link: "https://x/y.jpg", caption: "oi" },
    });
  });

  it("omite caption quando não há legenda", () => {
    expect(montarPayloadImagem("5562999998888", "https://x/y.jpg")).toEqual({
      to: "5562999998888",
      type: "image",
      image: { link: "https://x/y.jpg" },
    });
  });
});
```

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `npm run test -- meta.test`
Expected: FAIL — `montarPayloadImagem is not a function`.

- [ ] **Step 3: Implementar em `meta.ts`**

Adicionar (após `montarComponentsTemplate`):

```typescript
export function montarPayloadImagem(
  telefone: string,
  imagemUrl: string,
  legenda?: string,
): Record<string, unknown> {
  const image: { link: string; caption?: string } = { link: imagemUrl };
  if (legenda) image.caption = legenda;
  return { to: telefone, type: "image", image };
}
```

Adicionar (após `sendText`):

```typescript
// Envia uma imagem por link — só funciona dentro da janela de 24h.
export async function sendImage({
  telefone,
  imagemUrl,
  legenda,
}: {
  telefone: string;
  imagemUrl: string;
  legenda?: string;
}): Promise<MetaResult> {
  const config = getConfig();
  if (!config) {
    return { ok: false, reason: "Meta WhatsApp não configurada" };
  }
  return postMessage(config, montarPayloadImagem(telefone, imagemUrl, legenda));
}

// Resolve a URL temporária de download de uma mídia recebida (media_id do webhook).
export async function getMediaUrl(
  mediaId: string,
): Promise<{ ok: true; url: string } | { ok: false; reason: string }> {
  const config = getConfig();
  if (!config) return { ok: false, reason: "Meta WhatsApp não configurada" };
  try {
    const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${mediaId}`, {
      headers: { Authorization: `Bearer ${config.token}` },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return { ok: false, reason: `Meta media HTTP ${res.status}` };
    const json = (await res.json().catch(() => null)) as { url?: string } | null;
    if (!json?.url) return { ok: false, reason: "URL de mídia ausente" };
    return { ok: true, url: json.url };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : "falha media" };
  }
}
```

> `GRAPH_VERSION`, `getConfig`, `postMessage`, `MetaResult` já existem em `meta.ts`.

- [ ] **Step 4: Rodar o teste e ver passar**

Run: `npm run test -- meta.test`
Expected: PASS.

- [ ] **Step 5: Typecheck + commit**

```bash
npm run typecheck
git add src/lib/whatsapp/meta.ts src/lib/whatsapp/meta.test.ts
git commit -m "feat(whatsapp): sendImage e getMediaUrl no cliente Meta"
```

---

## Task 3: Funções puras do webhook (parser, assinatura, vínculo, janela)

**Files:**
- Create: `src/lib/whatsapp/inbox-parser.ts`
- Test: `src/lib/whatsapp/inbox-parser.test.ts`

**Interfaces:**
- Produces:
  - `validarAssinaturaWebhook(rawBody: string, signature: string | null, secret: string): boolean`
  - `EventoInbound = { telefone: string; nome: string | null; tipo: "texto" | "imagem"; texto: string | null; mediaId: string | null; providerMessageId: string }`
  - `parsearEventoWebhook(payload: unknown): EventoInbound[]`
  - `casarConversa(telefone: string, leads: { id: string; telefone: string | null }[], responsaveis: { id: string; aluno_id: string; telefone: string | null }[]): { lead_id: string | null; aluno_id: string | null; responsavel_id: string | null }`
  - `janelaAberta(janelaExpiraEm: string | null, agora: Date): boolean`

- [ ] **Step 1: Escrever os testes**

```typescript
import { describe, it, expect } from "vitest";
import {
  validarAssinaturaWebhook,
  parsearEventoWebhook,
  casarConversa,
  janelaAberta,
} from "./inbox-parser";
import { createHmac } from "node:crypto";

describe("validarAssinaturaWebhook", () => {
  const secret = "s3cr3t";
  const body = '{"a":1}';
  const assinaturaValida =
    "sha256=" + createHmac("sha256", secret).update(body).digest("hex");

  it("aceita assinatura correta", () => {
    expect(validarAssinaturaWebhook(body, assinaturaValida, secret)).toBe(true);
  });
  it("rejeita assinatura errada", () => {
    expect(validarAssinaturaWebhook(body, "sha256=deadbeef", secret)).toBe(false);
  });
  it("rejeita assinatura ausente", () => {
    expect(validarAssinaturaWebhook(body, null, secret)).toBe(false);
  });
});

describe("parsearEventoWebhook", () => {
  it("extrai mensagem de texto", () => {
    const payload = {
      entry: [{ changes: [{ value: {
        contacts: [{ profile: { name: "Maria" }, wa_id: "5562999998888" }],
        messages: [{ from: "5562999998888", id: "wamid.1", type: "text", text: { body: "Oi" } }],
      } }] }],
    };
    expect(parsearEventoWebhook(payload)).toEqual([
      { telefone: "5562999998888", nome: "Maria", tipo: "texto", texto: "Oi", mediaId: null, providerMessageId: "wamid.1" },
    ]);
  });

  it("extrai mensagem de imagem", () => {
    const payload = {
      entry: [{ changes: [{ value: {
        contacts: [{ profile: { name: "João" }, wa_id: "5562988887777" }],
        messages: [{ from: "5562988887777", id: "wamid.2", type: "image", image: { id: "media-1", caption: "foto" } }],
      } }] }],
    };
    expect(parsearEventoWebhook(payload)).toEqual([
      { telefone: "5562988887777", nome: "João", tipo: "imagem", texto: "foto", mediaId: "media-1", providerMessageId: "wamid.2" },
    ]);
  });

  it("ignora eventos de status (delivered/read)", () => {
    const payload = { entry: [{ changes: [{ value: { statuses: [{ status: "delivered" }] } }] }] };
    expect(parsearEventoWebhook(payload)).toEqual([]);
  });

  it("retorna vazio para payload sem messages", () => {
    expect(parsearEventoWebhook({})).toEqual([]);
  });
});

describe("casarConversa", () => {
  const leads = [{ id: "lead-1", telefone: "5562999998888" }];
  const resps = [{ id: "resp-1", aluno_id: "aluno-1", telefone: "5562988887777" }];

  it("casa com lead", () => {
    expect(casarConversa("5562999998888", leads, resps)).toEqual({
      lead_id: "lead-1", aluno_id: null, responsavel_id: null,
    });
  });
  it("casa com responsável", () => {
    expect(casarConversa("5562988887777", leads, resps)).toEqual({
      lead_id: null, aluno_id: "aluno-1", responsavel_id: "resp-1",
    });
  });
  it("sem vínculo quando não casa", () => {
    expect(casarConversa("5511111111111", leads, resps)).toEqual({
      lead_id: null, aluno_id: null, responsavel_id: null,
    });
  });
});

describe("janelaAberta", () => {
  const agora = new Date("2026-06-30T12:00:00Z");
  it("aberta quando expira no futuro", () => {
    expect(janelaAberta("2026-06-30T20:00:00Z", agora)).toBe(true);
  });
  it("fechada quando expira no passado", () => {
    expect(janelaAberta("2026-06-30T10:00:00Z", agora)).toBe(false);
  });
  it("fechada quando null", () => {
    expect(janelaAberta(null, agora)).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm run test -- inbox-parser`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar `inbox-parser.ts`**

```typescript
import { createHmac, timingSafeEqual } from "node:crypto";
import { normalizarTelefone } from "./telefone";

export function validarAssinaturaWebhook(
  rawBody: string,
  signature: string | null,
  secret: string,
): boolean {
  if (!signature || !signature.startsWith("sha256=")) return false;
  const esperado = "sha256=" + createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(signature);
  const b = Buffer.from(esperado);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export type EventoInbound = {
  telefone: string;
  nome: string | null;
  tipo: "texto" | "imagem";
  texto: string | null;
  mediaId: string | null;
  providerMessageId: string;
};

type WebhookValue = {
  contacts?: { profile?: { name?: string }; wa_id?: string }[];
  messages?: {
    from?: string;
    id?: string;
    type?: string;
    text?: { body?: string };
    image?: { id?: string; caption?: string };
  }[];
  statuses?: unknown[];
};

export function parsearEventoWebhook(payload: unknown): EventoInbound[] {
  const eventos: EventoInbound[] = [];
  const root = payload as { entry?: { changes?: { value?: WebhookValue }[] }[] };
  for (const entry of root?.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;
      const nome = value?.contacts?.[0]?.profile?.name ?? null;
      for (const msg of value?.messages ?? []) {
        if (!msg.from || !msg.id) continue;
        if (msg.type === "text" && msg.text?.body) {
          eventos.push({
            telefone: msg.from, nome, tipo: "texto",
            texto: msg.text.body, mediaId: null, providerMessageId: msg.id,
          });
        } else if (msg.type === "image" && msg.image?.id) {
          eventos.push({
            telefone: msg.from, nome, tipo: "imagem",
            texto: msg.image.caption ?? null, mediaId: msg.image.id, providerMessageId: msg.id,
          });
        }
        // outros tipos (audio, video, document, status) são ignorados nesta fase
      }
    }
  }
  return eventos;
}

export function casarConversa(
  telefone: string,
  leads: { id: string; telefone: string | null }[],
  responsaveis: { id: string; aluno_id: string; telefone: string | null }[],
): { lead_id: string | null; aluno_id: string | null; responsavel_id: string | null } {
  const alvo = normalizarTelefone(telefone);
  const lead = leads.find((l) => l.telefone && normalizarTelefone(l.telefone) === alvo);
  if (lead) return { lead_id: lead.id, aluno_id: null, responsavel_id: null };
  const resp = responsaveis.find((r) => r.telefone && normalizarTelefone(r.telefone) === alvo);
  if (resp) return { lead_id: null, aluno_id: resp.aluno_id, responsavel_id: resp.id };
  return { lead_id: null, aluno_id: null, responsavel_id: null };
}

export function janelaAberta(janelaExpiraEm: string | null, agora: Date): boolean {
  if (!janelaExpiraEm) return false;
  return new Date(janelaExpiraEm).getTime() > agora.getTime();
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm run test -- inbox-parser`
Expected: PASS (todos os casos).

- [ ] **Step 5: Typecheck + commit**

```bash
npm run typecheck
git add src/lib/whatsapp/inbox-parser.ts src/lib/whatsapp/inbox-parser.test.ts
git commit -m "feat(whatsapp): funcoes puras do webhook (assinatura, parser, vinculo, janela)"
```

---

## Task 4: Processamento do evento recebido (`inbox-receive.ts`)

**Files:**
- Create: `src/lib/whatsapp/inbox-receive.ts`

**Interfaces:**
- Consumes: `EventoInbound`, `casarConversa` (Task 3); `getMediaUrl` (Task 2); `DEFAULT_SCHOOL_ID`; `createAdminClient`.
- Produces: `processarEventoInbound(evento: EventoInbound, supabaseAdmin: SupabaseAdmin): Promise<void>`

> Esta task é I/O (Supabase + Storage + Graph). Sem teste unitário — validação manual no Task 5/9. O objetivo aqui é o módulo compilar e expor a função que a rota chama.

- [ ] **Step 1: Implementar `inbox-receive.ts`**

```typescript
import "server-only";
import { DEFAULT_SCHOOL_ID } from "@/lib/constants";
import { normalizarTelefone } from "./telefone";
import { casarConversa, type EventoInbound } from "./inbox-parser";
import { getMediaUrl } from "./meta";

const JANELA_HORAS = 24;
const BUCKET = "whatsapp-inbox";

type SupabaseAdmin = { from: (t: string) => any; storage: any };

// Baixa a mídia da Meta, sobe no bucket e devolve a URL assinada (ou null em falha).
async function baixarMidia(
  supabase: SupabaseAdmin,
  mediaId: string,
  conversaId: string,
): Promise<string | null> {
  const media = await getMediaUrl(mediaId);
  if (!media.ok) return null;
  try {
    const token = process.env.META_WHATSAPP_TOKEN!;
    const res = await fetch(media.url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.byteLength > 5 * 1024 * 1024) return null; // limite 5MB
    const path = `${conversaId}/${mediaId}.jpg`;
    const up = await supabase.storage.from(BUCKET).upload(path, bytes, {
      contentType: res.headers.get("content-type") ?? "image/jpeg",
      upsert: true,
    });
    if (up.error) return null;
    const signed = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60 * 24 * 365);
    return signed.data?.signedUrl ?? null;
  } catch {
    return null;
  }
}

export async function processarEventoInbound(
  evento: EventoInbound,
  supabase: SupabaseAdmin,
): Promise<void> {
  const telefone = normalizarTelefone(evento.telefone) ?? evento.telefone;

  // Dedup: se já existe mensagem com esse provider_message_id, ignora.
  const existente = await supabase
    .from("pipeline_conversa_mensagem")
    .select("id")
    .eq("provider_message_id", evento.providerMessageId)
    .maybeSingle();
  if (existente.data) return;

  // Casa vínculo (lead + responsável).
  const [leadsRes, respsRes] = await Promise.all([
    supabase.from("pipeline_lead").select("id, telefone").eq("escola_id", DEFAULT_SCHOOL_ID),
    supabase
      .from("responsaveis_aluno")
      .select("id, aluno_id, telefone, celular")
      .eq("escola_id", DEFAULT_SCHOOL_ID),
  ]);
  const resps = (respsRes.data ?? []).map((r: any) => ({
    id: r.id, aluno_id: r.aluno_id, telefone: r.celular ?? r.telefone,
  }));
  const vinculo = casarConversa(telefone, leadsRes.data ?? [], resps);

  const agora = new Date();
  const janelaExpira = new Date(agora.getTime() + JANELA_HORAS * 3600 * 1000).toISOString();
  const preview = evento.tipo === "imagem" ? "📷 Imagem" : (evento.texto ?? "").slice(0, 120);

  // Upsert da conversa (única por escola+telefone).
  const conversaExistente = await supabase
    .from("pipeline_conversa")
    .select("id, nao_lidas")
    .eq("escola_id", DEFAULT_SCHOOL_ID)
    .eq("telefone", telefone)
    .maybeSingle();

  let conversaId: string;
  if (conversaExistente.data) {
    conversaId = conversaExistente.data.id;
    await supabase
      .from("pipeline_conversa")
      .update({
        nao_lidas: (conversaExistente.data.nao_lidas ?? 0) + 1,
        janela_expira_em: janelaExpira,
        ultima_msg_em: agora.toISOString(),
        ultima_msg_preview: preview,
        nome_whatsapp: evento.nome ?? undefined,
        ...vinculo,
      })
      .eq("id", conversaId);
  } else {
    const nova = await supabase
      .from("pipeline_conversa")
      .insert({
        escola_id: DEFAULT_SCHOOL_ID,
        telefone,
        nome_whatsapp: evento.nome,
        nao_lidas: 1,
        janela_expira_em: janelaExpira,
        ultima_msg_em: agora.toISOString(),
        ultima_msg_preview: preview,
        ...vinculo,
      })
      .select("id")
      .single();
    if (nova.error || !nova.data) return;
    conversaId = nova.data.id;
  }

  // Baixa mídia se for imagem.
  let midiaUrl: string | null = null;
  let texto = evento.texto;
  if (evento.tipo === "imagem" && evento.mediaId) {
    midiaUrl = await baixarMidia(supabase, evento.mediaId, conversaId);
    if (!midiaUrl) texto = texto ?? "[imagem não recebida]";
  }

  // Insere a mensagem de entrada.
  await supabase.from("pipeline_conversa_mensagem").insert({
    escola_id: DEFAULT_SCHOOL_ID,
    conversa_id: conversaId,
    direcao: "entrada",
    tipo: evento.tipo,
    texto,
    midia_url: midiaUrl,
    provider_message_id: evento.providerMessageId,
  });
}
```

> Confirmar no schema os nomes reais de `responsaveis_aluno` (colunas `telefone`/`celular`/`aluno_id`/`escola_id`). Ajustar o `.select` e o `.map` se diferirem. `createAdminClient` é importado pela rota (Task 5), não aqui.

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/whatsapp/inbox-receive.ts
git commit -m "feat(whatsapp): processamento do evento inbound (conversa + midia)"
```

---

## Task 5: Rota do webhook (`/api/whatsapp/webhook`)

**Files:**
- Create: `src/app/api/whatsapp/webhook/route.ts`
- Modify: `.env.example` (documentar envs)

**Interfaces:**
- Consumes: `validarAssinaturaWebhook`, `parsearEventoWebhook` (Task 3); `processarEventoInbound` (Task 4); `createAdminClient`.

> I/O — validação manual. Espelha o padrão de `src/app/api/asaas/webhook/route.ts`.

- [ ] **Step 1: Implementar a rota**

```typescript
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  validarAssinaturaWebhook,
  parsearEventoWebhook,
} from "@/lib/whatsapp/inbox-parser";
import { processarEventoInbound } from "@/lib/whatsapp/inbox-receive";

export const dynamic = "force-dynamic";

// Verificação inicial da Meta.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  if (mode === "subscribe" && token && token === process.env.META_VERIFY_TOKEN) {
    return new NextResponse(challenge ?? "", { status: 200 });
  }
  return new NextResponse("forbidden", { status: 403 });
}

export async function POST(req: Request) {
  const secret = process.env.META_APP_SECRET;
  const rawBody = await req.text();
  const assinatura = req.headers.get("x-hub-signature-256");

  if (!secret || !validarAssinaturaWebhook(rawBody, assinatura, secret)) {
    return NextResponse.json({ error: "assinatura inválida" }, { status: 401 });
  }

  const payload = JSON.parse(rawBody);
  const eventos = parsearEventoWebhook(payload);

  // Responde 200 já; processa em seguida (best-effort, sem travar a Meta).
  if (eventos.length > 0) {
    const supabase = createAdminClient();
    for (const evento of eventos) {
      try {
        await processarEventoInbound(evento, supabase as any);
      } catch (err) {
        console.error("[whatsapp/webhook] falha ao processar evento:", err);
      }
    }
  }

  return NextResponse.json({ ok: true });
}
```

> Confirmar o nome real do helper admin (`createAdminClient` em `@/lib/supabase/admin`). Em `gate-events.ts` o projeto já usa `createAdminClient` — reaproveitar o mesmo import.

- [ ] **Step 2: Documentar as envs**

Adicionar em `.env.example` (criar a seção se não existir):

```
# WhatsApp Inbox (Fase 6)
META_VERIFY_TOKEN=
META_APP_SECRET=
```

- [ ] **Step 3: Typecheck + build**

Run: `npm run typecheck && npm run build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/whatsapp/webhook/route.ts .env.example
git commit -m "feat(whatsapp): rota do webhook (GET verify + POST receive)"
```

---

## Task 6: Leitura de dados do inbox (`src/lib/data/inbox.ts`)

**Files:**
- Create: `src/lib/data/inbox.ts`

**Interfaces:**
- Consumes: `requirePermission`, `createServerClient`.
- Produces:
  - `type ConversaResumo = { id, telefone, nome_whatsapp, lead_id, aluno_id, responsavel_id, assigned_to, nao_lidas, janela_expira_em, ultima_msg_em, ultima_msg_preview }`
  - `getConversas(filtro: "todas" | "minhas" | "nao_lidas"): Promise<ConversaResumo[]>`
  - `type MensagemThread = { id, direcao, tipo, texto, midia_url, status, created_at }`
  - `getMensagensConversa(conversaId: string): Promise<MensagemThread[]>`

> Leitura usa RLS (cliente de sessão), não admin. I/O — validação manual; sem teste unitário.

- [ ] **Step 1: Implementar**

```typescript
import "server-only";
import { requirePermission } from "@/lib/auth/session";
import { createServerClient } from "@/lib/supabase/server";

export type ConversaResumo = {
  id: string;
  telefone: string;
  nome_whatsapp: string | null;
  lead_id: string | null;
  aluno_id: string | null;
  responsavel_id: string | null;
  assigned_to: string | null;
  nao_lidas: number;
  janela_expira_em: string | null;
  ultima_msg_em: string;
  ultima_msg_preview: string | null;
};

export type MensagemThread = {
  id: string;
  direcao: "entrada" | "saida";
  tipo: "texto" | "imagem" | "template";
  texto: string | null;
  midia_url: string | null;
  status: string | null;
  created_at: string;
};

export async function getConversas(
  filtro: "todas" | "minhas" | "nao_lidas",
): Promise<ConversaResumo[]> {
  const session = await requirePermission("whatsapp_inbox", "read");
  const supabase = await createServerClient();
  let q = supabase
    .from("pipeline_conversa")
    .select(
      "id, telefone, nome_whatsapp, lead_id, aluno_id, responsavel_id, assigned_to, nao_lidas, janela_expira_em, ultima_msg_em, ultima_msg_preview",
    )
    .eq("status", "aberta")
    .order("ultima_msg_em", { ascending: false });

  if (filtro === "minhas") q = q.eq("assigned_to", session.profile.id);
  if (filtro === "nao_lidas") q = q.gt("nao_lidas", 0);

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as ConversaResumo[];
}

export async function getMensagensConversa(conversaId: string): Promise<MensagemThread[]> {
  await requirePermission("whatsapp_inbox", "read");
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("pipeline_conversa_mensagem")
    .select("id, direcao, tipo, texto, midia_url, status, created_at")
    .eq("conversa_id", conversaId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as MensagemThread[];
}
```

> Confirmar a assinatura real de `requirePermission` e o shape de `session.profile.id` em `src/lib/auth/session.ts` (usado em `pipeline.ts`).

- [ ] **Step 2: Typecheck + commit**

```bash
npm run typecheck
git add src/lib/data/inbox.ts
git commit -m "feat(whatsapp): leitura de conversas e mensagens do inbox"
```

---

## Task 7: Server actions do inbox (`src/lib/actions/whatsapp-inbox.ts`)

**Files:**
- Create: `src/lib/actions/whatsapp-inbox.ts`

**Interfaces:**
- Consumes: `requirePermission`, `createServerClient`, `createAdminClient`; `sendText`, `sendImage` (Task 2); `sendTemplate`, `montarComponentsTemplate` (existentes); `janelaAberta` (Task 3); `getMensagensConversa` (Task 6).
- Produces:
  - `ActionResult<T>` (mesma forma do pipeline)
  - `marcarLidaAction(conversaId): Promise<ActionResult>`
  - `responderTextoAction(conversaId, texto): Promise<ActionResult>`
  - `responderImagemAction(conversaId, imagemUrl, legenda?): Promise<ActionResult>`
  - `responderTemplateAction(conversaId, templateId, variaveis): Promise<ActionResult>`
  - `atribuirConversaAction(conversaId, perfilId | null): Promise<ActionResult>`
  - `arquivarConversaAction(conversaId): Promise<ActionResult>`

> I/O — sem teste unitário (a lógica testável de janela já está coberta no Task 3). Validação manual.

- [ ] **Step 1: Implementar (esqueleto + ações de envio)**

```typescript
"use server";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/session";
import { createServerClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { sendText, sendImage, sendTemplate } from "@/lib/whatsapp/meta";
import { janelaAberta } from "@/lib/whatsapp/inbox-parser";

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

const IDIOMA = "pt_BR";

async function ctxConversa(conversaId: string) {
  const session = await requirePermission("whatsapp_inbox", "read");
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("pipeline_conversa")
    .select("id, telefone, janela_expira_em")
    .eq("id", conversaId)
    .single();
  if (error || !data) throw new Error("Conversa não encontrada");
  return { session, supabase, conversa: data };
}

export async function marcarLidaAction(conversaId: string): Promise<ActionResult> {
  try {
    const { supabase } = await ctxConversa(conversaId);
    await supabase.from("pipeline_conversa").update({ nao_lidas: 0 }).eq("id", conversaId);
    revalidatePath("/whatsapp");
    return { ok: true, data: undefined };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro" };
  }
}

export async function responderTextoAction(
  conversaId: string,
  texto: string,
): Promise<ActionResult> {
  try {
    const parsed = z.string().min(1).max(4000).safeParse(texto);
    if (!parsed.success) return { ok: false, error: "Mensagem vazia ou longa demais" };
    const { session, supabase, conversa } = await ctxConversa(conversaId);
    if (!janelaAberta(conversa.janela_expira_em, new Date())) {
      return { ok: false, error: "Janela de 24h fechada — use um template" };
    }
    const r = await sendText({ telefone: conversa.telefone, mensagem: parsed.data });
    await supabase.from("pipeline_conversa_mensagem").insert({
      escola_id: session.profile.escola_id,
      conversa_id: conversaId,
      direcao: "saida",
      tipo: "texto",
      texto: parsed.data,
      status: r.ok ? "enviada" : "falha",
      erro: r.ok ? null : r.reason,
      provider_message_id: r.ok ? r.providerMessageId : null,
      enviada_por: session.profile.id,
    });
    await supabase.from("pipeline_conversa").update({
      ultima_msg_em: new Date().toISOString(),
      ultima_msg_preview: parsed.data.slice(0, 120),
    }).eq("id", conversaId);
    revalidatePath("/whatsapp");
    return r.ok ? { ok: true, data: undefined } : { ok: false, error: r.reason };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro" };
  }
}
```

- [ ] **Step 2: Adicionar `responderImagemAction`**

```typescript
export async function responderImagemAction(
  conversaId: string,
  imagemUrl: string,
  legenda?: string,
): Promise<ActionResult> {
  try {
    const { session, supabase, conversa } = await ctxConversa(conversaId);
    if (!janelaAberta(conversa.janela_expira_em, new Date())) {
      return { ok: false, error: "Janela de 24h fechada — use um template" };
    }
    const r = await sendImage({ telefone: conversa.telefone, imagemUrl, legenda });
    await supabase.from("pipeline_conversa_mensagem").insert({
      escola_id: session.profile.escola_id,
      conversa_id: conversaId,
      direcao: "saida",
      tipo: "imagem",
      texto: legenda ?? null,
      midia_url: imagemUrl,
      status: r.ok ? "enviada" : "falha",
      erro: r.ok ? null : r.reason,
      provider_message_id: r.ok ? r.providerMessageId : null,
      enviada_por: session.profile.id,
    });
    await supabase.from("pipeline_conversa").update({
      ultima_msg_em: new Date().toISOString(),
      ultima_msg_preview: "📷 Imagem",
    }).eq("id", conversaId);
    revalidatePath("/whatsapp");
    return r.ok ? { ok: true, data: undefined } : { ok: false, error: r.reason };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro" };
  }
}
```

- [ ] **Step 3: Adicionar `responderTemplateAction`, `atribuirConversaAction`, `arquivarConversaAction`**

```typescript
export async function responderTemplateAction(
  conversaId: string,
  templateId: string,
  variaveis: string[],
): Promise<ActionResult> {
  try {
    const { session, supabase, conversa } = await ctxConversa(conversaId);
    const tpl = await supabase
      .from("pipeline_template_whatsapp")
      .select("nome_template, descricao")
      .eq("id", templateId)
      .single();
    if (tpl.error || !tpl.data) return { ok: false, error: "Template não encontrado" };
    const r = await sendTemplate({
      telefone: conversa.telefone,
      templateName: tpl.data.nome_template,
      idioma: IDIOMA,
      variaveis,
    });
    await supabase.from("pipeline_conversa_mensagem").insert({
      escola_id: session.profile.escola_id,
      conversa_id: conversaId,
      direcao: "saida",
      tipo: "template",
      texto: tpl.data.descricao,
      status: r.ok ? "enviada" : "falha",
      erro: r.ok ? null : r.reason,
      provider_message_id: r.ok ? r.providerMessageId : null,
      enviada_por: session.profile.id,
    });
    await supabase.from("pipeline_conversa").update({
      ultima_msg_em: new Date().toISOString(),
      ultima_msg_preview: tpl.data.descricao.slice(0, 120),
    }).eq("id", conversaId);
    revalidatePath("/whatsapp");
    return r.ok ? { ok: true, data: undefined } : { ok: false, error: r.reason };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro" };
  }
}

export async function atribuirConversaAction(
  conversaId: string,
  perfilId: string | null,
): Promise<ActionResult> {
  try {
    const { supabase } = await ctxConversa(conversaId);
    await supabase.from("pipeline_conversa").update({ assigned_to: perfilId }).eq("id", conversaId);
    revalidatePath("/whatsapp");
    return { ok: true, data: undefined };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro" };
  }
}

export async function arquivarConversaAction(conversaId: string): Promise<ActionResult> {
  try {
    const { supabase } = await ctxConversa(conversaId);
    await supabase.from("pipeline_conversa").update({ status: "arquivada" }).eq("id", conversaId);
    revalidatePath("/whatsapp");
    return { ok: true, data: undefined };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro" };
  }
}
```

> Confirmar `session.profile.escola_id` e `session.profile.id` (mesmo shape usado em `pipeline.ts`).

- [ ] **Step 4: Typecheck + build + commit**

```bash
npm run typecheck && npm run build
git add src/lib/actions/whatsapp-inbox.ts
git commit -m "feat(whatsapp): server actions do inbox (responder, atribuir, arquivar)"
```

---

## Task 8: Chip de vínculo (`vinculo-chip.tsx`)

**Files:**
- Create: `src/components/whatsapp/vinculo-chip.tsx`

**Interfaces:**
- Produces: `<VinculoChip lead_id aluno_id responsavel_id />` — renderiza 🎓 Lead / 👤 Resp. / ❓ Sem vínculo.

> Componente de apresentação puro. Sem teste unitário (visual). Tokens do DS, sem cor crua.

- [ ] **Step 1: Implementar**

```tsx
type VinculoChipProps = {
  lead_id: string | null;
  aluno_id: string | null;
  responsavel_id: string | null;
};

export function VinculoChip({ lead_id, aluno_id, responsavel_id }: VinculoChipProps) {
  if (lead_id) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs bg-[var(--color-success-soft)] text-[var(--color-success-strong)]">
        🎓 Lead
      </span>
    );
  }
  if (aluno_id || responsavel_id) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs bg-[var(--color-info-soft)] text-[var(--color-info-strong)]">
        👤 Responsável
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs bg-[var(--color-muted)] text-[var(--color-text-soft)]">
      ❓ Sem vínculo
    </span>
  );
}
```

> Substituir os nomes de token pelos reais do DS do projeto. Conferir em `docs/design_system/src/rrb-tokens.css` os tokens equivalentes a "success soft / info soft / muted". Não inventar token novo — usar o que existe.

- [ ] **Step 2: Typecheck + commit**

```bash
npm run typecheck
git add src/components/whatsapp/vinculo-chip.tsx
git commit -m "feat(whatsapp): chip de vinculo da conversa"
```

---

## Task 9: Página, lista, thread e realtime (UI)

**Files:**
- Create: `src/app/(app)/whatsapp/page.tsx`
- Create: `src/components/whatsapp/inbox-client.tsx`
- Create: `src/components/whatsapp/conversa-lista.tsx`
- Create: `src/components/whatsapp/conversa-thread.tsx`

**Interfaces:**
- Consumes: `getConversas`, `getMensagensConversa`, `ConversaResumo`, `MensagemThread` (Task 6); actions (Task 7); `VinculoChip` (Task 8); `janelaAberta` (Task 3); browser Supabase client (padrão do board do pipeline).

> UI — validação manual. Reusar o padrão de subscription Realtime já usado no board do pipeline (procurar o componente client do pipeline que faz `supabase.channel(...).on("postgres_changes", ...)`).

- [ ] **Step 1: Página (server component)**

`src/app/(app)/whatsapp/page.tsx`:

```tsx
import { getConversas } from "@/lib/data/inbox";
import { InboxClient } from "@/components/whatsapp/inbox-client";

export const dynamic = "force-dynamic";

export default async function WhatsappPage() {
  const conversas = await getConversas("todas");
  return (
    <div className="h-[calc(100vh-var(--topbar-h,64px))]">
      <InboxClient conversasIniciais={conversas} />
    </div>
  );
}
```

> Ajustar a altura/wrapper ao padrão das outras páginas `(app)`.

- [ ] **Step 2: Client component com estado + realtime**

`src/components/whatsapp/inbox-client.tsx` — mantém: lista de conversas, conversa selecionada, mensagens; subscription realtime em `pipeline_conversa` e `pipeline_conversa_mensagem`; ao selecionar, chama `getMensagensConversa` (via action de leitura ou route handler) e `marcarLidaAction`. Renderiza `<ConversaLista>` + `<ConversaThread>` lado a lado.

Estrutura (preencher com o padrão real de client do pipeline para realtime e leitura):

```tsx
"use client";
import { useState, useEffect, useCallback } from "react";
import type { ConversaResumo, MensagemThread } from "@/lib/data/inbox";
import { ConversaLista } from "./conversa-lista";
import { ConversaThread } from "./conversa-thread";
import { marcarLidaAction } from "@/lib/actions/whatsapp-inbox";
// import { createBrowserClient } from "@/lib/supabase/client"; // confirmar caminho real

type Filtro = "todas" | "minhas" | "nao_lidas";

export function InboxClient({ conversasIniciais }: { conversasIniciais: ConversaResumo[] }) {
  const [conversas, setConversas] = useState(conversasIniciais);
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [selecionada, setSelecionada] = useState<ConversaResumo | null>(null);
  const [mensagens, setMensagens] = useState<MensagemThread[]>([]);

  const abrir = useCallback(async (c: ConversaResumo) => {
    setSelecionada(c);
    // buscar mensagens via route handler GET /api/whatsapp/conversa/[id] OU server action de leitura
    const res = await fetch(`/api/whatsapp/conversa/${c.id}`);
    setMensagens(res.ok ? await res.json() : []);
    await marcarLidaAction(c.id);
    setConversas((prev) => prev.map((p) => (p.id === c.id ? { ...p, nao_lidas: 0 } : p)));
  }, []);

  useEffect(() => {
    // Subscription realtime — reusar padrão do board do pipeline.
    // const supabase = createBrowserClient();
    // const ch = supabase.channel("inbox")
    //   .on("postgres_changes", { event: "*", schema: "public", table: "pipeline_conversa" }, recarregar)
    //   .on("postgres_changes", { event: "INSERT", schema: "public", table: "pipeline_conversa_mensagem" }, onNovaMsg)
    //   .subscribe();
    // return () => { supabase.removeChannel(ch); };
  }, []);

  const visiveis = conversas.filter((c) =>
    filtro === "nao_lidas" ? c.nao_lidas > 0 : true,
  );

  return (
    <div className="flex h-full">
      <ConversaLista
        conversas={visiveis}
        filtro={filtro}
        onFiltro={setFiltro}
        selecionadaId={selecionada?.id ?? null}
        onSelecionar={abrir}
      />
      <ConversaThread conversa={selecionada} mensagens={mensagens} onEnviado={() => selecionada && abrir(selecionada)} />
    </div>
  );
}
```

> Decisão de leitura: criar um route handler `GET /api/whatsapp/conversa/[id]/route.ts` que chama `getMensagensConversa` (mais simples para o client) OU expor `getMensagensConversa` como server action. Escolher um e manter. O filtro "minhas" requer o id do perfil no client — passar via prop a partir da sessão na página.

- [ ] **Step 3: Lista de conversas**

`src/components/whatsapp/conversa-lista.tsx` — busca, filtros (Todas/Minhas/Não lidas), item por conversa com nome/telefone, preview, hora, badge de não lidas e `<VinculoChip>`. Tokens do DS.

- [ ] **Step 4: Thread + caixa de envio**

`src/components/whatsapp/conversa-thread.tsx` — cabeçalho com vínculo + badge da janela (usar `janelaAberta(conversa.janela_expira_em, new Date())`) + botão Atribuir; balões entrada/saída; imagens inline (`<img src={midia_url}>`); caixa de envio com texto + anexo de imagem quando aberta; bloco "texto bloqueado + Enviar template" quando fechada. Chama `responderTextoAction` / `responderImagemAction` / `responderTemplateAction`.

> Para anexo de imagem enviada: subir a imagem no bucket `whatsapp-inbox` (via route handler de upload ou action que recebe FormData) e passar a URL assinada para `responderImagemAction`. Confirmar o padrão de upload já usado no projeto (ex.: portaria/anamnese) e reusar.

- [ ] **Step 5: Link no menu (hardcoded)**

Modificar `src/components/layout/topbar.tsx`: adicionar manualmente o item de menu `{ href: "/whatsapp", label: "WhatsApp", modulo: "whatsapp_inbox" }` (seguir o shape exato do array existente — ver memória `project_menu_hardcoded`). O RBAC já filtra por `whatsapp_inbox`.

- [ ] **Step 6: Typecheck + build**

Run: `npm run typecheck && npm run build`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/app/\(app\)/whatsapp src/components/whatsapp src/components/layout/topbar.tsx
git commit -m "feat(whatsapp): UI do inbox (pagina, lista, thread, realtime, menu)"
```

---

## Task 10: Verificação manual end-to-end

**Files:** nenhum (validação).

> Esta task não tem código — é o roteiro de validação manual do que não tem teste unitário (webhook, mídia, realtime, envio).

- [ ] **Step 1: Aplicar migration + criar bucket**

```bash
supabase db push
```
No painel Supabase Storage, criar o bucket **`whatsapp-inbox`** (privado).

- [ ] **Step 2: Configurar envs e webhook na Meta**

- Setar `META_VERIFY_TOKEN` e `META_APP_SECRET` (local e Vercel).
- No painel da Meta: URL `https://<dominio>/api/whatsapp/webhook`, `verify_token` igual ao env, assinar o campo `messages`.
- Confirmar que o GET de verificação retorna o `hub.challenge`.

- [ ] **Step 3: Roteiro de teste**

1. Enviar um WhatsApp de um número que **é lead** → conversa aparece no inbox com chip 🎓 Lead, badge não lida, realtime.
2. Enviar de um número que **é responsável de aluno** → chip 👤 Responsável.
3. Enviar de número **desconhecido** → ❓ Sem vínculo, só telefone/nome.
4. Enviar **imagem** → renderiza inline na thread.
5. Reenvio do mesmo evento (Meta retenta) → **não** duplica (dedup por `provider_message_id`).
6. Responder **texto** dentro da janela → chega no WhatsApp; balão saída `enviada`.
7. Anexar e enviar **imagem** dentro da janela → chega no WhatsApp.
8. Forçar janela fechada (ajustar `janela_expira_em` no banco para o passado) → caixa de texto bloqueada, só template; enviar template funciona.
9. Atribuir conversa a um perfil; filtro "Minhas" mostra só as atribuídas a ele.
10. Usuário sem `whatsapp_inbox:read` **não** vê o link nem a página.

- [ ] **Step 4: Commit (se houver ajuste de doc)**

```bash
git add -A
git commit -m "docs(whatsapp): roteiro de validacao manual do inbox"
```

---

## Notas de implementação (confirmar antes de codar)

Estes pontos dependem de nomes reais do schema/código e devem ser conferidos na hora (não bloqueiam o desenho, mas evitam retrabalho):

1. **`responsaveis_aluno`** — nomes reais das colunas de telefone (`telefone` vs `celular`), `aluno_id`, `escola_id`. Ajustar Task 4.
2. **`createAdminClient`** — caminho real do helper (usado em `gate-events.ts`). Ajustar imports Task 4/5.
3. **`requirePermission` / `session.profile`** — assinatura e shape (`id`, `escola_id`) conforme `src/lib/auth/session.ts`. Tasks 6/7.
4. **Browser Supabase client + padrão Realtime** — copiar do client component do board do pipeline. Task 9.
5. **Tokens do DS** — mapear os nomes reais em `docs/design_system/src/rrb-tokens.css`. Task 8/9.
6. **Padrão de upload de imagem** — reusar o já existente (portaria/anamnese) para a imagem enviada. Task 9.
7. **`modulos`/`role_permissoes`** — confirmar colunas e a existência da role `coordenacao`. Task 1.
