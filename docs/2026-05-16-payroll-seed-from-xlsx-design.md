# Seed Payroll a partir de XLSX

**Data:** 2026-05-16
**Tipo:** Script one-shot
**Status:** Spec aprovada

## Objetivo

Extrair valores de Adicional, INSS, IR, SIND/Empréstimo, Adiantamento, Deduções e Família-Salário das planilhas de folha de pagamento em `public/` e atualizar **todas** as linhas existentes da tabela `payroll` (todos os meses) por funcionário, casando por nome. Serve como seed completo para as próximas folhas de pagamento.

## Entradas

- `public/04º F. pg 2026 (Escola Pinguinho ).xlsx`
- `public/04ºF. pg 2026 (Colegio Integrado).xlsx`

Abas relevantes: todas **exceto** as que casam `/desconto/i` (ex: `DESCONTOS`). As demais (`PROFESSORES`, `ADMINISTRATIVO`, `ENSINO MÉDIO`, etc.) seguem o mesmo padrão de headers com pequenas variações no nome das colunas.

## Decisões

| Tópico | Decisão |
|---|---|
| `reference_month` | Ignorado. Update aplica-se a todas as linhas existentes do funcionário. |
| Criação de linhas | Não. Apenas UPDATE. Funcionário sem linha em `payroll` é logado como warning. |
| `Salário dobra` | Ignorado. Já tratado via boolean `aplica_dobra` no fluxo existente. Sem coluna numérica. |
| Nomes não-encontrados | Log + skip. Sem abort. |
| Nomes ambíguos (mais de um match) | Log + skip. |
| Campos não tocados | `base_salary`, `total_earnings`, `net_amount`, `consider_decimo_terceiro`, `considera_um_tercio_ferias`, `observations`, `uniform_value`. |

## Mapeamento de colunas

| Header planilha (variações) | Coluna `payroll` |
|---|---|
| `Adicional` | `additional` |
| `INSS` | `inss` |
| `IR` | `ir` |
| `SIND`, `emprestimo`, `emprest` | `loan_deduction` |
| `ADIANT`, `ADIANT.` | `advance` |
| `Deduções`, `Deducoes` | `total_deductions` |
| `Família`, `Familia` | `family_allowance` |
| `Funcionários`, `Funcionarios`, `FUNCIONÁRIOS` | (chave: nome) |

Match de header é **case e diacritic insensitive** via `normalize("NFD").replace(/[̀-ͯ]/g,"").toUpperCase().trim()`.

## Arquitetura

Script Node standalone único: `scripts/seed_payroll_from_xlsx.mjs`.

```
xlsx files → parsePayrollExtended → matchByName → UPDATE payroll → log file
```

### Dependências

- `exceljs` (já no projeto)
- `@supabase/supabase-js` (já no projeto, ver `scripts/seed-admin.mjs`)
- `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` em `.env.local`

Sem novas deps. Sem migration. Sem mudança em código de aplicação.

## Algoritmo

### 1. Parse de cada xlsx

Para cada worksheet:

1. Se `ws.name` casa `/desconto/i` → skip aba.
2. Scan das primeiras 20 linhas para detectar a linha de header. Header é a primeira linha que contém ao menos a célula `FUNCIONÁRIOS` e uma das células de pagamento (`ADICIONAL` ou `INSS` ou `TOTAL`).
3. Mapear índice de coluna para cada header conhecido. Headers ausentes → coluna fica como `null` (campo vira `0` no update).
4. A partir de `headerRow + 1`, iterar até `ws.rowCount`:
   - Extrair nome via `cellText`. Se vazio, numérico puro, ou sem coluna nome → skip linha.
   - Para cada coluna mapeada, extrair valor via `cellNumber` (resolve fórmulas via `.result`; null vira 0).
   - Empilhar registro `{ file, sheet, nome, additional, inss, ir, loan_deduction, advance, total_deductions, family_allowance }`.

### 2. Carregar funcionários

```ts
const { data } = await supabase.from("employees").select("id, name");
```

Construir `Map<normalizedName, string[]>` (array de ids para detectar ambiguidade).

`normalizeName(s)`: `s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/\s+/g," ").trim()`.

### 3. Match + Update

Para cada registro parseado:

- `key = normalizeName(record.nome)`
- ids = `employeeMap.get(key) ?? []`
- 0 ids → log `NOT_FOUND`, skip.
- ≥2 ids → log `AMBIGUOUS`, skip.
- 1 id → executar:

```sql
UPDATE payroll
SET additional = $1,
    inss = $2,
    ir = $3,
    loan_deduction = $4,
    advance = $5,
    total_deductions = $6,
    family_allowance = $7,
    updated_at = now()
WHERE employee_id = $8
```

Via Supabase client:

```ts
const { data, error } = await supabase
  .from("payroll")
  .update({ additional, inss, ir, loan_deduction, advance, total_deductions, family_allowance })
  .eq("employee_id", employeeId)
  .select("id");
```

`data.length` = quantidade de linhas atualizadas (todos os meses do funcionário).

- 0 linhas → log warning (funcionário existe mas não tem registros em `payroll`).
- ≥1 → log success com contagem.
- Erro Supabase → log `ERROR`, continua próximo.

### 4. Log

Arquivo: `scripts/payroll_seed_log.txt` (sobrescreve a cada run).

Formato:

```
[ISO_TIMESTAMP] START
FILE: <basename>
  SHEET: <nome>
    MATCHED: "<nome_db>" <- "<nome_planilha>" → updated N rows
    NOT_FOUND: "<nome_planilha>"
    AMBIGUOUS: "<nome_planilha>" → ids=[...]
    WARNING: "<nome_db>" matched but 0 payroll rows
    ERROR: "<nome_planilha>": <message>
SUMMARY:
  filesProcessed=2
  rowsParsed=N
  matched=N
  notFound=N
  ambiguous=N
  warnings=N
  errors=N
  payrollRowsUpdated=N
[ISO_TIMESTAMP] DONE
```

## Tratamento de erros

| Cenário | Comportamento |
|---|---|
| Arquivo xlsx ausente | Abort com `console.error` e exit 1 |
| `SUPABASE_URL` ou key ausente | Abort com mensagem clara |
| Falha de conexão / select employees | Abort |
| Update individual falha | Log `ERROR`, continua |
| Aba sem header reconhecível | Skip aba, log `SHEET_SKIPPED: <name> (no header)` |
| Nome planilha vazio em linha | Skip linha silenciosamente |

## Execução

```
node scripts/seed_payroll_from_xlsx.mjs
```

Sem args. Paths hardcoded. Idempotente: rodar 2x produz mesmo estado final.

## Isolamento

- **Único arquivo.** Sem impacto em código de app.
- **Apenas UPDATE.** Sem INSERT, sem DELETE.
- **Sem schema change.** Sem migration.
- **Sem mexer em UI.** Fluxo `payroll_import_cache` existente intocado.

## Critério de sucesso

1. Script roda sem erros fatais.
2. `payroll_seed_log.txt` lista contagens coerentes.
3. Spot-check: para 3 funcionários conhecidos das planilhas, valores em `payroll` batem com os das planilhas após o run.
4. `total_earnings`, `base_salary`, `net_amount` permanecem inalterados (não estão no SET).

## Fora de escopo

- Recalcular `net_amount` ou `total_deductions` a partir dos campos atualizados.
- Importar `Salário dobra` numérico.
- Importar coluna `desconsiderar` / `1/3 férias` / `decênio`.
- UI / preview / confirmação interativa.
- Backup automático antes do update (usuário roda `pg_dump` por conta se quiser).
