# Relatórios/Etiquetas Dinâmicos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Três relatórios dinâmicos separados (Aluno, Funcionário, Professor) com filtros, catálogo de colunas normalizado, ordenação, cópias, templates salvos por escola e emissão em Etiqueta / Grade PDF / Tabular PDF / CSV.

**Architecture:** Catálogo de colunas em TS por entidade (`{key,label,grupo,relacoes,tipo,resolve}`); server action busca só as relações exigidas pelas colunas, resolve para linhas planas `string[][]`, ordena e devolve; o cliente replica cópias e renderiza (jsPDF + jspdf-autotable, CSV em string). Templates em `relatorio_templates` (jsonb validado por zod). Professor = `employees` + vínculo novo `employees.perfil_id → perfis` para turmas/disciplinas.

**Tech Stack:** Next.js 14 App Router, Supabase (PostgREST + RLS), zod 3, jsPDF 4 + jspdf-autotable 5, @dnd-kit/sortable, sonner, vitest 4 (+ @testing-library/react, jsdom por docblock).

**Spec:** `docs/superpowers/specs/2026-09-25-relatorios-dinamicos-design.md`

## Global Constraints

- Conversão visual segue `docs/design_system/REGRAS-CLAUDE-CODE.md`: cor só via token (`var(--*)` ou classes tokenizadas `text-ink`, `border-line`, `bg-muted`, `text-brand`, `bg-surface`); sem hex/rgb cru em componentes; sem serifa; paridade claro/escuro; reusar `ds-*` e `src/components/ui/*`.
- PDFs podem usar cores RGB literais (jsPDF não lê tokens CSS) — só preto/cinza.
- Nunca usar `confirm()` nativo — sempre `useConfirm` de `src/components/ui/confirm-dialog.tsx`.
- Menus são hardcoded em `src/components/layout/topbar.tsx`; RBAC só filtra.
- Módulo RBAC novo = migration (`modulos` + `role_permissoes`) + `MODULOS` + `ROTA_PARA_MODULO` em `src/lib/auth/permissions.ts`.
- `Acao` do app é `"read" | "create" | "update" | "delete"` (não "edit").
- Cópias por registro: inteiro 1–10. Registros por emissão: ≤ 2000. Fonte da etiqueta: 6–12, passo 0,5, default 7,5. Máx. 4 logos.
- CSV: separador `;`, BOM UTF-8, `\r\n`.
- Vercel não aplica migrations: após merge rodar `supabase db push --linked`. `supabase db reset --local` está quebrado no repo — não usar para validar.
- Quality gate por fase: `npm run typecheck && npm run build` verdes; `npm run test` antes do PR. Commits `feat(relatorios): <fase>` na branch `feat/relatorios-dinamicos`.
- Nada de `console.log` em código de produção.

### Desvios deliberados do spec (decididos ao ler o código)
1. **Códigos de módulo** seguem a convenção com ponto do repo: `relatorios.dinamico-aluno`, `relatorios.dinamico-funcionario`, `relatorios.dinamico-professor` (spec dizia `relatorio_din_*`).
2. **`companies` não tem `escola_id`** (single-tenant): logos = `companies` ativas com `logo_path`; URL pública via `companyLogoUrl()` (bucket público `escola-logos`) — não precisa assinar.
3. **Empresa do cabeçalho**: a primeira de `logosEmpresas`; vazio → primeira empresa ativa (por nome). "Credenciamento vigente" exige série+ano e não existe para Funcionário/Professor.
4. **Cabeçalho não é extraído de `declaracao-pdf.ts`**: layouts diferentes (declaração = logo centralizada; relatório = logos à esquerda + texto à direita). Extrair não reduziria código; `declaracao-pdf.ts` fica intocado.
5. **Colunas salariais** exigem `rh.folha-v2` read (não existe módulo `rh`).
6. **Reordenação de chaves de ordenação** por botões ↑/↓ (colunas selecionadas continuam com arrastar).

## Review Focus

1. **Muitos ids no `.in()`** — seleção de 300+ alunos estoura o tamanho da URL do PostgREST → buscar em lotes de 150 (`emLotes`); teste em Task 9.
2. **Ordenação de datas/números/vazios** — "10/03/2015" ordenado como texto sai errado; valores vazios devem ir para o fim em asc e desc; teste em Task 3.
3. **Template com coluna removida ou sem permissão** (ex.: salário para secretaria) — server rejeita key fora do catálogo filtrado do usuário; cliente descarta com aviso ao carregar; testes em Tasks 9 e 11.
4. **Texto longo na etiqueta** — nome maior que a largura ou mais colunas que linhas cabem nunca invade a etiqueta vizinha; teste em Task 5.
5. **Logo que falha / empresa sem logo / nenhuma empresa** — PDF sai assim mesmo, com aviso; teste em Task 6.

---

## File Structure

```
supabase/migrations/202609250001_relatorio_dinamico.sql     RBAC + relatorio_templates + employees.perfil_id
src/lib/auth/permissions.ts                                  (mod) 3 módulos + 3 rotas
src/lib/validation/rh.ts                                     (mod) perfil_id opcional
src/lib/actions/rh.ts                                        (mod) grava perfil_id
src/lib/data/rh.ts                                           (mod) Employee.perfil_id + listProfessoresVinculaveis
src/components/rh/employee-form.tsx                          (mod) select "Usuário do sistema (professor)"
src/app/(app)/rh/funcionarios/novo/page.tsx                  (mod) passa professores
src/app/(app)/rh/funcionarios/[id]/editar/page.tsx           (mod) passa professores

src/lib/relatorio-dinamico/
  tipos.ts          Entidade, ColunaDef, ColunaMeta, TemplateConfig (zod), filtros (zod), configPadrao, validarEmissao
  formatar.ts       fmtData, fmtMoeda, idade, juntar, normalizarTexto, primeiroNome
  ordenar.ts        chaveOrdenacao, ordenarLinhas, repetirCopias
  montar.ts         montarDados (catálogo + ctxs → DadosRelatorio)
  catalogo/aluno.ts        AlunoCtx + COLUNAS_ALUNO
  catalogo/funcionario.ts  FuncionarioCtx + COLUNAS_FUNCIONARIO
  catalogo/professor.ts    COLUNAS_PROFESSOR
  catalogo/index.ts        getCatalogo, filtrarColunasPorPermissao, catalogoMeta
  dados/lotes.ts           emLotes
  dados/aluno.ts           listarRegistrosAluno, carregarCtxAlunos   (server-only)
  dados/rh.ts              listarRegistrosRh, carregarCtxFuncionarios (server-only)
  dados/opcoes.ts          listarTemplates, listarEmpresasRelatorio, opcoesAluno, opcoesRh (server-only)
  render/baixar.ts         baixarBlob, nomeArquivo
  render/csv.ts            gerarCsv
  render/modelos-etiqueta.ts MODELOS_ETIQUETA, posicaoEtiqueta, descricaoModelo
  render/etiqueta.ts       renderEtiquetas, linhasEtiqueta, truncarParaLargura
  render/cabecalho.ts      layoutLogos, desenharCabecalho, finalizarPaginas, ALTURA_CABECALHO_MM
  render/grade.ts          renderGrade
  render/tabular.ts        renderTabular
  render/emitir.ts         selecionarEmpresas, emitirArquivo (client)
src/app/(app)/relatorios/dinamico/
  actions.ts        listarRegistrosAction, gerarDadosRelatorioAction, salvarTemplateAction, excluirTemplateAction
  alunos/page.tsx, funcionarios/page.tsx, professores/page.tsx
src/components/relatorio-dinamico/
  stepper.tsx, segmentado.tsx, acordeao.tsx
  lista-dupla.tsx, ordenacao-editor.tsx, registros-lista.tsx
  filtros-aluno.tsx, filtros-rh.tsx
  template-bar.tsx, leiaute-form.tsx
  relatorio-dinamico-page.tsx
src/components/layout/topbar.tsx                              (mod) 3 itens em RELATORIOS_ITEMS
```

---

### Task 1: Banco — templates, vínculo e RBAC

**Files:**
- Create: `supabase/migrations/202609250001_relatorio_dinamico.sql`
- Modify: `src/lib/auth/permissions.ts` (MODULOS após `"relatorios.dre"`; ROTA_PARA_MODULO após `"/relatorios/comercial"`)
- Test: `src/lib/auth/permissions.test.ts` (criar se não existir; se existir, acrescentar o `describe`)

**Interfaces:**
- Produces: tabela `relatorio_templates(id, escola_id, entidade, nome, config, criado_por, created_at, updated_at)`; coluna `employees.perfil_id uuid unique null`; módulos `relatorios.dinamico-aluno|funcionario|professor`.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/auth/permissions.test.ts
import { describe, it, expect } from "vitest";
import { MODULOS, ROTA_PARA_MODULO } from "./permissions";

describe("módulos de relatório dinâmico", () => {
  it("registra os 3 módulos e mapeia as 3 rotas", () => {
    expect(MODULOS["relatorios.dinamico-aluno"].grupo).toBe("operacional");
    expect(MODULOS["relatorios.dinamico-funcionario"].grupo).toBe("operacional");
    expect(MODULOS["relatorios.dinamico-professor"].grupo).toBe("operacional");
    expect(ROTA_PARA_MODULO["/relatorios/dinamico/alunos"]).toBe("relatorios.dinamico-aluno");
    expect(ROTA_PARA_MODULO["/relatorios/dinamico/funcionarios"]).toBe("relatorios.dinamico-funcionario");
    expect(ROTA_PARA_MODULO["/relatorios/dinamico/professores"]).toBe("relatorios.dinamico-professor");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/auth/permissions.test.ts`
Expected: FAIL (typecheck/undefined `grupo` of undefined).

- [ ] **Step 3: Add modules and routes**

In `MODULOS`, after `"relatorios.dre": ...`:
```ts
  "relatorios.dinamico-aluno": { grupo: "operacional", nome: "Relatório Dinâmico — Alunos" },
  "relatorios.dinamico-funcionario": { grupo: "operacional", nome: "Relatório Dinâmico — Funcionários" },
  "relatorios.dinamico-professor": { grupo: "operacional", nome: "Relatório Dinâmico — Professores" },
```
In `ROTA_PARA_MODULO`, after `"/relatorios/comercial": "relatorios.comercial",`:
```ts
  "/relatorios/dinamico/alunos": "relatorios.dinamico-aluno",
  "/relatorios/dinamico/funcionarios": "relatorios.dinamico-funcionario",
  "/relatorios/dinamico/professores": "relatorios.dinamico-professor",
```

- [ ] **Step 4: Write the migration**

```sql
-- supabase/migrations/202609250001_relatorio_dinamico.sql
-- Relatórios/Etiquetas dinâmicos (spec 2026-09-25): RBAC dos 3 relatórios,
-- templates de leiaute por escola e vínculo funcionário (RH) ↔ usuário professor.

-- 1) RBAC
insert into modulos (codigo, grupo, nome, ordem) values
  ('relatorios.dinamico-aluno',       'operacional', 'Relatório Dinâmico — Alunos', 42),
  ('relatorios.dinamico-funcionario', 'operacional', 'Relatório Dinâmico — Funcionários', 43),
  ('relatorios.dinamico-professor',   'operacional', 'Relatório Dinâmico — Professores', 44)
on conflict (codigo) do nothing;

insert into role_permissoes (role_codigo, modulo_codigo, pode_ler, pode_criar, pode_editar, pode_deletar) values
  ('admin',      'relatorios.dinamico-aluno',       true,  true,  true,  true),
  ('admin',      'relatorios.dinamico-funcionario', true,  true,  true,  true),
  ('admin',      'relatorios.dinamico-professor',   true,  true,  true,  true),
  ('secretaria', 'relatorios.dinamico-aluno',       true,  true,  true,  true),
  ('secretaria', 'relatorios.dinamico-funcionario', false, false, false, false),
  ('secretaria', 'relatorios.dinamico-professor',   true,  true,  true,  true),
  ('financeiro', 'relatorios.dinamico-aluno',       false, false, false, false),
  ('financeiro', 'relatorios.dinamico-funcionario', true,  true,  true,  true),
  ('financeiro', 'relatorios.dinamico-professor',   true,  true,  true,  true),
  ('professor',  'relatorios.dinamico-aluno',       false, false, false, false),
  ('professor',  'relatorios.dinamico-funcionario', false, false, false, false),
  ('professor',  'relatorios.dinamico-professor',   false, false, false, false)
on conflict (role_codigo, modulo_codigo) do nothing;

-- 2) Templates de leiaute
create table if not exists public.relatorio_templates (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references escolas(id) on delete cascade,
  entidade text not null check (entidade in ('aluno','funcionario','professor')),
  nome text not null check (length(trim(nome)) between 1 and 120),
  config jsonb not null,
  criado_por uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (escola_id, entidade, nome)
);

create index if not exists relatorio_templates_escola_entidade_idx
  on relatorio_templates (escola_id, entidade);

create trigger relatorio_templates_updated_at before update on relatorio_templates
  for each row execute function set_updated_at();

alter table relatorio_templates enable row level security;

create policy relatorio_templates_service on relatorio_templates
  for all to service_role using (true) with check (true);

create policy relatorio_templates_select on relatorio_templates
  for select to authenticated
  using (escola_id = (select escola_id from current_perfil())
         and has_permission('relatorios.dinamico-' || entidade, 'read'));

create policy relatorio_templates_insert on relatorio_templates
  for insert to authenticated
  with check (escola_id = (select escola_id from current_perfil())
              and has_permission('relatorios.dinamico-' || entidade, 'create'));

create policy relatorio_templates_update on relatorio_templates
  for update to authenticated
  using (escola_id = (select escola_id from current_perfil())
         and has_permission('relatorios.dinamico-' || entidade, 'update'))
  with check (escola_id = (select escola_id from current_perfil())
              and has_permission('relatorios.dinamico-' || entidade, 'update'));

create policy relatorio_templates_delete on relatorio_templates
  for delete to authenticated
  using (escola_id = (select escola_id from current_perfil())
         and has_permission('relatorios.dinamico-' || entidade, 'delete'));

grant select, insert, update, delete on relatorio_templates to authenticated;

-- 3) Vínculo funcionário (RH) ↔ usuário professor (perfis)
alter table public.employees
  add column if not exists perfil_id uuid unique references public.perfis(id) on delete set null;

-- Backfill por e-mail: só matches 1↔1 (e-mail duplicado em qualquer lado é ignorado).
do $$
declare
  v_ligados int;
  v_ambiguos int;
begin
  with pares as (
    select e.id as employee_id, p.id as perfil_id
    from employees e
    join perfis p on p.perfil = 'professor' and lower(trim(p.email)) = lower(trim(e.email))
    where e.perfil_id is null and e.email is not null and trim(e.email) <> ''
  ),
  unicos as (
    select employee_id, min(perfil_id::text)::uuid as perfil_id
    from pares
    where employee_id in (select employee_id from pares group by employee_id having count(*) = 1)
      and perfil_id in (select perfil_id from pares group by perfil_id having count(*) = 1)
      and perfil_id not in (select perfil_id from employees where perfil_id is not null)
    group by employee_id
  )
  update employees e set perfil_id = u.perfil_id
  from unicos u where e.id = u.employee_id;
  get diagnostics v_ligados = row_count;

  select count(*) into v_ambiguos
  from employees e
  where e.perfil_id is null and e.email is not null
    and (select count(*) from perfis p
         where p.perfil = 'professor' and lower(trim(p.email)) = lower(trim(e.email))) > 1;

  raise notice 'relatorio_dinamico: % funcionários vinculados por e-mail; % ambíguos ignorados', v_ligados, v_ambiguos;
end $$;
```

- [ ] **Step 5: Verify**

Run: `npx vitest run src/lib/auth/permissions.test.ts` → PASS.
Run: `npm run typecheck` → sem erros.
Revisão manual do SQL: `current_perfil()` e `has_permission(text,text)` já existem (`202605300001_rbac_permissoes.sql`, usados em `202609240009_declaracao_modelos.sql`); `set_updated_at()` existe (`202605130001_initial_schema.sql`). Não usar `db reset --local`.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/202609250001_relatorio_dinamico.sql src/lib/auth/permissions.ts src/lib/auth/permissions.test.ts
git commit -m "feat(relatorios): banco e RBAC dos relatorios dinamicos"
```

---

### Task 2: Vínculo "Usuário do sistema (professor)" no cadastro de funcionário

**Files:**
- Modify: `src/lib/validation/rh.ts:51-76` (EmployeeSchema)
- Modify: `src/lib/actions/rh.ts:198-275` (readEmployeeForm, insert, update)
- Modify: `src/lib/data/rh.ts:93-107` (Employee), selects de `listEmployees` e `getEmployeeById`; nova `listProfessoresVinculaveis`
- Modify: `src/components/rh/employee-form.tsx`
- Modify: `src/app/(app)/rh/funcionarios/novo/page.tsx`, `src/app/(app)/rh/funcionarios/[id]/editar/page.tsx`
- Test: `src/lib/validation/rh.test.ts` (criar se não existir; senão acrescentar)

**Interfaces:**
- Produces: `Employee.perfil_id: string | null`; `listProfessoresVinculaveis(employeeId?: string): Promise<{ id: string; nome: string; email: string }[]>`; `EmployeeForm` prop `professores: { id: string; nome: string; email: string }[]`.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/validation/rh.test.ts
import { describe, it, expect } from "vitest";
import { EmployeeSchema } from "./rh";

const base = {
  company_id: "11111111-1111-1111-1111-111111111111",
  name: "Maria Souza",
  cpf: "123.456.789-00",
};

describe("EmployeeSchema.perfil_id", () => {
  it("vazio vira undefined", () => {
    const r = EmployeeSchema.safeParse({ ...base, perfil_id: "" });
    expect(r.success && r.data.perfil_id).toBeUndefined();
  });
  it("aceita uuid", () => {
    const r = EmployeeSchema.safeParse({ ...base, perfil_id: "22222222-2222-2222-2222-222222222222" });
    expect(r.success).toBe(true);
  });
  it("recusa texto que não é uuid", () => {
    expect(EmployeeSchema.safeParse({ ...base, perfil_id: "abc" }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/validation/rh.test.ts`
Expected: FAIL (`perfil_id: "abc"` passa porque a chave é ignorada).

- [ ] **Step 3: Implement**

`src/lib/validation/rh.ts` — dentro de `EmployeeSchema`, após `hire_date: optionalString`:
```ts
  hire_date: optionalString,
  perfil_id: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().uuid("Usuário inválido").optional()
  )
```

`src/lib/actions/rh.ts` — em `readEmployeeForm` acrescentar:
```ts
    hire_date: String(formData.get("hire_date") ?? "").trim(),
    perfil_id: String(formData.get("perfil_id") ?? "").trim()
```
No `.insert({...})` e no `.update({...})` acrescentar:
```ts
    perfil_id: parsed.data.perfil_id ?? null,
```
Nos dois tratamentos de erro, trocar a mensagem de 23505 para distinguir o índice:
```ts
    const msg = error.code === "23505"
      ? (error.message.includes("perfil_id") ? "Esse usuário já está vinculado a outro funcionário" : "CPF já cadastrado")
      : error.message;
```

`src/lib/data/rh.ts` — em `Employee` acrescentar `perfil_id: string | null;` e incluir `perfil_id` nas strings de select de `listEmployees` e `getEmployeeById` (logo após `ativo`). Acrescentar no fim do arquivo:
```ts
/** Usuários com perfil professor que ainda não estão ligados a um funcionário
 * (mais o já ligado a `employeeId`, para a edição mostrar o valor atual). */
export async function listProfessoresVinculaveis(
  employeeId?: string
): Promise<{ id: string; nome: string; email: string }[]> {
  const supabase = await createServerClient();
  const [perfisRes, ligadosRes] = await Promise.all([
    supabase.from("perfis").select("id, nome, email").eq("perfil", "professor").eq("ativo", true).order("nome"),
    supabase.from("employees").select("id, perfil_id").not("perfil_id", "is", null),
  ]);
  if (perfisRes.error) throw perfisRes.error;
  if (ligadosRes.error) throw ligadosRes.error;
  const ocupados = new Set(
    (ligadosRes.data ?? []).filter((e) => e.id !== employeeId).map((e) => e.perfil_id as string)
  );
  return (perfisRes.data ?? [])
    .filter((p) => !ocupados.has(p.id as string))
    .map((p) => ({ id: p.id as string, nome: p.nome as string, email: (p.email as string) ?? "" }));
}
```

`src/components/rh/employee-form.tsx` — Props ganha `professores: { id: string; nome: string; email: string }[];`, desestruturar `professores`, e antes de `Data de nascimento`:
```tsx
      <label>
        Usuário do sistema (professor)
        <select name="perfil_id" defaultValue={employee?.perfil_id ?? ""}>
          <option value="">— Sem vínculo —</option>
          {professores.map((p) => (
            <option key={p.id} value={p.id}>{p.nome} ({p.email})</option>
          ))}
        </select>
      </label>
```

`novo/page.tsx`:
```tsx
import { listCompanies, listProfessoresVinculaveis } from "@/lib/data/rh";
...
  const [companies, professores] = await Promise.all([
    listCompanies({ includeInactive: false }),
    listProfessoresVinculaveis(),
  ]);
...
        <EmployeeForm ... professores={professores} />
```
`[id]/editar/page.tsx`: mesma troca usando `listProfessoresVinculaveis(id)` (o `id` já está disponível nos params dessa página) e passar `professores={professores}` ao `EmployeeForm`.

- [ ] **Step 4: Run tests and typecheck**

Run: `npx vitest run src/lib/validation/rh.test.ts src/components/rh` → PASS.
Run: `npm run typecheck` → sem erros (qualquer outro uso de `<EmployeeForm>` sem `professores` aparece aqui — corrigir passando a lista).

- [ ] **Step 5: Commit**

```bash
git add src/lib/validation/rh.ts src/lib/validation/rh.test.ts src/lib/actions/rh.ts src/lib/data/rh.ts src/components/rh/employee-form.tsx "src/app/(app)/rh/funcionarios"
git commit -m "feat(relatorios): vinculo funcionario-usuario professor no cadastro do RH"
```

---

### Task 3: Tipos, formatação e ordenação

**Files:**
- Create: `src/lib/relatorio-dinamico/tipos.ts`, `formatar.ts`, `ordenar.ts`
- Test: `src/lib/relatorio-dinamico/tipos.test.ts`, `formatar.test.ts`, `ordenar.test.ts`

**Interfaces:**
- Produces (tipos.ts):
  - `ENTIDADES`, `type Entidade = "aluno" | "funcionario" | "professor"`, `MODULO_POR_ENTIDADE: Record<Entidade, ModuloCodigo>`
  - `type TipoColuna = "texto" | "data" | "numero"`
  - `type ColunaDef<Ctx> = { key: string; label: string; grupo: string; relacoes: readonly string[]; tipo?: TipoColuna; permissao?: ModuloCodigo; resolve: (ctx: Ctx) => string }`
  - `type ColunaMeta = { key: string; label: string; grupo: string; tipo: TipoColuna }`
  - `type Ordenacao = { key: string; dir: "asc" | "desc" }`
  - `FORMATOS`, `type Formato`, `MODELOS_ETIQUETA_CODIGOS`, `type ModeloEtiqueta`
  - `TemplateConfigSchema`, `type TemplateConfig`
  - `FiltrosAlunoSchema`, `FiltrosRhSchema`, `type FiltrosAluno`, `type FiltrosRh`
  - `type DadosRelatorio = { colunas: ColunaMeta[]; linhas: string[][] }`
  - `type RegistroResumo = { id: string; nome: string; detalhe: string }`
  - `type TemplateResumo = { id: string; nome: string; config: TemplateConfig }`
  - `type EmpresaRelatorio = { id: string; nomeFantasia: string; resolucao: string | null; logoUrl: string | null }`
  - `configPadrao(entidade): TemplateConfig`, `validarEmissao(config, qtdSelecionados): string | null`, `LIMITE_REGISTROS = 2000`
- Produces (formatar.ts): `fmtData(iso: string | null): string`, `fmtMoeda(v: number | null): string`, `idade(iso: string | null, hoje: Date): string`, `juntar(vals: Array<string | null | undefined>): string`, `normalizarTexto(s: string | null): string`, `primeiroNome(nome: string): string`, `txt(v: unknown): string`
- Produces (ordenar.ts): `chaveOrdenacao(valor: string, tipo: TipoColuna): string | number | null`, `ordenarLinhas(dados: DadosRelatorio, ordenacao: Ordenacao[]): DadosRelatorio`, `repetirCopias(linhas: string[][], copias: number): string[][]`

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/relatorio-dinamico/formatar.test.ts
import { describe, it, expect } from "vitest";
import { fmtData, fmtMoeda, idade, juntar, normalizarTexto, primeiroNome, txt } from "./formatar";

describe("formatar", () => {
  it("fmtData converte ISO sem deslocar fuso", () => {
    expect(fmtData("2015-03-10")).toBe("10/03/2015");
    expect(fmtData("2015-03-10T00:00:00Z")).toBe("10/03/2015");
    expect(fmtData(null)).toBe("");
  });
  it("fmtMoeda usa pt-BR", () => {
    expect(fmtMoeda(1234.5)).toBe("R$ 1.234,50");
    expect(fmtMoeda(null)).toBe("");
  });
  it("idade considera se o aniversário já passou", () => {
    const hoje = new Date(2026, 8, 25);
    expect(idade("2015-09-25", hoje)).toBe("11");
    expect(idade("2015-09-26", hoje)).toBe("10");
    expect(idade(null, hoje)).toBe("");
  });
  it("juntar ignora vazios e separa com ' / '", () => {
    expect(juntar(["a", null, " ", "b"])).toBe("a / b");
  });
  it("normalizarTexto remove acento e caixa", () => {
    expect(normalizarTexto(" Mãe ")).toBe("mae");
  });
  it("primeiroNome", () => {
    expect(primeiroNome("ana michele vieira")).toBe("ANA");
  });
  it("txt trata null/number", () => {
    expect(txt(null)).toBe("");
    expect(txt(3)).toBe("3");
    expect(txt("  x ")).toBe("x");
  });
});
```

```ts
// src/lib/relatorio-dinamico/ordenar.test.ts
import { describe, it, expect } from "vitest";
import { chaveOrdenacao, ordenarLinhas, repetirCopias } from "./ordenar";
import type { DadosRelatorio } from "./tipos";

const dados: DadosRelatorio = {
  colunas: [
    { key: "nome", label: "Nome", grupo: "g", tipo: "texto" },
    { key: "nasc", label: "Nascimento", grupo: "g", tipo: "data" },
    { key: "sal", label: "Salário", grupo: "g", tipo: "numero" },
  ],
  linhas: [
    ["Érica", "10/03/2015", "R$ 1.000,00"],
    ["ana", "", "R$ 900,50"],
    ["Bruno", "01/12/2014", ""],
  ],
};

describe("ordenar", () => {
  it("chaveOrdenacao por tipo", () => {
    expect(chaveOrdenacao("10/03/2015", "data")).toBe("20150310");
    expect(chaveOrdenacao("R$ 1.234,56", "numero")).toBe(1234.56);
    expect(chaveOrdenacao("", "texto")).toBeNull();
  });
  it("texto pt-BR ignora acento e caixa", () => {
    const r = ordenarLinhas(dados, [{ key: "nome", dir: "asc" }]);
    expect(r.linhas.map((l) => l[0])).toEqual(["ana", "Bruno", "Érica"]);
  });
  it("data ordena cronologicamente e vazio vai para o fim em asc e desc", () => {
    expect(ordenarLinhas(dados, [{ key: "nasc", dir: "asc" }]).linhas.map((l) => l[0])).toEqual(["Bruno", "Érica", "ana"]);
    expect(ordenarLinhas(dados, [{ key: "nasc", dir: "desc" }]).linhas.map((l) => l[0])).toEqual(["Érica", "Bruno", "ana"]);
  });
  it("número ordena numericamente", () => {
    expect(ordenarLinhas(dados, [{ key: "sal", dir: "desc" }]).linhas.map((l) => l[0])).toEqual(["Érica", "ana", "Bruno"]);
  });
  it("multi-chave e estável", () => {
    const d: DadosRelatorio = {
      colunas: [{ key: "a", label: "A", grupo: "g", tipo: "texto" }, { key: "b", label: "B", grupo: "g", tipo: "texto" }],
      linhas: [["x", "2"], ["y", "1"], ["x", "1"]],
    };
    expect(ordenarLinhas(d, [{ key: "a", dir: "asc" }, { key: "b", dir: "asc" }]).linhas).toEqual([["x", "1"], ["x", "2"], ["y", "1"]]);
    expect(ordenarLinhas(d, []).linhas).toEqual(d.linhas);
  });
  it("repetirCopias repete em sequência", () => {
    expect(repetirCopias([["a"], ["b"]], 2)).toEqual([["a"], ["a"], ["b"], ["b"]]);
  });
});
```

```ts
// src/lib/relatorio-dinamico/tipos.test.ts
import { describe, it, expect } from "vitest";
import { TemplateConfigSchema, configPadrao, validarEmissao } from "./tipos";

describe("TemplateConfigSchema", () => {
  it("config padrão é válida", () => {
    expect(TemplateConfigSchema.safeParse(configPadrao("aluno")).success).toBe(true);
    expect(TemplateConfigSchema.safeParse(configPadrao("funcionario")).success).toBe(true);
  });
  it("grade/tabular exigem título", () => {
    const c = { ...configPadrao("aluno"), formato: "grade" as const, titulo: "  " };
    expect(TemplateConfigSchema.safeParse(c).success).toBe(false);
  });
  it("limites de cópias, fonte e logos", () => {
    const b = configPadrao("aluno");
    expect(TemplateConfigSchema.safeParse({ ...b, copias: 11 }).success).toBe(false);
    expect(TemplateConfigSchema.safeParse({ ...b, fonte: 7.3 }).success).toBe(false);
    expect(TemplateConfigSchema.safeParse({ ...b, logosEmpresas: ["a", "b", "c", "d", "e"].map(() => crypto.randomUUID()) }).success).toBe(false);
  });
  it("ordenação só por coluna selecionada; colunas sem repetição", () => {
    const b = configPadrao("aluno");
    expect(TemplateConfigSchema.safeParse({ ...b, ordenacao: [{ key: "x.y", dir: "asc" }] }).success).toBe(false);
    expect(TemplateConfigSchema.safeParse({ ...b, colunas: ["aluno.nome", "aluno.nome"] }).success).toBe(false);
  });
});

describe("validarEmissao", () => {
  it("bloqueia sem registro, sem coluna e acima do limite", () => {
    const c = configPadrao("aluno");
    expect(validarEmissao(c, 0)).toMatch(/registro/);
    expect(validarEmissao({ ...c, colunas: [], ordenacao: [] }, 1)).toMatch(/coluna/);
    expect(validarEmissao(c, 2001)).toMatch(/2000/);
    expect(validarEmissao(c, 5)).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/lib/relatorio-dinamico`
Expected: FAIL (módulos não existem).

- [ ] **Step 3: Implement `formatar.ts`**

```ts
// src/lib/relatorio-dinamico/formatar.ts
const MOEDA = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function txt(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

/** "2015-03-10" (ou timestamp ISO) → "10/03/2015", sem passar por Date (evita fuso). */
export function fmtData(iso: string | null): string {
  if (!iso) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}

export function fmtMoeda(v: number | null): string {
  return v === null || v === undefined || Number.isNaN(v) ? "" : MOEDA.format(v);
}

export function idade(iso: string | null, hoje: Date): string {
  const m = iso ? /^(\d{4})-(\d{2})-(\d{2})/.exec(iso) : null;
  if (!m) return "";
  const [ano, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])];
  let anos = hoje.getFullYear() - ano;
  const mesHoje = hoje.getMonth() + 1;
  if (mesHoje < mes || (mesHoje === mes && hoje.getDate() < dia)) anos -= 1;
  return anos >= 0 ? String(anos) : "";
}

export function juntar(vals: Array<string | null | undefined>): string {
  return vals.map((v) => txt(v)).filter(Boolean).join(" / ");
}

export function normalizarTexto(s: string | null): string {
  return (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

export function primeiroNome(nome: string): string {
  return txt(nome).split(/\s+/)[0]?.toUpperCase() ?? "";
}
```

- [ ] **Step 4: Implement `tipos.ts`**

```ts
// src/lib/relatorio-dinamico/tipos.ts
import { z } from "zod";
import type { ModuloCodigo } from "@/lib/auth/permissions";

export const ENTIDADES = ["aluno", "funcionario", "professor"] as const;
export type Entidade = (typeof ENTIDADES)[number];

export const MODULO_POR_ENTIDADE: Record<Entidade, ModuloCodigo> = {
  aluno: "relatorios.dinamico-aluno",
  funcionario: "relatorios.dinamico-funcionario",
  professor: "relatorios.dinamico-professor",
};

export const LIMITE_REGISTROS = 2000;

export type TipoColuna = "texto" | "data" | "numero";

export type ColunaDef<Ctx> = {
  key: string;
  label: string;
  grupo: string;
  /** Relações que o server precisa buscar para resolver esta coluna. */
  relacoes: readonly string[];
  tipo?: TipoColuna;
  /** Coluna só existe para quem tem `read` neste módulo (admin sempre). */
  permissao?: ModuloCodigo;
  resolve: (ctx: Ctx) => string;
};

export type ColunaMeta = { key: string; label: string; grupo: string; tipo: TipoColuna };
export type Ordenacao = { key: string; dir: "asc" | "desc" };
export type DadosRelatorio = { colunas: ColunaMeta[]; linhas: string[][] };
export type RegistroResumo = { id: string; nome: string; detalhe: string };

export const FORMATOS = ["etiqueta", "grade", "tabular", "csv"] as const;
export type Formato = (typeof FORMATOS)[number];
export const FORMATO_LABEL: Record<Formato, string> = {
  etiqueta: "Etiquetas",
  grade: "Relatório em grade PDF",
  tabular: "Relatório tabular PDF",
  csv: "Arquivo CSV",
};

export const MODELOS_ETIQUETA_CODIGOS = ["6180", "6181", "A4256", "A4362"] as const;
export type ModeloEtiqueta = (typeof MODELOS_ETIQUETA_CODIGOS)[number];

export const TemplateConfigSchema = z
  .object({
    formato: z.enum(FORMATOS),
    colunas: z.array(z.string().min(1).max(80)).max(200),
    ordenacao: z.array(z.object({ key: z.string(), dir: z.enum(["asc", "desc"]) })).max(10),
    copias: z.number().int().min(1).max(10),
    descricaoImpressao: z.string().max(200).optional(),
    modeloEtiqueta: z.enum(MODELOS_ETIQUETA_CODIGOS).optional(),
    fonte: z.number().min(6).max(12).refine((v) => Number.isInteger(v * 2), "Fonte em passos de 0,5").optional(),
    rotulos: z.boolean().optional(),
    titulo: z.string().max(120).optional(),
    subtitulo: z.string().max(120).optional(),
    exibirLogos: z.boolean().optional(),
    logosEmpresas: z.array(z.string().uuid()).max(4).optional(),
  })
  .superRefine((c, ctx) => {
    if (new Set(c.colunas).size !== c.colunas.length) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Coluna repetida", path: ["colunas"] });
    }
    if (c.ordenacao.some((o) => !c.colunas.includes(o.key))) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Ordenação só por coluna selecionada", path: ["ordenacao"] });
    }
    if ((c.formato === "grade" || c.formato === "tabular") && !c.titulo?.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Informe o título do relatório", path: ["titulo"] });
    }
    if (c.formato === "etiqueta" && !c.modeloEtiqueta) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Escolha o formato da etiqueta", path: ["modeloEtiqueta"] });
    }
  });
export type TemplateConfig = z.infer<typeof TemplateConfigSchema>;

export type TemplateResumo = { id: string; nome: string; config: TemplateConfig };
export type EmpresaRelatorio = { id: string; nomeFantasia: string; resolucao: string | null; logoUrl: string | null };

export const STATUS_MATRICULA = ["ativa", "cancelada", "transferida", "concluida"] as const;

export const FiltrosAlunoSchema = z.object({
  ano: z.number().int().min(2000).max(2100),
  filtrarPor: z.enum(["serie", "turma", "segmento"]),
  valores: z.array(z.string().min(1)).max(200),
  status: z.array(z.enum(STATUS_MATRICULA)).min(1),
});
export type FiltrosAluno = z.infer<typeof FiltrosAlunoSchema>;

export const FiltrosRhSchema = z.object({
  companyId: z.string().uuid().nullable(),
  situacao: z.enum(["ativo", "inativo", "todos"]),
  categoria: z.enum(["admin", "fund1", "fund2", "medio"]).nullable(),
  cargo: z.string().max(80).nullable(),
  turmaIds: z.array(z.string().uuid()).max(200),
  disciplinaIds: z.array(z.string().uuid()).max(200),
});
export type FiltrosRh = z.infer<typeof FiltrosRhSchema>;

const COLUNAS_PADRAO: Record<Entidade, string[]> = {
  aluno: ["aluno.nome", "mat.serie", "mat.turma"],
  funcionario: ["func.nome", "func.cargo"],
  professor: ["func.nome", "prof.disciplinas"],
};

export function configPadrao(entidade: Entidade): TemplateConfig {
  return {
    formato: "etiqueta",
    colunas: COLUNAS_PADRAO[entidade],
    ordenacao: [],
    copias: 1,
    descricaoImpressao: "",
    modeloEtiqueta: "6180",
    fonte: 7.5,
    rotulos: true,
    titulo: "",
    subtitulo: "",
    exibirLogos: true,
    logosEmpresas: [],
  };
}

/** Mensagem que bloqueia o botão Emitir, ou null quando pode emitir. */
export function validarEmissao(config: TemplateConfig, qtdSelecionados: number): string | null {
  if (qtdSelecionados === 0) return "Selecione ao menos um registro na aba Filtros.";
  if (qtdSelecionados > LIMITE_REGISTROS) return `Máximo de ${LIMITE_REGISTROS} registros por emissão.`;
  if (config.colunas.length === 0) return "Selecione ao menos uma coluna no Leiaute.";
  const r = TemplateConfigSchema.safeParse(config);
  return r.success ? null : r.error.issues[0]?.message ?? "Leiaute inválido.";
}
```

- [ ] **Step 5: Implement `ordenar.ts`**

```ts
// src/lib/relatorio-dinamico/ordenar.ts
import type { DadosRelatorio, Ordenacao, TipoColuna } from "./tipos";

const COLLATOR = new Intl.Collator("pt-BR", { sensitivity: "base", numeric: true });

/** null = valor vazio (sempre vai para o fim, em asc e desc). */
export function chaveOrdenacao(valor: string, tipo: TipoColuna): string | number | null {
  const v = valor.trim();
  if (!v) return null;
  if (tipo === "data") {
    const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v);
    return m ? `${m[3]}${m[2]}${m[1]}` : v;
  }
  if (tipo === "numero") {
    const n = Number(v.replace(/[^\d,-]/g, "").replace(",", "."));
    return Number.isNaN(n) ? null : n;
  }
  return v;
}

function comparar(a: string | number | null, b: string | number | null): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return COLLATOR.compare(String(a), String(b));
}

export function ordenarLinhas(dados: DadosRelatorio, ordenacao: Ordenacao[]): DadosRelatorio {
  const regras = ordenacao
    .map((o) => ({ ...o, idx: dados.colunas.findIndex((c) => c.key === o.key) }))
    .filter((o) => o.idx >= 0);
  if (regras.length === 0) return dados;

  const linhas = [...dados.linhas].sort((la, lb) => {
    for (const r of regras) {
      const tipo = dados.colunas[r.idx].tipo;
      const ka = chaveOrdenacao(la[r.idx] ?? "", tipo);
      const kb = chaveOrdenacao(lb[r.idx] ?? "", tipo);
      if (ka === null || kb === null) {
        const c = comparar(ka, kb); // vazio no fim independente da direção
        if (c !== 0) return c;
        continue;
      }
      const c = comparar(ka, kb);
      if (c !== 0) return r.dir === "asc" ? c : -c;
    }
    return 0;
  });
  return { ...dados, linhas };
}

export function repetirCopias(linhas: string[][], copias: number): string[][] {
  return linhas.flatMap((l) => Array.from({ length: copias }, () => l));
}
```

- [ ] **Step 6: Run tests**

Run: `npx vitest run src/lib/relatorio-dinamico`
Expected: PASS. Se `fmtMoeda` falhar por espaço (` ` vs ` `), ajustar o teste para `expect(fmtMoeda(1234.5)).toMatch(/^R\$\s1\.234,50$/)`.

- [ ] **Step 7: Commit**

```bash
git add src/lib/relatorio-dinamico
git commit -m "feat(relatorios): tipos, formatacao e ordenacao do motor dinamico"
```

---

### Task 4: CSV e download

**Files:**
- Create: `src/lib/relatorio-dinamico/render/csv.ts`, `render/baixar.ts`
- Test: `src/lib/relatorio-dinamico/render/csv.test.ts`

**Interfaces:**
- Consumes: `DadosRelatorio` (Task 3)
- Produces: `gerarCsv(dados: DadosRelatorio): string` (com BOM); `baixarBlob(blob: Blob, nome: string): void`; `nomeArquivo(base: string, ext: "pdf" | "csv", agora?: Date): string`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/relatorio-dinamico/render/csv.test.ts
import { describe, it, expect } from "vitest";
import { gerarCsv } from "./csv";
import { nomeArquivo } from "./baixar";

describe("gerarCsv", () => {
  it("BOM, ; e CRLF com cabeçalho de labels", () => {
    const csv = gerarCsv({
      colunas: [{ key: "a", label: "Nome", grupo: "g", tipo: "texto" }, { key: "b", label: "Obs", grupo: "g", tipo: "texto" }],
      linhas: [["Ana", "tem ; ponto"], ["Bia \"B\"", "linha1\nlinha2"]],
    });
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv.slice(1)).toBe('Nome;Obs\r\nAna;"tem ; ponto"\r\n"Bia ""B""";"linha1\nlinha2"\r\n');
  });
});

describe("nomeArquivo", () => {
  it("slug + data", () => {
    expect(nomeArquivo("Festa do 3º Ano", "pdf", new Date(2026, 8, 25, 10, 7))).toBe("festa-do-3-ano-20260925-1007.pdf");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/relatorio-dinamico/render/csv.test.ts` → FAIL.

- [ ] **Step 3: Implement**

```ts
// src/lib/relatorio-dinamico/render/csv.ts
import type { DadosRelatorio } from "../tipos";

function escapar(v: string): string {
  return /[;"\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

/** CSV para Excel PT-BR: `;`, BOM UTF-8, CRLF, escape RFC 4180. */
export function gerarCsv(dados: DadosRelatorio): string {
  const linhas = [dados.colunas.map((c) => c.label), ...dados.linhas];
  return "﻿" + linhas.map((l) => l.map(escapar).join(";")).join("\r\n") + "\r\n";
}
```

```ts
// src/lib/relatorio-dinamico/render/baixar.ts
import { normalizarTexto } from "../formatar";

export function nomeArquivo(base: string, ext: "pdf" | "csv", agora: Date = new Date()): string {
  const slug = normalizarTexto(base).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "relatorio";
  const p = (n: number) => String(n).padStart(2, "0");
  const carimbo = `${agora.getFullYear()}${p(agora.getMonth() + 1)}${p(agora.getDate())}-${p(agora.getHours())}${p(agora.getMinutes())}`;
  return `${slug}-${carimbo}.${ext}`;
}

export function baixarBlob(blob: Blob, nome: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 100);
}
```

- [ ] **Step 4: Run test** → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/relatorio-dinamico/render
git commit -m "feat(relatorios): exportacao CSV"
```

---

### Task 5: Etiquetas

**Files:**
- Create: `src/lib/relatorio-dinamico/render/modelos-etiqueta.ts`, `render/etiqueta.ts`
- Test: `src/lib/relatorio-dinamico/render/etiqueta.test.ts`

**Interfaces:**
- Consumes: `DadosRelatorio`, `ModeloEtiqueta` (Task 3)
- Produces:
  - `type ModeloEtiquetaDef = { codigo: ModeloEtiqueta; nome: string; papel: "letter" | "a4"; paginaW: number; paginaH: number; colunas: number; linhas: number; largura: number; altura: number; margemEsq: number; margemTopo: number; passoH: number; passoV: number }` (mm)
  - `MODELOS_ETIQUETA: Record<ModeloEtiqueta, ModeloEtiquetaDef>`
  - `posicaoEtiqueta(m: ModeloEtiquetaDef, indice: number): { pagina: number; x: number; y: number }` (pagina 0-based)
  - `descricaoModelo(m: ModeloEtiquetaDef): string`
  - `linhasEtiqueta(dados: DadosRelatorio, linha: string[], rotulos: boolean): string[]`
  - `truncarParaLargura(medir: (s: string) => number, texto: string, largura: number): string`
  - `renderEtiquetas(dados: DadosRelatorio, opts: { modelo: ModeloEtiqueta; fonte: number; rotulos: boolean; descricao?: string }): jsPDF`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/relatorio-dinamico/render/etiqueta.test.ts
import { describe, it, expect } from "vitest";
import { MODELOS_ETIQUETA, posicaoEtiqueta, descricaoModelo } from "./modelos-etiqueta";
import { linhasEtiqueta, renderEtiquetas, truncarParaLargura } from "./etiqueta";
import type { DadosRelatorio } from "../tipos";

describe("modelos de etiqueta", () => {
  it.each(Object.values(MODELOS_ETIQUETA))("$codigo cabe na página", (m) => {
    const ultima = posicaoEtiqueta(m, m.colunas * m.linhas - 1);
    expect(ultima.pagina).toBe(0);
    expect(ultima.x + m.largura).toBeLessThanOrEqual(m.paginaW + 0.01);
    expect(ultima.y + m.altura).toBeLessThanOrEqual(m.paginaH + 0.01);
  });
  it("6180: índice → linha/coluna e quebra de página", () => {
    const m = MODELOS_ETIQUETA["6180"];
    expect(posicaoEtiqueta(m, 0)).toEqual({ pagina: 0, x: m.margemEsq, y: m.margemTopo });
    expect(posicaoEtiqueta(m, 4)).toEqual({ pagina: 0, x: m.margemEsq + m.passoH, y: m.margemTopo + m.passoV });
    expect(posicaoEtiqueta(m, 30)).toEqual({ pagina: 1, x: m.margemEsq, y: m.margemTopo });
  });
  it("descrição igual ao Escolar Manager", () => {
    expect(descricaoModelo(MODELOS_ETIQUETA["6180"])).toBe(
      "Folha Tamanho Carta 215,9 x 279,4 mm. 3 colunas e 10 linhas totalizando 30 etiquetas por folha."
    );
  });
});

const dados: DadosRelatorio = {
  colunas: [
    { key: "a", label: "Nome Aluno", grupo: "g", tipo: "texto" },
    { key: "b", label: "Série", grupo: "g", tipo: "texto" },
  ],
  linhas: Array.from({ length: 31 }, (_, i) => [`ALUNO ${i} COM UM NOME MUITO GRANDE QUE NAO CABE NA ETIQUETA`, "3º ANO"]),
};

describe("etiqueta", () => {
  it("rótulos Sim/Não", () => {
    expect(linhasEtiqueta(dados, ["ANA", "3º ANO"], true)).toEqual(["Nome Aluno: ANA", "Série: 3º ANO"]);
    expect(linhasEtiqueta(dados, ["ANA", "3º ANO"], false)).toEqual(["ANA", "3º ANO"]);
  });
  it("trunca pela largura medida, sem quebrar", () => {
    const medir = (s: string) => s.length; // 1 unidade por caractere
    expect(truncarParaLargura(medir, "ABCDEFGHIJ", 4)).toBe("ABCD");
    expect(truncarParaLargura(medir, "ABC", 4)).toBe("ABC");
  });
  it("31 registros em 6180 geram 2 páginas; texto nunca passa da etiqueta", () => {
    const doc = renderEtiquetas(dados, { modelo: "6180", fonte: 7.5, rotulos: true });
    expect(doc.getNumberOfPages()).toBe(2);
    doc.setFont("courier", "normal");
    doc.setFontSize(7.5);
    const texto = truncarParaLargura((s) => doc.getTextWidth(s), linhasEtiqueta(dados, dados.linhas[0], true)[0], 66.7 - 3);
    expect(doc.getTextWidth(texto)).toBeLessThanOrEqual(66.7 - 3);
  });
});
```

- [ ] **Step 2: Run to verify it fails** → FAIL.

- [ ] **Step 3: Implement `modelos-etiqueta.ts`**

```ts
// src/lib/relatorio-dinamico/render/modelos-etiqueta.ts
import type { ModeloEtiqueta } from "../tipos";

export type ModeloEtiquetaDef = {
  codigo: ModeloEtiqueta;
  nome: string;
  papel: "letter" | "a4";
  paginaW: number;
  paginaH: number;
  colunas: number;
  linhas: number;
  largura: number;
  altura: number;
  margemEsq: number;
  margemTopo: number;
  passoH: number;
  passoV: number;
};

// ponytail: geometria de catálogo Pimaco; conferir com folha real impressa
// (Task 14) e ajustar margemEsq/margemTopo se houver deslocamento.
export const MODELOS_ETIQUETA: Record<ModeloEtiqueta, ModeloEtiquetaDef> = {
  "6180": { codigo: "6180", nome: "Carta - 6180", papel: "letter", paginaW: 215.9, paginaH: 279.4, colunas: 3, linhas: 10, largura: 66.7, altura: 25.4, margemEsq: 4.8, margemTopo: 12.7, passoH: 69.85, passoV: 25.4 },
  "6181": { codigo: "6181", nome: "Carta - 6181", papel: "letter", paginaW: 215.9, paginaH: 279.4, colunas: 2, linhas: 10, largura: 101.6, altura: 25.4, margemEsq: 4.2, margemTopo: 12.7, passoH: 105.9, passoV: 25.4 },
  A4256: { codigo: "A4256", nome: "A4 - A4256 / 6280", papel: "a4", paginaW: 210, paginaH: 297, colunas: 3, linhas: 11, largura: 63.5, altura: 25.4, margemEsq: 7.2, margemTopo: 8.8, passoH: 66.0, passoV: 25.4 },
  A4362: { codigo: "A4362", nome: "A4 - A4362", papel: "a4", paginaW: 210, paginaH: 297, colunas: 2, linhas: 8, largura: 99.0, altura: 33.9, margemEsq: 4.75, margemTopo: 12.9, passoH: 101.5, passoV: 33.9 },
};

export function posicaoEtiqueta(m: ModeloEtiquetaDef, indice: number): { pagina: number; x: number; y: number } {
  const porPagina = m.colunas * m.linhas;
  const pagina = Math.floor(indice / porPagina);
  const resto = indice % porPagina;
  const linha = Math.floor(resto / m.colunas);
  const coluna = resto % m.colunas;
  return { pagina, x: m.margemEsq + coluna * m.passoH, y: m.margemTopo + linha * m.passoV };
}

const num = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 1 });

export function descricaoModelo(m: ModeloEtiquetaDef): string {
  const papel = m.papel === "letter" ? "Carta" : "A4";
  return `Folha Tamanho ${papel} ${num(m.paginaW)} x ${num(m.paginaH)} mm. ${m.colunas} colunas e ${m.linhas} linhas totalizando ${m.colunas * m.linhas} etiquetas por folha.`;
}
```

- [ ] **Step 4: Implement `etiqueta.ts`**

```ts
// src/lib/relatorio-dinamico/render/etiqueta.ts
import jsPDF from "jspdf";
import type { DadosRelatorio, ModeloEtiqueta } from "../tipos";
import { MODELOS_ETIQUETA, posicaoEtiqueta } from "./modelos-etiqueta";

const PADDING_MM = 1.5;
const PT_EM_MM = 0.3528;
const ENTRELINHA = 1.15;

export function linhasEtiqueta(dados: DadosRelatorio, linha: string[], rotulos: boolean): string[] {
  return dados.colunas.map((c, i) => (rotulos ? `${c.label}: ${linha[i] ?? ""}` : linha[i] ?? ""));
}

/** Corta o texto (sem quebra de linha) até caber em `largura`, como no Escolar Manager. */
export function truncarParaLargura(medir: (s: string) => number, texto: string, largura: number): string {
  if (medir(texto) <= largura) return texto;
  let fim = texto.length;
  while (fim > 0 && medir(texto.slice(0, fim)) > largura) fim -= 1;
  return texto.slice(0, fim);
}

export function renderEtiquetas(
  dados: DadosRelatorio,
  opts: { modelo: ModeloEtiqueta; fonte: number; rotulos: boolean; descricao?: string }
): jsPDF {
  const m = MODELOS_ETIQUETA[opts.modelo];
  const doc = new jsPDF({ unit: "mm", format: m.papel, orientation: "portrait" });
  doc.setFont("courier", "normal");
  doc.setFontSize(opts.fonte);
  const alturaLinha = opts.fonte * PT_EM_MM * ENTRELINHA;
  const larguraUtil = m.largura - PADDING_MM * 2;
  const maxLinhas = Math.max(1, Math.floor((m.altura - PADDING_MM * 2) / alturaLinha));
  const medir = (s: string) => doc.getTextWidth(s);
  const descricao = opts.descricao?.trim();

  let paginaAtual = 0;
  const rodape = () => {
    if (!descricao) return;
    doc.setFontSize(7);
    doc.text(truncarParaLargura(medir, descricao, m.paginaW - 10), m.paginaW / 2, m.paginaH - 3, { align: "center" });
    doc.setFontSize(opts.fonte);
  };

  dados.linhas.forEach((linha, i) => {
    const pos = posicaoEtiqueta(m, i);
    if (pos.pagina > paginaAtual) {
      rodape();
      doc.addPage(m.papel, "portrait");
      paginaAtual = pos.pagina;
    }
    linhasEtiqueta(dados, linha, opts.rotulos)
      .slice(0, maxLinhas)
      .forEach((texto, l) => {
        const y = pos.y + PADDING_MM + alturaLinha * (l + 1) - alturaLinha * 0.25;
        doc.text(truncarParaLargura(medir, texto, larguraUtil), pos.x + PADDING_MM, y);
      });
  });
  rodape();
  return doc;
}
```

- [ ] **Step 5: Run test** → PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/relatorio-dinamico/render
git commit -m "feat(relatorios): renderizador de etiquetas (6180, 6181, A4256, A4362)"
```

---

### Task 6: Cabeçalho, Grade PDF e Tabular PDF

**Files:**
- Create: `src/lib/relatorio-dinamico/render/cabecalho.ts`, `render/grade.ts`, `render/tabular.ts`
- Test: `src/lib/relatorio-dinamico/render/pdf-relatorio.test.ts`

**Interfaces:**
- Consumes: `DadosRelatorio` (Task 3)
- Produces:
  - `type ImagemPdf = { data: string; w: number; h: number }`
  - `type CabecalhoDados = { titulo: string; subtitulo?: string; empresaNome: string | null; resolucao: string | null; logos: ImagemPdf[]; emitidoEm: Date; descricao?: string }`
  - `ALTURA_CABECALHO_MM = 30`, `MARGEM_MM = 10`, `RODAPE_MM = 12`
  - `layoutLogos(logos: { w: number; h: number }[], alturaMax: number, larguraMax: number, gap: number): { x: number; w: number; h: number }[]` (x relativo à margem esquerda)
  - `finalizarPaginas(doc: jsPDF, c: CabecalhoDados): void` — desenha cabeçalho e rodapé "n/N" + descrição em todas as páginas
  - `renderGrade(dados: DadosRelatorio, c: CabecalhoDados): jsPDF`
  - `renderTabular(dados: DadosRelatorio, c: CabecalhoDados): jsPDF`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/relatorio-dinamico/render/pdf-relatorio.test.ts
import { describe, it, expect } from "vitest";
import { layoutLogos, type CabecalhoDados } from "./cabecalho";
import { renderGrade } from "./grade";
import { renderTabular } from "./tabular";
import type { DadosRelatorio } from "../tipos";

const cab: CabecalhoDados = {
  titulo: "Festa do 3",
  subtitulo: "feste",
  empresaNome: "EPG TRINDADE",
  resolucao: "RESOLUÇÃO CEE/CEB Nº 518/2024",
  logos: [],
  emitidoEm: new Date(2026, 8, 25, 10, 7),
  descricao: "teste 222",
};

function dados(n: number): DadosRelatorio {
  return {
    colunas: ["Nome do Pai", "Nome da Mãe", "Nome Aluno", "Celulares"].map((l, i) => ({ key: `k${i}`, label: l, grupo: "g", tipo: "texto" as const })),
    linhas: Array.from({ length: n }, (_, i) => [`PAI ${i}`, `MÃE ${i}`, `ALUNO ${i}`, "(62)98481-8104 - FRANÇOISA - (Celular-MÃE) / (62)98416-7273 - MARGARETE".repeat(2)]),
  };
}

describe("layoutLogos", () => {
  it("0 logos → vazio", () => {
    expect(layoutLogos([], 18, 90, 3)).toEqual([]);
  });
  it("altura fixa, largura proporcional, gap entre logos", () => {
    const r = layoutLogos([{ w: 200, h: 100 }, { w: 100, h: 100 }], 18, 90, 3);
    expect(r).toEqual([{ x: 0, w: 36, h: 18 }, { x: 39, w: 18, h: 18 }]);
  });
  it("encolhe tudo quando passa da largura máxima", () => {
    const r = layoutLogos([{ w: 400, h: 100 }, { w: 400, h: 100 }, { w: 400, h: 100 }, { w: 400, h: 100 }], 18, 90, 3);
    const fim = r[r.length - 1].x + r[r.length - 1].w;
    expect(fim).toBeLessThanOrEqual(90.001);
  });
});

describe("grade e tabular", () => {
  it("grade: 12 registros quebram página sem erro e sem logos", () => {
    const doc = renderGrade(dados(12), cab);
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(2);
  });
  it("tabular: paisagem e várias páginas com 60 linhas", () => {
    const doc = renderTabular(dados(60), cab);
    expect(doc.internal.pageSize.getWidth()).toBeGreaterThan(doc.internal.pageSize.getHeight());
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(2);
  });
  it("sem empresa nenhuma ainda gera", () => {
    expect(() => renderTabular(dados(1), { ...cab, empresaNome: null, resolucao: null })).not.toThrow();
  });
});
```

- [ ] **Step 2: Run to verify it fails** → FAIL.

- [ ] **Step 3: Implement `cabecalho.ts`**

```ts
// src/lib/relatorio-dinamico/render/cabecalho.ts
import type jsPDF from "jspdf";

export type ImagemPdf = { data: string; w: number; h: number };
export type CabecalhoDados = {
  titulo: string;
  subtitulo?: string;
  empresaNome: string | null;
  resolucao: string | null;
  logos: ImagemPdf[];
  emitidoEm: Date;
  descricao?: string;
};

export const MARGEM_MM = 10;
export const ALTURA_CABECALHO_MM = 30;
export const RODAPE_MM = 12;
const ALTURA_LOGO_MM = 18;
const GAP_LOGO_MM = 3;

/** Logos lado a lado, altura fixa e largura proporcional; se não couberem em
 * `larguraMax`, todas encolhem pelo mesmo fator. */
export function layoutLogos(
  logos: { w: number; h: number }[],
  alturaMax: number,
  larguraMax: number,
  gap: number
): { x: number; w: number; h: number }[] {
  if (logos.length === 0) return [];
  const larguras = logos.map((l) => (l.w / l.h) * alturaMax);
  const total = larguras.reduce((s, w) => s + w, 0) + gap * (logos.length - 1);
  const fator = total > larguraMax ? (larguraMax - gap * (logos.length - 1)) / (total - gap * (logos.length - 1)) : 1;
  let x = 0;
  return larguras.map((w) => {
    const item = { x, w: w * fator, h: alturaMax * fator };
    x += item.w + gap;
    return item;
  });
}

function fmtDataHora(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function desenharCabecalho(doc: jsPDF, c: CabecalhoDados): void {
  const largura = doc.internal.pageSize.getWidth();
  const direita = largura - MARGEM_MM;
  const posicoes = layoutLogos(c.logos, ALTURA_LOGO_MM, largura * 0.4, GAP_LOGO_MM);
  posicoes.forEach((p, i) => {
    const img = c.logos[i];
    const formato = img.data.startsWith("data:image/jpeg") ? "JPEG" : "PNG";
    doc.addImage(img.data, formato, MARGEM_MM + p.x, MARGEM_MM, p.w, p.h, undefined, "FAST");
  });

  doc.setTextColor(0, 0, 0);
  let y = MARGEM_MM + 3;
  if (c.empresaNome) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(c.empresaNome.toUpperCase(), direita, y, { align: "right" });
    y += 4;
  }
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  if (c.resolucao) {
    doc.text(c.resolucao, direita, y, { align: "right" });
    y += 3.5;
  }
  doc.text(fmtDataHora(c.emitidoEm), direita, y, { align: "right" });

  const centro = largura / 2;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(c.titulo, centro, MARGEM_MM + 22, { align: "center" });
  if (c.subtitulo) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(c.subtitulo, centro, MARGEM_MM + 26.5, { align: "center" });
  }
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.3);
  doc.line(MARGEM_MM, MARGEM_MM + ALTURA_CABECALHO_MM - 2, direita, MARGEM_MM + ALTURA_CABECALHO_MM - 2);
}

function desenharRodape(doc: jsPDF, pagina: number, total: number, descricao?: string): void {
  const largura = doc.internal.pageSize.getWidth();
  const altura = doc.internal.pageSize.getHeight();
  const y = altura - MARGEM_MM + 2;
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.2);
  doc.line(MARGEM_MM, y - 4, largura - MARGEM_MM, y - 4);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(0, 0, 0);
  if (descricao) doc.text(descricao, MARGEM_MM, y);
  doc.text(`${pagina}/${total}`, largura / 2, y, { align: "center" });
}

/** Pós-processamento: cabeçalho + rodapé em todas as páginas (total só é conhecido no fim). */
export function finalizarPaginas(doc: jsPDF, c: CabecalhoDados): void {
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    desenharCabecalho(doc, c);
    desenharRodape(doc, i, total, c.descricao?.trim() || undefined);
  }
}

export const TOPO_CONTEUDO_MM = MARGEM_MM + ALTURA_CABECALHO_MM;
```

- [ ] **Step 4: Implement `grade.ts` and `tabular.ts`**

```ts
// src/lib/relatorio-dinamico/render/grade.ts
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { DadosRelatorio } from "../tipos";
import { finalizarPaginas, MARGEM_MM, RODAPE_MM, TOPO_CONTEUDO_MM, type CabecalhoDados } from "./cabecalho";

const FONTE = 8;
const PADDING = 1;
const ALTURA_LINHA = FONTE * 0.3528 * 1.15;
const LARGURA_ROTULO = 45;
const ESPACO_BLOCOS = 3;

type ComFinalY = { lastAutoTable: { finalY: number } };

/** Um bloco rótulo|valor por registro; o bloco não é partido entre páginas. */
export function renderGrade(dados: DadosRelatorio, c: CabecalhoDados): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const largura = doc.internal.pageSize.getWidth();
  const limite = doc.internal.pageSize.getHeight() - RODAPE_MM - MARGEM_MM;
  const larguraValor = largura - MARGEM_MM * 2 - LARGURA_ROTULO;
  doc.setFont("times", "normal");
  doc.setFontSize(FONTE);

  let y = TOPO_CONTEUDO_MM;
  for (const linha of dados.linhas) {
    const alturaBloco = linha.reduce((s, v) => {
      const n = Math.max(1, (doc.splitTextToSize(v || " ", larguraValor - PADDING * 2) as string[]).length);
      return s + n * ALTURA_LINHA + PADDING * 2;
    }, 0);
    if (y + alturaBloco > limite && y > TOPO_CONTEUDO_MM) {
      doc.addPage("a4", "portrait");
      y = TOPO_CONTEUDO_MM;
    }
    autoTable(doc, {
      startY: y,
      margin: { top: TOPO_CONTEUDO_MM, bottom: RODAPE_MM + MARGEM_MM, left: MARGEM_MM, right: MARGEM_MM },
      theme: "grid",
      styles: { font: "times", fontSize: FONTE, cellPadding: PADDING, textColor: [0, 0, 0], lineColor: [0, 0, 0], lineWidth: 0.2 },
      columnStyles: { 0: { cellWidth: LARGURA_ROTULO, fontStyle: "bold" } },
      body: dados.colunas.map((col, i) => [col.label, linha[i] ?? ""]),
    });
    y = (doc as unknown as ComFinalY).lastAutoTable.finalY + ESPACO_BLOCOS;
  }

  if (y + 6 > limite) {
    doc.addPage("a4", "portrait");
    y = TOPO_CONTEUDO_MM;
  }
  doc.setFont("times", "normal");
  doc.setFontSize(9);
  doc.text(`Quantidade: ${dados.linhas.length}`, MARGEM_MM, y + 4);
  finalizarPaginas(doc, c);
  return doc;
}
```

```ts
// src/lib/relatorio-dinamico/render/tabular.ts
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { DadosRelatorio } from "../tipos";
import { finalizarPaginas, MARGEM_MM, RODAPE_MM, TOPO_CONTEUDO_MM, type CabecalhoDados } from "./cabecalho";

type ComFinalY = { lastAutoTable: { finalY: number } };

/** Uma linha por registro, uma coluna por campo; cabeçalho de colunas repetido por página. */
export function renderTabular(dados: DadosRelatorio, c: CabecalhoDados): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" });
  autoTable(doc, {
    startY: TOPO_CONTEUDO_MM,
    margin: { top: TOPO_CONTEUDO_MM, bottom: RODAPE_MM + MARGEM_MM, left: MARGEM_MM, right: MARGEM_MM },
    theme: "grid",
    showHead: "everyPage",
    styles: { font: "times", fontSize: 7.5, cellPadding: 1, overflow: "linebreak", textColor: [0, 0, 0], lineColor: [0, 0, 0], lineWidth: 0.2, valign: "middle" },
    headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontStyle: "bold", halign: "center" },
    head: [dados.colunas.map((col) => col.label)],
    body: dados.linhas,
  });
  const limite = doc.internal.pageSize.getHeight() - RODAPE_MM - MARGEM_MM;
  let y = (doc as unknown as ComFinalY).lastAutoTable.finalY + 5;
  if (y > limite) {
    doc.addPage("a4", "landscape");
    y = TOPO_CONTEUDO_MM + 4;
  }
  doc.setFont("times", "normal");
  doc.setFontSize(9);
  doc.text(`Quantidade: ${dados.linhas.length}`, MARGEM_MM, y);
  finalizarPaginas(doc, c);
  return doc;
}
```

- [ ] **Step 5: Run test** → PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/relatorio-dinamico/render
git commit -m "feat(relatorios): cabecalho com logos, relatorio em grade e tabular"
```

---

### Task 7: Catálogo de Aluno

**Files:**
- Create: `src/lib/relatorio-dinamico/catalogo/aluno.ts`
- Test: `src/lib/relatorio-dinamico/catalogo/aluno.test.ts`

**Interfaces:**
- Consumes: `ColunaDef` (Task 3), `formatar.ts` (Task 3)
- Produces:
  - `type ResponsavelRow = { nome: string; cpf: string | null; telefone: string | null; celular: string | null; parentesco: string | null; email: string | null; responsavel_financeiro: boolean; responsavel_pedagogico: boolean }`
  - `type ContatoRow = { nome: string; telefone: string | null; celular: string | null; parentesco: string | null; principal: boolean }`
  - `type EnderecoRow = { logradouro: string; numero: string | null; complemento: string | null; bairro: string | null; cidade: string | null; uf: string | null; cep: string | null; principal: boolean }`
  - `type MedicoRow = { alergia_descricao: string | null; necessidade_especial_descricao: string | null; doenca_grave_descricao: string | null; remedio_especial_descricao: string | null; tipo_sanguineo: string | null; plano_saude: string | null }`
  - `type AlunoCtx = { aluno: AlunoBase; matricula: MatriculaBase; responsaveis: ResponsavelRow[]; contatos: ContatoRow[]; enderecos: EnderecoRow[]; medico: MedicoRow | null; numeroChamada: number | null; hoje: Date }`
  - `type AlunoBase` / `type MatriculaBase` (campos abaixo)
  - `RELACOES_ALUNO = ["responsaveis","contatos","enderecos","medico","chamada"] as const`
  - `COLUNAS_ALUNO: ColunaDef<AlunoCtx>[]`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/relatorio-dinamico/catalogo/aluno.test.ts
import { describe, it, expect } from "vitest";
import { COLUNAS_ALUNO, type AlunoCtx } from "./aluno";

function ctx(over: Partial<AlunoCtx> = {}): AlunoCtx {
  return {
    aluno: {
      matricula_codigo: "123", nome: "ANA LAURA", sexo: "F", data_nascimento: "2018-02-10", naturalidade: "Goiânia",
      nacionalidade: "Brasileira", celular: null, cpf: null, rg: null, orgao_expedidor: null, data_expedicao: null,
      certidao_livro: "A1", certidao_folha: "10", certidao_numero: "999", certidao_cartorio: "1º", email: null, codigo_inep: null, etnia: null,
    },
    matricula: { codigo: "M1", ano_letivo: 2026, status: "ativa", data_matricula: "2026-01-15", serie: "3º ANO", segmento: "FUNDAMENTAL1", turma: "A", turno: "matutino" },
    responsaveis: [
      { nome: "MARTIUS AQUINO", cpf: null, telefone: null, celular: "(62)98522-0812", parentesco: "Pai", email: null, responsavel_financeiro: false, responsavel_pedagogico: true },
      { nome: "FRANÇOISA SILVA", cpf: "111", telefone: null, celular: "(62)98481-8104", parentesco: "Mãe", email: "f@x.com", responsavel_financeiro: true, responsavel_pedagogico: false },
    ],
    contatos: [{ nome: "MARGARETE", telefone: null, celular: "(62)98416-7273", parentesco: "Avó", principal: false }],
    enderecos: [
      { logradouro: "Rua 1", numero: "10", complemento: null, bairro: "Centro", cidade: "Goiânia", uf: "GO", cep: "74000-000", principal: false },
      { logradouro: "Rua 2", numero: "20", complemento: "Qd 3", bairro: "Setor Sul", cidade: "TRINDADE", uf: "GO", cep: "75380-000", principal: true },
    ],
    medico: null,
    numeroChamada: 4,
    hoje: new Date(2026, 8, 25),
    ...over,
  };
}

const col = (key: string) => {
  const c = COLUNAS_ALUNO.find((x) => x.key === key);
  if (!c) throw new Error(`coluna ${key} não existe`);
  return c;
};

describe("catálogo de aluno", () => {
  it("keys únicas e labels preenchidos", () => {
    const keys = COLUNAS_ALUNO.map((c) => c.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(COLUNAS_ALUNO.every((c) => c.label.trim() && c.grupo.trim())).toBe(true);
    expect(COLUNAS_ALUNO.length).toBeGreaterThanOrEqual(55);
  });
  it("pai e mãe por parentesco (com e sem acento)", () => {
    expect(col("pai.nome").resolve(ctx())).toBe("MARTIUS AQUINO");
    expect(col("mae.nome").resolve(ctx())).toBe("FRANÇOISA SILVA");
    const semAcento = ctx({ responsaveis: [{ ...ctx().responsaveis[1], parentesco: "mae" }] });
    expect(col("mae.celular").resolve(semAcento)).toBe("(62)98481-8104");
    expect(col("pai.nome").resolve(semAcento)).toBe("");
  });
  it("responsável financeiro/pedagógico pelas flags", () => {
    expect(col("rf.nome").resolve(ctx())).toBe("FRANÇOISA SILVA");
    expect(col("rp.nome").resolve(ctx())).toBe("MARTIUS AQUINO");
  });
  it("Celulares concatena responsáveis e contatos sem duplicar número", () => {
    const c = ctx({ contatos: [...ctx().contatos, { nome: "X", telefone: null, celular: "(62) 98481-8104", parentesco: null, principal: false }] });
    expect(col("cont.celulares").resolve(c)).toBe(
      "(62)98522-0812 - MARTIUS - (Pai) / (62)98481-8104 - FRANÇOISA - (Mãe) / (62)98416-7273 - MARGARETE - (Avó)"
    );
  });
  it("endereço principal e Cidade Endereço", () => {
    expect(col("end.cidadeUf").resolve(ctx())).toBe("TRINDADE - GO");
    expect(col("end.completo").resolve(ctx())).toBe("Rua 2, 20, Qd 3 - Setor Sul - TRINDADE - GO - CEP 75380-000");
    expect(col("end.cidadeUf").resolve(ctx({ enderecos: [] }))).toBe("");
  });
  it("idade, datas, segmento, turno e chamada", () => {
    expect(col("aluno.idade").resolve(ctx())).toBe("8");
    expect(col("aluno.nascimento").resolve(ctx())).toBe("10/02/2018");
    expect(col("mat.segmento").resolve(ctx())).toBe("Fundamental I");
    expect(col("mat.turno").resolve(ctx())).toBe("Matutino");
    expect(col("mat.chamada").resolve(ctx())).toBe("4");
  });
});
```

- [ ] **Step 2: Run to verify it fails** → FAIL.

- [ ] **Step 3: Implement**

```ts
// src/lib/relatorio-dinamico/catalogo/aluno.ts
import type { ColunaDef, TipoColuna } from "../tipos";
import { fmtData, idade, juntar, normalizarTexto, primeiroNome, txt } from "../formatar";

export type AlunoBase = {
  matricula_codigo: string; nome: string; sexo: string | null; data_nascimento: string | null;
  naturalidade: string | null; nacionalidade: string | null; celular: string | null; cpf: string | null;
  rg: string | null; orgao_expedidor: string | null; data_expedicao: string | null;
  certidao_livro: string | null; certidao_folha: string | null; certidao_numero: string | null; certidao_cartorio: string | null;
  email: string | null; codigo_inep: string | null; etnia: string | null;
};
export type MatriculaBase = {
  codigo: string | null; ano_letivo: number; status: string; data_matricula: string | null;
  serie: string | null; segmento: string | null; turma: string | null; turno: string | null;
};
export type ResponsavelRow = {
  nome: string; cpf: string | null; telefone: string | null; celular: string | null; parentesco: string | null;
  email: string | null; responsavel_financeiro: boolean; responsavel_pedagogico: boolean;
};
export type ContatoRow = { nome: string; telefone: string | null; celular: string | null; parentesco: string | null; principal: boolean };
export type EnderecoRow = {
  logradouro: string; numero: string | null; complemento: string | null; bairro: string | null;
  cidade: string | null; uf: string | null; cep: string | null; principal: boolean;
};
export type MedicoRow = {
  alergia_descricao: string | null; necessidade_especial_descricao: string | null; doenca_grave_descricao: string | null;
  remedio_especial_descricao: string | null; tipo_sanguineo: string | null; plano_saude: string | null;
};
export type AlunoCtx = {
  aluno: AlunoBase;
  matricula: MatriculaBase;
  responsaveis: ResponsavelRow[];
  contatos: ContatoRow[];
  enderecos: EnderecoRow[];
  medico: MedicoRow | null;
  numeroChamada: number | null;
  hoje: Date;
};

export const RELACOES_ALUNO = ["responsaveis", "contatos", "enderecos", "medico", "chamada"] as const;

const SEGMENTO: Record<string, string> = { INFANTIL: "Educação Infantil", FUNDAMENTAL1: "Fundamental I", FUNDAMENTAL2: "Fundamental II", MEDIO: "Ensino Médio" };
const TURNO: Record<string, string> = { matutino: "Matutino", vespertino: "Vespertino", noturno: "Noturno", integral: "Integral" };
const STATUS: Record<string, string> = { ativa: "Ativa", cancelada: "Cancelada", transferida: "Transferida", concluida: "Concluída" };

const porParentesco = (c: AlunoCtx, alvo: "pai" | "mae") =>
  c.responsaveis.find((r) => normalizarTexto(r.parentesco) === alvo) ?? null;
const financeiro = (c: AlunoCtx) => c.responsaveis.find((r) => r.responsavel_financeiro) ?? null;
const pedagogico = (c: AlunoCtx) => c.responsaveis.find((r) => r.responsavel_pedagogico) ?? null;
const endereco = (c: AlunoCtx) => c.enderecos.find((e) => e.principal) ?? c.enderecos[0] ?? null;
const cidadeUf = (e: EnderecoRow | null) => (e ? juntar([e.cidade, e.uf]).replace(" / ", " - ") : "");
const digitos = (s: string) => s.replace(/\D/g, "");

function celulares(c: AlunoCtx): string {
  const vistos = new Set<string>();
  const itens: string[] = [];
  for (const p of [...c.responsaveis, ...c.contatos]) {
    const cel = txt(p.celular);
    if (!cel || vistos.has(digitos(cel))) continue;
    vistos.add(digitos(cel));
    itens.push([cel, primeiroNome(p.nome), p.parentesco ? `(${txt(p.parentesco)})` : ""].filter(Boolean).join(" - "));
  }
  return itens.join(" / ");
}

function telefones(c: AlunoCtx): string {
  return juntar([...c.responsaveis, ...c.contatos].map((p) => p.telefone));
}

function col(
  key: string, label: string, grupo: string, relacoes: readonly string[],
  resolve: (c: AlunoCtx) => string, tipo: TipoColuna = "texto"
): ColunaDef<AlunoCtx> {
  return { key, label, grupo, relacoes, resolve, tipo };
}

type Pessoa = ResponsavelRow | null;
function colsPessoa(prefixo: string, sufixo: string, grupo: string, pegar: (c: AlunoCtx) => Pessoa): ColunaDef<AlunoCtx>[] {
  const r = ["responsaveis"] as const;
  return [
    col(`${prefixo}.nome`, `Nome ${sufixo}`, grupo, r, (c) => txt(pegar(c)?.nome)),
    col(`${prefixo}.cpf`, `CPF ${sufixo}`, grupo, r, (c) => txt(pegar(c)?.cpf)),
    col(`${prefixo}.celular`, `Celular ${sufixo}`, grupo, r, (c) => txt(pegar(c)?.celular)),
    col(`${prefixo}.telefone`, `Telefone ${sufixo}`, grupo, r, (c) => txt(pegar(c)?.telefone)),
    col(`${prefixo}.email`, `E-mail ${sufixo}`, grupo, r, (c) => txt(pegar(c)?.email)),
  ];
}

const P = "Dados pessoais", C = "Certidão", M = "Matrícula", E = "Endereço", CT = "Contatos", MD = "Saúde";
const END = ["enderecos"] as const, MED = ["medico"] as const;

export const COLUNAS_ALUNO: ColunaDef<AlunoCtx>[] = [
  col("aluno.nome", "Nome Aluno", P, [], (c) => txt(c.aluno.nome)),
  col("aluno.matricula", "Matrícula", P, [], (c) => txt(c.aluno.matricula_codigo)),
  col("aluno.sexo", "Sexo", P, [], (c) => txt(c.aluno.sexo)),
  col("aluno.nascimento", "Data de Nascimento", P, [], (c) => fmtData(c.aluno.data_nascimento), "data"),
  col("aluno.idade", "Idade", P, [], (c) => idade(c.aluno.data_nascimento, c.hoje), "numero"),
  col("aluno.cpf", "CPF do Aluno", P, [], (c) => txt(c.aluno.cpf)),
  col("aluno.rg", "RG do Aluno", P, [], (c) => txt(c.aluno.rg)),
  col("aluno.orgao", "Órgão Expedidor", P, [], (c) => txt(c.aluno.orgao_expedidor)),
  col("aluno.expedicao", "Data de Expedição", P, [], (c) => fmtData(c.aluno.data_expedicao), "data"),
  col("aluno.naturalidade", "Naturalidade", P, [], (c) => txt(c.aluno.naturalidade)),
  col("aluno.nacionalidade", "Nacionalidade", P, [], (c) => txt(c.aluno.nacionalidade)),
  col("aluno.etnia", "Cor/Raça", P, [], (c) => txt(c.aluno.etnia)),
  col("aluno.inep", "Código INEP", P, [], (c) => txt(c.aluno.codigo_inep)),
  col("aluno.email", "E-mail do Aluno", P, [], (c) => txt(c.aluno.email)),
  col("aluno.celular", "Celular do Aluno", P, [], (c) => txt(c.aluno.celular)),
  col("cert.livro", "Certidão - Livro", C, [], (c) => txt(c.aluno.certidao_livro)),
  col("cert.folha", "Certidão - Folha", C, [], (c) => txt(c.aluno.certidao_folha)),
  col("cert.numero", "Certidão - Número", C, [], (c) => txt(c.aluno.certidao_numero)),
  col("cert.cartorio", "Certidão - Cartório", C, [], (c) => txt(c.aluno.certidao_cartorio)),
  col("mat.codigo", "Código da Matrícula", M, [], (c) => txt(c.matricula.codigo)),
  col("mat.ano", "Ano da Matrícula", M, [], (c) => String(c.matricula.ano_letivo), "numero"),
  col("mat.serie", "Série", M, [], (c) => txt(c.matricula.serie)),
  col("mat.turma", "Turma", M, [], (c) => txt(c.matricula.turma)),
  col("mat.turno", "Turno", M, [], (c) => TURNO[c.matricula.turno ?? ""] ?? txt(c.matricula.turno)),
  col("mat.segmento", "Segmento", M, [], (c) => SEGMENTO[c.matricula.segmento ?? ""] ?? txt(c.matricula.segmento)),
  col("mat.status", "Situação da Matrícula", M, [], (c) => STATUS[c.matricula.status] ?? txt(c.matricula.status)),
  col("mat.data", "Data da Matrícula", M, [], (c) => fmtData(c.matricula.data_matricula), "data"),
  col("mat.chamada", "Nº de Chamada", M, ["chamada"], (c) => (c.numeroChamada ? String(c.numeroChamada) : ""), "numero"),
  col("end.logradouro", "Logradouro", E, END, (c) => txt(endereco(c)?.logradouro)),
  col("end.numero", "Número", E, END, (c) => txt(endereco(c)?.numero)),
  col("end.complemento", "Complemento", E, END, (c) => txt(endereco(c)?.complemento)),
  col("end.bairro", "Bairro", E, END, (c) => txt(endereco(c)?.bairro)),
  col("end.cidade", "Cidade", E, END, (c) => txt(endereco(c)?.cidade)),
  col("end.uf", "UF", E, END, (c) => txt(endereco(c)?.uf)),
  col("end.cidadeUf", "Cidade Endereço", E, END, (c) => cidadeUf(endereco(c))),
  col("end.cep", "CEP", E, END, (c) => txt(endereco(c)?.cep)),
  col("end.completo", "Endereço Completo", E, END, (c) => {
    const e = endereco(c);
    if (!e) return "";
    const rua = [e.logradouro, e.numero, e.complemento].map(txt).filter(Boolean).join(", ");
    return [rua, txt(e.bairro), cidadeUf(e), e.cep ? `CEP ${txt(e.cep)}` : ""].filter(Boolean).join(" - ");
  }),
  ...colsPessoa("pai", "do Pai", "Pai", (c) => porParentesco(c, "pai")),
  ...colsPessoa("mae", "da Mãe", "Mãe", (c) => porParentesco(c, "mae")),
  ...colsPessoa("rf", "do Responsável Financeiro", "Responsável Financeiro", financeiro),
  ...colsPessoa("rp", "do Responsável Pedagógico", "Responsável Pedagógico", pedagogico),
  col("cont.celulares", "Celulares", CT, ["responsaveis", "contatos"], celulares),
  col("cont.telefones", "Telefones", CT, ["responsaveis", "contatos"], telefones),
  col("med.alergia", "Alergias", MD, MED, (c) => txt(c.medico?.alergia_descricao)),
  col("med.necessidade", "Necessidade Especial", MD, MED, (c) => txt(c.medico?.necessidade_especial_descricao)),
  col("med.doenca", "Doença Grave", MD, MED, (c) => txt(c.medico?.doenca_grave_descricao)),
  col("med.remedio", "Medicação Especial", MD, MED, (c) => txt(c.medico?.remedio_especial_descricao)),
  col("med.sangue", "Tipo Sanguíneo", MD, MED, (c) => txt(c.medico?.tipo_sanguineo)),
  col("med.plano", "Plano de Saúde", MD, MED, (c) => txt(c.medico?.plano_saude)),
];
```

(Contagem: 15 + 4 + 9 + 9 + 20 + 2 + 6 = 65.)

- [ ] **Step 4: Run test** → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/relatorio-dinamico/catalogo
git commit -m "feat(relatorios): catalogo de colunas do aluno"
```

---

### Task 8: Catálogos de Funcionário e Professor + índice + montagem

**Files:**
- Create: `src/lib/relatorio-dinamico/catalogo/funcionario.ts`, `catalogo/professor.ts`, `catalogo/index.ts`, `src/lib/relatorio-dinamico/montar.ts`
- Test: `src/lib/relatorio-dinamico/catalogo/funcionario.test.ts`, `src/lib/relatorio-dinamico/montar.test.ts`

**Interfaces:**
- Consumes: Tasks 3, 7
- Produces:
  - `type FuncionarioCtx = { func: FuncBase; empresa: { name: string; nome_fantasia: string | null; cnpj: string } | null; contrato: { salario_base: number | null; valor_hora_aula: number | null; aulas_semanais: number | null; data_desligamento: string | null } | null; atribuicoes: { disciplina: string; turma: string; serie: string }[]; usuarioEmail: string | null; hoje: Date }`
  - `type FuncBase = { name: string; cpf: string; birth_date: string | null; hire_date: string | null; email: string | null; telefone: string | null; cargo: string | null; school_category: string | null; status_contrato: string | null; ativo: boolean }`
  - `RELACOES_FUNCIONARIO = ["contrato"]`, `RELACOES_PROFESSOR = ["contrato","atribuicoes","usuario"]`
  - `COLUNAS_FUNCIONARIO: ColunaDef<FuncionarioCtx>[]`, `COLUNAS_PROFESSOR: ColunaDef<FuncionarioCtx>[]`
  - `getCatalogo(entidade: "aluno"): ColunaDef<AlunoCtx>[]` / `(entidade: "funcionario" | "professor"): ColunaDef<FuncionarioCtx>[]` (overloads)
  - `filtrarColunasPorPermissao<C>(cols: ColunaDef<C>[], perms: PermissionMap, isAdmin: boolean): ColunaDef<C>[]`
  - `catalogoMeta<C>(cols: ColunaDef<C>[]): ColunaMeta[]`
  - `relacoesNecessarias<C>(cols: ColunaDef<C>[], keys: string[]): Set<string>`
  - `montarDados<C>(catalogo: ColunaDef<C>[], ctxs: C[], keys: string[]): DadosRelatorio` (lança `Error("Coluna desconhecida: <key>")`)

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/relatorio-dinamico/catalogo/funcionario.test.ts
import { describe, it, expect } from "vitest";
import { COLUNAS_FUNCIONARIO, type FuncionarioCtx } from "./funcionario";
import { COLUNAS_PROFESSOR } from "./professor";
import { filtrarColunasPorPermissao, getCatalogo, catalogoMeta } from "./index";

const ctx: FuncionarioCtx = {
  func: { name: "JOÃO", cpf: "123.456.789-00", birth_date: "1990-01-01", hire_date: "2020-02-03", email: "j@x.com", telefone: null, cargo: "Professor", school_category: "fund1", status_contrato: "CLT", ativo: true },
  empresa: { name: "EPG LTDA", nome_fantasia: "EPG TRINDADE", cnpj: "11.714.876/0001-16" },
  contrato: { salario_base: 3500, valor_hora_aula: 30.5, aulas_semanais: 20, data_desligamento: null },
  atribuicoes: [
    { disciplina: "Matemática", turma: "A", serie: "3º ANO" },
    { disciplina: "Ciências", turma: "B", serie: "3º ANO" },
    { disciplina: "Matemática", turma: "B", serie: "4º ANO" },
  ],
  usuarioEmail: "joao@escola.com",
  hoje: new Date(2026, 8, 25),
};
const r = (cols: typeof COLUNAS_FUNCIONARIO, key: string) => cols.find((c) => c.key === key)!.resolve(ctx);

describe("catálogo funcionário/professor", () => {
  it("resolve campos básicos e formatados", () => {
    expect(r(COLUNAS_FUNCIONARIO, "func.categoria")).toBe("Fundamental I");
    expect(r(COLUNAS_FUNCIONARIO, "func.situacao")).toBe("Ativo");
    expect(r(COLUNAS_FUNCIONARIO, "emp.nome")).toBe("EPG TRINDADE");
    expect(r(COLUNAS_FUNCIONARIO, "ctr.salario")).toMatch(/3\.500,00/);
  });
  it("professor: listas únicas e ordenadas", () => {
    expect(r(COLUNAS_PROFESSOR, "prof.disciplinas")).toBe("Ciências / Matemática");
    expect(r(COLUNAS_PROFESSOR, "prof.series")).toBe("3º ANO / 4º ANO");
    expect(r(COLUNAS_PROFESSOR, "prof.turmas")).toBe("3º ANO A / 3º ANO B / 4º ANO B");
  });
  it("colunas salariais somem sem rh.folha-v2", () => {
    const semPerm = filtrarColunasPorPermissao(getCatalogo("funcionario"), {}, false).map((c) => c.key);
    expect(semPerm).not.toContain("ctr.salario");
    expect(semPerm).not.toContain("ctr.horaAula");
    const admin = filtrarColunasPorPermissao(getCatalogo("funcionario"), {}, true).map((c) => c.key);
    expect(admin).toContain("ctr.salario");
  });
  it("meta não carrega funções", () => {
    const meta = catalogoMeta(getCatalogo("professor"));
    expect(Object.keys(meta[0]).sort()).toEqual(["grupo", "key", "label", "tipo"]);
  });
});
```

```ts
// src/lib/relatorio-dinamico/montar.test.ts
import { describe, it, expect } from "vitest";
import { montarDados } from "./montar";
import { relacoesNecessarias } from "./catalogo";
import type { ColunaDef } from "./tipos";

type Ctx = { n: string; d: string };
const cat: ColunaDef<Ctx>[] = [
  { key: "n", label: "Nome", grupo: "g", relacoes: [], resolve: (c) => c.n },
  { key: "d", label: "Data", grupo: "g", relacoes: ["x"], tipo: "data", resolve: (c) => c.d },
];

describe("montarDados", () => {
  it("respeita a ordem das keys pedidas", () => {
    expect(montarDados(cat, [{ n: "A", d: "01/01/2020" }], ["d", "n"])).toEqual({
      colunas: [{ key: "d", label: "Data", grupo: "g", tipo: "data" }, { key: "n", label: "Nome", grupo: "g", tipo: "texto" }],
      linhas: [["01/01/2020", "A"]],
    });
  });
  it("coluna desconhecida lança", () => {
    expect(() => montarDados(cat, [], ["zzz"])).toThrow("Coluna desconhecida: zzz");
  });
  it("relacoesNecessarias une as relações das keys", () => {
    expect([...relacoesNecessarias(cat, ["n", "d"])]).toEqual(["x"]);
  });
});
```

- [ ] **Step 2: Run to verify they fail** → FAIL.

- [ ] **Step 3: Implement `funcionario.ts`**

```ts
// src/lib/relatorio-dinamico/catalogo/funcionario.ts
import type { ColunaDef, TipoColuna } from "../tipos";
import type { ModuloCodigo } from "@/lib/auth/permissions";
import { fmtData, fmtMoeda, idade, txt } from "../formatar";

export type FuncBase = {
  name: string; cpf: string; birth_date: string | null; hire_date: string | null; email: string | null;
  telefone: string | null; cargo: string | null; school_category: string | null; status_contrato: string | null; ativo: boolean;
};
export type FuncionarioCtx = {
  func: FuncBase;
  empresa: { name: string; nome_fantasia: string | null; cnpj: string } | null;
  contrato: { salario_base: number | null; valor_hora_aula: number | null; aulas_semanais: number | null; data_desligamento: string | null } | null;
  atribuicoes: { disciplina: string; turma: string; serie: string }[];
  usuarioEmail: string | null;
  hoje: Date;
};

export const RELACOES_FUNCIONARIO = ["contrato"] as const;

const CATEGORIA: Record<string, string> = { admin: "Administrativo", fund1: "Fundamental I", fund2: "Fundamental II", medio: "Ensino Médio" };
const SALARIAL: ModuloCodigo = "rh.folha-v2";

export function colF(
  key: string, label: string, grupo: string, relacoes: readonly string[],
  resolve: (c: FuncionarioCtx) => string, tipo: TipoColuna = "texto", permissao?: ModuloCodigo
): ColunaDef<FuncionarioCtx> {
  return { key, label, grupo, relacoes, resolve, tipo, permissao };
}

const D = "Dados pessoais", V = "Vínculo", EM = "Empresa", CT = "Contrato";
const CTR = ["contrato"] as const;

export const COLUNAS_FUNCIONARIO: ColunaDef<FuncionarioCtx>[] = [
  colF("func.nome", "Nome", D, [], (c) => txt(c.func.name)),
  colF("func.cpf", "CPF", D, [], (c) => txt(c.func.cpf)),
  colF("func.nascimento", "Data de Nascimento", D, [], (c) => fmtData(c.func.birth_date), "data"),
  colF("func.idade", "Idade", D, [], (c) => idade(c.func.birth_date, c.hoje), "numero"),
  colF("func.email", "E-mail", D, [], (c) => txt(c.func.email)),
  colF("func.telefone", "Telefone", D, [], (c) => txt(c.func.telefone)),
  colF("func.cargo", "Cargo", V, [], (c) => txt(c.func.cargo)),
  colF("func.categoria", "Categoria", V, [], (c) => CATEGORIA[c.func.school_category ?? ""] ?? ""),
  colF("func.vinculo", "Tipo de Contrato", V, [], (c) => txt(c.func.status_contrato)),
  colF("func.situacao", "Situação", V, [], (c) => (c.func.ativo ? "Ativo" : "Inativo")),
  colF("func.admissao", "Data de Admissão", V, [], (c) => fmtData(c.func.hire_date), "data"),
  colF("emp.nome", "Empresa", EM, [], (c) => txt(c.empresa?.nome_fantasia || c.empresa?.name)),
  colF("emp.razao", "Razão Social", EM, [], (c) => txt(c.empresa?.name)),
  colF("emp.cnpj", "CNPJ da Empresa", EM, [], (c) => txt(c.empresa?.cnpj)),
  colF("ctr.salario", "Salário Base", CT, CTR, (c) => fmtMoeda(c.contrato?.salario_base ?? null), "numero", SALARIAL),
  colF("ctr.horaAula", "Valor Hora-Aula", CT, CTR, (c) => fmtMoeda(c.contrato?.valor_hora_aula ?? null), "numero", SALARIAL),
  colF("ctr.aulas", "Aulas Semanais", CT, CTR, (c) => txt(c.contrato?.aulas_semanais), "numero"),
  colF("ctr.desligamento", "Data de Desligamento", CT, CTR, (c) => fmtData(c.contrato?.data_desligamento ?? null), "data"),
];
```

- [ ] **Step 4: Implement `professor.ts`, `index.ts`, `montar.ts`**

```ts
// src/lib/relatorio-dinamico/catalogo/professor.ts
import type { ColunaDef } from "../tipos";
import { txt } from "../formatar";
import { COLUNAS_FUNCIONARIO, colF, type FuncionarioCtx } from "./funcionario";

export const RELACOES_PROFESSOR = ["contrato", "atribuicoes", "usuario"] as const;

const COLLATOR = new Intl.Collator("pt-BR", { sensitivity: "base", numeric: true });
const unicosOrdenados = (vals: string[]) => [...new Set(vals.filter(Boolean))].sort(COLLATOR.compare).join(" / ");
const AT = ["atribuicoes"] as const;
const G = "Docência";

export const COLUNAS_PROFESSOR: ColunaDef<FuncionarioCtx>[] = [
  ...COLUNAS_FUNCIONARIO,
  colF("prof.disciplinas", "Disciplinas", G, AT, (c) => unicosOrdenados(c.atribuicoes.map((a) => a.disciplina))),
  colF("prof.turmas", "Turmas", G, AT, (c) => unicosOrdenados(c.atribuicoes.map((a) => `${a.serie} ${a.turma}`.trim()))),
  colF("prof.series", "Séries", G, AT, (c) => unicosOrdenados(c.atribuicoes.map((a) => a.serie))),
  colF("prof.usuario", "E-mail de Acesso ao Sistema", G, ["usuario"], (c) => txt(c.usuarioEmail)),
];
```

```ts
// src/lib/relatorio-dinamico/catalogo/index.ts
import type { PermissionMap } from "@/lib/auth/permissions";
import { can } from "@/lib/auth/permissions";
import type { ColunaDef, ColunaMeta, Entidade } from "../tipos";
import { COLUNAS_ALUNO, type AlunoCtx } from "./aluno";
import { COLUNAS_FUNCIONARIO, type FuncionarioCtx } from "./funcionario";
import { COLUNAS_PROFESSOR } from "./professor";

export function getCatalogo(entidade: "aluno"): ColunaDef<AlunoCtx>[];
export function getCatalogo(entidade: "funcionario" | "professor"): ColunaDef<FuncionarioCtx>[];
export function getCatalogo(entidade: Entidade): ColunaDef<AlunoCtx>[] | ColunaDef<FuncionarioCtx>[];
export function getCatalogo(entidade: Entidade): ColunaDef<AlunoCtx>[] | ColunaDef<FuncionarioCtx>[] {
  if (entidade === "aluno") return COLUNAS_ALUNO;
  return entidade === "professor" ? COLUNAS_PROFESSOR : COLUNAS_FUNCIONARIO;
}

export function filtrarColunasPorPermissao<C>(cols: ColunaDef<C>[], perms: PermissionMap, isAdmin: boolean): ColunaDef<C>[] {
  return cols.filter((c) => !c.permissao || isAdmin || can(perms, c.permissao, "read"));
}

export function catalogoMeta<C>(cols: ColunaDef<C>[]): ColunaMeta[] {
  return cols.map((c) => ({ key: c.key, label: c.label, grupo: c.grupo, tipo: c.tipo ?? "texto" }));
}

export function relacoesNecessarias<C>(cols: ColunaDef<C>[], keys: string[]): Set<string> {
  const pedidas = new Set(keys);
  return new Set(cols.filter((c) => pedidas.has(c.key)).flatMap((c) => [...c.relacoes]));
}
```

```ts
// src/lib/relatorio-dinamico/montar.ts
import type { ColunaDef, DadosRelatorio } from "./tipos";

export function montarDados<C>(catalogo: ColunaDef<C>[], ctxs: C[], keys: string[]): DadosRelatorio {
  const porKey = new Map(catalogo.map((c) => [c.key, c]));
  const cols = keys.map((k) => {
    const c = porKey.get(k);
    if (!c) throw new Error(`Coluna desconhecida: ${k}`);
    return c;
  });
  return {
    colunas: cols.map((c) => ({ key: c.key, label: c.label, grupo: c.grupo, tipo: c.tipo ?? "texto" })),
    linhas: ctxs.map((ctx) => cols.map((c) => c.resolve(ctx))),
  };
}
```

- [ ] **Step 5: Run tests** → `npx vitest run src/lib/relatorio-dinamico` PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/relatorio-dinamico
git commit -m "feat(relatorios): catalogos de funcionario e professor, montagem de dados"
```

---

### Task 9: Camada de dados (server) e server actions

**Files:**
- Create: `src/lib/relatorio-dinamico/dados/lotes.ts`, `dados/aluno.ts`, `dados/rh.ts`, `dados/opcoes.ts`
- Create: `src/app/(app)/relatorios/dinamico/actions.ts`
- Test: `src/lib/relatorio-dinamico/dados/lotes.test.ts`, `src/app/(app)/relatorios/dinamico/actions.test.ts`

**Interfaces:**
- Consumes: Tasks 3, 7, 8
- Produces:
  - `emLotes<T>(itens: T[], tamanho?: number): T[][]` (default 150)
  - `listarRegistrosAluno(f: FiltrosAluno): Promise<RegistroResumo[]>`
  - `carregarCtxAlunos(ids: string[], ano: number, relacoes: Set<string>): Promise<AlunoCtx[]>` (ordem por nome)
  - `listarRegistrosRh(f: FiltrosRh, professor: boolean): Promise<RegistroResumo[]>`
  - `carregarCtxFuncionarios(ids: string[], relacoes: Set<string>): Promise<FuncionarioCtx[]>` (ordem por nome)
  - `listarTemplates(entidade: Entidade): Promise<TemplateResumo[]>`
  - `listarEmpresasRelatorio(): Promise<EmpresaRelatorio[]>`
  - `opcoesAluno(): Promise<OpcoesAluno>`; `type OpcoesAluno = { anos: number[]; series: { id: string; nome: string; segmento: string | null }[]; turmas: { id: string; nome: string; serie_id: string; ano_letivo: number }[] }`
  - `opcoesRh(): Promise<OpcoesRh>`; `type OpcoesRh = { empresas: { id: string; nome: string }[]; cargos: string[]; turmas: { id: string; nome: string; ano_letivo: number }[]; disciplinas: { id: string; nome: string; serie: string }[] }`
  - Actions (retorno `{ ok: true; ... } | { ok: false; error: string }`):
    - `listarRegistrosAction(input: { entidade: Entidade; filtros: unknown }): Promise<{ ok: true; registros: RegistroResumo[] } | Falha>`
    - `gerarDadosRelatorioAction(input: { entidade: Entidade; ids: string[]; colunas: string[]; ordenacao: Ordenacao[]; filtros: unknown }): Promise<{ ok: true; dados: DadosRelatorio } | Falha>`
    - `salvarTemplateAction(input: { id?: string; entidade: Entidade; nome: string; config: unknown }): Promise<{ ok: true; template: TemplateResumo } | Falha>`
    - `excluirTemplateAction(input: { id: string; entidade: Entidade }): Promise<{ ok: true } | Falha>`

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/relatorio-dinamico/dados/lotes.test.ts
import { describe, it, expect } from "vitest";
import { emLotes } from "./lotes";

describe("emLotes", () => {
  it("divide em lotes de 150 por padrão", () => {
    const r = emLotes(Array.from({ length: 301 }, (_, i) => i));
    expect(r.map((l) => l.length)).toEqual([150, 150, 1]);
  });
  it("lista vazia → nenhum lote", () => {
    expect(emLotes([])).toEqual([]);
  });
});
```

```ts
// src/app/(app)/relatorios/dinamico/actions.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const { requirePermissionMock, carregarAlunosMock, carregarFuncMock } = vi.hoisted(() => ({
  requirePermissionMock: vi.fn(),
  carregarAlunosMock: vi.fn(),
  carregarFuncMock: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ requirePermission: requirePermissionMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createServerClient: vi.fn() }));
vi.mock("@/lib/relatorio-dinamico/dados/aluno", () => ({
  carregarCtxAlunos: carregarAlunosMock,
  listarRegistrosAluno: vi.fn(),
}));
vi.mock("@/lib/relatorio-dinamico/dados/rh", () => ({
  carregarCtxFuncionarios: carregarFuncMock,
  listarRegistrosRh: vi.fn(),
}));

import { gerarDadosRelatorioAction } from "./actions";

const ID = "11111111-1111-1111-1111-111111111111";
const filtrosAluno = { ano: 2026, filtrarPor: "serie", valores: [], status: ["ativa"] };

beforeEach(() => {
  requirePermissionMock.mockReset().mockResolvedValue({ profile: { perfil: "secretaria", escola_id: "e1" }, permissions: {} });
  carregarAlunosMock.mockReset().mockResolvedValue([]);
  carregarFuncMock.mockReset().mockResolvedValue([]);
});

describe("gerarDadosRelatorioAction", () => {
  it("rejeita coluna fora do catálogo", async () => {
    const r = await gerarDadosRelatorioAction({ entidade: "aluno", ids: [ID], colunas: ["xxx"], ordenacao: [], filtros: filtrosAluno });
    expect(r).toEqual({ ok: false, error: "Coluna desconhecida: xxx" });
    expect(carregarAlunosMock).not.toHaveBeenCalled();
  });
  it("rejeita coluna salarial para quem não tem rh.folha-v2", async () => {
    const r = await gerarDadosRelatorioAction({ entidade: "funcionario", ids: [ID], colunas: ["ctr.salario"], ordenacao: [], filtros: null });
    expect(r).toEqual({ ok: false, error: "Coluna desconhecida: ctr.salario" });
  });
  it("rejeita acima do limite de registros", async () => {
    const ids = Array.from({ length: 2001 }, () => ID);
    const r = await gerarDadosRelatorioAction({ entidade: "aluno", ids, colunas: ["aluno.nome"], ordenacao: [], filtros: filtrosAluno });
    expect(r.ok).toBe(false);
  });
  it("pede permissão de leitura do módulo da entidade e só as relações necessárias", async () => {
    await gerarDadosRelatorioAction({ entidade: "aluno", ids: [ID], colunas: ["aluno.nome", "mae.nome"], ordenacao: [], filtros: filtrosAluno });
    expect(requirePermissionMock).toHaveBeenCalledWith("relatorios.dinamico-aluno", "read");
    expect(carregarAlunosMock).toHaveBeenCalledWith([ID], 2026, new Set(["responsaveis"]));
  });
  it("entidade inválida é recusada", async () => {
    const r = await gerarDadosRelatorioAction({ entidade: "x" as never, ids: [ID], colunas: [], ordenacao: [], filtros: null });
    expect(r.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify they fail** → FAIL.

- [ ] **Step 3: Implement `lotes.ts`**

```ts
// src/lib/relatorio-dinamico/dados/lotes.ts
/** PostgREST usa GET: `.in()` com centenas de uuids estoura o tamanho da URL. */
export function emLotes<T>(itens: T[], tamanho = 150): T[][] {
  const lotes: T[][] = [];
  for (let i = 0; i < itens.length; i += tamanho) lotes.push(itens.slice(i, i + tamanho));
  return lotes;
}
```

- [ ] **Step 4: Implement `dados/aluno.ts`**

```ts
// src/lib/relatorio-dinamico/dados/aluno.ts
import "server-only";
import { createServerClient } from "@/lib/supabase/server";
import type { FiltrosAluno, RegistroResumo } from "../tipos";
import type { AlunoCtx, ContatoRow, EnderecoRow, MedicoRow, ResponsavelRow } from "../catalogo/aluno";
import { emLotes } from "./lotes";

const COLLATOR = new Intl.Collator("pt-BR", { sensitivity: "base" });
const um = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? v[0] ?? null : v ?? null);

export async function listarRegistrosAluno(f: FiltrosAluno): Promise<RegistroResumo[]> {
  const supabase = await createServerClient();
  let q = supabase
    .from("matriculas")
    .select("aluno_id, alunos!inner(nome), series!inner(nome, segmento), turmas(nome)")
    .eq("ano_letivo", f.ano)
    .in("status", f.status);
  if (f.valores.length > 0) {
    if (f.filtrarPor === "serie") q = q.in("serie_id", f.valores);
    if (f.filtrarPor === "turma") q = q.in("turma_id", f.valores);
    if (f.filtrarPor === "segmento") q = q.in("series.segmento", f.valores);
  }
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? [])
    .map((m) => {
      const serie = um(m.series as { nome: string } | { nome: string }[]);
      const turma = um(m.turmas as { nome: string } | { nome: string }[] | null);
      return {
        id: m.aluno_id as string,
        nome: um(m.alunos as { nome: string } | { nome: string }[])?.nome ?? "",
        detalhe: [serie?.nome, turma?.nome].filter(Boolean).join(" · "),
      };
    })
    .sort((a, b) => COLLATOR.compare(a.nome, b.nome));
}

const SELECT_ALUNO =
  "id, matricula_codigo, nome, sexo, data_nascimento, naturalidade, nacionalidade, celular, cpf, rg, orgao_expedidor, data_expedicao, certidao_livro, certidao_folha, certidao_numero, certidao_cartorio, email, codigo_inep, etnia";
const FRAGMENTO: Record<string, string> = {
  responsaveis: "responsaveis_aluno(nome, cpf, telefone, celular, parentesco, email, responsavel_financeiro, responsavel_pedagogico)",
  contatos: "contatos_aluno(nome, telefone, celular, parentesco, principal)",
  enderecos: "enderecos_aluno(logradouro, numero, complemento, bairro, cidade, uf, cep, principal)",
  medico: "informacoes_medicas(alergia_descricao, necessidade_especial_descricao, doenca_grave_descricao, remedio_especial_descricao, tipo_sanguineo, plano_saude)",
};

type LinhaMatricula = {
  aluno_id: string; turma_id: string; codigo: string | null; ano_letivo: number; status: string; data_matricula: string | null;
  series: { nome: string; segmento: string | null } | { nome: string; segmento: string | null }[] | null;
  turmas: { nome: string; turno: string | null } | { nome: string; turno: string | null }[] | null;
  alunos: Record<string, unknown> | Record<string, unknown>[];
};

async function numerosDeChamada(turmaIds: string[], ano: number): Promise<Map<string, number>> {
  const supabase = await createServerClient();
  const mapa = new Map<string, number>();
  const porTurma = new Map<string, { alunoId: string; nome: string }[]>();
  for (const lote of emLotes(turmaIds)) {
    const { data, error } = await supabase
      .from("matriculas")
      .select("aluno_id, turma_id, alunos!inner(nome, nome_normalizado)")
      .eq("ano_letivo", ano)
      .eq("status", "ativa")
      .in("turma_id", lote);
    if (error) throw error;
    for (const m of data ?? []) {
      const a = um(m.alunos as { nome: string; nome_normalizado: string | null } | { nome: string; nome_normalizado: string | null }[]);
      const lista = porTurma.get(m.turma_id as string) ?? [];
      lista.push({ alunoId: m.aluno_id as string, nome: a?.nome_normalizado || a?.nome || "" });
      porTurma.set(m.turma_id as string, lista);
    }
  }
  for (const lista of porTurma.values()) {
    lista.sort((x, y) => COLLATOR.compare(x.nome, y.nome)).forEach((x, i) => mapa.set(x.alunoId, i + 1));
  }
  return mapa;
}

export async function carregarCtxAlunos(ids: string[], ano: number, relacoes: Set<string>): Promise<AlunoCtx[]> {
  const supabase = await createServerClient();
  const extras = Object.entries(FRAGMENTO).filter(([rel]) => relacoes.has(rel)).map(([, frag]) => frag);
  const select = `aluno_id, turma_id, codigo, ano_letivo, status, data_matricula, series(nome, segmento), turmas(nome, turno), alunos!inner(${[SELECT_ALUNO, ...extras].join(", ")})`;

  const linhas: LinhaMatricula[] = [];
  for (const lote of emLotes(ids)) {
    const { data, error } = await supabase.from("matriculas").select(select).eq("ano_letivo", ano).in("aluno_id", lote);
    if (error) throw error;
    linhas.push(...((data ?? []) as unknown as LinhaMatricula[]));
  }

  const chamada = relacoes.has("chamada")
    ? await numerosDeChamada([...new Set(linhas.map((l) => l.turma_id))], ano)
    : new Map<string, number>();
  const hoje = new Date();

  return linhas
    .map((l): AlunoCtx => {
      const a = um(l.alunos) as Record<string, unknown>;
      const serie = um(l.series);
      const turma = um(l.turmas);
      return {
        aluno: a as unknown as AlunoCtx["aluno"],
        matricula: {
          codigo: l.codigo, ano_letivo: l.ano_letivo, status: l.status, data_matricula: l.data_matricula,
          serie: serie?.nome ?? null, segmento: serie?.segmento ?? null, turma: turma?.nome ?? null, turno: turma?.turno ?? null,
        },
        responsaveis: (a.responsaveis_aluno as ResponsavelRow[] | undefined) ?? [],
        contatos: (a.contatos_aluno as ContatoRow[] | undefined) ?? [],
        enderecos: (a.enderecos_aluno as EnderecoRow[] | undefined) ?? [],
        medico: um(a.informacoes_medicas as MedicoRow | MedicoRow[] | undefined),
        numeroChamada: chamada.get(l.aluno_id) ?? null,
        hoje,
      };
    })
    .sort((x, y) => COLLATOR.compare(x.aluno.nome, y.aluno.nome));
}
```

- [ ] **Step 5: Implement `dados/rh.ts`**

```ts
// src/lib/relatorio-dinamico/dados/rh.ts
import "server-only";
import { createServerClient } from "@/lib/supabase/server";
import type { FiltrosRh, RegistroResumo } from "../tipos";
import type { FuncionarioCtx } from "../catalogo/funcionario";
import { emLotes } from "./lotes";

const COLLATOR = new Intl.Collator("pt-BR", { sensitivity: "base" });
const um = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? v[0] ?? null : v ?? null);
const CATEGORIAS_DOCENTES = "(fund1,fund2,medio)";

async function perfisPorAtribuicao(f: FiltrosRh): Promise<string[] | null> {
  if (f.turmaIds.length === 0 && f.disciplinaIds.length === 0) return null;
  const supabase = await createServerClient();
  let q = supabase.from("professor_disciplina_turma").select("perfil_id");
  if (f.turmaIds.length) q = q.in("turma_id", f.turmaIds);
  if (f.disciplinaIds.length) q = q.in("disciplina_id", f.disciplinaIds);
  const { data, error } = await q;
  if (error) throw error;
  return [...new Set((data ?? []).map((r) => r.perfil_id as string))];
}

export async function listarRegistrosRh(f: FiltrosRh, professor: boolean): Promise<RegistroResumo[]> {
  const supabase = await createServerClient();
  let q = supabase.from("employees").select("id, name, cargo, companies(name, nome_fantasia)");
  if (f.situacao !== "todos") q = q.eq("ativo", f.situacao === "ativo");
  if (f.companyId) q = q.eq("company_id", f.companyId);
  if (f.categoria) q = q.eq("school_category", f.categoria);
  if (f.cargo) q = q.ilike("cargo", f.cargo);
  if (professor) {
    q = q.or(`perfil_id.not.is.null,school_category.in.${CATEGORIAS_DOCENTES}`);
    const perfis = await perfisPorAtribuicao(f);
    if (perfis !== null) {
      if (perfis.length === 0) return [];
      q = q.in("perfil_id", perfis);
    }
  }
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? [])
    .map((e) => {
      const emp = um(e.companies as { name: string; nome_fantasia: string | null } | { name: string; nome_fantasia: string | null }[] | null);
      return { id: e.id as string, nome: e.name as string, detalhe: [e.cargo, emp?.nome_fantasia || emp?.name].filter(Boolean).join(" · ") };
    })
    .sort((a, b) => COLLATOR.compare(a.nome, b.nome));
}

type LinhaFunc = Record<string, unknown> & {
  id: string; name: string; perfil_id: string | null;
  companies: FuncionarioCtx["empresa"] | NonNullable<FuncionarioCtx["empresa"]>[] | null;
  folha_contratos?: Array<NonNullable<FuncionarioCtx["contrato"]> & { ativo: boolean }>;
  perfis?: { email: string | null } | { email: string | null }[] | null;
};

async function atribuicoesPorPerfil(perfilIds: string[]): Promise<Map<string, FuncionarioCtx["atribuicoes"]>> {
  const supabase = await createServerClient();
  const mapa = new Map<string, FuncionarioCtx["atribuicoes"]>();
  for (const lote of emLotes(perfilIds)) {
    const { data, error } = await supabase
      .from("professor_disciplina_turma")
      .select("perfil_id, disciplinas(nome), turmas(nome, series(nome))")
      .in("perfil_id", lote);
    if (error) throw error;
    for (const r of data ?? []) {
      const disc = um(r.disciplinas as { nome: string } | { nome: string }[] | null);
      const turma = um(r.turmas as { nome: string; series: unknown } | { nome: string; series: unknown }[] | null);
      const serie = um(turma?.series as { nome: string } | { nome: string }[] | null);
      const lista = mapa.get(r.perfil_id as string) ?? [];
      lista.push({ disciplina: disc?.nome ?? "", turma: turma?.nome ?? "", serie: serie?.nome ?? "" });
      mapa.set(r.perfil_id as string, lista);
    }
  }
  return mapa;
}

export async function carregarCtxFuncionarios(ids: string[], relacoes: Set<string>): Promise<FuncionarioCtx[]> {
  const supabase = await createServerClient();
  const partes = [
    "id, name, cpf, birth_date, hire_date, email, telefone, cargo, school_category, status_contrato, ativo, perfil_id",
    "companies(name, nome_fantasia, cnpj)",
    relacoes.has("contrato") ? "folha_contratos(salario_base, valor_hora_aula, aulas_semanais, data_desligamento, ativo)" : null,
    relacoes.has("usuario") ? "perfis(email)" : null,
  ].filter(Boolean);

  const linhas: LinhaFunc[] = [];
  for (const lote of emLotes(ids)) {
    const { data, error } = await supabase.from("employees").select(partes.join(", ")).in("id", lote);
    if (error) throw error;
    linhas.push(...((data ?? []) as unknown as LinhaFunc[]));
  }

  const atrib = relacoes.has("atribuicoes")
    ? await atribuicoesPorPerfil(linhas.map((l) => l.perfil_id).filter((p): p is string => Boolean(p)))
    : new Map<string, FuncionarioCtx["atribuicoes"]>();
  const hoje = new Date();

  return linhas
    .map((l): FuncionarioCtx => {
      const contratos = l.folha_contratos ?? [];
      const contrato = contratos.find((c) => c.ativo) ?? null;
      return {
        func: l as unknown as FuncionarioCtx["func"],
        empresa: um(l.companies),
        contrato,
        atribuicoes: l.perfil_id ? atrib.get(l.perfil_id) ?? [] : [],
        usuarioEmail: um(l.perfis)?.email ?? null,
        hoje,
      };
    })
    .sort((x, y) => COLLATOR.compare(x.func.name, y.func.name));
}
```

- [ ] **Step 6: Implement `dados/opcoes.ts`**

```ts
// src/lib/relatorio-dinamico/dados/opcoes.ts
import "server-only";
import { createServerClient } from "@/lib/supabase/server";
import { getStudentAvailableYears } from "@/lib/data/students";
import { companyLogoUrl } from "@/lib/storage/company-logo-url";
import { TemplateConfigSchema, type EmpresaRelatorio, type Entidade, type TemplateResumo } from "../tipos";

export type OpcoesAluno = {
  anos: number[];
  series: { id: string; nome: string; segmento: string | null }[];
  turmas: { id: string; nome: string; serie_id: string; ano_letivo: number }[];
};
export type OpcoesRh = {
  empresas: { id: string; nome: string }[];
  cargos: string[];
  turmas: { id: string; nome: string; ano_letivo: number }[];
  disciplinas: { id: string; nome: string; serie: string }[];
};

export async function listarTemplates(entidade: Entidade): Promise<TemplateResumo[]> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("relatorio_templates").select("id, nome, config").eq("entidade", entidade).order("nome");
  if (error) throw error;
  // Template com config inválida (ex.: schema mudou) é descartado em vez de quebrar a página.
  return (data ?? []).flatMap((t) => {
    const cfg = TemplateConfigSchema.safeParse(t.config);
    return cfg.success ? [{ id: t.id as string, nome: t.nome as string, config: cfg.data }] : [];
  });
}

export async function listarEmpresasRelatorio(): Promise<EmpresaRelatorio[]> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("companies").select("id, name, nome_fantasia, resolucao, logo_path").eq("ativo", true).order("name");
  if (error) throw error;
  return (data ?? []).map((c) => ({
    id: c.id as string,
    nomeFantasia: (c.nome_fantasia as string) || (c.name as string),
    resolucao: (c.resolucao as string) ?? null,
    logoUrl: companyLogoUrl(c.logo_path as string | null),
  }));
}

export async function opcoesAluno(): Promise<OpcoesAluno> {
  const supabase = await createServerClient();
  const [anos, series, turmas] = await Promise.all([
    getStudentAvailableYears(),
    supabase.from("series").select("id, nome, segmento, ordem").eq("ativo", true).order("ordem"),
    supabase.from("turmas").select("id, nome, serie_id, ano_letivo").eq("ativo", true).order("nome"),
  ]);
  if (series.error) throw series.error;
  if (turmas.error) throw turmas.error;
  return {
    anos,
    series: (series.data ?? []).map((s) => ({ id: s.id as string, nome: s.nome as string, segmento: (s.segmento as string) ?? null })),
    turmas: (turmas.data ?? []) as OpcoesAluno["turmas"],
  };
}

export async function opcoesRh(): Promise<OpcoesRh> {
  const supabase = await createServerClient();
  const [empresas, cargos, turmas, disciplinas] = await Promise.all([
    supabase.from("companies").select("id, name").eq("ativo", true).order("name"),
    supabase.from("employees").select("cargo").not("cargo", "is", null),
    supabase.from("turmas").select("id, nome, ano_letivo, series(nome)").eq("ativo", true).order("ano_letivo", { ascending: false }),
    supabase.from("disciplinas").select("id, nome, series(nome)").eq("ativo", true).order("nome"),
  ]);
  for (const r of [empresas, cargos, turmas, disciplinas]) if (r.error) throw r.error;
  const um = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? v[0] ?? null : v ?? null);
  return {
    empresas: (empresas.data ?? []).map((e) => ({ id: e.id as string, nome: e.name as string })),
    cargos: [...new Set((cargos.data ?? []).map((c) => String(c.cargo).trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR")),
    turmas: (turmas.data ?? []).map((t) => ({
      id: t.id as string,
      nome: `${um(t.series as { nome: string } | { nome: string }[] | null)?.nome ?? ""} ${t.nome}`.trim(),
      ano_letivo: t.ano_letivo as number,
    })),
    disciplinas: (disciplinas.data ?? []).map((d) => ({
      id: d.id as string,
      nome: d.nome as string,
      serie: um(d.series as { nome: string } | { nome: string }[] | null)?.nome ?? "",
    })),
  };
}
```

- [ ] **Step 7: Implement `actions.ts`**

```ts
// src/app/(app)/relatorios/dinamico/actions.ts
"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/session";
import { createServerClient } from "@/lib/supabase/server";
import {
  ENTIDADES, FiltrosAlunoSchema, FiltrosRhSchema, LIMITE_REGISTROS, MODULO_POR_ENTIDADE, TemplateConfigSchema,
  type DadosRelatorio, type Entidade, type Ordenacao, type RegistroResumo, type TemplateResumo,
} from "@/lib/relatorio-dinamico/tipos";
import { filtrarColunasPorPermissao, getCatalogo, relacoesNecessarias } from "@/lib/relatorio-dinamico/catalogo";
import { montarDados } from "@/lib/relatorio-dinamico/montar";
import { ordenarLinhas } from "@/lib/relatorio-dinamico/ordenar";
import { carregarCtxAlunos, listarRegistrosAluno } from "@/lib/relatorio-dinamico/dados/aluno";
import { carregarCtxFuncionarios, listarRegistrosRh } from "@/lib/relatorio-dinamico/dados/rh";

type Falha = { ok: false; error: string };
const EntidadeSchema = z.enum(ENTIDADES);
const ROTA: Record<Entidade, string> = {
  aluno: "/relatorios/dinamico/alunos",
  funcionario: "/relatorios/dinamico/funcionarios",
  professor: "/relatorios/dinamico/professores",
};

function erro(e: unknown): Falha {
  const msg = e instanceof Error ? e.message : "Erro inesperado ao gerar o relatório.";
  return { ok: false, error: msg };
}

export async function listarRegistrosAction(input: { entidade: Entidade; filtros: unknown }): Promise<{ ok: true; registros: RegistroResumo[] } | Falha> {
  const ent = EntidadeSchema.safeParse(input.entidade);
  if (!ent.success) return { ok: false, error: "Relatório inválido." };
  await requirePermission(MODULO_POR_ENTIDADE[ent.data], "read");
  try {
    if (ent.data === "aluno") {
      const f = FiltrosAlunoSchema.safeParse(input.filtros);
      if (!f.success) return { ok: false, error: "Filtros inválidos." };
      return { ok: true, registros: await listarRegistrosAluno(f.data) };
    }
    const f = FiltrosRhSchema.safeParse(input.filtros);
    if (!f.success) return { ok: false, error: "Filtros inválidos." };
    return { ok: true, registros: await listarRegistrosRh(f.data, ent.data === "professor") };
  } catch (e) {
    console.error("[relatorio-dinamico] listarRegistros", e);
    return erro(e);
  }
}

const GerarSchema = z.object({
  entidade: EntidadeSchema,
  ids: z.array(z.string().uuid()).min(1, "Selecione ao menos um registro.").max(LIMITE_REGISTROS, `Máximo de ${LIMITE_REGISTROS} registros por emissão.`),
  colunas: z.array(z.string()).min(1, "Selecione ao menos uma coluna."),
  ordenacao: z.array(z.object({ key: z.string(), dir: z.enum(["asc", "desc"]) })),
  filtros: z.unknown(),
});

export async function gerarDadosRelatorioAction(input: {
  entidade: Entidade; ids: string[]; colunas: string[]; ordenacao: Ordenacao[]; filtros: unknown;
}): Promise<{ ok: true; dados: DadosRelatorio } | Falha> {
  const p = GerarSchema.safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "Pedido inválido." };
  const { entidade, ids, colunas, ordenacao } = p.data;
  const session = await requirePermission(MODULO_POR_ENTIDADE[entidade], "read");
  const isAdmin = session.profile.perfil === "admin";

  try {
    if (entidade === "aluno") {
      const f = FiltrosAlunoSchema.safeParse(p.data.filtros);
      if (!f.success) return { ok: false, error: "Informe o ano de referência." };
      const catalogo = filtrarColunasPorPermissao(getCatalogo("aluno"), session.permissions, isAdmin);
      montarDados(catalogo, [], colunas); // valida keys antes de consultar o banco
      const ctxs = await carregarCtxAlunos(ids, f.data.ano, relacoesNecessarias(catalogo, colunas));
      return { ok: true, dados: ordenarLinhas(montarDados(catalogo, ctxs, colunas), ordenacao) };
    }
    const catalogo = filtrarColunasPorPermissao(getCatalogo(entidade), session.permissions, isAdmin);
    montarDados(catalogo, [], colunas);
    const ctxs = await carregarCtxFuncionarios(ids, relacoesNecessarias(catalogo, colunas));
    return { ok: true, dados: ordenarLinhas(montarDados(catalogo, ctxs, colunas), ordenacao) };
  } catch (e) {
    if (!(e instanceof Error && e.message.startsWith("Coluna desconhecida"))) console.error("[relatorio-dinamico] gerar", e);
    return erro(e);
  }
}

const SalvarSchema = z.object({
  id: z.string().uuid().optional(),
  entidade: EntidadeSchema,
  nome: z.string().trim().min(1, "Informe o nome do template.").max(120),
  config: TemplateConfigSchema,
});

export async function salvarTemplateAction(input: { id?: string; entidade: Entidade; nome: string; config: unknown }): Promise<{ ok: true; template: TemplateResumo } | Falha> {
  const p = SalvarSchema.safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "Template inválido." };
  const { id, entidade, nome, config } = p.data;
  const session = await requirePermission(MODULO_POR_ENTIDADE[entidade], id ? "update" : "create");
  const supabase = await createServerClient();

  const query = id
    ? supabase.from("relatorio_templates").update({ nome, config }).eq("id", id).eq("entidade", entidade)
    : supabase.from("relatorio_templates").insert({ escola_id: session.profile.escola_id, entidade, nome, config, criado_por: session.user?.id ?? null });
  const { data, error } = await query.select("id, nome, config").single();
  if (error) {
    if (error.code === "23505") return { ok: false, error: "Já existe um template com esse nome." };
    console.error("[relatorio-dinamico] salvarTemplate", error);
    return { ok: false, error: "Não foi possível salvar o template." };
  }
  revalidatePath(ROTA[entidade]);
  return { ok: true, template: { id: data.id as string, nome: data.nome as string, config } };
}

export async function excluirTemplateAction(input: { id: string; entidade: Entidade }): Promise<{ ok: true } | Falha> {
  const p = z.object({ id: z.string().uuid(), entidade: EntidadeSchema }).safeParse(input);
  if (!p.success) return { ok: false, error: "Template inválido." };
  await requirePermission(MODULO_POR_ENTIDADE[p.data.entidade], "delete");
  const supabase = await createServerClient();
  const { error } = await supabase.from("relatorio_templates").delete().eq("id", p.data.id).eq("entidade", p.data.entidade);
  if (error) {
    console.error("[relatorio-dinamico] excluirTemplate", error);
    return { ok: false, error: "Não foi possível excluir o template." };
  }
  revalidatePath(ROTA[p.data.entidade]);
  return { ok: true };
}
```

Nota: `console.error` em server action é log de servidor (permitido; a regra proíbe `console.log`). No teste, `session.user` pode não existir — por isso `session.user?.id`.

- [ ] **Step 8: Run tests and typecheck**

Run: `npx vitest run src/lib/relatorio-dinamico "src/app/(app)/relatorios/dinamico"` → PASS.
Run: `npm run typecheck` → sem erros. Se o tipo de retorno do Supabase reclamar de `.select(string dinâmica)`, o cast `as unknown as LinhaX[]` já cobre; não trocar por `any`.

- [ ] **Step 9: Commit**

```bash
git add src/lib/relatorio-dinamico "src/app/(app)/relatorios/dinamico/actions.ts" "src/app/(app)/relatorios/dinamico/actions.test.ts"
git commit -m "feat(relatorios): camada de dados e server actions dos relatorios dinamicos"
```

---

### Task 10: Primitivas de UI — stepper, segmentado, acordeão, lista dupla, ordenação, lista de registros

**Files:**
- Create: `src/components/relatorio-dinamico/stepper.tsx`, `segmentado.tsx`, `acordeao.tsx`, `lista-dupla.tsx`, `ordenacao-editor.tsx`, `registros-lista.tsx`
- Test: `src/components/relatorio-dinamico/lista-dupla.test.tsx`, `src/components/relatorio-dinamico/primitivas.test.tsx`

**Interfaces:**
- Consumes: `ColunaMeta`, `Ordenacao`, `RegistroResumo` (Task 3)
- Produces:
  - `Stepper({ value, onChange, min, max, step, ariaLabel, decimais? })`
  - `Segmentado({ value: boolean, onChange, ariaLabel, labels?: [string, string] })`
  - `Acordeao({ titulo, children, defaultOpen? })`
  - `ListaDupla({ disponiveis: ColunaMeta[]; selecionadas: string[]; onChange: (keys: string[]) => void })`
  - `OrdenacaoEditor({ colunas: ColunaMeta[]; valor: Ordenacao[]; onChange: (o: Ordenacao[]) => void })`
  - `RegistrosLista({ registros: RegistroResumo[]; selecionados: Set<string>; onChange: (s: Set<string>) => void; carregando: boolean })`

- [ ] **Step 1: Write the failing tests**

```tsx
// src/components/relatorio-dinamico/lista-dupla.test.tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ListaDupla } from "./lista-dupla";
import type { ColunaMeta } from "@/lib/relatorio-dinamico/tipos";

const cols: ColunaMeta[] = [
  { key: "a", label: "Bairro", grupo: "Endereço", tipo: "texto" },
  { key: "b", label: "Nome Aluno", grupo: "Dados", tipo: "texto" },
  { key: "c", label: "CEP", grupo: "Endereço", tipo: "texto" },
];

describe("ListaDupla", () => {
  it("move marcados para a direita, no fim", () => {
    const onChange = vi.fn();
    render(<ListaDupla disponiveis={cols} selecionadas={["b"]} onChange={onChange} />);
    fireEvent.click(screen.getByRole("checkbox", { name: "Bairro" }));
    fireEvent.click(screen.getByRole("button", { name: "Adicionar selecionados" }));
    expect(onChange).toHaveBeenCalledWith(["b", "a"]);
  });
  it("remove marcados da direita", () => {
    const onChange = vi.fn();
    render(<ListaDupla disponiveis={cols} selecionadas={["b", "a"]} onChange={onChange} />);
    fireEvent.click(screen.getByRole("checkbox", { name: "Nome Aluno" }));
    fireEvent.click(screen.getByRole("button", { name: "Remover selecionados" }));
    expect(onChange).toHaveBeenCalledWith(["a"]);
  });
  it("duplo clique move um item e busca filtra", () => {
    const onChange = vi.fn();
    render(<ListaDupla disponiveis={cols} selecionadas={[]} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("Pesquisar dados disponíveis"), { target: { value: "cep" } });
    expect(screen.queryByText("Bairro")).toBeNull();
    fireEvent.doubleClick(screen.getByText("CEP"));
    expect(onChange).toHaveBeenCalledWith(["c"]);
  });
  it("contadores de rodapé", () => {
    render(<ListaDupla disponiveis={cols} selecionadas={[]} onChange={vi.fn()} />);
    expect(screen.getAllByText("Nenhum item selecionado")).toHaveLength(2);
  });
});
```

```tsx
// src/components/relatorio-dinamico/primitivas.test.tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Stepper } from "./stepper";
import { Segmentado } from "./segmentado";
import { OrdenacaoEditor } from "./ordenacao-editor";

describe("Stepper", () => {
  it("respeita passo e limites", () => {
    const onChange = vi.fn();
    render(<Stepper value={7.5} onChange={onChange} min={6} max={12} step={0.5} ariaLabel="Fonte" decimais={1} />);
    fireEvent.click(screen.getByRole("button", { name: "Aumentar Fonte" }));
    expect(onChange).toHaveBeenLastCalledWith(8);
    fireEvent.change(screen.getByLabelText("Fonte"), { target: { value: "99" } });
    expect(onChange).toHaveBeenLastCalledWith(12);
  });
});

describe("Segmentado", () => {
  it("alterna Sim/Não", () => {
    const onChange = vi.fn();
    render(<Segmentado value={true} onChange={onChange} ariaLabel="Rótulos" />);
    expect(screen.getByRole("radio", { name: "Sim" })).toHaveAttribute("aria-checked", "true");
    fireEvent.click(screen.getByRole("radio", { name: "Não" }));
    expect(onChange).toHaveBeenCalledWith(false);
  });
});

describe("OrdenacaoEditor", () => {
  const colunas = [
    { key: "a", label: "Nome", grupo: "g", tipo: "texto" as const },
    { key: "b", label: "Série", grupo: "g", tipo: "texto" as const },
  ];
  it("adiciona, inverte direção e remove", () => {
    const onChange = vi.fn();
    const { rerender } = render(<OrdenacaoEditor colunas={colunas} valor={[]} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("Coluna para ordenar"), { target: { value: "b" } });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar ordenação" }));
    expect(onChange).toHaveBeenLastCalledWith([{ key: "b", dir: "asc" }]);
    rerender(<OrdenacaoEditor colunas={colunas} valor={[{ key: "b", dir: "asc" }]} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Série: crescente" }));
    expect(onChange).toHaveBeenLastCalledWith([{ key: "b", dir: "desc" }]);
    fireEvent.click(screen.getByRole("button", { name: "Remover Série" }));
    expect(onChange).toHaveBeenLastCalledWith([]);
  });
});
```

- [ ] **Step 2: Run to verify they fail** → FAIL.

- [ ] **Step 3: Implement `stepper.tsx`, `segmentado.tsx`, `acordeao.tsx`**

```tsx
// src/components/relatorio-dinamico/stepper.tsx
"use client";

import { Minus, Plus } from "lucide-react";

type Props = { value: number; onChange: (v: number) => void; min: number; max: number; step: number; ariaLabel: string; decimais?: number };

export function Stepper({ value, onChange, min, max, step, ariaLabel, decimais = 0 }: Props) {
  const ajustar = (v: number) => {
    const n = Number.isNaN(v) ? min : Math.round(v / step) * step;
    onChange(Number(Math.min(max, Math.max(min, n)).toFixed(decimais)));
  };
  return (
    <div className="flex h-10 items-center rounded-ui border border-line bg-surface">
      <button type="button" aria-label={`Diminuir ${ariaLabel}`} className="px-3 text-ink/70 hover:text-ink disabled:opacity-40" disabled={value <= min} onClick={() => ajustar(value - step)}>
        <Minus size={14} />
      </button>
      <input
        aria-label={ariaLabel}
        type="number"
        inputMode="decimal"
        className="w-full min-w-0 border-0 bg-transparent text-right text-sm text-ink focus:outline-none"
        value={value.toLocaleString("en-US", { minimumFractionDigits: decimais, maximumFractionDigits: decimais })}
        min={min}
        max={max}
        step={step}
        onChange={(e) => ajustar(Number(e.target.value))}
      />
      <button type="button" aria-label={`Aumentar ${ariaLabel}`} className="px-3 text-ink/70 hover:text-ink disabled:opacity-40" disabled={value >= max} onClick={() => ajustar(value + step)}>
        <Plus size={14} />
      </button>
    </div>
  );
}
```

```tsx
// src/components/relatorio-dinamico/segmentado.tsx
"use client";

import { cn } from "@/lib/utils";

type Props = { value: boolean; onChange: (v: boolean) => void; ariaLabel: string; labels?: [string, string] };

export function Segmentado({ value, onChange, ariaLabel, labels = ["Sim", "Não"] }: Props) {
  const opcoes: Array<[boolean, string]> = [[true, labels[0]], [false, labels[1]]];
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="grid h-10 grid-cols-2 overflow-hidden rounded-ui border border-line">
      {opcoes.map(([v, label]) => (
        <button
          key={label}
          type="button"
          role="radio"
          aria-checked={value === v}
          onClick={() => onChange(v)}
          className={cn(
            "text-sm transition-colors",
            value === v ? "bg-brand/10 font-semibold text-brand ring-1 ring-inset ring-brand" : "bg-surface text-ink/70 hover:bg-muted"
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
```

```tsx
// src/components/relatorio-dinamico/acordeao.tsx
import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";

export function Acordeao({ titulo, children, defaultOpen = false }: { titulo: string; children: ReactNode; defaultOpen?: boolean }) {
  return (
    <details open={defaultOpen} className="group rounded-ui border border-line bg-surface">
      <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-medium text-ink">
        {titulo}
        <ChevronDown size={16} className="transition-transform group-open:rotate-180" />
      </summary>
      <div className="border-t border-line p-4">{children}</div>
    </details>
  );
}
```

- [ ] **Step 4: Implement `lista-dupla.tsx`**

```tsx
// src/components/relatorio-dinamico/lista-dupla.tsx
"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, GripVertical } from "lucide-react";
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { normalizarTexto } from "@/lib/relatorio-dinamico/formatar";
import type { ColunaMeta } from "@/lib/relatorio-dinamico/tipos";

type Props = { disponiveis: ColunaMeta[]; selecionadas: string[]; onChange: (keys: string[]) => void };

const contagem = (n: number) => (n === 0 ? "Nenhum item selecionado" : n === 1 ? "1 item selecionado" : `${n} itens selecionados`);
const filtra = (cols: ColunaMeta[], busca: string) => {
  const b = normalizarTexto(busca);
  return b ? cols.filter((c) => normalizarTexto(c.label).includes(b)) : cols;
};

function Painel({ titulo, busca, onBusca, itens, marcados, onMarcados, onDuplo, rotuloBusca, ordenavel }: {
  titulo: string; busca: string; onBusca: (s: string) => void; itens: ColunaMeta[]; marcados: Set<string>;
  onMarcados: (s: Set<string>) => void; onDuplo: (key: string) => void; rotuloBusca: string; ordenavel?: boolean;
}) {
  const todos = itens.length > 0 && itens.every((i) => marcados.has(i.key));
  const alternar = (key: string) => {
    const s = new Set(marcados);
    if (s.has(key)) s.delete(key); else s.add(key);
    onMarcados(s);
  };
  return (
    <div className="grid min-w-0 gap-2">
      <label className="flex items-center gap-3 rounded-ui bg-brand px-4 py-3 text-sm font-semibold text-white">
        <input type="checkbox" checked={todos} onChange={() => onMarcados(todos ? new Set() : new Set(itens.map((i) => i.key)))} aria-label={`Marcar todos: ${titulo}`} />
        {titulo}
      </label>
      <input aria-label={rotuloBusca} placeholder="Pesquisar" value={busca} onChange={(e) => onBusca(e.target.value)} />
      <ul className="h-64 overflow-y-auto rounded-ui border border-line bg-muted/40 p-1">
        {itens.length === 0 ? <li className="p-4 text-center text-sm text-ink/55">Não há nada para mostrar aqui</li> : null}
        {itens.map((item) =>
          ordenavel ? (
            <ItemOrdenavel key={item.key} item={item} marcado={marcados.has(item.key)} onToggle={alternar} onDuplo={onDuplo} />
          ) : (
            <li key={item.key} onDoubleClick={() => onDuplo(item.key)} className="mb-1 flex items-center gap-3 rounded-ui bg-surface px-3 py-2 text-sm text-ink odd:bg-muted">
              <input type="checkbox" aria-label={item.label} checked={marcados.has(item.key)} onChange={() => alternar(item.key)} />
              <span className="truncate">{item.label}</span>
              <span className="ml-auto shrink-0 text-xs text-ink/45">{item.grupo}</span>
            </li>
          )
        )}
      </ul>
      <p className="text-right text-xs font-medium text-ink/55">{contagem(marcados.size)}</p>
    </div>
  );
}

function ItemOrdenavel({ item, marcado, onToggle, onDuplo }: { item: ColunaMeta; marcado: boolean; onToggle: (k: string) => void; onDuplo: (k: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: item.key });
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} onDoubleClick={() => onDuplo(item.key)}
      className="mb-1 flex items-center gap-3 rounded-ui bg-surface px-3 py-2 text-sm text-ink odd:bg-muted">
      <button type="button" aria-label={`Arrastar ${item.label}`} className="cursor-grab text-ink/40" {...attributes} {...listeners}>
        <GripVertical size={14} />
      </button>
      <input type="checkbox" aria-label={item.label} checked={marcado} onChange={() => onToggle(item.key)} />
      <span className="truncate">{item.label}</span>
    </li>
  );
}

export function ListaDupla({ disponiveis, selecionadas, onChange }: Props) {
  const [buscaEsq, setBuscaEsq] = useState("");
  const [buscaDir, setBuscaDir] = useState("");
  const [marcEsq, setMarcEsq] = useState<Set<string>>(new Set());
  const [marcDir, setMarcDir] = useState<Set<string>>(new Set());
  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  const porKey = new Map(disponiveis.map((c) => [c.key, c]));
  const esquerda = filtra(
    disponiveis.filter((c) => !selecionadas.includes(c.key)).sort((a, b) => a.label.localeCompare(b.label, "pt-BR")),
    buscaEsq
  );
  const direita = filtra(selecionadas.map((k) => porKey.get(k)).filter((c): c is ColunaMeta => Boolean(c)), buscaDir);

  const adicionar = (keys: string[]) => {
    onChange([...selecionadas, ...keys.filter((k) => !selecionadas.includes(k))]);
    setMarcEsq(new Set());
  };
  const remover = (keys: string[]) => {
    onChange(selecionadas.filter((k) => !keys.includes(k)));
    setMarcDir(new Set());
  };
  const aoArrastar = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    onChange(arrayMove(selecionadas, selecionadas.indexOf(String(e.active.id)), selecionadas.indexOf(String(e.over.id))));
  };

  return (
    <div className="grid gap-4 md:grid-cols-[1fr_auto_1fr]">
      <Painel titulo="Dados Disponíveis" rotuloBusca="Pesquisar dados disponíveis" busca={buscaEsq} onBusca={setBuscaEsq}
        itens={esquerda} marcados={marcEsq} onMarcados={setMarcEsq} onDuplo={(k) => adicionar([k])} />
      <div className="flex flex-row items-center justify-center gap-2 md:flex-col">
        <button type="button" aria-label="Adicionar selecionados" className="ds-button ds-button-secondary w-24" disabled={marcEsq.size === 0} onClick={() => adicionar([...marcEsq])}>
          <ArrowRight size={16} />
        </button>
        <button type="button" aria-label="Remover selecionados" className="ds-button ds-button-secondary w-24" disabled={marcDir.size === 0} onClick={() => remover([...marcDir])}>
          <ArrowLeft size={16} />
        </button>
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={aoArrastar}>
        <SortableContext items={selecionadas} strategy={verticalListSortingStrategy}>
          <Painel titulo="Dados Selecionados" rotuloBusca="Pesquisar dados selecionados" busca={buscaDir} onBusca={setBuscaDir}
            itens={direita} marcados={marcDir} onMarcados={setMarcDir} onDuplo={(k) => remover([k])} ordenavel />
        </SortableContext>
      </DndContext>
    </div>
  );
}
```

Nota DS: `bg-brand text-white` repete o padrão dos cabeçalhos azuis do protótipo; se o DS tiver token de texto sobre brand (ex.: `text-on-brand`), usar esse — conferir em `docs/design_system/src/rrb-tokens.css` e trocar antes do commit.

- [ ] **Step 5: Implement `ordenacao-editor.tsx` and `registros-lista.tsx`**

```tsx
// src/components/relatorio-dinamico/ordenacao-editor.tsx
"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, X } from "lucide-react";
import type { ColunaMeta, Ordenacao } from "@/lib/relatorio-dinamico/tipos";

type Props = { colunas: ColunaMeta[]; valor: Ordenacao[]; onChange: (o: Ordenacao[]) => void };

export function OrdenacaoEditor({ colunas, valor, onChange }: Props) {
  const livres = colunas.filter((c) => !valor.some((o) => o.key === c.key));
  const [escolhida, setEscolhida] = useState("");
  const label = (key: string) => colunas.find((c) => c.key === key)?.label ?? key;
  const mover = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= valor.length) return;
    const nova = [...valor];
    [nova[i], nova[j]] = [nova[j], nova[i]];
    onChange(nova);
  };

  return (
    <div className="grid gap-3">
      {colunas.length === 0 ? <p className="text-sm text-ink/55">Selecione colunas em "Colunas" para ordenar por elas. Sem ordenação, sai por nome.</p> : null}
      <div className="flex flex-wrap items-end gap-2">
        <label className="min-w-56 flex-1">
          Coluna para ordenar
          <select value={escolhida} onChange={(e) => setEscolhida(e.target.value)}>
            <option value="">Selecione...</option>
            {livres.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
        </label>
        <button type="button" className="ds-button ds-button-secondary" aria-label="Adicionar ordenação" disabled={!escolhida}
          onClick={() => { onChange([...valor, { key: escolhida, dir: "asc" }]); setEscolhida(""); }}>
          Adicionar
        </button>
      </div>
      <ol className="grid gap-1">
        {valor.map((o, i) => (
          <li key={o.key} className="flex items-center gap-2 rounded-ui border border-line bg-surface px-3 py-2 text-sm text-ink">
            <span className="w-6 text-ink/45">{i + 1}º</span>
            <span className="flex-1 truncate">{label(o.key)}</span>
            <button type="button" className="ds-button ds-button-secondary" aria-label={`${label(o.key)}: ${o.dir === "asc" ? "crescente" : "decrescente"}`}
              onClick={() => onChange(valor.map((x) => (x.key === o.key ? { ...x, dir: x.dir === "asc" ? "desc" : "asc" } : x)))}>
              {o.dir === "asc" ? "A → Z" : "Z → A"}
            </button>
            <button type="button" aria-label={`Subir ${label(o.key)}`} disabled={i === 0} onClick={() => mover(i, -1)}><ArrowUp size={14} /></button>
            <button type="button" aria-label={`Descer ${label(o.key)}`} disabled={i === valor.length - 1} onClick={() => mover(i, 1)}><ArrowDown size={14} /></button>
            <button type="button" aria-label={`Remover ${label(o.key)}`} onClick={() => onChange(valor.filter((x) => x.key !== o.key))}><X size={14} /></button>
          </li>
        ))}
      </ol>
    </div>
  );
}
```

```tsx
// src/components/relatorio-dinamico/registros-lista.tsx
"use client";

import { useState } from "react";
import { Spinner } from "@/components/ui/spinner";
import { normalizarTexto } from "@/lib/relatorio-dinamico/formatar";
import type { RegistroResumo } from "@/lib/relatorio-dinamico/tipos";

type Props = { registros: RegistroResumo[]; selecionados: Set<string>; onChange: (s: Set<string>) => void; carregando: boolean };

export function RegistrosLista({ registros, selecionados, onChange, carregando }: Props) {
  const [busca, setBusca] = useState("");
  const b = normalizarTexto(busca);
  const visiveis = b ? registros.filter((r) => normalizarTexto(r.nome).includes(b)) : registros;
  const todos = visiveis.length > 0 && visiveis.every((r) => selecionados.has(r.id));
  const alternarTodos = () => {
    const s = new Set(selecionados);
    visiveis.forEach((r) => (todos ? s.delete(r.id) : s.add(r.id)));
    onChange(s);
  };
  const alternar = (id: string) => {
    const s = new Set(selecionados);
    if (s.has(id)) s.delete(id); else s.add(id);
    onChange(s);
  };

  return (
    <div className="grid gap-2">
      <label className="flex items-center gap-3 rounded-ui bg-brand px-4 py-3 text-sm font-semibold text-white">
        <input type="checkbox" checked={todos} onChange={alternarTodos} aria-label="Marcar todos os registros" />
        Nome {carregando ? <Spinner className="ml-2" /> : null}
      </label>
      <input aria-label="Pesquisar registros" placeholder="Pesquisar" value={busca} onChange={(e) => setBusca(e.target.value)} />
      <ul className="max-h-80 overflow-y-auto rounded-ui border border-line">
        {!carregando && visiveis.length === 0 ? <li className="p-6 text-center text-sm text-ink/55">Nenhum registro encontrado com esses filtros.</li> : null}
        {visiveis.map((r) => (
          <li key={r.id} className="flex items-center gap-3 px-3 py-2 text-sm text-ink odd:bg-muted">
            <input type="checkbox" aria-label={r.nome} checked={selecionados.has(r.id)} onChange={() => alternar(r.id)} />
            <span className="truncate">{r.nome}</span>
            {r.detalhe ? <span className="ml-auto shrink-0 text-xs text-ink/50">{r.detalhe}</span> : null}
          </li>
        ))}
      </ul>
      <p className="text-right text-xs font-medium text-ink/55">
        {selecionados.size === 0 ? "Nenhum item selecionado" : `${selecionados.size} ${selecionados.size === 1 ? "item selecionado" : "itens selecionados"}`}
      </p>
    </div>
  );
}
```

- [ ] **Step 6: Run tests**

Run: `npx vitest run src/components/relatorio-dinamico` → PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/relatorio-dinamico
git commit -m "feat(relatorios): componentes de lista dupla, ordenacao, stepper e segmentado"
```

---

### Task 11: Emissão no cliente, leiaute, barra de templates e shell da página

**Files:**
- Create: `src/lib/relatorio-dinamico/render/emitir.ts`
- Create: `src/components/relatorio-dinamico/leiaute-form.tsx`, `template-bar.tsx`, `relatorio-dinamico-page.tsx`
- Test: `src/lib/relatorio-dinamico/render/emitir.test.ts`, `src/components/relatorio-dinamico/template-bar.test.tsx`

**Interfaces:**
- Consumes: Tasks 3–10
- Produces:
  - `selecionarEmpresas(config: TemplateConfig, empresas: EmpresaRelatorio[]): { cabecalho: EmpresaRelatorio | null; logos: EmpresaRelatorio[] }`
  - `sanearConfig(config: TemplateConfig, colunas: ColunaMeta[]): { config: TemplateConfig; removidas: string[] }`
  - `emitirArquivo(config: TemplateConfig, dados: DadosRelatorio, empresas: EmpresaRelatorio[], nomeBase: string): Promise<{ avisos: string[] }>`
  - `LeiauteForm({ config, onChange, colunas, empresas })`
  - `TemplateBar({ entidade, templates, selecionadoId, config, permissoes, onSelecionar, onSalvo, onExcluido })`
  - `RelatorioDinamicoPage(props: RelatorioDinamicoPageProps)` com `type RelatorioDinamicoPageProps = { entidade: Entidade; colunas: ColunaMeta[]; templates: TemplateResumo[]; empresas: EmpresaRelatorio[]; permissoes: { criar: boolean; editar: boolean; excluir: boolean }; filtros: (onChange: (f: unknown) => void) => ReactNode }` — o slot `filtros` é preenchido por um wrapper client da página (Task 12/13).

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/relatorio-dinamico/render/emitir.test.ts
import { describe, it, expect } from "vitest";
import { sanearConfig, selecionarEmpresas } from "./emitir";
import { configPadrao } from "../tipos";

const empresas = [
  { id: "11111111-1111-1111-1111-111111111111", nomeFantasia: "A", resolucao: null, logoUrl: null },
  { id: "22222222-2222-2222-2222-222222222222", nomeFantasia: "B", resolucao: "RES", logoUrl: "https://x/b.png" },
  { id: "33333333-3333-3333-3333-333333333333", nomeFantasia: "C", resolucao: null, logoUrl: "https://x/c.png" },
];

describe("selecionarEmpresas", () => {
  it("sem escolha: cabeçalho = primeira ativa; logo = primeira com logo", () => {
    const r = selecionarEmpresas(configPadrao("aluno"), empresas);
    expect(r.cabecalho?.nomeFantasia).toBe("A");
    expect(r.logos.map((e) => e.nomeFantasia)).toEqual(["B"]);
  });
  it("escolha explícita define ordem e cabeçalho; empresa sem logo ou inexistente é ignorada nos logos", () => {
    const r = selecionarEmpresas(
      { ...configPadrao("aluno"), logosEmpresas: [empresas[2].id, empresas[0].id, "44444444-4444-4444-4444-444444444444"] },
      empresas
    );
    expect(r.cabecalho?.nomeFantasia).toBe("C");
    expect(r.logos.map((e) => e.nomeFantasia)).toEqual(["C"]);
  });
  it("exibirLogos=false → sem logos; nenhuma empresa → tudo vazio", () => {
    expect(selecionarEmpresas({ ...configPadrao("aluno"), exibirLogos: false }, empresas).logos).toEqual([]);
    expect(selecionarEmpresas(configPadrao("aluno"), [])).toEqual({ cabecalho: null, logos: [] });
  });
});

describe("sanearConfig", () => {
  it("remove colunas (e ordenações) que não existem mais no catálogo do usuário", () => {
    const cfg = { ...configPadrao("funcionario"), colunas: ["func.nome", "ctr.salario"], ordenacao: [{ key: "ctr.salario", dir: "desc" as const }] };
    const r = sanearConfig(cfg, [{ key: "func.nome", label: "Nome", grupo: "g", tipo: "texto" }]);
    expect(r.config.colunas).toEqual(["func.nome"]);
    expect(r.config.ordenacao).toEqual([]);
    expect(r.removidas).toEqual(["ctr.salario"]);
  });
});
```

```tsx
// src/components/relatorio-dinamico/template-bar.test.tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const { salvarMock, excluirMock } = vi.hoisted(() => ({ salvarMock: vi.fn(), excluirMock: vi.fn() }));
vi.mock("@/app/(app)/relatorios/dinamico/actions", () => ({ salvarTemplateAction: salvarMock, excluirTemplateAction: excluirMock }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));

import { ConfirmProvider } from "@/components/ui/confirm-dialog";
import { TemplateBar } from "./template-bar";
import { configPadrao } from "@/lib/relatorio-dinamico/tipos";

const tpl = { id: "11111111-1111-1111-1111-111111111111", nome: "Aluno cidade", config: configPadrao("aluno") };
const perms = { criar: true, editar: true, excluir: true };

beforeEach(() => { salvarMock.mockReset(); excluirMock.mockReset(); });

describe("TemplateBar", () => {
  it("Salvar sem template selecionado pede nome e cria", async () => {
    salvarMock.mockResolvedValue({ ok: true, template: { ...tpl, id: "22222222-2222-2222-2222-222222222222", nome: "Novo" } });
    const onSalvo = vi.fn();
    render(<ConfirmProvider><TemplateBar entidade="aluno" templates={[tpl]} selecionadoId={null} config={configPadrao("aluno")} permissoes={perms}
      onSelecionar={vi.fn()} onSalvo={onSalvo} onExcluido={vi.fn()} /></ConfirmProvider>);
    fireEvent.click(screen.getByRole("button", { name: /Salvar/ }));
    fireEvent.change(screen.getByLabelText("Nome do template"), { target: { value: "Novo" } });
    fireEvent.click(screen.getByRole("button", { name: "Criar template" }));
    await waitFor(() => expect(salvarMock).toHaveBeenCalledWith({ entidade: "aluno", nome: "Novo", config: configPadrao("aluno") }));
    expect(onSalvo).toHaveBeenCalled();
  });
  it("Excluir pede confirmação pelo useConfirm (nunca confirm nativo)", async () => {
    const nativo = vi.spyOn(window, "confirm");
    excluirMock.mockResolvedValue({ ok: true });
    const onExcluido = vi.fn();
    render(<ConfirmProvider><TemplateBar entidade="aluno" templates={[tpl]} selecionadoId={tpl.id} config={tpl.config} permissoes={perms}
      onSelecionar={vi.fn()} onSalvo={vi.fn()} onExcluido={onExcluido} /></ConfirmProvider>);
    fireEvent.click(screen.getByRole("button", { name: /Excluir/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Excluir template" }));
    await waitFor(() => expect(onExcluido).toHaveBeenCalledWith(tpl.id));
    expect(nativo).not.toHaveBeenCalled();
  });
});
```

(Se o `ConfirmModal` usar outro texto de botão para `confirmLabel`, o teste usa o `confirmLabel: "Excluir template"` passado pelo componente — ver Step 4.)

- [ ] **Step 2: Run to verify they fail** → FAIL.

- [ ] **Step 3: Implement `render/emitir.ts`**

```ts
// src/lib/relatorio-dinamico/render/emitir.ts
"use client";

import { carregarImagens } from "@/lib/documents/pdf-utils";
import type { ColunaMeta, DadosRelatorio, EmpresaRelatorio, TemplateConfig } from "../tipos";
import { repetirCopias } from "../ordenar";
import { gerarCsv } from "./csv";
import { baixarBlob, nomeArquivo } from "./baixar";
import { renderEtiquetas } from "./etiqueta";
import { renderGrade } from "./grade";
import { renderTabular } from "./tabular";
import type { ImagemPdf } from "./cabecalho";

export function selecionarEmpresas(config: TemplateConfig, empresas: EmpresaRelatorio[]): { cabecalho: EmpresaRelatorio | null; logos: EmpresaRelatorio[] } {
  const escolhidas = (config.logosEmpresas ?? [])
    .map((id) => empresas.find((e) => e.id === id))
    .filter((e): e is EmpresaRelatorio => Boolean(e));
  const cabecalho = escolhidas[0] ?? empresas[0] ?? null;
  if (config.exibirLogos === false) return { cabecalho, logos: [] };
  const base = escolhidas.length > 0 ? escolhidas : empresas.filter((e) => e.logoUrl).slice(0, 1);
  return { cabecalho, logos: base.filter((e) => e.logoUrl).slice(0, 4) };
}

/** Template salvo pode citar coluna que saiu do catálogo ou que o usuário não pode ver. */
export function sanearConfig(config: TemplateConfig, colunas: ColunaMeta[]): { config: TemplateConfig; removidas: string[] } {
  const validas = new Set(colunas.map((c) => c.key));
  const removidas = config.colunas.filter((k) => !validas.has(k));
  if (removidas.length === 0) return { config, removidas };
  const cols = config.colunas.filter((k) => validas.has(k));
  return { config: { ...config, colunas: cols, ordenacao: config.ordenacao.filter((o) => cols.includes(o.key)) }, removidas };
}

export async function emitirArquivo(
  config: TemplateConfig, dados: DadosRelatorio, empresas: EmpresaRelatorio[], nomeBase: string
): Promise<{ avisos: string[] }> {
  const avisos: string[] = [];
  const comCopias: DadosRelatorio = { ...dados, linhas: repetirCopias(dados.linhas, config.copias) };

  if (config.formato === "csv") {
    baixarBlob(new Blob([gerarCsv(comCopias)], { type: "text/csv;charset=utf-8" }), nomeArquivo(nomeBase, "csv"));
    return { avisos };
  }
  if (config.formato === "etiqueta") {
    renderEtiquetas(comCopias, {
      modelo: config.modeloEtiqueta ?? "6180", fonte: config.fonte ?? 7.5, rotulos: config.rotulos ?? true, descricao: config.descricaoImpressao,
    }).save(nomeArquivo(nomeBase, "pdf"));
    return { avisos };
  }

  const { cabecalho, logos } = selecionarEmpresas(config, empresas);
  const urls = logos.map((e) => e.logoUrl as string);
  const cache = await carregarImagens(urls);
  const imagens: ImagemPdf[] = [];
  logos.forEach((e, i) => {
    const img = cache.get(urls[i]);
    if (img) imagens.push(img);
    else avisos.push(`Não foi possível carregar a logo de ${e.nomeFantasia}.`);
  });
  const cab = {
    titulo: config.titulo?.trim() ?? "",
    subtitulo: config.subtitulo?.trim() || undefined,
    empresaNome: cabecalho?.nomeFantasia ?? null,
    resolucao: cabecalho?.resolucao ?? null,
    logos: imagens,
    emitidoEm: new Date(),
    descricao: config.descricaoImpressao?.trim() || undefined,
  };
  const doc = config.formato === "grade" ? renderGrade(comCopias, cab) : renderTabular(comCopias, cab);
  doc.save(nomeArquivo(config.titulo || nomeBase, "pdf"));
  return { avisos };
}
```

- [ ] **Step 4: Implement `template-bar.tsx`**

```tsx
// src/components/relatorio-dinamico/template-bar.tsx
"use client";

import { useState, useTransition } from "react";
import { FilePlus2, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { excluirTemplateAction, salvarTemplateAction } from "@/app/(app)/relatorios/dinamico/actions";
import type { Entidade, TemplateConfig, TemplateResumo } from "@/lib/relatorio-dinamico/tipos";

type Props = {
  entidade: Entidade;
  templates: TemplateResumo[];
  selecionadoId: string | null;
  config: TemplateConfig;
  permissoes: { criar: boolean; editar: boolean; excluir: boolean };
  onSelecionar: (id: string | null) => void;
  onSalvo: (t: TemplateResumo) => void;
  onExcluido: (id: string) => void;
};

export function TemplateBar({ entidade, templates, selecionadoId, config, permissoes, onSelecionar, onSalvo, onExcluido }: Props) {
  const confirm = useConfirm();
  const [pendente, iniciar] = useTransition();
  const [dialogo, setDialogo] = useState(false);
  const [nome, setNome] = useState("");
  const atual = templates.find((t) => t.id === selecionadoId) ?? null;

  const salvar = (payload: { id?: string; nome: string }) =>
    iniciar(async () => {
      const r = await salvarTemplateAction({ ...payload, entidade, config });
      if (!r.ok) return void toast.error(r.error);
      toast.success("Template salvo.");
      setDialogo(false);
      onSalvo(r.template);
    });

  const aoSalvar = () => {
    if (atual && permissoes.editar) return salvar({ id: atual.id, nome: atual.nome });
    setNome("");
    setDialogo(true);
  };

  const aoExcluir = async () => {
    if (!atual) return;
    const ok = await confirm({ title: "Excluir template", message: `Excluir o template "${atual.nome}"? Essa ação não pode ser desfeita.`, confirmLabel: "Excluir template", variant: "danger" });
    if (!ok) return;
    iniciar(async () => {
      const r = await excluirTemplateAction({ id: atual.id, entidade });
      if (!r.ok) return void toast.error(r.error);
      toast.success("Template excluído.");
      onExcluido(atual.id);
    });
  };

  return (
    <div className="grid gap-3 md:grid-cols-[2fr_1fr_1fr_1fr] md:items-end">
      <label>
        Template
        <select value={selecionadoId ?? ""} onChange={(e) => onSelecionar(e.target.value || null)}>
          <option value="">— Sem template —</option>
          {templates.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
        </select>
      </label>
      <Button type="button" variant="secondary" loading={pendente} disabled={!(permissoes.criar || (atual && permissoes.editar))} onClick={aoSalvar}>
        <Save size={14} className="mr-1.5" /> Salvar
      </Button>
      <Button type="button" variant="secondary" onClick={() => onSelecionar(null)}>
        <FilePlus2 size={14} className="mr-1.5" /> Novo
      </Button>
      <Button type="button" variant="secondary" disabled={!atual || !permissoes.excluir || pendente} onClick={aoExcluir}>
        <Trash2 size={14} className="mr-1.5" /> Excluir
      </Button>

      <Dialog open={dialogo} title="Salvar template" onClose={() => setDialogo(false)}>
        <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); salvar({ nome }); }}>
          <label>
            Nome do template
            <input value={nome} onChange={(e) => setNome(e.target.value)} maxLength={120} required autoFocus />
          </label>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setDialogo(false)}>Cancelar</Button>
            <Button type="submit" loading={pendente} disabled={!nome.trim()}>Criar template</Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
```

- [ ] **Step 5: Implement `leiaute-form.tsx`**

```tsx
// src/components/relatorio-dinamico/leiaute-form.tsx
"use client";

import { FORMATOS, FORMATO_LABEL, MODELOS_ETIQUETA_CODIGOS, type ColunaMeta, type EmpresaRelatorio, type Formato, type ModeloEtiqueta, type TemplateConfig } from "@/lib/relatorio-dinamico/tipos";
import { MODELOS_ETIQUETA, descricaoModelo } from "@/lib/relatorio-dinamico/render/modelos-etiqueta";
import { Acordeao } from "./acordeao";
import { ListaDupla } from "./lista-dupla";
import { OrdenacaoEditor } from "./ordenacao-editor";
import { Segmentado } from "./segmentado";
import { Stepper } from "./stepper";

type Props = { config: TemplateConfig; onChange: (c: TemplateConfig) => void; colunas: ColunaMeta[]; empresas: EmpresaRelatorio[] };

export function LeiauteForm({ config, onChange, colunas, empresas }: Props) {
  const set = <K extends keyof TemplateConfig>(k: K, v: TemplateConfig[K]) => onChange({ ...config, [k]: v });
  const pdfRelatorio = config.formato === "grade" || config.formato === "tabular";
  const sufixo = config.formato === "grade" ? "grade" : "tabular";
  const comLogo = empresas.filter((e) => e.logoUrl);
  const selecionadasMeta = config.colunas.map((k) => colunas.find((c) => c.key === k)).filter((c): c is ColunaMeta => Boolean(c));
  const modelo = MODELOS_ETIQUETA[config.modeloEtiqueta ?? "6180"];

  const alternarLogo = (id: string) => {
    const atual = config.logosEmpresas ?? [];
    set("logosEmpresas", atual.includes(id) ? atual.filter((x) => x !== id) : [...atual, id].slice(0, 4));
  };
  const setColunas = (keys: string[]) =>
    onChange({ ...config, colunas: keys, ordenacao: config.ordenacao.filter((o) => keys.includes(o.key)) });

  return (
    <div className="grid gap-5">
      <label>
        Formato de emissão
        <select value={config.formato} onChange={(e) => set("formato", e.target.value as Formato)}>
          {FORMATOS.map((f) => <option key={f} value={f}>{FORMATO_LABEL[f]}</option>)}
        </select>
      </label>

      <div className="grid gap-4 md:grid-cols-4">
        {config.formato === "etiqueta" ? (
          <>
            <label>
              Formato da etiqueta
              <select value={config.modeloEtiqueta ?? "6180"} onChange={(e) => set("modeloEtiqueta", e.target.value as ModeloEtiqueta)}>
                {MODELOS_ETIQUETA_CODIGOS.map((m) => <option key={m} value={m}>{MODELOS_ETIQUETA[m].nome}</option>)}
              </select>
            </label>
            <div>
              <span className="mb-1 block text-sm font-medium text-ink">Fonte</span>
              <Stepper value={config.fonte ?? 7.5} onChange={(v) => set("fonte", v)} min={6} max={12} step={0.5} decimais={1} ariaLabel="Fonte" />
            </div>
            <div>
              <span className="mb-1 block text-sm font-medium text-ink">Rótulos dos campos</span>
              <Segmentado value={config.rotulos ?? true} onChange={(v) => set("rotulos", v)} ariaLabel="Rótulos dos campos" />
            </div>
          </>
        ) : null}

        {pdfRelatorio ? (
          <>
            <label>
              Título do relatório {sufixo}
              <input value={config.titulo ?? ""} maxLength={120} onChange={(e) => set("titulo", e.target.value)} required />
            </label>
            <label>
              Subtítulo do relatório {sufixo}
              <input value={config.subtitulo ?? ""} maxLength={120} onChange={(e) => set("subtitulo", e.target.value)} />
            </label>
          </>
        ) : null}

        {config.formato !== "csv" ? (
          <label className={config.formato === "etiqueta" ? "" : "md:col-span-2"}>
            Descrição para impressão
            <input value={config.descricaoImpressao ?? ""} maxLength={200} onChange={(e) => set("descricaoImpressao", e.target.value)} />
          </label>
        ) : null}

        <div>
          <span className="mb-1 block text-sm font-medium text-ink" title="Quantas vezes cada registro sai no arquivo">Qtd de cópias</span>
          <Stepper value={config.copias} onChange={(v) => set("copias", v)} min={1} max={10} step={1} ariaLabel="Quantidade de cópias" />
        </div>

        {config.formato === "etiqueta" ? (
          <div className="md:col-span-3">
            <span className="mb-1 block text-sm font-medium text-ink">Descrição</span>
            <p className="rounded-ui bg-muted px-3 py-2.5 text-sm text-ink/80">{descricaoModelo(modelo)}</p>
          </div>
        ) : null}

        {pdfRelatorio ? (
          <div className="md:col-span-4 grid gap-2">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-ink">Exibir logos</span>
              <div className="w-40"><Segmentado value={config.exibirLogos ?? true} onChange={(v) => set("exibirLogos", v)} ariaLabel="Exibir logos" /></div>
            </div>
            {config.exibirLogos !== false ? (
              <fieldset className="flex flex-wrap gap-3">
                <legend className="mb-1 text-xs text-ink/60">Logos das empresas (até 4, na ordem de marcação; nenhuma = logo padrão)</legend>
                {comLogo.length === 0 ? <p className="text-sm text-ink/55">Nenhuma empresa com logo cadastrada em RH › Empresas.</p> : null}
                {comLogo.map((e) => {
                  const pos = (config.logosEmpresas ?? []).indexOf(e.id);
                  return (
                    <label key={e.id} className="flex items-center gap-2 rounded-ui border border-line px-3 py-2 text-sm">
                      <input type="checkbox" checked={pos >= 0} onChange={() => alternarLogo(e.id)} disabled={pos < 0 && (config.logosEmpresas ?? []).length >= 4} />
                      {pos >= 0 ? <span className="text-xs font-semibold text-brand">{pos + 1}º</span> : null}
                      {e.nomeFantasia}
                    </label>
                  );
                })}
              </fieldset>
            ) : null}
          </div>
        ) : null}
      </div>

      <Acordeao titulo="Colunas" defaultOpen>
        <ListaDupla disponiveis={colunas} selecionadas={config.colunas} onChange={setColunas} />
      </Acordeao>
      <Acordeao titulo="Ordenação">
        <OrdenacaoEditor colunas={selecionadasMeta} valor={config.ordenacao} onChange={(o) => set("ordenacao", o)} />
      </Acordeao>
    </div>
  );
}
```

- [ ] **Step 6: Implement `relatorio-dinamico-page.tsx`**

```tsx
// src/components/relatorio-dinamico/relatorio-dinamico-page.tsx
"use client";

import { useCallback, useRef, useState, useTransition, type ReactNode } from "react";
import { Printer, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs } from "@/components/ui/tabs";
import { gerarDadosRelatorioAction, listarRegistrosAction } from "@/app/(app)/relatorios/dinamico/actions";
import { configPadrao, validarEmissao, type ColunaMeta, type EmpresaRelatorio, type Entidade, type RegistroResumo, type TemplateConfig, type TemplateResumo } from "@/lib/relatorio-dinamico/tipos";
import { emitirArquivo, sanearConfig } from "@/lib/relatorio-dinamico/render/emitir";
import { LeiauteForm } from "./leiaute-form";
import { RegistrosLista } from "./registros-lista";
import { TemplateBar } from "./template-bar";

export type RelatorioDinamicoPageProps = {
  entidade: Entidade;
  colunas: ColunaMeta[];
  templates: TemplateResumo[];
  empresas: EmpresaRelatorio[];
  permissoes: { criar: boolean; editar: boolean; excluir: boolean };
  filtros: (onChange: (f: unknown) => void) => ReactNode;
};

const NOME_BASE: Record<Entidade, string> = { aluno: "etiquetas-alunos", funcionario: "etiquetas-funcionarios", professor: "etiquetas-professores" };

export function RelatorioDinamicoPage({ entidade, colunas, templates: iniciais, empresas, permissoes, filtros }: RelatorioDinamicoPageProps) {
  const [templates, setTemplates] = useState(iniciais);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [config, setConfig] = useState<TemplateConfig>(() => sanearConfig(configPadrao(entidade), colunas).config);
  const [registros, setRegistros] = useState<RegistroResumo[]>([]);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const filtrosAtuais = useRef<unknown>(null);
  const reqAtual = useRef(0);
  const [carregando, iniciarCarga] = useTransition();
  const [emitindo, iniciarEmissao] = useTransition();

  const aoFiltrar = useCallback((f: unknown) => {
    filtrosAtuais.current = f;
    const req = ++reqAtual.current;
    iniciarCarga(async () => {
      const r = await listarRegistrosAction({ entidade, filtros: f });
      if (req !== reqAtual.current) return; // resposta antiga de um filtro já trocado
      if (!r.ok) return void toast.error(r.error);
      setRegistros(r.registros);
      setSelecionados(new Set(r.registros.map((x) => x.id)));
    });
  }, [entidade]);

  const carregarTemplate = (id: string | null) => {
    setTemplateId(id);
    const t = templates.find((x) => x.id === id);
    const { config: limpa, removidas } = sanearConfig(t?.config ?? configPadrao(entidade), colunas);
    if (removidas.length) toast.warning(`Colunas indisponíveis foram removidas do template: ${removidas.join(", ")}`);
    setConfig(limpa);
  };

  const bloqueio = validarEmissao(config, selecionados.size);

  const emitir = () =>
    iniciarEmissao(async () => {
      const ids = registros.filter((r) => selecionados.has(r.id)).map((r) => r.id);
      const r = await gerarDadosRelatorioAction({ entidade, ids, colunas: config.colunas, ordenacao: config.ordenacao, filtros: filtrosAtuais.current });
      if (!r.ok) return void toast.error(r.error);
      try {
        const { avisos } = await emitirArquivo(config, r.dados, empresas, templates.find((t) => t.id === templateId)?.nome ?? NOME_BASE[entidade]);
        avisos.forEach((a) => toast.warning(a));
      } catch (e) {
        toast.error(e instanceof Error ? `Falha ao gerar o arquivo: ${e.message}` : "Falha ao gerar o arquivo.");
      }
    });

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-end gap-2 rounded-ui bg-muted px-4 py-3">
        {bloqueio ? <span className="mr-auto text-sm text-ink/60">{bloqueio}</span> : null}
        <Button type="button" variant="secondary" onClick={() => carregarTemplate(templateId)}>
          <X size={14} className="mr-1.5" /> Cancelar
        </Button>
        <Button type="button" loading={emitindo} disabled={Boolean(bloqueio)} onClick={emitir}>
          <Printer size={14} className="mr-1.5" /> Emitir
        </Button>
      </div>
      <Tabs
        defaultValue="filtros"
        items={[
          {
            value: "filtros",
            label: "Filtros",
            content: (
              <div className="grid gap-4">
                {filtros(aoFiltrar)}
                <RegistrosLista registros={registros} selecionados={selecionados} onChange={setSelecionados} carregando={carregando} />
              </div>
            ),
          },
          {
            value: "leiaute",
            label: "Leiaute",
            content: (
              <div className="grid gap-5">
                <TemplateBar
                  entidade={entidade} templates={templates} selecionadoId={templateId} config={config} permissoes={permissoes}
                  onSelecionar={carregarTemplate}
                  onSalvo={(t) => { setTemplates((ts) => [...ts.filter((x) => x.id !== t.id), t].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))); setTemplateId(t.id); }}
                  onExcluido={(id) => { setTemplates((ts) => ts.filter((x) => x.id !== id)); carregarTemplate(null); }}
                />
                <LeiauteForm config={config} onChange={setConfig} colunas={colunas} empresas={empresas} />
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}
```

Nota: `carregarTemplate` depois de `onExcluido` usa `templates` do render atual (template excluído some → cai no padrão), comportamento correto.

- [ ] **Step 7: Run tests and typecheck**

Run: `npx vitest run src/lib/relatorio-dinamico src/components/relatorio-dinamico` → PASS.
Run: `npm run typecheck` → sem erros.

- [ ] **Step 8: Commit**

```bash
git add src/lib/relatorio-dinamico/render/emitir.ts src/lib/relatorio-dinamico/render/emitir.test.ts src/components/relatorio-dinamico
git commit -m "feat(relatorios): leiaute, templates e emissao no cliente"
```

---

### Task 12: Relatório de Alunos (filtros + página)

**Files:**
- Create: `src/components/relatorio-dinamico/filtros-aluno.tsx`
- Create: `src/app/(app)/relatorios/dinamico/alunos/page.tsx`, `src/app/(app)/relatorios/dinamico/alunos/relatorio-alunos-client.tsx`
- Test: `src/components/relatorio-dinamico/filtros-aluno.test.tsx`

**Interfaces:**
- Consumes: `OpcoesAluno` (Task 9), `RelatorioDinamicoPage` (Task 11), `FiltrosAluno` (Task 3)
- Produces: `FiltrosAlunoForm({ opcoes: OpcoesAluno; onChange: (f: FiltrosAluno) => void })`

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/relatorio-dinamico/filtros-aluno.test.tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FiltrosAlunoForm } from "./filtros-aluno";

const opcoes = {
  anos: [2026, 2025],
  series: [{ id: "s1", nome: "3º ANO", segmento: "FUNDAMENTAL1" }],
  turmas: [{ id: "t1", nome: "A", serie_id: "s1", ano_letivo: 2026 }, { id: "t2", nome: "B", serie_id: "s1", ano_letivo: 2025 }],
};

describe("FiltrosAlunoForm", () => {
  it("emite filtro inicial com ano mais recente e status ativa", () => {
    const onChange = vi.fn();
    render(<FiltrosAlunoForm opcoes={opcoes} onChange={onChange} />);
    expect(onChange).toHaveBeenCalledWith({ ano: 2026, filtrarPor: "serie", valores: [], status: ["ativa"] });
  });
  it("trocar para turma mostra só turmas do ano e limpa valores", () => {
    const onChange = vi.fn();
    render(<FiltrosAlunoForm opcoes={opcoes} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("Filtrar por"), { target: { value: "turma" } });
    expect(screen.getByRole("checkbox", { name: "3º ANO A" })).toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: "3º ANO B" })).toBeNull();
    fireEvent.click(screen.getByRole("checkbox", { name: "3º ANO A" }));
    expect(onChange).toHaveBeenLastCalledWith({ ano: 2026, filtrarPor: "turma", valores: ["t1"], status: ["ativa"] });
  });
  it("não deixa desmarcar o último status", () => {
    const onChange = vi.fn();
    render(<FiltrosAlunoForm opcoes={opcoes} onChange={onChange} />);
    fireEvent.click(screen.getByRole("checkbox", { name: "Ativa" }));
    expect(screen.getByRole("checkbox", { name: "Ativa" })).toBeChecked();
  });
});
```

- [ ] **Step 2: Run to verify it fails** → FAIL.

- [ ] **Step 3: Implement `filtros-aluno.tsx`**

```tsx
// src/components/relatorio-dinamico/filtros-aluno.tsx
"use client";

import { useEffect, useState } from "react";
import type { OpcoesAluno } from "@/lib/relatorio-dinamico/dados/opcoes";
import { STATUS_MATRICULA, type FiltrosAluno } from "@/lib/relatorio-dinamico/tipos";

const SEGMENTOS = [
  { id: "INFANTIL", nome: "Educação Infantil" }, { id: "FUNDAMENTAL1", nome: "Fundamental I" },
  { id: "FUNDAMENTAL2", nome: "Fundamental II" }, { id: "MEDIO", nome: "Ensino Médio" },
];
const STATUS_LABEL: Record<(typeof STATUS_MATRICULA)[number], string> = { ativa: "Ativa", cancelada: "Cancelada", transferida: "Transferida", concluida: "Concluída" };

type Props = { opcoes: OpcoesAluno; onChange: (f: FiltrosAluno) => void };

export function FiltrosAlunoForm({ opcoes, onChange }: Props) {
  const [f, setF] = useState<FiltrosAluno>({ ano: opcoes.anos[0] ?? new Date().getFullYear(), filtrarPor: "serie", valores: [], status: ["ativa"] });

  // Carga inicial da lista de registros (uma vez).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => onChange(f), []);

  const atualizar = (novo: FiltrosAluno) => { setF(novo); onChange(novo); };
  const serieNome = new Map(opcoes.series.map((s) => [s.id, s.nome]));
  const valoresPossiveis =
    f.filtrarPor === "serie" ? opcoes.series.map((s) => ({ id: s.id, nome: s.nome }))
    : f.filtrarPor === "turma" ? opcoes.turmas.filter((t) => t.ano_letivo === f.ano).map((t) => ({ id: t.id, nome: `${serieNome.get(t.serie_id) ?? ""} ${t.nome}`.trim() }))
    : SEGMENTOS;
  const alternar = <T extends string>(lista: T[], v: T) => (lista.includes(v) ? lista.filter((x) => x !== v) : [...lista, v]);

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 md:grid-cols-3">
        <label>
          Ano referência *
          <select value={f.ano} onChange={(e) => atualizar({ ...f, ano: Number(e.target.value), valores: f.filtrarPor === "turma" ? [] : f.valores })}>
            {opcoes.anos.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </label>
        <label>
          Filtrar por
          <select value={f.filtrarPor} onChange={(e) => atualizar({ ...f, filtrarPor: e.target.value as FiltrosAluno["filtrarPor"], valores: [] })}>
            <option value="serie">Série</option>
            <option value="turma">Turma</option>
            <option value="segmento">Segmento</option>
          </select>
        </label>
        <fieldset>
          <legend className="mb-1 text-sm font-medium text-ink">Situação da matrícula</legend>
          <div className="flex flex-wrap gap-3">
            {STATUS_MATRICULA.map((s) => (
              <label key={s} className="flex items-center gap-1.5 text-sm">
                <input type="checkbox" checked={f.status.includes(s)}
                  onChange={() => { const n = alternar(f.status, s); if (n.length) atualizar({ ...f, status: n }); }} />
                {STATUS_LABEL[s]}
              </label>
            ))}
          </div>
        </fieldset>
      </div>
      <fieldset>
        <legend className="mb-1 text-sm font-medium text-ink">
          {f.filtrarPor === "serie" ? "Séries" : f.filtrarPor === "turma" ? "Turmas" : "Segmentos"} <span className="text-ink/50">(nenhuma marcada = todas)</span>
        </legend>
        <div className="flex max-h-32 flex-wrap gap-2 overflow-y-auto">
          {valoresPossiveis.map((v) => (
            <label key={v.id} className="flex items-center gap-1.5 rounded-ui border border-line px-2.5 py-1.5 text-sm">
              <input type="checkbox" aria-label={v.nome} checked={f.valores.includes(v.id)} onChange={() => atualizar({ ...f, valores: alternar(f.valores, v.id) })} />
              {v.nome}
            </label>
          ))}
        </div>
      </fieldset>
    </div>
  );
}
```

- [ ] **Step 4: Implement the page and client wrapper**

```tsx
// src/app/(app)/relatorios/dinamico/alunos/relatorio-alunos-client.tsx
"use client";

import { FiltrosAlunoForm } from "@/components/relatorio-dinamico/filtros-aluno";
import { RelatorioDinamicoPage, type RelatorioDinamicoPageProps } from "@/components/relatorio-dinamico/relatorio-dinamico-page";
import type { OpcoesAluno } from "@/lib/relatorio-dinamico/dados/opcoes";

export function RelatorioAlunosClient(props: Omit<RelatorioDinamicoPageProps, "filtros" | "entidade"> & { opcoes: OpcoesAluno }) {
  const { opcoes, ...rest } = props;
  return <RelatorioDinamicoPage entidade="aluno" {...rest} filtros={(onChange) => <FiltrosAlunoForm opcoes={opcoes} onChange={onChange} />} />;
}
```

```tsx
// src/app/(app)/relatorios/dinamico/alunos/page.tsx
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/card";
import { requirePermission } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { catalogoMeta, filtrarColunasPorPermissao, getCatalogo } from "@/lib/relatorio-dinamico/catalogo";
import { listarEmpresasRelatorio, listarTemplates, opcoesAluno } from "@/lib/relatorio-dinamico/dados/opcoes";
import { RelatorioAlunosClient } from "./relatorio-alunos-client";

const MODULO = "relatorios.dinamico-aluno" as const;

export default async function RelatorioDinamicoAlunosPage() {
  const session = await requirePermission(MODULO, "read");
  const isAdmin = session.profile.perfil === "admin";
  const [templates, empresas, opcoes] = await Promise.all([listarTemplates("aluno"), listarEmpresasRelatorio(), opcoesAluno()]);
  const colunas = catalogoMeta(filtrarColunasPorPermissao(getCatalogo("aluno"), session.permissions, isAdmin));
  const pode = (a: "create" | "update" | "delete") => isAdmin || can(session.permissions, MODULO, a);

  return (
    <div className="grid gap-6">
      <PageHeader
        breadcrumb={[{ label: "Relatórios", href: "/" }, { label: "Etiquetas / relatórios dinâmicos - aluno" }]}
        title="Emissão de Etiquetas/Relatórios Dinâmicos - Aluno"
      />
      <Panel className="p-6">
        <RelatorioAlunosClient colunas={colunas} templates={templates} empresas={empresas} opcoes={opcoes}
          permissoes={{ criar: pode("create"), editar: pode("update"), excluir: pode("delete") }} />
      </Panel>
    </div>
  );
}
```

(Conferir que `Panel` é exportado de `@/components/ui/card` — é o import usado em `rh/funcionarios/novo/page.tsx`. Confirmar também que `ConfirmProvider` já envolve o layout `(app)`; se não, envolver o `RelatorioAlunosClient` em `<ConfirmProvider>`: `rg "ConfirmProvider" src/app` responde.)

- [ ] **Step 5: Run tests, typecheck, build**

Run: `npx vitest run src/components/relatorio-dinamico` → PASS.
Run: `npm run typecheck && npm run build` → verdes.

- [ ] **Step 6: Manual check (dev)**

Run: `npm run dev`, abrir `/relatorios/dinamico/alunos` como admin:
1. Filtros: ano 2026, série "3º ANO" → lista carrega com todos marcados; rodapé "N itens selecionados".
2. Leiaute: colunas Nome do Pai, Nome da Mãe, Nome Aluno, Cidade Endereço, Celulares, Celular do Pai, Celular da Mãe; cópias 2; Etiquetas 6180 → Emitir baixa PDF com pares repetidos, igual ao `Etiqueta do aluno.pdf`.
3. Grade PDF com título "Festa do 3" / subtítulo → blocos rótulo|valor, cabeçalho com logo e "Quantidade: N".
4. Tabular PDF → paisagem, cabeçalho de colunas repetido.
5. CSV → abre no Excel com acentos.
6. Salvar template "Aluno cidade", recarregar a página, selecionar → config volta; Excluir → diálogo do DS.
7. Tema escuro: alternar e conferir contraste de todos os controles.

- [ ] **Step 7: Commit**

```bash
git add src/components/relatorio-dinamico/filtros-aluno.tsx src/components/relatorio-dinamico/filtros-aluno.test.tsx "src/app/(app)/relatorios/dinamico/alunos"
git commit -m "feat(relatorios): relatorio dinamico de alunos"
```

---

### Task 13: Relatórios de Funcionários e Professores

**Files:**
- Create: `src/components/relatorio-dinamico/filtros-rh.tsx`
- Create: `src/app/(app)/relatorios/dinamico/funcionarios/page.tsx`, `funcionarios/relatorio-rh-client.tsx`
- Create: `src/app/(app)/relatorios/dinamico/professores/page.tsx`
- Test: `src/components/relatorio-dinamico/filtros-rh.test.tsx`

**Interfaces:**
- Consumes: `OpcoesRh` (Task 9), `RelatorioDinamicoPage` (Task 11), `FiltrosRh` (Task 3)
- Produces: `FiltrosRhForm({ opcoes: OpcoesRh; professor: boolean; onChange: (f: FiltrosRh) => void })`; `RelatorioRhClient({ entidade: "funcionario" | "professor", opcoes, ...RelatorioDinamicoPageProps sem filtros/entidade })`

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/relatorio-dinamico/filtros-rh.test.tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FiltrosRhForm } from "./filtros-rh";

const opcoes = {
  empresas: [{ id: "11111111-1111-1111-1111-111111111111", nome: "EPG" }],
  cargos: ["Professor", "Secretária"],
  turmas: [{ id: "22222222-2222-2222-2222-222222222222", nome: "3º ANO A", ano_letivo: 2026 }],
  disciplinas: [{ id: "33333333-3333-3333-3333-333333333333", nome: "Matemática", serie: "3º ANO" }],
};
const inicial = { companyId: null, situacao: "ativo", categoria: null, cargo: null, turmaIds: [], disciplinaIds: [] };

describe("FiltrosRhForm", () => {
  it("funcionário: emite padrão e não mostra turma/disciplina", () => {
    const onChange = vi.fn();
    render(<FiltrosRhForm opcoes={opcoes} professor={false} onChange={onChange} />);
    expect(onChange).toHaveBeenCalledWith(inicial);
    expect(screen.queryByText("Turmas")).toBeNull();
  });
  it("professor: filtra por turma", () => {
    const onChange = vi.fn();
    render(<FiltrosRhForm opcoes={opcoes} professor onChange={onChange} />);
    fireEvent.click(screen.getByRole("checkbox", { name: "3º ANO A (2026)" }));
    expect(onChange).toHaveBeenLastCalledWith({ ...inicial, turmaIds: ["22222222-2222-2222-2222-222222222222"] });
  });
  it("empresa e situação", () => {
    const onChange = vi.fn();
    render(<FiltrosRhForm opcoes={opcoes} professor={false} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("Empresa"), { target: { value: "11111111-1111-1111-1111-111111111111" } });
    fireEvent.change(screen.getByLabelText("Situação"), { target: { value: "todos" } });
    expect(onChange).toHaveBeenLastCalledWith({ ...inicial, companyId: "11111111-1111-1111-1111-111111111111", situacao: "todos" });
  });
});
```

- [ ] **Step 2: Run to verify it fails** → FAIL.

- [ ] **Step 3: Implement `filtros-rh.tsx`**

```tsx
// src/components/relatorio-dinamico/filtros-rh.tsx
"use client";

import { useEffect, useState } from "react";
import type { OpcoesRh } from "@/lib/relatorio-dinamico/dados/opcoes";
import type { FiltrosRh } from "@/lib/relatorio-dinamico/tipos";

type Props = { opcoes: OpcoesRh; professor: boolean; onChange: (f: FiltrosRh) => void };

export function FiltrosRhForm({ opcoes, professor, onChange }: Props) {
  const [f, setF] = useState<FiltrosRh>({ companyId: null, situacao: "ativo", categoria: null, cargo: null, turmaIds: [], disciplinaIds: [] });

  // Carga inicial da lista de registros (uma vez).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => onChange(f), []);

  const atualizar = (novo: FiltrosRh) => { setF(novo); onChange(novo); };
  const alternar = (lista: string[], v: string) => (lista.includes(v) ? lista.filter((x) => x !== v) : [...lista, v]);

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 md:grid-cols-4">
        <label>
          Empresa
          <select value={f.companyId ?? ""} onChange={(e) => atualizar({ ...f, companyId: e.target.value || null })}>
            <option value="">Todas</option>
            {opcoes.empresas.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
          </select>
        </label>
        <label>
          Situação
          <select value={f.situacao} onChange={(e) => atualizar({ ...f, situacao: e.target.value as FiltrosRh["situacao"] })}>
            <option value="ativo">Ativos</option>
            <option value="inativo">Inativos</option>
            <option value="todos">Todos</option>
          </select>
        </label>
        <label>
          Categoria
          <select value={f.categoria ?? ""} onChange={(e) => atualizar({ ...f, categoria: (e.target.value || null) as FiltrosRh["categoria"] })}>
            <option value="">Todas</option>
            <option value="admin">Administrativo</option>
            <option value="fund1">Fundamental I</option>
            <option value="fund2">Fundamental II</option>
            <option value="medio">Ensino Médio</option>
          </select>
        </label>
        <label>
          Cargo
          <select value={f.cargo ?? ""} onChange={(e) => atualizar({ ...f, cargo: e.target.value || null })}>
            <option value="">Todos</option>
            {opcoes.cargos.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
      </div>

      {professor ? (
        <div className="grid gap-4 md:grid-cols-2">
          <fieldset>
            <legend className="mb-1 text-sm font-medium text-ink">Turmas <span className="text-ink/50">(nenhuma = todas)</span></legend>
            <div className="flex max-h-32 flex-wrap gap-2 overflow-y-auto">
              {opcoes.turmas.map((t) => {
                const rotulo = `${t.nome} (${t.ano_letivo})`;
                return (
                  <label key={t.id} className="flex items-center gap-1.5 rounded-ui border border-line px-2.5 py-1.5 text-sm">
                    <input type="checkbox" aria-label={rotulo} checked={f.turmaIds.includes(t.id)} onChange={() => atualizar({ ...f, turmaIds: alternar(f.turmaIds, t.id) })} />
                    {rotulo}
                  </label>
                );
              })}
            </div>
          </fieldset>
          <fieldset>
            <legend className="mb-1 text-sm font-medium text-ink">Disciplinas <span className="text-ink/50">(nenhuma = todas)</span></legend>
            <div className="flex max-h-32 flex-wrap gap-2 overflow-y-auto">
              {opcoes.disciplinas.map((d) => {
                const rotulo = `${d.nome} — ${d.serie}`;
                return (
                  <label key={d.id} className="flex items-center gap-1.5 rounded-ui border border-line px-2.5 py-1.5 text-sm">
                    <input type="checkbox" aria-label={rotulo} checked={f.disciplinaIds.includes(d.id)} onChange={() => atualizar({ ...f, disciplinaIds: alternar(f.disciplinaIds, d.id) })} />
                    {rotulo}
                  </label>
                );
              })}
            </div>
          </fieldset>
          <p className="md:col-span-2 text-xs text-ink/55">
            Turma/disciplina usa o vínculo "Usuário do sistema (professor)" do cadastro do funcionário em RH › Funcionários. Funcionário sem vínculo não aparece quando esses filtros estão marcados.
          </p>
        </div>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 4: Implement client wrapper and the two pages**

```tsx
// src/app/(app)/relatorios/dinamico/funcionarios/relatorio-rh-client.tsx
"use client";

import { FiltrosRhForm } from "@/components/relatorio-dinamico/filtros-rh";
import { RelatorioDinamicoPage, type RelatorioDinamicoPageProps } from "@/components/relatorio-dinamico/relatorio-dinamico-page";
import type { OpcoesRh } from "@/lib/relatorio-dinamico/dados/opcoes";

type Props = Omit<RelatorioDinamicoPageProps, "filtros" | "entidade"> & { entidade: "funcionario" | "professor"; opcoes: OpcoesRh };

export function RelatorioRhClient({ entidade, opcoes, ...rest }: Props) {
  return (
    <RelatorioDinamicoPage entidade={entidade} {...rest}
      filtros={(onChange) => <FiltrosRhForm opcoes={opcoes} professor={entidade === "professor"} onChange={onChange} />} />
  );
}
```

```tsx
// src/app/(app)/relatorios/dinamico/funcionarios/page.tsx
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/card";
import { requirePermission } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { catalogoMeta, filtrarColunasPorPermissao, getCatalogo } from "@/lib/relatorio-dinamico/catalogo";
import { listarEmpresasRelatorio, listarTemplates, opcoesRh } from "@/lib/relatorio-dinamico/dados/opcoes";
import { RelatorioRhClient } from "./relatorio-rh-client";

const MODULO = "relatorios.dinamico-funcionario" as const;

export default async function RelatorioDinamicoFuncionariosPage() {
  const session = await requirePermission(MODULO, "read");
  const isAdmin = session.profile.perfil === "admin";
  const [templates, empresas, opcoes] = await Promise.all([listarTemplates("funcionario"), listarEmpresasRelatorio(), opcoesRh()]);
  const colunas = catalogoMeta(filtrarColunasPorPermissao(getCatalogo("funcionario"), session.permissions, isAdmin));
  const pode = (a: "create" | "update" | "delete") => isAdmin || can(session.permissions, MODULO, a);

  return (
    <div className="grid gap-6">
      <PageHeader
        breadcrumb={[{ label: "Relatórios", href: "/" }, { label: "Etiquetas / relatórios dinâmicos - funcionário" }]}
        title="Emissão de Etiquetas/Relatórios Dinâmicos - Funcionário"
      />
      <Panel className="p-6">
        <RelatorioRhClient entidade="funcionario" colunas={colunas} templates={templates} empresas={empresas} opcoes={opcoes}
          permissoes={{ criar: pode("create"), editar: pode("update"), excluir: pode("delete") }} />
      </Panel>
    </div>
  );
}
```

```tsx
// src/app/(app)/relatorios/dinamico/professores/page.tsx
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/card";
import { requirePermission } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { catalogoMeta, filtrarColunasPorPermissao, getCatalogo } from "@/lib/relatorio-dinamico/catalogo";
import { listarEmpresasRelatorio, listarTemplates, opcoesRh } from "@/lib/relatorio-dinamico/dados/opcoes";
import { RelatorioRhClient } from "../funcionarios/relatorio-rh-client";

const MODULO = "relatorios.dinamico-professor" as const;

export default async function RelatorioDinamicoProfessoresPage() {
  const session = await requirePermission(MODULO, "read");
  const isAdmin = session.profile.perfil === "admin";
  const [templates, empresas, opcoes] = await Promise.all([listarTemplates("professor"), listarEmpresasRelatorio(), opcoesRh()]);
  const colunas = catalogoMeta(filtrarColunasPorPermissao(getCatalogo("professor"), session.permissions, isAdmin));
  const pode = (a: "create" | "update" | "delete") => isAdmin || can(session.permissions, MODULO, a);

  return (
    <div className="grid gap-6">
      <PageHeader
        breadcrumb={[{ label: "Relatórios", href: "/" }, { label: "Etiquetas / relatórios dinâmicos - professor" }]}
        title="Emissão de Etiquetas/Relatórios Dinâmicos - Professor"
      />
      <Panel className="p-6">
        <RelatorioRhClient entidade="professor" colunas={colunas} templates={templates} empresas={empresas} opcoes={opcoes}
          permissoes={{ criar: pode("create"), editar: pode("update"), excluir: pode("delete") }} />
      </Panel>
    </div>
  );
}
```

- [ ] **Step 5: Run tests, typecheck, build** → verdes.

- [ ] **Step 6: Manual check (RLS de RH)**

Logar como **secretaria** e abrir `/relatorios/dinamico/professores`: a lista precisa trazer professores. Se vier vazia com funcionários cadastrados, a RLS de `employees`/`folha_contratos`/`companies` não libera leitura para secretaria — **parar e reportar** ao usuário (liberar leitura é decisão de permissão, não corrigir por conta própria). Logar como **financeiro** em `/relatorios/dinamico/funcionarios`: coluna "Salário Base" só aparece se o perfil tiver `rh.folha-v2` read.

- [ ] **Step 7: Commit**

```bash
git add src/components/relatorio-dinamico/filtros-rh.tsx src/components/relatorio-dinamico/filtros-rh.test.tsx "src/app/(app)/relatorios/dinamico/funcionarios" "src/app/(app)/relatorios/dinamico/professores"
git commit -m "feat(relatorios): relatorios dinamicos de funcionarios e professores"
```

---

### Task 14: Menu, verificação final e calibragem das etiquetas

**Files:**
- Modify: `src/components/layout/topbar.tsx:29-35`

- [ ] **Step 1: Add menu items**

Em `RELATORIOS_ITEMS`, após `{ href: "/relatorios/dre", ... }`:
```ts
  { href: "/relatorios/dinamico/alunos", label: "Etiquetas/Rel. Dinâmico — Alunos", iconName: "Tags" },
  { href: "/relatorios/dinamico/funcionarios", label: "Etiquetas/Rel. Dinâmico — Funcionários", iconName: "Tags" },
  { href: "/relatorios/dinamico/professores", label: "Etiquetas/Rel. Dinâmico — Professores", iconName: "Tags" },
```
Conferir que `"Tags"` está no mapa de ícones usado por `iconName` no topbar (`rg "iconName" src/components/layout/topbar.tsx` e o mapa de ícones). Se não estiver, adicionar `Tags` ao import de `lucide-react` e ao mapa, seguindo o padrão dos outros.

- [ ] **Step 2: Full quality gate**

Run: `npm run typecheck && npm run build && npm run test`
Expected: tudo verde.

- [ ] **Step 3: Calibrar etiquetas (folha real)**

Imprimir um PDF 6180 com 30 registros em papel comum, sobrepor a uma folha Pimaco 6180 contra a luz. Se houver deslocamento sistemático, ajustar `margemEsq`/`margemTopo` do modelo em `modelos-etiqueta.ts` (e rodar o teste de "cabe na página"). Repetir para os modelos que a escola usa de fato. Registrar o resultado no PR.

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/topbar.tsx src/lib/relatorio-dinamico/render/modelos-etiqueta.ts
git commit -m "feat(relatorios): menu dos relatorios dinamicos"
```

- [ ] **Step 5: Deploy note**

No PR, destacar: **após o merge rodar `supabase db push --linked`** (migration `202609250001_relatorio_dinamico.sql`), senão as 3 telas quebram sem mensagem (tabela `relatorio_templates` e coluna `employees.perfil_id` inexistentes). Conferir o `raise notice` do backfill no output do push.
