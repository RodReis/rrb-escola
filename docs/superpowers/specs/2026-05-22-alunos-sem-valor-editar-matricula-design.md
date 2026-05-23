# Editar matrícula na tela Alunos sem valor — Design

**Data:** 2026-05-22
**Status:** Aprovado para implementação
**Depende de:** [2026-05-22-alunos-sem-valor-matricula-design.md](2026-05-22-alunos-sem-valor-matricula-design.md) (feature já implementada)

## Objetivo

Permitir que o financeiro corrija, direto na tela "Alunos sem valor de
matrícula", os dados que fazem um aluno aparecer ali: tipo de vaga, plano,
série/turma e status da matrícula. A grid passa também a listar alunos ativos
**sem matrícula no ano corrente**, e o editor cria a matrícula 2026 nesses
casos.

A edição/criação acontece num modal aberto a partir de cada linha.

## Contexto do modelo de dados

Achados que moldam o design:

- `tipo_vaga` e `percentual_bolsa` são colunas de `matriculas`. O "Motivo"
  exibido na grid é **derivado** de `tipo_vaga` + plano — não é coluna.
- `createStudentAction` (`src/lib/actions/students.ts`) grava `tipo_vaga` /
  `percentual_bolsa` na matrícula e chama `generateChargesForEnrollment`.
  As funções `readTipoVaga` / `readPercentualBolsa` desse arquivo validam
  esses campos.
- `createEnrollmentAction` / `updateEnrollmentAction`
  (`src/lib/actions/academics.ts`) **não** mexem em `tipo_vaga`.
- A grid atual (`getAlunosSemValor`) parte de `matriculas` filtrando
  `ano_letivo=2026` + `status='ativa'` — logo só lista quem já tem matrícula
  no ano. Para o caso "criar matrícula" fazer sentido, a query precisa
  partir de `alunos`.
- O projeto só tem `confirm-dialog.tsx` (confirmação), sem componente de
  dialog genérico para formulários.

## Decisões

| Tema | Decisão |
|---|---|
| Escopo da grid | Passa a incluir alunos ativos **sem matrícula 2026** (novo motivo `sem_matricula`) |
| Ação do modal | Edita a matrícula 2026 existente, OU cria uma se inexistente |
| Campos editáveis | `tipo_vaga` (+ `percentual_bolsa`), `plano_id`, `serie_id`/`turma_id`, `status` |
| Criar matrícula | **Não** gera cobranças (não chama `generateChargesForEnrollment`) |
| Editar matrícula | **Não** mexe em cobranças já geradas |
| UI | Modal/dialog client-side na própria grid |
| Permissão | `matriculas` — `update` para editar, `create` para criar |
| Componente de dialog | Criar `Dialog` genérico reutilizável (`src/components/ui/dialog.tsx`) |

## Arquitetura

### Arquivos novos

| Arquivo | Papel |
|---|---|
| `src/components/ui/dialog.tsx` | Componente `Dialog` genérico — portal, backdrop, ESC, click-outside, botão X, foco. Apenas o shell; sem lógica de formulário. Extraído do padrão de `confirm-dialog.tsx`. |
| `src/lib/actions/alunos-sem-valor.ts` | Server action `upsertMatriculaSemValorAction` — cria ou atualiza a matrícula 2026. |
| `src/components/finance/matricula-edit-dialog.tsx` | Client component — botão "Editar" na linha + modal com o formulário. |

### Arquivos modificados

| Arquivo | Mudança |
|---|---|
| `src/lib/data/alunos-sem-valor-constants.ts` | `MotivoSemValor` ganha `'sem_matricula'`; `MOTIVO_LABEL` e `motivoTone` cobrem o novo valor; `AlunoSemValorRow` ganha `alunoId`, `serieId`, `turmaId`; `matriculaId` passa a `string \| null`. `deriveMotivo`/`buildRow` ajustados. |
| `src/lib/data/alunos-sem-valor.ts` | `getAlunosSemValor` reescrita para partir de `alunos` (left join `matriculas`). |
| `src/lib/data/alunos-sem-valor.test.ts` | Novos casos: `sem_matricula`, `matriculaId` null. |
| `src/app/(app)/financeiro/alunos-sem-valor/page.tsx` | Carrega `series`/`turmas`/`planos`, passa para o dialog; nova coluna "Ações" com botão Editar; +KPI "Sem matrícula"; passa flag de permissão de escrita. |
| `src/components/finance/export-alunos-sem-valor-button.tsx` | Trata `matriculaId` null e linhas `sem_matricula` (série/turma vazias) — sem quebrar o export. |

## Camada de dados

### `getAlunosSemValor` reescrita

Parte de `alunos` em vez de `matriculas`:

```
alunos
  filtro: ativo = true, escola_id = DEFAULT_SCHOOL_ID
  left join matriculas (ano_letivo = 2026, status = 'ativa')
    embed: tipo_vaga, plano_id, status,
           planos(valor_matricula),
           turmas(id, nome, serie_id, series(id, nome, ordem))
  embed: responsaveis_aluno(nome, parentesco, telefone, celular,
                            responsavel_financeiro)
```

O `left join` faz a matrícula 2026 ser opcional. Supabase: a matrícula
filtrada vem como relação embutida em `alunos`; quando não há matrícula 2026 a
relação vem vazia. Casts de fronteira (`as unknown as`) seguem o padrão já
usado no arquivo.

### Regra de inclusão (filtro em JS, via `buildRow`)

Um aluno entra na grid se:

- **não tem matrícula 2026** → motivo `sem_matricula`; OU
- tem matrícula 2026 e ela é `sem_valor` (sem plano / valor 0) ou
  `tipo_vaga !== 'paga'` (lógica atual).

Aluno ativo com matrícula 2026 `paga` e plano válido → **não entra**.

### Motivo

`MotivoSemValor = 'sem_matricula' | 'sem_valor' | 'bolsa_integral' |
'bolsa_parcial' | 'permuta' | 'gratuita'`

`MOTIVO_LABEL.sem_matricula = "Sem matrícula"`.
`motivoTone('sem_matricula') = 'danger'` (cadastro incompleto, ação
necessária — mesmo tom de `sem_valor`).

`deriveMotivo` ganha um parâmetro indicando ausência de matrícula; quando não
há matrícula retorna `sem_matricula`. Precedência inalterada para os demais
casos (tipo_vaga não-paga vence `sem_valor`).

### `AlunoSemValorRow` — campos

| Campo | Mudança |
|---|---|
| `alunoId` | **novo** — sempre presente (a grid agora parte de alunos) |
| `matriculaId` | passa a `string \| null` (null quando `sem_matricula`) |
| `serieId` | **novo** — `string \| null`, para pré-preencher o modal |
| `turmaId` | **novo** — `string \| null`, para pré-preencher o modal |
| `serie`, `turma` | string vazia/`—` quando não há matrícula |
| demais | inalterados |

### Filtros

- `nome` — `ilike` (inalterado).
- `motivo` — pós-derivação; passa a aceitar `sem_matricula`.
- `serieId` / `turmaId` — filtro em JS pós-`buildRow` (já é assim). Alunos sem
  matrícula não têm série/turma, então um filtro de série/turma ativo
  naturalmente os exclui.

### Ordenação

`serieOrdem` ascendente → `nome`. Alunos sem matrícula usam `serieOrdem`
fallback (`9999`) — caem ao fim, ordenados por nome.

### KPIs

Total · Sem matrícula · Sem valor · Bolsistas · Permuta/Gratuita.

## Server action — `upsertMatriculaSemValorAction`

Arquivo novo `src/lib/actions/alunos-sem-valor.ts`. Uma action; decide
create vs update pela presença de `matricula_id` no `FormData`.

Arquivo separado (não `academics.ts`) porque `academics.ts` já é grande, suas
enrollment actions não tocam `tipo_vaga`, e esta action tem semântica própria
(upsert + sem geração de cobranças).

### Campos lidos do `FormData`

`matricula_id` (vazio = criar), `aluno_id`, `serie_id`, `turma_id`,
`plano_id`, `tipo_vaga`, `percentual_bolsa`, `status`.

### Validação

- `tipo_vaga`: validado contra o enum (`paga`, `bolsa_integral`,
  `bolsa_parcial`, `permuta`, `gratuita`); default `paga`. Mesma lógica de
  `readTipoVaga` em `students.ts` — extrair/reaproveitar conforme couber.
- `percentual_bolsa`: 1–99 obrigatório quando `tipo_vaga = bolsa_parcial`;
  0 caso contrário. Mesma regra de `readPercentualBolsa`.
- Criar exige `serie_id` **e** `turma_id` (matrícula não existe sem eles) —
  erro se faltar.
- `status`: validado contra o enum de `status_matricula`; default `ativa`.

### Update (`matricula_id` presente)

- `requirePermission("matriculas", "update")`.
- `update` em `matriculas` dos campos: `tipo_vaga`, `percentual_bolsa`,
  `plano_id`, `serie_id`, `turma_id`, `status`.
- `.eq("id", matriculaId).eq("escola_id", DEFAULT_SCHOOL_ID)`.
- **Não** toca em cobranças.

### Create (`matricula_id` vazio)

- `requirePermission("matriculas", "create")`.
- `insert` em `matriculas`: `escola_id`, `aluno_id`, `serie_id`, `turma_id`,
  `plano_id`, `tipo_vaga`, `percentual_bolsa`, `ano_letivo = 2026`,
  `status = 'ativa'`, `data_matricula = hoje`, `codigo` derivado
  (ex.: `<matricula_codigo do aluno>-2026`, seguindo o padrão de
  `createStudentAction`).
- **Não** chama `generateChargesForEnrollment`.

### Retorno e revalidação

- Retorna `{ error?: string }` (padrão de `rematricularAlunoAction`). Erro de
  validação volta como string para exibição no modal.
- `revalidatePath`: `/financeiro/alunos-sem-valor`, `/financeiro`,
  `/matriculas`, `/alunos/${alunoId}`.

## Componentes UI

### `Dialog` genérico — `src/components/ui/dialog.tsx`

Client component. Extrai a mecânica de `confirm-dialog.tsx`:

```
<Dialog open title onClose>{children}</Dialog>
```

- `createPortal` para `document.body`.
- Backdrop `bg-ink/30 backdrop-blur-[2px]`; click no backdrop fecha.
- ESC fecha. Botão X no canto. `role="dialog"`, `aria-modal`.
- Apenas o shell — sem lógica de formulário.

### `MatriculaEditDialog` — `src/components/finance/matricula-edit-dialog.tsx`

Client component. Props: a linha (`AlunoSemValorRow`) + listas `series`,
`turmas` (com `serie_id`), `planos`.

- Botão "Editar" na linha; estado `open` controla o `Dialog`.
- Dentro do `Dialog`, `<form action={upsertMatriculaSemValorAction}>`:
  - hidden: `aluno_id`; `matricula_id` (vazio quando `matriculaId` null).
  - selects: tipo de vaga, plano, série, turma, status — pré-preenchidos com
    os valores atuais da linha.
  - `percentual_bolsa`: input numérico exibido apenas quando o tipo
    selecionado é `bolsa_parcial` (toggle client-side com `useState`).
  - select de turma filtra pelas turmas da série escolhida (client-side, a
    partir da lista completa).
- Título dinâmico: "Editar matrícula" quando há `matriculaId`; "Criar
  matrícula 2026" quando `matriculaId` é null.
- Erro retornado pela action exibido no topo do form.
- Submit bem-sucedido fecha o modal; `revalidatePath` atualiza a grid.

### Página `/financeiro/alunos-sem-valor`

- Já chama `getAcademicData()` — passa `series`, `turmas`, `planos` para cada
  `MatriculaEditDialog`.
- Nova coluna "Ações" com o botão Editar.
- Novo KPI "Sem matrícula".
- `requirePermission("relatorios", "read")` continua sendo o gate de leitura
  da página. Para o botão Editar: a página usa o `Session` retornado por
  `requirePermission` e checa `can(session.permissions, "matriculas",
  "update")` (ou `perfil === "admin"`); passa o booleano ao dialog. Sem
  permissão de escrita, o botão não renderiza. A própria action revalida a
  permissão no servidor de qualquer forma.

### Filtros

`alunos-sem-valor-filters.tsx`: a opção `sem_matricula` aparece
automaticamente no dropdown de motivo (vem de `MOTIVO_LABEL`).

## Tratamento de erros / edge cases

- Aluno sem matrícula 2026 → linha com `matriculaId` null, série/turma
  vazias, motivo `sem_matricula`; modal abre em modo "Criar".
- Criar sem série ou turma → action retorna erro; modal exibe a mensagem.
- `bolsa_parcial` com percentual fora de 1–99 → action retorna erro.
- Usuário sem permissão `matriculas` → botão Editar não renderiza; action
  bloqueia no servidor caso seja chamada diretamente.
- Export Excel: linha `sem_matricula` exporta com série/turma vazias e Motivo
  "Sem matrícula" — sem quebrar.

## Testes

- `alunos-sem-valor.test.ts` — novos casos para `buildRow` / `deriveMotivo`:
  - aluno sem matrícula 2026 → motivo `sem_matricula`, `matriculaId` null
  - aluno com matrícula `bolsa_integral` → inalterado
  - `motivoTone('sem_matricula')` → `danger`
  - `serieId`/`turmaId` presentes na linha quando há matrícula; null quando não
- Verificação manual:
  - abrir o modal numa linha com matrícula → editar `tipo_vaga` → linha sai da
    grid (ou muda de motivo) após salvar
  - abrir o modal numa linha `sem_matricula` → criar matrícula → aluno some da
    grid; matrícula aparece em `/matriculas`; nenhuma cobrança gerada
  - editar `bolsa_parcial` com percentual inválido → erro no modal
  - usuário sem permissão `matriculas` não vê o botão Editar

## Fora de escopo

- Geração ou recálculo de cobranças (criar e editar não tocam cobranças).
- Edição de dados do aluno (nome, responsáveis) — só a matrícula.
- Exclusão de matrícula.
- Anos letivos diferentes de 2026.
