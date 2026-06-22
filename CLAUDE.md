# RRB Escola

Sistema de gestão escolar (CRM). Next.js 14 (App Router) + Tailwind + Supabase. PT-BR.

## Conversão de Design System (em andamento)

Ao trabalhar em **layout, estilo, tema, cores, tipografia ou componentes visuais**, é OBRIGATÓRIO seguir, nesta ordem:

1. `docs/design_system/REGRAS-CLAUDE-CODE.md` — invariantes (ler sempre, antes de editar).
2. `docs/design_system/PLANO-CONVERSAO.md` — roteiro faseado, ordem de execução e critérios de aceite.
3. `docs/design_system/DESIGN-SYSTEM.md` — spec visual (fonte de verdade dos valores).
4. `docs/design_system/src/rrb-tokens.css` e `docs/design_system/src/*.jsx` — referência literal de tokens e das telas pixel-perfeito.

### Regras inegociáveis
- Conversão é **somente visual**: não alterar lógica, data fetching, Server Actions, Supabase, permissões ou rotas.
- Cor **só via token** (`var(--token)` ou classes Tailwind tokenizadas). Proibido hex/rgb cru fora dos tokens (exceção: paleta pastel de avatar).
- **Sem serifa.** Títulos em Bricolage Grotesque (sans). Família `serif` não existe mais.
- Tema por `data-theme` no `<html>`, persistido em `localStorage['theme']` (não mudar a chave). Paridade total claro/escuro.
- Reaproveitar nomes existentes (`ds-*`, `src/components/ui/*`): trocar só o visual interno, não a API.
- **Pixel-perfeito** vale apenas para Login, Dashboard e Alunos (têm protótipo), verificado por screenshot-diff < 2% em claro e escuro. As demais páginas: meta de consistência com o DS.

### Trava de qualidade
`npm run typecheck && npm run build` verdes antes de fechar cada fase. `npm run test` antes do PR. Branch dedicada, commit por fase (`feat(ds): <fase>`).
