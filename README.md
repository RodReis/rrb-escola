# RRB Escola

Aplicativo Next.js 14 para gestao escolar, ficha do aluno e financeiro usando Supabase local.

## Requisitos

- Node.js 20+
- Docker Desktop
- Supabase CLI

## Configuracao

```bash
cp .env.example .env.local
npm install
npx supabase start
npm run seed:auth
npm run dev
```

Credenciais locais:

- Email: `admin@rrbescola.local`
- Senha: `rrb123456`

O app usa Supabase local em `http://127.0.0.1:55421` para evitar conflito com outros projetos locais. O Studio fica em `http://127.0.0.1:55423`.

Todos os cadastros, relatorios, pagamentos e frequencias sao lidos e gravados no banco local. A interface nao usa `localStorage` nem armazenamento de dados do app no cliente.

## Modulos

- Dashboard financeiro com grafico
- Alunos com ficha visual e exportacao PDF
- Edicao da ficha do aluno
- Series, turmas, matriculas e planos
- Cobrancas, pagamentos e exportacao PDF financeira
- Frequencia
- Importacoes de PDF de alunos para o Supabase Storage

## Autenticacao

App usa Supabase Auth com cookies HTTP-only via `@supabase/ssr`. Toda rota `(app)/*` exige usuario com perfil ativo.

### Variaveis de ambiente

| Variavel | Origem | Uso |
|----------|--------|-----|
| `NEXT_PUBLIC_SUPABASE_URL` | publico | client + server |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | publico | client + server |
| `SUPABASE_SERVICE_ROLE_KEY` | secreto | server only (criacao de user, batch jobs, API portaria) |
| `APP_DEFAULT_ADMIN_EMAIL` | secreto | seed admin |
| `APP_DEFAULT_ADMIN_PASSWORD` | secreto | seed admin |
| `GATE_API_TOKEN` | secreto | autenticacao da API `/api/portaria/*` |

### Fluxo

1. `npm run seed:auth` cria admin default e linha em `perfis`.
2. Login em `/login` cria cookies de sessao.
3. `src/middleware.ts` refresca cookies em toda request e redireciona para `/login` se sem sessao.
4. `(app)/layout.tsx` valida perfil ativo.
5. Server actions e data fetchers usam `createServerClient()` (SSR + RLS).
6. Service role permitido apenas em criacao de user, seed admin, processamento batch e API portaria.

### Criar novo usuario

Logado como admin: acessar `/usuarios/novo`. Senha gerada e exibida uma vez.
