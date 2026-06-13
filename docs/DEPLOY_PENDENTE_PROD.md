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

## Validação fiscal antes do corte (operacional)

- [ ] Confirmar IRRF oficial com 2-3 contracheques reais (âncora mai/2026: rendimento 5836,32 → IRRF 324,61; fórmula dá 324,59)
- [ ] Migração de contratos a partir de `employees` (script one-off, revisão manual de hora-aula dos professores)
- [ ] Rodar folha da competência de corte em paralelo com a planilha do financeiro; bater totais (caso Ana Flávia: hora-aula 23,16 × 48 = 5002,56)

## Férias e 13º (v2.1) — operacional

- [ ] Habilitar `jobs.gerar_especiais` na config de cada empresa (tela Config → Férias e 13º) para o cron gerar 13º/férias automaticamente
- [ ] Ajustar `inicio` dos períodos aquisitivos backfillados (admissão antiga gera período já vencido — alinhar período corrente real com o contador)
- [ ] Import de bases históricas 2025 (opcional, só se usar média 12 meses): `node scripts/importar_bases_historicas.mjs --dry-run` depois `--apply`
- [ ] Smoke E2E com `?hoje=` simulado (dev): jobs geram decimo_1a (01/11), decimo_2a (01/12), férias (01/06); fechar férias baixa provisão + abre período; mensal de julho recebe ferias_desconto_gozo
- [ ] INSS 2025 método: caso dourado dá 842,12 (progressivo) vs 842,11 oficial (tabela única) — diferença de R$0,01 por método; confirmar com contador se o cliente exige tabela-única exata
