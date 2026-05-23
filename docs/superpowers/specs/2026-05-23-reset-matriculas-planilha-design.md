# Reset Matrículas 2026 da Planilha — Design

**Data:** 2026-05-23
**Status:** aprovado para implementação

## Objetivo

Limpar matrículas 2026 inteiras (matrículas, séries, turmas, cobranças, pagamentos) e recriar do zero usando `public/MATRICULADOS2026.xlsx` como única fonte de verdade.

Alunos com **valor em branco na planilha** ficam **sem matrícula** — serão tratados manualmente depois (já existe fluxo `alunos-sem-valor`).

## Motivação

Análise preliminar do usuário mostrou:
- Alunos em séries erradas no DB
- Valores de mensalidade não batem com o praticado real
- DB 2026 tem 507 matrículas, 24 turmas, 5558 cobranças, 5556 pagamentos — todos com base em dados desalinhados

Planilha (auditoria): 499 alunos em 25 seções (mas só 21 turmas únicas pós-normalização), 36 sem valor → 463 matrículas a criar.

## Schema Change

Migration nova `2026MMDD_matricula_valor_praticado.sql`:

```sql
alter table matriculas
  add column valor_mensalidade_praticado numeric(12,2);

comment on column matriculas.valor_mensalidade_praticado is
  'Valor mensal cobrado deste aluno (override de planos.valor_mensalidade). Quando null, usa valor do plano.';
```

**Semântica:** valor já é o final cobrado, sem cálculo de bolsa. `tipo_vaga` permanece coluna informativa mas não influencia geração de cobrança quando `valor_mensalidade_praticado` está setado.

## Mapeamento Planilha → DB

### Séries alvo (16)

| Planilha | Série DB | Segmento |
|---|---|---|
| MATERNAL | MATERNAL | INFANTIL |
| INFANTIL 3 | INFANTIL3 | INFANTIL |
| INFANTIL 4 | INFANTIL4 | INFANTIL |
| INFANTIL 5 | INFANTIL5 (criar) | INFANTIL |
| 1º ANO | 1º ANO | FUNDAMENTAL1 |
| 2º ANO | 2º ANO | FUNDAMENTAL1 |
| 3º ANO | 3º ANO | FUNDAMENTAL1 |
| 4º ANO | 4º ANO | FUNDAMENTAL1 |
| 5º ANO | 5º ANO | FUNDAMENTAL1 |
| 6º ANO | 6º ANO | FUNDAMENTAL2 |
| 7º ANO | 7º ANO | FUNDAMENTAL2 |
| 8º ANO | 8º ANO | FUNDAMENTAL2 |
| 9º ANO | 9º ANO | FUNDAMENTAL2 |
| 1ª SÉRIE EM | 1ª SÉRIE | MEDIO |
| 2ª SÉRIE EM | 2ª SÉRIE | MEDIO |
| 3ª SÉRIE EM | 3ª SÉRIE | MEDIO |

Séries fora desta lista (ex: INFANTIL2): apagar se sem dependências; caso contrário desativar.

### Turmas alvo (21)

| Série | Turmas | Turnos |
|---|---|---|
| MATERNAL | MATUTINO, VESPERTINO | matutino, vespertino |
| INFANTIL 3 | MATUTINO, VESPERTINO | matutino, vespertino |
| INFANTIL 4 | MATUTINO, VESPERTINO | matutino, vespertino |
| INFANTIL 5 | MATUTINO, VESPERTINO | matutino, vespertino |
| 1º ANO | MATUTINO, VESPERTINO | matutino, vespertino |
| 2º ANO | MATUTINO, VESPERTINO | matutino, vespertino |
| 3º ANO | MATUTINO, VESPERTINO | matutino, vespertino |
| 4º ANO | MATUTINO, VESPERTINO | matutino, vespertino |
| 5º ANO | MATUTINO, VESPERTINO | matutino, vespertino |
| 6º ANO | MATUTINO | matutino |
| 7º ANO | MATUTINO | matutino |
| 8º ANO | MATUTINO | matutino |
| 9º ANO | MATUTINO | matutino |
| 1ª SÉRIE | MATUTINO | matutino |
| 2ª SÉRIE | MATUTINO | matutino |
| 3ª SÉRIE | MATUTINO | matutino |

Todas `ano_letivo=2026`, `escola_id` da escola única.

### Regras de parse planilha

- **INFANTIL**: header já é "SERIE - TURNO" (ex: "MATERNAL - MATUTINO") → turno direto.
- **FUND1** (1º–5º ANO): header "SERIE - LETRA" (ex: "1º ANO - A"). Letra A → turma MATUTINO. Letra B → turma VESPERTINO.
- **FUND2** (6º–9º ANO): header "SERIE - A". → turma MATUTINO.
- **MÉDIO**: header "Nª SÉRIE - EM - A". → turma MATUTINO. Série armazenada sem "- EM".

Linhas onde valor da mensalidade está vazio/zero/null: pulam (não geram matrícula).

## Pipeline de Reset

Script Node em `scripts/reset-matriculas-2026.ts`. Flags: `--dry-run` (default), `--commit` (executa).

**Ordem de execução:**

1. **Parse planilha** `public/MATRICULADOS2026.xlsx` em `[{nome, serie, turma, turno, valor}]`.
2. **Match alunos** por nome normalizado (lowercase + remove acentos via `String.normalize('NFD').replace(/[̀-ͯ]/g,'')` + trim + collapse spaces) contra `alunos.nome` normalizado da mesma forma.
3. **Validação:** se algum nome não bater → imprime lista + **aborta** (zero alteração no DB).
4. **Backup explícito (manual):** `pg_dump` antes do `--commit`. Script avisa e pede confirmação interativa.
5. **Delete (transação única):**
   - `delete from pagamentos where matricula_id in (select id from matriculas where ano_letivo=2026)`
   - `delete from cobrancas where matricula_id in (select id from matriculas where ano_letivo=2026)`
   - `delete from matriculas where ano_letivo=2026`
   - `delete from turmas where ano_letivo=2026`
   - `delete from series where id not in (lista 16 alvo) and id not in (select serie_id from turmas) and id not in (select serie_id from matriculas)`
6. **Upsert séries** (16) — mantém id existente se nome bate, cria as faltantes (INFANTIL5).
7. **Insert turmas** (21).
8. **Insert matrículas** — linha planilha com valor > 0:
   - `aluno_id` matched
   - `serie_id`, `turma_id` resolvidos
   - `plano_id` = plano único "Mensalidade 2026"
   - `tipo_vaga='paga'`, `percentual_bolsa=0`
   - `valor_mensalidade_praticado` = valor planilha
   - `data_matricula=2026-01-01`, `ano_letivo=2026`, `status='ativa'`
9. **Gerar cobranças** via helper adaptado: 12 parcelas, vencimento dia 10, `valor_original = valor_mensalidade_praticado`.

Transação inteira (BEGIN/COMMIT/ROLLBACK). Falha em qualquer passo → rollback total.

## Mudança em `generate-charges.ts`

Atualizar `generateChargesForEnrollment`:

- Buscar `valor_mensalidade_praticado` da matrícula.
- Se setado: usar como `valor_original` direto; ignorar cálculo de bolsa.
- Se null: comportamento atual (plano × percentual_bolsa).

## Mudança em UI — `matricula-edit-dialog.tsx`

Adicionar campo:

```tsx
<label>
  Valor mensalidade praticado (R$)
  <input
    name="valor_mensalidade_praticado"
    type="number"
    step="0.01"
    min="0"
    placeholder="Opcional — usa valor do plano se em branco"
  />
</label>
```

Action `upsertMatriculaSemValorAction` (`src/lib/actions/alunos-sem-valor.ts`):
- Aceita `valor_mensalidade_praticado` opcional
- Salva no insert/update da matrícula
- Se valor mudou e matrícula tinha cobranças geradas: regera (delete unpaid → insert)

## Match de Alunos — Detalhe

Função `normalizeName(s)`:
```ts
s.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/\s+/g,' ').trim()
```

Pre-flight: `select id, nome from alunos`. Constrói map normalizado → id. Match O(1) por linha planilha.

**Conflitos:** se 2 alunos DB normalizam pro mesmo nome → erro, lista ambos, abortar. (Caso raro, requer revisão manual.)

## Backup / Rollback

- **Antes do `--commit`:** dump completo via `pg_dump` ou snapshot Supabase. Script imprime comando sugerido e exige flag `--i-have-backup`.
- **Em caso de falha mid-transaction:** ROLLBACK automático restaura estado.
- **Em caso de regret pós-commit:** restaurar dump manual.

## Não-objetivos (YAGNI)

- Não importa responsáveis/endereços/contatos
- Não atualiza dados de aluno existente
- Não cria alunos novos (planilha não tem dados suficientes)
- Não tenta detectar bolsistas (todos `tipo_vaga='paga'`; valor diferente = valor diferente, sem inferência)
- Não regera matrículas para alunos sem valor (manual via UI existente)

## Testing

- **Unit:** `parseMatriculadosXlsx(buffer)` → output deterministico
- **Unit:** `normalizeName(s)` → casos: acentos, maiúsculas, espaços duplos
- **Unit:** `generateChargesForEnrollment` com `valor_mensalidade_praticado` setado vs null
- **Integration:** rodar `--dry-run` em Supabase real, validar contagens de delete/insert previstas
- **Manual smoke:** após `--commit`, abrir UI `/financeiro/alunos-com-desconto`, validar valores batem com planilha

## Arquivos

**Criar:**
- `supabase/migrations/2026MMDD_matricula_valor_praticado.sql`
- `scripts/reset-matriculas-2026.ts`
- `scripts/lib/parse-matriculados-xlsx.ts`
- `scripts/lib/parse-matriculados-xlsx.test.ts`

**Modificar:**
- `src/lib/server/generate-charges.ts` — branch `valor_mensalidade_praticado`
- `src/components/finance/matricula-edit-dialog.tsx` — campo valor
- `src/lib/actions/alunos-sem-valor.ts` — aceitar campo valor
- `src/lib/data/alunos-sem-valor.ts` — retornar campo valor

## Risco

- **Alto:** delete cascateia. Backup obrigatório.
- **Médio:** match de nome pode falhar — script aborta sem alterar nada, mitigado.
- **Médio:** geração de 5500+ cobranças nova. Validar performance do insert em batch.
- **Baixo:** UI nova campo — change isolada.
