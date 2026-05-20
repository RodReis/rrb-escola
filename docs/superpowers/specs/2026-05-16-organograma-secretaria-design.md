# Organograma de Alunos + Menu Secretaria

**Data:** 2026-05-16  
**Status:** Aprovado

---

## Contexto

Escola RRB usa o sistema Lectiva. Atualmente o menu da topbar é flat (primaryItems + secondaryItems). O objetivo é agrupar os cadastros num menu "Secretaria" com dropdown, e criar uma nova página `/organograma` que mostra a hierarquia Escola → Segmento → Série → Turma → Aluno com métricas financeiras por turma.

---

## 1. Banco de Dados

### Nova tabela `segmentos`

```sql
create table segmentos (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references escolas(id) on delete cascade,
  nome text not null,
  ordem integer not null default 0,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  unique (escola_id, nome)
);
```

### Coluna `segmento_id` em `series`

```sql
alter table series
  add column segmento_id uuid references segmentos(id) on delete set null;
```

### Seed — 4 segmentos + associações

| Segmento | Ordem | Séries associadas |
|---|---|---|
| Educação Infantil | 1 | Maternal, Infantil 1, Infantil 2, Infantil 3, Infantil 4, Infantil 5 |
| Ensino Fundamental I | 2 | 1º Ano, 2º Ano, 3º Ano, 4º Ano, 5º Ano |
| Ensino Fundamental II | 3 | 6º Ano, 7º Ano, 8º Ano, 9º Ano |
| Ensino Médio | 4 | 1ª Série, 2ª Série, 3ª Série |

Séries sem segmento (Infantil I, II, III): ficam `segmento_id = null`, não aparecem no organograma.

### RLS

`segmentos`: mesmas políticas das demais tabelas (`service_role full access` + `authenticated` read via escola_id do perfil).

---

## 2. Menu Secretaria — Dropdown na Topbar

### Comportamento

- Item "Secretaria" na topbar (ícone `BookOpen`) abre dropdown ao clicar
- Dropdown fecha ao clicar fora (click-outside) ou ao navegar
- Implementado como Client Component leve (apenas o dropdown é client, topbar continua server)

### Itens do dropdown Secretaria

| Label | Rota | Ícone |
|---|---|---|
| Alunos | `/alunos` | `UsersRound` |
| Matrículas | `/matriculas` | `FileText` |
| Séries | `/series` | `Layers3` |
| Turmas | `/turmas` | `GraduationCap` |
| Organograma | `/organograma` | `Network` |
| Importações | `/importacoes` | `Inbox` |

### Reorganização do menu atual

**primaryItems** (mantém):
- Dashboard, Financeiro, Portaria

**primaryItems** (move para Secretaria):
- Alunos, Matrículas

**secondaryItems** (move para Secretaria):
- Séries, Turmas, Importações

**secondaryItems** (mantém como secundários):
- Usuários, Planos, Frequência, Rel. Alunos, Inadimplência, Rel. Frequência

---

## 3. Rota `/organograma`

### Layout

Layout de 2 colunas fixo:
- Sidebar esquerda: 280px fixa, scroll independente
- Painel direito: flex-1, conteúdo principal

### 3a. Sidebar

**Estrutura:**
```
🔍 [Busca: aluno ou turma]

📍 Colégio RRB
   499 alunos · 4 segmentos

● Educação Infantil    117 · 7 turmas  ▼
  ▪ Maternal - A          7 alunos
  ▪ Maternal - B          6 alunos
  ▪ ...

● Ensino Fundamental I  223 · 10 turmas  ▶
● Ensino Fundamental II 120 · 4 turmas   ▶
● Ensino Médio           39 · 3 turmas   ▶
```

- Segmentos colapsáveis (click toggle)
- Dentro de cada segmento: turmas direto (sem nível série intermediário — séries são só agrupamento visual)
- Turma selecionada: borda esquerda azul (`border-l-2 border-brand`)
- Busca: filtra turmas e alunos inline (client-side sobre dados já carregados)
- Cor do bullet por segmento: amarelo, azul, verde, vermelho (igual à imagem)

### 3b. Painel direito — estado default (sem turma selecionada)

Cards de resumo da escola:
- Total alunos
- Total matrículas ativas
- Soma mensalidades mês atual
- Ticket médio geral

### 3c. Painel direito — drill de turma

URL: `/organograma?turma=<turma_id>`

**Header:**
```
Detalhamento da turma  [DRILL]
                        Educação Infantil · Maternal - A
```

**3 cards:**
- ALUNOS: contagem
- SOMA DA SALA: soma `cobrancas.valor_final` competencia mês atual, status != cancelada
- TICKET MÉDIO: soma / contagem

**Tabela:**
| # | Aluno | Resp. Financ. | Mensalidade |
|---|---|---|---|
| 1 | Nome do aluno | Nome resp. financeiro | R$ 690,00 |

- Resp. financeiro: primeiro `responsaveis_aluno` com `responsavel_financeiro = true`; se nenhum: "-"
- Mensalidade: `cobrancas.valor_final` do mês atual para aquele aluno; se não encontrar: "-"
- Ordenado por nome do aluno

### 3d. Dados — queries

**Sidebar (server, carregado 1x):**
```
segmentos → series(segmento_id) → turmas → matriculas(status=ativa, count)
```

**Drill turma (server, por turma_id via searchParam):**
```
matriculas(turma_id, status=ativa)
  → alunos(nome, matricula_codigo)
  → responsaveis_aluno(responsavel_financeiro=true, nome)
  → cobrancas(aluno_id, competencia=YYYY-MM-atual, status!=cancelada, valor_final)
```

---

## 4. Arquivos a criar/modificar

### Criar
- `supabase/migrations/YYYYMMDD_segmentos.sql` — tabela + seed
- `src/lib/data/organograma.ts` — queries sidebar + drill
- `src/app/(app)/organograma/page.tsx` — page server component
- `src/components/organograma/sidebar.tsx` — sidebar client (busca + collapse)
- `src/components/organograma/drill-panel.tsx` — painel direito server
- `src/components/layout/secretaria-dropdown.tsx` — dropdown client component

### Modificar
- `src/components/layout/topbar.tsx` — adicionar SecretariaDropdown, reorganizar items
- `supabase/migrations/` — alter series add segmento_id

---

## 5. Fora do escopo

- Edição de segmentos via UI (apenas migration/seed)
- Drill por série (só por turma)
- Export do organograma
- Filtro por ano letivo (fixo 2026)
