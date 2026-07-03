# Design

> **A fonte de verdade do sistema visual é `docs/design_system/`, não este arquivo.**
> Este DESIGN.md é um ponteiro curto para o impeccable e outros agentes. Todos os valores literais (tokens, componentes, escala de tipo) vivem nos arquivos abaixo. Ao editar layout/estilo/tema, ler `docs/design_system/` antes de tocar em código (ver CLAUDE.md).

## Fonte de verdade

| Arquivo | Conteúdo |
|---|---|
| `docs/design_system/DESIGN-SYSTEM.md` | Spec visual completa: princípios, tema, tipografia, tokens, componentes, layout, gráficos, animação, a11y. |
| `docs/design_system/src/rrb-tokens.css` | Tokens canônicos + utilitários de tipo + classes de componente (`rb-*`). |
| `docs/design_system/src/*.jsx` | Telas de referência pixel-perfeito (login, dashboard, alunos, shell). |
| `docs/design_system/PLANO-CONVERSAO.md` | Roteiro faseado da conversão em andamento. |
| `docs/design_system/REGRAS-CLAUDE-CODE.md` | Invariantes — ler sempre antes de editar. |
| `src/components/ui/*` | Implementação React dos componentes (button, card, data-table, status-pill, etc). |

## Resumo do sistema (não normativo — valores literais estão nos arquivos acima)

- **Estética:** produto moderno, colorido com disciplina, denso-legível. Sem serifa. Sem slop.
- **Tema:** claro (padrão) + escuro paritários, via `data-theme` no `<html>`.
  - ⚠️ **Chave de persistência real no código = `localStorage['theme']`** (`src/app/layout.tsx`), **não** `rrb-theme` como diz a spec. Código vence. Não mudar a chave.
- **Marca:** azul royal `--brand-600` (#2348C9 claro / #4E72F0 escuro). Logo wordmark EPG.
- **Matizes temáticos:** 7 canais fixos (`--c-blue/coral/amber/green/violet/teal/pink`) para KPI, tags e gráficos.
- **Tipografia:** Bricolage Grotesque (display/títulos/KPI), Geist (corpo/UI), Geist Mono (IDs, valores, eyebrows). Numerais tabulares em todo dado.
- **Componentes:** classes `rb-*` (botão, card, input, pill de status, tag, KPI, tabela densa, modal, drawer). Preservar API; trocar só visual interno.
- **Raio:** 5/8/11/16/22px + pill. **Sombras:** 5 níveis/tema + `--shadow-brand` (glow azul).
- **Movimento:** `--ease` (UI), `--ease-out` (reveal), `--spring` (knobs/modais). Durações 140–160ms hover, 200–300ms painel, 600ms reveal. `prefers-reduced-motion` respeitado.
- **A11y:** WCAG AA. Anel de foco `0 0 0 4px`. Texto sobre tint via `--on-tint`. Avatar sempre `#20283e` sobre pastel.

## Escopo de pixel-perfeito

Login, Dashboard e Alunos têm protótipo e são verificados por screenshot-diff < 2% (claro + escuro). Demais páginas: meta de **consistência** com o design system, não pixel-perfeito.
