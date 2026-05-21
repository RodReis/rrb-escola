# Comunicados — Seleção por Aluno + UX — Design

**Data:** 2026-05-22
**Contexto:** Refinamento do Sub-projeto C (comunicados por turma/série).

## Objetivo

Melhorar a UI do comunicado segmentado: em vez de um paredão de ~60 checkboxes de
turmas (todos os anos), o admin escolhe série e turma por combo (filtrados pelo ano
corrente), vê os alunos da turma e pode desmarcar individualmente. Mover o menu de
Lembretes para o grupo RH.

## Contexto

- Comunicado segmentado hoje: `alvos` jsonb = `Alvo[]` (`{tipo: "turma"|"serie", id}`).
  `resolverDestinatarios` expande série→turma→alunos no envio.
- O form lista TODAS as turmas ativas (2023–2026) como checkboxes — virou um paredão.
- `listTurmasESeries` traz todas as turmas/séries.
- Menu de Lembretes (`/configuracoes/lembretes`) está em `CONFIG_ITEMS` da topbar.

## Decisões de escopo

- **Combos filtrados pelo ano corrente (2026):** série e turma viram `<select>`. Turma
  filtra pela série escolhida + ano corrente.
- **Seleção por aluno:** escolher turma → lista os alunos dela, todos marcados, com
  "selecionar todos". O admin desmarca quem não quer.
- **`alvos` guarda alunos + critério:** a coluna `alvos` jsonb passa de `Alvo[]` para um
  objeto `{ alunos: string[]; criterio: CriterioAlvo[] }` — `alunos` são os destinatários
  finais; `criterio` registra as turmas/séries escolhidas (com nome) para o histórico.
- **Menu Lembretes → RH.**

## Modelo de dados

Sem migração — a coluna `comunicados.alvos` (jsonb) já existe. Muda o **formato** do
conteúdo para comunicados `segmentado`:

```json
{
  "alunos": ["aluno-uuid-1", "aluno-uuid-2"],
  "criterio": [
    { "tipo": "turma", "id": "uuid", "nome": "3ª Série Matutino" },
    { "tipo": "serie", "id": "uuid", "nome": "4º Ano" }
  ]
}
```

Tipos:
```
CriterioAlvo = { tipo: "turma" | "serie"; id: string; nome: string }
AlvosSegmentado = { alunos: string[]; criterio: CriterioAlvo[] }
```

Comunicados antigos com o formato `Alvo[]` continuam no banco — o mapper trata os dois
formatos (array antigo → `{ alunos: [], criterio: [] }`; objeto novo → como está).

## Arquitetura

### Resolução de destinatários — `src/lib/comunicados/destinatarios.ts`

`resolverDestinatarios` no caso `segmentado` simplifica: recebe a lista de `alunoId`
(de `alvos.alunos`) e resolve direto o responsável financeiro — sem expansão
série→turma. A função `coletarTurmaIds` deixa de ser usada pelo caso segmentado (pode
permanecer no arquivo, sem chamadas, ou ser removida — remover, já que nada mais a usa).

Nova assinatura: `resolverDestinatarios` recebe `alunoIds: string[]` para o caso
segmentado em vez de `Alvo[]`.

### Data layer — `src/lib/data/comunicados.ts`

- `ComunicadoRow.alvos` muda de `Alvo[]` para `AlvosSegmentado`.
- `mapComunicado` normaliza: se `row.alvos` é array (formato antigo) →
  `{ alunos: [], criterio: [] }`; se é objeto → usa os campos `alunos`/`criterio`.
- `listTurmasESeries` — filtra `turmas` e `series` pelo ano corrente. As séries não têm
  `ano_letivo` próprio (uma série é reusada entre anos via turmas), então: filtrar as
  turmas por `ano_letivo = ano corrente`, e as séries para apenas as que têm ao menos uma
  turma no ano corrente.
- Nova função `listAlunosDaTurma(turmaId, escolaId?)` — alunos com matrícula ativa
  naquela turma. Retorna `{ id, nome }[]`.

### Server action — `src/lib/actions/comunicados.ts`

`criarComunicadoAction` no caso `segmentado`:
- Lê do form um campo `alvos` (JSON) já no formato `AlvosSegmentado`.
- Valida: `alunos` não-vazio.
- Grava `alvos` (objeto) na coluna.
- Chama `resolverDestinatarios` passando `alvos.alunos`.

### UI — `src/components/comunicados/novo-comunicado-form.tsx`

Modo `segmentado` redesenhado:
- **Combo de Série** (`<select>`) — opções = séries do ano corrente.
- **Combo de Turma** (`<select>`) — opções = turmas da série escolhida (ano corrente).
- Ao escolher uma turma → carrega os alunos dela (client fetch a uma rota ou via prop
  pré-carregada). Lista os alunos com checkbox, todos marcados, + "Selecionar todos".
- O admin desmarca quem não quer; pode trocar de turma e adicionar mais alunos — a
  seleção acumula num `Set<alunoId>`.
- A turma/série escolhida vai para `criterio`; os alunos marcados para `alunos`.
- Campo hidden `alvos` com o JSON `{ alunos, criterio }`.

Para a UI carregar os alunos por turma sem recarregar a página, uma rota leve:
`src/app/api/turmas/[id]/alunos/route.ts` — `GET`, retorna os alunos ativos da turma
(autenticada por sessão; usa `requirePermission` ou checagem equivalente).

UX: layout em passos claros — Série → Turma → Alunos. Espaçamento, agrupamento, sem o
paredão.

### Página de novo comunicado — `src/app/(app)/comunicados/novo/page.tsx`

Carrega `listTurmasESeries` (já filtrado por ano corrente) e passa ao form.

### Detalhe do comunicado — `src/app/(app)/comunicados/[id]/page.tsx`

O alcance segmentado exibe o `criterio`: "Segmentado · Turmas: 3ª Série Matutino;
Séries: 4º Ano" + "N alunos".

### Menu — `src/components/layout/topbar.tsx`

O item `{ href: "/configuracoes/lembretes", ... }` sai de `CONFIG_ITEMS` e entra em
`RH_ITEMS`.

## RBAC

Sem mudança — comunicados usa `comunicados`; lembretes usa `financeiro.cobrancas`. O
item de menu de lembretes mudar de grupo não muda a permissão.

## Testes

Unit (Vitest):
- `mapComunicado` / normalização de `alvos` — formato antigo (array) vira
  `{alunos:[],criterio:[]}`; formato novo (objeto) preservado.
- Filtro de séries por ano corrente, se extraído em função pura.

A UI e o fetch de alunos por turma são validados manualmente.

## Fora de escopo

- Editar os alvos de um comunicado já criado.
- Pré-visualizar a contagem de responsáveis (alguns alunos podem não ter responsável
  financeiro com WhatsApp — isso só é resolvido no envio).
- Histórico/relatório dedicado de comunicados.
