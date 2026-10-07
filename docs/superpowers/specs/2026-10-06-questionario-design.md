# Módulo Questionário — design

Data: 2026-10-06 · Revisado após a implementação (PR #43) e o ajuste de escala padrão (PR #44).
Plano: `docs/superpowers/plans/2026-10-06-questionario.md`

## Objetivo

Cadastros do módulo Questionário (existente no sistema legado, telas de referência
fornecidas pelo usuário): **Grupo de Questão**, **Escala**, **Questão** e **Questionário**.
Uso pedagógico (ex.: "Quadro de objetivos de aprendizagem e desenvolvimento — Infantil 3").

## Fora de escopo

- **Responder** questionário (professor preenche por aluno/turma/bimestre). Ciclo seguinte,
  na mesma app com role `professor` (não existe portal separado), padrão de
  `avaliacoes/lancamento`.
- Relatórios sobre respostas.
- Tipo **Questão de Matriz Descritiva**: existe no enum e no select, sem configuração
  (fase 2). Salva só os campos base.
- Reordenação por drag-and-drop (usa botões ↑↓).
- Exclusão física: ativar/inativar apenas (coluna `ativo`; em `questoes`, `ativa`).
- Seções da Ficha Avaliativa e Associação da Série ao Questionário: ver `docs/superpowers/specs/2026-10-06-secoes-associacoes-questionario-design.md` (extensão deste módulo).

## Decisões

- Layout segue o design system do projeto (`PageHeader`, `Panel`, `DataTable`,
  `ConfirmButton`), não o pixel do legado. As telas de referência definem campos e fluxo.
- **Escala** é um catálogo reutilizável (ex.: Não observado / Em desenvolvimento /
  Desenvolvido) cadastrado em tela própria.
- **Escala padrão na questão** (`questoes.escala_id`, obrigatória em `objetiva_escala`): o
  cadastro da questão escolhe a escala e mostra suas opções, como no sistema legado. A lista
  de questões tem a coluna Escala. Ao adicionar a questão ao questionário, o vínculo já vem
  com essa escala, que ainda pode ser **trocada por questionário**
  (`questionario_questoes.escala_id`). A versão inicial só escolhia a escala no questionário;
  a escala padrão foi acrescentada depois (PR #44).
- Ativar/inativar com `useAction({ confirm })` (`BotaoAtivar`); nunca `confirm()` nativo.
- RBAC: admin e secretaria com acesso total; financeiro e professor sem acesso. O módulo
  `questionario.responder` (professor) nasce no ciclo de resposta.
- No form do questionário, **Questão = "Todos"** adiciona todas as questões ativas do grupo
  escolhido (ou de todos os grupos, se o grupo também for "Todos"), comportamento da tela
  legada.

## Modelo de dados

Migrations `202610060001_questionario.sql` (tabelas, RLS, RBAC) e
`202610060002_questao_escala_padrao.sql` (`questoes.escala_id`). RLS por `escola_id`
(mesmo padrão de `declaracao_modelos`: policy `service_role` + policy `authenticated` via
`current_perfil()`; tabelas filhas via `exists` no pai), `updated_at` via `set_updated_at()`.
Descrição de grupo e de escala é única por escola, sem diferenciar caixa
(`unique (escola_id, lower(descricao))`).

| Tabela | Campos |
|---|---|
| `questao_grupos` | id, escola_id, codigo serial, descricao, ativo |
| `escalas` | id, escola_id, descricao, ativo |
| `escala_opcoes` | id, escala_id, rotulo, ordem |
| `questoes` | id, escola_id, grupo_id, tipo (enum), pergunta, ativa, obrigatoria, limitar_caracteres, qtde_caracteres, qtde_linhas, **escala_id** (nullable; escala padrão) |
| `questao_alternativas` | id, questao_id, rotulo, ordem |
| `questionarios` | id, escola_id, descricao, observacoes, ativo |
| `questionario_questoes` | id (uuid PK), questionario_id, questao_id, escala_id (nullable), ordem; unique (questionario_id, questao_id) |

Enum `questao_tipo`: `subjetiva`, `objetiva_unica`, `objetiva_multipla`, `objetiva_escala`,
`matriz_descritiva`.

`questionario_questoes` tem PK própria porque respostas futuras apontam para ela
("questão X, escala Y, no questionário Z"). `questoes.escala_id` é nullable porque questões
anteriores ao PR #44 ficaram sem escala padrão até serem editadas.

### Regras

- Subjetiva usa `limitar_caracteres` / `qtde_caracteres` / `qtde_linhas`; os demais tipos
  ignoram (gravados como false/0).
- `objetiva_unica` e `objetiva_multipla` exigem ≥ 2 alternativas distintas.
- `objetiva_escala`: escala padrão obrigatória na questão; no vínculo
  (`questionario_questoes`) a escala também é obrigatória. Outros tipos: `escala_id` null nos dois.
- Tipo da questão **não muda** se ela já está em algum questionário.
- Grupo/questão/escala inativos não aparecem para novo vínculo, mas permanecem nos
  questionários existentes. O servidor aplica o mesmo: grupo e escala inativos só passam se
  já eram os atuais; questão inativa só passa em vínculo já existente; grupo ou escala
  inexistentes (ou de outra escola) são recusados.
- Escala com opções: ≥ 2 opções, rótulos distintos.
- **Clonar** questionário: nova linha com descrição `"<original> (cópia)"`, `ativo=false`,
  copia todos os vínculos (questão, escala, ordem).
- Ordem das questões: ordem de inclusão; ↑↓ reordena; remover renumera.
- Salvar um questionário casa os vínculos pelo id (e mesma questão) ou, na falta, pela
  questão; grava na ordem inserir → atualizar → remover, para que uma falha deixe vínculos a
  mais, nunca questões perdidas.
- Futuro (não construído): questionário com resposta fica travado para editar/remover
  questão; só clonar.

### Limitações conhecidas

- Criar e clonar compensam falha parcial (apagam o registro recém-criado). **Atualizar**
  questão ou escala não é transacional (grava o registro e depois as alternativas/opções); a
  correção real é uma RPC transacional. Repetir o salvar converge.
- Alternativas e opções de escala são recriadas, com ids novos, a cada gravação. Rever antes
  do ciclo de respostas, se elas passarem a referenciar esses ids.
- A RLS das tabelas filhas olha só o pai; a validação de grupo/escala/questão vinda do cliente
  é feita nas actions.

## Telas

Rotas em `src/app/(app)/questionario/`:

| Rota | Conteúdo |
|---|---|
| `/grupos` | Tela única: Descrição* + Cadastrar; tabela Código/Descrição, pesquisa, editar, toggle ativo |
| `/escalas` | Tela única como grupos; o form tem a lista de opções (rótulo + ↑↓) |
| `/questoes` | Lista Tipo / Grupo / Pergunta / **Escala**, pesquisa, editar, toggle ativa. Botão Cadastrar |
| `/questoes/nova`, `/questoes/[id]/editar` | Grupo*, Tipo*, Está Ativa, É Obrigatória, Pergunta*; campos extras por tipo (Subjetiva: limitar/qtde caracteres/qtde linhas; Única/Múltipla: alternativas; **Com Escala: Escala\* com as opções exibidas**). Em uso, o tipo fica travado |
| `/questionarios` | Lista Descrição, pesquisa, clonar, editar, toggle ativo. Botão Cadastrar |
| `/questionarios/novo`, `/[id]/editar` | Descrição*, Ativo, Observações; seção "Questões adicionadas": Grupo → Questão (Todos) + Adicionar; tabela Grupo / Tipo / Questão / Escala (select, já preenchido com a escala padrão da questão) + ↑↓ + remover |

Filtro Grupo→Questão no form do questionário: client-side sobre a lista de questões ativas
já carregada.

## Código

- `src/lib/validation/questionario.ts` — schemas zod (grupo, escala, questão, questionário),
  tipos e rótulos.
- `src/lib/questionario/` — regras puras e apoio: `lista.ts`, `vinculos.ts` (normalizar,
  diff, "Todos"), `clone.ts`, `filhos.ts` (troca de opções/alternativas, grava antes de
  apagar), `ativo.ts`, `acesso.ts`, `tipos.ts`, `test-support.ts` (fake de Supabase só para testes).
- `src/lib/actions/questionario-{grupos,escalas,questoes,questionarios}.ts` — server actions:
  `requirePermission`, `assertOk`, `revalidatePath`; retornam `ActionResult`.
- `src/lib/data/questionario.ts` — queries.
- `src/components/questionario/` — componentes de lista/form.
- Menu: `src/components/layout/topbar.tsx` (array hardcoded) → item "Questionário" irmão de
  "Acadêmico" em `SECRETARIA_ITEMS` (o dropdown só suporta 2 níveis), com filhos Grupo de
  Questão, Escala, Questão, Questionário.
- O `tsconfig` tem `target: es5`: nada de `for…of` em Map/Set/iteradores nem spread de Set/Map
  nesse módulo.

## RBAC

Módulos em `modulos` (grupo `academico`): `questionario.grupo`, `questionario.escala`,
`questionario.questao`, `questionario.questionario`. `role_permissoes`: admin e secretaria
`true` nas 4 colunas; financeiro e professor `false`. Rotas mapeadas em
`ROTA_PARA_MODULO` (com teste em `src/lib/auth/questionario-rbac.test.ts`).

## Testes e entrega

- Vitest: validação por tipo; vínculos e clone; actions com fake de Supabase (inclui
  compensação de falha parcial, tipo em uso, escala/grupo inativos, ordem de gravação);
  formulários de questão e de questionário.
- `npm run typecheck && npm run build` verdes; `npm run test` antes do PR (hoje há 1
  *unhandled error* antigo em `src/lib/hooks/use-action.test.tsx`, fora deste módulo).
- **Deploy exige `supabase db push --linked`** (a Vercel não aplica migrations). Sem a
  migration, as telas quebram com o erro genérico de Server Component. Aconteceu no PR #43.
- `db reset --local` quebra por bug de ordem de migrations preexistente; validar a migration
  por revisão e `db push`.
