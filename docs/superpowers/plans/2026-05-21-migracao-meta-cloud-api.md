# Migração WhatsApp para Meta Cloud API — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir a integração Evolution API pela Meta Cloud API (WhatsApp Business oficial) na camada de mensageria — comunicados e lembretes passam a enviar via templates aprovados pela Meta.

**Architecture:** Novo cliente `meta.ts` substitui `evolution.ts`. `enviarWhatsApp` deixa de receber texto livre e passa a receber um template (nome + variáveis + imagem opcional) + um `textoLog` legível para o log. Comunicados e lembretes adaptados para passar template/variáveis. Evolution e o template editável de lembrete são removidos.

**Tech Stack:** TypeScript, Next.js 14, Supabase, Vitest, Meta Cloud API (Graph API v21.0).

**Spec:** `docs/superpowers/specs/2026-05-21-migracao-meta-cloud-api-design.md`
**Branch:** criar `feature/migracao-meta-whatsapp` a partir de `developer`.

---

## File Structure

**Criar:**
- `src/lib/whatsapp/meta.ts` — cliente Meta Cloud API + `montarComponentsTemplate`
- `src/lib/whatsapp/meta.test.ts` — testes de `montarComponentsTemplate`

**Modificar:**
- `src/lib/whatsapp/send.ts` — `enviarWhatsApp` recebe template em vez de texto livre
- `src/lib/comunicados/processar.ts` — usa template `META_TEMPLATE_COMUNICADO`
- `src/lib/lembretes/processar.ts` — usa template `META_TEMPLATE_LEMBRETE`
- `src/lib/actions/lembretes.ts` — `salvarConfigLembretesAction` para de gravar `lembrete_template`
- `src/lib/data/lembretes.ts` — `getConfigLembretes` deixa de retornar `template`
- `src/components/lembretes/config-lembretes-form.tsx` — remove o textarea do template
- `src/app/(app)/configuracoes/lembretes/page.tsx` — ajusta props passadas ao form
- `.env.local` — adiciona META_*, remove EVOLUTION_*

**Apagar:**
- `src/lib/whatsapp/evolution.ts`
- `src/lib/lembretes/montar-mensagem.ts`
- `src/lib/lembretes/montar-mensagem.test.ts`

---

## Task 0: Branch

- [ ] **Step 1: Criar a branch a partir de `developer`**

Run:
```bash
git checkout developer
git checkout -b feature/migracao-meta-whatsapp
```
Expected: `Switched to a new branch 'feature/migracao-meta-whatsapp'`.

---

## Task 1: Função `montarComponentsTemplate` (TDD)

Função pura que monta o array `components` do payload de template da Meta. Base testável do cliente.

**Files:**
- Create: `src/lib/whatsapp/meta.ts`
- Create: `src/lib/whatsapp/meta.test.ts`

- [ ] **Step 1: Escrever o teste**

`src/lib/whatsapp/meta.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { montarComponentsTemplate } from "./meta";

describe("montarComponentsTemplate", () => {
  it("monta só o body quando não há imagem", () => {
    const r = montarComponentsTemplate(["Maria", "João"], undefined);
    expect(r).toEqual([
      {
        type: "body",
        parameters: [
          { type: "text", text: "Maria" },
          { type: "text", text: "João" },
        ],
      },
    ]);
  });

  it("adiciona header de imagem antes do body quando há imagemUrl", () => {
    const r = montarComponentsTemplate(["Aviso geral"], "https://x.com/foto.jpg");
    expect(r).toEqual([
      {
        type: "header",
        parameters: [{ type: "image", image: { link: "https://x.com/foto.jpg" } }],
      },
      {
        type: "body",
        parameters: [{ type: "text", text: "Aviso geral" }],
      },
    ]);
  });

  it("body com uma única variável", () => {
    const r = montarComponentsTemplate(["texto único"], undefined);
    expect(r).toEqual([
      { type: "body", parameters: [{ type: "text", text: "texto único" }] },
    ]);
  });

  it("variáveis vazias geram body com parameters vazio", () => {
    const r = montarComponentsTemplate([], undefined);
    expect(r).toEqual([{ type: "body", parameters: [] }]);
  });

  it("preserva a ordem das variáveis", () => {
    const r = montarComponentsTemplate(["um", "dois", "três"], undefined);
    expect(r[0].parameters.map((p: { text: string }) => p.text)).toEqual([
      "um",
      "dois",
      "três",
    ]);
  });
});
```

- [ ] **Step 2: Rodar — deve FALHAR**

Run: `npx vitest run src/lib/whatsapp/meta.test.ts`
Expected: FAIL — `montarComponentsTemplate` não existe.

- [ ] **Step 3: Implementar (só a função pura por ora)**

`src/lib/whatsapp/meta.ts`:

```typescript
import "server-only";

type TextParameter = { type: "text"; text: string };
type ImageParameter = { type: "image"; image: { link: string } };

type TemplateComponent =
  | { type: "header"; parameters: ImageParameter[] }
  | { type: "body"; parameters: TextParameter[] };

// Monta o array `components` do payload de template da Meta Cloud API.
// Se imagemUrl for fornecida, adiciona um header de imagem antes do body.
export function montarComponentsTemplate(
  variaveis: string[],
  imagemUrl: string | undefined,
): TemplateComponent[] {
  const components: TemplateComponent[] = [];

  if (imagemUrl) {
    components.push({
      type: "header",
      parameters: [{ type: "image", image: { link: imagemUrl } }],
    });
  }

  components.push({
    type: "body",
    parameters: variaveis.map((v) => ({ type: "text", text: v })),
  });

  return components;
}
```

- [ ] **Step 4: Rodar — deve PASSAR**

Run: `npx vitest run src/lib/whatsapp/meta.test.ts`
Expected: PASS — 5 testes.

- [ ] **Step 5: Commit**

```bash
git add src/lib/whatsapp/meta.ts src/lib/whatsapp/meta.test.ts
git commit -m "feat(whatsapp): add Meta template components builder"
```

---

## Task 2: Cliente Meta — `sendTemplate` e `sendText`

Acrescenta o cliente HTTP da Meta Cloud API ao `meta.ts`.

**Files:**
- Modify: `src/lib/whatsapp/meta.ts`

- [ ] **Step 1: Acrescentar o cliente ao `meta.ts`**

Acrescentar ao final de `src/lib/whatsapp/meta.ts`:

```typescript
const GRAPH_VERSION = "v21.0";

export type MetaResult =
  | { ok: true; providerMessageId: string }
  | { ok: false; reason: string };

type MetaConfig = {
  token: string;
  phoneNumberId: string;
};

function getConfig(): MetaConfig | null {
  const token = process.env.META_WHATSAPP_TOKEN;
  const phoneNumberId = process.env.META_PHONE_NUMBER_ID;
  if (!token || !phoneNumberId) return null;
  return { token, phoneNumberId };
}

async function postMessage(
  config: MetaConfig,
  body: Record<string, unknown>,
): Promise<MetaResult> {
  const endpoint = `https://graph.facebook.com/${GRAPH_VERSION}/${config.phoneNumberId}/messages`;
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.token}`,
      },
      body: JSON.stringify({ messaging_product: "whatsapp", ...body }),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      const texto = await res.text().catch(() => "");
      return { ok: false, reason: `Meta API HTTP ${res.status}: ${texto.slice(0, 200)}` };
    }

    const json = (await res.json().catch(() => null)) as
      | { messages?: Array<{ id?: string }> }
      | null;
    const providerMessageId = json?.messages?.[0]?.id ?? "";
    return { ok: true, providerMessageId };
  } catch (err) {
    const reason = err instanceof Error ? err.message : "falha ao enviar";
    return { ok: false, reason };
  }
}

// Envia uma mensagem de template aprovado — inicia conversa.
export async function sendTemplate({
  telefone,
  templateName,
  idioma,
  variaveis,
  imagemUrl,
}: {
  telefone: string;
  templateName: string;
  idioma: string;
  variaveis: string[];
  imagemUrl?: string;
}): Promise<MetaResult> {
  const config = getConfig();
  if (!config) {
    return { ok: false, reason: "Meta WhatsApp não configurada" };
  }

  return postMessage(config, {
    to: telefone,
    type: "template",
    template: {
      name: templateName,
      language: { code: idioma },
      components: montarComponentsTemplate(variaveis, imagemUrl),
    },
  });
}

// Envia texto livre — só funciona dentro da janela de 24h. Não inicia conversa.
export async function sendText({
  telefone,
  mensagem,
}: {
  telefone: string;
  mensagem: string;
}): Promise<MetaResult> {
  const config = getConfig();
  if (!config) {
    return { ok: false, reason: "Meta WhatsApp não configurada" };
  }

  return postMessage(config, {
    to: telefone,
    type: "text",
    text: { body: mensagem },
  });
}
```

- [ ] **Step 2: Verificar tipos e testes**

Run: `npx tsc --noEmit && npx vitest run src/lib/whatsapp/meta.test.ts`
Expected: sem erros de tipo; 5 testes passam.

- [ ] **Step 3: Commit**

```bash
git add src/lib/whatsapp/meta.ts
git commit -m "feat(whatsapp): add Meta Cloud API client"
```

---

## Task 3: Adaptar `send.ts` para template

`enviarWhatsApp` deixa de receber `mensagem` livre; passa a receber `templateName` + `variaveis` + `textoLog`. Internamente chama `meta.sendTemplate`.

**Files:**
- Modify: `src/lib/whatsapp/send.ts`

- [ ] **Step 1: Reescrever `src/lib/whatsapp/send.ts`**

Substituir TODO o conteúdo de `src/lib/whatsapp/send.ts` por:

```typescript
import "server-only";
import { createServerClient } from "@/lib/supabase/server";
import { DEFAULT_SCHOOL_ID } from "@/lib/constants";
import { normalizarTelefone } from "./telefone";
import { sendTemplate } from "./meta";

const IDIOMA_TEMPLATE = "pt_BR";

export type EnviarWhatsAppParams = {
  telefone: string;
  templateName: string;
  variaveis: string[];
  textoLog: string;
  imagemUrl?: string;
  alunoId?: string;
  referenciaTipo?: string;
  referenciaId?: string;
};

export type EnvioResult =
  | { ok: true; mensagemId: string }
  | { ok: false; reason: string };

type SupabaseClientLike = {
  from: (table: string) => any;
};

export async function enviarWhatsApp(
  params: EnviarWhatsAppParams,
  supabaseClient?: SupabaseClientLike,
): Promise<EnvioResult> {
  const supabase = supabaseClient ?? (await createServerClient());
  const telefoneNormalizado = normalizarTelefone(params.telefone);

  // Telefone inválido: grava log de falha direto, sem chamar a API.
  if (!telefoneNormalizado) {
    await supabase.from("mensagens_whatsapp").insert({
      escola_id: DEFAULT_SCHOOL_ID,
      telefone: params.telefone,
      mensagem: params.textoLog,
      status: "falha",
      erro: "Telefone inválido",
      imagem_url: params.imagemUrl ?? null,
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
      mensagem: params.textoLog,
      status: "pendente",
      imagem_url: params.imagemUrl ?? null,
      aluno_id: params.alunoId ?? null,
      referencia_tipo: params.referenciaTipo ?? null,
      referencia_id: params.referenciaId ?? null,
    })
    .select("id")
    .single();

  if (logErr || !log) {
    return { ok: false, reason: logErr?.message ?? "falha ao registrar mensagem" };
  }

  // Envia o template via Meta.
  const resultado = await sendTemplate({
    telefone: telefoneNormalizado,
    templateName: params.templateName,
    idioma: IDIOMA_TEMPLATE,
    variaveis: params.variaveis,
    imagemUrl: params.imagemUrl,
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
Expected: ERROS esperados em `comunicados/processar.ts` e `lembretes/processar.ts` (ainda
usam a API antiga). Serão corrigidos nas Tasks 4 e 5. Confirmar que o erro é APENAS
nesses dois arquivos — nenhum erro dentro de `send.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/whatsapp/send.ts
git commit -m "feat(whatsapp): adapt enviarWhatsApp to send Meta templates"
```

---

## Task 4: Adaptar o processador de comunicados

`comunicados/processar.ts` deixa de chamar `sendWhatsApp`/`sendWhatsAppMedia` (Evolution) e passa a usar `enviarWhatsApp` com o template `META_TEMPLATE_COMUNICADO`.

**Files:**
- Modify: `src/lib/comunicados/processar.ts`

- [ ] **Step 1: Reescrever o trecho de envio**

Em `src/lib/comunicados/processar.ts`:

(a) Trocar o import:
```typescript
import { sendWhatsApp, sendWhatsAppMedia } from "@/lib/whatsapp/evolution";
```
por:
```typescript
import { enviarWhatsApp } from "@/lib/whatsapp/send";
```

(b) Adicionar, logo após o import, a constante do template:
```typescript
const TEMPLATE_COMUNICADO = process.env.META_TEMPLATE_COMUNICADO ?? "comunicado_escola";
```

(c) Substituir o bloco de envio dentro do `for (const msg of lote)`. O bloco atual é:
```typescript
    const resultado = msg.imagem_url
      ? await sendWhatsAppMedia({
          telefone: msg.telefone,
          mensagem: msg.mensagem,
          imagemUrl: msg.imagem_url,
        })
      : await sendWhatsApp({ telefone: msg.telefone, mensagem: msg.mensagem });

    if (resultado.ok) {
      enviadas += 1;
      await supabase
        .from("mensagens_whatsapp")
        .update({
          status: "enviada",
          provider_message_id: resultado.providerMessageId,
          enviada_em: new Date().toISOString(),
        })
        .eq("id", msg.id);
    } else {
      falhas += 1;
      await supabase
        .from("mensagens_whatsapp")
        .update({
          status: "falha",
          erro: resultado.reason,
          enviada_em: new Date().toISOString(),
        })
        .eq("id", msg.id);
    }
```

Substituir por:
```typescript
    // A linha pendente já foi criada na criação do comunicado. Aqui só enviamos
    // via Meta e atualizamos o status da linha existente.
    const resultado = await sendTemplateComunicado(msg, supabase);

    if (resultado.ok) {
      enviadas += 1;
    } else {
      falhas += 1;
    }
```

(d) Adicionar, ANTES da função `processarLote`, uma função auxiliar que envia o template
da Meta e atualiza a linha de log já existente:
```typescript
import { sendTemplate } from "@/lib/whatsapp/meta";

const IDIOMA = "pt_BR";

type MsgPendente = {
  id: string;
  telefone: string;
  mensagem: string;
  imagem_url: string | null;
  referencia_id: string;
};

async function sendTemplateComunicado(
  msg: MsgPendente,
  supabase: ReturnType<typeof createAdminClient>,
): Promise<{ ok: boolean }> {
  const resultado = await sendTemplate({
    telefone: msg.telefone,
    templateName: TEMPLATE_COMUNICADO,
    idioma: IDIOMA,
    variaveis: [msg.mensagem],
    imagemUrl: msg.imagem_url ?? undefined,
  });

  if (resultado.ok) {
    await supabase
      .from("mensagens_whatsapp")
      .update({
        status: "enviada",
        provider_message_id: resultado.providerMessageId,
        enviada_em: new Date().toISOString(),
      })
      .eq("id", msg.id);
    return { ok: true };
  }

  await supabase
    .from("mensagens_whatsapp")
    .update({
      status: "falha",
      erro: resultado.reason,
      enviada_em: new Date().toISOString(),
    })
    .eq("id", msg.id);
  return { ok: false };
}
```

NOTA: o import `enviarWhatsApp` do passo (a) acaba não sendo usado — o processador de
comunicados manipula a linha de log diretamente (a linha `pendente` já existe, criada na
criação do comunicado). Portanto, em (a), NÃO adicione o import de `enviarWhatsApp`;
adicione apenas `import { sendTemplate } from "@/lib/whatsapp/meta";`. Remova a linha de
import de `evolution`. Mantenha o `createAdminClient` já importado.

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros em `comunicados/processar.ts` (erro em `lembretes/processar.ts` ainda
existe — corrigido na Task 5).

- [ ] **Step 3: Commit**

```bash
git add src/lib/comunicados/processar.ts
git commit -m "feat(comunicados): send via Meta template instead of Evolution"
```

---

## Task 5: Adaptar o processador de lembretes

`lembretes/processar.ts` passa a usar `enviarWhatsApp` com o template `META_TEMPLATE_LEMBRETE` e variáveis. Deixa de usar `montar-mensagem.ts`.

**Files:**
- Modify: `src/lib/lembretes/processar.ts`

- [ ] **Step 1: Reescrever `src/lib/lembretes/processar.ts`**

Substituir TODO o conteúdo por:

```typescript
import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_SCHOOL_ID, money } from "@/lib/constants";
import { enviarWhatsApp } from "@/lib/whatsapp/send";
import { resolverLembretesPendentes } from "./detectar";

const TEMPLATE_LEMBRETE = process.env.META_TEMPLATE_LEMBRETE ?? "lembrete_cobranca";
const LIMITE_LOTE = 50;

export type ResultadoLembretes = {
  processados: number;
  enviados: number;
  falhas: number;
};

function dataBR(iso: string): string {
  return iso.split("-").reverse().join("/");
}

export async function processarLembretes(
  opts: { forcarReenvio: boolean },
  escolaId: string = DEFAULT_SCHOOL_ID,
): Promise<ResultadoLembretes> {
  const supabase = createAdminClient();

  // forcarReenvio → não ignora já enviados.
  const pendentes = await resolverLembretesPendentes(supabase, escolaId, !opts.forcarReenvio);
  const lote = pendentes.slice(0, LIMITE_LOTE);

  let enviados = 0;
  let falhas = 0;

  for (const p of lote) {
    const valorFmt = money.format(p.valor);
    const vencimentoFmt = dataBR(p.vencimento);

    // Variáveis do template lembrete_cobranca, na ordem {{1}}..{{4}}:
    // responsável, aluno, valor, vencimento.
    const variaveis = [p.responsavelNome, p.alunoNome, valorFmt, vencimentoFmt];

    // Texto legível para o log (a Meta renderiza o template; guardamos uma versão local).
    const textoLog = `Lembrete: mensalidade de ${p.alunoNome} (${p.descricao}) ${valorFmt}, vencida em ${vencimentoFmt}.`;

    const resultado = await enviarWhatsApp(
      {
        telefone: p.telefone,
        templateName: TEMPLATE_LEMBRETE,
        variaveis,
        textoLog,
        alunoId: p.alunoId,
        referenciaTipo: "lembrete_cobranca",
        referenciaId: p.cobrancaId,
      },
      supabase,
    );

    if (resultado.ok) enviados += 1;
    else falhas += 1;
  }

  return { processados: lote.length, enviados, falhas };
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros. (Se houver erro de import não-usado em outro arquivo apontando para
`montar-mensagem`, será resolvido na Task 6.)

- [ ] **Step 3: Commit**

```bash
git add src/lib/lembretes/processar.ts
git commit -m "feat(lembretes): send via Meta template instead of free text"
```

---

## Task 6: Remover Evolution e montar-mensagem

Apaga os arquivos que ficaram órfãos.

**Files:**
- Delete: `src/lib/whatsapp/evolution.ts`
- Delete: `src/lib/lembretes/montar-mensagem.ts`
- Delete: `src/lib/lembretes/montar-mensagem.test.ts`

- [ ] **Step 1: Confirmar que não há mais referências**

Run: `grep -rn "evolution\|montar-mensagem\|montarMensagem\|sendWhatsAppMedia" src/ --include=*.ts --include=*.tsx`
Expected: nenhum resultado. Se houver, corrija a referência antes de apagar.

- [ ] **Step 2: Apagar os arquivos**

Run:
```bash
git rm src/lib/whatsapp/evolution.ts src/lib/lembretes/montar-mensagem.ts src/lib/lembretes/montar-mensagem.test.ts
```

- [ ] **Step 3: Verificar tipos e testes**

Run: `npx tsc --noEmit && npm test`
Expected: sem erros de tipo; testes passam (os 5 testes de `montar-mensagem` somem da
suíte; `meta.test.ts` adiciona 5).

- [ ] **Step 4: Commit**

```bash
git commit -m "chore(whatsapp): remove Evolution client and obsolete message builder"
```

---

## Task 7: Limpar a configuração de lembretes (sem template editável)

Com a Meta, o texto do lembrete é um template aprovado fixo. A tela perde o textarea.

**Files:**
- Modify: `src/lib/data/lembretes.ts`
- Modify: `src/lib/actions/lembretes.ts`
- Modify: `src/components/lembretes/config-lembretes-form.tsx`
- Modify: `src/app/(app)/configuracoes/lembretes/page.tsx`

- [ ] **Step 1: `getConfigLembretes` deixa de retornar `template`**

Em `src/lib/data/lembretes.ts`, o tipo e a função mudam. Substituir o conteúdo do arquivo
por:

```typescript
import { createServerClient } from "@/lib/supabase/server";
import { DEFAULT_SCHOOL_ID } from "@/lib/constants";
import { resolverLembretesPendentes } from "@/lib/lembretes/detectar";

export type ConfigLembretes = {
  autoAtivo: boolean;
};

export async function getConfigLembretes(
  escolaId: string = DEFAULT_SCHOOL_ID,
): Promise<ConfigLembretes> {
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("escolas")
    .select("lembrete_auto_ativo")
    .eq("id", escolaId)
    .maybeSingle();
  return {
    autoAtivo: !!data?.lembrete_auto_ativo,
  };
}

export async function contarLembretesPendentes(
  escolaId: string = DEFAULT_SCHOOL_ID,
): Promise<number> {
  const supabase = await createServerClient();
  const pendentes = await resolverLembretesPendentes(supabase, escolaId, true);
  return pendentes.length;
}
```

- [ ] **Step 2: `salvarConfigLembretesAction` para de gravar `lembrete_template`**

Em `src/lib/actions/lembretes.ts`, na função `salvarConfigLembretesAction`: remover a
leitura de `template` e o campo `lembrete_template` do update. A função fica:

```typescript
export async function salvarConfigLembretesAction(formData: FormData) {
  const session = await requirePermission("financeiro.cobrancas", "update");
  const supabase = await createServerClient();

  const autoAtivo = formData.get("auto_ativo") === "on";

  await supabase
    .from("escolas")
    .update({
      lembrete_auto_ativo: autoAtivo,
    })
    .eq("id", session.profile.escola_id);

  revalidatePath("/configuracoes/lembretes");
}
```

Se o import de `formText` ficar sem uso após a remoção, removê-lo. `enviarLembretesAgoraAction`
permanece igual.

- [ ] **Step 3: Remover o textarea do form**

Substituir TODO o conteúdo de `src/components/lembretes/config-lembretes-form.tsx` por:

```typescript
"use client";

import { useState } from "react";
import { Save, Send } from "lucide-react";
import { Panel } from "@/components/ui/card";
import {
  salvarConfigLembretesAction,
  enviarLembretesAgoraAction,
} from "@/lib/actions/lembretes";

export function ConfigLembretesForm({
  autoAtivo,
  pendentes,
}: {
  autoAtivo: boolean;
  pendentes: number;
}) {
  const [salvando, setSalvando] = useState(false);
  const [enviando, setEnviando] = useState(false);

  return (
    <div className="grid gap-6">
      <Panel className="grid gap-4">
        <h2 className="font-bold text-ink">Configuração dos lembretes</h2>
        <form
          action={salvarConfigLembretesAction}
          onSubmit={() => setSalvando(true)}
          className="grid gap-4"
        >
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="auto_ativo"
              defaultChecked={autoAtivo}
              className="h-4 w-4"
            />
            Enviar lembretes automaticamente (uma vez por dia)
          </label>

          <p className="rounded-ui bg-muted/40 p-3 text-xs text-ink/60">
            O texto do lembrete é um modelo aprovado pelo WhatsApp e não é editável aqui.
            Para alterá-lo, é necessário aprovar um novo modelo na conta WhatsApp Business.
          </p>

          <div className="flex justify-end">
            <button className="ds-button ds-button-primary" disabled={salvando}>
              <Save size={14} /> {salvando ? "Salvando…" : "Salvar configuração"}
            </button>
          </div>
        </form>
      </Panel>

      <Panel className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-ink">
            {pendentes} cobrança(s) vencida(s) sem lembrete
          </p>
          <p className="text-xs text-ink/55">
            Envio manual ignora a configuração automática.
          </p>
        </div>
        <form action={enviarLembretesAgoraAction} onSubmit={() => setEnviando(true)}>
          <button
            className="ds-button ds-button-accent"
            disabled={enviando || pendentes === 0}
          >
            <Send size={14} /> {enviando ? "Enviando…" : "Enviar lembretes agora"}
          </button>
        </form>
      </Panel>
    </div>
  );
}
```

- [ ] **Step 4: Ajustar a página para não passar `template`**

Em `src/app/(app)/configuracoes/lembretes/page.tsx`, o `<ConfigLembretesForm>` recebia
`autoAtivo`, `template`, `pendentes`. Remover `template`. O JSX do form fica:

```typescript
      <ConfigLembretesForm
        autoAtivo={config.autoAtivo}
        pendentes={pendentes}
      />
```

(o resto da página permanece igual — `config.template` deixa de existir no tipo, então
qualquer uso some naturalmente).

- [ ] **Step 5: Verificar tipos e build**

Run: `npx tsc --noEmit && npm run build`
Expected: sem erros; build passa.

- [ ] **Step 6: Commit**

```bash
git add src/lib/data/lembretes.ts src/lib/actions/lembretes.ts "src/components/lembretes/config-lembretes-form.tsx" "src/app/(app)/configuracoes/lembretes/page.tsx"
git commit -m "feat(lembretes): drop editable template, text is now a Meta template"
```

---

## Task 8: Variáveis de ambiente

**Files:**
- Modify: `.env.local`

- [ ] **Step 1: Atualizar `.env.local`**

Em `.env.local`:

Remover as 3 linhas:
```
EVOLUTION_API_URL=...
EVOLUTION_API_KEY=...
EVOLUTION_INSTANCE=...
```

Adicionar:
```
# Meta WhatsApp Cloud API
META_WHATSAPP_TOKEN=
META_PHONE_NUMBER_ID=
META_TEMPLATE_LEMBRETE=lembrete_cobranca
META_TEMPLATE_COMUNICADO=comunicado_escola
```

NÃO commitar `.env.local` (está no `.gitignore`). Este step só garante as chaves
localmente para o usuário preencher.

- [ ] **Step 2: Avisar o usuário**

Reportar ao final que o usuário deve:
1. Preencher `META_WHATSAPP_TOKEN` e `META_PHONE_NUMBER_ID` no `.env.local`.
2. Adicionar as 4 variáveis META_* no painel da Vercel.
3. Remover as 3 variáveis EVOLUTION_* do painel da Vercel.
4. No Meta Business Manager: aprovar os templates `lembrete_cobranca` (4 variáveis) e
   `comunicado_escola` (1 variável + header de imagem opcional), idioma pt_BR, categoria
   Utility.

---

## Task 9: Verificação final

- [ ] **Step 1: Rodar todos os testes**

Run: `npm test`
Expected: `meta.test.ts` (5) + `telefone` (10) + `dias-letivos` (10) + `feriados` (14) +
`destinatarios` (6) + `detectar` (8) = 53 passando. (Os 5 de `montar-mensagem` saíram; os
5 de `meta` entraram — total permanece 53.)

- [ ] **Step 2: Build final**

Run: `npm run build`
Expected: passa sem erros.

- [ ] **Step 3: Confirmar ausência de Evolution**

Run: `grep -rn "evolution\|Evolution\|EVOLUTION" src/`
Expected: nenhum resultado.

- [ ] **Step 4: Smoke test manual** (requer token Meta + templates aprovados)

Se o usuário já configurou `META_*` e aprovou os templates:
1. `/configuracoes/lembretes` — abre, mostra só o toggle (sem textarea), salva.
2. Criar um comunicado individual de teste → mensagem chega via template Meta.
3. "Enviar lembretes agora" com uma cobrança vencida → lembrete chega via template.
4. Conferir `mensagens_whatsapp` — `provider_message_id` preenchido (id da Meta).

Sem `META_*` configurado: as mensagens viram `falha` com motivo "Meta WhatsApp não
configurada" — o app não quebra.

---

## Notas de execução

- **Ordem importa:** Task 3 quebra o build de propósito (consumidores ainda na API
  antiga); Tasks 4 e 5 consertam. Não interromper a sequência entre 3 e 6.
- **Comunicados x lembretes — caminhos diferentes:** o processador de comunicados
  manipula a linha `mensagens_whatsapp` diretamente (a linha `pendente` já existe, criada
  na criação do comunicado) e usa `sendTemplate`. O processador de lembretes usa
  `enviarWhatsApp` (que cria a linha de log). Essa assimetria já existia antes da
  migração e é preservada.
- **`textoLog`:** como a Meta renderiza o template no servidor dela, o sistema não tem o
  texto final exato. `textoLog` guarda uma versão legível para a tela de histórico /
  detalhe do comunicado.
- **Sem migração de banco:** `mensagens_whatsapp` não muda; `escolas.lembrete_template`
  fica obsoleta mas não é dropada.
- **Templates Meta:** precisam estar aprovados na conta WhatsApp Business antes do uso em
  produção. Sem isso, a Meta rejeita o envio — a camada degrada graciosamente.
- **Idioma:** `pt_BR` fixo (constante `IDIOMA_TEMPLATE` / `IDIOMA`).
