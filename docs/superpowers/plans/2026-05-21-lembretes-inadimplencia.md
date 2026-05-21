# Lembretes de Inadimplência — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enviar lembretes via WhatsApp ao responsável financeiro quando uma cobrança vence e continua em aberto — automático (cron diário) ou manual, controlado por flag de configuração.

**Architecture:** Detecção de cobranças vencidas sem lembrete prévio (via `mensagens_whatsapp` como controle de duplicata). Mensagem montada de um template editável com placeholders. Disparo híbrido: cron diário (respeita a flag) + botão manual. Reusa a camada WhatsApp (Frente 3) e o padrão de cron (Frente 4a).

**Tech Stack:** TypeScript, Next.js 14 App Router, Supabase (Postgres + RLS), Vitest, Vercel Cron, Evolution API.

**Spec:** `docs/superpowers/specs/2026-05-21-lembretes-inadimplencia-design.md`
**Branch:** criar `feature/lembretes-inadimplencia` a partir de `developer`.

---

## File Structure

**Criar:**
- `supabase/migrations/202605310004_lembretes.sql` — 2 colunas em `escolas`
- `src/lib/lembretes/montar-mensagem.ts` + `.test.ts` — substituição de placeholders (pura)
- `src/lib/lembretes/detectar.ts` + `.test.ts` — resolução de cobranças elegíveis
- `src/lib/lembretes/processar.ts` — orquestra o envio
- `src/lib/data/lembretes.ts` — data layer
- `src/lib/actions/lembretes.ts` — server actions
- `src/app/api/lembretes/processar/route.ts` — rota do cron
- `src/app/(app)/configuracoes/lembretes/page.tsx` — tela de configuração
- `src/components/lembretes/config-lembretes-form.tsx` — form (client component)

**Modificar:**
- `vercel.json` — segundo cron
- `src/components/layout/topbar.tsx` — item de menu em CONFIG_ITEMS

---

## Task 0: Branch

- [ ] **Step 1: Criar a branch a partir de `developer`**

Run:
```bash
git checkout developer
git checkout -b feature/lembretes-inadimplencia
```
Expected: `Switched to a new branch 'feature/lembretes-inadimplencia'`.

---

## Task 1: Migração — config de lembretes em `escolas`

Duas colunas: a flag de envio automático e o template de mensagem.

**Files:**
- Create: `supabase/migrations/202605310004_lembretes.sql`

- [ ] **Step 1: Criar a migração**

`supabase/migrations/202605310004_lembretes.sql`:

```sql
-- Lembretes de inadimplência: configuração na tabela escolas.

alter table escolas
  add column if not exists lembrete_auto_ativo boolean not null default false;

alter table escolas
  add column if not exists lembrete_template text;

-- Template de fábrica para escolas que ainda não têm um definido.
update escolas
set lembrete_template = 'Olá {responsavel}, a mensalidade de {aluno} ({descricao}) no valor de {valor}, vencida em {vencimento}, está em aberto há {dias_atraso} dia(s). Por favor, regularize. Em caso de dúvida, entre em contato.'
where lembrete_template is null;
```

- [ ] **Step 2: Aplicar via MCP Supabase**

Aplicar `202605310004_lembretes.sql` no projeto `fljkjhmwnjehsodvqaqk` via MCP `apply_migration` (name: `202605310004_lembretes`).
Expected: `{"success": true}`.

- [ ] **Step 3: Verificar**

Via MCP `execute_sql` no projeto `fljkjhmwnjehsodvqaqk`:

```sql
SELECT column_name FROM information_schema.columns
WHERE table_name='escolas' AND column_name IN ('lembrete_auto_ativo', 'lembrete_template');
SELECT lembrete_auto_ativo, left(lembrete_template, 30) AS template_preview FROM escolas;
```

Expected: as 2 colunas retornam; `lembrete_auto_ativo` é `false`; `template_preview` começa com "Olá {responsavel}".

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/202605310004_lembretes.sql
git commit -m "feat(lembretes): add reminder config columns to escolas"
```

---

## Task 2: Montagem da mensagem

Função pura: substitui os placeholders do template pelos dados da cobrança.

**Files:**
- Create: `src/lib/lembretes/montar-mensagem.ts`
- Create: `src/lib/lembretes/montar-mensagem.test.ts`

- [ ] **Step 1: Escrever o teste**

`src/lib/lembretes/montar-mensagem.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { montarMensagem } from "./montar-mensagem";

const dados = {
  responsavel: "Maria Silva",
  aluno: "João Silva",
  descricao: "Mensalidade 03/2026",
  valor: "R$ 450,00",
  vencimento: "10/03/2026",
  diasAtraso: 5,
};

describe("montarMensagem", () => {
  it("substitui todos os placeholders", () => {
    const template =
      "Olá {responsavel}, mensalidade de {aluno} ({descricao}) {valor} venceu {vencimento}, {dias_atraso} dias.";
    expect(montarMensagem(template, dados)).toBe(
      "Olá Maria Silva, mensalidade de João Silva (Mensalidade 03/2026) R$ 450,00 venceu 10/03/2026, 5 dias.",
    );
  });

  it("substitui o mesmo placeholder repetido", () => {
    const template = "{aluno} e novamente {aluno}";
    expect(montarMensagem(template, dados)).toBe("João Silva e novamente João Silva");
  });

  it("template sem placeholders é retornado igual", () => {
    const template = "Aviso de cobrança.";
    expect(montarMensagem(template, dados)).toBe("Aviso de cobrança.");
  });

  it("placeholder desconhecido é mantido literal", () => {
    const template = "Olá {responsavel}, {placeholder_inexistente}.";
    expect(montarMensagem(template, dados)).toBe(
      "Olá Maria Silva, {placeholder_inexistente}.",
    );
  });

  it("dias_atraso é convertido de número para texto", () => {
    const template = "{dias_atraso} dia(s)";
    expect(montarMensagem(template, dados)).toBe("5 dia(s)");
  });
});
```

- [ ] **Step 2: Rodar — deve FALHAR**

Run: `npx vitest run src/lib/lembretes/montar-mensagem.test.ts`
Expected: FAIL — `montarMensagem` não existe.

- [ ] **Step 3: Implementar**

`src/lib/lembretes/montar-mensagem.ts`:

```typescript
export type DadosLembrete = {
  responsavel: string;
  aluno: string;
  descricao: string;
  valor: string;
  vencimento: string;
  diasAtraso: number;
};

// Substitui os placeholders {chave} do template pelos valores correspondentes.
// Placeholders sem valor conhecido são mantidos literais.
export function montarMensagem(template: string, dados: DadosLembrete): string {
  const mapa: Record<string, string> = {
    responsavel: dados.responsavel,
    aluno: dados.aluno,
    descricao: dados.descricao,
    valor: dados.valor,
    vencimento: dados.vencimento,
    dias_atraso: String(dados.diasAtraso),
  };
  return template.replace(/\{(\w+)\}/g, (literal, chave: string) => {
    return chave in mapa ? mapa[chave] : literal;
  });
}
```

- [ ] **Step 4: Rodar — deve PASSAR**

Run: `npx vitest run src/lib/lembretes/montar-mensagem.test.ts`
Expected: PASS — 5 testes.

- [ ] **Step 5: Commit**

```bash
git add src/lib/lembretes/montar-mensagem.ts src/lib/lembretes/montar-mensagem.test.ts
git commit -m "feat(lembretes): add message template rendering"
```

---

## Task 3: Detecção de cobranças elegíveis

`filtrarElegiveis` (pura) aplica as regras; `resolverLembretesPendentes` faz a query.

**Files:**
- Create: `src/lib/lembretes/detectar.ts`
- Create: `src/lib/lembretes/detectar.test.ts`

- [ ] **Step 1: Escrever o teste da parte pura**

`src/lib/lembretes/detectar.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { filtrarElegiveis } from "./detectar";

const HOJE = "2026-03-20";

// Linha crua de cobrança como vem do join no Supabase.
function cobranca(over: Partial<{
  id: string;
  status: string;
  data_vencimento: string;
  jaEnviado: boolean;
  temResponsavel: boolean;
}>) {
  const base = {
    id: "cob-1",
    descricao: "Mensalidade 03/2026",
    valor_final: 450,
    data_vencimento: "2026-03-10",
    status: "aberta",
    aluno_id: "aluno-1",
    jaEnviado: false,
    temResponsavel: true,
    ...over,
  };
  return {
    id: base.id,
    descricao: base.descricao,
    valor_final: base.valor_final,
    data_vencimento: base.data_vencimento,
    status: base.status,
    aluno_id: base.aluno_id,
    alunos: {
      nome: "João Silva",
      responsaveis_aluno: base.temResponsavel
        ? [{ nome: "Maria Silva", celular: "62999990000", responsavel_financeiro: true }]
        : [],
    },
  };
}

describe("filtrarElegiveis", () => {
  it("cobrança vencida, em aberto, com responsável → elegível", () => {
    const r = filtrarElegiveis([cobranca({})], HOJE, new Set());
    expect(r).toHaveLength(1);
    expect(r[0].cobrancaId).toBe("cob-1");
    expect(r[0].telefone).toBe("62999990000");
    expect(r[0].diasAtraso).toBe(10);
  });

  it("cobrança não vencida (vence depois de hoje) → ignorada", () => {
    const r = filtrarElegiveis([cobranca({ data_vencimento: "2026-04-01" })], HOJE, new Set());
    expect(r).toHaveLength(0);
  });

  it("cobrança paga → ignorada", () => {
    const r = filtrarElegiveis([cobranca({ status: "paga" })], HOJE, new Set());
    expect(r).toHaveLength(0);
  });

  it("cobrança cancelada → ignorada", () => {
    const r = filtrarElegiveis([cobranca({ status: "cancelada" })], HOJE, new Set());
    expect(r).toHaveLength(0);
  });

  it("status parcial e vencida também são elegíveis", () => {
    expect(filtrarElegiveis([cobranca({ status: "parcial" })], HOJE, new Set())).toHaveLength(1);
    expect(filtrarElegiveis([cobranca({ status: "vencida" })], HOJE, new Set())).toHaveLength(1);
  });

  it("cobrança sem responsável financeiro com celular → ignorada", () => {
    const r = filtrarElegiveis([cobranca({ temResponsavel: false })], HOJE, new Set());
    expect(r).toHaveLength(0);
  });

  it("cobrança já com lembrete enviado → ignorada quando o id está no Set", () => {
    const r = filtrarElegiveis([cobranca({ id: "cob-9" })], HOJE, new Set(["cob-9"]));
    expect(r).toHaveLength(0);
  });

  it("Set vazio não exclui nada (modo forçar reenvio)", () => {
    const r = filtrarElegiveis([cobranca({ id: "cob-9" })], HOJE, new Set());
    expect(r).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Rodar — deve FALHAR**

Run: `npx vitest run src/lib/lembretes/detectar.test.ts`
Expected: FAIL — `filtrarElegiveis` não existe.

- [ ] **Step 3: Implementar**

`src/lib/lembretes/detectar.ts`:

```typescript
import { DEFAULT_SCHOOL_ID } from "@/lib/constants";

export type LembretePendente = {
  cobrancaId: string;
  alunoId: string;
  alunoNome: string;
  responsavelNome: string;
  telefone: string;
  descricao: string;
  valor: number;
  vencimento: string;
  diasAtraso: number;
};

const STATUS_EM_ABERTO = new Set(["aberta", "parcial", "vencida"]);

type ResponsavelRow = {
  nome: string | null;
  celular: string | null;
  responsavel_financeiro: boolean | null;
};

type CobrancaRow = {
  id: string;
  descricao: string;
  valor_final: number | string | null;
  data_vencimento: string;
  status: string;
  aluno_id: string;
  alunos: {
    nome: string | null;
    responsaveis_aluno: ResponsavelRow[];
  } | null;
};

function diffDias(de: string, ate: string): number {
  const [ay, am, ad] = de.split("-").map(Number);
  const [by, bm, bd] = ate.split("-").map(Number);
  const a = Date.UTC(ay, am - 1, ad);
  const b = Date.UTC(by, bm - 1, bd);
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}

// Parte pura: aplica as regras de elegibilidade.
// jaEnviados: ids de cobranças que já têm lembrete (exclui no modo automático;
// passar Set vazio no modo forçar reenvio).
export function filtrarElegiveis(
  cobrancas: CobrancaRow[],
  hoje: string,
  jaEnviados: Set<string>,
): LembretePendente[] {
  const resultado: LembretePendente[] = [];
  for (const c of cobrancas) {
    if (c.data_vencimento >= hoje) continue; // não vencida
    if (!STATUS_EM_ABERTO.has(c.status)) continue; // paga/cancelada
    if (jaEnviados.has(c.id)) continue; // já avisada

    const responsavel = (c.alunos?.responsaveis_aluno ?? []).find(
      (r) => r.responsavel_financeiro === true && !!r.celular,
    );
    if (!responsavel?.celular) continue;

    resultado.push({
      cobrancaId: c.id,
      alunoId: c.aluno_id,
      alunoNome: c.alunos?.nome ?? "Aluno",
      responsavelNome: responsavel.nome ?? "Responsável",
      telefone: responsavel.celular,
      descricao: c.descricao,
      valor: Number(c.valor_final ?? 0),
      vencimento: c.data_vencimento,
      diasAtraso: diffDias(c.data_vencimento, hoje),
    });
  }
  return resultado;
}

type SupabaseLike = {
  from: (table: string) => any;
};

function hojeISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Parte com I/O: busca cobranças vencidas em aberto + responsável financeiro,
// e (se ignorarJaEnviados) descobre quais já têm lembrete.
export async function resolverLembretesPendentes(
  supabase: SupabaseLike,
  escolaId: string = DEFAULT_SCHOOL_ID,
  ignorarJaEnviados: boolean = true,
): Promise<LembretePendente[]> {
  const hoje = hojeISO();

  const { data: cobrancas } = await supabase
    .from("cobrancas")
    .select(
      "id, descricao, valor_final, data_vencimento, status, aluno_id, alunos(nome, responsaveis_aluno(nome, celular, responsavel_financeiro))",
    )
    .eq("escola_id", escolaId)
    .lt("data_vencimento", hoje)
    .in("status", ["aberta", "parcial", "vencida"]);

  const lista = (cobrancas ?? []) as CobrancaRow[];

  let jaEnviados = new Set<string>();
  if (ignorarJaEnviados && lista.length > 0) {
    const { data: enviados } = await supabase
      .from("mensagens_whatsapp")
      .select("referencia_id")
      .eq("escola_id", escolaId)
      .eq("referencia_tipo", "lembrete_cobranca")
      .in("referencia_id", lista.map((c) => c.id));
    jaEnviados = new Set((enviados ?? []).map((m: { referencia_id: string }) => m.referencia_id));
  }

  return filtrarElegiveis(lista, hoje, jaEnviados);
}
```

- [ ] **Step 4: Rodar — deve PASSAR**

Run: `npx vitest run src/lib/lembretes/detectar.test.ts`
Expected: PASS — 8 testes.

- [ ] **Step 5: Commit**

```bash
git add src/lib/lembretes/detectar.ts src/lib/lembretes/detectar.test.ts
git commit -m "feat(lembretes): add eligible charge detection"
```

---

## Task 4: Processador de lembretes

`processarLembretes` — resolve pendentes, monta mensagem de cada um, envia via `enviarWhatsApp`.

**Files:**
- Create: `src/lib/lembretes/processar.ts`

- [ ] **Step 1: Criar `src/lib/lembretes/processar.ts`**

```typescript
import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_SCHOOL_ID, money } from "@/lib/constants";
import { enviarWhatsApp } from "@/lib/whatsapp/send";
import { montarMensagem } from "./montar-mensagem";
import { resolverLembretesPendentes } from "./detectar";

const TEMPLATE_FALLBACK =
  "Olá {responsavel}, a mensalidade de {aluno} ({descricao}) no valor de {valor}, vencida em {vencimento}, está em aberto há {dias_atraso} dia(s). Por favor, regularize.";
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

  // Template da escola (com fallback se nulo).
  const { data: escola } = await supabase
    .from("escolas")
    .select("lembrete_template")
    .eq("id", escolaId)
    .maybeSingle();
  const template = escola?.lembrete_template || TEMPLATE_FALLBACK;

  // forcarReenvio → não ignora já enviados.
  const pendentes = await resolverLembretesPendentes(supabase, escolaId, !opts.forcarReenvio);
  const lote = pendentes.slice(0, LIMITE_LOTE);

  let enviados = 0;
  let falhas = 0;

  for (const p of lote) {
    const mensagem = montarMensagem(template, {
      responsavel: p.responsavelNome,
      aluno: p.alunoNome,
      descricao: p.descricao,
      valor: money.format(p.valor),
      vencimento: dataBR(p.vencimento),
      diasAtraso: p.diasAtraso,
    });

    const resultado = await enviarWhatsApp({
      telefone: p.telefone,
      mensagem,
      alunoId: p.alunoId,
      referenciaTipo: "lembrete_cobranca",
      referenciaId: p.cobrancaId,
    });

    if (resultado.ok) enviados += 1;
    else falhas += 1;
  }

  return { processados: lote.length, enviados, falhas };
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros. Confirme que `money` é exportado de `@/lib/constants` (usado em `src/components/dashboard/saldo-ytd-card.tsx`). Confirme `enviarWhatsApp` aceita `referenciaTipo`/`referenciaId` (definido em `src/lib/whatsapp/send.ts`).

- [ ] **Step 3: Commit**

```bash
git add src/lib/lembretes/processar.ts
git commit -m "feat(lembretes): add reminder processor"
```

---

## Task 5: Data layer

`getConfigLembretes` e `contarLembretesPendentes` para a tela.

**Files:**
- Create: `src/lib/data/lembretes.ts`

- [ ] **Step 1: Criar `src/lib/data/lembretes.ts`**

```typescript
import { createServerClient } from "@/lib/supabase/server";
import { DEFAULT_SCHOOL_ID } from "@/lib/constants";
import { resolverLembretesPendentes } from "@/lib/lembretes/detectar";

export type ConfigLembretes = {
  autoAtivo: boolean;
  template: string;
};

const TEMPLATE_FALLBACK =
  "Olá {responsavel}, a mensalidade de {aluno} ({descricao}) no valor de {valor}, vencida em {vencimento}, está em aberto há {dias_atraso} dia(s). Por favor, regularize.";

export async function getConfigLembretes(
  escolaId: string = DEFAULT_SCHOOL_ID,
): Promise<ConfigLembretes> {
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("escolas")
    .select("lembrete_auto_ativo, lembrete_template")
    .eq("id", escolaId)
    .maybeSingle();
  return {
    autoAtivo: !!data?.lembrete_auto_ativo,
    template: data?.lembrete_template || TEMPLATE_FALLBACK,
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

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/lib/data/lembretes.ts
git commit -m "feat(lembretes): add data layer"
```

---

## Task 6: Server actions

`salvarConfigLembretesAction` (salva flag + template) e `enviarLembretesAgoraAction` (envio manual).

**Files:**
- Create: `src/lib/actions/lembretes.ts`

- [ ] **Step 1: Criar `src/lib/actions/lembretes.ts`**

```typescript
"use server";

import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/session";
import { formText } from "@/lib/utils";
import { processarLembretes } from "@/lib/lembretes/processar";

export async function salvarConfigLembretesAction(formData: FormData) {
  const session = await requirePermission("financeiro.cobrancas", "update");
  const supabase = await createServerClient();

  const template = formText(formData, "template");
  const autoAtivo = formData.get("auto_ativo") === "on";

  if (!template) {
    throw new Error("O template da mensagem é obrigatório");
  }

  await supabase
    .from("escolas")
    .update({
      lembrete_auto_ativo: autoAtivo,
      lembrete_template: template,
    })
    .eq("id", session.profile.escola_id);

  revalidatePath("/configuracoes/lembretes");
}

export async function enviarLembretesAgoraAction() {
  const session = await requirePermission("financeiro.cobrancas", "update");

  // Envio manual: respeita "uma vez por cobrança" (não força reenvio).
  await processarLembretes({ forcarReenvio: false }, session.profile.escola_id);

  revalidatePath("/configuracoes/lembretes");
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros. Confirme `formText` em `@/lib/utils`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/actions/lembretes.ts
git commit -m "feat(lembretes): add server actions for config and manual send"
```

---

## Task 7: Rota do cron

`GET /api/lembretes/processar` — protegida por `CRON_SECRET`, checa a flag antes de processar.

**Files:**
- Create: `src/app/api/lembretes/processar/route.ts`
- Modify: `vercel.json`

- [ ] **Step 1: Criar a rota**

`src/app/api/lembretes/processar/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_SCHOOL_ID } from "@/lib/constants";
import { processarLembretes } from "@/lib/lembretes/processar";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");

  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  // Só processa se o envio automático estiver ligado para a escola.
  const supabase = createAdminClient();
  const { data: escola } = await supabase
    .from("escolas")
    .select("lembrete_auto_ativo")
    .eq("id", DEFAULT_SCHOOL_ID)
    .maybeSingle();

  if (!escola?.lembrete_auto_ativo) {
    return NextResponse.json({ skipped: "envio automático desativado" });
  }

  const resultado = await processarLembretes({ forcarReenvio: false }, DEFAULT_SCHOOL_ID);
  return NextResponse.json(resultado);
}
```

- [ ] **Step 2: Adicionar o segundo cron ao `vercel.json`**

O `vercel.json` atual tem o cron de comunicados:
```json
{
  "framework": "nextjs",
  "buildCommand": "npm run build",
  "outputDirectory": ".next",
  "crons": [
    {
      "path": "/api/comunicados/processar",
      "schedule": "* * * * *"
    }
  ]
}
```

Adicionar o segundo objeto ao array `crons` (lembrete roda 1x/dia às 9h UTC):
```json
{
  "framework": "nextjs",
  "buildCommand": "npm run build",
  "outputDirectory": ".next",
  "crons": [
    {
      "path": "/api/comunicados/processar",
      "schedule": "* * * * *"
    },
    {
      "path": "/api/lembretes/processar",
      "schedule": "0 9 * * *"
    }
  ]
}
```

- [ ] **Step 3: Verificar tipos e build**

Run: `npx tsc --noEmit && npm run build`
Expected: sem erros; rota `/api/lembretes/processar` aparece no build.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/lembretes/processar/route.ts vercel.json
git commit -m "feat(lembretes): add daily cron route for reminders"
```

---

## Task 8: Form de configuração (client component)

Toggle do envio automático, textarea do template, botão de envio manual.

**Files:**
- Create: `src/components/lembretes/config-lembretes-form.tsx`

- [ ] **Step 1: Criar `src/components/lembretes/config-lembretes-form.tsx`**

```typescript
"use client";

import { useState } from "react";
import { Save, Send } from "lucide-react";
import { Panel } from "@/components/ui/card";
import {
  salvarConfigLembretesAction,
  enviarLembretesAgoraAction,
} from "@/lib/actions/lembretes";

const PLACEHOLDERS = [
  "{responsavel}",
  "{aluno}",
  "{descricao}",
  "{valor}",
  "{vencimento}",
  "{dias_atraso}",
];

export function ConfigLembretesForm({
  autoAtivo,
  template,
  pendentes,
}: {
  autoAtivo: boolean;
  template: string;
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

          <label className="grid gap-1 text-sm">
            Mensagem do lembrete
            <textarea
              name="template"
              required
              rows={5}
              defaultValue={template}
              maxLength={2000}
            />
          </label>

          <div className="rounded-ui bg-muted/40 p-3 text-xs text-ink/60">
            <span className="font-semibold text-ink/75">Placeholders disponíveis:</span>{" "}
            {PLACEHOLDERS.join("  ")}
          </div>

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

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/components/lembretes/config-lembretes-form.tsx
git commit -m "feat(lembretes): add config form component"
```

---

## Task 9: Página de configuração

Server component — carrega config + contagem de pendentes, renderiza o form.

**Files:**
- Create: `src/app/(app)/configuracoes/lembretes/page.tsx`

- [ ] **Step 1: Criar `src/app/(app)/configuracoes/lembretes/page.tsx`**

```typescript
import { PageHeader } from "@/components/ui/page-header";
import { requirePermission } from "@/lib/auth/session";
import { getConfigLembretes, contarLembretesPendentes } from "@/lib/data/lembretes";
import { ConfigLembretesForm } from "@/components/lembretes/config-lembretes-form";

export const dynamic = "force-dynamic";

export default async function LembretesConfigPage() {
  const session = await requirePermission("financeiro.cobrancas", "read");

  const config = await getConfigLembretes(session.profile.escola_id);
  const pendentes = await contarLembretesPendentes(session.profile.escola_id);

  return (
    <div className="grid gap-6">
      <PageHeader
        breadcrumb={[{ label: "Configurações" }, { label: "Lembretes" }]}
        title="Lembretes de inadimplência"
        description="Avisa o responsável financeiro por WhatsApp quando uma cobrança vence."
      />
      <ConfigLembretesForm
        autoAtivo={config.autoAtivo}
        template={config.template}
        pendentes={pendentes}
      />
    </div>
  );
}
```

- [ ] **Step 2: Verificar tipos e build**

Run: `npx tsc --noEmit && npm run build`
Expected: sem erros; rota `/configuracoes/lembretes` no build.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(app)/configuracoes/lembretes/page.tsx"
git commit -m "feat(lembretes): add config page"
```

---

## Task 10: Link no menu de Configurações

**Files:**
- Modify: `src/components/layout/topbar.tsx`

- [ ] **Step 1: Adicionar item em `CONFIG_ITEMS`**

Em `src/components/layout/topbar.tsx`, no array `CONFIG_ITEMS`, adicionar após a linha de
`"/configuracoes/webhook"`:

```typescript
  { href: "/configuracoes/webhook", label: "Webhook", iconName: "Webhook" },
  { href: "/configuracoes/lembretes", label: "Lembretes", iconName: "BellRing" },
```

- [ ] **Step 2: Garantir o ícone em `dropdown-icons.tsx`**

Abrir `src/components/layout/dropdown-icons.tsx`. Se `BellRing` não estiver no import de
`lucide-react` e no `ICON_MAP`, adicionar nos dois lugares (`BellRing` no import,
`BellRing,` no `ICON_MAP`).

- [ ] **Step 3: Verificar tipos e build**

Run: `npx tsc --noEmit && npm run build`
Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/topbar.tsx src/components/layout/dropdown-icons.tsx
git commit -m "feat(lembretes): add lembretes link to settings menu"
```

---

## Task 11: Verificação final

- [ ] **Step 1: Rodar todos os testes**

Run: `npm test`
Expected: `montar-mensagem.test.ts` (5) + `detectar.test.ts` (8) + suítes existentes
(`telefone` 10, `dias-letivos` 10, `feriados` 14, `destinatarios` 6) = 53 passando.

- [ ] **Step 2: Build final**

Run: `npm run build`
Expected: passa; rota `/configuracoes/lembretes` e `/api/lembretes/processar` listadas.

- [ ] **Step 3: Smoke test manual** (requer dev server)

1. `/configuracoes/lembretes` abre, mostra a config e a contagem de pendentes.
2. Editar o template, marcar o toggle, salvar → recarrega com os valores persistidos.
3. Se houver cobrança vencida em aberto com responsável financeiro: "Enviar lembretes
   agora" → processa; sem env Evolution, as mensagens viram `falha` controlada e
   aparecem em `mensagens_whatsapp` com `referencia_tipo = "lembrete_cobranca"`.
4. Rodar a rota do cron manualmente com a flag ligada:
   `curl -H "Authorization: Bearer <CRON_SECRET>" http://localhost:3001/api/lembretes/processar`
   → processa. Com a flag desligada → retorna `{ "skipped": ... }`.
5. Reexecutar o cron → cobranças já avisadas não são reenviadas (count cai para 0).

---

## Notas de execução

- **"Uma vez por cobrança":** garantido por `resolverLembretesPendentes` com
  `ignorarJaEnviados = true` — exclui cobranças que já têm linha
  `referencia_tipo = "lembrete_cobranca"` em `mensagens_whatsapp`. O envio manual também
  usa `forcarReenvio: false`, então respeita a mesma regra (não há reenvio neste escopo;
  reenvio forçado fica como capacidade futura via `forcarReenvio: true`).
- **Flag de envio automático:** a rota do cron checa `lembrete_auto_ativo` e sai cedo se
  `false`. O botão manual chama `processarLembretes` direto, sem checar a flag.
- **Service client:** `processar.ts` e a rota do cron usam `createAdminClient`
  (service_role) — o cron roda sem usuário autenticado.
- **Sem env = sem quebra:** sem `EVOLUTION_*`, os lembretes viram `falha` controlada;
  sem `CRON_SECRET`, a rota retorna 401.
- **Migração:** Task 1 aplica via MCP direto em produção (`fljkjhmwnjehsodvqaqk`); o `.sql`
  fica versionado em `supabase/migrations/`.
- **RBAC:** sem módulo novo — reusa `financeiro.cobrancas`. A página e as actions usam
  `requirePermission("financeiro.cobrancas", ...)`.
