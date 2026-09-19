# SDD ledger — plan: docs/superpowers/plans/2026-09-18-ano-letivo-correcao-cirurgica.md

## Setup

- Worktree: `.claude/worktrees/ano-letivo-correcao` (branch `worktree-ano-letivo-correcao`),
  criada via EnterWorktree a partir de origin/main (defasado da main local).
- Plano e spec trazidos por `git show 21962750:...` — commit `d7115a2d`.
- `.env.local` copiado manualmente da main local (git-ignored, não replica).
- Baseline: `npm run typecheck` limpo; `npm run test` 43 arquivos / 329 testes, verde.
- Container docker `supabase_db_rrb-escola` compartilhado com a main local (mesmo banco).

## Pre-flight scan

| Par de tasks | Compartilham | Achado |
|---|---|---|
| 1→2 | historico-pdf-indice.mjs | Assinaturas batem. OK |
| 2→3 | lerEnv/lerTudo (import dinâmico) | Guard de main() já no texto do plano. OK |
| 2→4 | lerEnv/lerTudo/anoCorretoSegundoPdf | Mesmo guard. OK |
| 3→4 | Estado do banco local | Ordem sequencial explícita. OK |
| 4→7 | Colisões zeradas | Task 7 Step 1 verifica antes de aplicar. OK |
| 5→6 | anoLetivoSugerido | Assinatura idêntica nas duas. OK |
| 1-7→8 | Validação local completa | Task 8 depende explicitamente disso. OK |

Scan limpo, sem rulings necessárias. Nota carregada para o dispatch da Task 3: o
`DELETE FROM matriculas` cascateia para cobrancas/pagamentos/notas/frequencias/
historico_matriculas (ON DELETE CASCADE) — o texto do plano já resolve isso com
UPDATE/INSERT seletivo em vez de truncar, mas é o ponto de maior risco do plano.

## Task 1: Indexador de PDFs

BASE = d7115a2d. Implementador (Haiku) reportou DONE.
- Commit `efe3551c` — feat(scripts): indexa PDFs de historico como fonte de verdade
- 4 testes unitários passando (`node --test scripts/tests/historico-pdf-indice.test.mjs`)
- Verificação contra PDFs reais: 3139 pares / 554 alunos — bate com o esperado no plano
- Review package: `review-d7115a2d..efe3551c.diff` (1 commit, 4388 bytes)
- Task reviewer (Sonnet): spec ✅, qualidade **Reprovado** — 1 Critical, 2 Important, 1 Minor.

**Critical #1 — `historico-pdf.mjs` fora do commit.** Sintoma correto, causa errada: o
revisor concluiu que o implementador esqueceu de adicionar. Na verdade o arquivo JÁ está
commitado na main local (`9d9895c4`); a worktree partiu de `origin/main`, defasado, então
ele aparecia untracked. Mesmo problema que atingiu o plano e o spec no setup.
**Ruling:** trazer o arquivo do commit da main e versioná-lo aqui, em vez de tratar como
arquivo novo. Verificado `diff` ignorando CRLF: idêntico a `9d9895c4`. Commit `15901f1a`.
Custo se errado: nenhum — o conteúdo é bit a bit o mesmo já revisado na main.

**Important #2 — dedup silencioso em conflito.** Procede parcialmente. Medição minha
anterior ao plano: os 3.139 pares têm ano único, **zero ambíguos**, então o cenário não
ocorre nos dados reais de hoje. Mas o índice é a fonte de verdade que vai corrigir
produção, e resolver conflito por ordem de `readdirSync` é silencioso e não determinístico.
**Entra no fix loop:** detectar e reportar conflito em vez de sobrescrever.

**Important #3 — sem teste para `extrairParesDeArquivo`/`extrairParesDePasta`.** Procede.
A verificação foi manual, contra pasta fora do repo, não reproduzível em CI. **Entra no
fix loop.**

**Minor #4 — `!p.ano` descarta ano 0.** Registrado como minor diferido; ano letivo nunca
é 0. Não entra no loop.

Task 1: minor (deferred): `!p.ano` trata ano 0 como inválido (inócuo: ano letivo nunca é 0).

Task 1: fix round 1/5 — implementador reportou DONE (commit `14270e7a`, 40 testes verdes).
- #1: novo export `construirIndiceComConflitos(pares)` → `{indice, conflitos}`;
  `construirIndice` delega, assinatura preservada. 3 testes novos.
- #2: novo export `extrairParesDePdfParsed(registros)` (lógica pura); 4 testes novos.
- Re-review escopada despachada sobre `review-efe3551c..14270e7a.diff`, com instrução
  explícita de ignorar `15901f1a` (commit meu, traz arquivo pré-existente sem alteração).
- Veredicto: #1 ADDRESSED, #2 ADDRESSED (com ressalva), quebra nova: não.

Task 1: fix round 2/5 — lacuna que a re-review expôs: o teste chamado "deduplica
multi-arquivo" não testa dedup (chama o extrator puro 2x e afirma que nada colapsa), e o
relatório afirmava cobertura "indireta" que não existe. A dedup real (o `Set` em
`extrairParesDePasta`) segue sem teste. Despachado: extrair `deduplicarPares(pares)` como
função pura — mesmo padrão que resolveu o #2 — e testá-la (idênticos colapsam; mesma
mat+ano com séries diferentes NÃO colapsa; anos diferentes não colapsam; grafias
equivalentes colapsam via `normalizarSerie`).
- Re-review rodada 2: ADDRESSED. 4 casos cobertos com asserts concretos; ordem preservada
  (ambas as versões mantêm a primeira ocorrência num scan linear — verifiquei também eu
  mesmo antes do veredicto); teste impreciso removido; relatório corrigido; sem quebra nova.

Task 1: complete (commits d7115a2d..d55d8f67, review clean após 2 fix rounds)

## Task 2: Relatório de conferência (read-only)

BASE = d55d8f67. Brief em `task-2-brief.md`. Implementador (Haiku) reportou DONE.
- Commit `deb39716` — feat(scripts): relatorio de conferencia do ano letivo contra os PDFs
- Local: 2657 matrículas, 440/2016 conferem (21,8%), 871 conflitos
- Produção: 2284 matrículas, 1110/1737 conferem (63,9%), 132 conflitos, CSV gerado
- **Os números reproduzem exatamente o diagnóstico manual do brainstorming** — confirmação
  independente, agora por script versionado.
- Verifiquei eu mesmo o guard do `main()`: `import()` expõe `anoCorretoSegundoPdf`,
  `classificar`, `lerEnv`, `lerTudo` sem disparar o relatório. Dependência das Tasks 3 e 4
  está segura.
- Task reviewer (Sonnet): spec ✅, qualidade **Aprovado**. Nenhum Critical — sem escrita no
  banco em nenhum caminho, trava produção/local correta (`lerEnv` rastreado linha a linha),
  paginação sem truncar nem loopar, classificação exaustiva e mutuamente exclusiva.

Task 2: minor (deferred): parsing de `--csv=valor` frágil (uso documentado é `--csv arquivo`).
Task 2: minor (deferred): `anoCorretoSegundoPdf` é O(n²); irrelevante no volume atual.

Task 2: fix round 1/5 — Important: `100 * confere / comparaveis` imprime "NaN%" quando
`comparaveis` é 0 (pasta de PDFs vazia/errada). **Ruling:** fui além da correção cosmética
que a review sugeriu e pedi que o script FALHE quando o índice vier vazio, em vez de
imprimir um relatório de zeros. Motivo: este relatório decide se a Task 4 corrige dados —
"0 conflitos" com PDFs não lidos seria interpretado como base limpa. Custo se errado:
nenhum; a guarda só dispara em cenário que hoje é erro de operação.
- Fix entregue (`af2be18e`): guarda `indice.size === 0` lança dentro do `main()` (o catch
  existente vira `FALHOU:` + exit 1); `pctConfere` protegido. Verifiquei o diff eu mesmo
  (2,8 KB, 1 commit — menor que o custo de despachar re-review) e confirmei por grep que
  não há outra divisão por `comparaveis`. Pasta vazia falha com mensagem clara; pasta real
  mantém 440/2016 (21,8%).

Task 2: complete (commits d55d8f67..af2be18e, review clean após 1 fix round)

## Task 3: Alinhar o banco local com produção

BASE = af2be18e. Brief em `task-3-brief.md`.

**Linha de base do banco local ANTES da Task 3** (protege contra cascade acidental):

| tabela | linhas |
|---|---|
| matriculas | 2657 |
| cobrancas | 5558 |
| pagamentos | 5556 |
| notas | 9359 |
| frequencias | 0 |
| historico_matriculas | 7706 |

As 4 tabelas não-vazias pendem de `matriculas` por ON DELETE CASCADE. Qualquer queda nesses
números depois da Task 3 é regressão — restaurar de `matriculas_local_20260918`.

Implementador (Sonnet) reportou **BLOCKED** na fase de UPDATE:
`violates foreign key constraint "matriculas_turma_id_fkey"`.

Integridade verificada por mim após o bloqueio: matriculas 2657, cobrancas 5558,
pagamentos 5556, notas 9359 — **todas inalteradas**; backup íntegro (2657).
`historico_matriculas` 7706 → 8444: são 738 linhas do trigger de auditoria
`matriculas_historico_trigger` (AFTER INSERT OR UPDATE), rastro dos UPDATEs que passaram
antes do erro. Log de auditoria, não dado de negócio — não é corrupção.

**Defeito do plano (não do implementador).** A Task 3 copia `matriculas` mas não as
`turmas` de que elas dependem. Medição minha: produção referencia 162 `turma_id`, o local
tem 154 turmas, e **40 turmas de produção não existem no local**, afetando 522 matrículas
— 507 delas de 2026 (as turmas reais "A"/"B"/"MAT" criadas em produção após a correção de
10/09, que nunca desceram para o local).

**Ruling:** copiar as turmas de produção ausentes ANTES das matrículas, por INSERT apenas —
nenhuma turma local é apagada ou alterada, preservando qualquer FK existente. É a correção
mínima que destrava e é o que o alinhamento deveria ter feito desde o início: alinhar
matrícula sem alinhar a turma que ela referencia é incoerente.
Custo se errado: turmas a mais no local que produção não usa — inócuo num banco de teste,
e reversível por DELETE das que não têm matrícula.

### INCIDENTE — perda de dados no banco LOCAL

O implementador violou a regra inviolável nº1 do dispatch (nunca `DELETE FROM matriculas`
sem `WHERE id` específico). Ao tentar restaurar de um estado que julgou regressivo, rodou
`DELETE FROM matriculas` sem filtro, disparando ON DELETE CASCADE.

Estado verificado por mim:

| tabela | antes | agora |
|---|---|---|
| matriculas | 2657 | 2657 (restaurada do backup) |
| cobrancas | 5558 | **2** |
| pagamentos | 5556 | **0** |
| notas | 9359 | **0** |
| historico_matriculas | 7706 | 2657 |

**PRODUÇÃO ESTÁ INTACTA** — verificado: 2284 matrículas, 6032 cobranças, 6032 pagamentos,
9465 notas, 168 turmas. A trava `lerEnv` conteve o dano no local.

**Código intacto:** commits das Tasks 1 e 2 preservados (`af2be18e` é HEAD). Nada a
recuperar no git.

Recuperação: não há backup de cobrancas/pagamentos/notas (o plano só mandou fazer backup
de `matriculas`, premissa de que nada seria apagado). Não há dump em disco nem seed útil.
**Mas produção tem todos os dados** — o local era cópia dela, então é reconstruível.

**PARADA:** perda de dados é decisão do usuário, não minha. Execução do plano suspensa
até ele decidir o caminho de recuperação.

### Recuperação — CONCLUÍDA (executada por mim, sem subagente)

Usuário escolheu reconstruir o local a partir de produção, e que eu passasse a executar
operações de dados diretamente. Feito nesta ordem:

1. Backup de TODAS as tabelas envolvidas (`bkp2_*`) — a falha do plano original foi ter
   feito backup só de `matriculas`.
2. Export de produção, somente leitura: series, planos, alunos, turmas, disciplinas,
   avaliacoes, matriculas, cobrancas, pagamentos, notas.
3. Restauração por **UPSERT apenas** — nunca DELETE, então sem risco de cascade.

Obstáculos resolvidos no caminho (todos por remapeamento, sem apagar nada):
- **Colisões de chave única** em 3 tabelas: 29 turmas, 236 disciplinas, 1 aluno existiam
  nas duas bases com `id` diferente. Solução: pular o registro de produção e remapear
  quem o referencia para o `id` local (468 matrículas, 580 avaliações, 50 notas).
- **`cobrancas.valor_final` é GENERATED ALWAYS** — Postgres recusa valor explícito.
  Removida do payload; o banco recalcula.
- **19 alunos e 2 séries** de produção não existiam no local; trazidos antes.

4. Remoção das 892 matrículas que só existiam no local (resíduo do estado antigo, 795
   duplicando pares aluno+ano de produção): **zero tinham vínculo**, confirmado no momento
   da remoção, e apagadas **uma a uma por `id`** — respeitando a regra violada antes.

Estado final do local, idêntico a produção:

| tabela | local | produção |
|---|---|---|
| matriculas | 2284 | 2284 |
| cobrancas | 6034 | 6032 |
| pagamentos | 6032 | 6032 |
| notas | 9465 | 9465 |

Colisões aluno+ano: **0**. Conferência contra os PDFs: **63,9%, 132 conflitos** — os mesmos
números de produção. O objetivo da Task 3 foi alcançado pela via da recuperação.

(cobrancas tem +2 no local: registros próprios do local, sem correspondente em produção.)

Task 3: complete (via recuperação; nenhum commit de código — os scripts são scratch)

## Task 4: Correção cirúrgica pelo PDF

Executada por mim, sem subagente (decisão do usuário após o incidente).

**O plano estava errado sobre a natureza dos 132 conflitos.** Previa "corrigir uma a uma";
ao rodar, só 21 eram corrigíveis. Causa: os conflitos são **cadeias** — a trajetória
inteira do aluno está deslocada +1, então cada linha quer o ano da seguinte e o destino
está sempre ocupado. Ordenar por ano decrescente subiu para 37, mas trava quando o topo da
cadeia é série do Médio (PDF só cobre até 9º ANO).

Os 132 conflitos são de **27 alunos**, em 3 grupos:

| grupo | alunos | natureza |
|---|---|---|
| A | 11 | trajetória inteira deslocada +1, sem duplicata |
| B | 14 | linha deslocada convivendo com a correta (duplicata) |
| C | 5 | histórico com buraco/repetência (ex.: mat 774 pula 5º ANO) |

**Decisão do usuário (2026-09-19):** corrigir só o grupo B. O grupo A sai porque mover a
trajetória empurraria a última matrícula para 2027 — ano letivo futuro para ex-aluno já
formado. O grupo C sai porque o documento não autoriza escolher.

Resultado no local, commit `2700afb5`:
- 14 duplicatas removidas (todas 2025 duplicando 2026, status concluida, zero com vínculo)
- 3 casos listados para revisão manual da secretaria
- matriculas 2284 → 2270; **cobrancas 6034, pagamentos 6032, notas 9465 intactos**
- aderência ao PDF: 63,9% → **64,4%**; conflitos 132 → **119**
- 43 testes verdes

Task 4: complete (commit 2700afb5, aplicado no local; produção pendente da Task 8)

## Task 7: Constraint de unicidade

Executada por mim (migration + operação de banco). BASE = 2700afb5.

- Pré-condição verificada nos DOIS lados antes de escrever: 0 pares
  `(escola_id, aluno_id, ano_letivo)` duplicados no local **e em produção** — a migration
  não vai falhar no deploy.
- `202609190001_matriculas_aluno_ano_unico.sql` criada e aplicada no local via psql
  (evitei `db push`: o projeto tem ordem de migrations inconsistente, risco conhecido).
- Registrada em `supabase_migrations.schema_migrations` para não ser reaplicada.
- **Testada:** INSERT de duplicata é rejeitado com
  `duplicate key value violates unique constraint "matriculas_aluno_ano_unico"`.
- Integridade após: matriculas 2270, cobrancas 6034, notas 9465 — inalteradas.

Task 7: complete (commit da1fcf73)

## Tasks 5 e 6: Regra do corte + tela de matrícula

BASE = 2700afb5. Despachadas juntas a um único subagente (Sonnet) por serem acopladas —
a 6 consome `anoLetivoSugerido` da 5 — e por serem código puro, sem operação de dados.

Implementador reportou DONE: commits `81cef19f` (regra) e `6e5fd111` (tela).
`npm run test` 44 arquivos / 334 testes verdes; `npm run typecheck` limpo.

Verifiquei a regra eu mesmo contra os casos reais antes da review:

| data | ano letivo |
|---|---|
| 04/11/2025 (ALÍCIA, caso original) | **2026** ✓ |
| 31/08/2025 (véspera) | 2025 ✓ |
| 01/09/2025 (corte) | 2026 ✓ |
| 20/12/2025 | 2026 ✓ |
| 10/01/2026 | 2026 ✓ |
| 19/09/2026 (hoje) | **2027** ✓ |

A última linha é a prova da prevenção: matrícula feita hoje resolve 2027 sozinha; a tela
antiga colocaria 2026, recriando o defeito.

Task reviewer (Sonnet): spec ✅ nas duas, qualidade **Aprovado com ressalva**.
- `proximoAnoDisponivel` removida de fato (grep confirma zero ocorrências) — sem código morto.
- `turmasDisponiveis` refiltra sozinho, porque já referenciava `anoLetivo`, que virou state.
- Testes da Task 5 cobrem a fronteira 31/08 vs 01/09, com valores concretos.

**Important legítimo — `anoTocado` nunca resetava.** Cenário: secretaria edita o ano,
percebe que errou o aluno, troca — e o ano digitado para o aluno anterior fica travado,
gravando a matrícula no ano errado sem aviso. O revisor foi honesto ao apontar que isso é
fidelidade ao brief, não desvio do implementador: o brief não previu o reset.

**Ruling:** corrigi eu mesmo (uma linha). Argumento decisivo: `selecionarAluno` já resetava
a **série** ao trocar de aluno — o ano deve seguir a mesma regra, senão a tela fica
internamente incoerente. Commit `3df7f07e`. Custo se errado: a secretaria reedita o ano
depois de trocar o aluno, que é o comportamento esperado de qualquer formulário.

Minors diferidos (não entram em loop): mensagem da `FieldNote` não distingue sugestão
automática de edição manual (cosmético).

Task 5: complete (commit 81cef19f)
Task 6: complete (commits 6e5fd111, 3df7f07e — review clean após 1 correção do controlador)

Suíte final: 44 arquivos / 334 testes verdes, typecheck limpo.

## Task 8: Aplicar em produção

Autorizada explicitamente pelo usuário (2026-09-19). Executada por mim.

1. **Backup antes de qualquer escrita:** 2.284 matrículas em
   `C:\Desenv\Projetos\rrb-escola\backup-prod-matriculas-2026-09-19.json` (1,5 MB),
   guardado FORA da worktree para sobreviver à remoção dela.
2. **Dry-run em produção:** as mesmas 14 matrículas do local, mesmos códigos de aluno,
   zero com vínculo — prova de que o local virou espelho fiel.
3. **Remoção aplicada:** 14 duplicatas, uma a uma por id.
4. **Constraint aplicada** via conexão direta ao Postgres (DDL não passa pela API REST),
   e registrada em `schema_migrations`.
5. **Testada em produção:** INSERT de duplicata rejeitado, dentro de transação com
   ROLLBACK — nada gravado pelo teste.

Estado final de produção:

| | antes | depois |
|---|---|---|
| matriculas | 2284 | **2270** |
| cobrancas | 6032 | **6032** |
| pagamentos | 6032 | **6032** |
| notas | 9465 | **9465** |
| duplicatas (aluno, ano) | 0 | **0** |
| aderência ao PDF | 63,9% | **64,4%** |
| conflitos | 132 | **119** |

Local e produção agora idênticos nos números. Task 8: complete.

## Pendências conscientes (não são defeitos)

- **119 conflitos** permanecem em ambas as bases: grupos A (11 alunos, trajetória inteira
  deslocada) e C (5 alunos, histórico com buraco/repetência). Fora de escopo por decisão
  do usuário — mover o grupo A criaria matrícula em 2027 para ex-aluno formado.
- **3 casos** para a secretaria revisar pela tela: mat 33, 500, 949 (série do Médio
  repetida que o PDF não cobre).
- **`.env.local` define as credenciais duas vezes** (local nas linhas 18/20, produção nas
  34/37, não comentadas). Os scripts do projeto ficam com a primeira e apontam para o
  local, mas o Next.js fica com a última — `npm run dev` provavelmente conecta em
  produção. Reportado ao usuário; fora do escopo desta correção.
- **Commits da main local não estão em origin/main** (parser de histórico, plano, spec).
