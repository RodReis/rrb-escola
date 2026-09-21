# DB Seed Workflow

Como popular e restaurar o banco local.

Existem duas fontes de dados possíveis, e elas servem a propósitos diferentes:

| Fonte | Comando | Dados | Use quando |
|-------|---------|-------|-----------|
| **Espelho de produção** (recomendado) | `bash scripts/sync_local_from_prod.sh` | Iguais aos de prod (789 alunos) | Trabalho do dia a dia, reproduzir bug relatado |
| **Snapshot versionado** (legado) | `npx supabase db reset --local` | Congelados em 2026-05-17 (509 alunos) | Validar a cadeia de migrations do zero |

## Espelhar produção

```bash
bash scripts/sync_local_from_prod.sh
```

O script:

1. Faz backup binário do banco local em `backups/pre_prod_mirror_TIMESTAMP.dump`
2. Baixa schema + dados de prod via `supabase db dump --linked` para `backups/prod/`
3. Corrige o `search_path` dos dumps (ver [gotcha](#gotcha-search_path-nos-dumps))
4. Recria o schema `public` e limpa `auth.users`
5. Carrega schema e dados de produção
6. Marca as migrations como aplicadas em `supabase_migrations.schema_migrations`
7. Roda `npm run seed:auth` para garantir o admin de teste local

Os dumps ficam em `backups/`, que está no `.gitignore`: contêm dados pessoais de
alunos (CPF, RG, certidão, contatos, informações médicas) e nunca devem ser versionados.

Depois do sync, confira que o `.env.local` está com o bloco **Supabase Local Docker**
ativo — com o bloco Cloud ativo, `npm run dev` e todos os scripts escrevem direto
em produção.

### Fluxo do dia a dia

```bash
bash scripts/sync_local_from_prod.sh   # quando quiser os dados atuais de prod
npx supabase migration up --local      # aplica migrations novas por cima
```

O passo 6 do script é o que torna isso possível: `supabase db dump` não inclui o
schema `supabase_migrations`, então sem a marcação o CLI acharia que nenhuma
migration rodou e tentaria reaplicar todas sobre um schema que já existe.

### Por que `db reset --local` não espelha produção

O reset apaga tudo e reaplica a cadeia desde o zero. Duas coisas impedem que ele
termine com os dados de produção:

1. Ele restaura o snapshot `202605270002_seed_real_data.sql`, com os dados
   **antigos** (509 alunos, capturados em 2026-05-17) em vez dos 789 de produção.
2. ~28 migrations de dados (boletins, rematrículas, correções) chumbam UUIDs de
   séries e turmas em vez de resolvê-los por consulta. Num banco vazio elas quebram:

```
insert or update on table "disciplinas" violates foreign key constraint
"disciplinas_serie_id_fkey"
```

Essas migrations rodam bem sobre um banco já povoado — o erro só aparece no reset
do zero. Torná-las reexecutáveis exigiria reescrever cada uma para resolver os
UUIDs dinamicamente. Como todas já estão aplicadas em produção e não rodarão de
novo lá, isso não foi feito.

Ou seja: `db reset --local` serve para validar a cadeia de migrations num banco
descartável; o script de sync, para trabalhar com dados reais.

## Login local

Usuário de teste: `admin@rrb.local` / `admin123` (definidos em `APP_DEFAULT_ADMIN_*`
no `.env.local`).

```bash
npm run seed:auth
```

Cria o usuário se não existir, garante o perfil `admin` ativo e reaplica a senha.
É idempotente e recusa rodar contra banco remoto — como ele escreve senha,
apontado para prod sobrescreveria a de um admin real. Para forçar:
`SEED_ADMIN_ALLOW_REMOTE=1 npm run seed:auth`.

### "Sem perfil ativo. Solicite acesso ao administrador."

O login autenticou, mas não há linha em `perfis` para aquele `user_id` — ou ela
está com `ativo = false`. Rode `npm run seed:auth`.

Acontece sempre que o banco local é reconstruído a partir de produção: **`admin@rrb.local`
não tem perfil em produção**, ele só existia no snapshot local.

Detalhe que explica por que o problema voltava a cada reconstrução: o perfil
`22222222-2222-2222-2222-222222222222` pertence a **usuários diferentes** nos dois
mundos — a `admin@rrb.local` no snapshot local e a `admin@rrbescola.local` em
produção. Qualquer mistura das duas fontes deixa o perfil apontando para o usuário
errado ou inativo. Corrigir por INSERT manual não resolve: some na próxima
reconstrução. A correção tem que passar pelo `seed:auth`, que o script de sync já
chama no final.

### `Invalid Refresh Token: Refresh Token Not Found`

O navegador tem cookie de sessão apontando para um auth user que não existe mais.
Limpe os cookies `sb-*` do site (DevTools → Application → Cookies) ou faça logout.

## Snapshot versionado (legado)

`supabase/migrations/202605270002_seed_real_data.sql` é um snapshot de ~23k rows
capturado em 2026-05-17, restaurado automaticamente pelo `db reset --local`.

Cobre `auth.users`/`auth.identities`, `escolas`, `perfis`, `series`, `turmas`,
`alunos`, `matriculas`, `cobrancas`, `pagamentos`, folha de pagamento, despesas e
dispositivos de acesso.

Regerar com `bash scripts/regenerate_seed_migration.sh`, que faz backup binário,
dump `--column-inserts`, adiciona `ON CONFLICT DO NOTHING` e corrige o `search_path`.

**Na prática não regenere.** Isso versionaria dados pessoais de ~789 alunos em texto
claro no git, com churn de dezenas de milhares de linhas a cada atualização. Para
trabalhar com dados atuais, use o espelho de produção. O snapshot continua existindo
porque ~28 migrations de dados dependem dos registros que ele cria.

### Limitações do snapshot

Gerado com `--column-inserts`, então sobrevive à adição de colunas novas. Mas
quebra ao **remover coluna**, **mudar tipo** de coluna existente ou **adicionar
NOT NULL sem default**.

## Backup e restauração

Backup ad-hoc:

```bash
docker exec supabase_db_rrb-escola pg_dump -U postgres -d postgres \
  -Fc --no-owner --no-acl \
  > "backups/manual_$(date +%Y%m%d_%H%M%S).dump"
```

Restaurar:

```bash
ls backups/

docker exec -i supabase_db_rrb-escola pg_restore \
  -U postgres -d postgres --clean --if-exists --no-owner --no-acl \
  < backups/<arquivo>.dump

docker exec -i supabase_db_rrb-escola psql -U postgres -d postgres \
  -c "select count(*) from alunos;"
```

Warnings sobre event triggers de superuser são ignoráveis.

## Gotcha: search_path nos dumps

`pg_dump` emite `SELECT pg_catalog.set_config('search_path', '', false);`. Com o
search_path vazio, qualquer função ou trigger que referencie objetos sem qualificar
o schema falha. Dois casos reais no projeto:

- `immutable_unaccent()` chama `unaccent('unaccent', $1)`. Sem search_path a coluna
  gerada `alunos.nome_normalizado` não é criada, a tabela `alunos` não existe e ~30
  objetos dependentes quebram em cascata.
- O trigger `registrar_historico_matricula` insere em `historico_matriculas`.

`sync_local_from_prod.sh` substitui por `'public, extensions, pg_catalog'`;
`regenerate_seed_migration.sh`, por `'public, pg_catalog'`.

## Nota sobre `supabase/seed.sql`

É um noop (`select 1;`). O `db reset --local` o executa depois de todas as migrations,
sem o mesmo controle de ordem, então a inicialização do snapshot ficou na migration
`202605270002_seed_real_data.sql`.

Ele também não serve para carregar o dump de produção: o CLI envia o arquivo via
protocolo, não pelo psql, então meta-comandos como `\i` falham com
`syntax error at or near "\"`.
