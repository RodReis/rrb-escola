# Notificação de Portaria via WhatsApp — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Avisar o responsável via WhatsApp quando o aluno entra/sai da escola, com a foto capturada na portaria, usando a Meta Cloud API.

**Architecture:** O `POST /api/portaria/evento` recebe a foto em base64, sobe no Storage e gera URL. `registerGateEvent` envia via `enviarWhatsApp` (camada Meta) escolhendo entre dois templates (com foto / sem foto). O log unifica em `mensagens_whatsapp`; a tabela `notificacoes_responsavel` e o webhook genérico são removidos.

**Tech Stack:** TypeScript, Next.js 14, Supabase (Postgres + Storage), Vitest, Meta Cloud API.

**Spec:** `docs/superpowers/specs/2026-05-21-portaria-notificacao-design.md`
**Branch:** criar `feature/portaria-notificacao` a partir de `developer`.

---

## File Structure

**Criar:**
- `supabase/migrations/202605310005_portaria_notificacao.sql` — bucket + drop tabela
- `src/lib/portaria/notificacao.ts` — função pura `montarNotificacaoPortaria`
- `src/lib/portaria/notificacao.test.ts` — testes

**Modificar:**
- `src/lib/server/gate-events.ts` — `registerGateEvent` notifica via Meta
- `src/app/api/portaria/evento/route.ts` — recebe `foto_base64`, sobe no Storage
- `src/lib/data/gate.ts` — `getGateNotifications` lê `mensagens_whatsapp`
- `src/app/(app)/portaria/notificacoes/page.tsx` — ajusta para o novo shape
- `src/lib/actions/gate.ts` — remove `retryGuardianNotificationAction`
- `.env.local` — adiciona META_TEMPLATE_PORTARIA_*, remove WHATSAPP_WEBHOOK_*

**Apagar:**
- `src/lib/server/guardian-notifications.ts`

---

## Task 0: Branch

- [ ] **Step 1: Criar a branch a partir de `developer`**

Run:
```bash
git checkout developer
git checkout -b feature/portaria-notificacao
```
Expected: `Switched to a new branch 'feature/portaria-notificacao'`.

---

## Task 1: Função pura `montarNotificacaoPortaria` (TDD)

Decide o template (com foto / sem foto) e monta as variáveis da notificação.

**Files:**
- Create: `src/lib/portaria/notificacao.ts`
- Create: `src/lib/portaria/notificacao.test.ts`

- [ ] **Step 1: Escrever o teste**

`src/lib/portaria/notificacao.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { montarNotificacaoPortaria } from "./notificacao";

const templates = { comFoto: "portaria_acesso_foto", semFoto: "portaria_acesso_texto" };

// 2026-03-10T13:04 em America/Sao_Paulo. Date em UTC: 13:04 -03:00 = 16:04 UTC.
const dataEvento = new Date("2026-03-10T16:04:00Z");

describe("montarNotificacaoPortaria", () => {
  it("com foto usa o template de foto e inclui imagemUrl", () => {
    const r = montarNotificacaoPortaria(
      { nomeAluno: "João Silva", tipo: "entrada", dataEvento, fotoUrl: "https://x.com/f.jpg" },
      templates,
    );
    expect(r.templateName).toBe("portaria_acesso_foto");
    expect(r.imagemUrl).toBe("https://x.com/f.jpg");
  });

  it("sem foto usa o template de texto e não tem imagemUrl", () => {
    const r = montarNotificacaoPortaria(
      { nomeAluno: "João Silva", tipo: "entrada", dataEvento, fotoUrl: null },
      templates,
    );
    expect(r.templateName).toBe("portaria_acesso_texto");
    expect(r.imagemUrl).toBeUndefined();
  });

  it("entrada usa o verbo 'entrou'", () => {
    const r = montarNotificacaoPortaria(
      { nomeAluno: "João Silva", tipo: "entrada", dataEvento, fotoUrl: null },
      templates,
    );
    expect(r.variaveis).toEqual(["João Silva", "entrou", "13:04"]);
  });

  it("saída usa o verbo 'saiu'", () => {
    const r = montarNotificacaoPortaria(
      { nomeAluno: "Maria", tipo: "saida", dataEvento, fotoUrl: null },
      templates,
    );
    expect(r.variaveis).toEqual(["Maria", "saiu", "13:04"]);
  });

  it("horário formatado em America/Sao_Paulo", () => {
    // 2026-03-10T20:30 UTC = 17:30 em São Paulo.
    const r = montarNotificacaoPortaria(
      { nomeAluno: "Ana", tipo: "entrada", dataEvento: new Date("2026-03-10T20:30:00Z"), fotoUrl: null },
      templates,
    );
    expect(r.variaveis[2]).toBe("17:30");
  });

  it("textoLog descreve o evento de forma legível", () => {
    const r = montarNotificacaoPortaria(
      { nomeAluno: "João Silva", tipo: "entrada", dataEvento, fotoUrl: null },
      templates,
    );
    expect(r.textoLog).toBe("João Silva entrou na escola às 13:04.");
  });
});
```

- [ ] **Step 2: Rodar — deve FALHAR**

Run: `npx vitest run src/lib/portaria/notificacao.test.ts`
Expected: FAIL — `montarNotificacaoPortaria` não existe.

- [ ] **Step 3: Implementar**

`src/lib/portaria/notificacao.ts`:

```typescript
export type TipoAcesso = "entrada" | "saida";

export type DadosNotificacaoPortaria = {
  nomeAluno: string;
  tipo: TipoAcesso;
  dataEvento: Date;
  fotoUrl: string | null;
};

export type TemplatesPortaria = {
  comFoto: string;
  semFoto: string;
};

export type NotificacaoPortaria = {
  templateName: string;
  variaveis: string[];
  imagemUrl?: string;
  textoLog: string;
};

function horarioSP(data: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  }).format(data);
}

// Decide o template (foto/texto) e monta as variáveis da notificação de portaria.
export function montarNotificacaoPortaria(
  dados: DadosNotificacaoPortaria,
  templates: TemplatesPortaria,
): NotificacaoPortaria {
  const verbo = dados.tipo === "entrada" ? "entrou" : "saiu";
  const horario = horarioSP(dados.dataEvento);
  const variaveis = [dados.nomeAluno, verbo, horario];
  const textoLog = `${dados.nomeAluno} ${verbo} na escola às ${horario}.`;

  if (dados.fotoUrl) {
    return {
      templateName: templates.comFoto,
      variaveis,
      imagemUrl: dados.fotoUrl,
      textoLog,
    };
  }

  return {
    templateName: templates.semFoto,
    variaveis,
    textoLog,
  };
}
```

- [ ] **Step 4: Rodar — deve PASSAR**

Run: `npx vitest run src/lib/portaria/notificacao.test.ts`
Expected: PASS — 6 testes.

- [ ] **Step 5: Commit**

```bash
git add src/lib/portaria/notificacao.ts src/lib/portaria/notificacao.test.ts
git commit -m "feat(portaria): add gate notification message builder"
```

---

## Task 2: Migração — bucket de fotos e drop da tabela antiga

**Files:**
- Create: `supabase/migrations/202605310005_portaria_notificacao.sql`

- [ ] **Step 1: Criar a migração**

`supabase/migrations/202605310005_portaria_notificacao.sql`:

```sql
-- Notificação de portaria: bucket de fotos capturadas + remoção da tabela antiga.

-- 1) Bucket privado para fotos capturadas na portaria
insert into storage.buckets (id, name, public)
values ('portaria-eventos', 'portaria-eventos', false)
on conflict (id) do nothing;

create policy "portaria eventos read" on storage.objects for select to authenticated
  using (bucket_id = 'portaria-eventos' and exists (select 1 from current_perfil()));

create policy "portaria eventos service" on storage.objects for all to service_role
  using (bucket_id = 'portaria-eventos') with check (bucket_id = 'portaria-eventos');

-- 2) Remove a tabela antiga de notificações (substituída por mensagens_whatsapp).
--    Tabela está vazia em produção — drop seguro.
drop table if exists notificacoes_responsavel;
```

- [ ] **Step 2: Aplicar via MCP Supabase**

Aplicar `202605310005_portaria_notificacao.sql` no projeto `fljkjhmwnjehsodvqaqk` via MCP
`apply_migration` (name: `202605310005_portaria_notificacao`).
Expected: `{"success": true}`.

- [ ] **Step 3: Verificar**

Via MCP `execute_sql` no projeto `fljkjhmwnjehsodvqaqk`:

```sql
SELECT id FROM storage.buckets WHERE id='portaria-eventos';
SELECT to_regclass('public.notificacoes_responsavel') AS tabela;
```

Expected: bucket `portaria-eventos` retorna 1 linha; `tabela` retorna `null` (dropada).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/202605310005_portaria_notificacao.sql
git commit -m "feat(portaria): add photo bucket, drop notificacoes_responsavel"
```

---

## Task 3: `registerGateEvent` notifica via Meta

Reescreve o trecho de notificação de `gate-events.ts`: remove `notificacoes_responsavel` /
`sendGuardianNotification`, passa a usar `enviarWhatsApp` com os templates de portaria.

**Files:**
- Modify: `src/lib/server/gate-events.ts`

- [ ] **Step 1: Ler o arquivo atual**

Run: `cat src/lib/server/gate-events.ts`
Expected: ver `registerGateEvent`, a função `eventMessage`, e o bloco `if (shouldNotify)`
que usa `notificacoes_responsavel` e `sendGuardianNotification`.

- [ ] **Step 2: Atualizar imports e assinatura**

No topo de `src/lib/server/gate-events.ts`:
- Remover: `import { sendGuardianNotification } from "@/lib/server/guardian-notifications";`
- Adicionar:
```typescript
import { enviarWhatsApp } from "@/lib/whatsapp/send";
import { montarNotificacaoPortaria } from "@/lib/portaria/notificacao";
```

Adicionar, após os imports, as constantes dos templates:
```typescript
const TEMPLATE_PORTARIA_FOTO = process.env.META_TEMPLATE_PORTARIA_FOTO ?? "portaria_acesso_foto";
const TEMPLATE_PORTARIA_TEXTO = process.env.META_TEMPLATE_PORTARIA_TEXTO ?? "portaria_acesso_texto";
```

Em `RegisterGateEventInput`, adicionar o campo:
```typescript
type RegisterGateEventInput = {
  alunoId: string;
  tipo: "entrada" | "saida";
  dispositivoId?: string | null;
  origem?: "manual" | "facial_simulado" | "facial";
  confianca?: number | null;
  observacao?: string | null;
  fotoUrl?: string | null;
};
```

A função `eventMessage` deixa de ser usada — removê-la.

- [ ] **Step 3: Reescrever o bloco de notificação**

Localizar o bloco que começa em `const { data: preference } = await supabase` e vai até
o fim do `if (shouldNotify) { ... }` (inclui a inserção em `notificacoes_responsavel` e a
chamada a `sendGuardianNotification`). Substituir TODO esse bloco por:

```typescript
  const { data: preference } = await supabase
    .from("preferencias_notificacao_aluno")
    .select("*, responsaveis_aluno(id, nome, celular, telefone)")
    .eq("aluno_id", input.alunoId)
    .eq("ativo", true)
    .maybeSingle();

  const shouldNotify =
    preference &&
    ((input.tipo === "entrada" && preference.notificar_entrada) ||
      (input.tipo === "saida" && preference.notificar_saida));

  let notificationId: string | null = null;

  if (shouldNotify) {
    const guardian = Array.isArray(preference.responsaveis_aluno)
      ? preference.responsaveis_aluno[0]
      : preference.responsaveis_aluno;
    const phone = preference.telefone_destino || guardian?.celular || guardian?.telefone;

    if (phone) {
      const notif = montarNotificacaoPortaria(
        {
          nomeAluno: student.nome,
          tipo: input.tipo,
          dataEvento: now,
          fotoUrl: input.fotoUrl ?? null,
        },
        { comFoto: TEMPLATE_PORTARIA_FOTO, semFoto: TEMPLATE_PORTARIA_TEXTO },
      );

      const envio = await enviarWhatsApp(
        {
          telefone: phone,
          templateName: notif.templateName,
          variaveis: notif.variaveis,
          textoLog: notif.textoLog,
          imagemUrl: notif.imagemUrl,
          alunoId: input.alunoId,
          referenciaTipo: "portaria",
          referenciaId: event.id,
        },
        supabase,
      );

      notificationId = envio.ok ? envio.mensagemId : null;
    }
  }
```

NOTA: `supabase` aqui é o `createAdminClient()` já criado no início de `registerGateEvent`
— passá-lo como 2º argumento de `enviarWhatsApp` é necessário (a portaria roda sem sessão
de usuário). `event.id` é o id de `eventos_acesso` já inserido acima no fluxo.

O `return` final da função permanece igual (já retorna `notificationId`).

- [ ] **Step 4: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: ERRO esperado em `api/portaria/evento/route.ts` (ainda não passa `fotoUrl`) e
em `guardian-notifications.ts` ainda existir não causa erro. Confirmar que NÃO há erro
dentro de `gate-events.ts`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/gate-events.ts
git commit -m "feat(portaria): notify guardian via Meta WhatsApp templates"
```

---

## Task 4: API recebe a foto e sobe no Storage

`POST /api/portaria/evento` aceita `foto_base64`, decodifica, sobe no bucket, passa a URL.

**Files:**
- Modify: `src/app/api/portaria/evento/route.ts`

- [ ] **Step 1: Reescrever a rota**

Substituir TODO o conteúdo de `src/app/api/portaria/evento/route.ts` por:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { isGateRequestAuthorized, unauthorizedGateResponse } from "@/lib/server/gate-api-auth";
import { registerGateEvent } from "@/lib/server/gate-events";
import { createAdminClient } from "@/lib/supabase/admin";

type GateEventPayload = {
  aluno_id?: string;
  tipo?: "entrada" | "saida";
  dispositivo_id?: string | null;
  origem?: "facial" | "facial_simulado" | "manual";
  confianca?: number | null;
  observacao?: string | null;
  foto_base64?: string | null;
};

const MAX_FOTO_BYTES = 2 * 1024 * 1024;

// Sobe a foto capturada no bucket portaria-eventos e retorna uma URL assinada.
// Retorna null se não houver foto ou se o upload falhar (não bloqueia o evento).
async function uploadFotoEvento(
  alunoId: string,
  fotoBase64: string,
): Promise<string | null> {
  try {
    // Aceita data URL ("data:image/jpeg;base64,...") ou base64 puro.
    const base64 = fotoBase64.includes(",") ? fotoBase64.split(",")[1] : fotoBase64;
    const buffer = Buffer.from(base64, "base64");
    if (buffer.length === 0 || buffer.length > MAX_FOTO_BYTES) return null;

    const supabase = createAdminClient();
    const path = `${alunoId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
    const { error: upErr } = await supabase.storage
      .from("portaria-eventos")
      .upload(path, buffer, { contentType: "image/jpeg", upsert: false });
    if (upErr) return null;

    const { data: signed } = await supabase.storage
      .from("portaria-eventos")
      .createSignedUrl(path, 60 * 60); // 1h — envio é síncrono em seguida
    return signed?.signedUrl ?? null;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  if (!isGateRequestAuthorized(request)) {
    return unauthorizedGateResponse();
  }

  const payload = (await request.json()) as GateEventPayload;
  if (!payload.aluno_id || (payload.tipo !== "entrada" && payload.tipo !== "saida")) {
    return NextResponse.json({ error: "payload invalido" }, { status: 400 });
  }

  const fotoUrl = payload.foto_base64
    ? await uploadFotoEvento(payload.aluno_id, payload.foto_base64)
    : null;

  const result = await registerGateEvent({
    alunoId: payload.aluno_id,
    tipo: payload.tipo,
    dispositivoId: payload.dispositivo_id,
    origem: payload.origem ?? "facial",
    confianca: payload.confianca ?? null,
    observacao: payload.observacao ?? "Evento recebido pela API da portaria",
    fotoUrl,
  });

  return NextResponse.json({ ok: true, ...result });
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros em `route.ts` nem em `gate-events.ts`. (Pode ainda haver erro se
`guardian-notifications.ts` for importado em outro lugar — resolvido na Task 5.)

- [ ] **Step 3: Commit**

```bash
git add "src/app/api/portaria/evento/route.ts"
git commit -m "feat(portaria): accept captured photo in gate event API"
```

---

## Task 5: Remover infra antiga de notificação

Apaga `guardian-notifications.ts` e remove `retryGuardianNotificationAction`.

**Files:**
- Delete: `src/lib/server/guardian-notifications.ts`
- Modify: `src/lib/actions/gate.ts`

- [ ] **Step 1: Remover `retryGuardianNotificationAction`**

Em `src/lib/actions/gate.ts`, localizar e apagar a função `retryGuardianNotificationAction`
inteira (começa em `export async function retryGuardianNotificationAction`). Se ela for o
único uso de algum import (ex: algo de `guardian-notifications` ou
`notificacoes_responsavel`), remover o import órfão.

- [ ] **Step 2: Confirmar que não há mais referências**

Run: `grep -rn "guardian-notifications\|sendGuardianNotification\|retryGuardianNotification\|notificacoes_responsavel" src/ --include=*.ts --include=*.tsx`
Expected: as ÚNICAS referências restantes devem estar em `src/lib/data/gate.ts` e
`src/app/(app)/portaria/notificacoes/page.tsx` — ambas serão corrigidas na Task 6.
Nenhuma referência a `guardian-notifications` ou `sendGuardianNotification`/`retryGuardian`.

- [ ] **Step 3: Apagar o arquivo**

Run: `git rm src/lib/server/guardian-notifications.ts`

- [ ] **Step 4: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: erro APENAS em `src/lib/data/gate.ts` e/ou `portaria/notificacoes/page.tsx`
(ainda referenciam a tabela / a action removida) — corrigido na Task 6.

- [ ] **Step 5: Commit**

```bash
git add src/lib/actions/gate.ts
git rm --cached src/lib/server/guardian-notifications.ts 2>$null
git commit -m "chore(portaria): remove legacy guardian notification code"
```

(NOTA: o `git rm` do Step 3 já removeu o arquivo do índice; o Step 5 só comita junto a
mudança em `gate.ts`. Se `git rm --cached` reclamar que o arquivo não existe, ignore — o
arquivo já está staged para remoção.)

---

## Task 6: Tela de notificações lê `mensagens_whatsapp`

`getGateNotifications` passa a ler `mensagens_whatsapp` filtrado por
`referencia_tipo = "portaria"`; a página ajusta para o novo shape.

**Files:**
- Modify: `src/lib/data/gate.ts`
- Modify: `src/app/(app)/portaria/notificacoes/page.tsx`

- [ ] **Step 1: Reescrever `getGateNotifications` em `gate.ts`**

Em `src/lib/data/gate.ts`, substituir a função `getGateNotifications` por:

```typescript
export async function getGateNotifications(status?: string) {
  const allowedStatuses = new Set(["pendente", "enviada", "falha"]);
  const supabase = await createServerClient();
  let query = supabase
    .from("mensagens_whatsapp")
    .select("id, telefone, mensagem, status, erro, provider_message_id, created_at, alunos(nome, matricula_codigo)")
    .eq("escola_id", DEFAULT_SCHOOL_ID)
    .eq("referencia_tipo", "portaria")
    .order("created_at", { ascending: false })
    .limit(100);

  if (status && allowedStatuses.has(status)) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}
```

NOTA: `mensagens_whatsapp` tem `aluno_id` FK para `alunos` — o join `alunos(nome,
matricula_codigo)` funciona. Se o join falhar por falta de relação nomeada, usar
`alunos:aluno_id(nome, matricula_codigo)`.

- [ ] **Step 2: Ajustar a página `portaria/notificacoes/page.tsx`**

Substituir TODO o conteúdo de `src/app/(app)/portaria/notificacoes/page.tsx` por:

```typescript
import { ArrowLeft, Bell } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { getGateNotifications } from "@/lib/data/gate";
import { requirePermission } from "@/lib/auth/session";

const filters = [
  { href: "/portaria/notificacoes", label: "Todas", value: "" },
  { href: "/portaria/notificacoes?status=falha", label: "Falhas", value: "falha" },
  { href: "/portaria/notificacoes?status=pendente", label: "Pendentes", value: "pendente" },
  { href: "/portaria/notificacoes?status=enviada", label: "Enviadas", value: "enviada" },
];

function statusTone(status: string): "green" | "red" | "gold" | "gray" {
  if (status === "enviada") return "green";
  if (status === "falha") return "red";
  if (status === "pendente") return "gold";
  return "gray";
}

type AlunoRel = { nome: string | null; matricula_codigo: string | null } | null;

export default async function GateNotificationsPage({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  await requirePermission("portaria", "read");
  const selectedStatus = searchParams.status ?? "";
  const notifications = await getGateNotifications(selectedStatus);

  return (
    <div className="grid gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-line bg-paper px-6 py-7">
        <div>
          <p className="ds-kicker">Portaria</p>
          <h1 className="mt-7 font-serif text-4xl text-ink">Notificações</h1>
          <p className="mt-3 max-w-2xl text-sm text-muted">
            Mensagens de entrada e saída enviadas aos responsáveis via WhatsApp.
          </p>
        </div>
        <ButtonLink href="/portaria" variant="secondary">
          <ArrowLeft size={14} /> Voltar para portaria
        </ButtonLink>
      </header>

      <nav className="flex flex-wrap gap-2">
        {filters.map((filter) => (
          <ButtonLink
            key={filter.href}
            href={filter.href}
            variant={selectedStatus === filter.value ? "primary" : "secondary"}
          >
            {filter.label}
          </ButtonLink>
        ))}
      </nav>

      <section className="overflow-hidden rounded-panel border border-line bg-surface shadow-soft">
        <div className="grid grid-cols-[1.4fr_0.8fr_0.8fr_0.8fr] border-b border-line bg-muted px-4 py-3 text-xs font-bold uppercase text-muted max-lg:hidden">
          <span>Aluno e mensagem</span>
          <span>Destino</span>
          <span>Status</span>
          <span>Envio</span>
        </div>

        <div className="grid bg-paper/70">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-ink/40">
              <Bell size={28} />
              <p className="text-sm font-medium">Nenhuma notificação encontrada.</p>
            </div>
          ) : null}
          {notifications.map((notification) => {
            const aluno = (notification.alunos as AlunoRel) ?? null;
            return (
              <div
                key={notification.id}
                className="grid gap-3 border-b border-line px-4 py-4 last:border-b-0 lg:grid-cols-[1.4fr_0.8fr_0.8fr_0.8fr]"
              >
                <div>
                  <strong>{aluno?.nome ?? "Aluno não localizado"}</strong>
                  <span className="block text-sm text-muted">{aluno?.matricula_codigo}</span>
                  <p className="mt-2 text-sm">{notification.mensagem}</p>
                  {notification.erro ? (
                    <p className="mt-2 text-sm font-bold text-clay">{notification.erro}</p>
                  ) : null}
                </div>
                <div className="text-sm">
                  <span className="block font-bold">WhatsApp</span>
                  <span className="text-muted">{notification.telefone || "Sem telefone"}</span>
                </div>
                <div>
                  <Badge tone={statusTone(notification.status)}>{notification.status}</Badge>
                  {notification.provider_message_id ? (
                    <p className="mt-2 text-xs text-muted">{notification.provider_message_id}</p>
                  ) : null}
                </div>
                <div className="text-sm text-muted">
                  {new Date(notification.created_at).toLocaleString("pt-BR")}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 3: Verificar tipos e build**

Run: `npx tsc --noEmit && npm run build`
Expected: sem erros; build passa.

- [ ] **Step 4: Commit**

```bash
git add src/lib/data/gate.ts "src/app/(app)/portaria/notificacoes/page.tsx"
git commit -m "feat(portaria): notifications screen reads mensagens_whatsapp"
```

---

## Task 7: Variáveis de ambiente

**Files:**
- Modify: `.env.local`

- [ ] **Step 1: Atualizar `.env.local`**

Em `.env.local`:

Remover (se existirem):
```
WHATSAPP_WEBHOOK_URL=...
WHATSAPP_WEBHOOK_TOKEN=...
```

Adicionar:
```
META_TEMPLATE_PORTARIA_FOTO=portaria_acesso_foto
META_TEMPLATE_PORTARIA_TEXTO=portaria_acesso_texto
```

NÃO commitar `.env.local` (está no `.gitignore`).

- [ ] **Step 2: Avisar o usuário**

Reportar ao final que o usuário deve:
1. Adicionar `META_TEMPLATE_PORTARIA_FOTO` e `META_TEMPLATE_PORTARIA_TEXTO` no `.env.local`
   e na Vercel.
2. Remover `WHATSAPP_WEBHOOK_URL` / `WHATSAPP_WEBHOOK_TOKEN` da Vercel (se configuradas).
3. No Meta Business Manager, aprovar dois templates (idioma pt_BR, categoria Utility):
   - `portaria_acesso_foto` — header de imagem + corpo 3 variáveis:
     `{{1}} {{2}} na escola às {{3}}.`
   - `portaria_acesso_texto` — só corpo, mesmas 3 variáveis.

---

## Task 8: Verificação final

- [ ] **Step 1: Rodar todos os testes**

Run: `npm test`
Expected: `notificacao.test.ts` (6) + suítes existentes (`meta` 5, `telefone` 10,
`dias-letivos` 10, `feriados` 14, `destinatarios` 6, `detectar` 8) = 59 passando.

- [ ] **Step 2: Build final**

Run: `npm run build`
Expected: passa sem erros.

- [ ] **Step 3: Confirmar remoção da infra antiga**

Run: `grep -rn "guardian-notifications\|sendGuardianNotification\|notificacoes_responsavel\|WHATSAPP_WEBHOOK" src/`
Expected: nenhum resultado.

- [ ] **Step 4: Smoke test manual** (requer token Meta + templates aprovados)

1. Com `META_*` configurado e templates aprovados, simular um evento de portaria:
   `POST /api/portaria/evento` com `aluno_id`, `tipo: "entrada"`, `foto_base64` (uma imagem
   pequena em base64), header de autenticação `GATE_API_TOKEN`.
2. Conferir: evento registrado em `eventos_acesso`; frequência marcada; linha em
   `mensagens_whatsapp` com `referencia_tipo = "portaria"`, `imagem_url` preenchida.
3. `/portaria/notificacoes` — a notificação aparece com status `enviada` (ou `falha` com
   motivo se a Meta não estiver configurada).
4. Enviar um evento SEM `foto_base64` → notificação usa o template texto, sem imagem.

Sem `META_*` configurado: a notificação vira `falha` controlada — o evento e a frequência
ainda são registrados normalmente.

---

## Notas de execução

- **Envio síncrono:** o WhatsApp é enviado dentro do `POST /api/portaria/evento`. A
  resposta da API só volta após o envio — aceitável (o sistema de portaria espera ~1-2s).
- **Foto é best-effort:** se o upload da foto falhar, `uploadFotoEvento` retorna `null`, o
  evento segue, e a notificação usa o template de texto. Nunca bloqueia o registro de
  entrada/saída nem a frequência.
- **Service client:** `registerGateEvent` e o upload usam `createAdminClient` — a portaria
  é autenticada por `GATE_API_TOKEN`, não por sessão de usuário. `enviarWhatsApp` recebe
  esse client como 2º argumento.
- **`mensagens_whatsapp` como log único:** a portaria agora compartilha a tabela de log
  com comunicados e lembretes, diferenciada por `referencia_tipo`.
- **Cooldown preservado:** a lógica de dedup de evento recente (`gateCooldownSeconds`) em
  `registerGateEvent` não é alterada — eventos duplicados continuam não gerando nova
  notificação.
- **Migração:** Task 2 aplica via MCP direto em produção (`fljkjhmwnjehsodvqaqk`).
- **Templates Meta:** `portaria_acesso_foto` e `portaria_acesso_texto` precisam estar
  aprovados antes do uso em produção; sem eles a Meta rejeita o envio (degrada gracioso).
