# RH Payroll — DSR + Dobra Mensal (Design)

**Data:** 2026-05-16
**Status:** Spec aprovada (aguardando review)
**Fase:** Adendo à Fase 2 (Folha de Pagamento)
**Depende de:** Fase 2 ([2026-05-16-rh-folha-pagamento-design.md](./2026-05-16-rh-folha-pagamento-design.md))

## Contexto

Modelo atual da folha trata `base_salary` como entrada única do salário do funcionário. Real-world do CRM Escola separa essa entrada em:

- **Salário s/ DSR** — valor contratual sem descanso semanal
- **DSR** — descanso semanal remunerado, calculado como `s/DSR × 1/5` (Lei 605)
- **Salário base** = s/DSR + DSR
- **Dobra mensal** — alguns funcionários recebem 2× salário base por padrão

Esta spec adiciona suporte a essa decomposição, mantendo `base_salary` como valor derivado consolidado para legacy.

## Caso Ana Flávia (referência)

| Item | Valor |
|------|-------|
| Salário s/ DSR (input contratual) | 2.304,75 |
| DSR (1/5) | 460,95 |
| Salário base | 2.765,70 |
| Aplica dobra? | sim |
| Total base proventos (× 2) | 5.531,40 |

Após cálculo INSS/IR oficial 2026:
- INSS sobre 5.531,40 (progressivo) ≈ 583,99
- IR sobre (5.531,40 − INSS), faixa 27,5% ≈ 451,81
- Líquido base ≈ 4.495,60

Sistema usa **tabela INSS/IR oficial Receita Federal 2026** (decisão usuário). Diferença para planilha legada é esperada.

## Escopo

**Inclui:**
- Migration: novos campos `salario_sem_dsr` + `aplica_dobra` em `employees` + `payroll`
- Calculator: funções puras `calcDSR`, `calcBaseFromSemDsr`, `calcProventosBase`
- UI form funcionário: campos "Salário s/ DSR" + checkbox "Aplica dobra mensal"
- UI form payroll: substitui campo "Salário base" por "Salário s/ DSR" editável + derivados read-only (DSR, base, total base) + checkbox dobra
- Server actions: persist novos campos, recompute `base_salary` derivado
- `generateMonthAction`: herda `s/DSR` + `dobra` de último payroll OU `employees`

**Não inclui:**
- Mudança holerite PDF (mostra `base_salary` consolidado igual antes)
- Coluna nova no listing mensal (mantém compactness; detalhe no form)
- Backfill automático — admin preenche conforme edita

## Migration

Arquivo: `supabase/migrations/202605240003_dsr_dobra.sql`

```sql
-- employees: dados contratuais default (herdados em new payrolls)
alter table public.employees
  add column if not exists salario_sem_dsr numeric(10,2) default 0,
  add column if not exists aplica_dobra boolean default false;

-- payroll: override mensal (NULL = pega de employees na geração; após salvar fica explícito)
alter table public.payroll
  add column if not exists salario_sem_dsr numeric(10,2),
  add column if not exists aplica_dobra boolean;
```

Sem index novo (filtro por essas colunas não é use case).

## Calculator

Arquivo: `src/lib/payroll/calculators.ts` — adicionar:

```ts
export function calcDSR(salarioSemDsr: number): number {
  return round2(salarioSemDsr / 5);
}

export function calcBaseFromSemDsr(salarioSemDsr: number): number {
  return round2(salarioSemDsr + calcDSR(salarioSemDsr));
}

export function calcProventosBase(salarioSemDsr: number, aplicaDobra: boolean): number {
  const base = calcBaseFromSemDsr(salarioSemDsr);
  return aplicaDobra ? round2(base * 2) : base;
}
```

`PayrollInput` extends com:
```ts
salario_sem_dsr?: number;
aplica_dobra?: boolean;
```

`calcAll` lógica adicional (antes do cálculo de totais):
```ts
if (input.salario_sem_dsr != null && input.salario_sem_dsr > 0) {
  input = { ...input, base_salary: calcProventosBase(input.salario_sem_dsr, input.aplica_dobra ?? false) };
}
```

Restante (INSS, IR, totals) inalterado.

## Validação

`src/lib/validation/payroll.ts` — adicionar em `PayrollSchema`:
```ts
salario_sem_dsr: numericNonNeg.optional(),
aplica_dobra: boolFromForm.optional()
```

`src/lib/validation/rh.ts` — adicionar em `EmployeeSchema` + `EmployeeUpdateSchema`:
```ts
salario_sem_dsr: numericNonNeg.optional(),
aplica_dobra: z.preprocess((v) => v === "on" || v === true, z.boolean()).optional()
```

## UI Funcionário

`src/components/rh/employee-form.tsx` — adicionar grupo "Dados contratuais" após Status do contrato:

```
Salário s/ DSR  [______]   (number step 0.01, currency mask opcional)
☐ Aplica dobra mensal
```

Submit envia `salario_sem_dsr` + `aplica_dobra` (checkbox value "on").

## UI Payroll Form

`src/components/rh/payroll/payroll-row-form.tsx` — Card Proventos primeira seção rearrange:

```tsx
<NumberField label="Salário s/ DSR" name="salario_sem_dsr" value={state.salario_sem_dsr} onChange={...} />
<ReadOnly label="DSR (1/5)" value={money(calcDSR(state.salario_sem_dsr))} />
<ReadOnly label="Salário base" value={money(calcBaseFromSemDsr(state.salario_sem_dsr))} />
<Checkbox label="Aplica dobra mensal" name="aplica_dobra" checked={state.aplica_dobra} />
<ReadOnly label="Total base" value={money(calcProventosBase(state.salario_sem_dsr, state.aplica_dobra))} className="font-bold text-success" />

{/* separador */}

<NumberField label="Horas extras" .../>
... resto adicionais
```

Hidden field `base_salary` enviado com valor `calcProventosBase(...)` (server recalcula igual; redundância p/ consistência).

**Initial state lookup:**
1. `row.salario_sem_dsr` se não null → usa
2. Senão `row.employees?.salario_sem_dsr` se >0 → usa
3. Senão 0 (legacy: admin preenche manual `base_salary` antigo OU s/DSR novo)

Idem `aplica_dobra`.

**Modo legacy:** se `salario_sem_dsr` ficar 0, sistema usa `base_salary` direto (campo existe escondido OR exibido como fallback). Decisão: **sempre mostrar s/DSR**; se 0, admin preenche.

## Server Action

`src/lib/actions/payroll.ts` — `upsertPayrollAction`:

```ts
// Após PayrollSchema.safeParse:
const semDsr = data.salario_sem_dsr ?? 0;
const dobra = data.aplica_dobra ?? false;
const baseDerivada = semDsr > 0 ? calcProventosBase(semDsr, dobra) : data.base_salary;

const calcInput: CalcInput = {
  ...input,
  base_salary: baseDerivada,
  salario_sem_dsr: semDsr,
  aplica_dobra: dobra
};

const computed = calcAll(calcInput, brackets, { manualInss, manualIr });

// Upsert:
supabase.from("payroll").upsert({
  ...existing fields,
  salario_sem_dsr: semDsr,
  aplica_dobra: dobra,
  base_salary: baseDerivada,
  total_earnings, total_deductions, net_amount, inss, ir
});
```

## generateMonthAction update

Cada employee:
1. Pega último payroll prior (já existe lógica)
2. Herda:
   - `salario_sem_dsr`: `prevPayroll.salario_sem_dsr ?? employee.salario_sem_dsr ?? 0`
   - `aplica_dobra`: `prevPayroll.aplica_dobra ?? employee.aplica_dobra ?? false`
   - `base_salary`: derivado se s/DSR > 0, senão `prevPayroll.base_salary ?? 0`
3. Insert payroll com todos campos

Mesma lógica para `syncNewEmployeesAction`.

## Data Layer

`src/lib/data/rh.ts` — `Employee` type adiciona:
```ts
salario_sem_dsr: number | null;
aplica_dobra: boolean | null;
```

Query select string inclui as novas colunas em `listEmployees`, `getEmployeeById`.

`src/lib/data/payroll.ts` — `PayrollRow` type adiciona:
```ts
salario_sem_dsr: number | null;
aplica_dobra: boolean | null;
```

Query select inclui novas colunas. `getPayrollByEmployeeMonth` join `employees(... salario_sem_dsr, aplica_dobra)`.

## Tratamento

- s/DSR negativo bloqueado por Zod `min(0)`
- s/DSR = 0 com `aplica_dobra=true`: matemática gera base 0, dobra ainda 0. OK comportamento (legacy mode).
- Payroll antigo (s/DSR null): form abre com 0, admin escolhe migrar ou continuar legacy

## Testes manuais

- [ ] Migration aplicada, 4 colunas novas (2 em employees, 2 em payroll)
- [ ] Cadastrar funcionário Ana Flávia com s/DSR=2304.75 + dobra=true
- [ ] Generate mês → cria payroll com base_salary=5531.40 derivado
- [ ] Form individual mostra DSR=460.95, base=2765.70, total base=5531.40
- [ ] INSS ≈ 583.99, IR ≈ 451.81, líquido ≈ 4495.60
- [ ] Editar s/DSR no form → DSR, base, total base recalculam live
- [ ] Toggle dobra → total base muda live (× 2 ou ÷ 2)
- [ ] Salvar → reload mostra valores persistidos
- [ ] Funcionário sem s/DSR cadastrado: payroll abre com 0, modo legacy
- [ ] generateMonth respeita s/DSR + dobra herdados

## Decisões

| Decisão | Razão |
|---------|-------|
| DSR = s/DSR × 1/5 | Lei 605/1949 (5 dias úteis + 1 DSR sobre 6 dias trabalho) |
| Tabela INSS/IR oficial 2026 | Acuracidade legal (decisão usuário) |
| `base_salary` mantido como derivado | Compatibilidade com holerite/exports/legacy |
| Override mensal em payroll | Permite ajuste pontual sem alterar contrato |
| Sem coluna na lista mensal | Mantém compactness; detalhe no form |
| Holerite sem breakdown DSR | Cliente final vê valor consolidado (igual planilha legada) |

## Próximos passos

1. Aprovar spec
2. writing-plans → plan
3. Execute
