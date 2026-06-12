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
