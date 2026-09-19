# Filtro de Série/Turma em Alunos + normalização de turmas e matrículas

**Data:** 2026-09-11
**Tipo:** Feature + correção de dados
**Status:** Aplicado em produção

## Objetivo

Adicionar filtro por Série e Turma na Lista de Alunos. No processo, apareceram
turmas duplicadas e matrículas com ano letivo divergente — corrigidas no
banco de produção, com migration versionada.

## O que mudou na UI

**Lista de Alunos** (`src/app/(app)/alunos/page.tsx`,
`src/components/students/student-filters.tsx`):

- Dois combos novos na barra de filtros: **Série** e **Turma**.
  - Série agrupa por nível (Educação Infantil, Fundamental I, Fundamental II,
    Ensino Médio), ordenado pelo campo `ordem` da série.
  - Turma agrupa por turno (lendo `turmas.turno`, não o nome da turma), lista
    só turmas da série escolhida, e fica desabilitado quando não há turma
    aplicável.
  - Escolher um segmento nas abas (Infantil/Fund.I/Fund.II/Médio) restringe
    as séries do combo e limpa série/turma selecionados.
  - Sem série filtrada, o rótulo da turma prefixa o nome da série (`3º ANO ·
    A`), porque várias turmas repetem o mesmo nome curto.
- Toolbar reestruturada em duas linhas fixas: segmento + série + turma em
  cima, busca em barra larga embaixo — não depende mais de quebra
  automática por largura de viewport.

**Componente reutilizado:** `FilterDropdown` (`src/components/ui/filter-dropdown.tsx`)
ganhou suporte a `group` (agrupamento visual com cabeçalho) e `disabled`. API
anterior não quebrou — usado em outros lugares sem alteração.

**Dado já existia, só faltava plugar:** `getStudentFilterOptions()` em
`src/lib/data/students.ts` já estava escrita e sem uso; o filtro por
`serieId`/`turmaId` em `listStudents()` também já existia.

## Bug encontrado e corrigido: card "Visão geral pedagógica"

`getPedagogicoOverview()` (`src/lib/data/pedagogico.ts`) contava matrícula
ativa de **qualquer ano letivo**, apesar do texto do card dizer "no ano
corrente" e da função já receber `anoLetivo` como parâmetro. Adicionado
`.eq("ano_letivo", anoLetivo)` nas duas consultas de matrícula.

Outras consultas em `src/lib/data/dashboard-executive.ts` têm o mesmo padrão
(filtram `status = 'ativa'` sem filtrar ano) e não foram tocadas — não
distorcem hoje porque a causa de dado foi corrigida, mas o padrão é frágil
se uma matrícula futura repetir o erro de ano.

## Migrations aplicadas em produção

### `202609110017_normaliza_turmas_duplicadas_2026.sql`

Seis turmas de 2026 (`MAT`, `A` × 4, `B`) duplicavam a turma canônica
`MATUTINO` da própria série — mesma série, mesmo turno, nome fora do padrão.
Nove matrículas ficaram presas nelas, dividindo alunos que na prática
estavam na mesma sala, e poluindo o combo de Turma.

A migration funde as duplicadas na canônica de mesma série+turno: move as
matrículas de 2026 e desativa (não apaga) as turmas duplicadas. Histórico de
anos anteriores continua apontando para os mesmos ids. Aborta a transação se
o destino for ambíguo (duas canônicas no mesmo turno) ou inexistente.

Testada antes em banco local com fixture recriando o cenário de produção.

### `202609120001_corrige_ano_letivo_matriculas_2025_ativas.sql`

Três matrículas ativas estavam gravadas com `ano_letivo = 2025` embora
apontassem para turma de 2026 e tivessem `data_matricula = 2026-01-01` — ano
digitado errado no cadastro, não histórico legítimo. Isso inflava a
contagem "do ano corrente" em qualquer consulta que somasse matrícula ativa
sem filtrar ano (era a causa do desvio 507 vs 504 no dashboard).

A migration alinha `ano_letivo` da matrícula ao `ano_letivo` da turma para a
qual ela já aponta. Critério estreito: só corrige quando os dois anos
divergem, não toca matrícula antiga com turma do mesmo ano. Aborta se o
aluno já tiver outra matrícula no ano de destino, para não criar duas
matrículas concorrentes — testado localmente com fixture hostil (rollback
confirmado).

## Migrations de boletim versionadas (retroativo)

14 migrations de importação de notas do 1º/2º bimestre 2026 (uma por turma)
já estavam aplicadas em produção desde antes desta sessão, mas nunca tinham
sido commitadas — o repositório não descrevia o estado real do banco.
Commitadas sem alteração de conteúdo.

Uma delas (`202609110014_boletim_1serie_em_matutino_notas.sql`) foi
**reescrita antes de commitar**: o INSERT original criava o cadastro de uma
aluna com CPF e RG em texto puro (dado pessoal de menor). Passou a gravar só
o mínimo necessário (matrícula, nome, sexo, nascimento, naturalidade);
documentos ficam a cargo da secretaria, preenchidos no sistema. Também
trocado `on conflict do nothing` (inofensivo — a tabela não tem unique nessas
colunas) por guarda `not exists` explícita, evitando duplicar a aluna se a
migration rodar de novo.

## Números de produção — antes/depois

| Métrica | Antes | Depois |
|---|---|---|
| Lista de Alunos (cadastro total) | 527 | 527 (não muda — mede outra coisa) |
| Matrículas ativas 2026 | 504 + 3 soltas em 2025 | 507 |
| Turmas 2026 ativas fora do padrão (`MAT`/`A`/`B`) | 6 | 0 (desativadas, não apagadas) |
| Matrículas presas em turma duplicada | 9 | 0 (realocadas para a canônica) |

A diferença entre 527 (Lista de Alunos) e 507 (dashboard) é esperada e não é
bug: 527 conta todo cadastro, 507 conta só matrícula ativa em 2026. Os 20 de
diferença são 15 ex-alunos (matrícula concluída, anos anteriores) e 5
cadastros que nunca chegaram a ser matriculados.

## Backups

Antes de cada migration em produção, os registros afetados foram salvos
(fora do controle de versão, contêm dado de aluno):

- `backups/202609110017_turmas_duplicadas_pre_migration.json`
- `backups/202609120001_matriculas_ano_divergente_pre_migration.json`

## Commits

- `692d9dbf` / `510bc0ec` — feat(alunos): filtro de Série e Turma
- `c0d369a6` — chore(db): versiona 14 migrations de boletim
- `7283dfde` — chore(db): versiona migration da 1ª série sem CPF/RG
- `4cadd558` — feat(alunos): busca em barra larga abaixo dos filtros
- `0e70b586` — fix(dashboard): filtro de ano + migration de matrículas
