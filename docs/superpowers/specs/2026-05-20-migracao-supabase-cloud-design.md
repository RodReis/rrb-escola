# Design: Migração Supabase Docker Local → Cloud

**Data:** 2026-05-20  
**Status:** Aprovado

## Contexto

Projeto rrb-escola roda Supabase via Docker local (porta 55432/55421). Objetivo: migrar schema, dados reais e storage (imagens) para projeto Supabase Cloud existente (`fljkjhmwnjehsodvqaqk`). Keys da nuvem já disponíveis.

## Escopo

- Schema: 50+ migrations em `supabase/migrations/`
- Dados: todas as tabelas do schema `public` (dados reais)
- Storage: buckets `perfis-fotos` e `escola-logos`
- Auth: recriar usuário(s) admin manualmente na nuvem
- App: atualizar `.env.local` para apontar ao cloud

## Fora do escopo

- Migração de `auth.users` via dump (incompatível com Supabase Auth gerenciado)
- CI/CD ou deploy da aplicação Next.js

## Arquitetura da Migração

### Fase 1 — Schema via `supabase db push`

Usar Supabase CLI para linkar ao projeto cloud e aplicar todas as migrations em ordem. Mais seguro que pg_dump DDL: evita conflitos com roles/extensões gerenciadas pelo Supabase.

```bash
supabase link --project-ref fljkjhmwnjehsodvqaqk
supabase db push
```

### Fase 2 — Dados via pg_dump data-only

Dump somente dados (`--data-only`) do schema `public` local, excluindo tabelas gerenciadas pelo Supabase. Restore direto no cloud DB.

**Dump:**
```bash
pg_dump \
  --host 127.0.0.1 --port 55432 \
  --username postgres \
  --data-only \
  --schema public \
  --no-owner --no-privileges \
  --file dados_local.sql \
  postgres
```

**Restore:**
```bash
psql "postgresql://postgres:[SENHA]@db.fljkjhmwnjehsodvqaqk.supabase.co:5432/postgres" \
  --file dados_local.sql
```

A senha do DB cloud está na variável `SUPABASE_CLOUD_DB_URL` comentada no `.env.local`.

### Fase 3 — Storage via supabase CLI

Download dos buckets do local, re-upload para cloud.

**Download (apontando para local):**
```bash
# Garantir que CLI está apontando para local antes deste passo
supabase storage cp --recursive ss:///perfis-fotos  ./backup-storage/perfis-fotos
supabase storage cp --recursive ss:///escola-logos  ./backup-storage/escola-logos
```

**Upload (após linkar ao cloud):**
```bash
supabase link --project-ref fljkjhmwnjehsodvqaqk
supabase storage cp --recursive ./backup-storage/perfis-fotos ss:///perfis-fotos
supabase storage cp --recursive ./backup-storage/escola-logos ss:///escola-logos
```

### Fase 4 — Auth

Usuários `auth.users` não migram via dump. Recriar admin no Supabase Dashboard (Authentication > Users > Invite) ou via script usando service role key.

### Fase 5 — Atualizar .env.local

Substituir variáveis locais pelas da nuvem:

```env
NEXT_PUBLIC_SUPABASE_URL=https://fljkjhmwnjehsodvqaqk.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key cloud>
SUPABASE_SERVICE_ROLE_KEY=<service role key cloud>
```

### Fase 6 — Verificação

- `supabase status` local pode continuar rodando (não interfere)
- Rodar app localmente apontando para cloud
- Verificar: login, listagem de alunos, imagens de perfis, logos de escola

## Ordem de Execução

1. Fase 1: `supabase link` + `supabase db push`
2. Fase 2: pg_dump local → psql restore cloud
3. Fase 3: storage cp download → re-link → storage cp upload
4. Fase 4: recriar admin no Dashboard
5. Fase 5: atualizar `.env.local`
6. Fase 6: testar app

## Riscos

| Risco | Mitigação |
|-------|-----------|
| Conflito de FK durante restore | Usar `--disable-triggers` no psql restore se necessário |
| Storage cp falha em arquivo grande | Retry manual por bucket |
| Senha DB cloud errada | Extrair de `SUPABASE_CLOUD_DB_URL` no `.env.local` |
| Migrations com erro no cloud | Rodar `supabase db push --dry-run` primeiro |

## Dependências

- Supabase CLI: `npm install supabase --save-dev` ou instalação global
- `psql` disponível no PATH
- Docker local rodando com dados (`supabase status`)
- Acesso ao Supabase Dashboard (para recriar auth users)
