#!/usr/bin/env bash
# Regenera supabase/migrations/202605270002_seed_real_data.sql com snapshot atual do banco.
# Uso: bash scripts/regenerate_seed_migration.sh
# Pre-requisito: stack supabase rodando (docker container supabase_db_rrb-escola).

set -euo pipefail

MIGRATION="supabase/migrations/202605270002_seed_real_data.sql"
TMP_AUTH=$(mktemp)
TMP_DATA=$(mktemp)
TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)

echo "=== Backup binario antes de regerar ==="
mkdir -p backups
docker exec supabase_db_rrb-escola pg_dump -U postgres -d postgres \
  -Fc --no-owner --no-acl > "backups/pre_regen_$(date +%Y%m%d_%H%M%S).dump"

echo "=== Dump auth.users + auth.identities ==="
docker exec supabase_db_rrb-escola pg_dump -U postgres -d postgres \
  --data-only --inserts --no-owner --no-acl \
  --table=auth.users --table=auth.identities > "$TMP_AUTH"

echo "=== Dump public schema ==="
docker exec supabase_db_rrb-escola pg_dump -U postgres -d postgres \
  --data-only --inserts --no-owner --no-acl \
  --schema=public \
  --exclude-table=schema_migrations > "$TMP_DATA"

echo "=== Monta migration ==="
{
  echo "-- Seed real data snapshot (capturado em $TIMESTAMP)"
  echo "-- Regerado via: bash scripts/regenerate_seed_migration.sh"
  echo "-- Idempotente via ON CONFLICT DO NOTHING."
  echo ""
  cat "$TMP_AUTH"
  echo ""
  cat "$TMP_DATA"
} > "$MIGRATION"

echo "=== Adiciona ON CONFLICT DO NOTHING ==="
python -c "
import re
with open('$MIGRATION','r',encoding='utf-8') as f:
    content = f.read()
content = re.sub(r'(INSERT INTO [a-z_.]+ VALUES \(.+?\));$', r'\1 ON CONFLICT DO NOTHING;', content, flags=re.MULTILINE | re.DOTALL)
with open('$MIGRATION','w',encoding='utf-8') as f:
    f.write(content)
print('done')
"

rm -f "$TMP_AUTH" "$TMP_DATA"

LINES=$(wc -l < "$MIGRATION")
INSERTS=$(grep -c "INSERT INTO" "$MIGRATION" || true)
echo ""
echo "Migration gerada: $MIGRATION"
echo "  Lines: $LINES"
echo "  Inserts: $INSERTS"
