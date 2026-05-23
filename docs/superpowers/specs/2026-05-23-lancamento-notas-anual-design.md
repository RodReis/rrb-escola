# Lançamento de Notas por Disciplina (Visão Anual) — Design

**Data:** 2026-05-23
**Status:** aprovado

## Objetivo

Rota nova `/avaliacoes/lancamento` — fluxo Série → Turma → Disciplina → grid Alunos × 4 Bimestres com autosave. Substitui o fluxo bagunçado de selecionar "disciplina-da-turma" misturadas (`MATERNAL · Artes`, `1º ANO · Artes`, …).

## Motivação

A tela `/avaliacoes/nova` lista todas disciplinas de todas séries no mesmo combobox (centenas de opções) — quebrava UX. Novo fluxo encadeado é claro e direto.

## Modelo lógico

**Sem schema novo.** Convenção: por bimestre + disciplina + turma, existe **uma avaliação consolidada** com `titulo='Nota Bimestral'`, `tipo='outro'`, `peso=1`, `valor_maximo=10`. Criada sob demanda na primeira nota digitada daquele bimestre. Boletim já agrega via view `notas_consolidadas`.

A tela `/avaliacoes/nova` permanece para prova/trabalho específicos extras (fora do padrão "nota bimestral").

## Schema

Sem mudança. Reusa `avaliacoes` (`turma_id`, `disciplina_id`, `bimestre`, `titulo`) + `notas` (unique `avaliacao_id+aluno_id`).

## Arquitetura

### Data layer — `src/lib/data/lancamento-notas.ts`

```ts
getTurmasComSerie(escolaId, anoLetivo)
  → [{ serieId, serieNome, serieOrdem, turmaId, turmaNome }]

getDisciplinasPorSerie(escolaId, serieId)
  → [{ id, nome }]

getGridNotasAnual(escolaId, turmaId, disciplinaId, anoLetivo)
  → {
      valorMaximo: number,
      alunos: [{
        matriculaId, alunoId, nome,
        notas: { 1: number|null, 2: number|null, 3: number|null, 4: number|null },
        media: number|null
      }]
    }
```

`getGridNotasAnual` é só leitura — não cria avaliação. Resolve as 4 avaliações `Nota Bimestral` existentes via `(turma_id, disciplina_id, bimestre, titulo)`; pra alunos sem nota, retorna `null` por bimestre.

### Action — `src/lib/actions/lancamento-notas.ts`

```ts
salvarNotaBimestralAction({
  turmaId, disciplinaId, bimestre, matriculaId, alunoId, valor: number|null
}): { ok: true } | { ok: false; error: string }
```

Algoritmo:
1. `requirePermission("avaliacoes", "update")`
2. Resolve `avaliacao_id` por `(turma_id, disciplina_id, bimestre, titulo='Nota Bimestral')`.
3. Se não existe e `valor === null`: no-op (return ok). Não cria avaliação à toa.
4. Se não existe e `valor !== null`: cria avaliação consolidada.
5. Valida `0 <= valor <= 10` (2 casas decimais).
6. Se `valor === null`: deleta nota.
7. Caso contrário: upsert `notas (escola_id, avaliacao_id, aluno_id, matricula_id, valor, lancada_por)` `onConflict='avaliacao_id,aluno_id'`.
8. `revalidatePath('/avaliacoes/lancamento')` + `revalidatePath('/alunos/[id]/boletim')`.

### UI

**Page (`src/app/(app)/avaliacoes/lancamento/page.tsx`):**
- Server component. `requirePermission("avaliacoes", "read")`.
- Lê `searchParams`: `serie?`, `turma?`, `disciplina?`, `ano?` (default ano atual).
- Carrega `getTurmasComSerie(...)` sempre. Filtra opções de turma pela série.
- Se `serie+turma` presentes: carrega `getDisciplinasPorSerie(serie)`.
- Se todos presentes: carrega `getGridNotasAnual(...)`.
- Renderiza `<FiltrosLancamento>` + (se completo) `<NotasBimestraisGrid>`.

**FiltrosLancamento (client):**
- 3 selects encadeados. Cada `onChange` atualiza URL via `router.replace`.
- Trocar série limpa turma+disciplina. Trocar turma limpa disciplina.

**NotasBimestraisGrid (client):**
- Tabela: foto, nome, 4 inputs (1 por bimestre), coluna média.
- Estado local por célula: `{ valor, status: idle|saving|saved|error }`.
- `onBlur` ou `Enter`: chama `salvarNotaBimestralAction`. Status "saved" volta a "idle" em 2s.
- Enter pula pra próxima célula da mesma coluna (próximo aluno mesmo bimestre).
- Tab move horizontalmente (próximo bimestre mesmo aluno).
- Média recalculada localmente quando nota muda (sem ir ao servidor).

### Link em `/avaliacoes/page.tsx`

Botão "Lançar notas" no header da listagem aponta pra `/avaliacoes/lancamento`.

## RBAC

Reusa módulo `avaliacoes` (`read` na page, `update` na action). Sem migration.

## Validação

- `valor`: 0 a 10, 2 casas decimais.
- vazio → apaga nota existente; não cria avaliação à toa.
- range fora: erro local no input, sem request.

## Testes

Unit:
- Action cria avaliação se não existe + nota > 0
- Action reusa avaliação existente
- Action apaga nota quando valor=null
- Action no-op quando avaliação não existe e valor=null
- Action rejeita valor < 0 ou > 10

Manual:
- Selecionar 6º ANO → MATUTINO → Matematica
- Digitar 4 notas pra um aluno (1 por bimestre)
- Refresh → notas persistem
- Boletim mostra os 4 valores

## Fora de escopo

- Avaliações múltiplas por bimestre (continua via `/avaliacoes/nova`)
- Observação por nota
- Histórico/audit log
- Importação CSV
- Fechar bimestre (read-only)

## Arquivos

**Criar:**
- `src/lib/data/lancamento-notas.ts`
- `src/lib/actions/lancamento-notas.ts`
- `src/app/(app)/avaliacoes/lancamento/page.tsx`
- `src/components/avaliacoes/filtros-lancamento.tsx`
- `src/components/avaliacoes/notas-bimestrais-grid.tsx`

**Modificar:**
- `src/app/(app)/avaliacoes/page.tsx` — botão "Lançar notas"

## Risco

Baixo. Schema intocado. Avaliações `Nota Bimestral` são identificáveis por convenção (titulo). Co-existe com fluxo antigo.
