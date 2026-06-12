# Lectiva Design System

Base visual do sistema escolar CRM Escola.

## Direcao

- Marca: azul profundo com diagonal vermelha.
- Interface interna: operacional, densa e limpa, com topbar horizontal.
- Landing/login: mais expressiva, com marca forte no primeiro viewport.
- Temas: claro e escuro por variaveis CSS, respeitando `prefers-color-scheme` sem armazenamento no cliente.

## Tokens

Os tokens ficam em `src/app/globals.css` e sao consumidos pelo Tailwind em `tailwind.config.ts`.

- `paper`: fundo geral da aplicacao.
- `surface`: superficies de cards, formularios e tabelas.
- `muted`: areas secundarias.
- `ink`: texto principal.
- `line`: bordas.
- `brand` e `moss`: cor principal.
- `accent`: vermelho da marca.
- `clay`: erro/perigo.
- `gold`: alerta.

## Componentes

- `Topbar`: shell principal das telas internas.
- `TopbarNavLink`: link de navegacao com estado ativo por rota e `aria-current`.
- `ThemeToggle`: alternancia entre sistema, claro e escuro apenas em memoria/DOM, sem `localStorage` ou cookies.
- Acao de saida: botao iconico no `Topbar`, executado por Server Action e redirecionando para `/login`.
- `Button` e `ButtonLink`: acoes primarias, secundarias, destaque e ghost.
- `Card` e `Panel`: superficies padronizadas.
- `PageHeader`: cabecalho reutilizavel de modulo.
- `Badge`: indicador de status com tons semanticos.

## Regras

- Nao usar `localStorage`, cookies ou persistencia no cliente para tema.
- O tema pode ser alternado por `data-theme` no elemento `html`, mas a escolha nao deve ser persistida no navegador.
- Preferir tokens (`bg-surface`, `text-ink`, `border-line`) a cores soltas.
- Usar `ds-panel`, `ds-card`, `ds-button` e `ds-table` para novas telas.
- Migrar telas existentes por modulo para reduzir risco visual e funcional.
