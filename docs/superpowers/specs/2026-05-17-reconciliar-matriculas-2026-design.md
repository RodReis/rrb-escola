# Reconciliar Matrículas 2026 — Design

**Data:** 2026-05-17
**Branch:** folha-de-pagamento
**Status:** Spec — aguardando revisão

## Problema

Série, turma e turno de alunos no sistema divergem da realidade. Exemplos relatados:

- `INFANTIL4 - MATUTINO`: sistema = 38, planilha = 20
- `INFANTIL4 - VESPERTINO`: sistema = 38, planilha = 19
- `3º ANO - MATUTINO`: sistema = 27, planilha = 25 (3º A = 26 na contagem real)
- `4º ANO - MATUTINO`: sistema = 26, planilha = 24
- Caso individual: `MANUELA MARGARIDA BARROS` está em `4º MATUTINO` no sistema; correto é `3º VESPERTINO (B)`

Causa raiz: importação inicial usou planilha como fonte para valores de matrícula mas atribuiu série/turma incorretamente. Os PDFs de fichas (`docs/pdfs/Resultado.pdf`, `Resultado1.pdf`) seriam fonte primária mas a planilha `public/MATRICULADOS2026.xlsx` foi confirmada como mais confiável e estruturada para o ano letivo 2026.

## Fonte de Verdade

`public/MATRICULADOS2026.xlsx`

Estrutura:
- 4 sheets: `INFANTIL`, `FUND 1`, `FUND 2`, `MÉDIO`
- Blocos por turma. Cabeçalho do bloco em uma célula (qualquer coluna): nome da turma com turno embutido.
- Em seguida linha header com `ALUNO | MATRICULA` (ou `mensalidade`).
- Linhas seguintes: índice, nome do aluno, valor mensalidade.
- Bloco termina ao encontrar próximo cabeçalho ou fim de sheet.

Formatos de cabeçalho observados:
- `MATERNAL - MATUTINO`, `MATERNAL - VESPERTINO`
- `INFANTIL 3 - MATUTINO`, `INFANTIL 4 - VESPERTINO`, `INFANTIL 5 - MATUTINO`
- `1º ANO - A`, `2º ANO - B`, …, `9º ANO - A`
- `1ª SÉRIE - EM - A`, `2ª SÉRIE - EM - A`, `3ª SÉRIE - EM - A`

Convenção de turno:
- Infantil/Maternal: turno explícito no cabeçalho.
- Fundamental + Médio: turma A → `matutino`, turma B → `vespertino`.

Totais esperados após reconciliação (parse seco da planilha):

| Sheet | Turmas | Alunos |
|---|---|---|
| INFANTIL | 8 (Maternal 2, Inf3 2, Inf4 2, Inf5 2) | 117 |
| FUND 1 | 10 (1º–5º, A e B) | 223 |
| FUND 2 | 4 (6º–9º, só A) | 120 |
| MÉDIO | 3 (1ª–3ª série, só A) | 39 |
| **Total** | **25** | **499** |

## Escopo

Reconstruir série + turma + turno de TODAS as matrículas 2026 a partir da planilha. Não toca em pagamentos, contratos, plano financeiro nem histórico (`enrollment_history`).

## Identificação Aluno

Match por nome exato após normalização:
- `trim`
- `toUpperCase`
- Remover acentos (`NFD` + strip combining marks)
- Colapsar espaços múltiplos para um único espaço

Sem fallback. Aluno sem match exato vira "órfão" no relatório para tratamento manual posterior.

## Mapeamento Turma → DB

Tabela `series` (`escola_id`, `nome`, `ordem`, `ativo`).
Tabela `turmas` (`escola_id`, `serie_id`, `nome`, `ano_letivo`, `turno`, `capacidade`, `ativo`).

Para cada cabeçalho de turma da planilha:

| Cabeçalho planilha | series.nome | turmas.nome | turmas.turno |
|---|---|---|---|
| `MATERNAL - MATUTINO` | `Maternal` | `Maternal Matutino` (ou `A`) | `matutino` |
| `MATERNAL - VESPERTINO` | `Maternal` | `Maternal Vespertino` (ou `B`) | `vespertino` |
| `INFANTIL N - MATUTINO/VESPERTINO` | `Infantil N` | `A`/`B` | matutino/vespertino |
| `Nº ANO - A` | `Nº Ano` | `A` | `matutino` |
| `Nº ANO - B` | `Nº Ano` | `B` | `vespertino` |
| `Nª SÉRIE - EM - A` | `Nª Série EM` | `A` | `matutino` |

Resolução: olhar `series` e `turmas` existentes com `ano_letivo=2026` e adaptar o nome canônico para o que já está no banco. Se uma turma alvo não existir, criar (`capacidade` padrão da migração `202605280007_turmas_capacidade_por_segmento.sql`).

## Algoritmo

Script one-shot em `scripts/reconcile_matriculas_2026.mjs`. Modos:
1. `--dry-run` (padrão): só lê e gera relatório, nenhuma escrita.
2. `--apply`: aplica mudanças.

Fluxo:

1. Carrega xlsx → produz array `planilha[]` de `{ nome_raw, nome_norm, sheet, turma_label, serie_nome_alvo, turma_nome_alvo, turno_alvo, mensalidade }`.
2. Carrega do DB:
   - `alunos` (id, nome, nome_norm)
   - `series` 2026
   - `turmas` ano_letivo 2026
   - `matriculas` ano_letivo 2026 ativas, com aluno_id, serie_id, turma_id
3. Garante que cada turma da planilha existe no DB. Cria séries/turmas faltantes (apenas em `--apply`; em dry-run, lista o que seria criado).
4. Para cada item da planilha:
   - Acha `aluno` por `nome_norm`.
   - Se não achou → registra em `orfaos_planilha`.
   - Se achou: pega matrícula 2026 do aluno (se existir).
     - Se matrícula 2026 já tem `turma_id == turma_alvo.id` → `inalterado`.
     - Se tem matrícula 2026 com turma diferente → `update_matricula` (atualiza `serie_id`, `turma_id`).
     - Se aluno existe mas não tem matrícula 2026 → `insert_matricula`.
5. Após processar a planilha, varre `matriculas` 2026 do DB. Para cada matrícula cujo aluno não apareceu na planilha → `extras_sistema` (provavelmente cancelados ou erros).
6. Imprime relatório agregado + escreve JSON detalhado em `docs/pdfs/reconcile-2026-<timestamp>.json`:
   - `corrigidos[]` (cada com `aluno_id`, `nome`, `de_turma`, `para_turma`)
   - `criados[]`
   - `inalterados_count`
   - `orfaos_planilha[]`
   - `extras_sistema[]`
   - `turmas_criadas[]`, `series_criadas[]`

## Operações de Escrita (Apply)

Apenas em `--apply`. Tudo em uma transação (`begin` / `commit` via Supabase RPC, ou batched). Se algo falhar → rollback.

- Criar `series` faltantes.
- Criar `turmas` faltantes com `ano_letivo = 2026`, `turno` calculado, `capacidade` padrão.
- Para cada `update_matricula`: `UPDATE matriculas SET serie_id=$1, turma_id=$2, updated_at=now() WHERE id=$3`.
  - Preserva `id`, ou seja preserva pagamentos/cobranças vinculadas.
- Para cada `insert_matricula`: `INSERT INTO matriculas (escola_id, aluno_id, serie_id, turma_id, ano_letivo, status) VALUES (...)` sem mexer em plano/financeiro.
- Não toca em `frequencias`, `boletim`, `pagamentos`.

## Não-Escopo (Tratamento Manual Depois)

- Órfãos da planilha (aluno na planilha mas não no DB): possível digitação divergente. Fora desta tarefa.
- Extras do sistema (matrícula 2026 no DB mas aluno não na planilha): possíveis cancelamentos. Fora.
- Atualização de valores de mensalidade (`planos` / `valor_mensalidade`): fora. Já existe spec `2026-05-17-valores-praticados-design.md`.

## Pré-requisitos

- `openpyxl` (Python) ou `xlsx` (Node) para parser. Preferir Node/JS para alinhar com resto do projeto. Pacote: `xlsx` (sheetjs) já comum.
- Service role key Supabase (admin) — script roda local com `SUPABASE_SERVICE_ROLE_KEY` no `.env`.

## Testes / Validação

Sem testes unitários automatizados (script one-shot). Validação:
1. Dry-run produz totais que batem com a contagem manual da planilha (499 alunos, 25 turmas).
2. Spot-check 5 casos conhecidos:
   - `MANUELA MARGARIDA BARROS` → `3º Ano - B` / vespertino.
   - 4 cabeçalhos citados no problema, conferir contagem pós-apply.
3. Após apply, query agregada `SELECT t.nome, t.turno, count(*) FROM matriculas m JOIN turmas t ON t.id=m.turma_id WHERE m.ano_letivo=2026 GROUP BY t.id` deve bater com a planilha.

## Riscos

- Nomes com grafia divergente (acento, hífen, sobrenome composto) viram órfãos. Mitigação: relatório separado, revisão manual.
- Aluno com matrícula 2026 vinculada a `frequencias` já registradas em turma errada: as frequências mantêm `matricula_id` correto após o UPDATE, mas o histórico de frequência se manterá registrado contra a turma original via FK indireta? Verificar — `frequencias` referencia `matricula_id` direto, não `turma_id`. Sem impacto.
- Capacidade da turma: se a planilha colocar mais alunos do que `turmas.capacidade`, ignorar (capacidade é informacional, não constraint).
