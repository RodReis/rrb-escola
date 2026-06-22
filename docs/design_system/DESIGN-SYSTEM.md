# RRB Escola — Design System

> Sistema de gestão escolar. Estética moderna e **colorida**, com tema **claro e escuro**.
> Marca: **RRB Escola** (logo **EPG**). Sem identidade serifada.
>
> Este documento é a fonte de verdade para implementação. Todos os valores são literais e prontos para conversão (CSS variables + componentes). A folha de tokens canônica é `src/rrb-tokens.css`.

---

## Sumário

1. [Princípios](#1-princípios)
2. [Como o tema funciona (claro/escuro)](#2-como-o-tema-funciona-claroescuro)
3. [Marca e logo](#3-marca-e-logo)
4. [Tipografia](#4-tipografia)
5. [Tokens de cor](#5-tokens-de-cor)
6. [Raio, sombra, espaçamento e movimento](#6-raio-sombra-espaçamento-e-movimento)
7. [Tints temáticos (cores adaptáveis)](#7-tints-temáticos)
8. [Componentes](#8-componentes)
9. [Padrões de layout](#9-padrões-de-layout)
10. [Gráficos](#10-gráficos)
11. [Animações / keyframes](#11-animações--keyframes)
12. [Acessibilidade](#12-acessibilidade)
13. [Inventário de arquivos-fonte](#13-inventário-de-arquivos-fonte)

---

## 1. Princípios

- **Colorido, mas disciplinado.** Uma cor de marca (azul royal) + 7 matizes temáticos usados em KPIs, tags e gráficos. Nunca inventar cores fora da paleta.
- **Tudo via tokens.** Componentes só usam `var(--*)`. Trocar o tema = trocar o valor do token, nunca o componente.
- **Claro e escuro são paritários.** Cada token semântico existe nos dois temas. Cores de matiz ficam mais claras/saturadas no escuro.
- **Densidade de produto.** Tabelas e dashboards densos, fontes pequenas mas legíveis (mín. 10.5px em rótulos auxiliares, 12.5–14px em corpo).
- **Numerais tabulares** em qualquer dado numérico (`font-variant-numeric: tabular-nums`).
- **Sem slop:** sem gradientes gratuitos, sem emoji decorativo (exceto 👋 de saudação), sem cantos arredondados com borda-accent à esquerda como cliché.

---

## 2. Como o tema funciona (claro/escuro)

O tema é controlado por **`data-theme` no elemento `<html>`**, com valores `"light"` (padrão) ou `"dark"`.

```html
<html data-theme="light"> … </html>
```

**Persistência:** salvar em `localStorage` na chave **`rrb-theme`**. Aplicar **antes do paint** para evitar flash:

```html
<script>
  (function () {
    try {
      var t = localStorage.getItem('rrb-theme') || 'light';
      document.documentElement.setAttribute('data-theme', t);
    } catch (e) {}
  })();
</script>
```

**Alternar:**

```js
function setTheme(t) {                       // t = 'light' | 'dark'
  document.documentElement.setAttribute('data-theme', t);
  try { localStorage.setItem('rrb-theme', t); } catch (e) {}
}
```

`color-scheme` é definido em cada tema para que controles nativos (scrollbars, selects) acompanhem.

---

## 3. Marca e logo

- **Nome:** `RRB Escola` — sempre em `--font-display` (Bricolage Grotesque) 700.
- **Subtítulo:** `Gestão Escolar`.
- **Logo:** wordmark **EPG** (formas angulares). Fornecido como PNG transparente em duas versões:
  - `epg-white.png` — letras brancas → usar sobre o **selo de marca** (gradiente azul) ou fundos escuros.
  - `epg-navy.png` — letras navy `#1B368C` → usar sobre fundos claros/brancos.
  - Proporção do recorte ≈ **3.26:1** (largura : altura).

**Selo de marca (badge)** — quadrado arredondado com o EPG branco centralizado:

```html
<span style="
  width:36px; height:36px; border-radius:10px; overflow:hidden;
  display:inline-flex; align-items:center; justify-content:center;
  background:linear-gradient(150deg, var(--brand-500), var(--brand-700));
  box-shadow:0 6px 16px -8px rgba(35,72,201,.6), inset 0 1px 0 rgba(255,255,255,.18);">
  <img src="epg-white.png" alt="EPG" style="width:70%; height:auto; display:block;">
</span>
```

Sobre fundo branco (ex.: chip claro), usar `epg-navy.png` e fundo `#fff`.

---

## 4. Tipografia

Três famílias (Google Fonts):

```html
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,500;12..96,600;12..96,700;12..96,800&family=Geist:wght@300;400;500;600;700&family=Geist+Mono:wght@400;500;600&display=swap" rel="stylesheet">
```

| Token | Família | Uso |
|---|---|---|
| `--font-display` | `'Bricolage Grotesque', 'Geist', system-ui, sans-serif` | Títulos, valores de KPI, números grandes |
| `--font-body` | `'Geist', ui-sans-serif, system-ui, -apple-system, sans-serif` | Interface, corpo, botões |
| `--font-mono` | `'Geist Mono', ui-monospace, 'SF Mono', Menlo, monospace` | IDs, valores, eyebrows, atalhos |

`body` aplica `font-feature-settings: 'ss01'` e `-webkit-font-smoothing: antialiased`.

### Escala de tipo (utilitários)

| Classe | Definição | Exemplo de uso |
|---|---|---|
| `.rb-display` | Bricolage 600, `letter-spacing:-.02em`, `line-height:1.05` | títulos de seção |
| `.rb-mono` | Geist Mono, `tabular-nums` | dados monoespaçados |
| `.rb-num` | `tabular-nums` (mantém a fonte) | qualquer número alinhado |
| `.rb-eyebrow` | Geist Mono, 10.5px, `letter-spacing:.16em`, UPPERCASE, `--brand-600`, 600 | sobrescrita acima de títulos |

```css
.rb-display { font-family: var(--font-display); font-weight: 600; letter-spacing: -0.02em; line-height: 1.05; }
.rb-mono    { font-family: var(--font-mono); font-variant-numeric: tabular-nums; }
.rb-num     { font-variant-numeric: tabular-nums; }
.rb-eyebrow { font-family: var(--font-mono); font-size: 10.5px; letter-spacing: 0.16em; text-transform: uppercase; color: var(--brand-600); font-weight: 600; }
```

### Tamanhos de referência (px)

| Papel | Tamanho / peso / família |
|---|---|
| Display / H1 | 38–62 / 700 / display |
| Title / H2 | 26–28 / 700 / display |
| Heading / H3 | 18 / 600 / body |
| Valor de KPI | 27–28 / 700 / display, tabular |
| Corpo | 14–15 / 400 / body |
| Corpo pequeno / label | 12.5–13 / 500–550 / body |
| Auxiliar / meta | 10.5–11.5 / 500 / body ou mono |
| Eyebrow | 10.5 / 600 / mono, uppercase |

---

## 5. Tokens de cor

### 5.1 Marca e matizes (constantes — não mudam por tema, exceto onde indicado)

```css
:root {
  /* Marca */
  --brand-700: #1B36A6;
  --brand-600: #2348C9;   /* azul royal primário */
  --brand-500: #3A5FE0;
  --brand-400: #6E8BF0;
  --brand-glow: #5B7BFF;

  --red-600: #D8242E;     /* accent secundário (bandeira) */
  --red-500: #EF4452;

  /* Matizes temáticos — KPIs, tags, gráficos */
  --c-blue:   #2E5BE6;
  --c-coral:  #ED4451;
  --c-amber:  #E0A12B;
  --c-green:  #18A05E;
  --c-violet: #8048EC;
  --c-teal:   #12A39A;
  --c-pink:   #E84393;

  /* Status semântico */
  --ok:   #16915A;
  --warn: #C9821A;
  --bad:  #DA2E39;
  --info: var(--brand-600);
}
```

> **No tema escuro**, `--brand-600/500/glow`, todos os `--c-*` e `--ok/--warn/--bad` recebem versões mais claras/saturadas (ver 5.3).

### 5.2 Tema CLARO (padrão)

Aplicado em `:root, [data-theme="light"]`.

```css
color-scheme: light;
--bg:        #F4F6FC;
--bg-grad-a: #EEF2FE;   /* blobs/gradiente de fundo */
--bg-grad-b: #F7F4FB;
--surface:   #FFFFFF;   /* cards, topbar */
--surface-2: #F7F8FD;   /* zebra, headers de tabela, hover sutil */
--surface-3: #EFF2FA;   /* trilhos de segmented, chips neutros */
--border:        #E5E8F2;
--border-soft:   #EEF0F8;   /* divisores internos de linha */
--border-strong: #D2D7E6;   /* contorno de input/botão ghost */

--text:       #0D1428;   /* texto primário */
--text-2:     #2A3450;
--text-soft:  #46506B;   /* labels */
--text-muted: #6B7590;   /* meta, secundário */
--text-faint: #9AA2B8;   /* placeholder, ícones inativos */

--shadow-xs: 0 1px 2px rgba(16,24,48,.06);
--shadow-sm: 0 2px 6px rgba(16,24,48,.07), 0 1px 2px rgba(16,24,48,.05);
--shadow-md: 0 8px 22px -8px rgba(16,24,48,.16), 0 2px 6px -2px rgba(16,24,48,.08);
--shadow-lg: 0 28px 60px -22px rgba(16,24,48,.28), 0 8px 18px -10px rgba(16,24,48,.12);
--shadow-brand: 0 16px 40px -14px rgba(35,72,201,.45);

--tint-strength: 9%;    /* quanto do matiz mistura na superfície */
--tint-border:   22%;
--on-tint:       38%;   /* mistura rumo ao texto p/ rótulo legível sobre tint */
```

### 5.3 Tema ESCURO

Aplicado em `[data-theme="dark"]`.

```css
color-scheme: dark;
--bg:        #080B16;
--bg-grad-a: #0C1124;
--bg-grad-b: #120E22;
--surface:   #121726;
--surface-2: #0E1320;
--surface-3: #1A2133;
--border:        #242B3D;
--border-soft:   #1C2233;
--border-strong: #333B52;

--text:       #EEF1FA;
--text-2:     #D3D9E8;
--text-soft:  #B3BCD2;
--text-muted: #8B96B0;
--text-faint: #5E6880;

/* Marca e matizes mais claros no escuro */
--brand-600: #4E72F0;
--brand-500: #5E80F5;
--brand-glow: #6E8BFF;

--c-blue:   #5E80F5;
--c-coral:  #FF6470;
--c-amber:  #F0B847;
--c-green:  #2FC07C;
--c-violet: #A06CFF;
--c-teal:   #2BC2B8;
--c-pink:   #FF6BB0;

--ok:   #2FB678;
--warn: #E0A93E;
--bad:  #FF5C66;

--shadow-xs: 0 1px 2px rgba(0,0,0,.4);
--shadow-sm: 0 2px 8px rgba(0,0,0,.45), 0 1px 2px rgba(0,0,0,.4);
--shadow-md: 0 10px 26px -8px rgba(0,0,0,.6), 0 2px 8px -2px rgba(0,0,0,.5);
--shadow-lg: 0 30px 64px -20px rgba(0,0,0,.7), 0 10px 22px -10px rgba(0,0,0,.55);
--shadow-brand: 0 18px 46px -14px rgba(78,114,240,.55);

--tint-strength: 16%;
--tint-border:   32%;
--on-tint:       78%;
```

---

## 6. Raio, sombra, espaçamento e movimento

### Raios

```css
--r-xs: 5px;    /* botão sm, tags */
--r-sm: 8px;    /* botão padrão, input */
--r-md: 11px;   /* botão lg, badge da marca */
--r-lg: 16px;   /* cards, KPIs */
--r-xl: 22px;
--r-pill: 999px;
```

### Sombras
Cinco níveis por tema: `--shadow-xs | sm | md | lg | brand` (ver §5). `--shadow-brand` é o glow azul usado em botões primários e estados ativos.

### Espaçamento
Escala informal em px. Padrões recorrentes: **gaps** 2 / 6–8 / 10–14 / 16; **padding de card** 18–26; **padding de página** 20–26 horizontal. Usar sempre `flex`/`grid` com `gap` (nunca margens entre irmãos inline).

### Movimento

```css
--ease:     cubic-bezier(.22,.68,.32,1);   /* padrão UI */
--ease-out: cubic-bezier(.16,1,.3,1);      /* entradas/reveal */
--spring:   cubic-bezier(.34,1.56,.64,1);  /* knobs, modais (overshoot) */
```

Durações típicas: hover/foco **.14–.16s**, transições de painel **.2–.3s**, reveal **.6s**.

---

## 7. Tints temáticos

Helpers que misturam um matiz na superfície atual, adaptando-se ao tema via `--tint-strength`:

```css
:root {
  --tint-blue:   color-mix(in oklab, var(--c-blue)   var(--tint-strength), var(--surface));
  --tint-coral:  color-mix(in oklab, var(--c-coral)  var(--tint-strength), var(--surface));
  --tint-amber:  color-mix(in oklab, var(--c-amber)  var(--tint-strength), var(--surface));
  --tint-green:  color-mix(in oklab, var(--c-green)  var(--tint-strength), var(--surface));
  --tint-violet: color-mix(in oklab, var(--c-violet) var(--tint-strength), var(--surface));
  --tint-teal:   color-mix(in oklab, var(--c-teal)   var(--tint-strength), var(--surface));
  --tint-pink:   color-mix(in oklab, var(--c-pink)   var(--tint-strength), var(--surface));
}
```

**Padrão de uso (rótulo legível sobre tint):**
`color: color-mix(in oklab, var(--c-blue) var(--on-tint), var(--text))`.

> Requer suporte a `color-mix()` (todos os navegadores modernos). É a base dos pills de status, KPIs e estados soft.

---

## 8. Componentes

Todos os componentes abaixo são CSS puro + markup (classes `rb-*`). As versões React/JSX equivalentes estão nos arquivos listados em §13 — mas o contrato visual é este.

### 8.1 Botões — `.rb-btn`

```css
.rb-btn {
  --b-h: 38px;
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  height: var(--b-h); padding: 0 16px;
  border-radius: var(--r-sm);
  font-family: var(--font-body); font-weight: 550; font-size: 13.5px;
  letter-spacing: -0.006em; cursor: pointer; white-space: nowrap;
  border: 1px solid transparent;
  transition: transform .16s var(--ease), box-shadow .2s var(--ease), background .16s var(--ease), border-color .16s var(--ease), color .16s var(--ease);
  text-decoration: none; user-select: none;
}
.rb-btn:active { transform: translateY(1px) scale(.99); }

/* Tamanhos */
.rb-btn.sm { --b-h: 32px; font-size: 12.5px; padding: 0 12px; border-radius: var(--r-xs); }
.rb-btn.lg { --b-h: 46px; font-size: 14.5px; padding: 0 22px; border-radius: var(--r-md); }

/* Variações */
.rb-btn-primary {
  background: linear-gradient(180deg, var(--brand-500), var(--brand-600)); color: #fff;
  box-shadow: 0 1px 0 rgba(255,255,255,.22) inset, var(--shadow-brand);
}
.rb-btn-primary:hover { transform: translateY(-1px); box-shadow: 0 1px 0 rgba(255,255,255,.25) inset, 0 22px 50px -16px rgba(35,72,201,.6); }

.rb-btn-ghost { background: var(--surface); color: var(--text); border-color: var(--border-strong); box-shadow: var(--shadow-xs); }
.rb-btn-ghost:hover { background: var(--surface-2); border-color: var(--text-faint); }

.rb-btn-soft { background: color-mix(in oklab, var(--brand-600) 12%, var(--surface)); color: var(--brand-600); }
.rb-btn-soft:hover { background: color-mix(in oklab, var(--brand-600) 18%, var(--surface)); }

.rb-btn-danger { background: var(--bad); color: #fff; }
.rb-btn-danger:hover { filter: brightness(1.05); transform: translateY(-1px); }

/* Só ícone (quadrado) */
.rb-btn-ghost.icon, .rb-btn-soft.icon { padding: 0; width: var(--b-h); }

.rb-btn:disabled { opacity: .5; cursor: not-allowed; transform: none; }
```

Variações: `primary` (gradiente azul + glow), `ghost` (superfície + borda), `soft` (azul translúcido), `danger` (vermelho). Tamanhos: base, `.sm`, `.lg`. Modificador `.icon` para botão quadrado. Estados: hover (sobe 1px), active (afunda), focus (anel — ver inputs), disabled (opacidade .5). Ícone recomendado 14–15px à esquerda do texto.

```html
<button class="rb-btn rb-btn-primary">Nova matrícula</button>
<button class="rb-btn rb-btn-ghost sm">Exportar</button>
<button class="rb-btn rb-btn-ghost icon" aria-label="Mais">⋯</button>
```

### 8.2 Card — `.rb-card`

```css
.rb-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--r-lg);
  box-shadow: var(--shadow-sm);
}
```
Padding aplicado por contexto (18–26px). Para tabelas, usar `padding:0; overflow:hidden`.

### 8.3 Campos / formulários

```css
.rb-field { display: flex; flex-direction: column; gap: 7px; }
.rb-label { font-size: 12.5px; font-weight: 550; color: var(--text-soft); letter-spacing: -0.005em; }
.rb-input {
  height: 44px; padding: 0 14px;
  background: var(--surface);
  border: 1.5px solid var(--border-strong);
  border-radius: var(--r-sm);
  font-family: var(--font-body); font-size: 14px; color: var(--text);
  transition: border-color .16s var(--ease), box-shadow .16s var(--ease), background .16s var(--ease);
  width: 100%;
}
.rb-input::placeholder { color: var(--text-faint); }
.rb-input:focus {
  outline: none;
  border-color: var(--brand-500);
  box-shadow: 0 0 0 4px color-mix(in oklab, var(--brand-500) 18%, transparent);   /* anel de foco padrão */
}
.rb-input.has-icon { padding-left: 42px; }   /* ícone absoluto à esquerda em 13–14px */
select.rb-input option { background: var(--surface); color: var(--text); }
```

- **Anel de foco** (`box-shadow 0 0 0 4px ...18%`) é o padrão de foco de TODO o sistema (inputs, botões ghost focados).
- **Erro:** `border-color: var(--bad)` + anel `color-mix(in oklab, var(--bad) 16%, transparent)` + mensagem 11.5px em `--bad`.
- **Ícone interno:** wrapper `position:relative`, ícone `position:absolute; left:14px; top:14px`, input com `.has-icon`.
- **Select:** `.rb-input` com `appearance:none` + chevron 16px absoluto à direita.
- **Checkbox:** nativo, `width/height:16–17px; accent-color: var(--brand-600)`.

### 8.4 Switch — `.rb-switch`

```css
.rb-switch .track { width:40px; height:23px; border-radius:999px; background:var(--surface-3);
  border:1px solid var(--border-strong); position:relative;
  transition:background .2s var(--ease), border-color .2s var(--ease); flex-shrink:0; }
.rb-switch .knob { position:absolute; top:2px; left:2px; width:17px; height:17px; border-radius:50%;
  background:#fff; box-shadow:var(--shadow-xs); transition:transform .22s var(--spring); }
.rb-switch.on .track { background:var(--brand-600); border-color:var(--brand-600); }
.rb-switch.on .knob  { transform:translateX(17px); }
```
Markup: `<label class="rb-switch"><span class="track"><span class="knob"></span></span> Texto<input type="checkbox" hidden></label>`. Alternar a classe `.on` no clique.

### 8.5 Pills de status — `.rb-pill`

```css
.rb-pill {
  display: inline-flex; align-items: center; gap: 6px;
  height: 23px; padding: 0 10px; border-radius: var(--r-pill);
  font-size: 11.5px; font-weight: 600; letter-spacing: -0.005em; white-space: nowrap;
}
.rb-pill .dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }

.rb-pill-ok      { background: var(--tint-green); color: color-mix(in oklab, var(--ok)    var(--on-tint), var(--text)); }
.rb-pill-ok   .dot { background: var(--ok); }
.rb-pill-warn    { background: var(--tint-amber); color: color-mix(in oklab, var(--warn)  var(--on-tint), var(--text)); }
.rb-pill-warn .dot { background: var(--warn); }
.rb-pill-bad     { background: var(--tint-coral); color: color-mix(in oklab, var(--bad)   var(--on-tint), var(--text)); }
.rb-pill-bad  .dot { background: var(--bad); }
.rb-pill-info    { background: var(--tint-blue);  color: color-mix(in oklab, var(--c-blue) var(--on-tint), var(--text)); }
.rb-pill-info .dot { background: var(--c-blue); }
.rb-pill-neutral   { background: var(--surface-3); color: var(--text-soft); }
.rb-pill-neutral .dot { background: var(--text-faint); }
```

Variações: `ok` (verde / "Em dia"), `warn` (âmbar / "Aguardando"), `bad` (coral / atraso), `info` (azul / novo), `neutral` (cinza / arquivado). O `.dot` é opcional. Pode levar `.rb-num` para conteúdo numérico.

```html
<span class="rb-pill rb-pill-ok"><span class="dot"></span>Em dia</span>
<span class="rb-pill rb-pill-bad rb-num">-41,9%</span>
```

### 8.6 Tag de contorno — `.rb-tag`

```css
.rb-tag {
  display: inline-flex; align-items: center; gap: 5px;
  height: 24px; padding: 0 9px; border-radius: var(--r-xs);
  font-size: 11.5px; font-weight: 550;
  border: 1px solid var(--border-strong); color: var(--text-soft); background: var(--surface);
}
```
Para tag colorida por categoria, sobrescrever inline:
`style="color:var(--c-violet); border-color:color-mix(in oklab,var(--c-violet) 35%,var(--border))"`.

### 8.7 Tabs segmentadas (segmented)

Trilho `--surface-3` + borda `--border`, pílula ativa em `--surface` com `--shadow-xs`.

```html
<div class="seg">
  <button class="on">Financeiro</button><button>Comercial</button><button>Secretaria</button><button>Pedagógico</button>
</div>
```
```css
.seg { display:inline-flex; gap:2px; background:var(--surface-3); border:1px solid var(--border); border-radius:999px; padding:3px; }
.seg button { border:none; background:transparent; padding:8px 16px; border-radius:999px; font-size:12.5px; font-weight:500;
  color:var(--text-muted); cursor:pointer; font-family:inherit; transition:all .16s var(--ease); }
.seg button.on { background:var(--surface); color:var(--text); box-shadow:var(--shadow-xs); font-weight:600; }
```
Variante "filtro" (pílula ativa **azul cheia**): `.on { background:var(--brand-600); color:#fff; box-shadow:var(--shadow-brand); }`, podendo embutir um contador (`.rb-num` em fundo `rgba(255,255,255,.24)`).

### 8.8 Tabs com underline

```css
.underline-tabs { display:flex; gap:4px; border-bottom:1px solid var(--border); }
.underline-tabs button { border:none; background:none; padding:11px 14px; font-size:13px; font-weight:550;
  color:var(--text-muted); cursor:pointer; position:relative; font-family:inherit; }
.underline-tabs button.on { color:var(--brand-600); }
.underline-tabs button.on::after { content:''; position:absolute; left:10px; right:10px; bottom:-1px; height:2.5px;
  background:var(--brand-600); border-radius:2px; }
```

### 8.9 Breadcrumb

```html
<div class="breadcrumb">
  <a href="#">Gestão</a><span class="sep">/</span><a href="#">Secretaria</a>
  <span class="sep">/</span><span style="color:var(--brand-600);font-weight:550">Alunos</span>
</div>
```
Texto 12.5px `--text-muted`; separador `/` com `opacity:.4`; item atual em `--brand-600` ou `--text`. Pode usar `.rb-mono` UPPERCASE para versão "kicker".

### 8.10 Avatar

Círculo com iniciais. Fundo em **pastel** fixo por pessoa; texto sempre `#20283e` (escuro) para contraste sobre pastel — mantém legibilidade nos dois temas.

```html
<span style="width:34px;height:34px;border-radius:999px;background:#FFD3D3;color:#20283e;
  display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:600;">ME</span>
```
Paleta pastel de avatares: `#FFD3D3 #D6E4FF #FFE6C7 #E8D9FF #D4F0DF #FFD8B0`.
Avatar de usuário/marca pode usar gradiente (ex.: `linear-gradient(135deg, var(--c-coral), #C81515)` com texto branco).

### 8.11 KPI card (cartão colorido)

Cartão com tinta do matiz, glow radial no canto e ícone em chip sólido. Define `--hue` (um dos `--c-*`) e tudo deriva dele.

```css
.kpi {
  position: relative; border-radius: var(--r-lg); padding: 17px 18px 18px; overflow: hidden;
  border: 1px solid color-mix(in oklab, var(--hue) var(--tint-border), var(--border));
  background: linear-gradient(165deg, color-mix(in oklab, var(--hue) calc(var(--tint-strength) + 4%), var(--surface)), var(--surface) 78%);
  transition: transform .2s var(--ease), box-shadow .2s var(--ease);
}
.kpi:hover { transform: translateY(-3px); box-shadow: var(--shadow-md); }
.kpi::after {            /* glow radial decorativo */
  content:''; position:absolute; right:-30px; top:-30px; width:120px; height:120px; border-radius:50%;
  background: radial-gradient(circle, color-mix(in oklab, var(--hue) 28%, transparent), transparent 70%); pointer-events:none;
}
.kpi .ico   { width:34px; height:34px; border-radius:9px; display:inline-flex; align-items:center; justify-content:center;
              color:#fff; background:var(--hue); box-shadow:0 6px 14px -6px var(--hue); }
.kpi .klabel{ font-family:var(--font-mono); font-size:10.5px; letter-spacing:.12em; text-transform:uppercase;
              color:var(--text-muted); margin-top:13px; }
.kpi .kval  { font-family:var(--font-display); font-weight:700; font-size:27px; letter-spacing:-.03em; margin-top:4px;
              font-variant-numeric:tabular-nums; }
```

```html
<div class="kpi" style="--hue:var(--c-blue)">
  <div class="kpi-head"><!-- flex space-between -->
    <span class="ico"><!-- ícone 17px --></span>
    <span class="rb-pill rb-pill-ok rb-num">+8,2%</span>
  </div>
  <div class="klabel">Receita do mês</div>
  <div class="kval">R$ 321.432</div>
</div>
```
Trocar `--hue` por `--c-coral`/`--c-green`/`--c-violet`/etc. para cada KPI. O delta usa pill (`ok`=positivo bom, `bad`=negativo/ruim, `neutral`).

### 8.12 Tabela / grid

Tabela densa baseada em CSS Grid (linhas como grid para alinhamento e ações por linha) ou `<table>`. Contrato visual:

- **Header:** fundo `--surface-2`, borda inferior `--border`, rótulos 10.5px 600 UPPERCASE `letter-spacing:.05em` `--text-muted`.
- **Linhas:** altura 52–56px; divisor `--border-soft`; hover `--surface-2`; selecionada `color-mix(in oklab, var(--brand-600) 6%, var(--surface))` + barra esquerda 3px `--brand-600`.
- **Célula nome:** avatar 32–34px + nome 13px 600 + ID em `.rb-mono` 10.5px `--text-muted`.
- **Numerais** em `.rb-mono`/`.rb-num`.
- **Coluna de ações** alinhada à direita (ver 8.13).
- **Footer:** `--surface-2`, "Mostrando X–Y de N" + paginação.

```css
.tbl { width:100%; border-collapse:separate; border-spacing:0; font-size:13px; }
.tbl thead th { text-align:left; font-size:10.5px; font-weight:600; letter-spacing:.06em; text-transform:uppercase;
  color:var(--text-muted); padding:11px 14px; background:var(--surface-2); border-bottom:1px solid var(--border); position:sticky; top:0; }
.tbl tbody td { padding:12px 14px; border-bottom:1px solid var(--border-soft); }
.tbl tbody tr { transition:background .12s var(--ease); cursor:pointer; }
.tbl tbody tr:hover { background:var(--surface-2); }
.tbl tbody tr.sel  { background: color-mix(in oklab, var(--brand-600) 7%, var(--surface)); }
.tbl tbody tr:last-child td { border-bottom:none; }
```
Para grid: `display:grid; grid-template-columns: 34px 2.3fr 1fr 1.1fr 1.4fr 1.2fr 116px; gap:14px;` repetido em header e linhas.

### 8.13 Ações por linha (in-grid)

Botões-ícone 30×30 que ganham cor no hover. Visíveis a ~55% de opacidade, 100% no hover da linha.

```css
.row-action { width:30px; height:30px; border-radius:8px; border:1px solid transparent; cursor:pointer;
  display:inline-flex; align-items:center; justify-content:center; color:var(--text-faint);
  background:transparent; transition:all .14s var(--ease); }
/* hover: --c é a cor do tom (ex.: var(--c-green) p/ WhatsApp, var(--brand-600) p/ editar) */
.row-action:hover { color:var(--c); border-color:color-mix(in oklab,var(--c) 40%,var(--border));
  background:color-mix(in oklab,var(--c) 12%,var(--surface)); }
```
Trio típico: **mensagem** (verde), **editar** (azul-marca), **mais** (neutro). Container: `display:flex; gap:3px; justify-content:flex-end; opacity:.55` → `1` quando a linha está em hover/selecionada.

### 8.14 Barra de ações em massa (bulk bar)

Aparece acima do header da tabela quando ≥1 linha é selecionada.

```css
.bulk-bar { display:flex; align-items:center; gap:12px; padding:0 16px; height:50px;
  background: color-mix(in oklab, var(--brand-600) 9%, var(--surface));
  border-bottom: 1px solid color-mix(in oklab, var(--brand-600) 22%, var(--border));
  animation: rbSlideDown .22s var(--ease-out); }
```
Conteúdo: "**N** selecionado(s)" em `--brand-600` 600 + divisor + botões `.rb-btn.rb-btn-ghost.sm` (Mensagem, Gerar boleto, Exportar, Excluir [vermelho]) + "Limpar seleção" à direita.

### 8.15 Paginação

```css
.pg-btn { min-width:32px; height:32px; border:1px solid var(--border-strong); border-radius:8px;
  background:var(--surface); color:var(--text-soft); font-size:12.5px; font-weight:600; cursor:pointer; padding:0 9px; }
.pg-btn.on { border:none; background:var(--brand-600); color:#fff; box-shadow:var(--shadow-brand); }
```
Sequência: `‹ 1 2 3 … 129 ›`. Botão ativo em azul cheio.

### 8.16 Lista com avatar

Linhas de 11px de padding, divisor `--border-soft`, hover `--surface-2`, raio 10px. Avatar + (nome 13–13.5 600 / meta 11–11.5 muted) + valor `.rb-num` + pill de status à direita. Usada em "Inadimplência recente", "Leads quentes", etc.

### 8.17 Modal

```css
.scrim { position:fixed; inset:0; background:rgba(8,12,24,.5); backdrop-filter:blur(3px); z-index:90;
  display:flex; align-items:center; justify-content:center; opacity:0; transition:opacity .22s var(--ease); }
.scrim.show { opacity:1; }
.modal { width:min(440px,92vw); background:var(--surface); border:1px solid var(--border); border-radius:var(--r-lg);
  box-shadow:var(--shadow-lg); padding:24px; transform:translateY(12px) scale(.98); transition:transform .26s var(--spring); }
.scrim.show .modal { transform:none; }
```
Estrutura: eyebrow + título (`.rb-display` ~21px) + botão fechar (ghost icon sm) + corpo 14px `--text-soft` + rodapé de ações alinhado à direita (ghost + primary/danger).

### 8.18 Drawer (painel lateral)

```css
.drawer { position:fixed; top:0; right:0; bottom:0; width:min(420px,92vw);
  background:var(--surface); border-left:1px solid var(--border); box-shadow:var(--shadow-lg); z-index:91;
  transform:translateX(100%); transition:transform .3s var(--ease-out); padding:24px; overflow:auto; }
.drawer.show { transform:none; }
```
Mesmo scrim do modal. Cabeçalho: avatar + nome/ID + fechar. Corpo: pills/tags, mini-KPI, dados, botão primário full-width.

### 8.19 Botão-ícone de topbar — `IconBtn`

36×36, borda `--border-strong`, fundo `--surface`→`--surface-2` no hover, cor `--text-soft`. Suporta ponto de notificação (`--c-coral`, anel `--surface`). Usado para tema, sino, etc.

### 8.20 Empty state

Ícone 64×64 em chip soft de marca (`color-mix brand 12% surface` + borda `brand 22%`), título `.rb-display` 22px, descrição 13.5px muted, pill neutro "Em construção".

---

## 9. Padrões de layout

### 9.1 Shell da aplicação
`height:100vh; display:flex; flex-direction:column; background:var(--bg); overflow:hidden`. Topbar fixa (não rola) + `<main>` rolável com `.rb-scroll`.

### 9.2 Topbar
Altura 62px, `background:var(--surface)`, borda inferior `--border`, `--shadow-xs`, `z-index:30`. Da esquerda p/ direita: **selo EPG + marca** (com divisor `--border` à direita) · **nav** (links pílula) · *spacer* · **busca** (`.rb-input.has-icon` 230px + atalho `⌘K`) · **chip de ano letivo** · **toggle de tema** · **sino** · **botão de usuário** (nome/cargo + avatar gradiente).

Link de nav:
```
height:34px; padding:0 12px; border-radius:9px; font-size:12.5px; gap:7px;
inativo:  color:var(--text-muted)
hover:    color:var(--text); background:var(--surface-3)
ativo:    color:var(--brand-600); background:color-mix(in oklab,var(--brand-600) 12%,var(--surface)); font-weight:600
```

### 9.3 Fundo com blobs (telas de login/hero)
```css
body { background:
  radial-gradient(1200px 600px at 12% -8%, var(--bg-grad-a), transparent 60%),
  radial-gradient(1000px 520px at 92% -4%, var(--bg-grad-b), transparent 55%),
  var(--bg); }
```
Para mesh animado, blobs `border-radius:50%; filter:blur(70px); opacity:.4` em `--c-*`, animando `transform` com `@keyframes drift` (18s, alternate). Manter sutil (opacidade ≤ .5).

### 9.4 Cabeçalho de página
Eyebrow (`.rb-eyebrow` ou breadcrumb mono) → título `.rb-display`/Bricolage 700 (26–28px) + chip de contagem (`rb-pill-info`) → subtítulo 13.5 muted. Ações à direita (`.rb-btn`). **Importante:** títulos de página são **sans (Bricolage)**, nunca serifados.

### 9.5 Barra de filtros
`--surface`, borda inferior `--border`, `flex; gap:12; wrap`. Segmented de níveis (variante azul com contador) + busca + chips de filtro (label muted + valor 600 + chevron) + botão de "mais filtros" (ícone).

### 9.6 Grades de dashboard
KPIs: `grid-template-columns: repeat(4,1fr); gap:15`. Gráficos: `1.5fr 1fr`. Barras+lista: `1fr 1.2fr`. Conteúdo central com `max-width:1320px; margin:0 auto`. Responsivo: colapsar para 2 colunas em < 860px.

---

## 10. Gráficos

Todos em **SVG inline**, traçados com `currentColor`/tokens — sem libs.

- **Área/linha (sparkline):** `<path>` de área com gradiente vertical (`stop` do matiz .26→0) + `<path>` de linha `stroke-width:2.5` + ponto final destacado (`r:4.5`, `stroke:var(--surface)`). Gerar os pontos normalizando a série no viewBox.
- **Donut:** dois círculos `r:15.9` em viewBox `0 0 42 42`; trilho `--surface-3`, arco `stroke-dasharray="{pct} {100-pct}"` `stroke-dashoffset:25` `transform:rotate(-90)`, `stroke-linecap:round`, `stroke-width:5.5`; `%` em texto central Bricolage 700.
- **Barras:** colunas flex (`align-items:stretch`, container `height:132`), cada barra `height:{pct}%` (o pai precisa ter altura definida!) com gradiente `linear-gradient(180deg, var(--c-x), color-mix(... 45% surface))`, raio `7px 7px 3px 3px`, `min-height:4px`, entrada `rbGrow`. Valor acima, rótulo abaixo.

> ⚠️ Em barras com `height:%`, o **container precisa de altura fixa** e os filhos `align-items:stretch` (senão a % resolve contra 0).

---

## 11. Animações / keyframes

```css
@keyframes rbGrow       { from { transform: scaleY(0); transform-origin: bottom; } }   /* barras */
@keyframes rbSlideDown  { from { opacity: 0; transform: translateY(-6px); } }          /* bulk bar */
@keyframes drift        { 0%{transform:translate(0,0) scale(1)} 100%{transform:translate(40px,30px) scale(1.12)} } /* blobs */
@keyframes sp           { to { transform: rotate(360deg) } }                            /* spinner */

/* Reveal (entrada com stagger) — base escondido, .ready libera */
[data-reveal]            { opacity:0; transform:translateY(14px); }
body.ready [data-reveal] { opacity:1; transform:none;
  transition:opacity .6s var(--ease-out), transform .6s var(--ease-out);
  transition-delay: calc(var(--i,0) * 60ms); }
```

- **Spinner:** `width:13px;height:13px;border:2px solid color-mix(in oklab,var(--brand-600) 30%,transparent);border-top-color:var(--brand-600);border-radius:50%;animation:sp .7s linear infinite`.
- **Reveal robusto:** disparar `.ready` via `requestAnimationFrame` + `load` + `setTimeout(…,250)` para nunca ficar invisível em iframe throttled.
- **`prefers-reduced-motion`:** o token base já zera durações:
  ```css
  @media (prefers-reduced-motion: reduce) { * { animation-duration:.001ms!important; transition-duration:.001ms!important; } }
  ```

---

## 12. Acessibilidade

- **Foco:** anel `0 0 0 4px color-mix(... 18%)` em qualquer campo/controle interativo. Não remover sem substituir.
- **Contraste:** texto sobre tints usa `--on-tint` (38% claro / 78% escuro) para manter AA. Texto de avatar é sempre `#20283e` sobre pastel.
- **Alvos de toque:** mín. 30px (ações de linha) / 36–44px (controles principais).
- **`aria-label`** obrigatório em botões só-ícone. `alt="EPG"` no logo.
- **`color-scheme`** definido por tema para UI nativa.
- Numerais sempre tabulares para leitura em colunas.

---

## 13. Inventário de arquivos-fonte

| Arquivo | Conteúdo |
|---|---|
| `src/rrb-tokens.css` | **Tokens canônicos** + utilitários de tipo + classes de componente (`rb-btn`, `rb-card`, `rb-input`, `rb-field`, `rb-label`, `rb-pill*`, `rb-tag`, `rb-scroll`, `rb-display/mono/num/eyebrow`). |
| `src/icons.jsx` | Set de ícones `I.*` (stroke, 24×24, `currentColor`) + selo de marca. |
| `src/sistema-shell.jsx` | Topbar, nav, busca, toggle de tema, IconBtn, brand badge, shell. |
| `src/sistema-dashboard.jsx` | KPI cards, AreaChart, Donut, Bars, SegTabs, MiniList, dados por aba (Financeiro/Comercial/Secretaria/Pedagógico). |
| `src/sistema-alunos.jsx` | Grid/tabela, filtros, chips, ações por linha, bulk bar, paginação, empty state. |
| `src/sistema-app.jsx` | Roteamento (Dashboard/Alunos/placeholders), tema, painel de Tweaks. |
| `src/login.jsx` | Tela de login (variações Aurora claro / Spotlight escuro), Mark (selo EPG), inputs. |
| `assets/epg-white.png`, `assets/epg-navy.png` | Logo EPG transparente (branco / navy). Também em `uploads/`. |
| **Telas de referência** | `RRB Escola - Design System.html` (showcase), `RRB Escola - Sistema.html` (app: dashboard + alunos), `RRB Escola - Login.html` (logins). |

### Ordem de carregamento (HTML)
1. Fontes (Google) → 2. `rrb-tokens.css` → 3. script pre-paint de tema → 4. React 18.3.1 + ReactDOM + Babel standalone (versões fixas) → 5. `icons.jsx` → componentes → `tweaks-panel.jsx` → `*-app.jsx`.

### Contrato para conversão (ex.: React/Tailwind/Vue)
- Mapear cada `--token` para a camada de tema (CSS vars permanecem a forma recomendada; o switch é só o atributo `data-theme`).
- Componentes são **stateless visualmente** — todo estado de cor vem de token/variante. Preservar: variantes de botão, 5 pills de status, KPI dirigido por `--hue`, anel de foco, hover de subir 1px no primário, e o padrão de ações por linha.
- Manter números tabulares e títulos em Bricolage (sans), **sem serifa**.

---

*Fim. Qualquer componente novo deve reusar tokens existentes; não introduzir cores cruas fora da paleta.*
