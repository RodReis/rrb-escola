# Alunos sem valor de matrícula — Design

**Data:** 2026-05-22
**Status:** Aprovado para implementação

## Objetivo

Dar ao financeiro uma tela para tomar decisões melhores: listar, em uma grid,
os alunos com matrícula ativa que **não geram receita normal de matrícula** —
seja por cadastro incompleto (sem plano / valor zerado), seja por serem
bolsistas, permuta ou gratuitos.

A tela entra no menu **Financeiro** da topbar.

## Contexto do modelo de dados

Achados da exploração que moldam o design:

- `matriculas` **não tem** coluna de valor. O valor da matrícula vem do plano
  vinculado: `matriculas.plano_id` → `planos.valor_matricula`.
- Bolsa é representada por `matriculas.tipo_vaga`
  (`paga` | `bolsa_integral` | `bolsa_parcial` | `permuta` | `gratuita`)
  + `matriculas.percentual_bolsa` (migration `202605280003_tipo_vaga.sql`).
- Responsáveis ficam em `responsaveis_aluno` (nome, telefone, celular,
  parentesco, `responsavel_financeiro`).
- Série/turma: `matriculas.turma_id` → `turmas` → `turmas.serie_id` → `series`
  (`series.ordem` define ordenação).

## Decisões

| Tema | Decisão |
|---|---|
| "Sem valor de matrícula" | `plano_id` é NULL **OU** `planos.valor_matricula` é 0/NULL |
| Quais bolsistas | `tipo_vaga` ≠ `paga` (integral, parcial, permuta, gratuita) |
| Combinação das condições | Uma única grid com coluna **Motivo** |
| Escopo de alunos | Matrículas `status='ativa'` e `ano_letivo=2026` |
| Filtros | Busca por nome + filtro por motivo + filtro por série/turma |
| Exportação | Excel (`exceljs`) |
| Permissão RBAC | Reusar `relatorios` (sem migration) |
| Abordagem da query | Função de dados em TS + filtro em JS (sem migration/view/RPC) |

## Arquitetura

Abordagem escolhida: **função de dados em `src/lib/data/` + filtro em JS**.
Espelha `getDelinquencyReport` em `src/lib/data/finance.ts`. Sem migration,
sem SQL novo, lógica testável em TypeScript. Volume pequeno (centenas de
alunos) torna o filtro em JS barato.

### Arquivos novos

| Arquivo | Papel |
|---|---|
| `src/lib/data/alunos-sem-valor.ts` | `getAlunosSemValor(filters)` — query Supabase + filtro/derivação em JS. Exporta tipos `AlunoSemValorRow`, `AlunosSemValorFilters`, `MotivoSemValor`. |
| `src/app/(app)/financeiro/alunos-sem-valor/page.tsx` | Server component. `requirePermission("relatorios","read")`, lê searchParams, chama data fn, renderiza. |
| `src/components/finance/alunos-sem-valor-filters.tsx` | Client component — busca nome + dropdowns motivo/série/turma. |
| `src/components/finance/export-alunos-sem-valor-button.tsx` | Client component — exporta Excel via `exceljs`. |

### Arquivo modificado

| Arquivo | Mudança |
|---|---|
| `src/components/layout/topbar.tsx` | +1 item em `FINANCEIRO_ITEMS`: `{ href: "/financeiro/alunos-sem-valor", label: "Alunos sem valor", iconName: "AlertTriangle" }`. Verificar/registrar `AlertTriangle` em `dropdown-icons.ts`. |

## Camada de dados — `getAlunosSemValor`

### Query base (Supabase, service client)

```
matriculas
  select: id, tipo_vaga, percentual_bolsa, plano_id
  filtro: ano_letivo = 2026, status = 'ativa'
  join alunos!inner (id, nome)
  join planos (valor_matricula)        -- nullable: plano_id pode ser NULL
  join turmas!inner (id, nome, serie_id, series!inner(id, nome, ordem))
  join responsaveis_aluno (nome, telefone, celular, parentesco,
                           responsavel_financeiro)
```

### Regra de inclusão (filtro em JS)

Uma matrícula entra na grid se **qualquer** condição for verdadeira:

- **sem valor:** `plano_id` é NULL **OU** `planos.valor_matricula` é NULL ou 0
- **não-pagante:** `tipo_vaga !== 'paga'`

### Derivação do Motivo

`MotivoSemValor = 'sem_valor' | 'bolsa_integral' | 'bolsa_parcial' | 'permuta' | 'gratuita'`

Precedência quando uma matrícula casa nas duas condições (ex.: bolsista E sem
plano): **`tipo_vaga` vence**. Bolsista sem plano é esperado, não erro de
cadastro. Logo:

- Se `tipo_vaga !== 'paga'` → motivo = o próprio `tipo_vaga`.
- Senão (é `paga` mas sem valor) → motivo = `sem_valor`.

### `AlunoSemValorRow`

| Campo | Origem |
|---|---|
| `matriculaId` | `matriculas.id` |
| `nome` | `alunos.nome` |
| `serie` | `series.nome` |
| `serieOrdem` | `series.ordem` (para ordenação) |
| `turma` | `turmas.nome` |
| `motivo` | enum `MotivoSemValor` derivado acima |
| `valorMatricula` | `planos.valor_matricula ?? 0` |
| `responsaveis` | lista de `{ nome, parentesco, telefone }` |

`responsaveis`: ordena `responsavel_financeiro` primeiro. `telefone` por
responsável = `celular || telefone` (padrão do projeto, ref. commit
`310dc6ca`). Aluno sem nenhum responsável → lista vazia (UI mostra "—").

### Filtros (`AlunosSemValorFilters`)

| Filtro | Aplicação |
|---|---|
| `nome` | `ilike` na query Supabase |
| `motivo` | pós-derivação, em JS (depende do Motivo já calculado) |
| `serieId` / `turmaId` | na query Supabase |

### Ordenação

`serieOrdem` ascendente → `nome` ascendente.

## Página — `/financeiro/alunos-sem-valor`

Layout segue o padrão de `relatorios/inadimplencia`: `PageHeader` com KPIs +
componente de filtros + `DataTableShell`.

```
┌─ Financeiro › Alunos sem valor ──────────────────────────┐
│  Alunos sem valor de matrícula          [Exportar XLSX]  │
│  KPIs: Total | Sem valor | Bolsistas | Permuta/Gratuita  │
├──────────────────────────────────────────────────────────┤
│  [Busca nome] [Motivo ▾] [Série ▾] [Turma ▾]            │
├──────────────────────────────────────────────────────────┤
│ Aluno        │Série│Turma│ Motivo      │ Responsáveis    │
│──────────────┼─────┼─────┼─────────────┼─────────────────│
│ RAFAEL ...   │ 1º  │ A   │ 🟡Bolsa int.│ Rafaela (mãe)   │
│              │     │     │             │ 62 99999-9999   │
│ JOÃO ...     │ 2º  │ B   │ 🔴Sem valor │ Maria (fin.)    │
│              │     │     │             │ 62 88888-8888   │
└──────────────────────────────────────────────────────────┘
```

### Colunas da grid

Aluno · Série · Turma · Motivo (`StatusPill` colorido) · Responsáveis
(nome + parentesco + telefone, multi-linha quando há mais de um).

### Motivo → cor do `StatusPill`

| Motivo | Tom | Razão |
|---|---|---|
| `sem_valor` | `danger` (vermelho) | cadastro incompleto, ação necessária |
| `bolsa_integral`, `bolsa_parcial` | `warning` (amarelo) | bolsista |
| `permuta`, `gratuita` | `neutral` (cinza) | não-pagante por acordo |

### KPIs

Total de linhas · Sem valor · Bolsistas (integral + parcial) ·
Permuta/Gratuita.

### Estado vazio

Ícone + texto "Nenhum aluno sem valor encontrado."

## Exportação Excel

Componente client `export-alunos-sem-valor-button.tsx`, padrão de
`src/components/rh/payroll/export-month-buttons.tsx` (`handleXlsx`).

Formato **achatado** — uma linha por par aluno×responsável (melhor para
planilha). Aluno sem responsável gera uma linha com colunas de responsável
vazias.

Colunas: Aluno · Série · Turma · Motivo · Valor matrícula · Responsável ·
Parentesco · Telefone.

Nome do arquivo: `alunos_sem_valor_2026.xlsx`.

## Tratamento de erros / edge cases

- Aluno sem responsável: grid mostra "—"; export gera linha com colunas de
  responsável vazias.
- `plano_id` NULL: join `planos` retorna null → tratado como sem valor.
- Sem resultados após filtros: estado vazio.
- Acesso sem permissão `relatorios`: `requirePermission` bloqueia (padrão do
  sistema).

## Testes

- Teste unitário de `getAlunosSemValor` cobrindo a regra de inclusão e a
  precedência do Motivo:
  - matrícula `paga` sem plano → `sem_valor`
  - matrícula `paga` com plano `valor_matricula = 0` → `sem_valor`
  - matrícula `paga` com plano `valor_matricula > 0` → **não entra**
  - matrícula `bolsa_integral` com plano válido → `bolsa_integral`
  - matrícula `bolsa_integral` sem plano → `bolsa_integral` (tipo_vaga vence)
  - filtro por motivo, série e nome
- Verificação manual: tela acessível pelo menu Financeiro, KPIs corretos,
  export Excel abre com as colunas esperadas.

## Fora de escopo

- Edição/correção do cadastro a partir desta tela (apenas leitura).
- Export PDF.
- Anos letivos diferentes de 2026 (sem year picker nesta versão).
