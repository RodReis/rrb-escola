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
