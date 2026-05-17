# DB Seed Workflow

Como preservar e restaurar o estado do banco local.

## Por que existe

O Supabase CLI tem `npx supabase db reset --local` que **apaga tudo** e reaplica migrations. Antes desta solução, qualquer reset destruía dados cadastrados manualmente.

Solução: migration final `202605270002_seed_real_data.sql` contém snapshot completo do banco em formato SQL (INSERTs com `ON CONFLICT DO NOTHING`). Após reset, ela restaura todo o estado.

## Estado preservado

Snapshot atual cobre:

- `auth.users` + `auth.identities` (admin login)
- `escolas`, `perfis`, `segmentos`, `planos`
- `series`, `turmas`, `alunos`, `matriculas`, `historico_matriculas`
- `enderecos_aluno`, `contatos_aluno`, `responsaveis_aluno`, `informacoes_medicas`, `autorizacoes_aluno`, `pessoas_autorizadas`
- `cobrancas`, `pagamentos`
- `companies`, `employees`, `payroll`, `payroll_periods`, `inss_brackets`, `ir_brackets`
- `categorias_despesa`, `despesas`
- `dispositivos_acesso`

## Comandos

### Resetar banco e restaurar snapshot

```bash
npx supabase db reset --local
```

Sequência:
1. Drop schema `public` + `auth`
2. Reaplica todas migrations em `supabase/migrations/` em ordem alfabética
3. `202605270002_seed_real_data.sql` restaura ~23k rows
4. Roda `supabase/seed.sql` (noop atualmente)

### Regerar snapshot (após cadastrar dados novos)

```bash
bash scripts/regenerate_seed_migration.sh
```

O script:
1. Faz `pg_dump -Fc` (backup binário) em `backups/pre_regen_TIMESTAMP.dump`
2. Dump `--data-only --column-inserts` de `auth.users`, `auth.identities`, todo `public` schema (exceto `schema_migrations`)
3. Monta `supabase/migrations/202605270002_seed_real_data.sql`
4. Adiciona `ON CONFLICT DO NOTHING` em cada INSERT (idempotência)
5. Corrige `search_path` (pg_dump zera por default, quebra triggers que referenciam tabelas sem schema)

Sempre commite o resultado:

```bash
git add supabase/migrations/202605270002_seed_real_data.sql
git commit -m "chore(seed): atualizar snapshot"
```

### Restaurar de backup binário

Se a migration de seed quebrar (FK, schema mismatch etc):

```bash
# Lista backups
ls backups/

# Restaura
docker exec -i supabase_db_rrb-escola pg_restore \
  -U postgres -d postgres --clean --if-exists --no-owner --no-acl \
  < backups/<arquivo>.dump

# Verifica
docker exec -i supabase_db_rrb-escola psql -U postgres -d postgres \
  -c "select count(*) from alunos;"
```

Warnings sobre event triggers de superuser são ignoráveis.

### Backup manual ad-hoc

```bash
docker exec supabase_db_rrb-escola pg_dump -U postgres -d postgres \
  -Fc --no-owner --no-acl \
  > "backups/manual_$(date +%Y%m%d_%H%M%S).dump"
```

## Gotchas conhecidos

### Cookie de sessão stale após reset

A migration recria `auth.users` com mesmo UUID, mas o navegador pode ter token de refresh do auth user antigo. Sintoma:

```
AuthApiError: Invalid Refresh Token: Refresh Token Not Found
```

Fix: DevTools → Application → Cookies → delete cookies `sb-*` do site. Ou logout/login.

### Migration de seed depende da ordem do schema

A migration foi gerada com `--column-inserts` (colunas explícitas), então sobrevive a adição de novas colunas. Mas:

- **Remover coluna** existente quebra inserts antigos
- **Mudar tipo** de coluna existente quebra inserts
- **Adicionar NOT NULL sem default** em coluna que o snapshot não tem quebra inserts

Se schema mudar de forma incompatível, regenere o snapshot ou edite manualmente.

### search_path

`pg_dump` por default emite:
```sql
SELECT pg_catalog.set_config('search_path', '', false);
```

Search path vazio quebra triggers que fazem `insert into outra_tabela` sem qualificar com `public.`. Exemplo no projeto: trigger `registrar_historico_matricula` insere em `historico_matriculas`.

O regenerator substitui essa linha por:
```sql
SELECT pg_catalog.set_config('search_path', 'public, pg_catalog', false);
```

### seed.sql não roda mais

`supabase/seed.sql` virou noop (`select 1;`). Toda inicialização está em `202605270002_seed_real_data.sql`. Razão: seed.sql roda **depois** de todas migrations e não tem o mesmo controle de ordem. Migration final é mais previsível.

## Trade-offs

| Solução | Prós | Contras |
|---------|------|---------|
| Migration de seed (atual) | Versão controlado, idempotente, automático | 24k linhas, churn grande no git em cada update |
| Backup binário só | Pequeno, rápido | Não versionado, perde se backup local sumir |
| Sem snapshot | Zero overhead | Perde tudo no primeiro reset (já aconteceu) |

Decisão: migration de seed como fonte da verdade, backups binários como segurança extra de curto prazo.
