# Aniversariantes da Semana + Stage Table Cleanup — Design

**Data:** 2026-05-19
**Branch alvo:** feature-mvp2
**Escopo:** Dashboard executivo, aba Alunos

## Contexto

Aba Alunos do dashboard executivo já tem:
- `StageTable` (`src/components/dashboard/stage-table.tsx`) com 8 colunas, incluindo Receita e Ticket.
- `AniversariantesCard` mensal (`src/components/dashboard/aniversariantes-card.tsx`) renderizado em grid 2col junto com `RankingTurmasCard`.

Falta destaque visual para aniversariantes da semana (próximos 7 dias), com aluno do dia em evidência.

Data layer já tem `getAniversariantesSemana(escolaId)` em `src/lib/data/dashboard-executive.ts:1239` retornando `AniversarioSemanaRow[]` com `foto_url`, `hoje`, `diaSemana`, `dia`, `mes`, `nome`, `alunoId`.

## Objetivos

1. **Remover Receita e Ticket** da `StageTable` (foco da tabela é matrículas/ocupação, não financeiro).
2. **Novo card "Aniversariantes da Semana"** com destaque visual para aniversariantes de hoje + lista compacta dos próximos 6 dias, posicionado em destaque na aba Alunos.

## Mudanças

### 1. StageTable — remover colunas Receita e Ticket

**Arquivo:** `src/components/dashboard/stage-table.tsx`

- Remover `<th>Receita</th>` e `<th>Ticket</th>` (linhas 61-62).
- Remover `<td>` correspondentes nas rows de dados (linhas 110-111).
- Remover `<td>` correspondentes na row Total (linhas 139-140).
- Remover cálculos não utilizados: `totalReceita`, `ticketMedio`.
- Remover import `money` se não houver mais uso no arquivo.
- Tabela final: 6 colunas (Etapa, Alunos, Bolsistas, Capacidade, Vagas livres, Ocupação).

Sem alteração no tipo `StageBreakdownRow` nem no data layer (campos `receita` e `ticket` permanecem, podem ser usados em outros lugares).

### 2. Data layer — adicionar idade em AniversarioSemanaRow

**Arquivo:** `src/lib/data/dashboard-executive.ts`

- Adicionar campo `idade: number` ao tipo `AniversarioSemanaRow` (idade que o aluno faz neste aniversário).
- Em `getAniversariantesSemana`, calcular: `idade = hoje.getFullYear() - anoNasc` (com ajuste se aniversário ainda não chegou no ano corrente — para janela de 7 dias o ajuste é trivial: se `mm/dd` está dentro da janela e ainda não passou, é a próxima idade).
- Adicionar campo `dataLabel: string` (ex: "qua 21/05") pré-formatado para exibição na lista compacta.

### 3. Novo componente — AniversariantesSemanaCard

**Arquivo novo:** `src/components/dashboard/aniversariantes-semana-card.tsx`

**Props:**
```ts
{ items: AniversarioSemanaRow[] }
```

**Estrutura:**

- Card raiz `<article>` com `rounded-panel bg-surface shadow-soft p-6`.
- Header: título "Aniversariantes da Semana" + contador no kicker style; subtítulo "Próximos 7 dias. Comemorações em destaque."
- Bloco "Hoje" (se `items.some(i => i.hoje)`):
  - Container destacado: gradient `from-gold/20 to-gold/5`, ring `border-gold/30`, padding generoso.
  - Kicker "ANIVERSÁRIO HOJE" + ícone PartyPopper.
  - Heading "Parabéns!" grande.
  - Para cada aniversariante de hoje: card individual `bg-surface ring-1 ring-gold/40` com foto (avatar 48px) + nome em bold + badge "🎂 Aniversário hoje".
  - Foto: `<Avatar>` ou fallback com iniciais sobre `bg-gold/15 text-gold`.
- Bloco "Próximos dias" (se `items.some(i => !i.hoje)`):
  - Label "Próximos dias:" (kicker style).
  - Lista vertical compacta: foto 32px + nome + `dataLabel` ("qua 21/05") + idade ("· 8a").
  - Hover: `bg-muted/60`.
- Vazio (`items.length === 0`): card visível com mensagem "Sem aniversariantes nesta semana." e ícone Cake apagado.
- Todos os itens (hoje e próximos): `<Link href={/alunos/${alunoId}}>` envolvendo o item inteiro. Hover mostra tooltip nativo via `title` attribute com nome completo + idade.

**Paleta:** gold como cor primária (igual ao card mensal existente, mantém coerência visual).

**Acessibilidade:** alt text nas fotos, `aria-label` nos links com "Ver ficha de [nome]".

### 4. Wire-up na page

**Arquivo:** `src/app/(app)/page.tsx`

- Adicionar import de `getAniversariantesSemana` da `@/lib/data/dashboard-executive`.
- Adicionar import de `AniversariantesSemanaCard` de `@/components/dashboard/aniversariantes-semana-card`.
- Adicionar slot ao `Promise.all`: `showAlunos ? getAniversariantesSemana(escolaId) : null`. Posicionar próximo ao `aniversariantes` (mensal) para preservar ordem.
- Renderizar dentro de `tabEfetiva === "alunos"`, em posição de destaque:
  - **Acima** do grid 2col que contém `RankingTurmasCard` + `AniversariantesCard` mensal.
  - **Abaixo** do `StageTable`.
- Full-width (não dentro de grid).

**Ordem final aba Alunos:**
1. Métricas top (Ocupação, Frequência, Benefícios, Resumo).
2. `StageTable` (modificada).
3. **`AniversariantesSemanaCard` (novo, full-width).**
4. Grid 2col: `RankingTurmasCard` + `AniversariantesCard` (mensal).
5. Grid 2col: `AniversarioMatriculaCard` + `SaudeSistemaCard`.
6. `RenovacoesPendentes` ou `TopDevedores` (conditional).

## Não-objetivos

- Não alterar `AniversariantesCard` mensal existente.
- Não alterar dados/tipos do `StageBreakdownRow` (apenas a apresentação na tabela).
- Não adicionar paginação ou filtros no card semanal.
- Não criar página dedicada — apenas card no dashboard.

## Critérios de sucesso

- StageTable renderiza 6 colunas sem Receita/Ticket.
- AniversariantesSemanaCard renderiza:
  - Bloco "Hoje" em destaque quando há aniversariantes de hoje.
  - Lista compacta com foto + nome + data + idade para próximos dias.
  - Estado vazio com mensagem amigável.
  - Click em qualquer item navega para `/alunos/[alunoId]`.
- Card mensal existente continua renderizando normalmente.
- Sem regressão visual nas demais seções da aba Alunos.
- Permission gate `showAlunos` aplicado ao novo card (igual ao mensal).
