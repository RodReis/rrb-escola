# Tipo de Vaga — Bolsa / Permuta / Gratuidade

**Data:** 2026-05-17
**Status:** aprovado para implementação

## Objetivo

Modelar alunos com benefício (bolsa, permuta, gratuidade) sem gerar cobranças, mas mantendo-os contados em vagas/ocupação. Refletir corretamente no dashboard executivo.

## Problema atual

- 508 alunos cadastrados, 475 matrículas `status='ativa'`, 33 com `status='concluida'` (ex-alunos OU bolsistas/permuta).
- Hoje, secretaria marca bolsista como `concluida` pra evitar geração de cobrança.
- Dashboard mostra ocupação 475, ignora os 33 que **ocupam vaga física**.
- Sem distinção entre ex-aluno real e bolsista ativo.

## Modelagem

### Novo enum

```sql
create type tipo_vaga as enum (
  'paga',            -- aluno pagante padrão
  'bolsa_integral',  -- 100% bolsa, sem cobrança
  'bolsa_parcial',   -- bolsa %, cobrança com desconto
  'permuta',         -- pais prestam serviço em troca
  'gratuita'         -- gratuidade (ex: filho de funcionário)
);
```

### Colunas em `matriculas`

```sql
alter table matriculas
  add column tipo_vaga tipo_vaga not null default 'paga',
  add column percentual_bolsa numeric(5,2) not null default 0
    check (percentual_bolsa >= 0 and percentual_bolsa <= 100);

alter table matriculas
  add constraint matriculas_percentual_bolsa_check
  check (
    (tipo_vaga = 'bolsa_parcial' and percentual_bolsa > 0 and percentual_bolsa < 100)
    or (tipo_vaga <> 'bolsa_parcial' and percentual_bolsa = 0)
  );
```

### Backfill

Reclassificar 33 matrículas `concluida` que são bolsistas para `ativa` + `tipo_vaga = 'bolsa_integral'` (default; refinar via UI depois). Critério: aluno **sem** matrícula ativa **mas com** matrícula `concluida`.

⚠️ **Backup obrigatório antes do backfill.**

```sql
-- Toma só a matrícula mais recente por aluno entre as 'concluida'
with bolsistas_candidatos as (
  select distinct on (m.aluno_id) m.id
  from matriculas m
  join alunos a on a.id = m.aluno_id
  where m.escola_id = '00000000-0000-0000-0000-000000000001'
    and m.status = 'concluida'
    and not exists (
      select 1 from matriculas mx
      where mx.aluno_id = m.aluno_id and mx.status = 'ativa'
    )
  order by m.aluno_id, m.created_at desc
)
update matriculas
  set status = 'ativa', tipo_vaga = 'bolsa_integral'
  where id in (select id from bolsistas_candidatos);
```

## Impacto no Dashboard

| Métrica | Comportamento |
|---------|---------------|
| Ocupação (vagas) | Conta **todos** ativos (pagantes + beneficiados). Bolsista ocupa vaga física. |
| Alunos totais | Conta todos ativos. |
| Receita | Soma `cobrancas.valor_final` (já reflete descontos). Bolsa integral não gera cobrança → não impacta. |
| Ticket médio | **Apenas pagantes + bolsa parcial** no denominador. Bolsa integral/permuta/gratuita zera = distorce ticket. |
| Detalhamento etapa | Nova coluna **Bolsistas** ao lado de Alunos. |
| Card novo | **Benefícios concedidos** — count + breakdown por tipo + receita estimada não realizada. |

## Data layer

`src/lib/data/dashboard-executive.ts` ganha:

```ts
export type TipoVaga = 'paga' | 'bolsa_integral' | 'bolsa_parcial' | 'permuta' | 'gratuita';

export type OcupacaoData = {
  total: number;          // capacidade
  ocupadas: number;       // todas ativas
  pagantes: number;       // 'paga' + 'bolsa_parcial'
  beneficiados: number;   // 'bolsa_integral' + 'permuta' + 'gratuita'
  porEtapa: Array<{
    etapa: string;
    capacidade: number;
    matriculados: number;
    bolsistas: number;
  }>;
};

export type StageBreakdownRow = {
  etapa: string;
  alunos: number;
  bolsistas: number;       // novo
  receita: number;
  ticket: number;          // só pagantes
  ocupacao: number;
  capacidade: number;
  vagasLivres: number;
};

export type BeneficiosData = {
  total: number;
  porTipo: Record<TipoVaga, number>;
  receitaPerdidaEstimada: number; // soma planos.valor_mensalidade × meses do ano dos beneficiados
};

export async function getBeneficios(
  escolaId?: string
): Promise<BeneficiosData>;
```

### Ajustes nas funções existentes

- **`getOcupacao`** — somar `bolsistas` por etapa (matrículas com `tipo_vaga != 'paga'`). Manter contagem total inalterada (todos ativos).
- **`getStageBreakdown`** — adicionar `bolsistas` por etapa. Ticket continua receita/alunos (alunos = todos ativos da etapa; receita já vem real do cobrancas).
- **`getTicketMedio`** — denominador deve ser **count(matriculas tipo_vaga in ('paga','bolsa_parcial'))** por mês, não count(cobrancas).
- **`getAlertas`** — sem mudança (overlotação continua usando total).
- **`getBeneficios`** — nova. Conta por tipo + soma valor_mensalidade dos planos vinculados a essas matrículas, × 12 (ou meses do ano letivo corrente).

## UI

### Componente novo: `BeneficiosCard`

`src/components/dashboard/beneficios-card.tsx` — server component.

- Header: ícone HandHeart + "Benefícios concedidos"
- Valor grande: total de matrículas com benefício
- Lista compacta: ícone + tipo + count (ex: "Bolsa integral · 30")
- Rodapé: "Receita estimada não realizada: R$ 19.800/mês" em tom warning

### Update `StageTable`

Adicionar coluna **Bolsistas** entre Alunos e Capacidade:

```
Etapa       Alunos  Bolsistas    Capacidade  Vagas livres   Receita   Ticket   Ocupação
Ed Inf      120     4 (3%)       175         51 livres      R$ 70k    R$ 608   69%
```

Format: `4 (3%)` quando > 0; "—" quando 0. Cor: `text-accent` ou similar.

### Composição `page.tsx`

`BeneficiosCard` entra na Zona 3 como **5º card** (grid passa de `lg:grid-cols-4` para `lg:grid-cols-5`). Ou substitui um dos existentes se ficar apertado. Decisão na implementação após ver visualmente.

## Out of scope (fase 2)

- UI de edição de `tipo_vaga` e `percentual_bolsa` na tela de matrícula
- Trigger automático de geração de cobrança com desconto pra `bolsa_parcial`
- Relatório dedicado de benefícios (lista de alunos, histórico, motivos)
- Aprovação/workflow de concessão de bolsa
- Limite máximo de bolsas por etapa (regra de negócio)

## Critério de pronto

- [ ] Migration `tipo_vaga` enum + colunas + constraint aplicada
- [ ] Backfill executado: 33 matrículas viram `ativa` + `bolsa_integral`
- [ ] `getOcupacao` retorna `bolsistas` por etapa
- [ ] `getStageBreakdown` retorna `bolsistas`
- [ ] `getTicketMedio` usa denominador pagantes+parcial
- [ ] `getBeneficios` implementado
- [ ] `BeneficiosCard` criado
- [ ] `StageTable` exibe coluna Bolsistas
- [ ] `page.tsx` compõe `BeneficiosCard`
- [ ] Typecheck/lint limpos (exceto erro pré-existente conhecido)
- [ ] Visual smoke: dashboard mostra 508 = 475 pagantes + 33 beneficiados (aprox)
