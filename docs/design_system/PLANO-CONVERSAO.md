# Plano de Conversão de Layout — CRM Escola → Design System

> **Para quem:** Claude Code (CLI), executando dentro de `C:\Desenv\Projetos\rrb-escola`.
> **Fonte de verdade visual:** `docs/design_system/DESIGN-SYSTEM.md` + `docs/design_system/src/rrb-tokens.css`.
> **Regras persistentes:** `docs/design_system/REGRAS-CLAUDE-CODE.md` (leia ANTES de tocar em qualquer arquivo).
> **Estratégia aprovada:** **Híbrido** — (a) camada de tema + primitivos + shell reaproveitando nomes existentes (re-skin de todas as páginas) **e** (b) reconstrução **pixel-perfeita** das 3 telas de referência (Login, Dashboard, Alunos) contra o protótipo, com verificação por screenshot-diff.

---

## 0. Princípio diretor (leia primeiro)

O codebase **já é token-based**. NÃO reescreva as 98 páginas. A conversão é feita em **3 camadas compartilhadas** e as páginas herdam o novo visual automaticamente:

1. **Tokens** — `src/app/globals.css` (`:root` / `[data-theme]`) + `tailwind.config.ts`.
2. **Primitivos** — as classes `@layer components` (`ds-*`) em `globals.css` e os componentes em `src/components/ui/*`.
3. **Shell** — `src/app/(app)/layout.tsx` + `src/components/layout/*` (topbar, nav, dropdowns, etc.).

Depois disso, só restam **toques cirúrgicos** em arquivos com cor crua ou serifa.

### Por que isto funciona (números reais do codebase, jun/2026)

| Sinal | Arquivos | Ação |
|---|---|---|
| Usam cores tokenizadas do Tailwind (`text-ink`, `bg-surface`, `border-line`…) | **201** | Re-skin automático ao repontar `--color-*` |
| Usam classes `ds-*` (`ds-card`, `ds-button`, `ds-dt`…) | **95** | Re-skin automático ao reescrever as classes |
| Têm hex hardcoded (`#1B3FB8`, etc.) | **16** | Toque manual (Fase 5) |
| Usam serifa (`font-serif`/`font-display`/`Instrument_Serif`) | **26** | Migrar para sans (Fase 5) — colisão obrigatória |

**Meta:** ~95% do re-skin vem das Fases 1–4 (poucos arquivos, alto alcance). A Fase 5 limpa hex/serifa residual. **A Fase 6 reconstrói pixel-a-pixel as 3 telas de referência.** A Fase 7 é o QA.

### Escopo do "pixel-perfeito" (leia com atenção)

Pixel-perfeito só é **definível onde existe protótipo para comparar**. Existem **3**, e o app já tem as telas correspondentes:

| Tela de referência (protótipo) | Arquivo no app | Meta |
|---|---|---|
| `CRM Escola - Login.html` / `src/login.jsx` | `src/app/(auth)/login/page.tsx` | **Pixel-perfeito** |
| `CRM Escola - Sistema.html` (Dashboard) / `src/sistema-dashboard.jsx` | `src/app/(app)/page.tsx` | **Pixel-perfeito** |
| `src/sistema-alunos.jsx` (Alunos) | `src/app/(app)/alunos/page.tsx` | **Pixel-perfeito** |

As **outras ~95 páginas não têm protótipo** — não há ground truth para medir pixel. Meta delas: **consistência com o DS** via os primitivos das Fases 1–4. Não tente "adivinhar" um pixel-perfeito inexistente; isso só gera divergência arbitrária.

> Os protótipos usam dados **mock**. O pixel-perfeito é do **layout/estilo** (espaçamento, cor, tipografia, raios, sombras, estados), não do conteúdo — as telas reais consomem dados do Supabase.

---

## 1. Pré-requisitos e travas

- **Branch dedicada:** `git checkout -b feat/design-system-conversion`. Commits pequenos por fase.
- **Build verde a cada fase:** `npm run typecheck && npm run build` precisa passar antes de fechar uma fase.
- **Não tocar em lógica:** Server Components, data fetching, Server Actions, Supabase, permissões — **inalterados**. A conversão é visual.
- **Sem libs novas de UI.** Já existe `lucide-react`, `clsx`, `tailwind-merge`, `recharts`. Não introduzir nada.
- **`color-mix(in oklab, …)`** é usado pelo DS. Alvo são navegadores modernos — aceito. Não pré-computar.

---

## 2. Mapa de tokens (antigo → novo) — a tradução central

O sistema atual expõe cores ao Tailwind como **triplets RGB** em `--color-*` (formato `rgb(var(--color-x) / <alpha>)`). O DS usa **hex** em vars semânticas (`--surface`, `--text`, `--brand-600`…).

**Decisão:** manter os nomes `--color-*` (para o Tailwind continuar funcionando) **e** adicionar a camada de tokens hex do DS (para as classes `ds-*`/primitivos). Os dois conjuntos apontam para os **mesmos valores**.

### 2.1 Repontar os `--color-*` existentes (converter o hex do DS para triplet `R G B`)

| Token Tailwind | Hoje (light) | **Novo (light)** | **Novo (dark)** | Origem no DS |
|---|---|---|---|---|
| `--color-paper` | `248 250 252` | `244 246 252` | `8 11 22` | `--bg` |
| `--color-surface` | `255 255 255` | `255 255 255` | `18 23 38` | `--surface` |
| `--color-muted` | `241 245 249` | `239 242 250` | `26 33 51` | `--surface-3` |
| `--color-ink` | `15 23 42` | `13 20 40` | `238 241 250` | `--text` |
| `--color-line` | `214 225 237` | `229 232 242` | `36 43 61` | `--border` |
| `--color-brand` | `27 79 216` | `35 72 201` | `78 114 240` | `--brand-600` |
| `--color-primary` | `27 79 216` | `35 72 201` | `78 114 240` | `--brand-600` |
| `--color-accent` | `255 36 36` | `216 36 46` | `239 68 82` | `--red-600/500` |
| `--color-danger` | `190 50 50` | `218 46 57` | `255 92 102` | `--bad` |
| `--color-warning` | `201 151 54` | `201 130 26` | `224 169 62` | `--warn` |
| `--color-success` | `50 132 84` | `22 145 90` | `47 182 120` | `--ok` |

> Os nomes Tailwind `moss` (=primary), `clay` (=danger), `gold` (=warning), `brand`, `accent`, `surface`, `muted`, `success`, `warning`, `danger` continuam válidos em `tailwind.config.ts`. **Não renomear** — só mudam de valor.

### 2.2 Adicionar a camada hex do DS (copiar de `rrb-tokens.css`)

Trazer para `globals.css`, dentro de `:root`/`[data-theme="light"]`/`[data-theme="dark"]`, **na íntegra**, os blocos do `rrb-tokens.css`:

- Marca: `--brand-700/600/500/400`, `--brand-glow`, `--red-600/500`.
- Hues: `--c-blue/coral/amber/green/violet/teal/pink`.
- Status: `--ok/warn/bad/info`.
- Superfícies extra: `--surface-2`, `--surface-3`, `--bg-grad-a/b`.
- Bordas: `--border`, `--border-soft`, `--border-strong`.
- Texto: `--text`, `--text-2`, `--text-soft`, `--text-muted`, `--text-faint`.
- Raios: `--r-xs/sm/md/lg/xl/pill`.
- Sombras: `--shadow-xs/sm/md/lg/brand`.
- Movimento: `--ease`, `--ease-out`, `--spring`.
- Tints (`--tint-*`) + `--tint-strength/border` + `--on-tint`.
- Fontes: `--font-display`, `--font-body`, `--font-mono`.

### 2.3 Reconciliar variáveis de raio/sombra duplicadas

- `--radius-ui` → passa a valer `var(--r-sm)` (8px). `--radius-panel` → `var(--r-lg)` (16px).
- `--shadow-soft` → `var(--shadow-sm)`; `--shadow-lift` → `var(--shadow-md)`.
- Manter os nomes antigos como **aliases** apontando para os novos (zero churn no Tailwind/JS).

---

## 3. Fases

Cada fase tem **escopo de arquivos**, **o que fazer** e **critério de aceite**. Execute em ordem.

### Fase 1 — Fontes (corrige a colisão serifa)

**Arquivos:** `src/app/layout.tsx`.

- Trocar `Inter` → **Geist** e `Instrument_Serif` → **remover**. Adicionar **Bricolage_Grotesque** e **Geist_Mono** (todos via `next/font/google`).
- Variáveis CSS:
  - `--font-sans` → Geist (mantém o nome; Tailwind `font-sans` continua).
  - `--font-display` → Bricolage Grotesque (pesos 400–800).
  - `--font-mono` → Geist Mono.
  - **`--font-serif`: remover.** Não existe serifa no DS.
- Em `tailwind.config.ts`: trocar `serif: [...]` por `display: ["var(--font-display)", ...]` e `mono: ["var(--font-mono)", ...]`. Remover a família `serif`.

**Aceite:** `npm run build` passa; nenhuma referência a `Instrument_Serif` resta; `font-display` deixa de ser itálico-serifado.

---

### Fase 2 — Tokens (`globals.css` + `tailwind.config.ts`)

**Arquivos:** `src/app/globals.css`, `tailwind.config.ts`.

- Aplicar **toda** a §2 deste plano (repontar `--color-*`, adicionar camada hex do DS, reconciliar raios/sombras).
- Garantir os 3 blocos de tema: `:root, [data-theme="light"]` e `[data-theme="dark"]` — **paridade total** de tokens nos dois temas (regra do DS: todo token semântico existe nos dois).
- Atualizar o seletor `body` para `background: var(--bg); color: var(--text); font-family: var(--font-body);` e `font-feature-settings:'ss01'`.
- Redefinir `.font-display` (classe legada usada em 26 arquivos) para **Bricolage sans, não-itálico**: `font-family: var(--font-display); font-weight:600; letter-spacing:-.02em;` e **remover `font-style: italic`**. Isso conserta os 26 arquivos de uma vez.
- Atualizar os estilos globais de `input/select/textarea/label` para o contrato do DS (`§8.3`): borda `1.5px var(--border-strong)`, raio `var(--r-sm)`, anel de foco `0 0 0 4px color-mix(in oklab, var(--brand-500) 18%, transparent)`.

**Aceite:** abrir 3 páginas (Dashboard `/`, `/alunos`, `/financeiro`) em claro e escuro — cores, fundo e foco já refletem o DS; nenhuma página quebra layout.

---

### Fase 3 — Primitivos: classes `ds-*` (`globals.css @layer components`)

**Arquivos:** apenas `src/app/globals.css` (bloco `@layer components`).

Reescrever cada classe para o **contrato visual do DS** (`DESIGN-SYSTEM.md §8`), consumindo os tokens da Fase 2. Mapa classe→spec:

| Classe atual | Vira (spec DS) |
|---|---|
| `.ds-button` + `-primary/-accent/-secondary` | `.rb-btn` base + `primary` (gradiente azul + `--shadow-brand`, sobe 1px no hover), `ghost` (=secondary), `soft`, `danger` — §8.1 |
| `.ds-card` / `.ds-panel` | `.rb-card` (`--surface`, `--border`, `--r-lg`, `--shadow-sm`) — §8.2 |
| `.ds-kicker` | `.rb-eyebrow` (mono, 10.5px, `.16em`, uppercase, `--brand-600`) — §4 |
| `.ds-heading` / `-counter` / `.ds-subhead` | título Bricolage 700 26–28px (**sans**); counter vira `rb-pill-info`; subhead 13.5 `--text-muted` — §9.4 |
| `.ds-breadcrumb` | §8.9 (12.5px `--text-muted`, sep `/` opacity .4, atual `--brand-600`) |
| `.ds-kpi-*` | KPI dirigido por `--hue` (§8.11): tinta, glow radial, ícone em chip, valor Bricolage 27px tabular. Adicionar suporte a `style="--hue:var(--c-blue)"` |
| `.ds-status` / `-success/-warning/-danger/-neutral` | `.rb-pill` 5 variantes (`ok/warn/bad/info/neutral`) com `.dot` — §8.5 |
| `.ds-dt` (DataTable v2) | §8.12 (header `--surface-2` 10.5px uppercase; linha 52–56px; hover `--surface-2`; selecionada tint azul + barra esquerda 3px) |
| `.ds-dt-foot` | footer `--surface-2` "Mostrando X–Y de N" — §8.12 |
| `.ds-chip` | segmented filtro azul com contador — §8.7 (variante filtro) |
| `.ds-dropdown` | chip de filtro (label muted + valor 600 + chevron) — §9.5 |
| `.ds-search-inline` | `.rb-input.has-icon` — §8.3 |
| `.ds-pager` | §8.15 (ativo azul cheio `--shadow-brand`) |
| `.ds-avatar` | §8.10 — usar **pastel fixo + texto `#20283e`** (não `--brand` translúcido) |
| `.ds-topbar` | será reescrita na Fase 4 |

Adicionar também (novas, do DS): `.rb-tag` (§8.6), `.rb-switch` (§8.4), animações `rbGrow`/`rbSlideDown`/`drift` (§11) e os utilitários `.rb-display/.rb-mono/.rb-num/.rb-eyebrow/.rb-scroll`.

**Aceite:** botões mostram gradiente + glow; pills nas 5 cores; tabela de `/alunos` com header claro, hover e seleção corretos; KPIs coloridos por hue no Dashboard.

---

### Fase 4 — Shell (topbar, nav, layout do app)

**⚠️ Decisão de identidade — confirme o visual da topbar.** Hoje a topbar é uma **barra azul com gradiente** (`#1B3FB8→#15349E`, texto branco, pills brancas). O DS especifica topbar em **`--surface`** (branco no claro / escuro no escuro), com pills ativas em **tint de marca** (`color-mix(brand 12%, surface)`) e altura **62px**. Adotar o padrão DS (recomendado pela spec). Se o usuário quiser manter a barra azul, é a única divergência intencional permitida — registrar.

**Arquivos:** `src/app/(app)/layout.tsx`, `src/components/layout/topbar.tsx`, `topbar-nav-link.tsx`, `topbar-user-card.tsx`, `notification-bell.tsx`, `ano-letivo-picker.tsx`, `*-dropdown.tsx`, `dropdown-*.tsx`, `src/components/ui/theme-toggle.tsx`.

- **Topbar (`topbar.tsx`):** trocar o `style` inline (gradiente/hex) por `background: var(--surface)`, `border-bottom: 1px solid var(--border)`, `box-shadow: var(--shadow-xs)`, `height: 62px`, `z-index:30`. Remover **todos** os `#1B3FB8`, `white/70`, `#15349E`, `black/20`. `BrandBlock`: selo EPG = quadrado `--r-md` com `linear-gradient(150deg, var(--brand-500), var(--brand-700))` + logo branco (usar `assets/epg-white.png` se aplicável); marca em `--font-display`, subtítulo `--text-muted`.
- **`topbar-nav-link.tsx`:** estados conforme §9.2 — inativo `--text-muted`; hover `--text` + `--surface-3`; ativo `--brand-600` + `color-mix(brand 12%, surface)` + `font-weight:600`. Remover hex/branco.
- **`theme-toggle.tsx`:** manter a lógica. **Manter a chave de localStorage `'theme'`** (não migrar para `'rrb-theme'`; o script pre-paint em `layout.tsx` já usa `'theme'`). Reestilizar como `IconBtn` 36×36 (§8.19) ou switch sol/lua.
- **`layout.tsx` (app):** ajustar `min-h-[calc(100vh-72px)]` para a nova altura (62px) e `--bg` no shell. Considerar `.rb-scroll` no `<main>`.

**Aceite:** topbar em superfície clara/escura, nav com pill azul no item ativo, busca/sino/ano/usuário alinhados; nenhum hex cru resta em `src/components/layout/*` (`grep` abaixo retorna 0).

---

### Fase 5 — Toques cirúrgicos (hex cru + serifa residual) — *(antes "Fase 5")*

**Arquivos:** os 16 com hex + os 26 com serifa (listas geradas pelos greps da §4).

- Substituir cada hex por token: cores de marca → `var(--brand-600)`/classe Tailwind `brand`; vermelhos → `--c-coral`/`--bad`; etc. Avatares com gradiente podem manter pastel/`#20283e` conforme §8.10 (exceção documentada).
- Trocar `font-serif`/`className="font-display"` que dependiam de itálico-serifado por título Bricolage. Como `.font-display` já foi neutralizado na Fase 2, a maioria se resolve sozinha — revisar apenas onde o itálico era intencional (não deve haver, o DS não tem serifa).
- **Gráficos (`recharts`)** em `src/components/dashboard/*`: trocar cores hardcoded por tokens de hue (`--c-blue`, `--c-green`…) lidos via CSS var. Não reescrever os componentes.

**Aceite:** `grep` de hex em `src` retorna apenas exceções documentadas (paleta pastel de avatar). Dashboard com gráficos nas cores do DS.

---

### Fase 6 — Reconstrução pixel-perfeita das 3 telas de referência

Só começar **depois** que tokens/primitivos/shell (Fases 1–5) estiverem prontos — assim a reconstrução usa os mesmos tokens e não cria estilo paralelo.

**Setup do alvo visual (uma vez):**

1. Servir os protótipos estáticos para ter a imagem-alvo renderizada:
   ```bash
   npx --yes serve "docs/design_system/html" -l 5055   # ou: python3 -m http.server 5055 --directory docs/design_system
   ```
   Telas: `http://localhost:5055/CRM Escola - Login.html`, `… - Sistema.html`. Conferir também os PNGs em `docs/design_system/pages/*` (claro/escuro) e os PDFs.
2. Subir o app: `npm run dev` (porta 3000).
3. Script de diff com o **puppeteer já instalado** (criar em `scripts/visual-diff.mjs`): para cada par (protótipo, rota do app), em **claro e escuro** e em larguras 1440 e 1280, capturar screenshot dos dois, sobrepor e gerar uma imagem de diferença + % de pixels divergentes. Guardar em `docs/design_system/_diff/`.

**Por tela — reconstruir contra a spec correspondente:**

- **Login** (`(auth)/login/page.tsx`): layout split 2 colunas (esquerda `flex:1.14` painel de marca com blobs animados; direita `flex:1` card `max-width:396px`). Variante Aurora (claro) e Spotlight (escuro). Selo EPG 52px, eyebrow mono, título Bricolage 56px, campos `.rb-input` (email c/ ícone, senha c/ toggle olho), checkbox "Manter conectado", link "Esqueci a senha", botão primário full-width, toggle de tema. Ref: README §1 + `src/login.jsx`. **Preservar a autenticação atual** — só o layout muda.
- **Dashboard** (`(app)/page.tsx`): cabeçalho (eyebrow + "Olá, … 👋" Bricolage 28 + data + ações), abas segmentadas (Financeiro/Comercial/Secretaria/Pedagógico), grid de KPIs `repeat(4,1fr)` coloridos por `--hue`, gráficos `1.5fr 1fr` (área + donut), barras `1fr 1.2fr` + lista. Manter os componentes de dados já existentes em `src/components/dashboard/*`, reposicionando/retematizando para bater com o protótipo. Ref: README §2 + `src/sistema-dashboard.jsx` + DESIGN-SYSTEM §9.6/§10.
- **Alunos** (`(app)/alunos/page.tsx`): breadcrumb mono, título "Alunos" (Bricolage, **sans**) + chip de contagem, ações Exportar/Importar/Novo, 3 stats, barra de filtros (segmented de níveis azul c/ contador + busca + chips), tabela grid `34px 2.3fr 1fr 1.1fr 1.4fr 1.2fr 116px` (checkbox/Aluno/Turma/Plano/Responsável/Status/Ações), bulk bar ao selecionar, footer com paginação. Ref: README §3 + `src/sistema-alunos.jsx` + DESIGN-SYSTEM §8.12–8.15.

**Loop de iteração:** rodar `node scripts/visual-diff.mjs` → abrir o diff → ajustar espaçamento/cor/tipografia → repetir até o diff cair abaixo do limite (ver aceite). Diferenças aceitáveis: conteúdo de dados real ≠ mock, e fontes podem ter ~1px de hinting. **Não** aceitar divergência de layout, cor, raio, sombra ou estado.

**Aceite:** diff de pixels **< 2%** (ignorando regiões de conteúdo dinâmico) em cada tela, em claro e escuro, a 1440px. Estados interativos (hover de linha, foco, seleção, abas, toggle de senha, blobs do login) conferidos manualmente contra o protótipo. Imagens de diff arquivadas em `docs/design_system/_diff/`.

---

### Fase 7 — Auditoria visual e QA

- Rodar a app (`npm run dev`) e revisar em **claro e escuro**: Dashboard, Alunos, Financeiro, Matrículas, um formulário (ex.: `/alunos/novo`), uma tela de relatório, modal/dialog (`src/components/ui/dialog.tsx`) e a topbar.
- Checar anel de foco em inputs/botões, contraste de texto sobre tints, numerais tabulares em colunas.
- `npm run typecheck && npm run build && npm run test` verdes.
- Revisar diff por fase; abrir PR.

---

## 4. Comandos de auditoria (use para gerar listas e validar)

```bash
# Arquivos com hex cru (alvo da Fase 5; deve cair para ~exceções de avatar)
grep -rlE "#[0-9a-fA-F]{6}" src --include=*.tsx

# Ocorrências e quais hex (priorize os mais frequentes)
grep -rhoE "#[0-9a-fA-F]{6}" src --include=*.tsx | sort | uniq -c | sort -rn

# Serifa residual (deve chegar a 0 após Fases 1–2, exceto intencional)
grep -rlE "font-serif|Instrument_Serif" src --include=*.tsx

# Hex cru no shell (deve ser 0 ao fim da Fase 4)
grep -rnE "#[0-9a-fA-F]{6}" src/components/layout

# Garantir que nenhuma cor crua nova foi introduzida fora de tokens
grep -rnE "rgb\(|rgba\(" src/app/globals.css   # revisar manualmente
```

---

## 5. Riscos e armadilhas (do DS e do codebase)

1. **Topbar é troca de identidade, não re-skin.** É a maior divergência. Confirme o alvo (DS = barra clara) antes da Fase 4.
2. **Serifa proibida.** `.font-display` itálico-serifado conflita com o DS. Neutralizar na Fase 2 conserta 26 arquivos; não reintroduzir serifa.
3. **Chave de tema.** Manter `'theme'` (não `'rrb-theme'`) — o pre-paint em `layout.tsx` já usa essa chave. Mudar quebraria a persistência atual.
4. **Triplet vs hex.** O Tailwind consome `--color-*` como `R G B`. Ao converter hex do DS, gere o triplet correto (ex.: `#2348C9` → `35 72 201`). Não cole hex onde se espera triplet.
5. **Barras com `height:%`** (gráficos do DS) exigem container de altura fixa — só relevante se algum gráfico for reconstruído (não é o caso; usamos recharts).
6. **`color-mix(oklab)`** não tem fallback aqui — aceito para navegadores modernos. Não tente pré-computar (explodiria a manutenção).
7. **Paridade de tema.** Todo token novo precisa existir em light **e** dark. Faltar um token no dark gera "buraco" visual.
8. **Não tocar em `src/components/*/` de lógica** (forms, server actions). Mudança visual ≠ mudança de comportamento.

---

## 6. Ordem de execução resumida

```
branch  →  Fase 1 Fontes  →  Fase 2 Tokens  →  Fase 3 Primitivos ds-*  →
Fase 4 Shell/topbar  →  Fase 5 Toques cirúrgicos (hex/serifa/charts)  →
Fase 6 Pixel-perfeito das 3 telas (screenshot-diff < 2%, claro+escuro)  →
Fase 7 QA  →  PR
```

Commit ao fim de cada fase, com build verde. Nunca avance com `typecheck`/`build` quebrados.
