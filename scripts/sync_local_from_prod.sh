#!/usr/bin/env bash
# Espelha o banco local a partir de PRODUCAO (schema + dados).
# Uso: bash scripts/sync_local_from_prod.sh
# Pre-requisitos:
#   - stack supabase rodando (docker container supabase_db_rrb-escola)
#   - projeto linkado (npx supabase link) para o dump remoto
#
# Os dumps ficam em backups/prod/ (fora do git: contem dados pessoais de alunos).
# Depois de rodar, `npx supabase db reset --local` restaura este mesmo estado,
# porque supabase/seed.sql carrega backups/prod/prod_data_fixed.sql.

set -euo pipefail

CONTAINER="supabase_db_rrb-escola"
PROD_DIR="backups/prod"
SCHEMA_RAW="$PROD_DIR/prod_schema.sql"
DATA_RAW="$PROD_DIR/prod_data.sql"
SCHEMA_FIXED="$PROD_DIR/prod_schema_fixed.sql"
DATA_FIXED="$PROD_DIR/prod_data_fixed.sql"

# pg_dump zera o search_path; com ele vazio, funcoes que chamam unaccent() ou
# triggers que inserem sem qualificar o schema quebram na restauracao.
SEARCH_PATH_FIX="s|SELECT pg_catalog.set_config('search_path', '', false);|SELECT pg_catalog.set_config('search_path', 'public, extensions, pg_catalog', false);|"

mkdir -p "$PROD_DIR" backups

echo "=== Backup binario do banco local atual ==="
docker exec "$CONTAINER" pg_dump -U postgres -d postgres \
  -Fc --no-owner --no-acl > "backups/pre_prod_mirror_$(date +%Y%m%d_%H%M%S).dump"

echo "=== Dump do schema de producao ==="
npx supabase db dump --linked -f "$SCHEMA_RAW"

echo "=== Dump dos dados de producao ==="
npx supabase db dump --linked --data-only --use-copy -f "$DATA_RAW"

echo "=== Corrige search_path nos dumps ==="
sed "$SEARCH_PATH_FIX" "$SCHEMA_RAW" > "$SCHEMA_FIXED"
sed "$SEARCH_PATH_FIX" "$DATA_RAW" > "$DATA_FIXED"

echo "=== Recria schema public e limpa auth ==="
docker exec -i "$CONTAINER" psql -U postgres -d postgres -q \
  -c "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;" \
  -c "TRUNCATE auth.users CASCADE;" > /dev/null

echo "=== Aplica schema de producao ==="
docker exec -i "$CONTAINER" psql -U postgres -d postgres -q < "$SCHEMA_FIXED"

echo "=== Carrega dados de producao ==="
# session_replication_role=replica desliga triggers/FK durante a carga: o dump
# vem com FK circular (categorias_financeiras) e ordem de tabelas nao garantida.
docker exec -i "$CONTAINER" psql -U postgres -d postgres -q \
  --set=session_replication_role=replica < "$DATA_FIXED"

echo ""
echo "=== Contagens ==="
docker exec -i "$CONTAINER" psql -U postgres -d postgres -c "
select 'alunos' tabela, count(*) from alunos
union all select 'matriculas', count(*) from matriculas
union all select 'turmas', count(*) from turmas
union all select 'cobrancas', count(*) from cobrancas
union all select 'historico_notas', count(*) from historico_notas
union all select 'auth.users', count(*) from auth.users
order by 1;"

echo ""
echo "Banco local espelhado de producao."
echo "Lembre: .env.local precisa estar com o bloco LOCAL ativo para o dev usar este banco."
