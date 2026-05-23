# Lançamento de Notas em Lote — Design

**Data:** 2026-05-23
**Status:** aprovado para implementação

## Objetivo

Permitir ao professor digitar as notas de toda a turma rapidamente para uma avaliação, com autosave inline por aluno. Desbloqueia o uso real do módulo pedagógico (schema completo, 0 uso).

## Motivação

- `avaliacoes` = 0 linhas, `notas` = 0 linhas
- Schema, view consolidada (`notas_consolidadas`) e tela de boletim já prontos
- Faltava UX rápida pra entrada de dados — sem isso ninguém lança nada

## Escopo

- Tela dedicada `/avaliacoes/[id]/notas` (URL própria, refresh-safe).
- Autosave inline por blur/Enter; cada nota persiste isoladamente.
- Validação: `0 <= valor <= avaliacao.valor_maximo`, 2 casas decimais, ou apagar (valor null).
- Lista alunos = matrículas ativas da turma da avaliação no ano letivo da avaliação. Ordena por nome.

## Schema

**Sem mudança.** Reusa `notas` (unique `avaliacao_id + aluno_id`).

## Arquitetura

### Data layer — `src/lib/data/notas.ts` (novo)

```ts
export type AlunoComNota = {
  matriculaId: string;
  alunoId: string;
  nome: string;
  fotoUrl: string | null;
  nota: { valor: number | null; observacao: string | null } | null;
};

export type AvaliacaoComAlunos = {
  avaliacao: {
    id: string;
    titulo: string;
    bimestre: number;
    valorMaximo: number;
    peso: number;
    turmaId: string;
    turmaNome: string;
    serieNome: string;
    disciplinaNome: string;
    anoLetivo: number;
  };
  alunos: AlunoComNota[];
};

export async function getAvaliacaoComAlunos(avaliacaoId: string): Promise<AvaliacaoComAlunos | null>
```

Implementação:
- Busca `avaliacoes` join `turmas` + `series` + `disciplinas`.
- Busca `matriculas` `status='ativa'` AND `ano_letivo = avaliacao.ano_letivo` AND `turma_id = avaliacao.turma_id` + `alunos`.
- Busca `notas` da avaliação. Faz left-join em memória.
- Ordena alunos por nome (`pt-BR`).
- Retorna `null` se avaliação não existe ou pertence a outra escola.

### Server action — `src/lib/actions/notas.ts` (novo)

```ts
export type SalvarNotaResult = { ok: true } | { ok: false; error: string };

export async function salvarNotaAction(input: {
  avaliacaoId: string;
  matriculaId: string;
  alunoId: string;
  valor: number | null;
}): Promise<SalvarNotaResult>
```

- `requirePermission("avaliacoes", "update")` (sessão fornece `perfil.id` para `lancada_por`).
- Carrega `valor_maximo` da avaliação (1 query). Se avaliação não existe → erro.
- Valida: se `valor !== null`, exige `0 <= valor <= valor_maximo`, finite, max 2 casas decimais.
- Se `valor === null`: deleta nota existente (apagar).
- Caso contrário: upsert (`onConflict: "avaliacao_id,aluno_id"`).
- `revalidatePath("/avaliacoes/[id]")` + `revalidatePath("/alunos/[alunoId]/boletim")`.

### UI — `src/app/(app)/avaliacoes/[id]/notas/page.tsx` (novo)

Server component.
- `requirePermission("avaliacoes", "read")`.
- Carrega `getAvaliacaoComAlunos(params.id)`.
- Resolve fotos assinadas (`getSignedFotoUrls`).
- Renderiza `<NotasGrid avaliacao={...} alunos={...} />` (client).

### UI — `src/components/avaliacoes/notas-grid.tsx` (novo, client)

- Estado local: `Map<matriculaId, { valor: string, status: "idle" | "saving" | "saved" | "error", error?: string }>`.
- Tabela: foto + nome + input `type="number" step="0.01" min={0} max={valorMaximo}`.
- `onBlur` ou `Enter` → se valor mudou: chama `salvarNotaAction` → atualiza status.
- Status "saved" volta a "idle" após 2s (timer).
- Status "error" persiste com tooltip.
- Tab/Enter avança para próximo input (`tabIndex` sequencial).

### Link em `/avaliacoes/[id]/page.tsx`

Adicionar botão "Lançar notas" ao lado das ações existentes:
```tsx
<ButtonLink href={`/avaliacoes/${avaliacao.id}/notas`} variant="primary">
  <ClipboardEdit size={14} /> Lançar notas
</ButtonLink>
```

## RBAC

Reusa módulo `avaliacoes` (já existe). `read` na página, `update` na action. Sem migration.

## Validação

- `valor !== null`: finite, `>= 0`, `<= valor_maximo`.
- `valor === null` (string vazia): apaga a nota existente.
- Mais que 2 casas decimais: arredonda no client antes de enviar; server faz check defensivo.
- Erro 400 vira mensagem amigável no input específico.

## Testes

Unit (Vitest):
- `salvarNotaAction`:
  - Aceita valor válido (0, 5, valor_maximo)
  - Rejeita valor negativo
  - Rejeita valor > valor_maximo
  - Aceita null (apagar)
  - Idempotente (upsert)

Manual:
- Criar avaliação na tela existente
- Abrir `/avaliacoes/[id]/notas`
- Digitar notas, Enter, ver "salvo ✓"
- Refresh → notas persistem
- Boletim `/alunos/[id]/boletim?ano=2026` reflete

## Fora de escopo

- Lançar notas de várias avaliações simultaneamente.
- Histórico/audit log de mudanças.
- Importação CSV em massa.
- Validação de matrícula vigente na `data_aplicacao` (usa matrícula atual).
- Coluna "observação" por aluno na grid (campo existe no DB mas UX fica pra próxima).
- Fechar bimestre / read-only por período.

## Arquivos

**Criar:**
- `src/lib/data/notas.ts`
- `src/lib/actions/notas.ts`
- `src/lib/actions/notas.test.ts`
- `src/app/(app)/avaliacoes/[id]/notas/page.tsx`
- `src/components/avaliacoes/notas-grid.tsx`

**Modificar:**
- `src/app/(app)/avaliacoes/[id]/page.tsx` — botão "Lançar notas"

## Risco

Baixo. Schema intocado, action isolada, UI cliente independente das telas existentes.
