# Migração Supabase Cloud Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrar schema, dados reais e storage do Supabase Docker local para o projeto Supabase Cloud `fljkjhmwnjehsodvqaqk`.

**Architecture:** Supabase CLI aplica migrations (schema limpo, sem conflito de roles). pg_dump data-only migra dados do schema public. supabase storage cp faz backup local dos buckets e re-upload para cloud.

**Tech Stack:** Supabase CLI v2.100.1, psql 18.4, Docker local (porta 55432), Supabase Cloud (`fljkjhmwnjehsodvqaqk`)

---

## Pré-condições

Antes de começar, confirmar:
- Docker local rodando: `npx supabase status` deve mostrar serviços UP
- Senha do DB cloud extraída de `SUPABASE_CLOUD_DB_URL` em `.env.local` (formato: `postgresql://postgres:[SENHA]@db.fljkjhmwnjehsodvqaqk.supabase.co:5432/postgres`)
- Anon key cloud e service role key cloud disponíveis no Supabase Dashboard (Settings > API)

---

## Task 1: Linkar CLI ao projeto cloud e aplicar schema

**Files:**
- Sem alteração de código
- Cria: `./backup-storage/` (diretório temporário para storage)

- [ ] **Step 1: Confirmar Docker local está rodando**

```bash
npx supabase status
```

Esperado: todos os serviços com status `started`. Se não estiver, rodar `npx supabase start` antes de continuar.

- [ ] **Step 2: Linkar CLI ao projeto cloud**

```bash
npx supabase link --project-ref fljkjhmwnjehsodvqaqk
```

CLI vai pedir a senha do DB cloud. Usar a senha extraída de `SUPABASE_CLOUD_DB_URL` (a parte entre `:` e `@` na string de conexão).

Esperado: `Finished supabase link.`

- [ ] **Step 3: Dry-run para verificar migrations**

```bash
npx supabase db push --dry-run
```

Esperado: lista das migrations que serão aplicadas, sem erros. Se alguma migration falhar no dry-run, investigar antes de continuar.

- [ ] **Step 4: Aplicar migrations no cloud**

```bash
npx supabase db push
```

Esperado: cada migration listada como `Applied migration XXXXXXXXX_nome.sql`. Ao final: `Finished supabase db push.`

Se aparecer erro de migration já aplicada: normal, significa que o projeto cloud já tinha migrations parciais. Se aparecer erro de SQL, copiar a mensagem e investigar a migration específica.

---

## Task 2: Dump de dados do banco local

**Files:**
- Cria: `./dados_local.sql` (dump temporário — NÃO commitar)

- [ ] **Step 1: Criar dump data-only do schema public**

```bash
PGPASSWORD=postgres pg_dump \
  --host 127.0.0.1 \
  --port 55432 \
  --username postgres \
  --data-only \
  --schema public \
  --no-owner \
  --no-privileges \
  --file dados_local.sql \
  postgres
```

A senha padrão do Supabase local é `postgres`. Se pedir senha interativamente, digitar `postgres`.

Esperado: arquivo `dados_local.sql` criado, sem mensagens de erro. Verificar tamanho:

```bash
ls -lh dados_local.sql
```

- [ ] **Step 2: Inspecionar dump rapidamente**

```bash
head -50 dados_local.sql
```

Verificar que começa com `SET` statements do PostgreSQL e não contém `CREATE TABLE` (seria DDL indesejado). Se contiver DDL, o dump foi feito errado — re-rodar o Step 1.

---

## Task 3: Restore de dados no cloud

**Files:**
- Usa: `./dados_local.sql`

- [ ] **Step 1: Conectar ao cloud e verificar acesso**

Substituir `[SENHA]` pela senha real extraída de `SUPABASE_CLOUD_DB_URL`:

```bash
psql "postgresql://postgres:[SENHA]@db.fljkjhmwnjehsodvqaqk.supabase.co:5432/postgres" \
  --command "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';"
```

Esperado: número de tabelas no cloud (deve ser o mesmo número que no local após o `db push`). Se der erro de conexão, verificar senha e conectividade.

- [ ] **Step 2: Aplicar dump no cloud (primeira tentativa)**

```bash
psql "postgresql://postgres:[SENHA]@db.fljkjhmwnjehsodvqaqk.supabase.co:5432/postgres" \
  --file dados_local.sql \
  2>&1 | tee restore_log.txt
```

O `tee` salva o log para análise. Esperado: muitos `INSERT 0 N` sem erros `ERROR:`.

- [ ] **Step 3: Verificar erros no log**

```bash
grep -i "ERROR" restore_log.txt
```

Esperado: nenhum resultado. Se houver erros de FK (foreign key violation), re-rodar o restore com triggers desabilitados:

Criar arquivo `restore_with_triggers.sql`:

```sql
SET session_replication_role = 'replica';
\i dados_local.sql
SET session_replication_role = 'origin';
```

Depois rodar:

```bash
psql "postgresql://postgres:[SENHA]@db.fljkjhmwnjehsodvqaqk.supabase.co:5432/postgres" \
  --file restore_with_triggers.sql \
  2>&1 | tee restore_log2.txt
```

- [ ] **Step 4: Confirmar contagem de registros no cloud**

```bash
psql "postgresql://postgres:[SENHA]@db.fljkjhmwnjehsodvqaqk.supabase.co:5432/postgres" \
  --command "SELECT schemaname, tablename, n_live_tup FROM pg_stat_user_tables WHERE schemaname = 'public' ORDER BY n_live_tup DESC LIMIT 20;"
```

Comparar com a mesma query no local:

```bash
PGPASSWORD=postgres psql \
  --host 127.0.0.1 --port 55432 \
  --username postgres \
  --dbname postgres \
  --command "SELECT schemaname, tablename, n_live_tup FROM pg_stat_user_tables WHERE schemaname = 'public' ORDER BY n_live_tup DESC LIMIT 20;"
```

As contagens devem ser iguais (ou muito próximas).

---

## Task 4: Backup e migração do Storage

**Files:**
- Cria: `./backup-storage/perfis-fotos/` (temporário)
- Cria: `./backup-storage/escola-logos/` (temporário)

- [ ] **Step 1: Desvincular CLI do cloud para apontar ao local**

O CLI precisa estar apontando para o projeto LOCAL para fazer o download. Verificar qual projeto está linkado:

```bash
cat supabase/.temp/project-ref 2>/dev/null || echo "sem link"
```

Se mostrar `fljkjhmwnjehsodvqaqk` (cloud), desvincular temporariamente:

```bash
# Salvar referência cloud para uso posterior
echo "fljkjhmwnjehsodvqaqk" > .cloud-project-ref

# Remover link atual
rm -f supabase/.temp/project-ref
```

- [ ] **Step 2: Criar diretório de backup**

```bash
mkdir -p backup-storage/perfis-fotos
mkdir -p backup-storage/escola-logos
```

- [ ] **Step 3: Baixar bucket perfis-fotos do local**

```bash
npx supabase storage cp --recursive "ss:///perfis-fotos" ./backup-storage/perfis-fotos
```

Esperado: arquivos baixados para `./backup-storage/perfis-fotos/`. Se o bucket estiver vazio, o comando termina sem output — isso é normal.

- [ ] **Step 4: Baixar bucket escola-logos do local**

```bash
npx supabase storage cp --recursive "ss:///escola-logos" ./backup-storage/escola-logos
```

- [ ] **Step 5: Verificar arquivos baixados**

```bash
find backup-storage -type f | head -30
```

Listar quantos arquivos foram baixados por bucket.

- [ ] **Step 6: Re-linkar CLI ao cloud**

```bash
npx supabase link --project-ref fljkjhmwnjehsodvqaqk
```

Usar a senha do DB cloud quando solicitado.

- [ ] **Step 7: Upload bucket perfis-fotos para cloud**

```bash
npx supabase storage cp --recursive ./backup-storage/perfis-fotos "ss:///perfis-fotos"
```

- [ ] **Step 8: Upload bucket escola-logos para cloud**

```bash
npx supabase storage cp --recursive ./backup-storage/escola-logos "ss:///escola-logos"
```

- [ ] **Step 9: Verificar storage no cloud via Dashboard**

Acessar: `https://supabase.com/dashboard/project/fljkjhmwnjehsodvqaqk/storage/buckets`

Confirmar que `perfis-fotos` e `escola-logos` existem e contêm arquivos.

---

## Task 5: Recriar usuário admin no cloud

**Files:**
- Sem alteração de código

- [ ] **Step 1: Acessar Supabase Dashboard**

Ir para: `https://supabase.com/dashboard/project/fljkjhmwnjehsodvqaqk/auth/users`

- [ ] **Step 2: Criar usuário admin**

Clicar em **"Add user" > "Create new user"**. Preencher:
- Email: mesmo email do admin local (verificar em `.env.local`: `APP_DEFAULT_ADMIN_EMAIL`)
- Password: senha segura (diferente da senha local `rrb123456`)
- Marcar **"Auto Confirm User"**

- [ ] **Step 3: Conceder role de admin**

Após criar o usuário, o app usa a tabela `perfis` para roles. Rodar no SQL Editor do Dashboard:

```sql
-- Verificar o UUID do usuário recém-criado
SELECT id, email FROM auth.users ORDER BY created_at DESC LIMIT 5;
```

Copiar o UUID. Depois:

```sql
-- Inserir perfil com role admin (ajustar UUID)
INSERT INTO public.perfis (user_id, nome, email, role)
VALUES (
  '[UUID_DO_USUARIO]',
  'Admin',
  '[EMAIL_DO_ADMIN]',
  'admin'
)
ON CONFLICT (user_id) DO UPDATE SET role = 'admin';
```

Se a tabela `perfis` tiver estrutura diferente, verificar com:

```sql
\d public.perfis
```

e ajustar o INSERT conforme as colunas existentes.

---

## Task 6: Atualizar .env.local para cloud

**Files:**
- Modify: `.env.local`

- [ ] **Step 1: Obter keys do cloud**

Acessar: `https://supabase.com/dashboard/project/fljkjhmwnjehsodvqaqk/settings/api`

Copiar:
- **Project URL** (ex: `https://fljkjhmwnjehsodvqaqk.supabase.co`)
- **anon public** key
- **service_role** key (secret)

- [ ] **Step 2: Atualizar .env.local**

Editar `.env.local`:

```env
# Supabase Cloud (ativo)
NEXT_PUBLIC_SUPABASE_URL=https://fljkjhmwnjehsodvqaqk.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key do Dashboard>
SUPABASE_SERVICE_ROLE_KEY=<service role key do Dashboard>

# Local Docker (desativado)
# NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:55421
# NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH
# SUPABASE_SERVICE_ROLE_KEY=sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz
```

Manter `APP_DEFAULT_ADMIN_EMAIL`, `RESEND_API_KEY`, `RESEND_FROM`, `NEXT_PUBLIC_APP_URL`, `GATE_API_TOKEN` inalterados.

---

## Task 7: Verificação final

**Files:**
- Sem alteração de código

- [ ] **Step 1: Reiniciar servidor Next.js**

```bash
# Parar o servidor se estiver rodando (Ctrl+C) e reiniciar
npm run dev
```

- [ ] **Step 2: Testar login**

Acessar `http://localhost:3001` (ou porta configurada). Fazer login com o admin criado no cloud. Deve redirecionar para dashboard sem erros.

- [ ] **Step 3: Verificar dados**

Navegar para:
- `/alunos` — verificar lista de alunos carregada
- `/financeiro` — verificar dados financeiros
- `/rh` — verificar funcionários

- [ ] **Step 4: Verificar imagens**

Navegar para qualquer perfil com foto. Imagem deve carregar via URL `https://fljkjhmwnjehsodvqaqk.supabase.co/storage/v1/object/public/perfis-fotos/...`.

Se não carregar, verificar policies no Dashboard: Storage > Policies — `perfis-fotos read` deve existir.

- [ ] **Step 5: Limpeza de arquivos temporários**

```bash
rm -f dados_local.sql restore_log.txt restore_log2.txt
rm -rf backup-storage/
rm -f .cloud-project-ref
```

---

## Rollback

Se precisar voltar ao local:

1. Editar `.env.local` para restaurar variáveis locais
2. Reiniciar `npm run dev`
3. Docker local continua intacto — nenhum dado foi apagado

---

## Arquivos temporários criados (não commitar)

- `dados_local.sql`
- `restore_log.txt`
- `restore_log2.txt`
- `backup-storage/`
- `.cloud-project-ref`

Adicionar ao `.gitignore` se necessário:

```gitignore
dados_local.sql
restore_log*.txt
backup-storage/
.cloud-project-ref
```
