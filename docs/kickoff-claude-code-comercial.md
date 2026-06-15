# Kickoff — Claude Code: Módulo Comercial + Livro-Razão

> Cole o conteúdo abaixo (a partir de "PROMPT") no Claude Code, na raiz do projeto `rrb-escola`.
> Spec de referência: `docs/spec-modulo-comercial-estoque.md` — leia-a inteira antes de codar.

---

## PROMPT

Você vai implementar o módulo Comercial (produtos, estoque, vendas) e a unificação financeira do projeto `rrb-escola`. A especificação completa e canônica está em `docs/spec-modulo-comercial-estoque.md` — **leia o arquivo inteiro antes de escrever qualquer linha** e trate-o como fonte da verdade. Todas as 5 decisões já estão travadas na seção 11; não as reabra.

### Regras de execução (inegociáveis)

1. **Entregue uma fase por vez** (Fase 0 → 1 → 2 → 3, definidas na seção 9 da spec). Ao fim de cada fase, **pare e me peça revisão** antes de começar a próxima. Não emende fases.
2. **Não invente stack.** O projeto é Next.js 14 (App Router) + Supabase (Postgres) + TypeScript + Zod + Tailwind + Recharts. **Não há Prisma.** Migrations são SQL em `supabase/migrations/AAAAMMDDNNNN_nome.sql`.
3. **Copie os padrões existentes** em vez de inventar os seus:
   - Enums, trigger de `atualizado_em`, RLS e storage: espelhe `supabase/migrations/202605270001_despesas.sql`.
   - RLS sempre via `current_perfil()`, com scoping por `escola_id`.
   - Camadas: validação em `src/lib/validation/`, leitura em `src/lib/data/`, mutations (server actions) em `src/lib/actions/`, lógica pura testável em `src/lib/<modulo>/`, UI em `src/components/<modulo>/` e `src/app/(app)/<modulo>/`.
   - Gating de menu por perfil: siga `src/components/layout/topbar.tsx` e `src/lib/auth/permissions.ts`.
4. **Migrations idempotentes e reversíveis no raciocínio.** Devem rodar limpas tanto em base zerada quanto em base com dados reais de `despesas`/`categorias_despesa`. A Fase 0 migra esses dados — não perca registros, não quebre FKs existentes.
5. **Atomicidade no banco, não no client.** `confirmar_venda` e `gerar_lancamentos_contratos` são RPCs Postgres (`security definer` onde a spec pede). Nada de orquestrar transação em múltiplas chamadas do front.
6. **Saldo de estoque nunca é coluna mutável** — só nasce de `movimento_estoque` (`Σ quantidade × sentido`). Trigger força `sentido` de entrada/saída.
7. **TDD onde há cálculo.** Antes de implementar saldo de estoque e `confirmar_venda`, escreva os testes Vitest (entrada, saída, ajuste +/−, cancelamento/estorno, venda a descoberto bloqueada). Rode `npm run test`.
8. **Verificação antes de declarar pronto:** ao fim de cada fase, rode e cole a saída de `npm run typecheck`, `npm run lint` e `npm run test`. Sem evidência, não afirme que passou.

### Comece pela Fase 0

Escopo da Fase 0 (e só ela agora):
- Criar `tipo_lancamento`, `categorias_financeiras` (com hierarquia `parent_id` e `tipo`).
- Criar `status_lancamento`, `forma_pagamento`, `origem_lancamento`, e `lancamento_financeiro` (seção 5.2 da spec).
- (Opcional na 0, mas previsto) `contas_financeiras` — se não criar agora, deixe `conta_id` nullable e documente.
- **Migrar** dados: `categorias_despesa` → `categorias_financeiras` (`tipo='despesa'`); `despesas` → `lancamento_financeiro` (`tipo='despesa'`, `origem_tipo='despesa'`, mapeando `data_vencimento`/`data_pagamento`/`status`/`forma_pagamento`/`comprovante_path`/`competencia`/`categoria_id`).
- Reapontar a UI atual de despesas para ler/gravar do livro-razão **sem regressão visual** (a tela de Junho/2026 que existe hoje deve continuar idêntica para o usuário). Adicionar suporte a `tipo='receita'` no mesmo CRUD.
- RLS do razão: `admin`/`financeiro` apenas.
- **RBAC (não esquecer — RLS sozinho não faz a tela aparecer no menu):** ao introduzir a rota do livro-razão, atualize os TRÊS pontos descritos na seção 4 da spec: `MODULOS` + `ROTA_PARA_MODULO` em `src/lib/auth/permissions.ts`, e seed de `modulos`/`role_permissoes` numa migration (módulo `financeiro.lancamentos`, só `admin`/`financeiro`). Use o cast explícito de enum (`::text::forma_pagamento`) na migração de dados. O grupo `'comercial'` em `GRUPOS`/`GRUPO_LABEL` pode entrar já na Fase 0 ou na Fase 1, mas os módulos `comercial.*` só são semeados quando suas telas existirem.

Antes de codar a Fase 0, **me devolva um plano curto**: lista de migrations (nomes/numeração), arquivos que vai criar/alterar, e a estratégia de migração de dados com o que acontece se rodar duas vezes. Espere meu "ok" e então implemente.

### Definição de pronto da Fase 0
- Migrations rodam em base zerada e em base com despesas reais, sem perda.
- Tela de despesas funciona como antes; agora aceita lançar receita.
- Razão restrito por RLS a `admin`/`financeiro`.
- RBAC atualizado nos 3 pontos: logado como `financeiro`, o Livro-Razão aparece no menu e passa no route gating; o seed é idempotente.
- Migração de `forma_pagamento` com cast `::text::forma_pagamento` — sem erro de enum.
- `npm run typecheck && npm run lint && npm run test` verdes (saída colada).
