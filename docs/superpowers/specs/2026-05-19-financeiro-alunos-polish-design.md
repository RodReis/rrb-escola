# Polish abas Financeiro + Alunos — Design

**Data:** 2026-05-19
**Branch alvo:** feature-mvp2
**Escopo:** Dashboard executivo, abas Financeiro + Alunos

## Contexto

Sprint anterior polimos aba Pedagógico com padrão consistente:
- Header com ícone+título h3+subtítulo
- Métrica principal grande no header right
- Empty states com ícone grande centralizado + mensagem
- Avatares em listas de pessoas
- Section headers separando blocos
- Hover transitions, gradient tasteful

Este spec replica o padrão nas abas Financeiro (10 cards) e Alunos (12 cards), mantendo data layer intacto.

## Padrão visual (referência)

```tsx
// Header padrão
<div className="flex items-start justify-between gap-4">
  <div className="flex items-center gap-2">
    <span className="grid h-9 w-9 place-items-center rounded-ui bg-X/10 text-X">
      <Icon size={16} />
    </span>
    <div>
      <h3 className="text-sm font-bold text-ink">Título</h3>
      <p className="text-[0.66rem] text-ink/55">subtítulo</p>
    </div>
  </div>
  {/* Métrica destaque opcional right */}
</div>

// Empty state padrão
<div className="mt-6 flex flex-col items-center justify-center gap-2 rounded-ui bg-muted/40 py-10 text-ink/40">
  <Icon size={28} />
  <p className="text-sm">Mensagem amigável.</p>
</div>

// Section header
<header className="flex items-baseline gap-3 border-l-2 border-brand/40 pl-3">
  <h2 className="text-base font-bold text-ink">Título</h2>
  <p className="text-xs text-ink/55">Subtítulo</p>
</header>
```

## Mudanças por componente

### Aba Financeiro

| Componente | Mudança |
|------------|---------|
| **HeroFinancial** | Mantém grid 4col (já bom). Padroniza tipografia label p/ ser consistente. |
| **FolhaRatioCard** | Header novo (Folha/Receita + subtítulo "Indicador trabalhista"). Métrica % no header right (já tem mas mover). |
| **TicketCard** | Header novo (Ticket Médio + "últimos 6 meses"). Valor mantido grande, spark abaixo. |
| **BolsistasReceitaCard** | Header novo + empty state com ícone grande. |
| **SaldoYTDCard** | Header novo (Saldo YTD + "acumulado do ano"). |
| **RealizadoProjetadoCard** | Header novo (Realizado vs Projetado + "Por etapa de ensino"). Taxa realização no header right. |
| **AlertList** | Header novo (Alertas + "Itens que precisam de atenção"). Empty state com ícone. |
| **RevenueTrendChart** | Header novo (Receita × Custos + "Tendência 6 meses"). |
| **ProximasCobrancasCard** | Header novo. Total mantido. Avatar do aluno na lista (foto + iniciais). Empty state com ícone. |
| **TopCategoriasCard** | Header novo (Top categorias de despesa + "Distribuição mensal"). Total no header right. Empty state. |
| **FolhaEmpresas** | Header novo (Folha por empresa + "Distribuição por CNPJ"). Total bruto no header right. Empty state. |

### Aba Alunos

| Componente | Mudança |
|------------|---------|
| **MetricRing** | Header padronizado com ícone (TrendingUp). Subtítulo. |
| **FrequenciaCard** | Header novo (Frequência + "últimos 30 dias"). Taxa no header right. |
| **BeneficiosCard** | Header novo (Benefícios + "Bolsas, permutas e gratuidades"). Total no header right. |
| **ResumoInline** | Inline article virou componente com header (Resumo + "Pagantes × beneficiados"). |
| **RankingTurmasCard** | Header novo (Ranking turmas + "por ocupação"). Top 3 destacado (gold gradient como ranking alunos). |
| **AniversariantesCard mensal** | Header novo padrão. Manter design existente. |
| **AniversarioMatriculaCard** | Header novo. Manter design. |
| **SaudeSistemaCard** | Header novo (Saúde do sistema + "Configurações pendentes"). |
| **RenovacoesPendentes** | Header novo. Avatar aluno + ordenação por urgência. Empty state com ícone. |
| **TopDevedores** | Header novo. Avatar aluno. Empty state com ícone. |

### Data layer changes

- `ProximaCobrancaRow` precisa `fotoUrl` (atualmente só `alunoId`, `alunoNome`).
- `DevedorRow` precisa `fotoUrl`.
- `RenovacaoRow` precisa `fotoUrl` (e `alunoId` se já não tem).

### Section headers nas duas abas

**Financeiro:**
1. (KPIs hero — sem header)
2. (Quarteto métricas — sem header)
3. "Performance e projeção" antes RealizadoProjetado
4. "Alertas e tendência" antes AlertList + RevenueTrend
5. "Operação" antes ProximasCobrancas + TopCategorias + FolhaEmpresas

**Alunos:**
1. (Quarteto métricas — sem header)
2. "Matrículas e ocupação" antes StageTable
3. "Aniversários e fidelidade" antes Semana + (RankingTurmas+Mensal) + AniversarioMatricula
4. "Operação" antes SaudeSistema + RenovacoesPendentes/TopDevedores

## Não-objetivos

- Não mudar lógica de dados.
- Não adicionar novas métricas/cards.
- Não mudar layout grid de alto nível (mantém 2col/4col existentes).
- Não tocar StageTable, AniversariantesSemanaCard (já polidos).

## Critérios de sucesso

- Todos os cards usam o padrão de header (ícone + h3 + subtítulo).
- Cards com listas de pessoas mostram avatar.
- Empty states com ícone grande centralizado.
- Section headers separam grupos visualmente.
- Typecheck passa.
- Validação visual no browser pelas duas abas.
