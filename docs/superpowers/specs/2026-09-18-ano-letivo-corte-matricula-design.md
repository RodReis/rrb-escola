# Ano Letivo: corte de 01/09 e correção do histórico de matrículas

**Data:** 2026-09-18
**Status:** aprovado

## Problema

O sistema nunca teve "ano de referência" como dado próprio. A importação derivou
`matriculas.ano_letivo` de `year(data_matricula)`.

A escola matricula entre setembro e dezembro **para o ano letivo seguinte**. Como a
derivação ignorava isso, 1.687 das 2.657 matrículas ficaram um ano atrasadas.

As turmas foram criadas acompanhando o `ano_letivo` errado, então o defeito é
internamente consistente — todas as matrículas apontam para turma do mesmo ano. Por
isso passou despercebido até a emissão de histórico de 2025 voltar vazia.

### Evidência

Ficha do aluno 1204 (ALÍCIA), comparando o sistema de referência com o nosso:

| Referência (Série + Data) | Nossa base | Correto |
|---|---|---|
| 1º Ano — 04/11/2025 | 2025 / 1º ANO | **2026** / 1º ANO |
| Infantil 5 — 28/10/2024 | 2024 / INFANTIL4 | **2025** / INFANTIL5 |
| Infantil 4 — 15/12/2023 | 2023 / INFANTIL3 | **2024** / INFANTIL4 |

O sistema de referência não tem coluna "Ano" — identifica o ano pela data da matrícula.
O campo `ano_letivo` foi introduzido por nós, e a derivação estava errada.

### Validação contra documento oficial

Extraídos 3.139 pares `(matrícula, ano, série)` de 136 PDFs de histórico
(`~/OneDrive/Desktop/histo/2009..2025`), cobrindo 554 alunos e os anos 2011–2026.

| | Aderência ao PDF |
|---|---|
| Base atual | 440 / 2.016 — **21,8%** |
| Após correção | 1.448 / 2.016 — **71,8%** |

Das 568 divergências restantes:

- **444** — Infantil/Maternal: o histórico escolar só cobre 1º ANO em diante. Estrutural.
- **112** — matrículas de 2026 do Ensino Médio ainda em curso, posteriores à geração do PDF.
- **12** — conflito real de série (repetência/transferência), resolvidos caso a caso pela
  secretaria.

Descontando o que o PDF não pode cobrir, a correção reproduz o documento oficial.

## Classificação dos registros

| Classe | Critério | Qtd | Ação |
|---|---|---|---|
| Deslocada | `year(data) = ano_letivo` **e** `mês ≥ 9` | 1.687 | `ano_letivo += 1` |
| Já correta | `year(data) = ano_letivo - 1` | 27 | intocada |
| Início de ano | `year(data) = ano_letivo` **e** `mês < 9` | 943 | intocada |

Soma 2.657 = total. Nenhuma matrícula sem data, nenhum caso ambíguo.

O critério `year(data) = ano_letivo` distingue "derivado errado pela importação" de
"cadastrado certo pela tela": as 25 rematrículas de 2027 (data 17/09/2026) têm
`year(data) ≠ ano_letivo` e ficam de fora naturalmente.

### Decisões tomadas

- **Corte em 01/09, sem exceção.** Pega junto 7 matrículas de setembro de alunos novatos
  que aparentam entrada no meio do ano. Regra única e previsível vale mais que a exceção;
  7 registros em 1.687 a secretaria corrige pela tela se necessário.
- **Duplicatas:** prevalece a **data** da linha deslocada (real, ex. `04/11/2025`) e a
  **série/turma** da linha de destino (real, ex. turma `B` — a que a ficha oficial mostra).
  Generalizada no passo 4 para "data mais antiga + série/turma da data mais recente", que
  cobre também os casos de série diferente e de três linhas.
- **Escopo:** todos os anos (2012–2025), não só 2025. As duas bases (local e produção)
  ficam alinhadas.

## Correção

Transação única, com backup prévio.

### 1. Backup

```sql
CREATE TABLE matriculas_backup_20260918 AS SELECT * FROM matriculas;
CREATE TABLE turmas_backup_20260918    AS SELECT * FROM turmas;
```

Caminho de volta. Mantidas até a validação em produção ser aceita.

### 2. Reapontar turma (antes de mover o ano)

`turmas` tem `UNIQUE (escola_id, serie_id, nome, ano_letivo, turno)`, então deslocar a
turma junto colidiria com a turma já existente no ano de destino. Em vez disso, cada
matrícula passa a apontar para a turma de mesma série+turno já existente no ano destino.

Verificado: existe turma de destino para **todos** os anos até 2026 (401/401 em 2026,
328/328 em 2025, e assim por diante). Apenas 3 matrículas de 2026 com data set–dez vão
para 2027 e precisam de turma criada.

Isto é seguro porque as turmas anteriores a 2026 são sintéticas — criadas pela importação,
uma por série, todas nomeadas "MATUTINO", com **zero avaliações, notas ou frequências**.
Só 2026 tem turmas reais (nomes "A", "B", "MAT") e 568 avaliações.

### 3. Deslocar o ano

`ano_letivo += 1` nas 1.687 linhas, processando **do ano mais recente para o mais antigo**
para não colidir em cascata.

### 4. Fundir as duplicatas resultantes

Após o deslocamento sobram **406 pares `(aluno, ano)` duplicados** — 397 deles em 2026.
Três formatos distintos:

| Formato | Qtd | Exemplo |
|---|---|---|
| Mesma série | 351 | `1º ANO 04/11/2025` + `1º ANO 01/01/2026` |
| Série diferente | 53 | `3º ANO 28/10/2025` + `4º ANO 01/01/2026` (mat 1041) |
| Três linhas / duas deslocadas | 4 | mat 1621, 1624, 1194, 1440, 1508 |

Na duplicata de série diferente, a linha deslocada traz a série que o aluno cursava ao se
matricular e a genérica traz a série para a qual foi promovido. Verificado: em **53 de 54
casos** a deslocada é a série anterior, zero o contrário.

**Regra única que cobre os três formatos:** em cada `(aluno, ano)` duplicado, vence a
`serie_id` e `turma_id` da linha de **data mais recente**; preserva-se a **menor
`data_matricula`** como data original.

Cada campo vem de onde é confiável: a série/turma da linha que reflete o ano letivo de
destino, a data da linha que registra quando a matrícula foi de fato feita.

Resultado verificado: 2.657 → **2.249** linhas, 408 removidas, zero duplicata restante,
zero linha sem série.

### 5. Limpar turmas órfãs

Remove turmas sintéticas que ficaram sem nenhuma matrícula.

### 6. Validação automática com rollback

O script recarrega os 3.139 pares dos PDFs e recalcula a aderência. Se não subir de ~22%
para ~72%, **ROLLBACK**. Transforma "confia na regra" em "provado contra o documento da
escola".

Checagens adicionais:

1. Total de matrículas = **2.249** (2.657 − 408 fundidas).
2. Nenhum aluno com duas linhas no mesmo `ano_letivo` — pré-condição da constraint.
3. Nenhuma matrícula sem `serie_id`.
4. Aluno 1259 bate com o PDF: `2025/1º ANO`, `2026/2º ANO`.

## Prevenção

Duas mudanças fecham a causa raiz.

### Constraint

```sql
ALTER TABLE matriculas
  ADD CONSTRAINT matriculas_aluno_ano_unico UNIQUE (escola_id, aluno_id, ano_letivo);
```

Hoje não existe — foi o que permitiu a duplicata. Adicionada depois da limpeza.

### Tela de nova matrícula

`src/components/matriculas/nova-matricula-fields.tsx` hoje calcula:

```ts
const anoAtual = new Date().getFullYear();
const anoLetivo = proximoAnoDisponivel(aluno, anoAtual);
```

`proximoAnoDisponivel` parte do ano do relógio e avança até achar ano livre — desconhece o
corte. Passa a aplicar `mês ≥ 9 → ano + 1` como base do cálculo, e o campo deixa de ser
`readOnly` para que a secretaria sobrescreva casos atípicos.

**Fora de escopo:** a RPC de rematrícula em lote já recebe `p_ano_dest` explícito e está
correta — foi ela que produziu as 25 matrículas de 2027 com o ano certo. Não muda.

## Revisão de 18/09: produção já foi corrigida

Ao levantar o plano de implementação, descobriu-se o commit `14008cf3` de **10/09/2026**
— `fix(matriculas): corrige ano letivo deslocado e remove duplicatas` — que ataca este
mesmo defeito com a mesma causa raiz (`fix_matriculas.py:119`), por estratégia diferente:
reconstrói o ano pela **progressão de séries ancorada em 2026**, não pela data.

Ele foi aplicado em produção. Consulta somente-leitura confirma:

| | Local | Produção |
|---|---|---|
| Total matrículas | 2.657 | 2.284 |
| Colisões `(aluno, ano)` | 329 | **0** |
| Séries repetidas | 377 | 17 |
| Aderência aos PDFs | 21,8% | **63,9%** |

**Produção está saudável, mas não correta.** Restam **132 matrículas** em conflito com o
PDF, e o padrão é uniforme — a base está sempre *exatamente uma série à frente*:

```
 23  3º ANO -> 2º ANO      11  7º ANO -> 6º ANO
 23  2º ANO -> 1º ANO       8  8º ANO -> 7º ANO
 22  4º ANO -> 3º ANO       6  9º ANO -> 8º ANO
 20  5º ANO -> 4º ANO       4  1ª SÉRIE -> 9º ANO
 15  6º ANO -> 5º ANO
```

É o mesmo deslocamento de um ano, sobrevivente onde a estratégia de progressão falhou:
alunos com buraco na sequência (ano sem matrícula, repetência) não têm como ser ancorados
caminhando para trás.

O **local** está pior que produção porque a importação de histórico de 18/09 reintroduziu
linhas. Ele não reflete nenhum estado real.

### Execução revisada

O deslocamento em massa descrito nos passos 2–5 **não se aplica a produção** — ela já
passou por correção equivalente. Aplicá-lo de novo deslocaria um segundo ano.

1. **Alinhar o local**: restaurar dump de produção, reaplicar por cima só o histórico
   importado em 18/09. Passa a testar contra o que existe de verdade. Não usar
   `supabase db reset --local`.
2. **Correção cirúrgica**: script que compara a base com os 3.139 pares dos PDFs e corrige
   **apenas** onde há conflito, com o PDF como fonte de verdade. Diff mínimo, cada
   alteração rastreável a um documento oficial.
3. Dry-run local → conferir → aplicar local → conferir na tela → aplicar em produção.

A regra do corte 01/09 permanece válida para a **tela de nova matrícula** (prevenção), que
é o que impede o defeito de voltar. O que muda é o método de correção do histórico: em vez
de deslocar em massa, corrigir por confronto com o documento.

## Ressalvas

- O aluno 1204 (ALÍCIA), caso que originou a investigação, **não pode ser validado por
  PDF** — estava no Infantil em 2024/2025 e o histórico não cobre esse nível. A correção
  dele se apoia na regra validada nos outros 554 alunos e nas fichas anexadas pelo usuário.
- Os PDFs de 2026 não são necessários: os de 2025 já trazem o ano seguinte (o histórico
  lista a trajetória inteira), rendendo 259 pares de 2026. Gerá-los depois serviria como
  conferência pós-deploy das 112 divergências do Médio.

## Execução final (19/09/2026)

Executado via Subagent-Driven Development, plano
`docs/superpowers/plans/2026-09-18-ano-letivo-correcao-cirurgica.md` (8 tasks).
Ferramentas criadas:

- `scripts/lib/historico-pdf-indice.mjs` — indexa os 3.139 pares
  `(matrícula, ano, série)` dos 136 PDFs como fonte de verdade.
- `scripts/conferir_ano_letivo.mjs` — relatório somente-leitura, base × PDF.
- `scripts/corrigir_ano_letivo_pelo_pdf.mjs` — remove duplicatas (grupo B, ver
  abaixo), com guarda contra apagar matrícula com vínculo financeiro
  (`idsComVinculo` em cobranças/pagamentos/notas/frequências).
- `src/lib/matriculas/ano-letivo.ts` — regra do corte 01/09, usada pela tela de
  nova matrícula (prevenção; `81cef19f`, `6e5fd111`, `3df7f07e`).
- Migração `202609190001_matriculas_aluno_ano_unico.sql` — `UNIQUE (escola_id,
  aluno_id, ano_letivo)`, aplicada em produção após a limpeza.

### Incidente e recuperação

Na Task 3, um `DELETE FROM matriculas` sem filtro (violação da regra
inviolável do projeto) rodou contra o banco **local**, cascateando para 5
tabelas (cobranças, pagamentos, notas, frequências, histórico). Produção foi
verificada intacta. O local foi reconstruído do zero a partir de um dump de
produção (UPSERT com remapeamento de id para 29 turmas, 236 disciplinas e 1
aluno em colisão de chave única) e depois recebeu de volta só a importação de
histórico de 18/09. Detalhe completo no ledger preservado em
`ledger-ano-letivo-2026-09-19.md` (fora do git).

### Classificação final dos 132 conflitos restantes

Os conflitos de série (produção estava uma série à frente do PDF) formam
cadeias, não casos independentes — corrigir um extremo da cadeia sem os
demais não elimina a colisão. Classificados em três grupos; **só o grupo B
foi corrigido**, por decisão do usuário:

| Grupo | Descrição | Qtd | Ação |
|---|---|---|---|
| A | Cadeia inteira deslocada (nenhuma ponta bate com o PDF sem gerar 2027 para ex-aluno) | — | Fora de escopo, decisão explícita |
| **B** | **Duplicata simples: uma ocorrência já bate com o ano do PDF** | **14** | **Removida** |
| C | Cadeia cujo topo é série de Médio ausente do PDF | — | Fora de escopo |

3 casos (matrículas 33, 500, 949) não se encaixam em nenhum grupo — série de
Médio repetida sem cobertura no PDF — e ficaram sinalizados para a secretaria
resolver pela própria tela.

### Resultado em produção (autorizado, aplicado 19/09/2026)

| Métrica | Antes | Depois |
|---|---|---|
| Total de matrículas | 2.284 | 2.270 |
| Aderência aos PDFs | 63,9% | 64,4% |
| Cobranças / pagamentos / notas | 6.032 / 6.032 / 9.465 | inalterados |
| Constraint `matriculas_aluno_ano_unico` | ausente | aplicada (testada com `BEGIN/ROLLBACK` antes) |

Local e produção ficaram idênticos após a correção. 389 testes verdes.
Mergeado em `main` (`f12d8bc0`), branch de trabalho `worktree-ano-letivo-correcao`
removida. Os 119 conflitos dos grupos A e C permanecem em ambas as bases —
efeito colateral visível: os 302 anos de histórico órfãos documentados em
`[[project_historico_escolar]]`.
