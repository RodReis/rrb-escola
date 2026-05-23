# Aba "Alunos com desconto" — Design

**Data:** 2026-05-22
**Status:** Aprovado para implementação
**Depende de:** [2026-05-22-alunos-sem-valor-matricula-design.md](2026-05-22-alunos-sem-valor-matricula-design.md) e [2026-05-22-alunos-sem-valor-editar-matricula-design.md](2026-05-22-alunos-sem-valor-editar-matricula-design.md) (features já implementadas)

## Objetivo

Adicionar à tela `/financeiro/alunos-sem-valor` uma segunda visão, "Alunos com
desconto", que lista alunos que pagam **abaixo** do valor praticado oficial —
seja porque o plano tem mensalidade menor, seja porque a matrícula é
`bolsa_parcial`. A página passa a ter duas abas: "Sem valor" (atual) e "Com
desconto" (novo).

Alunos que pagam o valor oficial de irmão (2º ou 3º filho) **não entram** —
isso é preço oficial, não desconto.

## Contexto do modelo de dados

- `valores_praticados(ano_letivo, segmento, ordem_filho)` — tabela de
  referência. `ordem_filho` 1 = valor cheio; 2 e 3 = preço oficial menor para
  irmãos. Segmentos: `INFANTIL`, `FUNDAMENTAL1`, `FUNDAMENTAL2`, `MEDIO`.
- `series.segmento` indica o segmento da série (migration
  `202605200001_serie_segmento.sql`).
- `matriculas.plano_id` → `planos.valor_mensalidade` é o valor que a matrícula
  cobra de fato.
- `matriculas.tipo_vaga` pode ser `bolsa_parcial` com `percentual_bolsa`
  entre 1 e 99 — desconto formal sobre o valor do plano.
- `bolsa_integral`, `permuta` e `gratuita` já aparecem na aba "Sem valor" —
  não entram aqui.

## Decisões

| Tema | Decisão |
|---|---|
| Quem é "com desconto" | Matrícula ativa 2026 onde `plano.valor_mensalidade < min(valores_praticados.valor_mensalidade do segmento, qualquer ordem_filho)` **OU** `tipo_vaga = bolsa_parcial` |
| Excluir preço oficial de irmão | Se `plano.valor_mensalidade` bate exatamente com algum valor de `ordem_filho` 1/2/3 do segmento → NÃO entra (a menos que seja `bolsa_parcial`, que sempre conta) |
| Tipos de vaga incluídos | `paga` e `bolsa_parcial`. Os outros (integral/permuta/gratuita) vivem na aba "Sem valor". |
| Aluno sem plano | Não entra (já é caso da aba "Sem valor") |
| Layout | Tabs no topo: `[Sem valor] [Com desconto]`. URL `?aba=sem-valor` (default) ou `?aba=com-desconto` |
| % desconto exibido | `percentualDescontoEfetivo = 1 - (valorEfetivo / valorPraticadoCheio)`, combinando plano e bolsa em uma única métrica |
| Origem do desconto | `plano` / `bolsa_parcial` / `plano+bolsa` |
| Escopo | Matrículas `status='ativa'`, `ano_letivo=2026` |
| Filtros | Nome, série, turma (sem "motivo" nesta aba) |
| Permissão | `relatorios` (mesma da página) |
| Exportação | Excel (`exceljs`) |
| Botão Editar | **Não** aparece nesta aba — escopo de edição é só "sem valor" |

## Arquitetura

Função de dados nova em `src/lib/data/`, com função pura
`buildDescontoRow` isolada para testes (mesmo padrão de `bolsistas.ts`,
`alunos-sem-valor-constants.ts`). Sem migration. Cálculo do desconto em JS,
contra um `Map<segmento, valoresPraticados>` carregado em paralelo.

### Arquivos novos

| Arquivo | Papel |
|---|---|
| `src/components/finance/alunos-tabs.tsx` | Tabs `[Sem valor][Com desconto]` ligadas por `?aba=...` (Link-based, espelha `dashboard-tabs.tsx`). |
| `src/lib/data/alunos-com-desconto.ts` | Tipos + função pura `buildDescontoRow` + `getAlunosComDesconto(filters)`. |
| `src/lib/data/alunos-com-desconto.test.ts` | Testes Vitest da função pura (inclusão, exclusão de preço de irmão, origem combinada, %). |
| `src/components/finance/alunos-com-desconto-filters.tsx` | Filtros nome / série / turma (espelha o componente existente, sem campo motivo). |
| `src/components/finance/export-alunos-com-desconto-button.tsx` | Botão "Exportar XLSX" para esta aba. |

### Arquivo modificado

| Arquivo | Mudança |
|---|---|
| `src/app/(app)/financeiro/alunos-sem-valor/page.tsx` | Lê `?aba`. Renderiza tabs no topo. Quando `aba=com-desconto`: chama `getAlunosComDesconto`, troca KPIs / filtros / colunas / export. Botão Editar não aparece nesta aba. |

## Camada de dados — `getAlunosComDesconto`

### Tipos

```typescript
export type OrigemDesconto = "plano" | "bolsa_parcial" | "plano+bolsa";

export type AlunoComDescontoRow = {
  alunoId: string;
  matriculaId: string;
  nome: string;
  serie: string;
  serieId: string;
  serieOrdem: number;
  turma: string;
  turmaId: string;
  segmento: string;
  origem: OrigemDesconto;
  valorPraticadoCheio: number;       // valor_mensalidade ordem_filho=1
  valorMensalidadePlano: number;     // planos.valor_mensalidade
  percentualBolsaParcial: number;    // 0 quando não-aplicável
  percentualDescontoEfetivo: number; // 0..1
  responsavelNome: string | null;
  responsavelParentesco: string | null;
  responsavelTelefone: string | null; // celular || telefone
};

export type AlunosComDescontoFilters = {
  nome: string | null;
  serieId: string | null;
  turmaId: string | null;
};
```

### Query (Supabase, server)

Duas queries em paralelo:

1. **`matriculas`** — status `ativa`, ano_letivo 2026, `tipo_vaga` em
   `paga` ou `bolsa_parcial`. Joins: `alunos!inner(id, nome,
   responsaveis_aluno(nome, parentesco, telefone, celular,
   responsavel_financeiro))`, `series!inner(id, nome, ordem, segmento)`,
   `turmas!inner(id, nome)`, `planos!inner(valor_mensalidade)`.
   `planos!inner` porque sem plano não entra na aba (caso "sem valor"
   é outra aba). Filtro `nome` (ilike via `.or` com `foreignTable:
   "alunos"`) aplicado na query, padrão `getDelinquencyReport`.

2. **`valores_praticados`** — ano_letivo 2026, todos `ordem_filho`. Construir
   `Map<segmento, number[]>` (lista de valores `valor_mensalidade` por
   segmento, ordenada por `ordem_filho`).

### Função pura — `buildDescontoRow`

```typescript
type RawMatricula = {
  id: string;
  tipo_vaga: "paga" | "bolsa_parcial";
  percentual_bolsa: number;
  alunos: { id: string; nome: string; responsaveis_aluno: Array<...> } | null;
  series: { id: string; nome: string; ordem: number; segmento: string | null } | null;
  turmas: { id: string; nome: string } | null;
  planos: { valor_mensalidade: number | null } | null;
};

/**
 * Decide se a matrícula entra como "com desconto" e calcula a linha.
 * Regras:
 * - Sem plano, sem série, sem segmento, ou sem dados de valores_praticados
 *   para o segmento → retorna null.
 * - Se valorPlano bate exatamente com algum valor praticado (qualquer
 *   ordem_filho) E tipo_vaga !== "bolsa_parcial" → preço oficial de filho,
 *   retorna null.
 * - Entra se tipo_vaga === "bolsa_parcial" OU valorPlano < min(valoresSeg).
 * - Origem: combina plano e bolsa.
 * - valorEfetivo = valorPlano * (1 - percentual_bolsa/100) para bolsa_parcial;
 *   senão valorPlano.
 * - percentualDescontoEfetivo = max(0, 1 - valorEfetivo / valorPraticadoCheio).
 */
export function buildDescontoRow(
  raw: RawMatricula,
  valoresSeg: number[],         // [ordem1, ordem2, ordem3] do segmento
): AlunoComDescontoRow | null
```

### Regra de inclusão (precisa)

1. Se `planos?.valor_mensalidade` é null/undefined → null.
2. Se `series?.segmento` é null → null.
3. Se `valoresSeg` está vazio ou não tem `ordem_filho=1` → null.
4. `valorPlano = Number(planos.valor_mensalidade)`.
5. `isBolsaParcial = tipo_vaga === "bolsa_parcial" && percentual_bolsa > 0 && percentual_bolsa < 100`.
6. `bateValorOficial = valoresSeg.some(v => v === valorPlano)`.
7. Se `bateValorOficial && !isBolsaParcial` → null (preço oficial de irmão).
8. `temDescontoPlano = valorPlano < Math.min(...valoresSeg)`.
9. Se `!temDescontoPlano && !isBolsaParcial` → null.
10. Origem:
    - `temDescontoPlano && isBolsaParcial` → `"plano+bolsa"`
    - `temDescontoPlano` → `"plano"`
    - `isBolsaParcial` → `"bolsa_parcial"`
11. `valorEfetivo = isBolsaParcial ? valorPlano * (1 - percentual_bolsa/100) : valorPlano`.
12. `valorPraticadoCheio = valoresSeg[0]` (assumindo `ordem_filho=1` é o
    primeiro na lista — o caller garante a ordenação).
13. `percentualDescontoEfetivo = Math.max(0, 1 - valorEfetivo / valorPraticadoCheio)`.

### Responsáveis

Mesma lógica das outras telas: ordena `responsavel_financeiro` primeiro, pega
o primeiro. `telefone = celular || telefone || ""`. Sem responsável →
`responsavelNome: null`.

### Filtros

- `nome` — ilike na query (padrão).
- `serieId` / `turmaId` — em JS pós-`buildDescontoRow` (consistente com
  `getAlunosSemValor`).

### Ordenação

`serieOrdem` ascendente → `nome` (localeCompare pt-BR).

## Página `/financeiro/alunos-sem-valor` — adaptação

A página passa a despachar entre duas abas.

```typescript
const aba = sp.aba === "com-desconto" ? "com-desconto" : "sem-valor";
```

Para `aba="sem-valor"`: comportamento atual, sem mudanças no comportamento ou
nas colunas/KPIs/permissões.

Para `aba="com-desconto"`:

- Chama `getAlunosComDesconto(filtersDesconto)` em vez de `getAlunosSemValor`.
- Renderiza `<AlunosComDescontoFilters>` (sem campo motivo).
- Renderiza `<ExportAlunosComDescontoButton>` em vez do export atual.
- **Não** renderiza coluna Ações nem `MatriculaEditDialog`.
- KPIs (ver abaixo).
- Grid (ver abaixo).

Componente `<AlunosTabs active={aba} />` renderizado acima do `PageHeader`
ou logo abaixo dele (ver mockup na Seção 3 acima — implementador escolhe
posição que combine com o `PageHeader` existente; padrão atual é tabs logo
após o header).

## KPIs — aba "Com desconto"

| KPI | Valor | Tone |
|---|---|---|
| Total | `rows.length` | default |
| Plano abaixo | linhas com origem `plano` ou `plano+bolsa` | neutral |
| Bolsa parcial | linhas com origem `bolsa_parcial` ou `plano+bolsa` | warning |
| Desconto médio % | média de `percentualDescontoEfetivo`, formatada `12,3%` | default |

## Grid — aba "Com desconto"

| Coluna | Origem |
|---|---|
| Aluno | `nome` |
| Série | `serie` |
| Turma | `turma` |
| Origem | `StatusPill` colorido conforme tabela abaixo |
| % desconto | `percentualDescontoEfetivo` formatado `-12,3%` (sinal negativo, 1 decimal) |
| Responsável | nome + (parentesco) + · telefone — mesmo padrão da aba sem valor |

Origem → cor do `StatusPill`:

| Origem | Tone |
|---|---|
| `plano` | `neutral` |
| `bolsa_parcial` | `warning` |
| `plano+bolsa` | `danger` |

Estado vazio: `Panel` com ícone + "Nenhum aluno com desconto encontrado."
(reusar ícone `BadgePercent` ou `AlertTriangle` já registrado).

## Export Excel

Componente `ExportAlunosComDescontoButton`, espelha
`export-month-buttons.tsx` (`handleXlsx`). Achatado — uma linha por
aluno×responsável (mesma decisão da aba sem valor). Aluno sem responsável →
linha com colunas de responsável vazias.

Colunas:

| Header | Origem |
|---|---|
| Aluno | `nome` |
| Série | `serie` |
| Turma | `turma` |
| Segmento | `segmento` |
| Origem do desconto | "Plano" / "Bolsa parcial" / "Plano + Bolsa parcial" |
| Valor praticado (cheio) | `valorPraticadoCheio`, formato R$ |
| Valor mensalidade plano | `valorMensalidadePlano`, formato R$ |
| % bolsa parcial | `percentualBolsaParcial`, formato %, 0 quando N/A |
| % desconto efetivo | `percentualDescontoEfetivo`, formato % |
| Responsável | nome |
| Parentesco | string |
| Telefone | `celular || telefone` |

Nome do arquivo: `alunos_com_desconto_2026.xlsx`.

## Testes

`src/lib/data/alunos-com-desconto.test.ts` — função pura `buildDescontoRow`:

- Plano com valor cheio + `paga` → null (sem desconto).
- Plano com valor de `ordem_filho=2` + `paga` → null (preço oficial irmão).
- Plano com valor de `ordem_filho=3` + `paga` → null.
- Plano com `valor_mensalidade` abaixo do menor irmão + `paga` →
  origem `plano`, % calculado.
- `bolsa_parcial` 50% com plano cheio → origem `bolsa_parcial`, % efetivo
  ≈ 50%.
- `bolsa_parcial` 30% com plano abaixo do menor irmão → origem
  `plano+bolsa`, % efetivo combina os dois.
- Sem plano → null.
- Sem segmento na série → null.
- `valoresSeg` vazio → null.

Verificação manual:

- Abrir a página e ver as tabs `[Sem valor][Com desconto]`.
- Aba "Sem valor" continua funcionando idêntica.
- Aba "Com desconto" lista os alunos esperados; KPIs batem; export Excel
  abre com as 12 colunas e formatos esperados.
- Filtros nome/série/turma reduzem a lista corretamente.
- Aluno sem permissão `matriculas` continua sem ver botão Editar (irrelevante
  nesta aba — não há botão Editar aqui).

## Tratamento de erros / edge cases

- Aluno cuja série não tem segmento cadastrado → não aparece (`buildDescontoRow`
  retorna null). Sem ruído na grid; cadastrar segmento da série corrige.
- Valor praticado do segmento ausente para 2026 → todo o segmento sai da
  grid. Mesmo motivo.
- `percentualDescontoEfetivo` negativo (plano acima do cheio + bolsa parcial
  pequena) → `Math.max(0, ...)` zera. Cenário improvável.
- Aluno sem responsável → coluna mostra `—`, export gera linha vazia nas
  colunas de responsável.

## Fora de escopo

- Edição de matrícula a partir da aba "Com desconto" (botão Editar fica só
  na aba "Sem valor").
- Análise temporal do desconto.
- Anos letivos diferentes de 2026.
- Renomear a rota `/financeiro/alunos-sem-valor` — fica como guarda-chuva
  das duas abas. Renomeação eventual fica em outro PR.
