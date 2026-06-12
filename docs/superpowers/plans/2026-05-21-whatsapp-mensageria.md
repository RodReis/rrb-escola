# Camada de Mensageria WhatsApp — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir a camada base de envio de mensagens WhatsApp via Evolution API, com log de cada envio — infra para a Frente 4 consumir.

**Architecture:** Três módulos em camadas: `telefone.ts` (normalização pura, testável), `evolution.ts` (cliente HTTP do provedor, server-only), `send.ts` (orquestra normalização + log + envio). Tabela `mensagens_whatsapp` registra cada envio com status `pendente`→`enviada`/`falha`.

**Tech Stack:** TypeScript, Next.js Server Actions, Supabase (Postgres + RLS), Vitest, Evolution API.

**Spec:** `docs/superpowers/specs/2026-05-21-whatsapp-mensageria-design.md`
**Branch:** criar `feature/whatsapp-mensageria` a partir de `developer`.

---

## File Structure

**Criar:**
- `supabase/migrations/202605310002_mensagens_whatsapp.sql` — tabela + enum + RLS
- `src/lib/whatsapp/telefone.ts` — normalização de telefone (pura)
- `src/lib/whatsapp/telefone.test.ts` — testes da normalização
- `src/lib/whatsapp/evolution.ts` — cliente Evolution API (server-only)
- `src/lib/whatsapp/send.ts` — envio de alto nível com log

**Modificar:**
- `.env.local` — adicionar as 3 variáveis Evolution (valores reais são do usuário)

---

## Task 0: Branch

- [ ] **Step 1: Criar a branch a partir de `developer`**

Run:
```bash
git checkout developer
git checkout -b feature/whatsapp-mensageria
```
Expected: `Switched to a new branch 'feature/whatsapp-mensageria'`.

---

## Task 1: Normalização de telefone

Função pura que converte um telefone brasileiro cru (com máscara, com/sem DDI, com/sem 9º dígito) em E.164 sem `+`. Base testável de toda a camada.

**Files:**
- Create: `src/lib/whatsapp/telefone.ts`
- Create: `src/lib/whatsapp/telefone.test.ts`

- [ ] **Step 1: Escrever o teste**

`src/lib/whatsapp/telefone.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { normalizarTelefone } from "./telefone";

describe("normalizarTelefone", () => {
  it("celular 11 dígitos (DDD+9+8) prefixa 55", () => {
    expect(normalizarTelefone("62999998888")).toBe("5562999998888");
  });

  it("número já com 55 (13 dígitos) é mantido", () => {
    expect(normalizarTelefone("5562999998888")).toBe("5562999998888");
  });

  it("fixo 10 dígitos (DDD+8) prefixa 55", () => {
    expect(normalizarTelefone("6233334444")).toBe("556233334444");
  });

  it("número com 55 e 12 dígitos (fixo) é mantido", () => {
    expect(normalizarTelefone("556233334444")).toBe("556233334444");
  });

  it("string com máscara é normalizada", () => {
    expect(normalizarTelefone("(62) 99999-8888")).toBe("5562999998888");
  });

  it("string com +55 e máscara é normalizada", () => {
    expect(normalizarTelefone("+55 (62) 99999-8888")).toBe("5562999998888");
  });

  it("número curto demais retorna null", () => {
    expect(normalizarTelefone("99998888")).toBeNull();
  });

  it("string vazia retorna null", () => {
    expect(normalizarTelefone("")).toBeNull();
  });

  it("string sem dígitos retorna null", () => {
    expect(normalizarTelefone("abc-def")).toBeNull();
  });

  it("número longo demais retorna null", () => {
    expect(normalizarTelefone("5562999998888000")).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar — deve FALHAR**

Run: `npx vitest run src/lib/whatsapp/telefone.test.ts`
Expected: FAIL — `normalizarTelefone` não existe.

- [ ] **Step 3: Implementar**

`src/lib/whatsapp/telefone.ts`:

```typescript
// Normaliza um telefone brasileiro para E.164 sem "+" (ex: 5562999998888).
// Aceita máscara, com/sem DDI 55, fixo (10 díg) ou celular (11 díg).
// Retorna null se o número não for reconhecível.
export function normalizarTelefone(raw: string): string | null {
  const digitos = raw.replace(/\D/g, "");

  // Já com DDI 55: 12 (fixo) ou 13 (celular) dígitos.
  if (digitos.startsWith("55") && (digitos.length === 12 || digitos.length === 13)) {
    return digitos;
  }

  // Sem DDI: 10 (fixo) ou 11 (celular) dígitos → prefixa 55.
  if (digitos.length === 10 || digitos.length === 11) {
    return `55${digitos}`;
  }

  return null;
}
```

- [ ] **Step 4: Rodar — deve PASSAR**

Run: `npx vitest run src/lib/whatsapp/telefone.test.ts`
Expected: PASS — 10 testes.

- [ ] **Step 5: Commit**

```bash
git add src/lib/whatsapp/telefone.ts src/lib/whatsapp/telefone.test.ts
git commit -m "feat(whatsapp): add phone number normalization"
```

---

## Task 2: Migração — tabela `mensagens_whatsapp`

Tabela de log de envios, enum de status, RLS.

**Files:**
- Create: `supabase/migrations/202605310002_mensagens_whatsapp.sql`

- [ ] **Step 1: Criar a migração**

`supabase/migrations/202605310002_mensagens_whatsapp.sql`:

```sql
-- Camada de mensageria WhatsApp: log de cada envio.

do $$ begin
  create type status_mensagem_whatsapp as enum ('pendente', 'enviada', 'falha');
exception when duplicate_object then null;
end $$;

create table mensagens_whatsapp (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references escolas(id) on delete cascade,
  telefone text not null,
  mensagem text not null,
  status status_mensagem_whatsapp not null default 'pendente',
  erro text,
  provider_message_id text,
  aluno_id uuid references alunos(id) on delete set null,
  referencia_tipo text,
  referencia_id uuid,
  created_at timestamptz not null default now(),
  enviada_em timestamptz
);

create index mensagens_whatsapp_escola_idx on mensagens_whatsapp (escola_id);
create index mensagens_whatsapp_status_idx on mensagens_whatsapp (status);
create index mensagens_whatsapp_aluno_idx on mensagens_whatsapp (aluno_id);

alter table mensagens_whatsapp enable row level security;

create policy "mensagens whatsapp service" on mensagens_whatsapp for all to service_role
  using (true) with check (true);

create policy "mensagens whatsapp escola" on mensagens_whatsapp for all to authenticated
  using (escola_id = (select escola_id from current_perfil()))
  with check (escola_id = (select escola_id from current_perfil()));
```

- [ ] **Step 2: Aplicar a migração via MCP Supabase**

Aplicar `202605310002_mensagens_whatsapp.sql` no projeto `fljkjhmwnjehsodvqaqk` via MCP `apply_migration` (name: `202605310002_mensagens_whatsapp`).
Expected: `{"success": true}`.

- [ ] **Step 3: Verificar a tabela**

Via MCP `execute_sql` no projeto `fljkjhmwnjehsodvqaqk`:

```sql
SELECT column_name, data_type FROM information_schema.columns
WHERE table_schema='public' AND table_name='mensagens_whatsapp'
ORDER BY ordinal_position;
```

Expected: retorna as 12 colunas (`id`, `escola_id`, `telefone`, `mensagem`, `status`, `erro`, `provider_message_id`, `aluno_id`, `referencia_tipo`, `referencia_id`, `created_at`, `enviada_em`).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/202605310002_mensagens_whatsapp.sql
git commit -m "feat(whatsapp): add mensagens_whatsapp table with RLS"
```

---

## Task 3: Cliente Evolution API

Cliente HTTP de baixo nível. `server-only`. Lê config do env, degrada graciosamente se não configurado.

**Files:**
- Create: `src/lib/whatsapp/evolution.ts`

- [ ] **Step 1: Criar `src/lib/whatsapp/evolution.ts`**

```typescript
import "server-only";

export type EvolutionResult =
  | { ok: true; providerMessageId: string }
  | { ok: false; reason: string };

type EvolutionConfig = {
  url: string;
  apiKey: string;
  instance: string;
};

function getConfig(): EvolutionConfig | null {
  const url = process.env.EVOLUTION_API_URL;
  const apiKey = process.env.EVOLUTION_API_KEY;
  const instance = process.env.EVOLUTION_INSTANCE;
  if (!url || !apiKey || !instance) return null;
  return { url, apiKey, instance };
}

export async function sendWhatsApp({
  telefone,
  mensagem,
}: {
  telefone: string;
  mensagem: string;
}): Promise<EvolutionResult> {
  const config = getConfig();
  if (!config) {
    return { ok: false, reason: "Evolution API não configurada" };
  }

  const endpoint = `${config.url.replace(/\/$/, "")}/message/sendText/${config.instance}`;

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: config.apiKey,
      },
      body: JSON.stringify({ number: telefone, text: mensagem }),
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      const texto = await res.text().catch(() => "");
      return { ok: false, reason: `Evolution API HTTP ${res.status}: ${texto.slice(0, 200)}` };
    }

    const json = (await res.json().catch(() => null)) as { key?: { id?: string } } | null;
    const providerMessageId = json?.key?.id ?? "";
    return { ok: true, providerMessageId };
  } catch (err) {
    const reason = err instanceof Error ? err.message : "falha ao enviar";
    return { ok: false, reason };
  }
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros. (`server-only` já é dependência do projeto — usado em `src/lib/email/resend.ts`.)

- [ ] **Step 3: Commit**

```bash
git add src/lib/whatsapp/evolution.ts
git commit -m "feat(whatsapp): add Evolution API client"
```

---

## Task 4: Envio de alto nível com log

`enviarWhatsApp` — orquestra: normaliza telefone, grava log `pendente`, chama o cliente, atualiza o log para `enviada`/`falha`. É a função pública que a Frente 4 vai consumir.

**Files:**
- Create: `src/lib/whatsapp/send.ts`

- [ ] **Step 1: Criar `src/lib/whatsapp/send.ts`**

```typescript
import "server-only";
import { createServerClient } from "@/lib/supabase/server";
import { DEFAULT_SCHOOL_ID } from "@/lib/constants";
import { normalizarTelefone } from "./telefone";
import { sendWhatsApp } from "./evolution";

export type EnviarWhatsAppParams = {
  telefone: string;
  mensagem: string;
  alunoId?: string;
  referenciaTipo?: string;
  referenciaId?: string;
};

export type EnvioResult =
  | { ok: true; mensagemId: string }
  | { ok: false; reason: string };

export async function enviarWhatsApp(params: EnviarWhatsAppParams): Promise<EnvioResult> {
  const supabase = await createServerClient();
  const telefoneNormalizado = normalizarTelefone(params.telefone);

  // Telefone inválido: grava log de falha direto, sem chamar a API.
  if (!telefoneNormalizado) {
    await supabase.from("mensagens_whatsapp").insert({
      escola_id: DEFAULT_SCHOOL_ID,
      telefone: params.telefone,
      mensagem: params.mensagem,
      status: "falha",
      erro: "Telefone inválido",
      aluno_id: params.alunoId ?? null,
      referencia_tipo: params.referenciaTipo ?? null,
      referencia_id: params.referenciaId ?? null,
      enviada_em: new Date().toISOString(),
    });
    return { ok: false, reason: "Telefone inválido" };
  }

  // Grava log pendente.
  const { data: log, error: logErr } = await supabase
    .from("mensagens_whatsapp")
    .insert({
      escola_id: DEFAULT_SCHOOL_ID,
      telefone: telefoneNormalizado,
      mensagem: params.mensagem,
      status: "pendente",
      aluno_id: params.alunoId ?? null,
      referencia_tipo: params.referenciaTipo ?? null,
      referencia_id: params.referenciaId ?? null,
    })
    .select("id")
    .single();

  if (logErr || !log) {
    return { ok: false, reason: logErr?.message ?? "falha ao registrar mensagem" };
  }

  // Chama o provedor.
  const resultado = await sendWhatsApp({
    telefone: telefoneNormalizado,
    mensagem: params.mensagem,
  });

  // Atualiza o log com o resultado final.
  if (resultado.ok) {
    await supabase
      .from("mensagens_whatsapp")
      .update({
        status: "enviada",
        provider_message_id: resultado.providerMessageId,
        enviada_em: new Date().toISOString(),
      })
      .eq("id", log.id);
    return { ok: true, mensagemId: log.id };
  }

  await supabase
    .from("mensagens_whatsapp")
    .update({
      status: "falha",
      erro: resultado.reason,
      enviada_em: new Date().toISOString(),
    })
    .eq("id", log.id);
  return { ok: false, reason: resultado.reason };
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros. Confirme que `createServerClient` vem de `@/lib/supabase/server` e `DEFAULT_SCHOOL_ID` de `@/lib/constants` — ambos confirmados em `src/lib/actions/calendario.ts`.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: build passa.

- [ ] **Step 4: Commit**

```bash
git add src/lib/whatsapp/send.ts
git commit -m "feat(whatsapp): add high-level enviarWhatsApp with logging"
```

---

## Task 5: Documentar variáveis de ambiente

As 3 variáveis Evolution precisam estar no `.env.local`. Os valores reais são do usuário — adicionar com placeholders e documentar.

**Files:**
- Modify: `.env.local`

- [ ] **Step 1: Adicionar as variáveis ao `.env.local`**

Acrescentar ao final de `.env.local`:

```
# Evolution API (WhatsApp) — preencher com os dados do servidor Evolution
EVOLUTION_API_URL=
EVOLUTION_API_KEY=
EVOLUTION_INSTANCE=
```

NÃO commitar `.env.local` (já está no `.gitignore`). Este step apenas garante que as
chaves existem localmente para o usuário preencher.

- [ ] **Step 2: Avisar o usuário**

Reportar ao final que o usuário deve:
1. Preencher `EVOLUTION_API_URL`, `EVOLUTION_API_KEY`, `EVOLUTION_INSTANCE` no `.env.local`.
2. Adicionar as mesmas 3 variáveis no painel da Vercel (Environment Variables) antes de
   usar a feature em produção.

Sem este preenchimento, `sendWhatsApp` retorna `{ ok: false, reason: "Evolution API não configurada" }` — a camada não quebra, só não envia.

---

## Task 6: Verificação final

- [ ] **Step 1: Rodar todos os testes**

Run: `npm test`
Expected: testes de `telefone.test.ts` (10) + suítes existentes (`dias-letivos` 10, `feriados` 14) = 34 passando.

- [ ] **Step 2: Build final**

Run: `npm run build`
Expected: passa sem erros.

- [ ] **Step 3: Teste manual de envio (opcional — requer env configurado)**

Se o usuário já configurou as 3 variáveis Evolution: criar um script ou rota temporária
que chame `enviarWhatsApp({ telefone: "<seu número>", mensagem: "Teste CRM Escola" })`,
verificar que a mensagem chega no WhatsApp e que um registro `enviada` aparece na tabela
`mensagens_whatsapp`. Remover o script/rota temporária após o teste.

Se o env não estiver configurado, pular — a Frente 4 fará a validação integrada.

---

## Notas de execução

- **Sem env = sem quebra:** toda a camada degrada graciosamente. `sendWhatsApp` sem config
  retorna falha controlada; `enviarWhatsApp` grava o log como `falha` e retorna o motivo.
- **`server-only`:** `evolution.ts` e `send.ts` importam `server-only` — nunca podem ir
  para o bundle do cliente. `telefone.ts` é pura, pode ser usada em qualquer lugar.
- **Sem UI / sem RBAC nesta frente:** a camada é consumida só por código (Frente 4). O
  módulo RBAC `whatsapp` e a tela de histórico vêm na Frente 4.
- **Migração:** Task 2 aplica via MCP direto em produção (`fljkjhmwnjehsodvqaqk`); o `.sql`
  fica versionado em `supabase/migrations/`.
- **Formato de resposta da Evolution:** o `providerMessageId` é extraído de `json.key.id` —
  formato padrão da Evolution API para `sendText`. Se a versão do servidor retornar outro
  shape, o envio ainda conta como sucesso (HTTP 2xx), apenas `provider_message_id` fica vazio.
