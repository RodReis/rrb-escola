# Módulo Questionário — design

Data: 2026-10-06 · Branch: `feat/questionario`

## Objetivo

Cadastros do módulo Questionário (hoje existente no sistema legado, telas de referência
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
- Exclusão física: ativar/inativar apenas (coluna `ativo`).

## Decisões

- Layout segue o design system do projeto (`PageHeader`, `Panel`, `DataTable`,
  `ConfirmButton`), não o pixel do legado. As telas de referência definem campos e fluxo.
- **Escala** é um catálogo reutilizável (ex.: Não observado / Em desenvolvimento /
  Desenvolvido) cadastrado em tela própria. A escala é escolhida **ao adicionar a questão
  no questionário**, não na questão: a mesma pergunta pode ter escalas diferentes por
  questionário.
- Ativar/inativar com `ConfirmButton`/`useConfirm`; nunca `confirm()` nativo.
- RBAC: admin e secretaria com acesso total; financeiro e professor sem acesso. O módulo
  `questionario.responder` (professor) nasce no ciclo de resposta.

## Modelo de dados

Migration `supabase/migrations/202610060001_questionario.sql`. RLS por `escola_id`
(mesmo padrão de `declaracao_modelos`: policy `service_role` + policy `authenticated` via
`current_perfil()`), `updated_at` via `set_updated_at()`.

| Tabela | Campos |
|---|---|
| `questao_grupos` | id, escola_id, codigo serial, descricao, ativo |
| `escalas` | id, escola_id, descricao, ativo |
| `escala_opcoes` | id, escala_id, rotulo, ordem |
| `questoes` | id, escola_id, grupo_id, tipo (enum), pergunta, ativa, obrigatoria, limitar_caracteres, qtde_caracteres, qtde_linhas |
| `questao_alternativas` | id, questao_id, rotulo, ordem |
| `questionarios` | id, escola_id, descricao, observacoes, ativo |
| `questionario_questoes` | id (uuid PK), questionario_id, questao_id, escala_id (nullable), ordem; unique (questionario_id, questao_id) |

Enum `questao_tipo`: `subjetiva`, `objetiva_unica`, `objetiva_multipla`, `objetiva_escala`,
`matriz_descritiva`.

`questionario_questoes` tem PK própria porque respostas futuras apontam para ela
("questão X, escala Y, no questionário Z").

### Regras

- Subjetiva usa `limitar_caracteres` / `qtde_caracteres` / `qtde_linhas`; os demais tipos
  ignoram (gravados como false/0).
- `objetiva_unica` e `objetiva_multipla` exigem ≥ 2 alternativas.
- `objetiva_escala`: escala obrigatória em `questionario_questoes`. Outros tipos: `escala_id`
  null.
- Tipo da questão **não muda** se ela já está em algum questionário.
- Grupo/questão/escala inativos não aparecem para novo vínculo, mas permanecem nos
  questionários existentes.
- Escala com opções: ≥ 2 opções, rótulos distintos.
- **Clonar** questionário: nova linha com descrição `"<original> (cópia)"`, `ativo=false`,
  copia todos os vínculos (questão, escala, ordem).
- Ordem das questões: ordem de inclusão; ↑↓ reordena; remover renumera.
- Futuro (não construído): questionário com resposta fica travado para editar/remover
  questão; só clonar.

## Telas

Rotas em `src/app/(app)/questionario/`:

| Rota | Conteúdo |
|---|---|
| `/grupos` | Tela única: Descrição* + Cadastrar; tabela Código/Descrição, pesquisa, editar inline, toggle ativo |
| `/escalas` | Tela única como grupos; editar abre painel com opções (rótulo + ↑↓) |
| `/questoes` | Lista Tipo / Grupo / Pergunta, pesquisa, editar, toggle ativa. Botão Cadastrar |
| `/questoes/nova`, `/questoes/[id]/editar` | Grupo*, Tipo*, Está Ativa, É Obrigatória, Pergunta*; campos extras por tipo (Subjetiva: limitar/qtde caracteres/qtde linhas; Única/Múltipla: alternativas) |
| `/questionarios` | Lista Descrição, pesquisa, clonar, editar, toggle ativo. Botão Cadastrar |
| `/questionarios/novo`, `/[id]/editar` | Descrição*, Ativo, Observações; seção "Questões adicionadas": Grupo → Questão (Todos) + Adicionar; tabela Grupo / Tipo / Questão / Escala (select se tipo Escala) + ↑↓ + remover |

Filtro Grupo→Questão no form do questionário: client-side sobre a lista de questões ativas
já carregada.

## Código

- `src/lib/questionario/validacao.ts` — regras puras (por tipo, alternativas, escala,
  opções de escala), com testes.
- `src/lib/actions/questionario.ts` — server actions: `requirePermission`, `assertOk`,
  `revalidatePath`. Inclui `clonarQuestionarioAction`.
- `src/lib/data/questionario.ts` — queries.
- `src/components/questionario/` — componentes de lista/form.
- Menu: `src/components/layout/topbar.tsx` (array hardcoded) → Acadêmico → "Questionário"
  com filhos Grupo de Questão, Escala, Questão, Questionário.

## RBAC

Módulos em `modulos` (grupo `operacional`): `questionario.grupo`, `questionario.escala`,
`questionario.questao`, `questionario.questionario`. `role_permissoes`: admin e secretaria
`true` nas 4 colunas; financeiro e professor `false`.

## Testes e entrega

- Vitest: validação por tipo; clone (copia ordem/escala, vem inativo); bloqueio de troca de
  tipo em uso.
- `npm run typecheck && npm run build` verdes; `npm run test` antes do PR.
- **Deploy exige `supabase db push --linked`** (Vercel não aplica migrations).
- Atenção: `db reset --local` quebra por bug de ordem de migrations preexistente; validar a
  migration por revisão e `db push`.
