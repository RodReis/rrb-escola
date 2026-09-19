# Fonte única de contagem/consulta de alunos — Design

**Status:** aprovado para plano
**Data:** 2026-09-19

## Contexto

O sistema mostra números diferentes de "quantos alunos existem" em telas distintas (dashboard, relatório, combos, busca). Investigação mapeou a causa: cada tela reimplementa sua própria query com filtros diferentes — sem uma fonte de verdade compartilhada.

Divergências encontradas:

1. **`ativo` filtrado inconsistentemente** — `/alunos` (`listStudents`) filtra `ativo=true` por padrão; `/relatorios/alunos` (`getStudentsReport`) e o combo de matrícula (`getAcademicData`) não filtram nunca.
2. **Contagem de `alunos` vs. contagem de `matriculas`** — vários dashboards (`getPedagogicoOverview`, `getOcupacao`, `getEvasao`, bolsistas) contam linhas de `matriculas.status='ativa'`, não linhas de `alunos`. Um aluno `ativo=true` sem matrícula no ano corrente não entra nesses números.
3. **Ano letivo hardcoded** — `alunos-com-desconto.ts` tem `ano_letivo = 2026` fixo no código-fonte; quebra sozinho em 2027.
4. **Zero normalização de acento** — toda busca por nome usa `ilike` (SQL) ou `.includes()` (JS) puro. `unaccent` (extensão Postgres) não está instalada. "CORTES" não encontra "CÔRTES".
5. **Dedup manual inconsistente** — algumas queries com join fazem `Set<string>` para evitar duplicar linha; outras não.

## Decisão de negócio (regra "527")

**"527 alunos" = alunos com `ativo=true` E matrícula com `status='ativa'` no ano letivo corrente.** Esta é a regra canônica que a nova função encapsula. Ano corrente = `new Date().getFullYear()` por padrão, nunca hardcoded; aceita override explícito por parâmetro para telas que navegam anos anteriores (ex.: relatório histórico).

Esta regra não substitui todo uso de `alunos` no sistema — ver "Contextos que ficam fora da regra 527" abaixo.

## Arquitetura

Uma função TypeScript canônica em `src/lib/data/students.ts` (arquivo já existente, sem migration SQL nova — ver decisão em brainstorming: função TS compartilhada, não view/RPC), que os outros módulos passam a consumir em vez de reimplementar a query.

```ts
// src/lib/data/students.ts

export type AlunoAtivoAnoCorrente = {
  id: string;
  nome: string;
  matriculaCodigo: string | null;
  cpf: string | null;
  matriculaId: string;
  serieId: string;
  turmaId: string;
  anoLetivo: number;
};

export type FiltroAlunosAtivos = {
  anoLetivo?: number; // default: new Date().getFullYear()
  serieId?: string;
  turmaId?: string;
  nome?: string; // busca com normalização de acento
};

/**
 * Fonte única: alunos com `ativo=true` e matrícula `status='ativa'` no ano
 * letivo informado (ou corrente). Base de todo KPI/contagem "oficial" do
 * sistema (dashboard, relatório consistente, badge "527").
 */
export async function getAlunosAtivosAnoCorrente(
  filtro?: FiltroAlunosAtivos
): Promise<AlunoAtivoAnoCorrente[]>;

/**
 * Mesma base de `getAlunosAtivosAnoCorrente`, mas devolve só a contagem
 * (`count: "exact", head: true`) — evita trazer linhas quando só o número
 * importa (KPI, badge).
 */
export async function contarAlunosAtivos(
  filtro?: Omit<FiltroAlunosAtivos, "nome">
): Promise<number>;

/**
 * Universo para o combo de NOVA matrícula / rematrícula: alunos `ativo=true`
 * que NÃO têm matrícula `status='ativa'` no ano letivo informado (ainda não
 * matriculados nesse ano). Contexto oposto ao de `getAlunosAtivosAnoCorrente`
 * — ver "Contextos que ficam fora da regra 527".
 */
export async function getAlunosSemMatriculaNoAno(
  anoLetivo?: number
): Promise<{ id: string; nome: string; matriculaCodigo: string | null }[]>;
```

### Normalização de acento

Nova migration adiciona a extensão `unaccent` e uma coluna gerada `nome_normalizado` em `alunos` (minúsculo, sem acento), com índice, para busca eficiente:

```sql
create extension if not exists unaccent;

alter table alunos
  add column nome_normalizado text
  generated always as (lower(unaccent(nome))) stored;

create index idx_alunos_nome_normalizado on alunos using gin (nome_normalizado gin_trgm_ops);
```

(Requer também `pg_trgm` se ainda não instalada — verificar na migration; se não houver, usar índice btree simples em vez de trigram, já que o volume atual é ~500 linhas e não justifica trigram.)

Toda busca por nome (`getAlunosAtivosAnoCorrente({ nome })`, o combo client-side) passa a comparar contra `nome_normalizado` com o termo de busca também normalizado (`lower(unaccent(termo))` no servidor; no client, função `normalizeNome()` compartilhada usando `.normalize("NFD").replace(/[̀-ͯ]/g, "")`).

## Quem passa a consumir (trocar chamada interna, manter assinatura pública de cada função)

| Arquivo | Função | Mudança |
|---|---|---|
| `src/lib/data/students.ts` | `listStudents`, `getStudentSegmentCounts` | Mantêm comportamento atual (não usam a regra 527 — ver exceção abaixo); ficam lado a lado com a nova função no mesmo arquivo. |
| `src/lib/data/pedagogico.ts` | `getPedagogicoOverview`, `getEvasao` | Trocam contagem manual de `matriculas` por `contarAlunosAtivos`. |
| `src/lib/data/dashboard-executive.ts` | `getOcupacao` | Idem — remove query própria de `matriculas.status='ativa'`. |
| `src/lib/data/dashboard-comercial.ts` | top devedores, renovações, aniversariantes | Usam `getAlunosAtivosAnoCorrente` como base, aplicam filtro adicional específico por cima (ex.: inadimplência). |
| `src/lib/data/bolsistas.ts` | `listBolsistas` | Idem, com filtro adicional `tipo_vaga`. |
| `src/lib/data/alunos-com-desconto.ts` | contagem/listagem | Remove `ano_letivo = 2026` hardcoded; usa `getAlunosAtivosAnoCorrente` com ano corrente. |
| `src/lib/data/alunos-sem-valor.ts` | listagem | Idem. |
| `src/lib/data/lookups.ts` | `getAcademicData` | **Não muda a função existente** (ainda serve outros consumidores que precisam do universo completo). Adiciona uso de `getAlunosAtivosAnoCorrente`/`getAlunosSemMatriculaNoAno` onde o combo precisar de uma das duas regras — ver tabela de combos abaixo. |
| `src/components/matriculas/student-combobox.tsx` | filtro client-side | Troca `.toLowerCase().includes()` por comparação usando a função `normalizeNome()` compartilhada (novo arquivo `src/lib/format/normalize-nome.ts`, usado tanto no client quanto — futuramente — em scripts). |
| `src/lib/data/comunicados.ts` | `listAlunosDaTurma` | Sem mudança de comportamento (já filtra corretamente); revisar se compensa reusar a base nova — **fora do escopo deste refactor**, mencionar como candidato futuro no changelog da spec. |

### Combos: duas regras por contexto

Decisão (brainstorming): não existe "um combo universal". Cada combo usa a regra que faz sentido pro seu fluxo:

- **Combo de NOVA matrícula/rematrícula** (tela onde `createEnrollmentAction` é chamada): usa `getAlunosSemMatriculaNoAno(anoLetivo)` — precisa listar quem AINDA NÃO tem matrícula ativa no ano, senão fica impossível matricular alguém novo.
- **Combos gerais** (comunicados, buscas, qualquer combo que pressupõe "aluno atualmente na escola"): usa `getAlunosAtivosAnoCorrente` — mesma regra do 527.
- Combos que precisam do universo completo (ex.: editar cadastro de aluno inativo) continuam usando `getAcademicData` sem filtro, sem mudança.

### Contextos que ficam fora da regra 527 (deliberado, não é inconsistência)

- **`/alunos` (tela principal, `listStudents`)**: propositalmente mostra aluno ativo SEM matrícula no ano — é a tela onde a secretaria precisa achar esse aluno para rematricular. Comentário já existente no código (`students.ts:39-43`) documenta essa decisão; o refactor preserva.
- **`/relatorios/alunos` (`getStudentsReport`)**: decisão de negócio confirmada — relatório geral mantém ativo+inativo, sem filtro de ano. Não usa a nova função.

## Erros e validação

- `getAlunosAtivosAnoCorrente`/`contarAlunosAtivos`/`getAlunosSemMatriculaNoAno` propagam erro do Supabase (`throw error`), seguindo o padrão já usado em todo `students.ts` — sem try/catch silencioso.
- `anoLetivo` fora de uma faixa razoável (ex.: negativo) não é validado dentro da função — quem chama passa um ano válido; não é um boundary de input de usuário direto (nenhuma dessas funções é chamada com ano vindo de form sem validação prévia no schema da action).

## Testes

Novo arquivo `src/lib/data/students.test.ts` (ou extensão do existente, se houver), cobrindo `getAlunosAtivosAnoCorrente`:

1. Aluno `ativo=true` com matrícula `status='ativa'` no ano corrente → aparece.
2. Aluno `ativo=true` SEM matrícula no ano corrente → não aparece.
3. Aluno `ativo=false` com matrícula `status='ativa'` no ano corrente → não aparece (edge case: aluno desativado mas matrícula não foi encerrada).
4. Busca por nome com acento (`"CÔRTES"`) encontra registro buscando sem acento (`"cortes"`) e vice-versa.
5. `getAlunosSemMatriculaNoAno`: aluno ativo sem NENHUMA matrícula → aparece; aluno ativo com matrícula `concluida` (não `ativa`) no ano → aparece; aluno ativo com matrícula `ativa` no ano → não aparece.
6. `contarAlunosAtivos` retorna o mesmo número que `getAlunosAtivosAnoCorrente(...).length` para o mesmo filtro (teste de consistência interna, evita a divergência #7 do mapa original).

Testes usam o padrão de mocks já estabelecido no projeto (verificar `*.test.ts` existentes em `src/lib/data/` ou `src/lib/documents/*.test.ts` para o padrão de mock do client Supabase).

## Fora de escopo

- Não mexe em `deleteStudentAction` (hard delete) nem em RBAC.
- Não cria view/RPC no Postgres — decisão explícita de manter lógica em TS.
- Não resolve falta de validação de capacidade de turma (`turmas.capacidade` não é checada em nenhuma matrícula hoje) — problema pré-existente, fora do pedido.
- Não reescreve `listAlunosDaTurma` (comunicados) — já está correto, fica como candidato futuro.
- Não altera os dois scripts Python (`import_novos_alunos_2026.py`, `import_matriculados_2026.py`) que bypassam a Server Action — fora do escopo deste refactor de leitura.

## Critério de aceite

- `npm run typecheck && npm run build` verdes.
- `npm run test` verde, incluindo os novos casos.
- Badge/KPI de qualquer tela que passe a usar `contarAlunosAtivos`/`getAlunosAtivosAnoCorrente` mostra o mesmo número entre si, para o mesmo ano letivo.
- Busca por nome com/sem acento retorna o mesmo resultado, no combo e na tela `/alunos`.
- `alunos-com-desconto.ts` não tem mais ano hardcoded.
