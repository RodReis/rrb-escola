# Seções da Ficha Avaliativa e Associação ao Questionário — design

Data: 2026-10-06 · Estende o módulo Questionário
(`docs/superpowers/specs/2026-10-06-questionario-design.md`, PRs #43/#44).

## Objetivo

Dois cadastros novos em `/questionario/*`, no mesmo padrão dos anteriores, a partir das telas
do sistema legado:

1. **Seção da Ficha Avaliativa**: catálogo (ex.: "Desenvolvimento cognitivo", "Expressão
   corporal", "Registro de avanços e dificuldades") com a opção "Permite lançamento coletivo".
2. **Associação da Série ao Questionário**: diz **qual questionário, em qual turma, em qual
   etapa (bimestre) e quem (professor) vai preencher**. É a base do ciclo seguinte, em que o
   professor responde a ficha.

## Fora de escopo

- O professor **responder** a ficha e o uso de "permite lançamento coletivo" (esse flag só é
  gravado e listado agora).
- Ligar Seção a questão ou a questionário (decisão: cadastro isolado nesta entrega).
- Gerar associações automaticamente a partir das turmas; ações em lote na lista (o lote é só
  na criação); exclusão física (só ativar/inativar).

## Decisões

- **Seção = cadastro isolado**, igual ao Grupo de Questão: tela única (formulário no topo +
  lista), editar, ativar/inativar. Campo extra `permite_lancamento_coletivo` (Sim/Não, padrão
  Não), com o `Switch` do DS.
- **Associação em lote na criação**: o cadastro escolhe Ano, Série, Questionário, Professor,
  várias Etapas (1ª a 4ª) e várias Turmas (ou todas da série/ano); o sistema cria todas as
  combinações etapa × turma e ignora as que já existem. Editar e ativar/inativar são por linha.
- **Ano e Série não são gravados**: vêm de `turmas.ano_letivo` e `turmas.serie_id`. Eles só
  servem para estreitar as turmas no cadastro e para filtrar a lista.
- **Professor = funcionário do RH** (`employees`), não `perfis`: é o que a escola reconhece
  pelo nome (e funciona mesmo sem login criado). Lista de candidatos: a mesma de
  `listProfessores()` (`school_category in ('fund1','fund2','medio')`, ativos). O ciclo de
  resposta resolve o usuário de login por `employees.perfil_id` (já existe, preenchido por
  e-mail na migration de relatórios dinâmicos).
- **Etapa** = 1 a 4 (bimestre), como em `avaliacoes.bimestre`.
- RBAC: dois módulos novos, `questionario.secao` e `questionario.associacao`; admin e
  secretaria com acesso total; financeiro e professor sem acesso (como os demais).

## Modelo de dados

Migration `supabase/migrations/202610060003_secoes_associacoes_questionario.sql`. RLS por `escola_id`, mesmo
padrão do módulo (policy `service_role` + `authenticated` via `current_perfil()`),
`updated_at` via `set_updated_at()`.

| Tabela | Campos |
|---|---|
| `ficha_secoes` | id, escola_id, codigo serial, descricao, permite_lancamento_coletivo (bool, padrão false), ativo |
| `questionario_associacoes` | id, escola_id, questionario_id (restrict), turma_id (restrict), etapa (smallint, 1 a 4), professor_id → `employees(id)` (restrict), ativo |

- `ficha_secoes`: descrição única por escola, ignorando caixa (`unique (escola_id, lower(descricao))`).
- `questionario_associacoes`: único em `(questionario_id, turma_id, etapa, professor_id)`;
  índices por `turma_id` e `professor_id`. Dois professores na mesma turma e etapa podem
  coexistir; troca de professor = inativar e criar outra.

### Regras (validadas no servidor)

- Seção: descrição obrigatória (aparada); duplicada vira "Já existe um registro…".
- Associação nova (e mudança de questionário, turma ou professor na edição): questionário
  **ativo**, turma **ativa**, professor **ativo** e da lista de candidatos acima, todos da
  mesma escola (leitura pela RLS). Etapa 1 a 4. Nada disso é exigido de associações já
  gravadas quando o questionário, a turma ou o professor forem inativados depois (a linha
  continua, e só edição que troque o campo revalida).
- **Lote:** `combinarAssociacoes` (função pura) recebe etapas, turmas e as associações
  existentes e devolve `criar` e `ignoradas`. A action grava `criar` com um único insert e
  responde "N criadas, M já existiam". Sem etapa ou sem turma marcada: erro, sem gravar.
- Falha parcial: o insert único é atômico; ler as existentes e inserir não é transacional, e a
  corrida entre duas secretarias cai na unique e vira a mensagem amigável (repetir completa).

## Telas

Rotas em `src/app/(app)/questionario/`:

| Rota | Conteúdo |
|---|---|
| `/secoes` | Como `/grupos`: Descrição\* + "Permite lançamento coletivo" + Cadastrar; lista Código / Descrição / Permite lançamento coletivo / Situação, pesquisa, editar, ativar/inativar |
| `/associacoes` | Formulário de lote (Ano, Série, Questionário, Professor, Etapas 1ª a 4ª, Turmas com "todas") e lista com filtros Ano, Etapa, Série, Turma, Questionário, Professor + pesquisa; colunas Ano / Etapa / Questionário / Série / Turma / Professor / Situação; editar e ativar/inativar por linha |

- Editar uma associação reabre o formulário em modo unitário (uma etapa, uma turma) e troca
  questionário, etapa, turma e professor, um de cada vez.
- Filtros da lista: client-side sobre as associações carregadas (a escola tem poucas
  centenas). Ano padrão = ano letivo mais recente com turmas.
- Menu: dois filhos novos no item "Questionário": "Seção da Ficha" e "Associação
  Série/Questionário".

## Código

- `src/lib/validation/questionario.ts`: `SecaoSchema`, `AssociacaoLoteSchema`,
  `AssociacaoEdicaoSchema`.
- `src/lib/questionario/associacoes.ts`: `combinarAssociacoes` (puro, com teste).
- `src/lib/questionario/ativo.ts`: aceita as duas tabelas novas.
- `src/lib/actions/questionario-secoes.ts` e `questionario-associacoes.ts` (`requirePermission`,
  `assertOk`, `revalidatePath`, retornam `ActionResult`).
- `src/lib/data/questionario.ts`: `listarSecoes`, `listarAssociacoes`, e reuso de
  `listProfessores` e `getAcademicData` (turmas/séries).
- `src/components/questionario/`: `secoes-manager`, `associacoes-lote-form`, `associacoes-lista`.
- `src/lib/auth/permissions.ts`: módulos e rotas; teste de RBAC das rotas novas.
- O `tsconfig` tem `target: es5`: nada de `for…of` em Map/Set nem spread de Set/Map.

## Testes e entrega

- Vitest: `combinarAssociacoes`; schemas; actions com o fake de Supabase (permissão por
  módulo/ação, escola, ativo/inativo, duplicado, lote com existentes); formulário de lote
  (turmas filtradas por ano e série, "todas", etapas, envio).
- `npm run typecheck && npm run build` verdes; `npm run test` antes do PR.
- **Deploy exige `supabase db push --linked`** antes ou junto do merge (a Vercel não aplica
  migrations). Registrar isso no PR.
- `db reset --local` quebra por bug antigo de ordem de migrations: validar por revisão e `db push`.
