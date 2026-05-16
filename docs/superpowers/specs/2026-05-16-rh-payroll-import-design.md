# RH Payroll — Import Bulk S/DSR + Dobra (Design)

**Data:** 2026-05-16
**Status:** Spec aprovada (aguardando review)
**Depende de:** Fase 2 + addendum DSR/dobra

## Contexto

Admin precisa atualizar `salario_sem_dsr` + `aplica_dobra` em massa para os 64 funcionários a partir de planilhas Excel existentes (`public/04ºF. pg 2026 (Colegio Integrado).xlsx` + `public/04º F. pg 2026 (Escola Pinguinho ).xlsx`). Após update, sistema apaga folha do mês corrente e regenera com novos valores — INSS/IR/descontos recalculam automático via brackets oficiais.

## Estrutura das planilhas (referência)

Cada planilha tem múltiplas sheets (PROFESSORES, ADMINISTRATIVO, ENSINO MÉDIO, Funcionários, F. FUND. II, DESCONTOS). Header em row variável (~6) contém colunas:
```
Nº | Funcionários | Aniv. | Entrada | Salário base | SALÁRIO S/ DSR | DSR | Adicional | Salário dobra | DSR | 1/3 férias | TOTAL SALÁRIO | GPS | IRRF | cred trab | ADIANT. | Deduções | Família | Receber
```

Sheets cujo nome contém "DESCONTO" são puladas (não têm dados folha).

Exemplo Ana Flávia (row 7 Professores Pinguinho):
- Salário base: 2.765,70
- SALÁRIO S/ DSR: 2.304,75 (= base − DSR)
- DSR: 460,95 (= base/6)
- Salário dobra: 2.304,75 (>0 → aplica_dobra true)

## Escopo

**Inclui:**
- Página upload multi-arquivo `.xlsx` (admin only)
- Parse server-side via exceljs
- Auto-detect sheets (qualquer com header "SALÁRIO S/ DSR", skip "DESCONTO")
- Match nome (lowercase + trim) vs `employees.name`
- Preview tela: matched + not-matched + counts
- Confirmar:
  - UPDATE employees set salario_sem_dsr + aplica_dobra
  - DELETE payroll + payroll_periods do mês corrente
  - Regenera folha (puxa novos valores employees + INSS/IR auto)
- Not-matched ignorados silenciosamente (mostrados no preview)

**Não inclui:**
- Importação de outros campos (adicional, descontos, etc.) — só s/DSR + dobra
- Criação de funcionários novos (só atualiza existentes)
- Download relatório not-matched (apenas exibe na preview)
- Selecionar mês destino (sempre = mês corrente)
- Confirmação extra antes deletar payroll (banner aviso + botão Confirmar é suficiente)

## Estrutura arquivos

**Pure parser:**
- Create: `src/lib/payroll/xlsx-parser.ts` — função `parsePayrollXlsx(buffer): ParsedRow[]`

**Actions:**
- Create: `src/lib/actions/payroll-import.ts` — `previewImportAction`, `commitImportAction`

**Validation:**
- Create: `src/lib/validation/payroll-import.ts` — Zod schemas

**Components:**
- Create: `src/components/rh/payroll-import/upload-form.tsx` (client)
- Create: `src/components/rh/payroll-import/preview-table.tsx` (client)
- Create: `src/components/rh/payroll-import/commit-button.tsx` (client)

**Page:**
- Create: `src/app/(app)/rh/funcionarios/importar/page.tsx` (server, accepts searchParams matched/notMatched serialized)

**Topbar/lista:**
- Modify: `src/app/(app)/rh/funcionarios/page.tsx` (add "Importar" button no actions admin only)

## Parser

Arquivo: `src/lib/payroll/xlsx-parser.ts`

```ts
import ExcelJS from "exceljs";

export type ParsedRow = {
  sheet: string;
  nome: string;
  salario_sem_dsr: number;
  aplica_dobra: boolean;
};

export async function parsePayrollXlsx(buffer: ArrayBuffer | Buffer): Promise<ParsedRow[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const out: ParsedRow[] = [];

  for (const ws of wb.worksheets) {
    if (/desconto/i.test(ws.name)) continue;

    // Find header row + column indexes
    let headerRow = -1;
    let nomeCol = -1, semDsrCol = -1, dobraCol = -1;

    for (let r = 1; r <= Math.min(20, ws.rowCount); r++) {
      const row = ws.getRow(r);
      row.eachCell({ includeEmpty: true }, (cell, n) => {
        const v = String(cell.value ?? "").toUpperCase().trim();
        if (v.includes("SALÁRIO S/ DSR") || v.includes("SALARIO S/ DSR")) {
          headerRow = r;
          semDsrCol = n;
        } else if (v === "FUNCIONÁRIOS" || v === "FUNCIONARIOS") {
          if (headerRow === -1 || headerRow === r) nomeCol = n;
        } else if (v.includes("SALÁRIO DOBRA") || v.includes("SALARIO DOBRA")) {
          dobraCol = n;
        }
      });
      if (headerRow > 0 && nomeCol > 0 && semDsrCol > 0) break;
    }

    if (headerRow < 0 || nomeCol < 0 || semDsrCol < 0) continue;

    // Iterate data rows
    for (let r = headerRow + 1; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      const nomeCell = row.getCell(nomeCol).value;
      const nome = nomeCell == null ? "" : String(nomeCell).trim();
      if (!nome) continue;

      const semDsrVal = cellNumber(row.getCell(semDsrCol).value);
      if (semDsrVal <= 0) continue;

      const dobraVal = dobraCol > 0 ? cellNumber(row.getCell(dobraCol).value) : 0;
      const aplica_dobra = dobraVal > 0;

      out.push({ sheet: ws.name, nome, salario_sem_dsr: round2(semDsrVal), aplica_dobra });
    }
  }

  return out;
}

function cellNumber(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === "number") return v;
  if (typeof v === "string") return Number(v.replace(",", ".")) || 0;
  if (typeof v === "object" && v && "result" in v) return cellNumber((v as { result: unknown }).result);
  return 0;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
```

## Actions

Arquivo: `src/lib/actions/payroll-import.ts`

```ts
"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requirePerfil } from "@/lib/auth/session";
import { createServerClient } from "@/lib/supabase/server";
import { parsePayrollXlsx, type ParsedRow } from "@/lib/payroll/xlsx-parser";
import { calcProventosBase } from "@/lib/payroll/calculators";
import { currentUrlMonth, urlToDbMonth } from "@/lib/payroll/date-utils";

export type MatchedRecord = {
  employee_id: string;
  nome_db: string;
  nome_planilha: string;
  cpf: string;
  salario_sem_dsr: number;
  aplica_dobra: boolean;
};

export type ImportPreview = {
  matched: MatchedRecord[];
  notMatched: ParsedRow[];
};

export async function previewImportAction(formData: FormData): Promise<never> {
  await requirePerfil(["admin"]);
  const files = formData.getAll("files");
  if (files.length === 0) redirect("/rh/funcionarios/importar?erro=Sem arquivos");

  const supabase = await createServerClient();
  const { data: employees, error } = await supabase
    .from("employees")
    .select("id, name, cpf")
    .eq("ativo", true);
  if (error) redirect(`/rh/funcionarios/importar?erro=${encodeURIComponent(error.message)}`);

  const empMap = new Map<string, { id: string; name: string; cpf: string }>();
  for (const e of employees ?? []) {
    empMap.set(normalizeName(e.name), e);
  }

  const allRows: ParsedRow[] = [];
  for (const f of files) {
    if (typeof f === "string") continue;
    const buf = await f.arrayBuffer();
    const rows = await parsePayrollXlsx(buf);
    allRows.push(...rows);
  }

  // Dedup by nome (last wins per name within import)
  const byName = new Map<string, ParsedRow>();
  for (const r of allRows) {
    byName.set(normalizeName(r.nome), r);
  }

  const matched: MatchedRecord[] = [];
  const notMatched: ParsedRow[] = [];
  for (const [key, row] of byName) {
    const emp = empMap.get(key);
    if (emp) {
      matched.push({
        employee_id: emp.id,
        nome_db: emp.name,
        nome_planilha: row.nome,
        cpf: emp.cpf,
        salario_sem_dsr: row.salario_sem_dsr,
        aplica_dobra: row.aplica_dobra
      });
    } else {
      notMatched.push(row);
    }
  }

  // Store in a temp table OR encode in URL (size risk). Solution: temp DB row keyed by session user id.
  const session = await supabase.auth.getUser();
  const userId = session.data.user?.id ?? "anonymous";

  // Use a single-row JSONB cache table
  await supabase
    .from("payroll_import_cache")
    .upsert(
      { user_id: userId, payload: { matched, notMatched }, created_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );

  redirect("/rh/funcionarios/importar?preview=1");
}

export async function commitImportAction(): Promise<never> {
  await requirePerfil(["admin"]);
  const supabase = await createServerClient();
  const session = await supabase.auth.getUser();
  const userId = session.data.user?.id ?? "anonymous";

  const { data: cache } = await supabase
    .from("payroll_import_cache")
    .select("payload")
    .eq("user_id", userId)
    .maybeSingle();

  if (!cache?.payload) redirect("/rh/funcionarios/importar?erro=Sem preview pendente");
  const { matched } = cache.payload as ImportPreview;

  // 1) UPDATE employees in batch (one per row; Supabase doesn't support multi-row update easily)
  for (const m of matched) {
    await supabase
      .from("employees")
      .update({
        salario_sem_dsr: m.salario_sem_dsr,
        aplica_dobra: m.aplica_dobra
      })
      .eq("id", m.employee_id);
  }

  // 2) Delete payroll + period of current month
  const urlMonth = currentUrlMonth();
  const dbMonth = urlToDbMonth(urlMonth);
  await supabase.from("payroll").delete().eq("reference_month", dbMonth);
  await supabase.from("payroll_periods").delete().eq("reference_month", dbMonth);

  // 3) Re-generate folha
  await supabase.from("payroll_periods").insert({ reference_month: dbMonth, status: "aberto" });

  const { data: actives } = await supabase
    .from("employees")
    .select("id, salario_sem_dsr, aplica_dobra")
    .eq("ativo", true);

  const rows = (actives ?? []).map((e) => {
    const semDsr = Number(e.salario_sem_dsr ?? 0);
    const dobra = e.aplica_dobra ?? false;
    const base = semDsr > 0 ? calcProventosBase(semDsr, dobra) : 0;
    return {
      employee_id: e.id,
      reference_month: dbMonth,
      base_salary: base,
      salario_sem_dsr: semDsr > 0 ? semDsr : null,
      aplica_dobra: dobra,
      total_earnings: base,
      total_deductions: 0,
      net_amount: base
    };
  });

  if (rows.length > 0) {
    await supabase.from("payroll").upsert(rows, { onConflict: "employee_id,reference_month", ignoreDuplicates: true });
  }

  // 4) Clean cache
  await supabase.from("payroll_import_cache").delete().eq("user_id", userId);

  revalidatePath(`/rh/folha/${urlMonth}`);
  redirect(`/rh/folha/${urlMonth}?ok=importado&matched=${matched.length}`);
}

function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
```

## Migration support — cache table

Arquivo: `supabase/migrations/202605240004_payroll_import_cache.sql`

```sql
create table if not exists public.payroll_import_cache (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null,
  created_at timestamptz not null default now()
);
```

Sem RLS adicional — só ações server-side autenticadas escrevem.

## UI

### `/rh/funcionarios/importar/page.tsx`

Server component:
- `requirePerfil(["admin"])`
- Read query param `preview=1` → busca cache row do usuário → renderiza `<PreviewTable>` + `<CommitButton>`
- Sem preview → renderiza `<UploadForm>`

### `<UploadForm>` (client)

Multi-file picker (`<input type="file" multiple accept=".xlsx">`).
Botão "Analisar" → submit `previewImportAction`.
Banner aviso: "Apenas s/DSR + dobra serão atualizados. Outros campos da planilha são ignorados."

### `<PreviewTable>` (client)

Tabela duas seções:
- **Matched (X)**: tabela com nome_db | nome_planilha | s/DSR | dobra
- **Not matched (Y)**: lista nomes da planilha sem correspondência

Botão "Confirmar e regerar folha" → confirm dialog → submit `commitImportAction`.
Banner destrutivo: "A folha do mês atual será APAGADA e regerada com os novos valores. INSS/IR serão recalculados automaticamente."
Botão "Cancelar" → delete cache + redirect `/rh/funcionarios/importar`.

### Topbar/lista funcionários

`/rh/funcionarios` page: adicionar botão actions admin-only:
```tsx
<ButtonLink href="/rh/funcionarios/importar" variant="secondary">
  <Upload size={14} /> Importar
</ButtonLink>
```

## Permissões

| Operação | Admin | Outros |
|----------|-------|--------|
| Acessar página | ✅ | ❌ |
| Preview | ✅ | ❌ |
| Commit (delete + regenerate) | ✅ | ❌ |

## Tratamento erros

- Sem arquivos: redirect com erro
- Parse falha: continua (skip sheet); se nenhuma row parsed, mostra "Nenhum dado encontrado"
- Empregado inativo: não considerado para match (filtro `ativo=true`)
- Múltiplas rows mesmo nome (duplicado entre sheets): última vence (dedup)
- Mês corrente fechado (`payroll_periods.status='fechado'`): commit falha com erro "Mês fechado, reabra antes"

## Decisões

| Decisão | Razão |
|---------|-------|
| Cache via tabela DB (não session/cookie) | Payload pode ser grande (64+ rows); cookie tem limite 4KB |
| Update sequencial employees (loop) | Simples; 64 updates rápido; Supabase JS não suporta bulk update por id |
| Apaga + regenera (não merge) | Garante consistência; novos s/DSR podem mudar tudo (INSS/IR cascade) |
| Skip sheets "DESCONTO" | Não têm dados folha relevantes |
| Auto-detect header row | Planilhas variam linha do header entre sheets |
| Match por nome normalizado | Decisão usuário; risco aceitável |
| Sem download not-matched | Decisão usuário; mostra na tela basta |

## Testes manuais

- [ ] Migration cache aplicada
- [ ] Upload ambas planilhas → preview mostra 60+ matched, alguns not-matched
- [ ] Confirmar → folha maio regenera, Ana Flávia tem s/DSR=2304.75, dobra true
- [ ] INSS/IR Ana batem oficial 2026 (583.99 / 451.81)
- [ ] Não-admin → `/acesso-negado`

## Próximos passos

1. Aprovar spec
2. writing-plans → plan
3. Execute
