# Regras de Conversão — Design System CRM Escola

> Invariantes que valem para **toda** a conversão de layout. Leia antes de editar qualquer arquivo.
> Plano de execução: `docs/design_system/PLANO-CONVERSAO.md`. Spec visual: `docs/design_system/DESIGN-SYSTEM.md`.
> Para ativar no Claude Code: referencie este arquivo no `CLAUDE.md` da raiz (ver §8).

---

## 1. Escopo

- A conversão é **somente visual**. Não alterar lógica, data fetching, Server Actions, Supabase, permissões ou rotas.
- Trabalhar pelas **3 camadas compartilhadas** (tokens → primitivos `ds-*`/`ui/*` → shell). Não reescrever páginas individuais para mudar aparência — elas herdam.
- Só editar uma página diretamente quando: tiver **hex cru**/**serifa** (Fase 5), ou for uma das **3 telas de referência** com meta pixel-perfeita (Fase 6).
- **Pixel-perfeito** vale só para Login (`(auth)/login`), Dashboard (`(app)/page`) e Alunos (`(app)/alunos`) — as únicas com protótipo. As demais ~95 páginas têm meta de **consistência com o DS**, não pixel (não há ground truth). Não inventar layout "pixel-perfeito" onde não há protótipo.
- Pixel-perfeito é verificado por **screenshot-diff** (puppeteer) contra o protótipo, em claro e escuro; meta < 2% de pixels divergentes ignorando conteúdo dinâmico. "Pronto" sem diff rodado não é pixel-perfeito.

## 2. Cor — sempre via token

- **Proibido** hex cru, `rgb()`/`rgba()` literais ou cores nomeadas em JSX/CSS de componente. Use sempre `var(--token)` ou as classes Tailwind tokenizadas (`text-ink`, `bg-surface`, `border-line`, `text-muted`, `bg-brand`…).
- A paleta é fechada: marca azul royal + 7 hues (`--c-blue/coral/amber/green/violet/teal/pink`) + status (`--ok/warn/bad`). **Nunca inventar cor fora da paleta.**
- **Única exceção:** paleta pastel de avatar (`#FFD3D3 #D6E4FF #FFE6C7 #E8D9FF #D4F0DF #FFD8B0`) com texto `#20283e`. Documentar onde usar.
- KPIs/tags/gráficos coloridos derivam de `--hue`; tints adaptam via `color-mix(in oklab, var(--hue) var(--tint-strength), var(--surface))`.

## 3. Tipografia — sem serifa

- Títulos e valores: **Bricolage Grotesque** (`--font-display`), 600–700, **nunca itálico, nunca serifado**.
- Interface/corpo: **Geist** (`--font-body`). Dados/IDs/eyebrows/atalhos: **Geist Mono** (`--font-mono`).
- **Proibido** `font-serif`, `Instrument_Serif` ou qualquer `font-style: italic` decorativo. A família `serif` não existe mais no Tailwind.
- Todo dado numérico em colunas usa `font-variant-numeric: tabular-nums` (`.rb-num`/`.rb-mono`).

## 4. Tema claro/escuro

- Controlado por `data-theme` no `<html>`; persistido em `localStorage['theme']` — **manter esta chave** (não usar `rrb-theme`).
- **Paridade obrigatória:** todo token semântico existe em `[data-theme="light"]` e `[data-theme="dark"]`. Hues e status ficam mais claros/saturados no escuro.
- `color-scheme` definido por tema (controles nativos acompanham).

## 5. Componentes — invariantes a preservar

- Botões: variantes `primary` (gradiente azul + `--shadow-brand`, sobe 1px no hover), `ghost`, `soft`, `danger`; tamanhos base/`.sm`/`.lg`.
- 5 pills de status (`ok/warn/bad/info/neutral`), com `.dot` opcional.
- KPI dirigido por `--hue` (tinta + glow radial + ícone em chip + valor Bricolage tabular).
- **Anel de foco padrão** em todo controle: `box-shadow: 0 0 0 4px color-mix(in oklab, var(--brand-500) 18%, transparent)`. Erro usa `--bad`. Nunca remover foco sem substituir.
- Ações por linha de tabela: ícone 30×30, opacidade ~.55 → 1 no hover, cor do tom (verde=mensagem, azul=editar, neutro=mais).
- Reaproveitar nomes existentes: manter `ds-*` e `src/components/ui/*` — trocar só o visual interno, não a API/props.

## 6. Raio, sombra, movimento

- Raios: `--r-xs:5 / sm:8 / md:11 / lg:16 / xl:22 / pill:999`. Cards usam `--r-lg`; inputs/botões `--r-sm`.
- Sombras: `--shadow-xs/sm/md/lg` + `--shadow-brand` (glow azul, só em primário e estados ativos).
- Easing: `--ease` (UI), `--ease-out` (entradas), `--spring` (knobs/modais). Respeitar `prefers-reduced-motion` (token base já zera durações).

## 7. Processo

- Branch dedicada; commit por fase com mensagem `feat(ds): <fase>`.
- **Trava de qualidade:** `npm run typecheck && npm run build` verdes antes de fechar qualquer fase. `npm run test` antes do PR.
- Mudou um primitivo? Validar em **claro e escuro** em ao menos 2 páginas que o consomem.
- Não adicionar dependências de UI novas.

## 8. Ativação no Claude Code (raiz do repo)

Não existe `CLAUDE.md` na raiz. Crie um (ou adicione a um existente) com:

```md
# CRM Escola

## Conversão de Design System (em andamento)
Ao trabalhar em layout/estilo, siga obrigatoriamente:
- docs/design_system/REGRAS-CLAUDE-CODE.md  (invariantes)
- docs/design_system/PLANO-CONVERSAO.md     (fases e ordem)
- docs/design_system/DESIGN-SYSTEM.md        (spec visual — fonte de verdade)
```

## 9. Definition of Done

- [ ] Tokens repontados; paridade claro/escuro completa.
- [ ] `ds-*` e `ui/*` refletem o contrato do DS.
- [ ] Topbar/shell convertidos (decisão de identidade da barra confirmada).
- [ ] `grep` de hex cru em `src` = só exceções de avatar; serifa = 0.
- [ ] Charts (recharts) usando tokens de hue.
- [ ] **Login, Dashboard e Alunos com screenshot-diff < 2%** (claro+escuro, 1440px) e estados interativos conferidos; diffs arquivados em `docs/design_system/_diff/`.
- [ ] `typecheck` + `build` + `test` verdes; QA visual em claro e escuro.
