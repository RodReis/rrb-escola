# RH Fase 2 — Folha de Pagamento (Design)

**Data:** 2026-05-16
**Status:** Spec aprovada (aguardando review)
**Fase:** 2 de 4 (módulo RH)
**Depende de:** Fase 1 ([2026-05-16-rh-empresas-funcionarios-design.md](./2026-05-16-rh-empresas-funcionarios-design.md))

## Contexto

Fase 2 do módulo RH. Permite lançar payroll mensal por funcionário com cálculo automático INSS/IR (override manual), fechar/reabrir competências, gerar holerite PDF individual, exportar mês consolidado, e gerenciar tabelas progressivas (brackets) via UI.

## Objetivo

Folha de pagamento mensal completa:
- Lista mensal com totais consolidados
- Form individual com cálculo em tempo real (client live calc)
- Cálculo INSS/IR híbrido (auto sugere, admin sobrescreve)
- Fechamento mensal (lock) com possibilidade de reabertura
- Holerite PDF individual + exportação mês (XLSX + PDF consolidado)
- Configuração de brackets INSS/IR via UI admin

## Escopo

**Inclui:**
- 3 migrations: brackets tables, payroll_periods, payroll extra columns
- Lista mensal `/rh/folha/[mes]` com filtros + KPIs
- Form individual `/rh/folha/[mes]/[employee_id]` com live calc
- Generate month action (copia base do mês anterior)
- Close/reopen period actions
- Brackets admin `/rh/brackets`
- Calculators puros (INSS, IR, totais)
- Holerite PDF individual
- Exportação mês XLSX + PDF tabular

**Não inclui:**
- FGTS automation (só informativo no PDF)
- Folha 13º separada (campo `consider_decimo_terceiro` boolean apenas marca, sem cálculo dedicado nesta fase)
- Provisões férias (`considera_um_tercio_ferias` marca, cálculo separado fase futura)
- Auditoria de alterações
- Reabertura aprovada por workflow

## Migrations

Arquivo: `supabase/migrations/202605240001_payroll_v2.sql`

```sql
-- INSS progressive brackets, vigência configurável
create table if not exists public.inss_brackets (
  id uuid primary key default gen_random_uuid(),
  vigencia_inicio date not null,
  ordem int not null,
  valor_de numeric(10,2) not null,
  valor_ate numeric(10,2),
  aliquota numeric(5,4) not null,
  parcela_deduzir numeric(10,2) not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (vigencia_inicio, ordem)
);

create index if not exists idx_inss_brackets_vigencia on public.inss_brackets (vigencia_inicio desc);

-- IRRF progressive brackets
create table if not exists public.ir_brackets (
  id uuid primary key default gen_random_uuid(),
  vigencia_inicio date not null,
  ordem int not null,
  valor_de numeric(10,2) not null,
  valor_ate numeric(10,2),
  aliquota numeric(5,4) not null,
  parcela_deduzir numeric(10,2) not null default 0,
  deducao_dependente numeric(10,2) default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (vigencia_inicio, ordem)
);

create index if not exists idx_ir_brackets_vigencia on public.ir_brackets (vigencia_inicio desc);

-- payroll periods (status lock by month)
create table if not exists public.payroll_periods (
  id uuid primary key default gen_random_uuid(),
  reference_month date not null unique,
  status text not null default 'aberto' check (status in ('aberto','fechado')),
  closed_at timestamptz,
  closed_by uuid references auth.users(id),
  created_at timestamptz default now()
);

create index if not exists idx_payroll_periods_status on public.payroll_periods (status);

-- payroll extra columns (proventos + descontos breakdown + manual flags)
alter table public.payroll
  add column if not exists horas_extras numeric(10,2) default 0,
  add column if not exists gratificacao numeric(10,2) default 0,
  add column if not exists comissao numeric(10,2) default 0,
  add column if not exists adicional_noturno numeric(10,2) default 0,
  add column if not exists periculosidade numeric(10,2) default 0,
  add column if not exists insalubridade numeric(10,2) default 0,
  add column if not exists outros_proventos numeric(10,2) default 0,
  add column if not exists vale_transporte numeric(10,2) default 0,
  add column if not exists vale_alimentacao numeric(10,2) default 0,
  add column if not exists outros_descontos numeric(10,2) default 0,
  add column if not exists dependentes int default 0,
  add column if not exists inss_manual boolean default false,
  add column if not exists ir_manual boolean default false;

create index if not exists idx_payroll_reference_month on public.payroll (reference_month);

-- triggers updated_at
drop trigger if exists inss_brackets_updated_at on public.inss_brackets;
create trigger inss_brackets_updated_at before update on public.inss_brackets
for each row execute function public.set_updated_at();

drop trigger if exists ir_brackets_updated_at on public.ir_brackets;
create trigger ir_brackets_updated_at before update on public.ir_brackets
for each row execute function public.set_updated_at();
```

**Seed brackets iniciais** (executar via SQL após migration):

INSS 2026:
| Ordem | De | Até | Alíquota | Parc.deduzir |
|-------|----|----|----------|--------------|
| 1 | 0 | 1518,00 | 0,075 | 0 |
| 2 | 1518,01 | 2793,88 | 0,09 | 22,77 |
| 3 | 2793,89 | 4190,83 | 0,12 | 106,59 |
| 4 | 4190,84 | 8157,41 | 0,14 | 190,40 |

IR 2026:
| Ordem | De | Até | Alíquota | Parc.deduzir | Ded.Dep |
|-------|----|----|----------|--------------|---------|
| 1 | 0 | 2428,80 | 0 | 0 | 189,59 |
| 2 | 2428,81 | 2826,65 | 0,075 | 182,16 | 189,59 |
| 3 | 2826,66 | 3751,05 | 0,15 | 394,16 | 189,59 |
| 4 | 3751,06 | 4664,68 | 0,225 | 675,49 | 189,59 |
| 5 | 4664,69 | NULL | 0,275 | 908,73 | 189,59 |

Vigência seed: `2026-01-01`.

## Estrutura

### Rotas (`src/app/(app)/rh/`)
```
folha/
  page.tsx                          redirect /rh/folha/{currentMonth}
  [mes]/page.tsx                    lista mensal
  [mes]/[employee_id]/page.tsx      form individual
brackets/
  page.tsx                          admin INSS + IR
```

### Data (`src/lib/data/payroll.ts`)
```ts
listPayrollByMonth(mes: string, filters?): PayrollRowJoined[]
getPayrollByEmployeeMonth(employeeId, mes): PayrollRow | null
getPayrollPeriod(mes): PayrollPeriod   // ensures row exists with status default aberto
getBracketsForMonth(mes: string): { inss: InssBracket[]; ir: IrBracket[] }
listBracketVigencias(table: 'inss' | 'ir'): { vigencia_inicio: string }[]
getMonthSummary(mes): MonthSummary    // total_proventos, total_descontos, total_liquido, count, inss_total, ir_total
listEmployeesNeedingPayroll(mes): Employee[]  // ativos sem linha payroll p/ mês
```

### Actions (`src/lib/actions/payroll.ts`)
```ts
generateMonthAction(formData)        // formData: mes
syncNewEmployeesAction(formData)     // adiciona linhas p/ ativos sem payroll
upsertPayrollAction(formData)
closePeriodAction(formData)
reopenPeriodAction(formData)
createBracketVigenciaAction(formData)  // table, vigencia_inicio, copyFrom?
upsertBracketAction(formData)
deleteBracketAction(formData)
deleteVigenciaAction(formData)
```

### Validation (`src/lib/validation/payroll.ts`)
```ts
PayrollSchema = z.object({
  employee_id: z.string().uuid(),
  reference_month: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  base_salary: numericNonNeg,
  horas_extras: numericNonNeg,
  gratificacao: numericNonNeg,
  comissao: numericNonNeg,
  adicional_noturno: numericNonNeg,
  periculosidade: numericNonNeg,
  insalubridade: numericNonNeg,
  outros_proventos: numericNonNeg,
  family_allowance: numericNonNeg,
  vale_transporte: numericNonNeg,
  vale_alimentacao: numericNonNeg,
  outros_descontos: numericNonNeg,
  loan_deduction: numericNonNeg,
  advance: numericNonNeg,
  uniform_value: numericNonNeg,
  dependentes: z.number().int().min(0).default(0),
  consider_decimo_terceiro: z.boolean().optional(),
  considera_um_tercio_ferias: z.boolean().optional(),
  inss_manual: z.boolean().optional(),
  ir_manual: z.boolean().optional(),
  inss: numericNonNeg.optional(),
  ir: numericNonNeg.optional(),
  observations: z.string().optional()
});

BracketSchema = z.object({
  table: z.enum(['inss','ir']),
  vigencia_inicio: dateString,
  ordem: z.number().int().min(1),
  valor_de: numericNonNeg,
  valor_ate: numericNonNeg.optional(),
  aliquota: z.number().min(0).max(1),
  parcela_deduzir: numericNonNeg.default(0),
  deducao_dependente: numericNonNeg.optional()
});
```

### Calculators (`src/lib/payroll/calculators.ts`)
Pure functions, no DB. Usadas por client (live calc) e server (validate before persist).

```ts
calcINSS(base: number, brackets: InssBracket[]): number
calcIR(baseAfterInss: number, dependentes: number, brackets: IrBracket[]): number
calcTotalEarnings(input: PayrollInput): number
calcTotalDeductions(input: PayrollInput): number
calcNetAmount(input: PayrollInput): number
calcAll(input: PayrollInput, brackets, opts: { useManualInss?: boolean; useManualIr?: boolean }): ComputedPayroll
```

INSS algorithm: progressive by faixa (faixaSize × aliquota), cap = última `valor_ate`.

IR algorithm: `baseFinal = base + adicionais − INSS − (dependentes × deducao_dependente)`. Find first bracket where `baseFinal ≤ valor_ate`, return `max(0, baseFinal × aliquota − parcela_deduzir)`.

### Components (`src/components/rh/payroll/`)
```
payroll-row-form.tsx       client, live calc, 3 cards (proventos/descontos/resumo)
payroll-month-table.tsx    server, lista mês
payroll-summary-card.tsx   totais consolidados topo
holerite-pdf-button.tsx    client, jspdf gera holerite
month-nav.tsx              client, [< prev] [mês ▾] [next >]
generate-month-button.tsx  client, confirm dialog + dispatch
close-period-button.tsx    client, confirm dialog + dispatch
brackets-form.tsx          admin form criar/editar faixa
brackets-table.tsx         tabela editável faixas vigência selecionada
```

### Auth
- Pages `/rh/folha/**` GET → `requirePerfil(['admin','financeiro'])`
- Actions edit → `requirePerfil(['admin','financeiro'])`
- Actions close/reopen → `requirePerfil(['admin'])`
- `/rh/brackets/**` → `requirePerfil(['admin'])`

### Topbar
Adicionar item em `RhDropdown`:
- Empresas
- Funcionários
- **Folha** (`/rh/folha`)
- **Brackets** (`/rh/brackets`) — só admin (filtra no client por perfil OR sempre exibe, server redirect se não admin)

## UI

### `/rh/folha/[mes]` (lista mensal)

`PageHeader`:
- breadcrumb `RH / Folha / {mes label}`
- title `Folha de pagamento`
- counter mês label italic
- description curta
- actions: month-nav + Gerar folha + Sync novos + Fechar/Reabrir + Exportar XLSX + Exportar PDF mês
- kpis: Proventos, Descontos, Líquido, Funcionários, INSS total, IR total, Status pill

Banner status `fechado` (yellow): "Mês fechado em {data} por {user}".

DataTableShell toolbar: search + filter empresa + filter categoria.

Colunas: Funcionário | Empresa | Base | Adicionais | Proventos | INSS | IR | Outros desc | **Líquido** | Ações (Editar / Holerite).

Empty state: ícone + "Folha não foi gerada" + botão Gerar.

Mismatch state: se há `employeesNeedingPayroll`, banner "{N} funcionários ativos sem lançamento" + botão "Adicionar novos".

### `/rh/folha/[mes]/[employee_id]` (form individual)

`PageHeader`:
- breadcrumb `RH / Folha / {mes} / {nome}`
- title nome funcionário
- counter mês label
- actions: Holerite PDF + Voltar + Salvar (primary)
- kpis **live**: Total proventos, Total descontos, **Líquido** (destaque serif italic brand)

Form 3 cards lado a lado (xl) / stack (sm):

**Card Proventos:** base_salary*, horas_extras, gratificacao, comissao, adicional_noturno, periculosidade, insalubridade, outros_proventos, family_allowance. Subtotal calc live.

**Card Descontos:** INSS (auto, toggle manual), IR (auto, toggle manual), dependentes (recalc IR), loan_deduction, advance, vale_transporte, vale_alimentacao, outros_descontos. Subtotal calc live.

**Card Outros:** consider_decimo_terceiro, considera_um_tercio_ferias, uniform_value, observations, Líquido destaque, botão Recalcular INSS/IR.

Live calc: `calcAll()` invocado on-change. Submit envia tudo, server recalcula com mesma lógica.

Period `fechado`: inputs disabled, banner amarelo, sem botão Salvar.

### `/rh/brackets` (admin)

`PageHeader`: title "Tabelas progressivas" + action Nova vigência.

2 Panels: INSS + IR. Cada um:
- Dropdown seletor vigência (desc)
- Botões editar/excluir vigência (admin)
- Tabela editável faixas

Nova vigência modal: input vigencia_inicio + checkbox "Copiar da última".

Validação:
- Faixas contíguas (`valor_de` próxima = `valor_ate` anterior + 0.01)
- Alíquotas crescentes (warning)
- Última faixa pode ter `valor_ate NULL` (IR sem teto)

## Holerite PDF

Lib: `jspdf` + `jspdf-autotable` (presente no projeto).

Layout 1 página A4:
- Header: logo placeholder + nome empresa + CNPJ + "RECIBO DE PAGAMENTO DE SALÁRIO"
- Dados funcionário: nome, CPF, cargo, categoria, admissão
- Competência mes/ano
- Tabela proventos: Cód | Descrição | Referência | Valor (apenas valores não-zero)
- Tabela descontos: idem
- Totais: total_earnings, total_deductions, **Líquido a receber** destaque
- Footer informativo: Base INSS, Base IR, FGTS mês (8% base, não desconta), assinaturas

Filename: `holerite_{cpf_sem_mascara}_{YYYY-MM}.pdf`

## Generate Month Flow

`generateMonthAction(mes)`:
1. requirePerfil admin/financeiro
2. Ensure `payroll_periods` row exists (cria status aberto se não); se fechado → erro
3. Find prev month (date math)
4. Query employees ativos
5. Para cada employee:
   - Read prev payroll: copia `base_salary`, `dependentes`, `vale_transporte`, `vale_alimentacao` (recurring)
   - Sem prev: zeros
   - Upsert via unique `(employee_id, reference_month)`
6. revalidatePath + redirect com flash

`syncNewEmployeesAction(mes)`:
- Adiciona linha SÓ p/ employees ativos sem payroll naquele mês
- Não modifica existentes

## Permissões

| Operação | Admin | Financeiro | Secretaria | Outros |
|----------|-------|------------|------------|--------|
| Ver folha | ✅ | ✅ | ❌ | ❌ |
| Gerar/sync mês | ✅ | ✅ | ❌ | ❌ |
| Editar payroll | ✅ | ✅ | ❌ | ❌ |
| Fechar/reabrir | ✅ | ❌ | ❌ | ❌ |
| Brackets CRUD | ✅ | ❌ | ❌ | ❌ |
| Holerite PDF | ✅ | ✅ | ❌ | ❌ |

## Tratamento erros

- Edit em mês fechado → flash "Período fechado. Reabra antes de editar."
- Gerar em mês fechado → flash
- Brackets sem vigência p/ mês → fallback vigência mais antiga + warning banner
- Validação Zod falha → flash erro primeiro issue
- Constraint unique payroll → "Lançamento já existe para este funcionário no mês"
- Brackets faixas com gap → erro validation server

## Empty/edge states

- Mês vazio → empty state + Gerar
- Employees ativos sem payroll → banner sync
- Employee desativado durante mês → mantém linha, badge "Inativo"
- Sem brackets → erro tela brackets "Cadastre vigência inicial"

## Decisões/justificativas

| Decisão | Razão |
|---------|-------|
| Live calc client + server recalc | Feedback UX imediato sem perder validação |
| Brackets em DB editáveis | Permite atualizar tabelas oficiais sem deploy |
| Lock por período (não por linha) | Simplifica permissão; mês fechado = imutável |
| Drill page individual | Folha tem ~15 campos por funcionário; inline editing seria caótico |
| Holerite PDF inline jspdf | Já no projeto, sem nova dep |
| Snapshot company via payroll → employee → companies join | Não precisa coluna histórica company_id em payroll (FK já em employees) |
| Vigência inicio date (não datetime) | Brackets vigem por mês inteiro |
| `inss_manual`/`ir_manual` flags | Permite override mantendo recálculo automático ao reset |

## Testes manuais (smoke)

- [ ] Migration aplicada, 3 novas tabelas + colunas payroll
- [ ] Seed brackets 2026 cria INSS (4 faixas) + IR (5 faixas)
- [ ] `/rh/folha` redireciona mês atual
- [ ] Mês vazio: banner Gerar; click gera 64 linhas
- [ ] Sync novos: cria só p/ funcionário novo após geração
- [ ] Form individual: digitar base_salary recalcula INSS+IR+totais live
- [ ] Toggle manual INSS: server respeita valor enviado
- [ ] Reset INSS auto: recalcula via bracket
- [ ] Salvar persiste; reload mostra valores
- [ ] Fechar mês: inputs disabled, Salvar oculto
- [ ] Reabrir: edição volta
- [ ] Financeiro consegue editar; secretaria 403
- [ ] Brackets admin: criar vigência, editar faixa, validar continuidade
- [ ] Holerite PDF gera arquivo com layout correto
- [ ] Exportar XLSX mês baixa planilha
- [ ] KPIs topo refletem soma correta

## Próximos passos

1. Aprovar spec
2. Gerar implementation plan via writing-plans
3. Executar via subagent-driven-development (ou inline)
