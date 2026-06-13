# Aplicar em produção — pendente

Migrations e correções aplicadas no Docker local (`db reset` OK, 66 migrations). **Falta aplicar em produção.**

## Como aplicar

```bash
# Aplica apenas as migrations pendentes (NÃO usar db reset em prod)
npx supabase db push --linked
```

## Migrations novas desta rodada (folha-v2 + adendos + correções de ordem)

Folha v2 + adendos:
- `202606120001_folha_v2_schema.sql` — schema folha_* + RLS
- `202606120002_folha_v2_seed.sql` — rubricas/perfis/faixas 2026 (sindicato = percentual_sobre_base)
- `202606120003_despesas_folha_link.sql` — folha_run_id em despesas
- `202606120004_folha_v2_permissao.sql` — RBAC rh.folha-v2 (admin + financeiro)
- `202606120005_folha_v2_adendos.sql` — cargo/cbo/aulas_por_turno + coefs IRRF (ADENDO 1+2)

Férias e 13º (Folha v2.1):
- `202606130001_folha_v21_ferias_13o.sql` — tipo em runs, folha_periodos_aquisitivos, periodo_aquisitivo_id em itens, campos contrato/config, rubricas 13º/férias/dobro, recesso, companies endereco/cidade
- `202606130002_seed_faixas_2025.sql` — faixas INSS/IRRF 2025 (vigencia_inicio 2025-01-01) para média/caso dourado
- `202606130003_grants_authenticated.sql` — GRANT DML ao role authenticated/anon/service_role (RLS sozinha não basta; sem isto toda query autenticada dá "permission denied"). Conferir se prod já tem esses grants antes do push; a migration é idempotente.

Correções de bugs de ordem PRÉ-EXISTENTES (afetam db reset; idempotentes):
- `202605200004_rh_payroll_rls_policies.sql` — tornada defensiva (do-block if exists)
- `202605230002_eventos_escola.sql` — seed RBAC tornado defensivo
- `202605300001_rbac_permissoes.sql` — drop/recreate da policy eventos no rebuild de current_perfil
- `202606120006_rh_payroll_rls_garantia.sql` — garantia idempotente policies payroll
- `202606120007_eventos_rbac_garantia.sql` — garantia idempotente modulo eventos
- Renomes: `202605230001_rh_empresas_funcionarios` → `202605230005`; `202605230003_pdt_employee` → `202605290008`

> **Atenção aos renomes:** se prod já aplicou as versões antigas (`202605230001_rh_empresas_funcionarios`, `202605230003_pdt_employee`), os novos nomes re-executam como migrations "novas". Ambas são idempotentes (`add column if not exists`, alters tolerantes), então re-execução é segura. Conferir `supabase_migrations.schema_migrations` em prod antes do push.

## Remoção da folha legada (motor v1 / payroll) — IRREVERSÍVEL

Aplicada no local (`db push --local` OK). **Em prod, conferir ANTES do push:**

- `202606130005_drop_folha_legada.sql` — dropa tabelas `payroll`, `payroll_periods`, `payroll_import_cache` (cascade) e colunas legadas de `employees` (`base_salary`, `salario_sem_dsr`, `aplica_dobra`, `gps_default`).

> **CHECKLIST OBRIGATÓRIO antes do push em prod (irreversível, apaga dados históricos da folha v1):**
> - [ ] Confirmar que TODOS os funcionários ativos com salário em `employees` já têm contrato v2 equivalente em `folha_contratos` (a migração de contratos `0003f7a4` consumiu essas colunas; validar cobertura real em prod, não só local).
> - [ ] Exportar/backup das tabelas `payroll*` em prod antes do drop, se houver necessidade de histórico fiscal da folha v1.
> - [ ] Confirmar que nenhuma integração externa/relatório fiscal lê `payroll` em prod.
>
> Código já removido nesta branch: páginas `financeiro/folha/**`, `lib/{actions,data}/payroll.ts`, `lib/payroll/**`, `components/rh/payroll/**`, `validation/payroll.ts`. Compartilhados extraídos: `lib/folha/engine/brackets-calc.ts` (calcINSS/calcIR) e `lib/validation/brackets.ts`. Dashboard migrado para `folha_runs` (só status `aprovado`). Permissão de `/rh/brackets` movida de `rh.folha` → `rh.folha-v2`. O módulo `rh.folha` permanece no seed RBAC (inerte) — remover é opcional e separado.

## Validação fiscal antes do corte (operacional)

- [ ] Confirmar IRRF oficial com 2-3 contracheques reais (âncora mai/2026: rendimento 5836,32 → IRRF 324,61; fórmula dá 324,59)
- [ ] Migração de contratos a partir de `employees` (script one-off, revisão manual de hora-aula dos professores)
- [ ] Rodar folha da competência de corte em paralelo com a planilha do financeiro; bater totais (caso Ana Flávia: hora-aula 23,16 × 48 = 5002,56)

## PENDÊNCIA — finalizar cálculo da folha do PROFESSOR (com contador)

Status: **aberto** — aguardando definição do contador. Contratos de professor em prod
foram criados (script `criar_contratos_da_planilha.mjs`) com `salario_base` tirado da
coluna "Salário base" da planilha, mas isso está **conceitualmente errado**.

Diagnóstico (recibo oficial Ana Flávia, mai/2026):
- Professor é **HORISTA**, não mensalista. Recibo: SALÁRIO HORA 216h = 5.002,56 (valor-hora 23,16) + DSR PROFESSOR AULISTA 833,76 (= salário-hora ÷ 6) = total 5.836,32.
- INSS 618,58 · IRRF 324,61 · líquido 4.698,78 · base INSS/FGTS/IRRF = 5.836,32 (IRRF base 5.217,74).
- Relação planilha→recibo: `salário-hora ≈ TOTAL_planilha × 6/7`; `DSR = salário-hora ÷ 6`.

O que falta para fechar:
- [ ] Obter (RH/contador) `valor_hora_aula` + `aulas_semanais` reais de cada professor (a planilha só tem totais, não horas). Ana = 23,16/h × 48 aulas/sem × 4,5 semanas = 216h.
- [ ] Preencher `valor_hora_aula`/`aulas_semanais` nos contratos professor; a rubrica `hora_aula` (perfil `clt_professor`) já incide DSR (÷6 automático). Hoje esses campos estão nulos → proventos vinham 0 antes do paliativo.
- [ ] **Reverter migration `202606130006_professor_salario_base.sql`** (adicionou `salario_base` ao perfil `clt_professor`). Foi paliativo para não zerar; professor não é mensalista. Reverter quando os contratos forem para hora-aula. (rollback: `delete from folha_perfis_rubricas` da dupla clt_professor+salario_base.)
- [ ] Revalidar com o recibo da Ana após ajuste (e amostra de 2-3 professores).

Não-professores (perfil `clt`, ex.: Keila, Reginalda) já calculam corretamente por `salario_base`.

## Férias e 13º (v2.1) — operacional

- [ ] Habilitar `jobs.gerar_especiais` na config de cada empresa (tela Config → Férias e 13º) para o cron gerar 13º/férias automaticamente
- [ ] Ajustar `inicio` dos períodos aquisitivos backfillados (admissão antiga gera período já vencido — alinhar período corrente real com o contador)
- [ ] Import de bases históricas 2025 (opcional, só se usar média 12 meses): `node scripts/importar_bases_historicas.mjs --dry-run` depois `--apply`
- [ ] Smoke E2E com `?hoje=` simulado (dev): jobs geram decimo_1a (01/11), decimo_2a (01/12), férias (01/06); fechar férias baixa provisão + abre período; mensal de julho recebe ferias_desconto_gozo
- [ ] INSS 2025 método: caso dourado dá 842,12 (progressivo) vs 842,11 oficial (tabela única) — diferença de R$0,01 por método; confirmar com contador se o cliente exige tabela-única exata
