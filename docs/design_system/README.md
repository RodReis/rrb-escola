# Handoff: CRM Escola — Sistema de Gestão Escolar (CRM)

## Overview
CRM Escola é um sistema (CRM) de gestão escolar. Este pacote contém o **design system completo** e três telas de referência: **Design System (showcase)**, **Sistema (Dashboard + Alunos)** e **Login**. Estética moderna e colorida, com **tema claro e escuro**. Marca: **CRM Escola**, logo **EPG**.

## About the Design Files
Os arquivos `.html`/`.jsx`/`.css` deste pacote são **referências de design criadas em HTML** — protótipos que mostram aparência e comportamento pretendidos, **não código de produção para copiar diretamente**. A tarefa é **recriar estes designs no ambiente do codebase de destino** (React, Vue, Next, etc.) usando seus padrões e bibliotecas estabelecidos. Se ainda não houver ambiente, escolha o framework mais adequado e implemente lá. Os protótipos usam React 18 + Babel standalone (transpilação no browser) apenas para prototipagem — **não reproduza esse setup em produção**.

> Os tokens de cor/tipografia/componentes em CSS variables (`src/rrb-tokens.css`) **são** prontos para produção e devem ser portados como camada de tema. O switch de tema é só o atributo `data-theme` no `<html>`.

## Fidelity
**Alta fidelidade (hi-fi).** Cores, tipografia, espaçamento, raios, sombras e interações são finais. Recriar pixel-a-pixel usando as bibliotecas/padrões do codebase de destino. Valores exatos em **`DESIGN-SYSTEM.md`** (incluído neste pacote — é a fonte de verdade).

---

## Design Tokens
Todos os tokens (claro **e** escuro), com valores literais, estão em **`DESIGN-SYSTEM.md`** (seções 5–7) e em `src/rrb-tokens.css`. Resumo essencial:

- **Marca:** `--brand-600: #2348C9` (azul royal; no escuro `#4E72F0`), `--brand-700: #1B36A6`, `--brand-500: #3A5FE0`. Accent vermelho `--red-600: #D8242E`.
- **Matizes temáticos** (KPIs/tags/gráficos): blue `#2E5BE6`, coral `#ED4451`, amber `#E0A12B`, green `#18A05E`, violet `#8048EC`, teal `#12A39A`, pink `#E84393` (todos mais claros no escuro — ver spec §5.3).
- **Status:** ok `#16915A`, warn `#C9821A`, bad `#DA2E39`.
- **Tipografia:** títulos/valores **Bricolage Grotesque** (700), interface **Geist**, dados **Geist Mono**. Sem serifa.
- **Raios:** 5 / 8 / 11 / 16 / 22 / 999px. **Sombras:** xs→lg + `--shadow-brand` (glow azul). **Easing:** `--ease`, `--ease-out`, `--spring`.
- **Tema:** `data-theme="light|dark"` no `<html>`; persistir em `localStorage['rrb-theme']`; aplicar antes do paint. Tints adaptam via `color-mix(in oklab, …, var(--surface))` com `--tint-strength` (9% claro / 16% escuro).

---

## Screens / Views

### 1. Login (`CRM Escola - Login.html` → `src/login.jsx`)
- **Purpose:** autenticação do operador da escola.
- **Layout:** split em duas colunas. **Esquerda** (`flex:1.14`, padding 60×56) = painel de marca com fundo decorativo animado; **direita** (`flex:1`, `var(--surface)`) = card de formulário centrado (`max-width:396px`).
- **Duas direções (variants):**
  - **A · Aurora (tema claro):** fundo `linear-gradient(160deg, var(--bg-grad-a), var(--bg-grad-b))` + 3 “blobs” borrados (blue/violet/teal, `blur(72px)`, `opacity:.5`, animação `lgdrift` 16s). Chips de features (Matrículas/Cobranças/Claro-escuro).
  - **B · Spotlight (tema escuro):** fundo `radial-gradient(120% 90% at 20% 0%, #16213f, var(--bg) 70%)` + textura de pontos (`.dots`, mask radial) + 2 orbs (brand-glow/violet). Features em linha.
- **Componentes:** selo de marca EPG 52px; eyebrow (mono uppercase); título “CRM Escola” (Bricolage 56px); subtítulo; campos `.rb-input` (email com ícone, senha com toggle mostrar/ocultar), checkbox “Manter conectado”, link “Esqueci a senha”, botão primário full-width “Entrar”; toggle de tema (sol/lua) no canto superior direito.
- **Interações:** foco com anel azul (`box-shadow 0 0 0 4px color-mix(... 18%)`); botão de olho alterna `type` do password; entradas com stagger (`.reveal`, delays via `--d`).

### 2. Sistema — Dashboard (`CRM Escola - Sistema.html` → `src/sistema-dashboard.jsx` + `src/sistema-shell.jsx`)
- **Purpose:** visão geral operacional.
- **Topbar (62px, `var(--surface)`, borda inferior):** selo EPG + “CRM Escola / Gestão Escolar” · nav em pílulas (Dashboard, Alunos, Matrículas, Financeiro, Secretaria, Relatórios) · busca (`.rb-input.has-icon` 230px + `⌘K`) · chip de ano letivo · toggle de tema · sino (com dot) · botão de usuário (nome/cargo + avatar gradiente). Ativo: `color:var(--brand-600); background:color-mix(in oklab, var(--brand-600) 12%, var(--surface))`.
- **Cabeçalho:** eyebrow “Visão geral · 2026.1”, título “Olá, Renata 👋” (Bricolage 28), data; ações “Relatório” (ghost) + “Nova matrícula” (primary).
- **Abas segmentadas:** Financeiro · Comercial · Secretaria · Pedagógico (cada uma troca KPIs/gráficos/lista — dados em `DASH` no arquivo).
- **Grid:** KPIs `repeat(4,1fr)` (cards coloridos por `--hue`, glow radial, ícone em chip, delta em pill); gráficos `1.5fr 1fr` (área de receita + donut); barras `1fr 1.2fr` (barras por categoria + lista “Inadimplência recente”).
- **Gráficos:** SVG inline — área com gradiente, donut com `stroke-dasharray`, barras com altura `%` (container precisa de altura fixa — ver §10 da spec). Sem libs.

### 3. Sistema — Alunos (`src/sistema-alunos.jsx`)
- **Purpose:** lista/CRM de alunos (grid + ações).
- **Cabeçalho:** breadcrumb mono (Gestão / Secretaria / **Alunos**); título **“Alunos”** (Bricolage 27, **sans — sem serifa**) + chip “1.284 ativos”; ações Exportar/Importar/Novo aluno; 3 stats (Novos no mês / Aniversariantes / Retenção).
- **Barra de filtros:** segmented de níveis (Todos/Infantil/Fund. I/Fund. II/Médio com contador; ativo azul cheio) + busca + chips Turma/Plano/Status + botão “mais filtros”.
- **Bulk bar:** ao selecionar ≥1 linha aparece barra azul translúcida com “N selecionado(s)” + Mensagem/Gerar boleto/Exportar/Excluir + “Limpar seleção” (entra com `rbSlideDown`).
- **Tabela (CSS grid `34px 2.3fr 1fr 1.1fr 1.4fr 1.2fr 116px`):** checkbox · Aluno (avatar+nome+ID) · Turma · Plano · Responsável · Status financeiro (pill) · **Ações por linha** (mensagem=verde, editar=azul, mais=neutro; 30×30, opacidade .55→1 no hover). Linha: altura 56, hover `--surface-2`, selecionada tint azul + barra esquerda 3px. Footer com “Mostrando 1–N de 1.284” + paginação.

### 4. Design System (`CRM Escola - Design System.html`)
Showcase navegável de cores, tipografia e **todos os componentes** (botões, inputs, switch, pills, tags, segmented/underline tabs, breadcrumb, KPIs, gráficos, tabela, navegação, modal, drawer, avatares, lista). Use como catálogo visual.

---

## Interactions & Behavior
- **Tema claro/escuro:** atributo `data-theme` no `<html>`; persistir em `localStorage['rrb-theme']`; script pre-paint para evitar flash. No protótipo Login, cada variação carrega seu próprio tema num wrapper `data-theme` aninhado.
- **Foco:** anel `0 0 0 4px color-mix(in oklab, var(--brand-500) 18%, transparent)` em todos os controles. Erro: borda + anel em `--bad`.
- **Hover:** primário sobe 1px + sombra; ghost muda superfície/borda; linhas de tabela mudam fundo; ações por linha aumentam opacidade e ganham cor do tom.
- **Animações:** `rbGrow` (barras), `rbSlideDown` (bulk bar), `lgdrift`/`drift` (blobs, infinito sutil), `.reveal` stagger (`--d`). Respeitar `prefers-reduced-motion` (já zera durações no token base).
- **Seleção:** Set de IDs; “selecionar todos” no header; clique na linha alterna seleção.
- **Abas:** estado local controla KPIs/gráficos/lista do Dashboard e filtro de nível em Alunos.

## State Management
- `theme` (light/dark) — global, persistido.
- Dashboard: `tab` ∈ {financeiro, comercial, secretaria, pedagogico}.
- Alunos: `level` (filtro), `q` (busca), `sel` (Set de IDs selecionados), `hoverRow`.
- Roteamento simples no protótipo (`route` em `sistema-app.jsx`): dashboard | alunos | placeholders. No codebase real, usar o roteador do framework.
- Dados são mock (arrays nos arquivos) — substituir por fetch real (ex.: lista de alunos, KPIs financeiros, inadimplência).

## Assets
- **Logo EPG:** `assets/epg-white.png` (branco, para selo azul/fundos escuros) e `assets/epg-navy.png` (`#1B368C`, para fundos claros). PNG transparente, recorte ~3.26:1. Cópia também em `uploads/`. Selo de marca = quadrado arredondado com gradiente `linear-gradient(150deg, var(--brand-500), var(--brand-700))` + EPG branco a 70% de largura.
- **Ícones:** set stroke 24×24 `currentColor` em `src/icons.jsx` (objeto `I`). Pode ser trocado por lucide/heroicons equivalentes no codebase.
- **Fontes:** Google Fonts — Bricolage Grotesque, Geist, Geist Mono (import no `<head>`; ver spec §4).
- **Avatares:** iniciais sobre pastel fixo (`#FFD3D3 #D6E4FF #FFE6C7 #E8D9FF #D4F0DF #FFD8B0`), texto `#20283e`.

## Files
- **`DESIGN-SYSTEM.md`** — especificação completa (tokens claro+escuro, tipografia, 20 componentes com CSS+markup, layouts, gráficos, animações, acessibilidade). **Comece por aqui.**
- `src/rrb-tokens.css` — tokens + utilitários + classes `rb-*` (prontos para portar).
- `src/icons.jsx` — set de ícones `I`.
- `src/sistema-shell.jsx` — topbar/nav/shell.
- `src/sistema-dashboard.jsx` — KPIs, gráficos, abas, dados `DASH`.
- `src/sistema-alunos.jsx` — grid, filtros, ações por linha, bulk bar.
- `src/sistema-app.jsx` — roteamento + tema + tweaks (referência).
- `src/login.jsx` — telas de login (Aurora/Spotlight).
- `src/tweaks-panel.jsx`, `src/design-canvas.jsx` — utilitários de prototipagem (NÃO portar; específicos do ambiente de protótipo).
- `CRM Escola - *.html` — telas montáveis (abrir via servidor estático para ver render; usam caminhos relativos a `src/`, `uploads/`, `assets/`).

## Notas de implementação
- Manter **numerais tabulares** em dados (`font-variant-numeric: tabular-nums`) e **títulos em Bricolage (sans), nunca serifados**.
- Componentes são visualmente *stateless*: toda cor vem de token/variante. Preservar variantes de botão, 5 pills de status, KPI dirigido por `--hue`, anel de foco e padrão de ações por linha.
- `color-mix()` é usado extensivamente — se o alvo precisar suportar navegadores antigos, pré-computar os valores por tema.
- Não há dependência de marca de terceiros além do logo EPG fornecido.
