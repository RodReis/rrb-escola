# Cadastro de Empresa — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expandir o cadastro de `companies` (RH › Empresas) com logo funcional,
endereço estruturado, assinaturas de 4 cargos e dados extras (site, whatsapp,
INEP, mantenedora, nome fantasia), organizados em abas, e fazer o histórico
escolar passar a usar o logo real em vez do arquivo fixo.

**Architecture:** Migration aditiva em `companies` (novas colunas, sem dropar
nada). Duas Server Actions novas de upload/remoção de logo, reaproveitando o
bucket `escola-logos` já existente. `CompanyForm` ganha um componente de abas
novo (`Tabs`, client component simples — não existe no DS ainda) e passa a
enviar todos os campos. `updateCompanyAction`/`CompanyUpdateSchema` estendidos.
Histórico passa a resolver o logo a partir de `companies.logo_path` com
fallback para o arquivo estático atual.

**Tech Stack:** Next.js 14 App Router, Server Actions, Supabase (Postgres +
Storage), Zod, Tailwind com tokens do DS (`ds-*`, `bg-brand`, `text-ink`, etc).

**Spec:** `docs/superpowers/specs/2026-09-24-empresa-cadastro-design.md`

## Global Constraints

- Cor só via token/classe Tailwind tokenizada — proibido hex/rgb cru (regra do
  CLAUDE.md do projeto).
- Sem serifa nos títulos da UI (Bricolage Grotesque via classes existentes) —
  não se aplica ao PDF do histórico/certificado, que já usa fonte própria
  (`times`), fora do DS da aplicação.
- Nunca usar `confirm()` nativo — usar `useConfirm`/`ConfirmButton` do DS
  quando uma ação precisar de confirmação.
- `npm run typecheck && npm run build` verdes antes de fechar a fase.
- Migration é aditiva (`add column if not exists`), nunca dropar coluna.
- Reaproveitar nomes existentes (`rh.empresas` como permissão, `companies`
  como tabela) — trocar só o visual/campos internos, não a API pública das
  actions já usadas por outras telas (RH, isaac, Sicoob, histórico).

## Review Focus

- **Logo ausente:** `logo_path` vazio (caso hoje de 100% das companies) não
  pode quebrar o upload nem o histórico — precisa cair no fallback estático
  em todos os pontos que leem logo.
- **Upload de arquivo inválido:** arquivo maior que 2MB ou de tipo fora da
  lista permitida precisa ser rejeitado antes de tocar o storage, com
  mensagem clara, não um erro genérico do Supabase.
- **Campos novos vazios na emissão de PDF:** nome fantasia, INEP e
  mantenedora ausentes não podem gerar `"null"`/`"undefined"` impresso no
  cabeçalho — mesma disciplina que `certificado-pdf.test.ts` já cobre para
  RG/filiação/naturalidade ausentes.
- **CNPJ duplicado ao salvar:** o update já trata `error.code === "23505"`
  para nome/CNPJ; os campos novos (INEP, por exemplo) não têm constraint de
  unicidade — não introduzir uma sem necessidade (YAGNI), mas confirmar que
  a company de teste não colide com CNPJ de outra já plantada nos fixtures.
- **Cargo com valor default sobrescrito por string vazia:** ao limpar o campo
  "Cargo da coordenação" e salvar, o valor não pode virar `null`/string vazia
  perdendo o default — precisa voltar para o default (`"Coordenador(a)"`),
  igual ao comportamento já existente para secretário/diretor
  (`secretarioCargo ?? "Secretário(a)"`).

---

## Task 1: Migration — colunas novas em `companies`

**Files:**
- Create: `supabase/migrations/202609240008_companies_dados_completos.sql`
- Test: manual via `supabase db push` local / staging (não há harness de
  migration test no projeto — seguir o padrão já usado nas migrations
  anteriores de `companies`).

**Interfaces:**
- Produces: colunas `numero`, `complemento`, `bairro`, `site`, `whatsapp`,
  `nome_fantasia`, `codigo_inep`, `mantenedora`, `coordenacao_nome`,
  `coordenacao_cargo` (default `'Coordenador(a)'`), `financeiro_nome`,
  `financeiro_cargo` (default `'Financeiro'`) em `companies`. Task 2+ depende
  desses nomes exatos.

- [ ] **Step 1: Escrever a migration**

```sql
-- Campos completos de Empresa: endereco estruturado, contato, identificacao
-- e assinaturas de coordenacao/financeiro. Aditivo, sem dropar nada.

alter table companies
  add column if not exists numero text,
  add column if not exists complemento text,
  add column if not exists bairro text,
  add column if not exists site text,
  add column if not exists whatsapp text,
  add column if not exists nome_fantasia text,
  add column if not exists codigo_inep text,
  add column if not exists mantenedora text,
  add column if not exists coordenacao_nome text,
  add column if not exists coordenacao_cargo text not null default 'Coordenador(a)',
  add column if not exists financeiro_nome text,
  add column if not exists financeiro_cargo text not null default 'Financeiro';

comment on column companies.endereco is 'Logradouro (nome mantido por compatibilidade — numero/complemento/bairro sao colunas separadas)';
```

- [ ] **Step 2: Rodar a migration local**

Run: `cd supabase && supabase db reset --local` (ou `db push` conforme o
fluxo já documentado no projeto — checar `project_migration_order_bug.md`:
preferir `db push` se `db reset --local` estiver quebrado por ordem de
migrations preexistente).

Expected: sem erro; `\d companies` no psql mostra as 12 colunas novas.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/202609240008_companies_dados_completos.sql
git commit -m "feat(rh): adiciona colunas de endereco, contato, identificacao e assinaturas em companies

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 2: Bucket de logo aceita prefixo `companies/`

**Files:**
- Create: `supabase/migrations/202609240009_company_logo_storage_policy.sql`

**Interfaces:**
- Consumes: bucket `escola-logos` (criado em
  `202605290006_avatar_logo_storage.sql`), já público, com policy de
  `select`/`all` sem restrição de prefixo de path.
- Produces: nenhuma mudança de schema necessária — a policy existente
  (`bucket_id = 'escola-logos'`) já cobre qualquer prefixo, incluindo
  `companies/`. Esta task apenas confirma isso e documenta.

- [ ] **Step 1: Verificar a policy existente**

Ler `supabase/migrations/202605290006_avatar_logo_storage.sql:31-43`: a
policy `escola-logos write`/`escola-logos read` filtra só por `bucket_id`,
sem checar o path. Nenhuma migration nova é necessária para permitir o
prefixo `companies/<id>/...` dentro do mesmo bucket.

- [ ] **Step 2: Decisão — não criar migration nesta task**

Não criar o arquivo `202609240009_...`. Anotar no commit da Task 3 (upload
action) que o bucket reaproveitado é `escola-logos`, prefixo `companies/`,
sem policy nova.

*(Task numerada para rastreabilidade do plano; nenhum arquivo é de fato
criado — ver Task 3.)*

---

## Task 3: Server Actions de upload/remoção de logo da empresa

**Files:**
- Modify: `src/lib/actions/rh.ts`
- Test: `src/lib/actions/rh.test.ts` (criar — não existe teste hoje para
  este arquivo; seguir o padrão de mocks de `createServerClient` usado em
  outros `*.test.ts` de actions do projeto, ex.: buscar um exemplo existente
  em `src/lib/actions/*.test.ts` antes de escrever os mocks do zero).

**Interfaces:**
- Consumes: `requirePermission` de `@/lib/auth/session`, `createServerClient`
  de `@/lib/supabase/server`, `revalidatePath`/`redirect` de Next.js (mesmo
  padrão de `uploadEscolaLogoAction` em `src/lib/actions/escola.ts:12-44`).
- Produces: `uploadCompanyLogoAction(formData: FormData): Promise<void>` e
  `removeCompanyLogoAction(formData: FormData): Promise<void>`. `formData`
  de upload carrega `id` (company id) e `logo` (File). `formData` de remoção
  carrega `id`. Ambas usadas pela Task 5 (UI).

- [ ] **Step 1: Escrever o teste de rejeição de arquivo inválido**

```typescript
// src/lib/actions/rh.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockUpdate = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
const mockUpload = vi.fn();
const mockRequirePermission = vi.fn().mockResolvedValue({
  profile: { escola_id: "escola-1" }
});

vi.mock("@/lib/auth/session", () => ({
  requirePermission: (...args: unknown[]) => mockRequirePermission(...args)
}));
vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn().mockResolvedValue({
    storage: { from: () => ({ upload: mockUpload, remove: vi.fn() }) },
    from: () => ({ update: mockUpdate })
  })
}));
vi.mock("next/navigation", () => ({ redirect: vi.fn((url: string) => { throw new Error(`REDIRECT:${url}`); }) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { uploadCompanyLogoAction } from "./rh";

describe("uploadCompanyLogoAction", () => {
  beforeEach(() => {
    mockUpload.mockReset();
    mockUpdate.mockClear();
  });

  it("rejeita arquivo maior que 2MB antes de chamar o storage", async () => {
    const bigFile = new File([new Uint8Array(3 * 1024 * 1024)], "logo.png", { type: "image/png" });
    const fd = new FormData();
    fd.set("id", "company-1");
    fd.set("logo", bigFile);

    await expect(uploadCompanyLogoAction(fd)).rejects.toThrow("REDIRECT:/rh/empresas/company-1/editar?erro=arquivo_grande");
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it("rejeita extensao fora da lista permitida", async () => {
    const badFile = new File([new Uint8Array(10)], "logo.pdf", { type: "application/pdf" });
    const fd = new FormData();
    fd.set("id", "company-1");
    fd.set("logo", badFile);

    await expect(uploadCompanyLogoAction(fd)).rejects.toThrow("REDIRECT:/rh/empresas/company-1/editar?erro=tipo_invalido");
    expect(mockUpload).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `npm test -- src/lib/actions/rh.test.ts`
Expected: FAIL — `uploadCompanyLogoAction` não existe em `rh.ts`.

- [ ] **Step 3: Implementar as duas actions**

Adicionar em `src/lib/actions/rh.ts`, junto das demais actions de company
(após `toggleCompanyAction`, linha ~108):

```typescript
const IMG_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/svg+xml"]);

export async function uploadCompanyLogoAction(formData: FormData) {
  await requirePermission("rh.empresas", "update");
  const id = String(formData.get("id") ?? "");
  if (!id) redirect("/rh/empresas?erro=ID inválido");

  const file = formData.get("logo");
  if (!(file instanceof File) || file.size === 0) {
    redirect(`/rh/empresas/${id}/editar?erro=sem_arquivo`);
  }
  if (file.size > 2 * 1024 * 1024) {
    redirect(`/rh/empresas/${id}/editar?erro=arquivo_grande`);
  }
  if (!IMG_TYPES.has(file.type)) {
    redirect(`/rh/empresas/${id}/editar?erro=tipo_invalido`);
  }

  const supabase = await createServerClient();
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "png";
  const path = `companies/${id}/${Date.now()}.${ext}`;
  const bytes = Buffer.from(await file.arrayBuffer());

  const { data: uploaded, error: uploadErr } = await supabase.storage
    .from("escola-logos")
    .upload(path, bytes, { contentType: file.type, upsert: false });

  if (uploadErr) redirect(`/rh/empresas/${id}/editar?erro=${encodeURIComponent(uploadErr.message)}`);

  await supabase.from("companies").update({ logo_path: uploaded?.path ?? path }).eq("id", id);

  revalidatePath(`/rh/empresas/${id}`);
  revalidatePath(`/rh/empresas/${id}/editar`);
  redirect(`/rh/empresas/${id}/editar?logo_atualizada=1`);
}

export async function removeCompanyLogoAction(formData: FormData) {
  await requirePermission("rh.empresas", "update");
  const id = String(formData.get("id") ?? "");
  if (!id) redirect("/rh/empresas?erro=ID inválido");

  const supabase = await createServerClient();
  const { error } = await supabase.from("companies").update({ logo_path: null }).eq("id", id);
  if (error) redirect(`/rh/empresas/${id}/editar?erro=${encodeURIComponent(error.message)}`);

  revalidatePath(`/rh/empresas/${id}`);
  revalidatePath(`/rh/empresas/${id}/editar`);
  redirect(`/rh/empresas/${id}/editar?logo_removida=1`);
}
```

- [ ] **Step 4: Rodar o teste e ver passar**

Run: `npm test -- src/lib/actions/rh.test.ts`
Expected: PASS — 2 testes verdes.

- [ ] **Step 5: Commit**

```bash
git add src/lib/actions/rh.ts src/lib/actions/rh.test.ts
git commit -m "feat(rh): actions de upload e remocao de logo da empresa

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 4: Estender validação, tipos e leitura de dados (`Company`)

**Files:**
- Modify: `src/lib/validation/rh.ts`
- Modify: `src/lib/data/rh.ts`
- Test: `src/lib/validation/rh.test.ts` (criar)

**Interfaces:**
- Consumes: `CompanySchema`/`CompanyUpdateSchema` existentes (Task 4
  estende, não substitui).
- Produces: `CompanyUpdateSchema` com os 12 campos novos, todos opcionais;
  tipo `Company` em `src/lib/data/rh.ts` com os mesmos campos. Task 5 (form)
  e Task 6 (action de update) consomem esses nomes de campo exatamente como
  definidos aqui.

- [ ] **Step 1: Escrever o teste de validação**

```typescript
// src/lib/validation/rh.test.ts
import { describe, it, expect } from "vitest";
import { CompanyUpdateSchema } from "./rh";

const base = {
  id: "123e4567-e89b-12d3-a456-426614174000",
  name: "Escola Teste Ltda",
  cnpj: "11.222.333/0001-44",
  ativo: "on"
};

describe("CompanyUpdateSchema — campos novos", () => {
  it("aceita todos os campos novos vazios", () => {
    const parsed = CompanyUpdateSchema.safeParse(base);
    expect(parsed.success).toBe(true);
  });

  it("aceita os campos novos preenchidos", () => {
    const parsed = CompanyUpdateSchema.safeParse({
      ...base,
      numero: "473",
      complemento: "Q 24, L 17",
      bairro: "Centro",
      site: "https://epgtrindade.com.br",
      whatsapp: "(62) 99999-0000",
      nomeFantasia: "EPG Trindade",
      codigoInep: "52012345",
      mantenedora: "Escola Infantil Pinguinho de Gente Ltda",
      coordenacaoNome: "Janaina Maria",
      coordenacaoCargo: "Coordenador(a) Geral",
      financeiroNome: "Keila Regina",
      financeiroCargo: "Financeiro"
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.nomeFantasia).toBe("EPG Trindade");
    }
  });
});
```

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `npm test -- src/lib/validation/rh.test.ts`
Expected: FAIL — campos como `numero`, `nomeFantasia` não existem no schema
(zod ignora chaves desconhecidas por padrão, então o teste de "aceita
preenchido" passa mesmo sem os campos — a falha real aparece na Task 5/6
quando o valor não chega ao banco. Para este teste pegar a ausência,
adicionar uma asserção de shape):

```typescript
  it("schema conhece o campo nomeFantasia", () => {
    expect(CompanyUpdateSchema.shape).toHaveProperty("nomeFantasia");
  });
```

Expected: FAIL — `undefined` não tem a propriedade.

- [ ] **Step 3: Estender `CompanyUpdateSchema`**

Em `src/lib/validation/rh.ts`, substituir o bloco `CompanyUpdateSchema`:

```typescript
export const CompanyUpdateSchema = CompanySchema.extend({
  id: z.string().uuid(),
  ativo: z.preprocess((v) => v === "on" || v === true, z.boolean()),
  // Endereco estruturado.
  endereco: optionalText(),
  numero: optionalText(),
  complemento: optionalText(),
  bairro: optionalText(),
  cidade: optionalText(),
  uf: optionalText(),
  cep: optionalText(),
  // Outras informacoes.
  resolucao: optionalText(),
  telefones: optionalText(),
  email: optionalText(),
  site: optionalText(),
  whatsapp: optionalText(),
  nomeFantasia: optionalText(),
  codigoInep: optionalText(),
  mantenedora: optionalText(),
  // Assinaturas.
  secretarioNome: optionalText(),
  secretarioCargo: optionalText(),
  diretorNome: optionalText(),
  diretorCargo: optionalText(),
  coordenacaoNome: optionalText(),
  coordenacaoCargo: optionalText(),
  financeiroNome: optionalText(),
  financeiroCargo: optionalText()
});
```

- [ ] **Step 4: Estender o tipo `Company` e as queries em `src/lib/data/rh.ts`**

```typescript
export type Company = {
  id: string;
  cnpj: string;
  name: string;
  ativo: boolean;
  endereco: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  cep: string | null;
  resolucao: string | null;
  telefones: string | null;
  email: string | null;
  site: string | null;
  whatsapp: string | null;
  nome_fantasia: string | null;
  codigo_inep: string | null;
  mantenedora: string | null;
  logo_path: string | null;
  secretario_nome: string | null;
  secretario_cargo: string;
  diretor_nome: string | null;
  diretor_cargo: string;
  coordenacao_nome: string | null;
  coordenacao_cargo: string;
  financeiro_nome: string | null;
  financeiro_cargo: string;
  created_at: string | null;
  updated_at: string | null;
};
```

Atualizar o `.select(...)` em `listCompanies` e `getCompanyById` (linhas ~36
e ~50) para incluir as colunas novas:

```typescript
    .select(
      "id, cnpj, name, ativo, endereco, numero, complemento, bairro, cidade, uf, cep, resolucao, telefones, email, site, whatsapp, nome_fantasia, codigo_inep, mantenedora, logo_path, secretario_nome, secretario_cargo, diretor_nome, diretor_cargo, coordenacao_nome, coordenacao_cargo, financeiro_nome, financeiro_cargo, created_at, updated_at"
    )
```

- [ ] **Step 5: Rodar o teste e ver passar**

Run: `npm test -- src/lib/validation/rh.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/validation/rh.ts src/lib/validation/rh.test.ts src/lib/data/rh.ts
git commit -m "feat(rh): estende Company e validacao com endereco completo, contato e assinaturas

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 5: `updateCompanyAction` grava os campos novos

**Files:**
- Modify: `src/lib/actions/rh.ts`
- Test: `src/lib/actions/rh.test.ts` (estender o arquivo criado na Task 3)

**Interfaces:**
- Consumes: `CompanyUpdateSchema` (Task 4).
- Produces: `updateCompanyAction` grava todos os campos novos em `companies`,
  aplicando o default de cargo quando o campo vem vazio (mesma regra já
  existente para secretário/diretor).

- [ ] **Step 1: Escrever o teste do default de cargo**

```typescript
// adicionar em src/lib/actions/rh.test.ts

describe("updateCompanyAction", () => {
  it("aplica o default de cargo quando o campo vem vazio", async () => {
    const fd = new FormData();
    fd.set("id", "123e4567-e89b-12d3-a456-426614174000");
    fd.set("name", "Escola Teste Ltda");
    fd.set("cnpj", "11.222.333/0001-44");
    fd.set("ativo", "on");
    fd.set("coordenacaoCargo", "");
    fd.set("financeiroCargo", "");

    const { updateCompanyAction } = await import("./rh");
    await expect(updateCompanyAction(fd)).rejects.toThrow("REDIRECT:");

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        coordenacao_cargo: "Coordenador(a)",
        financeiro_cargo: "Financeiro"
      })
    );
  });
});
```

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `npm test -- src/lib/actions/rh.test.ts`
Expected: FAIL — `updateCompanyAction` ainda não lê/grava esses campos.

- [ ] **Step 3: Atualizar `updateCompanyAction`**

Em `src/lib/actions/rh.ts`, no parse (linhas ~42-58), adicionar a leitura dos
campos novos do `formData`, e no `.update({...})` (linhas ~67-82), adicionar
a gravação, com os mesmos defaults do padrão já usado:

```typescript
export async function updateCompanyAction(formData: FormData) {
  await requirePermission("rh.empresas", "update");

  const parsed = CompanyUpdateSchema.safeParse({
    id: String(formData.get("id") ?? ""),
    name: String(formData.get("name") ?? "").trim(),
    cnpj: String(formData.get("cnpj") ?? "").trim(),
    ativo: formData.get("ativo"),
    endereco: formData.get("endereco"),
    numero: formData.get("numero"),
    complemento: formData.get("complemento"),
    bairro: formData.get("bairro"),
    cidade: formData.get("cidade"),
    uf: formData.get("uf"),
    cep: formData.get("cep"),
    resolucao: formData.get("resolucao"),
    telefones: formData.get("telefones"),
    email: formData.get("email"),
    site: formData.get("site"),
    whatsapp: formData.get("whatsapp"),
    nomeFantasia: formData.get("nomeFantasia"),
    codigoInep: formData.get("codigoInep"),
    mantenedora: formData.get("mantenedora"),
    secretarioNome: formData.get("secretarioNome"),
    secretarioCargo: formData.get("secretarioCargo"),
    diretorNome: formData.get("diretorNome"),
    diretorCargo: formData.get("diretorCargo"),
    coordenacaoNome: formData.get("coordenacaoNome"),
    coordenacaoCargo: formData.get("coordenacaoCargo"),
    financeiroNome: formData.get("financeiroNome"),
    financeiroCargo: formData.get("financeiroCargo")
  });
  if (!parsed.success) {
    const id = formData.get("id");
    redirect(`/rh/empresas/${id}/editar?erro=${firstError(parsed.error)}`);
  }

  const supabase = await createServerClient();
  const { error } = await supabase
    .from("companies")
    .update({
      name: parsed.data.name,
      cnpj: parsed.data.cnpj,
      ativo: parsed.data.ativo,
      endereco: parsed.data.endereco ?? null,
      numero: parsed.data.numero ?? null,
      complemento: parsed.data.complemento ?? null,
      bairro: parsed.data.bairro ?? null,
      cidade: parsed.data.cidade ?? null,
      uf: parsed.data.uf ?? null,
      cep: parsed.data.cep ?? null,
      resolucao: parsed.data.resolucao ?? null,
      telefones: parsed.data.telefones ?? null,
      email: parsed.data.email ?? null,
      site: parsed.data.site ?? null,
      whatsapp: parsed.data.whatsapp ?? null,
      nome_fantasia: parsed.data.nomeFantasia ?? null,
      codigo_inep: parsed.data.codigoInep ?? null,
      mantenedora: parsed.data.mantenedora ?? null,
      secretario_nome: parsed.data.secretarioNome ?? null,
      secretario_cargo: parsed.data.secretarioCargo ?? "Secretário(a)",
      diretor_nome: parsed.data.diretorNome ?? null,
      diretor_cargo: parsed.data.diretorCargo ?? "Diretor(a)",
      coordenacao_nome: parsed.data.coordenacaoNome ?? null,
      coordenacao_cargo: parsed.data.coordenacaoCargo ?? "Coordenador(a)",
      financeiro_nome: parsed.data.financeiroNome ?? null,
      financeiro_cargo: parsed.data.financeiroCargo ?? "Financeiro"
    })
    .eq("id", parsed.data.id);

  if (error) {
    const msg = error.code === "23505" ? "CNPJ já cadastrado" : error.message;
    redirect(`/rh/empresas/${parsed.data.id}/editar?erro=${encodeURIComponent(msg)}`);
  }

  revalidatePath("/rh/empresas");
  revalidatePath(`/rh/empresas/${parsed.data.id}`);
  redirect("/rh/empresas?ok=editada");
}
```

- [ ] **Step 4: Rodar o teste e ver passar**

Run: `npm test -- src/lib/actions/rh.test.ts`
Expected: PASS — todos os testes de `rh.test.ts` verdes.

- [ ] **Step 5: Commit**

```bash
git add src/lib/actions/rh.ts src/lib/actions/rh.test.ts
git commit -m "feat(rh): updateCompanyAction grava endereco completo, contato e assinaturas

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 6: Componente `Tabs` no DS

**Files:**
- Create: `src/components/ui/tabs.tsx`
- Test: `src/components/ui/tabs.test.tsx`

**Interfaces:**
- Produces: `<Tabs defaultValue={string} items={{ value: string; label: string; content: ReactNode }[]} />`
  — client component, sem dependência externa, controla a aba ativa com
  `useState`. Task 7 (CompanyForm) consome este componente.

- [ ] **Step 1: Escrever o teste**

```tsx
// src/components/ui/tabs.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Tabs } from "./tabs";

describe("Tabs", () => {
  it("mostra o conteudo da aba inicial e troca ao clicar", () => {
    render(
      <Tabs
        defaultValue="endereco"
        items={[
          { value: "endereco", label: "Endereço", content: <div>Conteúdo endereço</div> },
          { value: "assinaturas", label: "Assinaturas", content: <div>Conteúdo assinaturas</div> }
        ]}
      />
    );

    expect(screen.getByText("Conteúdo endereço")).toBeInTheDocument();
    expect(screen.queryByText("Conteúdo assinaturas")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Assinaturas" }));

    expect(screen.getByText("Conteúdo assinaturas")).toBeInTheDocument();
    expect(screen.queryByText("Conteúdo endereço")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `npm test -- src/components/ui/tabs.test.tsx`
Expected: FAIL — `./tabs` não existe.

- [ ] **Step 3: Implementar `Tabs`**

```tsx
"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type TabItem = {
  value: string;
  label: string;
  content: ReactNode;
};

type Props = {
  defaultValue: string;
  items: TabItem[];
  className?: string;
};

/**
 * Abas simples, sem lib externa (YAGNI) — usado no formulario de Empresa
 * para separar Endereco / Assinaturas / Outras informacoes sem exigir scroll
 * por um form gigante.
 */
export function Tabs({ defaultValue, items, className }: Props) {
  const [active, setActive] = useState(defaultValue);
  const activeItem = items.find((item) => item.value === active) ?? items[0];

  return (
    <div className={className}>
      <div role="tablist" className="flex gap-2 border-b border-line">
        {items.map((item) => (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={item.value === active}
            onClick={() => setActive(item.value)}
            className={cn(
              "border-b-2 px-4 py-2 text-sm font-medium transition-colors",
              item.value === active
                ? "border-brand text-ink"
                : "border-transparent text-ink/55 hover:text-ink/80"
            )}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="pt-4">{activeItem?.content}</div>
    </div>
  );
}
```

- [ ] **Step 4: Rodar o teste e ver passar**

Run: `npm test -- src/components/ui/tabs.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/tabs.tsx src/components/ui/tabs.test.tsx
git commit -m "feat(ui): componente Tabs simples para formularios com secoes

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 7: `CompanyForm` reorganizado com logo e abas

**Files:**
- Modify: `src/components/rh/company-form.tsx`
- Test: `src/components/rh/company-form.test.tsx` (criar)

**Interfaces:**
- Consumes: `Tabs` (Task 6), `Company` (Task 4),
  `uploadCompanyLogoAction`/`removeCompanyLogoAction` (Task 3),
  `maskCNPJ`/`maskPhone` (existentes).
- Produces: formulário completo por `<form action={action}>` mantendo a
  mesma prop `action` já usada pelas páginas de criar/editar (Task 8 não
  precisa mudar as pages).

- [ ] **Step 1: Escrever o teste de renderização das abas e campos**

```tsx
// src/components/rh/company-form.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CompanyForm } from "./company-form";
import type { Company } from "@/lib/data/rh";

const company: Company = {
  id: "1", cnpj: "11.222.333/0001-44", name: "Escola Teste", ativo: true,
  endereco: "Rua A", numero: "100", complemento: null, bairro: "Centro",
  cidade: "Trindade", uf: "GO", cep: "75388-686",
  resolucao: "RESOLUCAO X", telefones: "(62) 3000-0000", email: "a@a.com",
  site: null, whatsapp: null, nome_fantasia: "EPG Trindade",
  codigo_inep: null, mantenedora: null, logo_path: null,
  secretario_nome: "Fulana", secretario_cargo: "Secretário(a)",
  diretor_nome: "Ciclana", diretor_cargo: "Diretor(a)",
  coordenacao_nome: null, coordenacao_cargo: "Coordenador(a)",
  financeiro_nome: null, financeiro_cargo: "Financeiro",
  created_at: null, updated_at: null
};

describe("CompanyForm", () => {
  it("mostra as 3 abas e troca entre elas", () => {
    render(<CompanyForm action={vi.fn()} company={company} />);

    expect(screen.getByRole("tab", { name: "Endereço" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Assinaturas" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Outras informações" })).toBeInTheDocument();

    expect(screen.getByLabelText(/Logradouro/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Assinaturas" }));
    expect(screen.getByLabelText(/Nome da coordenação/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Nome do financeiro/i)).toBeInTheDocument();
  });

  it("pre-preenche nome fantasia e razao social no topo", () => {
    render(<CompanyForm action={vi.fn()} company={company} />);
    expect(screen.getByDisplayValue("EPG Trindade")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Escola Teste")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `npm test -- src/components/rh/company-form.test.tsx`
Expected: FAIL — abas e campos novos não existem ainda.

- [ ] **Step 3: Reescrever `CompanyForm`**

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs } from "@/components/ui/tabs";
import { maskCNPJ, maskPhone } from "@/lib/format/masks";
import { uploadCompanyLogoAction, removeCompanyLogoAction } from "@/lib/actions/rh";
import type { Company } from "@/lib/data/rh";

type Props = {
  action: (formData: FormData) => void | Promise<void>;
  company?: Company;
  submitLabel?: string;
};

function LogoUploader({ company }: { company: Company }) {
  const logoUrl = company.logo_path
    ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/escola-logos/${company.logo_path}`
    : null;

  return (
    <div className="flex items-center gap-4">
      <div className="flex h-20 w-32 items-center justify-center overflow-hidden rounded-ui border border-line bg-muted">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt={`Logo de ${company.name}`} className="h-full w-full object-contain" />
        ) : (
          <span className="text-xs text-ink/50">Sem logo</span>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <form action={uploadCompanyLogoAction}>
          <input type="hidden" name="id" value={company.id} />
          <label className="ds-button ds-button-secondary cursor-pointer text-xs">
            Atualizar foto
            <input
              type="file"
              name="logo"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              className="sr-only"
              onChange={(e) => e.target.form?.requestSubmit()}
            />
          </label>
        </form>
        {company.logo_path ? (
          <form action={removeCompanyLogoAction}>
            <input type="hidden" name="id" value={company.id} />
            <Button type="submit" variant="ghost" className="text-xs">Remover imagem</Button>
          </form>
        ) : null}
      </div>
    </div>
  );
}

export function CompanyForm({ action, company, submitLabel = "Salvar" }: Props) {
  const [cnpj, setCnpj] = useState(maskCNPJ(company?.cnpj ?? ""));
  const [telefones, setTelefones] = useState(maskPhone(company?.telefones ?? ""));

  return (
    <form action={action} className="grid gap-6">
      {company ? <input type="hidden" name="id" value={company.id} /> : null}

      {company ? <LogoUploader company={company} /> : null}

      <div className="grid gap-4 md:grid-cols-2">
        <label className="md:col-span-2">
          Razão social
          <input
            name="name"
            defaultValue={company?.name ?? ""}
            required
            minLength={3}
            placeholder="Ex.: Escola RRB Educação Ltda."
          />
        </label>

        <label>
          Nome fantasia
          <input name="nomeFantasia" defaultValue={company?.nome_fantasia ?? ""} />
        </label>

        <label>
          CNPJ
          <input
            name="cnpj"
            value={cnpj}
            onChange={(e) => setCnpj(maskCNPJ(e.target.value))}
            required
            placeholder="00.000.000/0000-00"
          />
        </label>

        {company ? (
          <label className="flex grid-cols-none items-center gap-2 self-end pb-3">
            <input name="ativo" type="checkbox" defaultChecked={company.ativo} className="h-4 w-4" />
            Ativa
          </label>
        ) : null}
      </div>

      {company ? (
        <Tabs
          defaultValue="endereco"
          items={[
            {
              value: "endereco",
              label: "Endereço",
              content: (
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="md:col-span-2">
                    Logradouro
                    <input name="endereco" defaultValue={company.endereco ?? ""} placeholder="Rua, Avenida..." />
                  </label>
                  <label>
                    Número
                    <input name="numero" defaultValue={company.numero ?? ""} />
                  </label>
                  <label>
                    Complemento
                    <input name="complemento" defaultValue={company.complemento ?? ""} placeholder="Q 24, L 17" />
                  </label>
                  <label>
                    Bairro
                    <input name="bairro" defaultValue={company.bairro ?? ""} />
                  </label>
                  <label>
                    Cidade
                    <input name="cidade" defaultValue={company.cidade ?? ""} />
                  </label>
                  <label>
                    UF
                    <input name="uf" maxLength={2} defaultValue={company.uf ?? ""} />
                  </label>
                  <label>
                    CEP
                    <input name="cep" defaultValue={company.cep ?? ""} placeholder="00000-000" />
                  </label>
                </div>
              )
            },
            {
              value: "assinaturas",
              label: "Assinaturas",
              content: (
                <div className="grid gap-4 md:grid-cols-2">
                  <label>
                    Nome do(a) secretário(a)
                    <input name="secretarioNome" defaultValue={company.secretario_nome ?? ""} />
                  </label>
                  <label>
                    Cargo do(a) secretário(a)
                    <input name="secretarioCargo" defaultValue={company.secretario_cargo ?? "Secretário(a)"} />
                  </label>

                  <label>
                    Nome do(a) diretor(a)
                    <input name="diretorNome" defaultValue={company.diretor_nome ?? ""} />
                  </label>
                  <label>
                    Cargo do(a) diretor(a)
                    <input name="diretorCargo" defaultValue={company.diretor_cargo ?? "Diretor(a)"} />
                  </label>

                  <label>
                    Nome da coordenação
                    <input name="coordenacaoNome" defaultValue={company.coordenacao_nome ?? ""} />
                  </label>
                  <label>
                    Cargo da coordenação
                    <input name="coordenacaoCargo" defaultValue={company.coordenacao_cargo ?? "Coordenador(a)"} />
                  </label>

                  <label>
                    Nome do financeiro
                    <input name="financeiroNome" defaultValue={company.financeiro_nome ?? ""} />
                  </label>
                  <label>
                    Cargo do financeiro
                    <input name="financeiroCargo" defaultValue={company.financeiro_cargo ?? "Financeiro"} />
                  </label>
                </div>
              )
            },
            {
              value: "outras",
              label: "Outras informações",
              content: (
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="md:col-span-2">
                    Portaria / Resolução
                    <input
                      name="resolucao"
                      defaultValue={company.resolucao ?? ""}
                      placeholder="Ex.: RENOVAÇÃO DE RECONHECIMENTO, RESOLUÇÃO CEE/CEB Nº 000/0000"
                    />
                  </label>

                  <label>
                    E-mail
                    <input name="email" type="email" defaultValue={company.email ?? ""} />
                  </label>
                  <label>
                    Site
                    <input name="site" type="url" defaultValue={company.site ?? ""} placeholder="https://" />
                  </label>
                  <label>
                    WhatsApp
                    <input name="whatsapp" defaultValue={company.whatsapp ?? ""} placeholder="(00) 00000-0000" />
                  </label>
                  <label>
                    Telefone
                    <input
                      name="telefones"
                      value={telefones}
                      onChange={(e) => setTelefones(maskPhone(e.target.value))}
                      placeholder="(00) 00000-0000"
                    />
                  </label>

                  <label>
                    Código INEP
                    <input name="codigoInep" defaultValue={company.codigo_inep ?? ""} />
                  </label>
                  <label className="md:col-span-2">
                    Entidade mantenedora
                    <input name="mantenedora" defaultValue={company.mantenedora ?? ""} />
                  </label>
                </div>
              )
            }
          ]}
        />
      ) : null}

      <div className="flex justify-end gap-2">
        <Button type="submit" variant="primary">{submitLabel}</Button>
      </div>
    </form>
  );
}
```

- [ ] **Step 4: Rodar o teste e ver passar**

Run: `npm test -- src/components/rh/company-form.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/rh/company-form.tsx src/components/rh/company-form.test.tsx
git commit -m "feat(rh): CompanyForm com logo, abas de endereco/assinaturas/outras informacoes

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 8: Histórico usa `logo_path` com fallback

**Files:**
- Modify: `src/components/historico/emissao-form.tsx`
- Modify: `src/lib/data/historico.ts:27` (`mapCredenciamento`)
- Test: `src/lib/documents/historico-pdf.test.ts` (estender — arquivo já
  existe, conforme mapeamento prévio)

**Interfaces:**
- Consumes: `HistoricoCredenciamento.logoPath` (já existe no tipo, só não era
  usado para nada além de repassar).
- Produces: nova função `logoParaDataUrl(logoPath: string | null): Promise<string | undefined>`
  em `emissao-form.tsx`, substituindo a atual (que ignorava o parâmetro).

- [ ] **Step 1: Escrever o teste do fallback em `mapCredenciamento`**

```typescript
// adicionar em um novo describe de src/lib/documents/historico-pdf.test.ts
// (ou em src/lib/data/historico.test.ts se preferir isolar — checar qual já
// existe antes de criar arquivo novo)

import { describe, it, expect } from "vitest";

describe("nomeFantasia no cabecalho do historico", () => {
  it("usa nome_fantasia quando preenchido, senao usa name", () => {
    // este teste cobre mapCredenciamento diretamente; se a funcao nao for
    // exportada, exportar (mudanca minima) para permitir o teste unitario.
  });
});
```

*(Nota para quem implementa: `mapCredenciamento` não é exportado hoje —
exportar a função em `src/lib/data/historico.ts` como parte do Step 3 abaixo,
antes de escrever o teste real com valores concretos.)*

```typescript
import { mapCredenciamento } from "./historico";

describe("mapCredenciamento", () => {
  it("usa nome_fantasia quando preenchido", () => {
    const row = { name: "Escola Pinguinho de Gente Ltda", nome_fantasia: "EPG Trindade" };
    const resultado = mapCredenciamento(row);
    expect(resultado.nomeFantasia).toBe("EPG Trindade");
    expect(resultado.razaoSocial).toBe("Escola Pinguinho de Gente Ltda");
  });

  it("cai para name quando nome_fantasia esta vazio", () => {
    const row = { name: "Escola Pinguinho de Gente Ltda", nome_fantasia: null };
    const resultado = mapCredenciamento(row);
    expect(resultado.nomeFantasia).toBe("Escola Pinguinho de Gente Ltda");
  });
});
```

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `npm test -- src/lib/data/historico.test.ts`
Expected: FAIL — `mapCredenciamento` não é exportado / não lê
`nome_fantasia`.

- [ ] **Step 3: Exportar e ajustar `mapCredenciamento`**

Em `src/lib/data/historico.ts:25-43`, trocar `function mapCredenciamento` por
`export function mapCredenciamento` e ajustar o campo `nomeFantasia`:

```typescript
export function mapCredenciamento(row: Record<string, unknown>): HistoricoCredenciamento {
  return {
    razaoSocial: (row.name as string) ?? "",
    nomeFantasia: (row.nome_fantasia as string) || (row.name as string) || "",
    cnpj: (row.cnpj as string) ?? null,
    resolucao: (row.resolucao as string) ?? null,
    endereco: (row.endereco as string) ?? null,
    cidade: (row.cidade as string) ?? null,
    uf: (row.uf as string) ?? null,
    cep: (row.cep as string) ?? null,
    telefones: (row.telefones as string) ?? null,
    email: (row.email as string) ?? null,
    logoPath: (row.logo_path as string) ?? null,
    secretarioNome: (row.secretario_nome as string) ?? null,
    secretarioCargo: (row.secretario_cargo as string) ?? "Secretário(a)",
    diretorNome: (row.diretor_nome as string) ?? null,
    diretorCargo: (row.diretor_cargo as string) ?? "Diretor(a)"
  };
}
```

- [ ] **Step 4: Rodar o teste e ver passar**

Run: `npm test -- src/lib/data/historico.test.ts`
Expected: PASS.

- [ ] **Step 5: Trocar a fonte do logo em `emissao-form.tsx`**

Substituir a função `logoParaDataUrl` (linhas 54-67) e seu uso (linha 111):

```typescript
async function logoParaDataUrl(logoPath: string | null): Promise<string | undefined> {
  const url = logoPath
    ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/escola-logos/${logoPath}`
    : "/historico/logo-epg.png";
  try {
    const resposta = await fetch(url);
    if (!resposta.ok) return undefined;
    const blob = await resposta.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  } catch {
    return undefined;
  }
}
```

E no `emitir()` (linha ~109), trocar a chamada:

```typescript
      const [historicos, logoDataUrl] = await Promise.all([
        carregarHistoricosAction(selecionados, nivel),
        logoParaDataUrl(historicos[0]?.credenciamento.logoPath ?? null)
      ]);
```

Atenção: `historicos` só existe depois do primeiro `await` — reordenar para
buscar `historicos` primeiro e então `logoDataUrl`, já que o logo depende do
credenciamento do primeiro histórico carregado:

```typescript
      const historicos = await carregarHistoricosAction(selecionados, nivel);
      if (historicos.length === 0) {
        setErro("Nenhum histórico pôde ser carregado para os alunos selecionados.");
        return;
      }
      const logoDataUrl = await logoParaDataUrl(historicos[0].credenciamento.logoPath ?? null);
      renderHistoricos(historicos, { logoDataUrl }).save(`historicos-${anoLetivo}.pdf`);
```

(Remove a checagem duplicada de `historicos.length === 0` que já existia
depois do `Promise.all` — ver linhas 113-116 do arquivo atual.)

- [ ] **Step 6: Rodar toda a suíte de histórico e certificado**

Run: `npm test -- src/lib/documents`
Expected: PASS — nenhum teste existente de `historico-pdf.test.ts` ou
`certificado-pdf.test.ts` quebra (eles não passam por `emissao-form.tsx`,
mas confirmar que os fixtures que usam `logoPath` continuam batendo).

- [ ] **Step 7: Commit**

```bash
git add src/lib/data/historico.ts src/lib/data/historico.test.ts src/components/historico/emissao-form.tsx
git commit -m "feat(historico): usa logo_path da empresa com fallback para o logo padrao

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 9: Verificação final — typecheck, build e revisão manual

**Files:** nenhum arquivo novo — task de verificação.

- [ ] **Step 1: Rodar typecheck**

Run: `npm run typecheck`
Expected: sem erros.

- [ ] **Step 2: Rodar build**

Run: `npm run build`
Expected: build verde.

- [ ] **Step 3: Rodar toda a suíte de teste**

Run: `npm test`
Expected: todos os testes passam, incluindo os novos desta feature.

- [ ] **Step 4: Checklist manual (smoke test local)**

1. Abrir `/rh/empresas/[id]/editar` de uma company existente.
2. Confirmar as 3 abas aparecem e trocam corretamente.
3. Fazer upload de um PNG pequeno, confirmar que o preview atualiza.
4. Preencher nome fantasia, site, whatsapp, INEP, mantenedora, coordenação e
   financeiro; salvar; reabrir a página e confirmar que os valores
   persistiram.
5. Abrir `/historico/emissao`, emitir um histórico de um aluno cuja série
   está associada a essa company, e confirmar que o PDF mostra o logo
   enviado (não o `logo-epg.png` fixo).
6. Abrir `/historico/certificado` para o mesmo aluno e confirmar que o
   certificado também mostra o logo enviado — este fluxo não muda de código
   (já fazia fallback para `LOGO_PADRAO_PATH` via `getEscolaCertificado`),
   só precisa ser confirmado com dado real agora que `logo_path` é gravável.

- [ ] **Step 5: Commit final (se houver ajustes do smoke test)**

```bash
git add -A
git commit -m "fix(rh): ajustes finais do smoke test do cadastro de empresa

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

*(Pular este commit se o smoke test não exigir nenhuma mudança.)*
