# Year Picker — Design Spec

**Data:** 2026-05-18
**Status:** Aprovado

## Objetivo

Ativar o botão "2026.1" na topbar como seletor de ano letivo funcional. Mudar o ano sincroniza `?ano=` e `?competencia=` na URL, fazendo o dashboard e o organograma responderem ao ano selecionado.

## Mecanismo

URL como única fonte de verdade: `?ano=2026&competencia=2026-05`.

- `?ano` controla `ano_letivo` em todas as queries de matrículas/turmas/ocupação.
- Mudar o ano via picker seta automaticamente `?competencia={ano}-01` (vai para janeiro do ano selecionado).
- `?competencia` continua funcionando independentemente dentro do ano (o `CompetenciaPicker` já existente não muda).
- Fallback: se `?ano` ausente ou inválido → `new Date().getFullYear()`.

## Lista de Anos

Dinâmica: `SELECT DISTINCT ano_letivo FROM turmas WHERE escola_id = ? ORDER BY ano_letivo DESC`. Query feita no `AppLayout` (server), resultado passado como prop para `<Topbar>` → `<AnoLetivoPicker>`. Lista pequena (2-5 itens), cache Next.js natural.

## Componentes

### `<AnoLetivoPicker>` — novo Client Component
`src/components/layout/ano-letivo-picker.tsx`

- Props: `anos: number[]`, `current: number`
- Lê `?ano` via `useSearchParams()`
- Ao mudar: `router.push("/?ano={ano}&competencia={ano}-01")`
- Estilo: substitui o `<button>` estático atual na topbar, mantém visual idêntico (fundo `bg-white/10`, borda `border-white/[0.12]`, texto branco)
- Exibe `{ano}` (sem ".1" — semestres fora de escopo)

### `<Topbar>` — modificar
- Recebe nova prop `anosLetivos: number[]`
- Substitui `<button>` estático por `<AnoLetivoPicker anos={anosLetivos} current={anoAtual} />`
- `anoAtual` derivado de `searchParams` não está disponível no layout server — passa `anosLetivos` apenas; o componente client lê o `?ano` atual da URL via `useSearchParams()`

### `AppLayout` — modificar
- Busca `distinct ano_letivo from turmas` para `escola_id` do perfil
- Passa `anosLetivos` para `<Topbar>`

## Funções do Data Layer a Parametrizar

Adicionar `anoLetivo: number = new Date().getFullYear()` como último parâmetro (com default) em:

| Função | Arquivo | Linha aprox |
|--------|---------|-------------|
| `getOcupacao` | dashboard-executive.ts | 278 |
| `getStageBreakdown` | dashboard-executive.ts | 352 |
| `getBeneficios` | dashboard-executive.ts | 763 |
| `getAlertas` | dashboard-executive.ts | 710 |
| `getFrequenciaResumo` | dashboard-executive.ts | 840 |
| `getRankingTurmas` | dashboard-executive.ts | 956 |
| `getFrequenciaPorTurma` | dashboard-executive.ts | 1145 |
| `getAniversariantesMatricula` | dashboard-executive.ts | 1293 |
| `getRealizadoVsProjetado` | dashboard-executive.ts | 1067 |

`getSaldoYTD` já tem `anoLetivo` como parâmetro — só precisa ser passado no `page.tsx`.

Internamente cada função substitui `const anoLetivo = new Date().getFullYear()` pelo parâmetro recebido.

## Dashboard `page.tsx`

- `searchParams` ganha `ano?: string`
- Valida: `const anoLetivo = isValidAno(params.ano, anosDisponiveis) ? Number(params.ano) : new Date().getFullYear()`
- `isValidAno`: checa se é número inteiro >= 2000 e <= 2100
- Passa `anoLetivo` para todas as funções parametrizadas acima

## Organograma

`src/lib/data/organograma.ts`: substituir hardcoded `2026` por parâmetro `anoLetivo: number = new Date().getFullYear()` em `getOrganogramaTree` e `getOrganogramaDrill`.

`src/app/(app)/organograma/page.tsx`: lê `searchParams.ano`, passa para as funções.

## Fora de Escopo

- Semestres ("2026.1" / "2026.2")
- Persistir preferência de ano por usuário
- Filtrar outras páginas (bolsistas, relatórios) pelo ano — apenas dashboard e organograma nesta fase
