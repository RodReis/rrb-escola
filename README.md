# CRM Escola

Sistema Next.js 14 + Supabase para gestão escolar: alunos, matrículas, financeiro, RH/folha de pagamento, despesas operacionais, portaria e relatórios.

## Stack

- **Frontend**: Next.js 14 (App Router) + TypeScript + Tailwind
- **Backend**: Next.js Server Actions + Supabase (Postgres + Storage + Auth)
- **Auth**: Supabase Auth via `@supabase/ssr` (cookies HTTP-only)
- **DB local**: Supabase CLI + Docker

## Requisitos

- Node.js 20+
- Docker Desktop (rodando)
- Git
- Python 3.10+ (apenas para scripts de import de PDFs e xlsx)

## Setup rápido

```bash
# 1. Clone + dependências
git clone <repo>
cd rrb-escola
npm install
cp .env.example .env.local

# 2. Sobe stack Supabase local (Docker)
npx supabase start

# 3. Aplica migrations + restaura snapshot completo de dados reais
npx supabase db reset --local

# 4. Garante o admin de teste local
npm run seed:auth

# 5. Sobe Next dev
npm run dev
```

Abra `http://localhost:3000` e logue com:

- **Email**: `admin@rrb.local`
- **Senha**: `admin123`

Para trabalhar com os dados atuais de produção em vez do snapshot, use
`bash scripts/sync_local_from_prod.sh` (ver [docs/db-seed-workflow.md](docs/db-seed-workflow.md)).

**Login falhou com "Sem perfil ativo"?** Rode `npm run seed:auth`. O usuário existe
no `auth`, mas sem linha em `perfis` — acontece sempre que o banco local é
reconstruído a partir de produção, onde `admin@rrb.local` não tem perfil.

Supabase Studio (admin DB): `http://127.0.0.1:55423`

## O que `db reset` faz

Roda todas migrations em `supabase/migrations/` em ordem. A última migration (`202605270002_seed_real_data.sql`) é um snapshot completo do banco com **~23 mil INSERTs** (alunos, matrículas, cobranças, payroll etc). Sai com banco populado pronto pra usar.

**Login pós-reset**: o navegador pode ter cookie de sessão stale apontando para auth user antigo. Se aparecer `Invalid Refresh Token`: limpe cookies do site (DevTools → Application → Cookies → delete `sb-*`) ou faça logout/login.

## Atualizando o snapshot

Quando você adicionar dados novos via app e quiser que sobrevivam ao próximo `db reset`:

```bash
bash scripts/regenerate_seed_migration.sh
git add supabase/migrations/202605270002_seed_real_data.sql
git commit -m "chore(seed): atualizar snapshot"
```

O script também salva backup `.dump` binário em `backups/` (gitignored).

## Restaurar de backup binário

Se a migration de seed quebrar:

```bash
# Lista backups
ls backups/

# Restaura
docker exec -i supabase_db_rrb-escola pg_restore \
  -U postgres -d postgres --clean --if-exists --no-owner --no-acl \
  < backups/<arquivo>.dump
```

## Módulos

| Módulo | Path | Descrição |
|--------|------|-----------|
| Dashboard | `/` | KPIs + gráfico financeiro |
| Alunos | `/alunos` | Cadastro, ficha visual, edição, importação PDF |
| Matrículas | `/matriculas` | Vincula aluno + série + turma + plano por ano letivo |
| Séries/Turmas | `/series`, `/turmas` | Estrutura escolar (INFANTIL, FUND1, FUND2, MÉDIO) |
| Financeiro | `/financeiro` | Cobranças e pagamentos por competência |
| Despesas | `/despesas` | CRUD de despesas operacionais por mês + categorias + comprovantes |
| RH | `/rh/empresas`, `/rh/funcionarios` | Empresas, funcionários, base salarial, GPS |
| Folha | `/rh/folha/[mes]` | Geração + edição da folha de pagamento mensal (v1, legado) |
| Folha v2 | `/rh/folha-v2` | Motor de rubricas: runs mensais por empresa, contracheque editável, conciliação com despesas, provisões, holerite PDF, pacote do contador (xlsx). Cron diário `/api/jobs/dispatch` gera a folha no dia de fechamento |
| Portaria | `/portaria` | Reconhecimento facial, eventos de acesso |
| Frequência | `/frequencias` | Registro de presença |
| Importações | `/importacoes` | Upload e processamento de PDFs/xlsx |

## Estrutura

```
src/
  app/(app)/...    # Rotas autenticadas
  app/(auth)/...   # Login
  app/api/...      # APIs server (portaria etc)
  lib/
    actions/       # Server actions por domínio
    data/          # Data fetchers (Supabase queries)
    auth/          # requireSession, requirePerfil
    supabase/      # Server/browser clients
    validation/    # Zod schemas
    finance/, despesas/, payroll/  # Domain logic
  components/      # UI por domínio + ui/ shared
supabase/
  migrations/      # SQL schema + seed snapshot
  seed.sql         # noop (seed real está em migration)
scripts/
  regenerate_seed_migration.sh    # Regerar snapshot
  import_pdf_alunos.py            # PDF → alunos
  import_matriculados_2026.py     # Xlsx → matrículas + cobranças
  export_payroll_template.mjs     # Folha base template
docs/
  superpowers/specs/   # Specs de features
  superpowers/plans/   # Planos de implementação
backups/           # Dumps .dump (gitignored)
public/            # Estáticos + xlsx de import
```

## Variáveis de ambiente

| Variável | Origem | Uso |
|----------|--------|-----|
| `NEXT_PUBLIC_SUPABASE_URL` | público | client + server |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | público | client + server |
| `SUPABASE_SERVICE_ROLE_KEY` | secreto | server only (admin tasks, batch) |
| `GATE_API_TOKEN` | secreto | auth API `/api/portaria/*` |

Pegue `ANON_KEY` e `SERVICE_ROLE_KEY` rodando `npx supabase status`.

## Comandos úteis

```bash
npm run dev           # Dev server (Next + HMR)
npm run typecheck     # tsc --noEmit
npm run lint          # next lint
npm run build         # Build produção

npx supabase start    # Sobe stack Docker
npx supabase stop     # Para stack
npx supabase status   # URLs + keys locais
npx supabase db reset --local   # Reaplica todas migrations (restaura snapshot)

bash scripts/regenerate_seed_migration.sh  # Snapshot atual → migration
```

## Domínio + RLS

- Multi-tenant por `escola_id`. `DEFAULT_SCHOOL_ID = '00000000-0000-0000-0000-000000000001'`.
- Helper `current_perfil()` em SQL retorna o perfil + escola_id do usuário logado.
- Todas tabelas com dados sensíveis têm RLS gated por `perfil` (admin/financeiro/secretaria/professor) + `escola_id`.
- Server actions usam `requireSession()` ou `requirePerfil([roles])` antes de qualquer write.

## Convenções

- **Componentes UI**: usar `@/components/ui/{button,card,page-header,status-pill,currency-input}`. NÃO inventar classes `ds-*` próprias.
- **Forms**: `<input>` plain dentro de `<label>`. Submit via `Button` component.
- **Money**: `money.format()` de `@/lib/constants`.
- **Datas**: ISO `YYYY-MM-DD` em strings, formatação BR via `toLocaleDateString("pt-BR")`.
- **Competência**: formato `YYYY-MM` (text), validado por regex.
- **Comentários**: zero por default. Só se "porquê" não é óbvio do código.

## Troubleshooting

| Sintoma | Causa | Fix |
|---------|-------|-----|
| `Invalid Refresh Token` após reset | Cookie aponta pra UUID antigo | Limpa cookies `sb-*` ou logout/login |
| `Could not find table 'public.X'` | Migration nova não aplicada ou schema cache stale | `npx supabase db reset --local` |
| Migration nova quebra com FK | Ordem de migrations / seed antes de tabela existir | Conferir ordem dos arquivos em `supabase/migrations/` |
| `gen_salt does not exist` no seed.sql | Falta extension pgcrypto | Não usado — seed.sql é noop, migration faz tudo |
| Erros pré-existentes em `alunos/[id]/editar` typecheck | Componente removido em refator anterior | Sem fix ainda |
| `Sem perfil ativo. Solicite acesso ao administrador.` no login | Auth user existe mas não tem linha em `perfis` (ou `perfis.ativo = false`) vinculada pro `escola_id` | Rodar `npx supabase db reset --local` para restaurar o snapshot com o perfil do `admin@rrb.local`, ou verificar a tabela `perfis` no Supabase Studio |

## Documentação adicional

- `docs/superpowers/specs/` — specs aprovadas de features
- `docs/superpowers/plans/` — planos de implementação detalhados
- `docs/design-system-lectiva.md` — design system
- `docs/importacao-alunos.md` — pipeline de import
- `docs/portaria-integracao.md` — integração portaria
