# Valores Praticados — Design

**Data:** 2026-05-17
**Status:** aprovado para implementação

## Objetivo

Tabela de **referência** com valores de matrícula e mensalidade praticados pela escola por ano letivo, segmento e ordem de filho. **Não vincula** à matrícula nem gera cobrança. Serve como base para dashboard mostrar receita potencial e descontos praticados.

Adicionalmente: aplicar capacidade real por etapa nas turmas existentes 2026 (INFANTIL=20, FUND1=20, FUND2=35, MEDIO=35) e criar tabela `segmento_config` como default para novos cadastros.

## Schema

### Tabela `valores_praticados`

```sql
create table valores_praticados (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references escolas(id) on delete cascade,
  ano_letivo integer not null,
  segmento text not null,        -- INFANTIL | FUNDAMENTAL1 | FUNDAMENTAL2 | MEDIO
  ordem_filho integer not null check (ordem_filho between 1 and 3),
  valor_matricula numeric(12,2) not null default 0,
  valor_mensalidade numeric(12,2) not null default 0,
  observacao text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (escola_id, ano_letivo, segmento, ordem_filho)
);
```

RLS: mesma policy de outras tabelas (admin full access).

### Tabela `segmento_config`

```sql
create table segmento_config (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references escolas(id) on delete cascade,
  segmento text not null,
  capacidade_default integer not null check (capacidade_default > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (escola_id, segmento)
);
```

### Seeds 2026 (valores_praticados — da imagem)

| Segmento | 1 Aluno | 2º Irmão | 3º Irmão |
|----------|---------|----------|----------|
| INFANTIL | 690 | 650 | 600 |
| FUNDAMENTAL1 | 745 | 690 | 650 |
| FUNDAMENTAL2 | 890 | 825 | 750 |
| MEDIO | 955 | 900 | 850 |

`valor_matricula` igual a `valor_mensalidade` por enquanto (a imagem trata como mesmo valor de "matrícula + mensalidades").

### Seeds 2025 (histórico)

| Segmento | 1 Aluno | 2º Irmão | 3º Irmão |
|----------|---------|----------|----------|
| INFANTIL | 650 | 595 | 540 |
| FUNDAMENTAL1 | 690 | 650 | 600 |
| FUNDAMENTAL2 | 830 | 775 | 625 |
| MEDIO | 920 | 880 | 830 |

### Seed `segmento_config`

| Segmento | Capacidade |
|----------|-----------|
| INFANTIL | 20 |
| FUNDAMENTAL1 | 20 |
| FUNDAMENTAL2 | 35 |
| MEDIO | 35 |

### Atualização imediata de turmas 2026

```sql
update turmas t
set capacidade = case s.segmento
  when 'INFANTIL'      then 20
  when 'FUNDAMENTAL1'  then 20
  when 'FUNDAMENTAL2'  then 35
  when 'MEDIO'         then 35
  else t.capacidade
end
from series s
where t.serie_id = s.id
  and t.escola_id = '00000000-0000-0000-0000-000000000001'
  and t.ano_letivo = 2026;
```

## CRUD UI

**Rota:** `/valores-praticados` (menu Financeiro)

**Lista:**
- Tabela agrupada por ano letivo (mais recente primeiro)
- Subtabela 4×3 (segmento × ordem_filho) com `valor_matricula` e `valor_mensalidade` por célula
- Header com filtro de ano + botão "Novo ano letivo" (cria 12 linhas vazias)

**Edição inline:**
- Cada célula clicável → input number
- Botão Salvar por linha OU autosave on blur

**Form simplificado (alternativa):**
- Modal: ano + segmento + ordem + 2 valores + observação
- Submit → upsert

Decisão: **edição inline** (menos cliques, vê tudo de uma vez).

**Excluir ano inteiro:** botão "Remover ano" pede confirmação.

## Data layer

`src/lib/data/valores-praticados.ts`:

```ts
export type SegmentoSerie = 'INFANTIL' | 'FUNDAMENTAL1' | 'FUNDAMENTAL2' | 'MEDIO';

export type ValorPraticado = {
  id: string;
  anoLetivo: number;
  segmento: SegmentoSerie;
  ordemFilho: 1 | 2 | 3;
  valorMatricula: number;
  valorMensalidade: number;
  observacao: string | null;
};

export async function listValoresPraticados(escolaId?: string): Promise<ValorPraticado[]>;
export async function listAnosLetivos(escolaId?: string): Promise<number[]>;
export async function getValorPraticado(
  anoLetivo: number,
  segmento: SegmentoSerie,
  ordemFilho: 1 | 2 | 3,
  escolaId?: string
): Promise<ValorPraticado | null>;
```

`src/lib/actions/valores-praticados.ts`:

```ts
export async function upsertValorPraticadoAction(formData: FormData): Promise<void>;
export async function deleteValorPraticadoAction(formData: FormData): Promise<void>;
export async function criarAnoLetivoAction(formData: FormData): Promise<void>; // cria 12 linhas zeradas
export async function removerAnoLetivoAction(formData: FormData): Promise<void>;
```

## Uso no Dashboard

**`getBeneficios()`** atualiza:
- Em vez de usar `planos.valor_mensalidade` (R$ 680 único), usa `valores_praticados` do ano corrente + segmento do aluno, `ordem_filho=1` (default), para calcular `receitaPerdidaEstimada`.
- Fallback: se não houver `valores_praticados` para o segmento, mantém `planos.valor_mensalidade` da matrícula.

**Página `/bolsistas`** ganha info: `valor_mensalidade` real por aluno baseado no segmento.

## Menu

Item novo no dropdown **Financeiro**:
- `/valores-praticados` — label "Valores praticados", ícone `Table` ou `Receipt`

## Fora de escopo

- Vincular `ordem_filho` à matrícula
- Gerador de cobranças usar essa tabela (mantém `planos`)
- Histórico de mudanças (audit)
- Diferenciação `valor_matricula` × `valor_mensalidade` por ordem (a imagem mostra blocos diferentes para "matrículas 2025" vs "matrícula + mensalidades 2026" — modelagem pode evoluir depois)

## Critério de pronto

- [ ] Migration `valores_praticados` + `segmento_config` aplicada
- [ ] Seed 2026 (12 linhas) + 2025 (12 linhas)
- [ ] Seed `segmento_config` (4 linhas)
- [ ] Update turmas 2026 com capacidade correta
- [ ] Rota `/valores-praticados` lista por ano
- [ ] Edição inline funciona
- [ ] Criar ano novo cria 12 linhas vazias
- [ ] Remover ano apaga 12 linhas
- [ ] Item menu Financeiro
- [ ] `getBeneficios` usa `valores_praticados`
- [ ] Dashboard reflete receita real (ex-32 bolsistas × R$ 690-955 dependendo da etapa em vez de R$ 680)
- [ ] Typecheck/lint limpos (exceto erro pré-existente)
