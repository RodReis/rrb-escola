# Payroll: Desconto GPS

**Data:** 2026-05-16
**Tipo:** Feature
**Status:** Spec aprovada

## Objetivo

Adicionar campo de desconto **GPS** (Guia da Previdência Social) na folha de pagamento, com valor padrão por funcionário e override mensal.

## Decisões

| Tópico | Decisão |
|---|---|
| Natureza | Campo simples de desconto (input numérico, soma em `total_deductions`) |
| Default | Herdado de `employees.gps_default` quando `payroll.gps` for null |
| Posição UI | Painel Descontos, logo após "Adiantamento" |
| Cálculo | Sem cálculo automático; entrada manual |
| Importação xlsx | Fora do escopo (planilha não tem coluna GPS) |

## Schema

Migration `supabase/migrations/202605250001_payroll_gps.sql`:

```sql
alter table public.employees
  add column if not exists gps_default numeric(10,2) default 0;

alter table public.payroll
  add column if not exists gps numeric(10,2);
```

- `employees.gps_default`: default `0`, NOT NULL via default.
- `payroll.gps`: nullable. `null` = herda `gps_default` do employee.

## Calculadora

`src/lib/payroll/calculators.ts`:

- `PayrollInput` ganha `gps: number`.
- `calcTotalDeductions(input)` soma `gps` junto com `loan_deduction`, `advance`, `vale_transporte`, `vale_alimentacao`, `outros_descontos`, `uniform_value`.

## Form payroll

`src/components/rh/payroll/payroll-row-form.tsx`:

- `FormState` ganha `gps: number`.
- Init: `gps: num(row.gps ?? row.employees?.gps_default ?? 0)`.
- `<NumberField label="GPS" name="gps" value={state.gps} onChange={setNum("gps")} disabled={disabled} />` inserido **após** Adiantamento e **antes** de Vale transporte.
- Passa `gps` em `calcInput`.

## Form employee

`src/components/rh/employee-form.tsx`:

- Campo `gps_default` (input numérico, default 0), salvo em `employees.gps_default`.
- Posição: próximo a `salario_sem_dsr` / `aplica_dobra`.

## Data layer

- `PayrollRowJoined` (em `src/lib/data/payroll.ts`) ganha `gps`, e `employees.gps_default` no join.
- `select` puxa `gps` da `payroll` e `gps_default` da `employees`.
- `upsertPayrollAction` (`src/lib/actions/payroll.ts`) aceita `gps` no payload.
- Validação Zod em `src/lib/validation/payroll.ts` adiciona `gps: z.number().min(0).optional()`.
- Action de employee (`src/lib/actions/rh.ts`) aceita `gps_default`.

## Critério de sucesso

1. Migration aplica sem erro.
2. Form payroll mostra campo GPS após Adiantamento, valor inicial herdado de `employees.gps_default` quando `payroll.gps` é null.
3. Editar GPS no form e salvar persiste em `payroll.gps`.
4. `total_deductions` reflete soma incluindo GPS.
5. Form employee permite definir `gps_default`.
6. Linhas `payroll` existentes (gps=null) continuam funcionando, herdando default 0.

## Fora de escopo

- Cálculo automático de GPS (alíquota, base).
- Importação de GPS via xlsx.
- Histórico/auditoria de mudanças de `gps_default`.
- Geração de boleto/guia.
