# Tipo de Vaga v2 — granularidade de benefícios + edição na grid de matrículas

**Data:** 2026-09-22
**Status:** implementado
**Substitui:** [2026-05-17-tipo-vaga-bolsa-permuta-design.md](./2026-05-17-tipo-vaga-bolsa-permuta-design.md)

## Objetivo

Trocar o enum `tipo_vaga` original (5 valores) por um conjunto mais granular
que distingue filhos de professora/funcionária dos demais tipos de bolsa, e
expor edição completa da matrícula (incluindo tipo de vaga) diretamente na
grid de `/matriculas` — até então só existia em Financeiro > Alunos sem valor.

## Problema atual

- Enum antigo (`paga`, `bolsa_integral`, `bolsa_parcial`, `permuta`,
  `gratuita`) não permitia identificar filhos de professora/funcionária nos
  relatórios — caíam junto com bolsa parcial genérica.
- `bolsa_parcial` aceitava qualquer percentual (1-99, campo digitado); na
  prática só era usado em 0 matrículas de produção com esse formato livre.
- Não havia campo "Tipo de vaga" visível na tela `/matriculas` (secretaria):
  só existia em Financeiro > Alunos sem valor, uma tela pouco descoberta
  (sem link no menu). Ver histórico da sessão: usuário não sabia onde editar.

## Modelagem

### Novo enum

```sql
create type tipo_vaga as enum (
  'NORMAL',
  'BOLSA_50_PORCENTO',
  'BOLSA_INTEGRAL',
  'FILHO_PROFESSORA',
  'FILHO_PROFESSORA_INTEGRAL',
  'PERMUTA',
  'ISENTO'
);
```

`percentual_bolsa` deixa de ser um campo livre (1-99): agora é sempre `50`
quando `tipo_vaga in ('BOLSA_50_PORCENTO', 'FILHO_PROFESSORA')`, e `0` nos
demais casos — reforçado por constraint:

```sql
alter table matriculas
  add constraint matriculas_bolsa_50_check
  check (
    (tipo_vaga in ('BOLSA_50_PORCENTO', 'FILHO_PROFESSORA') and percentual_bolsa = 50)
    or (tipo_vaga not in ('BOLSA_50_PORCENTO', 'FILHO_PROFESSORA') and percentual_bolsa = 0)
  );
```

`FILHO_PROFESSORA` e `BOLSA_50_PORCENTO` têm o **mesmo comportamento de
cobrança** (desconto fixo de 50%); o tipo separado serve só para identificar
filhos de professora/funcionária em relatórios e consultas. `FILHO_PROFESSORA
_INTEGRAL` segue o mesmo tratamento de `BOLSA_INTEGRAL` (isento de cobrança).

### Mapeamento de dados (migration)

| Antigo | Novo |
|---|---|
| `paga` | `NORMAL` |
| `bolsa_integral` | `BOLSA_INTEGRAL` |
| `bolsa_parcial` | `BOLSA_50_PORCENTO` |
| `permuta` | `PERMUTA` |
| `gratuita` | `ISENTO` |

Distribuição real em produção antes da migration: `paga` (2283),
`bolsa_integral` (1), `permuta` (1), `gratuita` (1). Nenhuma linha usava
`bolsa_parcial` — mapeamento 1:1 sem perda ou ambiguidade de dado.

Migrations: `supabase/migrations/202609220001_tipo_vaga_v2.sql` (troca de
enum + backfill) e `202609220002_tipo_vaga_filho_professora_50.sql` (inclui
`FILHO_PROFESSORA` na constraint de 50%). Aplicadas em local (Docker) e
produção (Supabase Cloud).

## Impacto no código

Todo local que lia/gravava o enum antigo foi atualizado — ver lista completa
no commit `feat(matriculas): novo enum tipo_vaga e tela de edicao completa
na grid`. Pontos principais:

- `src/lib/data/dashboard-executive.ts`, `bolsistas.ts`,
  `alunos-sem-valor-constants.ts`, `alunos-com-desconto-constants.ts` —
  tipos, labels e lógica de desconto/isenção reescritos para o novo enum.
- `src/lib/server/generate-charges.ts` — `BOLSA_INTEGRAL`,
  `FILHO_PROFESSORA_INTEGRAL`, `PERMUTA`, `ISENTO` pulam geração de
  cobrança; `BOLSA_50_PORCENTO` e `FILHO_PROFESSORA` aplicam desconto de 50%
  na mensalidade.
- `src/lib/actions/academics.ts` — `createEnrollmentAction` grava
  `tipo_vaga`/`percentual_bolsa`; nova action `updateEnrollmentFullAction`
  edita série/turma/plano/tipo de vaga/status de uma matrícula; nova action
  `toggleEnrollmentStatusAction` alterna só ativa↔cancelada.

## UI — grid de `/matriculas`

- **Form "Nova matrícula"**: ganhou campo "Tipo de vaga" (default `NORMAL`).
- **Filtro**: novo combo "Tipo da vaga" ao lado dos chips de status; busca
  por aluno/matrícula movida para linha própria abaixo (evita desalinhar o
  combo com os chips quando a busca cresce).
- **Grid**: nova coluna "Tipo de vaga" (badge, só leitura). Botão "Editar"
  (ícone lápis) na coluna Ações abre `MatriculaFullEditDialog`
  (`src/components/matriculas/matricula-full-edit-dialog.tsx`) com todos os
  campos editáveis: Série, Turma, Plano, Tipo de vaga, Status.
- **Status na grid**: o combo de 4 status + botão "Salvar" foi substituído
  por um ícone de toggle (Power/PowerOff) que alterna só entre `ativa` e
  `cancelada` — `transferida`/`concluida` não são mais editáveis por essa
  ação rápida (o dialog completo ainda cobre esses casos via campo Status).
- **Histórico/Ficha**: viraram ícones inline (`Eye`/`FileText`), mesmo
  padrão já usado na grid de Alunos (`aluno-row-actions.tsx`).

## Out of scope

- Descoberta da tela Financeiro > Alunos sem valor no menu (ainda sem link
  no topbar — acesso continua só por URL direta).
- Aprovação/workflow de concessão de bolsa.
- Limite máximo de bolsas por etapa.

## Critério de pronto

- [x] Migration do enum aplicada em local e produção, dados verificados
- [x] Todos os usos do enum antigo atualizados (constantes, actions, UI)
- [x] Campo "Tipo de vaga" no cadastro de nova matrícula
- [x] Coluna + filtro "Tipo de vaga" na grid de matrículas
- [x] Dialog de edição completa (série/turma/plano/tipo de vaga/status)
- [x] Toggle ativa/cancelada substitui combo de status + Salvar
- [x] Ícones substituem botões de texto (Histórico/Ficha)
- [x] `npm run typecheck && npm run build` verdes
- [x] `npm run test` verde (508 testes)
- [x] Validação visual em produção (login real, dialog aberto e cancelado
      sem gravar, sem alterar dados de alunos reais)
